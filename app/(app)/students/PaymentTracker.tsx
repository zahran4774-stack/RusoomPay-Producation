'use client'
// app/(app)/students/PaymentTracker.tsx
// لوحة تتبع الدفعات الشهرية لطالب واحد — عرض بصري للعام الدراسي الحالي بالكامل،
// يوضّح أي الأشهر دُفع فيها (أخضر) وأيها لا (أحمر)، بناءً على تواريخ الدفعات
// الفعلية (payments.paid_at) — بلا أي تغيير في نظام الفوترة.
// + زر طباعة يُصدر سجلاً كاملاً بالتواريخ والمبالغ والمتبقي التراكمي لكل شهر.
// + الشهر المدفوع قابل للضغط: يعرض فواتير الشهر بكامل تفاصيلها (RPC student_month_payments)
//   مع طباعة كل فاتورة على حدة.
import { useEffect, useState } from 'react'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import { createClient } from '@/lib/supabase-client'
import { printPaymentTracker } from '@/lib/payment-tracker-print'
import { generateInvoice } from '@/lib/invoice-pdf'

type MonthRow = {
  month_label: string
  month_key: string
  paid_amount: number
  has_payment: boolean
  cumulative_remaining: number
  last_payment_date: string | null
}

type SchoolInfo = {
  name: string
  vat?: string | null
  address?: string | null
  phone?: string | null
  logoUrl?: string | null
  branch?: string | null
}

type MonthPayment = {
  payment_id: string
  invoice_number: string | null
  amount: number
  method: string
  paid_at: string
  created_at: string
  fee_description: string
  fee_total: number
  fee_paid: number
  fee_remaining: number
  due_date: string | null
  recorded_by_name: string | null
}

type MonthDetail = {
  ok: boolean
  reason?: string
  student?: { name: string; code: string | null; grade: string | null; section: string | null }
  items?: MonthPayment[]
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'نقداً', onsite: 'نقداً (في المدرسة)', bank: 'تحويل بنكي', card: 'بطاقة',
  check: 'شيك', cheque: 'شيك', thawani: 'دفع إلكتروني', online: 'دفع إلكتروني',
  applepay: 'Apple Pay', googlepay: 'Google Pay',
}

