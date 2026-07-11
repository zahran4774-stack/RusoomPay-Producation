'use client'
// تسجيل دفعة حضورية (نقداً / بطاقة / شيك) — يسجّلها المحاسب مباشرة في المدرسة
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Fee = { id: string; description: string; total: number; paid: number }

export default function CashPayment({
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

  const remaining = Math.max(0, fee.total - fee.paid)
  const [amount, setAmount] = useState<string>(remaining ? String(remaining) : '')
  const [method, setMethod] = useState('cash')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

  async function submit() {
    setErr(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) { setErr('أدخل مبلغاً صحيحاً'); return }
    if (amt > remaining) { setErr(`المبلغ أكبر من المتبقّي (${fmt(remaining)} ${sym})`); return }

    setSaving(true)
    const { error } = await supabase.rpc('record_payment', {
      p_fee_id: fee.id,
      p_amount: amt,
      p_method: method,
      p_paid_at: paidAt,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }

    setOk(true)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1200)
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }

  if (remaining <= 0) {
    return <span style={{ fontSize: 12, fontWeight: 700, color: '#067647' }}>✓ مسدّد</span>
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#067647', color: '#fff', border: 0, padding: '7px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        💵 دفع في المدرسة
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={() => !saving && setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 420, boxShadow: '0 24px 60px -20px rgba(10,37,64,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F2744' }}>تسجيل دفعة حضورية</h3>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <div style={{ color: '#667', fontSize: 13, marginBottom: 18 }}>
          {studentName} · {fee.description}
        </div>

        <div style={{ background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 11, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#667' }}>المتبقّي</span>
          <b style={{ fontSize: 15, color: '#B54708' }}>{fmt(remaining)} {sym}</b>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>المبلغ المدفوع ({sym})</label>
          <input type="number" step="0.001" style={input} value={amount} dir="ltr"
            onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>طريقة الدفع</label>
            <select style={input} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">نقداً</option>
              <option value="card">بطاقة</option>
              <option value="cheque">شيك</option>
              <option value="bank">تحويل بنكي</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>تاريخ الدفع</label>
            <input type="date" style={input} value={paidAt} dir="ltr"
              onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>

        {err && <div style={{ color: '#C0392B', marginBottom: 12, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
        {ok && <div style={{ color: '#067647', marginBottom: 12, fontWeight: 700, fontSize: 13 }}>✓ سُجّلت الدفعة بنجاح</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, background: saving ? '#8AA' : '#067647', color: '#fff', border: 0, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'جارٍ الحفظ…' : 'تسجيل الدفعة'}
          </button>
          <button onClick={() => setOpen(false)} disabled={saving}
            style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
