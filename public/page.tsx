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
      {/* ═══ مبدّل اللغة (بصري فقط في هذه المرحلة) ═══ */}
      <div className="lp-lang" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
            stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
        <span>العربية</span>
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* ═══ منطقة البطل: النص + الصورة ═══ */}
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <div className="lp-hero-mark"><Logo height={44} /></div>
          <h1 className="lp-hero-title">
            النظام المالي والإداري المتكامل
            <br />
            <span>للمدارس الخاصة في الخليج</span>
          </h1>
          <p className="lp-hero-sub">
            إدارة الرسوم والمدفوعات والعمليات المالية بكل سهولة وأمان.
            <br />
            ضمن منصّة حديثة تساعد المدارس على العمل بكفاءة أعلى.
          </p>
        </div>

        {/* بطاقات المزايا العائمة */}
        <div className="lp-features">
          <div className="lp-feat">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
            <b>أمن موثوق</b>
            <span>حماية متقدمة لبيانات المدرسة والطلاب</span>
          </div>
          <div className="lp-feat">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a9 9 0 109 9h-9V3z" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M14 3.5A9 9 0 0120.5 10H14V3.5z" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
            <b>تقارير ذكية</b>
            <span>تقارير مالية واضحة تساعد على اتخاذ القرار</span>
          </div>
          <div className="lp-feat">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
            <b>إدارة متكاملة</b>
            <span>كل العمليات المالية في منصّة واحدة</span>
          </div>
          <div className="lp-feat">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M7 15h3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
            <b>مدفوعات سهلة</b>
            <span>تجربة دفع سلسة وآمنة لأولياء الأمور</span>
          </div>
        </div>
      </section>

      {/* ═══ بطاقة الدخول العائمة ═══ */}
      <main className="lp-pane">
        <div className="lp-card">
          <div className="lp-brand">
            <Logo height={44} />
            <h2>سجّل دخولك للوصول إلى حسابك</h2>
            <p>إدارة مدرستك بكل سهولة وأمان</p>
          </div>

          {mfaStep ? (
            <form onSubmit={verifyMfa} className="lp-form" aria-label="التحقّق بخطوتين">
              <h3 className="lp-step-title">التحقّق بخطوتين</h3>
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
                <svg className="lp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                <input id="lp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="name@school.com" aria-label="البريد الإلكتروني" />
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
                {loading ? <span className="lp-spin" /> : (<>تسجيل الدخول <span className="lp-arrow">←</span></>)}
              </button>

              <div className="lp-or"><span>أو</span></div>

              <a href="/register" className="lp-btn-ghost">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
                  <path d="M3.5 19a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  <path d="M18 7v6M15 10h6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
                إنشاء حساب جديد
              </a>

              <div className="lp-foot-links">
                <span>ولي أمر؟ <a href="/parent-register">أنشئ حساب</a></span>
                <span>موظف مدعوّ؟ <a href="/staff-register">أنشئ حساب</a></span>
              </div>

              <p className="lp-terms">
                بالتسجيل أنت توافق على <a href="/terms">شروط الخدمة</a> و <a href="/privacy">سياسة الخصوصية</a>
              </p>
            </form>
          )}
        </div>
      </main>

      {/* ═══ شريط الإحصائيات السفلي ═══ */}
      <footer className="lp-stats" aria-label="مؤشّرات الثقة">
        <div className="lp-stat">
          <span className="lp-stat-ic blue">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
          </span>
          <div><b>99.9%</b><span>حماية وأمان على مدار الساعة</span></div>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-ic slate">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10l9-5 9 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 19h18" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/></svg>
          </span>
          <div><b>+50 مدرسة</b><span>تثق في RusoomPay</span></div>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-ic blue">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" fill="none"/></svg>
          </span>
          <div><b>تشفير متقدم</b><span>لحماية البيانات</span></div>
        </div>
        <div className="lp-stat">
          <span className="lp-stat-ic slate">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/><rect x="2.5" y="13" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.8" fill="none"/><rect x="17.5" y="13" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.8" fill="none"/></svg>
          </span>
          <div><b>دعم مخصص</b><span>جاهزون لمساعدتك</span></div>
        </div>
      </footer>

      <style jsx>{`
        :global(html), :global(body) { height: 100%; }

        .lp-root {
          position: relative;
          min-height: 100dvh;
          display: grid;
          grid-template-columns: minmax(380px, 460px) 1fr;
          grid-template-rows: 1fr auto;
          gap: 0 40px;
          padding: 0 clamp(20px, 4vw, 56px);
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          background: #F4F7FB;
          overflow: hidden;
        }

        /* الصورة الخلفية — تشغل النصف العلوي بعرض الصفحة */
        .lp-root::before {
          content: '';
          position: absolute;
          inset: 0 0 128px 0;
          background-image:
            linear-gradient(270deg, rgba(244,247,251,.96) 0%, rgba(244,247,251,.55) 22%, transparent 48%),
            url('/hero-school.jpg');
          background-size: cover;
          background-position: center 30%;
          /* قلب أفقي: التلاشي الأبيض في الصورة ينتقل لليمين ليقع تحت بطاقة الدخول */
          transform: scaleX(-1);
          z-index: 0;
        }

        /* ═══ مبدّل اللغة ═══ */
        .lp-lang {
          position: absolute;
          top: 22px;
          right: 28px;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 7px;
          height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.92);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(226,232,240,.9);
          box-shadow: 0 4px 14px -6px rgba(15,39,68,.18);
          font-size: 13px;
          font-weight: 700;
          color: #334155;
        }

        /* ═══ البطل ═══ */
        .lp-hero {
          position: relative;
          z-index: 2;
          grid-column: 2;
          grid-row: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 72px 0 28px;
          animation: fadeIn .7s ease .1s both;
        }
        @keyframes fadeIn { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform:none } }

        .lp-hero-mark {
          display: inline-flex;
          background: rgba(255,255,255,.94);
          border-radius: 14px;
          padding: 9px 15px;
          margin-bottom: 26px;
          box-shadow: 0 8px 24px -12px rgba(0,0,0,.35);
        }
        .lp-hero-copy { max-width: 620px; }
        .lp-hero-title {
          font-size: clamp(24px, 2.5vw, 36px);
          line-height: 1.5;
          font-weight: 800;
          color: #0F2744;
          margin: 0 0 16px;
          letter-spacing: -.5px;
          text-shadow: 0 2px 18px rgba(255,255,255,.7);
        }
        .lp-hero-title span { color: #1D4ED8; }
        .lp-hero-sub {
          font-size: clamp(13px, 1.05vw, 15px);
          line-height: 2;
          font-weight: 600;
          color: #33465F;
          margin: 0;
          text-shadow: 0 1px 14px rgba(255,255,255,.85);
        }

        /* ── بطاقات المزايا ── */
        .lp-features {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          max-width: 660px;
          margin-top: 40px;
        }
        .lp-feat {
          background: rgba(255,255,255,.94);
          backdrop-filter: blur(14px) saturate(150%);
          -webkit-backdrop-filter: blur(14px) saturate(150%);
          border: 1px solid rgba(226,232,240,.9);
          border-radius: 16px;
          padding: 16px 14px;
          text-align: center;
          box-shadow:
            0 1px 2px rgba(15,39,68,.04),
            0 12px 26px -14px rgba(15,39,68,.22);
          transition: transform .18s ease, box-shadow .22s ease;
        }
        .lp-feat:hover {
          transform: translateY(-3px);
          box-shadow: 0 2px 4px rgba(15,39,68,.06), 0 18px 34px -16px rgba(15,39,68,.28);
        }
        .lp-feat :global(svg) {
          width: 26px; height: 26px;
          color: #1D4ED8;
          margin-bottom: 9px;
        }
        .lp-feat b {
          display: block;
          font-size: 13.5px; font-weight: 800; color: #0F2744;
          margin-bottom: 5px;
        }
        .lp-feat span {
          display: block;
          font-size: 11px; line-height: 1.65; color: #64748B;
        }

        /* ═══ بطاقة الدخول ═══ */
        .lp-pane {
          position: relative;
          z-index: 2;
          grid-column: 1;
          grid-row: 1;
          display: grid;
          place-items: center;
          padding: 40px 0;
        }
        .lp-card {
          width: 100%;
          background: rgba(255,255,255,.97);
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid rgba(226,232,240,.9);
          border-radius: 26px;
          padding: 34px 32px 26px;
          box-shadow:
            0 1px 2px rgba(15,39,68,.04),
            0 16px 34px -14px rgba(15,39,68,.14),
            0 40px 80px -40px rgba(15,39,68,.24);
          animation: rise .5s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes rise { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }

        .lp-brand { text-align: center; margin-bottom: 24px; }
        .lp-brand h2 {
          margin: 18px 0 6px;
          font-size: 18px;
          font-weight: 800;
          color: #0F2744;
          letter-spacing: -.3px;
        }
        .lp-brand p {
          margin: 0;
          font-size: 13px;
          color: #64748B;
        }

        /* ── الحقول ── */
        .lp-form { display: block; }
        .lp-label {
          display: block;
          font-size: 12.5px;
          font-weight: 700;
          color: #0F2744;
          margin: 0 0 7px;
          letter-spacing: -.1px;
        }
        .lp-field {
          position: relative;
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        .lp-field :global(input) {
          width: 100%;
          height: 48px;
          padding: 0 44px 0 44px;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          background: #fff;
          font-family: inherit;
          font-size: 14.5px;
          color: #0F172A;
          outline: none;
          transition: border-color .18s ease, box-shadow .18s ease;
        }
        .lp-field :global(input::placeholder) { color: #A5B0C0; }
        .lp-field :global(input:focus) {
          border-color: #1D4ED8;
          box-shadow: 0 0 0 4px rgba(29,78,216,.10);
        }
        .lp-ic {
          position: absolute;
          right: 14px;
          width: 18px; height: 18px;
          color: #94A3B8;
          pointer-events: none;
        }
        .lp-eye {
          position: absolute;
          left: 12px;
          width: 30px; height: 30px;
          display: grid; place-items: center;
          background: none; border: 0; cursor: pointer;
          color: #94A3B8;
          border-radius: 8px;
          transition: color .15s, background .15s;
        }
        .lp-eye:hover { color: #475569; background: #F1F5F9; }
        .lp-eye :global(svg) { width: 18px; height: 18px; }

        /* ── صف التذكّر ── */
        .lp-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 2px 0 18px;
        }
        .lp-remember {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: #475569; cursor: pointer;
          user-select: none;
        }
        .lp-remember :global(input) {
          width: 17px; height: 17px;
          accent-color: #1D4ED8;
          cursor: pointer;
        }
        .lp-link {
          background: none; border: 0;
          font-family: inherit; font-size: 13px; font-weight: 600;
          color: #1D4ED8; cursor: pointer; padding: 0;
        }
        .lp-link:hover { text-decoration: underline; }

        /* ── الأزرار ── */
        .lp-btn {
          width: 100%;
          height: 50px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
          color: #fff;
          font-family: inherit;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -.2px;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          box-shadow: 0 1px 2px rgba(15,39,68,.2), 0 10px 22px -10px rgba(29,78,216,.55);
          transition: transform .12s ease, box-shadow .2s ease, filter .2s ease;
        }
        .lp-btn:hover:not(:disabled) {
          filter: brightness(1.07);
          box-shadow: 0 2px 4px rgba(15,39,68,.22), 0 16px 30px -12px rgba(29,78,216,.6);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(1px); }
        .lp-btn:disabled { opacity: .62; cursor: default; }
        .lp-arrow { font-size: 17px; line-height: 1; }

        .lp-btn-ghost {
          width: 100%;
          height: 50px;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          background: #fff;
          color: #0F2744;
          font-family: inherit;
          font-size: 14.5px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 9px;
          transition: border-color .18s, background .18s, box-shadow .18s;
        }
        .lp-btn-ghost:hover {
          border-color: #CBD5E1;
          background: #F8FAFC;
          box-shadow: 0 6px 16px -10px rgba(15,39,68,.24);
        }
        .lp-btn-ghost :global(svg) { width: 19px; height: 19px; color: #475569; }

        .lp-spin {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg) } }

        /* ── الفاصل "أو" ── */
        .lp-or {
          position: relative;
          text-align: center;
          margin: 18px 0;
        }
        .lp-or::before {
          content: '';
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 1px;
          background: #E9EEF4;
        }
        .lp-or span {
          position: relative;
          background: #fff;
          padding: 0 14px;
          font-size: 12.5px;
          font-weight: 700;
          color: #94A3B8;
        }

        /* ── الرسائل ── */
        .lp-msg {
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px;
          font-weight: 600;
          line-height: 1.65;
          margin-bottom: 14px;
        }
        .lp-msg.err { background: #FEF2F2; border: 1px solid #FECACA; color: #B42318; }
        .lp-msg.ok  { background: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; }

        /* ── MFA ── */
        .lp-step-title { font-size: 18px; color: #0F2744; margin: 0 0 4px; text-align: center; }
        .lp-step-sub { font-size: 13px; color: #64748B; margin: 0 0 18px; text-align: center; }
        .lp-otp {
          width: 100%; height: 56px;
          border: 1.5px solid #E2E8F0; border-radius: 12px;
          background: #fff;
          font-family: inherit; font-size: 26px; font-weight: 700;
          letter-spacing: 10px; text-align: center;
          color: #0F172A; outline: none;
          margin-bottom: 16px;
          transition: border-color .18s, box-shadow .18s;
        }
        .lp-otp:focus { border-color: #1D4ED8; box-shadow: 0 0 0 4px rgba(29,78,216,.10); }

        /* ── الروابط ── */
        .lp-foot-links {
          display: flex; justify-content: center; gap: 16px;
          flex-wrap: wrap;
          text-align: center; margin-top: 18px;
          font-size: 12.5px; color: #64748B;
        }
        .lp-foot-links :global(a) {
          color: #1D4ED8; font-weight: 700; text-decoration: none;
        }
        .lp-foot-links :global(a:hover) { text-decoration: underline; }

        .lp-terms {
          text-align: center;
          margin: 16px 0 0;
          padding-top: 14px;
          border-top: 1px solid #EEF2F6;
          font-size: 11.5px;
          line-height: 1.9;
          color: #94A3B8;
        }
        .lp-terms :global(a) { color: #1D4ED8; font-weight: 700; text-decoration: none; }
        .lp-terms :global(a:hover) { text-decoration: underline; }

        /* ═══ شريط الإحصائيات ═══ */
        .lp-stats {
          position: relative;
          z-index: 2;
          grid-column: 1 / -1;
          grid-row: 2;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          align-items: center;
          min-height: 128px;
          padding: 22px 0;
          background: #F4F7FB;
        }
        .lp-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
          padding: 0 12px;
          border-left: 1px solid #E4EAF2;
        }
        .lp-stat:last-child { border-left: 0; }
        .lp-stat-ic {
          flex: 0 0 auto;
          width: 42px; height: 42px;
          display: grid; place-items: center;
          border-radius: 12px;
        }
        .lp-stat-ic :global(svg) { width: 21px; height: 21px; }
        .lp-stat-ic.blue  { background: #E8EFFC; color: #1D4ED8; }
        .lp-stat-ic.slate { background: #EEF1F6; color: #475569; }
        .lp-stat b {
          display: block;
          font-size: 14px; font-weight: 800; color: #0F2744;
          margin-bottom: 2px;
        }
        .lp-stat span:not(.lp-stat-ic) {
          font-size: 11.5px; color: #64748B; line-height: 1.5;
        }

        /* ═══ الاستجابة ═══ */
        @media (max-width: 1180px) {
          .lp-features { grid-template-columns: repeat(2, 1fr); max-width: 420px; }
        }
        @media (max-width: 980px) {
          .lp-root {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto;
            padding: 0 20px;
            overflow: visible;
          }
          .lp-root::before { inset: 0 0 auto 0; height: 300px; }
          .lp-hero { display: none; }
          .lp-lang { top: 16px; right: 16px; }
          .lp-pane {
            grid-column: 1; grid-row: 1;
            padding: 74px 0 28px;
          }
          .lp-stats {
            grid-row: 2;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px 10px;
            min-height: 0;
            padding: 8px 0 28px;
          }
          .lp-stat:nth-child(2n) { border-left: 0; }
        }
        @media (max-width: 520px) {
          .lp-stats { grid-template-columns: 1fr; }
          .lp-stat { border-left: 0; justify-content: flex-start; }
          .lp-card { padding: 28px 22px 22px; border-radius: 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-card, .lp-hero { animation: none; }
          .lp-btn, .lp-btn-ghost, .lp-feat, .lp-field :global(input) { transition: none; }
        }
      `}</style>
    </div>
  )
}
