'use client'
// جدول الموظفين التفاعلي — إضافة/تعديل
// المحاسب: تعديل الراتب يصبح طلباً · المدير: تعديل مباشر
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

type Emp = {
  id: string; code: string; full_name: string; job_title: string | null
  nationality: string; basic: number; allowance: number; iban: string | null
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

  async function saveEdit(form: Emp) {
    const original = employees.find((e) => e.id === form.id)
    const salaryChanged = original && (form.basic !== original.basic || form.allowance !== original.allowance)

    if (role === 'accountant' && salaryChanged) {
      // المحاسب: تعديل الراتب → طلب معلّق (يُحدّث الحقول غير المالية مباشرة)
      await supabase.from('employees').update({
        full_name: form.full_name, job_title: form.job_title,
        nationality: form.nationality, iban: form.iban,
      }).eq('id', form.id)

      await supabase.from('salary_requests').insert({
        school_id: (await supabase.from('profiles').select('school_id').single()).data?.school_id,
        employee_id: form.id,
        old_basic: original!.basic, old_allow: original!.allowance,
        new_basic: form.basic, new_allow: form.allowance,
        status: 'pending',
      })
      setMsg('📩 تم إرسال طلب تعديل الراتب لاعتماد مدير المدرسة')
    } else {
      // المدير: تعديل مباشر معتمد
      await supabase.from('employees').update({
        full_name: form.full_name, job_title: form.job_title, nationality: form.nationality,
        basic: form.basic, allowance: form.allowance, iban: form.iban,
      }).eq('id', form.id)
      setMsg('✓ تم تحديث بيانات الموظف')
    }
    setEditing(null)
    router.refresh()
  }

  return (
    <div>
      {msg && <div style={{ background: '#E6F4EC', color: '#1A7A45', padding: 11, borderRadius: 9, marginBottom: 12, fontSize: 14 }}>{msg}</div>}

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
                  <td style={{ padding: 12 }}>{e.nationality === 'om' ? 'عُماني' : 'وافد'}</td>
                  <td style={{ padding: 12 }}>{fmt(e.basic)}</td>
                  <td style={{ padding: 12 }}>{fmt(e.allowance)}</td>
                  <td style={{ padding: 12 }}>{fmt(p.emp)}</td>
                  <td style={{ padding: 12 }}>{fmt(p.er)}</td>
                  <td style={{ padding: 12 }}>
                    <button onClick={() => { setEditing(e); setMsg('') }}
                      style={{ background: '#EEF2F9', color: '#163B68', border: '1px solid #D8E2EF', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                      ✏️ تعديل
                    </button>
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

function EditModal({ emp, role, onSave, onClose }: { emp: Emp; role: string; onSave: (e: Emp) => void; onClose: () => void }) {
  const [form, setForm] = useState<Emp>(emp)
  const set = (k: keyof Emp, v: string | number) => setForm({ ...form, [k]: v })
  const inp = { width: '100%', padding: 10, margin: '5px 0 12px', borderRadius: 9, border: '1.5px solid #DDE3EC' }

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
          <option value="om">عُماني</option><option value="expat">وافد</option>
        </select>

        <label style={{ fontSize: 13, fontWeight: 600 }}>الراتب الأساسي</label>
        <input type="number" value={form.basic} onChange={(e) => set('basic', parseFloat(e.target.value) || 0)} style={inp} />

        <label style={{ fontSize: 13, fontWeight: 600 }}>البدلات</label>
        <input type="number" value={form.allowance} onChange={(e) => set('allowance', parseFloat(e.target.value) || 0)} style={inp} />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', background: '#F0F3F8', border: 'none', borderRadius: 9, cursor: 'pointer' }}>إلغاء</button>
          <button onClick={() => onSave(form)} style={{ padding: '10px 18px', background: '#163B68', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700 }}>
            {role === 'accountant' ? 'إرسال للاعتماد' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}
