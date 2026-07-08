// شاشة التحميل — تظهر أثناء جلب بيانات الصفحة (تغذية بصرية بدل شاشة جامدة)
export default function Loading() {
  return (
    <div dir="rtl" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 44, height: 44, margin: '0 auto 16px', borderRadius: '50%',
          border: '3px solid #E5EAF2', borderTopColor: '#163B68',
          animation: 'edupaySpin .8s linear infinite',
        }} />
        <div style={{ color: '#667', fontSize: 14 }}>جارٍ التحميل…</div>
      </div>
      <style>{`@keyframes edupaySpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
