'use client'
// مكوّن حماية Cloudflare Turnstile — يُستخدم في كل صفحات التسجيل (مدرسة/موظف/ولي أمر)
// مجاني بالكامل بلا اشتراك ولا حدّ للاستخدام، ومدعوم أصلاً في Supabase Auth.
// لا يحتاج مكتبة npm إضافية: يحمّل سكربت Turnstile مباشرة ويدير الودجت يدوياً.
// ملاحظة مهمة: نمرّر عنصر DOM مباشرة (ref) لا نص الـid — لأن معرّفات React
// المولّدة عبر useId() قد تحوي رموزاً (مثل الشرطة السفلية المزدوجة) لا يتعرّف
// عليها Turnstile عند البحث بالـid كنص، فيفشل بخطأ "Unable to find a container"
// رغم أن العنصر موجود فعلياً في الصفحة.
// يتطلّب: NEXT_PUBLIC_TURNSTILE_SITE_KEY في متغيّرات البيئة (مفتاح عام، آمن بالتصميم).
import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false

    function tryRender() {
      if (cancelled) return
      if (window.turnstile && containerRef.current && widgetId.current === null) {
        // نمرّر عنصر DOM مباشرة — لا نص id — لتفادي مشاكل بحث CSS selector
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        })
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
    </>
  )
}
