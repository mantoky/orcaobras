const CACHE_NAME = 'orcaobras-v1';
const OFFLINE_URL = '/offline.html';

const ASSETS = [
    '/',
    '/index.html',
    '/css/estilos.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/config.js',
    '/js/data-manager.js',
    '/js/budget-builder.js',
    '/js/column-mapper.js',
    '/js/export.js',
    '/js/firebase.js',
    '/js/agenda-manager.js',
    '/js/utils.js',
    '/manifest.json',
    '/offline.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchResponse => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        }).catch(() => caches.match('/offline.html'))
    );
});