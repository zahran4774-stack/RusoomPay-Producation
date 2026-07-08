'use client'
// app/(app)/fees/RiskIndicator.tsx
// مؤشّر خطورة التعثّر — يعرض فقط نتائج محرّك risk_scores (طبقة الذكاء).
// لا منطق أعمال هنا. يظهر إن كان المحرّك مفعّلاً فقط.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { AlertTriangle, Phone } from 'lucide-react'

type RiskItem = {
  student_id: string; student_name: string; student_code: string
  guardian: string; phone: string | null
  outstanding: number; overdue_count: number; oldest_days: number
  score: number; level: string; action: string
}

const levelColor = (lvl: string) => lvl === 'عالية' ? '#B42318' : lvl === 'متوسّطة' ? '#B54708' : '#5A6B7B'
const levelBg = (lvl: string) => lvl === 'عالية' ? '#FEF0F0' : lvl === 'متوسّطة' ? '#FFF6ED' : '#F2F4F7'

export default function RiskIndicator({ currency }: { currency: string }) {
  const supabase = createClient()
  const [items, setItems] = useState<RiskItem[] | null>(null)
  const [disabled, setDisabled] = useState(false)
  const sym = currency === 'OMR' ? 'ر.ع' : currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n || 0)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.rpc('risk_scores')
      if (!active) return
      const d = data as { ok?: boolean; disabled?: boolean; items?: RiskItem[] } | null
      if (d?.disabled) { setDisabled(true); return }
      setItems(d?.items ?? [])
    })()
    return () => { active = false }
  }, [supabase])

  if (disabled) return null            // المحرّك معطّل من الإعدادات
  if (items === null) return null       // يُحمّل
  if (items.length === 0) return null    // لا مخاطر — لا نُظهر شيئاً

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <AlertTriangle size={19} color="#B54708" />
        <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>مؤشّر خطورة التعثّر</h2>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 16px' }}>
        ترتيب أولياء الأمور حسب احتمال تأخّر السداد — لمتابعة استباقية تحسّن التحصيل.
      </p>

      <div style={{ overflowX: 'auto', border: '1px solid #EEF1F5', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
          <thead>
            <tr style={{ background: '#F4F8F7', textAlign: 'right' }}>
              <th style={th}>الطالب / ولي الأمر</th>
              <th style={th}>المستحق</th>
              <th style={th}>فواتير متأخرة</th>
              <th style={th}>أقدم تأخّر</th>
              <th style={th}>الخطورة</th>
              <th style={th}>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 15).map((r) => (
              <tr key={r.student_id}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: '#0F1B2D' }}>{r.student_name}</div>
                  <div style={{ fontSize: 12, color: '#8A94A6' }}>{r.guardian} · {r.student_code}</div>
                </td>
                <td style={{ ...td, direction: 'ltr', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.outstanding)} {sym}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.overdue_count}</td>
                <td style={{ ...td, textAlign: 'center' }}>{r.oldest_days} يوم</td>
                <td style={td}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: levelBg(r.level), color: levelColor(r.level), fontWeight: 700, fontSize: 12.5, padding: '3px 10px', borderRadius: 20 }}>
                    {r.score} · {r.level}
                  </span>
                </td>
                <td style={td}>
                  {r.phone ? (
                    <a href={`tel:${r.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#1E5C4E', textDecoration: 'none' }}>
                      <Phone size={13} /> {r.action}
                    </a>
                  ) : (
                    <span style={{ fontSize: 12.5, color: '#667' }}>{r.action}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const th: React.CSSProperties = { padding: 11, fontSize: 12.5, color: '#0F2744', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: 11, fontSize: 13.5, borderTop: '1px solid #EEF1F5' }
