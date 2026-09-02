/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    const supabaseHost = (() => {
      try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch { return '*.supabase.co' }
    })()
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `img-src 'self' data: blob: https:`,
      `font-src 'self' data: https://fonts.gstatic.com`,
      `connect-src 'self' https://${supabaseHost} https://checkout.thawani.om https://uatcheckout.thawani.om https://challenges.cloudflare.com https://*.sentry.io https://*.ingest.de.sentry.io`,
      `frame-src https://challenges.cloudflare.com https://checkout.thawani.om https://uatcheckout.thawani.om`,
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.thawani.om https://uatcheckout.thawani.om",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = withSentryConfig(nextConfig, {
  org: 'autocare-yu',
  project: 'rusoompay',
  silent: true,
  // لا يرفع خرائط المصدر تلقائياً — يتطلب auth token، نتركه بسيطاً الآن
  sourcemaps: { disable: true },
  // يعطّل تعليمات Sentry الإضافية التي قد تبطئ البناء
  disableLogger: true,
})
