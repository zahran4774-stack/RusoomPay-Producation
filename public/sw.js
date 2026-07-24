// RusoomPay Service Worker — دعم العمل دون اتصال (اطّلاع على آخر بيانات)
// استراتيجية: Network-first للصفحات، Cache-first للأصول الثابتة.
// مهم: نتجاهل طلبات RSC (?_rsc) وبيانات Next الديناميكية تماماً —
//      اعتراضها كان يبطّئ كل تنقّل ويخزّن بيانات ديناميكية خطأً.
const CACHE = 'edupay-v4'   // رفعنا الإصدار ليُمسح الكاش القديم الملوّث
const OFFLINE_URL = '/offline'

const PRECACHE = ['/manifest.webmanifest']  // لا نُخزّن أي HTML مسبقاً — يمنع خدمة صفحة قديمة

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // احذف كل الكاشات القديمة (v2, v3...) تماماً
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      // تفعيل فوري على كل التبويبات المفتوحة
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // خارج الأصل، أو API — لا نعترض
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return

  // ═══ حرج: تجاهل طلبات RSC وبيانات Next الديناميكية تماماً ═══
  // هذه تنقّلات React Server Components — يجب أن تصل Next مباشرة بلا اعتراض.
  // اعتراضها كان يبطّئ كل نقرة ويخزّن بيانات متغيّرة كأنها ثابتة.
  if (
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  ) {
    return // اترك المتصفح يتولّاها طبيعياً
  }

  // ═══ التنقّل الكامل: لا نعترضه إطلاقاً ═══
  // اعتراضه بـnetwork-first كان يسبّب ومضة صفحة offline/تحميل على الشبكة البطيئة.
  // نترك المتصفح يحمّل الصفحات مباشرة — أسرع وبلا ومضة.
  if (request.mode === 'navigate') {
    return
  }

  // الأصول الثابتة فقط: cache-first
  if (/\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname) || url.pathname.startsWith('/_next/static')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        }).catch(() => cached)
      )
    )
  }
})
