/* Migration worker for older installs. Current app pages are fetched from network. */
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const legacyCaches = new Set(['tn-v1', 'tanagha-v1', 'school-platform-v1']);
    await Promise.all((await caches.keys()).filter(name => legacyCaches.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
