// Offline after first visit. Pages are network-first so a deploy reaches the very next visit and a
// page's HTML can never pair with assets from another build; the cached copy serves when offline
// or when the network is slow (then the tabs are told, so the page can offer a reload once the
// fresh copy has landed). Hashed assets are cache-first, refreshed in the background.
const CACHE = 'bricksy-v3';
const SLOW_MS = 2500;
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
      if (res.ok) await cache.put(e.request, res.clone());
      return res;
    });
    if (e.request.mode !== 'navigate') return cached ?? fresh.catch(() => cached ?? Response.error());
    if (!cached) return fresh;
    const res = await Promise.race([fresh.catch(() => null), new Promise((r) => setTimeout(() => r(null), SLOW_MS))]);
    if (res) return res;
    // Slow or offline: the cached page now, and a word to the tabs if a newer one arrives.
    e.waitUntil(fresh.then(async (r) => {
      if (!r.ok) return;
      const [a, b] = await Promise.all([cached.clone().text(), r.clone().text()]);
      if (a !== b) for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'bricksy-update' });
    }).catch(() => {}));
    return cached;
  }));
});
