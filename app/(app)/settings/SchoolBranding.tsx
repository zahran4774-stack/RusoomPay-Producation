'use client'
// app/(app)/settings/SchoolBranding.tsx
// تخصيص هوية المدرسة (شعار + لون) — للمدير فقط. يظهر في الفواتير والتقارير.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

export default function SchoolBranding({
  initialLogo, initialColor, canEdit,
}: {
  initialLogo: string | null
  initialColor: string | null
  canEdit: boolean
}) {
  const supabase = createClient()
  const [logo, setLogo] = useState(initialLogo ?? '')
  const [color, setColor] = useState(initialColor ?? '#0F9D74')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  if (!canEdit) return null

  async function save() {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('update_school_branding', {
      p_logo_url: logo.trim() || null,
      p_color: color.trim() || null,
    })
    setBusy(false)
    if (error) { setMsg('تعذّر الحفظ: ' + error.message); return }
    setMsg('✓ حُفظت هوية المدرسة')
    setTimeout(() => setMsg(''), 2500)
  }

  const logoValid = !logo || logo.startsWith('https://')

  return (
    <section style={{ background: '#fff', border: '1px solid #E2E7EE', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: '0 0 4px' }}>🎨 هوية المدرسة</h2>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px' }}>
        شعار المدرسة ولونها الأساسي — يظهران في الفواتير والتقارير الرسمية.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>رابط شعار المدرسة</label>
      <input
        value={logo} onChange={(e) => setLogo(e.target.value)} dir="ltr"
        placeholder="https://example.com/logo.png"
        style={{ width: '100%', height: 44, padding: '0 12px', borderRadius: 10, border: `1.5px solid ${logoValid ? '#E2E7EE' : '#E5484D'}`, fontSize: 14, marginBottom: 4 }}
      />
      <div style={{ fontSize: 12, color: logoValid ? '#8A94A6' : '#E5484D', marginBottom: 8 }}>
        {logoValid ? 'استضِف الشعار على رابط https واضع الرابط هنا (سنضيف الرفع المباشر لاحقاً).' : '⚠️ يجب أن يبدأ الرابط بـ https://'}
      </div>

      {logo && logoValid && (
        <div style={{ marginBottom: 14 }}>
          {/* معاينة الشعار */}
          <img src={logo} alt="شعار المدرسة" style={{ maxHeight: 64, maxWidth: 200, objectFit: 'contain', border: '1px solid #EEF2F1', borderRadius: 8, padding: 6, background: '#FAFBFC' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      )}

      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>اللون الأساسي</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <input type="color" value={/^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#0F9D74'}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 48, height: 44, border: '1px solid #E2E7EE', borderRadius: 10, cursor: 'pointer', padding: 2 }} />
        <input value={color} onChange={(e) => setColor(e.target.value)} dir="ltr"
          placeholder="#0F9D74"
          style={{ width: 130, height: 44, padding: '0 12px', borderRadius: 10, border: '1.5px solid #E2E7EE', fontSize: 14, fontFamily: 'monospace' }} />
      </div>

      <button onClick={save} disabled={busy || !logoValid}
        style={{ background: '#1E5C4E', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer', opacity: busy || !logoValid ? 0.6 : 1 }}>
        {busy ? 'جارٍ الحفظ…' : 'حفظ الهوية'}
      </button>
      {msg && <span style={{ marginInlineStart: 12, fontSize: 13, color: msg.startsWith('✓') ? '#067647' : '#B42318' }}>{msg}</span>}
    </section>
  )
}
