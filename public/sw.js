const CACHE_NAME = 'medsystem-v2';
const STATIC_ASSETS = [
  '/',
  '/login',
  '/register',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: cachea solo archivos estáticos conocidos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('No cacheado:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: limpia caches viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first para estáticos, network-first para páginas
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar requests que no sean GET
  if (request.method !== 'GET') return;

  // No interceptar APIs de Supabase/Next.js
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;
  if (url.hostname.includes('supabase.co')) return;

  // Para navegación de páginas (HTML): network-first, fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            // Si no hay cache, mostrar login como fallback seguro
            return cached || caches.match('/login') || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Para estáticos (JS, CSS, imágenes): cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});

// Push notifications (opcional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva notificación',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/dashboard' }
    };
    event.waitUntil(self.registration.showNotification(data.title || 'MedSystem', options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/dashboard'));
});