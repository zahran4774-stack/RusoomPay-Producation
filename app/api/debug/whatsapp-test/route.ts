// app/api/debug/whatsapp-test/route.ts
// ⚠️ مؤقت للتشخيص فقط — احذفه بعد ما تحل المشكلة.
// افتحه مباشرة بالمتصفح (GET) وبيطلعلك الرد الحقيقي من Twilio أو من متغيرات البيئة.
import { NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function GET() {
  const envCheck = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? '✅ موجود' : '❌ مفقود',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? '✅ موجود' : '❌ مفقود',
    TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || '❌ مفقود',
  }

  const result = await sendWhatsApp('+96895476649', '🧪 رسالة اختبار من RusoomPay — تجاهلها')

  return NextResponse.json({ envCheck, sendResult: result })
}
