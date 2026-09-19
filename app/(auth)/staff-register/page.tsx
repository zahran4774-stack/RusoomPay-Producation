'use client'
// تسجيل حساب موظف (إداري/محاسب) — نموذج بسيط: اسم، بريد، كلمة مرور فقط.
// بلا اسم مدرسة وبلا منطق ولي أمر — الحساب يُنشأ في Supabase Auth مباشرة،
// والربط بالدور والمدرسة يحدث تلقائياً عند أول دخول عبر مطابقة البريد مع
// دعوة موجودة في staff_invites (أنشأها المالك/الإداري من StaffInvites).
//
// حماية من روابط التأكيد المُبطَلة: كل signUp/resend جديد لنفس البريد يُصدر رمزاً جديداً
// ويُبطل السابق. لذلك: (1) نمنع إعادة التسجيل خلال 60 ثانية، (2) نتذكّر أن التسجيل تم
// (localStorage) فلا يعيد المستخدم التسجيل عند تحديث الصفحة، (3) زر إعادة إرسال بمهلة،
// (4) تنبيه صريح: استخدم أحدث رسالة فقط.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Logo from '@/app/Logo'
import Captcha from '@/components/auth/Captcha'

const PENDING_KEY = 'rp_staff_pending'
const COOLDOWN_SECS = 60
const PENDING_TTL_MS = 30 * 60 * 1000

type Pending = { email: string; ts: number }

