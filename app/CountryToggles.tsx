'use client'
// app/(app)/platform/CountryToggles.tsx
// لوحة تفعيل/تعطيل دول الخليج — لمالك المنصّة. يتحكّم في الدول المتاحة للتسجيل.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Country = { code: string; name_ar: string; currency: string; enabled: boolean }

export default function CountryToggles() {
  const supabase = createClient()
  const [countries, setCountries] = useState<Country[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('platform_countries').select('*').order('name_ar')
    setCountries((data ?? []) as Country[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function toggle(code: string, next: boolean) {
    setBusy(code); setMsg('')
    // تحديث متفائل
    setCountries((cs) => cs.map((c) => c.code === code ? { ...c, enabled: next } : c))
    const { error } = await supabase.rpc('set_country_enabled', { p_code: code, p_enabled: next })
    setBusy(null)
    if (error) {
      // تراجع عند الفشل
      setCountries((cs) => cs.map((c) => c.code === code ? { ...c, enabled: !next } : c))
      setMsg('تعذّر التحديث: ' + error.message)
      return
    }
    setMsg(`✓ ${next ? 'فُعّلت' : 'عُطّلت'} ${countries.find((c) => c.code === code)?.name_ar ?? code}`)
    setTimeout(() => setMsg(''), 2500)
  }

  if (loading) return <div style={{ color: '#667', fontSize: 14, padding: 16 }}>جارٍ التحميل…</div>

  const flags: Record<string, string> = { OM: '🇴🇲', SA: '🇸🇦', AE: '🇦🇪', QA: '🇶🇦', KW: '🇰🇼', BH: '🇧🇭' }

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E7EE', borderRadius: 16, padding: 22, marginBottom: 18 }} dir="rtl">
      <h3 style={{ color: '#0F2744', margin: '0 0 4px', fontSize: '1.15rem' }}>🌍 دول الخليج المتاحة للتسجيل</h3>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px' }}>
        فعّل أو عطّل الدول. المدارس في الدول المفعّلة فقط يمكنها التسجيل — أداة توسّع مستقبلي.
      </p>

      <div style={{ display: 'grid', gap: 10 }}>
        {countries.map((c) => (
          <div key={c.code} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 12,
            border: `1px solid ${c.enabled ? 'rgba(30,92,78,.3)' : '#E2E7EE'}`,
            background: c.enabled ? 'rgba(30,92,78,.05)' : '#FAFBFC',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontSize: '1.4rem' }}>{flags[c.code] ?? '🏳️'}</span>
              <div>
                <div style={{ fontWeight: 700, color: '#0F2744', fontSize: 14 }}>{c.name_ar}</div>
                <div style={{ fontSize: 12, color: '#8A94A6' }}>{c.currency} · {c.code}</div>
              </div>
            </div>

            {/* مفتاح التبديل */}
            <button
              onClick={() => toggle(c.code, !c.enabled)}
              disabled={busy === c.code}
              aria-label={`${c.enabled ? 'تعطيل' : 'تفعيل'} ${c.name_ar}`}
              aria-pressed={c.enabled}
              style={{
                width: 52, height: 30, borderRadius: 99, border: 'none', cursor: busy === c.code ? 'wait' : 'pointer',
                background: c.enabled ? '#1E5C4E' : '#CBD3DE', position: 'relative', transition: 'background .2s',
                opacity: busy === c.code ? 0.6 : 1, flexShrink: 0,
              }}>
              <span style={{
                position: 'absolute', top: 3, insetInlineStart: c.enabled ? 3 : 25,
                width: 24, height: 24, borderRadius: '50%', background: '#fff',
                transition: 'inset-inline-start .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              }} />
            </button>
          </div>
        ))}
      </div>

      {msg && <div style={{ marginTop: 14, fontSize: 13, color: msg.startsWith('✓') ? '#067647' : '#B42318' }}>{msg}</div>}

      <p style={{ marginTop: 16, fontSize: 12, color: '#8A94A6', lineHeight: 1.7 }}>
        ملاحظة: تعطيل دولة لا يؤثّر على المدارس المسجّلة فيها مسبقاً — يمنع التسجيلات الجديدة فقط.
      </p>
    </div>
  )
}
