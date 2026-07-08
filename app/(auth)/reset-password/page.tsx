'use client'
// صفحة تعيين كلمة مرور جديدة — يصلها المستخدم عبر رابط البريد
// Supabase ينشئ جلسة مؤقتة عند فتح الرابط، فنحدّث كلمة المرور مباشرة
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

// سياسة كلمة المرور (مطابقة لصفحة التسجيل)
function passwordIssue(pw: string): string | null {
  if (pw.length < 10) return 'كلمة المرور 10 أحرف على الأقل'
  if (!/[A-Za-z]/.test(pw)) return 'يجب أن تحتوي على حرف'
  if (!/[0-9]/.test(pw)) return 'يجب أن تحتوي على رقم'
  if (!/[^A-Za-z0-9]/.test(pw)) return 'يجب أن تحتوي على رمز (مثل ! @ #)'
  const common = ['password', '12345678', 'qwerty', 'admin123', '11111111']
  if (common.some((c) => pw.toLowerCase().includes(c))) return 'كلمة المرور شائعة جداً — اختر أقوى'
  return null
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const issue = passwordIssue(pw)
    if (issue) return setError(issue)
    if (pw !== pw2) return setError('كلمتا المرور غير متطابقتين')
    setLoading(true)

    // الجلسة المؤقتة من رابط البريد تسمح بتحديث كلمة المرور
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setLoading(false)
    if (err) { setError('تعذّر تعيين كلمة المرور. قد يكون الرابط منتهياً — اطلب رابطاً جديداً.'); return }
    setDone(true)
    setTimeout(() => { router.push('/login'); router.refresh() }, 2000)
  }

  const inp = { width: '100%', padding: 12, margin: '6px 0 16px', borderRadius: 10, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 15 }

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
            <p style={{ color: '#667', fontSize: 13.5, marginBottom: 22 }}>اختر كلمة مرور قوية لحسابك.</p>

            <label style={{ fontSize: 13, fontWeight: 600 }}>كلمة المرور الجديدة</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inp} />

            <label style={{ fontSize: 13, fontWeight: 600 }}>تأكيد كلمة المرور</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inp} />

            {error && <div style={{ background: '#FCE9E6', color: '#C0392B', padding: 10, borderRadius: 9, fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <button onClick={submit} disabled={loading}
              style={{ width: '100%', padding: 13, background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
              {loading ? 'جارٍ الحفظ…' : 'تعيين كلمة المرور'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
