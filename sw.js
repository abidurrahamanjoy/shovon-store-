const CACHE_NAME = 'shuvon-store-v7';
const APP_SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// এই ফাইলগুলো বদলালে ভিজিটর যেন সবসময় নতুন কপি পায় (network-first)
const NETWORK_FIRST = ['/firebase-config.js', '/app.js', '/styles.css'];

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
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('/index.html');
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          cache.put('/index.html', copy);
        }
        return response;
      }).catch(() => null);
      return cached || await network || new Response('Offline', { status: 503 });
    })());
    return;
  }

  // কোড ও কনফিগ ফাইল: আগে নেটওয়ার্ক থেকে আনবে, অফলাইনে থাকলে ক্যাশ থেকে দেবে।
  if (NETWORK_FIRST.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // বাকি static ফাইল (ছবি, আইকন): cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
