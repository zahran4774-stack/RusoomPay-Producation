'use client'
// app/(app)/accounting/PeriodReports.tsx
// التقارير المالية الفترّية — المحاسب يختار المدى، ويولّد: ميزان المراجعة،
// قائمة الدخل، الميزانية، دفتر اليومية. مع تصدير PDF لكشوف المدقّقين.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type School = { name: string; vat_number: string | null; currency: string }
type ReportKind = 'trial' | 'income' | 'balance' | 'journal' | 'vat'

const KINDS: { key: ReportKind; label: string; hint: string }[] = [
  { key: 'trial', label: 'ميزان المراجعة', hint: 'مدين ودائن لكل حساب — أساس التدقيق' },
  { key: 'income', label: 'قائمة الدخل', hint: 'الإيرادات والمصروفات وصافي الربح' },
  { key: 'balance', label: 'الميزانية العمومية', hint: 'الأصول والخصوم وحقوق الملكية' },
  { key: 'journal', label: 'دفتر اليومية', hint: 'كل القيود ضمن المدة — لكشوف المدقّقين' },
  { key: 'vat', label: 'التقرير الضريبي', hint: 'ضريبة القيمة المضافة حسب قانون الدولة' },
]

const typeLabel = (t: string) =>
  ({ asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' } as Record<string, string>)[t] || t

export default function PeriodReports({ school }: { school: School }) {
  const supabase = createClient()
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01-01`)
  const [to, setTo] = useState(`${year}-12-31`)
  const [kind, setKind] = useState<ReportKind>('trial')
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const sym = school.currency === 'OMR' ? 'ر.ع' : school.currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

  async function generate() {
    setBusy(true); setErr(''); setRows(null)
    try {
      let res
      if (kind === 'trial') res = await supabase.rpc('trial_balance_period', { p_from: from, p_to: to })
      else if (kind === 'income') res = await supabase.rpc('income_statement_period', { p_from: from, p_to: to })
      else if (kind === 'balance') res = await supabase.rpc('balance_sheet_asof', { p_asof: to })
      else if (kind === 'vat') res = await supabase.rpc('vat_report_period', { p_from: from, p_to: to })
      else res = await supabase.rpc('journal_period', { p_from: from, p_to: to })
      if (res.error) throw res.error
      setRows((res.data ?? []) as Record<string, unknown>[])
    } catch (e) {
      setErr('تعذّر إنشاء التقرير: ' + (e as { message?: string }).message)
    } finally {
      setBusy(false)
    }
  }

  async function exportPDF() {
    if (!rows || rows.length === 0) return
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const kindLabel = KINDS.find((k) => k.key === kind)!.label
    // ترويسة
    doc.setFontSize(16); doc.text(school.name, 200, 18, { align: 'right' })
    doc.setFontSize(11)
    if (school.vat_number) doc.text(`VAT: ${school.vat_number}`, 200, 25, { align: 'right' })
    doc.setFontSize(13); doc.text(kindLabel, 200, 34, { align: 'right' })
    doc.setFontSize(10)
    const period = kind === 'balance' ? `كما في ${to}` : `من ${from} إلى ${to}`
    doc.text(period, 200, 40, { align: 'right' })
    doc.line(10, 44, 200, 44)

    // جدول مبسّط (نصّي — يتحمّل العربية عبر عرض القيم يميناً)
    let y = 52
    doc.setFontSize(9)
    rows.forEach((r) => {
      if (y > 280) { doc.addPage(); y = 20 }
      let line = ''
      if (kind === 'trial') line = `${r.code}  ${r.name}   مدين ${fmt(r.debit as number)}  دائن ${fmt(r.credit as number)}`
      else if (kind === 'income') line = `[${typeLabel(r.section as string)}] ${r.name}: ${fmt(r.amount as number)}`
      else if (kind === 'balance') line = `[${typeLabel(r.section as string)}] ${r.name}: ${fmt(r.balance as number)}`
      else if (kind === 'vat') {
        if (!(r.applies as boolean)) { line = 'الضريبة غير مطبّقة على هذه المدرسة' }
        else {
          doc.text(`نسبة الضريبة: ${r.vat_rate}%`, 200, y, { align: 'right' }); y += 6
          doc.text(`إجمالي الإيرادات: ${fmt(r.revenue_total as number)}`, 200, y, { align: 'right' }); y += 6
          line = `قيمة الضريبة المستحقّة: ${fmt(r.vat_amount as number)}`
        }
      }
      else line = `${r.entry_date}  ${r.account_name}  مدين ${fmt(r.debit as number)} دائن ${fmt(r.credit as number)}`
      doc.text(line, 200, y, { align: 'right' })
      y += 6
    })
    doc.save(`${kindLabel}-${from}-${to}.pdf`)
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #E2E7EE', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <h2 style={{ color: '#0F2744', fontSize: '1.2rem', margin: '0 0 4px' }}>التقارير المالية الفترّية</h2>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px' }}>
        اختر نوع التقرير والمدة، ثم صدّره PDF — مناسب للتقارير السنوية والضريبية وكشوف المدقّقين.
      </p>

      {/* اختيار نوع التقرير */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 16 }}>
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => { setKind(k.key); setRows(null) }}
            style={{
              textAlign: 'right', cursor: 'pointer', padding: '12px 14px', borderRadius: 12,
              border: `1.5px solid ${kind === k.key ? '#1E5C4E' : '#E2E7EE'}`,
              background: kind === k.key ? '#F0F7F5' : '#fff', fontFamily: 'inherit',
            }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0F2744' }}>{k.label}</div>
            <div style={{ fontSize: 11.5, color: '#8A94A6', marginTop: 3 }}>{k.hint}</div>
          </button>
        ))}
      </div>

      {/* اختيار المدة */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        {kind !== 'balance' && (
          <label style={{ fontSize: 13, fontWeight: 600 }}>من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              style={{ display: 'block', height: 42, padding: '0 10px', borderRadius: 9, border: '1.5px solid #E2E7EE', marginTop: 5 }} />
          </label>
        )}
        <label style={{ fontSize: 13, fontWeight: 600 }}>{kind === 'balance' ? 'كما في تاريخ' : 'إلى'}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ display: 'block', height: 42, padding: '0 10px', borderRadius: 9, border: '1.5px solid #E2E7EE', marginTop: 5 }} />
        </label>
        {/* اختصارات سريعة */}
        <button onClick={() => { setFrom(`${year}-01-01`); setTo(`${year}-12-31`) }}
          style={{ height: 42, padding: '0 14px', borderRadius: 9, border: '1px solid #CBD5D1', background: '#F7FAF9', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
          السنة الحالية
        </button>
        <button onClick={generate} disabled={busy}
          style={{ height: 42, padding: '0 22px', borderRadius: 9, border: 'none', background: '#1E5C4E', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'جارٍ…' : 'إنشاء التقرير'}
        </button>
      </div>

      {err && <div style={{ color: '#B42318', fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {/* النتائج */}
      {rows && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#667' }}>{rows.length} سطر</span>
            {rows.length > 0 && (
              <button onClick={exportPDF}
                style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#163B68', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                ⬇ تصدير PDF
              </button>
            )}
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#999', background: '#F7FAF9', borderRadius: 10 }}>لا حركات في هذه المدة.</div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #EEF2F1', borderRadius: 10 }}>
              <ReportTable kind={kind} rows={rows} fmt={fmt} sym={sym} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ReportTable({ kind, rows, fmt, sym }: { kind: ReportKind; rows: Record<string, unknown>[]; fmt: (n: number) => string; sym: string }) {
  const th: React.CSSProperties = { padding: 10, textAlign: 'right', background: '#F4F8F7', color: '#0F2744', fontSize: 12.5, whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: 10, fontSize: 13, borderBottom: '1px solid #EEF2F1' }
  const num: React.CSSProperties = { ...td, direction: 'ltr', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }

  if (kind === 'trial') {
    const totD = rows.reduce((s, r) => s + (r.debit as number), 0)
    const totC = rows.reduce((s, r) => s + (r.credit as number), 0)
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
        <thead><tr><th style={th}>الرمز</th><th style={th}>الحساب</th><th style={th}>مدين</th><th style={th}>دائن</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td style={td}>{r.code as string}</td><td style={td}>{r.name as string}</td>
              <td style={num}>{fmt(r.debit as number)}</td><td style={num}>{fmt(r.credit as number)}</td></tr>
          ))}
          <tr style={{ fontWeight: 700, background: '#F7FAF9' }}>
            <td style={td} colSpan={2}>الإجمالي</td>
            <td style={num}>{fmt(totD)}</td><td style={num}>{fmt(totC)}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  if (kind === 'journal') {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
        <thead><tr><th style={th}>التاريخ</th><th style={th}>المرجع</th><th style={th}>الحساب</th><th style={th}>مدين</th><th style={th}>دائن</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}><td style={td}>{r.entry_date as string}</td><td style={td}>{(r.reference as string) || '—'}</td>
              <td style={td}>{r.account_name as string}</td>
              <td style={num}>{fmt(r.debit as number)}</td><td style={num}>{fmt(r.credit as number)}</td></tr>
          ))}
        </tbody>
      </table>
    )
  }
  if (kind === 'vat') {
    const r = rows[0] as { applies: boolean; vat_rate: number; revenue_total: number; vat_amount: number } | undefined
    if (!r || !r.applies) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: '#667', fontSize: 14 }}>
          الضريبة غير مطبّقة على مدرستك (حسب قانون دولتك أو إعداد المدرسة).
        </div>
      )
    }
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
        <tbody>
          <tr><td style={td}>نسبة الضريبة</td><td style={num}>{r.vat_rate}%</td></tr>
          <tr><td style={td}>إجمالي الإيرادات (قبل الضريبة)</td><td style={num}>{fmt(r.revenue_total)} {sym}</td></tr>
          <tr style={{ fontWeight: 700, background: '#F7FAF9' }}>
            <td style={td}>قيمة الضريبة المستحقّة</td><td style={num}>{fmt(r.vat_amount)} {sym}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  // income / balance
  const valKey = kind === 'income' ? 'amount' : 'balance'
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
      <thead><tr><th style={th}>القسم</th><th style={th}>الحساب</th><th style={th}>القيمة ({sym})</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td style={td}>{typeLabel(r.section as string)}</td><td style={td}>{r.name as string}</td>
            <td style={num}>{fmt(r[valKey] as number)}</td></tr>
        ))}
      </tbody>
    </table>
  )
}

// تحميل jsPDF كسولاً من CDN
let _p: Promise<{ new (o: object): { setFontSize: (n: number) => void; text: (t: string, x: number, y: number, o?: object) => void; line: (a: number, b: number, c: number, d: number) => void; addPage: () => void; save: (n: string) => void } }> | null = null
function loadJsPDF() {
  const w = window as unknown as { jspdf?: { jsPDF: unknown } }
  if (w.jspdf?.jsPDF) return Promise.resolve(w.jspdf.jsPDF as never)
  if (!_p) {
    _p = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
      s.onload = () => resolve((window as unknown as { jspdf: { jsPDF: never } }).jspdf.jsPDF)
      s.onerror = () => reject(new Error('load failed'))
      document.head.appendChild(s)
    })
  }
  return _p
}
