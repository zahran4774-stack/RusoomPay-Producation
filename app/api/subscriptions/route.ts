// app/api/platform/subscriptions/route.ts
// اشتراكات التشغيل (فواتير Supabase/Netlify/Twilio/إلخ) — يقرأ من مشروع Supabase
// منفصل (byzantium-pillow) عبر RPC للقراءة فقط لا يكشف أي بيانات اعتماد.
// محمي بنفس فحص is_platform_admin على قاعدة RusoomPay الرئيسية قبل أي استدعاء خارجي.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: isAdmin } = await supabase.rpc('is_platform_admin')
  if (!isAdmin) return NextResponse.json({ error: 'غير مصرّح: لمدير المنصة فقط' }, { status: 403 })

  const url = process.env.BYZANTIUM_SUPABASE_URL
  const key = process.env.BYZANTIUM_SUPABASE_ANON_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'إعدادات byzantium-pillow ناقصة (env vars)' }, { status: 500 })
  }

  const byzantium = createSupabaseClient(url, key)
  const { data, error } = await byzantium.rpc('platform_subscriptions_summary')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
