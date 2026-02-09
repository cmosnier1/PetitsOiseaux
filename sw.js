const CACHE_NAME = 'budget-cache-v8.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-sync.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache ouvert');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes chrome-extension://, moz-extension://, safari-extension://
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('moz-extension://') ||
      event.request.url.startsWith('safari-extension://')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (response) => {
            // Ne pas cacher si la réponse n'est pas valide
            // CORRECTION: Permettre aussi les requêtes CORS (type: 'cors')
            if (!response || response.status !== 200 || 
                (response.type !== 'basic' && response.type !== 'cors')) {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Vérifier que l'URL est cachable
                try {
                  cache.put(event.request, responseToCache);
                } catch (error) {
                  console.log('Erreur mise en cache ignorée:', error);
                }
              });
            return response;
          }
        ).catch((error) => {
          console.log('Erreur fetch:', error);
          return caches.match('./index.html');
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
