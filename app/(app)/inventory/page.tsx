// صفحة المخزون — مكوّن خادم
// كتب وزي مدرسي: شراء (مخزون/بنك) وبيع لطالب (فاتورة + تكلفة مبيعات) بترحيل تلقائي
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, type Role } from '@/lib/roles'
import InventoryClient from './InventoryClient'
import FocusScroller from '../FocusScroller'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isStaff(profile?.role as Role)) redirect('/dashboard')

  const [{ data: items }, { data: students }, { data: school }] = await Promise.all([
    supabase.rpc('inventory_list'),
    supabase.from('students').select('id, full_name, guardian_name').eq('status', 'active').order('full_name'),
    supabase.from('schools').select('name, vat_number').single(),
  ])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>المخزون</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
        كتب وزي مدرسي — الشراء والبيع بترحيل محاسبي تلقائي (مخزون · تكلفة مبيعات)
      </p>
      <div id="low-stock" style={{ scrollMarginTop: 80 }}>
        <InventoryClient
          initialItems={items || []}
          students={students || []}
          school={{ name: school?.name ?? 'مدرسة', vat: school?.vat_number }}
        />
      </div>
      <FocusScroller />
    </div>
  )
}
