'use client'
// لوحة اعتماد الدفعات المعلّقة — للمحاسب/المدير
// بعد الاعتماد: تُرسل تلقائياً رسالة شكر/إثبات سداد لولي الأمر عبر واتساب
// (من رقم المدرسة الرسمي عبر Twilio). لا تُرسل عند الرفض.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Pending = {
  id: string; guardian: string; student: string
  amount: number; method: string; bank_ref: string | null; created_at: string
  guardian_phone?: string | null; school_name?: string | null
}

const METHOD_LABEL: Record<string, string> = {
  card: 'بطاقة بنكية', bank: 'تحويل بنكي', applepay: 'Apple Pay', googlepay: 'Google Pay', onsite: 'نقداً عند المدرسة',
}
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

// تطبيع الرقم العُماني: يزيل الرموز، ويضمن رمز الدولة 968
function normalizePhone(raw: string): string {
  let p = (raw || '').replace(/[\s\-()]/g, '')
  if (p.startsWith('+')) p = p.slice(1)
  if (p.startsWith('00')) p = p.slice(2)
  if (!p.startsWith('968') && p.length === 8) p = '968' + p
  return p
}

export default function PendingPayments({ initial }: { initial: Pending[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Pending[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)

  // إرسال رسالة الشكر — فشل الإرسال لا يُظهر خطأ للمستخدم (الاعتماد نفسه نجح ومستقل عنه)
  async function sendThankYou(p: Pending) {
    if (!p.guardian_phone) return
    try {
      const to = `+${normalizePhone(p.guardian_phone)}`
      const school = p.school_name ? `مدرسة ${p.school_name}` : 'المدرسة'
      const methodLabel = METHOD_LABEL[p.method] || p.method
      const body =
        `${school}\n\n` +
        `شكراً لكم ${p.guardian} 🌿\n` +
        `نفيدكم بأنه تم اعتماد واستلام دفعتكم بمبلغ ${fmt(p.amount)} (${methodLabel}) ` +
        `لصالح الطالب ${p.student}.\n\n` +
        `نقدّر التزامكم وحسن تعاونكم معنا.`

      await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body }),
      })
    } catch {
      // لا نعرض خطأ — الاعتماد نجح بالفعل، الإشعار وحده فشل
    }
  }

  async function act(id: string, approve: boolean) {
    setBusy(id)
    const { error } = await supabase.rpc(approve ? 'approve_payment' : 'reject_payment', { p_id: id })
    if (!error) {
      const target = items.find((p) => p.id === id)
      setItems((prev) => prev.filter((p) => p.id !== id))
      if (approve && target) sendThankYou(target)
    }
    setBusy(null)
  }

  if (items.length === 0) return null

  return (
    <div style={{
      background: '#fff', border: '1px solid #E6EBF1', borderInlineStart: '4px solid #D4A017',
      borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.05)', marginBottom: 20,
    }} dir="rtl">
      <h3 style={{ fontSize: 16, color: '#0F2744', margin: '0 0 12px' }}>
        🔔 دفعات بانتظار اعتمادك ({items.length})
      </h3>
      {items.map((p) => (
        <div key={p.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 10, padding: '12px 0', borderBottom: '1px dashed #E5EDEB',
        }}>
          <div>
            <b style={{ color: '#0F2744' }}>{fmt(p.amount)}</b> — {p.guardian}
            <span style={{ fontSize: 12.5, color: '#8A94A6' }}>
              {' '}({p.student} · {METHOD_LABEL[p.method] || p.method}
              {p.bank_ref ? ` · مرجع ${p.bank_ref}` : ''} · {new Date(p.created_at).toLocaleDateString('en-GB')})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => act(p.id, true)} disabled={busy === p.id}
              style={{ background: '#D4A017', color: '#08172B', border: 'none', borderRadius: 9, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {busy === p.id ? '...' : '✓ اعتماد'}
            </button>
            <button onClick={() => act(p.id, false)} disabled={busy === p.id}
              style={{ background: '#fff', color: '#C0392B', border: '1px solid #EAD1CC', borderRadius: 9, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
