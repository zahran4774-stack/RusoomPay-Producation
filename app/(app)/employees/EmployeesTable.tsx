'use client'
// جدول الموظفين التفاعلي — إضافة/تعديل
// المحاسب: تعديل الراتب يصبح طلباً · المدير: تعديل مباشر عبر update_employee
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import GrantAccess from './GrantAccess'

type Emp = {
  id: string; code: string; full_name: string; job_title: string | null
  nationality: string; basic: number; allowance: number; iban: string | null
  email?: string | null
}

function payslip(basic: number, allow: number, nat: string, rates: InsRates) {
  const base = rates.cap != null ? Math.min(basic + allow, rates.cap) : basic + allow
  const exempt = nat?.toUpperCase() !== 'OM' && rates.expatExempt
  return {
    emp: exempt ? 0 : Math.round(base * rates.emp * 1000) / 1000,
    er: exempt ? 0 : Math.round(base * rates.er * 1000) / 1000,
  }
}
const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

import type { InsRates } from '@/lib/payroll'

export default function EmployeesTable({ employees, role, rates }: { employees: Emp[]; role: string; rates: InsRates }) {
  const router = useRouter()
  const supabase = createClient()
  const [editing, setEditing] = useState<Emp | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function saveEdit(form: Emp) {
    setMsg(''); setErr('')
    const original = employees.find((e) => e.id === form.id)
    const salaryChanged = original && (form.basic !== original.basic || form.allowance !== original.allowance)

    if (role === 'accountant' && salaryChanged) {
      // المحاسب: الحقول غير المالية مباشرة · الراتب يصبح طلباً معلّقاً
      const { error: e1 } = await supabase.rpc('update_employee', {
        p_id: form.id,
        p_full_name: form.full_name,
        p_job_title: form.job_title,
        p_nationality: form.nationality,
        p_iban: form.iban,
      })
      if (e1) { setErr(e1.message); return }

      const { data: prof } = await supabase.from('profiles').select('school_id').single()
      const { error: e2 } = await supabase.from('salary_requests').insert({
        school_id: prof?.school_id,
        employee_id: form.id,
        old_basic: original!.basic, old_allow: original!.allowance,
        new_basic: form.basic, new_allow: form.allowance,
        status: 'pending',
      })
      if (e2) { setErr(e2.message); return }
      setMsg('📩 تم إرسال طلب تعديل الراتب لاعتماد مدير المدرسة')
    } else {
      // المدير/الإداري: تعديل مباشر معتمد
      const { error } = await supabase.rpc('update_employee', {
        p_id: form.id,
        p_full_name: form.full_name,
        p_job_title: form.job_title,
        p_nationality: form.nationality,
        p_basic: form.basic,
        p_allowance: form.allowance,
        p_iban: form.iban,
      })
      if (error) { setErr(error.message); return }
      setMsg('✓ تم تحديث بيانات الموظف')
    }
    setEditing(null)
    router.refresh()
  }

  return (
    <div>
      {msg && <div style={{ background: '#E6F4EC', color: '#1A7A45', padding: 11, borderRadius: 9, marginBottom: 12, fontSize: 14 }}>{msg}</div>}
      {err && <div style={{ background: '#FBE9E9', color: '#8A2B2B', padding: 11, borderRadius: 9, marginBottom: 12, fontSize: 14 }}>⚠ {err}</div>}

      <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0F2744', color: '#fff', textAlign: 'right' }}>
              <th style={{ padding: 12 }}>الرقم</th><th style={{ padding: 12 }}>الاسم</th>
              <th style={{ padding: 12 }}>الجنسية</th><th style={{ padding: 12 }}>الأساسي</th>
              <th style={{ padding: 12 }}>البدلات</th><th style={{ padding: 12 }}>اشتراك الموظف</th>
              <th style={{ padding: 12 }}>حصة صاحب العمل</th><th style={{ padding: 12 }}></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const p = payslip(e.basic, e.allowance, e.nationality, rates)
              return (
                <tr key={e.id} style={{ borderBottom: '1px solid #EEF2F1' }}>
                  <td style={{ padding: 12, fontWeight: 700 }}>{e.code}</td>
                  <td style={{ padding: 12 }}>{e.full_name}</td>
                  <td style={{ padding: 12 }}>{e.nationality?.toUpperCase() === 'OM' ? 'عُماني' : 'وافد'}</td>
                  <td style={{ padding: 12 }}>{fmt(e.basic)}</td>
                  <td style={{ padding: 12 }}>{fmt(e.allowance)}</td>
                  <td style={{ padding: 12 }}>{fmt(p.emp)}</td>
                  <td style={{ padding: 12 }}>{fmt(p.er)}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => { setEditing(e); setMsg(''); setErr('') }}
                        style={{ background: '#EEF2F9', color: '#163B68', border: '1px solid #D8E2EF', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                        ✏️ تعديل
                      </button>
                      {role === 'owner' && (
                        <GrantAccess employeeId={e.id} employeeName={e.full_name} email={e.email ?? null} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {employees.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#999' }}>لا يوجد موظفون</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && <EditModal emp={editing} role={role} onSave={saveEdit} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditModal({ emp, role, onSave, onClose }: { emp: Emp; role: string; onSave: (e: Emp) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<Emp>({
    ...emp,
    nationality: emp.nationality?.toUpperCase() === 'OM' ? 'OM' : 'NON_OM',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Emp, v: string | number) => setForm({ ...form, [k]: v })
  const inp = { width: '100%', padding: 10, margin: '5px 0 12px', borderRadius: 9, border: '1.5px solid #DDE3EC' }

  async function submit() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,68,.5)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 100 }} dir="rtl">
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 'min(92vw, 440px)' }}>
        <h3 style={{ color: '#0F2744', marginBottom: 14 }}>تعديل: {emp.full_name}</h3>

        {role === 'accountant' && (
          <div style={{ background: '#FBF3D5', color: '#8A6D0F', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
            ℹ️ تعديل الراتب سيُرسل كطلب لاعتماد مدير المدرسة
          </div>
        )}

        <label style={{ fontSize: 13, fontWeight: 600 }}>الاسم</label>
        <input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>الجنسية</label>
        <select value={form.nationality} onChange={(e) => set('nationality', e.target.value)} style={inp}>
          <option value="OM">عُماني</option>
          <option value="NON_OM">وافد</option>
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>الراتب الأساسي</label>
        <input type="number" value={form.basic} onChange={(e) => set('basic', parseFloat(e.target.value) || 0)} style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>البدلات</label>
        <input type="number" value={form.allowance} onChange={(e) => set('allowance', parseFloat(e.target.value) || 0)} style={inp} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '10px 18px', background: '#F0F3F8', border: 'none', borderRadius: 9, cursor: 'pointer' }}>إلغاء</button>
          <button onClick={submit} disabled={saving} style={{ padding: '10px 18px', background: saving ? '#8AA' : '#163B68', color: '#fff', border: 'none', borderRadius: 9, cursor: saving ? 'default' : 'pointer', fontWeight: 700 }}>
            {saving ? 'جارٍ الحفظ…' : role === 'accountant' ? 'إرسال للاعتماد' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}
