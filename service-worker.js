const CACHE_NAME = 'propinas-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/js/app.js',
  '/manifest.json',
  // Add other assets (CSS, icons, etc.)
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});