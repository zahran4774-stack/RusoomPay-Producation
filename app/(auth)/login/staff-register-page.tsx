'use client'
// تسجيل موظف مدعوّ — لا يختار مدرسة؛ الدعوة (ببريده) تحدّد مدرسته ودوره تلقائياً
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

export default function StaffRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [f, setF] = useState({ fullName: '', email: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.fullName.trim()) return setError('الاسم مطلوب')
    if (f.password.length < 8) return setError('كلمة المرور 8 أحرف على الأقل')
    if (f.password !== f.password2) return setError('كلمتا المرور غير متطابقتين')
    setLoading(true)

    const { data, error: signErr } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.password,
      options: { data: { full_name: f.fullName } },
    })
    if (signErr) { setError('تعذّر التسجيل: ' + signErr.message); setLoading(false); return }
    if (!data.user) { setError('تعذّر إنشاء الحساب'); setLoading(false); return }

    // ربط الدعوة — تحدّد المدرسة والدور
    const { data: res, error: invErr } = await supabase.rpc('accept_staff_invite')
    if (invErr) { setError('تعذّر ربط الدعوة: ' + invErr.message); setLoading(false); return }

    const ok = (res as { ok?: boolean } | null)?.ok
    if (!ok) {
      setLoading(false)
      setError('لا توجد دعوة بهذا البريد. تأكّد أن مدير مدرستك دعاك بنفس البريد الذي أدخلته.')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inp: React.CSSProperties = {
    width: '100%', height: 46, padding: '0 14px', borderRadius: 11,
    border: '1.5px solid #E2E7EE', fontSize: 14.5, fontFamily: 'inherit',
    background: '#fff', outline: 'none',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 6,
  }

  return (
    <div dir="rtl" style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(180deg,#F7F9FC 0%,#EEF2F7 100%)', padding: 20,
      fontFamily: 'Cairo, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '34px 30px',
        width: '100%', maxWidth: 430,
        boxShadow: '0 24px 60px -24px rgba(15,39,68,.22)', border: '1px solid #EBEFF5',
      }}>
        <h1 style={{ color: '#0F2744', fontSize: '1.4rem', margin: '0 0 6px', textAlign: 'center' }}>
          تسجيل حساب موظف
        </h1>
        <p style={{ color: '#667', fontSize: 13.5, textAlign: 'center', margin: '0 0 8px', lineHeight: 1.8 }}>
          سجّل بنفس البريد الذي دعاك به مدير المدرسة
        </p>

        <div style={{
          background: '#F7FAFC', border: '1px solid #E3E8EE', borderRadius: 11,
          padding: '12px 14px', margin: '0 0 20px', fontSize: 12.5, color: '#667', lineHeight: 1.9,
        }}>
          سترتبط بمدرستك ودورك تلقائياً. إن لم تُدعَ بعد، اطلب من المدير دعوتك أولاً.
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>الاسم الكامل</label>
            <input style={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)}
              placeholder="سالم محمد البلوشي" required />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>البريد الإلكتروني (نفس بريد الدعوة)</label>
            <input type="email" style={inp} value={f.email} onChange={(e) => set('email', e.target.value)}
              placeholder="staff@email.com" dir="ltr" required />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>كلمة المرور</label>
            <input type="password" style={inp} value={f.password} onChange={(e) => set('password', e.target.value)}
              placeholder="٨ أحرف على الأقل" dir="ltr" required />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={lbl}>تأكيد كلمة المرور</label>
            <input type="password" style={inp} value={f.password2} onChange={(e) => set('password2', e.target.value)}
              dir="ltr" required />
          </div>

          {error && (
            <div style={{
              background: '#FDF3F2', border: '1px solid #F6D5D1', color: '#B42318',
              borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600,
              marginBottom: 16, lineHeight: 1.7,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', height: 48, background: loading ? '#8FA0B5' : '#163B68',
            color: '#fff', border: 0, borderRadius: 12, fontWeight: 800, fontSize: 15.5,
            cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>
            {loading ? 'جارٍ التسجيل…' : 'إنشاء الحساب'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13.5, color: '#667' }}>
          لديك حساب؟{' '}
          <Link href="/login" style={{ color: '#163B68', fontWeight: 700, textDecoration: 'none' }}>
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  )
}
