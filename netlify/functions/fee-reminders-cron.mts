أبسط وأذكى فعلاً — يوم 28 موجود بكل الشهور بلا استثناء (حتى فبراير القصير). تعديل سطر واحد فقط:

```typescript
// netlify/functions/fee-reminders-cron.mts
//
// بديل Netlify Scheduled Function لمهمّة تذكيرات الرسوم، بدل تعريف
// vercel.json غير الفعّال (لا يوجد مشروع Vercel على الحساب إطلاقاً).
//
// التكرار: شهرياً يوم 28 الساعة 02:00 UTC (= 06:00 صباحاً بتوقيت عُمان)
// بدل التذكير اليومي الأصلي — بطلب صاحب المنتج، لتفادي إزعاج أولياء الأمور
// برسالة يومية متكررة لنفس الفاتورة المتأخرة. يوم 28 مقصود تحديداً (وليس
// 30 أو 31): موجود بكل شهور السنة بلا استثناء، بما فيها فبراير — فلا يُتخطّى
// أي شهر أبداً.

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

// يوم 28 من كل شهر، 02:00 UTC = 10:00 بتوقيت عُمان (UTC+4)
// (يوم 28 مقصود: موجود بكل الشهور بلا استثناء، بما فيها فبراير)
export const config: Config = {
  schedule: '0 2 28 * *',
}
```

نفس المسار: `netlify/functions/fee-reminders-cron.mts` — استبدل به المحتوى الحالي بالكامل، Commit، وانتهينا. هذا يغطّي كل شهور السنة بلا استثناء، مرة واحدة بالشهر.
