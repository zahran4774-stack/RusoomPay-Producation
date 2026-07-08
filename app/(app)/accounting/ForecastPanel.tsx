'use client'
// app/(app)/accounting/ForecastPanel.tsx
// التنبّؤ بالتدفّق النقدي — يعرض فقط نتائج cashflow_forecast (طبقة الذكاء).
// لا منطق أعمال هنا. يظهر إن كان المحرّك مفعّلاً فقط.
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { TrendingUp } from 'lucide-react'

type Month = { month: string; due: number; expected: number }
type Forecast = { ok?: boolean; disabled?: boolean; collection_rate: number; total_expected_6m: number; months: Month[] }

export default function ForecastPanel({ currency }: { currency: string }) {
  const supabase = createClient()
  const [data, setData] = useState<Forecast | null>(null)
  const [disabled, setDisabled] = useState(false)
  const sym = currency === 'OMR' ? 'ر.ع' : currency
  const fmt = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n || 0)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: d } = await supabase.rpc('cashflow_forecast')
      if (!active) return
      const f = d as Forecast | null
      if (f?.disabled) { setDisabled(true); return }
      setData(f ?? null)
    })()
    return () => { active = false }
  }, [supabase])

  if (disabled || data === null) return null
  if (!data.months || data.months.length === 0) return null

  const maxExpected = Math.max(...data.months.map((m) => m.expected), 1)

  return (
    <section style={{ background: '#fff', border: '1px solid #E7EBF0', borderRadius: 16, padding: 22, marginTop: 18 }} dir="rtl">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
        <TrendingUp size={19} color="#1E5C4E" />
        <h2 style={{ color: '#0F2744', fontSize: '1.15rem', margin: 0 }}>التنبّؤ بالتدفّق النقدي</h2>
      </div>
      <p style={{ color: '#667', fontSize: 13.5, margin: '0 0 18px' }}>
        التحصيل المتوقّع للأشهر الستّة القادمة — مبنيّ على الفواتير المستحقّة ومعدّل التحصيل الفعلي ({data.collection_rate}%).
      </p>

      {/* الإجمالي المتوقّع */}
      <div style={{ display: 'inline-flex', flexDirection: 'column', background: '#F0F7F5', border: '1px solid #CDE5DD', borderRadius: 12, padding: '12px 18px', marginBottom: 18 }}>
        <span style={{ fontSize: 12, color: '#5A6B7B' }}>إجمالي المتوقّع تحصيله (6 أشهر)</span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F6E5F' }}>{fmt(data.total_expected_6m)} <span style={{ fontSize: 14, fontWeight: 600 }}>{sym}</span></span>
      </div>

      {/* مخطّط أعمدة بسيط */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160, paddingTop: 10 }}>
        {data.months.map((m) => {
          const h = Math.round((m.expected / maxExpected) * 130)
          return (
            <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0F1B2D', fontVariantNumeric: 'tabular-nums' }}>{fmt(m.expected)}</span>
              <div style={{ width: '100%', maxWidth: 46, height: Math.max(h, 4), background: 'linear-gradient(180deg,#34C79A,#0F9D74)', borderRadius: '6px 6px 0 0', transition: 'height .3s' }} />
              <span style={{ fontSize: 10.5, color: '#8A94A6' }}>{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 11.5, color: '#8A94A6', marginTop: 14, textAlign: 'center' }}>
        الأرقام تقديرية بناءً على أنماط السداد الحالية، وقد تتغيّر بتغيّر التحصيل الفعلي.
      </p>
    </section>
  )
}
