// netlify/functions/fee-reminders-cron.mts
//
// بديل Netlify Scheduled Function لمهمّة تذكيرات الرسوم اليومية، بدل تعريف
// vercel.json غير الفعّال (لا يوجد مشروع Vercel على الحساب إطلاقاً).
//
// ⚠️ تصحيح إضافي غير مجرّد نقل منصّة: التوقيت الأصلي في vercel.json كان
// "0 6 * * *" — وVercel يفسّر هذا بتوقيت UTC دائماً، أي أن التذكير كان
// سيصل فعلياً الساعة 10:00 صباحاً بتوقيت عُمان (UTC+4) لا 6:00 صباحاً كما
// يوحي الاسم والتعليق بالكود الأصلي. Netlify أيضاً ينفّذ الجدولة بتوقيت UTC
// حصراً (لا فرق بينه وبين Vercel بهذه النقطة)، لذا صحّحت التوقيت هنا إلى
// 02:00 UTC ليصل التذكير فعلاً الساعة 6:00 صباحاً بتوقيت عُمان — وهو
// الأقرب للنيّة الأصلية الظاهرة من التسمية والتوثيق.

import type { Config } from '@netlify/functions'

export default async (): Promise<Response> => {
  const secret = process.env.CRON_SECRET
  const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL

  if (!secret) {
    console.error('fee-reminders-cron: CRON_SECRET غير مضبوط — تخطّي التشغيل')
    return new Response(JSON.stringify({ ok: false, error: 'CRON_SECRET missing' }), { status: 500 })
  }
  if (!baseUrl) {
    console.error('fee-reminders-cron: تعذّر تحديد رابط الموقع (URL) من بيئة Netlify')
    return new Response(JSON.stringify({ ok: false, error: 'site URL missing' }), { status: 500 })
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/fee-reminders`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`fee-reminders-cron: فشل الاستدعاء الداخلي (${res.status}): ${body}`)
    }
    return new Response(body, { status: res.status })
  } catch (err) {
    console.error('fee-reminders-cron: خطأ أثناء استدعاء /api/cron/fee-reminders', err)
    return new Response(JSON.stringify({ ok: false, error: 'internal fetch failed' }), { status: 500 })
  }
}

// 02:00 UTC = 06:00 بتوقيت عُمان (UTC+4)
export const config: Config = {
  schedule: '0 2 * * *',
}
