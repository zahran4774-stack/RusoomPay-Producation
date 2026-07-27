'use client'

// ============================================================================
// components/help/ProductTour.tsx
// جولة تفاعلية تُضيء عناصر الصفحة وتشرحها، تظهر تلقائياً لأول دخول.
//
// الاستخدام:
//   1) ضع سمة data-tour على العناصر التي تريد شرحها في صفحتك:
//        <div data-tour="kpis"> ... </div>
//   2) أضف <ProductTour steps={[...]} /> في الصفحة.
//
// يتذكّر أن المستخدم أنهى الجولة عبر علم في profiles أو localStorage
// (هنا localStorage للبساطة؛ يمكن ربطه بحقل في قاعدة البيانات لاحقاً).
// ============================================================================

import { useState, useEffect, useCallback, useLayoutEffect } from 'react'

export type TourStep = {
  selector: string // مثل '[data-tour="kpis"]'
  title: string
  text: string
}

const STORAGE_KEY = 'rusoompay_tour_done_v1'

export default function ProductTour({
  steps,
  autoStart = true,
}: {
  steps: TourStep[]
  autoStart?: boolean
}) {
  const [active, setActive] = useState(false)
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // بدء تلقائي لأول دخول
  useEffect(() => {
    if (!autoStart) return
    let done = false
    try {
      done = localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      /* تجاهل */
    }
    if (!done && steps.length > 0) {
      const t = setTimeout(() => setActive(true), 700)
      return () => clearTimeout(t)
    }
  }, [autoStart, steps.length])

  // حساب موضع العنصر الحالي
  const measure = useCallback(() => {
    const step = steps[idx]
    if (!step) return
    const el = document.querySelector(step.selector)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => setRect(el.getBoundingClientRect()), 350)
    } else {
      // العنصر غير موجود في هذه الصفحة — تخطَّ
      setRect(null)
    }
  }, [idx, steps])

  useLayoutEffect(() => {
    if (active) measure()
  }, [active, idx, measure])

  useEffect(() => {
    if (!active) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [active, measure])

  const finish = useCallback(() => {
    setActive(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* تجاهل */
    }
  }, [])

  const next = () => (idx >= steps.length - 1 ? finish() : setIdx((i) => i + 1))
  const prev = () => setIdx((i) => Math.max(0, i - 1))

  // زر إعادة الجولة (يظهر دائماً، صغير)
  const restart = () => {
    setIdx(0)
    setActive(true)
  }

  if (!active) {
    return (
      <button onClick={restart} style={T.restartBtn} aria-label="جولة تعريفية">
        🎯 جولة تعريفية
      </button>
    )
  }

  const step = steps[idx]
  const toAr = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

  // موضع البطاقة
  let cardTop = 120
  let cardLeft = 20
  if (rect) {
    cardTop = rect.bottom + 14
    if (cardTop + 190 > window.innerHeight) cardTop = Math.max(10, rect.top - 196)
    cardLeft = rect.left
    if (cardLeft + 320 > window.innerWidth) cardLeft = window.innerWidth - 334
    if (cardLeft < 14) cardLeft = 14
  }

  return (
    <>
      <div style={T.scrim} />
      {rect && (
        <div
          style={{
            ...T.highlight,
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div style={{ ...T.card, top: cardTop, left: cardLeft }}>
        <div style={T.stepOf}>
          الخطوة {toAr(idx + 1)} من {toAr(steps.length)}
        </div>
        <h4 style={T.cardTitle}>{step.title}</h4>
        <p style={T.cardText}>{step.text}</p>
        <div style={T.nav}>
          <div style={T.dots}>
            {steps.map((_, i) => (
              <span key={i} style={i === idx ? T.dotOn : T.dot} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={finish} style={T.ghost}>
              تخطّي
            </button>
            {idx > 0 && (
              <button onClick={prev} style={T.line}>
                السابق
              </button>
            )}
            <button onClick={next} style={T.primary}>
              {idx === steps.length - 1 ? 'تمّ ✓' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@media (prefers-reduced-motion: reduce){*{transition:none!important}}`}</style>
    </>
  )
}

const BRAND = '#0d7d6b'
const BRAND_DEEP = '#095a4e'
const INK = '#0A1D33'

const T: Record<string, React.CSSProperties> = {
  restartBtn: {
    background: '#fff', border: '1px solid #e3e9f0', color: INK,
    borderRadius: 10, padding: '9px 14px', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-cairo), sans-serif',
  },
  scrim: {
    position: 'fixed', inset: 0, background: 'rgba(10,29,51,.55)', zIndex: 9997,
  },
  highlight: {
    position: 'fixed', borderRadius: 12, zIndex: 9998, pointerEvents: 'none',
    boxShadow: `0 0 0 4px ${BRAND}, 0 0 0 9999px rgba(10,29,51,.55)`,
    transition: 'all .35s cubic-bezier(.4,0,.2,1)',
  },
  card: {
    position: 'fixed', zIndex: 9999, background: '#fff', borderRadius: 14,
    boxShadow: '0 16px 56px rgba(10,29,51,.28)', width: 320, maxWidth: '88vw',
    padding: 20, fontFamily: 'var(--font-cairo), sans-serif',
    transition: 'all .35s cubic-bezier(.4,0,.2,1)',
  },
  stepOf: { fontSize: 12, color: BRAND, fontWeight: 600, marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: INK, margin: '0 0 6px' },
  cardText: { fontSize: 13.5, color: '#5a6b7f', margin: '0 0 16px', lineHeight: 1.7 },
  nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dots: { display: 'flex', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: '50%', background: '#e3e9f0', display: 'block' },
  dotOn: { width: 20, height: 7, borderRadius: 4, background: BRAND, display: 'block' },
  ghost: {
    border: 'none', background: 'transparent', color: '#5a6b7f',
    padding: '8px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  line: {
    border: '1px solid #e3e9f0', background: '#fff', color: INK,
    padding: '8px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  primary: {
    border: 'none', background: BRAND, color: '#fff',
    padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
}
