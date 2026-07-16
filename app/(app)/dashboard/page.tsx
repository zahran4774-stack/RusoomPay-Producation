// لوحة التحكم الموحّدة — تشغيلية + تحليلية، تتكيّف حسب الدور
// مكوّن خادم: يجلب كل المؤشرات في استدعاء واحد (dashboard_summary)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { type Role, ROLE_LABEL, canAccessFinance, isStaff } from '@/lib/roles'
import { curSymbol } from '@/lib/accounting'
import DashboardClient from './DashboardClient'
import SchoolCopilot from './SchoolCopilot'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()
  // قراءة الدور عبر my_role() — موثوقة (security definer)
  const { data: myRole } = await supabase.rpc('my_role')
  const role = (myRole ?? profile?.role ?? 'admin') as Role

  // مدير المنصة له لوحته الخاصة
  if (role === 'platform_admin') redirect('/platform')

  const { data: school } = await supabase
    .from('schools').select('name, branch, currency').single()
  const currency = school?.currency ?? 'OMR'

  // كل المؤشرات في استدعاء واحد
  const { data: summary } = await supabase.rpc('dashboard_summary')
  const s = (summary ?? {}) as Record<string, number>

  // تحليلات التحصيل (للمالية فقط)
  let analytics: Record<string, unknown> = {}
  if (canAccessFinance(role)) {
    const { data: a } = await supabase.rpc('collection_analytics')
    analytics = (a ?? {}) as Record<string, unknown>
  }

  // آخر العمليات (للمدير — من سجل التدقيق)
  let recent: { action: string; details: string | null; created_at: string }[] = []
  if (role === 'owner') {
    const { data: logs } = await supabase
      .from('audit_log').select('action, details, created_at')
      .order('created_at', { ascending: false }).limit(6)
    recent = logs ?? []
  }

  // School Copilot — المساعد التنفيذي (للطاقم الإداري فقط)
  let copilot: Record<string, unknown> | null = null
  if (isStaff(role)) {
    const { data: cp } = await supabase.rpc('copilot_gated')
    copilot = (cp ?? null) as Record<string, unknown> | null
  }

  return (
    <>
      {copilot && (copilot as { ok?: boolean }).ok !== false && (
        <div style={{ padding: '24px 24px 0', maxWidth: 1280, margin: '0 auto' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
         <SchoolCopilot
 data={copilot as any}
 sym={curSymbol(currency)}
 firstName={(profile?.full_name ?? '').split(' ')[0]}
 schoolName={(school?.name ?? '') + (school?.branch ? ` — ${school.branch}` : '')}
/>
        </div>
      )}
      <DashboardClient
        userName={profile?.full_name ?? 'مستخدم'}
        roleLabel={ROLE_LABEL[role] ?? role}
        role={role}
        schoolName={(school?.name ?? '') + (school?.branch ? ` — ${school.branch}` : '')}
        currency={currency}
        sym={curSymbol(currency)}
        canFinance={canAccessFinance(role)}
        isStaff={isStaff(role)}
        data={s}
        analytics={analytics}
        recent={recent}
      />
    </>
  )
}
