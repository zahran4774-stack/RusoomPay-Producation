'use client'
// app/(app)/settings/ChangePassword.tsx
// تغيير كلمة المرور من داخل الحساب — بلا حاجة لتسجيل خروج أو رابط بريد.
// يستخدم supabase.auth.updateUser() القياسية لجلسة نشطة.
//
// ⚠️ إصلاح: كانت السياسة هنا "8 أحرف فقط" بينما صفحة استعادة كلمة المرور
// (/reset-password) تشترط 10 أحرف + حرف + رقم + رمز — تناقض بين صفحتين لنفس
// الحساب. الآن نفس السياسة بالضبط + نفس قائمة الشروط الحيّة (✓/✕)، والزر
// معطّل حتى تتحقق كل الشروط، لمنع نفس نمط "أظن أني غيّرتها وما تغيّرت".
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const C = { navy: '#0F2744', petrol: '#1E5C4E', gold: '#D4A017', danger: '#C0392B', line: '#DDE3EC' }

type Check = { id: string; label: string; test: (pw: string) => boolean }

const COMMON = ['password', '12345678', 'qwerty', 'admin123', '11111111']

const CHECKS: Check[] = [
  { id: 'len', label: '10 أحرف على الأقل', test: (pw) => pw.length >= 10 },
  { id: 'letter', label: 'يحتوي على حرف', test: (pw) => /[A-Za-z]/.test(pw) },
  { id: 'digit', label: 'يحتوي على رقم', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'يحتوي على رمز (مثل ! @ #)', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
  { id: 'common', label: 'ليست كلمة مرور شائعة', test: (pw) => pw.length === 0 || !COMMON.some((c) => pw.toLowerCase().includes(c)) },
]

export default function ChangePassword() {
  const supabase = createClient()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)

  const allValid = CHECKS.every((c) => c.test(next))
  const matches = next.length > 0 && next === confirm
  const canSubmit = allValid && matches && current.length > 0 && next !== current && !loading

  async function submit() {
    setMsg('')
    setTouched(true)
    if (!current) { setMsg('أدخل كلمة المرور الحالية'); return }
    const failed = CHECKS.find((c) => !c.test(next))
    if (failed) { setMsg('كلمة المرور الجديدة لا تحقّق الشرط: ' + failed.label); return }
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
    setCurrent(''); setNext(''); setConfirm(''); setTouched(false)
    setTimeout(() => { setOpen(false); setMsg('') }, 1800)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: 11, borderRadius: 10, border: `1.5px solid ${C.line}`,
    fontFamily: 'inherit', fontSize: 14, marginBottom: 10,
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
          <input
            type="password" style={input} value={next}
            onChange={(e) => { setNext(e.target.value); setTouched(true) }}
            dir="ltr" placeholder="10 أحرف على الأقل"
          />

          {/* قائمة الشروط الحيّة — نفس منطق صفحة /reset-password بالضبط */}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'grid', gap: 5 }}>
            {CHECKS.map((c) => {
              const ok = touched && c.test(next)
              const shown = touched && next.length > 0
              return (
                <li key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                  color: !shown ? '#8A94A6' : ok ? C.petrol : C.danger,
                }}>
                  <span style={{
                    display: 'inline-grid', placeItems: 'center', width: 16, height: 16, borderRadius: '50%',
                    fontSize: 10, fontWeight: 800, flex: '0 0 auto',
                    background: !shown ? '#E7EBF1' : ok ? '#DFF5E6' : '#FCE9E6',
                    color: !shown ? '#9AA5B5' : ok ? C.petrol : C.danger,
                  }}>
                    {shown ? (ok ? '✓' : '✕') : '•'}
                  </span>
                  {c.label}
                </li>
              )
            })}
          </ul>

          <label style={label}>تأكيد كلمة المرور الجديدة</label>
          <input type="password" style={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
          {confirm.length > 0 && !matches && (
            <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>كلمتا المرور غير متطابقتين</div>
          )}

          {msg && (
            <p style={{ fontSize: 13.5, fontWeight: 600, color: msg.startsWith('✓') ? C.petrol : C.danger, marginBottom: 12 }}>
              {msg}
            </p>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={submit} disabled={!canSubmit}
              style={{
                flex: 1, color: C.navy, border: 'none', borderRadius: 11, padding: 13, fontWeight: 700,
                fontFamily: 'inherit',
                background: canSubmit ? C.gold : '#E7EBF1',
                color: canSubmit ? C.navy : '#9AA5B5',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}>
              {loading ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور الجديدة'}
            </button>
            <button onClick={() => { setOpen(false); setCurrent(''); setNext(''); setConfirm(''); setMsg(''); setTouched(false) }} disabled={loading}
              style={{ background: '#F2F5F8', color: C.navy, border: 'none', borderRadius: 11, padding: '13px 18px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
