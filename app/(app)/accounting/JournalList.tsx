'use client'
// app/(app)/accounting/JournalList.tsx
// عرض القيود مع زرّ التصحيح بالعكس (بدل التعديل/الحذف — حفاظاً على النزاهة).
// المخوّل: المدير والمحاسب. القيد المعكوس يُوسم بوضوح.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { RotateCcw, ShieldCheck } from 'lucide-react'

type Entry = {
  id: string; entry_date: string; description: string | null
  reference: string | null; reversed_by_entry: string | null; reverses_entry: string | null
  journal_lines: { debit: number }[]
}

export default function JournalList({
  entries, currency, canReverse,
}: {
  entries: Entry[]; currency: string; canReverse: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const sym = currency === 'OMR' ? 'ر.ع' : currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

  async function reverse(e: Entry) {
    const reason = window.prompt(`تصحيح القيد بإنشاء قيد عكسي.\nاكتب سبب التصحيح (يُسجّل للتدقيق):`)
    if (reason === null) return
    if (reason.trim() === '') { alert('يجب ذكر سبب التصحيح'); return }
    setBusyId(e.id)
    const { error } = await supabase.rpc('reverse_journal_entry', { p_entry_id: e.id, p_reason: reason.trim() })
    setBusyId(null)
    if (error) { alert('تعذّر التصحيح: ' + error.message); return }
    router.refresh()
  }

  if (entries.length === 0) return <div style={{ color: '#999' }}>لا توجد قيود بعد</div>

  return (
    <div>
      {entries.slice(0, 12).map((e) => {
        const d = e.journal_lines.reduce((s, l) => s + l.debit, 0)
        const isReversed = !!e.reversed_by_entry     // قيد أصلي عُكِس
        const isReversal = !!e.reverses_entry        // قيد عكسي (تصحيح)
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
      {/* شرح النزاهة */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: '10px 12px', background: '#F7FAF9', borderRadius: 10, fontSize: 12, color: '#667' }}>
        <ShieldCheck size={16} color="#1E5C4E" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>حفاظاً على نزاهة الحسابات، القيود المرحّلة لا تُعدّل ولا تُحذف. التصحيح يتمّ بإنشاء <b>قيد عكسي</b> يُلغي أثر الخطأ ويبقى مسجّلاً للتدقيق.</span>
      </div>
    </div>
  )
}
