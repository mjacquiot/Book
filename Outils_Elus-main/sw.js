const CACHE_NAME = 'eluconnect-v7';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-512.png',
  './js/state.js',
  './js/views_app.js',
  './js/init.js',
  './js/crypto_utils.js',
  './js/actions/auth_actions.js',
  './js/actions/theme_actions.js',
  './js/actions/doc_actions.js',
  './js/actions/rag_actions.js',
  './js/actions/agenda_actions.js',
  './js/actions/sys_actions.js',
  './js/actions/crypto_init.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourne le cache si trouvé, sinon fait la requête réseau
        return response || fetch(event.request);
      })
  );
});
