'use client'
// app/(app)/accounting/JournalList.tsx
// عرض القيود مع زرّ التصحيح بالعكس (بدل التعديل/الحذف — حفاظاً على النزاهة).
// المخوّل: المدير والمحاسب. القيد المعكوس يُوسم بوضوح.
// + فلترة من تاريخ إلى تاريخ + بحث بالاسم (اسم الطالب / الوصف / المرجع) عبر RPC search_journal_entries
//   (بحث على كل القيود في قاعدة البيانات، لا على آخر 60 قيداً فقط).
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { RotateCcw, ShieldCheck, Search, X } from 'lucide-react'

type Entry = {
  id: string; entry_date: string; description: string | null
  reference: string | null; reversed_by_entry: string | null; reverses_entry: string | null
  journal_lines: { debit: number }[]
  student_name?: string | null
}

type SearchResult = { ok: boolean; reason?: string; total?: number; limit?: number; items?: Entry[] }

export default function JournalList({
  entries, currency, canReverse,
}: {
  entries: Entry[]; currency: string; canReverse: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 6
  const sym = currency === 'OMR' ? 'ر.ع' : currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

  // ─── الفلترة ───
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const trimmed = query.trim()
  const rangeInvalid = !!from && !!to && from > to
  const active = !!from || !!to || trimmed.length > 0

  useEffect(() => {
    if (!active) { setResult(null); setSearching(false); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_journal_entries', {
        p_from: from || null,
        p_to: to || null,
        p_q: trimmed || null,
        p_limit: 500,
      })
      if (cancelled) return
      setResult(error ? { ok: false, reason: 'error' } : (data as SearchResult))
      setSearching(false)
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, from, to, trimmed, refreshKey])

  // عند تغيّر الفلاتر أو النتائج أو عدد القيود نعود للصفحة الأولى
  useEffect(() => { setPage(0) }, [entries.length, from, to, trimmed, result])

  const list: Entry[] = active ? (result?.ok ? (result.items ?? []) : []) : entries
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const pageEntries = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function clearFilters() { setFrom(''); setTo(''); setQuery('') }

  async function reverse(e: Entry) {
    const reason = window.prompt(`تصحيح القيد بإنشاء قيد عكسي.\nاكتب سبب التصحيح (يُسجّل للتدقيق):`)
    if (reason === null) return
    if (reason.trim() === '') { alert('يجب ذكر سبب التصحيح'); return }
    setBusyId(e.id)
    const { error } = await supabase.rpc('reverse_journal_entry', { p_entry_id: e.id, p_reason: reason.trim() })
    setBusyId(null)
    if (error) { alert('تعذّر التصحيح: ' + error.message); return }
    router.refresh()
    setRefreshKey((k) => k + 1)   // أعد تنفيذ البحث الحالي ليشمل القيد العكسي الجديد
  }

  if (entries.length === 0 && !active) return <div style={{ color: '#999' }}>لا توجد قيود بعد</div>

  const dateInput: React.CSSProperties = {
    padding: '8px 10px', borderRadius: 9, border: '1.5px solid #DDE3EC', fontSize: 13.5,
    fontFamily: 'inherit', background: '#fff', color: '#1D2939',
  }

  return (
    <div>
      {/* شريط الفلترة */}
      <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F0F3F8' }}>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={16} color="#8A94A6" style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم (الطالب / الوصف / المرجع)…"
            aria-label="بحث في القيود"
            style={{ ...dateInput, width: '100%', boxSizing: 'border-box', padding: '10px 38px', fontSize: 14 }}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="مسح البحث"
              style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: '#EEF1F5', color: '#556', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: '#556' }}>من</label>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={dateInput} dir="ltr" />
          <label style={{ fontSize: 13, fontWeight: 700, color: '#556' }}>إلى</label>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={dateInput} dir="ltr" />
          {active && (
            <button onClick={clearFilters}
              style={{ ...dateInput, cursor: 'pointer', fontWeight: 700, color: '#667', border: '1.5px solid #EEF2F7' }}>
              ✕ مسح الفلاتر
            </button>
          )}
        </div>

        {rangeInvalid && (
          <div style={{ color: '#C0392B', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>
            ⚠ تاريخ "من" بعد تاريخ "إلى" — سيتم عكسهما تلقائياً
          </div>
        )}

        {active && (
          <div style={{ fontSize: 13, color: '#667', marginTop: 10 }}>
            {searching && 'جارٍ البحث…'}
            {!searching && result?.ok && (
              <>
                {result.total ?? 0} قيد مطابق
                {(result.total ?? 0) > (result.items?.length ?? 0) && ` (يُعرض أحدث ${result.items?.length})`}
              </>
            )}
            {!searching && result && !result.ok && (
              <span style={{ color: '#C0392B' }}>
                {result.reason === 'forbidden' ? 'ليس لديك صلاحية البحث في القيود.' : 'تعذّر البحث، حاول مجدداً.'}
              </span>
            )}
          </div>
        )}
      </div>

      {active && !searching && result?.ok && list.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24, background: '#F8FAFC', borderRadius: 12 }}>
          لا توجد قيود مطابقة للفلاتر المحددة
        </div>
      )}

      {pageEntries.map((e) => {
        const d = e.journal_lines.reduce((s, l) => s + l.debit, 0)
        const isReversed = !!e.reversed_by_entry     // قيد أصلي عُكِس
        const isReversal = !!e.reverses_entry        // قيد عكسي (تصحيح)
        const showStudent = !!e.student_name && !(e.description ?? '').includes(e.student_name)
        return (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F0F3F8', fontSize: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: '#0F2744' }}>{e.entry_date} · {e.description || '—'}</span>
                {isReversed && (
                  <span style={{ fontSize: 11, background: '#FEF0F0', color: '#B42318', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>مُصحّح (معكوس)</span>
                )}
                {isReversal && (
                  <span style={{ fontSize: 11, background: '#EEF4F3', color: '#1E5C4E', padding: '2px 8px', borderRadius: 20, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <RotateCcw size={10} /> قيد تصحيحي
                  </span>
                )}
              </div>
              {showStudent && (
                <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 2 }}>الطالب: {e.student_name}</div>
              )}
            </div>
            <b style={{ whiteSpace: 'nowrap' }}>{fmt(d)} {sym}</b>
            {/* زرّ التصحيح — يظهر فقط للقيود الأصلية غير المعكوسة، وللمخوّلين */}
            {canReverse && !isReversed && !isReversal && (
              <button onClick={() => reverse(e)} disabled={busyId === e.id}
                title="تصحيح بقيد عكسي"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#B42318', background: 'none', border: '1px solid #F0C8C0', borderRadius: 8, padding: '5px 10px', cursor: busyId === e.id ? 'wait' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                <RotateCcw size={13} /> {busyId === e.id ? '...' : 'تصحيح'}
              </button>
            )}
          </div>
        )
      })}

      {/* ترقيم الصفحات — 6 قيود لكل صفحة */}
      {list.length > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 8 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #DDE3EC', background: page === 0 ? '#F4F6FA' : '#fff', color: page === 0 ? '#B0B8C4' : '#0F2744', cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            السابق
          </button>
          <span style={{ fontSize: 12.5, color: '#667', fontWeight: 600 }}>
            صفحة {page + 1} من {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #DDE3EC', background: page >= totalPages - 1 ? '#F4F6FA' : '#fff', color: page >= totalPages - 1 ? '#B0B8C4' : '#0F2744', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
            التالي
          </button>
        </div>
      )}
      {/* شرح النزاهة */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', background: '#F7FAF9', borderRadius: 10, fontSize: 12, color: '#667' }}>
        <ShieldCheck size={16} color="#1E5C4E" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>حفاظاً على نزاهة الحسابات، القيود المرحّلة لا تُعدّل ولا تُحذف. التصحيح يتمّ بإنشاء <b>قيد عكسي</b> يُلغي أثر الخطأ ويبقى مسجّلاً للتدقيق.</span>
      </div>
    </div>
  )
}
