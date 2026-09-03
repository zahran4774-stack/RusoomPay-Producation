// تخطيط الصفحات المُصادَقة — يلفّها بقشرة التطبيق (شريط جانبي + تخطيط)
// مجموعة (app) لا تظهر في الرابط؛ المسارات تبقى /dashboard /students ...
// يجلب هوية المدرسة (اللون والشعار والاسم) ويمرّرها للقشرة.
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Role } from '@/lib/roles'
import AppShell from './AppShell'
import IdleGuard from './platform/IdleGuard'
import ImpersonationBar from '@/components/ImpersonationBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الدور الحقيقي + حالة الدخول (impersonation) — من الجدول مباشرة
  const [{ data: profile }, { data: myRole }] = await Promise.all([
    supabase.from('profiles').select('role, impersonating_school_id, impersonation_reason').eq('id', user.id).single(),
    supabase.rpc('my_role'),   // الدور الفعّال (owner أثناء الدخول)
  ])

  const realRole = (profile?.role ?? 'admin') as Role
  const effectiveRole = (myRole ?? realRole) as Role
  const isImpersonating = realRole === 'platform_admin' && !!profile?.impersonating_school_id

  // مدرسة الدخول (أثناء الدعم الفني) أو مدرسة المستخدم العادية
  const { data: school } = await supabase
    .from('schools').select('color, logo_url, name, branch')
    .maybeSingle()

  // ═══ حالة الدخول للدعم الفني: مدير المنصة داخل مدرسة ═══
  // يُعرض بقشرة المدرسة الكاملة (كأنه المالك) + الشريط الأحمر فوق كل شيء
  if (isImpersonating) {
    const schoolName = school?.name
      ? school.name + (school.branch ? ` — ${school.branch}` : '')
      : 'المدرسة'
    return (
      <>
        <ImpersonationBar schoolName={schoolName} />
        <AppShell
          role={'owner' as Role}
          brandColor={school?.color ?? null}
          schoolLogo={school?.logo_url ?? null}
          schoolName={schoolName}
        >
          {children}
        </AppShell>
      </>
    )
  }

  // مدير المنصة (بلا دخول): لوحته الخاصة بلا شريط جانبي للمدرسة
  // + قفل خمول 10 دقائق (IdleGuard) لأنها أخطر صفحة بالنظام كامل
  if (realRole === 'platform_admin') {
    return (
      <main className="app-main" style={{ padding: 0 }}>
        <IdleGuard />
        {children}
      </main>
    )
  }

  // ولي الأمر: بوابة مبسّطة خاصة به (بلا شريط طاقم المدرسة)
  if (realRole === 'parent') {
    return <main className="app-main" style={{ padding: 0 }}>{children}</main>
  }

  const schoolName = school?.name
    ? school.name + (school.branch ? ` — ${school.branch}` : '')
    : null

  return (
    <AppShell
      role={effectiveRole}
      brandColor={school?.color ?? null}
      schoolLogo={school?.logo_url ?? null}
      schoolName={schoolName}
    >
      {children}
    </AppShell>
  )
}
