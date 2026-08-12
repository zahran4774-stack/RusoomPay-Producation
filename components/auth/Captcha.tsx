'use client'
// مكوّن حماية Cloudflare Turnstile — يُستخدم في كل صفحات التسجيل (مدرسة/موظف/ولي أمر)
// مجاني بالكامل بلا اشتراك ولا حدّ للاستخدام، ومدعوم أصلاً في Supabase Auth.
// لا يحتاج مكتبة npm إضافية: يحمّل سكربت Turnstile مباشرة ويدير الودجت يدوياً.
// ملاحظة مهمة: نمرّر عنصر DOM مباشرة (ref) لا نص الـid — لأن معرّفات React
// المولّدة عبر useId() قد تحوي رموزاً لا يتعرّف عليها Turnstile عند البحث
// بالـid كنص، فيفشل بخطأ "Unable to find a container" رغم وجود العنصر فعلياً.
// نعرض أيضاً نص حالة صريح ("جارٍ التحقّق…" ثم "✓ تم التحقّق") لأن ودجت
// Turnstile نفسه صغير وقد يمرّ المستخدم بثوانٍ صمت أثناء التحقّق التلقائي
// (وضع Managed) فيظن أن الصفحة "فريزت" دون أي مؤشر.
// يتطلّب: NEXT_PUBLIC_TURNSTILE_SITE_KEY في متغيّرات البيئة (مفتاح عام، آمن بالتصميم).
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
      getResponse: (id?: string) => string
    }
  }
}

type Status = 'loading' | 'verifying' | 'verified' | 'error'

export default function Captcha({
  onVerify,
  onExpire,
}: {
  onVerify: (token: string) => void
  onExpire?: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    function tryRender() {
      if (cancelled) return
      if (window.turnstile && containerRef.current && widgetId.current === null) {
        setStatus('verifying')
        try {
          // نمرّر عنصر DOM مباشرة — لا نص id — لتفادي مشاكل بحث CSS selector
          widgetId.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => { setStatus('verified'); onVerify(token) },
            'expired-callback': () => { setStatus('verifying'); onExpire?.() },
            'error-callback': () => { setStatus('error'); onExpire?.() },
          })
        } catch {
          setStatus('error')
        }
      }
    }
    tryRender()
    const interval = setInterval(tryRender, 300)
    return () => {
      cancelled = true
      clearInterval(interval)
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* تجاهل */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) {
    // في التطوير بلا مفتاح: لا نعطّل التسجيل، فقط نتخطّى الودجت بصمت
    return null
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" async defer />
      <div ref={containerRef} />
      <div style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {status === 'loading' && <span style={{ color: '#889' }}>جارٍ تحميل التحقّق الأمني…</span>}
        {status === 'verifying' && (
          <span style={{ color: '#B8860B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              border: '2px solid #E8DCC0', borderTopColor: '#B8860B',
              animation: 'cap-spin 0.8s linear infinite', display: 'inline-block',
            }} />
            جارٍ التحقّق أنك لست روبوتاً…
            <style jsx>{`@keyframes cap-spin { to { transform: rotate(360deg) } }`}</style>
          </span>
        )}
        {status === 'verified' && <span style={{ color: '#1E8E3E', fontWeight: 600 }}>✓ تم التحقّق بنجاح</span>}
        {status === 'error' && <span style={{ color: '#C0392B' }}>تعذّر التحقّق — أعد تحميل الصفحة وحاول مجدداً</span>}
      </div>
    </>
  )
}
