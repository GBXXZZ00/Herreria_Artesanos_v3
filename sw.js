// Service worker: solo muestra las notificaciones y abre la app al tocarlas.
// No guarda nada en caché, para que la app siempre cargue la versión nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Herrería Artesanos', {
    body: d.cuerpo || '',
    icon: 'assets/img/icon-192.png',
    badge: 'assets/img/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    for (const w of ventanas) {
      if ('focus' in w) { return w.focus().then((f) => (f && 'navigate' in f ? f.navigate(url) : null)); }
    }
    return self.clients.openWindow(url);
  }));
});
