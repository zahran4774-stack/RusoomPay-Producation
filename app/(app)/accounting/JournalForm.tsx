'use client'
// نموذج إدخال قيد محاسبي — يفرض توازن المدين والدائن قبل الترحيل
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { isBalanced, fmtCurrency, type Account } from '@/lib/accounting'

type Line = { account_id: string; debit: number; credit: number }

export default function JournalForm({ accounts, currency }: { accounts: Account[]; currency: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { account_id: '', debit: 0, credit: 0 },
    { account_id: '', debit: 0, credit: 0 },
  ])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const totalD = lines.reduce((s, l) => s + l.debit, 0)
  const totalC = lines.reduce((s, l) => s + l.credit, 0)
  const balanced = isBalanced(lines)
  const fmt = (n: number) => fmtCurrency(n, currency)

  function setLine(i: number, k: keyof Line, v: string | number) {
    const next = [...lines]
    next[i] = { ...next[i], [k]: v } as Line
    // عند إدخال قيمة موجبة في المدين، فرّغ الدائن لنفس السطر (والعكس) — كل سطر جانب واحد
    if (k === 'debit' && Number(v) > 0) next[i].credit = 0
    if (k === 'credit' && Number(v) > 0) next[i].debit = 0
    setLines(next)
  }
  function addLine() { setLines([...lines, { account_id: '', debit: 0, credit: 0 }]) }

  async function post() {
    setMsg('')
    const valid = lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0))
    if (valid.length < 2) { setMsg('يلزم سطران على الأقل'); return }
    if (!balanced) { setMsg('القيد غير متوازن: مجموع المدين يجب أن يساوي الدائن'); return }
    setBusy(true)

    const schoolId = (await supabase.from('profiles').select('school_id').single()).data?.school_id

    // إنشاء القيد
    const { data: entry, error: e1 } = await supabase
      .from('journal_entries')
      .insert({ school_id: schoolId, description: desc, reference: 'JV-' + Date.now() })
      .select('id').single()
    if (e1 || !entry) { setMsg('تعذّر إنشاء القيد'); setBusy(false); return }

    // إدراج السطور
    const rows = valid.map((l) => ({ ...l, entry_id: entry.id, school_id: schoolId }))
    const { error: e2 } = await supabase.from('journal_lines').insert(rows)
    if (e2) { setMsg('تعذّر ترحيل السطور'); setBusy(false); return }

    setBusy(false); setOpen(false)
    setLines([{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }]); setDesc('')
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}>
        ＋ قيد محاسبي جديد
      </button>
    )
  }

  const sel = { padding: 8, borderRadius: 8, border: '1.5px solid #DDE3EC', width: '100%' }
  const num = { padding: 8, borderRadius: 8, border: '1.5px solid #DDE3EC', width: '100%' }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <h3 style={{ color: '#0F2744', marginBottom: 12 }}>قيد محاسبي جديد</h3>
      <input placeholder="البيان (وصف القيد)" value={desc} onChange={(e) => setDesc(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 9, border: '1.5px solid #DDE3EC', marginBottom: 12 }} />

      <table style={{ width: '100%', fontSize: 14, marginBottom: 10 }}>
        <thead><tr style={{ textAlign: 'right', color: '#667', fontSize: 13 }}>
          <th style={{ padding: 6 }}>الحساب</th><th style={{ padding: 6, width: 110 }}>مدين</th><th style={{ padding: 6, width: 110 }}>دائن</th>
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: 4 }}>
                <select value={l.account_id} onChange={(e) => setLine(i, 'account_id', e.target.value)} style={sel}>
                  <option value="">— اختر الحساب —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </select>
              </td>
              <td style={{ padding: 4 }}>
                <input type="number" value={l.debit || ''} onChange={(e) => setLine(i, 'debit', parseFloat(e.target.value) || 0)} style={num} />
              </td>
              <td style={{ padding: 4 }}>
                <input type="number" value={l.credit || ''} onChange={(e) => setLine(i, 'credit', parseFloat(e.target.value) || 0)} style={num} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={addLine} style={{ background: 'none', border: '1px dashed #163B68', color: '#163B68', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
        ＋ سطر آخر
      </button>

      {/* مؤشر التوازن */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, borderRadius: 9, background: balanced ? '#E6F4EC' : '#FCE9E6', color: balanced ? '#1A7A45' : '#C0392B', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        <span>مدين: {fmt(totalD)}</span>
        <span>دائن: {fmt(totalC)}</span>
        <span>{balanced ? '✓ متوازن' : '⚠️ غير متوازن'}</span>
      </div>

      {msg && <div style={{ color: '#C0392B', fontSize: 13, marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(false)} style={{ padding: '10px 18px', background: '#F0F3F8', border: 'none', borderRadius: 9, cursor: 'pointer' }}>إلغاء</button>
        <button onClick={post} disabled={busy || !balanced}
          style={{ padding: '10px 18px', background: balanced ? '#163B68' : '#9AA7B8', color: '#fff', border: 'none', borderRadius: 9, cursor: balanced ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
          {busy ? 'جارٍ الترحيل…' : 'ترحيل القيد'}
        </button>
      </div>
    </div>
  )
}
