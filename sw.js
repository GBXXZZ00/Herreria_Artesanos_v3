// Service worker: muestra las notificaciones y abre la app al tocarlas.
// No guarda nada en caché, para que la app siempre cargue la versión nueva.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'Herrería Artesanos';
  const url = d.url || './';
  const opciones = {
    body: d.cuerpo || '',
    icon: 'assets/img/icon-192.png',
    badge: 'assets/img/icon-192.png',
    vibrate: [200, 100, 200],
    silent: false,
    timestamp: Date.now(),
    data: { url }
  };
  // Cada aviso vuelve a sonar aunque sea de la misma venta
  if (d.tag) { opciones.tag = d.tag; opciones.renotify = true; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(titulo, opciones),
    // Si la app está abierta, también se muestra el aviso arriba dentro de la app
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((ventanas) => ventanas.forEach((w) => w.postMessage({ tipo: 'aviso', titulo, cuerpo: d.cuerpo || '', url })))
  ]));
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
