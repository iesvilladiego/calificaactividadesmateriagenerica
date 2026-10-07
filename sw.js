// Service Worker para Evaluación Criterial Multimateria

// Versión de la app: única fuente de verdad.
// - El SW responde a los mensajes GET_VERSION de la página con APP_VERSION
//   (extraída del nombre de la caché).
// - La página también puede leerla haciendo fetch de sw.js y parseando el
//   literal v2.1.1 (fallback cuando el SW aún no controla la página).
// ⚠ IMPORTANTE: cada vez que cambie index.html hay que subir la versión en
//   CACHE_NAME (p. ej. v2.1.0 → v2.1.1) o los usuarios seguirán viendo la
//   copia antigua del HTML (estrategia cache-first).
const CACHE_NAME = 'eval-criterial-multimateria-v2.1.2';
const APP_VERSION = (CACHE_NAME.match(/v([\d.]+)$/) || [])[1] || '2.1.1';
const BASE_PATH = '/CalificaActividadesMateriaGenericaV2/';
const URLS_TO_CACHE = [
    BASE_PATH,
    BASE_PATH + 'index.html',
    BASE_PATH + 'manifest.json',
    BASE_PATH + 'icons/icon-72x72.png',
    BASE_PATH + 'icons/icon-96x96.png',
    BASE_PATH + 'icons/icon-128x128.png',
    BASE_PATH + 'icons/icon-144x144.png',
    BASE_PATH + 'icons/icon-152x152.png',
    BASE_PATH + 'icons/icon-192x192.png',
    BASE_PATH + 'icons/icon-384x384.png',
    BASE_PATH + 'icons/icon-512x512.png',
    // Recursos externos (CDN)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha3/dist/js/bootstrap.bundle.min.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
];

// Instalación: cachear recursos
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(URLS_TO_CACHE.map(url => new Request(url, { mode: 'no-cors' })));
        }).then(function() {
            return self.skipWaiting();
        }).catch(function(err) {
            console.warn('SW: Error al cachear recursos:', err);
        })
    );
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME && cacheName.startsWith('eval-criterial-multimateria-')) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch: estrategia cache-first con fallback a red
self.addEventListener('fetch', function(event) {
    // No interceptar peticiones a Firebase
    if (event.request.url.includes('firebasedatabase.app') ||
        event.request.url.includes('firebaseio.com') ||
        event.request.url.includes('googleapis.com')) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request).then(function(response) {
                // No cachear respuestas no válidas o de origen cruzado sin CORS
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                var responseToCache = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseToCache);
                });
                return response;
            }).catch(function() {
                // Fallback offline: servir index.html para navegación
                if (event.request.mode === 'navigate') {
                    return caches.match(BASE_PATH + 'index.html');
                }
            });
        })
    );
});

// Mensajes desde la página
self.addEventListener('message', function(event) {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
        return;
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        var msg = { type: 'APP_VERSION', version: APP_VERSION, cache: CACHE_NAME };
        // Responder a la página que pregunta (el chip de la cabecera)
        if (event.source && event.source.postMessage) {
            event.source.postMessage(msg);
        }
        // Difundir también al resto de clientes/pestañas abiertas
        self.clients.matchAll({ includeUncontrolled: true }).then(function(clients) {
            clients.forEach(function(client) {
                client.postMessage(msg);
            });
        }).catch(function() { /* sin clientes registrados todavía */ });
    }
});
