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

  registrar();
  window.Avisos = { estado, activar, olvidar, instalada, esIOS };
})();
