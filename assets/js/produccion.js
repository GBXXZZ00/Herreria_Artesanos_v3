// Producción: pedidos en fabricación y órdenes para exhibición, sus productos y las
// etapas de cada uno (quién hace cada paso y para cuándo, categoría de pago).
// El administrador asigna; cada trabajador marca terminado lo suyo desde su teléfono.
// La vendedora solo mira el avance (modo lectura, sin montos ni botones).
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, fotoModelo, fotoItem, etiquetaOtroColor, acabados, tieneColores,
          estadoDesdeEspecificaciones, especificacionesDesdeEstado, sabados, sabadoCorto, topeTexto, medidas } = window.AH;
  const AV = window.AV;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const NOMBRE_ESPECIALIDAD = { herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Ventanero', carpintero:'Carpintero' };
  const TIPOS_PRODUCCION = ['Puerta Multilock', 'Portón', 'Puerta de Madera', 'Ventana', 'Combo'];
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

  let pedidos = [];
  let trabajadores = [];
  let categorias = [];
  let lectura = false;   // vendedora: solo mirar
  const FILTROS_ADMIN = [ { id:'todos', t:'Todos' }, { id:'asignar', t:'Por asignar' }, { id:'sincat', t:'Sin categoría' }, { id:'atrasados', t:'Atrasados' } ];
  let FILTROS = FILTROS_ADMIN;
  const params = new URLSearchParams(location.search);
  let filtro = FILTROS.some(f => f.id === params.get('filtro')) ? params.get('filtro') : 'todos';
  let abrirAlCargar = Number(params.get('abrir')) || null;

  // ---------------------------------------------------------------------------
  // Cálculos sobre las etapas de un pedido
  // ---------------------------------------------------------------------------
  // La "etapa actual" de una rama es la primera pendiente en orden; las de antes ya
  // están hechas y las de después todavía no se pueden tocar.
  const ORDEN_RAMA = { principal:1, ventana:2, proteccion:3 };
  function ramas(item){
    const porRama = {};
    (item.etapas || []).slice().sort((a, b) => (ORDEN_RAMA[a.rama] || 9) - (ORDEN_RAMA[b.rama] || 9))
      .forEach(e => { (porRama[e.rama] = porRama[e.rama] || []).push(e); });
    Object.values(porRama).forEach(l => l.sort((a, b) => a.orden - b.orden));
    return porRama;
  }
  // Título de cada bloque de un Combo: la puerta, las 2 ventanas y las 2 protecciones, con sus medidas
  function tituloRama(it, rama){
    const e = it.especificaciones || {};
    const med = (a, b) => (a && b) ? ' · ' + medidas({ alto:a, ancho:b }) : '';
    const cu = e.ventanas_alto && e.ventanas_ancho ? ' c/u' : '';
    if(rama === 'ventana') return '2 ventanas' + med(e.ventanas_alto, e.ventanas_ancho) + cu;
    if(rama === 'proteccion') return '2 protecciones' + med(e.ventanas_alto, e.ventanas_ancho) + cu;
    return 'Puerta' + med(e.alto, e.ancho);
  }
  // Algún paso pendiente se pasó de su fecha tope
  const pasoAtrasado = (e) => e.estado === 'pendiente' && e.para_el && topeTexto(e.para_el).tarde;
  function etapaActual(lista){
    return lista.find(e => e.estado === 'pendiente') || null;
  }
  // Solo los productos que se fabrican (una pieza de exhibición ya está hecha)
  const itemsFabrica = (v) => (v.items || []).filter(it => (it.etapas || []).length);
  function resumenPedido(v){
    let total = 0, hechas = 0, sinAsignar = 0, sinCat = 0, pasosTarde = 0;
    itemsFabrica(v).forEach(it => {
      if(!it.categoria_pago_id) sinCat++;
      pasosTarde += (it.etapas || []).filter(pasoAtrasado).length;
      Object.values(ramas(it)).forEach(lista => {
        total += lista.length;
        hechas += lista.filter(e => e.estado === 'hecha').length;
        const act = etapaActual(lista);
        if(act && !act.trabajador_id) sinAsignar++;
      });
    });
    return { total, hechas, sinAsignar, sinCat, pasosTarde };
  }
  function diasAtraso(v){
    if(!v.fecha_entrega) return null;
    return -AV.diasHasta(v.fecha_entrega); // positivo = atrasado
  }
  const esAtrasado = (v) => (diasAtraso(v) || 0) > 0 || v._resumen.pasosTarde > 0;
  const nombreCategoria = (id) => (categorias.find(c => c.id === id) || {}).nombre || '';
  // Fecha corta en la hora del teléfono (terminada_en viene en UTC)
  function fechaDeHora(ts){
    const d = new Date(ts);
    return isNaN(d) ? '' : AV.fechaCorta(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
  }
  // En qué va un pedido (para la vendedora): la etapa actual de cada línea
  function enQueVa(v){
    const act = [];
    itemsFabrica(v).forEach(it => Object.values(ramas(it)).forEach(l => { const a = etapaActual(l); if(a && !act.includes(a.nombre)) act.push(a.nombre); }));
    return act.length ? 'En ' + act.join(' y ').toLowerCase() : 'Casi listo';
  }
  const tituloPedido = (v) => v.interna ? 'Para exhibición' : ((v.cliente || {}).nombre || 'Sin nombre');

  // ---------------------------------------------------------------------------
  // Cargar
  // ---------------------------------------------------------------------------
  async function cargar(){
    try{
      if(lectura){
        const { data, error } = await db.rpc('produccion_lectura');
        if(error) throw error;
        return mostrarPedidos(data || []);
      }
      const [rv, rc] = await Promise.all([
        db.from('ventas')
          .select('id,fecha_entrega,interna,cliente:clientes(nombre),items:venta_items(id,nombre,tipo,foto,pieza_id,cantidad,categoria_pago_id,especificaciones,catalogo:catalogo(fotos),etapas(id,rama,nombre,orden,especialidad,estado,unidades,para_el,trabajador_id,foto,terminada_en,monto,trabajador:perfiles(nombre)))')
          .eq('estado', 'en_produccion'),
        db.from('categorias_pago').select('id,nombre').eq('activo', true).order('nombre', { ascending:true })
      ]);
      if(rv.error) throw rv.error;
      if(rc.error) toast('No se pudieron cargar las categorías de pago', 'error');
      categorias = rc.data || [];
      mostrarPedidos(rv.data || []);
    } catch(e){
      $('lista').innerHTML = '<div class="vacio"><h3>No se pudo cargar</h3><p>Revisa tu internet y toca actualizar.</p></div>';
      toast((e && e.message) || 'No se pudo cargar', 'error');
    }
  }
  function mostrarPedidos(lista){
      pedidos = lista.map(v => Object.assign(v, { _resumen: resumenPedido(v) }));
      pedidos.sort((a, b) => {
        const da = diasAtraso(a) || 0, db_ = diasAtraso(b) || 0;
        if((da > 0) !== (db_ > 0)) return db_ > 0 ? 1 : -1;
        if(da > 0 && db_ > 0) return db_ - da;
        if(a.interna !== b.interna) return a.interna ? 1 : -1;
        const fa = a.fecha_entrega || '9999', fb = b.fecha_entrega || '9999';
        return fa < fb ? -1 : fa > fb ? 1 : a.id - b.id;
      });
      pintarChips();
      pintarLista();
      if(abrirAlCargar){
        const v = pedidos.find(x => x.id === abrirAlCargar);
        abrirAlCargar = null;
        if(v) pintarFicha(v);
      }
  }

  function pintarChips(){
    const n = {
      todos: pedidos.length,
      asignar: pedidos.filter(v => v._resumen.sinAsignar > 0).length,
      sincat: pedidos.filter(v => v._resumen.sinCat > 0).length,
      atrasados: pedidos.filter(esAtrasado).length
    };
    if(filtro === 'sincat' && !n.sincat) filtro = 'todos';
    $('chips').innerHTML = FILTROS.filter(f => f.id !== 'sincat' || n.sincat).map(f =>
      `<button class="chip ${filtro === f.id ? 'active' : ''}" data-f="${f.id}">${f.t} · ${n[f.id]}</button>`).join('');
    const ped = pedidos.filter(v => !v.interna).length, exh = pedidos.length - ped;
    $('subtitulo').textContent = (ped === 1 ? '1 pedido' : ped + ' pedidos') + ' en taller' + (exh ? ` · ${exh} para exhibición` : '');
  }
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if(!b) return;
    filtro = b.dataset.f;
    pintarChips(); pintarLista();
  });

  function pintarLista(){
    let vistos = pedidos;
    if(filtro === 'asignar') vistos = pedidos.filter(v => v._resumen.sinAsignar > 0);
    if(filtro === 'sincat') vistos = pedidos.filter(v => v._resumen.sinCat > 0);
    if(filtro === 'atrasados') vistos = pedidos.filter(esAtrasado);
    const cont = $('lista');
    if(!vistos.length){
      cont.innerHTML = pedidos.length
        ? '<div class="vacio"><h3>Nada por aquí</h3><p>Ningún pedido coincide con este filtro.</p></div>'
        : `<div class="vacio"><h3>El taller está libre</h3><p>Cuando un pedido pase a producción aparece aquí.${lectura ? '' : ' Con el botón + puedes fabricar algo para exhibición.'}</p></div>`;
      return;
    }
    cont.innerHTML = vistos.map((v, i) => {
      const r = v._resumen;
      const da = diasAtraso(v);
      const plazo = da > 0 ? `<span class="plazo tarde">${da} ${da === 1 ? 'día' : 'días'} atrasada</span>`
        : v.fecha_entrega ? `<span class="plazo">Entrega ${AV.fechaCorta(v.fecha_entrega)}</span>` : '';
      const badge = lectura ? `<span class="plazo">${esc(enQueVa(v))}</span>`
        : r.pasosTarde > 0 ? `<span class="plazo tarde">${r.pasosTarde === 1 ? '1 paso atrasado' : r.pasosTarde + ' pasos atrasados'}</span>`
        : r.sinAsignar > 0 ? `<span class="plazo">${r.sinAsignar} sin asignar</span>`
        : r.sinCat > 0 ? '<span class="plazo aviso">Sin categoría de pago</span>'
        : '<span class="plazo ok">Todo asignado</span>';
      const prod = itemsFabrica(v).map(it => it.nombre + (it.cantidad > 1 ? ' ×' + it.cantidad : '')).join(', ');
      const pct = r.total ? r.hechas / r.total : 0;
      return `<button class="vcard" style="--i:${i}" data-id="${v.id}">
        <div class="vcard-top">
          <div style="min-width:0"><div class="vcard-nombre">${esc(tituloPedido(v))}</div>${v.interna ? '<span class="vcard-exhib">Exhibición</span>' : `<div class="vcard-num">N° ${v.id}</div>`}</div>
          ${plazo}
        </div>
        <div class="vcard-prod">${esc(prod)}</div>
        <div class="barra"><i style="transform:scaleX(${pct})"></i></div>
        <div class="barra-txt"><span>${r.hechas} de ${r.total} etapas listas</span>${badge}</div>
      </button>`;
    }).join('');
  }
  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('.vcard'); if(!b) return;
    const v = pedidos.find(x => String(x.id) === b.dataset.id);
    if(v) pintarFicha(v);
  });

  // ---------------------------------------------------------------------------
  // Ficha del pedido: productos y su línea de etapas
  // ---------------------------------------------------------------------------
  let pedidoActual = null;
  function pintarFicha(v){
    pedidoActual = v;
    const cab = v.interna ? 'Para exhibición' : `N° ${v.id} · ${esc((v.cliente || {}).nombre || '')}`;
    $('fichaBody').innerHTML = `
      <p class="field-label" style="margin-bottom:2px">${cab}</p>
      ${itemsFabrica(v).map(it => itemHtml(it)).join('')}
      ${v.interna && !lectura ? `<button class="btn-cancelar-orden" type="button" data-cancelar-orden="${v.id}">Cancelar esta orden</button>` : ''}`;
    abrirHoja('sheetFicha');
  }
  function catHtml(it){
    if(lectura || !it.categoria_pago_id) return '';
    return `<button class="p-cat" type="button" data-cat-item="${it.id}"><span>Pago: ${esc(nombreCategoria(it.categoria_pago_id) || 'Categoría')}</span></button>`;
  }
  // Sin categoría no se asigna: el aviso lleva directo a elegirla
  function catFaltaHtml(it){
    if(lectura || it.categoria_pago_id) return '';
    return `<button class="cat-falta" type="button" data-cat-item="${it.id}"><b>Primero dale una categoría de pago.</b> Sin ella no se puede asignar. Toca aquí.</button>`;
  }
  function itemHtml(it){
    const grupos = ramas(it);
    const claves = Object.keys(grupos);
    // Un Combo tiene tres líneas en paralelo (puerta, 2 ventanas y 2 protecciones): cada una
    // en su propio bloque para que la línea que las conecta no salte de una a otra.
    const bloques = claves.map(r => {
      const lista = grupos[r];
      const act = etapaActual(lista);
      const etiqueta = it.tipo === 'Combo' ? `<p class="e-rama-tit">${esc(tituloRama(it, r))}</p>` : '';
      return etiqueta + '<div class="e-rama">' + lista.map(e => {
        const cls = e.estado === 'hecha' ? 'hecha' : (act && act.id === e.id) ? 'actual' : '';
        const dot = e.estado === 'hecha'
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '';
        let derecha = '', abajo = '';
        if(e.estado === 'hecha'){
          const monto = !lectura && e.monto != null ? ` · <span class="e-monto">${dinero(e.monto)}</span>` : '';
          abajo = `<span class="e-hecha-info">Terminó${e.terminada_en ? ' el ' + esc(fechaDeHora(e.terminada_en)) : ''}${e.trabajador ? ' · ' + esc(e.trabajador.nombre) : ''}${monto}</span>`;
        } else {
          // Pendiente: quién lo tiene (o "Por asignar") y para cuándo. Los botones están en "Asignar trabajadores".
          derecha = e.trabajador_id
            ? `<span class="e-chip"><span class="ini">${esc(inicial(e.trabajador ? e.trabajador.nombre : '?'))}</span>${esc(e.trabajador ? e.trabajador.nombre : '')}</span>`
            : '<span class="e-por">Por asignar</span>';
          const partes = [];
          if(e.trabajador_id && e.para_el){
            const tt = topeTexto(e.para_el);
            partes.push(`<span class="e-tope ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>`);
          }
          if(cls !== 'actual'){
            const antes = lista.slice(0, lista.indexOf(e)).reverse().find(x => x.estado === 'pendiente');
            if(antes) partes.push(`<span class="e-hecha-info">Después de ${esc(antes.nombre.toLowerCase())}</span>`);
          }
          abajo = partes.join('');
        }
        return `<div class="etapa ${cls}"><div class="e-dot">${dot}</div><div class="e-cuerpo"><div class="e-linea"><div class="e-nom">${esc(e.nombre)}</div>${derecha}</div><div class="e-fila">${abajo}</div></div></div>`;
      }).join('') + '</div>';
    }).join('');
    const fi = fotoItem(it);
    const sub = it.tipo === 'Combo' ? 'Combo · 1 puerta + 2 ventanas + 2 protecciones' : (it.tipo || '');
    const color = (it.especificaciones || {}).color;
    return `<div class="p-item">
      <div class="p-item-cab">
        <div class="p-item-foto">${fi.url ? `<img src="${esc(fi.url)}" alt="">` : iconoTipo(it.tipo, 22)}</div>
        <div><div class="p-item-nom">${esc(it.nombre)}${it.cantidad > 1 ? ' ×' + it.cantidad : ''}</div><div class="p-item-cant">${esc(sub)}${color ? ' · ' + esc(color) : ''}</div>${catHtml(it)}</div>
      </div>
      ${fi.otroColor ? `<p class="p-foto-otra">${esc(etiquetaOtroColor(fi, it.tipo))}.${lectura ? '' : ` Sube la foto en ${esc(String(fi.color).toLowerCase())} en Catálogo.`}</p>` : ''}
      ${catFaltaHtml(it)}
      ${bloques}
      ${!lectura && it.categoria_pago_id && (it.etapas || []).some(x => x.estado === 'pendiente')
        ? `<button class="btn-asignar-todo" type="button" data-asignar-todo="${it.id}">Asignar trabajadores</button>` : ''}
    </div>`;
  }
  // ---------------------------------------------------------------------------
  // Asignar trabajadores: quién hace cada paso y para cuándo (este sábado o el próximo)
  // ---------------------------------------------------------------------------
  let itemTodo = null, elegidos = {}, guardandoTodo = false, paraElegido = null, paraTocado = false;
  async function abrirAsignarTodo(iid){
    const v = pedidoActual; if(!v) return;
    const it = (v.items || []).find(x => x.id === iid); if(!it) return;
    const todos = await cargarTrabajadores();
    itemTodo = it; elegidos = {}; paraTocado = false;
    const sab = sabados();
    const pend = (it.etapas || []).filter(e => e.estado === 'pendiente');
    // Si todo lo asignado ya es para el próximo sábado, arranca ahí; si no, este sábado
    paraElegido = pend.some(e => e.trabajador_id) && pend.filter(e => e.trabajador_id).every(e => e.para_el === sab.proximo) ? sab.proximo : sab.este;
    const grupos = ramas(it);
    let html = `<div class="at-cuando"><p class="field-label">¿Para cuándo?</p>
      <div class="seg" role="radiogroup" id="segPara">
        <button type="button" class="seg-op ${paraElegido === sab.este ? 'on' : ''}" data-para="${sab.este}" role="radio" aria-checked="${paraElegido === sab.este}">Este ${esc(sabadoCorto(sab.este))}</button>
        <button type="button" class="seg-op ${paraElegido === sab.proximo ? 'on' : ''}" data-para="${sab.proximo}" role="radio" aria-checked="${paraElegido === sab.proximo}">Próximo ${esc(sabadoCorto(sab.proximo))}</button>
      </div></div>`;
    Object.keys(grupos).forEach(r => {
      const pendR = grupos[r].filter(e => e.estado === 'pendiente');
      if(!pendR.length) return;
      if(it.tipo === 'Combo') html += `<p class="e-rama-tit">${esc(tituloRama(it, r))}</p>`;
      pendR.forEach(e => {
        elegidos[e.id] = e.trabajador_id || '';
        const ops = todos.filter(t => (t.especialidades || []).includes(e.especialidad));
        // Si está asignado a alguien que ya no está activo, se muestra marcado para que se vea y se pueda cambiar
        const fuera = e.trabajador_id && !ops.some(t => t.id === e.trabajador_id)
          ? `<button type="button" class="at-op on" data-eid="${e.id}" data-tid="${esc(e.trabajador_id)}"><span class="ini">${esc(inicial(e.trabajador ? e.trabajador.nombre : '?'))}</span>${esc(e.trabajador ? e.trabajador.nombre : 'Otro')} (inactivo)</button>` : '';
        const tt = e.trabajador_id && e.para_el ? topeTexto(e.para_el) : null;
        html += `<div class="at-paso" data-eid="${e.id}"><p class="at-nom">${esc(e.nombre)}${tt ? ` <span class="e-tope ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>` : ''}</p>
          ${ops.length || fuera ? `<div class="at-ops">${fuera}${ops.map(t => `<button type="button" class="at-op ${e.trabajador_id === t.id ? 'on' : ''}" data-eid="${e.id}" data-tid="${esc(t.id)}"><span class="ini">${esc(inicial(t.nombre))}</span>${esc(t.nombre)}</button>`).join('')}
            <button type="button" class="at-op nadie ${e.trabajador_id ? '' : 'on'}" data-eid="${e.id}" data-tid="">Sin asignar</button></div>`
            : `<p class="at-vacio">Nadie tiene la especialidad ${esc(NOMBRE_ESPECIALIDAD[e.especialidad] || e.especialidad)}. Créalo en Usuarios.</p>`}
        </div>`;
      });
    });
    $('todoTitulo').textContent = 'Asignar: ' + it.nombre;
    $('todoBody').innerHTML = html;
    pintarBotonTodo();
    abrirHoja('sheetTodo');
  }
  // Cambia quien cambió de trabajador. Si se tocó "¿Para cuándo?", también los ya asignados con otra fecha.
  function cambiosTodo(){
    return (itemTodo ? (itemTodo.etapas || []) : []).filter(e => {
      if(e.estado !== 'pendiente' || !(e.id in elegidos)) return false;
      const tid = elegidos[e.id] || '';
      if(tid !== (e.trabajador_id || '')) return true;
      return paraTocado && !!tid && e.para_el !== paraElegido;
    }).map(e => {
      const tid = elegidos[e.id] || null;
      return tid ? { eid:e.id, tid, para:paraElegido } : { eid:e.id, tid:null };
    });
  }
  function pintarBotonTodo(){
    const n = cambiosTodo().length;
    $('btnGuardarTodo').disabled = !n;
    $('btnGuardarTodo').textContent = n ? (n === 1 ? 'Guardar 1 cambio' : `Guardar ${n} cambios`) : 'Elige quién hace cada paso';
  }
  $('todoBody').addEventListener('click', (e) => {
    const sp = e.target.closest('[data-para]');
    if(sp){
      paraElegido = sp.dataset.para; paraTocado = true;
      $('segPara').querySelectorAll('.seg-op').forEach(x => { x.classList.toggle('on', x === sp); x.setAttribute('aria-checked', String(x === sp)); });
      pintarBotonTodo();
      return;
    }
    const b = e.target.closest('.at-op'); if(!b) return;
    elegidos[b.dataset.eid] = b.dataset.tid;
    b.closest('.at-ops').querySelectorAll('.at-op').forEach(x => x.classList.toggle('on', x === b));
    pintarBotonTodo();
  });
  $('btnGuardarTodo').addEventListener('click', async () => {
    const cambios = cambiosTodo();
    if(!cambios.length || guardandoTodo) return;
    const btn = $('btnGuardarTodo');
    guardandoTodo = true; btn.disabled = true;
    try{
      const { error } = await db.rpc('asignar_etapas', { p: cambios });
      if(error) throw error;
      cerrarHoja('sheetTodo', true);
      toast('Listo. A cada uno le llega el aviso cuando le toque.');
      await refrescarFicha();
    } catch(err){
      const red = /fetch|network/i.test(String(err.message));
      toast(red ? 'Sin conexión. Intenta de nuevo' : err.message, 'error');
      if(red){ btn.disabled = false; }
      else {
        // Algo cambió en el taller mientras la hoja estaba abierta: se vuelve a pintar con lo último
        cerrarHoja('sheetTodo', true);
        await refrescarFicha();
      }
    } finally { guardandoTodo = false; }
  });

  async function refrescarFicha(){
    await cargar();
    const v = pedidoActual && pedidos.find(x => x.id === pedidoActual.id);
    if(v) pintarFicha(v); else cerrarHoja('sheetFicha');
  }

  async function cargarTrabajadores(){
    if(trabajadores.length) return trabajadores;
    const { data, error } = await db.from('perfiles').select('id,nombre,especialidades').eq('rol', 'trabajador').eq('activo', true);
    if(error){ toast(error.message, 'error'); return []; }
    trabajadores = data || [];
    return trabajadores;
  }
  $('fichaBody').addEventListener('click', async (e) => {
    const bc = e.target.closest('[data-cat-item]');
    if(bc){ abrirCatItem(Number(bc.dataset.catItem)); return; }
    const bo = e.target.closest('[data-cancelar-orden]');
    if(bo){ cancelarOrden(Number(bo.dataset.cancelarOrden), bo); return; }
    const bat = e.target.closest('[data-asignar-todo]');
    if(bat){ abrirAsignarTodo(Number(bat.dataset.asignarTodo)); return; }
  });

  // ---------------------------------------------------------------------------
  // Categoría de pago de un producto
  // ---------------------------------------------------------------------------
  let itemParaCat = null;
  function abrirCatItem(iid){
    const it = pedidoActual && itemsFabrica(pedidoActual).find(x => x.id === iid);
    if(!it) return;
    itemParaCat = it;
    $('catItemSub').textContent = it.nombre + ': con esto se calcula lo que gana cada trabajador.';
    $('listaCatItem').innerHTML = categorias.length
      ? categorias.map(c => `<button class="fila-cat ${c.id === it.categoria_pago_id ? 'sel' : ''}" type="button" data-cid="${c.id}">${esc(c.nombre)}</button>`).join('')
      : '<p class="field-error" style="display:block">Aún no hay categorías. Créalas en Mi cuenta › Categorías de pago.</p>';
    abrirHoja('sheetCatItem');
  }
  $('listaCatItem').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cid]'); if(!b || !itemParaCat) return;
    const cid = Number(b.dataset.cid);
    if(cid === itemParaCat.categoria_pago_id){ cerrarHoja('sheetCatItem'); return; }
    [...$('listaCatItem').children].forEach(x => x.disabled = true);
    b.classList.add('sel');
    try{
      const { error } = await db.rpc('asignar_categoria_item', { iid: itemParaCat.id, cid });
      if(error) throw error;
      cerrarHoja('sheetCatItem');
      toast('Categoría guardada');
      await refrescarFicha();
    } catch(err){
      toast(err.message, 'error');
      [...$('listaCatItem').children].forEach(x => x.disabled = false);
      b.classList.remove('sel');
    }
  });

  async function cancelarOrden(vid, boton){
    if(!confirm('¿Cancelar esta orden para exhibición? Lo que ya se terminó queda pagado a quien lo hizo.')) return;
    boton.disabled = true;
    try{
      const { error } = await db.rpc('cancelar_orden_exhibicion', { vid });
      if(error) throw error;
      cerrarHoja('sheetFicha');
      toast('Orden cancelada');
      await cargar();
    } catch(err){
      toast(err.message, 'error');
      boton.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Fabricar para exhibición (sin cliente): igual que agregar un producto en Nueva
  // venta. Primero el tipo, luego el modelo, luego sus especificaciones. Al terminar
  // queda en Entrega inmediata con esas especificaciones.
  // ---------------------------------------------------------------------------
  const SP = window.SpecsProducto;
  let modelosCat = null;
  let sedes = [];
  let orden = null;   // { tipo, modelo, prod, sede, cat }
  let enviandoOrden = false;

  async function cargarModelos(){
    if(modelosCat) return modelosCat;
    const [rm, rs] = await Promise.all([
      db.from('catalogo').select('id,nombre,tipo,fotos,precio_base,especificaciones_base,categoria_pago_id').in('tipo', TIPOS_PRODUCCION).order('nombre', { ascending:true }),
      db.from('sedes').select('id,nombre').eq('activa', true).order('orden', { ascending:true })
    ]);
    if(rm.error || rs.error) throw (rm.error || rs.error);
    modelosCat = rm.data || [];
    sedes = rs.data || [];
    return modelosCat;
  }
  const tiposConModelos = () => TIPOS_PRODUCCION.filter(t => (modelosCat || []).some(m => m.tipo === t));
  const fieldErr = (id, texto) => `<p class="field-error" id="${id}">${esc(texto)}</p>`;

  function prodDesdeModelo(m){
    const cols = acabados(m.tipo).filter(a => a.sw && (m.fotos || {})[a.key]);
    const color = tieneColores(m.tipo) ? ((cols[0] && cols[0].key) || 'Blanco') : null;
    return {
      origen:'catalogo', catalogo_id:m.id, tipo:m.tipo, nombre:m.nombre, color,
      estado: Object.assign(estadoDesdeEspecificaciones(m.tipo, m.especificaciones_base, 'pedido'), m.tipo === 'Combo' && color ? { ventanas_color: color } : {}),
      extraProteccion:'', precio:'', precioManual:false, cantidad:1
    };
  }

  function pintarOrden(){
    const cuerpo = $('ordenBody');
    const scroll = cuerpo.scrollTop;
    const o = orden;
    let html = `<div class="field" id="campoOTipo">${SP.optsHtml({ g:'__otipo', label:'¿Qué vas a fabricar?', cols:2, opts: tiposConModelos().map(t => ({ v:t })) }, o.tipo).replace(/^<div class="field">|<\/div>$/g, '')}
      ${fieldErr('eOTipo', 'Elige qué vas a fabricar')}</div>`;
    if(o.tipo){
      const m = o.modelo;
      const foto = m ? fotoModelo(m, o.prod && o.prod.color) : null;
      html += `<div class="field" id="campoModelo"><span class="field-label">Modelo</span>
        <button class="f-link-box" type="button" id="btnModelo">
          <span class="mini-foto">${foto ? `<img src="${esc(foto)}" alt="">` : (m ? iconoTipo(m.tipo, 20) : '')}</span>
          <span style="min-width:0"><span class="mod-nom ${m ? '' : 'ph'}">${m ? esc(m.nombre) : 'Elige un modelo del catálogo'}</span>${m ? `<span class="mod-sub">${esc(m.tipo)}</span>` : ''}</span>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
        </button>${fieldErr('eModelo', 'Elige el modelo')}</div>`;
    }
    if(o.modelo){
      if(!o.modelo.categoria_pago_id){
        html += categorias.length
          ? `<div class="field" id="campoOCat">${SP.optsHtml({ g:'__ocat', label:'Categoría de pago', cols:1, opts: categorias.map(c => ({ v:String(c.id), t:c.nombre })) }, o.cat == null ? null : String(o.cat)).replace(/^<div class="field">|<\/div>$/g, '')}
              <p class="field-hint aviso">Este modelo no tiene. La que elijas queda guardada en el modelo.</p>${fieldErr('eOCat', 'Elige la categoría de pago')}</div>`
          : `<div class="field"><p class="field-error" style="display:block">Este modelo no tiene categoría de pago y todavía no hay ninguna. Créalas en Mi cuenta › Categorías de pago.</p></div>`;
      }
      html += SP.specsHtml(o.prod, o.modelo);
      html += `<div class="field" id="campoOSede">${SP.optsHtml({ g:'__osede', label:'Sede donde quedará', cols:2, opts: sedes.map(x => ({ v:String(x.id), t:x.nombre })) }, o.sede == null ? null : String(o.sede)).replace(/^<div class="field">|<\/div>$/g, '')}
        ${fieldErr('eSede', 'Elige dónde quedará la pieza')}</div>`;
      html += `<div class="field"><span class="field-label">Cantidad</span>
        <div class="stepper"><button type="button" data-cant="-1" aria-label="Una menos">−</button><span id="cantValor">${o.prod.cantidad}</span><button type="button" data-cant="1" aria-label="Una más">+</button></div></div>`;
      const c = SP.calcular(o.prod, o.modelo);
      const valor = o.prod.precioManual ? o.prod.precio : c.total;
      html += `<div class="precio-caja">
        <div class="field" id="campoPrecio"><label class="field-label" for="fPrecio">Precio en exhibición (por unidad)</label>
          <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fPrecio" type="text" inputmode="decimal" autocomplete="off" value="${esc(valor === '' || valor == null ? '' : valor)}"></div>
          ${fieldErr('ePrecio', 'Ingresa un precio mayor a 0')}
        </div>
        <div class="desglose" id="desglose">Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}</div>
        ${o.prod.precioManual && Number(montoOrNull(o.prod.precio)) !== c.total ? '<button type="button" class="usar-sugerido" id="usarSugerido">Usar el sugerido</button>' : ''}
      </div>`;
    }
    cuerpo.innerHTML = html;
    cuerpo.scrollTop = scroll;
    $('btnCrearOrden').disabled = enviandoOrden || !!(o.modelo && !o.modelo.categoria_pago_id && !categorias.length);
  }
  function refrescarPrecioOrden(){
    const o = orden; if(!o || !o.modelo) return;
    const c = SP.calcular(o.prod, o.modelo);
    if(!o.prod.precioManual && $('fPrecio')) $('fPrecio').value = c.total;
    if($('desglose')) $('desglose').innerHTML = `Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}`;
  }

  $('btnNuevaOrden').addEventListener('click', async () => {
    try{ await cargarModelos(); }
    catch(err){ toast('No se pudieron cargar los modelos: ' + ((err && err.message) || ''), 'error'); return; }
    if(!tiposConModelos().length){ toast('No hay modelos en el catálogo para fabricar', 'error'); return; }
    orden = { tipo:null, modelo:null, prod:null, sede: sedes.length === 1 ? sedes[0].id : null, cat:null };
    pintarOrden();
    $('ordenBody').scrollTop = 0;
    abrirHoja('sheetOrden');
  });

  $('ordenBody').addEventListener('click', (e) => {
    const o = orden; if(!o) return;
    const op = e.target.closest('.opt[data-g]');
    if(op && op.dataset.g === '__otipo'){
      if(op.dataset.v !== o.tipo){ o.tipo = op.dataset.v; o.modelo = null; o.prod = null; o.cat = null; }
      pintarOrden(); return;
    }
    if(op && op.dataset.g === '__ocat'){ o.cat = Number(op.dataset.v); pintarOrden(); return; }
    if(op && op.dataset.g === '__osede'){ o.sede = Number(op.dataset.v); pintarOrden(); return; }
    if(e.target.closest('#btnModelo')){
      $('buscaModelo').value = '';
      $('modelosTitulo').textContent = o.tipo;
      pintarModelos();
      abrirHoja('sheetModelos');
      return;
    }
    if(o.prod && SP.tocar(o.prod, e.target)){ pintarOrden(); return; }
    const c = e.target.closest('[data-cant]');
    if(c && o.prod){
      o.prod.cantidad = Math.min(50, Math.max(1, o.prod.cantidad + Number(c.dataset.cant)));
      $('cantValor').textContent = o.prod.cantidad;
      return;
    }
    if(e.target.closest('#usarSugerido')){ o.prod.precioManual = false; pintarOrden(); }
  });
  $('ordenBody').addEventListener('input', (e) => {
    const o = orden; if(!o || !o.prod) return;
    const el = e.target;
    if(el.id === 'fPrecio'){ o.prod.precio = el.value; o.prod.precioManual = true; $('campoPrecio').classList.remove('invalid'); return; }
    if(SP.escribir(o.prod, el)) refrescarPrecioOrden();
  });

  function pintarModelos(){
    const q = $('buscaModelo').value.trim().toLowerCase();
    const lista = (modelosCat || []).filter(m => m.tipo === (orden && orden.tipo) && (!q || m.nombre.toLowerCase().includes(q)));
    $('listaModelos').innerHTML = lista.length ? lista.map(m => {
      const f = fotoModelo(m);
      return `<button class="fila-mod" type="button" data-mid="${m.id}">
        <span class="mini-foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : iconoTipo(m.tipo, 20)}</span>
        <span style="min-width:0"><span class="mod-nom">${esc(m.nombre)}</span><span class="mod-sub">${m.tipo === 'Ventana' ? 'Por m²' : dinero(m.precio_base)}${m.categoria_pago_id ? '' : ' · sin categoría de pago'}</span></span>
      </button>`;
    }).join('') : '<div class="vacio" style="padding:28px 10px"><p>Ningún modelo coincide.</p></div>';
  }
  $('buscaModelo').addEventListener('input', pintarModelos);
  $('listaModelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mid]'); if(!b || !orden) return;
    const m = modelosCat.find(x => String(x.id) === b.dataset.mid); if(!m) return;
    orden.modelo = m;
    orden.prod = prodDesdeModelo(m);
    orden.cat = null;
    cerrarHoja('sheetModelos');
    pintarOrden();
  });

  $('btnCrearOrden').addEventListener('click', async () => {
    const o = orden; if(!o || enviandoOrden) return;
    let primero = null;
    const falla = (campo) => { const c = $(campo); if(!c) return; c.classList.add('invalid'); primero = primero || c; };
    if(!o.tipo) falla('campoOTipo');
    else if(!o.modelo) falla('campoModelo');
    else {
      if(!o.modelo.categoria_pago_id && o.cat == null) falla('campoOCat');
      if(o.sede == null) falla('campoOSede');
      if($('campoProt') && !(montoOrNull(o.prod.extraProteccion) > 0)) falla('campoProt');
      if(!(montoOrNull($('fPrecio').value) > 0)) falla('campoPrecio');
    }
    if(primero){ primero.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    const precio = montoOrNull($('fPrecio').value);
    const esp = Object.assign({}, especificacionesDesdeEstado(o.prod.tipo, o.prod.estado, 'pedido'),
      o.prod.color ? { color: o.prod.color } : {},
      SP.pideMontoProteccion(o.prod, o.modelo) ? { monto_proteccion: montoOrNull(o.prod.extraProteccion) } : {});
    const btn = $('btnCrearOrden');
    enviandoOrden = true;
    btn.disabled = true;
    try{
      const { data, error } = await db.rpc('crear_orden_exhibicion', { p: {
        catalogo_id: o.modelo.id, sede_id: o.sede, cantidad: o.prod.cantidad, precio,
        especificaciones: esp, categoria_pago_id: o.modelo.categoria_pago_id ? null : o.cat
      } });
      if(error) throw error;
      if(!o.modelo.categoria_pago_id) o.modelo.categoria_pago_id = o.cat;
      cerrarHoja('sheetOrden');
      orden = null;
      toast('Listo, ya está en producción. Asigna quién la fabrica.');
      abrirAlCargar = data && data.id;
      await cargar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      enviandoOrden = false;
      btn.disabled = false;
    }
  });

  $('btnActualizar').addEventListener('click', cargar);

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin' && p.rol !== 'vendedor'){ location.replace('index.html'); return; }
    if(p.rol === 'vendedor'){
      lectura = true;
      FILTROS = FILTROS_ADMIN.filter(f => f.id === 'todos' || f.id === 'atrasados');
      if(!FILTROS.some(f => f.id === filtro)) filtro = 'todos';
      document.body.classList.add('solo-lectura');
    }
    cargar();
  })();
})();
