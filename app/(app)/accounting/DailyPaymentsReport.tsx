'use client'
// app/(app)/accounting/DailyPaymentsReport.tsx
// تقرير المدفوعات — يوم واحد (افتراضي: اليوم) أو فترة مخصّصة (من-إلى).
// يعتمد على RPC daily_payments_report (معزول بالمدرسة + للطاقم المالي فقط).
// يجلب هوية المدرسة (الاسم/الفرع/الشعار/العملة) تلقائياً.
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
  const [date, setDate] = useState(todayStr())        // وضع اليوم الواحد
  const [from, setFrom] = useState(addDays(todayStr(), -6)) // وضع الفترة
  const [to, setTo] = useState(todayStr())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<string>('OMR')
  // هوية المدرسة للترويسة المطبوعة
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

  // تحميل عند تغيّر الوضع أو التواريخ
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

  function printReport() { window.print() }

  const rangeLabel = report?.is_range
    ? `${dateOf(report.from ?? '')} — ${dateOf(report.to ?? '')}`
    : dateOf(report?.from ?? date)

  const initial = (brand.name || 'م').trim().charAt(0)

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .dpr-sheet, .dpr-sheet * { visibility: visible; }
          .dpr-sheet { position: absolute; inset: 0; padding: 20px; }
          .dpr-no-print { display: none !important; }
          .dpr-print-only { display: flex !important; }
        }
        .dpr-print-only { display: none; }
      `}</style>

      {/* الرأس */}
      <div className="dpr-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>تقرير المدفوعات</h2>
          <p style={{ color: '#667', fontSize: 13, margin: '4px 0 0' }}>متابعة الدفعات المستلمة بأسماء الطلاب — يوم واحد أو فترة محدّدة</p>
        </div>
        <button onClick={printReport} style={btnPrint}>⎙ طباعة</button>
      </div>

      {/* مبدّل الوضع */}
      <div className="dpr-no-print" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMode('day')} style={mode === 'day' ? tabActive : tabLite}>يوم واحد</button>
        <button onClick={() => setMode('range')} style={mode === 'range' ? tabActive : tabLite}>فترة (من/إلى)</button>
      </div>

      {/* أدوات التحكم — يوم واحد */}
      {mode === 'day' && (
        <div className="dpr-no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => shiftDay(-1)} style={btnLite} aria-label="اليوم السابق">‹</button>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={dateInput} />
          <button onClick={() => shiftDay(1)} disabled={date >= todayStr()} style={{ ...btnLite, opacity: date >= todayStr() ? 0.4 : 1 }} aria-label="اليوم التالي">›</button>
          <button onClick={() => setDate(todayStr())} style={btnLite}>اليوم</button>
        </div>
      )}

      {/* أدوات التحكم — فترة */}
      {mode === 'range' && (
        <div className="dpr-no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#556' }}>من</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
          <label style={{ fontSize: 13, color: '#556' }}>إلى</label>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} style={dateInput} />
          <button onClick={() => quickRange(7)} style={btnLite}>آخر 7 أيام</button>
          <button onClick={() => quickRange(30)} style={btnLite}>آخر 30 يوم</button>
          <button onClick={thisMonth} style={btnLite}>هذا الشهر</button>
        </div>
      )}

      <div className="dpr-sheet">
        {/* ═══ ترويسة الطباعة — تظهر عند الطباعة فقط ═══ */}
        <div className="dpr-print-only" style={{
          justifyContent: 'space-between', alignItems: 'flex-start', gap: 20,
          paddingBottom: 14, borderBottom: '2px solid #0A1D33', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', border: '1px solid #E6EBF1', background: '#fff' }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#0A1D33', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 800 }}>{initial}</div>
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1D33', lineHeight: 1.3 }}>{brand.name}</div>
              {brand.branch && <div style={{ fontSize: 12, color: '#5A6B7E', fontWeight: 500 }}>{brand.branch}</div>}
              {brand.vat && <div style={{ fontSize: 11, color: '#8A94A6', marginTop: 2 }}>الرقم الضريبي: {brand.vat}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0A1D33', background: '#F2F5F9', borderRight: '3px solid #C9A227', padding: '5px 13px', borderRadius: 8, display: 'inline-block' }}>
              تقرير المدفوعات
            </div>
            <div style={{ fontSize: 11.5, color: '#8A94A6', marginTop: 6 }}>{rangeLabel}</div>
          </div>
        </div>

        {/* عنوان الشاشة (يختفي عند الطباعة لأن الترويسة تغني عنه) */}
        <div className="dpr-no-print" style={{ marginBottom: 14 }}>
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

        {report?.ok && items.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E6EBF1', fontSize: 11.5, color: '#9AA7B8', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9A227', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}></span><span style={{ fontWeight: 600, color: '#5A6B7E' }}>RusoomPay</span> — النظام المحاسبي للمدارس</span>
            <span>{rangeLabel}</span>
          </div>
        )}
      </div>
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
const btnPrint: React.CSSProperties = { padding: '9px 16px', borderRadius: 10, border: 'none', background: '#163B68', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
const tabLite: React.CSSProperties = { padding: '8px 16px', borderRadius: 20, border: '1.5px solid #DDE3EC', background: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: '#556' }
const tabActive: React.CSSProperties = { ...tabLite, background: '#0F2744', color: '#fff', border: '1.5px solid #0F2744' }
