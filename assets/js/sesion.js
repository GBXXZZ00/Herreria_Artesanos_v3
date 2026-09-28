// Sesión (acceso con usuario y PIN) y menú de módulos.
// Cada usuario entra una sola vez por teléfono; la sesión queda guardada.
(function(){
  'use strict';
  const db = window.db;
  const DOMINIO = '@artesanos.app';

  // Módulos de la app. listo:false = se muestra como "próximamente".
  const MODULOS = [
    { id:'inicio',       nombre:'Inicio',       href:'index.html',    listo:true,
      icon:'<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>' },
    { id:'cotizaciones', nombre:'Cotizaciones', href:null,            listo:false,
      icon:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>' },
    { id:'ventas',       nombre:'Ventas',       href:null,            listo:false,
      icon:'<path d="M6 2l1.5 4h9L18 2"/><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 11a4 4 0 0 0 8 0"/>' },
    { id:'catalogo',     nombre:'Catálogo',     href:'catalogo.html', listo:true,
      icon:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v6"/>' },
    { id:'produccion',   nombre:'Producción',   href:null,            listo:false,
      icon:'<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17v3h3l5.3-5.3"/>' }
  ];
  function iconoModulo(m, size){
    const s = size || 22;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>`;
  }

  // Menú de abajo dentro de cada módulo
  function pintarMenu(){
    const cont = document.getElementById('menuModulos');
    if(!cont) return;
    const activo = cont.dataset.activo;
    cont.innerHTML = `<nav class="bottom-nav" aria-label="Módulos">${MODULOS.map(m => {
      const es = m.id === activo;
      if(!m.listo) return `<button class="nav-item disabled" disabled aria-label="${m.nombre}, próximamente">${iconoModulo(m)}<span>${m.nombre}</span></button>`;
      return `<a class="nav-item ${es ? 'active' : ''}" ${es ? 'aria-current="page"' : ''} href="${m.href}">${iconoModulo(m)}<span>${m.nombre}</span></a>`;
    }).join('')}</nav>`;
  }

  let perfilActual = null;
  async function sesionActual(){
    if(!db) return null;
    const { data } = await db.auth.getSession();
    return data && data.session ? data.session : null;
  }
  async function perfil(){
    if(perfilActual) return perfilActual;
    const s = await sesionActual();
    if(!s) return null;
    const { data } = await db.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
    perfilActual = data || { nombre: (s.user.user_metadata || {}).nombre || 'Usuario', rol: (s.user.user_metadata || {}).rol || 'vendedor' };
    return perfilActual;
  }
  // En los módulos: si no hay sesión, vuelve a la pantalla de acceso
  async function requerir(){
    const s = await sesionActual();
    if(!s){ location.replace('index.html'); return null; }
    return perfil();
  }
  async function entrar(usuario, pin){
    const { data, error } = await db.auth.signInWithPassword({ email: usuario + DOMINIO, password: pin });
    if(error) throw error;
    perfilActual = null;
    return data.session;
  }
  async function salir(){
    perfilActual = null;
    try{ await db.auth.signOut(); } catch(e){}
  }
  async function cambiarPin(pin){
    const { error } = await db.auth.updateUser({ password: pin });
    if(error) throw error;
  }

  window.Sesion = { MODULOS, iconoModulo, pintarMenu, sesionActual, perfil, requerir, entrar, salir, cambiarPin };

  pintarMenu();
  if(document.body.dataset.requiereSesion === 'si') requerir();
})();
