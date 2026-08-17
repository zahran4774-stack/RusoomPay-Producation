// app/api/send-whatsapp/route.ts — إرسال واتساب عبر Twilio (محميّ)
// P0-4: مصادقة إلزامية + تحديد معدّل + التحقّق أن المستلم من مدرسة المستخدم.
// تحديث: دعم قوالب Twilio Content API (ContentSid) بجانب النص الحر القديم.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// تطبيع رقم للمقارنة: أرقام فقط، وإسقاط بادئة الدولة/الأصفار للمقارنة المرنة
function normalizePhone(p: string): string {
  const digits = (p || '').replace(/\D/g, '')
  return digits.replace(/^0+/, '')
}

// خريطة القوالب المعتمدة — الاسم المستخدم بالكود ↔ Content SID الحقيقي من Twilio
// حدّث القيم هنا فقط إذا أنشأت قالب جديد أو غيّرت واحد قديم
const TEMPLATES = {
  fee_reminder: 'HX26a44583bfcd9f3d2f93ff88c9d7abd4', // تذكير رسوم — {{1}} مدرسة {{2}} ولي أمر {{3}} طالب {{4}} مبلغ
  payment_full: 'HX6cf023d78afdf4050b79163f78cb823e', // تأكيد سداد كامل — {{1}} مدرسة {{2}} ولي أمر {{3}} مبلغ {{4}} طريقة {{5}} طالب
  payment_partial: 'HX03029915d074ff446d676551c48e2416', // تأكيد سداد جزئي — نفس السابق + {{6}} متبقي
  parent_invite: 'HXcc8f0f4041f592b2d182e0610915671b', // دعوة تفعيل حساب (v2 — أُعيدت صياغته كـUtility بعد رفض النسخة الأولى) — {{1}} مدرسة {{2}} رقم هاتف
  admin_new_sub: 'HX815c4c62648c90c9e502021720ba7e98', // إشعار اشتراك جديد للإدارة — {{1}} مدرسة {{2}} باقة {{3}} طريقة دفع
  general_reminder: 'HXc750c19902eccb2ac11f5c5c6f7f1c98', // تذكير عام — {{1}} مدرسة
} as const

type TemplateName = keyof typeof TEMPLATES

export async function POST(req: NextRequest) {
  try {
    // 1) المصادقة — لا إرسال بلا تسجيل دخول
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    // 2) الدور — الطاقم فقط (لا أولياء أمور ولا طلاب)
    const { data: myRole } = await supabase.rpc('my_role')
    if (!['owner', 'admin', 'accountant'].includes(myRole as string)) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
    }

    // 3) تحديد المعدّل — 30 رسالة كل 5 دقائق لكل مستخدم
    const rl = await checkRateLimit(`wa:${user.id}`, 30, 300)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. حاول بعد قليل.', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    // 4) التحقّق من المدخلات
    // مسارين: (أ) قالب معتمد via template + variables — الطريقة الصحيحة لأي رسالة يبدأها النظام
    //         (ب) body حر — يعمل فقط داخل نافذة 24 ساعة من آخر رسالة من المستلم، وإلا يفشل من Twilio
    let payload: { to?: string; body?: string; template?: string; variables?: Record<string, string> }
    try { payload = await req.json() } catch {
      return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 })
    }
    const to = String(payload?.to ?? '').trim()
    const body = payload?.body ? String(payload.body).trim() : ''
    const template = payload?.template as TemplateName | undefined
    const variables = payload?.variables

    if (!to) {
      return NextResponse.json({ error: 'المستلم مطلوب' }, { status: 400 })
    }
    if (!template && !body) {
      return NextResponse.json({ error: 'يجب تحديد template أو body' }, { status: 400 })
    }
    if (template && !TEMPLATES[template]) {
      return NextResponse.json(
        { error: `قالب غير معروف: ${template}`, availableTemplates: Object.keys(TEMPLATES) },
        { status: 400 }
      )
    }
    if (body.length > 1000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 })
    }

    // 5) عزل المستأجر — المستلم يجب أن يكون ولي أمر/طالب في مدرسة المستخدم
    const { data: school } = await supabase
      .from('profiles').select('school_id').eq('id', user.id).single()
    if (!school?.school_id) {
      return NextResponse.json({ error: 'لا مدرسة مرتبطة بحسابك' }, { status: 403 })
    }

    const target = normalizePhone(to)
    const { data: students } = await supabase
      .from('students').select('guardian_phone').eq('school_id', school.school_id)

    const allowed = (students ?? []).some(
      (s) => s.guardian_phone && normalizePhone(s.guardian_phone) === target
    )
    if (!allowed) {
      return NextResponse.json({ error: 'المستلم ليس ولي أمر في مدرستك' }, { status: 403 })
    }

    // 6) الإرسال عبر Twilio
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM
    if (!sid || !token || !from) {
      return NextResponse.json({ error: 'إعدادات Twilio ناقصة' }, { status: 500 })
    }

    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const params = new URLSearchParams()
    params.append('To', toFormatted)
    params.append('From', from)

    if (template) {
      // إرسال عبر قالب معتمد — الطريقة الصحيحة لأي رسالة يبدأها النظام (تذكير، تأكيد دفع، إشعار)
      params.append('ContentSid', TEMPLATES[template])
      if (variables && Object.keys(variables).length > 0) {
        params.append('ContentVariables', JSON.stringify(variables))
      }
    } else {
      // نص حر — يعمل فقط ضمن نافذة 24 ساعة من رسالة واردة من المستلم
      params.append('Body', body)
    }

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.message || 'twilio error', code: data.code }, { status: res.status })
    }
    return NextResponse.json({ success: true, sid: data.sid, status: data.status })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'خطأ' }, { status: 500 })
  }
}
