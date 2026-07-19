// لوحة التحكم الموحّدة — تشغيلية + تحليلية، تتكيّف حسب الدور
// مكوّن خادم. الاستعلامات في موجتين متوازيتين (Promise.all).
// يجلب أيضاً التوصيات الذكية وأثرها لتمريرها إلى Copilot.
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { type Role, ROLE_LABEL, canAccessFinance, isStaff } from '@/lib/roles'
import { curSymbol } from '@/lib/accounting'
import DashboardClient from './DashboardClient'
import CopilotWithActions from './CopilotWithActions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ═══ الموجة 1: كل ما لا يعتمد على الدور — متوازٍ ═══
  const [
    { data: profile },
    { data: myRole },
    { data: school },
    { data: summary },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.rpc('my_role'),
    supabase.from('schools').select('name, branch, currency').single(),
    supabase.rpc('dashboard_summary'),
  ])

  const role = (myRole ?? profile?.role ?? 'admin') as Role
  if (role === 'platform_admin') redirect('/platform')

  const currency = school?.currency ?? 'OMR'
  const s = (summary ?? {}) as Record<string, number>

  // ═══ الموجة 2: ما يعتمد على الدور — متوازٍ فيما بينه ═══
  const wantAnalytics = canAccessFinance(role)
  const wantRecent = role === 'owner'
  const staff = isStaff(role)

  const [analyticsRes, recentRes, copilotRes, smartRes, impactRes] = await Promise.all([
    wantAnalytics ? supabase.rpc('collection_analytics') : Promise.resolve({ data: null }),
    wantRecent
      ? supabase.from('audit_log').select('action, details, created_at')
          .order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: null }),
    staff ? supabase.rpc('copilot_gated') : Promise.resolve({ data: null }),
    staff ? supabase.rpc('smart_recommendations') : Promise.resolve({ data: null }),
    staff ? supabase.rpc('recommendations_impact') : Promise.resolve({ data: null }),
  ])

  const analytics = (analyticsRes.data ?? {}) as Record<string, unknown>
  const recent = (recentRes.data ?? []) as { action: string; details: string | null; created_at: string }[]
  const copilot = (copilotRes.data ?? null) as Record<string, unknown> | null

  // التوصيات الذكية + أثرها
  const smartRaw = (smartRes.data ?? {}) as { ok?: boolean; recommendations?: unknown[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const smartRecs = (smartRaw.ok && Array.isArray(smartRaw.recommendations) ? smartRaw.recommendations : []) as any[]
  const impactRaw = (impactRes.data ?? {}) as { ok?: boolean; actions_this_month?: number; collected_this_month?: number }
  const impact = impactRaw.ok
    ? { actions_this_month: impactRaw.actions_this_month, collected_this_month: impactRaw.collected_this_month }
    : null

  return (
    <>
      {copilot && (copilot as { ok?: boolean }).ok !== false && (
        <div style={{ padding: '24px 24px 0', maxWidth: 1280, margin: '0 auto' }}>
          <CopilotWithActions
            data={copilot}
            sym={curSymbol(currency)}
            firstName={(profile?.full_name ?? '').split(' ')[0]}
            schoolName={(school?.name ?? '') + (school?.branch ? ` — ${school.branch}` : '')}
            smartRecs={smartRecs}
            impact={impact}
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
