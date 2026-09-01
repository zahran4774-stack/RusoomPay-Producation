'use client'
// app/(app)/accounting/PayrollYearlyReport.tsx
// تقرير الرواتب الشهرية/السنوية — إجمالي السنة الحالية + جدول تفصيلي بكل دورة راتب
// يعتمد على payroll_yearly_summary(year) — معزول بالمدرسة، يشمل الدورات المعتمدة والمدفوعة فقط
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Row = {
  period_month: number
  status: string
  total_gross: number
  total_net: number
  total_pasi_er: number
  approved_at: string
  is_paid: boolean
}
type Summary = {
  ok?: boolean
  year?: number
  yearly_gross?: number
  yearly_net?: number
  rows?: Row[]
}

const MONTH_NAMES = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const STATUS_LABEL: Record<string, { t: string; c: string; bg: string }> = {
  approved: { t: 'معتمدة (لم تُصرف بعد)', c: '#8A6D0F', bg: '#FBF3D5' },
  paid:     { t: 'مصروفة', c: '#1A7A45', bg: '#EAF7F0' },
}

export default function PayrollYearlyReport({ currency = 'OMR' }: { currency?: string }) {
  const supabase = createClient()
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 6

  const sym = currency === 'OMR' ? 'ر.ع' : currency
  const dec = ['OMR', 'KWD', 'BHD'].includes(currency) ? 3 : 2
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n || 0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setPage(0) // العودة للصفحة الأولى عند تغيير السنة — تجنّباً لصفحة فارغة بعد تبديل البيانات
    supabase.rpc('payroll_yearly_summary', { p_year: year }).then(({ data: d }) => {
      if (active) { setData(d as Summary); setLoading(false) }
    })
    return () => { active = false }
  }, [year, supabase])

  const rows = data?.rows ?? []
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // ترقيم الصفحات: 6 دورات لكل صفحة — صف "الإجمالي" يبقى ثابتاً خارج الترقيم دائماً
  const PAGE_SIZE_SAFE = PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE_SAFE))
  const pageRows = rows.slice(page * PAGE_SIZE_SAFE, page * PAGE_SIZE_SAFE + PAGE_SIZE_SAFE)

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>تقرير الرواتب السنوي</h2>
          <p style={{ color: '#667', fontSize: 13, margin: '4px 0 0' }}>إجمالي الرواتب المعتمدة والمصروفة، شهراً بشهر</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* بطاقة الإجمالي السنوي */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 180px', minWidth: 160, background: '#F4F7FB', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5A6B7B', marginBottom: 4 }}>إجمالي رواتب {year} (إجمالي)</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#0F2744', direction: 'ltr', textAlign: 'right' }}>
            {fmt(data?.yearly_gross ?? 0)} {sym}
          </div>
        </div>
        <div style={{ flex: '1 1 180px', minWidth: 160, background: '#EAF7F0', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5A6B7B', marginBottom: 4 }}>صافي رواتب {year} (بعد الاستقطاعات)</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#1A7A45', direction: 'ltr', textAlign: 'right' }}>
            {fmt(data?.yearly_net ?? 0)} {sym}
          </div>
        </div>
        <div style={{ flex: '1 1 140px', minWidth: 130, background: '#FFF6ED', borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 12.5, color: '#5A6B7B', marginBottom: 4 }}>عدد الدورات</div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#B54708' }}>{rows.length}</div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#8A94A6', padding: 20 }}>جارٍ التحميل…</div>}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24, background: '#F8FAFC', borderRadius: 12 }}>
          لا توجد دورات رواتب معتمدة أو مصروفة لسنة {year}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #EEF1F5', borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#F4F8F7', textAlign: 'right' }}>
                <th style={th}>الشهر</th>
                <th style={th}>الإجمالي</th>
                <th style={th}>الصافي</th>
                <th style={th}>حصة صاحب العمل (تأمينات)</th>
                <th style={th}>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => {
                const st = STATUS_LABEL[r.is_paid ? 'paid' : r.status] ?? STATUS_LABEL.approved
                return (
                  <tr key={r.period_month}>
                    <td style={{ ...td, fontWeight: 600 }}>{MONTH_NAMES[r.period_month]}</td>
                    <td style={{ ...td, direction: 'ltr', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total_gross)} {sym}</td>
                    <td style={{ ...td, direction: 'ltr', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total_net)} {sym}</td>
                    <td style={{ ...td, direction: 'ltr', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total_pasi_er)} {sym}</td>
                    <td style={td}>
                      <span style={{ fontSize: 12.5, background: st.bg, color: st.c, padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                        {st.t}
                      </span>
                    </td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid #0F2744', fontWeight: 700, background: '#F9FBFC' }}>
                <td style={td}>الإجمالي</td>
                <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#0F2744' }}>{fmt(data?.yearly_gross ?? 0)} {sym}</td>
                <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#0F2744' }}>{fmt(data?.yearly_net ?? 0)} {sym}</td>
                <td style={td} colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ترقيم الصفحات — 6 دورات لكل صفحة، يظهر فقط إن تجاوز عدد الدورات صفحة واحدة */}
      {!loading && rows.length > PAGE_SIZE_SAFE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 14 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '7px 16px', borderRadius: 9, border: '1.5px solid #DDE3EC', background: page === 0 ? '#F4F6FA' : '#fff', color: page === 0 ? '#B0B8C4' : '#0F2744', cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600 }}>
            السابق
          </button>
          <span style={{ fontSize: 13, color: '#667', fontWeight: 600 }}>
            صفحة {page + 1} من {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '7px 16px', borderRadius: 9, border: '1.5px solid #DDE3EC', background: page >= totalPages - 1 ? '#F4F6FA' : '#fff', color: page >= totalPages - 1 ? '#B0B8C4' : '#0F2744', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600 }}>
            التالي
          </button>
        </div>
      )}
    </section>
  )
}

const th: React.CSSProperties = { padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: '#475467', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13.5, color: '#1D2939', borderTop: '1px solid #EEF1F5', verticalAlign: 'top' }
