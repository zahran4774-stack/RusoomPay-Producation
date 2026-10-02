'use client'
// app/(app)/employees/StaffPermissionsManager.tsx
// إدارة صلاحيات الإداري/المحاسب — مستقل تماماً عن EmployeesTable (يعمل على
// profiles لا employees، لأن الصلاحيات مرتبطة بحساب الدخول لا سجل الراتب).
// للمالك فقط. يعرض كل admin/accountant لهم حساب دخول فعلي، مع ثلاثة مفاتيح
// تبديل لكل واحد: القيود اليدوية، التقارير، الاعتمادات.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type StaffRow = {
  user_id: string
  full_name: string
  role: 'admin' | 'accountant'
  permissions: string[]
}

const PERMISSIONS: { key: string; label: string; desc: string }[] = [
  { key: 'journal_entries', label: 'القيود اليدوية', desc: 'تسجيل وتعديل قيود محاسبية يدوية' },
  { key: 'reports', label: 'التقارير', desc: 'الوصول للتقارير الدورية والتوقعات المالية' },
  { key: 'approvals', label: 'الاعتمادات', desc: 'اعتماد الدفعات المعلّقة (تحويلات بنكية، شيكات)' },
]

const ROLE_LABEL: Record<string, string> = { admin: 'إداري', accountant: 'محاسب' }

export default function StaffPermissionsManager() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open || staff !== null) return
    supabase.rpc('staff_permissions_list').then(({ data, error }) => {
      if (error) { setErr(error.message); return }
      setStaff(data ?? [])
    })
  }, [open, staff, supabase])

  async function toggle(row: StaffRow, permKey: string) {
    const hasIt = row.permissions.includes(permKey)
    const busyId = row.user_id + permKey
    setBusyKey(busyId)
    setErr('')
    const { error } = await supabase.rpc('set_user_permission', {
      p_user_id: row.user_id, p_permission: permKey, p_grant: !hasIt,
    })
    setBusyKey(null)
    if (error) { setErr(error.message); return }
    setStaff((prev) =>
      (prev ?? []).map((r) =>
        r.user_id === row.user_id
          ? { ...r, permissions: hasIt ? r.permissions.filter((p) => p !== permKey) : [...r.permissions, permKey] }
          : r
      )
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: '#EEF2F9', color: '#163B68', border: '1px solid #D8E2EF',
          borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
        🔑 إدارة الصلاحيات
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,39,68,.5)', display: 'grid', placeItems: 'center', padding: 16, zIndex: 200 }}
      dir="rtl" onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: 'min(94vw, 640px)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 12px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#0F2744', margin: 0 }}>إدارة الصلاحيات</h3>
            <p style={{ color: '#667', fontSize: 13, margin: '4px 0 0' }}>امنح أو اسحب صلاحيات إضافية لكل إداري أو محاسب</p>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, fontSize: 22, cursor: 'pointer', color: '#667' }}>×</button>
        </div>

        <div style={{ padding: '0 24px 20px', overflowY: 'auto', flex: 1 }}>
          {err && <div style={{ background: '#FBE9E9', color: '#8A2B2B', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>⚠ {err}</div>}

          {staff === null ? (
            <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24 }}>جارٍ التحميل…</div>
          ) : staff.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8A94A6', padding: 24 }}>لا يوجد إداريون أو محاسبون بحساب دخول بعد</div>
          ) : (
            staff.map((row) => (
              <div key={row.user_id} style={{ border: '1px solid #EEF2F1', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <b style={{ color: '#0F2744', fontSize: 15 }}>{row.full_name}</b>
                  <span style={{ background: '#EEF2F9', color: '#163B68', fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                    {ROLE_LABEL[row.role] ?? row.role}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {PERMISSIONS.map((perm) => {
                    const active = row.permissions.includes(perm.key)
                    const busyId = row.user_id + perm.key
                    return (
                      <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', background: active ? '#EAF7EE' : '#F7F9FC', borderRadius: 9 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F2744' }}>{perm.label}</div>
                          <div style={{ fontSize: 11.5, color: '#8A94A6' }}>{perm.desc}</div>
                        </div>
                        <button
                          onClick={() => toggle(row, perm.key)}
                          disabled={busyKey === busyId}
                          style={{
                            flexShrink: 0, width: 46, height: 26, borderRadius: 99, border: 0, position: 'relative',
                            background: active ? '#1A7A45' : '#D8DEE6', cursor: busyKey === busyId ? 'default' : 'pointer',
                            opacity: busyKey === busyId ? 0.6 : 1, transition: 'background .2s',
                          }}>
                          <span style={{
                            position: 'absolute', top: 3, [active ? 'right' : 'left']: 3,
                            width: 20, height: 20, borderRadius: '50%', background: '#fff',
                            transition: 'all .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                          }} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
