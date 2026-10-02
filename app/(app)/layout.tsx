// تخطيط الصفحات المُصادَقة — يلفّها بقشرة التطبيق (شريط جانبي + تخطيط)
// مجموعة (app) لا تظهر في الرابط؛ المسارات تبقى /dashboard /students ...
// يجلب هوية المدرسة (اللون والشعار والاسم) ويمرّرها للقشرة.
// يجلب أيضاً my_subscription_status() ويمرّرها كـsubscriptionInfo — تُعرض
// كشارة ملوّنة (نشط/قريب الانتهاء/منتهي) في AppShell.
// ⚠️ IdleGuard (خروج قسري بعد 10 دقائق خمول) أصبح مطبَّقاً الآن على كل
// المسارات — مالك/إداري/محاسب، الدعم الفني، وولي الأمر — لا فقط platform_admin
// كما كان سابقاً. حماية إضافية مستقلة عن صلاحية الجلسة نفسها (JWT).
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

  const [{ data: profile }, { data: myRole }] = await Promise.all([
    supabase.from('profiles').select('role, impersonating_school_id, impersonation_reason').eq('id', user.id).single(),
    supabase.rpc('my_role'),
  ])

  const realRole = (profile?.role ?? 'admin') as Role
  const effectiveRole = (myRole ?? realRole) as Role
  const isImpersonating = realRole === 'platform_admin' && !!profile?.impersonating_school_id

  const { data: school } = await supabase
    .from('schools').select('color, logo_url, name, branch')
    .maybeSingle()

  // ═══ حالة الدخول للدعم الفني: مدير المنصة داخل مدرسة ═══
  if (isImpersonating) {
    const { data: subscriptionInfo } = await supabase.rpc('my_subscription_status')
    const schoolName = school?.name
      ? school.name + (school.branch ? ` — ${school.branch}` : '')
      : 'المدرسة'
    return (
      <>
        <IdleGuard />
        <ImpersonationBar schoolName={schoolName} />
        <AppShell
          role={'owner' as Role}
          brandColor={school?.color ?? null}
          schoolLogo={school?.logo_url ?? null}
          schoolName={schoolName}
          subscriptionInfo={subscriptionInfo}
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
  // + قفل خمول 10 دقائق — بيانات مالية لأبنائه، نفس مستوى الحماية
  if (realRole === 'parent') {
    return (
      <main className="app-main" style={{ padding: 0 }}>
        <IdleGuard />
        {children}
      </main>
    )
  }

  const { data: subscriptionInfo } = await supabase.rpc('my_subscription_status')

  const schoolName = school?.name
    ? school.name + (school.branch ? ` — ${school.branch}` : '')
    : null

  return (
    <>
      <IdleGuard />
      <AppShell
        role={effectiveRole}
        brandColor={school?.color ?? null}
        schoolLogo={school?.logo_url ?? null}
        schoolName={schoolName}
        subscriptionInfo={subscriptionInfo}
      >
        {children}
      </AppShell>
    </>
  )
}
