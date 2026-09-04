// سجل النشاط والتدقيق — مكوّن خادم
// يعرض العمليات المسجّلة في audit_log بترقيم صفحات من جانب الخادم (25/صفحة)،
// بحث نصّي، وفلترة بالمستخدم والفترة الزمنية — كلها منفَّذة كاستعلام واحد على
// الخادم، لا جلب كامل الجدول إلى المتصفح.
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { isOwner, type Role } from '@/lib/roles'
import ActivityToolbar, { type ActorOption } from './ActivityToolbar'
import ActivityTable, { type ActivityRow } from './ActivityTable'
import ActivityPagination from './ActivityPagination'

const PAGE_SIZE = 25

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; actor?: string; from?: string; to?: string }>
}) {
  const { page: pageParam, q, actor, from, to } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // سجل التدقيق للمدير فقط (تفرضه RLS أيضاً)
  const { data: profile } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
  if (!isOwner(profile?.role as Role)) redirect('/dashboard')

  // قائمة المستخدمين لفلتر "المستخدم" — الطاقم الحالي بالمدرسة فقط (استعلام
  // صغير منفصل، لا علاقة له بحجم سجل التدقيق نفسه)
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('school_id', profile?.school_id)
    .in('role', ['owner', 'admin', 'accountant'])
    .order('full_name')
  const actors: ActorOption[] = (staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? '—' }))

  // الاستعلام الرئيسي — فلترة وترتيب وترقيم صفحات على الخادم بالكامل
  let query = supabase
    .from('audit_log')
    .select('id, action, details, created_at, actor_id, profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // ترتيب ثانوي ثابت لضمان ترقيم صفحات حتمي

  if (q && q.trim()) {
    const term = q.trim().replace(/[%,]/g, '')
    query = query.or(`action.ilike.%${term}%,details.ilike.%${term}%`)
  }
  if (actor) query = query.eq('actor_id', actor)
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const fromIdx = (page - 1) * PAGE_SIZE
  const { data: logs, count } = await query.range(fromIdx, fromIdx + PAGE_SIZE - 1)

  const rows: ActivityRow[] = (logs ?? []).map((l) => {
    const prof = (Array.isArray(l.profiles) ? l.profiles[0] : l.profiles) as { full_name?: string } | null
    return {
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.created_at,
      actor: prof?.full_name ?? 'النظام',
    }
  })

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const buildHref = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (actor) params.set('actor', actor)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/activity?${qs}` : '/activity'
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }} dir="rtl">
      <h1 style={{ color: '#0F2744', marginBottom: 4 }}>سجل النشاط والتدقيق</h1>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 24 }}>
        سجل غير قابل للتعديل بكل العمليات المهمة في مدرستك — للمراجعة والمساءلة
        {typeof count === 'number' && <> · {count.toLocaleString('en-US')} عملية مسجّلة</>}
      </p>

      <ActivityToolbar actors={actors} />
      <ActivityTable rows={rows} />
      <ActivityPagination page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  )
}
