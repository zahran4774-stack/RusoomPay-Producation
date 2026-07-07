import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWARegister from './PWARegister'
import ClickSound from './ClickSound'

export const metadata: Metadata = {
  title: 'RusoomPay — منظومة المدارس الذكية',
  description: 'نظام إدارة مالية للمدارس الخاصة في الخليج',
  manifest: '/manifest.webmanifest',
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
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <PWARegister />
        <ClickSound />
        {children}
      </body>
    </html>
  )
}
