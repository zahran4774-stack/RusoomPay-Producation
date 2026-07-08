'use client'
// اعتماد/رفض التحويلات البنكية المعلّقة — عبر دوال الخادم
// الاعتماد يفعّل الاشتراك؛ الرفض يُنهيه. كلاهما لمدير المنصة فقط (يفرضه الخادم)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Item = {
  id: string; plan: string; pay_method: string | null
  receipt_url: string | null; schoolName: string; created_at: string
}

const planNames: Record<string, string> = {
  monthly: 'الباقة الشهرية', yearly: 'الباقة السنوية', lifetime: 'اشتراك دائم',
}

export default function PendingSubs({ items }: { items: Item[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)

  async function approve(id: string) {
    setBusy(id)
    const { error } = await supabase.rpc('approve_subscription', { p_sub_id: id })
    setBusy(null)
    if (error) { alert('تعذّر الاعتماد: ' + error.message); return }
    router.refresh()
  }

  async function reject(id: string) {
    if (!confirm('تأكيد رفض هذا التحويل؟')) return
    setBusy(id)
    const { error } = await supabase.rpc('reject_subscription', { p_sub_id: id })
    setBusy(null)
    if (error) { alert('تعذّر الرفض: ' + error.message); return }
    router.refresh()
  }

  if (items.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, color: '#999', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        لا توجد تحويلات بنكية بانتظار الاعتماد ✓
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((it) => (
        <div key={it.id} style={{ background: '#FFFDF5', border: '1.5px solid #D4A017', borderRadius: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0F2744' }}>{it.schoolName}</div>
              <div style={{ fontSize: 13, color: '#667', marginTop: 4 }}>
                {planNames[it.plan] ?? it.plan} · تحويل بنكي · {it.created_at?.slice(0, 10)}
              </div>
              {it.receipt_url ? (
                <a href={it.receipt_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#163B68', fontWeight: 600, display: 'inline-block', marginTop: 6 }}>
                  📎 عرض الإيصال
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#999', display: 'inline-block', marginTop: 6 }}>لا يوجد إيصال مرفق</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => approve(it.id)} disabled={busy === it.id}
                style={{ background: '#D4A017', color: '#0F2744', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                ✓ اعتماد
              </button>
              <button onClick={() => reject(it.id)} disabled={busy === it.id}
                style={{ background: '#FCE9E6', color: '#C0392B', border: 'none', borderRadius: 9, padding: '9px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                رفض
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
