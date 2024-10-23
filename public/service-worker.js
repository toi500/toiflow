const CACHE_NAME = 'toiflow-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {

  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
