// صفحة بديلة تظهر عند انقطاع الإنترنت وعدم وجود نسخة مخزّنة للصفحة المطلوبة
export const metadata = { title: 'لا اتصال — RusoomPay' }

export default function OfflinePage() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0A1D33', padding: 24 }} dir="rtl">
      <div style={{ textAlign: 'center', maxWidth: 420, color: '#fff' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📡</div>
        <h1 style={{ fontSize: 24, margin: '0 0 10px', fontFamily: 'Cairo' }}>لا يوجد اتصال بالإنترنت</h1>
        <p style={{ fontSize: 15, lineHeight: 1.9, opacity: .85, margin: '0 0 24px' }}>
          تعذّر تحميل هذه الصفحة لانقطاع الاتصال. يمكنك تصفّح الصفحات التي زرتها سابقاً للاطّلاع على آخر البيانات المحفوظة.
          <br /><br />
          <b style={{ color: '#D4A017' }}>ملاحظة:</b> إضافة أو تعديل البيانات (الدفع، الفواتير) تتطلب اتصالاً بالإنترنت لضمان دقّة وأمان حساباتك.
        </p>
        <a href="/" style={{ display: 'inline-block', background: '#D4A017', color: '#08172B', padding: '12px 28px', borderRadius: 11, fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
          إعادة المحاولة
        </a>
      </div>
    </div>
  )
}
