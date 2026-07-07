// RusoomPay Service Worker — دعم العمل دون اتصال (اطّلاع على آخر بيانات)
// استراتيجية: Network-first للصفحات (أحدث بيانات أولاً، وعند الانقطاع يعرض المخزّن)
//             Cache-first للأصول الثابتة (خطوط، أيقونات، JS/CSS)
const CACHE = 'edupay-v1'
const OFFLINE_URL = '/offline'

// أصول أساسية تُخزّن عند التثبيت
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // فقط GET — لا نخزّن عمليات الكتابة (POST/PUT) أبداً
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // لا نعترض طلبات Supabase/API — البيانات الحيّة تتطلب اتصالاً
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return

  // التنقّل بين الصفحات: network-first مع fallback للصفحة المخزّنة ثم offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // الأصول الثابتة: cache-first
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
