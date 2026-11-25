/* عامل خدمة الاستخدام بدون إنترنت.
   يخزّن فقط ملفات الموقع الثابتة (واجهة، أنماط، صور) من نفس النطاق. لا يخزّن أي بيانات حسابات ولا طلبات Firebase
   (هي طلبات لنطاقات أخرى ولا يعترضها). عند انقطاع الاتصال تظهر واجهة التطبيق وتُرفض البيانات الحية برسالة. */
const VERSION = 'tn-app-v2';
const LEGACY = new Set(['tn-v1', 'tanagha-v1', 'school-platform-v1']);
const SCOPE = new URL(self.registration.scope);
const SHELL = SCOPE.href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try { const res = await fetch(SHELL, { cache: 'reload' }); if (res.ok) await cache.put(SHELL, res); } catch { /* يُخزَّن عند أول زيارة ناجحة */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => LEGACY.has(name) || (name.startsWith('tn-app-') && name !== VERSION)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

function isStatic(url) {
  return /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|webmanifest)$/u.test(url.pathname);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(VERSION).then(cache => cache.put(SHELL, copy)); }
        return res;
      } catch {
        return (await caches.match(SHELL)) || new Response('لا يوجد اتصال بالإنترنت.', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  if (isStatic(url) && !url.pathname.endsWith('/sw.js') && !url.pathname.endsWith('/push-sw.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(request);
      const refresh = fetch(request).then(res => { if (res.ok && res.type === 'basic') cache.put(request, res.clone()); return res; });
      if (cached) { refresh.catch(() => {}); return cached; }
      return refresh;
    })());
  }
});
