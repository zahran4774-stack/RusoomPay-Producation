'use client'
// تسجيل ولي الأمر — بالهاتف، بلا اختيار مدرسة.
// النظام يطابق رقم ولي الأمر مع أرقام أولياء الأمور في سجلّات الطلاب،
// فيحدّد المدرسة ويربط الأبناء تلقائياً عبر parent_signup_by_phone.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Logo from '@/app/Logo'
import { GULF_COUNTRIES, DEFAULT_COUNTRY, cleanLocalNumber, isValidLocalNumber } from '@/lib/academic'

export default function ParentRegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({
    full_name: '', email: '', password: '', confirm: '',
    country_code: DEFAULT_COUNTRY, phone: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  function onPhone(raw: string) {
    const country = GULF_COUNTRIES.find((c) => c.code === f.country_code)
    set('phone', cleanLocalNumber(raw).slice(0, country?.localLen ?? 9))
  }
  const phoneValid = isValidLocalNumber(f.phone, f.country_code)

  // ترجمة أسباب الرفض من الدالة إلى رسائل عربية واضحة
  function reasonMessage(reason: string): string {
    switch (reason) {
      case 'no_children_found':
        return 'لا يوجد طالب مسجّل بهذا الرقم في أي مدرسة. تأكّد من الرقم، أو اطلب من مدرسة أبنائك تسجيل رقمك في بيانات الطالب أولاً.'
      case 'invalid_phone':
        return 'رقم الهاتف غير صالح. تحقّق من الرقم ورمز الدولة.'
      case 'already_registered':
        return 'لديك حساب مسجّل بالفعل. سجّل دخولك مباشرة.'
      default:
        return 'تعذّر إكمال التسجيل. حاول مجدداً.'
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!f.full_name.trim()) { setError('الاسم الكامل مطلوب'); return }
    if (!f.phone) { setError('رقم الهاتف مطلوب — هو ما يربطك بأبنائك'); return }
    if (!phoneValid) { setError('رقم الهاتف غير صالح — تحقّق من الرقم ورمز الدولة'); return }
    if (f.password.length < 8) { setError('كلمة المرور 8 أحرف على الأقل'); return }
    if (f.password !== f.confirm) { setError('كلمتا المرور غير متطابقتين'); return }

    setLoading(true)

    // 1) إنشاء الحساب — بلا metadata (لا school_name، حتى لا يُنشئ مدرسة)
    const { error: signUpErr } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.password,
    })
    if (signUpErr) {
      setError('تعذّر إنشاء الحساب. قد يكون البريد مسجلاً — جرّب تسجيل الدخول')
      setLoading(false)
      return
    }

    // 2) ربط ولي الأمر بأبنائه عبر الهاتف
    const fullCountry = f.country_code
    const { data, error: rpcErr } = await supabase.rpc('parent_signup_by_phone', {
      p_full_name: f.full_name,
      p_phone: f.phone,
      p_country_code: fullCountry,
    })

    if (rpcErr) {
      setError('تعذّر ربط حسابك: ' + rpcErr.message)
      setLoading(false)
      return
    }

    const res = (data ?? {}) as { ok?: boolean; reason?: string; children_linked?: number }
    if (!res.ok) {
      // الحساب أُنشئ لكن الربط فشل — نُعلم ولي الأمر بالسبب
      setError(reasonMessage(res.reason ?? ''))
      setLoading(false)
      return
    }

    // نجح — إلى بوابة ولي الأمر
    router.push('/parent')
    router.refresh()
  }

  const label: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#0F2744', marginBottom: 7 }
  const input: React.CSSProperties = { width: '100%', height: 47, padding: '0 44px 0 44px', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 14.5, fontFamily: 'inherit', outline: 'none' }

  return (
    <div className="pr-root" dir="rtl">
      <main className="pr-pane">
        <div className="pr-card">
          <div className="pr-brand">
            <Logo height={44} />
            <h2>حساب ولي الأمر</h2>
            <p>سجّل برقم هاتفك لمتابعة أبنائك ورسومهم</p>
          </div>

          <form onSubmit={handleRegister} className="pr-form" aria-label="تسجيل ولي الأمر">
            <div className="pr-note" role="note">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              </svg>
              <span>
                استخدم نفس الرقم الذي سجّلته مدرسة أبنائك في بياناتهم — به نربط حسابك بأبنائك تلقائياً.
              </span>
            </div>

            <label htmlFor="pr-name" style={label}>الاسم الكامل</label>
            <div className="pr-field">
              <svg className="pr-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M4 20a8 8 0 0116 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
              <input id="pr-name" style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} required placeholder="أحمد الكندي" />
            </div>

            <label style={label}>رقم الهاتف</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
              <select
                value={f.country_code}
                onChange={(e) => { set('country_code', e.target.value); set('phone', '') }}
                style={{ flex: '0 0 135px', height: 47, border: '1.5px solid #E2E8F0', borderRadius: 12, background: '#fff', fontFamily: 'inherit', fontSize: 14, padding: '0 8px', cursor: 'pointer' }}
              >
                {GULF_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} +{c.code}</option>
                ))}
              </select>
              <input
                style={{ ...input, padding: '0 14px', direction: 'ltr', textAlign: 'right', borderColor: f.phone && !phoneValid ? '#E0A3A3' : '#E2E8F0' }}
                value={f.phone} onChange={(e) => onPhone(e.target.value)}
                inputMode="numeric" placeholder="99123456" required
              />
            </div>
            {f.phone && !phoneValid && (
              <div style={{ color: '#C0392B', fontSize: 12, margin: '-8px 0 12px' }}>رقم غير مكتمل أو غير صالح لهذه الدولة</div>
            )}

            <label htmlFor="pr-email" style={label}>البريد الإلكتروني</label>
            <div className="pr-field">
              <svg className="pr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6l10 7L22 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="pr-email" type="email" style={input} value={f.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" placeholder="parent@email.com" dir="ltr" />
            </div>

            <label htmlFor="pr-pw" style={label}>كلمة المرور</label>
            <div className="pr-field">
              <svg className="pr-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="pr-pw" type={showPw ? 'text' : 'password'} style={input} value={f.password} onChange={(e) => set('password', e.target.value)} required autoComplete="new-password" placeholder="8 أحرف على الأقل" />
              <button type="button" className="pr-eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'إخفاء' : 'إظهار'}>
                {showPw
                  ? <svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.4 3.4M6.1 6.1A11 11 0 003 12c0 2.5 4 7 9 7a9.3 9.3 0 003.9-.8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                  : <svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
              </button>
            </div>

            <label htmlFor="pr-confirm" style={label}>تأكيد كلمة المرور</label>
            <div className="pr-field">
              <svg className="pr-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
              <input id="pr-confirm" type={showPw ? 'text' : 'password'} style={input} value={f.confirm} onChange={(e) => set('confirm', e.target.value)} required autoComplete="new-password" placeholder="أعد إدخال كلمة المرور" />
            </div>

            {error && <div className="pr-msg err" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="pr-btn">
              {loading ? <span className="pr-spin" /> : 'إنشاء الحساب وربط أبنائي'}
            </button>

            <div className="pr-foot">
              <span>لديك حساب؟ <Link href="/login">تسجيل الدخول</Link></span>
            </div>
          </form>
        </div>
      </main>

      <style jsx>{`
        .pr-root { min-height: 100dvh; display: grid; place-items: center; padding: 40px 20px;
          font-family: 'Cairo', system-ui, sans-serif;
          background: radial-gradient(1000px 600px at 80% 0%, #EEF4FB 0%, transparent 60%), linear-gradient(180deg, #FFF 0%, #F4F7FB 100%); }
        .pr-card { width: 100%; max-width: 460px; background: #fff; border: 1px solid #E7ECF3; border-radius: 26px;
          padding: 34px 32px 26px; box-shadow: 0 1px 2px rgba(15,39,68,.04), 0 16px 34px -14px rgba(15,39,68,.12), 0 40px 80px -40px rgba(15,39,68,.2);
          animation: rise .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes rise { from { opacity:0; transform: translateY(14px) } to { opacity:1; transform:none } }
        .pr-brand { text-align: center; margin-bottom: 22px; }
        .pr-brand h2 { margin: 16px 0 6px; font-size: 19px; font-weight: 800; color: #0F2744; }
        .pr-brand p { margin: 0; font-size: 13px; line-height: 1.7; color: #64748B; }
        .pr-note { display: flex; gap: 10px; background: #EFF5FE; border: 1px solid #D6E4FA; border-radius: 12px;
          padding: 12px 14px; margin-bottom: 20px; font-size: 12.5px; line-height: 1.8; color: #1E3A63; }
        .pr-note :global(svg) { flex: 0 0 auto; width: 18px; height: 18px; color: #1D4ED8; margin-top: 2px; }
        .pr-field { position: relative; display: flex; align-items: center; margin-bottom: 15px; }
        .pr-field :global(input:focus) { border-color: #1D4ED8 !important; box-shadow: 0 0 0 4px rgba(29,78,216,.1); }
        .pr-ic { position: absolute; right: 14px; width: 18px; height: 18px; color: #94A3B8; pointer-events: none; }
        .pr-eye { position: absolute; left: 12px; width: 30px; height: 30px; display: grid; place-items: center;
          background: none; border: 0; cursor: pointer; color: #94A3B8; border-radius: 8px; }
        .pr-eye:hover { color: #475569; background: #F1F5F9; }
        .pr-eye :global(svg) { width: 18px; height: 18px; }
        .pr-btn { width: 100%; height: 50px; margin-top: 6px; border: 0; border-radius: 12px;
          background: linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%); color: #fff; font-family: inherit;
          font-size: 15px; font-weight: 800; cursor: pointer; display: grid; place-items: center;
          box-shadow: 0 1px 2px rgba(15,39,68,.2), 0 10px 22px -10px rgba(29,78,216,.55); }
        .pr-btn:hover:not(:disabled) { filter: brightness(1.07); }
        .pr-btn:disabled { opacity: .62; cursor: default; }
        .pr-spin { width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,.35); border-top-color: #fff;
          border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg) } }
        .pr-msg { border-radius: 10px; padding: 11px 14px; font-size: 13px; font-weight: 600; line-height: 1.7; margin-bottom: 14px; }
        .pr-msg.err { background: #FEF2F2; border: 1px solid #FECACA; color: #B42318; }
        .pr-foot { text-align: center; margin-top: 18px; padding-top: 15px; border-top: 1px solid #EEF2F6; font-size: 13px; color: #64748B; }
        .pr-foot :global(a) { color: #1D4ED8; font-weight: 700; text-decoration: none; }
        .pr-foot :global(a:hover) { text-decoration: underline; }
        @media (max-width: 520px) { .pr-card { padding: 28px 22px 22px; border-radius: 22px; } }
        @media (prefers-reduced-motion: reduce) { .pr-card { animation: none; } }
      `}</style>
    </div>
  )
}
