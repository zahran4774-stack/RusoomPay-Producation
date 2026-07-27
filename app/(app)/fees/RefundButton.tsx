'use client'
// استرداد رسوم — يستدعي refund_payment (مالك/محاسب فقط)
// يظهر فقط للبنود التي بها مبلغ مدفوع. إجراء مالي حسّاس: يتطلّب سبباً وتأكيداً.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Fee = { id: string; description: string; total: number; paid: number }

export default function RefundButton({
  fee, studentName, currency, sym, dec,
}: {
  fee: Fee; studentName: string; currency: string; sym: string; dec: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const refundable = Math.max(0, fee.paid)
  const [amount, setAmount] = useState<string>(refundable ? String(refundable) : '')
  const [reason, setReason] = useState('')

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  async function submit() {
    setErr(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) { setErr('أدخل مبلغاً صحيحاً'); return }
    if (amt > refundable) { setErr(`المبلغ أكبر من المدفوع القابل للاسترداد (${fmt(refundable)} ${sym})`); return }
    if (!reason.trim()) { setErr('سبب الاسترداد مطلوب'); return }
    // تأكيد إضافي قبل التنفيذ (إجراء مالي لا رجعة فيه بسهولة)
    if (!confirm) { setConfirm(true); return }

    setSaving(true)
    const { error } = await supabase.rpc('refund_payment', {
      p_fee_id: fee.id,
      p_amount: amt,
      p_reason: reason.trim(),
    })
    setSaving(false)
    if (error) { setErr(error.message); setConfirm(false); return }

    setOk(true)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false); setConfirm(false) }, 1200)
  }

  function close() {
    if (saving) return
    setOpen(false); setConfirm(false); setErr(null)
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }

  // لا استرداد بلا مبلغ مدفوع
  if (refundable <= 0) return null

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        title="استرداد مبلغ مدفوع"
        style={{ background: '#fff', color: '#B42318', border: '1px solid #F3C6C0', padding: '7px 12px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        ↩ استرداد
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px -20px rgba(10,37,64,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F2744' }}>استرداد رسوم</h3>
          <button onClick={close} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <div style={{ color: '#667', fontSize: 13, marginBottom: 18 }}>
          {studentName} · {fee.description}
        </div>

        <div style={{ background: '#FEF6F5', border: '1px solid #F3C6C0', borderRadius: 11, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#667' }}>المدفوع القابل للاسترداد</span>
          <b style={{ fontSize: 15, color: '#B42318' }}>{fmt(refundable)} {sym}</b>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>مبلغ الاسترداد ({sym})</label>
          <input type="number" step="0.001" style={input} value={amount} dir="ltr"
            onChange={(e) => { setAmount(e.target.value); setConfirm(false) }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={label}>سبب الاسترداد (إلزامي)</label>
          <input type="text" style={input} value={reason} placeholder="مثال: انسحاب الطالب من الخدمة"
            onChange={(e) => { setReason(e.target.value); setConfirm(false) }} />
        </div>

        {err && <div style={{ color: '#C0392B', marginBottom: 12, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
        {ok && <div style={{ color: '#067647', marginBottom: 12, fontWeight: 700, fontSize: 13 }}>✓ تمّ الاسترداد بنجاح</div>}

        {confirm && !ok && (
          <div style={{ background: '#FEF6F5', border: '1px solid #F3C6C0', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#8A2B2B', fontWeight: 600 }}>
            ⚠ تأكيد: سيُسترد {fmt(Number(amount) || 0)} {sym} ويُخفّض رصيد الفاتورة. اضغط «تأكيد الاسترداد» للمتابعة.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, background: saving ? '#C99' : '#B42318', color: '#fff', border: 0, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'جارٍ التنفيذ…' : confirm ? 'تأكيد الاسترداد' : 'استرداد'}
          </button>
          <button onClick={close} disabled={saving}
            style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
