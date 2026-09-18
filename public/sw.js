// Offline after first visit: same-origin GETs are served from cache while a fresh copy is fetched.
// When a page's fresh HTML differs from what was served, the open tabs are told so they can offer a reload.
const CACHE = 'bricksy-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request).then(async (res) => {
      if (!res.ok) return res;
      if (cached && e.request.mode === 'navigate') {
        const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
        if (a !== b) for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'bricksy-update' });
      }
      await cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached ?? fresh;
  }));
});
