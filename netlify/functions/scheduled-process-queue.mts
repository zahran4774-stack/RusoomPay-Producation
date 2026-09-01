// netlify/functions/scheduled-process-queue.mts
// يستدعي معالج طابور الإشعارات كل دقيقة (Netlify Scheduled Function).
// السبب: لا يوجد مشروع Vercel فعّال، فإعدادات vercel.json السابقة لم تكن تُشغَّل أبداً —
// هذا هو المُشغّل الفعلي على منصّة النشر الحالية (Netlify).
import type { Config } from '@netlify/functions'

export default async () => {
  const baseUrl = Netlify.env.get('NEXT_PUBLIC_APP_URL')
  const secret = Netlify.env.get('CRON_SECRET')

  if (!baseUrl || !secret) {
    console.error('scheduled-process-queue: missing NEXT_PUBLIC_APP_URL or CRON_SECRET')
    return
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/process-queue`, {
      headers: { Authorization: `Bearer ${secret}` },
    })
    const body = await res.text()
    if (!res.ok) {
      console.error(`scheduled-process-queue: worker returned ${res.status}: ${body}`)
    } else {
      console.log(`scheduled-process-queue: ${body}`)
    }
  } catch (e) {
    console.error('scheduled-process-queue: fetch failed', e)
  }
}

export const config: Config = {
  schedule: '* * * * *',
}
