// app/api/send-notify-admin/route.ts
// تنبيه واتساب لمالك المنصة فقط — رقمه ثابت من متغيّر بيئة (لا يُمرَّر من الواجهة إطلاقاً).
// يُستخدم لإشعارات تشغيلية للمنصة نفسها (مثل: اشتراك مدرسة ينتظر الاعتماد).
// يعيد استخدام نفس بيانات اعتماد Twilio المستخدَمة في send-whatsapp.
import { NextResponse } from 'next/server'

const ADMIN_PHONE = process.env.PLATFORM_ADMIN_WHATSAPP // مثال: 96895476649 (بدون + وبدون whatsapp:)

export async function POST(req: Request) {
  try {
    const { body } = await req.json()
    if (!body || typeof body !== 'string') {
      return NextResponse.json({ success: false, error: 'نص الرسالة مطلوب' }, { status: 400 })
    }
    if (!ADMIN_PHONE) {
      return NextResponse.json({ success: false, error: 'رقم مالك المنصة غير مُعرَّف (PLATFORM_ADMIN_WHATSAPP)' }, { status: 500 })
    }

    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM
    if (!sid || !token || !from) {
      return NextResponse.json({ success: false, error: 'إعدادات Twilio ناقصة' }, { status: 500 })
    }

    const to = `whatsapp:+${ADMIN_PHONE.replace(/[^\d]/g, '')}`
    const params = new URLSearchParams({ From: from, To: to, Body: body })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      },
      body: params,
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ success: false, error: data.message || 'فشل إرسال Twilio' }, { status: 502 })
    }
    return NextResponse.json({ success: true, sid: data.sid })
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'خطأ غير معروف' }, { status: 500 })
  }
}
