// Network-first app shell, offline fallback to cache. PLAN.md §10.3 called
// for cache-first, but that has a sharp edge on a host like GitHub Pages:
// its CDN can take a moment to finish propagating every file after a push,
// so a service worker's one-time install-time cache.addAll() can grab a
// TORN snapshot — e.g. the new index.html paired with the still-old
// styles.css — and then serve that mismatched combo forever, since
// cache-first never rechecks the network. That's what produced buttons
// with no background/border: fresh markup, stale CSS.
//
// Network-first avoids this: every request tries the network first (so
// you always get what's actually live), and only falls back to the cache
// when there's no network at all — which is the one case "offline" is
// actually asking for. Bump CACHE on every deploy regardless, so
// activate() sweeps the previous (possibly torn) cache.
const CACHE = 'tc-v3';

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
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Refresh the cache with whatever's actually live, so the
        // offline fallback stays current instead of freezing at
        // whatever was true the moment the SW first installed.
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
