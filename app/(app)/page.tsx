// بوابة ولي الأمر — مكوّن خادم
// يشاهد أبناءه ورسومهم، يدفع، ويحمّل الإيصالات
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { Role } from '@/lib/roles'
import ParentPortal from './ParentPortal'

export default async function ParentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  const role = profile?.role as Role
  // البوابة لولي الأمر فقط — الطاقم يُحوّل للوحته
  if (role !== 'parent') redirect('/dashboard')

  // هوية المدرسة (للترويسة والإيصالات + الحساب البنكي للتحويل)
  const { data: school } = await supabase
    .from('schools')
    .select('name, vat_number, currency, bank_iban, bank_holder, bank_name')
    .single()

  const [{ data: children }, { data: fees }, { data: receipts }, { data: notifications }, { data: certificates }] = await Promise.all([
    supabase.rpc('parent_children'),
    supabase.rpc('parent_fees'),
    supabase.rpc('parent_receipts'),
    supabase.rpc('my_notifications', { p_limit: 20 }),
    supabase.rpc('parent_certificates'),
  ])

  return (
    <ParentPortal
      parentName={profile?.full_name ?? 'ولي الأمر'}
      school={{
        name: school?.name ?? 'المدرسة', vat: school?.vat_number,
        currency: school?.currency ?? 'OMR',
        bankIban: school?.bank_iban ?? null, bankHolder: school?.bank_holder ?? null, bankName: school?.bank_name ?? null,
      }}
      children_={children || []}
      fees={fees || []}
      receipts={receipts || []}
      notifications={notifications || []}
      certificates={certificates || []}
    />
  )
}
