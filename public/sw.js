ً
// RusoomPay Service Worker — (اﻃّﻼع ﻋﻠﻰ آﺧﺮ ﺑﯿﺎﻧﺎت) دﻋﻢ اﻟﻌﻤﻞ دون اﺗﺼﺎل.ﻟﻸﺻﻮل اﻟﺜﺎﺑﺘﺔ Cache-first ،ﻟﻠﺼﻔﺤﺎت Network-first :اﺳﺘﺮاﺗﯿﺠﯿﺔ //
— اﻟﺪﯾﻨﺎﻣﯿﻜﯿﺔ ﺗﻤﺎﻣﺎً Next وﺑﯿﺎﻧﺎت RSC (?_rsc) ﻣﮭﻢ: ﻧﺘﺠﺎھﻞ ﻃﻠﺒﺎت //

//      .اﻋﺘﺮاﺿﮭﺎ ﻛﺎن ﯾﺒﻄّﺊ ﻛﻞ ﺗﻨﻘّﻞ وﯾﺨﺰّن ﺑﯿﺎﻧﺎت دﯾﻨﺎﻣﯿﻜﯿﺔ ﺧﻄ
ﺄ
const CACHE = 'edupay-v2'   // رﻓﻌﻨﺎ اﻹﺻﺪار ﻟﯿُﻤﺴﺢ اﻟﻜﺎش اﻟﻘﺪﯾﻢ اﻟﻤﻠﻮّث
const OFFLINE_URL = '/offline'
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
  if (request.method !== 'GET') return
  const url = new URL(request.url)ﻻ ﻧﻌﺘﺮض — API ﺧﺎرج اﻷﺻﻞ، أو // 
 
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return═══ اﻟﺪﯾﻨﺎﻣﯿﻜﯿﺔ ﺗﻤﺎﻣﺎً Next وﺑﯿﺎﻧﺎت RSC ﺣﺮج: ﺗﺠﺎھﻞ ﻃﻠﺒﺎت ═══ // 
 .ﻣﺒﺎﺷﺮة ﺑﻼ اﻋﺘﺮاض Next ﯾﺠﺐ أن ﺗﺼﻞ — React Server Components ھﺬه ﺗﻨﻘّﻼت // 
 .اﻋﺘﺮاﺿﮭﺎ ﻛﺎن ﯾﺒﻄّﺊ ﻛﻞ ﻧﻘﺮة وﯾﺨﺰّن ﺑﯿﺎﻧﺎت ﻣﺘﻐﯿّﺮة ﻛﺄﻧﮭﺎ ﺛﺎﺑﺘﺔ // 
 
  if (
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1'
  ) {
    return // ًاﺗﺮك اﻟﻤﺘﺼﻔﺢ ﯾﺘﻮﻻّھﺎ ﻃﺒﯿﻌﯿﺎ
  }
network-first :)HTML ﺗﺤﻤﯿﻞ ﺻﻔﺤﺔ( اﻟﺘﻨﻘّﻞ اﻟﻜﺎﻣﻞ // 
 
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
  }cache-first :اﻷﺻﻮل اﻟﺜﺎﺑﺘﺔ ﻓﻘﻂ // 
 
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
