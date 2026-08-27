'use client'
// app/(app)/fees/RiskIndicator.tsx
// مؤشّر خطورة التعثّر — يعرض فقط نتائج محرّك risk_scores (طبقة الذكاء).
// لا منطق أعمال هنا. يظهر إن كان المحرّك مفعّلاً فقط.
// تحديث: زر "إرسال تذكير ودّي" يستخدم الآن قالب fee_reminder المعتمد من Twilio
// بدل النص الحر — النص الحر يفشل خارج نافذة 24 ساعة من رسالة المستلم.
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

const th: React.CSSProperties = { padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: '#475467', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13.5, color: '#1D2939', borderTop: '1px solid #EEF1F5', verticalAlign: 'top' }

const PAGE_SIZE = 6

export default function RiskIndicator({ currency }: { currency: string }) {
  const supabase = createClient()
  const [items, setItems] = useState<RiskItem[] | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [page, setPage] = useState(1)
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

  if (disabled) return null
  if (items === null) return null
  if (items.length === 0) return null

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
            {pageItems.map((r) => (
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
                    <button
                      onClick={async () => {
                        if (!r.phone) { alert('لا يوجد رقم لولي الأمر'); return }
                        let school = 'مدرستكم'
                        const { data: sch } = await supabase.from('schools').select('name').limit(1).single()
                        if (sch?.name) school = sch.name
                        // تطبيع الرقم العُماني: نزيل المسافات والرموز، ونضمن رمز الدولة 968
let raw = (r.phone || '').replace(/[\s\-()]/g, '')
if (raw.startsWith('+')) raw = raw.slice(1)
if (raw.startsWith('00')) raw = raw.slice(2)
if (!raw.startsWith('968') && raw.length === 8) raw = '968' + raw  // رقم عُماني محلي (8 أرقام)
const to = `+${raw}`

                        try {
                          const res = await fetch('/api/send-whatsapp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              to,
                              template: 'fee_reminder',
                              variables: {
                                '1': school,
                                '2': r.guardian || 'ولي الأمر',
                                '3': r.student_name,
                                '4': fmt(r.outstanding),
                              },
                            }),
                          })
                          const data = await res.json()
                          alert(data.success ? 'تم إرسال التذكير عبر واتساب ✅' : 'فشل الإرسال: ' + (data.error || 'خطأ'))
                        } catch (e) {
                          alert('خطأ في الإرسال')
                        }
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, background: 'none', border: 'none', color: '#0F9D74', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      💬 إرسال تذكير ودّي
                    </button>
                  ) : (
                    <span style={{ fontSize: 12.5, color: '#667' }}>{r.action}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{
              padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDE3EC', background: '#fff',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
              cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.5 : 1,
            }}>
            ‹ السابق
          </button>
          <span style={{ fontSize: 13.5, color: '#556', padding: '0 8px' }}>
            صفحة {safePage} من {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{
              padding: '9px 14px', borderRadius: 10, border: '1.5px solid #DDE3EC', background: '#fff',
              fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
              cursor: safePage === totalPages ? 'default' : 'pointer', opacity: safePage === totalPages ? 0.5 : 1,
            }}>
            التالي ›
          </button>
        </div>
      )}
    </section>
  )
}
