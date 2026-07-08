// صفحة النقل المدرسي — مكوّن خادم
// الباصات (مسار/سائق/سعر/جهة دفع) + اشتراكات الطلاب + الفوترة الشهرية
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, type Role } from '@/lib/roles'
import TransportClient from './TransportClient'

export default async function TransportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isStaff(profile?.role as Role)) redirect('/dashboard')

  const [{ data: buses }, { data: subscribers }, { data: students }, { data: school }] = await Promise.all([
    supabase.rpc('transport_buses'),
    supabase.rpc('transport_subscribers'),
    supabase.from('students').select('id, full_name, guardian_name').eq('status', 'active').order('full_name'),
    supabase.from('schools').select('name, vat_number').single(),
  ])

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>النقل المدرسي</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
        الباصات والمسارات واشتراكات الطلاب والفوترة الشهرية
      </p>
      <TransportClient
        initialBuses={buses || []}
        initialSubscribers={subscribers || []}
        students={students || []}
        school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
      />
    </div>
  )
}
