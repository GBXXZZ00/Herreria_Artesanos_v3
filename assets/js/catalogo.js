// Catálogo interno: lista de modelos + formulario corto de nuevo / editar modelo.
// Todo va dentro de una función para no chocar con nombres globales de librerías.
(function(){
  'use strict';

  const db = window.db;
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------------------------
  // Configuración de tipos (misma lógica que la app original, formulario más corto)
  // ---------------------------------------------------------------------------
  const TIPOS = ['Puerta Multilock', 'Ventana', 'Portón', 'Combo', 'Puerta de Madera'];

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
    const orden = acabados(m.tipo).map(a => a.key);
    for(const k of orden){ if(f[k]) return f[k]; }
    const cualquiera = Object.values(f).find(Boolean);
    return cualquiera || null;
  }

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
        <button class="btn-secondary" data-accion="reintentar">Reintentar</button>
      </div>`;
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
          <div class="state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v6"/></svg>
          </div>
          <div class="state-title">${hayFiltro ? 'Nada por aquí' : 'Aún no hay modelos'}</div>
          <div class="state-text">${q ? 'Ningún modelo coincide con la búsqueda.' : 'Toca el botón + para agregar el primero.'}</div>
          ${filtro !== 'Todos' && !q ? `<button class="btn-secondary" data-accion="nuevo">Agregar ${esc(filtro)}</button>` : ''}
        </div>`;
      return;
    }

    $('grid').innerHTML = lista.map((m, i) => {
      const foto = fotoPrincipal(m);
      const f = m.fotos || {};
      const dots = acabados(m.tipo).filter(a => a.sw && f[a.key]);
      return `
        <div class="card-wrap" style="--i:${Math.min(i, 12)}">
          <button class="card" data-id="${m.id}">
            <div class="card-photo">
              ${foto
                ? `<img src="${esc(foto)}" alt="" loading="lazy">`
                : `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>`}
              ${m.badge ? `<span class="card-badge">${esc(m.badge)}</span>` : ''}
              ${dots.length > 1 ? `<span class="card-dots">${dots.map(d => `<span class="swatch ${d.sw}"></span>`).join('')}</span>` : ''}
            </div>
            <div class="card-name">${esc(m.nombre)}</div>
            <div class="card-type">${esc(m.tipo)}</div>
            <div class="card-price">Desde ${dinero(m.precio_base)}</div>
          </button>
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
      modelos = data || [];
      $('subtitulo').textContent = modelos.length === 1 ? '1 modelo' : `${modelos.length} modelos`;
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
    const card = e.target.closest('.card');
    if(card){ abrirHoja(Number(card.dataset.id)); return; }
    const acc = e.target.closest('[data-accion]');
    if(!acc) return;
    if(acc.dataset.accion === 'reintentar') cargarModelos();
    if(acc.dataset.accion === 'nuevo') abrirHoja(null);
  });
  window.addEventListener('scroll', ()=>{
    $('topbar').classList.toggle('scrolled', window.scrollY > 4);
  }, { passive:true });

  // ---------------------------------------------------------------------------
  // Formulario (hoja inferior)
  // ---------------------------------------------------------------------------
  let editandoId = null;
  let tipoActual = TIPOS[0];
  let estado = {};          // valores de especificaciones en pantalla
  let fotosExistentes = {}; // key -> url ya guardada
  let fotosNuevas = {};     // key -> { blob, url }
  let caracteristicas = [];
  let guardando = false;

  function pintarTipos(){
    $('tipos').innerHTML = TIPOS.map(t =>
      `<button type="button" class="chip ${t === tipoActual ? 'active' : ''}" data-tipo="${esc(t)}">${esc(t)}</button>`
    ).join('');
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
    // Conserva las medidas escritas si el usuario cambia de tipo a mitad del formulario
    const altoPrevio = estado.alto, anchoPrevio = estado.ancho, tocoMedidas = estado._medidasTocadas;
    tipoActual = t;
    estado = estadoDesdeEspecificaciones(t, null);
    if(tocoMedidas){ estado.alto = altoPrevio; estado.ancho = anchoPrevio; estado._medidasTocadas = true; }
    // Las fotos ya elegidas se conservan aunque cambies de tipo y vuelvas; al guardar solo
    // se suben las que corresponden al tipo final.
    pintarTipos();
    pintarFotos();
    pintarSpecs();
  }

  function abrirHoja(id){
    const m = id != null ? modelos.find(x => x.id === id) : null;
    editandoId = m ? m.id : null;
    tipoActual = m ? (TIPOS.includes(m.tipo) ? m.tipo : TIPOS[0]) : (filtro !== 'Todos' ? filtro : TIPOS[0]);
    estado = estadoDesdeEspecificaciones(tipoActual, m ? m.especificaciones_base : null);
    fotosExistentes = m ? { ...(m.fotos || {}) } : {};
    Object.values(fotosNuevas).forEach(f => URL.revokeObjectURL(f.url));
    fotosNuevas = {};
    caracteristicas = m && Array.isArray(m.caracteristicas) ? [...m.caracteristicas] : [];

    $('sheetTitulo').textContent = m ? 'Editar modelo' : 'Nuevo modelo';
    $('fNombre').value = m ? (m.nombre || '') : '';
    $('fPrecio').value = m && Number(m.precio_base) ? m.precio_base : '';
    $('fBadge').value = m ? (m.badge || '') : '';
    $('fDescripcion').value = m ? (m.descripcion_publica || '') : '';
    $('fCaracteristica').value = '';
    $('btnEliminar').classList.toggle('hidden', !m);
    limpiarErrores();
    setFold(false);

    pintarTipos();
    pintarFotos();
    pintarSpecs();
    pintarTags();
    actualizarPrecio();

    $('sheetBody').scrollTop = 0;
    document.body.style.overflow = 'hidden';
    $('scrim').classList.add('open');
    $('sheet').classList.add('open');
  }

  function cerrarHoja(){
    if(guardando) return;
    $('scrim').classList.remove('open');
    $('sheet').classList.remove('open');
    document.body.style.overflow = '';
  }

  $('btnNuevo').addEventListener('click', ()=> abrirHoja(null));
  $('btnCerrar').addEventListener('click', cerrarHoja);
  $('scrim').addEventListener('click', cerrarHoja);
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') cerrarHoja(); });

  $('tipos').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-tipo]');
    if(b && b.dataset.tipo !== tipoActual) cambiarTipo(b.dataset.tipo);
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

  function setGuardando(on){
    guardando = on;
    const b = $('btnGuardar');
    b.disabled = on;
    b.innerHTML = on ? '<span class="spinner"></span>Guardando' : 'Guardar modelo';
  }

  async function guardar(){
    if(guardando) return;
    limpiarErrores();
    const nombre = $('fNombre').value.trim();
    const precio = parseFloat($('fPrecio').value);
    let primerError = null;
    if(!nombre){ $('campoNombre').classList.add('invalid'); primerError = primerError || $('campoNombre'); }
    if(!(precio > 0)){ $('campoPrecio').classList.add('invalid'); primerError = primerError || $('campoPrecio'); }
    if(primerError){
      primerError.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    if(!db){ toast('Sin conexión con la base de datos', 'error'); return; }

    setGuardando(true);
    try{
      // Subir solo las fotos nuevas; las ya guardadas se conservan
      const validas = acabados(tipoActual).map(a => a.key);
      const fotos = {};
      validas.forEach(k => { if(fotosExistentes[k]) fotos[k] = fotosExistentes[k]; });
      const slug = nombre.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase() || 'modelo';
      for(const k of Object.keys(fotosNuevas)){
        if(!validas.includes(k)) continue;
        const path = `modelos/${slug}-${k.toLowerCase()}-${Date.now()}.jpg`;
        const { error: upErr } = await db.storage.from('catalogo-fotos').upload(path, fotosNuevas[k].blob, { contentType:'image/jpeg' });
        if(upErr) throw new Error('No se pudo subir la foto: ' + upErr.message);
        fotos[k] = db.storage.from('catalogo-fotos').getPublicUrl(path).data.publicUrl;
      }

      const payload = {
        nombre,
        tipo: tipoActual,
        fotos,
        especificaciones_base: especificacionesDesdeEstado(tipoActual, estado),
        precio_base: precio,
        badge: $('fBadge').value.trim() || null,
        descripcion_publica: $('fDescripcion').value.trim() || null,
        caracteristicas
      };

      if(editandoId != null){
        const { error } = await db.from('catalogo').update(payload).eq('id', editandoId);
        if(error) throw new Error(error.message);
      } else {
        const { error } = await db.from('catalogo').insert(payload);
        if(error) throw new Error(error.message);
      }
      setGuardando(false);
      cerrarHoja();
      toast(editandoId != null ? 'Modelo actualizado' : 'Modelo agregado al catálogo');
      await cargarModelos();
    } catch(err){
      setGuardando(false);
      toast(err && err.message ? err.message : 'No se pudo guardar, intenta de nuevo', 'error');
    }
  }
  $('btnGuardar').addEventListener('click', guardar);

  $('btnEliminar').addEventListener('click', async ()=>{
    if(editandoId == null || !db) return;
    const m = modelos.find(x => x.id === editandoId);
    if(!confirm(`¿Eliminar "${m ? m.nombre : 'este modelo'}" del catálogo?`)) return;
    const { error } = await db.from('catalogo').delete().eq('id', editandoId);
    if(error){ toast('No se pudo eliminar: ' + error.message, 'error'); return; }
    cerrarHoja();
    toast('Modelo eliminado');
    await cargarModelos();
  });

  // ---------------------------------------------------------------------------
  // Jalar hacia abajo para actualizar (solo con la app anclada al inicio;
  // en Safari normal ya existe el gesto del propio navegador)
  // ---------------------------------------------------------------------------
  const anclada = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if(anclada){
    const ptr = $('ptr');
    let y0 = null, dy = 0;
    window.addEventListener('touchstart', (e)=>{
      if(window.scrollY > 0 || $('sheet').classList.contains('open')) { y0 = null; return; }
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
