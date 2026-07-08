// app/api/payments/submit/route.ts
// مثال تطبيقي يجمع الحمايات الثلاث: تحديد المعدّل + التحقّق من المدخلات + التعامل الرشيق.
// نقطة دخول حسّاسة (دفع) — محميّة بالكامل.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'
import { validate, paymentSubmitSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()

  try {
    // 1) المصادقة — لا دفع بلا تسجيل دخول
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    // 2) تحديد المعدّل — 10 محاولات دفع كل 5 دقائق لكل مستخدم
    const rl = await checkRateLimit(`pay:${user.id}`, 10, 300)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة. حاول بعد قليل.', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    // 3) التحقّق من المدخلات وتنظيفها
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'جسم الطلب غير صالح' }, { status: 400 })
    }
    const v = validate(paymentSubmitSchema, body)
    if (!v.ok) {
      return NextResponse.json({ error: 'بيانات غير صالحة', details: v.errors }, { status: 422 })
    }

    // 4) التنفيذ عبر RPC الآمنة (submit_payment تتحقّق من الملكية والمبلغ)
    const { error } = await supabase.rpc('submit_payment', {
      p_fee_id: v.data.feeId,
      p_amount: v.data.amount,
      p_method: v.data.method,
      p_bank_ref: v.data.bankRef ?? null,
    })
    if (error) {
      return NextResponse.json({ error: error.message, requestId }, { status: 400 })
    }

    return NextResponse.json({ ok: true, remaining: rl.remaining })
  } catch (e) {
    // 5) تعامل رشيق — يُسجّل دون تسريب التفاصيل
    try {
      const sb = await createClient()
      await sb.rpc('log_error', {
        p_source: 'api', p_severity: 'error',
        p_message: (e as Error).message,
        p_context: { path: '/api/payments/submit' }, p_request_id: requestId,
      })
    } catch { /* تجاهل */ }
    return NextResponse.json({ error: 'خطأ غير متوقّع', requestId }, { status: 500 })
  }
}