export default function PaymentTracker({
  studentId, studentName, studentCode, school, currency = 'OMR', onClose,
}: {
  studentId: string
  studentName: string
  studentCode?: string | null
  school: SchoolInfo
  currency?: string
  onClose: () => void
}) {
  const supabase = createClient()
  const en = useLanguage().language === 'en'
  const [months, setMonths] = useState<MonthRow[] | null>(null)
  const [err, setErr] = useState('')

  // ─── تفاصيل فواتير شهر محدّد ───
  const [openMonth, setOpenMonth] = useState<MonthRow | null>(null)
  const [detail, setDetail] = useState<MonthDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('student_payment_tracker', { p_student_id: studentId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setErr(error.message); return }
      setMonths(data ?? [])
    })
    return () => { cancelled = true }
  }, [studentId, supabase])

  const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const paidCount = months?.filter((m) => m.has_payment).length ?? 0

  function handlePrint() {
    if (!months) return
    printPaymentTracker({
      school,
      studentName,
      studentCode,
      currency,
      months,
    })
  }

  async function openMonthDetail(m: MonthRow) {
    if (!m.has_payment) return
    setOpenMonth(m)
    setDetail(null)
    setDetailBusy(true)
    const { data, error } = await supabase.rpc('student_month_payments', {
      p_student_id: studentId,
      p_month_key: m.month_key,
    })
    setDetail(error ? { ok: false, reason: 'error' } : (data as MonthDetail))
    setDetailBusy(false)
  }

  function closeMonthDetail() {
    setOpenMonth(null)
    setDetail(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} dir="rtl">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#0F2744' }}>تتبع الدفعات الشهرية</h3>
          <button onClick={onClose} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <p style={{ color: '#667', fontSize: 13.5, marginBottom: 18 }}>{studentName}</p>

        {err && <div style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>⚠ {err}</div>}

        {!months ? (
          <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24 }}>جارٍ التحميل…</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 13.5, color: '#445' }}>
              <span>العام الدراسي الحالي</span>
              <span style={{ fontWeight: 700, color: paidCount >= 6 ? '#1A7A45' : '#C0392B' }}>
                {paidCount} / {months.length} شهراً مدفوعاً
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
              {months.map((m) => {
                const paid = m.has_payment
                const style: React.CSSProperties = {
                  borderRadius: 11, padding: '12px 8px', textAlign: 'center',
                  background: paid ? '#E6F4EC' : '#FCE9E6',
                  border: `1.5px solid ${paid ? '#BFE5D0' : '#F3C9C2'}`,
                  fontFamily: 'inherit', width: '100%',
                  cursor: paid ? 'pointer' : 'default',
                }
                const inner = (
                  <>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{paid ? '✅' : '❌'}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: paid ? '#1A7A45' : '#C0392B' }}>
                      {m.month_label}
                    </div>
                    {paid && (
                      <div style={{ fontSize: 10.5, color: '#5A8A6E', marginTop: 2 }}>{fmt(m.paid_amount)}</div>
                    )}
                  </>
                )
                return paid ? (
                  <button key={m.month_key} type="button" onClick={() => openMonthDetail(m)}
                    title={en ? `Paid ${fmt(m.paid_amount)} — click to view the invoice` : `دُفع ${fmt(m.paid_amount)} — اضغط لعرض الفاتورة`}
                    style={style}>
                    {inner}
                  </button>
                ) : (
                  <div key={m.month_key} title="لم يُدفع شيء هذا الشهر" style={style}>
                    {inner}
                  </div>
                )
              })}
            </div>

            <p style={{ fontSize: 12, color: '#163B68', marginBottom: 12, fontWeight: 600 }}>
              👆 اضغط على أي شهر مدفوع لعرض فاتورته بكامل التفاصيل.
            </p>

            <p style={{ fontSize: 11.5, color: '#8A94A6', marginBottom: 16, lineHeight: 1.7 }}>
              💡 يعتمد هذا التتبع على تواريخ الدفعات الفعلية المسجَّلة، لا على نظام أقساط شهري منفصل.
              شهر بلا أي دفعة يظهر بالأحمر، حتى لو كان الرسم السنوي مدفوعاً جزئياً في شهر آخر.
            </p>

            <button onClick={handlePrint}
              style={{ width: '100%', background: '#163B68', color: '#fff', border: 0, padding: 12, borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
              🖨 طباعة سجل السنة كاملاً
            </button>
          </>
        )}

        <button onClick={onClose}
          style={{ width: '100%', background: '#F2F5F8', color: '#0F2744', border: 0, padding: 12, borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          إغلاق
        </button>
      </div>

      {openMonth && (
        <MonthInvoices
          month={openMonth}
          detail={detail}
          busy={detailBusy}
          school={school}
          currency={currency}
          fallbackName={studentName}
          fallbackCode={studentCode}
          fmt={fmt}
          onClose={closeMonthDetail}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// نافذة فواتير الشهر — كل دفعة = فاتورة كاملة التفاصيل
// ═══════════════════════════════════════════════════════════════
function MonthInvoices({
  month, detail, busy, school, currency, fallbackName, fallbackCode, fmt, onClose,
}: {
  month: MonthRow
  detail: MonthDetail | null
  busy: boolean
  school: SchoolInfo
  currency: string
  fallbackName: string
  fallbackCode?: string | null
  fmt: (n: number) => string
  onClose: () => void
}) {
  const en = useLanguage().language === 'en'
  const items = detail?.items ?? []
  const stu = detail?.student
  const monthTotal = items.reduce((a, it) => a + (Number(it.amount) || 0), 0)
  const scName = school.name + (school.branch ? ` — ${school.branch}` : '')

  const dateOf = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB') } catch { return d }
  }
  const timeOf = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) } catch { return '—' }
  }

  function printOne(it: MonthPayment) {
    generateInvoice({
      school,
      invoiceNo: it.invoice_number || '—',
      paidAt: it.paid_at,
      studentName: stu?.name ?? fallbackName,
      studentCode: stu?.code ?? fallbackCode ?? null,
      feeDescription: it.fee_description,
      amount: Number(it.amount),
      method: it.method,
      currency,
      remaining: it.fee_remaining > 0.0005 ? Number(it.fee_remaining) : null,
    })
  }

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px dashed #EEF1F5', fontSize: 13.5 }}>
      <span style={{ color: '#667' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#0F2744', textAlign: 'left' }}>{value}</span>
    </div>
  )

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(7,25,30,.7)', display: 'grid', placeItems: 'start center', zIndex: 1000, padding: 16, overflowY: 'auto' }}
      dir="rtl">
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, marginTop: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #EEF2F1' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0F2744', fontSize: 16 }}>فواتير {month.month_label}</h3>
            <div style={{ fontSize: 12.5, color: '#667', marginTop: 2 }}>{stu?.name ?? fallbackName}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {busy && <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24 }}>جارٍ تحميل الفاتورة…</div>}

          {!busy && detail && !detail.ok && (
            <div style={{ background: '#FDEEED', color: '#8A2B2B', borderRadius: 10, padding: 14, fontSize: 14 }}>
              {detail.reason === 'forbidden' ? 'ليس لديك صلاحية لعرض الفواتير.' : 'تعذّر تحميل الفاتورة، حاول مجدداً.'}
            </div>
          )}

          {!busy && detail?.ok && items.length === 0 && (
            <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24, background: '#F8FAFC', borderRadius: 12 }}>
              لا توجد دفعات مسجّلة في هذا الشهر
            </div>
          )}

          {!busy && detail?.ok && items.length > 0 && (
            <>
              {items.length > 1 && (
                <div style={{ background: '#EFF9F2', color: '#1A7A45', borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>
                  {items.length} دفعات في هذا الشهر · الإجمالي {fmt(monthTotal)} {currency}
                </div>
              )}

              {items.map((it, i) => {
                const settled = it.fee_remaining <= 0.0005
                return (
                  <div key={it.payment_id}
                    style={{ border: '1px solid #E6EBF1', borderRadius: 14, padding: 16, marginBottom: i === items.length - 1 ? 0 : 14, background: '#fff' }}>
                    {/* ترويسة الفاتورة */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      {school.logoUrl
                        ? <img src={school.logoUrl} alt="" style={{ width: 42, height: 42, borderRadius: 11, objectFit: 'contain', border: '1px solid #E6EBF1' }} />
                        : <div style={{ width: 42, height: 42, borderRadius: 11, background: '#0A1D33', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{(school.name || 'م').trim().charAt(0)}</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: '#0A1D33', fontSize: 15 }}>{scName}</div>
                        <div style={{ fontSize: 11.5, color: '#8A94A6', lineHeight: 1.7 }}>
                          {school.address && <span>{school.address} </span>}
                          {school.phone && <span>· {school.phone} </span>}
                          {school.vat && <span>· الرقم الضريبي: {school.vat}</span>}
                        </div>
                      </div>
                      <span style={{ background: '#E6F4EC', color: '#1A7A45', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>مدفوعة ✓</span>
                    </div>

                    {/* رقم الفاتورة */}
                    <div style={{ background: '#0A1D33', color: '#fff', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12.5, opacity: 0.85 }}>رقم الفاتورة</span>
                      <b style={{ direction: 'ltr', fontSize: 15, letterSpacing: 0.3 }}>{it.invoice_number || '—'}</b>
                    </div>

                    {/* التفاصيل */}
                    <div>
                      {row('الطالب', `${stu?.name ?? fallbackName}${(stu?.code ?? fallbackCode) ? ` (${stu?.code ?? fallbackCode})` : ''}`)}
                      {(stu?.grade || stu?.section) && row('الصف', `${stu?.grade ?? ''}${stu?.section ? ` - ${stu.section}` : ''}`)}
                      {row('البند', it.fee_description)}
                      {row('تاريخ الدفع', dateOf(it.paid_at))}
                      {row('وقت التسجيل', timeOf(it.created_at))}
                      {row('طريقة الدفع', METHOD_LABEL[it.method] || it.method)}
                      {it.recorded_by_name && row('سُجّلت بواسطة', it.recorded_by_name)}
                      {it.due_date && row('تاريخ الاستحقاق', dateOf(it.due_date))}
                      {row('إجمالي الرسم', <span style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(it.fee_total)} {currency}</span>)}
                      {row('إجمالي المسدّد على الرسم', <span style={{ direction: 'ltr', display: 'inline-block' }}>{fmt(it.fee_paid)} {currency}</span>)}
                      {row('المتبقي', <span style={{ direction: 'ltr', display: 'inline-block', color: settled ? '#1A7A45' : '#C0392B' }}>{fmt(it.fee_remaining)} {currency}</span>)}
                    </div>

                    {/* مبلغ هذه الدفعة */}
                    <div style={{ marginTop: 12, background: '#F4F7FB', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRight: '3px solid #C9A227' }}>
                      <span style={{ fontWeight: 700, color: '#0A1D33', fontSize: 14 }}>المبلغ المدفوع في هذه الفاتورة</span>
                      <b style={{ color: '#0A1D33', fontSize: 18, direction: 'ltr' }}>{fmt(it.amount)} {currency}</b>
                    </div>

                    <button onClick={() => printOne(it)}
                      style={{ width: '100%', marginTop: 12, background: '#163B68', color: '#fff', border: 0, padding: 11, borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ⎙ طباعة / حفظ PDF
                    </button>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #EEF2F1', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#F0F3F8', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
