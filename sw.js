const CACHE_NAME = 'xiaomi-visual-app-v13';
const urlsToCache = [
  './index.html',
  './main_v130.js?v=148',
  './style_v128.css?v=143',
  './devices.json',
  './manifest.json',
  './logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.warn('Cache install warning:', err))
  );
});

self.addEventListener('fetch', event => {
  // Para páginas de navegación (HTML principal), intentar siempre red primero
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Para el resto de recursos: Caché primero, fallback a red
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false })
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(netRes => {
          if (netRes && netRes.status === 200 && event.request.method === 'GET' && !event.request.url.includes('script.google.com')) {
            const clone = netRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return netRes;
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )),
      self.clients.claim()
    ])
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
