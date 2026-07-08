// صفحة الدعم والملاحظات — مكوّن خادم
// طاقم المدرسة يرسل شكاوى/اقتراحات ويرى سجلّ بلاغاته
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isStaff, type Role } from '@/lib/roles'
import FeedbackClient from './FeedbackClient'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!isStaff(profile?.role as Role)) redirect('/dashboard')

  // سجلّ بلاغات المدرسة الحالية
  const { data: items } = await supabase.rpc('my_school_feedback')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>الدعم والملاحظات</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
        أرسل شكوى أو اقتراحاً أو بلاغاً عن مشكلة — يصل مباشرة لفريق منصة RusoomPay
      </p>
      <FeedbackClient initialItems={items || []} />
    </div>
  )
}
