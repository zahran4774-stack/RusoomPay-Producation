'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function AddEmployee() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const [f, setF] = useState({
    full_name: '', job_title: '', nationality: 'OM',
    basic: '', allowance: '', iban: '', code: '', email: '',
    id_type: 'CIVIL', id_number: '', bank_name: '', bank_account_no: '',
    subject_to_pasi: true,
  })
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))

  async function submit() {
    setErr(null); setOk(false)
    if (!f.full_name.trim()) { setErr('اسم الموظف مطلوب'); return }
    setSaving(true)
    const { error } = await supabase.rpc('add_employee', {
      p_full_name: f.full_name,
      p_job_title: f.job_title || null,
      p_nationality: f.nationality || 'OM',
      p_basic: f.basic ? Number(f.basic) : 0,
      p_allowance: f.allowance ? Number(f.allowance) : 0,
      p_iban: f.iban || null,
      p_code: f.code || null,
      p_email: f.email || null,
      p_id_type: f.id_type,
      p_id_number: f.id_number || null,
      p_bank_name: f.bank_name || null,
      p_bank_account_no: f.bank_account_no || f.iban || null,
      p_subject_to_pasi: f.subject_to_pasi,
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setOk(true)
    setF({
      full_name: '', job_title: '', nationality: 'OM', basic: '', allowance: '',
      iban: '', code: '', email: '', id_type: 'CIVIL', id_number: '',
      bank_name: '', bank_account_no: '', subject_to_pasi: true,
    })
    router.refresh()
    setTimeout(() => { setOk(false); setOpen(false) }, 1200)
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 220px' }
  const sectionTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 800, color: '#1B4F8A', margin: '20px 0 10px', width: '100%' }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ background: '#163B68', color: '#fff', border: 0, padding: '12px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        ＋ إضافة موظف جديد
      </button>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24, marginBottom: 18, boxShadow: '0 12px 34px -20px rgba(10,37,64,.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h3 style={{ color: '#0F2744', margin: 0, fontSize: 18 }}>إضافة موظف جديد</h3>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        <div style={cell}>
          <label style={label}>الاسم الكامل *</label>
          <input style={input} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="سالم محمد البلوشي" />
        </div>
        <div style={cell}>
          <label style={label}>المسمّى الوظيفي</label>
          <input style={input} value={f.job_title} onChange={(e) => set('job_title', e.target.value)} placeholder="معلّم رياضيات" />
        </div>
        <div style={cell}>
          <label style={label}>البريد الإلكتروني (لمنح صلاحية دخول)</label>
          <input style={input} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="staff@email.com" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>الرقم الوظيفي (تلقائي إن تُرك فارغاً)</label>
          <input style={input} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="EMP-001" />
        </div>

        <div style={sectionTitle}>الهوية والجنسية</div>

        <div style={cell}>
          <label style={label}>الجنسية</label>
          <select style={input} value={f.nationality}
            onChange={(e) => {
              const v = e.target.value
              setF((p) => ({ ...p, nationality: v, subject_to_pasi: v === 'OM' ? p.subject_to_pasi : false }))
            }}>
            <option value="OM">عُماني</option>
            <option value="NON_OM">وافد</option>
          </select>
        </div>
        <div style={cell}>
          <label style={label}>نوع الهوية</label>
          <select style={input} value={f.id_type} onChange={(e) => set('id_type', e.target.value)}>
            <option value="CIVIL">البطاقة المدنية</option>
            <option value="PASSPORT">جواز السفر</option>
          </select>
        </div>
        <div style={cell}>
          <label style={label}>رقم الهوية * (مطلوب لحماية الأجور)</label>
          <input style={input} value={f.id_number} onChange={(e) => set('id_number', e.target.value)} placeholder="12345678" dir="ltr" />
        </div>

        <div style={sectionTitle}>البيانات البنكية</div>

        <div style={cell}>
          <label style={label}>اسم البنك</label>
          <input style={input} value={f.bank_name} onChange={(e) => set('bank_name', e.target.value)} placeholder="بنك مسقط" />
        </div>
        <div style={cell}>
          <label style={label}>الآيبان * (لتحويل الراتب)</label>
          <input style={input} value={f.iban} onChange={(e) => set('iban', e.target.value.toUpperCase())} placeholder="OM..." dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>رقم الحساب (إن اختلف عن الآيبان)</label>
          <input style={input} value={f.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} placeholder="اتركه فارغاً لاستخدام الآيبان" dir="ltr" />
        </div>

        <div style={sectionTitle}>الراتب والتأمينات</div>

        <div style={cell}>
          <label style={label}>الراتب الأساسي (ر.ع)</label>
          <input type="number" style={input} value={f.basic} onChange={(e) => set('basic', e.target.value)} placeholder="0" dir="ltr" />
        </div>
        <div style={cell}>
          <label style={label}>البدلات (ر.ع)</label>
          <input type="number" style={input} value={f.allowance} onChange={(e) => set('allowance', e.target.value)} placeholder="0" dir="ltr" />
        </div>
        <div style={{ ...cell, display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#0F2744', cursor: f.nationality === 'OM' ? 'pointer' : 'default', paddingBottom: 10 }}>
            <input type="checkbox" checked={f.subject_to_pasi}
              disabled={f.nationality !== 'OM'}
              onChange={(e) => set('subject_to_pasi', e.target.checked)}
              style={{ width: 17, height: 17, cursor: 'inherit' }} />
            مشترك في الحماية الاجتماعية
          </label>
        </div>
      </div>

      {err && <div style={{ color: '#C0392B', marginTop: 14, fontWeight: 600, fontSize: 14 }}>⚠ {err}</div>}
      {ok && <div style={{ color: '#067647', marginTop: 14, fontWeight: 700, fontSize: 14 }}>✓ أُضيف الموظف بنجاح</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={submit} disabled={saving}
          style={{ background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0, padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الموظف'}
        </button>
        <button onClick={() => setOpen(false)}
          style={{ background: '#F2F5F8', color: '#0F2744', border: 0, padding: '12px 22px', borderRadius: 11, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
          إلغاء
        </button>
      </div>
    </div>
  )
}
