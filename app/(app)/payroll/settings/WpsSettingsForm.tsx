'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Settings = {
  employer_cr_no: string | null
  payer_cr_no: string | null
  wps_email: string | null
  wps_phone: string | null
  debit_account_no: string | null
  bank_name: string | null
}

export default function WpsSettingsForm({
  schoolId, schoolName, initial,
}: {
  schoolId: string
  schoolName: string
  initial: Settings | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const [f, setF] = useState({
    employer_cr_no: initial?.employer_cr_no ?? '',
    payer_cr_no: initial?.payer_cr_no ?? '',
    wps_email: initial?.wps_email ?? '',
    wps_phone: initial?.wps_phone ?? '',
    debit_account_no: initial?.debit_account_no ?? '',
    bank_name: initial?.bank_name ?? 'بنك مسقط',
  })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    setMsg(''); setErr('')
    if (!f.employer_cr_no.trim()) { setErr('رقم السجل التجاري مطلوب'); return }
    if (!f.debit_account_no.trim()) { setErr('رقم حساب الخصم مطلوب'); return }

    setSaving(true)
    const { error } = await supabase.from('payroll_settings').upsert({
      school_id: schoolId,
      employer_cr_no: f.employer_cr_no.trim(),
      payer_cr_no: (f.payer_cr_no || f.employer_cr_no).trim(),
      wps_email: f.wps_email.trim() || null,
      wps_phone: f.wps_phone.trim() || null,
      debit_account_no: f.debit_account_no.trim(),
      bank_name: f.bank_name.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'school_id' })
    setSaving(false)

    if (error) { setErr(error.message); return }
    setMsg('✓ حُفظت الإعدادات')
    router.refresh()
  }

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#0F2744', marginBottom: 5, display: 'block' }
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #E3E8EE', fontSize: 14, fontFamily: 'inherit' }
  const cell: React.CSSProperties = { flex: '1 1 240px' }
  const hint: React.CSSProperties = { fontSize: 12, color: '#889', marginTop: 4 }

  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8EE', borderRadius: 18, padding: 24 }}>
      <div style={{ background: '#F7F9FC', borderRadius: 11, padding: '12px 14px', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#556' }}>اسم المنشأة في الملف: </span>
        <b style={{ color: '#0F2744' }}>{schoolName}</b>
        <div style={hint}>يُؤخذ من اسم المدرسة في الإعدادات العامة</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <div style={cell}>
          <label style={label}>رقم السجل التجاري *</label>
          <input style={input} value={f.employer_cr_no}
                 onChange={(e) => set('employer_cr_no', e.target.value)}
                 placeholder="1234567" dir="ltr" />
        </div>

        <div style={cell}>
          <label style={label}>سجل الدافع</label>
          <input style={input} value={f.payer_cr_no}
                 onChange={(e) => set('payer_cr_no', e.target.value)}
                 placeholder="اتركه فارغاً إن كان نفس السجل" dir="ltr" />
          <div style={hint}>غالباً نفس رقم السجل التجاري</div>
        </div>

        <div style={cell}>
          <label style={label}>البريد الإلكتروني</label>
          <input style={input} value={f.wps_email}
                 onChange={(e) => set('wps_email', e.target.value)}
                 placeholder="info@school.om" dir="ltr" />
          <div style={hint}>يتواصل عليه البنك عند الحاجة لتوضيح</div>
        </div>

        <div style={cell}>
          <label style={label}>رقم الهاتف</label>
          <input style={input} value={f.wps_phone}
                 onChange={(e) => set('wps_phone', e.target.value)}
                 placeholder="+968XXXXXXXX" dir="ltr" />
        </div>

        <div style={cell}>
          <label style={label}>اسم البنك</label>
          <input style={input} value={f.bank_name}
                 onChange={(e) => set('bank_name', e.target.value)}
                 placeholder="بنك مسقط" />
        </div>

        <div style={cell}>
          <label style={label}>رقم حساب الخصم *</label>
          <input style={input} value={f.debit_account_no}
                 onChange={(e) => set('debit_account_no', e.target.value)}
                 placeholder="0180000009876543" dir="ltr" />
          <div style={hint}>الحساب الذي تُخصم منه الرواتب</div>
        </div>
      </div>

      {err && <div style={{ background: '#FBE9E9', color: '#8A2B2B', padding: 11, borderRadius: 9, marginTop: 18, fontSize: 14 }}>⚠ {err}</div>}
      {msg && <div style={{ background: '#E6F4EC', color: '#1A7A45', padding: 11, borderRadius: 9, marginTop: 18, fontSize: 14 }}>{msg}</div>}

      <button onClick={save} disabled={saving}
        style={{ background: saving ? '#8AA' : '#163B68', color: '#fff', border: 0,
                 padding: '12px 26px', borderRadius: 11, fontWeight: 800, fontSize: 15,
                 cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', marginTop: 20 }}>
        {saving ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
      </button>
    </div>
  )
}
