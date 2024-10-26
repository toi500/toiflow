const CACHE_NAME = 'toiflow-v1';
const STATIC_ASSETS = [
  '/favicon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
  '/screenshot-wide.png',
  '/screenshot-narrow.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('web.js')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
