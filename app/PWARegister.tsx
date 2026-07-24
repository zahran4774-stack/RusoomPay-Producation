'use client'
// إدارة الاتصال + إزالة Service Worker القديم نهائياً.
//
// قرار هندسي: أزلنا الـService Worker كلياً.
// السبب: Next.js يبصم كل أصوله بـhash المحتوى ويخدمها immutable —
// فإدارة الكاش تلقائية ومثالية. الـSW كان يضيف طبقة كاش ثانية بـcache-first
// تخدم أصولاً قديمة لا تطابق HTML الجديد بعد كل نشر → وميض وأعطال بصرية.
// ولنظام مالي، "العمل دون اتصال" غير مرغوب أصلاً (لا تسجيل دفعات على بيانات قديمة).
import { useEffect, useState } from 'react'

export default function PWARegister() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // ═══ إزالة أي Service Worker مسجّل سابقاً + مسح كل كاشاته ═══
    // يُنظّف النسخ العالقة (edupay-v2/v3/v4) على كل جهاز تلقائياً.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      }).catch(() => {})
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k))
      }).catch(() => {})
    }

    // مراقبة حالة الاتصال (شريط تنبيه فقط — بلا كاش)
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed', insetBlockStart: 0, insetInline: 0, zIndex: 10000,
        background: '#B8860B', color: '#fff', textAlign: 'center',
        padding: '8px 14px', fontSize: 13.5, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      }}
      dir="rtl"
    >
      📡 لا يوجد اتصال بالإنترنت. تحقّق من اتصالك للمتابعة.
    </div>
  )
}
