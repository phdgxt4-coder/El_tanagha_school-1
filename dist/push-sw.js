/* عامل الإشعارات اللحظية: يعرض رسائل FCM من نوع data فقط. لا يخزّن صفحات. */
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json()?.data ?? event.data?.json() ?? {}; } catch { data = {}; }
  const title = data.title || 'مدرسة التناغة';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    dir: 'rtl',
    lang: 'ar',
    icon: 'assets/icons/icon-192.png',
    tag: data.type || 'school',
    data: { link: data.link || '/dashboard' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const root = new URL('../', self.registration.scope);
  const target = root.pathname + 'dashboard';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(client => client.url.startsWith(root.href));
    return open ? open.focus() : self.clients.openWindow(target);
  }));
});
