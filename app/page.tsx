// الصفحة الرئيسية — توجّه حسب حالة المصادقة والدور
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // توجيه حسب الدور: ولي الأمر لبوابته، الباقون للوحة التحكّم
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  redirect(profile?.role === 'parent' ? '/parent' : '/dashboard')
}
