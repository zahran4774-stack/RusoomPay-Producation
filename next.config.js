/** @type {import('next').NextConfig} */
const nextConfig = {
 reactStrictMode: true,
 // يضمن توافق البناء مع بيئة Netlify (Next.js Runtime)
 eslint: {
   // لا توقف البناء بسبب تحذيرات ESLint (يمكن تشديدها لاحقاً)
   ignoreDuringBuilds: true,
 },
 typescript: {
   // لا توقف البناء بسبب أخطاء نوع غير حرجة أثناء الإطلاق الأول
   ignoreBuildErrors: false,
 },
 // تشجير دقيق لـ lucide-react — يحمّل الأيقونات المستخدمة فقط
 // بدل استيراد المكتبة كاملة (آلاف الأيقونات)
 experimental: {
   optimizePackageImports: ['lucide-react'],
 },
 // هيدرز أمان حقيقية على مستوى الويب — تُطبَّق على كل صفحة.
 // ملاحظة مهمة: هذي حماية طبقة الويب (متصفح)، لا علاقة لها بمفاهيم
 // native mobile binary (Frida/root detection/SSL pinning/Play Integrity) —
 // تلك المفاهيم لا تنطبق على تطبيق ويب/PWA لأنه لا يوجد ثنائي مُصرَّف
 // (APK/IPA) يُحمَّى أو يُختبَر اختراقه بتلك الأدوات؛ RusoomPay حالياً Next.js
 // PWA بدون أي غلاف Kotlin/Swift/Capacitor/React Native فعلي بالمستودع.
 async headers() {
   const supabaseHost = (() => {
     try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').host } catch { return '*.supabase.co' }
   })()
   const csp = [
     "default-src 'self'",
     // Next.js يحتاج 'unsafe-inline' لسكربتات hydration الداخلية، و'unsafe-eval'
     // بيئة التطوير فقط (غير مطلوبة بالإنتاج لكن غير ضارة لو بقيت)
     `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,
     `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
     `img-src 'self' data: blob: https:`,
     `font-src 'self' data: https://fonts.gstatic.com`,
     // الاتصال بـSupabase وThawani (الدفع) والتحقق الأمني Turnstile فقط —
     // لا نطاقات أخرى مسموحة، يمنع تسريب بيانات لجهات غير معروفة عبر XSS
     `connect-src 'self' https://${supabaseHost} https://checkout.thawani.om https://uatcheckout.thawani.om https://challenges.cloudflare.com`,
     // ثواني تحتاج تضمين صفحة الدفع بإطار (checkout) — لا أحد غيرها
     `frame-src https://challenges.cloudflare.com https://checkout.thawani.om https://uatcheckout.thawani.om`,
     // ⚠️ الحماية الأهم بهذا القسم: منع تضمين موقعنا نفسه بإطار خارجي —
     // هذا هو "anti-clickjacking" الحقيقي على الويب (لا يوجد "tapjacking"
     // بمفهوم الويب؛ الحماية المكافئة له هنا نفسها frame-ancestors)
     "frame-ancestors 'self'",
     "base-uri 'self'",
     "form-action 'self' https://checkout.thawani.om https://uatcheckout.thawani.om",
   ].join('; ')

   return [
     {
       source: '/:path*',
       headers: [
         { key: 'Content-Security-Policy', value: csp },
         // نفس الحماية بصياغة أقدم لمتصفحات لا تدعم frame-ancestors
         { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
         { key: 'X-Content-Type-Options', value: 'nosniff' },
         { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
         { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
         // يفرض HTTPS على المتصفح لمدة سنة، ويشمل النطاقات الفرعية —
         // يمنع أي محاولة تراجع لـHTTP غير مشفّر (SSL stripping)
         { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
       ],
     },
   ]
 },
};
module.exports = nextConfig;
