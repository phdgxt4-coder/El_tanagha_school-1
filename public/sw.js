/* One-time migration worker: purge the legacy PWA cache and unregister itself.
   The current Vite application intentionally does not cache authenticated pages. */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const legacyCaches = new Set(['tn-v1', 'tanagha-v1', 'school-platform-v1']);
    await Promise.all(cacheNames.filter(name => legacyCaches.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
