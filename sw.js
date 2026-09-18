const CACHE_NAME = 'xiaomi-visual-app-v10';
const urlsToCache = [
  './index.html',
  './main_v130.js?v=145',
  './style_v128.css?v=12',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false })
      .then(response => {
        if (response) {
          return response; // Return from cache
        }
        return fetch(event.request); // Fetch from network
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

// Permite que la página (main_v130.js) le diga a esta nueva versión "espera en segundo
// plano" que active ya, en cuanto el usuario pulse "Actualizar ahora".
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: mensaje SKIP_WAITING recibido, activando nueva versión...');
    self.skipWaiting();
  }
});
