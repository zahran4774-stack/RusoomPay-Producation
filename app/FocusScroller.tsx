'use client'
// app/(app)/FocusScroller.tsx
// يقرأ ?focus=<id> من الرابط، يمرّر لذلك القسم ويُبرزه لحظياً.
// يُستخدم لتوجيه المستخدم من School Copilot مباشرةً للبيانات المعنيّة.
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
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.transition = 'box-shadow .4s, background .4s'
    el.style.boxShadow = '0 0 0 3px rgba(15,157,116,.35)'
    el.style.borderRadius = '14px'
    const t = setTimeout(() => { el.style.boxShadow = 'none' }, 2400)
    return () => clearTimeout(t)
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

