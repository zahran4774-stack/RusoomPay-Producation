'use client'
// شريط بحث وفلاتر سجل النشاط — يكتب فقط إلى معطيات الرابط (query string).
// لا يجلب أي بيانات بنفسه؛ الخادم (page.tsx) هو من يُعيد الجلب والفلترة
// عند تغيّر الرابط. أي تغيير فلتر يُعيد الصفحة إلى page=1.
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export type ActorOption = { id: string; name: string }

export default function ActivityToolbar({ actors }: { actors: ActorOption[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const apply = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v); else params.delete(k)
    }
    params.delete('page') // أي تغيير فلتر يبدأ من الصفحة الأولى
    router.push(`${pathname}?${params.toString()}`)
  }

  // بحث نصّي مع تأخير بسيط (debounce) لتفادي طلب خادم لكل ضغطة حرف
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get('q') ?? '')) apply({ q: q.trim() || null })
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const hasFilters = searchParams.get('q') || searchParams.get('actor') || searchParams.get('from') || searchParams.get('to')

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center' }}>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 ابحث في الإجراء أو التفاصيل"
        style={{ flex: '1 1 220px', padding: 12, borderRadius: 11, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14.5 }}
      />
      <select
        value={searchParams.get('actor') ?? ''}
        onChange={(e) => apply({ actor: e.target.value || null })}
        style={{ padding: 12, borderRadius: 11, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14, background: '#fff', minWidth: 150 }}
      >
        <option value="">كل المستخدمين</option>
        {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <input
        type="date" value={searchParams.get('from') ?? ''}
        onChange={(e) => apply({ from: e.target.value || null })}
        style={{ padding: 12, borderRadius: 11, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14 }} dir="ltr"
        aria-label="من تاريخ"
      />
      <input
        type="date" value={searchParams.get('to') ?? ''}
        onChange={(e) => apply({ to: e.target.value || null })}
        style={{ padding: 12, borderRadius: 11, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 14 }} dir="ltr"
        aria-label="إلى تاريخ"
      />
      {hasFilters && (
        <button
          type="button"
          onClick={() => { setQ(''); router.push(pathname) }}
          style={{ padding: '11px 16px', borderRadius: 11, border: '1.5px solid #DDE3EC', background: '#fff', color: '#667', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ✕ مسح الفلاتر
        </button>
      )}
    </div>
  )
}
