const CACHE_NAME = 'medsystem-v1';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/register',
  '/dashboard'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Si falla la red y es una página, devuelve el fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});