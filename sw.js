const CACHE_NAME = 'shuvon-store-v3'; // ভার্সন ৩ করা হয়েছে
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// HTML পেজ সবসময় আগে নেটওয়ার্ক থেকে আনার চেষ্টা করে (যাতে নতুন ডিপ্লয় সাথে সাথে দেখা যায়),
// নেট না থাকলে ক্যাশে ফিরে যায়। অন্য স্ট্যাটিক ফাইল (CSS/JS/ম্যানিফেস্ট) আগের মতোই cache-first।
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});
