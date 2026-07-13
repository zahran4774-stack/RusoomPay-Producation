'use client'
// صفحة تسجيل الدخول — مصادقة حقيقية عبر Supabase (لا تحقق في المتصفح)
// المنطق (المصادقة، MFA، التوجيه، الاستعادة) محفوظ كما هو؛ التحسين بصري فقط.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Logo from '@/app/Logo'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // حالة تحدّي المصادقة الثنائية
  const [mfaStep, setMfaStep] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')

  // يتحقّق هل الحساب يحتاج تخطّي تحدّي MFA (aal1 → aal2)
  async function needsMfa(): Promise<string | null> {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel) {
      const { data: f } = await supabase.auth.mfa.listFactors()
      const verified = f?.totp?.find((x) => x.status === 'verified')
      return verified?.id ?? null
    }
    return null
  }

  // إكمال الدخول بعد اجتياز أي تحدّي مطلوب
  async function finishLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('انتهت الجلسة، أعد المحاولة'); setLoading(false); setMfaStep(false); return }
    // قراءة الدور عبر my_role() — موثوقة (لا تتأثّر بـRLS)، تمنع تكرار إنشاء المدرسة
    const { data: myRole } = await supabase.rpc('my_role')
    // ربط دعوة طاقم إن وُجدت (بلا دور بعد)
    if (!myRole) {
      const { data: accepted } = await supabase.rpc('accept_staff_invite')
      if (accepted && (accepted as { ok?: boolean }).ok) { router.push('/dashboard'); router.refresh(); return }
    }
    if (!myRole && user.user_metadata?.school_name) {
      const m = user.user_metadata
      const { error: rpcErr } = await supabase.rpc('register_school', {
        p_name: m.school_name, p_branch: m.branch || '', p_country: m.country || 'OM',
        p_currency: m.currency || 'OMR', p_cr: m.cr || '', p_license: m.license || '',
        p_vat: m.vat || '', p_phone: m.phone || '', p_email: email, p_address: m.address || '',
        p_owner_name: m.owner_name || 'مدير المدرسة', p_bank_iban: m.bank_iban || null,
      })
      if (rpcErr) { setError('تعذّر إكمال تسجيل المدرسة: ' + rpcErr.message); setLoading(false); return }
      router.push('/subscription'); router.refresh(); return
    }
    if (myRole === 'platform_admin') router.push('/platform')
    else if (myRole === 'parent') router.push('/parent')
    else router.push('/dashboard')
    router.refresh()
  }

  // التحقّق من رمز المصادقة الثنائية
  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault()
    if (mfaCode.length !== 6) { setError('أدخل الرمز المكوّن من 6 أرقام'); return }
    setLoading(true); setError('')
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (chErr) { setError('خطأ في التحقّق'); setLoading(false); return }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: ch.id, code: mfaCode })
    if (vErr) { setError('الرمز غير صحيح، حاول مجدداً'); setLoading(false); return }
    await finishLogin()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // المصادقة تتم على خادم Supabase — يصدر JWT آمن
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // رسالة عامة لا تكشف إن كان البريد مسجلاً (وقاية من حصر الحسابات)
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لم يُؤكَّد البريد بعد')
      setLoading(false)
      return
    }

    // إن كان الحساب مفعّلاً عليه المصادقة الثنائية → اطلب الرمز قبل المتابعة
    const factorId = await needsMfa()
    if (factorId) {
      setMfaFactorId(factorId)
      setMfaStep(true)
      setLoading(false)
      return
    }

    // لا مصادقة ثنائية → أكمل الدخول مباشرة
    await finishLogin()
  }

  async function handleForgotPassword() {
    if (!email) { setError('أدخل بريدك الإلكتروني أولاً'); return }
    // استعادة كلمة المرور الحقيقية — Supabase يرسل بريداً فعلياً
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError('تعذّر إرسال رابط الاستعادة')
    else setError('✓ إن كان البريد مسجلاً، أرسلنا رابط إعادة التعيين')
  }

  return (
    <div className="lp-root" dir="rtl">
      {/* لوحة زخرفية جانبية — سطح المكتب فقط */}
      <div className="lp-aside" aria-hidden="true">
        <div className="lp-aside-content">
          <div className="lp-logo-wrap-lg"><Logo height={58} dark /></div>
          <p>النظام المالي والإداري المتكامل للمدارس الخاصة في الخليج</p>
          <ul className="lp-aside-points">
            <li>محاسبة قيد مزدوج كاملة</li>
            <li>بوابة أولياء أمور وتحصيل رقمي</li>
            <li>عزل بيانات آمن لكل مدرسة</li>
          </ul>
        </div>
        <svg className="lp-bldg" viewBox="0 0 400 300" aria-hidden="true" fill="none">
          <rect x="60" y="120" width="80" height="160" rx="4" />
          <rect x="160" y="70" width="90" height="210" rx="4" />
          <rect x="270" y="140" width="70" height="140" rx="4" />
          <path d="M160 70 L205 40 L250 70 Z" />
        </svg>
      </div>

      {/* بطاقة الدخول */}
      <div className="lp-main">
        <div className="lp-card">
          <div className="lp-brand">
            <div className="lp-logo-wrap"><Logo height={52} /></div>
            <p>النظام المالي والإداري المتكامل للمدارس الخاصة</p>
          </div>

          {mfaStep ? (
            <form onSubmit={verifyMfa} className="lp-form" aria-label="التحقّق بخطوتين">
              <h2 className="lp-step-title">التحقّق بخطوتين</h2>
              <p className="lp-step-sub">أدخل الرمز من تطبيق المصادقة</p>
              <input
                value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" inputMode="numeric" dir="ltr" autoFocus
                aria-label="رمز التحقّق" className="lp-otp"
              />
              {error && <div className={error.startsWith('✓') ? 'lp-msg ok' : 'lp-msg err'} role="alert">{error}</div>}
              <button type="submit" disabled={loading || mfaCode.length !== 6} className="lp-btn">
                {loading ? <span className="lp-spin" /> : 'تحقّق ودخول'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="lp-form" aria-label="تسجيل الدخول">
              <label htmlFor="lp-email" className="lp-label">البريد الإلكتروني</label>
              <div className="lp-field">
                <svg className="lp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z" fill="none"/><path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                <input id="lp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="name@school.om" aria-label="البريد الإلكتروني" />
              </div>

              <label htmlFor="lp-pw" className="lp-label">كلمة المرور</label>
              <div className="lp-field">
                <svg className="lp-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                <input id="lp-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="current-password" placeholder="••••••••" aria-label="كلمة المرور" />
                <button type="button" className="lp-eye" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                  {showPw
                    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.1 6.1A11 11 0 003 12c0 2.5 4 7 9 7a9.3 9.3 0 003.9-.8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
                </button>
              </div>

              <div className="lp-row">
                <label className="lp-remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>تذكّرني</span>
                </label>
                <button type="button" onClick={handleForgotPassword} className="lp-link">نسيت كلمة المرور؟</button>
              </div>

              {error && <div className={error.startsWith('✓') ? 'lp-msg ok' : 'lp-msg err'} role="alert">{error}</div>}

              <button type="submit" disabled={loading} className="lp-btn">
                {loading ? <span className="lp-spin" /> : 'تسجيل الدخول'}
              </button>

              <div className="lp-foot-links">
                <span>مدرسة جديدة؟ <a href="/register">سجّل مدرستك</a></span>
                <span>ولي أمر؟ <a href="/parent-register">أنشئ حساب</a></span>
                <span>موظف مدعوّ؟ <a href="/staff-register">أنشئ حساب</a></span>
              </div>
            </form>
          )}

          {/* تذييل الثقة الأمني */}
          <div className="lp-security" aria-label="مؤشّرات الأمان">
            <span>🔒 اتصال مشفّر</span>
            <span>🛡️ حماية مؤسسية</span>
            <span>👁️ خصوصية محميّة</span>
          </div>
        </div>
      </div>

      <style>{`
        :root{ --lp-primary:#123A72; --lp-primary-d:#0E2E5C; --lp-accent:#D4AF37; --lp-bg:#F7F8FA; --lp-line:#E2E7EE; --lp-ink:#1A2433; --lp-muted:#667285; }
        .lp-root{ min-height:100dvh; display:grid; grid-template-columns:1fr; background:var(--lp-bg); font-family:'Cairo','Tajawal',Tahoma,sans-serif; color:var(--lp-ink); }
        .lp-aside{ display:none; }
        .lp-main{ display:grid; place-items:center; padding:24px 16px; position:relative; }
        .lp-main::before{ content:''; position:absolute; inset:0; background:radial-gradient(900px 500px at 80% -10%, rgba(18,58,114,.07), transparent), radial-gradient(700px 400px at 10% 110%, rgba(212,175,55,.06), transparent); pointer-events:none; }
        .lp-card{ position:relative; z-index:1; width:100%; max-width:460px; background:#fff; border:1px solid var(--lp-line); border-radius:20px; padding:34px 30px; box-shadow:0 12px 40px rgba(18,40,80,.10),0 2px 8px rgba(18,40,80,.04); animation:lpFade .5s ease; }
        @keyframes lpFade{ from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }

        .lp-brand{ text-align:center; margin-bottom:24px; }
        .lp-logo-wrap{ display:flex; justify-content:center; margin-bottom:12px; }
        .lp-brand h1{ font-size:1.7rem; font-weight:700; color:var(--lp-primary); margin:0 0 6px; letter-spacing:-.5px; }
        .lp-brand p{ font-size:.92rem; color:var(--lp-muted); font-weight:400; line-height:1.6; margin:0; }

        .lp-form{ display:flex; flex-direction:column; }
        .lp-label{ font-size:13px; font-weight:600; margin-bottom:6px; color:var(--lp-ink); }
        .lp-field{ position:relative; display:flex; align-items:center; margin-bottom:14px; }
        .lp-field .lp-ic{ position:absolute; inset-inline-start:13px; width:19px; height:19px; color:var(--lp-muted); pointer-events:none; }
        .lp-field input{ width:100%; height:48px; padding-inline-start:42px; padding-inline-end:14px; border:1.5px solid var(--lp-line); border-radius:12px; font-size:15px; font-family:inherit; background:#fff; transition:border-color .18s, box-shadow .18s; }
        .lp-field input:focus{ outline:none; border-color:var(--lp-primary); box-shadow:0 0 0 3px rgba(18,58,114,.12); }
        .lp-eye{ position:absolute; inset-inline-end:10px; background:none; border:none; cursor:pointer; color:var(--lp-muted); padding:6px; display:grid; place-items:center; }
        .lp-eye svg{ width:20px; height:20px; }

        .lp-row{ display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; font-size:13px; }
        .lp-remember{ display:flex; align-items:center; gap:7px; cursor:pointer; color:var(--lp-muted); }
        .lp-remember input{ width:16px; height:16px; accent-color:var(--lp-primary); cursor:pointer; }
        .lp-link{ background:none; border:none; color:var(--lp-primary); font-weight:600; cursor:pointer; font-family:inherit; font-size:13px; }
        .lp-link:hover{ text-decoration:underline; }

        .lp-btn{ width:100%; height:50px; border:none; border-radius:12px; background:var(--lp-primary); color:#fff; font-size:15px; font-weight:700; font-family:inherit; cursor:pointer; display:grid; place-items:center; transition:background .18s, transform .12s, box-shadow .2s; }
        .lp-btn:hover:not(:disabled){ background:var(--lp-primary-d); transform:translateY(-1px); box-shadow:0 8px 20px rgba(18,58,114,.28); }
        .lp-btn:active:not(:disabled){ transform:translateY(0); }
        .lp-btn:disabled{ opacity:.6; cursor:not-allowed; }
        .lp-spin{ width:20px; height:20px; border:2.5px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:lpSpin .7s linear infinite; }
        @keyframes lpSpin{ to{ transform:rotate(360deg) } }

        .lp-otp{ width:100%; height:54px; border:1.5px solid var(--lp-line); border-radius:12px; font-size:24px; letter-spacing:10px; text-align:center; font-family:inherit; margin-bottom:14px; }
        .lp-otp:focus{ outline:none; border-color:var(--lp-primary); box-shadow:0 0 0 3px rgba(18,58,114,.12); }
        .lp-step-title{ font-size:1.3rem; color:var(--lp-primary); text-align:center; margin:0 0 4px; }
        .lp-step-sub{ font-size:.9rem; color:var(--lp-muted); text-align:center; margin:0 0 18px; }

        .lp-msg{ font-size:13px; padding:10px 12px; border-radius:9px; margin-bottom:12px; }
        .lp-msg.err{ color:#B42318; background:#FEF3F2; border:1px solid #FECDCA; }
        .lp-msg.ok{ color:#067647; background:#ECFDF3; border:1px solid #ABEFC6; }


        .lp-foot-links{ display:flex; flex-direction:column; gap:7px; text-align:center; margin-top:16px; font-size:13px; color:var(--lp-muted); }
        .lp-foot-links a{ color:var(--lp-primary); font-weight:600; text-decoration:none; }
        .lp-foot-links a:hover{ text-decoration:underline; }

        .lp-security{ display:flex; justify-content:center; flex-wrap:wrap; gap:14px; margin-top:22px; padding-top:18px; border-top:1px solid var(--lp-line); font-size:11.5px; color:var(--lp-muted); }

        /* سطح المكتب: لوحة جانبية */
        @media (min-width:1024px){
          .lp-root{ grid-template-columns:1.1fr 1fr; }
          .lp-aside{ display:flex; flex-direction:column; justify-content:center; position:relative; overflow:hidden; background:linear-gradient(155deg,var(--lp-primary-d),var(--lp-primary) 55%,#1B4F8A); color:#fff; padding:60px; }
          .lp-aside-content{ position:relative; z-index:1; max-width:420px; }
          .lp-logo-wrap-lg{ margin-bottom:22px; }
          .lp-aside h2{ font-size:2.2rem; font-weight:800; margin:0 0 12px; }
          .lp-aside p{ font-size:1.05rem; line-height:1.8; color:rgba(255,255,255,.82); margin:0 0 26px; }
          .lp-aside-points{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:13px; }
          .lp-aside-points li{ position:relative; padding-inline-start:28px; font-size:.98rem; color:rgba(255,255,255,.9); }
          .lp-aside-points li::before{ content:'✓'; position:absolute; inset-inline-start:0; width:20px; height:20px; border-radius:6px; background:var(--lp-accent); color:var(--lp-primary-d); display:grid; place-items:center; font-size:12px; font-weight:800; }
          .lp-bldg{ position:absolute; inset-block-end:-20px; inset-inline-start:50%; transform:translateX(-50%); width:90%; max-width:460px; opacity:.10; stroke:#fff; stroke-width:2; fill:none; }
        }
        @media (prefers-reduced-motion:reduce){ .lp-card{ animation:none } .lp-btn,.lp-field input{ transition:none } }
      `}</style>
    </div>
  )
}
