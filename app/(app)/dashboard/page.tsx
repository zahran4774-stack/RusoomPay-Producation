// لوحة التحكم الموحّدة — تشغيلية + تحليلية، تتكيّف حسب الدور
// مكوّن خادم. تحسين الأداء: الاستعلامات تُنفَّذ في موجتين متوازيتين (Promise.all)
// بدل سلسلة متتابعة — يقلّل زمن الخادم من ~5s إلى ~1.5s.
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

  // مدير المنصة له لوحته الخاصة
  if (role === 'platform_admin') redirect('/platform')

  const currency = school?.currency ?? 'OMR'
  const s = (summary ?? {}) as Record<string, number>

  // ═══ الموجة 2: ما يعتمد على الدور — متوازٍ فيما بينه ═══
  // نبني الاستعلامات المطلوبة فقط حسب الصلاحية، ثم ننفّذها معاً.
  const wantAnalytics = canAccessFinance(role)
  const wantRecent = role === 'owner'
  const wantCopilot = isStaff(role)

  const [analyticsRes, recentRes, copilotRes] = await Promise.all([
    wantAnalytics ? supabase.rpc('collection_analytics') : Promise.resolve({ data: null }),
    wantRecent
      ? supabase.from('audit_log').select('action, details, created_at')
          .order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: null }),
    wantCopilot ? supabase.rpc('copilot_gated') : Promise.resolve({ data: null }),
  ])

  const analytics = (analyticsRes.data ?? {}) as Record<string, unknown>
  const recent = (recentRes.data ?? []) as { action: string; details: string | null; created_at: string }[]
  const copilot = (copilotRes.data ?? null) as Record<string, unknown> | null

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
