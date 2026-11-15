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
    { id:'ventas',       nombre:'Ventas',       href:'ventas.html',   listo:true,
      icon:'<path d="M6 2l1.5 4h9L18 2"/><rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 11a4 4 0 0 0 8 0"/>' },
    { id:'catalogo',     nombre:'Catálogo',     href:'catalogo.html', listo:true,
      icon:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v6"/>' },
    // Taller: Producción y Nómina juntas (administradores y vendedora)
    { id:'taller',       nombre:'Taller',       href:'taller.html', listo:true, roles:['admin', 'vendedor'],
      icon:'<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17v3h3l5.3-5.3"/>' },
    // Costeador: solo Ray y Gualfredo (quien confirma pagos). Por ahora abre Costos.
    { id:'costeador',    nombre:'Costeador',    href:'costos.html', listo:true, costeador:true,
      icon:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M8 14h2M12 14h2M8 18h2M12 18h2M16 10v8"/>' }
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
    cont.innerHTML = `<nav class="bottom-nav" aria-label="Módulos">${MODULOS.filter(m => seVe(m, perfilActual)).map(m => {
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
  // Quién ve cada botón del menú de abajo. Sin el rol (sin señal y sin copia guardada)
  // se muestra el Taller igual y no se adivina nada; el Costeador solo con el permiso.
  function seVe(m, p){
    if(m.costeador) return !!(p && p.confirma_abonos);
    if(m.roles && p && p.rol) return m.roles.includes(p.rol);
    return true;
  }
  // Al saber quién entró, el menú se vuelve a pintar si cambia lo que se ve (en el mismo
  // teléfono pudo entrar antes otra persona)
  function ajustarMenu(p){
    if(!p || !p.rol) return;
    const cont = document.getElementById('menuModulos');
    if(!cont) return;
    const hay = [...cont.querySelectorAll('a.nav-item')].map(a => a.getAttribute('href')).join('|');
    const debe = MODULOS.filter(m => seVe(m, p)).map(m => m.href).join('|');
    if(hay !== debe) pintarMenu();
  }
  async function perfil(){
    // Si el rol no se pudo leer, se vuelve a intentar la próxima vez (no se queda "sin rol")
    if(perfilActual && perfilActual.rol){ ajustarMenu(perfilActual); return perfilActual; }
    const s = await sesionActual();
    if(!s) return null;
    // Si la señal falla al leer el perfil, se reintenta y luego se usa el último perfil
    // guardado en este teléfono. Nunca se adivina el rol (antes caía en "vendedor" y
    // a un administrador se le escondía Producción).
    const CLAVE = 'ah_cache_perfil_' + s.user.id;
    let data = null;
    for(let i = 0; i < 2 && !data; i++){
      try{
        const r = await db.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
        if(!r.error) data = r.data || null;
        if(!r.error) break;
      } catch(e){}
      if(i === 0) await new Promise(ok => setTimeout(ok, 600));
    }
    if(data){ try{ localStorage.setItem(CLAVE, JSON.stringify(data)); } catch(e){} }
    else { try{ data = JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch(e){ data = null; } }
    const meta = s.user.user_metadata || {};
    perfilActual = data || { nombre: meta.nombre || 'Usuario', rol: meta.rol || null };
    ajustarMenu(perfilActual);
    // El trabajador solo usa su Inicio: cualquier otra pantalla lo regresa allí
    if(perfilActual.rol === 'trabajador' && enModulo){ location.replace('index.html'); return null; }
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
    if(window.Avisos) await window.Avisos.olvidar();
    perfilActual = null;
    try{ Object.keys(localStorage).filter(k => k.startsWith('ah_cache_')).forEach(k => localStorage.removeItem(k)); } catch(e){}
    try{ await db.auth.signOut(); } catch(e){}
  }
  async function cambiarPin(pin){
    const { error } = await db.auth.updateUser({ password: pin });
    if(error) throw error;
  }

  // ---------------------------------------------------------------------------
  // Navegación: Inicio es el tope. Desde Inicio se entra a un módulo; "atrás" en un
  // módulo siempre regresa a Inicio; cambiar de módulo reemplaza (no apila).
  // ---------------------------------------------------------------------------
  const FLAG = 'ah_desdeInicio';
  const FLAG_SUB = 'ah_sub';   // pantalla abierta desde un módulo (ej. Nueva venta desde Ventas): atrás regresa allí
  const cont = document.getElementById('menuModulos');
  const activo = cont ? cont.dataset.activo : null;
  const enModulo = activo && activo !== 'inicio';
  function guardarFlag(){ try{ sessionStorage.setItem(FLAG, '1'); }catch(e){} }

  // Enlaces a una pantalla secundaria (ej. Nueva venta o Editar desde la lista)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-sub]');
    if(a){ try{ sessionStorage.setItem(FLAG_SUB, '1'); }catch(err){} }
  });
  const esSubpantalla = () => !!(history.state && history.state.sub);
  // Regresa a Inicio sin apilar pasos (Inicio siempre queda debajo del módulo)
  function irInicio(){
    const n = (window.AH && AH.profundidad) ? AH.profundidad() : 0;
    // Una subpantalla tiene su módulo debajo, y debajo de él Inicio
    history.go(-(n + (esSubpantalla() ? 2 : 1)));
  }

  if(enModulo){
    const st = history.state || {};
    let esSub = false;
    try{ esSub = sessionStorage.getItem(FLAG_SUB) === '1'; if(esSub) sessionStorage.removeItem(FLAG_SUB); }catch(e){}
    if(!st.modulo && esSub){
      try{ sessionStorage.removeItem(FLAG); }catch(e){}
      history.replaceState(Object.assign({}, st, { modulo:true, sub:true, ah:0 }), '');
    } else if(!st.modulo){
      let desdeInicio = false;
      try{ desdeInicio = sessionStorage.getItem(FLAG) === '1'; sessionStorage.removeItem(FLAG); }catch(e){}
      if(desdeInicio){
        history.replaceState(Object.assign({}, st, { modulo:true, ah:0 }), '');
      } else {
        // Se abrió el módulo directo: se pone Inicio debajo para que "atrás" lleve allí
        const url = location.href;
        history.replaceState({ ahBase:true }, '', 'index.html');
        history.pushState({ modulo:true, ah:0 }, '', url);
      }
    }
    // Pestañas que son otra pantalla del mismo módulo (Ventas · Cotizaciones, Taller · Nómina):
    // cambian sin apilar, así "atrás" sigue llevando a Inicio
    document.addEventListener('click', (e) => {
      const a = e.target.closest('.tabs-mod a[href]');
      if(!a || e.defaultPrevented) return;
      e.preventDefault();
      if(a.classList.contains('on')){ window.scrollTo({ top:0, behavior:'smooth' }); return; }
      guardarFlag();
      location.replace(a.getAttribute('href'));
    });
    // Menú de abajo dentro de un módulo
    if(cont) cont.addEventListener('click', (e) => {
      const a = e.target.closest('a.nav-item');
      if(!a) return;
      e.preventDefault();
      const id = (MODULOS.find(m => m.href === a.getAttribute('href')) || {}).id;
      // El mismo módulo en otra pantalla (Cotizaciones es parte de Ventas) sí cambia de pantalla
      const aqui = location.pathname.split('/').pop() || 'index.html';
      if(id === activo && aqui === a.getAttribute('href')){ window.scrollTo({ top:0, behavior:'smooth' }); return; }
      if(id === 'inicio'){ irInicio(); return; }
      guardarFlag();
      location.replace(a.getAttribute('href'));
    });
  } else {
    // En Inicio: al entrar a un módulo se marca que Inicio queda debajo
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if(!a) return;
      const href = a.getAttribute('href');
      const m = MODULOS.find(x => x.href === href) || (a.hasAttribute('data-modulo') ? { id:'otro' } : null);
      if(!m) return;
      if(m.id === 'inicio'){ e.preventDefault(); window.scrollTo({ top:0, behavior:'smooth' }); return; }
      guardarFlag();
    });
  }

  window.Sesion = { irInicio, esSubpantalla, MODULOS, iconoModulo, pintarMenu, sesionActual, perfil, requerir, entrar, salir, cambiarPin };

  pintarMenu();
  if(document.body.dataset.requiereSesion === 'si') requerir();
})();
