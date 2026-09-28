// Listas de Cotizaciones y de Ventas, con la ficha de cada una y sus acciones.
(function(){
  'use strict';
  const db = window.db;
  const { esc, dinero, montoOrNull: numOrNull, toast, abrirHoja, cerrarHoja, iconoTipo, verFoto, antesDeCerrar } = window.AH;
  const AV = window.AV;
  const $ = (id) => document.getElementById(id);
  const MODO = document.body.dataset.modo;             // 'cotizaciones' | 'ventas'
  const COT = MODO === 'cotizaciones';

  const ICON_ALERTA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  const ICON_WA = '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
  const ICON_TEL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
  const ICON_CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_DOC = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
  const ICON_DINERO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>';

  let todas = [];
  let cargadoUnaVez = false;
  const FILTROS = COT
    ? [ { id:'abiertas', t:'Abiertas' }, { id:'vencidas', t:'Vencidas' }, { id:'descartadas', t:'Descartadas' } ]
    : [ { id:'activas', t:'Activas' }, { id:'confirmar', t:'Pagos por confirmar', soloSiHay:true }, { id:'cobrar', t:'Por cobrar' }, { id:'entregadas', t:'Entregadas' }, { id:'canceladas', t:'Canceladas' } ];
  let filtro = FILTROS[0].id;
  { const f = new URLSearchParams(location.search).get('filtro'); if(f && FILTROS.some(x => x.id === f)) filtro = f; }

  // ---------------------------------------------------------------------------
  // Filtros y orden
  // ---------------------------------------------------------------------------
  function enFiltro(v, f){
    if(COT){
      if(f === 'descartadas') return v.estado === 'cancelada';
      if(v.estado !== 'cotizacion') return false;
      const d = AV.diasHasta(v.vence_en);
      return f === 'vencidas' ? d < 0 : d >= 0;
    }
    if(f === 'activas') return ['confirmada', 'en_produccion', 'lista'].includes(v.estado);
    if(f === 'cobrar') return v.estado !== 'cancelada' && AV.resta(v) > 0;
    if(f === 'confirmar') return AV.porConfirmar(v.abonos).length > 0;
    if(f === 'entregadas') return v.estado === 'entregada';
    return v.estado === 'cancelada';
  }
  const t = (x) => x ? new Date(x).getTime() : 0;
  function ordenar(lista){
    const porEntrega = (a, b) => (a.fecha_entrega || '9999') < (b.fecha_entrega || '9999') ? -1 : (a.fecha_entrega || '9999') > (b.fecha_entrega || '9999') ? 1 : 0;
    if(filtro === 'abiertas') return lista.sort((a, b) => t(b.creado_en) - t(a.creado_en));
    if(filtro === 'vencidas') return lista.sort((a, b) => (b.vence_en || '').localeCompare(a.vence_en || ''));
    if(filtro === 'activas' || filtro === 'cobrar' || filtro === 'confirmar') return lista.sort(porEntrega);
    if(filtro === 'entregadas') return lista.sort((a, b) => t(b.actualizado_en) - t(a.actualizado_en));
    return lista.sort((a, b) => t(b.cancelada_en) - t(a.cancelada_en));
  }

  // ---------------------------------------------------------------------------
  // Tarjetas
  // ---------------------------------------------------------------------------
  function plazoCotizacion(v){
    const d = AV.diasHasta(v.vence_en);
    if(d < 0) return `<span class="plazo tarde">Vencida hace ${-d} ${-d === 1 ? 'día' : 'días'}</span>`;
    if(d === 0) return '<span class="plazo pronto">Vence hoy</span>';
    return `<span class="plazo ${d <= 5 ? 'pronto' : ''}">Vence en ${d} ${d === 1 ? 'día' : 'días'}</span>`;
  }
  function plazoEntrega(v){
    if(AV.porConfirmar(v.abonos).length) return '<span class="plazo pronto">Pago por confirmar</span>';
    if(v.estado === 'confirmada' && v.produccion_pedida_en) return '<span class="plazo pronto">Pedida a producción</span>';
    if(!v.fecha_entrega || !['confirmada', 'en_produccion', 'lista'].includes(v.estado)) return '';
    const d = AV.diasHasta(v.fecha_entrega);
    if(d < 0) return `<span class="plazo tarde">Atrasada ${-d} ${-d === 1 ? 'día' : 'días'}</span>`;
    if(d === 0) return '<span class="plazo pronto">Se entrega hoy</span>';
    return `<span class="plazo ${d <= 3 ? 'pronto' : ''}">Entrega en ${d} ${d === 1 ? 'día' : 'días'}</span>`;
  }
  function estadoHtml(v){
    const e = AV.ESTADOS[v.estado] || AV.ESTADOS.cotizacion;
    const texto = COT && v.estado === 'cancelada' ? 'Descartada' : e.t;
    return `<span class="estado ${e.c}">${esc(texto)}</span>`;
  }
  function tarjeta(v, i){
    const nombre = esc(v.cliente ? v.cliente.nombre : 'Cliente');
    if(COT){
      return `<button class="vcard" data-id="${v.id}" style="--i:${Math.min(i, 12)}">
        <div class="vcard-top">
          <div style="min-width:0"><div class="vcard-nombre">${nombre}</div><div class="vcard-num">N° ${v.id} · ${esc(AV.hace(v.creado_en))}</div></div>
          <div class="vcard-total">${dinero(v.total)}</div>
        </div>
        <div class="vcard-prod">${esc(AV.resumenProductos(v.items))}</div>
        <div class="vcard-pie">${v.estado === 'cancelada' ? estadoHtml(v) : plazoCotizacion(v)}<span>${esc(vendedor(v))}</span></div>
      </button>`;
    }
    const pag = AV.pagado(v.abonos), total = Number(v.total) || 0, r = AV.resta(v);
    const pct = total ? Math.max(0, Math.min(1, pag / total)) : 0;
    return `<button class="vcard" data-id="${v.id}" style="--i:${Math.min(i, 12)}">
      <div class="vcard-top">
        <div style="min-width:0"><div class="vcard-nombre">${nombre}</div><div class="vcard-num">N° ${v.id}${v.fecha_entrega ? ' · Entrega ' + esc(AV.fechaCorta(v.fecha_entrega)) : ''}</div></div>
        ${estadoHtml(v)}
      </div>
      <div class="vcard-prod">${esc(AV.resumenProductos(v.items))}</div>
      ${v.estado === 'cancelada' ? '' : `
      <div class="barra"><i style="transform:scaleX(${pct})"></i></div>
      <div class="barra-txt"><span>Pagado <b>${dinero(pag)}</b> de ${dinero(total)}</span><span>${r > 0 ? 'Resta <b>' + dinero(r) + '</b>' : '<b>Pagado completo</b>'}</span></div>`}
      ${plazoEntrega(v) ? `<div class="vcard-pie">${plazoEntrega(v)}<span>${esc(vendedor(v))}</span></div>` : ''}
    </button>`;
  }
  let nombres = {};
  let esAdmin = false, puedeConfirmar = false;
  window.Sesion.perfil().then(p => { esAdmin = !!(p && p.rol === 'admin'); puedeConfirmar = !!(p && p.confirma_abonos); if(actual) pintarFicha(); }).catch(() => {});
  const vendedor = (v) => nombres[v.vendedor_id] || '';

  function pintarChips(){
    $('chips').innerHTML = FILTROS.map(f => {
      const n = todas.filter(v => enFiltro(v, f.id)).length;
      if(f.soloSiHay && !n && filtro !== f.id) return '';
      return `<button class="chip ${f.id === filtro ? 'active' : ''}" role="tab" aria-selected="${f.id === filtro}" data-f="${f.id}">${esc(f.t)}${n ? ' · ' + n : ''}</button>`;
    }).join('');
  }
  function pintar(){
    pintarChips();
    let q = $('buscador').value.trim().toLowerCase().replace(/[.\-\s]/g, '');
    if(/^0\d{3,}$/.test(q)) q = '58' + q.slice(1);   // 0414… también encuentra 58414…
    let lista = todas.filter(v => enFiltro(v, filtro));
    if(q){
      lista = lista.filter(v => {
        const c = v.cliente || {};
        const texto = [(c.nombre || '').toLowerCase().replace(/\s/g, ''), (c.cedula || '').toLowerCase(), c.telefono || '', String(v.id)].join('|');
        return texto.includes(q);
      });
    }
    lista = ordenar(lista);
    if(!lista.length){
      const vacioTodo = !todas.length;
      $('lista').innerHTML = `<div class="vacio">
        <div class="vacio-ico">${ICON_DOC}</div>
        <h3>${q ? 'No hay resultados' : vacioTodo ? (COT ? 'Aún no hay cotizaciones' : 'Aún no hay ventas') : 'Nada por aquí'}</h3>
        <p>${q ? 'Prueba con otro nombre, cédula o número.' : vacioTodo ? 'Toca el botón + para hacer la primera.' : 'Revisa los otros filtros de arriba.'}</p>
      </div>`;
      return;
    }
    $('lista').innerHTML = lista.map(tarjeta).join('');
  }
  function subtitulo(){
    if(COT){
      const n = todas.filter(v => enFiltro(v, 'abiertas')).length;
      $('subtitulo').textContent = n === 1 ? '1 abierta' : `${n} abiertas`;
    } else {
      const n = todas.filter(v => enFiltro(v, 'activas')).length;
      const c = todas.filter(v => enFiltro(v, 'cobrar')).length;
      $('subtitulo').textContent = `${n === 1 ? '1 activa' : n + ' activas'} · ${c} por cobrar`;
    }
  }

  $('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if(b){ filtro = b.dataset.f; pintar(); window.scrollTo({ top:0, behavior:'smooth' }); } });
  $('buscador').addEventListener('input', pintar);
  $('lista').addEventListener('click', (e) => { const c = e.target.closest('.vcard'); if(c) abrirFicha(+c.dataset.id); });

  // Copia local: la lista aparece al instante con lo último que se vio y luego se actualiza
  const CACHE = 'ah_cache_ventas';
  let firmaDatos = '';
  function aplicar(data, ps){
    nombres = ps || nombres;
    todas = (data || []).filter(v => COT ? AV.esCotizacion(v) : !AV.esCotizacion(v));
    cargadoUnaVez = true;
    subtitulo();
    pintar();
  }
  function desdeCache(){
    try{
      const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if(!c || !Array.isArray(c.data) || Date.now() - c.t > 3 * 864e5) return;
      firmaDatos = JSON.stringify(c.data);
      aplicar(c.data, c.ps);
    } catch(e){}
  }
  async function cargar(){
    try{
      const [r, ps] = await Promise.all([
        db.from('ventas').select('id,estado,total,creado_en,actualizado_en,confirmada_en,cancelada_en,vence_en,fecha_entrega,vendedor_id,produccion_pedida_en,cliente:clientes(nombre,cedula,telefono),items:venta_items(nombre,cantidad,orden),abonos(id,monto,tipo,estado)').order('creado_en', { ascending:false }).limit(2000),
        AV.perfiles()
      ]);
      if(r.error) throw r.error;
      const firma = JSON.stringify(r.data || []);
      if(firma !== firmaDatos){ firmaDatos = firma; aplicar(r.data, ps); }   // sin cambios no se repinta (sin parpadeo)
      else { nombres = ps; subtitulo(); }
      try{ localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), data: r.data || [], ps })); } catch(e){}
    } catch(err){
      $('subtitulo').textContent = 'Sin conexión';
      if(!cargadoUnaVez) $('lista').innerHTML = `<div class="vacio"><div class="vacio-ico">${ICON_ALERTA}</div><h3>No se pudo cargar</h3><p>Revisa tu internet.</p><button class="btn-secondary" type="button" id="btnReintentar" style="width:auto;padding:0 22px">Reintentar</button></div>`;
      else toast('No se pudo actualizar. Revisa tu internet', 'error');
    }
  }
  $('lista').addEventListener('click', (e) => { if(e.target.closest('#btnReintentar')) cargar(); });
  $('btnActualizar').addEventListener('click', async () => {
    $('btnActualizar').disabled = true;
    await cargar();
    if(actual) await recargarFicha();
    $('btnActualizar').disabled = false;
  });

  // ---------------------------------------------------------------------------
  // Ficha
  // ---------------------------------------------------------------------------
  let actual = null;      // venta completa abierta
  let pdf = null;         // { id, blob, promesa }

  function prepararPDF(v){
    const clave = v.id + '|' + v.actualizado_en + '|' + (v.abonos || []).length + '|' + v.estado;
    if(pdf && pdf.clave === clave) return;
    pdf = { clave, blob:null, promesa:null };
    const este = pdf;
    este.promesa = AV.crearPDF(v).then(b => { este.blob = b; if(pdf === este) pintarPie(); return b; })
      .catch(() => { if(pdf === este){ pdf = null; pintarPie(); } });
  }

  let fichaSeq = 0;
  async function abrirFicha(id){
    const seq = ++fichaSeq;
    actual = null;
    $('fichaBody').innerHTML = '<div class="sk-vcard" style="height:80px"></div><div class="sk-vcard" style="height:200px;margin-top:14px"></div>';
    $('fichaFoot').innerHTML = '';
    abrirHoja('sheetFicha');
    try{
      const v = await AV.cargarVenta(id);
      if(seq !== fichaSeq || !$('sheetFicha').classList.contains('open')) return;
      actual = v;
      pintarFicha();
      prepararPDF(actual);
    } catch(e){
      if(seq !== fichaSeq) return;
      $('fichaBody').innerHTML = `<div class="vacio"><h3>No se pudo abrir</h3><p>Revisa tu internet.</p></div>`;
    }
  }
  async function recargarFicha(){
    if(!actual) return;
    const seq = fichaSeq, id = actual.id;
    try{
      const v = await AV.cargarVenta(id);
      if(seq !== fichaSeq || !actual || actual.id !== id) return;
      actual = v; pintarFicha(); prepararPDF(actual);
    } catch(e){}
  }
  window.AH.alCerrar.sheetFicha = () => { actual = null; fichaSeq++; };

  const editable = (v) => v.estado === 'cotizacion' || v.estado === 'confirmada' || (v.estado === 'lista' && v.items.every(it => it.pieza_id));

  function pintarFicha(){
    const v = actual;
    const cot = AV.esCotizacion(v);
    const pag = AV.pagado(v.abonos), r = AV.resta(v);
    const tel = v.cliente.telefono || '';
    const pend = AV.porConfirmar(v.abonos).length;
    let html = `
      <div class="f-cab"><span class="f-num">${cot ? 'Cotización' : 'Pedido'} N° ${v.id}</span>${estadoHtml(v)}</div>
      <div class="f-nombre">${esc(v.cliente.nombre)}</div>
      <div class="f-sub">${esc(v.cliente.cedula || '')}${tel ? ' · 0' + esc(tel.replace(/^58/, '')) : ''}</div>
      <div class="f-contacto">
        <a href="https://wa.me/${esc(tel)}" target="_blank" rel="noopener">${ICON_WA}Escribirle</a>
        <a href="tel:+${esc(tel)}">${ICON_TEL}Llamar</a>
      </div>`;

    // Estado: en orden, uno al lado del otro, y un solo botón con el siguiente paso
    if(!cot) html += estadoBloque(v);
    else if(v.estado === 'cotizacion') html += `<button type="button" class="btn-guia" data-accion="convertir">
        <span class="bg-t">Convertir en venta</span><span class="bg-s">Cuando el cliente pague todo o una parte. Pasa a Ventas.</span></button>`;

    // Avisar al cliente: ① mensaje ② PDF
    if(v.estado !== 'cancelada') html += `<div class="f-tit" style="margin-top:20px">Avisar al cliente</div><div class="pasos3 dos">${avisarHtml(v)}</div>`;

    // Menús que se abren
    const totales = `
      <div class="t-fila"><span>Productos</span><b>${dinero(v.subtotal)}</b></div>
      ${Number(v.descuento) ? `<div class="t-fila"><span>Descuento</span><b>- ${dinero(v.descuento)}</b></div>` : ''}
      ${Number(v.instalacion) ? `<div class="t-fila"><span>Instalación</span><b>${dinero(v.instalacion)}</b></div>` : ''}
      ${Number(v.traslado) ? `<div class="t-fila"><span>Traslado</span><b>${dinero(v.traslado)}</b></div>` : ''}
      <div class="t-total"><span>Total</span><b>${dinero(v.total)}</b></div>`;
    if(cot){
      html += acordeon('precio', 'Precio', dinero(v.total), `<div class="totales">${totales}</div>`, true);
    } else {
      const lista = v.abonos.map(a => {
        const pe = a.tipo === 'abono' && a.estado === 'por_confirmar';
        const rech = a.estado === 'rechazado';
        const tocar = (pe && puedeConfirmar) ? `data-confirmar="${a.id}"` : (a.comprobante ? `data-comprobante="${esc(a.comprobante)}"` : 'disabled');
        const marca = pe ? '<span class="plazo pronto">Por confirmar</span>' : rech ? '<span class="plazo tarde">No llegó</span>' : (a.tipo === 'abono' ? '<span class="plazo ok">Confirmado</span>' : '');
        return `<button type="button" class="f-abono ${a.tipo === 'devolucion' ? 'dev' : ''} ${rech ? 'rech' : ''}" ${tocar}>
          <span class="f-abono-ico">${ICON_DINERO}</span>
          <span style="min-width:0"><span class="f-abono-t" style="display:block">${a.tipo === 'devolucion' ? 'Devolución' : 'Pago'} · ${esc(a.metodo)} ${marca}</span>
            <span class="f-abono-s">${esc(AV.fechaNum(a.fecha))}${nombres[a.registrado_por] ? ' · ' + esc(nombres[a.registrado_por]) : ''}${pe && puedeConfirmar ? ' · <span class="ver">Toca para confirmar</span>' : a.comprobante ? ' · <span class="ver">Ver comprobante</span>' : ''}</span>
            ${a.nota_confirmacion ? `<span class="f-abono-s" style="display:block;color:var(--ink)">Nota de ${esc(nombres[a.confirmado_por] || 'Ray')}: ${esc(a.nota_confirmacion)}</span>` : ''}</span>
          <span class="f-abono-m">${a.tipo === 'devolucion' ? '- ' : ''}${dinero(a.monto)}</span>
        </button>`; }).join('');
      const cuerpo = `<div class="totales">${totales}
          <div class="barra" style="margin-top:12px"><i style="transform:scaleX(${Number(v.total) ? Math.max(0, Math.min(1, pag / v.total)) : 0})"></i></div>
          <div class="barra-txt"><span>Pagado <b>${dinero(pag)}</b></span><span>${r > 0 ? 'Resta <b>' + dinero(r) + '</b>' : '<b>Pagado completo</b>'}</span></div></div>
        ${lista ? `<div style="margin-top:6px">${lista}</div>` : ''}
        ${pend && puedeConfirmar ? '<div class="f-nota">Toca un pago "Por confirmar" para revisar que el dinero llegó.</div>' : ''}
        ${v.estado !== 'cancelada' && r > 0 ? `<button type="button" class="btn-guia sec" data-accion="abono" style="margin-top:12px">
          <span class="bg-t">Registrar pago</span><span class="bg-s">Cuando el cliente pague lo que resta o una parte. Queda por confirmar.</span></button>` : ''}`;
      html += acordeon('pagos', 'Pagos', `${r > 0 ? 'Resta ' + dinero(r) : 'Pagado completo'}${pend ? ' · ' + pend + ' por confirmar' : ''}`, cuerpo, true);
    }
    html += acordeon('productos', 'Productos', `${v.items.length} ${v.items.length === 1 ? 'producto' : 'productos'}`,
      v.items.map(it => `<div class="f-item">
        <div class="f-foto">${it.foto ? `<img src="${esc(it.foto)}" alt="" loading="lazy">` : iconoTipo(it.tipo, 24)}</div>
        <div style="flex:1;min-width:0"><div class="f-item-t">${esc(it.nombre)}</div>
          <div class="f-item-d">${esc(AV.detalleItem(it))}</div>
          <div class="f-item-p"><span>${it.cantidad} × ${dinero(it.precio_unitario)}</span><b>${dinero(it.precio_unitario * it.cantidad)}</b></div></div>
      </div>`).join(''));
    const datos = [];
    datos.push(`<div class="f-dato"><span>${cot ? 'Hecha' : 'Confirmada'}</span><b>${esc(AV.fechaNum(cot ? v.creado_en : (v.confirmada_en || v.creado_en)))}</b></div>`);
    datos.push(`<div class="f-dato"><span>Por</span><b>${esc(v.vendedor || '-')}</b></div>`);
    datos.push(`<div class="f-dato"><span>Sede</span><b>${esc(v.sede ? v.sede.nombre : '-')}</b></div>`);
    datos.push(cot ? `<div class="f-dato"><span>Válida hasta</span><b>${esc(AV.fechaNum(new Date(v.vence_en + 'T12:00')))}</b></div>`
                   : `<div class="f-dato"><span>Entrega</span><b>${v.fecha_entrega ? esc(AV.fechaNum(new Date(v.fecha_entrega + 'T12:00'))) : '-'}</b></div>`);
    if(v.notas) datos.push(`<div class="f-dato ancho"><span>Notas</span><b style="font-weight:600">${esc(v.notas)}</b></div>`);
    if(v.estado === 'cancelada') datos.push(`<div class="f-dato ancho"><span>${cot ? 'Descartada' : 'Cancelada'} el ${esc(AV.fechaNum(v.cancelada_en))}</span><b style="font-weight:600">${esc(v.cancelada_motivo || 'Sin motivo')}</b></div>`);
    html += acordeon('datos', cot ? 'Datos de la cotización' : 'Datos de la venta', 'Fechas, sede y notas', `<div class="f-datos">${datos.join('')}</div>`);

    const links = [];
    if(v.estado !== 'cancelada' && v.estado !== 'entregada'){
      if(editable(v)) links.push(opcion(`<a class="f-link" href="venta.html?editar=${v.id}" data-sub>`, cot ? 'Editar cotización' : 'Editar venta', 'Si el cliente cambia o agrega algo', '</a>'));
      else links.push(`<span class="f-link" aria-disabled="true"><span><span class="op-t">No se puede editar</span><span class="op-s">Ya está ${esc(AV.ESTADOS[v.estado].t.toLowerCase())}</span></span></span>`);
    }
    links.push(opcion(`<a class="f-link" href="${esc(AV.urlSeguimiento(v))}" target="_blank" rel="noopener">`, 'Ver seguimiento', 'Así lo ve el cliente', '</a>'));
    links.push(opcion('<button type="button" class="f-link" data-accion="copiar-enlace">', 'Copiar enlace de seguimiento', 'Para mandarlo por otro lado', '</button>'));
    links.push(opcion('<button type="button" class="f-link" data-accion="descargar">', 'Descargar PDF', 'Guardarlo en el teléfono', '</button>'));
    const pv = pasosDe(v), k = pv.indexOf(v.estado);
    if(esAdmin && k > 0) links.push(opcion(`<button type="button" class="f-link" data-retro="${pv[k - 1]}">`, `Devolver a "${AV.ESTADOS[pv[k - 1]].t}"`, 'Solo si se marcó por error', '</button>'));
    if(v.estado !== 'cancelada' && v.estado !== 'entregada') links.push(opcion('<button type="button" class="f-link peligro" data-accion="cancelar">', cot ? 'Descartar cotización' : 'Cancelar venta', cot ? 'El cliente no la quiere' : 'Si pagó algo, se registra la devolución', '</button>'));
    html += acordeon('mas', 'Más opciones', 'Editar, PDF, seguimiento, cancelar', `<div class="f-links" style="margin-top:0;border-top:0">${links.join('')}</div>`);

    $('fichaBody').innerHTML = html;
    pintarPie();
  }

  // Menús que se abren y cierran (se recuerda cuáles abriste)
  const abiertos = { pagos:true, precio:true };
  function acordeon(id, titulo, sub, cuerpo){
    return `<details class="acord" data-sec="${id}" ${abiertos[id] ? 'open' : ''}>
      <summary><span><span class="ac-t">${esc(titulo)}</span><span class="ac-s">${esc(sub)}</span></span>
        <svg class="ac-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="ac-body">${cuerpo}</div></details>`;
  }
  $('fichaBody').addEventListener('toggle', (e) => {
    const d = e.target.closest && e.target.closest('details.acord');
    if(d) abiertos[d.dataset.sec] = d.open;
  }, true);
  function opcion(abre, t, s, cierra){
    return `${abre}<span><span class="op-t">${esc(t)}</span><span class="op-s">${esc(s)}</span></span>${ICON_CHEV}${cierra}`;
  }

  // Estados en orden (no se saltan pasos)
  const PASOS = ['confirmada', 'en_produccion', 'lista', 'entregada'];
  // Si todo es de entrega inmediata (ya está en tienda) no pasa por producción
  const soloInmediata = (v) => (v.items || []).length > 0 && v.items.every(it => it.pieza_id);
  const pasosDe = (v) => soloInmediata(v) ? PASOS.filter(p => p !== 'en_produccion') : PASOS;
  const SIGUIENTE = {
    confirmada:    { t:'Pasar a En producción', s:'El pedido entra a fabricación' },
    en_produccion: { t:'Marcar como Lista', s:'Ya está fabricado y listo para entregar' },
    lista:         { t:'Marcar como Entregada', s:'El cliente ya lo recibió' }
  };
  function estadoBloque(v){
    if(v.estado === 'cancelada') return '';
    const PV = pasosDe(v);
    const k = PV.indexOf(v.estado);
    let html = `<div class="estados" style="grid-template-columns:repeat(${PV.length},minmax(0,1fr))">${PV.map((p, i) => `
      <div class="est-i ${i < k || (i === k && v.estado === 'entregada') ? 'hecho' : ''} ${i === k && v.estado !== 'entregada' ? 'actual' : ''}">
        <span class="est-dot">${i < k || (i === k && v.estado === 'entregada') ? ICON_OK : ''}</span><span class="est-l">${esc(AV.ESTADOS[p].t)}</span></div>`).join('')}</div>`;
    const sig = PV[k + 1];
    if(!sig) return html + '<div class="f-nota" style="text-align:center">Pedido entregado. ¡Listo!</div>';
    if(sig === 'en_produccion' && !esAdmin){
      html += v.produccion_pedida_en
        ? `<div class="btn-guia hecho"><span class="bg-t">Pedido a producción ✓</span><span class="bg-s">${esc(cuando(v.produccion_pedida_en, v.produccion_pedida_por))}. El administrador lo pasará a producción.</span></div>`
        : `<button type="button" class="btn-guia" data-accion="pedir-produccion"><span class="bg-t">Pedir a producción</span><span class="bg-s">Le llega un aviso al administrador para que lo pase</span></button>`;
      return html;
    }
    const info = sig === 'lista' && v.estado === 'confirmada' ? { t:'Marcar como Lista', s:'Ya está en tienda, lista para entregar' } : SIGUIENTE[v.estado];
    const extra = sig === 'en_produccion' && v.produccion_pedida_en ? ` · Te lo pidió ${esc(nombres[v.produccion_pedida_por] || '')}` : '';
    return html + `<button type="button" class="btn-guia" data-estado="${sig}"><span class="bg-t">${esc(info.t)}</span><span class="bg-s">${esc(info.s)}${extra}</span></button>`;
  }

  // ① mensaje ② PDF
  const ICON_OK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  function cuando(ts, por){
    const d = new Date(ts), hoyD = new Date();
    const mismoDia = d.toDateString() === hoyD.toDateString();
    const hora = d.toLocaleTimeString('es-VE', { hour:'numeric', minute:'2-digit' });
    return (mismoDia ? 'Hoy ' + hora : AV.fechaNum(ts)) + (nombres[por] ? ' · ' + nombres[por] : '');
  }
  function paso(n, hecho, titulo, sub, attrs, deshabilitado){
    return `<button type="button" class="paso3 ${hecho ? 'hecho' : ''}" ${attrs} ${deshabilitado ? 'disabled' : ''}>
      <span class="p3-num">${hecho ? ICON_OK : n}</span><span class="p3-t">${titulo}</span><span class="p3-s">${sub}</span></button>`;
  }
  function avisarHtml(v){
    const msjHecho = !!(v.mensaje_en && v.mensaje_estado === v.estado);
    const pdfListo = !!(pdf && pdf.blob && pdf.clave && pdf.clave.startsWith(v.id + '|'));
    const pdfHecho = !!(v.pdf_en && new Date(v.pdf_en) >= new Date(v.actualizado_en));
    return paso(1, msjHecho, 'Mensaje', msjHecho ? 'Enviado ' + cuando(v.mensaje_en, v.mensaje_por) : 'Le escribe con el enlace de su seguimiento', 'data-accion="mensaje"')
      + paso(2, pdfHecho, 'PDF', pdfHecho ? 'Enviado ' + cuando(v.pdf_en, v.pdf_por) : (pdfListo ? 'Le manda su nota de pedido' : 'Preparando…'), 'data-accion="pdf"', !pdfListo);
  }
  function pintarPie(){
    const v = actual;
    if(!v) return;
    const cont = document.querySelector('#fichaBody .pasos3');
    if(cont) cont.innerHTML = avisarHtml(v);
    $('fichaFoot').innerHTML = '';
    $('fichaFoot').classList.add('hidden');
  }
  async function marcarPaso(v, pasoNombre){
    const { error } = await db.rpc('marcar_paso', { vid: v.id, paso: pasoNombre });
    if(error) return;
    const ahora = new Date().toISOString();
    if(actual && actual.id === v.id){
      const me = (await window.Sesion.perfil()) || {};
      if(pasoNombre === 'mensaje'){ actual.mensaje_en = ahora; actual.mensaje_estado = actual.estado; actual.mensaje_por = me.id; }
      if(pasoNombre === 'pdf'){ actual.pdf_en = ahora; actual.pdf_por = me.id; }
      pintarPie();
    }
  }

  // Acciones de la ficha
  document.getElementById('sheetFicha').addEventListener('click', async (e) => {
    // Editar: se cierra la ficha antes de salir; al volver se abre de nuevo
    const ed = e.target.closest('a[href^="venta.html?editar="]');
    if(ed){
      e.preventDefault();
      const destino = ed.getAttribute('href');
      try{ sessionStorage.setItem('ah_ficha', String(actual.id)); sessionStorage.setItem('ah_sub', '1'); }catch(err){}
      let ido = false;
      const ir = () => { if(ido) return; ido = true; window.removeEventListener('popstate', ir); setTimeout(() => { location.href = destino; }, 30); };
      window.addEventListener('popstate', ir);
      cerrarHoja('sheetFicha', true);
      setTimeout(ir, 700);
      return;
    }
    const est = e.target.closest('[data-estado]');
    if(est){ cambiarEstado(est.dataset.estado); return; }
    const retro = e.target.closest('[data-retro]');
    if(retro){ cambiarEstado(retro.dataset.retro, true); return; }
    const conf = e.target.closest('[data-confirmar]');
    if(conf){ abrirAccion('confirmar', +conf.dataset.confirmar); return; }
    const comp = e.target.closest('[data-comprobante]');
    if(comp){
      const { data, error } = await db.storage.from('comprobantes').createSignedUrl(comp.dataset.comprobante, 600);
      if(error || !data) toast('No se pudo abrir el comprobante', 'error'); else verFoto(data.signedUrl);
      return;
    }
    const b = e.target.closest('[data-accion]');
    if(!b || !actual) return;
    const a = b.dataset.accion;
    if(a === 'mensaje'){
      const v0 = actual;
      const url = AV.linkSeguimientoWA(v0);
      const w = window.open(url, '_blank');
      if(!w) location.href = url;
      marcarPaso(v0, 'mensaje');
      return;
    }
    if(a === 'copiar-enlace'){
      try{ await navigator.clipboard.writeText(AV.urlSeguimiento(actual)); toast('Enlace copiado'); } catch(err){ toast('No se pudo copiar', 'error'); }
      return;
    }
    if(a === 'producir'){
      const v0 = actual;
      if(!confirm(`¿Enviar el pedido N° ${v0.id} a producción?`)) return;
      const { error } = await db.rpc('cambiar_estado_venta', { vid: v0.id, nuevo: 'en_produccion' });
      if(error){ toast(error.message, 'error'); return; }
      toast(`Pedido N° ${v0.id} en producción`);
      await Promise.all([recargarFicha(), cargar()]);
      return;
    }
    if(a === 'pedir-produccion'){
      const v0 = actual;
      if(!confirm(`¿Pedir al administrador que envíe el pedido N° ${v0.id} a producción?`)) return;
      const { error } = await db.rpc('pedir_produccion', { vid: v0.id });
      if(error){ toast(error.message, 'error'); return; }
      toast('Listo, le llegó el aviso al administrador');
      await Promise.all([recargarFicha(), cargar()]);
      return;
    }
    if(a === 'pdf'){
      if(!pdf || !pdf.blob) return;
      const v0 = actual;
      const r = await AV.compartirPDF(pdf.blob, v0);
      if(r !== 'cancelado') marcarPaso(v0, 'pdf');
      if(r === 'descargado') toast('PDF descargado');
      else if(r !== 'cancelado') toast(`Teléfono copiado (${window.AV.telBonito(v0)}). Pégalo en el buscador de WhatsApp si no ves el chat`);
    }
    if(a === 'descargar'){
      if(pdf && pdf.blob){ AV.descargarPDF(pdf.blob, actual); toast('PDF descargado'); }
      else if(pdf && pdf.promesa){ toast('Preparando el PDF'); const bl = await pdf.promesa; if(bl) AV.descargarPDF(bl, actual); }
    }
    if(a === 'convertir') abrirAccion('convertir');
    if(a === 'abono') abrirAccion('abono');
    if(a === 'cancelar') abrirAccion('cancelar');
  });

  async function cambiarEstado(nuevo, devolver){
    const v = actual;
    if(!v || v.estado === nuevo) return;
    const nombre = AV.ESTADOS[nuevo].t;
    let pregunta = devolver ? `¿Devolver el pedido N° ${v.id} a "${nombre}"? Úsalo solo si se marcó por error.`
      : nuevo === 'en_produccion' ? `¿Pasar el pedido N° ${v.id} a producción?` : `¿Marcar el pedido N° ${v.id} como "${nombre}"?`;
    if(nuevo === 'entregada' && AV.resta(v) > 0) pregunta = `Todavía debe ${dinero(AV.resta(v))}. ¿Marcarlo como entregado igual?`;
    if(!confirm(pregunta)) return;
    const { error } = await db.rpc('cambiar_estado_venta', { vid: v.id, nuevo, desde: v.estado });
    if(error){ toast(error.message, 'error'); await Promise.all([recargarFicha(), cargar()]); return; }
    toast(`Pedido N° ${v.id}: ${nombre}`);
    await Promise.all([recargarFicha(), cargar()]);
  }

  // ---------------------------------------------------------------------------
  // Hoja de acción: convertir en venta, registrar pago, confirmar pago, cancelar
  // ---------------------------------------------------------------------------
  let acc = null;
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function abrirAccion(tipo, abonoId){
    const v = actual;
    const r = AV.resta(v);
    acc = { tipo, monto:'', metodo:null, fecha: AV.habiles(20), blob:null, foto:null, motivo:'', guardando:false, clave: uuid(), abono: tipo === 'confirmar' ? v.abonos.find(a => a.id === abonoId) : null, nota:'' };
    if(tipo === 'convertir'){
      const inm = AV.soloInmediata(v.items);   // exhibición: pago completo y entrega hoy
      acc.modo = inm ? 'completo' : 'parcial';
      acc.monto = String(inm ? Number(v.total) : Math.round(v.total * 50) / 100);
      if(inm) acc.fecha = AV.iso(new Date());
    }
    if(tipo === 'abono'){ acc.modo = 'completo'; acc.monto = String(r); }
    $('accionTitulo').textContent = tipo === 'confirmar' ? 'Confirmar pago' : tipo === 'convertir' ? 'Convertir en venta' : tipo === 'abono' ? 'Registrar pago' : (AV.esCotizacion(v) ? 'Descartar cotización' : 'Cancelar venta');
    $('btnAccion').textContent = tipo === 'confirmar' ? 'Sí llegó, confirmar' : tipo === 'convertir' ? 'Guardar venta' : tipo === 'abono' ? 'Guardar pago' : (AV.esCotizacion(v) ? 'Descartar' : 'Cancelar venta');
    $('btnAccion').style.background = tipo === 'cancelar' ? 'var(--danger)' : '';
    pintarAccion();
    abrirHoja('sheetAccion');
  }
  function metodosHtml(label){
    return `<div class="field" id="campoMetodo"><span class="field-label">${label}</span>
      <div class="opts" style="--cols:2">${AV.METODOS.map(x => `<button type="button" class="opt ${x === acc.metodo ? 'selected' : ''}" data-metodo="${x}" aria-pressed="${x === acc.metodo}">${x}</button>`).join('')}</div>
      <div class="field-error">Elige el método</div></div>`;
  }
  function pintarAccion(){
    const v = actual;
    let html = '';
    if(acc.tipo === 'confirmar'){
      const a = acc.abono;
      html = `<div class="conf-total"><span>Pago · ${esc(a.metodo)}</span><b>${dinero(a.monto)}</b></div>
        <div class="f-nota" style="margin:0 0 12px">Pedido N° ${v.id} · ${esc(v.cliente.nombre)} · ${esc(AV.fechaNum(a.fecha))}${nombres[a.registrado_por] ? ' · registró ' + esc(nombres[a.registrado_por]) : ''}</div>
        ${a.comprobante ? `<button type="button" class="btn-secondary" data-ver-comprobante="${esc(a.comprobante)}" style="width:100%;height:48px;margin-bottom:14px">Ver comprobante</button>` : '<div class="f-nota" style="margin:0 0 12px">No subieron comprobante.</div>'}
        <div class="field"><label class="field-label" for="aNota">Tu nota (opcional)</label>
          <textarea class="input" id="aNota" rows="3" placeholder="A dónde llegó el dinero, a quién se transfirió…">${esc(acc.nota)}</textarea></div>
        <button type="button" class="f-link peligro" data-no-llego style="width:100%;justify-content:center;border:1px solid #F4C7C3;border-radius:14px;margin-top:4px">No llegó</button>`;
    } else if(acc.tipo === 'cancelar'){
      const pag = AV.pagado(v.abonos);
      html = `${pag > 0 ? `<div class="conf-total"><span>Se le devuelve</span><b>${dinero(pag)}</b></div>${metodosHtml('Cómo se le devolvió')}` : ''}
        <div class="field"><label class="field-label" for="aMotivo">Motivo (opcional)</label>
        <textarea class="input" id="aMotivo" rows="2" placeholder="Por qué se ${AV.esCotizacion(v) ? 'descarta' : 'cancela'}">${esc(acc.motivo)}</textarea></div>
        ${AV.esCotizacion(v) ? '' : '<div class="f-nota">Si tenía piezas de entrega inmediata, vuelven a la tienda.</div>'}`;
    } else {
      const base = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
      html = `<div class="conf-total"><span>${acc.tipo === 'convertir' ? 'Total de la venta' : 'Resta por pagar'}</span><b>${dinero(base)}</b></div>
        ${AV.modoPagoHtml(acc.modo, acc.tipo === 'abono' ? 'Paga lo que resta' : 'Pago completo')}
        <div class="field ${acc.modo === 'completo' ? 'hidden' : ''}" id="campoMonto"><label class="field-label" for="aMonto">Monto del pago en dólares</label>
          <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="aMonto" type="text" inputmode="decimal" autocomplete="off" value="${esc(acc.monto)}"></div>
          <div class="field-error" id="errMonto">Escribe el monto</div><div id="avisoMonto"></div></div>
        ${metodosHtml('Cómo pagó')}
        ${AV.comprobanteHtml(acc.foto)}
        ${acc.tipo === 'convertir' ? `<div class="field" id="campoFecha"><label class="field-label" for="aFecha">Fecha de entrega</label>
          <input class="input" id="aFecha" type="date" min="${AV.iso(new Date())}" value="${esc(acc.fecha)}">
          <div class="field-hint">${AV.soloInmediata(v.items) ? 'Es de entrega inmediata: hoy. La puedes cambiar.' : '20 días hábiles desde hoy, sin sábados ni domingos. La puedes cambiar.'}</div>
          <div class="field-error">Elige la fecha de entrega</div></div>` : ''}`;
    }
    $('accionBody').innerHTML = html;
    avisoMonto();
  }
  function avisoMonto(){
    if(!acc || acc.tipo === 'cancelar' || !$('avisoMonto')) return;
    const v = actual;
    const tope = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
    const m = numOrNull(acc.monto) || 0;
    let html = '';
    if(acc.tipo === 'convertir' && m > 0 && m < v.total * 0.5) html += `<div class="aviso-50">${ICON_ALERTA}Pago menor al 50%</div>`;
    if(m > 0 && m <= tope) html += `<div class="resta-t">${acc.tipo === 'convertir' ? 'Resta por pagar' : 'Después de este pago resta'}: <b>${dinero(Math.round((tope - m) * 100) / 100)}</b></div>`;
    $('avisoMonto').innerHTML = html;
    $('errMonto').textContent = m > tope ? 'Es mayor que lo que falta por pagar' : 'Escribe el monto';
    $('campoMonto').classList.toggle('invalid', m > tope);
  }
  $('accionBody').addEventListener('input', (e) => {
    if(e.target.id === 'aMonto'){ acc.monto = e.target.value; avisoMonto(); }
    if(e.target.id === 'aMotivo') acc.motivo = e.target.value;
    if(e.target.id === 'aNota') acc.nota = e.target.value;
    if(e.target.id === 'aFecha'){ acc.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
  });
  $('accionBody').addEventListener('change', async (e) => {
    if(e.target.id === 'aFecha'){ acc.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
    if(e.target.id === 'aComprobante' && e.target.files[0]){
      try{
        acc.blob = await comprimirFoto(e.target.files[0], AV.COMPROBANTE.lado, AV.COMPROBANTE.calidad);
        acc.foto = URL.createObjectURL(acc.blob);
        const sc = $('accionBody').scrollTop; pintarAccion(); $('accionBody').scrollTop = sc;
      } catch(err){ toast('No se pudo leer la foto', 'error'); }
    }
  });
  $('accionBody').addEventListener('click', async (e) => {
    const vc = e.target.closest('[data-ver-comprobante]');
    if(vc){
      const { data, error } = await db.storage.from('comprobantes').createSignedUrl(vc.dataset.verComprobante, 600);
      if(error || !data) toast('No se pudo abrir el comprobante', 'error'); else verFoto(data.signedUrl);
      return;
    }
    if(e.target.closest('[data-no-llego]')){ guardarConfirmacion(false); return; }
    const mp = e.target.closest('[data-modo-pago]');
    if(mp){
      const v = actual;
      acc.modo = mp.dataset.modoPago;
      const tope = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
      acc.monto = String(acc.modo === 'completo' ? tope : (acc.tipo === 'convertir' ? Math.round(v.total * 50) / 100 : ''));
      const sc = $('accionBody').scrollTop; pintarAccion(); $('accionBody').scrollTop = sc;
      if(acc.modo === 'parcial') $('aMonto').focus();
      return;
    }
    const b = e.target.closest('[data-metodo]');
    if(!b) return;
    acc.metodo = b.dataset.metodo;
    document.querySelectorAll('#accionBody [data-metodo]').forEach(x => { const s = x === b; x.classList.toggle('selected', s); x.setAttribute('aria-pressed', s); });
    $('campoMetodo').classList.remove('invalid');
  });

  async function subirComprobante(){
    if(!acc.blob) return null;
    const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db.storage.from('comprobantes').upload(path, acc.blob, { contentType:'image/jpeg' });
    if(error) throw new Error('No se pudo subir el comprobante: ' + error.message);
    return path;
  }

  async function guardarConfirmacion(llego){
    if(!acc || acc.guardando) return;
    const v = actual, a = acc.abono;
    if(!llego && !confirm(`¿Marcar que el pago de ${dinero(a.monto)} NO llegó? Dejará de contar y se le avisa a quien lo registró.`)) return;
    acc.guardando = true;
    const btn = $('btnAccion'); btn.disabled = true;
    try{
      const { error } = await db.rpc('confirmar_abono', { aid: a.id, llego, nota: acc.nota || null });
      if(error) throw new Error(error.message);
      cerrarHoja('sheetAccion', true);
      toast(llego ? 'Pago confirmado' : 'Marcado como que no llegó');
      await Promise.all([recargarFicha(), cargar()]);
    } catch(err){ toast(err.message, 'error'); }
    finally { if(acc) acc.guardando = false; btn.disabled = false; }
  }

  $('btnAccion').addEventListener('click', async () => {
    if(!acc || acc.guardando) return;
    if(acc.tipo === 'confirmar'){ guardarConfirmacion(true); return; }
    const v = actual;
    const btn = $('btnAccion');
    let primero = null;
    const marcar = (id, mal) => { const el = $(id); if(!el) return; el.classList.toggle('invalid', mal); if(mal && !primero) primero = el; };
    const pag = AV.pagado(v.abonos);
    if(acc.tipo === 'cancelar'){
      if(pag > 0) marcar('campoMetodo', !acc.metodo);
    } else {
      const tope = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
      const m = acc.modo === 'completo' ? tope : (numOrNull(acc.monto) || 0);
      marcar('campoMonto', !(m > 0) || m > tope);
      marcar('campoMetodo', !acc.metodo);
      marcar('campoComp', !acc.blob);
      if(acc.tipo === 'convertir') marcar('campoFecha', !acc.fecha || acc.fecha < AV.iso(new Date()));
    }
    if(primero){ primero.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    if(acc.tipo === 'cancelar' && !confirm(AV.esCotizacion(v) ? '¿Descartar esta cotización?' : (pag > 0 ? `¿Cancelar la venta y registrar la devolución de ${dinero(pag)}?` : '¿Cancelar esta venta?'))) return;

    acc.guardando = true;
    const txt = btn.textContent;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Guardando';
    try{
      let res;
      if(acc.tipo === 'cancelar'){
        res = await db.rpc('cancelar_venta', { vid: v.id, motivo: acc.motivo || null, metodo_devolucion: pag > 0 ? acc.metodo : null });
      } else {
        const comprobante = await subirComprobante();
        const tope = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
        const a = { monto: Math.round((acc.modo === 'completo' ? tope : (numOrNull(acc.monto) || 0)) * 100) / 100, metodo: acc.metodo, comprobante, clave: acc.clave };
        if(acc.tipo === 'convertir'){ a.fecha_entrega = acc.fecha; res = await db.rpc('convertir_en_venta', { vid: v.id, a }); }
        else res = await db.rpc('registrar_abono', { vid: v.id, a });
      }
      if(res.error) throw new Error(res.error.message);
      cerrarHoja('sheetAccion', true);
      if(acc.tipo === 'convertir'){
        toast(`Listo, ahora es la venta N° ${v.id}. La ves en Ventas`);
        cerrarHoja('sheetFicha', true);
        await cargar();
      } else {
        toast(acc.tipo === 'abono' ? 'Pago guardado. Queda por confirmar' : (AV.esCotizacion(v) ? 'Cotización descartada' : 'Venta cancelada'));
        await Promise.all([recargarFicha(), cargar()]);
      }
    } catch(err){
      const m = String(err.message || '');
      toast(/fetch|network/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m, 'error');
    } finally {
      if(acc) acc.guardando = false;
      btn.disabled = false; btn.textContent = txt;
    }
  });
  antesDeCerrar.sheetAccion = () => !(acc && acc.guardando);

  window.addEventListener('scroll', () => $('topbar').classList.toggle('scrolled', window.scrollY > 4), { passive:true });
  // Al volver de editar (página guardada por el navegador), se actualiza todo
  function fichaPendiente(){
    let id = null;
    try{ id = sessionStorage.getItem('ah_ficha'); sessionStorage.removeItem('ah_ficha'); }catch(e){}
    if(!id){
      // Desde una notificación: ventas.html?abrir=12 (se quita de la dirección para no reabrirla)
      const q = new URLSearchParams(location.search);
      if(q.get('abrir')){ id = q.get('abrir'); history.replaceState(history.state, '', location.pathname); }
    }
    return id ? +id : null;
  }
  window.addEventListener('pageshow', async (e) => {
    if(!e.persisted) return;
    await cargar();
    const id = fichaPendiente();
    if(id) abrirFicha(id); else recargarFicha();
  });

  (async function(){
    desdeCache();
    await cargar();
    const id = fichaPendiente();
    if(id) abrirFicha(id);
  })();
})();
