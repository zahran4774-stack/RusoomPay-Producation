// مركز تحكّم RusoomPay — Super Admin Control Center
// 3 أقسام تعمل ببيانات حقيقية: نظرة عامة + الإيرادات + إدارة الاشتراكات
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isPlatformAdmin, type Role } from '@/lib/roles'
import PendingSubs from './PendingSubs'
import ControlCenter from './ControlCenter'
import type { Sub, SchoolStat, AuditRow, FeedbackRow } from './types'

export default async function PlatformPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // قراءة الدور عبر my_role() — موثوقة (security definer، لا تتأثّر بـRLS)
  const { data: myRole } = await supabase.rpc('my_role')
  if (myRole !== 'platform_admin') redirect('/dashboard')

  // بيانات مركز التحكّم (نظرة عامة + إيرادات)
  const { data: summary } = await supabase.rpc('control_center_summary')
  const cc = (summary ?? {}) as { overview?: Record<string, number>; revenue?: Record<string, number> }

  // جدول الاشتراكات التفصيلي
  const { data: subs } = await supabase.rpc('control_center_subscriptions')

  // الاشتراكات المعلّقة (تحويلات بانتظار الاعتماد)
  const { data: pending } = await supabase
    .from('subscriptions')
    .select('id, school_id, plan, status, pay_method, receipt_url, created_at, schools(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  // القسم 7: تحليلات المدارس
  const { data: analytics } = await supabase.rpc('platform_school_analytics')
  // القسم 10: سجل التدقيق عابر المستأجرين
  const { data: audit } = await supabase.rpc('platform_audit_log', { p_limit: 100 })
  // الشكاوى والملاحظات من المستخدمين
  const { data: feedback } = await supabase.rpc('platform_feedback', { p_limit: 200 })

  return (
    <ControlCenter
      overview={cc.overview ?? {}}
      revenue={cc.revenue ?? {}}
      subscriptions={(subs ?? []) as Sub[]}
      pending={pending ?? []}
      analytics={(analytics ?? []) as SchoolStat[]}
      audit={(audit ?? []) as AuditRow[]}
      feedback={(feedback ?? []) as FeedbackRow[]}
    />
  )
}

