'use client'
// app/(app)/settings/IntelligencePanel.tsx
// لوحة تحكّم طبقة School Intelligence Core — المدير يفعّل/يعطّل كل محرّك.
// تقرأ intelligence_status وتضبط عبر set_intelligence_flag. معزولة عن V1.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Sparkles } from 'lucide-react'

type Engine = { engine: string; name_ar: string; description: string; enabled: boolean }

export default function IntelligencePanel({ initial, canEdit }: { initial: Engine[]; canEdit: boolean }) {
  const supabase = createClient()
  const [engines, setEngines] = useState<Engine[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function toggle(engine: string, enabled: boolean) {
    if (!canEdit) return
    setBusy(engine); setMsg('')
    const { error } = await supabase.rpc('set_intelligence_flag', { p_engine: engine, p_enabled: enabled })
    setBusy(null)
    if (error) { setMsg('تعذّر الحفظ: ' + error.message); return }
    setEngines((prev) => prev.map((e) => e.engine === engine ? { ...e, enabled } : e))
    setMsg('✓ حُفظ')
    setTimeout(() => setMsg(''), 1800)
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <Sparkles size={19} color="#1E5C4E" />
        <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>محرّكات الذكاء (School Intelligence)</h2>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px' }}>
        طبقة ذكاء تعمل فوق نظامك — فعّل أو عطّل كل محرّك حسب حاجتك. لا تؤثّر على بياناتك أو باقي الوحدات.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {engines.map((e) => (
          <div key={e.engine} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '13px 15px', background: '#FAFBFC', border: '1px solid #EEF1F5', borderRadius: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#0F1B2D' }}>{e.name_ar}</div>
              <div style={{ fontSize: 12.5, color: '#6B7A90', marginTop: 2 }}>{e.description}</div>
            </div>
            {/* مفتاح التبديل */}
            <button
              onClick={() => toggle(e.engine, !e.enabled)}
              disabled={!canEdit || busy === e.engine}
              aria-label={e.enabled ? 'تعطيل' : 'تفعيل'}
              style={{
                width: 46, height: 26, borderRadius: 20, border: 'none', flexShrink: 0, position: 'relative',
                background: e.enabled ? '#1E5C4E' : '#CBD5D1',
                cursor: canEdit ? 'pointer' : 'default', transition: 'background .2s',
              }}>
              <span style={{
                position: 'absolute', top: 3, insetInlineStart: e.enabled ? 3 : 23,
                width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s',
              }} />
            </button>
          </div>
        ))}
      </div>

      {msg && <div style={{ fontSize: 13, color: msg.startsWith('✓') ? '#067647' : '#B42318', marginTop: 12 }}>{msg}</div>}
      {!canEdit && <div style={{ fontSize: 12.5, color: '#8A94A6', marginTop: 12 }}>ضبط المحرّكات متاح لمدير المدرسة فقط.</div>}
    </section>
  )
}
