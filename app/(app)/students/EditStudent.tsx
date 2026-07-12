'use client'
// تعديل بيانات الطالب الشخصية — لا الرسوم، لا الرقم المدرسي (يُدار من قسم الرسوم)
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export type StudentEditable = {
  id: string
  full_name: string
  grade: string | null
  section: string | null
  guardian_name: string | null
  guardian_phone: string | null
  guardian_email: string | null
  birth_date: string | null
  gender: string | null
}

export default function EditStudent({ student }: { student: StudentEditable }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [f, setF] = useState({
    full_name: student.full_name ?? '',
    grade: student.grade ?? '',
    section: student.section ?? '',
    guardian_name: student.guardian_name ?? '',
    guardian_phone: student.guardian_phone ?? '',
    guardian_email: student.guardian_email ?? '',
    birth_date: student.birth_date ?? '',
    gender: student.gender ?? '',
  })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    setErr(null)
    if (!f.full_name.trim()) { setErr('اسم الطالب مطلوب'); return }
    if (!f.grade.trim()) { setErr('الصف/المرحلة مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.rpc('update_student', {
      p_student_id: student.id,
      p_full_name: f.full_name,
      p_grade: f.grade,
      p_section: f.section || null,
      p_guardian_name: f.guardian_name || null,
      p_guardian_phone: f.guardian_phone || null,
      p_guardian_email: f.guardian_email || null,
      p_birth_date: f.birth_date || null,
      p_gender: f.gender || null,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1000)
  }

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 190px' }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="تعديل بيانات الطالب"
        style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        ✎ تعديل
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.45)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
      onClick={() => !saving && setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px -20px rgba(10,37,64,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#0F2744' }}>تعديل بيانات الطالب</h3>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>
        <div style={{ color: '#8A94A6', fontSize: 12, marginBottom: 18 }}>
          الرسوم والرقم المدرسي لا يُعدّلان من هنا.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 13 }}>
          <div style={cell}>
            <label style={label}>الاسم الكامل *</label>
            <input style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          <div style={cell}>
            <label style={label}>الصف / المرحلة *</label>
            <input style={input} value={f.grade} onChange={(e) => set('grade', e.target.value)} />
          </div>
          <div style={cell}>
            <label style={label}>الشعبة</label>
            <input style={input} value={f.section} onChange={(e) => set('section', e.target.value)} />
          </div>
          <div style={cell}>
            <label style={label}>اسم ولي الأمر</label>
            <input style={input} value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
          </div>
          <div style={cell}>
            <label style={label}>رقم ولي الأمر</label>
            <input style={input} value={f.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} dir="ltr" />
          </div>
          <div style={cell}>
            <label style={label}>بريد ولي الأمر</label>
            <input style={input} value={f.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} dir="ltr" />
          </div>
          <div style={cell}>
            <label style={label}>تاريخ الميلاد</label>
            <input type="date" style={input} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} dir="ltr" />
          </div>
          <div style={cell}>
            <label style={label}>الجنس</label>
            <select style={input} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">—</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
        </div>

        {err && <div style={{ color: '#C0392B', marginTop: 14, fontWeight: 600, fontSize: 13 }}>⚠ {err}</div>}
        {ok && <div style={{ color: '#067647', marginTop: 14, fontWeight: 700, fontSize: 13 }}>✓ حُفظت التعديلات</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={submit} disabled={saving}
            style={{ flex: 1, background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
          </button>
          <button onClick={() => setOpen(false)} disabled={saving}
            style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 20px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
