'use client'
// تسجيل مدرسة جديدة — ينشئ مستخدم Auth ثم يستدعي دالة الخادم register_school
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const COUNTRY_CUR: Record<string, { cur: string; label: string }> = {
  OM: { cur: 'OMR', label: 'ريال عُماني' }, SA: { cur: 'SAR', label: 'ريال سعودي' },
  AE: { cur: 'AED', label: 'درهم إماراتي' }, QA: { cur: 'QAR', label: 'ريال قطري' },
  KW: { cur: 'KWD', label: 'دينار كويتي' }, BH: { cur: 'BHD', label: 'دينار بحريني' },
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({
    name: '', branch: '', country: 'OM', cr: '', license: '', vat: '',
    phone: '', email: '', address: '', iban: '', ownerName: '', password: '', password2: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [crAlert, setCrAlert] = useState(false)
  // الدول المفعّلة من مالك المنصّة (افتراضياً عُمان حتى تُحمّل القائمة)
  const [allowed, setAllowed] = useState<string[]>(['OM'])
  useEffect(() => {
    supabase.from('platform_countries').select('code').eq('enabled', true).then(({ data }) => {
      if (data && data.length) setAllowed(data.map((c: { code: string }) => c.code))
    })
  }, [])
  const set = (k: string, v: string) => setF({ ...f, [k]: v })

  // سياسة كلمة مرور قوية
  function passwordIssue(pw: string): string | null {
    if (pw.length < 10) return 'كلمة المرور 10 أحرف على الأقل'
    if (!/[A-Za-z]/.test(pw)) return 'يجب أن تحتوي على حرف'
    if (!/[0-9]/.test(pw)) return 'يجب أن تحتوي على رقم'
    if (!/[^A-Za-z0-9]/.test(pw)) return 'يجب أن تحتوي على رمز (مثل ! @ #)'
    const common = ['password', '12345678', 'qwerty', 'admin123', '11111111']
    if (common.some((c) => pw.toLowerCase().includes(c))) return 'كلمة المرور شائعة جداً — اختر أقوى'
    return null
  }

  // التحقق من رقم الحساب البنكي (IBAN) — الصيغة والطول حسب الدولة
  const IBAN_LEN: Record<string, number> = { OM: 23, SA: 24, AE: 23, QA: 29, KW: 30, BH: 22 }
  function ibanIssue(iban: string, country: string): string | null {
    const v = iban.replace(/\s/g, '').toUpperCase()
    if (!v) return null // اختياري
    const expected = IBAN_LEN[country] || 23
    if (!/^[A-Z]{2}[0-9A-Z]+$/.test(v)) return 'رقم الحساب البنكي (IBAN) غير صحيح'
    if (!v.startsWith(country)) return `يجب أن يبدأ الحساب البنكي برمز دولتك (${country})`
    if (v.length !== expected) return `طول الحساب البنكي غير صحيح (${v.length} من ${expected} خانة)`
    return null
  }

  // تنسيق IBAN لحظياً: تنظيف + منع تجاوز طول الدولة + مجموعات من 4
  function formatIbanInput(raw: string, country: string): string {
    const expected = IBAN_LEN[country] || 23
    let v = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, expected)
    return v.replace(/(.{4})/g, '$1 ').trim()
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const pwIssue = passwordIssue(f.password)
    if (pwIssue) return setError(pwIssue)
    if (f.password !== f.password2) return setError('كلمتا المرور غير متطابقتين')
    const ibIssue = ibanIssue(f.iban, f.country)
    if (ibIssue) return setError(ibIssue)
    setLoading(true)

    // 1) إنشاء المستخدم مع طلب تأكيد البريد + بيانات المدرسة في الميتاداتا
    //    (لا تُنشأ المدرسة الآن — تُنشأ بعد تأكيد البريد وأول دخول)
    const { data, error: authErr } = await supabase.auth.signUp({
      email: f.email,
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        // captchaToken: hcaptchaToken, // فعّله بعد ربط hCaptcha (انظر الدليل)
        data: {
          school_name: f.name, branch: f.branch, country: f.country,
          currency: COUNTRY_CUR[f.country].cur, cr: f.cr, license: f.license,
          vat: f.vat, phone: f.phone, address: f.address, owner_name: f.ownerName,
          bank_iban: f.iban.replace(/\s/g, '').toUpperCase(),
        },
      },
    })
    if (authErr) { setError('تعذّر إنشاء الحساب: ' + authErr.message); setLoading(false); return }

    // إن كان تأكيد البريد مفعّلاً، لا توجد جلسة بعد → اعرض شاشة "أكّد بريدك"
    if (data.user && !data.session) {
      setLoading(false)
      setSent(true)
      return
    }

    // إن كان التأكيد معطّلاً (تطوير): أنشئ المدرسة مباشرة
    await createSchool()
  }

  async function createSchool() {
    const { error: rpcErr } = await supabase.rpc('register_school', {
      p_name: f.name, p_branch: f.branch, p_country: f.country,
      p_currency: COUNTRY_CUR[f.country].cur, p_cr: f.cr, p_license: f.license,
      p_vat: f.vat, p_phone: f.phone, p_email: f.email, p_address: f.address,
      p_owner_name: f.ownerName, p_bank_iban: f.iban.replace(/\s/g, '').toUpperCase(),
    })
    if (rpcErr) { setError('تعذّر تسجيل المدرسة: ' + rpcErr.message); setLoading(false); return }
    router.push('/subscription')
    router.refresh()
  }

  const inp = { width: '100%', padding: 11, margin: '5px 0 12px', borderRadius: 10, border: '1.5px solid #DDE3EC' }

  if (sent) {
    return (
      <div style={{ minHeight: '100dvh', background: '#F4F6FA', display: 'grid', placeItems: 'center', padding: 24 }} dir="rtl">
        <div style={{ background: '#fff', padding: 32, borderRadius: 18, maxWidth: 460, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
          <h1 style={{ color: '#0F2744', marginBottom: 10, fontSize: 22 }}>أكّد بريدك الإلكتروني</h1>
          <p style={{ color: '#556', fontSize: 14, lineHeight: 1.9 }}>
            أرسلنا رابط تأكيد إلى <b>{f.email}</b>. افتح الرابط لتفعيل حسابك، ثم سجّل الدخول لإكمال تسجيل مدرستك.
          </p>
          <p style={{ color: '#889', fontSize: 12, marginTop: 14 }}>
            لم يصلك البريد؟ تحقّق من مجلد الرسائل غير المرغوبة (Spam).
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: 18, background: '#163B68', color: '#fff', padding: '11px 24px', borderRadius: 11, textDecoration: 'none', fontWeight: 700 }}>
            الذهاب لتسجيل الدخول
          </a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F6FA', padding: 24 }} dir="rtl">
      <form onSubmit={handleRegister} style={{ background: '#fff', padding: 28, borderRadius: 18, maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ color: '#0F2744', marginBottom: 18 }}>تسجيل مدرسة جديدة</h1>

        <label style={{ fontSize: 13, fontWeight: 600 }}>اسم المدرسة *</label>
        <input value={f.name} onChange={(e) => set('name', e.target.value)} required style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>الفرع (اختياري)</label>
        <input value={f.branch} onChange={(e) => set('branch', e.target.value)} style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>الدولة *</label>
        <select value={f.country} onChange={(e) => { const c = e.target.value; setF((p) => ({ ...p, country: c, iban: formatIbanInput(p.iban, c) })) }} style={inp}>
          {Object.entries(COUNTRY_CUR).filter(([k]) => allowed.includes(k)).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.cur})</option>)}
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>السجل التجاري *</label>
        <input value={f.cr} onChange={(e) => { const c = e.target.value.replace(/[^0-9]/g, ''); set('cr', c); setCrAlert(c !== e.target.value) }} required inputMode="numeric" style={inp} />
        {crAlert && <div style={{ color: '#C0392B', fontSize: 12, marginTop: 4 }}>⚠️ يُسمح بإدخال أرقام فقط</div>}

        <label style={{ fontSize: 13, fontWeight: 600 }}>اسم المدير *</label>
        <input value={f.ownerName} onChange={(e) => set('ownerName', e.target.value)} required style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>رقم الحساب البنكي (IBAN) لاستلام المدفوعات</label>
        <input value={f.iban} onChange={(e) => set('iban', formatIbanInput(e.target.value, f.country))}
          dir="ltr" placeholder="OM.. .... .... .... .... .." maxLength={37}
          style={{ ...inp, direction: 'ltr', textAlign: 'left', letterSpacing: '.5px', marginBottom: 4 }} />
        <div style={{ fontSize: 12, color: ibanIssue(f.iban, f.country) ? '#C0392B' : (f.iban ? '#1A7A45' : '#8A94A6'), lineHeight: 1.7, marginBottom: 12 }}>
          {f.iban
            ? (ibanIssue(f.iban, f.country) || '✅ الرقم مكتمل الصيغة — تأكّد أنه مطابق لكشف حسابك البنكي')
            : '⚠️ تأكّد من صحة الرقم بدقة — يُربط بعمليات الدفع وتُحوّل إليه رسوم أولياء الأمور. أي خطأ يعني تحويل الأموال لحساب غير صحيح.'}
        </div>

        <label style={{ fontSize: 13, fontWeight: 600 }}>البريد الإلكتروني *</label>
        <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>كلمة المرور *</label>
        <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} required style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>تأكيد كلمة المرور *</label>
        <input type="password" value={f.password2} onChange={(e) => set('password2', e.target.value)} required style={inp} />

        {error && <div style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'جارٍ التسجيل…' : 'تسجيل المدرسة'}
        </button>
      </form>
    </div>
  )
}
