// إعدادات حماية الأجور (WPS) — مكوّن خادم
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WpsSettingsForm from './WpsSettingsForm'
import { isOwner, type Role } from '@/lib/roles'

export default async function WpsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, school_id').eq('id', user.id).single()

  const role = (profile?.role ?? 'admin') as Role
  if (!isOwner(role)) redirect('/payroll')

  const [{ data: settings }, { data: school }] = await Promise.all([
    supabase.from('payroll_settings').select('*').eq('school_id', profile!.school_id).maybeSingle(),
    supabase.from('schools').select('name').eq('id', profile!.school_id).single(),
  ])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }} dir="rtl">
      <Link href="/payroll" style={{ color: '#667', fontSize: 13.5, textDecoration: 'none' }}>
        → عودة لدورات الرواتب
      </Link>

      <h1 style={{ color: '#0F2744', margin: '10px 0 4px' }}>إعدادات حماية الأجور</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 22 }}>
        بيانات المنشأة المطلوبة في ملف الرواتب البنكي — تُملأ مرة واحدة وتُستخدم في كل دورة
      </p>

      <WpsSettingsForm
        schoolId={profile!.school_id}
        schoolName={school?.name ?? ''}
        initial={settings ?? null}
      />
    </div>
  )
}
