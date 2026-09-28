// Notificaciones al teléfono (Web Push). En iPhone funcionan con la app abierta desde el ícono
// de la pantalla de inicio (iOS 16.4 o más nuevo).
(function(){
  'use strict';
  const db = window.db;
  const VAPID = 'BHgBCxxJKIHZTBor3mE3RqUJetdNz0IZewq-TrdzSrRREKbExGDbydumI9WcLEjYpC_DJ8fKW905GVknRwRdoEY';

  const soportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = () => window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

  let registro = null;
  function registrar(){
    if(!('serviceWorker' in navigator)) return Promise.resolve(null);
    if(!registro) registro = navigator.serviceWorker.register('sw.js').catch(() => null);
    return registro;
  }
  function clave(b64){
    const p = '='.repeat((4 - b64.length % 4) % 4);
    const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...s].map(c => c.charCodeAt(0)));
  }
  async function guardar(sub){
    const j = sub.toJSON();
    const { error } = await db.from('push_suscripciones').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
    if(error) throw error;
  }

  // 'no-soportado' | 'instalar' | 'bloqueado' | 'activo' | 'inactivo'
  async function estado(){
    if(esIOS() && !instalada()) return 'instalar';
    if(!soportado()) return 'no-soportado';
    if(Notification.permission === 'denied') return 'bloqueado';
    const reg = await registrar();
    if(!reg) return 'no-soportado';
    const sub = await reg.pushManager.getSubscription();
    if(sub && Notification.permission === 'granted'){ guardar(sub).catch(() => {}); return 'activo'; }
    return 'inactivo';
  }

  // Se llama al tocar el botón (el iPhone solo pide permiso dentro del toque)
  async function activar(){
    const permiso = await Notification.requestPermission();
    if(permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo';
    const reg = await registrar();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave(VAPID) });
    await guardar(sub);
    return 'activo';
  }

  // Al salir, este teléfono deja de recibir los avisos de esa persona
  async function olvidar(){
    try{
      const reg = await registrar();
      const sub = reg && await reg.pushManager.getSubscription();
      if(sub){ await db.from('push_suscripciones').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
    } catch(e){}
  }

  // Aviso dentro de la app cuando llega una notificación con la app abierta
  function mostrarBanner(m){
    let b = document.getElementById('bannerAviso');
    if(!b){
      b = document.createElement('button');
      b.id = 'bannerAviso'; b.type = 'button'; b.className = 'banner-aviso';
      document.body.appendChild(b);
      b.addEventListener('click', () => { const u = b.dataset.url; b.classList.remove('ver'); if(u) location.href = u; });
    }
    b.dataset.url = m.url || '';
    b.innerHTML = `<span class="ba-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span><span class="ba-txt"><b></b><span></span></span>`;
    b.querySelector('b').textContent = m.titulo || 'Aviso';
    b.querySelector('.ba-txt span').textContent = m.cuerpo || '';
    requestAnimationFrame(() => b.classList.add('ver'));
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
    clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('ver'), 7000);
  }
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', (e) => { if(e.data && e.data.tipo === 'aviso') mostrarBanner(e.data); });
  }

  registrar();
  // Si hay una versión nueva del service worker, se instala al abrir la app
  registrar().then(r => { if(r && r.update) r.update().catch(() => {}); });
  window.Avisos = { estado, activar, olvidar, instalada, esIOS };
})();
