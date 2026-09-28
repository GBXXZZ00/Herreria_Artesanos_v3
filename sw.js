// Service worker: muestra las notificaciones, abre la app al tocarlas y guarda en el
// teléfono los archivos con versión (?v=N) para que abran al instante.
// Las páginas (HTML) y los datos siempre vienen de internet: nunca se ve una versión vieja.
const CACHE = 'ah-archivos-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo archivos propios con versión: css, js, librerías
  if (url.origin !== self.location.origin || !url.searchParams.has('v') || !/\/assets\//.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const guardado = await c.match(req);
    if (guardado) return guardado;
    const r = await fetch(req);
    if (r.ok) {
      e.waitUntil(c.put(req, r.clone()).then(() => c.keys()).then((ks) => Promise.all(ks
        // Se borran las versiones anteriores del mismo archivo
        .filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; })
        .map((k) => c.delete(k)))).catch(() => {}));
    }
    return r;
  }).catch(() => fetch(req)));
});

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
    const scope = self.registration.scope;
    const w = ventanas.find((x) => x.url.startsWith(scope)) || ventanas[0];
    if (w && 'focus' in w) {
      return w.focus()
        .then((f) => (f && 'navigate' in f ? f.navigate(url) : self.clients.openWindow(url)))
        .catch(() => self.clients.openWindow(url));
    }
    return self.clients.openWindow(url);
  }));
});
