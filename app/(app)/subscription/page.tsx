// صفحة اشتراك المنصة — مكوّن خادم
// يجلب اشتراك المدرسة الحالي واسمها، ويمرّرهما للمكوّن التفاعلي
// (اسم المدرسة يُستخدم في رسالة تنبيه واتساب لمالك المنصة عند طلب اشتراك جديد)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isOwner, type Role } from '@/lib/roles'
import PlansManager from './PlansManager'

export default async function SubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // الدور — الاشتراك للمدير فقط
  const { data: profile } = await supabase
    .from('profiles').select('role, school_id').eq('id', user.id).single()
  if (!isOwner(profile?.role as Role)) redirect('/dashboard')

  // الاشتراك الحالي واسم المدرسة — يُجلبان معاً بالتوازي
  const [{ data: sub }, { data: school }] = await Promise.all([
    supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('schools').select('name').eq('id', profile?.school_id).single(),
  ])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>اشتراك المدرسة في منصة RusoomPay</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 20 }}>
        هذا اشتراك مدرستك في المنصة — منفصل عن رسوم الطلاب
      </p>
      <PlansManager sub={sub} schoolId={profile?.school_id} schoolName={school?.name} />
    </div>
  )
}
