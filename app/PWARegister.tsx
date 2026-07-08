'use client'
// تسجيل Service Worker لدعم العمل دون اتصال + شريط تنبيه عند انقطاع الإنترنت
import { useEffect, useState } from 'react'

export default function PWARegister() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // تسجيل Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // فشل التسجيل لا يكسر التطبيق — يبقى يعمل أونلاين عادياً
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
