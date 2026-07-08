'use client'
// خط زمني للنشاط — عرض بصري لسجل التدقيق مع أيقونات ووقت نسبي وبحث
import { useState } from 'react'

type Event = {
  id: string; action: string; details: string | null
  created_at: string; actor: string
}

// أيقونة ولون حسب نوع العملية (تخمين ذكي من نص الإجراء)
function iconFor(action: string): { ic: string; bg: string; color: string } {
  const a = action
  if (a.includes('راتب')) return { ic: '💰', bg: '#FBF3D5', color: '#8A6D0F' }
  if (a.includes('اشتراك')) return { ic: '💎', bg: '#E8EEF8', color: '#2E5EA8' }
  if (a.includes('حساب') || a.includes('بنك')) return { ic: '🏦', bg: '#E8F0F0', color: '#0E5C5C' }
  if (a.includes('تسجيل مدرسة') || a.includes('مدرسة')) return { ic: '🏫', bg: '#E6F4EC', color: '#1A7A45' }
  if (a.includes('رفض')) return { ic: '✕', bg: '#FCE9E6', color: '#C0392B' }
  if (a.includes('اعتماد') || a.includes('تفعيل')) return { ic: '✓', bg: '#E6F4EC', color: '#1A7A45' }
  return { ic: '•', bg: '#EEF1F5', color: '#69757F' }
}

// وقت نسبي بالعربية
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (m < 1) return 'الآن'
  if (m < 60) return `قبل ${m} دقيقة`
  if (h < 24) return `قبل ${h} ساعة`
  if (d < 30) return `قبل ${d} يوم`
  return new Date(iso).toISOString().slice(0, 10)
}

export default function ActivityTimeline({ events }: { events: Event[] }) {
  const [q, setQ] = useState('')
  const shown = q.trim()
    ? events.filter((e) => e.action.includes(q) || (e.details ?? '').includes(q) || e.actor.includes(q))
    : events

  return (
    <div>
      <input
        type="text" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 ابحث في النشاط (إجراء، منفّذ…)"
        style={{ width: '100%', padding: 13, borderRadius: 11, border: '1.5px solid #DDE3EC', fontFamily: 'inherit', fontSize: 15, marginBottom: 22 }}
      />

      {shown.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', color: '#999', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
          {q ? 'لا نتائج مطابقة لبحثك' : 'لا يوجد نشاط مسجّل بعد'}
        </div>
      ) : (
        <div style={{ position: 'relative', paddingInlineStart: 8 }}>
          {/* الخط العمودي */}
          <div style={{ position: 'absolute', insetInlineStart: 23, top: 8, bottom: 8, width: 2, background: '#EAEEF3' }} />
          {shown.map((e) => {
            const s = iconFor(e.action)
            return (
              <div key={e.id} style={{ display: 'flex', gap: 14, position: 'relative', marginBottom: 16 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: s.bg, color: s.color, display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0, zIndex: 1, border: '2px solid #fff' }}>{s.ic}</div>
                <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '13px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
                    <b style={{ color: '#0F2744', fontSize: 14.5 }}>{e.action}</b>
                    <span style={{ fontSize: 12, color: '#9AA7B8' }}>{relTime(e.created_at)}</span>
                  </div>
                  {e.details && <div style={{ fontSize: 13, color: '#667', marginTop: 3 }}>{e.details}</div>}
                  <div style={{ fontSize: 12, color: '#9AA7B8', marginTop: 5 }}>بواسطة: {e.actor}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
