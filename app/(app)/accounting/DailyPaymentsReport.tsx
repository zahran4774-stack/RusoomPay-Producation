'use client'
// app/(app)/accounting/DailyPaymentsReport.tsx
// تقرير المدفوعات — يوم واحد (افتراضي: اليوم) أو فترة مخصّصة (من-إلى).
// يعتمد على RPC daily_payments_report (معزول بالمدرسة + للطاقم المالي فقط).
// الطباعة عبر نافذة منفصلة — مضمونة بصفحة واحدة نظيفة بلا صفحات فارغة.
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

type Item = {
  student_name: string
  student_code: string
  grade: string | null
  fee_description: string
  amount: number
  method: string
  paid_at: string
  created_at: string
}
type Report = {
  ok: boolean
  reason?: string
  from?: string
  to?: string
  is_range?: boolean
  count?: number
  total?: number
  cash?: number
  bank?: number
  items?: Item[]
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'نقداً', bank: 'تحويل بنكي', card: 'بطاقة', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'عند المدرسة',
}
const CUR_SYM: Record<string, string> = { OMR: 'ر.ع', SAR: 'ر.س', AED: 'د.إ', QAR: 'ر.ق', KWD: 'د.ك', BHD: 'د.ب' }
const CUR_DEC: Record<string, number> = { OMR: 3, KWD: 3, BHD: 3, SAR: 2, AED: 2, QAR: 2 }

