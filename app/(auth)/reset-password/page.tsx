'use client'
// صفحة تعيين كلمة مرور جديدة — يصلها المستخدم عبر رابط البريد
// Supabase ينشئ جلسة مؤقتة عند فتح الرابط، فنحدّث كلمة المرور مباشرة
//
// ⚠️ إصلاح: كانت سياسة كلمة المرور (10 أحرف + حرف + رقم + رمز) تُرفض بصمت —
// رسالة خطأ عامة واحدة أسفل الزر لا تُبيّن أي شرط بالضبط ناقص، فكان المستخدم
// يظن أنه غيّر كلمة المرور فعلاً (خصوصاً لو لم يلحظ رسالة الخطأ) بينما الطلب
// لم يصل لسيرفر Supabase إطلاقاً. الآن: قائمة شروط حيّة (✓/✗) تحت الحقل،
// وزر الحفظ يبقى معطّلاً حتى تتحقق كل الشروط + تطابق كلمتي المرور.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Check = { id: string; label: string; test: (pw: string) => boolean }

const COMMON = ['password', '12345678', 'qwerty', 'admin123', '11111111']

const CHECKS: Check[] = [
  { id: 'len', label: '10 أحرف على الأقل', test: (pw) => pw.length >= 10 },
  { id: 'letter', label: 'يحتوي على حرف', test: (pw) => /[A-Za-z]/.test(pw) },
  { id: 'digit', label: 'يحتوي على رقم', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'يحتوي على رمز (مثل ! @ #)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { id: 'common', label: 'ليست كلمة مرور شائعة', test: (pw) => pw.length === 0 || !COMMON.some((c) => pw.toLowerCase().includes(c)) },
]

function passwordIssue(pw: string): string | null {
  const failed = CHECKS.find((c) => !c.test(pw))
  return failed ? failed.label : null
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const allValid = CHECKS.every((c) => c.test(pw))
  const matches = pw.length > 0 && pw === pw2
  const canSubmit = allValid && matches && !loading

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setTouched(true)
    const issue = passwordIssue(pw)
    if (issue) return setError('كلمة المرور لا تحقّق الشرط: ' + issue)
    if (pw !== pw2) return setError('كلمتا المرور غير متطابقتين')
    setLoading(true)

    // الجلسة المؤقتة من رابط البريد تسمح بتحديث كلمة المرور
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setLoading(false)
    if (err) { setError('تعذّر تعيين كلمة المرور. قد يكون الرابط منتهياً — اطلب رابطاً جديداً.'); return }
    setDone(true)
    setTimeout(() => { router.push('/login'); router.refresh() }, 2000)
  }

  const inp = { width: '100%', padding: 12, margin: '6px 0 10px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 15 }

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F4F6FA', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 'min(92vw, 400px)', boxShadow: '0 10px 40px rgba(15,39,68,.08)' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
            <h2 style={{ color: '#1A7A45', fontSize: 20, marginBottom: 8 }}>تم تعيين كلمة المرور</h2>
            <p style={{ color: '#667', fontSize: 14 }}>جارٍ تحويلك لتسجيل الدخول…</p>
          </div>
        ) : (
          <>
            <h1 style={{ color: '#0F2744', fontSize: 22, marginBottom: 6 }}>كلمة مرور جديدة</h1>
            <p style={{ color: '#667', fontSize: 13.5, marginBottom: 18 }}>اختر كلمة مرور قوية لحسابك.</p>

            <label style={{ fontSize: 13, fontWeight: 600 }}>كلمة المرور الجديدة</label>
            <input
              type="password" value={pw}
              onChange={(e) => { setPw(e.target.value); setTouched(true) }}
              style={inp} autoFocus
            />

            {/* قائمة الشروط الحيّة — كل شرط يتحوّل أخضر فور تحقّقه */}
            <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 16px', display: 'grid', gap: 5 }}>
              {CHECKS.map((c) => {
                const ok = touched && c.test(pw)
                const shown = touched && pw.length > 0
                return (
                  <li key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                    color: !shown ? '#8A94A6' : ok ? '#1A7A45' : '#B42318',
                  }}>
                    <span style={{
                      display: 'inline-grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%',
                      fontSize: 10, fontWeight: 800, flex: '0 0 auto',
                      background: !shown ? '#E7EBF1' : ok ? '#DFF5E6' : '#FCE9E6',
                      color: !shown ? '#9AA5B5' : ok ? '#1A7A45' : '#C0392B',
                    }}>
                      {shown ? (ok ? '✓' : '✕') : '•'}
                    </span>
                    {c.label}
                  </li>
                )
              })}
            </ul>

            <label style={{ fontSize: 13, fontWeight: 600 }}>تأكيد كلمة المرور</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inp} />
            {pw2.length > 0 && !matches && (
              <div style={{ fontSize: 12, color: '#B42318', marginBottom: 8 }}>كلمتا المرور غير متطابقتين</div>
            )}

            {error && <div style={{ background: '#FCE9E6', color: '#C0392B', padding: 10, borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <button onClick={submit} disabled={!canSubmit}
              style={{
                width: '100%', padding: 13, color: '#fff', border: 'none', borderRadius: 11,
                fontWeight: 700, fontSize: 15, marginTop: 4,
                background: canSubmit ? '#163B68' : '#9AA5B5',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}>
              {loading ? 'جارٍ الحفظ…' : 'تعيين كلمة المرور'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
