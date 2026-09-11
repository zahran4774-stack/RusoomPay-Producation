'use client'
// app/(app)/settings/ChangePassword.tsx
// تغيير كلمة المرور من داخل الحساب — بلا حاجة لتسجيل خروج أو رابط بريد.
// يستخدم supabase.auth.updateUser() القياسية لجلسة نشطة.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const C = { navy: '#0F2744', petrol: '#1E5C4E', gold: '#D4A017', danger: '#C0392B', line: '#DDE3EC' }

export default function ChangePassword() {
  const supabase = createClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)

  async function submit() {
    setMsg('')
    if (!current) { setMsg('أدخل كلمة المرور الحالية'); return }
    if (next.length < 8) { setMsg('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف'); return }
    if (next !== confirm) { setMsg('كلمة المرور الجديدة غير متطابقة مع التأكيد'); return }
    if (next === current) { setMsg('كلمة المرور الجديدة يجب أن تختلف عن الحالية'); return }

    setLoading(true)

    // تحقّق من كلمة المرور الحالية — Supabase لا يتطلبها لـupdateUser، لكن نتحقق
    // منها يدوياً بإعادة تسجيل دخول صامت بنفس البريد، لمنع تغيير كلمة المرور
    // من جلسة مسروقة/متروكة مفتوحة دون علم صاحب الحساب.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setLoading(false); setMsg('تعذّر التحقق من الحساب'); return }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email, password: current,
    })
    if (verifyError) {
      setLoading(false)
      setMsg('كلمة المرور الحالية غير صحيحة')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: next })
    setLoading(false)
    if (error) { setMsg('تعذّر تغيير كلمة المرور: ' + error.message); return }

    setMsg('✓ تم تغيير كلمة المرور بنجاح')
    setCurrent(''); setNext(''); setConfirm('')
    setTimeout(() => { setOpen(false); setMsg('') }, 1800)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: 11, borderRadius: 10, border: `1.5px solid ${C.line}`,
    fontFamily: 'inherit', fontSize: 14, marginBottom: 12,
  }
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.navy, display: 'block', marginBottom: 6 }

  return (
    <div style={{ maxWidth: 480, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 16, padding: 24, marginBottom: 18 }} dir="rtl">
      <h3 style={{ color: C.navy, marginBottom: 6 }}>كلمة المرور</h3>
      <p style={{ color: '#667', fontSize: 14, marginBottom: 18 }}>
        غيّر كلمة مرورك في أي وقت تراه مناسباً، دون الحاجة لتسجيل الخروج أو رابط بريد.
      </p>

      {!open ? (
        <button onClick={() => setOpen(true)}
          style={{ background: C.navy, color: '#fff', border: 'none', borderRadius: 11, padding: '12px 22px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          تغيير كلمة المرور
        </button>
      ) : (
        <div>
          <label style={label}>كلمة المرور الحالية</label>
          <input type="password" style={input} value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" />

          <label style={label}>كلمة المرور الجديدة</label>
          <input type="password" style={input} value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" placeholder="8 أحرف على الأقل" />

          <label style={label}>تأكيد كلمة المرور الجديدة</label>
          <input type="password" style={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />

          {msg && (
            <p style={{ fontSize: 13.5, fontWeight: 600, color: msg.startsWith('✓') ? C.petrol : C.danger, marginBottom: 12 }}>
              {msg}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={submit} disabled={loading}
              style={{ flex: 1, background: C.gold, color: C.navy, border: 'none', borderRadius: 11, padding: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}
            </button>
            <button onClick={() => { setOpen(false); setCurrent(''); setNext(''); setConfirm(''); setMsg('') }} disabled={loading}
              style={{ background: '#F2F5F8', color: C.navy, border: 'none', borderRadius: 11, padding: '13px 18px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
