'use client'
// تسجيل Service Worker لدعم العمل دون اتصال + شريط تنبيه عند انقطاع الإنترنت
import { useEffect, useState } from 'react'

export default function PWARegister() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // تسجيل Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // افحص وجود تحديث فوراً (يستبدل النسخة القديمة العالقة)
        reg.update()
        // إن وصل SW جديد وأصبح جاهزاً، أعِد التحميل مرّة واحدة لتفعيله نظيفاً
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing
          if (!sw) return
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') {
              // لا نُعيد التحميل تلقائياً لتفادي أي وميض — التفعيل يكفي
            }
          })
        })
      }).catch(() => {
        // فشل التسجيل لا يكسر التطبيق
      })

      // عند تغيّر الـSW المتحكّم، لا نفعل شيئاً مزعجاً — فقط نضمن النظافة
      let refreshed = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshed) return
        refreshed = true
        // النسخة الجديدة تولّت التحكّم — لا إعادة تحميل قسرية
      })
    }
    // مراقبة حالة الاتصال
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
      📡 لا يوجد اتصال — تتصفّح آخر بيانات محفوظة. التعديل والدفع يتطلّبان اتصالاً.
    </div>
  )
}
