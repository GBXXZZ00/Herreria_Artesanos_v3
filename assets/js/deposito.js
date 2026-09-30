// Depósito: materiales por unidad (discos, sierras, pintura…). El administrador registra
// las compras; el administrador o la vendedora entregan 1 unidad a un trabajador cuando la
// pide (baja del depósito de una vez). Cada entrega queda "Por revisar" hasta que Ray la
// aprueba o la cuestiona, viendo los trabajos que hizo desde la entrega anterior.
// Los costos solo los ve el administrador. Todo lo valida el servidor.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, heroZoom, verFoto, etiquetaOtroColor, antesDeCerrar } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const OFICIOS = [
    { v:'', t:'Todos' }, { v:'hierro', t:'Hierro' }, { v:'masilla', t:'Masilla' }, { v:'pintura', t:'Pintura' },
    { v:'detalles', t:'Detalles' }, { v:'armar', t:'Armar' }, { v:'instalar', t:'Instalar' }
  ];
  const nombreOficio = (o) => (OFICIOS.find(x => x.v === (o || '')) || OFICIOS[0]).t;
  const ESTADO = { por_revisar:{ t:'Por revisar', c:'amar' }, aprobada:{ t:'Aprobada', c:'verde' }, cuestionada:{ t:'Cuestionada', c:'rojo' } };
  const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const CHEV_ABAJO = '<svg class="ac-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  let datos = null;           // deposito_resumen()
  let perfil = null;
  let tab = 'materiales';
  let filtro = 'todos';       // entregas: 'todos' | 'revisar' | id del trabajador
  let cargando = null;        // la carga en curso (si piden otra, se hace al terminar)
  let otraVez = false;

  // ---------- Utilidades ----------
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const diaDe = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const corta = (d) => d.toLocaleDateString('es-VE', { day:'numeric', month:'short' }).replace('.', '');
  const fechaCorta = (ts) => { const d = new Date(ts); return isNaN(d) ? '' : DIAS[d.getDay()] + ' ' + corta(d); };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Semana de trabajo: de domingo a sábado, con el nombre de su lunes (igual que Nómina)
  function semanaActual(){
    const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 1);
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return iso(t);
  }
  function rangoSemana(lunesIso){
    const l = diaDe(lunesIso), s = new Date(l); s.setDate(s.getDate() + 5);
    return (l.getMonth() === s.getMonth() ? l.getDate() : corta(l)) + ' al ' + corta(s);
  }
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const trabajosTxt = (n) => plural(n, '1 trabajo', 'trabajos');
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
  const mensaje = (e) => {
    const m = String((e && e.message) || '');
    if(/fetch|network|Failed/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo';
    return m || 'Algo salió mal';
  };
  const bajo = (m) => m.activo && m.stock < m.minimo;
  const materialDe = (id) => (datos.materiales || []).find(m => m.id === id) || null;
  const entregaDe = (id) => (datos.entregas || []).find(e => e.id === id) || null;
  // La entrega anterior del mismo material al mismo trabajador (con ella se ve cuánto rindió)
  const anteriorDe = (e) => (datos.entregas || []).filter(x => x.material_id === e.material_id && x.trabajador_id === e.trabajador_id
    && (new Date(x.fecha) < new Date(e.fecha) || (x.fecha === e.fecha && x.id < e.id))).sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id)[0] || null;
  const porRevisar = () => (datos.entregas || []).filter(e => e.estado === 'por_revisar');

  // ---------- Cargar ----------
  async function cargar(){
    if(cargando){ otraVez = true; return cargando; }
    cargando = cargar0();
    try{ await cargando; } finally { cargando = null; }
    if(otraVez){ otraVez = false; await cargar(); }
  }
  async function cargar0(){
    try{
      const { data, error } = await db.rpc('deposito_resumen', { semanas: 12 });
      if(error) throw error;
      datos = data || { materiales:[], entregas:[], compras:[], trabajadores:[] };
      pintar();
    } catch(e){
      if(!datos) $('cont').innerHTML = '<div class="vacio-d"><b>No se pudo cargar</b>Revisa tu internet y toca actualizar.</div>';
      toast(mensaje(e), 'error');
    }
  }

  function pintar(){
    const reponer = datos.materiales.filter(bajo).length;
    const rev = porRevisar().length;
    const partes = [];
    if(reponer) partes.push(plural(reponer, '1 por reponer', 'por reponer'));
    if(rev) partes.push(plural(rev, '1 entrega por revisar', 'entregas por revisar'));
    $('subtitulo').textContent = partes.join(' · ') || (datos.materiales.length ? 'Todo al día' : 'Agrega tus materiales');
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tabs').classList.toggle('en-2', tab === 'entregas');
    $('pieEntregar').classList.toggle('hidden', !datos.materiales.some(m => m.activo));
    if(tab === 'materiales') pintarMateriales(); else pintarEntregas();
  }
  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if(!b || !datos || b.dataset.tab === tab) return;
    tab = b.dataset.tab; pintar(); window.scrollTo(0, 0);
  });

  // ---------- Materiales ----------
  function pintarMateriales(){
    $('filtrosWrap').classList.add('hidden');
    const l = datos.materiales;
    if(!l.length){
      $('cont').innerHTML = datos.es_admin
        ? `<div class="vacio-d"><b>Todavía no hay materiales</b>Agrega los que quieres controlar: discos, sierras, pintura. Se cuentan por unidad.</div>
          <button class="btn-nuevo" type="button" data-nuevo-mat>+ Agregar material</button>`
        : '<div class="vacio-d"><b>Todavía no hay materiales</b>Un administrador los agrega.</div>';
      return;
    }
    const activos = l.filter(m => m.activo);
    const reponer = activos.filter(bajo).length;
    const unidades = activos.reduce((a, m) => a + m.stock, 0);
    let html = `<div class="res">
      <div class="res-c ${reponer ? 'rojo' : 'ok'}"><span>${reponer ? 'Materiales por reponer' : 'Por reponer'}</span><b>${reponer ? esc(reponer) : 'Todo al día'}</b></div>
      <div class="res-c"><span>Unidades en depósito</span><b>${esc(unidades)}</b></div></div>
      <div class="mat-lista">`;
    html += l.map((m, i) => {
      const falta = Math.max(0, m.minimo - m.stock);
      const pill = !m.activo ? '<span class="pill gris">Ya no se usa</span>'
        : m.stock === 0 ? '<span class="pill rojo">Agotado</span>'
        : falta ? `<span class="pill rojo">Faltan ${falta}</span>` : '';
      return `<button class="mat ${bajo(m) ? 'bajo' : ''} ${m.activo ? '' : 'inactivo'}" type="button" data-mat="${m.id}" style="--i:${i}">
        <span class="mat-ico">${esc(inicial(m.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(m.nombre)}</span>
          <span class="mat-s">${m.minimo ? 'Mínimo ' + esc(m.minimo) : 'Sin mínimo'} · ${esc(m.oficio ? nombreOficio(m.oficio) : 'Todos los trabajos')} ${pill}</span></span>
        <span class="mat-n"><b>${esc(m.stock)}</b><span>${m.stock === 1 ? 'unidad' : 'unidades'}</span></span>
      </button>`;
    }).join('');
    html += '</div>' + (datos.es_admin ? '<button class="btn-nuevo" type="button" data-nuevo-mat>+ Agregar material</button>' : '');
    $('cont').innerHTML = html;
    // La entrada en cascada solo la primera vez (no en cada repintada)
    if(!$('cont').classList.contains('ya')) setTimeout(() => $('cont').classList.add('ya'), 700);
  }

  // ---------- Entregas ----------
  function pintarFiltros(){
    const conEntregas = new Map();
    datos.entregas.forEach(e => { if(!conEntregas.has(e.trabajador_id)) conEntregas.set(e.trabajador_id, e.trabajador); });
    const rev = porRevisar().length;
    const chips = [{ v:'todos', t:'Todas' }, { v:'revisar', t: rev ? `Por revisar · ${rev}` : 'Por revisar', c:'rev' },
      ...[...conEntregas].map(([id, n]) => ({ v:id, t:n || 'Trabajador' }))];
    if(!chips.some(c => c.v === filtro)) filtro = 'todos';
    $('filtros').innerHTML = chips.map(c => `<button class="fx ${c.c || ''} ${c.v === filtro ? 'on' : ''}" type="button" data-filtro="${esc(c.v)}" aria-pressed="${c.v === filtro}">${esc(c.t)}</button>`).join('');
    $('filtrosWrap').classList.remove('hidden');
  }
  $('filtros').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]'); if(!b || b.dataset.filtro === filtro) return;
    filtro = b.dataset.filtro; pintarEntregas();
  });
  function filaEntrega(e){
    const m = materialDe(e.material_id);
    const est = ESTADO[e.estado] || ESTADO.por_revisar;
    const ant = e.abierta ? anteriorDe(e) : null;
    const uso = e.abierta ? `lleva ${trabajosTxt(e.trabajos)}${ant ? ' · con la anterior ' + trabajosTxt(ant.trabajos) : ''}` : `hizo ${trabajosTxt(e.trabajos)}`;
    return `<button class="ent" type="button" data-entrega="${e.id}">
      <span class="mat-ico" style="width:40px;height:40px;font-size:15px">${esc(inicial(m ? m.nombre : '?'))}</span>
      <span style="min-width:0"><span class="ent-t">${esc(m ? m.nombre : 'Material')} a ${esc(e.trabajador || '')}</span>
        <span class="ent-s">${esc(fechaCorta(e.fecha))} · ${esc(uso)}${e.entregado_por ? ' · entregó ' + esc(e.entregado_por) : ''}</span></span>
      <span class="ent-d"><span class="pill ${est.c}">${est.t}</span>${e.rara ? '<span class="rara-dot">Rara</span>' : ''}</span>
    </button>`;
  }
  // Lo que ha recibido un trabajador y cuánto le rinde cada material
  function rindeHtml(lista){
    const porMat = new Map();
    lista.forEach(e => { const l = porMat.get(e.material_id) || []; l.push(e); porMat.set(e.material_id, l); });
    return [...porMat].map(([mid, l]) => {
      const m = materialDe(mid);
      const cerradas = l.filter(e => !e.abierta);
      const prom = cerradas.length ? Math.round(cerradas.reduce((a, e) => a + e.trabajos, 0) / cerradas.length * 10) / 10 : null;
      return `<div class="fila"><span>${esc(m ? m.nombre : 'Material')} · ${esc(plural(l.length, '1 recibido', 'recibidos'))}</span>
        <b>${prom === null ? 'Aún con el primero' : esc(String(prom).replace('.', ',')) + ' trabajos c/u'}</b></div>`;
    }).join('');
  }
  function pintarEntregas(){
    pintarFiltros();
    let l = datos.entregas;
    if(filtro === 'revisar') l = l.filter(e => e.estado === 'por_revisar');
    else if(filtro !== 'todos') l = l.filter(e => e.trabajador_id === filtro);
    if(!l.length){
      $('cont').innerHTML = filtro === 'revisar'
        ? '<div class="vacio-d"><b>Nada por revisar</b>Ray ya revisó todas las entregas.</div>'
        : '<div class="vacio-d"><b>Todavía no hay entregas</b>Cuando un trabajador pida material, toca "Entregar material".</div>';
      return;
    }
    let html = '';
    if(filtro !== 'todos' && filtro !== 'revisar'){
      html += `<div class="trab-res"><p>Lo que ha recibido en las últimas 12 semanas</p>${rindeHtml(l)}</div>`;
    }
    const semanas = new Map();
    l.forEach(e => { const k = e.semana; const x = semanas.get(k) || []; x.push(e); semanas.set(k, x); });
    const actual = semanaActual();
    let primera = true;
    semanas.forEach((lista, k) => {
      const abierta = k === actual || (primera && filtro !== 'todos');
      primera = false;
      const rev = lista.filter(e => e.estado === 'por_revisar').length;
      html += `<details class="sem" ${abierta ? 'open' : ''}><summary>
        <span class="sem-t">${k === actual ? 'Esta semana' : esc(rangoSemana(k))}</span>
        <span class="sem-s">${esc(plural(lista.length, '1 entrega', 'entregas'))}${rev ? ' · ' + rev + ' por revisar' : ''}</span>${CHEV_ABAJO}</summary>
        <div class="sem-body">${lista.map(filaEntrega).join('')}</div></details>`;
    });
    $('cont').innerHTML = html;
  }

  $('cont').addEventListener('click', (e) => {
    if(e.target.closest('[data-nuevo-mat]')){ abrirMatForm(null); return; }
    const m = e.target.closest('[data-mat]');
    if(m){ abrirMaterial(+m.dataset.mat); return; }
    const en = e.target.closest('[data-entrega]');
    if(en) abrirEntrega(+en.dataset.entrega);
  });

  // ---------- Entregar: material y después trabajador ----------
  let ent = null;
  $('btnEntregar').addEventListener('click', () => {
    if(!datos) return;
    ent = { paso:1, mid:null, tid:null, nota:'', clave: uuid(), enviando:false };
    pintarEntregar();
    abrirHoja('sheetEntregar');
  });
  function pintarEntregar(){
    const body = $('entregarBody');
    if(ent.paso === 1){
      $('entregarTitulo').textContent = '¿Qué vas a entregar?';
      $('entregarFoot').classList.add('hidden');
      const l = datos.materiales.filter(m => m.activo);
      body.innerHTML = `<p class="paso-t">Toca el material. Se entrega de uno en uno.</p><div class="gr-mat">${l.map(m => `
        <button class="gm ${bajo(m) ? 'bajo' : ''} ${m.stock < 1 ? 'agotado' : ''}" type="button" ${m.stock < 1 ? `data-agotado="${m.id}"` : `data-elegir-mat="${m.id}"`}>
          <span class="gm-t">${esc(m.nombre)}</span>
          <span class="gm-n">${m.stock < 1 ? 'Agotado' : 'Quedan ' + esc(m.stock) + (bajo(m) ? ' · por reponer' : '')}</span>
          ${m.stock < 1 ? `<span class="gm-at">${datos.es_admin ? 'Registrar compra' : 'Avisar para comprar'}</span>` : ''}
        </button>`).join('')}</div>`;
      body.scrollTop = 0;
      return;
    }
    const m = materialDe(ent.mid);
    $('entregarTitulo').textContent = '¿A quién se lo das?';
    $('entregarFoot').classList.remove('hidden');
    $('btnConfirmarEntrega').disabled = ent.enviando;
    const trabajadores = datos.trabajadores || [];
    const ultima = (tid) => datos.entregas.find(e => e.material_id === ent.mid && e.trabajador_id === tid);   // vienen de la más nueva
    body.innerHTML = `<div class="elegido"><span style="min-width:0"><b>${esc(m.nombre)}</b><span>Va 1 unidad · quedan ${esc(m.stock)}</span></span>
        <button type="button" data-cambiar-mat>Cambiar</button></div>
      <div id="campoTrab">${trabajadores.length ? trabajadores.map(t => {
        const u = ultima(t.id);
        const sub = u ? `Le diste uno el ${esc(fechaCorta(u.fecha))} · desde entonces <b>${esc(trabajosTxt(u.trabajos))}</b>` : 'Nunca le has dado este material';
        return `<button class="tr ${ent.tid === t.id ? 'sel' : ''}" type="button" data-elegir-trab="${esc(t.id)}" aria-pressed="${ent.tid === t.id}">
          <span class="tr-av">${esc(inicial(t.nombre))}</span><span style="min-width:0"><span class="tr-t">${esc(t.nombre)}</span><span class="tr-s">${sub}</span></span></button>`;
      }).join('') : `<div class="vacio-d"><b>No hay trabajadores</b>${datos.es_admin ? '<a class="gm-at" href="usuarios.html">Crear uno en Usuarios</a>' : 'Pídele a un administrador que los cree.'}</div>`}
      <p class="field-error" id="errTrab">Elige a quién se lo das</p></div>
      <div class="field" style="margin-top:16px"><label class="field-label" for="entNota">Nota (opcional)</label>
        <input class="input" id="entNota" type="text" maxlength="120" autocomplete="off" value="${esc(ent.nota)}" placeholder="Se le partió el disco"></div>`;
  }
  $('entregarBody').addEventListener('click', (e) => {
    const bm = e.target.closest('[data-elegir-mat]');
    const ag = e.target.closest('[data-agotado]');
    if(ag){ atajoReponer(+ag.dataset.agotado, true); return; }
    if(bm && !bm.disabled){ if(ent.mid !== +bm.dataset.elegirMat) ent.clave = uuid(); ent.mid = +bm.dataset.elegirMat; ent.paso = 2; pintarEntregar(); $('entregarBody').scrollTop = 0; return; }
    if(e.target.closest('[data-cambiar-mat]')){ ent.paso = 1; pintarEntregar(); return; }
    const bt = e.target.closest('[data-elegir-trab]');
    if(bt){
      if(ent.tid !== bt.dataset.elegirTrab) ent.clave = uuid();
      ent.tid = bt.dataset.elegirTrab;
      document.querySelectorAll('#entregarBody [data-elegir-trab]').forEach(x => { const s = x === bt; x.classList.toggle('sel', s); x.setAttribute('aria-pressed', s); });
      $('campoTrab').classList.remove('invalid');
    }
  });
  $('entregarBody').addEventListener('input', (e) => { if(e.target.id === 'entNota') ent.nota = e.target.value; });
  $('btnConfirmarEntrega').addEventListener('click', async () => {
    if(!ent || ent.enviando || ent.paso !== 2) return;
    if(!ent.tid){ const c = $('campoTrab'); c.classList.add('invalid'); c.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    const m = materialDe(ent.mid), t = (datos.trabajadores || []).find(x => x.id === ent.tid);
    ent.enviando = true;
    const btn = $('btnConfirmarEntrega');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Entregando';
    try{
      const { data, error } = await db.rpc('deposito_entregar', { mid: ent.mid, tid: ent.tid, nota: ent.nota.trim() || null, clave: ent.clave });
      if(error) throw error;
      cerrarHoja('sheetEntregar', true);
      toast(data && data.rara ? (datos.es_ray ? `Entregado. Se ve rara: ${data.rara_motivo}` : `Entregado. Le avisamos a Ray: ${data.rara_motivo}`) : `Listo: 1 ${m ? m.nombre : ''} a ${t ? t.nombre : ''}. Queda por revisar.`);
      ent = null;
      await cargar();
    } catch(err){
      toast(mensaje(err), 'error');
      if(ent){ ent.enviando = false; const m2 = materialDe(ent.mid); if(/No queda/i.test(String(err && err.message))){ ent.paso = 1; ent.mid = null; } else if(!m2) ent.paso = 1; }
      await cargar();
      if(ent && $('sheetEntregar').classList.contains('open')) pintarEntregar();
    } finally {
      btn.textContent = 'Entregar';
      btn.disabled = false;
    }
  });
  antesDeCerrar.sheetEntregar = () => !(ent && ent.enviando);

  // ---------- Ficha de un material ----------
  let matAbierto = null;
  function abrirMaterial(id){
    matAbierto = id;
    pintarMaterial();
    $('matBody').scrollTop = 0;
    abrirHoja('sheetMat');
  }
  function pintarMaterial(){
    const m = materialDe(matAbierto);
    if(!m){ cerrarHoja('sheetMat', true); return; }
    $('matTitulo').textContent = m.nombre;
    const falta = Math.max(0, m.minimo - m.stock);
    const ents = datos.entregas.filter(e => e.material_id === m.id);
    let html = `<div class="bento">
        <div class="res-c ${falta ? 'rojo' : ''}"><span>En depósito</span><b>${esc(m.stock)}</b></div>
        <div class="res-c"><span>Mínimo</span><b>${esc(m.minimo)}</b></div>
        <div class="res-c ${falta ? 'rojo' : 'ok'}"><span>${falta ? 'Faltan' : 'Reponer'}</span><b>${falta ? esc(falta) : 'Al día'}</b></div></div>
      <p class="mov-s" style="margin:6px 2px 0">${m.oficio ? 'Cuenta los trabajos de ' + esc(nombreOficio(m.oficio)) : 'Cuenta todos sus trabajos'} que hace cada trabajador con una unidad.${datos.es_admin && m.costo_unidad != null ? ' Última compra: ' + esc(dinero(m.costo_unidad)) + ' c/u.' : ''}</p>`;
    // Rinde por trabajador
    const porTrab = new Map();
    ents.forEach(e => { const l = porTrab.get(e.trabajador_id) || []; l.push(e); porTrab.set(e.trabajador_id, l); });
    if(porTrab.size){
      html += '<p class="tit">Rinde por trabajador (12 semanas)</p>' + [...porTrab].map(([tid, l]) => {
        const cerradas = l.filter(e => !e.abierta);
        const prom = cerradas.length ? Math.round(cerradas.reduce((a, e) => a + e.trabajos, 0) / cerradas.length * 10) / 10 : null;
        const act = l.find(e => e.abierta);
        return `<button class="mov" type="button" data-ver-trab="${esc(tid)}"><span class="tr-av">${esc(inicial(l[0].trabajador))}</span>
          <span style="min-width:0"><span class="mov-t">${esc(l[0].trabajador || '')}</span>
          <span class="mov-s">${esc(plural(l.length, '1 recibido', 'recibidos'))}${act ? ' · con el actual lleva ' + esc(trabajosTxt(act.trabajos)) : ''}</span></span>
          <span class="mov-m">${prom === null ? '<span class="mov-s">Aún con el primero</span>' : esc(String(prom).replace('.', ',')) + ' c/u'}</span>${CHEV}</button>`;
      }).join('');
    }
    // Movimientos: compras (solo el administrador) y entregas
    const movs = [
      ...(datos.compras || []).filter(c => c.material_id === m.id).map(c => ({ f:c.fecha, html:`<div class="mov"><span style="min-width:0"><span class="mov-t">Compra${c.nota ? ' · ' + esc(c.nota) : ''}</span>
        <span class="mov-s">${esc(fechaCorta(c.fecha))}${c.por ? ' · ' + esc(c.por) : ''}${c.costo != null ? ' · ' + esc(dinero(c.costo)) : ''}</span></span><span class="mov-m mas">+${esc(c.cantidad)}</span></div>` })),
      ...ents.map(e => ({ f:e.fecha, html:`<button class="mov" type="button" data-entrega="${e.id}"><span style="min-width:0"><span class="mov-t">A ${esc(e.trabajador || '')}</span>
        <span class="mov-s">${esc(fechaCorta(e.fecha))}${e.entregado_por ? ' · entregó ' + esc(e.entregado_por) : ''} · <span class="pill ${(ESTADO[e.estado] || ESTADO.por_revisar).c}">${(ESTADO[e.estado] || ESTADO.por_revisar).t}</span></span></span><span class="mov-m menos">−1</span>${CHEV}</button>` }))
    ].sort((a, b) => new Date(b.f) - new Date(a.f)).slice(0, 40);
    html += '<p class="tit">Movimientos</p>' + (movs.length ? movs.map(x => x.html).join('') : '<p class="mov-s" style="padding:8px 2px">Todavía no hay compras ni entregas.</p>');
    $('matBody').innerHTML = html;
    $('matFoot').innerHTML = datos.es_admin && m.activo
      ? '<div class="pie-dos"><button class="btn-secondary" type="button" data-editar-mat>Editar</button><button class="btn-primary" type="button" data-comprar>Registrar compra</button></div>'
      : datos.es_admin ? '<button class="btn-secondary" type="button" data-editar-mat style="width:100%;height:54px">Editar</button>'
      : m.activo && bajo(m) ? '<button class="btn-primary" type="button" data-reponer style="width:100%">Avisar para comprar</button>' : '';
    $('matFoot').classList.toggle('hidden', !$('matFoot').innerHTML);
  }
  $('matBody').addEventListener('click', (e) => {
    const en = e.target.closest('[data-entrega]');
    if(en){ abrirEntrega(+en.dataset.entrega); return; }
    const t = e.target.closest('[data-ver-trab]');
    if(t){ cerrarHoja('sheetMat', true); tab = 'entregas'; filtro = t.dataset.verTrab; pintar(); window.scrollTo(0, 0); }
  });
  $('matFoot').addEventListener('click', (e) => {
    if(e.target.closest('[data-editar-mat]')) abrirMatForm(materialDe(matAbierto));
    if(e.target.closest('[data-comprar]')) abrirCompra();
    if(e.target.closest('[data-reponer]')) atajoReponer(matAbierto, false);
  });
  // Atajo para un material agotado o por reponer: el admin registra la compra; la vendedora avisa
  let avisando = false;
  async function atajoReponer(mid, desdeEntregar){
    const m = materialDe(mid); if(!m) return;
    if(datos.es_admin){
      if(desdeEntregar) cerrarHoja('sheetEntregar', true);
      matAbierto = mid; abrirCompra(); return;
    }
    if(avisando || !confirm(`¿Avisarle a los administradores que hay que comprar ${m.nombre}?`)) return;
    avisando = true;
    try{
      const { data, error } = await db.rpc('deposito_pedir_reponer', { mid });
      if(error) throw error;
      toast(data && data.repetido ? `Ya les avisaron hace poco de ${m.nombre}` : `Listo, les avisamos que hay que comprar ${m.nombre}`);
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { avisando = false; }
  }

  // ---------- Nuevo material / editar ----------
  let mf = null;
  function abrirMatForm(m){
    mf = m ? { id:m.id, nombre:m.nombre, minimo:String(m.minimo), oficio:m.oficio || '', activo:m.activo, guardando:false }
      : { id:null, nombre:'', minimo:'', oficio:'', activo:true, guardando:false };
    $('matFormTitulo').textContent = m ? 'Editar material' : 'Nuevo material';
    pintarMatForm();
    abrirHoja('sheetMatForm');
  }
  function pintarMatForm(){
    $('matFormBody').innerHTML = `
      <div class="field" id="campoMatNombre"><label class="field-label" for="mfNombre">Nombre</label>
        <input class="input" id="mfNombre" type="text" maxlength="60" autocomplete="off" value="${esc(mf.nombre)}" placeholder="Disco de corte">
        <p class="field-error">Escribe el nombre</p></div>
      <div class="field" id="campoMatMin"><label class="field-label" for="mfMin">Mínimo en depósito</label>
        <input class="input" id="mfMin" type="text" inputmode="numeric" autocomplete="off" value="${esc(mf.minimo)}">
        <p class="field-hint">Si quedan menos, sale "Por reponer".</p>
        <p class="field-error">Escribe un número entero (0 o más)</p></div>
      <div class="field"><span class="field-label">¿Con qué trabajos se gasta?</span>
        <div class="opts" style="--cols:4">${OFICIOS.map(o => `<button type="button" class="opt ${o.v === mf.oficio ? 'selected' : ''}" data-oficio="${o.v}" aria-pressed="${o.v === mf.oficio}">${esc(o.t)}</button>`).join('')}</div>
        <p class="field-hint">Así se cuentan los trabajos que hace cada uno con una unidad.</p></div>
      ${mf.id ? `<button class="tchip ${mf.activo ? '' : 'on'}" type="button" id="mfInactivo" aria-pressed="${!mf.activo}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>Ya no se usa</button>` : ''}`;
  }
  $('matFormBody').addEventListener('input', (e) => {
    if(e.target.id === 'mfNombre'){ mf.nombre = e.target.value; $('campoMatNombre').classList.remove('invalid'); }
    if(e.target.id === 'mfMin'){ mf.minimo = e.target.value; $('campoMatMin').classList.remove('invalid'); }
  });
  $('matFormBody').addEventListener('click', (e) => {
    const o = e.target.closest('[data-oficio]');
    if(o){ mf.oficio = o.dataset.oficio; document.querySelectorAll('#matFormBody [data-oficio]').forEach(x => { const s = x === o; x.classList.toggle('selected', s); x.setAttribute('aria-pressed', s); }); return; }
    const t = e.target.closest('#mfInactivo');
    if(t){ mf.activo = !mf.activo; t.classList.toggle('on', !mf.activo); t.setAttribute('aria-pressed', String(!mf.activo)); }
  });
  $('btnGuardarMat').addEventListener('click', async () => {
    if(!mf || mf.guardando) return;
    const nombre = mf.nombre.trim();
    const minTxt = String(mf.minimo).trim();
    const min = minTxt === '' ? 0 : Number(minTxt);
    let ok = true;
    if(!nombre){ $('campoMatNombre').classList.add('invalid'); ok = false; }
    if(!Number.isInteger(min) || min < 0 || min > 10000){ $('campoMatMin').classList.add('invalid'); ok = false; }
    if(!ok) return;
    mf.guardando = true;
    const btn = $('btnGuardarMat'); btn.disabled = true;
    try{
      const { error } = await db.rpc('deposito_material_guardar', { p: { id: mf.id, nombre, minimo: min, oficio: mf.oficio || null, activo: mf.activo } });
      if(error) throw error;
      cerrarHoja('sheetMatForm', true);
      toast(mf.id ? 'Material guardado' : 'Material agregado. Registra la compra para que tenga unidades.');
      await cargar();
      if($('sheetMat').classList.contains('open')) pintarMaterial();
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { if(mf) mf.guardando = false; btn.disabled = false; }
  });

  // ---------- Registrar compra (administrador) ----------
  let comprando = false;
  function abrirCompra(){
    const m = materialDe(matAbierto); if(!m) return;
    $('compraTitulo').textContent = 'Compra de ' + m.nombre;
    ['compraCant', 'compraCosto', 'compraNota'].forEach(id => { $(id).value = ''; });
    ['campoCompraCant', 'campoCompraCosto'].forEach(id => $(id).classList.remove('invalid'));
    abrirHoja('sheetCompra');
  }
  $('compraCant').addEventListener('input', () => $('campoCompraCant').classList.remove('invalid'));
  $('compraCosto').addEventListener('input', () => $('campoCompraCosto').classList.remove('invalid'));
  $('btnGuardarCompra').addEventListener('click', async () => {
    if(comprando) return;
    const cant = Number(String($('compraCant').value).trim());
    const costoTxt = $('compraCosto').value.trim();
    const costo = costoTxt ? montoOrNull(costoTxt) : null;
    let ok = true;
    if(!Number.isInteger(cant) || cant < 1 || cant > 10000){ $('campoCompraCant').classList.add('invalid'); ok = false; }
    if(costoTxt && !(costo >= 0)){ $('campoCompraCosto').classList.add('invalid'); ok = false; }
    if(!ok) return;
    comprando = true;
    const btn = $('btnGuardarCompra'); btn.disabled = true;
    try{
      const { data, error } = await db.rpc('deposito_comprar', { mid: matAbierto, cantidad: cant, costo, nota: $('compraNota').value.trim() || null });
      if(error) throw error;
      cerrarHoja('sheetCompra', true);
      toast(`Compra guardada. Ahora hay ${data && data.stock != null ? data.stock : ''} en el depósito.`);
      await cargar();
      if($('sheetMat').classList.contains('open')) pintarMaterial();
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { comprando = false; btn.disabled = false; }
  });

  // ---------- Una entrega: trabajos y revisión de Ray ----------
  let rev = null;   // { id, trabajos, cuestionando, nota, enviando }
  const trabajosCache = {};
  async function abrirEntrega(id){
    const e = entregaDe(id);
    if(!e){ toast('No se encontró esa entrega (puede ser de hace más de 12 semanas)', 'error'); return; }
    const ant = anteriorDe(e);
    rev = { id, trabajos:null, error:false, cuestionando:false, nota:'', enviando:false, antId: ant ? ant.id : null, antTrabajos: null };
    pintarEntrega();
    $('entregaBody').scrollTop = 0;
    abrirHoja('sheetEntrega');
    await Promise.all([cargarTrabajos(id), ant ? cargarAnterior(id, ant.id) : null]);
  }
  // Los trabajos con la entrega anterior: con eso Ray ve si la unidad rindió antes de pedir otra
  async function cargarAnterior(id, antId){
    try{
      const { data, error } = await db.rpc('deposito_trabajos', { eid: antId });
      if(error) throw error;
      if(rev && rev.id === id){ rev.antTrabajos = data || []; pintarEntrega(); }
    } catch(err){
      if(rev && rev.id === id){ rev.antTrabajos = false; pintarEntrega(); }
    }
  }
  async function cargarTrabajos(id){
    try{
      const { data, error } = await db.rpc('deposito_trabajos', { eid: id });
      if(error) throw error;
      trabajosCache[id] = data || [];
      if(rev && rev.id === id){ rev.trabajos = trabajosCache[id]; rev.error = false; pintarEntrega(); }
    } catch(err){
      if(rev && rev.id === id){ rev.error = true; pintarEntrega(); }
      toast(mensaje(err), 'error');
    }
  }
  function filaTrabajo(it, i, lista){
    return `<button class="mov" type="button" data-trabajo="${i}" data-lista="${lista || 'esta'}">
      <span class="mov-foto">${it.foto ? `<img src="${esc(it.foto)}" alt="" loading="lazy">` : iconoTipo(it.tipo, 20)}</span>
      <span style="min-width:0"><span class="mov-t">${esc(it.etapa)} · ${esc(it.producto)}${it.cantidad > 1 ? ' ×' + esc(it.cantidad) : ''}</span>
      <span class="mov-s">${it.interna ? '<b>Exhibición</b>' + (it.sede ? ' · ' + esc(it.sede) : '') : `<b>${esc(it.cliente || 'Cliente')}</b> · N° ${esc(it.venta_id)}`} · ${esc(fechaCorta(it.fecha))}</span></span>
      ${it.foto_trabajo ? `<span class="mov-foto suya" style="width:38px;height:38px;margin-left:auto"><img src="${esc(it.foto_trabajo)}" alt="Foto del trabajo" loading="lazy"></span>` : ''}${CHEV}</button>`;
  }
  function pintarEntrega(){
    const e = entregaDe(rev.id);
    if(!e){ cerrarHoja('sheetEntrega', true); return; }
    const m = materialDe(e.material_id);
    const est = ESTADO[e.estado] || ESTADO.por_revisar;
    $('entregaTitulo').textContent = `${m ? m.nombre : 'Material'} a ${e.trabajador || ''}`;
    let html = `<div class="d-datos">
        <div class="d-dato"><span>Fecha</span><b>${esc(fechaCorta(e.fecha))}</b></div>
        <div class="d-dato"><span>Entregó</span><b>${esc(e.entregado_por || '')}</b></div>
        <div class="d-dato"><span>Estado</span><b><span class="pill ${est.c}">${est.t}</span></b></div>
        <div class="d-dato"><span>${e.abierta ? 'Lleva' : 'Hizo con ella'}</span><b>${esc(trabajosTxt(e.trabajos))}</b></div></div>`;
    if(e.rara) html += `<div class="caja-rara">Se ve rara: ${esc(e.rara_motivo || '')}</div>`;
    if(e.nota) html += `<div class="caja-nota"><span>Nota de la entrega</span>${esc(e.nota)}</div>`;
    if(e.estado !== 'por_revisar') html += `<div class="caja-nota"><span>${e.estado === 'aprobada' ? 'Aprobada' : 'Cuestionada'} por ${esc(e.revisado_por || 'Ray')} · ${esc(fechaCorta(e.revisado_en))}</span>${e.revision_nota ? esc(e.revision_nota) : 'Sin nota'}</div>`;
    html += `<p class="tit">${e.abierta ? 'Trabajos que ha terminado desde que la recibió' : 'Trabajos que terminó con ella (hasta la siguiente)'}${m && m.oficio ? ' · ' + esc(nombreOficio(m.oficio)) : ''}</p>`;
    if(rev.trabajos === null) html += rev.error ? '<p class="mov-s" style="padding:8px 2px">No se pudieron cargar. Cierra y vuelve a abrir.</p>' : '<div class="sk-fila"></div><div class="sk-fila"></div>';
    else if(!rev.trabajos.length) html += '<p class="mov-s" style="padding:8px 2px">No ha terminado trabajos con esta unidad.</p>';
    else html += rev.trabajos.map((it, i) => filaTrabajo(it, i, 'esta')).join('');
    // La anterior: cuánto rindió la unidad que tenía antes de pedir esta
    const ant = rev.antId ? entregaDe(rev.antId) : null;
    if(ant){
      html += `<p class="tit">Con la anterior (${esc(fechaCorta(ant.fecha))}) hizo ${esc(trabajosTxt(ant.trabajos))}</p>`;
      if(rev.antTrabajos === null) html += '<div class="sk-fila"></div>';
      else if(rev.antTrabajos === false) html += '<p class="mov-s" style="padding:8px 2px">No se pudieron cargar.</p>';
      else if(!rev.antTrabajos.length) html += '<p class="mov-s" style="padding:8px 2px">No terminó trabajos con la anterior.</p>';
      else html += rev.antTrabajos.map((it, i) => filaTrabajo(it, i, 'anterior')).join('');
    } else if(rev.trabajos !== null){
      html += '<p class="mov-s" style="padding:10px 2px 0">Es la primera que recibe de este material.</p>';
    }
    if(rev.cuestionando){
      html += `<div class="field" id="campoCuestion" style="margin-top:16px"><label class="field-label" for="revNota">¿Qué pasó?</label>
        <textarea class="input" id="revNota" rows="3" maxlength="300" placeholder="Pidió muy seguido, no cuadra con lo que hizo">${esc(rev.nota)}</textarea>
        <p class="field-error">Escribe qué pasó para cuestionarla</p></div>`;
    }
    const sc = $('entregaBody').scrollTop;
    $('entregaBody').innerHTML = html;
    $('entregaBody').scrollTop = sc;
    // Pie: solo Ray aprueba o cuestiona
    if(!datos.es_ray){ $('entregaFoot').innerHTML = '<p class="solo-ray">Solo Ray la aprueba o la cuestiona.</p>'; return; }
    const dis = rev.enviando ? 'disabled' : '';
    if(rev.cuestionando){
      $('entregaFoot').innerHTML = `<div class="pie-dos"><button class="btn-secondary" type="button" data-rev="cancelar" ${dis}>Cancelar</button><button class="btn-primary" type="button" data-rev="enviar" style="background:var(--danger)" ${dis}>Cuestionar</button></div>`;
    } else if(e.estado === 'por_revisar'){
      $('entregaFoot').innerHTML = `<div class="pie-dos"><button class="btn-secondary" type="button" data-rev="cuestionar" ${dis}>Cuestionar</button><button class="btn-primary" type="button" data-rev="aprobar" ${dis}>Aprobar</button></div>`;
    } else if(e.estado === 'aprobada'){
      $('entregaFoot').innerHTML = `<button class="btn-secondary" type="button" data-rev="cuestionar" style="width:100%;height:54px" ${dis}>Cuestionar</button>`;
    } else {
      $('entregaFoot').innerHTML = `<button class="btn-primary" type="button" data-rev="aprobar" style="width:100%" ${dis}>Aprobar</button>`;
    }
  }
  $('entregaBody').addEventListener('input', (e) => {
    if(e.target.id === 'revNota'){ rev.nota = e.target.value; $('campoCuestion').classList.remove('invalid'); }
  });
  $('entregaBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-trabajo]');
    if(!b || !rev) return;
    const l = b.dataset.lista === 'anterior' ? rev.antTrabajos : rev.trabajos;
    const it = l && l[+b.dataset.trabajo]; if(it) abrirItem(it);
  });
  $('entregaFoot').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rev]'); if(!b || !rev || rev.enviando) return;
    const a = b.dataset.rev;
    if(a === 'cuestionar'){ rev.cuestionando = true; pintarEntrega(); const c = $('campoCuestion'); if(c){ c.scrollIntoView({ block:'center', behavior:'smooth' }); $('revNota').focus(); } return; }
    if(a === 'cancelar'){ rev.cuestionando = false; rev.nota = ''; pintarEntrega(); return; }
    const aprobar = a === 'aprobar';
    if(!aprobar && rev.nota.trim().length < 3){ $('campoCuestion').classList.add('invalid'); return; }
    const e0 = entregaDe(rev.id);
    rev.enviando = true; pintarEntrega();
    try{
      const { error } = await db.rpc('deposito_revisar', { eid: rev.id, aprobar, nota: aprobar ? null : rev.nota.trim() });
      if(error) throw error;
      const esSuya = e0 && perfil && e0.entregado_por === perfil.nombre;
      toast(aprobar ? 'Entrega aprobada' : esSuya ? 'Cuestionada' : `Cuestionada. Le avisamos a ${e0 && e0.entregado_por ? e0.entregado_por : 'quien la entregó'}.`);
      rev.cuestionando = false; rev.nota = '';
      await cargar();
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { if(rev){ rev.enviando = false; if($('sheetEntrega').classList.contains('open')) pintarEntrega(); } }
  });
  antesDeCerrar.sheetEntrega = () => !(rev && rev.enviando) && (!(rev && rev.cuestionando && rev.nota.trim()) || confirm('¿Salir sin cuestionarla?'));

  // ---------- Detalle de un trabajo (como en Nómina) ----------
  function abrirItem(it){
    const e = it.especificaciones || {};
    const specs = resumenSpecs(it.tipo, e);
    const lb = etiquetaOtroColor({ otroColor: !!(it.foto && it.foto_de && e.color && it.foto_de !== e.color), de: it.foto_de, color: e.color }, it.tipo);
    $('itemBody').innerHTML = `
      <div ${heroAttrs(it.foto)}>${it.foto ? `<img src="${esc(it.foto)}" alt="${esc(it.producto)}">` : iconoTipo(it.tipo, 56)}${lb ? `<span class="foto-otra">${esc(lb)}</span>` : ''}${heroZoom(it.foto)}</div>
      <div class="d-parte">${esc(it.etapa)} · terminó ${esc(fechaCorta(it.fecha))}</div>
      <div class="det-name" style="margin-top:10px">${esc(it.producto)}${it.cantidad > 1 ? ' ×' + esc(it.cantidad) : ''}</div>
      <div class="det-type">${esc([it.tipo, e.color].filter(Boolean).join(' · '))}</div>
      <div class="d-datos" style="margin-top:14px">
        <div class="d-dato"><span>${it.interna ? 'Para' : 'Cliente'}</span><b>${esc(it.interna ? 'Exhibición' : (it.cliente || ''))}</b></div>
        <div class="d-dato"><span>${it.interna ? 'Sede' : 'Pedido'}</span><b>${esc(it.interna ? (it.sede || '') : 'N° ' + it.venta_id)}</b></div>
        ${'monto' in it ? `<div class="d-dato"><span>Pago por esta parte</span><b>${it.oficio === 'instalar' ? 'No se paga' : it.monto == null ? 'Por definir' : esc(dinero(it.monto))}</b></div>` : ''}
        <div class="d-dato"><span>Categoría</span><b>${esc(it.categoria || 'Sin categoría')}</b></div>
      </div>
      ${specs.length ? `<div class="det-section"><div class="det-label">Especificaciones</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>` : ''}
      ${it.foto_trabajo ? `<div class="d-suya"><button type="button" data-ver-foto="${esc(it.foto_trabajo)}" aria-label="Ver foto"><img src="${esc(it.foto_trabajo)}" alt=""></button>Foto que subió al terminar. Tócala para verla grande.</div>` : ''}
      ${it.interna ? '' : `<a class="d-link" href="ventas.html?abrir=${esc(it.venta_id)}">Ver la venta N° ${esc(it.venta_id)}</a>`}`;
    $('itemBody').scrollTop = 0;
    abrirHoja('sheetItem');
  }
  $('itemBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver-foto]');
    if(b) verFoto(b.dataset.verFoto);
  });

  $('btnActualizar').addEventListener('click', async () => {
    await cargar();
    if($('sheetMat').classList.contains('open')) pintarMaterial();
    if(rev && $('sheetEntrega').classList.contains('open')){ pintarEntrega(); cargarTrabajos(rev.id); }
  });

  (async function(){
    perfil = await S.requerir();
    if(!perfil) return;
    if(perfil.rol !== 'admin' && perfil.rol !== 'vendedor'){ location.replace('index.html'); return; }
    // deposito.html?entrega=ID (aviso a Ray) · ?tab=entregas&filtro=revisar · ?tab=materiales
    const q = new URLSearchParams(location.search);
    if(q.get('tab') === 'entregas') tab = 'entregas';
    if(q.get('filtro') === 'revisar') filtro = 'revisar';
    const abrir = Number(q.get('entrega'));
    if(abrir) tab = 'entregas';
    await cargar();
    if(abrir && datos){
      try{ history.replaceState(null, '', location.pathname); } catch(e){}
      abrirEntrega(abrir);
    }
    // deposito.html?material=ID (aviso "hay que comprar"): abre ese material
    const mat = Number(q.get('material'));
    if(mat && datos && materialDe(mat)){
      try{ history.replaceState(null, '', location.pathname); } catch(e){}
      abrirMaterial(mat);
    }
  })();
})();
