// app/Logo.tsx — شعار RusoomPay الرسمي (SVG حادّ على كل الأحجام)
// مشتقّ من حزمة الهوية. variant: 'horizontal' (أيقونة+اسم) أو 'mark' (أيقونة فقط).

const R_PATH = 'M30 24 h30 a22 22 0 0 1 0 44 h-8 l26 28 h-21 l-24 -26 v26 h-17 v-72 z M30 39 v16 h27 a8 8 0 0 0 0 -16 z'

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="RusoomPay" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="rp-em" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E8B6F" />
          <stop offset="100%" stopColor="#0B6E5F" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#rp-em)" />
      <path d={R_PATH} fill="#fff" />
      <path d="M64 22 l7 8 l16 -17" stroke="#BFE9D7" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ height = 56, dark = false }: { height?: number; dark?: boolean }) {
  const markSize = height
  const nameColor = dark ? '#fff' : '#0E2740'
  const payColor = dark ? '#34C79A' : '#0F9D74'
  const subColor = dark ? '#9FB3C7' : '#7A8493'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.28, direction: 'ltr' }}>
      <LogoMark size={markSize} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05 }}>
        <span style={{ fontSize: height * 0.5, fontWeight: 700, color: nameColor, letterSpacing: '-.5px' }}>
          Rusoom<span style={{ color: payColor }}>Pay</span>
        </span>
        <span style={{ fontSize: height * 0.19, fontWeight: 400, color: subColor, letterSpacing: '2.5px', marginTop: 2 }}>
          SCHOOL FEE PAYMENTS
        </span>
      </div>
    </div>
  )
}
