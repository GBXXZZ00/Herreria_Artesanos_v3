// Ayuda de la app: un botón "Ayuda" (con su palabra) en cada pantalla y en cada hoja.
// Al tocarlo sube una hoja con SOLO la parte del manual de esa pantalla, filtrada por
// quien entró (vendedora, administrador o trabajador). El contenido vive en
// assets/ayuda/<modulo>.html (una <section data-b="..."> por parte) y se genera con
// pruebas/manual/construir.py desde los manuales. Nada se descarga hasta que se toca Ayuda.
(function(){
  'use strict';
  const src = (document.currentScript && document.currentScript.src) || '';
  const V = (src && new URL(src).searchParams.get('v')) || '1';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const MODULOS = {
    catalogo:'Catálogo', venta:'Nueva cotización o venta', cotizaciones:'Cotizaciones', ventas:'Ventas y pagos',
    inicio:'Inicio y avisos', produccion:'Producción', nomina:'Nómina y vales', deposito:'Depósito',
    admin:'Categorías de pago y Usuarios', taller:'Manual del taller'
  };
  const ICONO = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>';

  // ---------------------------------------------------------------------------
  // Qué parte del manual sale en cada lugar. "mod:bloque" toma el bloque de otro manual.
  // b puede ser una función: se decide al tocar (según el tipo de producto, la acción, etc.).
  // ---------------------------------------------------------------------------
  const txt = (sel) => ((document.querySelector(sel) || {}).textContent || '').trim();
  const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const PAGINAS = {
    'catalogo.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'catalogo', t:'Aquí están los modelos que vendemos',
        b:['intro', 'registrar-un-modelo', 'despues-de-registrar', 'normas', 'poner-la-categoria-de-pago-admin', 'avisos-que-te-salen-admin'] },
      { ref:'#sheetForm [data-cerrar="sheetForm"]', etiqueta:'Cerrar', mod:'catalogo', t: () => txt('#formTitulo'),
        b: () => /pieza|inmediata/i.test(txt('#formTitulo')) ? ['entrega-inmediata']
          : ['antes-de-empezar-ten-a-mano', 'registrar-un-modelo', 'tipo-' + slug(txt('#sheetForm .type-row-value')), 'poner-la-categoria-de-pago-admin'] },
      { ref:'#sheetDetalle .sheet-x', flotante:true, mod:'catalogo', t:'Lo que puedes hacer aquí',
        b: () => document.querySelector('#sheetDetalle [data-accion="editar-pieza"]') ? ['entrega-inmediata', 'despues-de-registrar'] : ['despues-de-registrar', 'entrega-inmediata'] }
    ],
    'venta.html': [
      { alFinal:'#topbar', mod:'venta', t:'Registrar una cotización o una venta',
        b:['cotizacion-o-venta', 'paso-a-paso', 'si-es-una-venta', 'mandaselo-al-cliente', 'normas', 'avisos'] },
      { ref:'#sheetAgregar [data-cerrar="sheetAgregar"]', etiqueta:'Cerrar', mod:'venta', t:'¿De dónde viene el producto?', b:['paso-a-paso', 'segun-el-producto'] },
      { ref:'#sheetProducto [data-cerrar="sheetProducto"]', etiqueta:'Cerrar', mod:'venta', t:'Lo de este producto',
        b: () => {
          const e = window.AyudaVenta ? window.AyudaVenta() : {};
          const tipo = e.origen === 'pieza' ? 'tipo-entrega-inmediata' : e.origen === 'medida' ? 'tipo-a-medida'
            : e.tipo === 'Ventana' ? 'tipo-ventana' : e.tipo === 'Combo' ? 'tipo-combo' : 'tipo-puerta-y-porton';
          return e.modo === 'venta' && e.origen !== 'pieza' ? [tipo, 'si-es-una-venta'] : [tipo];
        } },
      { ref:'#sheetConfirmar [data-cerrar="sheetConfirmar"]', etiqueta:'Cerrar', mod:'venta', t:'Registrar el pago', b:['si-es-una-venta'] }
    ],
    'cotizaciones.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'cotizaciones', t:'Tus cotizaciones', b:['intro', 'la-lista', 'la-ficha', 'normas', 'avisos'] },
      { ref:'#sheetFicha .sheet-x', flotante:true, mod:'cotizaciones', t:'Esta cotización', b:['la-ficha', 'convertir-en-venta', 'mas-opciones'] },
      { ref:'#sheetAccion [data-cerrar="sheetAccion"]', etiqueta:'Cerrar', mod:'cotizaciones', t: () => txt('#accionTitulo'),
        b: () => /descartar/i.test(txt('#accionTitulo')) ? ['mas-opciones'] : ['convertir-en-venta'] }
    ],
    'ventas.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'ventas', t:'Los pedidos', b:['intro', 'como-avanza-un-pedido', 'la-lista', 'normas', 'avisos'] },
      { ref:'#sheetFicha .sheet-x', flotante:true, mod:'ventas', t:'Este pedido',
        b:['la-ficha-de-un-pedido', 'pagos', 'confirmar-un-pago-admin', 'avisarle-al-cliente', 'entregar', 'mas-opciones', 'cancelar-una-venta-admin'] },
      { ref:'#sheetAccion [data-cerrar="sheetAccion"]', etiqueta:'Cerrar', mod:'ventas', t: () => txt('#accionTitulo'),
        b: () => { const a = txt('#accionTitulo'); return /confirmar pago/i.test(a) ? ['confirmar-un-pago-admin'] : /cancelar/i.test(a) ? ['cancelar-una-venta-admin'] : ['pagos']; } }
    ],
    'produccion.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'produccion', t:'El taller', b:['intro', 'los-pasos-de-cada-producto', 'la-lista', 'puertas-de-madera', 'normas', 'avisos-admin', 'avisos-vend'] },
      { ref:'#sheetFicha .sheet-x', flotante:true, mod:'produccion', t:'Este pedido en el taller', b:['la-ficha', 'asignar-el-trabajo-admin', 'puertas-de-madera', 'los-pasos-de-cada-producto'] },
      { ref:'#sheetTodo [data-cerrar="sheetTodo"]', etiqueta:'Cerrar', mod:'produccion', t:'Asignar trabajadores', b:['asignar-el-trabajo-admin'] },
      { ref:'#sheetCatItem [data-cerrar="sheetCatItem"]', etiqueta:'Cerrar', mod:'admin', t:'Categoría de pago', b:['categorias-de-pago'] },
      { ref:'#sheetOrden [data-cerrar="sheetOrden"]', etiqueta:'Cerrar', mod:'produccion', t:'Fabricar para exhibición', b:['fabricar-para-exhibicion-admin'] }
    ],
    'nomina.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'nomina', t:'La nómina de la semana', b:['intro', 'como-se-calcula', 'la-lista-de-la-semana', 'normas', 'avisos'] },
      { ref:'#sheetTrab [data-cerrar="sheetTrab"]', etiqueta:'Cerrar', mod:'nomina', t:'Pagar y vales', b:['pagarle-a-un-trabajador', 'vales'] },
      { ref:'#sheetVale [data-cerrar="sheetVale"]', etiqueta:'Cerrar', mod:'nomina', t:'Anotar un vale', b:['vales'] }
    ],
    'deposito.html': [
      { ref:'#btnActualizar', etiqueta:'Actualizar', mod:'deposito', t:'El depósito',
        b:['intro', 'los-materiales', 'las-entregas', 'extra-compras-y-materiales-nuevos-admin', 'normas', 'avisos'] },
      { ref:'#sheetEntregar [data-cerrar="sheetEntregar"]', etiqueta:'Cerrar', mod:'deposito', t:'Entregar material', b:['entregar-material'] },
      { ref:'#sheetMat [data-cerrar="sheetMat"]', etiqueta:'Cerrar', mod:'deposito', t:'Este material', b:['los-materiales', 'compras-y-materiales-nuevos-admin'] },
      { ref:'#sheetMatForm [data-cerrar="sheetMatForm"]', etiqueta:'Cerrar', mod:'deposito', t:'Material nuevo', b:['compras-y-materiales-nuevos-admin'] },
      { ref:'#sheetCompra [data-cerrar="sheetCompra"]', etiqueta:'Cerrar', mod:'deposito', t:'Registrar compra', b:['compras-y-materiales-nuevos-admin'] },
      { ref:'#sheetCompraGrande [data-cerrar="sheetCompraGrande"]', etiqueta:'Cerrar', mod:'deposito', t:'Compra grande', b:['compras-y-materiales-nuevos-admin'] },
      { ref:'#sheetEntrega [data-cerrar="sheetEntrega"]', etiqueta:'Cerrar', mod:'deposito', t:'Esta entrega', b:['las-entregas', 'revisar-una-entrega-admin'] }
    ],
    'categorias-pago.html': [
      { alFinal:'#topbar', mod:'admin', t:'Categorías de pago', b:['categorias-de-pago', 'normas'] },
      { ref:'#sheetFicha [data-cerrar="sheetFicha"]', etiqueta:'Cerrar', mod:'admin', t:'Crear o cambiar una categoría', b:['categorias-de-pago'] },
      { ref:'#sheetModelos [data-cerrar="sheetModelos"]', etiqueta:'Cerrar', mod:'catalogo', t:'Asignar a modelos', b:['poner-la-categoria-de-pago-admin'] }
    ],
    'usuarios.html': [
      { alFinal:'#topbar', mod:'admin', t:'Usuarios', b:['usuarios', 'normas'] },
      { ref:'#sheetNuevo [data-cerrar="sheetNuevo"]', etiqueta:'Cerrar', mod:'admin', t:'Nuevo usuario', b:['usuarios'] },
      { ref:'#sheetFicha .sheet-x', flotante:true, mod:'admin', t:'Este usuario', b:['usuarios'] }
    ],
    'index.html': [
      { ref:'#btnCuenta', etiqueta:'Mi cuenta', mod: () => rol === 't' ? 'taller' : 'inicio', t: () => rol === 't' ? 'Tu trabajo en la app' : 'Inicio y avisos',
        b: () => rol === 't' ? ['intro', 'tu-dia-en-4-pasos', 'ordenar-tu-trabajo', 'tus-pagos', 'normas', 'avisos-que-te-llegan']
          : ['activar-los-avisos-en-el-celular', 'pendientes', 'todos-los-avisos-del-celular', 'los-avisos-que-le-llegan-al-taller-admin', 'normas'] },
      { ref:'#sheetTrabajos [data-cerrar="sheetTrabajos"]', etiqueta:'Cerrar', mod:'taller', t:'Tus trabajos', b:['tu-dia-en-4-pasos'] },
      { ref:'#sheetTerminarT [data-cerrar="sheetTerminarT"]', etiqueta:'Cerrar', mod:'taller', t:'Terminar con la foto', b:['tu-dia-en-4-pasos'] },
      { ref:'#sheetOrden [data-cerrar="sheetOrden"]', etiqueta:'Cerrar', mod:'taller', t:'Ordenar el trabajo', b:['ordenar-tu-trabajo'] },
      { ref:'#sheetPagos [data-cerrar="sheetPagos"]', etiqueta:'Cerrar', mod:'taller', t:'Tus pagos', b:['tus-pagos'] },
      { ref:'#sheetVale [data-cerrar="sheetVale"]', etiqueta:'Cerrar', mod:'taller', t:'Pedir un vale', b:['tus-pagos'] }
    ]
  };

  // ---------------------------------------------------------------------------
  // Quién entró: 'a' administrador, 'v' vendedora, 't' trabajador
  // ---------------------------------------------------------------------------
  let rol = 'v';
  let confirmaPagos = false;   // quien confirma pagos (Ray) ve esa parte aunque no sea administrador
  async function leerRol(){
    try{
      const p = window.Sesion ? await window.Sesion.perfil() : null;
      rol = p && p.rol === 'admin' ? 'a' : p && p.rol === 'trabajador' ? 't' : 'v';
      confirmaPagos = !!(p && p.confirma_abonos);
    } catch(e){}
    return rol;
  }

  // ---------------------------------------------------------------------------
  // Contenido: se baja la primera vez que se abre y queda guardado (el teléfono lo guarda con ?v=)
  // ---------------------------------------------------------------------------
  const cache = {};
  function cargar(mod){
    if(!cache[mod]){
      cache[mod] = fetch(`assets/ayuda/${mod}.html?v=${V}`).then(r => {
        if(!r.ok) throw new Error('No se pudo cargar la ayuda');
        return r.text();
      }).then(h => {
        const t = document.createElement('template');
        t.innerHTML = h;
        return t.content;
      }).catch(e => { delete cache[mod]; throw e; });
    }
    return cache[mod];
  }
  function cssListo(){
    if(document.getElementById('ayudaCss')) return;
    const l = document.createElement('link');
    l.id = 'ayudaCss'; l.rel = 'stylesheet'; l.href = `assets/css/ayuda.css?v=${V}`;
    document.head.appendChild(l);
  }
  // Una sección se ve si le toca a quien entró
  function leToca(s){
    const c = s.classList;
    if(c.contains('solo-admin') && rol !== 'a' && !(confirmaPagos && s.dataset.b === 'confirmar-un-pago-admin')) return false;
    if(c.contains('solo-vend') && rol === 'a') return false;
    return true;
  }
  // Copia las secciones pedidas (en ese orden) con las fotos apuntando a assets/ayuda/img
  async function secciones(mod, bloques){
    const out = [];
    for(const b0 of bloques){
      const [m, b] = b0.includes(':') ? b0.split(':') : [mod, b0];
      const frag = await cargar(m);
      const s = frag.querySelector(`section[data-b="${CSS.escape(b)}"]`);
      if(!s || !leToca(s)) continue;
      const c = s.cloneNode(true);
      c.querySelectorAll('img').forEach(i => {
        const r = i.getAttribute('src') || '';
        if(r.startsWith('img/')) i.setAttribute('src', `assets/ayuda/${r}?v=${V}`);
        i.setAttribute('loading', 'lazy');
      });
      out.push(c);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // La hoja de ayuda (una sola, arriba de todo)
  // ---------------------------------------------------------------------------
  function asegurarHoja(){
    if(document.getElementById('sheetAyuda')) return;
    const sc = document.createElement('div');
    sc.className = 'sheet-scrim ayuda-scrim'; sc.id = 'scrimAyuda'; sc.dataset.cerrar = 'sheetAyuda';
    const h = document.createElement('section');
    h.className = 'sheet ayuda-hoja'; h.id = 'sheetAyuda';
    h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); h.setAttribute('aria-labelledby', 'ayudaTitulo');
    h.innerHTML = `<div class="sheet-handle"></div>
      <div class="sheet-head"><div class="ayuda-cab"><span class="ayuda-mod" id="ayudaMod"></span><h2 class="sheet-title" id="ayudaTitulo">Ayuda</h2></div>
        <button class="icon-btn" type="button" data-cerrar="sheetAyuda" aria-label="Cerrar la ayuda"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="sheet-body"><div class="ayuda-c" id="ayudaBody"></div></div>
      <div class="sheet-foot"><a class="btn-secondary ayuda-todo" id="ayudaTodo" href="ayuda.html">Ver el manual completo</a></div>`;
    document.body.appendChild(sc);
    document.body.appendChild(h);
    if(window.AH && window.AH.activarDeslizar) window.AH.activarDeslizar(h);
  }
  let turno = 0;   // si se abre otra ayuda antes de que llegue la anterior, la vieja no pisa a la nueva
  async function abrir(lugar){
    const mio = ++turno;
    asegurarHoja();
    cssListo();
    await leerRol();
    const val = (x) => typeof x === 'function' ? x() : x;
    const mod = val(lugar.mod);
    const bloques = (val(lugar.b) || []).filter(Boolean);
    const cuerpo = document.getElementById('ayudaBody');
    cuerpo.className = 'ayuda-c ' + rol;
    document.getElementById('ayudaMod').textContent = 'Ayuda · ' + (MODULOS[mod] || '');
    document.getElementById('ayudaTitulo').textContent = val(lugar.t) || 'Ayuda';
    document.getElementById('ayudaTodo').setAttribute('href', 'ayuda.html?m=' + encodeURIComponent(mod));
    document.getElementById('ayudaTodo').textContent = 'Ver el manual completo';
    // Desde un formulario abierto no se sale de la pantalla: se perdería lo escrito
    document.querySelector('#sheetAyuda .sheet-foot').classList.toggle('hidden', !!lugar.enHoja);
    cuerpo.innerHTML = '<div class="ayuda-cargando"><div class="sk-linea"></div><div class="sk-linea"></div><div class="sk-linea corta"></div></div>';
    const body = document.querySelector('#sheetAyuda .sheet-body');
    body.scrollTop = 0;
    window.AH.abrirHoja('sheetAyuda');
    try{
      const ss = await secciones(mod, bloques);
      if(mio !== turno) return;
      cuerpo.innerHTML = '';
      if(!ss.length) cuerpo.innerHTML = '<p class="sub">Todavía no hay ayuda para esta pantalla. Mira el manual completo.</p>';
      ss.forEach(s => cuerpo.appendChild(s));
    } catch(e){
      if(mio !== turno) return;
      cuerpo.innerHTML = `<div class="ayuda-error"><b>No se pudo abrir la ayuda.</b><span>Revisa tu internet y toca otra vez.</span><button type="button" class="btn-secondary" data-ayuda-reintentar>Reintentar</button></div>`;
      cuerpo.querySelector('[data-ayuda-reintentar]').addEventListener('click', () => abrir(lugar));
    }
  }

  // ---------------------------------------------------------------------------
  // Botón "Ayuda" con su palabra. El botón de al lado también lleva la suya (Actualizar, Cerrar…).
  // ---------------------------------------------------------------------------
  function botonAyuda(flotante){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = flotante ? 'ayuda-flota' : 'ayuda-btn';
    b.setAttribute('aria-label', 'Ayuda de esta pantalla');
    b.innerHTML = flotante ? `${ICONO}<span>Ayuda</span>` : `<span class="ayuda-caja">${ICONO}</span><span class="ayuda-pal">Ayuda</span>`;
    return b;
  }
  function poner(lugar){
    const b = botonAyuda(!!lugar.flotante);
    b.addEventListener('click', (e) => { e.stopPropagation(); abrir(lugar); });
    if(lugar.alFinal){
      const cont = document.querySelector(lugar.alFinal);
      if(!cont || cont.querySelector('.ayuda-btn')) return;
      cont.appendChild(b);
      return;
    }
    const ref = document.querySelector(lugar.ref);
    if(!ref || ref.parentElement.querySelector(':scope > .ayuda-btn, :scope > .ayuda-flota, :scope > .ayuda-par')) return;
    const hoja = ref.closest('.sheet');
    lugar.enHoja = !!hoja;
    if(lugar.flotante){
      ref.parentElement.insertBefore(b, ref);
      if(hoja) hoja.classList.add('con-ayuda-flota');
      return;
    }
    // Los dos botones juntos, cada uno con su palabra debajo
    const par = document.createElement('div');
    par.className = 'ayuda-par';
    ref.parentElement.insertBefore(par, ref);
    const col = document.createElement('span');
    col.className = 'ayuda-col';
    col.appendChild(ref);
    const pal = document.createElement('span');
    pal.className = 'ayuda-pal gris';
    pal.textContent = lugar.etiqueta || '';
    pal.setAttribute('aria-hidden', 'true');
    col.appendChild(pal);
    par.appendChild(b);
    par.appendChild(col);
  }
  function iniciar(){
    const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    (PAGINAS[pagina] || []).forEach(poner);
    leerRol();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  // ---------------------------------------------------------------------------
  // Manual completo (ayuda.html): todas las partes de un manual, o la lista de manuales
  // ---------------------------------------------------------------------------
  async function manualCompleto(mod, cont){
    cssListo();
    await leerRol();
    const frag = await cargar(mod);
    const bloques = [...frag.querySelectorAll('section[data-b]')].filter(s => !s.dataset.solo).map(s => s.dataset.b);
    const ss = await secciones(mod, bloques);
    cont.classList.remove('a', 'v', 't');
    cont.classList.add('ayuda-c', rol);
    cont.innerHTML = '';
    ss.forEach(s => cont.appendChild(s));
  }
  function manualesDe(r){
    if(r === 't') return ['taller'];
    const v = ['inicio', 'catalogo', 'venta', 'cotizaciones', 'ventas', 'produccion', 'deposito'];
    return r === 'a' ? [...v, 'nomina', 'admin', 'taller'] : v;
  }
  window.Ayuda = { abrir, manualCompleto, manualesDe, leerRol, MODULOS, esc };
})();
