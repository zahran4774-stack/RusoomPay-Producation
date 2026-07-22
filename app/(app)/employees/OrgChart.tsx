'use client'
// الهيكل التنظيمي — مدير المدرسة في القمة، والأقسام في أعمدة تحته
import { useState } from 'react'

type Emp = {
  id: string
  code: string
  full_name: string
  job_title: string | null
  photo_url: string | null
  manager_id: string | null
  department?: string | null
  org_level?: number | null
}

const DEPTS = [
  { key: 'admin',    label: 'إداري ومالي',      color: '#1B4F8A' },
  { key: 'teaching', label: 'الهيئة التدريسية', color: '#1B6B3A' },
  { key: 'support',  label: 'خدمات مساندة',     color: '#7A5C0A' },
] as const

const VISIBLE = 3

export default function OrgChart({ employees, canEdit }: { employees: Emp[]; canEdit?: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const chief = employees.find((e) => e.org_level === 1)
    ?? employees.find((e) => e.department === 'management')
    ?? null

  const byDept = DEPTS.map((d) => {
    const all = employees.filter((e) => e.department === d.key && e.id !== chief?.id)
    const lead = all.find((e) => e.org_level === 2) ?? null
    const members = all.filter((e) => e.id !== lead?.id)
    return { ...d, lead, members, total: all.length }
  })

  const unassigned = employees.filter(
    (e) => e.id !== chief?.id && !DEPTS.some((d) => d.key === e.department)
  )

  if (employees.length === 0) {
    return (
      <div style={box}>
        <p style={{ color: '#8A94A6', fontSize: 13.5, textAlign: 'center', padding: 20 }}>
          لا يوجد موظفون بعد
        </p>
      </div>
    )
  }

  return (
    <div style={box}>
      {!chief && (
        <div style={{ background: '#FBF3D5', border: '1px solid #EAD9A0', borderRadius: 10,
                      padding: '10px 12px', marginBottom: 12, fontSize: 12.5, color: '#8A6D0F' }}>
          لم يُحدَّد مدير المدرسة بعد — اختر الموظف المناسب واضبط مستواه على «مدير المدرسة» من زر التعديل
        </div>
      )}

      {chief && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={chiefCard}>
              {chief.photo_url && <Photo src={chief.photo_url} size={32} />}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{chief.full_name}</div>
                <div style={{ fontSize: 10.5, opacity: 0.75 }}>{chief.job_title ?? 'مدير المدرسة'}</div>
              </div>
            </div>
          </div>
          <div style={stem} />
          <div style={bar} />
          <div style={{ display: 'flex' }}>
            {DEPTS.map((d) => (
              <div key={d.key} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={drop} />
              </div>
            ))}
          </div>
        </>
      )}

      <div style={cols}>
        {byDept.map((d) => {
          const open = expanded[d.key]
          const shown = open ? d.members : d.members.slice(0, VISIBLE)
          const hidden = d.members.length - shown.length

          return (
            <div key={d.key} style={col}>
              <div style={{ ...colHead, background: d.color }}>
                <span>{d.label}</span>
                <span style={countPill}>{d.total}</span>
              </div>
              <div style={{ padding: 8 }}>
                {d.lead && (
                  <div style={{ ...leadCard, borderInlineStartWidth: 3, borderInlineStartColor: d.color, borderInlineStartStyle: 'solid' }}>
                    {d.lead.photo_url && <Photo src={d.lead.photo_url} size={24} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={leadName}>{d.lead.full_name}</div>
                      <div style={leadRole}>{d.lead.job_title ?? '—'}</div>
                    </div>
                  </div>
                )}

                {shown.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {shown.map((m) => (
                      <div key={m.id} style={memberCard}>
                        {m.photo_url && <Photo src={m.photo_url} size={21} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={memberName}>{m.full_name}</div>
                          <div style={memberRole}>{m.job_title ?? '—'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {d.members.length === 0 && !d.lead && (
                  <div style={{ fontSize: 11, color: '#A6B0BE', textAlign: 'center', padding: '10px 0' }}>
                    لا يوجد موظفون
                  </div>
                )}

                {d.members.length > VISIBLE && (
                  <button onClick={() => setExpanded((p) => ({ ...p, [d.key]: !open }))} style={moreBtn}>
                    {open ? '▴ إخفاء' : `▾ عرض ${hidden} إضافيين`}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {unassigned.length > 0 && (
        <div style={unassignedBox}>
          <b style={{ fontSize: 12, color: '#7A5C0A' }}>
            {unassigned.length} موظف بلا قسم
          </b>
          <div style={{ fontSize: 11.5, color: '#8A6D0F', marginTop: 3 }}>
            {unassigned.map((e) => e.full_name).join(' · ')}
            {canEdit && ' — حدّد القسم من زر التعديل في جدول الموظفين'}
          </div>
        </div>
      )}

      <div style={foot}>
        {DEPTS.map((d) => (
          <span key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 9, height: 9, borderRadius: 2, background: d.color, display: 'inline-block' }} />
            {d.label}
          </span>
        ))}
        <span style={{ marginInlineStart: 'auto' }}>{employees.length} موظفاً</span>
      </div>
    </div>
  )
}

// الصورة الشخصية — تظهر فقط لمن رفع صورة، ولا بديل نصّي
function Photo({ src, size }: { src: string; size: number }) {
  return (
    <img src={src} alt=""
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
}

const box: React.CSSProperties = {
  background: '#fff', border: '1px solid #E6EBF1', borderRadius: 14,
  padding: '18px 16px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
}
const chiefCard: React.CSSProperties = {
  background: '#0F2744', color: '#fff', borderRadius: 11,
  padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 9,
}
const stem: React.CSSProperties = { width: 2, height: 14, background: '#DDE3EC', margin: '0 auto' }
const bar: React.CSSProperties = { height: 2, background: '#DDE3EC', width: '66.66%', margin: '0 auto' }
const drop: React.CSSProperties = { width: 2, height: 12, background: '#DDE3EC' }

const cols: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10,
}
const col: React.CSSProperties = {
  border: '1px solid #E9EEF4', borderRadius: 11, overflow: 'hidden', background: '#FBFCFE',
}
const colHead: React.CSSProperties = {
  padding: '7px 11px', color: '#fff', fontWeight: 700, fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}
const countPill: React.CSSProperties = {
  background: 'rgba(255,255,255,.24)', borderRadius: 20, padding: '1px 7px', fontSize: 10.5,
}
const leadCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #DDE5EF', borderRadius: 8,
  padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7,
}
const leadName: React.CSSProperties = {
  fontWeight: 700, fontSize: 12, lineHeight: 1.25,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const leadRole: React.CSSProperties = {
  fontSize: 10, color: '#8A94A6', lineHeight: 1.2,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const memberCard: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 9px', borderRadius: 7, background: '#fff', border: '1px solid #EEF2F7',
}
const memberName: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600,
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const memberRole: React.CSSProperties = {
  fontSize: 9.5, color: '#9AA4B2',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}
const moreBtn: React.CSSProperties = {
  background: 'none', border: 0, cursor: 'pointer', width: '100%',
  color: '#7C8899', fontSize: 10.5, fontFamily: 'inherit', fontWeight: 700,
  padding: '5px 0 1px',
}
const unassignedBox: React.CSSProperties = {
  marginTop: 12, background: '#FBF3D5', border: '1px solid #EAD9A0',
  borderRadius: 10, padding: '10px 12px',
}
const foot: React.CSSProperties = {
  display: 'flex', gap: 12, flexWrap: 'wrap',
  marginTop: 12, fontSize: 11, color: '#7C8899',
}
