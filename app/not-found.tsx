// صفحة 404 — تظهر عند زيارة رابط غير موجود
export default function NotFound() {
  return (
    <div dir="rtl" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#F4F6FA', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 36, maxWidth: 420, textAlign: 'center', boxShadow: '0 10px 40px rgba(15,39,68,.08)' }}>
        <div style={{ fontSize: 52, fontWeight: 800, color: '#163B68', fontFamily: 'Cairo, sans-serif' }}>404</div>
        <h2 style={{ color: '#0F2744', fontSize: 20, margin: '8px 0 10px' }}>الصفحة غير موجودة</h2>
        <p style={{ color: '#667', fontSize: 14, lineHeight: 1.9, marginBottom: 24 }}>
          الرابط الذي طلبته غير موجود أو تم نقله.
        </p>
        <a href="/dashboard"
          style={{ display: 'inline-block', background: '#163B68', color: '#fff', borderRadius: 11, padding: '12px 28px', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>
          العودة للوحة المعلومات
        </a>
      </div>
    </div>
  )
}
