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
    : [ { id:'activas', t:'Activas' }, { id:'cobrar', t:'Por cobrar' }, { id:'entregadas', t:'Entregadas' }, { id:'canceladas', t:'Canceladas' } ];
  let filtro = FILTROS[0].id;

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
    if(f === 'entregadas') return v.estado === 'entregada';
    return v.estado === 'cancelada';
  }
  const t = (x) => x ? new Date(x).getTime() : 0;
  function ordenar(lista){
    const porEntrega = (a, b) => (a.fecha_entrega || '9999') < (b.fecha_entrega || '9999') ? -1 : (a.fecha_entrega || '9999') > (b.fecha_entrega || '9999') ? 1 : 0;
    if(filtro === 'abiertas') return lista.sort((a, b) => t(b.creado_en) - t(a.creado_en));
    if(filtro === 'vencidas') return lista.sort((a, b) => (b.vence_en || '').localeCompare(a.vence_en || ''));
    if(filtro === 'activas' || filtro === 'cobrar') return lista.sort(porEntrega);
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
  let esAdmin = false;
  window.Sesion.perfil().then(p => { esAdmin = !!(p && p.rol === 'admin'); }).catch(() => {});
  const vendedor = (v) => nombres[v.vendedor_id] || '';

  function pintarChips(){
    $('chips').innerHTML = FILTROS.map(f => {
      const n = todas.filter(v => enFiltro(v, f.id)).length;
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

  async function cargar(){
    try{
      const [r, ps] = await Promise.all([
        db.from('ventas').select('id,estado,total,creado_en,actualizado_en,confirmada_en,cancelada_en,vence_en,fecha_entrega,vendedor_id,cliente:clientes(nombre,cedula,telefono),items:venta_items(nombre,cantidad,orden),abonos(monto,tipo)').order('creado_en', { ascending:false }).limit(2000),
        AV.perfiles()
      ]);
      if(r.error) throw r.error;
      nombres = ps;
      todas = (r.data || []).filter(v => COT ? AV.esCotizacion(v) : !AV.esCotizacion(v));
      cargadoUnaVez = true;
      subtitulo();
      pintar();
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
    pdf = { clave, blob:null, png:null, listo:false, promesa:null };
    const este = pdf;
    // Se prepara el PDF y su imagen de una vez, para que al tocar "Enviar" todo pase en el mismo toque
    este.promesa = AV.crearPDF(v).then(async b => {
      este.blob = b;
      try{ este.png = await AV.imagenDePDF(b); } catch(e){ este.png = null; }
      este.listo = true;
      if(pdf === este) pintarPie();
      return b;
    }).catch(() => { if(pdf === este){ pdf = null; pintarPie(); } });
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
    let html = `
      <div class="f-cab"><span class="f-num">${cot ? 'Cotización' : 'Pedido'} N° ${v.id}</span>${estadoHtml(v)}</div>
      <div class="f-nombre">${esc(v.cliente.nombre)}</div>
      <div class="f-sub">${esc(v.cliente.cedula || '')}${tel ? ' · 0' + esc(tel.replace(/^58/, '')) : ''}</div>
      <div class="f-contacto">
        <a href="https://wa.me/${esc(tel)}" target="_blank" rel="noopener">${ICON_WA}Escribirle</a>
        <a href="tel:+${esc(tel)}">${ICON_TEL}Llamar</a>
      </div>
      <div class="f-sec"><div class="f-tit">Productos</div>
        ${v.items.map(it => `<div class="f-item">
          <div class="f-foto">${it.foto ? `<img src="${esc(it.foto)}" alt="" loading="lazy">` : iconoTipo(it.tipo, 24)}</div>
          <div style="flex:1;min-width:0"><div class="f-item-t">${esc(it.nombre)}</div>
            <div class="f-item-d">${esc(AV.detalleItem(it))}</div>
            <div class="f-item-p"><span>${it.cantidad} × ${dinero(it.precio_unitario)}</span><b>${dinero(it.precio_unitario * it.cantidad)}</b></div></div>
        </div>`).join('')}
      </div>
      <div class="f-sec totales">
        <div class="t-fila"><span>Productos</span><b>${dinero(v.subtotal)}</b></div>
        ${Number(v.descuento) ? `<div class="t-fila"><span>Descuento</span><b>- ${dinero(v.descuento)}</b></div>` : ''}
        ${Number(v.instalacion) ? `<div class="t-fila"><span>Instalación o traslado</span><b>${dinero(v.instalacion)}</b></div>` : ''}
        <div class="t-total"><span>Total</span><b>${dinero(v.total)}</b></div>
        ${cot ? '' : `<div class="barra" style="margin-top:12px"><i style="transform:scaleX(${Number(v.total) ? Math.max(0, Math.min(1, pag / v.total)) : 0})"></i></div>
          <div class="barra-txt"><span>Pagado <b>${dinero(pag)}</b></span><span>${r > 0 ? 'Resta <b>' + dinero(r) + '</b>' : '<b>Pagado completo</b>'}</span></div>`}
      </div>`;
    if(!cot && v.abonos.length){
      html += `<div class="f-sec"><div class="f-tit">Pagos</div>
        ${v.abonos.map(a => `<button type="button" class="f-abono ${a.tipo === 'devolucion' ? 'dev' : ''}" ${a.comprobante ? `data-comprobante="${esc(a.comprobante)}"` : 'disabled'}>
          <span class="f-abono-ico">${ICON_DINERO}</span>
          <span><span class="f-abono-t" style="display:block">${a.tipo === 'devolucion' ? 'Devolución' : 'Abono'} · ${esc(a.metodo)}</span>
            <span class="f-abono-s">${esc(AV.fechaNum(a.fecha))}${nombres[a.registrado_por] ? ' · ' + esc(nombres[a.registrado_por]) : ''}${a.comprobante ? ' · <span class="ver">Ver comprobante</span>' : ''}</span></span>
          <span class="f-abono-m">${a.tipo === 'devolucion' ? '- ' : ''}${dinero(a.monto)}</span>
        </button>`).join('')}
      </div>`;
    }
    const datos = [];
    datos.push(`<div class="f-dato"><span>${cot ? 'Hecha' : 'Confirmada'}</span><b>${esc(AV.fechaNum(cot ? v.creado_en : (v.confirmada_en || v.creado_en)))}</b></div>`);
    datos.push(`<div class="f-dato"><span>Por</span><b>${esc(v.vendedor || '-')}</b></div>`);
    datos.push(`<div class="f-dato"><span>Sede</span><b>${esc(v.sede ? v.sede.nombre : '-')}</b></div>`);
    datos.push(cot ? `<div class="f-dato"><span>Válida hasta</span><b>${esc(AV.fechaNum(new Date(v.vence_en + 'T12:00')))}</b></div>`
                   : `<div class="f-dato"><span>Entrega</span><b>${v.fecha_entrega ? esc(AV.fechaNum(new Date(v.fecha_entrega + 'T12:00'))) : '-'}</b></div>`);
    if(v.notas) datos.push(`<div class="f-dato ancho"><span>Notas</span><b style="font-weight:600">${esc(v.notas)}</b></div>`);
    if(v.estado === 'cancelada') datos.push(`<div class="f-dato ancho"><span>${cot ? 'Descartada' : 'Cancelada'} el ${esc(AV.fechaNum(v.cancelada_en))}</span><b style="font-weight:600">${esc(v.cancelada_motivo || 'Sin motivo')}</b></div>`);
    html += `<div class="f-sec f-datos">${datos.join('')}</div>`;

    if(!cot && !['cancelada'].includes(v.estado)){
      const pasos = ['confirmada', 'en_produccion', 'lista', 'entregada'];
      html += `<div class="f-sec"><div class="f-tit">Estado</div>
        <div class="opts" style="--cols:2">${pasos.map((s, i) => { const atras = i < pasos.indexOf(v.estado) && !esAdmin; return `<button type="button" class="opt ${s === v.estado ? 'selected' : ''}" data-estado="${s}" aria-pressed="${s === v.estado}" ${atras ? 'disabled style="opacity:.45"' : ''}>${esc(AV.ESTADOS[s].t)}</button>`; }).join('')}</div>
        <div class="f-nota">Cuando exista el módulo de Producción, esto cambiará solo.</div></div>`;
    }
    const links = [];
    if(v.estado !== 'cancelada' && v.estado !== 'entregada'){
      if(editable(v)) links.push(`<a class="f-link" href="venta.html?editar=${v.id}" data-sub>${cot ? 'Editar cotización' : 'Editar venta'}${ICON_CHEV}</a>`);
      else links.push(`<span class="f-link" aria-disabled="true">Ya no se puede editar (${esc(AV.ESTADOS[v.estado].t.toLowerCase())})</span>`);
    }
    links.push(`<button type="button" class="f-link" data-accion="pdf">Compartir PDF${ICON_CHEV}</button>`);
    links.push(`<button type="button" class="f-link" data-accion="descargar">Descargar PDF${ICON_CHEV}</button>`);
    if(v.estado !== 'cancelada' && v.estado !== 'entregada') links.push(`<button type="button" class="f-link peligro" data-accion="cancelar">${cot ? 'Descartar cotización' : 'Cancelar venta'}</button>`);
    html += `<div class="f-links">${links.join('')}</div>`;
    $('fichaBody').innerHTML = html;
    pintarPie();
  }

  function pintarPie(){
    const v = actual;
    if(!v) return;
    const cot = AV.esCotizacion(v);
    const listo = pdf && pdf.listo;
    const btnPdf = `<button class="btn-secondary btn-enviar" type="button" data-accion="enviar" ${listo ? '' : 'disabled'}>${listo ? ICON_WA + 'Enviar' : '<span class="spinner" style="border-color:rgba(0,0,0,.15);border-top-color:var(--accent)"></span>Enviar'}</button>`;
    let principal = '';
    if(cot && v.estado === 'cotizacion') principal = `<button class="btn-primary" type="button" data-accion="convertir">Convertir en venta</button>`;
    else if(!cot && v.estado !== 'cancelada' && AV.resta(v) > 0) principal = `<button class="btn-primary" type="button" data-accion="abono">Registrar abono</button>`;
    $('fichaFoot').innerHTML = principal
      ? `<div class="f-foot">${btnPdf}${principal}</div>`
      : `<button class="btn-primary btn-enviar" type="button" data-accion="enviar" ${listo ? '' : 'disabled'}>${listo ? ICON_WA + 'Enviar al cliente' : '<span class="spinner"></span>Preparando'}</button>`;
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
    const comp = e.target.closest('[data-comprobante]');
    if(comp){
      const { data, error } = await db.storage.from('comprobantes').createSignedUrl(comp.dataset.comprobante, 600);
      if(error || !data) toast('No se pudo abrir el comprobante', 'error'); else verFoto(data.signedUrl);
      return;
    }
    const b = e.target.closest('[data-accion]');
    if(!b || !actual) return;
    const a = b.dataset.accion;
    if(a === 'enviar'){
      if(!pdf || !pdf.listo) return;
      AV.enviarAlCliente(actual, pdf.png, (r) => {
        if(r === 'ok') toast('Imagen copiada. En el chat mantén presionado y toca Pegar');
        else toast('No se pudo copiar la imagen. Usa "Compartir PDF"', 'error');
      });
      return;
    }
    if(a === 'pdf'){
      if(!pdf || !pdf.blob){ toast('Preparando el PDF'); return; }
      const r = await AV.compartirPDF(pdf.blob, actual);
      if(r === 'descargado') toast('PDF descargado');
    }
    if(a === 'descargar'){
      if(pdf && pdf.blob){ AV.descargarPDF(pdf.blob, actual); toast('PDF descargado'); }
      else if(pdf && pdf.promesa){ toast('Preparando el PDF'); const bl = await pdf.promesa; if(bl) AV.descargarPDF(bl, actual); }
    }
    if(a === 'convertir') abrirAccion('convertir');
    if(a === 'abono') abrirAccion('abono');
    if(a === 'cancelar') abrirAccion('cancelar');
  });

  async function cambiarEstado(nuevo){
    const v = actual;
    if(!v || v.estado === nuevo) return;
    const nombre = AV.ESTADOS[nuevo].t;
    let pregunta = `¿Marcar el pedido N° ${v.id} como "${nombre}"?`;
    if(nuevo === 'entregada' && AV.resta(v) > 0) pregunta = `Todavía debe ${dinero(AV.resta(v))}. ¿Marcarlo como entregado igual?`;
    if(!confirm(pregunta)) return;
    const { error } = await db.rpc('cambiar_estado_venta', { vid: v.id, nuevo });
    if(error){ toast(error.message, 'error'); return; }
    toast(`Pedido N° ${v.id}: ${nombre}`);
    await Promise.all([recargarFicha(), cargar()]);
  }

  // ---------------------------------------------------------------------------
  // Hoja de acción: convertir en venta, registrar abono, cancelar
  // ---------------------------------------------------------------------------
  let acc = null;
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function abrirAccion(tipo){
    const v = actual;
    const r = AV.resta(v);
    acc = { tipo, monto:'', metodo:null, fecha: AV.habiles(20), blob:null, foto:null, motivo:'', guardando:false, clave: uuid() };
    if(tipo === 'convertir') acc.monto = String(Math.round(v.total * 50) / 100);
    if(tipo === 'abono') acc.monto = String(r);
    $('accionTitulo').textContent = tipo === 'convertir' ? 'Convertir en venta' : tipo === 'abono' ? 'Registrar abono' : (AV.esCotizacion(v) ? 'Descartar cotización' : 'Cancelar venta');
    $('btnAccion').textContent = tipo === 'convertir' ? 'Guardar venta' : tipo === 'abono' ? 'Guardar abono' : (AV.esCotizacion(v) ? 'Descartar' : 'Cancelar venta');
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
    if(acc.tipo === 'cancelar'){
      const pag = AV.pagado(v.abonos);
      html = `${pag > 0 ? `<div class="conf-total"><span>Se le devuelve</span><b>${dinero(pag)}</b></div>${metodosHtml('Cómo se le devolvió')}` : ''}
        <div class="field"><label class="field-label" for="aMotivo">Motivo (opcional)</label>
        <textarea class="input" id="aMotivo" rows="2" placeholder="Por qué se ${AV.esCotizacion(v) ? 'descarta' : 'cancela'}">${esc(acc.motivo)}</textarea></div>
        ${AV.esCotizacion(v) ? '' : '<div class="f-nota">Si tenía piezas de entrega inmediata, vuelven a la tienda.</div>'}`;
    } else {
      const base = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
      html = `<div class="conf-total"><span>${acc.tipo === 'convertir' ? 'Total de la venta' : 'Resta por pagar'}</span><b>${dinero(base)}</b></div>
        <div class="field" id="campoMonto"><label class="field-label" for="aMonto">Abono en dólares</label>
          <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="aMonto" type="text" inputmode="decimal" autocomplete="off" value="${esc(acc.monto)}"></div>
          <div class="field-error" id="errMonto">Escribe el monto</div><div id="avisoMonto"></div></div>
        ${metodosHtml('Cómo pagó')}
        <div class="field"><span class="field-label">Comprobante (opcional)</span>
          <div class="photos single"><label class="photo-box ${acc.foto ? 'filled' : ''}" style="aspect-ratio:3/1">
          ${acc.foto ? `<img src="${esc(acc.foto)}" alt=""><span class="photo-tag">Cambiar comprobante</span>` : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>Foto o captura del pago</span>`}
          <input type="file" accept="image/*" id="aComprobante" aria-label="Comprobante"></label></div></div>
        ${acc.tipo === 'convertir' ? `<div class="field" id="campoFecha"><label class="field-label" for="aFecha">Fecha de entrega</label>
          <input class="input" id="aFecha" type="date" min="${AV.iso(new Date())}" value="${esc(acc.fecha)}">
          <div class="field-hint">20 días hábiles desde hoy, sin sábados ni domingos. La puedes cambiar.</div>
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
    if(acc.tipo === 'convertir' && m > 0 && m < v.total * 0.5) html += `<div class="aviso-50">${ICON_ALERTA}Abono menor al 50%</div>`;
    if(m > 0 && m <= tope) html += `<div class="resta-t">${acc.tipo === 'convertir' ? 'Resta por pagar' : 'Después de este abono resta'}: <b>${dinero(Math.round((tope - m) * 100) / 100)}</b></div>`;
    $('avisoMonto').innerHTML = html;
    $('errMonto').textContent = m > tope ? 'Es mayor que lo que falta por pagar' : 'Escribe el monto';
    $('campoMonto').classList.toggle('invalid', m > tope);
  }
  $('accionBody').addEventListener('input', (e) => {
    if(e.target.id === 'aMonto'){ acc.monto = e.target.value; avisoMonto(); }
    if(e.target.id === 'aMotivo') acc.motivo = e.target.value;
    if(e.target.id === 'aFecha'){ acc.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
  });
  $('accionBody').addEventListener('change', async (e) => {
    if(e.target.id === 'aFecha'){ acc.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
    if(e.target.id === 'aComprobante' && e.target.files[0]){
      try{
        acc.blob = await comprimirFoto(e.target.files[0], 1600, 0.8);
        acc.foto = URL.createObjectURL(acc.blob);
        const sc = $('accionBody').scrollTop; pintarAccion(); $('accionBody').scrollTop = sc;
      } catch(err){ toast('No se pudo leer la foto', 'error'); }
    }
  });
  $('accionBody').addEventListener('click', (e) => {
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

  $('btnAccion').addEventListener('click', async () => {
    if(!acc || acc.guardando) return;
    const v = actual;
    const btn = $('btnAccion');
    let primero = null;
    const marcar = (id, mal) => { const el = $(id); if(!el) return; el.classList.toggle('invalid', mal); if(mal && !primero) primero = el; };
    const pag = AV.pagado(v.abonos);
    if(acc.tipo === 'cancelar'){
      if(pag > 0) marcar('campoMetodo', !acc.metodo);
    } else {
      const tope = acc.tipo === 'convertir' ? Number(v.total) : AV.resta(v);
      const m = numOrNull(acc.monto) || 0;
      marcar('campoMonto', !(m > 0) || m > tope);
      marcar('campoMetodo', !acc.metodo);
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
        const a = { monto: Math.round((numOrNull(acc.monto) || 0) * 100) / 100, metodo: acc.metodo, comprobante, clave: acc.clave };
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
        toast(acc.tipo === 'abono' ? 'Abono guardado' : (AV.esCotizacion(v) ? 'Cotización descartada' : 'Venta cancelada'));
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
    return id ? +id : null;
  }
  window.addEventListener('pageshow', async (e) => {
    if(!e.persisted) return;
    await cargar();
    const id = fichaPendiente();
    if(id) abrirFicha(id); else recargarFicha();
  });

  (async function(){
    await cargar();
    const id = fichaPendiente();
    if(id) abrirFicha(id);
  })();
})();
