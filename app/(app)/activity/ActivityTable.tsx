// جدول سجل النشاط — عرض فقط. يستقبل صفوف الصفحة الحالية فقط (مُجلَبة سلفاً من
// الخادم بحد 25 صفاً)، لا يجلب أي بيانات بنفسه ولا يُخفي بيانات أُحضرت بالكامل.
export type ActivityRow = {
  id: string
  action: string
  details: string | null
  created_at: string
  actor: string
}

// أيقونة ولون حسب نوع العملية (تخمين بصري من نص الإجراء — لعرض فقط، وليس فلتر
// أو تصنيف بيانات؛ لا يُعرض كحقل "وحدة" لأن هذا الحقل غير موجود فعلياً)
function iconFor(action: string): { ic: string; bg: string; color: string } {
  const a = action
  if (a.includes('راتب')) return { ic: '💰', bg: '#FBF3D5', color: '#8A6D0F' }
  if (a.includes('اشتراك')) return { ic: '💎', bg: '#E8EEF8', color: '#2E5EA8' }
  if (a.includes('حساب') || a.includes('بنك')) return { ic: '🏦', bg: '#E8F0F0', color: '#0E5C5C' }
  if (a.includes('مدرسة')) return { ic: '🏫', bg: '#E6F4EC', color: '#1A7A45' }
  if (a.includes('رفض')) return { ic: '✕', bg: '#FCE9E6', color: '#C0392B' }
  if (a.includes('اعتماد') || a.includes('تفعيل')) return { ic: '✓', bg: '#E6F4EC', color: '#1A7A45' }
  return { ic: '•', bg: '#EEF1F5', color: '#69757F' }
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
function fmtTime(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${MONTHS[d.getMonth()]} ${h}:${m}`
}

export default function ActivityTable({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#999', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        لا يوجد نشاط مطابق
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'auto', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#F7FAFC', textAlign: 'right' }}>
            <th style={th}>الوقت</th>
            <th style={th}>المستخدم</th>
            <th style={th}>الإجراء</th>
            <th style={th}>التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const s = iconFor(e.action)
            return (
              <tr key={e.id} style={{ borderTop: '1px solid #F2F5F8' }} className="activity-row">
                <td style={{ ...td, direction: 'ltr', textAlign: 'right', color: '#8A94A6', whiteSpace: 'nowrap', fontSize: 13 }}>{fmtTime(e.created_at)}</td>
                <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{e.actor}</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: s.bg, color: s.color, display: 'grid', placeItems: 'center', fontSize: 12, flexShrink: 0 }}>{s.ic}</span>
                    <b style={{ color: '#0F2744', fontWeight: 600 }}>{e.action}</b>
                  </span>
                </td>
                <td style={{ ...td, color: '#667' }}>{e.details || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px', fontSize: 12.5, fontWeight: 700, color: '#475467', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '12px 14px', fontSize: 13.5, color: '#1D2939', verticalAlign: 'top' }
