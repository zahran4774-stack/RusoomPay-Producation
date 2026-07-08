// تخطيط الصفحات المُصادَقة — يلفّها بقشرة التطبيق (شريط جانبي + تخطيط)
// مجموعة (app) لا تظهر في الرابط؛ المسارات تبقى /dashboard /students ...
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Role } from '@/lib/roles'
import AppShell from '../AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'admin') as Role

  // مدير المنصة: لوحته الخاصة بلا شريط جانبي للمدرسة
  if (role === 'platform_admin') {
    return <main className="app-main" style={{ padding: 0 }}>{children}</main>
  }

  // ولي الأمر: بوابة مبسّطة خاصة به (بلا شريط طاقم المدرسة)
  if (role === 'parent') {
    return <main className="app-main" style={{ padding: 0 }}>{children}</main>
  }

  return <AppShell role={role}>{children}</AppShell>
}
