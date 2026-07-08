'use client'
// لوحة اعتماد طلبات تعديل الرواتب — للمدير فقط
// الاعتماد يتم عبر دالة الخادم approve_salary_request (تفرض أن المدير فقط يعتمد)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Req = {
  id: string; employee_id: string
  old_basic: number; old_allow: number; new_basic: number; new_allow: number
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export default function SalaryRequests({ requests }: { requests: Req[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function approve(id: string) {
    setBusy(id)
    // دالة الخادم: تطبّق التغيير وتغلق الطلب ذرّياً، وترفض إن لم يكن المستخدم مديراً
    const { error } = await supabase.rpc('approve_salary_request', { p_request_id: id })
    setBusy(null)
    if (error) { alert('تعذّر الاعتماد: ' + error.message); return }
    router.refresh()
  }

  async function reject(id: string) {
    setBusy(id)
    await supabase.from('salary_requests')
      .update({ status: 'rejected', decided_at: new Date().toISOString() })
      .eq('id', id)
    setBusy(null)
    router.refresh()
  }

  return (
    <div style={{ background: '#FFFDF5', border: '1.5px solid #D4A017', borderRadius: 14, padding: 18, marginBottom: 18 }}>
      <b style={{ color: '#0F2744', display: 'block', marginBottom: 12 }}>
        🔔 طلبات تعديل رواتب بانتظار اعتمادك ({requests.length})
      </b>
      {requests.map((r) => {
        const oldT = r.old_basic + r.old_allow, newT = r.new_basic + r.new_allow
        const diff = newT - oldT
        return (
          <div key={r.id} style={{ border: '1px solid #EEF2F1', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
            <div style={{ fontSize: 14 }}>
              الأساسي: {fmt(r.old_basic)} ← <b>{fmt(r.new_basic)}</b> · البدلات: {fmt(r.old_allow)} ← <b>{fmt(r.new_allow)}</b>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: diff >= 0 ? '#1A7A45' : '#C0392B', margin: '6px 0 10px' }}>
              الإجمالي: {fmt(oldT)} ← {fmt(newT)} ({diff >= 0 ? '+' : ''}{fmt(diff)})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => approve(r.id)} disabled={busy === r.id}
                style={{ background: '#D4A017', color: '#0F2744', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ✓ اعتماد الزيادة
              </button>
              <button onClick={() => reject(r.id)} disabled={busy === r.id}
                style={{ background: '#FCE9E6', color: '#C0392B', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                رفض
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
