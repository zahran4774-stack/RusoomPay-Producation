'use client'
// تسجيل الموظف المدعو — يجب أن يستخدم نفس البريد الذي دُعي به.
// مهم: لا نرسل أي user_metadata (خصوصاً school_name)، وإلا فمنطق finishLogin
// في صفحة الدخول سيحاول تسجيل مدرسة جديدة بدل ربط الدعوة.
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import Logo from '@/app/Logo'

export default function StaffRegisterPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)

    // بلا metadata — الدور والمدرسة والاسم تأتي من جدول الدعوات عبر accept_staff_invite
    const { error: signUpErr } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (signUpErr) {
      setError('تعذّر إنشاء الحساب. قد يكون البريد مسجلاً مسبقاً — جرّب تسجيل الدخول')
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
  }

  return (
    <div className="sr-root" dir="rtl">
      <main className="sr-pane">
        <div className="sr-card">
          <div className="sr-brand">
            <Logo height={44} />
            <h2>إنشاء حساب موظف</h2>
            <p>استخدم البريد الإلكتروني نفسه الذي دعتك به مدرستك</p>
          </div>

          {done ? (
            <div className="sr-done" role="status">
              <div className="sr-check" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" fill="none" />
                  <path d="M8 12.5l2.6 2.6L16 9.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              </div>
              <h3>تم إنشاء حسابك</h3>
              <p>
                إن كان تأكيد البريد مفعّلاً، ستصلك رسالة تأكيد.
                بعد ذلك سجّل دخولك وسيُربط حسابك بمدرستك تلقائياً.
              </p>
              <Link href="/login" className="sr-btn-link">الذهاب لتسجيل الدخول</Link>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="sr-form" aria-label="إنشاء حساب موظف">
              <div className="sr-note" role="note">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
                  <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                </svg>
                <span>
                  يجب أن يطابق البريد تماماً ما أدخله مدير المدرسة عند دعوتك،
                  وإلا لن يُربط حسابك بالمدرسة.
                </span>
              </div>

              <label htmlFor="sr-email" className="sr-label">البريد الإلكتروني</label>
              <div className="sr-field">
                <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <input
                  id="sr-email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email" placeholder="name@school.com"
                  aria-label="البريد الإلكتروني"
                />
              </div>

              <label htmlFor="sr-pw" className="sr-label">كلمة المرور</label>
              <div className="sr-field">
                <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <input
                  id="sr-pw" type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="new-password" placeholder="8 أحرف على الأقل"
                  aria-label="كلمة المرور"
                />
                <button
                  type="button" className="sr-eye" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPw
                    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.1 6.1A11 11 0 003 12c0 2.5 4 7 9 7a9.3 9.3 0 003.9-.8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
                </button>
              </div>

              <label htmlFor="sr-confirm" className="sr-label">تأكيد كلمة المرور</label>
              <div className="sr-field">
                <svg className="sr-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
                <input
                  id="sr-confirm" type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required autoComplete="new-password" placeholder="أعد إدخال كلمة المرور"
                  aria-label="تأكيد كلمة المرور"
                />
              </div>

              {error && <div className="sr-msg err" role="alert">{error}</div>}

              <button type="submit" disabled={loading} className="sr-btn">
                {loading ? <span className="sr-spin" /> : 'إنشاء الحساب'}
              </button>

              <div className="sr-foot">
                <span>لديك حساب بالفعل؟ <Link href="/login">تسجيل الدخول</Link></span>
              </div>
            </form>
          )}
        </div>
      </main>

      <style jsx>{`
        :global(html), :global(body) { height: 100%; }

        .sr-root {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 40px 20px;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(1000px 600px at 80% 0%, #EEF4FB 0%, transparent 60%),
            linear-gradient(180deg, #FFFFFF 0%, #F4F7FB 100%);
        }

        .sr-card {
          width: 100%;
          max-width: 440px;
          background: #fff;
          border: 1px solid #E7ECF3;
          border-radius: 26px;
          padding: 34px 32px 26px;
          box-shadow:
            0 1px 2px rgba(15,39,68,.04),
            0 16px 34px -14px rgba(15,39,68,.12),
            0 40px 80px -40px rgba(15,39,68,.20);
          animation: rise .5s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes rise { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }

        .sr-brand { text-align: center; margin-bottom: 22px; }
        .sr-brand h2 {
          margin: 16px 0 6px;
          font-size: 19px; font-weight: 800;
          color: #0F2744; letter-spacing: -.3px;
        }
        .sr-brand p {
          margin: 0; font-size: 13px; line-height: 1.7; color: #64748B;
        }

        /* ملاحظة تنبيهية */
        .sr-note {
          display: flex; gap: 10px;
          background: #EFF5FE;
          border: 1px solid #D6E4FA;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 20px;
          font-size: 12.5px; line-height: 1.8; color: #1E3A63;
        }
        .sr-note :global(svg) {
          flex: 0 0 auto;
          width: 18px; height: 18px;
          color: #1D4ED8;
          margin-top: 2px;
        }

        .sr-label {
          display: block;
          font-size: 12.5px; font-weight: 700;
          color: #0F2744; margin: 0 0 7px;
        }
        .sr-field {
          position: relative;
          display: flex; align-items: center;
          margin-bottom: 15px;
        }
        .sr-field :global(input) {
          width: 100%; height: 47px;
          padding: 0 44px 0 44px;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          background: #fff;
          font-family: inherit; font-size: 14.5px;
          color: #0F172A; outline: none;
          transition: border-color .18s ease, box-shadow .18s ease;
        }
        .sr-field :global(input::placeholder) { color: #A5B0C0; }
        .sr-field :global(input:focus) {
          border-color: #1D4ED8;
          box-shadow: 0 0 0 4px rgba(29,78,216,.10);
        }
        .sr-ic {
          position: absolute; right: 14px;
          width: 18px; height: 18px;
          color: #94A3B8; pointer-events: none;
        }
        .sr-eye {
          position: absolute; left: 12px;
          width: 30px; height: 30px;
          display: grid; place-items: center;
          background: none; border: 0; cursor: pointer;
          color: #94A3B8; border-radius: 8px;
          transition: color .15s, background .15s;
        }
        .sr-eye:hover { color: #475569; background: #F1F5F9; }
        .sr-eye :global(svg) { width: 18px; height: 18px; }

        .sr-btn {
          width: 100%; height: 50px;
          margin-top: 6px;
          border: 0; border-radius: 12px;
          background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
          color: #fff;
          font-family: inherit; font-size: 15px; font-weight: 800;
          cursor: pointer;
          display: grid; place-items: center;
          box-shadow: 0 1px 2px rgba(15,39,68,.2), 0 10px 22px -10px rgba(29,78,216,.55);
          transition: transform .12s ease, box-shadow .2s ease, filter .2s ease;
        }
        .sr-btn:hover:not(:disabled) { filter: brightness(1.07); }
        .sr-btn:active:not(:disabled) { transform: translateY(1px); }
        .sr-btn:disabled { opacity: .62; cursor: default; }

        .sr-spin {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg) } }

        .sr-msg {
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px; font-weight: 600; line-height: 1.65;
          margin-bottom: 14px;
        }
        .sr-msg.err { background: #FEF2F2; border: 1px solid #FECACA; color: #B42318; }

        .sr-foot {
          text-align: center;
          margin-top: 18px; padding-top: 15px;
          border-top: 1px solid #EEF2F6;
          font-size: 13px; color: #64748B;
        }
        .sr-foot :global(a) {
          color: #1D4ED8; font-weight: 700; text-decoration: none;
        }
        .sr-foot :global(a:hover) { text-decoration: underline; }

        /* شاشة النجاح */
        .sr-done { text-align: center; padding: 8px 0 4px; }
        .sr-check {
          width: 62px; height: 62px;
          margin: 0 auto 16px;
          display: grid; place-items: center;
          border-radius: 50%;
          background: #F0FDF4;
          color: #15803D;
        }
        .sr-check :global(svg) { width: 34px; height: 34px; }
        .sr-done h3 {
          margin: 0 0 10px;
          font-size: 18px; font-weight: 800; color: #0F2744;
        }
        .sr-done p {
          margin: 0 0 22px;
          font-size: 13.5px; line-height: 1.95; color: #64748B;
        }
        .sr-btn-link {
          display: grid; place-items: center;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%);
          color: #fff;
          font-size: 14.5px; font-weight: 800;
          text-decoration: none;
          box-shadow: 0 10px 22px -10px rgba(29,78,216,.55);
        }
        .sr-btn-link:hover { filter: brightness(1.07); }

        @media (max-width: 520px) {
          .sr-card { padding: 28px 22px 22px; border-radius: 22px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sr-card { animation: none; }
          .sr-btn, .sr-field :global(input) { transition: none; }
        }
      `}</style>
    </div>
  )
}
