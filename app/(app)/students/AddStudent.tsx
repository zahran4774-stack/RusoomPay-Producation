'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { GRADES, SECTIONS } from '@/lib/academic'

export default function AddStudent() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [f, setF] = useState({
    full_name: '', grade: '', section: '', guardian_name: '',
    guardian_phone: '', guardian_email: '', birth_date: '', gender: '',
    code: '', annual_fee: '',
  })

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    setErr(null); setOk(false)
    if (!f.full_name.trim()) { setErr('اسم الطالب مطلوب'); return }
    if (!f.grade.trim()) { setErr('الصف/المرحلة مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.rpc('add_student', {
      p_full_name: f.full_name,
      p_grade: f.grade,
      p_section: f.section || null,
      p_guardian_name: f.guardian_name || null,
      p_guardian_phone: f.guardian_phone || null,
      p_guardian_email: f.guardian_email || null,
      p_birth_date: f.birth_date || null,
      p_gender: f.gender || null,
      p_code: f.code || null,
      p_annual_fee: f.annual_fee ? Number(f.annual_fee) : 0,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    setF({ full_name: '', grade: '', section: '', guardian_name: '', guardian_phone: '', guardian_email: '', birth_date: '', gender: '', code: '', annual_fee: '' })
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1200)
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  // القوائم المنسدلة: خلفية بيضاء صريحة كي لا تظهر رمادية في بعض المتصفحات
  const select: React.CSSProperties = { ...input, background: '#fff', cursor: 'pointer' }
  const cell: React.CSSProperties = { flex: '1 1 220px' }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#163B68', color: '#fff', border: 0, padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        ＋ إضافة طالب جديد
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24, marginBottom: 18, boxShadow: '0 12px 34px -20px rgba(10,37,64,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ color: '#0F2744', margin: 0, fontSize: 18 }}>إضافة طالب جديد</h3>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={cell}>
          <label style={label}>الاسم الكامل *</label>
          <input style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="محمد أحمد الكندي" />
        </div>

        {/* قائمة ثابتة — تمنع تكرار الصفوف بصيغ مختلفة */}
        <div style={cell}>
          <label style={label}>الصف / المرحلة *</label>
          <select style={select} value={f.grade} onChange={(e) => set('grade', e.target.value)}>
            <option value="">— اختر الصف —</option>
            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        {/* قائمة ثابتة — عشر شعب بالترتيب الأبجدي */}
        <div style={cell}>
          <label style={label}>الشعبة</label>
          <select style={select} value={f.section} onChange={(e) => set('section', e.target.value)}>
            <option value="">— اختر الشعبة —</option>
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={cell}>
          <label style={label}>الرقم المدرسي (تلقائي إن تُرك فارغاً)</label>
          <input style={input} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="STU-001" />
        </div>
        <div style={cell}>
          <label style={label}>اسم ولي الأمر</label>
          <input style={input} value={f.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} placeholder="أحمد الكندي" />
        </div>
        <div style={cell}>
          <label style={label}>رقم ولي الأمر</label>
          <input style={input} value={f.guardian_phone} onChange={(e) => set('guardian_phone', e.target.value)} placeholder="9xxxxxxx" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>بريد ولي الأمر</label>
          <input style={input} value={f.guardian_email} onChange={(e) => set('guardian_email', e.target.value)} placeholder="parent@email.com" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>تاريخ الميلاد</label>
          <input type="date" style={input} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>الجنس</label>
          <select style={select} value={f.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>
        <div style={cell}>
          <label style={label}>الرسوم السنوية (ر.ع)</label>
          <input type="number" style={input} value={f.annual_fee} onChange={(e) => set('annual_fee', e.target.value)} placeholder="0" dir="ltr" />
        </div>
      </div>

      {err && <div style={{ color: '#C0392B', marginTop: 14, fontWeight: 600, fontSize: 14 }}>⚠ {err}</div>}
      {ok && <div style={{ color: '#067647', marginTop: 14, fontWeight: 700, fontSize: 14 }}>✓ أُضيف الطالب بنجاح</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={submit} disabled={saving}
          style={{ background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الطالب'}
        </button>
        <button onClick={() => setOpen(false)}
          style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 22px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          إلغاء
        </button>
      </div>
    </div>
  )
}
