'use client'

export default function SentryTest() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }} dir="rtl">
      <h1 style={{ color: '#0F2744' }}>اختبار تنبيه Sentry</h1>
      <button
        onClick={() => { throw new Error('اختبار تنبيه البريد — RusoomPay') }}
        style={{ background: '#C0392B', color: '#fff', border: 0, borderRadius: 10,
                 padding: '12px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20 }}
      >
        أحدث خطأ للاختبار
      </button>
    </div>
  )
}
