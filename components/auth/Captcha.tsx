'use client'
// مكوّن حماية Cloudflare Turnstile — يُستخدم في كل صفحات التسجيل (مدرسة/موظف/ولي أمر)
// مجاني بالكامل بلا اشتراك ولا حدّ للاستخدام (خلافاً لـhCaptcha)، ومدعوم أصلاً في Supabase Auth.
// لا يحتاج مكتبة npm إضافية: يحمّل سكربت Turnstile مباشرة ويدير الودجت يدوياً.
// يتطلّب: NEXT_PUBLIC_TURNSTILE_SITE_KEY في متغيّرات البيئة (مفتاح عام، آمن بالتصميم).
import { useEffect, useId, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile?: {
      render: (container: string, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
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
  const containerId = `turnstile-${useId().replace(/:/g, '')}`
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return
    function tryRender() {
      if (window.turnstile && widgetId.current === null) {
        widgetId.current = window.turnstile.render(containerId, {
          sitekey: siteKey,
          callback: (token: string) => onVerify(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        })
      }
    }
    tryRender()
    const interval = setInterval(tryRender, 300)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) {
    // في التطوير بلا مفتاح: لا نعطّل التسجيل، فقط نتخطّى الودجت بصمت
    return null
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" async defer />
      <div id={containerId} />
    </>
  )
}