const todayStr = () => new Date().toISOString().slice(0, 10)
const addDays = (d: string, n: number) => {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

type Mode = 'day' | 'range'

export default function DailyPaymentsReport() {
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('day')
  const [date, setDate] = useState(todayStr())
  const [from, setFrom] = useState(addDays(todayStr(), -6))
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<string>('OMR')
  const [brand, setBrand] = useState<{ name: string; branch: string | null; logoUrl: string | null; vat: string | null }>({
    name: '', branch: null, logoUrl: null, vat: null,
  })

  const sym = CUR_SYM[currency] ?? currency
  const dec = CUR_DEC[currency] ?? 2
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0)

  // جلب هوية المدرسة وعملتها تلقائياً — معزول بـ RLS
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('schools')
        .select('name, branch, logo_url, vat_number, currency')
        .limit(1)
        .single()
      if (!active || !data) return
      if (data.currency) setCurrency(data.currency)
      setBrand({
        name: data.name ?? '',
        branch: data.branch || null,
        logoUrl: data.logo_url || null,
        vat: data.vat_number || null,
      })
    })()
    return () => { active = false }
  }, [supabase])

  const load = useCallback(
    async (p_date: string, p_to: string | null) => {
      setLoading(true)
      const { data, error } = await supabase.rpc('daily_payments_report', { p_date, p_to })
      setReport(error ? { ok: false, reason: 'error' } : (data as Report))
      setLoading(false)
    },
    [supabase],
  )

  useEffect(() => {
    if (mode === 'day') load(date, null)
    else load(from, to)
  }, [mode, date, from, to, load])

  const items = report?.items ?? []

  const timeOf = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }
    catch { return '—' }
  }
  const dateOf = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB') }
    catch { return d }
  }

  const shiftDay = (delta: number) => setDate((d) => addDays(d, delta))

  const quickRange = (days: number) => {
    setTo(todayStr())
    setFrom(addDays(todayStr(), -(days - 1)))
  }
  const thisMonth = () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    setFrom(first)
    setTo(todayStr())
  }

  const rangeLabel = report?.is_range
    ? `${dateOf(report.from ?? '')} — ${dateOf(report.to ?? '')}`
    : dateOf(report?.from ?? date)

  const initial = (brand.name || 'م').trim().charAt(0)

  // ═══ الطباعة عبر نافذة منفصلة — صفحة واحدة نظيفة ═══
  function printReport() {
    if (!report?.ok || items.length === 0) return

    const logoBlock = brand.logoUrl
      ? `<img class="lg-img" src="${brand.logoUrl}" alt="" />`
      : `<div class="lg">${initial}</div>`

    const tbody = items.map((it, i) => `
      <tr>
        <td class="muted">${i + 1}</td>
        <td><div class="sname">${it.student_name}</div><div class="scode">${it.student_code}</div></td>
        <td class="muted">${it.grade ?? '—'}</td>
        <td class="muted">${it.fee_description}</td>
        <td class="n bold">${fmt(it.amount)} ${sym}</td>
        <td><span class="pill ${it.method === 'cash' ? 'cash' : 'bank'}">${METHOD_LABEL[it.method] || it.method}</span></td>
        <td class="n muted">${report.is_range ? dateOf(it.paid_at) : timeOf(it.created_at)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير المدفوعات</title>
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
.vt{font-size:.75rem;color:#8A94A6;margin-top:3px}
.m{text-align:left;flex-shrink:0}
.tl{font-size:1.05rem;font-weight:800;color:#0A1D33;padding:5px 14px;background:#F2F5F9;border-radius:8px;border-right:3px solid #C9A227;display:inline-block}
.pd{font-size:.76rem;color:#8A94A6;margin-top:7px}

/* ═══ بطاقات الملخّص ═══ */
.stats{display:flex;gap:10px;margin:20px 0 16px}
.st{flex:1;border-radius:11px;padding:12px 14px}
.st .lbl{font-size:.72rem;color:#5A6B7B;margin-bottom:3px}
.st .val{font-size:1.05rem;font-weight:800;direction:ltr;text-align:right}
.st.total{background:#F4F7FB}.st.total .val{color:#0A1D33}
.st.cash{background:#EFF9F2}.st.cash .val{color:#1A7A45}
.st.bank{background:#EEF4FC}.st.bank .val{color:#1D5FA8}
.st.cnt{background:#FFF6ED}.st.cnt .val{color:#B54708}

/* ═══ الجدول ═══ */
table{width:100%;border-collapse:separate;border-spacing:0;font-size:.82rem;border:1px solid #E6EBF1;border-radius:10px;overflow:hidden}
th{background:#0A1D33;color:#fff;padding:10px 12px;text-align:right;font-weight:600;font-size:.78rem;white-space:nowrap}
th:not(:last-child){border-left:1px solid rgba(255,255,255,.13)}
td{padding:9px 12px;border-bottom:1px solid #EDF1F6;text-align:right;color:#26333F;vertical-align:top}
tbody tr:nth-child(even) td{background:#FAFBFD}
td.n{direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
td.bold{font-weight:700}
td.muted{color:#5A6B7E}
.sname{font-weight:600;color:#0F1B2D}
.scode{font-size:.7rem;color:#8A94A6;margin-top:1px}
.pill{font-size:.72rem;padding:2px 9px;border-radius:20px;font-weight:600;white-space:nowrap}
.pill.cash{background:#EFF9F2;color:#1A7A45}
.pill.bank{background:#EEF4FC;color:#1D5FA8}
tr.tot td{font-weight:800;background:#F2F5F9;border-top:2px solid #0A1D33;border-bottom:none;color:#0A1D33}

/* ═══ التذييل ═══ */
.f{margin-top:26px;padding-top:13px;border-top:1px solid #E6EBF1;display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#9AA7B8;gap:12px}
.f-brand{font-weight:600;color:#5A6B7E}
.f-dot{width:5px;height:5px;border-radius:50%;background:#C9A227;display:inline-block;margin-left:6px;vertical-align:middle}

@media print{
  body{padding:0}
  table{page-break-inside:auto}
  tr{page-break-inside:avoid;page-break-after:auto}
  thead{display:table-header-group}
  @page{margin:12mm}
}
</style></head><body>
<div class="h">
  <div class="b">${logoBlock}
    <div>
      <div class="sn">${brand.name}</div>
      ${brand.branch ? `<div class="br">${brand.branch}</div>` : ''}
      ${brand.vat ? `<div class="vt">الرقم الضريبي: ${brand.vat}</div>` : ''}
    </div>
  </div>
  <div class="m"><div class="tl">تقرير المدفوعات</div><div class="pd">${rangeLabel}</div></div>
</div>

<div class="stats">
  <div class="st total"><div class="lbl">الإجمالي</div><div class="val">${fmt(report.total ?? 0)} ${sym}</div></div>
  <div class="st cash"><div class="lbl">نقداً</div><div class="val">${fmt(report.cash ?? 0)} ${sym}</div></div>
  <div class="st bank"><div class="lbl">تحويل/بطاقة</div><div class="val">${fmt(report.bank ?? 0)} ${sym}</div></div>
  <div class="st cnt"><div class="lbl">عدد الدفعات</div><div class="val">${report.count ?? 0}</div></div>
</div>

<table>
  <thead><tr>
    <th>#</th><th>الطالب</th><th>الصف</th><th>البند</th><th>المبلغ</th><th>الطريقة</th><th>${report.is_range ? 'التاريخ' : 'الوقت'}</th>
  </tr></thead>
  <tbody>
    ${tbody}
    <tr class="tot">
      <td></td>
      <td colspan="3">الإجمالي (${report.count} دفعة)</td>
      <td class="n">${fmt(report.total ?? 0)} ${sym}</td>
      <td colspan="2"></td>
    </tr>
  </tbody>
</table>

<div class="f">
  <span><span class="f-dot"></span><span class="f-brand">RusoomPay</span> — النظام المحاسبي للمدارس</span>
  <span>${rangeLabel}</span>
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=650')
    if (!win) { alert('فعّل النوافذ المنبثقة للطباعة'); return }
    win.document.write(html)
    win.document.close()

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
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      {/* الرأس */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>تقرير المدفوعات</h2>
          <p style={{ color: '#667', fontSize: 13, margin: '4px 0 0' }}>متابعة الدفعات المستلمة بأسماء الطلاب — يوم واحد أو فترة محدّدة</p>
        </div>
        <button
          onClick={printReport}
          disabled={!report?.ok || items.length === 0}
          style={{ ...btnPrint, opacity: (!report?.ok || items.length === 0) ? 0.45 : 1, cursor: (!report?.ok || items.length === 0) ? 'not-allowed' : 'pointer' }}
        >⎙ طباعة</button>
      </div>

      {/* مبدّل الوضع */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode('day')} style={mode === 'day' ? tabActive : tabLite}>يوم واحد</button>
        <button onClick={() => setMode('range')} style={mode === 'range' ? tabActive : tabLite}>فترة (من/إلى)</button>
      </div>

      {/* أدوات التحكم — يوم واحد */}
      {mode === 'day' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => shiftDay(-1)} style={btnLite} aria-label="اليوم السابق">‹</button>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={dateInput} />
          <button onClick={() => shiftDay(1)} disabled={date >= todayStr()} style={{ ...btnLite, opacity: date >= todayStr() ? 0.4 : 1 }} aria-label="اليوم التالي">›</button>
          <button onClick={() => setDate(todayStr())} style={btnLite}>اليوم</button>
        </div>
      )}

      {/* أدوات التحكم — فترة */}
      {mode === 'range' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#556' }}>من</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
          <label style={{ fontSize: 13, color: '#556' }}>إلى</label>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} style={dateInput} />
          <button onClick={() => quickRange(7)} style={btnLite}>آخر 7 أيام</button>
          <button onClick={() => quickRange(30)} style={btnLite}>آخر 30 يوم</button>
          <button onClick={thisMonth} style={btnLite}>هذا الشهر</button>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: '#0F2744', fontSize: 16 }}>
          تقرير المدفوعات — {rangeLabel}
        </div>
      </div>

      {/* بطاقات الإجمالي */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Stat label="الإجمالي" value={`${fmt(report?.total ?? 0)} ${sym}`} color="#0F2744" bg="#F4F7FB" />
        <Stat label="نقداً" value={`${fmt(report?.cash ?? 0)} ${sym}`} color="#1A7A45" bg="#EFF9F2" />
        <Stat label="تحويل/بطاقة" value={`${fmt(report?.bank ?? 0)} ${sym}`} color="#1D5FA8" bg="#EEF4FC" />
        <Stat label="عدد الدفعات" value={`${report?.count ?? 0}`} color="#B54708" bg="#FFF6ED" />
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24 }}>جارٍ التحميل…</div>}

      {!loading && report && !report.ok && (
        <div style={{ background: '#FDEEED', color: '#8A2B2B', borderRadius: 10, padding: 14, fontSize: 14 }}>
          {report.reason === 'forbidden'
            ? 'ليس لديك صلاحية لعرض هذا التقرير.'
            : report.reason === 'no_school'
              ? 'لا توجد مدرسة مرتبطة بحسابك.'
              : 'تعذّر تحميل التقرير، حاول مجدداً.'}
        </div>
      )}

      {!loading && report?.ok && items.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8A94A6', padding: 28, background: '#F8FAFC', borderRadius: 12 }}>
          لا توجد مدفوعات مسجّلة في هذه الفترة
        </div>
      )}

      {!loading && report?.ok && items.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #EEF1F5', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#F4F8F7', textAlign: 'right' }}>
                <th style={th}>#</th>
                <th style={th}>الطالب</th>
                <th style={th}>الصف</th>
                <th style={th}>البند</th>
                <th style={th}>المبلغ</th>
                <th style={th}>الطريقة</th>
                <th style={th}>{report?.is_range ? 'التاريخ' : 'الوقت'}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: '#8A94A6' }}>{i + 1}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: '#0F1B2D' }}>{it.student_name}</div>
                    <div style={{ fontSize: 12, color: '#8A94A6' }}>{it.student_code}</div>
                  </td>
                  <td style={{ ...td, color: '#556' }}>{it.grade ?? '—'}</td>
                  <td style={{ ...td, color: '#556' }}>{it.fee_description}</td>
                  <td style={{ ...td, direction: 'ltr', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(it.amount)} {sym}</td>
                  <td style={td}>
                    <span style={{ fontSize: 12.5, background: it.method === 'cash' ? '#EFF9F2' : '#EEF4FC', color: it.method === 'cash' ? '#1A7A45' : '#1D5FA8', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                      {METHOD_LABEL[it.method] || it.method}
                    </span>
                  </td>
                  <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#556' }}>
                    {report?.is_range ? dateOf(it.paid_at) : timeOf(it.created_at)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #0F2744', fontWeight: 700, background: '#F9FBFC' }}>
                <td style={td}></td>
                <td style={td} colSpan={3}>الإجمالي ({report.count} دفعة)</td>
                <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#0F2744' }}>{fmt(report.total ?? 0)} {sym}</td>
                <td style={td} colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 130, background: bg, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 12.5, color: '#5A6B7B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, direction: 'ltr', textAlign: 'right' }}>{value}</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: '#475467', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13.5, color: '#1D2939', borderTop: '1px solid #EEF1F5', verticalAlign: 'top' }
const btnLite: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDE3EC', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#334' }
const dateInput: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontSize: 14, fontFamily: 'inherit', background: '#fff' }
const btnPrint: React.CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#163B68', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }
const tabLite: React.CSSProperties = { padding: '8px 16px', borderRadius: 20, border: '1.5px solid #DDE3EC', background: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#556' }
const tabActive: React.CSSProperties = { ...tabLite, background: '#0F2744', color: '#fff', border: '1.5px solid #0F2744' }
