'use client'
// app/(app)/students/PaymentTracker.tsx
// لوحة تتبع الدفعات الشهرية لطالب واحد — عرض بصري لآخر 12 شهراً، يوضّح
// أي الأشهر دفع فيها ولي الأمر (أخضر) وأيها لم يدفع (أحمر)، بناءً على
// تواريخ الدفعات الفعلية (payments.paid_at) — بلا أي تغيير في نظام الفوترة.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type MonthRow = {
  month_label: string
  month_key: string
  paid_amount: number
  has_payment: boolean
}

export default function PaymentTracker({
  studentId, studentName, onClose,
}: {
  studentId: string
  studentName: string
  onClose: () => void
}) {
  const supabase = createClient()
  const [months, setMonths] = useState<MonthRow[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.rpc('student_payment_tracker', { p_student_id: studentId }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setErr(error.message); return }
      setMonths(data ?? [])
    })
    return () => { cancelled = true }
  }, [studentId, supabase])

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const paidCount = months?.filter((m) => m.has_payment).length ?? 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 520, boxShadow: '0 24px 60px -20px rgba(10,37,68,.4)' }} dir="rtl">
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
              <span>آخر 12 شهراً</span>
              <span style={{ fontWeight: 700, color: paidCount >= 6 ? '#1A7A45' : '#C0392B' }}>
                {paidCount} / 12 شهراً مدفوعاً
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {months.map((m) => (
                <div key={m.month_key}
                  title={m.has_payment ? `دُفع ${fmt(m.paid_amount)} ر.ع` : 'لم يُدفع شيء هذا الشهر'}
                  style={{
                    borderRadius: 11, padding: '12px 8px', textAlign: 'center',
                    background: m.has_payment ? '#E6F4EC' : '#FCE9E6',
                    border: `1.5px solid ${m.has_payment ? '#BFE5D0' : '#F3C9C2'}`,
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{m.has_payment ? '✅' : '❌'}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: m.has_payment ? '#1A7A45' : '#C0392B' }}>
                    {m.month_label}
                  </div>
                  {m.has_payment && (
                    <div style={{ fontSize: 10.5, color: '#5A8A6E', marginTop: 2 }}>{fmt(m.paid_amount)}</div>
                  )}
                </div>
              ))}
            </div>

            <p style={{ fontSize: 11.5, color: '#8A94A6', marginTop: 16, lineHeight: 1.7 }}>
              💡 يعتمد هذا التتبع على تواريخ الدفعات الفعلية المسجَّلة، لا على نظام أقساط شهري منفصل.
              شهر بلا أي دفعة يظهر بالأحمر، حتى لو كان الرسم السنوي مدفوعاً جزئياً في شهر آخر.
            </p>
          </>
        )}

        <div style={{ marginTop: 18 }}>
          <button onClick={onClose}
            style={{ width: '100%', background: '#F2F5F8', color: '#0F2744', border: 0, padding: 12, borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
