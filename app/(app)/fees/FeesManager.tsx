'use client'
// مدير الرسوم — بحث وتصفية + بطاقات ملخّص + صفوف قابلة للطي (Accordion) + صفحات (Pagination)
// الفاتورة تحمل هوية المدرسة (لا المنصة) · المتبقي يُخفى عند الطباعة/التنزيل
import { useState, useMemo } from 'react'
import { generateInvoice } from '@/lib/invoice-pdf'
import CashPayment from './CashPayment'
import RefundButton from './RefundButton'
const CUR_DEC: Record<string, number> = { OMR: 3, KWD: 3, BHD: 3, SAR: 2, AED: 2, QAR: 2 }
const CUR_SYM: Record<string, string> = { OMR: 'ر.ع', SAR: 'ر.س', AED: 'د.إ', QAR: 'ر.ق', KWD: 'د.ك', BHD: 'د.ب' }

type Fee = { id: string; description: string; total: number; paid: number; due_date: string | null }
type Student = { id: string; code: string; full_name: string; grade: string; section: string | null; student_fees: Fee[] }
type School = {
  name: string; branch: string | null; currency: string; cr_number: string | null
  moe_license: string | null; vat_number: string | null; phone: string | null
  email: string | null; address: string | null; logo_url: string | null; color: string | null
  bank_name?: string | null; bank_account?: string | null; bank_iban?: string | null
  bank_holder?: string | null; bank_enabled?: boolean | null
} | null

const PAGE_SIZE = 20

