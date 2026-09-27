// Catálogo interno: lista, ficha del modelo, selector de tipo y formulario corto.
// Todo va dentro de una función para no chocar con nombres globales de librerías.
(function(){
  'use strict';

  const db = window.db;
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Tipos de producto (misma lógica que la app original, formulario más corto)
  // ---------------------------------------------------------------------------
  const TIPOS = ['Puerta Multilock', 'Ventana', 'Portón', 'Combo', 'Puerta de Madera'];

  const TIPO_INFO = {
    'Puerta Multilock': { hint:'Puerta de seguridad', icon:'<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M15 11v2.5"/><path d="M9 7h.01M9 12h.01M9 17h.01"/>' },
    'Ventana':          { hint:'Con o sin protección', icon:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/>' },
    'Portón':           { hint:'Vidrio o farquilla', icon:'<path d="M2.5 20.5h19"/><rect x="3.5" y="6" width="17" height="14.5" rx="1"/><path d="M7.8 6v14.5M12 6v14.5M16.2 6v14.5"/>' },
    'Combo':            { hint:'Puerta y 2 ventanas', icon:'<rect x="3" y="3" width="9" height="18" rx="1.2"/><path d="M9.5 11.5v2"/><rect x="14" y="6" width="7" height="7" rx="1"/><path d="M17.5 6v7M14 9.5h7"/>' },
    'Puerta de Madera': { hint:'Un solo acabado', icon:'<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><rect x="8.5" y="5" width="7" height="6" rx=".8"/><rect x="8.5" y="13" width="7" height="6" rx=".8"/>' }
  };
  function iconoTipo(t, size){
    const s = size || 22;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${(TIPO_INFO[t] || TIPO_INFO['Puerta Multilock']).icon}</svg>`;
  }

  // Madera tiene un solo acabado; el resto, blanco y negro (igual que la app vieja).
  function acabados(tipo){
    if(tipo === 'Puerta de Madera') return [{ key:'Principal', label:'Foto', sw:null }];
    return [
      { key:'Blanco', label:'Blanco', sw:'sw-blanco' },
      { key:'Negro',  label:'Negro',  sw:'sw-negro' }
    ];
  }

  const OPC_VIDRIO   = [{v:'Farquilla'},{v:'Azul',sw:'sw-azul'},{v:'Espejo',sw:'sw-espejo'},{v:'Negro',sw:'sw-negro'}];
  const OPC_MANILLON = [{v:'Sin'},{v:'H'},{v:'S'},{v:'Luna'}];
  const OPC_AHUMADO  = [{v:'Sin'},{v:'Espejo',sw:'sw-espejo'},{v:'Azul',sw:'sw-azul'},{v:'Negro',sw:'sw-negro'}];
  const OPC_VARIANTE = [{v:'Con protección en puerta', t:'Con protección'},{v:'Sin protección en puerta', t:'Sin protección'}];
  const SW_COLOR = { Azul:'sw-azul', Espejo:'sw-espejo', Negro:'sw-negro' };

  // Qué se pregunta en cada tipo, en orden. Valores por defecto tomados de la app original.
  const ESQUEMA = {
    'Ventana': {
      medidas:{ alto:1, ancho:1 },
      grupos:[ { g:'ahumado', label:'Papel ahumado', opts:OPC_AHUMADO, def:'Espejo' } ],
      extras:[
        { k:'proteccion', label:'Protección' },
        { k:'marco_decorativo', label:'Marco en protección' },
        { k:'mas_hojas', label:'Más de 2 hojas' }
      ]
    },
    'Portón': {
      medidas:{ alto:2.2, ancho:3 },
      grupos:[
        { g:'vidrio', label:'Vidrio o farquilla', opts:OPC_VIDRIO, def:'Espejo' },
        { g:'manillon', label:'Manillón', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[]
    },
    'Puerta Multilock': {
      medidas:{ alto:2, ancho:1 },
      grupos:[
        { g:'vidrio', label:'Vidrio o farquilla', opts:OPC_VIDRIO, def:'Negro' },
        { g:'manillon', label:'Manillón', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[
        { k:'marco_decorativo', label:'Marco decorativo' },
        { k:'proteccion', label:'Protección' }
      ]
    },
    'Combo': {
      medidas:{ alto:2, ancho:1, label:'Medidas de la puerta' },
      grupos:[
        { g:'variante', label:'Variante', opts:OPC_VARIANTE, def:'Con protección en puerta', cols:2 },
        { g:'ahumado', label:'Papel ahumado de las ventanas', opts:OPC_AHUMADO, def:'Espejo' },
        { g:'manillon', label:'Manillón de la puerta', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[ { k:'marco_decorativo', label:'Marco decorativo' } ]
    },
    'Puerta de Madera': {
      medidas:{ alto:2, ancho:0.9 },
      grupos:[],
      extras:[]
    }
  };

  // Convierte lo elegido en pantalla a los mismos campos que usa el resto del sistema.
  function especificacionesDesdeEstado(tipo, s){
    const out = { alto: numOrNull(s.alto), ancho: numOrNull(s.ancho) };
    const esq = ESQUEMA[tipo];
    esq.grupos.forEach(({g})=>{
      const v = s[g];
      if(g === 'vidrio'){
        if(v === 'Farquilla') out.vidrio_o_farquilla = 'Farquilla';
        else { out.vidrio_o_farquilla = 'Vidrio'; out.color_vidrio = v; }
      } else if(g === 'manillon'){
        out.manillon = v !== 'Sin';
        if(out.manillon) out.manillon_tipo = v;
      } else if(g === 'ahumado'){
        out.papel_ahumado = v !== 'Sin';
        if(out.papel_ahumado) out.color_ahumado = v;
      } else if(g === 'variante'){
        out.variante = v;
      }
    });
    esq.extras.forEach(({k})=>{ out[k] = !!s[k]; });
    return out;
  }

  // Lo contrario: al editar un modelo guardado, reconstruye lo que se ve en pantalla.
  function estadoDesdeEspecificaciones(tipo, e){
    e = e || {};
    const esq = ESQUEMA[tipo];
    const s = {
      alto: e.alto != null ? e.alto : esq.medidas.alto,
      ancho: e.ancho != null ? e.ancho : esq.medidas.ancho
    };
    esq.grupos.forEach(({g, def})=>{
      let v = def;
      if(g === 'vidrio' && e.vidrio_o_farquilla){
        v = e.vidrio_o_farquilla === 'Farquilla' ? 'Farquilla' : (e.color_vidrio || def);
      } else if(g === 'manillon' && e.manillon != null){
        v = e.manillon ? (e.manillon_tipo || 'H') : 'Sin';
      } else if(g === 'ahumado' && e.papel_ahumado != null){
        v = e.papel_ahumado ? (e.color_ahumado || 'Espejo') : 'Sin';
      } else if(g === 'variante' && e.variante){
        v = e.variante;
      }
      s[g] = v;
    });
    esq.extras.forEach(({k})=>{ s[k] = !!e[k]; });
    return s;
  }

  // Especificaciones en frases cortas para la ficha del modelo.
  function resumenSpecs(tipo, e){
    e = e || {};
    const out = [];
    if(e.alto && e.ancho) out.push({ t:`${fmt.format(e.alto)} × ${fmt.format(e.ancho)} m` });
    if(e.variante) out.push({ t:e.variante });
    if(e.vidrio_o_farquilla === 'Farquilla') out.push({ t:'Farquilla' });
    else if(e.vidrio_o_farquilla === 'Vidrio') out.push({ t:'Vidrio ' + (e.color_vidrio || '').toLowerCase(), sw:SW_COLOR[e.color_vidrio] });
    if(e.papel_ahumado === true) out.push({ t:'Ahumado ' + (e.color_ahumado || '').toLowerCase(), sw:SW_COLOR[e.color_ahumado] });
    else if(e.papel_ahumado === false) out.push({ t:'Sin ahumado' });
    if(e.manillon === true) out.push({ t:'Manillón ' + (e.manillon_tipo || '') });
    if(e.proteccion) out.push({ t:'Protección' });
    if(e.marco_decorativo) out.push({ t: tipo === 'Ventana' ? 'Marco en protección' : 'Marco decorativo' });
    if(e.mas_hojas) out.push({ t:'Más de 2 hojas' });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  function esc(t){
    return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function numOrNull(v){ const n = parseFloat(v); return isFinite(n) ? n : null; }
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  function dinero(n){ return '$' + fmt.format(Number(n) || 0); }
  function buscarModelo(id){ return modelos.find(x => String(x.id) === String(id)); }

  let toastTimer = null;
  function toast(msg, tipo){
    const t = $('toast');
    t.textContent = msg;
    t.classList.toggle('error', tipo === 'error');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), tipo === 'error' ? 4200 : 2400);
  }

  function fotoPrincipal(m){
    const f = m.fotos || {};
    for(const a of acabados(m.tipo)){ if(f[a.key]) return f[a.key]; }
    return Object.values(f).find(Boolean) || null;
  }

  // ---------------------------------------------------------------------------
  // Hojas (abrir / cerrar con su fondo oscuro)
  // ---------------------------------------------------------------------------
  const pila = [];
  function abrirHoja(id){
    $(id).classList.add('open');
    $(id.replace('sheet', 'scrim')).classList.add('open');
    if(!pila.includes(id)) pila.push(id);
    document.body.style.overflow = 'hidden';
  }
  function cerrarHoja(id){
    $(id).classList.remove('open');
    $(id.replace('sheet', 'scrim')).classList.remove('open');
    const i = pila.indexOf(id);
    if(i > -1) pila.splice(i, 1);
    if(!pila.length) document.body.style.overflow = '';
  }
  document.addEventListener('click', (e)=>{
    const c = e.target.closest('[data-cerrar]');
    if(c) cerrarHoja(c.dataset.cerrar);
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && pila.length) cerrarHoja(pila[pila.length - 1]);
  });

  // ---------------------------------------------------------------------------
  // Lista de modelos
  // ---------------------------------------------------------------------------
  let modelos = [];
  let filtro = 'Todos';
  let cargando = false;

  function pintarChips(){
    const cats = ['Todos', ...TIPOS];
    $('chips').innerHTML = cats.map(c =>
      `<button class="chip ${c === filtro ? 'active' : ''}" role="tab" aria-selected="${c === filtro}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join('');
  }

  function actualizarSubtitulo(){
    const n = modelos.length;
    $('subtitulo').textContent = n === 1 ? '1 modelo' : `${n} modelos`;
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
    if(m._estado === 'guardando'){
      return `<div class="card-overlay"><span class="spinner"></span>Guardando</div>`;
    }
    if(m._estado === 'error'){
      return `<div class="card-overlay err">No se guardó
        <button class="link-btn" data-reintentar="${esc(m.id)}">Reintentar</button>
        <button class="link-btn" data-descartar="${esc(m.id)}" style="color:var(--ink-soft)">Descartar</button>
      </div>`;
    }
    return '';
  }

  function pintarLista(){
    const q = $('buscador').value.trim().toLowerCase();
    const lista = modelos.filter(m =>
      (filtro === 'Todos' || m.tipo === filtro) &&
      (!q || (m.nombre || '').toLowerCase().includes(q))
    );

    if(lista.length === 0){
      const hayFiltro = filtro !== 'Todos' || q;
      $('grid').innerHTML = `
        <div class="state">
          <div class="state-icon">${filtro !== 'Todos' ? iconoTipo(filtro, 28) : iconoTipo('Ventana', 28)}</div>
          <div class="state-title">${hayFiltro ? 'Nada por aquí' : 'Aún no hay modelos'}</div>
          <div class="state-text">${q ? 'Ningún modelo coincide con la búsqueda.' : 'Toca el botón + para agregar el primero.'}</div>
          ${filtro !== 'Todos' && !q ? `<button class="btn-secondary" data-accion="nuevo-filtro">Agregar ${esc(filtro)}</button>` : ''}
        </div>`;
      return;
    }

    $('grid').innerHTML = lista.map((m, i) => {
      const foto = fotoPrincipal(m);
      const f = m.fotos || {};
      const dots = acabados(m.tipo).filter(a => a.sw && f[a.key]);
      return `
        <div class="card-wrap" style="--i:${Math.min(i, 12)}">
          <div class="card" role="button" tabindex="0" data-id="${esc(m.id)}">
            <div class="card-photo">
              ${foto
                ? `<img src="${esc(foto)}" alt="" loading="lazy">`
                : iconoTipo(m.tipo, 34)}
              ${m.badge ? `<span class="card-badge">${esc(m.badge)}</span>` : ''}
              ${dots.length > 1 ? `<span class="card-dots">${dots.map(d => `<span class="swatch ${d.sw}"></span>`).join('')}</span>` : ''}
              ${overlayHtml(m)}
            </div>
            <div class="card-name">${esc(m.nombre)}</div>
            <div class="card-type">${esc(m.tipo)}</div>
            <div class="card-price">Desde ${dinero(m.precio_base)}</div>
          </div>
        </div>`;
    }).join('');
  }

  async function cargarModelos(){
    if(cargando) return;
    cargando = true;
    $('btnActualizar').classList.add('spinning');
    if(modelos.length === 0) pintarEsqueleto();
    try{
      if(!db) throw new Error('No se pudo conectar con la base de datos. Revisa tu conexión a internet.');
      const { data, error } = await db.from('catalogo').select('*').order('id', { ascending:false });
      if(error) throw new Error(error.message);
      // Los que se están guardando en este momento se mantienen visibles
      const lista = data || [];
      modelos.filter(m => m._estado).forEach(p => {
        const idx = p._editId != null ? lista.findIndex(x => x.id === p._editId) : -1;
        if(idx > -1) lista[idx] = p; else lista.unshift(p);
      });
      modelos = lista;
      actualizarSubtitulo();
      pintarLista();
    } catch(err){
      pintarError(err && err.message ? err.message : 'Error desconocido');
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
  $('btnActualizar').addEventListener('click', cargarModelos);

  $('grid').addEventListener('click', (e)=>{
    const r = e.target.closest('[data-reintentar]');
    if(r){ e.stopPropagation(); const t = trabajos[r.dataset.reintentar]; if(t) ejecutarTrabajo(t); return; }
    const d = e.target.closest('[data-descartar]');
    if(d){ e.stopPropagation(); descartarTrabajo(d.dataset.descartar); return; }
    const acc = e.target.closest('[data-accion]');
    if(acc){
      if(acc.dataset.accion === 'reintentar-carga') cargarModelos();
      if(acc.dataset.accion === 'nuevo-filtro') abrirForm(null, filtro);
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
  // Ficha del modelo (vista previa con Editar / Eliminar)
  // ---------------------------------------------------------------------------
  let detalleId = null;

  function abrirDetalle(m){
    detalleId = m.id;
    const f = m.fotos || {};
    const conFoto = acabados(m.tipo).filter(a => f[a.key]);
    const specs = resumenSpecs(m.tipo, m.especificaciones_base);
    const cars = Array.isArray(m.caracteristicas) ? m.caracteristicas : [];

    let html = `
      <div class="det-photo">
        ${conFoto.length
          ? conFoto.map((a, i) => `<img src="${esc(f[a.key])}" alt="${esc(m.nombre)} ${esc(a.label)}" data-acabado-img="${esc(a.key)}" class="${i ? 'off' : ''}">`).join('')
          : iconoTipo(m.tipo, 56)}
        ${m.badge ? `<span class="card-badge">${esc(m.badge)}</span>` : ''}
      </div>`;
    if(conFoto.length > 1){
      html += `
        <div class="opts det-toggle" style="--cols:${conFoto.length}">
          ${conFoto.map((a, i) => `<button type="button" class="opt ${i ? '' : 'selected'}" data-acabado="${esc(a.key)}" aria-pressed="${!i}"><span class="swatch ${a.sw}"></span>${esc(a.label)}</button>`).join('')}
        </div>`;
    }
    html += `
      <div class="det-name">${esc(m.nombre)}</div>
      <div class="det-type">${esc(m.tipo)}</div>
      <div class="det-price">Desde ${dinero(m.precio_base)}</div>`;
    if(specs.length){
      html += `
        <div class="det-section">
          <div class="det-label">Especificaciones</div>
          <div class="spec-chips">${specs.map(s => `<span class="spec-chip">${s.sw ? `<span class="swatch ${s.sw}"></span>` : ''}${esc(s.t)}</span>`).join('')}</div>
        </div>`;
    }
    if(cars.length){
      html += `
        <div class="det-section">
          <div class="det-label">Características</div>
          <ul class="feat-list">${cars.map(c => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>${esc(c)}</li>`).join('')}</ul>
        </div>`;
    }
    if(m.descripcion_publica){
      html += `
        <div class="det-section">
          <div class="det-label">Lo que ve el cliente</div>
          <div class="det-desc">${esc(m.descripcion_publica)}</div>
        </div>`;
    }
    $('detTipoHead').textContent = m.tipo;
    $('detalleBody').innerHTML = html;
    $('detalleBody').scrollTop = 0;
    abrirHoja('sheetDetalle');
  }

  $('detalleBody').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-acabado]');
    if(!b) return;
    const key = b.dataset.acabado;
    $('detalleBody').querySelectorAll('[data-acabado]').forEach(x => {
      const sel = x === b;
      x.classList.toggle('selected', sel);
      x.setAttribute('aria-pressed', sel);
    });
    $('detalleBody').querySelectorAll('[data-acabado-img]').forEach(img => {
      img.classList.toggle('off', img.dataset.acabadoImg !== key);
    });
  });

  $('btnEditar').addEventListener('click', ()=>{
    const m = buscarModelo(detalleId);
    if(!m) return;
    cerrarHoja('sheetDetalle');
    abrirForm(m.id);
  });

  $('btnEliminar').addEventListener('click', async ()=>{
    const m = buscarModelo(detalleId);
    if(!m || !db) return;
    if(!confirm(`¿Eliminar "${m.nombre}" del catálogo?`)) return;
    const btn = $('btnEliminar');
    btn.disabled = true;
    const { error } = await db.from('catalogo').delete().eq('id', m.id);
    btn.disabled = false;
    if(error){ toast('No se pudo eliminar: ' + error.message, 'error'); return; }
    modelos = modelos.filter(x => x !== m);
    cerrarHoja('sheetDetalle');
    actualizarSubtitulo();
    pintarLista();
    toast('Modelo eliminado');
  });

  // ---------------------------------------------------------------------------
  // Selector de tipo (lo primero que sale al tocar +)
  // ---------------------------------------------------------------------------
  let modoSelector = 'nuevo'; // 'nuevo' abre el formulario; 'cambiar' cambia el tipo del formulario abierto

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
  // Formulario
  // ---------------------------------------------------------------------------
  let editandoId = null;
  let tipoActual = TIPOS[0];
  let estado = {};          // valores de especificaciones en pantalla
  let fotosExistentes = {}; // acabado -> url ya guardada
  let fotosNuevas = {};     // acabado -> { blob, url }
  let caracteristicas = [];

  function pintarTipoFila(){
    $('tipoFila').innerHTML = `
      <span class="type-icon">${iconoTipo(tipoActual, 22)}</span>
      <span class="type-row-text"><span class="type-row-label" style="display:block">Tipo</span><span class="type-row-value">${esc(tipoActual)}</span></span>
      <button type="button" class="link-btn" data-accion="cambiar-tipo">Cambiar</button>`;
  }

  function pintarFotos(){
    const lista = acabados(tipoActual);
    const cont = $('fotos');
    cont.classList.toggle('single', lista.length === 1);
    cont.innerHTML = lista.map(a => {
      const url = (fotosNuevas[a.key] && fotosNuevas[a.key].url) || fotosExistentes[a.key] || '';
      const etiqueta = a.sw ? `<span class="swatch ${a.sw}"></span>${esc(a.label)}` : esc(a.label);
      return `
        <label class="photo-box ${url ? 'filled' : ''}">
          ${url
            ? `<img src="${esc(url)}" alt=""><span class="photo-tag">${etiqueta} · Cambiar</span>`
            : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
               <span style="display:inline-flex;align-items:center;gap:6px">${etiqueta}</span>`}
          <input type="file" accept="image/*" data-foto="${esc(a.key)}" aria-label="Foto ${esc(a.label)}">
        </label>`;
    }).join('');
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

  function pintarSpecs(){
    const esq = ESQUEMA[tipoActual];
    let html = `
      <div class="field">
        <span class="field-label">${esc(esq.medidas.label || 'Medidas típicas')}</span>
        <div class="input-row">
          <div class="input-affix has-r">
            <input class="input" id="specAlto" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(estado.alto ?? '')}" aria-label="Alto en metros">
            <span class="affix affix-r">alto</span>
          </div>
          <div class="input-affix has-r">
            <input class="input" id="specAncho" type="number" inputmode="decimal" step="0.01" min="0" value="${esc(estado.ancho ?? '')}" aria-label="Ancho en metros">
            <span class="affix affix-r">ancho</span>
          </div>
        </div>
        <div class="field-hint">En metros</div>
      </div>`;
    esq.grupos.forEach(g => { html += optsHtml(g, estado[g.g]); });
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

  function actualizarPrecio(){
    $('precioPreview').textContent = 'Desde ' + dinero($('fPrecio').value);
  }

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

  function cambiarTipo(t){
    // Conserva medidas escritas y fotos ya elegidas si se cambia de tipo a mitad del formulario
    const altoPrevio = estado.alto, anchoPrevio = estado.ancho, tocoMedidas = estado._medidasTocadas;
    tipoActual = t;
    estado = estadoDesdeEspecificaciones(t, null);
    if(tocoMedidas){ estado.alto = altoPrevio; estado.ancho = anchoPrevio; estado._medidasTocadas = true; }
    pintarTipoFila();
    pintarFotos();
    pintarSpecs();
  }

  function abrirForm(id, tipo){
    const m = id != null ? buscarModelo(id) : null;
    editandoId = m ? m.id : null;
    tipoActual = m ? (TIPOS.includes(m.tipo) ? m.tipo : TIPOS[0]) : (TIPOS.includes(tipo) ? tipo : TIPOS[0]);
    estado = estadoDesdeEspecificaciones(tipoActual, m ? m.especificaciones_base : null);
    fotosExistentes = m ? { ...(m.fotos || {}) } : {};
    Object.values(fotosNuevas).forEach(f => URL.revokeObjectURL(f.url));
    fotosNuevas = {};
    caracteristicas = m && Array.isArray(m.caracteristicas) ? [...m.caracteristicas] : [];

    $('formTitulo').textContent = m ? 'Editar modelo' : 'Nuevo modelo';
    $('fNombre').value = m ? (m.nombre || '') : '';
    $('fPrecio').value = m && Number(m.precio_base) ? m.precio_base : '';
    $('fBadge').value = m ? (m.badge || '') : '';
    $('fDescripcion').value = m ? (m.descripcion_publica || '') : '';
    $('fCaracteristica').value = '';
    limpiarErrores();
    setFold(false);

    pintarTipoFila();
    pintarFotos();
    pintarSpecs();
    pintarTags();
    actualizarPrecio();

    $('formBody').scrollTop = 0;
    abrirHoja('sheetForm');
  }

  $('tipoFila').addEventListener('click', (e)=>{
    if(e.target.closest('[data-accion="cambiar-tipo"]')) abrirSelector('cambiar');
  });

  $('specs').addEventListener('click', (e)=>{
    const opt = e.target.closest('.opt');
    if(opt){
      estado[opt.dataset.g] = opt.dataset.v;
      opt.parentElement.querySelectorAll('.opt').forEach(o => {
        const sel = o === opt;
        o.classList.toggle('selected', sel);
        o.setAttribute('aria-pressed', sel);
      });
      return;
    }
    const t = e.target.closest('.tchip');
    if(t){
      const k = t.dataset.k;
      estado[k] = !estado[k];
      // En ventana, el marco decorativo va sobre la protección: uno arrastra al otro
      if(tipoActual === 'Ventana'){
        if(k === 'marco_decorativo' && estado.marco_decorativo) estado.proteccion = true;
        if(k === 'proteccion' && !estado.proteccion) estado.marco_decorativo = false;
      }
      pintarExtras();
    }
  });
  $('specs').addEventListener('input', (e)=>{
    if(e.target.id === 'specAlto'){ estado.alto = e.target.value; estado._medidasTocadas = true; }
    if(e.target.id === 'specAncho'){ estado.ancho = e.target.value; estado._medidasTocadas = true; }
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
  $('fCaracteristica').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ e.preventDefault(); agregarCaracteristica(); }
  });
  $('tags').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-quitar]');
    if(!b) return;
    caracteristicas.splice(Number(b.dataset.quitar), 1);
    pintarTags();
  });

  // ---------------------------------------------------------------------------
  // Guardar en segundo plano: el formulario se cierra al instante y la tarjeta
  // muestra "Guardando" hasta que terminan de subir las fotos.
  // ---------------------------------------------------------------------------
  const trabajos = {}; // id temporal -> trabajo pendiente

  function guardar(){
    limpiarErrores();
    const nombre = $('fNombre').value.trim();
    const precio = parseFloat($('fPrecio').value);
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
      especificaciones_base: especificacionesDesdeEstado(tipoActual, estado),
      precio_base: precio,
      badge: $('fBadge').value.trim() || null,
      descripcion_publica: $('fDescripcion').value.trim() || null,
      caracteristicas: [...caracteristicas]
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

    cerrarHoja('sheetForm');
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
      const slug = t.payload.nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'modelo';
      for(const k of Object.keys(t.nuevas)){
        if(t.subidas[k]) continue; // en un reintento no se vuelve a subir lo que ya subió
        const path = `modelos/${slug}-${k.toLowerCase()}-${Date.now()}.jpg`;
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
      Object.values(t.nuevas).forEach(f => URL.revokeObjectURL(f.url));
      delete trabajos[t.tmpId];
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
    cargarModelos(); // si era una edición, vuelve a mostrar la versión guardada
  }

  $('btnGuardar').addEventListener('click', guardar);

  // Aviso si se intenta cerrar la app con algo guardándose
  window.addEventListener('beforeunload', (e)=>{
    if(Object.keys(trabajos).some(k => (buscarModelo(k) || {})._estado === 'guardando')){ e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------------------
  // Jalar hacia abajo para actualizar (solo con la app anclada al inicio;
  // en el navegador normal ya existe el gesto propio)
  // ---------------------------------------------------------------------------
  const anclada = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if(anclada){
    const ptr = $('ptr');
    let y0 = null, dy = 0;
    window.addEventListener('touchstart', (e)=>{
      if(window.scrollY > 0 || pila.length) { y0 = null; return; }
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
      if(dy * 0.5 > 60) cargarModelos();
      y0 = null;
    });
  }

  // Arranque
  pintarChips();
  cargarModelos();
})();
