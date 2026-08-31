// netlify/functions/process-queue-cron.mts
//
// بديل Netlify Scheduled Function لمهمّة معالجة طابور الإشعارات، التي كانت
// معرَّفة فقط في vercel.json (غير فعّالة — لا يوجد أي مشروع Vercel على
// الحساب إطلاقاً، تم التأكد من هذا مباشرة عبر Vercel API). النشر الفعلي على
// Netlify، وNetlify Scheduled Functions لا تقرأ vercel.json أبداً — تحتاج
// تعريفها هنا بصيغة Netlify الخاصة.
//
// هذه الدالة لا تكرّر منطق المعالجة: فقط تستدعي المسار الموجود فعلاً
// (/api/cron/process-queue) بنفس CRON_SECRET، فيبقى كل منطق claim/backoff/
// retry في مكان واحد (lib/notifications + دوال قاعدة البيانات) كما صُمم أصلاً.
//
// التكرار: كل دقيقة — نفس ما كان مخطَّطاً له في vercel.json الأصلي.

import type { Config } from '@netlify/functions'

export default async (): Promise<Response> => {
  const secret = process.env.CRON_SECRET
  const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL

  if (!secret) {
    console.error('process-queue-cron: CRON_SECRET غير مضبوط — تخطّي التشغيل')
    return new Response(JSON.stringify({ ok: false, error: 'CRON_SECRET missing' }), { status: 500 })
  }
  if (!baseUrl) {
    console.error('process-queue-cron: تعذّر تحديد رابط الموقع (URL) من بيئة Netlify')
    return new Response(JSON.stringify({ ok: false, error: 'site URL missing' }), { status: 500 })
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/process-queue`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`process-queue-cron: فشل الاستدعاء الداخلي (${res.status}): ${body}`)
    }
    return new Response(body, { status: res.status })
  } catch (err) {
    console.error('process-queue-cron: خطأ أثناء استدعاء /api/cron/process-queue', err)
    return new Response(JSON.stringify({ ok: false, error: 'internal fetch failed' }), { status: 500 })
  }
}

export const config: Config = {
  schedule: '* * * * *',
}
