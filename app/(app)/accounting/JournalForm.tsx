'use client'
// نموذج إدخال قيد محاسبي — يفرض توازن المدين والدائن قبل الترحيل
// توجيه تلقائي: كل سطر يقفل خانته المعاكسة لعكس السطر الذي قبله مباشرة —
// يمنع الخطأ البشري بتحديد أي خانة (مدين/دائن) يُسمح بالكتابة فيها لكل سطر تلقائياً.
// يستخدم create_manual_journal_entry (تحقق توازن خادمي + دعم "أخرى" لإنشاء حساب جديد تلقائياً).
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { isBalanced, fmtCurrency, type Account } from '@/lib/accounting'

type Line = { account_id: string; debit: number; credit: number; is_new: boolean; new_name: string }
type Side = 'debit' | 'credit' | null

const PAYROLL_LOCKED_CODES = ['5110', '5120']
const NEW_ACCOUNT_VALUE = '__NEW__'

export default function JournalForm({ accounts, currency }: { accounts: Account[]; currency: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([
    { account_id: '', debit: 0, credit: 0, is_new: false, new_name: '' },
    { account_id: '', debit: 0, credit: 0, is_new: false, new_name: '' },
  ])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const totalD = lines.reduce((s, l) => s + l.debit, 0)
  const totalC = lines.reduce((s, l) => s + l.credit, 0)
  const balanced = isBalanced(lines)
  const fmt = (n: number) => fmtCurrency(n, currency)
  const availableAccounts = accounts.filter((a) => !PAYROLL_LOCKED_CODES.includes(a.code))

  function sideOf(line: Line): Side {
    if (line.debit > 0) return 'debit'
    if (line.credit > 0) return 'credit'
    return null
  }
  function allowedSide(index: number): Side {
    if (index === 0) return null
    const prevSide = sideOf(lines[index - 1])
    if (prevSide === 'debit') return 'credit'
    if (prevSide === 'credit') return 'debit'
    return null
  }

  function setLine(i: number, k: keyof Line, v: string | number | boolean) {
    const next = [...lines]
    next[i] = { ...next[i], [k]: v } as Line
    if (k === 'debit' && Number(v) > 0) next[i].credit = 0
    if (k === 'credit' && Number(v) > 0) next[i].debit = 0
    setLines(next)
  }

  function onAccountChange(i: number, value: string) {
    if (value === NEW_ACCOUNT_VALUE) {
      setLine(i, 'account_id', value)
      setLine(i, 'is_new', true)
    } else {
      setLine(i, 'account_id', value)
      setLine(i, 'is_new', false)
      setLine(i, 'new_name', '')
    }
  }

  async function post() {
    setMsg('')
    const valid = lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0))
    if (valid.length < 2) { setMsg('يلزم سطران على الأقل'); return }
    if (!balanced) { setMsg('القيد غير متوازن: مجموع المدين يجب أن يساوي الدائن'); return }
    if (!desc.trim()) { setMsg('البيان مطلوب'); return }

    // تحقق: كل سطر "حساب جديد" يجب أن يحمل اسماً
    for (const l of valid) {
      if (l.is_new && !l.new_name.trim()) { setMsg('أدخل اسم الحساب الجديد'); return }
    }

    setBusy(true)

    const payloadLines = valid.map((l) => {
      const acc = availableAccounts.find((a) => a.id === l.account_id)
      return {
        account_code: l.is_new ? 'NEW' : (acc?.code ?? ''),
        account_name: l.is_new ? l.new_name.trim() : null,
        debit: l.debit,
        credit: l.credit,
      }
    })

    const { error } = await supabase.rpc('create_manual_journal_entry', {
      p_description: desc.trim(),
      p_date: entryDate,
      p_lines: payloadLines,
    })

    setBusy(false)
    if (error) { setMsg(error.message); return }

    setOpen(false)
    setLines([
      { account_id: '', debit: 0, credit: 0, is_new: false, new_name: '' },
      { account_id: '', debit: 0, credit: 0, is_new: false, new_name: '' },
    ])
    setDesc('')
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
  const numDisabled = { ...num, background: '#F0F2F5', color: '#B0B8C4', cursor: 'not-allowed' }
  const newNameInput = { padding: 8, borderRadius: 8, border: '1.5px solid #D4A017', width: '100%', marginTop: 6 }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <h3 style={{ color: '#0F2744', marginBottom: 12 }}>قيد محاسبي جديد</h3>

      <input placeholder="البيان (وصف القيد)" value={desc} onChange={(e) => setDesc(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 9, border: '1.5px solid #DDE3EC', marginBottom: 10 }} />

      <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} dir="ltr"
        style={{ width: '100%', padding: 10, borderRadius: 9, border: '1.5px solid #DDE3EC', marginBottom: 12 }} />

      <div style={{ background: '#F2F6FA', border: '1px solid #DCE6F0', borderRadius: 9, padding: '10px 13px', marginBottom: 14, fontSize: 12.5, color: '#3A526B', lineHeight: 1.9 }}>
        💡 <b>كيف تختار مدين ودائن؟</b> كل عملية لها طرفان: <b>مدين</b> = الحساب الذي استفاد أو زاد — <b>دائن</b> = الحساب الذي منه خرجت القيمة.
        النظام يوجّهك تلقائياً: اختر جهة السطر الأول، ويُقفل السطر الثاني على الجهة المقابلة ليبقى القيد متوازناً دائماً.
        اختر <b>«أخرى — حساب جديد»</b> لإنشاء حساب غير موجود في القائمة تلقائياً.
      </div>

      <table style={{ width: '100%', fontSize: 14, marginBottom: 10 }}>
        <thead><tr style={{ textAlign: 'right', color: '#667', fontSize: 13 }}>
          <th style={{ padding: 6 }}>الحساب</th><th style={{ padding: 6, width: 110 }}>مدين</th><th style={{ padding: 6, width: 110 }}>دائن</th>
        </tr></thead>
        <tbody>
          {lines.map((l, i) => {
            const allowed = allowedSide(i)
            const debitDisabled = allowed === 'credit'
            const creditDisabled = allowed === 'debit'
            return (
              <tr key={i}>
                <td style={{ padding: 4, verticalAlign: 'top' }}>
                  <select value={l.account_id} onChange={(e) => onAccountChange(i, e.target.value)} style={sel}>
                    <option value="">— اختر الحساب —</option>
                    {availableAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    <option value={NEW_ACCOUNT_VALUE}>➕ أخرى — حساب جديد</option>
                  </select>
                  {l.is_new && (
                    <input
                      placeholder="اسم الحساب الجديد"
                      value={l.new_name}
                      onChange={(e) => setLine(i, 'new_name', e.target.value)}
                      style={newNameInput}
                    />
                  )}
                </td>
                <td style={{ padding: 4, verticalAlign: 'top' }}>
                  <input
                    type="number"
                    value={l.debit || ''}
                    onChange={(e) => setLine(i, 'debit', parseFloat(e.target.value) || 0)}
                    disabled={debitDisabled}
                    style={debitDisabled ? numDisabled : num}
                    title={debitDisabled ? 'السطر السابق مدين — هذا السطر يُكتب في الدائن فقط' : undefined}
                  />
                </td>
                <td style={{ padding: 4, verticalAlign: 'top' }}>
                  <input
                    type="number"
                    value={l.credit || ''}
                    onChange={(e) => setLine(i, 'credit', parseFloat(e.target.value) || 0)}
                    disabled={creditDisabled}
                    style={creditDisabled ? numDisabled : num}
                    title={creditDisabled ? 'السطر السابق دائن — هذا السطر يُكتب في المدين فقط' : undefined}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p style={{ fontSize: 12, color: '#8A94A6', marginBottom: 12, lineHeight: 1.8 }}>
        💡 مصروف الرواتب والتأمينات (5110 / 5120) يُسجَّلان تلقائياً عبر دورة الرواتب فقط — غير متاحين هنا لتفادي التكرار.
      </p>

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
