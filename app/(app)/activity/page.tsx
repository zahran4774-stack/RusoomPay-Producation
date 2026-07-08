// سجل النشاط والتدقيق — مكوّن خادم
// يعرض كل العمليات المسجّلة في audit_log على هيئة خط زمني (للمدير فقط)
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isOwner, type Role } from '@/lib/roles'
import ActivityTimeline from './ActivityTimeline'

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // سجل التدقيق للمدير فقط (تفرضه RLS أيضاً)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isOwner(profile?.role as Role)) redirect('/dashboard')

  // العمليات المسجّلة (RLS يقصرها على المدرسة) + اسم المنفّذ
  const { data: logs } = await supabase
    .from('audit_log')
    .select('id, action, details, created_at, actor_id, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)

  const events = (logs ?? []).map((l) => {
    // Supabase يُرجع علاقة profiles كمصفوفة — نأخذ أول عنصر بأمان
    const prof = (Array.isArray(l.profiles) ? l.profiles[0] : l.profiles) as { full_name?: string } | null
    return {
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.created_at,
      actor: prof?.full_name ?? 'النظام',
    }
  })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>سجل النشاط والتدقيق</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>
        سجل غير قابل للتعديل بكل العمليات المهمة في مدرستك — للمراجعة والمساءلة
      </p>
      <ActivityTimeline events={events} />
    </div>
  )
}
