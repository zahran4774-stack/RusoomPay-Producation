// سجل النشاط والتدقيق — مكوّن خادم
// يعرض العمليات المسجّلة في audit_log بترقيم صفحات من جانب الخادم (25/صفحة)،
// بحث نصّي، وفلترة بالمستخدم والفترة الزمنية — كلها منفَّذة كاستعلام واحد على
// الخادم، لا جلب كامل الجدول إلى المتصفح.
//
// ⚠️ إصلاح أسماء المستخدمين: سياسة RLS على profiles (profiles_self_read) تسمح
// لكل مستخدم بقراءة ملفه فقط، فكان الربط profiles(full_name) يرجع فارغاً لأي
// موظف غير المالك فيظهر "النظام". الأسماء تُجلب الآن على الخادم فقط، ومحصورة
// بمدرسة المالك (school_id) وبمعرّفات ظهرت أصلاً في سجله — لا تغيير في سياسات
// قاعدة البيانات ولا في العزل بين المدارس.
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
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

  const schoolId = profile?.school_id as string | null | undefined

  // عميل الخدمة (خادم فقط) لقراءة أسماء الطاقم — إن تعذّر إنشاؤه نرجع للسلوك القديم
  let service: ReturnType<typeof createServiceClient> | null = null
  try { service = createServiceClient() } catch { service = null }

  // قائمة المستخدمين لفلتر "المستخدم" — الطاقم الحالي بالمدرسة فقط (استعلام
  // صغير منفصل، لا علاقة له بحجم سجل التدقيق نفسه)
  const staffClient = service && schoolId ? service : supabase
  const { data: staff } = await staffClient
    .from('profiles')
    .select('id, full_name')
    .eq('school_id', profile?.school_id)
    .in('role', ['owner', 'admin', 'accountant'])
    .order('full_name')
  const actors: ActorOption[] = (staff ?? []).map((s) => ({ id: s.id, name: s.full_name ?? '—' }))

  // الاستعلام الرئيسي — فلترة وترتيب وترقيم صفحات على الخادم بالكامل
  let query = supabase
    .from('audit_log')
    .select('id, action, details, created_at, actor_id', { count: 'exact' })
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

  // أسماء منفّذي العمليات في هذه الصفحة فقط — محصورة بمدرسة المالك
  const actorIds = Array.from(
    new Set((logs ?? []).map((l) => l.actor_id as string | null).filter((v): v is string => !!v))
  )
  const nameById = new Map<string, string>()
  if (actorIds.length > 0) {
    if (service && schoolId) {
      const { data: names } = await service
        .from('profiles')
        .select('id, full_name')
        .in('id', actorIds)
        .eq('school_id', schoolId)
      ;(names ?? []).forEach((n) => { if (n.full_name) nameById.set(n.id, n.full_name) })
    } else {
      // احتياطي: ما تسمح به RLS (ملف المالك نفسه فقط)
      const { data: names } = await supabase.from('profiles').select('id, full_name').in('id', actorIds)
      ;(names ?? []).forEach((n) => { if (n.full_name) nameById.set(n.id, n.full_name) })
    }
  }

  const rows: ActivityRow[] = (logs ?? []).map((l) => {
    const aid = l.actor_id as string | null
    return {
      id: l.id,
      action: l.action,
      details: l.details,
      created_at: l.created_at,
      // actor_id فارغ = عملية نظام فعلية (مثل اعتماد دفعة ثواني تلقائياً)
      // actor_id موجود بلا اسم = مستخدم بلا اسم أو محذوف
      actor: aid ? (nameById.get(aid) ?? 'مستخدم بلا اسم') : 'النظام',
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
