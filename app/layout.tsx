import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import PWARegister from './PWARegister'
import ClickSound from './ClickSound'
import AiAssistant from '../components/help/AiAssistant' // ← المساعد الذكي (مسار نسبي)

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'RusoomPay — منصة إدارة رسوم المدارس الذكية',
  description:
    'RusoomPay — منصة ذكية لإدارة رسوم المدارس مدعومة بالذكاء الاصطناعي تساعد إدارة المدرسة على اتخاذ القرارات الذكية وتحصيل الرسوم بشكل منظم وأسرع',
  manifest: '/manifest.webmanifest',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'RusoomPay — إدارة المدرسة بذكاء',
    description:
      'منصة مدعومة بالذكاء الاصطناعي لإدارة رسوم المدارس واتخاذ القرارات المالية الذكية في سلطنة عُمان ودول الخليج.',
    locale: 'ar_OM',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RusoomPay',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A1D33',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}>
        <PWARegister />
        <ClickSound />
        {children}
        {/* المساعد الذكي: زر عائم يظهر في كل الصفحات */}
        <AiAssistant />
      </body>
    </html>
  )
}
