// صفحة التغذية المدرسية — مكوّن خادم
// باقات التغذية + اشتراكات الطلاب + الفوترة الشهرية (إيراد للمدرسة)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, type Role } from '@/lib/roles'
import CafeteriaClient from './CafeteriaClient'

export default async function CafeteriaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isStaff(profile?.role as Role)) redirect('/dashboard')

  const [{ data: plans }, { data: subscribers }, { data: students }, { data: school }] = await Promise.all([
    supabase.rpc('cafeteria_plans'),
    supabase.rpc('cafeteria_subscribers'),
    supabase.from('students').select('id, full_name, guardian_name').eq('status', 'active').order('full_name'),
    supabase.from('schools').select('name, vat_number').single(),
  ])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>التغذية المدرسية</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
        باقات التغذية واشتراكات الطلاب والفوترة الشهرية — تدخل كإيراد للمدرسة
      </p>
      <CafeteriaClient
        initialPlans={plans || []}
        initialSubscribers={subscribers || []}
        students={students || []}
        school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
      />
    </div>
  )
}
