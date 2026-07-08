// app/api/cron/process-queue/route.ts
// عامل معالجة طابور الإشعارات — يُستدعى دورياً (Vercel Cron كل دقيقة).
// يلتقط دفعة، يحاول الإرسال، ويسجّل النتيجة مع إعادة محاولة تلقائية (backoff في قاعدة البيانات).
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { deliver, type NotificationJob } from '@/lib/notifications/providers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// حماية: لا يُشغّل إلا بترويسة سرّ الـcron
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results = { processed: 0, sent: 0, failed: 0 }

  try {
    // التقاط دفعة جاهزة (atomic claim عبر SKIP LOCKED — آمن مع عدة عمّال)
    const { data: batch, error } = await supabase.rpc('claim_queue_batch', { p_limit: 20 })
    if (error) throw error
    if (!batch || batch.length === 0) {
      return NextResponse.json({ ok: true, ...results, note: 'لا رسائل معلّقة' })
    }

    // معالجة كل رسالة على حدة — فشل واحدة لا يوقف الباقي
    for (const row of batch) {
      results.processed++
      const job: NotificationJob = {
        channel: row.channel,
        recipient: row.recipient,
        payload: row.payload,
      }
      try {
        const res = await deliver(job)
        await supabase.rpc('mark_queue_result', {
          p_id: row.id,
          p_success: res.ok,
          p_error: res.ok ? null : res.error,
          p_provider_id: res.ok ? res.providerId : null,
        })
        res.ok ? results.sent++ : results.failed++
      } catch (e) {
        results.failed++
        await supabase.rpc('mark_queue_result', {
          p_id: row.id, p_success: false,
          p_error: `worker: ${(e as Error).message}`, p_provider_id: null,
        })
      }
    }

    return NextResponse.json({ ok: true, ...results })
  } catch (e) {
    // خطأ عام في العامل — يُسجّل ولا يُسقط الخدمة
    await supabase.from('error_log').insert({
      source: 'queue', severity: 'critical',
      message: `فشل عامل الطابور: ${(e as Error).message}`,
    })
    return NextResponse.json({ ok: false, error: 'queue worker failed' }, { status: 500 })
  }
}
