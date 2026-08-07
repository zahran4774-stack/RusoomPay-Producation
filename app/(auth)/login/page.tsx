'use client'
// صفحة تسجيل الدخول — مصادقة حقيقية عبر Supabase (لا تحقق في المتصفح)
// المنطق (المصادقة، MFA، التوجيه، الاستعادة) محفوظ كما هو؛ التحسين بصري فقط.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { createBrowserClient } from '@supabase/ssr'
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

  // ينقل الجلسة من الكوكي المؤقت (sb-pending-auth-token) إلى كوكيها النهائي الصحيح
  // حسب الوجهة، ثم يمسح الكوكي المؤقت محليًا ويوجّه المستخدم
  async function settleSessionAndGo(destination: string) {
    try {
      const targetCookieName = destination.startsWith('/parent') ? 'sb-parent-auth-token' : undefined
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const targetClient = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { cookieOptions: targetCookieName ? { name: targetCookieName } : undefined }
        )
        const { error: setErr } = await targetClient.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        if (setErr) throw setErr
      }
      // نمسح الكوكي المؤقت محليًا فقط — بدون إبطال الجلسة على الخادم
      await supabase.auth.signOut({ scope: 'local' })
      router.push(destination)
    } catch (err) {
      console.error('settleSessionAndGo failed:', err)
      setError('حدث خطأ أثناء إكمال تسجيل الدخول، حاول مرة أخرى')
      setLoading(false)
    }
  }

  // إكمال الدخول بعد اجتياز أي تحدّي مطلوب
  async function finishLogin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('انتهت الجلسة، أعد المحاولة'); setLoading(false); setMfaStep(false); return }
    // قراءة الدور عبر my_role() — موثوقة (لا تتأثّر بRLS)، تمنع تكرار إنشاء المدرسة
    const { data: myRole } = await supabase.rpc('my_role')
    // ربط دعوة طاقم إن وجدت (بلا دور بعد)
    if (!myRole) {
      const { data: accepted } = await supabase.rpc('accept_staff_invite')
      if (accepted && (accepted as { ok?: boolean }).ok) { await settleSessionAndGo('/dashboard'); return }
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
      await settleSessionAndGo('/subscription'); return
    }
    if (myRole === 'platform_admin') await settleSessionAndGo('/platform')
    else if (myRole === 'parent') await settleSessionAndGo('/parent')
    else await settleSessionAndGo('/dashboard')
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
      {/* طبقة الصورة — غير مقلوبة، مُزاحة لليسار ليبقى اليمين نظيفاً */}
      <div className="lp-bg" aria-hidden="true" />
      <div className="lp-wash" aria-hidden="true" />

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

      {/* ═══ بطاقة الدخول — العمود الأول في RTL = اليمين ═══ */}
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
                <svg className="lp-ic" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
                <input id="lp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="name@school.com" aria-label="البريد الإلكتروني" />
              </div>

              <label htmlFor="lp-pw" className="lp-label">كلمة المرور</label>
              <div className="lp-field">
                <svg className="lp-ic" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
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

      {/* ═══ البطل: النص + بطاقات المزايا — العمود الثاني في RTL = اليسار ═══ */}
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
          <div><b>عربية بالكامل</b><span>مصمّمة للمدارس الخليجية</span></div>
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
    </div>
  )
}
