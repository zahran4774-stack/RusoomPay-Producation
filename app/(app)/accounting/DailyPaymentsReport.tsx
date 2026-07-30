'use client'
// app/(app)/accounting/DailyPaymentsReport.tsx
// تقرير المدفوعات اليومية بأسماء الطلاب — للمتابعة اليومية.
// يعتمد على RPC daily_payments_report (معزول بالمدرسة + للطاقم المالي فقط).
// يجلب عملة المدرسة تلقائياً (يدعم جميع عملات الخليج).
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

type Item = {
  student_name: string
  student_code: string
  grade: string | null
  fee_description: string
  amount: number
  method: string
  created_at: string
}
type Report = {
  ok: boolean
  reason?: string
  date?: string
  count?: number
  total?: number
  cash?: number
  bank?: number
  items?: Item[]
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'نقداً', bank: 'تحويل بنكي', card: 'بطاقة', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'عند المدرسة',
}

// رموز عملات الخليج + المنازل العشرية
const CUR_SYM: Record<string, string> = { OMR: 'ر.ع', SAR: 'ر.س', AED: 'د.إ', QAR: 'ر.ق', KWD: 'د.ك', BHD: 'د.ب' }
const CUR_DEC: Record<string, number> = { OMR: 3, KWD: 3, BHD: 3, SAR: 2, AED: 2, QAR: 2 }

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function DailyPaymentsReport() {
  const supabase = createClient()
  const [date, setDate] = useState(todayStr())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState<string>('OMR')

  const sym = CUR_SYM[currency] ?? currency
  const dec = CUR_DEC[currency] ?? 2
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0)

  // جلب عملة المدرسة تلقائياً (مرّة واحدة) — معزول بـ RLS
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('schools').select('currency').limit(1).single()
      if (active && data?.currency) setCurrency(data.currency)
    })()
    return () => { active = false }
  }, [supabase])

  const load = useCallback(
    async (d: string) => {
      setLoading(true)
      const { data, error } = await supabase.rpc('daily_payments_report', { p_date: d })
      setReport(error ? { ok: false, reason: 'error' } : (data as Report))
      setLoading(false)
    },
    [supabase],
  )

  useEffect(() => { load(date) }, [date, load])

  const items = report?.items ?? []

  const timeOf = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } catch { return '—' }
  }

  const shiftDay = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

  function printReport() { window.print() }

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .dpr-sheet, .dpr-sheet * { visibility: visible; }
          .dpr-sheet { position: absolute; inset: 0; padding: 20px; }
          .dpr-no-print { display: none !important; }
        }
      `}</style>

      {/* الرأس */}
      <div className="dpr-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>تقرير المدفوعات اليومية</h2>
          <p style={{ color: '#667', fontSize: 13, margin: '4px 0 0' }}>متابعة يومية لجميع الدفعات المستلمة بأسماء الطلاب</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => shiftDay(-1)} style={btnLite} aria-label="اليوم السابق">‹</button>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={dateInput} />
          <button onClick={() => shiftDay(1)} disabled={date >= todayStr()} style={{ ...btnLite, opacity: date >= todayStr() ? 0.4 : 1 }} aria-label="اليوم التالي">›</button>
          <button onClick={() => setDate(todayStr())} style={btnLite}>اليوم</button>
          <button onClick={printReport} style={btnPrint}>⎙ طباعة</button>
        </div>
      </div>

      <div className="dpr-sheet">
        {/* عنوان الطباعة */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, color: '#0F2744', fontSize: 16 }}>
            تقرير المدفوعات — {new Date(date).toLocaleDateString('en-GB')}
          </div>
        </div>

        {/* بطاقات الإجمالي */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat label="إجمالي اليوم" value={`${fmt(report?.total ?? 0)} ${sym}`} color="#0F2744" bg="#F4F7FB" />
          <Stat label="نقداً" value={`${fmt(report?.cash ?? 0)} ${sym}`} color="#1A7A45" bg="#EFF9F2" />
          <Stat label="تحويل/بطاقة" value={`${fmt(report?.bank ?? 0)} ${sym}`} color="#1D5FA8" bg="#EEF4FC" />
          <Stat label="عدد الدفعات" value={`${report?.count ?? 0}`} color="#B54708" bg="#FFF6ED" />
        </div>

        {/* الحالة */}
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
            لا توجد مدفوعات مسجّلة في هذا اليوم
          </div>
        )}

        {/* الجدول */}
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
                  <th style={th}>الوقت</th>
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
                    <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#556' }}>{timeOf(it.created_at)}</td>
                  </tr>
                ))}
                {/* صف الإجمالي */}
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

        {/* تذييل الطباعة */}
        {report?.ok && items.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12, color: '#8A94A6', textAlign: 'center' }}>
            تقرير المدفوعات اليومية — RusoomPay · {new Date(date).toLocaleDateString('en-GB')}
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
