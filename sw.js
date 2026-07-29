// Cache-first app shell. PLAN.md §10.3. Bump CACHE on every deploy so
// activate() sweeps the stale one.
const CACHE = 'tc-v2';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/format.js',
  './js/store.js',
  './js/seg.js',
  './js/stopwatch.js',
  './js/ui.js',
  './js/pwa.js',
  './js/views/home.js',
  './js/views/earn.js',
  './js/views/spend.js',
  './js/views/log.js',
  './fonts/barlow-400.woff2',
  './fonts/barlow-500.woff2',
  './fonts/barlow-600.woff2',
  './fonts/jetbrains-mono-variable.woff2',
  './fonts/roboto-variable.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
