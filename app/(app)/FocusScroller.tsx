'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function FocusScrollerInner() {
  const params = useSearchParams()
  const focus = params.get('focus')

  useEffect(() => {
    if (!focus) return
    const map: Record<string, string> = {
      overdue: 'overdue', pending: 'pending-payments',
      salary: 'salary-requests', low: 'low-stock',
    }
    const id = map[focus] ?? focus

    let attempts = 0
    const tryScroll = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.transition = 'box-shadow .4s, background .4s'
        el.style.boxShadow = '0 0 0 3px rgba(15,157,116,.35)'
        el.style.borderRadius = '14px'
        setTimeout(() => { el.style.boxShadow = 'none' }, 2400)
        return
      }
      // العنصر لم يُعرض بعد — أعد المحاولة لبضع مرات قصيرة
      attempts++
      if (attempts < 10) setTimeout(tryScroll, 150)
    }

    const initial = setTimeout(tryScroll, 100)
    return () => clearTimeout(initial)
  }, [focus])

  return null
}

export default function FocusScroller() {
  return (
    <Suspense fallback={null}>
      <FocusScrollerInner />
    </Suspense>
  )
}
