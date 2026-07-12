'use client'
// app/(app)/settings/SchoolBranding.tsx
// هوية المدرسة (شعار + لون) — رفع مباشر من جهاز المستخدم إلى تخزين المدرسة.
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

const MAX_MB = 2
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

export default function SchoolBranding({
  initialLogo, initialColor, canEdit,
}: {
  initialLogo: string | null
  initialColor: string | null
  canEdit: boolean
}) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [logo, setLogo] = useState(initialLogo ?? '')
  const [color, setColor] = useState(initialColor ?? '#0F9D74')
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
      setSchoolId(data?.school_id ?? null)
    })()
  }, [supabase])

  if (!canEdit) return null

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(''); setMsg('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!OK_TYPES.includes(file.type)) {
      setErr('الصيغة غير مدعومة. استخدم PNG أو JPG أو WEBP أو SVG.')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr('حجم الملف أكبر من ' + MAX_MB + ' ميغابايت.')
      return
    }
    if (!schoolId) {
      setErr('تعذّر تحديد مدرستك. أعد تحميل الصفحة.')
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = schoolId + '/logo-' + Date.now() + '.' + ext

    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (upErr) {
      setUploading(false)
      setErr('تعذّر الرفع: ' + upErr.message)
      return
    }

    const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
    const url = pub.publicUrl

    const { error: saveErr } = await supabase.rpc('update_school_branding', {
      p_logo_url: url,
      p_color: color.trim() || null,
    })

    setUploading(false)
    if (saveErr) { setErr('رُفع الملف لكن تعذّر الحفظ: ' + saveErr.message); return }

    setLogo(url)
    setMsg('✓ رُفع الشعار وحُفظ')
    setTimeout(() => setMsg(''), 2500)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeLogo() {
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.rpc('update_school_branding', {
      p_logo_url: null,
      p_color: color.trim() || null,
    })
    setBusy(false)
    if (error) { setErr('تعذّر الحذف: ' + error.message); return }
    setLogo('')
    setMsg('✓ حُذف الشعار')
    setTimeout(() => setMsg(''), 2500)
  }

  async function saveColor() {
    setBusy(true); setErr(''); setMsg('')
    const { error } = await supabase.rpc('update_school_branding', {
      p_logo_url: logo || null,
      p_color: color.trim() || null,
    })
    setBusy(false)
    if (error) { setErr('تعذّر الحفظ: ' + error.message); return }
    setMsg('✓ حُفظت هوية المدرسة')
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <section style={{ background: '#fff', border: '1px solid #E2E7EE', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: '0 0 4px' }}>🎨 هوية المدرسة</h2>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px' }}>
        شعار المدرسة ولونها الأساسي — يظهران في الفواتير والتقارير الرسمية.
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 8 }}>
        شعار المدرسة
      </label>

      {logo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <img src={logo} alt="شعار المدرسة"
            style={{ maxHeight: 72, maxWidth: 220, objectFit: 'contain', border: '1px solid #EEF2F1', borderRadius: 10, padding: 8, background: '#FAFBFC' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E2E7EE', padding: '9px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              استبدال
            </button>
            <button onClick={removeLogo} disabled={busy || uploading}
              style={{ background: 'none', color: '#C0392B', border: 0, padding: '9px 12px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
              حذف
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => { if (!uploading) fileRef.current?.click() }}
          style={{
            border: '2px dashed #D6DEE8', borderRadius: 12, padding: '26px 18px',
            textAlign: 'center', cursor: uploading ? 'default' : 'pointer',
            background: '#FAFBFC', marginBottom: 14,
          }}>
          <div style={{ fontSize: 26, marginBottom: 6 }}>⬆</div>
          <div style={{ fontWeight: 700, color: '#0F2744', fontSize: 14.5, marginBottom: 4 }}>
            {uploading ? 'جارٍ الرفع…' : 'اختر شعار المدرسة من جهازك'}
          </div>
          <div style={{ fontSize: 12.5, color: '#8A94A6' }}>
            PNG · JPG · WEBP · SVG — حتى {MAX_MB} ميغابايت
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept={OK_TYPES.join(',')} onChange={onPick} style={{ display: 'none' }} />

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', margin: '18px 0 8px' }}>
        اللون الأساسي
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          style={{ width: 52, height: 44, borderRadius: 9, border: '1px solid #E2E7EE', padding: 3, cursor: 'pointer', background: '#fff' }} />
        <input value={color} onChange={(e) => setColor(e.target.value)} dir="ltr"
          style={{ width: 120, height: 44, padding: '0 12px', borderRadius: 9, border: '1px solid #E2E7EE', fontSize: 14, fontFamily: 'inherit' }} />
        <button onClick={saveColor} disabled={busy || uploading}
          style={{ background: busy ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '0 24px', height: 44, borderRadius: 10, fontWeight: 800, fontSize: 14.5, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </div>

      {err && <div style={{ color: '#C0392B', fontSize: 13.5, fontWeight: 600, marginTop: 14 }}>⚠ {err}</div>}
      {msg && <div style={{ color: '#067647', fontSize: 13.5, fontWeight: 700, marginTop: 14 }}>{msg}</div>}
    </section>
  )
}
