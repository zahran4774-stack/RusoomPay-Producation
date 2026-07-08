'use client'
// app/(app)/settings/VatSetting.tsx
// إعداد احتساب الضريبة — يظهر حسب قانون الدولة:
//   mandatory: يُعرض كإلزامي (لا يمكن التعطيل)
//   optional : مفتاح تفعيل/تعطيل للمدير
//   none     : لا يُعرض (لا ضريبة في الدولة)
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function VatSetting({
  mode, rate, enabled, canEdit,
}: {
  mode: 'mandatory' | 'optional' | 'none'
  rate: number
  enabled: boolean
  canEdit: boolean
}) {
  const supabase = createClient()
  const [on, setOn] = useState(enabled)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (mode === 'none') return null // لا ضريبة في الدولة — لا نعرض شيئاً

  async function toggle(v: boolean) {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('set_school_vat', { p_enabled: v })
    setBusy(false)
    if (error) { setMsg('تعذّر الحفظ: ' + error.message); return }
    setOn(v); setMsg('✓ حُفظ')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #E2E7EE', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: '0 0 4px' }}>ضريبة القيمة المضافة</h2>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px' }}>
        نسبة الضريبة في دولتك: <b>{rate}%</b>
      </p>

      {mode === 'mandatory' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0F7F5', border: '1px solid #CDE5DD', borderRadius: 10, padding: '12px 16px' }}>
          <span style={{ color: '#1E5C4E', fontWeight: 700, fontSize: 14 }}>✓ الضريبة إلزامية</span>
          <span style={{ color: '#667', fontSize: 13 }}>تُحتسب تلقائياً وفق قانون دولتك (لا يمكن تعطيلها).</span>
        </div>
      ) : (
        // optional
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: canEdit ? 'pointer' : 'default' }}>
            <input type="checkbox" checked={on} disabled={!canEdit || busy}
              onChange={(e) => canEdit && toggle(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: '#1E5C4E', cursor: canEdit ? 'pointer' : 'default' }} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: '#0F2744' }}>
              احتساب الضريبة على رسوم مدرستي
            </span>
          </label>
          <p style={{ color: '#8A94A6', fontSize: 12.5, margin: '8px 0 0 0' }}>
            الضريبة اختيارية في دولتك — فعّلها إن كانت مدرستك مسجّلة ضريبياً.
          </p>
          {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? '#067647' : '#B42318' }}>{msg}</span>}
        </div>
      )}
    </section>
  )
}
