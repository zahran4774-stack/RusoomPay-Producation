// netlify/functions/scheduled-fee-reminders.mts
// يستدعي مولّد تذكيرات الرسوم المتأخّرة يومياً الساعة 03:00 UTC (~07:00 بتوقيت عُمان).
// السبب: لا يوجد مشروع Vercel فعّال، فإعدادات vercel.json السابقة لم تكن تُشغَّل أبداً —
// هذا هو المُشغّل الفعلي على منصّة النشر الحالية (Netlify).
import type { Config } from '@netlify/functions'

export default async () => {
  const baseUrl = Netlify.env.get('NEXT_PUBLIC_APP_URL')
  const secret = Netlify.env.get('CRON_SECRET')

  if (!baseUrl || !secret) {
    console.error('scheduled-fee-reminders: missing NEXT_PUBLIC_APP_URL or CRON_SECRET')
    return
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/fee-reminders`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`scheduled-fee-reminders: worker returned ${res.status}: ${body}`)
    } else {
      console.log(`scheduled-fee-reminders: ${body}`)
    }
  } catch (e) {
    console.error('scheduled-fee-reminders: fetch failed', e)
  }
}

export const config: Config = {
  schedule: '0 3 * * *',
}
