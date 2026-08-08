'use client'
// app/(app)/accounting/PeriodReports.tsx
// التقارير المالية الفترّية — المحاسب يختار المدى، ويولّد: ميزان المراجعة،
// قائمة الدخل، الميزانية، دفتر اليومية. التصدير عبر HTML بخط Cairo (عربية سليمة).
import { useState, useEffect } from 'react'
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
  // هوية المدرسة للترويسة المطبوعة (الشعار والفرع)
  const [brand, setBrand] = useState<{ logoUrl: string | null; branch: string | null }>({ logoUrl: null, branch: null })

  const sym = school.currency === 'OMR' ? 'ر.ع' : school.currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

  // جلب الشعار والفرع تلقائياً — معزول بـ RLS
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('schools').select('logo_url, branch').limit(1).single()
      if (active && data) setBrand({ logoUrl: data.logo_url || null, branch: data.branch || null })
    })()
    return () => { active = false }
  }, [supabase])

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

  // التصدير: HTML بخط Cairo عبر نافذة الطباعة — المتصفح يحفظه PDF بعربية سليمة
  function exportPDF() {
    if (!rows || rows.length === 0) return
    const kindLabel = KINDS.find((k) => k.key === kind)!.label
    const period = kind === 'balance' ? `كما في ${to}` : `من ${from} إلى ${to}`
    const initial = (school.name || 'م').trim().charAt(0)

    // الشعار الفعلي إن وُجد، وإلا الحرف الأول كبديل
    const logoBlock = brand.logoUrl
      ? `<img class="lg-img" src="${brand.logoUrl}" alt="" />`
      : `<div class="lg">${initial}</div>`

    let thead = ''
    let tbody = ''

    if (kind === 'trial') {
      const totD = rows.reduce((s, r) => s + (r.debit as number), 0)
      const totC = rows.reduce((s, r) => s + (r.credit as number), 0)
      thead = '<th>الرمز</th><th>الحساب</th><th>مدين</th><th>دائن</th>'
      tbody = rows.map((r) =>
        `<tr><td>${r.code}</td><td>${r.name}</td><td class="n">${fmt(r.debit as number)}</td><td class="n">${fmt(r.credit as number)}</td></tr>`
      ).join('')
      tbody += `<tr class="tot"><td colspan="2">الإجمالي</td><td class="n">${fmt(totD)}</td><td class="n">${fmt(totC)}</td></tr>`
    } else if (kind === 'journal') {
      thead = '<th>التاريخ</th><th>المرجع</th><th>الحساب</th><th>مدين</th><th>دائن</th>'
      tbody = rows.map((r) =>
        `<tr><td>${r.entry_date}</td><td>${r.reference ?? '—'}</td><td>${r.account_name}</td><td class="n">${fmt(r.debit as number)}</td><td class="n">${fmt(r.credit as number)}</td></tr>`
      ).join('')
    } else if (kind === 'vat') {
      const r = rows[0] as { applies: boolean; vat_rate: number; revenue_total: number; vat_amount: number } | undefined
      if (!r?.applies) {
        thead = '<th>البيان</th>'
        tbody = '<tr><td>الضريبة غير مطبّقة على هذه المدرسة</td></tr>'
      } else {
        thead = '<th>البند</th><th>القيمة</th>'
        tbody =
          `<tr><td>نسبة الضريبة</td><td class="n">${r.vat_rate}%</td></tr>` +
          `<tr><td>إجمالي الإيرادات (قبل الضريبة)</td><td class="n">${fmt(r.revenue_total)} ${sym}</td></tr>` +
          `<tr class="tot"><td>قيمة الضريبة المستحقّة</td><td class="n">${fmt(r.vat_amount)} ${sym}</td></tr>`
      }
    } else {
      const valKey = kind === 'income' ? 'amount' : 'balance'
      thead = `<th>القسم</th><th>الحساب</th><th>القيمة (${sym})</th>`
      tbody = rows.map((r) =>
        `<tr><td>${typeLabel(r.section as string)}</td><td>${r.name}</td><td class="n">${fmt(r[valKey] as number)}</td></tr>`
      ).join('')
    }

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${kindLabel}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Cairo',Tahoma,sans-serif}
body{padding:32px 30px;color:#1a2530;background:#fff}

/* ═══ الترويسة ═══ */
.h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:18px;border-bottom:2px solid #0A1D33;position:relative}
.h::after{content:'';position:absolute;bottom:-2px;right:0;width:96px;height:2px;background:#C9A227}
.b{display:flex;gap:13px;align-items:center}
.lg{width:52px;height:52px;border-radius:13px;background:#0A1D33;color:#fff;display:grid;place-items:center;font-size:1.5rem;font-weight:800;flex-shrink:0}
.lg-img{width:52px;height:52px;border-radius:13px;object-fit:contain;background:#fff;border:1px solid #E6EBF1;flex-shrink:0}
.sn{font-size:1.3rem;font-weight:800;color:#0A1D33;line-height:1.3}
.br{font-size:.82rem;color:#5A6B7E;margin-top:1px;font-weight:500}
.vt{font-size:.75rem;color:#8A94A6;margin-top:3px;letter-spacing:.2px}
.m{text-align:left;flex-shrink:0}
.tl{font-size:1.05rem;font-weight:800;color:#0A1D33;padding:5px 14px;background:#F2F5F9;border-radius:8px;border-right:3px solid #C9A227;display:inline-block}
.pd{font-size:.76rem;color:#8A94A6;margin-top:7px;letter-spacing:.2px}

.ct{font-size:.76rem;color:#8A94A6;background:#F7F9FC;padding:4px 11px;border-radius:20px;display:inline-block;margin:18px 0 12px}

/* ═══ الجدول ═══ */
table{width:100%;border-collapse:separate;border-spacing:0;font-size:.85rem;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
th{background:#0A1D33;color:#fff;padding:11px 13px;text-align:right;font-weight:600;font-size:.83rem;letter-spacing:.2px}
th:not(:last-child){border-left:1px solid rgba(255,255,255,.13)}
td{padding:10px 13px;border-bottom:1px solid #EDF1F6;text-align:right;color:#26333F}
td.n{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}
tbody tr:nth-child(even) td{background:#FAFBFD}
tr.tot td{font-weight:800;background:#F2F5F9;border-top:2px solid #0A1D33;border-bottom:none;color:#0A1D33}

/* ═══ التذييل ═══ */
.f{margin-top:28px;padding-top:13px;border-top:1px solid #E6EBF1;display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#9AA7B8;gap:12px}
.f-brand{font-weight:600;color:#5A6B7E}
.f-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;display:inline-block;margin-left:6px;vertical-align:middle}

@media print{
  body{padding:0}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid;page-break-after:auto}
  thead{display:table-header-group}
}
</style></head><body>
<div class="h">
  <div class="b">${logoBlock}
    <div>
      <div class="sn">${school.name}</div>
      ${brand.branch ? `<div class="br">${brand.branch}</div>` : ''}
      ${school.vat_number ? `<div class="vt">الرقم الضريبي: ${school.vat_number}</div>` : ''}
    </div>
  </div>
  <div class="m"><div class="tl">${kindLabel}</div><div class="pd">${period}</div></div>
</div>
<div class="ct">عدد السجلات: ${rows.length}</div>
<table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
<div class="f">
  <span><span class="f-dot"></span><span class="f-brand">RusoomPay</span> — النظام المحاسبي للمدارس</span>
  <span>${new Date().getFullYear()} · ${school.name}</span>
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=650')
    if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
    win.document.write(html)
    win.document.close()

    // انتظر تحميل الخط والشعار قبل الطباعة
    const doPrint = () => { try { win.focus(); win.print() } catch { /* نافذة أُغلقت */ } }

    const waitForImages = (): Promise<void> => {
      const imgs = Array.from(win.document.images)
      if (imgs.length === 0) return Promise.resolve()
      return Promise.all(
        imgs.map((img) => img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
        )
      ).then(() => undefined)
    }

    const fonts = (win.document as Document & { fonts?: FontFaceSet }).fonts
    const fontsReady = fonts && fonts.ready ? fonts.ready.then(() => undefined) : Promise.resolve()

    Promise.all([fontsReady, waitForImages()]).then(() => setTimeout(doPrint, 150))
    setTimeout(doPrint, 3000)
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
              style={{ display: 'block', height: 42, padding: '0 10px', borderRadius: 9, border: '1.5px solid #E2E7EE', marginTop: 5, fontFamily: 'inherit' }} />
          </label>
        )}
        <label style={{ fontSize: 13, fontWeight: 600 }}>{kind === 'balance' ? 'كما في تاريخ' : 'إلى'}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            style={{ display: 'block', height: 42, padding: '0 10px', borderRadius: 9, border: '1.5px solid #E2E7EE', marginTop: 5, fontFamily: 'inherit' }} />
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
                ⬇ تصدير / طباعة PDF
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
