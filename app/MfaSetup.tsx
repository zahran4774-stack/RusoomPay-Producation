'use client'
// app/(app)/settings/MfaSetup.tsx
// إعداد المصادقة الثنائية عبر معيار TOTP — باستخدام واجهة Supabase الأصلية.
// يعرض رمز QR للمسح، ثم يتحقّق من أول رمز لتفعيل العامل.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

const C = { navy: '#0F2744', petrol: '#1E5C4E', gold: '#D4A017', danger: '#C0392B', line: '#DDE3EC' }

type Factor = { id: string; status: string; friendly_name?: string }

export default function MfaSetup() {
  const supabase = createClient()
  const [factors, setFactors] = useState<Factor[]>([])
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // تحميل العوامل المسجّلة حالياً
  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors((data?.totp ?? []) as Factor[])
  }
  useEffect(() => { loadFactors() }, [])

  // بدء التسجيل — يولّد QR وسرّاً
  async function startEnroll() {
    setMsg(''); setLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `RusoomPay ${new Date().toLocaleDateString('ar')}`,
    })
    setLoading(false)
    if (error) { setMsg('تعذّر بدء التسجيل: ' + error.message); return }
    setQr(data.totp.qr_code)       // صورة QR (SVG data URI) يمسحها Google Authenticator
    setSecret(data.totp.secret)    // السرّ النصّي (للإدخال اليدوي البديل)
    setFactorId(data.id)
  }

  // التحقّق من أول رمز لإتمام التفعيل
  async function verifyEnroll() {
    if (!factorId || code.length !== 6) { setMsg('أدخل الرمز المكوّن من 6 أرقام'); return }
    setLoading(true); setMsg('')
    // ينشئ تحدّياً ثم يتحقّق منه
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) { setLoading(false); setMsg('خطأ: ' + chErr.message); return }
    const { error } = await supabase.auth.mfa.verify({
      factorId, challengeId: ch.id, code,
    })
    setLoading(false)
    if (error) { setMsg('الرمز غير صحيح، حاول مجدداً'); return }
    setMsg('✓ تم تفعيل المصادقة الثنائية بنجاح')
    setQr(null); setSecret(null); setFactorId(null); setCode('')
    loadFactors()
  }

  // إلغاء عامل مسجّل
  async function removeFactor(id: string) {
    setLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    setLoading(false)
    if (error) { setMsg('تعذّر الإلغاء: ' + error.message); return }
    setMsg('تم إلغاء المصادقة الثنائية')
    loadFactors()
  }

  const active = factors.filter((f) => f.status === 'verified')

  return (
    <div style={{ maxWidth: 480, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24 }} dir="rtl">
      <h3 style={{ color: C.navy, marginBottom: 6 }}>المصادقة الثنائية — 2FA</h3>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 18 }}>
        طبقة حماية إضافية عبر تطبيق Google Authenticator — يُطلب رمز مؤقّت عند كل تسجيل دخول.
      </p>

      {/* العوامل المفعّلة */}
      {active.length > 0 && (
        <div style={{ background: '#F0F7F5', border: `1px solid ${C.petrol}33`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ color: C.petrol, fontWeight: 700, fontSize: 14 }}>✓ المصادقة الثنائية مفعّلة</div>
          {active.map((f) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 13 }}>
              <span>{f.friendly_name || 'جهاز مصادقة'}</span>
              <button onClick={() => removeFactor(f.id)} disabled={loading}
                style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                إلغاء
              </button>
            </div>
          ))}
        </div>
      )}

      {/* بدء التسجيل */}
      {active.length === 0 && !qr && (
        <button onClick={startEnroll} disabled={loading}
          style={{ background: C.navy, color: '#fff', border: 'none', borderRadius: 11, padding: '12px 22px', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'جارٍ التحضير…' : 'تفعيل المصادقة الثنائية'}
        </button>
      )}

      {/* خطوات المسح والتحقّق */}
      {qr && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>1) امسح الرمز بتطبيق Google Authenticator:</p>
          <div style={{ display: 'grid', placeItems: 'center', padding: 12, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 12 }}>
            <img src={qr} alt="رمز QR للمصادقة الثنائية" style={{ width: 200, height: 200 }} />
          </div>
          {secret && (
            <p style={{ fontSize: 12, color: '#667', marginBottom: 14, wordBreak: 'break-all' }}>
              أو أدخل هذا السرّ يدوياً: <code style={{ background: '#F4F6F9', padding: '2px 6px', borderRadius: 6 }} dir="ltr">{secret}</code>
            </p>
          )}
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>2) أدخل الرمز الظاهر في التطبيق:</p>
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000" inputMode="numeric" dir="ltr"
            style={{ width: '100%', padding: 12, borderRadius: 10, border: `1.5px solid ${C.line}`, fontSize: 20, letterSpacing: 6, textAlign: 'center', marginBottom: 12 }}
          />
          <button onClick={verifyEnroll} disabled={loading || code.length !== 6}
            style={{ width: '100%', background: C.gold, color: C.navy, border: 'none', borderRadius: 11, padding: 13, fontWeight: 700, cursor: 'pointer', opacity: code.length === 6 ? 1 : 0.5 }}>
            {loading ? 'جارٍ التحقّق…' : 'تأكيد وتفعيل'}
          </button>
        </div>
      )}

      {msg && <p style={{ marginTop: 14, fontSize: 14, color: msg.startsWith('✓') ? C.petrol : C.danger }}>{msg}</p>}
    </div>
  )
}
