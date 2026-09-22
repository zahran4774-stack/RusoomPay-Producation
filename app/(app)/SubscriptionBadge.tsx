'use client'
// app/(app)/SubscriptionBadge.tsx
// شارة صغيرة تعرض نوع باقة اشتراك المدرسة وحالتها بلون واضح — تُدرَج في
// AppShell (الشريط الجانبي/الهيدر). تُحمَّل من الخادم عبر my_subscription_status()
// وتُمرَّر كـprop جاهزة، بنفس نمط RiskIndicator اليوم — بلا useEffect ولا وميض.
export type SubscriptionInfo = {
  ok: boolean
  plan?: string
  plan_label?: string
  status?: string
  color?: 'green' | 'orange' | 'red'
  days_left?: number | null
  effective_date?: string | null
} | null

const COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#E6F4EC', text: '#1A7A45', dot: '#1A7A45' },
  orange: { bg: '#FFF3E2', text: '#B45309', dot: '#F59E0B' },
  red:    { bg: '#FDEEED', text: '#C0392B', dot: '#C0392B' },
}

export default function SubscriptionBadge({ info, collapsed = false }: { info: SubscriptionInfo; collapsed?: boolean }) {
  if (!info?.ok) return null
  const c = COLORS[info.color ?? 'green'] ?? COLORS.green

  const tooltip = info.days_left != null
    ? info.color === 'red'
      ? 'انتهى الاشتراك — يرجى التجديد'
      : `متبقٍ ${info.days_left} يوماً على التجديد`
    : ''

  if (collapsed) {
    // شكل مصغّر لنقطة فقط — مناسب لوضع الشريط الجانبي المطوي
    return (
      <span
        title={`${info.plan_label ?? ''} — ${tooltip}`}
        style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
          background: c.dot, flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      title={tooltip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: c.bg, color: c.text, borderRadius: 20,
        padding: '5px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      <span>باقة {info.plan_label}</span>
      {info.days_left != null && info.color !== 'red' && (
        <span style={{ opacity: 0.75, fontWeight: 600 }}>· {info.days_left} يوم</span>
      )}
      {info.color === 'red' && <span style={{ fontWeight: 800 }}>· منتهي</span>}
    </div>
  )
}
