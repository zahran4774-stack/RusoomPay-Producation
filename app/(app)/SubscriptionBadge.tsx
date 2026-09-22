'use client'
// app/(app)/SubscriptionBadge.tsx
// شارة صغيرة تعرض نوع باقة اشتراك المدرسة وحالتها بلون واضح — تُدرَج في
// AppShell (الشريط الجانبي/الهيدر). تُحمَّل من الخادم عبر my_subscription_status()
// وتُمرَّر كـprop جاهزة، بنفس نمط RiskIndicator اليوم — بلا useEffect ولا وميض.
// عند الحالة الحمراء (منتهي)، يظهر زر "تجديد" يفتح نافذة توجيه للتواصل
// المباشر مع فريق الدعم — لا تجديد تلقائي، المراجعة تتم يدوياً عبر
// Control Center من جهة المنصة.
import { useState } from 'react'

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

// معلومات تواصل الدعم — عدّلها لبيانات الدعم الفعلية لديك
const SUPPORT_PHONE = '96812345678'
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent('مرحباً، أرغب بتجديد اشتراك مدرستي في RusoomPay.')}`

export default function SubscriptionBadge({ info, collapsed = false }: { info: SubscriptionInfo; collapsed?: boolean }) {
  const [showRenew, setShowRenew] = useState(false)

  if (!info?.ok) return null
  const c = COLORS[info.color ?? 'green'] ?? COLORS.green
  const isExpired = info.color === 'red'

  const tooltip = info.days_left != null
    ? isExpired ? 'انتهى الاشتراك — يرجى التجديد' : `متبقٍ ${info.days_left} يوماً على التجديد`
    : ''

  if (collapsed) {
    return (
      <span
        title={`${info.plan_label ?? ''} — ${tooltip}`}
        style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }}
      />
    )
  }

  return (
    <>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
          {info.days_left != null && !isExpired && (
            <span style={{ opacity: 0.75, fontWeight: 600 }}>· {info.days_left} يوم</span>
          )}
          {isExpired && <span style={{ fontWeight: 800 }}>· منتهي</span>}
        </div>

        {isExpired && (
          <button
            onClick={() => setShowRenew(true)}
            style={{
              background: '#C0392B', color: '#fff', border: 0, borderRadius: 20,
              padding: '5px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            تجديد الباقة
          </button>
        )}
      </div>

      {showRenew && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,.5)', display: 'grid', placeItems: 'center', zIndex: 999, padding: 16 }}
          onClick={() => setShowRenew(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 18, padding: 26, width: '100%', maxWidth: 420, textAlign: 'center' }}
            dir="rtl"
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏳</div>
            <h3 style={{ color: '#0F2744', margin: '0 0 8px', fontSize: 18 }}>انتهى اشتراك مدرستك</h3>
            <p style={{ color: '#667', fontSize: 13.5, lineHeight: 1.9, marginBottom: 20 }}>
              باقتك الحالية <b>{info.plan_label}</b> انتهت. تواصل مع فريق الدعم لتجديد اشتراكك
              ومواصلة استخدام كل ميزات المنصة بلا انقطاع.
            </p>

            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#25D366', color: '#fff', padding: '13px 20px', borderRadius: 12,
                fontWeight: 700, fontSize: 14.5, textDecoration: 'none', marginBottom: 10,
              }}
            >
              💬 تواصل عبر واتساب
            </a>
            <a
              href={`tel:+${SUPPORT_PHONE}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: '#F2F5F8', color: '#0F2744', padding: '13px 20px', borderRadius: 12,
                fontWeight: 700, fontSize: 14.5, textDecoration: 'none', marginBottom: 16,
              }}
            >
              ✆ اتصال مباشر
            </a>

            <button
              onClick={() => setShowRenew(false)}
              style={{ width: '100%', background: 'none', border: 0, color: '#8A94A6', padding: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5 }}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  )
}
