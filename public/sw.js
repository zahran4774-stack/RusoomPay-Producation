// Service Worker معطّل عمداً — أزلناه.
// Next.js يدير كاش الأصول تلقائياً عبر hash المحتوى (immutable).
// أي نسخة قديمة مسجّلة من هذا الـSW تلغي نفسها وتمسح كاشاتها عند فحص التحديث.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll()
      clients.forEach((c) => c.navigate(c.url))
    })()
  )
})
// لا نعترض أي طلب — كل شيء يمرّ للشبكة/كاش المتصفح الطبيعي.
