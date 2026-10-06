// Lou's service worker: keeps every file Lou needs on the device so it opens and works offline.
// The build (vite.config.ts) fills in PRECACHE with the list of built files and VERSION with a
// hash of their contents. Only Lou's own files are cached; tax data never passes through here.
/* global self, caches */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `lou-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  // No skipWaiting here: the page asks the user before switching to a new version mid-return.
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('lou-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // A page: the network when online (so a new version is noticed), the stored copy when offline.
    // The legal pages are stored too. Anything else falls back to the tool under /app/, or the landing page elsewhere.
    const page = url.pathname.startsWith('/app') ? '/app/index.html' : '/index.html';
    event.respondWith(fetch(req).catch(async () => (
      (await caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true })) ||
      (await caches.match(page, { cacheName: CACHE, ignoreVary: true })) || Response.error()
    )));
    return;
  }
  event.respondWith((async () => {
    // ignoreVary: the stored copies were fetched without the Origin header that module scripts send.
    const hit = await caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true });
    return hit || fetch(req);
  })());
});
