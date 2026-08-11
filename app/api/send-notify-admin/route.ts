// app/api/send-notify-admin/route.ts
// تنبيه واتساب لمالك المنصّة — رقمه ثابت من متغيّر بيئة (لا يُمرَّر من الواجهة).
// P0-5: مصادقة إلزامية + تحديد معدّل. يمنع الغرباء من إزعاج المالك.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ADMIN_PHONE = process.env.PLATFORM_ADMIN_WHATSAPP

export async function POST(req: NextRequest) {
  try {
    // 1) المصادقة — لا إرسال بلا تسجيل دخول
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    // 2) تحديد المعدّل — 5 تنبيهات كل 5 دقائق لكل مستخدم
    const rl = await checkRateLimit(`notify-admin:${user.id}`, 5, 300)
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'محاولات كثيرة. حاول بعد قليل.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
      )
    }

    // 3) التحقّق من المدخلات
    let payload: { body?: string }
    try { payload = await req.json() } catch {
      return NextResponse.json({ success: false, error: 'جسم الطلب غير صالح' }, { status: 400 })
    }
    const body = String(payload?.body ?? '').trim()
    if (!body) {
      return NextResponse.json({ success: false, error: 'نص الرسالة مطلوب' }, { status: 400 })
    }
    if (body.length > 1000) {
      return NextResponse.json({ success: false, error: 'الرسالة طويلة جداً' }, { status: 400 })
    }

    if (!ADMIN_PHONE) {
      return NextResponse.json({ success: false, error: 'رقم مالك المنصة غير مُعرَّف' }, { status: 500 })
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
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'خطأ' }, { status: 500 })
  }
}
