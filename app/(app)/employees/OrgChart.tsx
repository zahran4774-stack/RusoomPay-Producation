'use client'
// app/(app)/employees/OrgChart.tsx
// الهيكل التنظيمي بأسلوب Microsoft Teams — عرض مركّز على موظف:
// الرئيس فوقه · الموظف المحدّد بارز في الوسط · مرؤوسوه في بطاقات أفقية أسفله.
// التنقّل بالضغط على أي شخص. المدير يعيّن "يتبع مَن".
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Users, ChevronLeft, IdCard } from 'lucide-react'

type Emp = {
  id: string; code: string; full_name: string
  job_title: string | null; photo_url: string | null; manager_id: string | null
}

const AVATAR_COLORS = ['#1E5C4E', '#2E5EA8', '#B54708', '#7A3E9D', '#0F766E', '#B42318', '#3538CD']
function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function Avatar({ emp, size }: { emp: Emp; size: number }) {
  if (emp.photo_url) {
    return <img src={emp.photo_url} alt={emp.full_name}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 0 0 1px #E2E7EE' }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: colorFor(emp.full_name), color: '#fff', fontWeight: 700, fontSize: size * 0.36 }}>
      {initials(emp.full_name)}
    </span>
  )
}

export default function OrgChart({ employees, canEdit }: { employees: Emp[]; canEdit: boolean }) {
  const supabase = createClient()
  const [emps, setEmps] = useState<Emp[]>(employees)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => {
    const m = new Map<string, Emp>()
    emps.forEach((e) => m.set(e.id, e))
    return m
  }, [emps])

  const rootId = useMemo(() => {
    const root = emps.find((e) => !e.manager_id || !byId.has(e.manager_id))
    return root?.id ?? emps[0]?.id ?? null
  }, [emps, byId])

  const focus = focusId && byId.has(focusId) ? byId.get(focusId)! : (rootId ? byId.get(rootId)! : null)
  const manager = focus?.manager_id ? byId.get(focus.manager_id) : null
  const reports = useMemo(() => focus ? emps.filter((e) => e.manager_id === focus.id) : [], [emps, focus])
  const countReports = (id: string) => emps.filter((e) => e.manager_id === id).length

  async function assignManager(empId: string, managerId: string | null) {
    setBusy(true)
    const { error } = await supabase.rpc('set_employee_manager', { p_employee_id: empId, p_manager_id: managerId })
    setBusy(false)
    if (error) { alert('تعذّر التعيين: ' + error.message); return }
    setEmps((prev) => prev.map((e) => e.id === empId ? { ...e, manager_id: managerId } : e))
    setEditing(null)
  }

  if (emps.length === 0) {
    return <div style={{ background: '#fff', borderRadius: 14, padding: 28, textAlign: 'center', color: '#999' }}>لا يوجد موظفون بعد.</div>
  }
  if (!focus) return null

  return (
    <div style={{ background: '#F7FAFC', borderRadius: 16, padding: '22px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>الهيكل التنظيمي</h2>
        {focusId && focusId !== rootId && (
          <button onClick={() => setFocusId(rootId)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#1E5C4E', background: 'none', border: '1px solid #CBD5D1', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <ChevronLeft size={14} /> أعلى الهرم
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, maxWidth: 640, margin: '0 auto' }}>
        {manager && (
          <>
            <PersonCard emp={manager} count={countReports(manager.id)} variant="manager" onClick={() => setFocusId(manager.id)} />
            <Connector />
          </>
        )}

        <PersonCard emp={focus} count={reports.length} variant="focus"
          canEdit={canEdit} onEdit={() => setEditing(editing === focus.id ? null : focus.id)} />

        {editing === focus.id && canEdit && (
          <div style={{ background: '#EEF4F3', border: '1px solid #D8E4E0', borderRadius: 10, padding: 12, margin: '10px 0', width: '100%', maxWidth: 380 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>رئيس {focus.full_name} المباشر:</label>
            <select defaultValue={focus.manager_id ?? ''} onChange={(e) => assignManager(focus.id, e.target.value || null)} disabled={busy}
              style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid #CBD5D1', padding: '0 10px', fontFamily: 'inherit', fontSize: 14 }}>
              <option value="">— بلا رئيس (قمّة الهرم) —</option>
              {emps.filter((e) => e.id !== focus.id).map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} — {e.job_title || 'موظف'}</option>
              ))}
            </select>
          </div>
        )}

        {reports.length > 0 && (
          <>
            <Connector />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8A94A6', fontSize: 12.5, margin: '2px 0 12px' }}>
              <Users size={14} /> {reports.length} مرؤوس مباشر
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 12, width: '100%' }}>
              {reports.map((r) => (
                <button key={r.id} onClick={() => setFocusId(r.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #E2E7EE', borderRadius: 14, padding: '16px 12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'box-shadow .15s, transform .12s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar emp={r} size={54} />
                    {countReports(r.id) > 0 && (
                      <span style={{ position: 'absolute', bottom: -2, left: -2, background: '#1E5C4E', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 10, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 2, border: '2px solid #fff' }}>
                        <Users size={9} /> {countReports(r.id)}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F2744', lineHeight: 1.3 }}>{r.full_name}</div>
                    <div style={{ fontSize: 11.5, color: '#8A94A6', marginTop: 2 }}>{r.job_title || 'موظف'}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PersonCard({ emp, count, variant, canEdit, onEdit, onClick }: {
  emp: Emp; count: number; variant: 'manager' | 'focus'
  canEdit?: boolean; onEdit?: () => void; onClick?: () => void
}) {
  const isFocus = variant === 'focus'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%', maxWidth: isFocus ? 420 : 360,
        background: isFocus ? 'linear-gradient(135deg,#0F2744,#1A3A5C)' : '#fff',
        color: isFocus ? '#fff' : '#0F2744',
        border: isFocus ? 'none' : '1px solid #E2E7EE',
        borderRadius: 14, padding: isFocus ? '16px 18px' : '12px 15px',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: isFocus ? '0 6px 20px rgba(15,39,68,.25)' : '0 1px 3px rgba(0,0,0,.06)',
      }}>
      <Avatar emp={emp} size={isFocus ? 58 : 44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: isFocus ? '1.05rem' : '.95rem' }}>{emp.full_name}</div>
        <div style={{ fontSize: isFocus ? '.85rem' : '.78rem', opacity: .82 }}>{emp.job_title || 'بلا مسمّى'} · {emp.code}</div>
      </div>
      {count > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.75rem', background: isFocus ? 'rgba(255,255,255,.16)' : '#EEF4F3', color: isFocus ? '#fff' : '#1E5C4E', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          <Users size={12} /> {count}
        </span>
      )}
      {isFocus && canEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit?.() }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.75rem', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          <IdCard size={13} /> تعيين رئيس
        </button>
      )}
    </div>
  )
}

function Connector() {
  return <div style={{ width: 2, height: 22, background: '#CBD5D1' }} />
}
