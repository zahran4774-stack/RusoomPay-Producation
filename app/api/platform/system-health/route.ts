// app/api/platform/system-health/route.ts
// نقطة نهاية لصحّة النظام — تُستدعى من تبويب "المراقبة" بمركز التحكّم كل بضع ثوانٍ.
// كل البيانات حقيقية من platform_system_health() (RPC واحد يفحص is_platform_admin()
// داخلياً)، بالإضافة لزمن استجابة القاعدة نقيسه هنا بتوقيت الاستدعاء نفسه.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const startedAt = Date.now()
  const { data, error } = await supabase.rpc('platform_system_health')
  const dbLatencyMs = Date.now() - startedAt

  if (error) {
    // is_platform_admin() هو اللي يرفض غير المخوّلين من داخل الفنكشن نفسها
    const status = error.message?.includes('غير مصرّح') ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ ...data, db_latency_ms: dbLatencyMs })
}
