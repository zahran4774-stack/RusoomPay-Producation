// نقطة فحص الصحّة — لخدمات المراقبة (UptimeRobot, Vercel, لوحات الحالة)
// تتحقق أن التطبيق يعمل وأن الاتصال بقاعدة البيانات سليم
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit, clientId } from '@/lib/rate-limit'

// لا تُخزَّن مؤقتاً — الفحص يجب أن يكون لحظياً
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // تحديد معدّل خفيف: 60 فحص/دقيقة لكل IP (يمنع إساءة استخدام فحص قاعدة البيانات)
  const rl = await checkRateLimit(`health:${clientId(req)}`, 60, 60)
  if (!rl.allowed) {
    return NextResponse.json({ status: 'rate_limited' }, { status: 429 })
  }

  const startedAt = Date.now()
  let dbOk = false

  try {
    // فحص خفيف للاتصال بقاعدة البيانات (استعلام بسيط بحدّ أدنى)
    const supabase = await createClient()
    const { error } = await supabase.from('schools').select('id').limit(1)
    dbOk = !error
  } catch {
    dbOk = false
  }

  const healthy = dbOk
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'RusoomPay',
      checks: {
        app: 'ok',
        database: dbOk ? 'ok' : 'unreachable',
      },
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    // رمز 503 عند العطل ليكتشفه نظام المراقبة تلقائياً
    { status: healthy ? 200 : 503 }
  )
}
