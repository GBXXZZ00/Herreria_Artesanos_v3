// Catálogo interno: lista, disponibles, fichas, selector de tipo y formularios.
// Usa las piezas comunes de assets/js/comun.js (window.AH).
(function(){
  'use strict';

  const db = window.db;
  const $ = (id) => document.getElementById(id);
  const { TIPOS, TIPO_INFO, iconoTipo, acabados, tieneColores, ESQUEMA,
          especificacionesDesdeEstado, estadoDesdeEspecificaciones, resumenSpecs, medidas,
          fotoModelo, fotoPieza, esc, dinero, specChipsHtml, toast, abrirHoja, cerrarHoja, hojaAbierta, SW_COLOR, esquema, grupoActivo, avisoFotoProteccion, antesDeCerrar, clavesGrupo, numOrNull, heroAttrs, heroZoom, actualizarFondoHero } = window.AH;

  const ICON_CHEV = '<svg class="linea-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_PIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  const ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>';
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

  // ---------------------------------------------------------------------------
  // Datos
  // ---------------------------------------------------------------------------
  let modelos = [];
  let piezas = [];  // piezas disponibles (estado = disponible)
  let sedes = [];
  let categorias = []; // categorías de pago (solo las ve un admin, por RLS)
  let categoriaSeleccionada = null; // id de categoría elegida en el form del modelo
  let filtro = 'Todos';
  let primeraCarga = true;
  let cargando = false;
  const recienGuardados = {}; // id -> { fila, t } para que un refresco no deshaga un guardado

  const buscarModelo = (id) => modelos.find(x => String(x.id) === String(id));
  const buscarPieza = (id) => piezas.find(x => String(x.id) === String(id));
  const idReal = (m) => (m._editId != null ? m._editId : m.id);
  const piezasDe = (m) => piezas.filter(p => p.catalogo_id === idReal(m));
  const totalDisp = (m) => piezasDe(m).reduce((a, p) => a + (p.cantidad || 0), 0);
  const nombreSede = (id) => (sedes.find(s => s.id === id) || {}).nombre || 'Sin sede';

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------
  // Grupos de modelos que parecen repetidos: misma foto, o mismo nombre y tipo.
  // Sirve para limpiar lo que vino de la app vieja.
  const normalizar = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function gruposRevisar(){
    const lista = modelos.filter(m => !m._estado);
    const padre = {};
    const raiz = (x) => { while(padre[x] !== x){ padre[x] = padre[padre[x]]; x = padre[x]; } return x; };
    const unir = (a, b) => { padre[raiz(a)] = raiz(b); };
    const primero = {};
    lista.forEach(m => {
      padre[m.id] = m.id;
      const claves = ['n:' + m.tipo + '|' + normalizar(m.nombre)];
      const f = fotoModelo(m);
      if(f) claves.push('f:' + f);
      claves.forEach(k => { if(primero[k] != null) unir(m.id, primero[k]); else primero[k] = m.id; });
    });
    const grupos = {};
    lista.forEach(m => { const r = raiz(m.id); (grupos[r] = grupos[r] || []).push(m); });
    return Object.values(grupos).filter(g => g.length > 1).sort((a, b) => b.length - a.length);
  }

  function pintarChips(){
    const nRevisar = gruposRevisar().reduce((a, g) => a + g.length, 0);
    if(filtro === 'Revisar' && !nRevisar) filtro = 'Todos';
    const cats = ['Entrega inmediata', 'Todos', ...TIPOS, ...(nRevisar ? ['Revisar'] : [])];
    $('chips').innerHTML = cats.map(c =>
      `<button class="chip ${c === filtro ? 'active' : ''} ${c === 'Revisar' ? 'chip-revisar' : ''}" role="tab" aria-selected="${c === filtro}" data-cat="${esc(c)}">${c === 'Revisar' ? `Revisar repetidos · ${nRevisar}` : esc(c)}</button>`
    ).join('');
  }

  function actualizarSubtitulo(){
    const n = modelos.length;
    const d = piezas.reduce((a, p) => a + (p.cantidad || 0), 0);
    $('subtitulo').textContent = `${n === 1 ? '1 modelo' : n + ' modelos'} · ${d} de entrega inmediata`;
  }

  function pintarEsqueleto(){
    $('grid').innerHTML = Array.from({length:4}).map(()=>`
      <div class="sk-card">
        <div class="sk sk-photo"></div>
        <div class="sk sk-line" style="width:80%"></div>
        <div class="sk sk-line" style="width:45%;height:10px"></div>
        <div class="sk sk-line" style="width:55%;height:14px"></div>
      </div>`).join('');
  }

  function pintarError(msg){
    $('subtitulo').textContent = 'Sin conexión';
    $('grid').innerHTML = `
      <div class="state">
        <div class="state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
        </div>
        <div class="state-title">No se pudo cargar el catálogo</div>
        <div class="state-text">${esc(msg)}</div>
        <button class="btn-secondary" data-accion="reintentar-carga">Reintentar</button>
      </div>`;
  }

  function overlayHtml(m){
    if(m._estado === 'guardando') return `<div class="card-overlay"><span class="spinner"></span>Guardando</div>`;
    if(m._estado === 'error'){
      return `<div class="card-overlay err">No se guardó
        <button class="link-btn" data-reintentar="${esc(m.id)}">Reintentar</button>
        <button class="link-btn" data-descartar="${esc(m.id)}" style="color:var(--ink-soft)">Descartar</button>
      </div>`;
    }
    return '';
  }

  function tarjetaHtml(m, i, conBorrar){
    const foto = fotoModelo(m);
    const f = m.fotos || {};
    const dots = acabados(m.tipo).filter(a => a.sw && f[a.key]);
    const n = totalDisp(m);
    const etiqueta = m._estado ? '' : (n ? `<div class="card-disp">${n} de entrega inmediata</div>` : `<div class="card-disp agotado">Agotado</div>`);
    return `
      <div class="card-wrap" style="--i:${Math.min(i, 12)}">
        <div class="card" role="button" tabindex="0" data-id="${esc(m.id)}">
          <div class="card-photo">
            ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : iconoTipo(m.tipo, 34)}
            ${m.badge ? `<span class="card-badge">${esc(m.badge)}</span>` : ''}
            ${dots.length > 1 ? `<span class="card-dots">${dots.map(d => `<span class="swatch ${d.sw}"></span>`).join('')}</span>` : ''}
            ${conBorrar ? `<button class="card-del" data-borrar="${esc(m.id)}" aria-label="Eliminar ${esc(m.nombre)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg></button>` : ''}
            ${overlayHtml(m)}
          </div>
          <div class="card-name">${esc(m.nombre)}</div>
          <div class="card-type">${esc(m.tipo)}</div>
          ${etiqueta}
          <div class="card-price">Desde ${dinero(m.precio_base)}</div>
        </div>
      </div>`;
  }

  function pintarRevisar(q){
    const pendientes = modelos.filter(m => m._estado);
    let grupos = gruposRevisar();
    if(q) grupos = grupos.filter(g => g.some(m => (m.nombre || '').toLowerCase().includes(q)));
    let i = 0;
    const arriba = pendientes.map(m => tarjetaHtml(m, i++, false)).join('');
    if(!grupos.length){
      $('grid').innerHTML = arriba + `<div class="state"><div class="state-title">No quedan repetidos</div><div class="state-text">Ya está todo limpio.</div></div>`;
      return;
    }
    $('grid').innerHTML = arriba + `
      <div class="revisar-ayuda">Estos modelos tienen la misma foto o el mismo nombre. Toca la papelera en los que sobran, o abre uno para editarlo.</div>` +
      grupos.map(g => `
        <div class="grupo-head">${esc(g[0].nombre)}<span>${g.length} parecidos</span></div>
        ${g.map(m => tarjetaHtml(m, i++, true)).join('')}`).join('');
  }

  function pintarLista(){
    const q = $('buscador').value.trim().toLowerCase();
    if(filtro === 'Revisar'){ pintarRevisar(q); return; }
    const lista = modelos.filter(m => {
      if(m._estado) return true; // guardando o con error: siempre visible para poder reintentar
      if(filtro === 'Entrega inmediata' && !totalDisp(m)) return false;
      if(filtro !== 'Todos' && filtro !== 'Entrega inmediata' && m.tipo !== filtro) return false;
      return !q || (m.nombre || '').toLowerCase().includes(q);
    });

    if(lista.length === 0){
      let titulo = 'Aún no hay modelos', texto = 'Toca el botón + para agregar el primero.', boton = '';
      if(q){ titulo = 'Nada por aquí'; texto = 'Ningún modelo coincide con la búsqueda.'; }
      else if(filtro === 'Entrega inmediata'){
        titulo = 'Nada de entrega inmediata';
        texto = 'Abre un modelo y toca "Entrega inmediata" cuando tengas una pieza lista en tienda.';
        boton = `<button class="btn-secondary" data-accion="ver-todos">Ver todos los modelos</button>`;
      } else if(filtro !== 'Todos'){
        titulo = 'Nada por aquí'; texto = 'Toca el botón + para agregar el primero.';
        boton = `<button class="btn-secondary" data-accion="nuevo-filtro">Agregar ${esc(filtro)}</button>`;
      }
      $('grid').innerHTML = `
        <div class="state">
          <div class="state-icon">${iconoTipo(TIPOS.includes(filtro) ? filtro : 'Ventana', 28)}</div>
          <div class="state-title">${titulo}</div>
          <div class="state-text">${texto}</div>
          ${boton}
        </div>`;
      return;
    }

    $('grid').innerHTML = lista.map((m, i) => tarjetaHtml(m, i, false)).join('');
  }

  async function cargarDatos(){
    if(cargando) return;
    cargando = true;
    $('btnActualizar').classList.add('spinning');
    if(modelos.length === 0) pintarEsqueleto();
    try{
      if(!db) throw new Error('No se pudo conectar con la base de datos. Revisa tu conexión a internet.');
      const [rc, rp, rs, rcat] = await Promise.all([
        db.from('catalogo').select('*').order('id', { ascending:false }),
        db.from('disponibles').select('*').eq('estado', 'disponible').gt('cantidad', 0).order('id', { ascending:true }),
        db.from('sedes').select('*').eq('activa', true).order('orden', { ascending:true }),
        db.from('categorias_pago').select('id,nombre').eq('activo', true).order('nombre', { ascending:true })
      ]);
      const err = rc.error || rp.error || rs.error;
      if(err) throw new Error(err.message);
      // Si no es admin, RLS simplemente devuelve vacío (no error): el campo se oculta solo.
      categorias = rcat.data || [];
      // Los que se están guardando en este momento se mantienen visibles
      const lista = rc.data || [];
      // Lo guardado hace poco (por si este refresco salió antes de que terminara de guardarse)
      const ahora = Date.now();
      Object.keys(recienGuardados).forEach(id => {
        const r = recienGuardados[id];
        if(ahora - r.t > 60000){ delete recienGuardados[id]; return; }
        const idx = lista.findIndex(x => x.id === r.fila.id);
        if(idx > -1) lista[idx] = r.fila; else lista.unshift(r.fila);
      });
      modelos.filter(m => m._estado).forEach(p => {
        const idx = p._editId != null ? lista.findIndex(x => x.id === p._editId) : -1;
        if(idx > -1) lista[idx] = p; else lista.unshift(p);
      });
      modelos = lista;
      piezas = rp.data || [];
      sedes = rs.data || [];
      if(primeraCarga){
        filtro = piezas.length ? 'Entrega inmediata' : 'Todos';
        primeraCarga = false;
      }
      pintarChips();
      actualizarSubtitulo();
      pintarLista();
    } catch(err){
      const msg = err && err.message ? err.message : 'Error desconocido';
      // Si ya había una lista en pantalla, no se borra: solo se avisa
      if(modelos.length) toast('No se pudo actualizar: ' + msg, 'error');
      else pintarError(msg);
    } finally {
      cargando = false;
      $('btnActualizar').classList.remove('spinning');
    }
  }

  $('chips').addEventListener('click', (e)=>{
    const b = e.target.closest('.chip');
    if(!b) return;
    filtro = b.dataset.cat;
    pintarChips();
    pintarLista();
  });
  $('buscador').addEventListener('input', pintarLista);
  $('btnActualizar').addEventListener('click', cargarDatos);

  $('grid').addEventListener('click', async (e)=>{
    const del = e.target.closest('[data-borrar]');
    if(del){
      e.stopPropagation();
      const m = buscarModelo(del.dataset.borrar);
      if(m) await eliminarModelo(m, del, false);
      return;
    }
    const r = e.target.closest('[data-reintentar]');
    if(r){ e.stopPropagation(); const t = trabajos[r.dataset.reintentar]; if(t) ejecutarTrabajo(t); return; }
    const d = e.target.closest('[data-descartar]');
    if(d){ e.stopPropagation(); descartarTrabajo(d.dataset.descartar); return; }
    const acc = e.target.closest('[data-accion]');
    if(acc){
      if(acc.dataset.accion === 'reintentar-carga') cargarDatos();
      if(acc.dataset.accion === 'nuevo-filtro') abrirForm(null, filtro);
      if(acc.dataset.accion === 'ver-todos'){ filtro = 'Todos'; pintarChips(); pintarLista(); }
      return;
    }
    const card = e.target.closest('.card');
    if(!card) return;
    const m = buscarModelo(card.dataset.id);
    if(!m) return;
    if(m._estado === 'guardando'){ toast('Se está guardando, espera un momento'); return; }
    if(m._estado === 'error') return;
    abrirDetalle(m);
  });
  $('grid').addEventListener('keydown', (e)=>{
    if((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')){ e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('scroll', ()=>{
    $('topbar').classList.toggle('scrolled', window.scrollY > 4);
  }, { passive:true });

  // ---------------------------------------------------------------------------
  // Hoja de detalle con tres vistas: lista de disponibles, ficha del modelo, ficha de pieza
  // ---------------------------------------------------------------------------
  let det = { modeloId:null, vista:null, piezaId:null, desdeLista:false, acabado:null };

  function abrirDetalle(m){
    det = { modeloId:m.id, vista:null, piezaId:null, desdeLista:false };
    if(totalDisp(m)) mostrarLista(m); else mostrarModelo(m, false);
    abrirHoja('sheetDetalle');
  }

  function pintarVista(html, foot, volver){
    $('detalleVolver').innerHTML = volver
      ? `<button class="sheet-back" data-ir="${volver}">${ICON_BACK}Volver</button>` : '';
    $('detalleBody').innerHTML = `<div class="vista">${html}</div>`;
    $('detalleFoot').innerHTML = foot || '';
    $('detalleFoot').classList.toggle('hidden', !foot);
    $('detalleBody').scrollTop = 0;
    window.AH.vistaInterna('sheetDetalle', !!volver);
  }

  function mostrarLista(m){
    det.vista = 'lista';
    const ps = piezasDe(m);
    const n = totalDisp(m);
    const lineas = ps.map(p => {
      const foto = fotoPieza(p, m);
      const e = p.especificaciones || {};
      const t1 = [p.color, medidas(e)].filter(Boolean).join(' · ') || m.tipo;
      const extra = resumenSpecs(m.tipo, e, true).slice(0, 2).map(s => s.t).join(' · ');
      return `
        <button class="linea" data-pieza="${p.id}">
          <span class="linea-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : iconoTipo(m.tipo, 24)}</span>
          <span class="linea-txt">
            <span class="linea-t1">${p.color ? `<span class="swatch ${SW_COLOR[p.color] || ''}"></span>` : ''}${esc(t1)}${p.cantidad > 1 ? ` <span class="linea-cant">×${p.cantidad}</span>` : ''}</span>
            <span class="linea-t2" style="display:block">${esc(nombreSede(p.sede_id))}${extra ? ' · ' + esc(extra) : ''}</span>
          </span>
          <span class="linea-precio">${dinero(p.precio)}</span>
          ${ICON_CHEV}
        </button>`;
    }).join('');
    pintarVista(`
      <div class="vista-head">
        <div class="det-name" style="margin-top:0">${esc(m.nombre)}</div>
        <div class="det-type">${n === 1 ? '1 de entrega inmediata' : n + ' de entrega inmediata'} · ${esc(m.tipo)}</div>
      </div>
      <div class="det-section" style="margin-top:16px">
        <div class="lineas">${lineas}</div>
      </div>`, `
      <div class="det-foot">
        <button class="btn-secondary" type="button" data-ir="modelo">Ver modelo</button>
        <button class="btn-primary" type="button" data-accion="marcar">Agregar otra pieza</button>
      </div>`, null);
  }

  function mostrarModelo(m, desdeLista){
    det.vista = 'modelo';
    det.acabado = acabados(m.tipo).filter(x => (m.fotos || {})[x.key]).map(x => x.key)[0] || null;
    det.desdeLista = desdeLista;
    const f = m.fotos || {};
    const conFoto = acabados(m.tipo).filter(a => f[a.key]);
    const specs = resumenSpecs(m.tipo, m.especificaciones_base);
    const cars = Array.isArray(m.caracteristicas) ? m.caracteristicas : [];
    const n = totalDisp(m);

    let html = `
      <div ${heroAttrs(conFoto.length ? f[conFoto[0].key] : null)}>
        ${conFoto.length
          ? conFoto.map((a, i) => `<img src="${esc(f[a.key])}" alt="${esc(m.nombre)} ${esc(a.label)}" data-acabado-img="${esc(a.key)}" class="${i ? 'off' : ''}">`).join('')
          : iconoTipo(m.tipo, 56)}
        ${m.badge ? `<span class="card-badge">${esc(m.badge)}</span>` : ''}
        ${heroZoom(conFoto.length)}
      </div>`;
    if(conFoto.length > 1){
      html += `
        <div class="opts" style="--cols:${conFoto.length};margin-top:12px">
          ${conFoto.map((a, i) => `<button type="button" class="opt ${i ? '' : 'selected'}" data-acabado="${esc(a.key)}" aria-pressed="${!i}"><span class="swatch ${a.sw}"></span>${esc(a.label)}</button>`).join('')}
        </div>`;
    }
    html += `
      <div class="det-name">${esc(m.nombre)}</div>
      <div class="det-type">${esc(m.tipo)}</div>
      <div class="det-price">Desde ${dinero(m.precio_base)}</div>
      <div class="det-section" style="margin-top:14px">
        ${n
          ? `<button class="row-link" data-ir="lista"><span><span class="tag-disp" style="position:static">Entrega inmediata · ${n}</span></span>${ICON_CHEV}</button>`
          : `<div class="row-link" style="color:var(--ink-soft);cursor:default">Agotado · sin piezas en tienda</div>`}
      </div>`;
    if(specs.length){
      html += `<div class="det-section"><div class="det-label">Especificaciones</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>`;
    }
    if(cars.length){
      html += `<div class="det-section"><div class="det-label">Características</div><ul class="feat-list">${cars.map(c => `<li>${ICON_CHECK}${esc(c)}</li>`).join('')}</ul></div>`;
    }
    if(m.descripcion_publica){
      html += `<div class="det-section"><div class="det-label">Lo que ve el cliente</div><div class="det-desc">${esc(m.descripcion_publica)}</div></div>`;
    }
    const foot = `
      <div class="det-foot">
        <button class="btn-icon danger" type="button" data-accion="eliminar-modelo" aria-label="Eliminar modelo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg></button>
        <button class="btn-secondary" type="button" data-accion="editar-modelo">Editar</button>
        <button class="btn-primary" type="button" data-accion="marcar">Entrega inmediata</button>
      </div>`;
    pintarVista(html, foot, desdeLista ? 'lista' : null);
  }

  function mostrarPieza(p, m){
    det.vista = 'pieza';
    det.piezaId = p.id;
    const e = p.especificaciones || {};
    const foto = fotoPieza(p, m);
    const specs = resumenSpecs(m.tipo, e);
    const html = `
      <div ${heroAttrs(foto)}>
        ${foto ? `<img src="${esc(foto)}" alt="${esc(m.nombre)}">` : iconoTipo(m.tipo, 56)}
        ${heroZoom(foto)}
        <span class="tag-disp" style="bottom:12px;left:12px">Entrega inmediata${p.cantidad > 1 ? ' · ' + p.cantidad : ''}</span>
      </div>
      <div class="det-name">${esc(m.nombre)}</div>
      <div class="det-type">${esc([m.tipo, p.color].filter(Boolean).join(' · '))}</div>
      <div class="det-price">${dinero(p.precio)}</div>
      <div class="det-where">${ICON_PIN}Está en ${esc(nombreSede(p.sede_id))}</div>
      ${specs.length ? `<div class="det-section"><div class="det-label">Esta pieza</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>` : ''}
      ${avisoFotoProteccion(p, m) ? `<div class="det-where" style="color:var(--accent)">${ICON_CHECK}${esc(avisoFotoProteccion(p, m))}</div>` : ''}
      ${p.foto ? '' : `<div class="field-hint" style="margin-top:16px">La foto es la del modelo. Toca "Editar pieza" para ponerle la foto real.</div>`}`;
    const foot = `
      <div class="det-foot">
        <button class="btn-secondary danger" type="button" data-accion="quitar-pieza">Ya no está</button>
        <button class="btn-primary" type="button" data-accion="editar-pieza">Editar pieza</button>
      </div>`;
    pintarVista(html, foot, 'lista');
  }

  function irA(vista){
    const m = buscarModelo(det.modeloId);
    if(!m){ cerrarHoja('sheetDetalle'); return; }
    if(vista === 'lista' && totalDisp(m)) mostrarLista(m);
    else mostrarModelo(m, vista === 'modelo' && det.vista === 'lista');
  }

  $('sheetDetalle').addEventListener('click', async (e)=>{
    const ir = e.target.closest('[data-ir]');
    if(ir){ irA(ir.dataset.ir); return; }
    const lp = e.target.closest('[data-pieza]');
    if(lp){ const p = buscarPieza(lp.dataset.pieza); const m = buscarModelo(det.modeloId); if(p && m) mostrarPieza(p, m); return; }
    const ac = e.target.closest('[data-acabado]');
    if(ac){
      const key = ac.dataset.acabado;
      $('detalleBody').querySelectorAll('[data-acabado]').forEach(x => { const s = x === ac; x.classList.toggle('selected', s); x.setAttribute('aria-pressed', s); });
      $('detalleBody').querySelectorAll('[data-acabado-img]').forEach(img => img.classList.toggle('off', img.dataset.acabadoImg !== key));
      actualizarFondoHero($('detalleBody').querySelector('.hero'));
      det.acabado = key;
      return;
    }
    const a = e.target.closest('[data-accion]');
    if(!a) return;
    const m = buscarModelo(det.modeloId);
    if(!m) return;
    const accion = a.dataset.accion;
    if(accion === 'editar-modelo'){ cerrarHoja('sheetDetalle'); abrirForm(m.id); }
    if(accion === 'marcar'){ abrirFormPieza(m, null, det.vista === 'modelo' ? det.acabado : null); }
    if(accion === 'editar-pieza'){ const p = buscarPieza(det.piezaId); if(p) abrirFormPieza(m, p); }
    if(accion === 'eliminar-modelo') await eliminarModelo(m, a);
    if(accion === 'quitar-pieza') await quitarPieza(m, a);
  });

  async function eliminarModelo(m, btn, desdeHoja = true){
    if(!db) return;
    const n = totalDisp(m);
    const aviso = n ? `\n\nTambién se quitarán sus ${n} piezas de entrega inmediata.` : '';
    if(!confirm(`¿Eliminar "${m.nombre}" del catálogo?${aviso}`)) return;
    btn.disabled = true;
    const { error } = await db.from('catalogo').delete().eq('id', m.id);
    btn.disabled = false;
    if(error){ toast('No se pudo eliminar: ' + error.message, 'error'); return; }
    modelos = modelos.filter(x => x !== m);
    piezas = piezas.filter(p => p.catalogo_id !== m.id);
    if(desdeHoja) cerrarHoja('sheetDetalle');
    actualizarSubtitulo();
    pintarChips();
    pintarLista();
    toast('Modelo eliminado');
  }

  async function quitarPieza(m, btn){
    const p = buscarPieza(det.piezaId);
    if(!p || !db) return;
    const quedan = (p.cantidad || 1) - 1;
    const pregunta = quedan > 0
      ? `¿Ya no está una de estas piezas? Quedarán ${quedan}.`
      : '¿Esta pieza ya no está en tienda? (se vendió o se retiró)';
    if(!confirm(pregunta)) return;
    btn.disabled = true;
    const cambios = quedan > 0
      ? { cantidad: quedan, actualizado_en: new Date().toISOString() }
      : { estado:'retirado', actualizado_en: new Date().toISOString() };
    const { error } = await db.from('disponibles').update(cambios).eq('id', p.id);
    btn.disabled = false;
    if(error){ toast('No se pudo actualizar: ' + error.message, 'error'); return; }
    if(quedan > 0) p.cantidad = quedan; else piezas = piezas.filter(x => x !== p);
    actualizarSubtitulo();
    pintarLista();
    toast(quedan > 0 ? `Quedan ${quedan}` : 'Pieza quitada de entrega inmediata');
    if(quedan > 0) mostrarPieza(p, m); else irA('lista');
  }

  // ---------------------------------------------------------------------------
  // Selector de tipo (lo primero que sale al tocar +)
  // ---------------------------------------------------------------------------
  let modoSelector = 'nuevo';

  function abrirSelector(modo){
    modoSelector = modo;
    const actual = modo === 'cambiar' ? tipoActual : null;
    $('tipoTitulo').textContent = modo === 'cambiar' ? 'Cambiar tipo' : '¿Qué vas a agregar?';
    $('tipoGrid').innerHTML = TIPOS.map(t => `
      <button type="button" class="type-tile ${t === actual ? 'current' : ''}" data-elegir="${esc(t)}">
        <span class="type-icon">${iconoTipo(t, 24)}</span>
        <span><span class="type-name">${esc(t)}</span><span class="type-hint" style="display:block">${esc(TIPO_INFO[t].hint)}</span></span>
      </button>`).join('');
    abrirHoja('sheetTipo');
  }

  $('tipoGrid').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-elegir]');
    if(!b) return;
    const t = b.dataset.elegir;
    cerrarHoja('sheetTipo');
    if(modoSelector === 'cambiar'){ if(t !== tipoActual) cambiarTipo(t); }
    else abrirForm(null, t);
  });
  $('btnNuevo').addEventListener('click', ()=> abrirSelector('nuevo'));

  // ---------------------------------------------------------------------------
  // Categoría de pago del modelo
  // ---------------------------------------------------------------------------
  function pintarCategoriaTexto(){
    const c = categoriaSeleccionada != null ? categorias.find(x => x.id === categoriaSeleccionada) : null;
    $('categoriaTexto').textContent = c ? c.nombre : 'Sin categoría';
  }

  function abrirSelectorCategoria(){
    $('listaCategorias').innerHTML = `
      <button type="button" class="cat-fila-op ${categoriaSeleccionada == null ? 'sel' : ''}" data-cat="">Sin categoría</button>
      ${categorias.map(c => `<button type="button" class="cat-fila-op ${c.id === categoriaSeleccionada ? 'sel' : ''}" data-cat="${c.id}">${esc(c.nombre)}</button>`).join('')}`;
    abrirHoja('sheetCategoria');
  }

  $('btnCategoria').addEventListener('click', abrirSelectorCategoria);

  $('listaCategorias').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-cat]');
    if(!b) return;
    categoriaSeleccionada = b.dataset.cat ? Number(b.dataset.cat) : null;
    formSucio = true;
    pintarCategoriaTexto();
    cerrarHoja('sheetCategoria');
  });

  // ---------------------------------------------------------------------------
  // Formulario compartido: modelo nuevo / editar modelo / marcar pieza disponible
  // ---------------------------------------------------------------------------
  let modoForm = 'modelo';  // 'modelo' | 'pieza'
  let editandoId = null;    // modelo que se edita
  let piezaEditId = null;   // pieza que se edita
  let modeloPieza = null;   // modelo al que pertenece la pieza
  let tipoActual = TIPOS[0];
  let estado = {};
  let fotosExistentes = {};
  let fotosNuevas = {};
  let caracteristicas = [];
  let colorPieza = 'Blanco';
  let sedePieza = null;
  let cantidadPieza = 1;
  let guardandoPieza = false;
  let specsOriginal = null;  // especificaciones del modelo tal como estaban antes de editarlo
  let tocados = new Set();   // grupos que el usuario cambió en esta edición
  let formSucio = false;     // hay cambios sin guardar
  let formSeq = 0;           // cambia cada vez que se abre el formulario

  function acabadosForm(){
    return modoForm === 'pieza' ? [{ key:'Pieza', label:'Foto real', sw:null }] : acabados(tipoActual);
  }

  function pintarTipoFila(){
    $('tipoFila').innerHTML = `
      <span class="type-icon">${iconoTipo(tipoActual, 22)}</span>
      <span class="type-row-text"><span class="type-row-label" style="display:block">Tipo</span><span class="type-row-value">${esc(tipoActual)}</span></span>
      <button type="button" class="link-btn" data-accion="cambiar-tipo">Cambiar</button>`;
  }

  function pintarFotos(){
    const lista = acabadosForm();
    const cont = $('fotos');
    cont.classList.toggle('single', lista.length === 1);
    cont.innerHTML = lista.map(a => {
      let url = (fotosNuevas[a.key] && fotosNuevas[a.key].url) || fotosExistentes[a.key] || '';
      let tag = (a.sw ? `<span class="swatch ${a.sw}"></span>` : '') + esc(a.label) + ' · Cambiar';
      if(!url && modoForm === 'pieza'){
        const delModelo = fotoModelo(modeloPieza, colorPieza);
        if(delModelo){ url = delModelo; tag = 'Foto del modelo · Tomar foto real'; }
      }
      const etiqueta = a.sw ? `<span class="swatch ${a.sw}"></span>${esc(a.label)}` : esc(a.label);
      return `
        <label class="photo-box ${url ? 'filled' : ''}">
          ${url
            ? `<img src="${esc(url)}" alt=""><span class="photo-tag">${tag}</span>`
            : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
               <span style="display:inline-flex;align-items:center;gap:6px">${etiqueta}</span>`}
          <input type="file" accept="image/*" data-foto="${esc(a.key)}" aria-label="Foto ${esc(a.label)}">
        </label>`;
    }).join('');
  }

  function pintarColorSede(){
    const cols = acabados(tipoActual).filter(a => a.sw);
    $('optsColor').innerHTML = cols.map(a =>
      `<button type="button" class="opt ${a.key === colorPieza ? 'selected' : ''}" data-color="${a.key}" aria-pressed="${a.key === colorPieza}"><span class="swatch ${a.sw}"></span>${esc(a.label)}</button>`
    ).join('');
    $('optsSede').innerHTML = sedes.map(s =>
      `<button type="button" class="opt ${s.id === sedePieza ? 'selected' : ''}" data-sede="${s.id}" aria-pressed="${s.id === sedePieza}">${esc(s.nombre)}</button>`
    ).join('');
    $('cantValor').textContent = cantidadPieza;
  }

  function optsHtml(grupo, sel){
    const cols = grupo.cols || grupo.opts.length;
    return `
      <div class="field">
        <span class="field-label">${esc(grupo.label)}</span>
        <div class="opts" style="--cols:${cols}">
          ${grupo.opts.map(o => `
            <button type="button" class="opt ${o.v === sel ? 'selected' : ''}" data-g="${grupo.g}" data-v="${esc(o.v)}" aria-pressed="${o.v === sel}">
              ${o.sw ? `<span class="swatch ${o.sw}"></span>` : ''}${esc(o.t || o.v)}
            </button>`).join('')}
        </div>
      </div>`;
  }

  function medidasHtml(label, keyAlto, keyAncho, idAlto, idAncho){
    return `
      <div class="field">
        <span class="field-label">${esc(label)}</span>
        <div class="input-row">
          <div class="input-affix has-r">
            <input class="input" ${idAlto ? `id="${idAlto}"` : ''} data-mkey="${keyAlto}" type="text" inputmode="decimal" autocomplete="off" value="${esc(estado[keyAlto] == null ? '' : estado[keyAlto])}" aria-label="Alto en metros">
            <span class="affix affix-r">alto</span>
          </div>
          <div class="input-affix has-r">
            <input class="input" ${idAncho ? `id="${idAncho}"` : ''} data-mkey="${keyAncho}" type="text" inputmode="decimal" autocomplete="off" value="${esc(estado[keyAncho] == null ? '' : estado[keyAncho])}" aria-label="Ancho en metros">
            <span class="affix affix-r">ancho</span>
          </div>
        </div>
        <div class="field-hint">En metros</div>
      </div>`;
  }

  function grupoHtml(g){
    if(g.tipo === 'medidas') return medidasHtml(g.label, g.keys[0], g.keys[1]);
    if(g.tipo === 'texto'){
      return `
        <div class="field">
          <label class="field-label">${esc(g.label)}</label>
          <input class="input" type="text" data-texto="${g.g}" value="${esc(estado[g.g] || '')}" placeholder="${esc(g.placeholder || '')}" autocomplete="off">
        </div>`;
    }
    return optsHtml(g, estado[g.g]);
  }

  const modoEsquema = () => modoForm === 'pieza' ? 'pedido' : 'modelo';

  function pintarSpecs(){
    const esq = esquema(tipoActual, modoEsquema());
    let html = medidasHtml(modoForm === 'pieza' ? (esq.medidas.label || 'Medidas de esta pieza') : (esq.medidas.label || 'Medidas típicas'), 'alto', 'ancho', 'specAlto', 'specAncho');
    // Orden: cada grupo, y justo debajo los que dependen de él; luego los extras,
    // y al final lo que depende de un extra (ej. bloque o sentido de la protección).
    const dependeDeGrupo = (g) => g.si && typeof g.si === 'object';
    const dependeDeExtra = (g) => g.si && typeof g.si === 'string';
    esq.grupos.filter(g => !g.si).forEach(g => {
      html += grupoHtml(g);
      esq.grupos.filter(h => dependeDeGrupo(h) && h.si.g === g.g && grupoActivo(h, estado)).forEach(h => { html += grupoHtml(h); });
    });
    if(esq.extras.length){
      html += `
        <div class="field">
          <span class="field-label">Extras</span>
          <div class="toggles">
            ${esq.extras.map(x => `
              <button type="button" class="tchip ${estado[x.k] ? 'on' : ''}" data-k="${x.k}" aria-pressed="${!!estado[x.k]}">
                <span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>
                ${esc(x.label)}
              </button>`).join('')}
          </div>
        </div>`;
    }
    esq.grupos.filter(g => dependeDeExtra(g) && grupoActivo(g, estado)).forEach(g => { html += grupoHtml(g); });
    $('specs').innerHTML = html;
  }

  function pintarExtras(){
    document.querySelectorAll('#specs .tchip').forEach(b => {
      const on = !!estado[b.dataset.k];
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function pintarTags(){
    $('tags').innerHTML = caracteristicas.map((c, i) => `
      <span class="tag">${esc(c)}
        <button type="button" data-quitar="${i}" aria-label="Quitar ${esc(c)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>`).join('');
    actualizarResumenPublico();
  }

  function actualizarResumenPublico(){
    const partes = [];
    if($('fBadge').value.trim()) partes.push('Etiqueta');
    if($('fDescripcion').value.trim()) partes.push('Descripción');
    if(caracteristicas.length) partes.push(caracteristicas.length + (caracteristicas.length === 1 ? ' característica' : ' características'));
    $('foldResumen').textContent = partes.length ? partes.join(' · ') : 'Etiqueta, descripción y características';
  }

  function actualizarPrecio(){ $('precioPreview').textContent = 'Desde ' + dinero(numOrNull($('fPrecio').value) || 0); }

  function setFold(abierto){
    const f = $('foldPublico');
    $('foldPublicoBtn').setAttribute('aria-expanded', abierto);
    if(abierto){
      f.classList.add('open');
      requestAnimationFrame(()=> requestAnimationFrame(()=> f.classList.add('shown')));
    } else {
      f.classList.remove('open', 'shown');
    }
  }

  function limpiarErrores(){
    $('campoNombre').classList.remove('invalid');
    $('campoPrecio').classList.remove('invalid');
  }

  function aplicarModo(){
    const pieza = modoForm === 'pieza';
    $('tipoFila').classList.toggle('hidden', pieza);
    $('campoNombre').classList.toggle('hidden', pieza);
    $('foldPublico').classList.toggle('hidden', pieza);
    $('campoColor').classList.toggle('hidden', !pieza || !tieneColores(tipoActual));
    $('campoSede').classList.toggle('hidden', !pieza);
    $('campoCantidad').classList.toggle('hidden', !pieza);
    $('campoCategoria').classList.toggle('hidden', pieza || categorias.length === 0);
    $('fotosHint').classList.toggle('hidden', !pieza);
    $('precioPreviewFila').classList.toggle('hidden', pieza);
    $('fotosLabel').textContent = pieza ? 'Foto de la pieza' : 'Fotos';
    $('precioLabel').textContent = pieza ? 'Precio de esta pieza' : 'Precio base';
    $('btnGuardar').textContent = pieza ? (piezaEditId ? 'Guardar cambios' : 'Guardar pieza') : 'Guardar modelo';
  }

  function cambiarTipo(t){
    specsOriginal = null;
    formSucio = true;
    const altoPrevio = estado.alto, anchoPrevio = estado.ancho, tocoMedidas = estado._medidasTocadas;
    tipoActual = t;
    estado = estadoDesdeEspecificaciones(t, null);
    if(tocoMedidas){ estado.alto = altoPrevio; estado.ancho = anchoPrevio; estado._medidasTocadas = true; }
    pintarTipoFila();
    pintarFotos();
    pintarSpecs();
  }

  function limpiarFotosNuevas(){
    Object.values(fotosNuevas).forEach(f => URL.revokeObjectURL(f.url));
    fotosNuevas = {};
  }

  function abrirForm(id, tipo){
    const m = id != null ? buscarModelo(id) : null;
    formSeq++;
    specsOriginal = m ? { ...(m.especificaciones_base || {}) } : null;
    tocados = new Set();
    formSucio = false;
    $('btnGuardar').disabled = false;
    modoForm = 'modelo';
    editandoId = m ? m.id : null;
    piezaEditId = null;
    modeloPieza = null;
    tipoActual = m ? (TIPOS.includes(m.tipo) ? m.tipo : TIPOS[0]) : (TIPOS.includes(tipo) ? tipo : TIPOS[0]);
    estado = estadoDesdeEspecificaciones(tipoActual, m ? m.especificaciones_base : null);
    fotosExistentes = m ? { ...(m.fotos || {}) } : {};
    limpiarFotosNuevas();
    caracteristicas = m && Array.isArray(m.caracteristicas) ? [...m.caracteristicas] : [];
    categoriaSeleccionada = m ? (m.categoria_pago_id || null) : null;
    pintarCategoriaTexto();

    $('formTitulo').textContent = m ? 'Editar modelo' : 'Nuevo modelo';
    $('formSub').textContent = '';
    $('fNombre').value = m ? (m.nombre || '') : '';
    $('fPrecio').value = m && Number(m.precio_base) ? m.precio_base : '';
    $('fBadge').value = m ? (m.badge || '') : '';
    $('fDescripcion').value = m ? (m.descripcion_publica || '') : '';
    $('fCaracteristica').value = '';
    limpiarErrores();
    setFold(false);
    aplicarModo();

    pintarTipoFila();
    pintarFotos();
    pintarSpecs();
    pintarTags();
    actualizarPrecio();
    $('formBody').scrollTop = 0;
    abrirHoja('sheetForm');
  }

  function abrirFormPieza(m, p, colorElegido){
    formSeq++;
    specsOriginal = null;
    tocados = new Set();
    formSucio = false;
    $('btnGuardar').disabled = false;
    modoForm = 'pieza';
    modeloPieza = m;
    piezaEditId = p ? p.id : null;
    editandoId = null;
    tipoActual = m.tipo;
    estado = estadoDesdeEspecificaciones(tipoActual, p ? p.especificaciones : m.especificaciones_base, 'pedido');
    fotosExistentes = p && p.foto ? { Pieza: p.foto } : {};
    limpiarFotosNuevas();
    const f = m.fotos || {};
    // Color: el de la pieza al editar; si no, el que se estaba viendo en la ficha; si no, el que tenga foto
    colorPieza = p && p.color ? p.color
      : !tieneColores(m.tipo) ? null
      : (colorElegido === 'Blanco' || colorElegido === 'Negro') ? colorElegido
      : (f.Blanco ? 'Blanco' : (f.Negro ? 'Negro' : 'Blanco'));
    sedePieza = p && p.sede_id ? p.sede_id : (sedes[0] ? sedes[0].id : null);
    cantidadPieza = p ? (p.cantidad || 1) : 1;
    // Las ventanas del combo salen del mismo color que la puerta, salvo que ya estuviera guardado otro
    if(m.tipo === 'Combo'){
      if(p && p.especificaciones && p.especificaciones.ventanas_color) estado._ventanasColorTocado = p.especificaciones.ventanas_color !== p.color;
      else estado.ventanas_color = colorPieza || 'Blanco';
    }

    $('formTitulo').textContent = p ? 'Editar pieza' : 'Entrega inmediata';
    $('formSub').textContent = m.nombre;
    $('fPrecio').value = p ? p.precio : (Number(m.precio_base) || '');
    limpiarErrores();
    aplicarModo();
    pintarFotos();
    pintarColorSede();
    pintarSpecs();
    $('formBody').scrollTop = 0;
    abrirHoja('sheetForm');
  }

  ['input', 'change', 'click'].forEach(ev => $('formBody').addEventListener(ev, (e)=>{
    if(ev === 'click' && !e.target.closest('.opt, .tchip, [data-cant], [data-color], [data-sede], [data-quitar], #btnAgregarCar')) return;
    formSucio = true;
  }));
  antesDeCerrar.sheetForm = () => !formSucio || confirm('¿Salir sin guardar los cambios?');

  $('tipoFila').addEventListener('click', (e)=>{
    if(e.target.closest('[data-accion="cambiar-tipo"]')) abrirSelector('cambiar');
  });

  $('specs').addEventListener('click', (e)=>{
    const opt = e.target.closest('.opt');
    if(opt){
      const g = opt.dataset.g;
      estado[g] = opt.dataset.v;
      tocados.add(g);
      if(g === 'ventanas_color') estado._ventanasColorTocado = true;
      const hayDependientes = esquema(tipoActual, modoEsquema()).grupos.some(h => h.si && typeof h.si === 'object' && h.si.g === g);
      if(hayDependientes){ pintarSpecs(); return; }
      opt.parentElement.querySelectorAll('.opt').forEach(o => { const s = o === opt; o.classList.toggle('selected', s); o.setAttribute('aria-pressed', s); });
      return;
    }
    const t = e.target.closest('.tchip');
    if(t){
      const k = t.dataset.k;
      estado[k] = !estado[k];
      tocados.add(k);
      if(tipoActual === 'Ventana'){
        if(k === 'marco_decorativo' && estado.marco_decorativo) estado.proteccion = true;
        if(k === 'proteccion' && !estado.proteccion) estado.marco_decorativo = false;
      }
      const depende = esquema(tipoActual, modoEsquema()).grupos.some(g => g.si === k);
      if(depende) pintarSpecs(); else pintarExtras();
    }
  });
  $('specs').addEventListener('input', (e)=>{
    const mk = e.target.dataset.mkey;
    if(mk){ estado[mk] = e.target.value; tocados.add(mk); if(mk === 'alto' || mk === 'ancho') estado._medidasTocadas = true; }
    const tx = e.target.dataset.texto;
    if(tx){ estado[tx] = e.target.value; tocados.add(tx); }
  });

  $('optsColor').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-color]');
    if(!b) return;
    colorPieza = b.dataset.color;
    pintarColorSede();
    pintarFotos(); // la foto de respaldo cambia al color elegido
    if(tipoActual === 'Combo' && !estado._ventanasColorTocado){ estado.ventanas_color = colorPieza; pintarSpecs(); }
  });
  $('optsSede').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-sede]');
    if(!b) return;
    sedePieza = Number(b.dataset.sede);
    pintarColorSede();
  });
  $('campoCantidad').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-cant]');
    if(!b) return;
    cantidadPieza = Math.min(99, Math.max(1, cantidadPieza + Number(b.dataset.cant)));
    $('cantValor').textContent = cantidadPieza;
  });

  $('fotos').addEventListener('change', async (e)=>{
    const inp = e.target.closest('input[data-foto]');
    if(!inp || !inp.files || !inp.files[0]) return;
    const key = inp.dataset.foto;
    try{
      const blob = await comprimirFoto(inp.files[0]);
      if(fotosNuevas[key]) URL.revokeObjectURL(fotosNuevas[key].url);
      fotosNuevas[key] = { blob, url: URL.createObjectURL(blob) };
      pintarFotos();
    } catch(err){
      toast('No se pudo leer esa foto, prueba con otra', 'error');
    }
  });

  $('fNombre').addEventListener('input', ()=> $('campoNombre').classList.remove('invalid'));
  $('fPrecio').addEventListener('input', ()=>{ $('campoPrecio').classList.remove('invalid'); actualizarPrecio(); });
  $('fBadge').addEventListener('input', actualizarResumenPublico);
  $('fDescripcion').addEventListener('input', actualizarResumenPublico);
  $('foldPublicoBtn').addEventListener('click', ()=> setFold(!$('foldPublico').classList.contains('open')));

  function agregarCaracteristica(){
    const v = $('fCaracteristica').value.trim();
    if(!v) return;
    if(!caracteristicas.includes(v)) caracteristicas.push(v);
    $('fCaracteristica').value = '';
    pintarTags();
    $('fCaracteristica').focus();
  }
  $('btnAgregarCar').addEventListener('click', agregarCaracteristica);
  $('fCaracteristica').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); agregarCaracteristica(); } });
  $('tags').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-quitar]');
    if(!b) return;
    caracteristicas.splice(Number(b.dataset.quitar), 1);
    pintarTags();
  });

  function slug(t){
    return String(t).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'modelo';
  }

  // ---------------------------------------------------------------------------
  // Guardar pieza disponible (rápido: una fila y, si hay, una foto)
  // ---------------------------------------------------------------------------
  async function guardarPieza(){
    if(guardandoPieza) return;
    limpiarErrores();
    const precio = numOrNull($('fPrecio').value);
    if(!(precio > 0)){ $('campoPrecio').classList.add('invalid'); $('campoPrecio').scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if(!db){ toast('Sin conexión con la base de datos', 'error'); return; }
    const m = modeloPieza;
    const btn = $('btnGuardar');
    const seq = formSeq;
    const editId = piezaEditId;
    guardandoPieza = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Guardando';
    try{
      let foto = fotosExistentes.Pieza || null;
      if(fotosNuevas.Pieza){
        const path = `piezas/${slug(m.nombre)}-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage.from('catalogo-fotos').upload(path, fotosNuevas.Pieza.blob, { contentType:'image/jpeg' });
        if(upErr) throw new Error('No se pudo subir la foto: ' + upErr.message);
        foto = db.storage.from('catalogo-fotos').getPublicUrl(path).data.publicUrl;
      }
      const fila = {
        catalogo_id: m.id,
        sede_id: sedePieza,
        color: tieneColores(m.tipo) ? colorPieza : null,
        especificaciones: especificacionesDesdeEstado(m.tipo, estado, 'pedido'),
        foto,
        cantidad: cantidadPieza,
        precio,
        estado: 'disponible',
        actualizado_en: new Date().toISOString()
      };
      const q = editId != null
        ? db.from('disponibles').update(fila).eq('id', editId).select().single()
        : db.from('disponibles').insert(fila).select().single();
      const { data, error } = await q;
      if(error) throw new Error(error.message);
      if(editId != null){
        const i = piezas.findIndex(x => x.id === editId);
        if(i > -1) piezas[i] = data;
      } else {
        piezas.push(data);
      }
      actualizarSubtitulo();
      pintarChips();
      pintarLista();
      toast(editId != null ? 'Pieza actualizada' : 'Agregada a entrega inmediata');
      // Solo se cierra el formulario y se muestra la pieza si el usuario sigue en este mismo formulario
      if(seq === formSeq){
        limpiarFotosNuevas();
        formSucio = false;
        cerrarHoja('sheetForm', true);
        det.modeloId = m.id;
        if(editId != null) mostrarPieza(data, m); else mostrarLista(m);
        if(!$('sheetDetalle').classList.contains('open')) abrirHoja('sheetDetalle');
      }
    } catch(err){
      toast(err && err.message ? err.message : 'No se pudo guardar', 'error');
    } finally {
      guardandoPieza = false;
      if(seq === formSeq){ btn.disabled = false; aplicarModo(); }
    }
  }

  // ---------------------------------------------------------------------------
  // Guardar modelo en segundo plano: el formulario se cierra al instante y la
  // tarjeta muestra "Guardando" hasta que terminan de subir las fotos.
  // ---------------------------------------------------------------------------
  const trabajos = {};

  // Al editar un modelo: no inventa valores en grupos que el modelo no tenía y el usuario
  // no tocó, y conserva los campos que este formulario no maneja.
  function especificacionesParaGuardar(){
    const nuevo = especificacionesDesdeEstado(tipoActual, estado);
    if(!specsOriginal) return nuevo;
    const orig = specsOriginal;
    const esq = esquema(tipoActual, 'modelo');
    const manejadas = new Set(['alto', 'ancho']);
    const tiene = (claves) => claves.some(k => Object.prototype.hasOwnProperty.call(orig, k));
    if(!tiene(['alto', 'ancho']) && !tocados.has('alto') && !tocados.has('ancho')){ delete nuevo.alto; delete nuevo.ancho; }
    esq.grupos.forEach(g => {
      const claves = clavesGrupo(g);
      claves.forEach(k => manejadas.add(k));
      const tocado = tocados.has(g.g) || claves.some(k => tocados.has(k));
      if(!tiene(claves) && !tocado) claves.forEach(k => { delete nuevo[k]; });
    });
    esq.extras.forEach(x => {
      manejadas.add(x.k);
      if(!tiene([x.k]) && !tocados.has(x.k)) delete nuevo[x.k];
    });
    Object.keys(orig).forEach(k => { if(!manejadas.has(k)) nuevo[k] = orig[k]; });
    return nuevo;
  }

  function guardarModelo(){
    limpiarErrores();
    const nombre = $('fNombre').value.trim();
    const precio = numOrNull($('fPrecio').value);
    let primerError = null;
    if(!nombre){ $('campoNombre').classList.add('invalid'); primerError = primerError || $('campoNombre'); }
    if(!(precio > 0)){ $('campoPrecio').classList.add('invalid'); primerError = primerError || $('campoPrecio'); }
    if(primerError){ primerError.scrollIntoView({ behavior:'smooth', block:'center' }); return; }
    if(!db){ toast('Sin conexión con la base de datos', 'error'); return; }

    const validas = acabados(tipoActual).map(a => a.key);
    const existentes = {}, nuevas = {};
    validas.forEach(k => {
      if(fotosNuevas[k]) nuevas[k] = fotosNuevas[k];
      else if(fotosExistentes[k]) existentes[k] = fotosExistentes[k];
    });
    Object.keys(fotosNuevas).forEach(k => { if(!validas.includes(k)) URL.revokeObjectURL(fotosNuevas[k].url); });
    fotosNuevas = {};

    const payload = {
      nombre,
      tipo: tipoActual,
      especificaciones_base: especificacionesParaGuardar(),
      precio_base: precio,
      badge: $('fBadge').value.trim() || null,
      descripcion_publica: $('fDescripcion').value.trim() || null,
      caracteristicas: [...caracteristicas],
      categoria_pago_id: categoriaSeleccionada
    };

    const tmpId = 'tmp-' + Date.now();
    const trabajo = { tmpId, editId: editandoId, payload, existentes, nuevas, subidas:{} };
    trabajos[tmpId] = trabajo;

    const vista = { ...payload, id: tmpId, _editId: editandoId, _estado:'guardando', fotos:{ ...existentes } };
    Object.keys(nuevas).forEach(k => { vista.fotos[k] = nuevas[k].url; });
    if(editandoId != null){
      const idx = modelos.findIndex(x => x.id === editandoId);
      if(idx > -1) modelos[idx] = vista; else modelos.unshift(vista);
    } else {
      modelos.unshift(vista);
    }
    if(filtro === 'Entrega inmediata' && editandoId == null){ filtro = 'Todos'; pintarChips(); }

    formSucio = false;
    cerrarHoja('sheetForm', true);
    actualizarSubtitulo();
    pintarLista();
    window.scrollTo({ top:0, behavior:'smooth' });
    ejecutarTrabajo(trabajo);
  }

  function marcar(tmpId, estadoNuevo){
    const m = buscarModelo(tmpId);
    if(m) m._estado = estadoNuevo;
    pintarLista();
  }

  async function ejecutarTrabajo(t){
    marcar(t.tmpId, 'guardando');
    try{
      const s = slug(t.payload.nombre);
      for(const k of Object.keys(t.nuevas)){
        if(t.subidas[k]) continue;
        const path = `modelos/${s}-${k.toLowerCase()}-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage.from('catalogo-fotos').upload(path, t.nuevas[k].blob, { contentType:'image/jpeg' });
        if(upErr) throw new Error('No se pudo subir la foto: ' + upErr.message);
        t.subidas[k] = db.storage.from('catalogo-fotos').getPublicUrl(path).data.publicUrl;
      }
      const payload = { ...t.payload, fotos:{ ...t.existentes, ...t.subidas } };
      const q = t.editId != null
        ? db.from('catalogo').update(payload).eq('id', t.editId).select().single()
        : db.from('catalogo').insert(payload).select().single();
      const { data, error } = await q;
      if(error) throw new Error(error.message);

      const idx = modelos.findIndex(x => x.id === t.tmpId);
      const real = data || { ...payload, id: t.editId };
      if(idx > -1) modelos[idx] = real; else modelos.unshift(real);
      if(real.id != null) recienGuardados[real.id] = { fila: real, t: Date.now() };
      Object.values(t.nuevas).forEach(f => URL.revokeObjectURL(f.url));
      delete trabajos[t.tmpId];
      actualizarSubtitulo();
      pintarChips();
      pintarLista();
      toast(t.editId != null ? 'Modelo actualizado' : 'Modelo agregado al catálogo');
    } catch(err){
      marcar(t.tmpId, 'error');
      toast(err && err.message ? err.message : 'No se pudo guardar', 'error');
    }
  }

  function descartarTrabajo(tmpId){
    const t = trabajos[tmpId];
    if(!t) return;
    if(!confirm('¿Descartar lo que no se guardó?')) return;
    Object.values(t.nuevas).forEach(f => URL.revokeObjectURL(f.url));
    delete trabajos[tmpId];
    modelos = modelos.filter(x => x.id !== tmpId);
    actualizarSubtitulo();
    pintarLista();
    cargarDatos();
  }

  $('btnGuardar').addEventListener('click', ()=>{ if(modoForm === 'pieza') guardarPieza(); else guardarModelo(); });

  window.addEventListener('beforeunload', (e)=>{
    if(Object.keys(trabajos).some(k => (buscarModelo(k) || {})._estado === 'guardando')){ e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------------------
  // Jalar hacia abajo para actualizar (solo con la app anclada al inicio)
  // ---------------------------------------------------------------------------
  const anclada = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if(anclada){
    const ptr = $('ptr');
    let y0 = null, dy = 0;
    window.addEventListener('touchstart', (e)=>{
      if(window.scrollY > 0 || hojaAbierta()) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
      ptr.classList.remove('anim');
    }, { passive:true });
    window.addEventListener('touchmove', (e)=>{
      if(y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      const d = Math.min(dy * 0.5, 70);
      ptr.style.opacity = Math.min(d / 50, 1);
      ptr.style.transform = `translateY(${d - 40}px) rotate(${d * 4}deg)`;
    }, { passive:true });
    window.addEventListener('touchend', ()=>{
      if(y0 == null) return;
      ptr.classList.add('anim');
      ptr.style.opacity = 0;
      ptr.style.transform = 'translateY(-40px)';
      if(dy * 0.5 > 60) cargarDatos();
      y0 = null;
    });
  }

  // Arranque
  pintarChips();
  cargarDatos();
})();
