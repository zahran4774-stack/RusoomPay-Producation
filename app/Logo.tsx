// app/Logo.tsx — شعار RusoomPay الرسمي (الشعار الجديد كصورة)
// variant: 'horizontal' (أيقونة+اسم) أو 'mark' (أيقونة فقط).

import Image from 'next/image'

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="RusoomPay"
      width={size}
      height={size}
      priority
      style={{ display: 'block', borderRadius: size * 0.22 }}
    />
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
