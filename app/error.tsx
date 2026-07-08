'use client'
// حدود الخطأ العامة — تلتقط أي خطأ غير متوقّع وتعرض واجهة لطيفة بدل شاشة بيضاء
// (تعالج الحالات الحديّة مثل انقطاع الشبكة أثناء جلب البيانات)
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // تسجيل الخطأ (يمكن ربطه بخدمة مراقبة مثل Sentry لاحقاً)
    console.error('RusoomPay error:', error)
  }, [error])

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F4F6FA', padding: 24, fontFamily: 'inherit' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 36, maxWidth: 420, textAlign: 'center', boxShadow: '0 10px 40px rgba(15,39,68,.08)' }}>
        <div style={{ fontSize: 46, marginBottom: 14 }}>⚠️</div>
        <h2 style={{ color: '#0F2744', fontSize: 22, marginBottom: 10 }}>حدث خطأ غير متوقّع</h2>
        <p style={{ color: '#667', fontSize: 14, lineHeight: 1.9, marginBottom: 24 }}>
          تعذّر إكمال العملية. قد يكون السبب انقطاعاً مؤقتاً في الاتصال. حاول مرة أخرى، وإن تكرّر الأمر تواصل مع الدعم.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => reset()}
            style={{ background: '#163B68', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 24px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15 }}>
            إعادة المحاولة
          </button>
          <a href="/dashboard"
            style={{ background: '#F0F3F8', color: '#0F2744', borderRadius: 11, padding: '12px 24px', fontWeight: 600, textDecoration: 'none', fontSize: 15 }}>
            العودة للوحة المعلومات
          </a>
        </div>
        {error.digest && (
          <div style={{ marginTop: 18, fontSize: 11, color: '#9AA7B8' }}>رمز الخطأ: {error.digest}</div>
        )}
      </div>
    </div>
  )
}
