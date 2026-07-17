'use client'
// ربط ولي الأمر بطالب — بالهاتف (يتّسق مع نظام التسجيل التلقائي)
// الطاقم يختار طالباً، والنظام يبحث عن ولي أمر مسجّل بنفس رقم هاتف الطالب.
// أداة احتياطية: تُستخدم لو سجّل ولي الأمر قبل إضافة الطالب،
// فيدوياً يعيد الطاقم تشغيل الربط.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Student = { id: string; full_name: string; code: string }

export default function LinkParent({ students }: { students: Student[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  async function link() {
    if (!studentId) { setMsg({ ok: false, text: 'اختر الطالب أولاً' }); return }
    setLoading(true); setMsg(null)

    const { data, error } = await supabase.rpc('link_parent_by_student', {
      p_student_id: studentId,
    })
    setLoading(false)

    if (error) { setMsg({ ok: false, text: error.message }); return }

    const res = (data ?? {}) as { ok?: boolean; reason?: string; phone?: string }
    if (res.ok) {
      setMsg({ ok: true, text: '✓ تم ربط ولي الأمر بالطالب بنجاح' })
      setStudentId('')
      router.refresh()
    } else if (res.reason === 'no_parent_account') {
      setMsg({
        ok: false,
        text: `لا يوجد حساب ولي أمر مسجّل بالرقم ${res.phone ?? ''}. اطلب من ولي الأمر التسجيل بنفس الرقم أولاً عبر صفحة "حساب ولي أمر".`,
      })
    } else if (res.reason === 'student_not_found_or_no_phone') {
      setMsg({ ok: false, text: 'الطالب غير موجود أو لا يحمل رقم ولي أمر.' })
    } else {
      setMsg({ ok: false, text: 'تعذّر الربط. حاول مجدداً.' })
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#F2F5F8', color: '#0F2744', border: '1px solid #E3E8EE', padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
        👪 ربط ولي أمر بطالب
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 8px 24px -16px rgba(10,37,64,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <b style={{ color: '#0F2744', fontSize: 15 }}>ربط ولي أمر بطالب</b>
        <button onClick={() => { setOpen(false); setMsg(null) }} style={{ background: 'none', border: 0, fontSize: 20, cursor: 'pointer', color: '#667' }}>×</button>
      </div>
      <p style={{ color: '#667', fontSize: 13, margin: '0 0 16px', lineHeight: 1.8 }}>
        اختر الطالب، وسيبحث النظام عن حساب ولي أمر مسجّل <b>بنفس رقم هاتف ولي أمر الطالب</b> ويربطه تلقائياً.
        عادةً يتم الربط تلقائياً عند تسجيل ولي الأمر — استخدم هذه الأداة فقط إن لزم.
      </p>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 6 }}>الطالب</label>
      <select
        value={studentId} onChange={(e) => setStudentId(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', marginBottom: 14 }}
      >
        <option value="">— اختر الطالب —</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.full_name} — {s.code}</option>
        ))}
      </select>

      {msg && (
        <div style={{
          borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.7, marginBottom: 14,
          background: msg.ok ? '#EAF7F0' : '#FDECEA',
          border: `1px solid ${msg.ok ? '#BFE5D0' : '#F3C9C2'}`,
          color: msg.ok ? '#1A7A45' : '#A5331F',
        }}>
          {msg.text}
        </div>
      )}

      <button onClick={link} disabled={loading}
        style={{ background: loading ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '11px 24px', borderRadius: 10, fontWeight: 800, fontSize: 14.5, cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {loading ? 'جارٍ الربط…' : 'ربط تلقائي بالهاتف'}
      </button>
    </div>
  )
}