export default function FeesManager({ students, school, currency }: { students: Student[]; school: School; currency: string }) {
  const [invoice, setInvoice] = useState<{ student: Student; fee: Fee } | null>(null)
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [open, setOpen] = useState<string | null>(null)   // الطالب المفتوح (Accordion)
  const [page, setPage] = useState(1)

  const dec = CUR_DEC[currency] ?? 3
  const sym = CUR_SYM[currency] ?? 'ر.ع'
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  const grades = useMemo(
    () => Array.from(new Set(students.map((s) => s.grade).filter(Boolean))).sort(),
    [students]
  )

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return students.filter((s) => {
      if (grade && s.grade !== grade) return false
      if (term) {
        const hay = `${s.full_name} ${s.code} ${s.section ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (overdueOnly) {
        const fees = s.student_fees ?? []
        const remain = fees.reduce((a, f) => a + ((f.total ?? 0) - (f.paid ?? 0)), 0)
        if (remain <= 0.0005) return false
      }
      return true
    })
  }, [students, q, grade, overdueOnly])

  // ملخّص شامل لكل النتائج المُصفّاة (يظهر دائماً)
  const summary = useMemo(() => {
    let tot = 0, paid = 0, overdueStudents = 0
    filtered.forEach((s) => {
      let sRemain = 0
      ;(s.student_fees ?? []).forEach((f) => { tot += f.total ?? 0; paid += f.paid ?? 0; sRemain += (f.total ?? 0) - (f.paid ?? 0) })
      if (sRemain > 0.0005) overdueStudents++
    })
    return { tot, paid, remain: tot - paid, overdueStudents }
  }, [filtered])

  const active = q.trim() !== '' || grade !== '' || overdueOnly

  // إعادة الصفحة للأولى عند تغيّر التصفية
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const resetPage = () => setPage(1)

  const inp: React.CSSProperties = {
    padding: '10px 12px', borderRadius: 10, border: '1.5px solid #DDE3EC',
    fontSize: 14, fontFamily: 'inherit', background: '#fff',
  }

  // بطاقة ملخّص صغيرة
  const StatCard = ({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) => (
    <div style={{ flex: '1 1 150px', background: bg, borderRadius: 12, padding: '14px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 12.5, color: '#5A6B7B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, direction: 'ltr', textAlign: 'right' }}>{value}</div>
    </div>
  )

  return (
    <div>
      {/* بطاقات الملخّص العلوية */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatCard label="إجمالي الرسوم" value={`${fmt(summary.tot)} ${sym}`} color="#0F2744" bg="#F4F7FB" />
        <StatCard label="المحصّل" value={`${fmt(summary.paid)} ${sym}`} color="#1A7A45" bg="#EFF9F2" />
        <StatCard label="المتبقّي" value={`${fmt(summary.remain)} ${sym}`} color="#C0392B" bg="#FDEEED" />
        <StatCard label="طلاب عليهم متأخرات" value={`${summary.overdueStudents}`} color="#B54708" bg="#FFF6ED" />
      </div>

      {/* شريط البحث والتصفية */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); resetPage() }}
            placeholder="🔍 ابحث بالاسم أو الرقم المدرسي أو الشعبة"
            style={{ ...inp, flex: '1 1 260px' }}
          />

          <select value={grade} onChange={(e) => { setGrade(e.target.value); resetPage() }}
                  style={{ ...inp, flex: '0 1 180px', cursor: 'pointer' }}>
            <option value="">كل الصفوف</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>

          <button
            onClick={() => { setOverdueOnly((v) => !v); resetPage() }}
            style={{
              ...inp, cursor: 'pointer', fontWeight: 700,
              border: `1.5px solid ${overdueOnly ? '#C0392B' : '#DDE3EC'}`,
              background: overdueOnly ? '#FBE9E9' : '#fff',
              color: overdueOnly ? '#8A2B2B' : '#445',
            }}>
            {overdueOnly ? '✓ ' : ''}المتأخرات فقط
          </button>

          {active && (
            <button
              onClick={() => { setQ(''); setGrade(''); setOverdueOnly(false); resetPage() }}
              style={{ ...inp, cursor: 'pointer', color: '#667', border: '1.5px solid #EEF2F7' }}>
              ✕ مسح
            </button>
          )}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #EEF2F7',
                      display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
                      gap: 8, fontSize: 13.5 }}>
          <span style={{ color: '#556' }}>
            عرض {pageItems.length} من {filtered.length}{active ? ` (مُصفّى من ${students.length})` : ' طالب'}
          </span>
        </div>
      </div>

      {/* لا نتائج */}
      {filtered.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 32, textAlign: 'center',
                      color: '#8A94A6', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          {students.length === 0 ? 'لا يوجد طلاب بعد' : 'لا نتائج مطابقة — جرّب تعديل البحث'}
        </div>
      )}

      {/* قائمة الطلاب — صفوف قابلة للطي */}
      {filtered.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          {pageItems.map((s, idx) => {
            const fees = s.student_fees ?? []
            const tot = fees.reduce((a, f) => a + f.total, 0)
            const paid = fees.reduce((a, f) => a + f.paid, 0)
            const remain = tot - paid
            const isOpen = open === s.id
            return (
              <div key={s.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid #EEF2F7' }}>
                {/* رأس الصف — قابل للنقر */}
                <div
                  onClick={() => setOpen(isOpen ? null : s.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 10, flexWrap: 'wrap', padding: '14px 18px', cursor: 'pointer',
                    background: isOpen ? '#F8FAFC' : '#fff', transition: 'background .15s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ color: '#8A94A6', fontSize: 13, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0F2744' }}>{s.full_name}</div>
                      <div style={{ fontSize: 12.5, color: '#667' }}>{s.code} · الصف {s.grade}{s.section ? ` - ${s.section}` : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12.5, color: '#667' }}>الإجمالي <b style={{ color: '#0F2744', direction: 'ltr', display: 'inline-block' }}>{fmt(tot)}</b></span>
                    {remain > 0.0005 ? (
                      <span style={{ background: '#FBE9E9', color: '#8A2B2B', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                        متبقٍ {fmt(remain)} {sym}
                      </span>
                    ) : (
                      <span style={{ background: '#EFF9F2', color: '#1A7A45', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                        مسدّد بالكامل ✓
                      </span>
                    )}
                  </div>
                </div>

                {/* تفاصيل الرسوم — تظهر عند الفتح */}
                {isOpen && (
                  <div style={{ padding: '0 18px 18px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ textAlign: 'right', color: '#667', fontSize: 13 }}>
                          <th style={{ padding: '6px 8px' }}>البند</th><th style={{ padding: '6px 8px' }}>الإجمالي</th>
                          <th style={{ padding: '6px 8px' }}>المسدّد</th><th style={{ padding: '6px 8px' }}>المتبقي</th>
                          <th style={{ padding: '6px 8px' }}>فاتورة</th>
                          <th style={{ padding: '6px 8px' }}>الدفع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fees.map((f) => {
                          const due = f.total - f.paid
                          return (
                            <tr key={f.id} style={{ borderTop: '1px solid #F0F3F8' }}>
                              <td style={{ padding: '8px' }}>{f.description}</td>
                              <td style={{ padding: '8px' }}>{fmt(f.total)}</td>
                              <td style={{ padding: '8px' }}>{fmt(f.paid)}</td>
                              <td style={{ padding: '8px', color: due > 0.0005 ? '#C0392B' : '#1A7A45', fontWeight: due > 0.0005 ? 600 : 400 }}>{fmt(due)}</td>
                              <td style={{ padding: '8px' }}>
                                <button onClick={() => setInvoice({ student: s, fee: f })}
                                  title="طباعة فاتورة هذا البند"
                                  style={{ background: '#FBF3D5', border: '1px solid #E8D9A4', borderRadius: 8, padding: '4px 9px', cursor: 'pointer' }}>
                                  🧾
                                </button>
                              </td>
                              <td style={{ padding: '8px' }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <CashPayment fee={f} studentName={s.full_name} currency={currency} sym={sym} dec={dec} />
                                  <RefundButton fee={f} studentName={s.full_name} currency={currency} sym={sym} dec={dec} />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {fees.length === 0 && <tr><td colSpan={6} style={{ padding: 12, color: '#999' }}>لا توجد رسوم</td></tr>}
                        {fees.length > 0 && (
                          <tr style={{ borderTop: '2px solid #0F2744', fontWeight: 700 }}>
                            <td style={{ padding: '8px' }}>الإجمالي</td>
                            <td style={{ padding: '8px' }}>{fmt(tot)}</td>
                            <td style={{ padding: '8px' }}>{fmt(paid)}</td>
                            <td style={{ padding: '8px' }}>{fmt(tot - paid)}</td><td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* الترقيم (Pagination) */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{ ...inp, cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.5 : 1, fontWeight: 700 }}>
            ‹ السابق
          </button>
          <span style={{ fontSize: 13.5, color: '#556', padding: '0 8px' }}>
            صفحة {safePage} من {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{ ...inp, cursor: safePage === totalPages ? 'default' : 'pointer', opacity: safePage === totalPages ? 0.5 : 1, fontWeight: 700 }}>
            التالي ›
          </button>
        </div>
      )}

      {invoice && (
        <InvoiceModal student={invoice.student} fee={invoice.fee} school={school} sym={sym} fmt={fmt}
          onClose={() => setInvoice(null)} />
      )}
    </div>
  )
}

function InvoiceModal({ student, fee, school, sym, fmt, onClose }: {
  student: Student; fee: Fee; school: School; sym: string; fmt: (n: number) => string; onClose: () => void
}) {
  const due = fee.total - fee.paid
  const ref = `INV-${student.code}-${new Date().toISOString().slice(0, 10)}`
  const scName = (school?.name ?? 'المدرسة') + (school?.branch ? ` — ${school.branch}` : '')
  const status = due <= 0.0005 ? 'مسدّدة بالكامل' : fee.paid > 0 ? 'مسدّدة جزئياً' : 'غير مسدّدة'
  const [pdfBusy, setPdfBusy] = useState(false)

  async function downloadPDF() {
    setPdfBusy(true)
    try {
      generateInvoice({
        school: { name: scName, vat: school?.vat_number, address: school?.address, phone: school?.phone },
        invoiceNo: ref,
        paidAt: new Date().toISOString(),
        studentName: student.full_name,
        studentCode: student.code,
        feeDescription: fee.description,
        amount: fee.paid,
        method: 'bank',
        currency: school?.currency ?? 'OMR',
        remaining: due > 0.0005 ? due : null,
      })
    } catch {
      alert('تعذّر إنشاء ملف PDF، حاول مجدداً')
    } finally {
      setPdfBusy(false)
    }
  }

  function printInvoice() {
    window.print()
  }

  return (
    <div className="inv-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(7,25,30,.82)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'grid', placeItems: 'start center', padding: 16, overflowY: 'auto', zIndex: 100 }} dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .inv-sheet, .inv-sheet * { visibility: visible; }
          .inv-sheet { position: absolute; inset: 0; box-shadow: none; }
          .inv-no-print { display: none !important; }
          .inv-remaining { display: none !important; }
        }
      `}</style>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(94vw, 560px)', marginTop: 20 }}>
        <div className="inv-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #EEF2F1' }}>
          <h3 style={{ color: '#0F2744' }}>فاتورة رسوم</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div className="inv-sheet" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {school?.logo_url
              ? <img src={school.logo_url} alt="" style={{ width: 42, height: 42, borderRadius: 11, objectFit: 'cover' }} />
              : <div style={{ width: 42, height: 42, borderRadius: 11, background: school?.color ?? '#0F2744', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{scName.trim().charAt(0)}</div>}
            <b style={{ color: '#0F2744', fontSize: 17 }}>{scName}</b>
          </div>
          <div style={{ fontSize: 12, color: '#667', lineHeight: 1.9, marginBottom: 14 }}>
            {school?.address && <div>📍 {school.address}</div>}
            {school?.cr_number && <div>س.ت: {school.cr_number}{school.moe_license ? ` · ترخيص: ${school.moe_license}` : ''}</div>}
            {school?.vat_number && <div>الرقم الضريبي: {school.vat_number}</div>}
            {(school?.phone || school?.email) && <div>{school?.phone ? `📞 ${school.phone}` : ''}{school?.email ? ` · ✉ ${school.email}` : ''}</div>}
          </div>

          <table style={{ width: '100%', fontSize: 13, marginBottom: 10 }}>
            <tbody>
              <tr><td style={{ color: '#667' }}>رقم الفاتورة</td><td style={{ textAlign: 'end', fontWeight: 700 }}>{ref}</td></tr>
              <tr><td style={{ color: '#667' }}>الطالب</td><td style={{ textAlign: 'end' }}>{student.full_name} ({student.code})</td></tr>
              <tr><td style={{ color: '#667' }}>الصف</td><td style={{ textAlign: 'end' }}>{student.grade}</td></tr>
              <tr><td style={{ color: '#667' }}>تاريخ الإصدار</td><td style={{ textAlign: 'end' }}>{new Date().toISOString().slice(0, 10)}</td></tr>
            </tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0F2744', color: '#fff' }}>
                <th style={{ padding: 8, textAlign: 'right' }}>البند</th>
                <th style={{ padding: 8 }}>الإجمالي</th><th style={{ padding: 8 }}>المسدّد</th>
                <th className="inv-remaining" style={{ padding: 8 }}>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8 }}>{fee.description}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{fmt(fee.total)} {sym}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{fmt(fee.paid)} {sym}</td>
                <td className="inv-remaining" style={{ padding: 8, textAlign: 'center' }}>{fmt(due)} {sym}</td>
              </tr>
              <tr style={{ background: '#F4F8F7', fontWeight: 700 }}>
                <td style={{ padding: 8 }}>الحالة: {status}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{fmt(fee.total)}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{fmt(fee.paid)}</td>
                <td className="inv-remaining" style={{ padding: 8, textAlign: 'center' }}>{fmt(due)}</td>
              </tr>
            </tbody>
          </table>

          {school?.bank_enabled && school?.bank_account && (
            <div style={{ marginTop: 16, background: '#F4F8F7', border: '1px solid #D8E8E0', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, color: '#0F2744', fontSize: 13, marginBottom: 8 }}>🏦 للتحويل البنكي إلى المدرسة</div>
              {school.bank_name && <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#667' }}>البنك</span><b>{school.bank_name}</b></div>}
              <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#667' }}>رقم الحساب</span><b style={{ direction: 'ltr' }}>{school.bank_account}</b></div>
              {school.bank_iban && <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#667' }}>الآيبان</span><b style={{ direction: 'ltr' }}>{school.bank_iban}</b></div>}
              {school.bank_holder && <div style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#667' }}>صاحب الحساب</span><b>{school.bank_holder}</b></div>}
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: '#667', textAlign: 'center' }}>
            فاتورة رسمية صادرة عن {scName} — {ref}
          </div>
        </div>

        <div className="inv-no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #EEF2F1' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#F0F3F8', border: 'none', borderRadius: 9, cursor: 'pointer' }}>إغلاق</button>
          <button onClick={downloadPDF} disabled={pdfBusy} style={{ padding: '10px 18px', background: '#1E5C4E', color: '#fff', border: 'none', borderRadius: 9, cursor: pdfBusy ? 'wait' : 'pointer', fontWeight: 700, opacity: pdfBusy ? 0.7 : 1 }}>{pdfBusy ? 'جارٍ الإنشاء…' : '⬇ تنزيل PDF'}</button>
          <button onClick={printInvoice} style={{ padding: '10px 18px', background: '#163B68', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>⎙ طباعة</button>
        </div>
      </div>
    </div>
  )
}
