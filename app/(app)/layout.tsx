// تخطيط الصفحات المُصادَقة — يلفّها بقشرة التطبيق (شريط جانبي + تخطيط)
// مجموعة (app) لا تظهر في الرابط؛ المسارات تبقى /dashboard /students ...
// يجلب هوية المدرسة (اللون والشعار والاسم) ويمرّرها للقشرة.
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Role } from '@/lib/roles'
import AppShell from './AppShell'
import IdleGuard from './platform/IdleGuard'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الملف الشخصي ولون المدرسة — متوازيان (لا رحلتان متتابعتان)
  const [{ data: profile }, { data: school }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('schools').select('color, logo_url, name, branch').maybeSingle(),
  ])

  const role = (profile?.role ?? 'admin') as Role

  // مدير المنصة: لوحته الخاصة بلا شريط جانبي للمدرسة
  // + قفل خمول 10 دقائق (IdleGuard) لأنها أخطر صفحة بالنظام كامل
  if (role === 'platform_admin') {
    return (
      <main className="app-main" style={{ padding: 0 }}>
        <IdleGuard />
        {children}
      </main>
    )
  }

  // ولي الأمر: بوابة مبسّطة خاصة به (بلا شريط طاقم المدرسة)
  if (role === 'parent') {
    return <main className="app-main" style={{ padding: 0 }}>{children}</main>
  }

  const schoolName = school?.name
    ? school.name + (school.branch ? ` — ${school.branch}` : '')
    : null

  return (
    <AppShell
      role={role}
      brandColor={school?.color ?? null}
      schoolLogo={school?.logo_url ?? null}
      schoolName={schoolName}
    >
      {children}
    </AppShell>
  )
}
