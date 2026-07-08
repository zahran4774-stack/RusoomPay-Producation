'use client'
// ربط ولي أمر بطالب — يستخدمه الطاقم لربط حساب ولي أمر (مسجّل) بالطالب
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Student = { id: string; full_name: string; code: string }

export default function LinkParent({ students }: { students: Student[] }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function link() {
    if (!studentId || !email.trim()) { setMsg('اختر الطالب وأدخل بريد ولي الأمر'); return }
    setBusy(true); setMsg('')
    const { data, error } = await supabase.rpc('link_parent_by_email', {
      p_email: email.trim(), p_student_id: studentId,
    })
    if (error) { setMsg('تعذّر الربط: ' + error.message); setBusy(false); return }
    setMsg(`✓ تم ربط ${data} بالطالب بنجاح`); setEmail(''); setStudentId(''); setBusy(false)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: 11, borderRadius: 10, border: '1.5px solid #DDE3EC',
    fontFamily: 'inherit', fontSize: 14, marginBottom: 10,
  }

  return (
    <div style={{ marginBottom: 16 }} dir="rtl">
      <button onClick={() => setOpen(!open)} style={{
        background: '#fff', color: '#0F2744', border: '1.5px solid #DDE3EC', borderRadius: 10,
        padding: '9px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        👨‍👩‍👧 {open ? 'إخفاء' : 'ربط ولي أمر بطالب'}
      </button>
      {open && (
        <div style={{ background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14, padding: 18, marginTop: 10, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
          <p style={{ fontSize: 13, color: '#667', margin: '0 0 14px' }}>
            ربط حساب ولي أمر <b>مسجّل مسبقاً</b> بطالب. إن لم يكن لديه حساب، اطلب منه التسجيل بدور "ولي أمر" أولاً.
          </p>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>الطالب</label>
          <select style={input} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">اختر الطالب</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.full_name}</option>)}
          </select>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#445', display: 'block', marginBottom: 6 }}>بريد ولي الأمر</label>
          <input style={input} type="email" dir="ltr" placeholder="parent@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {msg && <div style={{ fontSize: 13, marginBottom: 10, color: msg.startsWith('✓') ? '#1A7A45' : '#C0392B' }}>{msg}</div>}
          <button onClick={link} disabled={busy} style={{
            background: '#D4A017', color: '#08172B', border: 'none', borderRadius: 10,
            padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>{busy ? 'جارٍ الربط...' : 'ربط'}</button>
        </div>
      )}
    </div>
  )
}
