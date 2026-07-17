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
};
module.exports = nextConfig;
