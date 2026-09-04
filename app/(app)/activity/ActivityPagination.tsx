import Link from 'next/link'

export default function ActivityPagination({
  page, totalPages, buildHref,
}: {
  page: number
  totalPages: number
  buildHref: (page: number) => string
}) {
  if (totalPages <= 1) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 20 }}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)} style={navBtn}>‹ السابق</Link>
      ) : (
        <span style={{ ...navBtn, opacity: 0.4, pointerEvents: 'none' }}>‹ السابق</span>
      )}
      <span style={{ fontSize: 13.5, color: '#667', fontWeight: 600 }}>صفحة {page} من {totalPages}</span>
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} style={navBtn}>التالي ›</Link>
      ) : (
        <span style={{ ...navBtn, opacity: 0.4, pointerEvents: 'none' }}>التالي ›</span>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 10, border: '1.5px solid #DDE3EC', background: '#fff',
  color: '#0F2744', fontWeight: 700, fontSize: 13.5, textDecoration: 'none', fontFamily: 'inherit',
}