function readPending(): Pending | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Pending
    if (!p?.email || !p?.ts || Date.now() - p.ts > PENDING_TTL_MS) return null
    return p
  } catch { return null }
}
function writePending(email: string) {
  try { window.localStorage.setItem(PENDING_KEY, JSON.stringify({ email, ts: Date.now() })) } catch { /* ignore */ }
}
function clearPending() {
  try { window.localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
}
function remainingCooldown(ts: number) {
  return Math.max(0, COOLDOWN_SECS - Math.floor((Date.now() - ts) / 1000))
}
// رابط التأكيد يجب أن يكون https دائماً (الموقع كان يُفتح أحياناً على http)
function loginUrl() {
  const o = window.location.origin
  const isLocal = /localhost|127\.0\.0\.1/.test(o)
  const origin = !isLocal && o.startsWith('http:') ? o.replace('http:', 'https:') : o
  return `${origin}/login`
}

export default function StaffRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [capKey, setCapKey] = useState(0)
  const hasCaptcha = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  // استعادة حالة "تم الإرسال" عند تحديث الصفحة — حتى لا يعيد المستخدم التسجيل ويُبطل رابطه
  useEffect(() => {
    const p = readPending()
    if (p) {
      setF((prev) => ({ ...prev, email: p.email }))
      setCooldown(remainingCooldown(p.ts))
      setSent(true)
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.full_name.trim()) { setError('الاسم الكامل مطلوب'); return }
    if (f.password.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (f.password !== f.confirm) { setError('كلمتا المرور غير متطابقتين'); return }
    if (hasCaptcha && !captchaToken) {
      setError('يرجى إكمال التحقق الأمني (CAPTCHA)'); return
    }

    const email = f.email.trim().toLowerCase()

    // نفس البريد سُجّل قبل أقل من 60 ثانية → لا نعيد التسجيل (سيُبطل الرابط المُرسَل)
    const pending = readPending()
    if (pending && pending.email === email && remainingCooldown(pending.ts) > 0) {
      setCooldown(remainingCooldown(pending.ts))
      setSent(true)
      return
    }

    setLoading(true)

    // بلا metadata خاص بمدرسة — هذا حساب موظف عام، يُربط بمدرسته لاحقاً
    // عبر مطابقة بريده مع دعوة سابقة في staff_invites.
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email,
      password: f.password,
      options: {
        emailRedirectTo: loginUrl(),
        captchaToken: captchaToken || undefined,
        data: { full_name: f.full_name },
      },
    })
    if (signUpErr) {
      setError('تعذّر إنشاء الحساب. قد يكون البريد مسجلاً بالفعل — جرّب تسجيل الدخول')
      setLoading(false)
      return
    }

    // البريد مسجّل ومؤكَّد مسبقاً: Supabase يرجع مستخدماً بلا identities ولا يُرسل أي رسالة
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('هذا البريد مسجّل بالفعل — سجّل الدخول من صفحة الدخول')
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      // تأكيد البريد مفعّل — لا جلسة بعد
      writePending(email)
      setCooldown(COOLDOWN_SECS)
      setLoading(false)
      setSent(true)
      return
    }

    // تأكيد البريد معطّل (تطوير) — جلسة فورية، اذهب مباشرة لتسجيل الدخول
    // (الربط بالدور يتم تلقائياً عند أول تحميل للوحة بعد تسجيل الدخول)
    clearPending()
    router.push('/login')
    router.refresh()
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    if (hasCaptcha && !captchaToken) {
      setError('يرجى إكمال التحقق الأمني (CAPTCHA) ثم أعد المحاولة'); return
    }
    setError(''); setInfo(''); setResending(true)
    const email = f.email.trim().toLowerCase()
    const { error: resendErr } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: loginUrl(), captchaToken: captchaToken || undefined },
    })
    setResending(false)
    // الرمز الأمني صالح لاستخدام واحد — نُجدّد الودجت
    setCaptchaToken(null); setCapKey((k) => k + 1)
    if (resendErr) {
      setError('تعذّر إعادة الإرسال الآن. انتظر دقيقة ثم حاول مجدداً، أو تواصل مع مدير مدرستك')
      return
    }
    writePending(email)
    setCooldown(COOLDOWN_SECS)
    setInfo('أُعيد إرسال الرسالة. افتح الرسالة الجديدة فقط — الروابط السابقة لم تعد صالحة.')
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F2744', marginBottom: 7 }
  const input: React.CSSProperties = { width: '100%', height: 47, padding: '0 44px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 14.5, fontFamily: 'inherit', outline: 'none' }

  if (sent) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F4F6FA', display: 'grid', placeItems: 'center', padding: 24 }} dir="rtl">
        <div style={{ background: '#fff', padding: 32, borderRadius: 18, maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
          <h1 style={{ color: '#0F2744', marginBottom: 10, fontSize: 22 }}>أكّد بريدك الإلكتروني</h1>
          <p style={{ color: '#556', fontSize: 14, lineHeight: 1.9 }}>
            أرسلنا رابط تأكيد إلى <b>{f.email}</b>. افتح الرابط لتفعيل حسابك، ثم سجّل الدخول — سيُربط حسابك تلقائياً بمدرستك ودورك.
          </p>
          <div style={{ background: '#FFF8E6', border: '1px solid #F5E0A3', color: '#7A5B00', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.9, marginTop: 14, textAlign: 'right' }}>
            ⚠️ استخدم <b>أحدث رسالة</b> وصلتك فقط — كل رسالة جديدة تُبطل الرابط في الرسائل السابقة. لا تُعد التسجيل من جديد، استخدم زر إعادة الإرسال أدناه إن لزم.
          </div>
          <p style={{ color: '#889', fontSize: 12, marginTop: 14 }}>
            لم يصلك البريد؟ تحقّق من مجلد الرسائل غير المرغوبة (Spam).
          </p>

          {hasCaptcha && cooldown <= 0 && (
            <div style={{ margin: '12px 0 4px' }}>
              <Captcha key={capKey} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            </div>
          )}

          {info && <div style={{ background: '#ECFDF3', border: '1px solid #ABEFC6', color: '#067647', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, marginTop: 12, lineHeight: 1.7 }}>{info}</div>}
          {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600, marginTop: 12, lineHeight: 1.7 }} role="alert">{error}</div>}

          <button type="button" onClick={handleResend} disabled={cooldown > 0 || resending}
            style={{ display: 'block', width: '100%', marginTop: 14, height: 44, borderRadius: 11, border: '1.5px solid #163B68', background: '#fff', color: '#163B68', fontWeight: 700, fontFamily: 'inherit', cursor: cooldown > 0 || resending ? 'default' : 'pointer', opacity: cooldown > 0 || resending ? 0.55 : 1 }}>
            {resending ? 'جارٍ الإرسال…' : cooldown > 0 ? `إعادة إرسال الرسالة بعد ${cooldown} ثانية` : 'إعادة إرسال رسالة التأكيد'}
          </button>

          <a href="/login" style={{ display: 'inline-block', marginTop: 14, background: '#163B68', color: '#fff', padding: '11px 24px', borderRadius: 11, textDecoration: 'none', fontWeight: 700 }}>
            الذهاب لتسجيل الدخول
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="sr-root" dir="rtl">
      <main className="sr-pane">
        <div className="sr-card">
          <div className="sr-brand">
            <Logo height={44} />
            <h2>حساب موظف</h2>
            <p>أنشئ حسابك بنفس البريد الذي دُعيت به — سيُربط تلقائياً بمدرستك</p>
          </div>

          <form onSubmit={handleRegister} className="sr-form" aria-label="تسجيل موظف">
            <div className="sr-note" role="note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              </svg>
              <span>استخدم نفس البريد الذي دعتك به إدارة مدرستك — به نربط حسابك بدورك تلقائياً.</span>
            </div>

            <label htmlFor="sr-name" style={label}>الاسم الكامل</label>
            <div className="sr-field">
              <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
              <input id="sr-name" style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} required placeholder="محمد أحمد الكندي" />
            </div>

            <label htmlFor="sr-email" style={label}>البريد الإلكتروني</label>
            <div className="sr-field">
              <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="sr-email" type="email" style={input} value={f.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" placeholder="staff@email.com" dir="ltr" />
            </div>

            <label htmlFor="sr-pw" style={label}>كلمة المرور</label>
            <div className="sr-field">
              <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="sr-pw" type={showPw ? 'text' : 'password'} style={input} value={f.password} onChange={(e) => set('password', e.target.value)} required autoComplete="new-password" placeholder="8 أحرف على الأقل" />
              <button type="button" className="sr-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'إخفاء' : 'إظهار'}>
                {showPw
                  ? <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.1 6.1A11 11 0 003 12c0 2.5 4 7 9 7a9.3 9.3 0 003.9-.8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                  : <svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
              </button>
            </div>

            <label htmlFor="sr-confirm" style={label}>تأكيد كلمة المرور</label>
            <div className="sr-field">
              <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="sr-confirm" type={showPw ? 'text' : 'password'} style={input} value={f.confirm} onChange={(e) => set('confirm', e.target.value)} required autoComplete="new-password" placeholder="أعد إدخال كلمة المرور" />
            </div>

            <div style={{ margin: '4px 0 16px' }}>
              <Captcha onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
            </div>

            {error && <div className="sr-msg err" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="sr-btn">
              {loading ? <span className="sr-spin" /> : 'إنشاء حساب الموظف'}
            </button>

            <div className="sr-foot">
              <span>لديك حساب؟ <Link href="/login">تسجيل الدخول</Link></span>
            </div>
          </form>
        </div>
      </main>

      <style jsx>{`
        .sr-root { min-height: 100dvh; display: grid; place-items: center; padding: 40px 20px;
          font-family: 'Cairo', system-ui, sans-serif;
          background: radial-gradient(1000px 600px at 80% 0%, #EEF4FB 0%, transparent 60%), linear-gradient(180deg, #FFF 0%, #F4F7FB 100%); }
        .sr-card { width: 100%; max-width: 460px; background: #fff; border: 1px solid #E7ECF3; border-radius: 26px;
          padding: 34px 32px 26px; box-shadow: 0 1px 2px rgba(15,39,68,.04), 0 16px 34px -14px rgba(15,39,68,.12), 0 40px 80px -40px rgba(15,39,68,.2);
          animation: rise .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes rise { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
        .sr-brand { text-align: center; margin-bottom: 22px; }
        .sr-brand h2 { margin: 16px 0 6px; font-size: 19px; font-weight: 800; color: #0F2744; }
        .sr-brand p { margin: 0; font-size: 13px; line-height: 1.7; color: #64748B; }
        .sr-note { display: flex; gap: 10px; background: #EFF5FE; border: 1px solid #D6E4FA; border-radius: 12px;
          padding: 12px 14px; margin-bottom: 20px; font-size: 12.5px; line-height: 1.8; color: #1E3A63; }
        .sr-note :global(svg) { flex: 0 0 auto; width: 18px; height: 18px; color: #1D4ED8; margin-top: 2px; }
        .sr-field { position: relative; display: flex; align-items: center; margin-bottom: 15px; }
        .sr-field :global(input:focus) { border-color: #1D4ED8 !important; box-shadow: 0 0 0 4px rgba(29,78,216,.1); }
        .sr-ic { position: absolute; right: 14px; width: 18px; height: 18px; color: #94A3B8; pointer-events: none; }
        .sr-eye { position: absolute; left: 12px; width: 30px; height: 30px; display: grid; place-items: center;
          background: none; border: 0; cursor: pointer; color: #94A3B8; border-radius: 8px; }
        .sr-eye:hover { color: #475569; background: #F1F5F9; }
        .sr-eye :global(svg) { width: 18px; height: 18px; }
        .sr-btn { width: 100%; height: 50px; margin-top: 6px; border: 0; border-radius: 12px;
          background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%); color: #fff; font-family: inherit;
          font-size: 15px; font-weight: 800; cursor: pointer; display: grid; place-items: center;
          box-shadow: 0 1px 2px rgba(15,39,68,.2), 0 10px 22px -10px rgba(29,78,216,.55); }
        .sr-btn:hover:not(:disabled) { filter: brightness(1.07); }
        .sr-btn:disabled { opacity: .62; cursor: default; }
        .sr-spin { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff;
          border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg) } }
        .sr-msg { border-radius: 10px; padding: 11px 14px; font-size: 13px; font-weight: 600; line-height: 1.7; margin-bottom: 14px; }
        .sr-msg.err { background: #FEF2F2; border: 1px solid #FECACA; color: #B42318; }
        .sr-foot { text-align: center; margin-top: 18px; padding-top: 15px; border-top: 1px solid #EEF2F6; font-size: 13px; color: #64748B; }
        .sr-foot :global(a) { color: #1D4ED8; font-weight: 700; text-decoration: none; }
        .sr-foot :global(a:hover) { text-decoration: underline; }
        @media (max-width: 520px) { .sr-card { padding: 28px 22px 22px; border-radius: 22px; } }
        @media (prefers-reduced-motion: reduce) { .sr-card { animation: none; } }
      `}</style>
    </div>
  )
}
