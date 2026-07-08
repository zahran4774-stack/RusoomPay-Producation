'use client'
// تسجيل ولي أمر — يختار المدرسة، يُنشئ حسابه بدور parent، ثم يربطه الطاقم بأبنائه
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

type School = { id: string; name: string }

export default function ParentRegisterPage() {
  const supabase = createClient()
  const router = useRouter()
  const [schools, setSchools] = useState<School[]>([])
  const [f, setF] = useState({ schoolId: '', fullName: '', phone: '', email: '', password: '', password2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [phoneAlert, setPhoneAlert] = useState(false)

  useEffect(() => {
    supabase.rpc('public_schools').then(({ data }) => setSchools(data || []))
  }, [supabase])

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.schoolId) return setError('اختر المدرسة')
    if (f.password.length < 8) return setError('كلمة المرور 8 أحرف على الأقل')
    if (f.password !== f.password2) return setError('كلمتا المرور غير متطابقتين')
    setLoading(true)

    const { data, error: signErr } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { data: { role: 'parent', full_name: f.fullName, school_id: f.schoolId, phone: f.phone } },
    })
    if (signErr) { setError('تعذّر التسجيل: ' + signErr.message); setLoading(false); return }
    if (!data.user) { setError('تعذّر إنشاء الحساب'); setLoading(false); return }

    // إنشاء ملف ولي الأمر
    const { error: pErr } = await supabase.rpc('create_parent_profile', {
      p_school_id: f.schoolId, p_full_name: f.fullName, p_phone: f.phone,
    })
    if (pErr) { setError('تعذّر إكمال الملف: ' + pErr.message); setLoading(false); return }

    router.push('/parent')
    router.refresh()
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid #DDE3EC',
    fontFamily: 'inherit', fontSize: 14, marginBottom: 12,
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F4F6FA', padding: 20 }} dir="rtl">
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
        <h1 style={{ color: '#0F2744', fontSize: 22, margin: '0 0 4px' }}>تسجيل ولي أمر</h1>
        <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 20px' }}>أنشئ حسابك لمتابعة رسوم أبنائك والدفع إلكترونياً</p>
        <form onSubmit={handleRegister}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>المدرسة</label>
          <select style={inp} value={f.schoolId} onChange={(e) => set('schoolId', e.target.value)} required>
            <option value="">اختر مدرسة أبنائك</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ fontSize: 13, fontWeight: 600 }}>الاسم الكامل</label>
          <input style={inp} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} required />
          <label style={{ fontSize: 13, fontWeight: 600 }}>رقم الهاتف</label>
          <input style={inp} value={f.phone} onChange={(e) => { const c = e.target.value.replace(/[^0-9]/g, ''); set('phone', c); setPhoneAlert(c !== e.target.value) }} inputMode="numeric" />
          {phoneAlert && <div style={{ color: '#C0392B', fontSize: 12, marginTop: 4 }}>⚠️ يُسمح بإدخال أرقام فقط</div>}
          <label style={{ fontSize: 13, fontWeight: 600 }}>البريد الإلكتروني</label>
          <input style={inp} type="email" dir="ltr" value={f.email} onChange={(e) => set('email', e.target.value)} required />
          <label style={{ fontSize: 13, fontWeight: 600 }}>كلمة المرور</label>
          <input style={inp} type="password" value={f.password} onChange={(e) => set('password', e.target.value)} required />
          <label style={{ fontSize: 13, fontWeight: 600 }}>تأكيد كلمة المرور</label>
          <input style={inp} type="password" value={f.password2} onChange={(e) => set('password2', e.target.value)} required />
          {error && <div style={{ color: '#C0392B', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: 13, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: '#D4A017', color: '#08172B', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
          }}>{loading ? 'جارٍ التسجيل...' : 'إنشاء الحساب'}</button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 13, color: '#667', marginTop: 16 }}>
          لديك حساب؟ <Link href="/login" style={{ color: '#1E5C4E', fontWeight: 600 }}>تسجيل الدخول</Link>
        </p>
        <p style={{ fontSize: 12, color: '#9AA7B8', marginTop: 10, lineHeight: 1.7 }}>
          💡 بعد التسجيل، تواصل مع مدرستك لربط حسابك بأبنائك حتى تظهر رسومهم.
        </p>
      </div>
    </div>
  )
}
