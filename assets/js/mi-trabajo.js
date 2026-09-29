// Inicio del trabajador (sus trabajos y sus pagos) y vales por aprobar del administrador.
// El trabajador ve solo lo suyo: lo que tiene asignado, lo que ha ganado y sus vales.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, heroZoom, SW_COLOR } = window.AH;
  const $ = (id) => document.getElementById(id);

  const ICON_CANDADO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const icoP = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_LLAVE_P = icoP('<path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17v3h3l5.3-5.3"/>');
  const ICON_DINERO_P = icoP('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>');
  const ICON_VALE_P = icoP('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');
  const ICON_HIST_P = icoP('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>');
  const CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_CAMARA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/></svg>';

  function fechaCorta(iso){
    if(!iso) return '';
    const d = new Date(String(iso).length <= 10 ? iso + 'T00:00' : iso);
    return isNaN(d) ? '' : d.toLocaleDateString('es-VE', { day:'numeric', month:'short' }).replace('.', '');
  }
  const refPedido = (t) => t.interna ? 'Exhibición' : 'N° ' + t.venta_id;

  // ===========================================================================
  // Trabajador
  // ===========================================================================
  let trabajos = [];
  let pagos = null;
  let perfil = null;
  let tabPagos = 'cobrar';
  let detalleId = null;
  const activo = () => trabajos.find(t => t.iniciada_en) || null;
  const suma = (l) => Math.round((l || []).reduce((a, x) => a + (Number(x.monto) || 0), 0) * 100) / 100;
  // Lo que se cobra este sábado (lo del domingo queda para la próxima semana)
  const deEstePago = (l) => (l || []).filter(x => !(pagos && pagos.semana_pago && x.semana && x.semana > pagos.semana_pago));
  const ganado = () => suma(deEstePago(pagos && pagos.trabajos));
  const valesTotal = () => suma(deEstePago(pagos && pagos.vales));
  const porCobrar = () => Math.round((ganado() - valesTotal()) * 100) / 100;
  // El que le toca: el primero que no espera a nadie (vienen ordenados por fecha de entrega)
  const sugerido = () => trabajos.find(t => !t.espera) || null;

  async function cargarTrabajador(){
    const [rt, rp] = await Promise.all([db.rpc('mis_trabajos'), db.rpc('mis_pagos')]);
    if(rt.error || rp.error) throw (rt.error || rp.error);
    trabajos = rt.data || [];
    pagos = rp.data || {};
  }

  const fotoHtml = (t, size) => t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}" loading="lazy">` : iconoTipo(t.tipo, size);
  // El color va primero: la foto puede ser de otro color si el modelo no tiene la de ese
  const specsDe = (t) => {
    const e = t.especificaciones || {};
    const c = e.color || t.color;
    return (c ? [{ t:'Color ' + String(c).toLowerCase(), sw:SW_COLOR[c] }] : []).concat(resumenSpecs(t.tipo, e));
  };
  function subTrabajo(t){
    return t.interna ? 'Para exhibición' : refPedido(t) + (t.fecha_entrega ? ' · entrega ' + fechaCorta(t.fecha_entrega) : '');
  }

  // Tarjeta grande de "Hoy": lo que está haciendo, o el que le toca empezar
  function hoyHtml(){
    const a = activo();
    const t = a || sugerido();
    if(!trabajos.length){
      return `<h2 class="hoy-tit">¿Qué vas a hacer hoy?</h2>
        <div class="hoy"><div class="hoy-vacio"><b>No tienes trabajos asignados</b><span>Te avisamos cuando Ray te asigne uno.</span></div></div>`;
    }
    if(!t){
      return `<h2 class="hoy-tit">¿Qué vas a hacer hoy?</h2>
        <div class="hoy"><div class="hoy-vacio"><b>Tus trabajos esperan a otro</b><span>Cuando terminen su parte, te toca a ti. Te avisamos.</span></div></div>`;
    }
    const chips = specsDe(t).slice(0, 4);
    return `<h2 class="hoy-tit">${a ? 'Hoy estás haciendo' : '¿Qué vas a hacer hoy?'}</h2>
      <div class="hoy ${a ? 'activo' : ''}">
        <button class="hoy-foto" type="button" data-detalle="${t.id}" aria-label="Ver foto y detalles">
          ${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}">` : `<span class="sin">${iconoTipo(t.tipo, 56)}</span>`}
          ${a ? '<span class="hoy-en">En curso</span>' : ''}
          <span class="ver">Ver detalles</span>
        </button>
        <div class="hoy-txt">
          <div class="hoy-etapa">${a ? 'Tu parte: ' : 'Te toca: '}${esc(t.nombre)}</div>
          <div class="hoy-nom">${esc(t.producto)}</div>
          <div class="hoy-sub">${esc([t.cantidad > 1 ? t.cantidad + ' unidades' : '', subTrabajo(t)].filter(Boolean).join(' · '))}</div>
          ${chips.length ? `<div class="spec-chips">${specChipsHtml(chips)}</div>` : ''}
        </div>
        <div class="hoy-acc">${a
          ? `<button class="btn-primary" type="button" data-terminar-t="${a.id}">Marcar terminado</button>`
          : `<button class="btn-primary" type="button" data-empezar="${t.id}">Empezar este</button>`}</div>
      </div>`;
  }

  // Filas largas con flecha (como en el Inicio del administrador)
  function filasHtml(){
    const n = trabajos.length;
    const vp = pagos && pagos.vale_pendiente;
    const filas = [];
    let i = 0;
    if(n) filas.push(`<button class="pend-fila naranja" type="button" data-ver="trabajos" style="--i:${i++}">
      <span class="pend-ico">${ICON_LLAVE_P}</span><span class="pend-t">${n === 1 ? '1 trabajo por hacer' : n + ' trabajos por hacer'}</span>${CHEV}</button>`);
    const pc = porCobrar();
    filas.push(`<button class="pend-fila verde" type="button" data-ver="pagos" style="--i:${i++}">
      <span class="pend-ico">${ICON_DINERO_P}</span><span class="pend-t">${pc < 0 ? 'Vales por descontar' : 'Te toca cobrar'} <span>· ${esc(dinero(Math.abs(pc)))}</span></span>${CHEV}</button>`);
    if(vp) filas.push(`<div class="pend-fila amarillo" style="--i:${i++}">
      <span class="pend-ico">${ICON_VALE_P}</span><span class="pend-t">Vale de ${esc(dinero(vp.monto))} <span>· esperando respuesta</span></span></div>`);
    filas.push(`<button class="pend-fila teal" type="button" data-ver="historial" style="--i:${i++}">
      <span class="pend-ico">${ICON_HIST_P}</span><span class="pend-t">Historial de pagos <span>· por semana</span></span>${CHEV}</button>`);
    return `<div class="pend-lista">${filas.join('')}</div>`;
  }

  function pintarInicioTrabajador(){
    $('vistaTrabajo').innerHTML = hoyHtml() + filasHtml();
  }
  function pintarCargando(){
    $('vistaTrabajo').innerHTML = '<div class="sk-linea" style="width:220px;height:26px;margin:6px 2px 14px"></div><div class="sk-hoy"></div>';
  }

  // ---------- Lista de trabajos ----------
  function trabajoHtml(t){
    const a = activo();
    const esActivo = a && a.id === t.id;
    const det = [t.cantidad > 1 ? t.cantidad + ' unidades' : '', subTrabajo(t)].filter(Boolean).join(' · ');
    const estado = esActivo ? '<span class="tr-estado curso">En curso</span>'
      : t.espera ? `<span class="tr-estado bloq">${ICON_CANDADO}Espera que terminen ${esc(t.espera)}</span>`
      : a ? `<span class="tr-estado bloq">${ICON_CANDADO}Después del que tienes en curso</span>`
      : t.monto != null ? `<span class="tr-estado">Ganas ${esc(dinero(t.monto))}</span>` : '';
    // Con uno en curso, los demás se ven en gris (se pueden abrir para ver su foto)
    const gris = !esActivo && (a || t.espera);
    return `<button class="tr ${esActivo ? 'activo' : ''} ${gris ? 'gris' : ''}" type="button" data-detalle="${t.id}">
      <span class="tr-foto">${fotoHtml(t, 24)}</span>
      <span style="min-width:0">
        <span class="tr-etapa" style="display:block">${esc(t.nombre)}</span>
        <span class="tr-nom" style="display:block">${esc(t.producto)}</span>
        <span class="tr-det" style="display:block">${esc(det)}</span>
        ${estado}
      </span>${CHEV}
    </button>`;
  }
  function pintarTrabajos(){
    $('trabajosAyuda').classList.toggle('hidden', !trabajos.length);
    $('trabajosAyuda').textContent = activo() ? 'Tienes uno en curso. Los demás quedan en espera hasta que lo termines.' : 'Toca uno para ver su foto y sus detalles.';
    $('listaTrabajos').innerHTML = trabajos.length
      ? trabajos.map(trabajoHtml).join('')
      : '<div class="tr-vacio">No tienes trabajos pendientes. Te avisamos cuando te asignen uno.</div>';
  }

  // ---------- Detalle: foto grande, modelo y especificaciones ----------
  function pintarDetalle(){
    const t = trabajos.find(x => x.id === detalleId);
    if(!t){ cerrarHoja('sheetTrabajo'); return; }
    const a = activo();
    const esActivo = a && a.id === t.id;
    const specs = specsDe(t);
    const e = t.especificaciones || {};
    const tipoColor = [t.tipo, e.color].filter(Boolean).join(' · ');
    $('trabajoBody').innerHTML = `
      <div ${heroAttrs(t.foto)}>${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}">` : iconoTipo(t.tipo, 56)}${heroZoom(t.foto)}</div>
      <div class="tj-parte">Tu parte: ${esc(t.nombre)}${esActivo ? ' · en curso' : ''}</div>
      <div class="det-name" style="margin-top:10px">${esc(t.producto)}</div>
      <div class="det-type">${esc(tipoColor)}</div>
      <div class="tj-datos">
        ${t.cantidad > 1 ? `<span><b>${t.cantidad}</b> unidades</span>` : ''}
        <span>${t.interna ? '<b>Para exhibición</b>' : `<b>${esc(refPedido(t))}</b>${t.fecha_entrega ? ' · entrega ' + esc(fechaCorta(t.fecha_entrega)) : ''}`}</span>
        ${t.monto != null ? `<span>Ganas <b>${esc(dinero(t.monto))}</b></span>` : ''}
      </div>
      ${specs.length ? `<div class="det-section"><div class="det-label">Especificaciones</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>` : ''}`;
    let pie;
    if(esActivo){
      pie = `<div class="det-foot"><button class="btn-secondary" type="button" data-pausar="${t.id}">Dejar para después</button><button class="btn-primary" type="button" data-terminar-t="${t.id}">Marcar terminado</button></div>`;
    } else if(t.espera){
      pie = `<div class="tj-bloq">${ICON_CANDADO}Espera que terminen ${esc(t.espera)}</div>`;
    } else if(a){
      pie = `<div class="tj-bloq">${ICON_CANDADO}Primero termina el que empezaste</div>`;
    } else {
      pie = `<button class="btn-primary" type="button" data-empezar="${t.id}" style="width:100%">Empezar este</button>`;
    }
    $('trabajoFoot').innerHTML = pie;
  }
  function abrirDetalle(id){
    if(!trabajos.some(x => x.id === id)) return;
    detalleId = id;
    pintarDetalle();
    const body = $('trabajoBody');
    if(body) body.scrollTop = 0;
    abrirHoja('sheetTrabajo');
  }

  // ---------- Mis pagos ----------
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  function diaCorto(iso){
    const d = new Date(iso);
    return isNaN(d) ? '' : DIAS[d.getDay()] + ' ' + fechaCorta(iso);
  }
  const isoDia = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // Semanas de lunes a sábado: el servidor dice a qué semana va cada cosa (el domingo
  // cuenta para la siguiente) y cuál es la semana de hoy
  function nombreSemana(lunesIso){
    const actual = (pagos && pagos.semana_actual) || '';
    if(lunesIso === actual) return 'Esta semana';
    if(actual){
      const l = new Date(actual + 'T00:00'); l.setDate(l.getDate() - 7);
      if(lunesIso === isoDia(l)) return 'Semana pasada';
    }
    return 'Semana del ' + fechaCorta(lunesIso);
  }
  function rangoSemana(lunesIso){
    const l = new Date(lunesIso + 'T00:00');
    const sab = new Date(l); sab.setDate(sab.getDate() + 5);
    const mismoMes = l.getMonth() === sab.getMonth();
    return (mismoMes ? l.getDate() : fechaCorta(lunesIso)) + ' al ' + fechaCorta(isoDia(sab));
  }
  const refDe = (m) => m.interna ? 'Exhibición' : 'N° ' + m.venta_id;
  function filaTrabajo(m){
    const monto = m.monto == null ? '<span class="pg-mov-m gris">Por definir</span>' : `<span class="pg-mov-m">${esc(dinero(m.monto))}</span>`;
    return `<div class="pg-mov"><span style="min-width:0"><span class="pg-mov-t">${esc(m.etapa)} · ${esc(m.producto)}</span>
      <span class="pg-mov-s">${esc([diaCorto(m.fecha), refDe(m)].filter(Boolean).join(' · '))}</span></span>${monto}</div>`;
  }
  function filaVale(v, pendiente){
    const bs = v.monto_bs ? 'dado en Bs ' + Number(v.monto_bs).toLocaleString('es-VE') : '';
    return `<div class="pg-mov vale"><span style="min-width:0"><span class="pg-mov-t">Vale${pendiente ? '<span class="pg-pill">Por aprobar</span>' : ''}</span>
      <span class="pg-mov-s">${esc([diaCorto(v.fecha), v.nota, bs].filter(Boolean).join(' · '))}</span></span>
      <span class="pg-mov-m ${pendiente ? 'gris' : 'rojo'}">${pendiente ? esc(dinero(v.monto)) : '−' + esc(dinero(v.monto))}</span></div>`;
  }

  function pintarPorCobrar(){
    const p = pagos || {};
    // Lo de después del sábado (el domingo) va para el pago de la próxima semana
    const sp = p.semana_pago || '';
    const esProx = (x) => sp && x.semana && x.semana > sp;
    const tr = (p.trabajos || []).filter(x => !esProx(x));
    const va = (p.vales || []).filter(x => !esProx(x));
    const trProx = (p.trabajos || []).filter(esProx), vaProx = (p.vales || []).filter(esProx);
    const vp = p.vale_pendiente;
    // Trabajos sin cobrar, por semana (lo más nuevo arriba)
    const grupos = [];
    tr.forEach(m => {
      const k = m.semana || '';
      let g = grupos.find(x => x.k === k);
      if(!g){ g = { k, l:[] }; grupos.push(g); }
      g.l.push(m);
    });
    const porDefinir = tr.filter(m => m.monto == null).length;
    let html = '';
    if(!tr.length && !va.length && !vp){
      html += '<div class="tr-vacio">Aquí verás cada trabajo que termines y lo que te toca cobrar.</div>';
    }
    grupos.forEach(g => {
      html += `<p class="pg-tit">${esc(nombreSemana(g.k))}</p>` + g.l.map(filaTrabajo).join('');
    });
    if(va.length || vp){
      html += '<p class="pg-tit">Vales</p>' + (vp ? filaVale(vp, true) : '') + va.map(v => filaVale(v, false)).join('');
    }
    if(tr.length || va.length){
      html += `<div class="pg-cuenta">
        <div class="pg-cuenta-fila"><span>Trabajos</span><b>${esc(dinero(ganado()))}</b></div>
        ${va.length ? `<div class="pg-cuenta-fila"><span>Vales</span><b class="rojo">−${esc(dinero(valesTotal()))}</b></div>` : ''}
        ${porCobrar() < 0
          ? `<div class="pg-cuenta-total"><span>Vales por descontar</span><b class="rojo">${esc(dinero(-porCobrar()))}</b></div>`
          : `<div class="pg-cuenta-total"><span>Te toca cobrar</span><b>${esc(dinero(porCobrar()))}</b></div>`}
        ${porDefinir ? `<div class="pg-aviso">${porDefinir === 1 ? '1 trabajo todavía no tiene monto' : porDefinir + ' trabajos todavía no tienen monto'}. Ray lo completa.</div>` : ''}
      </div>`;
    }
    if(trProx.length || vaProx.length) html += '<p class="pg-tit">Para la próxima semana</p>' + trProx.map(filaTrabajo).join('') + vaProx.map(v => filaVale(v, false)).join('');
    html += vp ? '' : '<button class="btn-secondary" type="button" id="btnAbrirVale" style="width:100%;margin-top:14px">Pedir un vale</button>';
    return html;
  }

  // Historial: cada pago que le hizo Ray (recibo): qué trabajos, qué vales y cuánto
  function pintarHistorial(){
    const pg = (pagos && pagos.pagos) || [];
    if(!pg.length) return '<div class="tr-vacio">Todavía no tienes pagos. Cuando Ray te pague, aquí verás el recibo de cada semana.</div>';
    return pg.map((p, i) => {
      const tr = p.trabajos || [], va = p.vales || [];
      const sub = esc([p.semana ? rangoSemana(p.semana) : '', tr.length === 1 ? '1 trabajo' : tr.length + ' trabajos'].filter(Boolean).join(' · '))
        + (Number(p.vales_monto) ? ` · <span style="white-space:nowrap">vales −${esc(dinero(p.vales_monto))}</span>` : '');
      return `<details class="pg-sem" ${i === 0 ? 'open' : ''}>
        <summary>
          <span style="min-width:0"><span class="pg-sem-t">${esc(diaCorto(p.pagado_en))}</span><span class="pg-sem-s">${sub}</span></span>
          <span class="pg-sem-m"><b>${esc(dinero(p.monto))}</b><span class="pg-est pagado">Pagado</span></span>
          <svg class="ac-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        <div class="pg-sem-body">${tr.map(filaTrabajo).join('')}${va.map(x => filaVale(x, false)).join('')}
          <div class="pg-cuenta" style="margin-bottom:6px"><div class="pg-cuenta-fila"><span>Trabajos</span><b>${esc(dinero(p.trabajos_monto))}</b></div>
            ${Number(p.vales_monto) ? `<div class="pg-cuenta-fila"><span>Vales</span><b class="rojo">−${esc(dinero(p.vales_monto))}</b></div>` : ''}
            <div class="pg-cuenta-total"><span>Te pagaron</span><b>${esc(dinero(p.monto))}</b></div>
            <div class="pg-aviso" style="color:var(--ink-soft)">Pagado por ${esc(p.pagado_por || 'Ray')}</div></div>
        </div>
      </details>`;
    }).join('');
  }

  function pintarPagos(){
    $('pagosTabs').querySelectorAll('[data-pg-tab]').forEach(b => b.classList.toggle('active', b.dataset.pgTab === tabPagos));
    $('pagosBody').innerHTML = tabPagos === 'historial' ? pintarHistorial() : pintarPorCobrar();
  }
  $('pagosTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg-tab]'); if(!b || b.dataset.pgTab === tabPagos) return;
    tabPagos = b.dataset.pgTab;
    pintarPagos();
  });

  async function refrescar(){
    try{
      await cargarTrabajador();
      pintarInicioTrabajador();
      if($('sheetTrabajos').classList.contains('open')) pintarTrabajos();
      if($('sheetTrabajo').classList.contains('open')) pintarDetalle();
      if($('sheetPagos').classList.contains('open')) pintarPagos();
    } catch(err){
      toast('No se pudo actualizar: ' + ((err && err.message) || 'revisa tu internet'), 'error');
    }
  }

  function ver(que){
    if(que === 'trabajos'){ pintarTrabajos(); abrirHoja('sheetTrabajos'); }
    if(que === 'pagos' || que === 'historial'){ tabPagos = que === 'historial' ? 'historial' : 'cobrar'; pintarPagos(); abrirHoja('sheetPagos'); }
  }

  // Empezar / dejar para después (desde la tarjeta de Hoy o el detalle)
  async function cambiarTrabajo(b, empezar){
    if(b.disabled) return;
    b.disabled = true;
    try{
      const { error } = await db.rpc(empezar ? 'empezar_etapa' : 'pausar_etapa', { eid: Number(b.dataset.empezar || b.dataset.pausar) });
      if(error) throw error;
      toast(empezar ? 'Listo, a trabajar. Cuando lo termines, márcalo aquí.' : 'Lo dejaste para después');
      if(empezar){ cerrarHoja('sheetTrabajo', true); cerrarHoja('sheetTrabajos', true); }
      await refrescar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      if(document.body.contains(b)) b.disabled = false;
    }
  }
  function clicTrabajo(e){
    const bt = e.target.closest('[data-terminar-t]');
    if(bt){ abrirTerminar(Number(bt.dataset.terminarT)); return true; }
    const be = e.target.closest('[data-empezar]');
    if(be){ cambiarTrabajo(be, true); return true; }
    const bp = e.target.closest('[data-pausar]');
    if(bp){ cambiarTrabajo(bp, false); return true; }
    const bd = e.target.closest('[data-detalle]');
    if(bd){ abrirDetalle(Number(bd.dataset.detalle)); return true; }
    return false;
  }
  $('vistaTrabajo').addEventListener('click', (e) => {
    if(clicTrabajo(e)) return;
    const b = e.target.closest('[data-ver]');
    if(b) ver(b.dataset.ver);
  });
  $('listaTrabajos').addEventListener('click', clicTrabajo);
  $('trabajoFoot').addEventListener('click', clicTrabajo);

  // Marcar terminado (foto opcional)
  let terminarId = null;
  let fotoBlob = null;
  function abrirTerminar(id){
    const t = trabajos.find(x => x.id === id);
    if(!t) return;
    terminarId = id;
    fotoBlob = null;
    $('tFotoInput').value = '';
    $('tFotoPrev').innerHTML = ICON_CAMARA;
    $('terminarTSub').textContent = `${t.nombre} · ${t.producto} · ${refPedido(t)}`;
    abrirHoja('sheetTerminarT');
  }
  $('btnTFoto').addEventListener('click', () => $('tFotoInput').click());
  $('tFotoInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    try{
      fotoBlob = await comprimirFoto(f);
      $('tFotoPrev').innerHTML = `<img src="${URL.createObjectURL(fotoBlob)}" alt="">`;
    } catch(err){ toast('No se pudo procesar la foto', 'error'); }
  });
  $('btnTConfirmar').addEventListener('click', async () => {
    if(!terminarId) return;
    const btn = $('btnTConfirmar');
    if(btn.disabled) return;
    btn.disabled = true;
    try{
      let fotoUrl = null;
      if(fotoBlob){
        const path = new Date().toISOString().slice(0, 7) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const { error: errSub } = await db.storage.from('etapas-fotos').upload(path, fotoBlob, { contentType:'image/jpeg' });
        if(errSub) throw errSub;
        fotoUrl = db.storage.from('etapas-fotos').getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await db.rpc('marcar_etapa_terminada', { eid: terminarId, foto_url: fotoUrl });
      if(error) throw error;
      cerrarHoja('sheetTerminarT', true);
      cerrarHoja('sheetTrabajo', true);
      terminarId = null;
      toast(data && data.monto != null ? `¡Bien hecho! Sumaste ${dinero(data.monto)}` : '¡Bien hecho! Quedó terminado');
      await refrescar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Vales
  document.addEventListener('click', (e) => {
    if(!e.target.closest('#btnAbrirVale')) return;
    $('valeMonto').value = '';
    $('valeNota').value = '';
    $('campoValeMonto').classList.remove('invalid');
    abrirHoja('sheetVale');
  });
  $('valeMonto').addEventListener('input', () => $('campoValeMonto').classList.remove('invalid'));
  $('btnPedirVale').addEventListener('click', async () => {
    const monto = montoOrNull($('valeMonto').value);
    if(!(monto > 0)){ $('campoValeMonto').classList.add('invalid'); $('valeMonto').focus(); return; }
    const btn = $('btnPedirVale');
    btn.disabled = true;
    try{
      const { error } = await db.rpc('pedir_vale', { p_monto: monto, p_nota: $('valeNota').value.trim() || null });
      if(error) throw error;
      cerrarHoja('sheetVale');
      toast('Vale pedido. Te avisamos cuando lo respondan.');
      await refrescar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  async function iniciarTrabajador(p){
    perfil = p;
    document.body.classList.add('es-trabajador');
    $('vistaTrabajo').classList.remove('hidden');
    pintarCargando();
    try{
      await cargarTrabajador();
      pintarInicioTrabajador();
    } catch(err){
      $('vistaTrabajo').innerHTML = '<div class="aviso-card"><span><span class="aviso-t">No se pudieron cargar tus trabajos</span><span class="aviso-s">Revisa tu internet y vuelve a abrir la app.</span></span></div>';
    }
  }
  function salirTrabajador(){
    perfil = null;
    document.body.classList.remove('es-trabajador');
    $('vistaTrabajo').classList.add('hidden');
    $('vistaTrabajo').innerHTML = '';
  }

  // ===========================================================================
  // Administrador: vales por aprobar
  // ===========================================================================
  let vales = [];
  let alCambiarVales = null;
  async function cargarVales(){
    const { data, error } = await db.from('vales')
      .select('id,monto,nota,creado_en,trabajador:perfiles!vales_trabajador_id_fkey(nombre)')
      .eq('estado', 'pendiente').order('creado_en', { ascending:true });
    if(error) throw error;
    vales = data || [];
    return vales;
  }
  function pintarVales(){
    $('valesBody').innerHTML = vales.length ? vales.map(v => `
      <div class="va" data-vale="${v.id}">
        <span style="min-width:0"><span class="va-t">${esc((v.trabajador || {}).nombre || 'Trabajador')} · ${dinero(v.monto)}</span>
        <span class="va-s">${esc([v.nota, fechaCorta(v.creado_en)].filter(Boolean).join(' · '))}</span></span>
        <span class="va-acc"><button class="va-no" type="button" data-resolver="no">Rechazar</button><button class="va-si" type="button" data-resolver="si">Aprobar</button></span>
      </div>`).join('') : '<div class="tr-vacio">No hay vales por aprobar.</div>';
  }
  async function abrirVales(){
    try{ await cargarVales(); }
    catch(err){ toast('No se pudieron cargar los vales: ' + ((err && err.message) || ''), 'error'); return; }
    pintarVales();
    abrirHoja('sheetVales');
  }
  $('valesBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-resolver]'); if(!b) return;
    const fila = b.closest('[data-vale]');
    const aprobar = b.dataset.resolver === 'si';
    fila.querySelectorAll('button').forEach(x => x.disabled = true);
    try{
      const { error } = await db.rpc('resolver_vale', { vid: Number(fila.dataset.vale), aprobar });
      if(error) throw error;
      toast(aprobar ? 'Vale aprobado. Se le descuenta de lo que tiene por cobrar.' : 'Vale rechazado');
      vales = vales.filter(v => String(v.id) !== fila.dataset.vale);
      pintarVales();
      if(!vales.length) cerrarHoja('sheetVales');
      if(alCambiarVales) alCambiarVales();
    } catch(err){
      toast(err.message, 'error');
      fila.querySelectorAll('button').forEach(x => x.disabled = false);
    }
  });

  // Abrir lo que pide un aviso tocado (index.html?ver=trabajos|pagos|vales)
  function abrirSegunURL(p){
    const que = new URLSearchParams(location.search).get('ver');
    if(!que || !p) return;
    try{ history.replaceState(history.state, '', location.pathname); } catch(e){}
    if(p.rol === 'trabajador' && (que === 'trabajos' || que === 'pagos' || que === 'historial')) ver(que);
    if(p.rol === 'admin' && que === 'vales') abrirVales();
  }

  window.Trabajo = {
    iniciarTrabajador, salirTrabajador, refrescar, abrirSegunURL,
    cargarVales, abrirVales, onValesCambian(fn){ alCambiarVales = fn; },
    esTrabajador: () => !!perfil
  };
})();
