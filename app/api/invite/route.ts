// إرسال بريد دعوة موظف عبر Resend
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const ROLE_AR: Record<string, string> = {
  admin: 'إداري',
  accountant: 'محاسب',
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('role, school_id').eq('id', user.id).single()

    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
    }

    // حدّ: 20 دعوة كل ساعة لكل مستخدم — يمنع استغلال المرسل no-reply@rusoompay.com
    const rl = await checkRateLimit(`invite:${user.id}`, 20, 3600)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'محاولات كثيرة. حاول لاحقاً.' }, { status: 429 })
    }

    const input = await req.json().catch(() => null) as { email?: unknown; name?: unknown; role?: unknown } | null
    const email = typeof input?.email === 'string' ? input.email.trim() : ''
    const name = typeof input?.name === 'string' ? input.name.trim() : ''
    const role = typeof input?.role === 'string' ? input.role : ''
    if (!email || !name) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    if (email.length > 200 || name.length > 100 || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'خدمة البريد غير مُهيّأة' }, { status: 500 })
    }

    const { data: school } = await supabase
      .from('schools').select('name').eq('id', profile.school_id).single()
    const schoolName = esc(school?.name ?? 'مدرستك')

    const signupUrl = 'https://rusoompay.com'
    const roleAr = ROLE_AR[role] ?? 'موظف'

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#F4F6FA;font-family:'Cairo',Tahoma,Arial,sans-serif;color:#1a2530">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(10,37,64,.08)">
    <div style="background:#0F2744;padding:22px 24px;color:#fff">
      <div style="font-size:19px;font-weight:800">${schoolName}</div>
      <div style="font-size:12.5px;opacity:.75;margin-top:3px">دعوة للانضمام إلى نظام إدارة المدرسة</div>
    </div>
    <div style="padding:26px 24px">
      <p style="font-size:15px;margin:0 0 14px">مرحباً ${esc(name)}،</p>
      <p style="font-size:14px;line-height:1.9;color:#445;margin:0 0 18px">
        تمت دعوتك للانضمام إلى نظام <b>${schoolName}</b> بصلاحية <b>${roleAr}</b>.
        لتفعيل حسابك، سجّل في المنصة باستخدام هذا البريد بالذات:
      </p>
      <div style="background:#F7F9FC;border:1px solid #E3E8EE;border-radius:10px;padding:13px 16px;margin-bottom:20px;text-align:center">
        <div style="font-size:11.5px;color:#8A94A6;margin-bottom:4px">بريد التسجيل</div>
        <div style="font-size:15px;font-weight:700;color:#0F2744;direction:ltr">${esc(email)}</div>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${signupUrl}" style="display:inline-block;background:#163B68;color:#fff;text-decoration:none;padding:13px 34px;border-radius:11px;font-size:15px;font-weight:800">
          الدخول إلى المنصة
        </a>
      </div>
      <div style="background:#FBF3D5;border:1px solid #EAD9A0;border-radius:10px;padding:13px 16px;font-size:12.5px;color:#8A6D0F;line-height:1.8">
        ⚠️ استخدم نفس البريد أعلاه عند التسجيل — سيُربط حسابك بالمدرسة وصلاحيتك تلقائياً عند أول دخول.
      </div>
    </div>
    <div style="border-top:1px solid #EEF2F7;padding:16px 24px;font-size:11.5px;color:#9AA7B8;text-align:center">
      صادر عن نظام RusoomPay لإدارة المدارس
    </div>
  </div>
</body></html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'RusoomPay <no-reply@rusoompay.com>',
        to: [email],
        subject: `دعوة للانضمام إلى نظام ${school?.name ?? 'مدرستك'}`,
        html,
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('Resend error:', detail)
      return NextResponse.json({ error: 'تعذّر إرسال البريد', detail }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('invite route error:', e)
    return NextResponse.json({ error: 'خطأ غير متوقع' }, { status: 500 })
  }
}
