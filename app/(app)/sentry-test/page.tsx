'use client'

export default function SentryTest() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }} dir="rtl">
      <h1 style={{ color: '#0F2744' }}>اختبار Sentry</h1>
      <p style={{ color: '#667', margin: '12px 0 24px' }}>
        اضغط الزر لإحداث خطأ متعمّد — يجب أن يظهر في لوحة Sentry خلال دقيقة.
      </p>
      <button
        onClick={() => {
          throw new Error('اختبار Sentry — خطأ متعمّد من RusoomPay')
        }}
        style={{ background: '#C0392B', color: '#fff', border: 0, borderRadius: 10,
                 padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
      >
        أحدث خطأ تجريبي
      </button>
    </div>
  )
}
