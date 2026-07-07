'use client'
// صوت نقر لطيف عند الضغط على أي زر/رابط — مستمع عام واحد يغطّي كل التطبيق
import { useEffect } from 'react'

export default function ClickSound() {
  useEffect(() => {
    let actx: AudioContext | null = null

    function playClick() {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        if (!actx) actx = new AC()
        if (actx.state === 'suspended') actx.resume()
        const o = actx.createOscillator()
        const g = actx.createGain()
        const t = actx.currentTime
        o.type = 'sine'
        o.frequency.setValueAtTime(620, t)
        o.frequency.exponentialRampToValueAtTime(880, t + 0.03)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
        o.connect(g); g.connect(actx.destination)
        o.start(t); o.stop(t + 0.1)
      } catch { /* المتصفح لا يدعم الصوت — نتجاهل */ }
    }

    function onClick(ev: MouseEvent) {
      const el = (ev.target as HTMLElement)?.closest(
        'button, a, [role="button"], select, input[type="button"], input[type="submit"]'
      )
      if (el) playClick()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
