const CACHE_NAME = 'sooull-shell-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/sooull-mark.svg']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('sooull-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Only immutable, same-origin build assets are cached. Never cache auth,
  // API, profile, wallet, story, or other private account responses.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') await cache.put(request, response.clone())
      return response
    })())
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put('/', response.clone())
        }
        return response
      } catch {
        const cached = await caches.match('/')
        return cached || new Response('SOOULL is offline. Reconnect to access your private account data.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })())
  }
})
