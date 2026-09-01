'use client'
// اشتراكات التشغيل — فواتير المزوّدين (Supabase, Netlify, Twilio...) من مشروع
// byzantium-pillow المنفصل. تُحدَّث كل 60 ثانية (بيانات مالية بطيئة التغيّر، لا تحتاج
// تحديث كل ثوانٍ مثل صحّة الأدوات).
import { useEffect, useRef, useState } from 'react'

type SubItem = {
  vendor: string
  status: string
  currency: string
  amount: number
  amount_base_omr: number | null
  billing_interval: string
  next_payment_date: string | null
  last_payment_date: string | null
  is_unused: boolean
  health_score: number | null
}
type Summary = { items: SubItem[]; estimated_monthly_total_omr: number; generated_at: string }

const STATUS_AR: Record<string, string> = { active: 'نشط', trial: 'تجريبي', cancelled: 'ملغى', past_due: 'متأخّر السداد', paused: 'موقوف' }
const INTERVAL_AR: Record<string, string> = { monthly: 'شهري', yearly: 'سنوي', usage: 'حسب الاستهلاك', one_time: 'مرّة واحدة' }

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000)
}

export default function OpsSubscriptionsPanel() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    try {
      const res = await fetch('/api/platform/subscriptions', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'فشل الجلب'); return }
      setData(json)
      setError(null)
    } catch {
      setError('تعذّر الاتصال بخادم اشتراكات التشغيل')
    }
  }

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 60000) // بيانات مالية — تحديث كل دقيقة كافٍ
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  if (error && !data) {
    return (
      <div style={{ background: '#FCE9E6', border: '1px solid #F0C4BC', borderRadius: 13, padding: 16, color: '#C0392B', fontSize: 13.5 }}>
        ⚠️ {error}
      </div>
    )
  }
  if (!data) return <div style={{ color: '#8A94A6', fontSize: 13.5, padding: 12 }}>جارٍ التحميل…</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, color: '#8A94A6' }}>
          إجمالي تقديري شهرياً: <b style={{ fontFamily: 'Cairo', color: '#0A1D33', fontSize: 15 }}>{data.estimated_monthly_total_omr.toFixed(3)} ر.ع</b>
        </div>
        <span style={{ fontSize: 11, color: '#8A94A6' }}>المصدر: byzantium-pillow</span>
      </div>

      {data.items.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 13, padding: 24, textAlign: 'center', color: '#9AA7B8', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          لا توجد اشتراكات مسجّلة
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ background: '#F7F9FC', textAlign: 'right' }}>
                <th style={{ padding: '10px 14px', color: '#8A94A6', fontWeight: 600 }}>المزوّد</th>
                <th style={{ padding: '10px 14px', color: '#8A94A6', fontWeight: 600 }}>الحالة</th>
                <th style={{ padding: '10px 14px', color: '#8A94A6', fontWeight: 600 }}>التكلفة</th>
                <th style={{ padding: '10px 14px', color: '#8A94A6', fontWeight: 600 }}>الدورة</th>
                <th style={{ padding: '10px 14px', color: '#8A94A6', fontWeight: 600 }}>التجديد القادم</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => {
                const days = daysUntil(it.next_payment_date)
                const renewColor = days === null ? '#8A94A6' : days <= 3 ? '#C0392B' : days <= 10 ? '#8A6D0F' : '#69757F'
                return (
                  <tr key={i} style={{ borderTop: '1px solid #EEF1F5' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#0A1D33' }}>
                      {it.vendor} {it.is_unused && <span title="غير مستخدم فعلياً" style={{ marginInlineStart: 6, fontSize: 11, color: '#D4A017' }}>⚠️ غير مستخدَم</span>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        background: it.status === 'active' ? '#E6F4EC' : '#F2E8E6',
                        color: it.status === 'active' ? '#1A7A45' : '#8A4B3F',
                        fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                      }}>
                        {STATUS_AR[it.status] ?? it.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'Cairo', fontWeight: 700, color: '#0A1D33' }}>
                      {it.amount.toFixed(3)} {it.currency}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#69757F' }}>{INTERVAL_AR[it.billing_interval] ?? it.billing_interval}</td>
                    <td style={{ padding: '11px 14px', color: renewColor, fontWeight: days !== null && days <= 10 ? 700 : 400 }}>
                      {it.next_payment_date ? `${it.next_payment_date} (${days} يوم)` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
