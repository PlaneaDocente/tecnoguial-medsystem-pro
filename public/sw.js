const CACHE_NAME = 'medsystem-pro-v1';
const STATIC_CACHE = 'medsystem-static-v1';
const PAGES_CACHE = 'medsystem-pages-v1';

// Archivos estáticos que SÍ existen físicamente
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Instalación: precachear solo archivos estáticos reales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.all(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((response) => {
              if (response.status === 200 || response.status === 0) {
                return cache.put(url, response);
              }
              console.warn('[SW] No se cacheó:', url, response.status);
            })
            .catch((err) => {
              console.warn('[SW] Error cacheando:', url, err.message);
            })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpiar caches viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith('medsystem-'))
          .map((name) => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estrategia inteligente según tipo de request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar todo lo que no sea GET
  if (request.method !== 'GET') return;

  // Ignorar APIs, Supabase, Next.js internals
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('vercel.app') && url.pathname.includes('/api/')
  ) {
    return;
  }

  // 1. Navegación de páginas (HTML): Network-first, fallback a offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(PAGES_CACHE).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Último recurso: intentar devolver la página de login cacheada
            return caches.match('/login').then((loginCached) => {
              if (loginCached) return loginCached;
              // Si nada existe, mostrar página offline mínima
              return new Response(
                `<!DOCTYPE html>
                <html>
                  <head><title>Offline - MedSystem</title>
                  <style>
                    body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f7fa}
                    .box{text-align:center;padding:2rem}
                    h2{color:#0a2540;margin-bottom:0.5rem}
                    p{color:#64748b}
                    button{padding:0.75rem 1.5rem;background:#0066cc;color:white;border:none;border-radius:0.5rem;cursor:pointer;margin-top:1rem}
                  </style>
                  </head>
                  <body>
                    <div class="box">
                      <h2>⚠️ Sin conexión</h2>
                      <p>No se pudo conectar al servidor. Verifica tu internet.</p>
                      <button onclick="location.reload()">Reintentar</button>
                    </div>
                  </body>
                </html>`,
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          });
        })
    );
    return;
  }

  // 2. Assets estáticos (JS, CSS, imágenes, fuentes): Cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff2?|ttf|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return networkResponse;
        }).catch(() => {
          // Si es una imagen y falla, devolver placeholder transparente
          if (request.destination === 'image') {
            return new Response(
              new Blob([], { type: 'image/png' }),
              { status: 200, headers: { 'Content-Type': 'image/png' } }
            );
          }
          throw new Error('Network error');
        });
      })
    );
    return;
  }

  // 3. Resto: pasar directo a red (no interceptar)
});