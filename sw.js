const CACHE_NAME = 'xiaomi-visual-app-v235';
const urlsToCache = [
    './img/posm/toptable_alcampo_crf_note15.png',
    './img/posm/lightbox_alcampo_crf_note15.png',
    './img/posm/cabecera_crf_premium_note15.png',
  './index.html',
  './main_v130.js?v=235',
  './style_v128.css?v=235',
  './stores_imei_real.js?v=235',
  './devices.json',
  './manifest.json',
  './logo.png',
  './favicon.ico',
  './img/posm/destacador_x18_pro_series.jpg',
  './img/posm/toptable_xiaomi_18_pro.png',
  './img/posm/toptable_redmi_note_17.png',
  './img/posm/lightbox_wall_xiaomi_18_pro.png',
  './img/posm/lightbox_column_xiaomi_18_pro.png',
  './img/posm/lightbox_column_redmi_note_17.png',
  './img/posm/lightbox_column_xiaomi_17t.png',
  './img/posm/cabecera_eci_display.png',
  './img/posm/cabecera_eci_backdrop.png',
  './img/posm/cabecera_eci_fondo.png',
  './img/posm/cabecera_eci_footer.png',
  './img/devices/xiaomi_18_pro_max_front.webp',
  './img/devices/xiaomi_18_pro_max_back.webp',
  './img/devices/xiaomi_18_pro_front.webp',
  './img/devices/xiaomi_18_pro_back.webp',
  './img/devices/xiaomi_17t_pro_front.webp',
  './img/devices/xiaomi_17t_pro_back.webp',
  './img/devices/xiaomi_17t_front.webp',
  './img/devices/xiaomi_17t_back.webp',
  './img/devices/xiaomi_17_front.webp',
  './img/devices/xiaomi_17_back.webp',
  './img/devices/rn17_promax_front.webp',
  './img/devices/rn17_promax_back.webp',
  './img/devices/rn17_pro_front.webp',
  './img/devices/rn17_pro_back.webp',
  './img/devices/rn17_5g_front.webp',
  './img/devices/rn17_5g_back.webp',
  './img/devices/redmi_17_5g_front.webp',
  './img/devices/redmi_17_5g_back.webp',
  './img/devices/redmi_17_4g_front.webp',
  './img/devices/redmi_17_4g_back.webp',
  './img/devices/redmi_15c_front.webp',
  './img/devices/redmi_15c_back.webp',
  './img/devices/pad8_pro_front.webp',
  './img/devices/pad8_pro_back.webp',
  './img/devices/pad8_front.webp',
  './img/devices/pad8_back.webp',
  './img/devices/redmi_pad2_pro_front.webp',
  './img/devices/redmi_pad2_pro_back.webp',
  './img/devices/redmi_pad2_front.webp',
  './img/devices/redmi_pad2_back.webp',
  './img/devices/redmi_pad2_front_vertical.webp',
  './img/devices/redmi_pad2_back_vertical.webp',
  './img/devices/pad8_front_vertical.webp',
  './img/devices/pad8_back_vertical.webp',
  './img/devices/pad8_pro_front_vertical.webp',
  './img/devices/pad8_pro_back_vertical.webp',
  './img/devices/redmi_pad2_pro_front_vertical.webp',
  './img/devices/redmi_pad2_pro_back_vertical.webp',
  './img/devices/redmi_pad2_97_front_vertical.webp',
  './img/devices/redmi_pad2_97_back_vertical.webp',
  './img/devices/redmi_pad2_97_front.webp',
  './img/devices/redmi_pad2_97_back.webp',
  './img/devices/watch_s5_46_front.webp',
  './img/devices/watch_s5_41_front.webp',
  './img/devices/watch_6_front.webp',
  './img/devices/watch_6_active_front.webp',
  './img/devices/watch_6_lite_front.webp',
  './img/devices/band_11_front.webp',
  './img/devices/band_11_active_front.webp',
  './img/devices/band_10_front.webp',
  './img/devices/band_10_pro_front.webp',
  './img/devices/band_9_active_front.webp',
  './img/devices/watch_5_front.webp',
  './img/devices/watch_s4_front.webp',
  './img/devices/watch_5_lite_front.webp',
  './img/devices/xiaomi_buds_6_front.webp',
  './img/devices/buds_8_front.webp',
  './img/devices/buds_8_pro_front.webp',
  './img/devices/buds_clip_front.webp'
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
  // En localhost o 127.0.0.1, ir siempre directamente a la red sin usar caché para no bloquear el desarrollo local
  const isLocal = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocal) {
    event.respondWith(fetch(event.request));
    return;
  }

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

  // Para scripts y estilos: Red primero (para asegurar versiones actualizadas al instante) y fallback a caché si offline
  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.url.includes('.js') || event.request.url.includes('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: false }))
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
