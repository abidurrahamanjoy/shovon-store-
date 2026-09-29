const CACHE_NAME = 'shuvon-store-v6';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML: cache-first for instant repeat visits, then refresh in background.
  // The new service-worker version invalidates the old shell after deployment.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('/index.html');
      const network = fetch(event.request).then((response) => {
        if (response.ok) cache.put('/index.html', response.clone());
        return response;
      }).catch(() => null);
      return cached || await network || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // Firebase configuration should refresh after every deployment, with cache fallback offline.
  if (url.pathname === '/firebase-config.js') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static same-origin assets: cache-first for speed.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
