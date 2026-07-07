'use client'
// حدود الخطأ الجذرية — تلتقط الأخطاء في التخطيط الجذر نفسه (layout.tsx)
// تستبدل التخطيط كاملاً، لذا تتضمّن html/body وإعداداتها بنفسها
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('RusoomPay global error:', error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "'Cairo', sans-serif", background: '#F4F6FA', color: '#1A2530', minHeight: '100dvh' }}>
        <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 36, maxWidth: 420, textAlign: 'center', boxShadow: '0 10px 40px rgba(15,39,68,.08)' }}>
            <div style={{ fontSize: 46, marginBottom: 14 }}>🛠️</div>
            <h2 style={{ fontFamily: "'Cairo', sans-serif", color: '#0F2744', fontSize: 22, marginBottom: 10 }}>
              خطأ في تحميل التطبيق
            </h2>
            <p style={{ color: '#667', fontSize: 14, lineHeight: 1.9, marginBottom: 24 }}>
              حدث خطأ منع تحميل التطبيق بالكامل. أعِد التحميل، وإن استمرّت المشكلة تواصل مع الدعم الفني.
            </p>
            <button onClick={() => reset()}
              style={{ background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 28px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15 }}>
              إعادة التحميل
            </button>
            {error.digest && (
              <div style={{ marginTop: 18, fontSize: 11, color: '#9AA7B8' }}>رمز الخطأ: {error.digest}</div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
