// Inicio del trabajador (sus trabajos y sus pagos) y vales por aprobar del administrador.
// El trabajador ve solo lo suyo: lo que tiene asignado, lo que ha ganado y sus vales.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo } = window.AH;
  const $ = (id) => document.getElementById(id);

  const ICON_LLAVE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 1 1-5.4 5.4L4 17v3h3l5.3-5.3"/></svg>';
  const ICON_DINERO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/></svg>';
  const ICON_CANDADO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
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
  const porCobrar = () => pagos ? Math.round((Number(pagos.ganado || 0) - Number(pagos.vales || 0)) * 100) / 100 : 0;
  const activo = () => trabajos.find(t => t.iniciada_en) || null;

  async function cargarTrabajador(){
    const [rt, rp] = await Promise.all([db.rpc('mis_trabajos'), db.rpc('mis_pagos')]);
    if(rt.error || rp.error) throw (rt.error || rp.error);
    trabajos = rt.data || [];
    pagos = rp.data || {};
  }

  function pintarInicioTrabajador(){
    const cont = $('vistaTrabajo');
    const a = activo();
    const n = trabajos.length;
    cont.innerHTML = `
      ${a ? `<button class="t-activo" type="button" data-ver="trabajos">
        <span class="t-activo-eyebrow">Estás trabajando en</span>
        <span class="t-activo-tit">${esc(a.nombre)} · ${esc(a.producto)}</span>
        <span class="t-activo-sub">${esc(refPedido(a))}${a.fecha_entrega && !a.interna ? ' · entrega ' + esc(fechaCorta(a.fecha_entrega)) : ''}</span>
        <span class="t-activo-btn" data-terminar-t="${a.id}">Marcar terminado</span>
      </button>` : ''}
      <div class="t-tiles">
        <button class="t-tile" type="button" data-ver="trabajos" style="--i:0">
          <span class="ini-ico">${ICON_LLAVE}</span>
          <span><span class="t-num">${n}</span><span class="t-lbl">${n === 1 ? 'Trabajo pendiente' : 'Trabajos pendientes'}</span></span>
        </button>
        <button class="t-tile" type="button" data-ver="pagos" style="--i:1">
          <span class="ini-ico">${ICON_DINERO}</span>
          <span><span class="t-num">${dinero(porCobrar())}</span><span class="t-lbl">Por cobrar</span></span>
        </button>
      </div>`;
  }
  function pintarCargando(){
    $('vistaTrabajo').innerHTML = '<div class="t-tiles"><div class="sk-tile"></div><div class="sk-tile"></div></div>';
  }

  function trabajoHtml(t){
    const a = activo();
    const esActivo = a && a.id === t.id;
    const det = [t.color, t.medidas, t.cantidad > 1 ? t.cantidad + ' unidades' : ''].filter(Boolean).join(' · ');
    const cuando = t.interna ? 'Para exhibición' : refPedido(t) + (t.fecha_entrega ? ' · entrega ' + fechaCorta(t.fecha_entrega) : '');
    const gana = t.monto != null ? `<span class="tr-gana">Ganas ${dinero(t.monto)}</span>` : '<span class="tr-gana"></span>';
    let pie;
    if(esActivo){
      pie = `${gana}<button class="tr-btn sec" type="button" data-pausar="${t.id}">Dejar para después</button><button class="tr-btn" type="button" data-terminar-t="${t.id}">Marcar terminado</button>`;
    } else if(t.espera){
      pie = `${gana}<span class="tr-bloq">${ICON_CANDADO}Espera que terminen ${esc(t.espera)}</span>`;
    } else if(a){
      pie = `${gana}<span class="tr-bloq">${ICON_CANDADO}Primero termina el que empezaste</span>`;
    } else {
      pie = `${gana}<button class="tr-btn" type="button" data-empezar="${t.id}">Empezar este</button>`;
    }
    const bloq = !esActivo && (t.espera || a);
    return `<div class="tr ${esActivo ? 'activo' : ''} ${bloq ? 'bloq' : ''}">
      <div class="tr-cab">
        <div class="tr-foto">${t.foto ? `<img src="${esc(t.foto)}" alt="" loading="lazy">` : iconoTipo(t.tipo, 22)}</div>
        <div style="min-width:0">
          <div class="tr-etapa">${esc(t.nombre)}${esActivo ? ' · en curso' : ''}</div>
          <div class="tr-nom">${esc(t.producto)}</div>
          <div class="tr-det">${esc([det, cuando].filter(Boolean).join(' · '))}</div>
        </div>
      </div>
      <div class="tr-pie">${pie}</div>
    </div>`;
  }
  function pintarTrabajos(){
    $('trabajosAyuda').classList.toggle('hidden', trabajos.length < 2);
    $('listaTrabajos').innerHTML = trabajos.length
      ? trabajos.map(trabajoHtml).join('')
      : '<div class="tr-vacio">No tienes trabajos pendientes. Te avisamos cuando te asignen uno.</div>';
  }

  function pintarPagos(){
    const p = pagos || {};
    const movs = p.movimientos || [];
    const vp = p.vale_pendiente;
    $('pagosBody').innerHTML = `
      <div class="pg-resumen">
        <div class="pg-lbl">Por cobrar</div>
        <div class="pg-total">${dinero(porCobrar())}</div>
        <div class="pg-linea"><span>Ganado <b>${dinero(p.ganado)}</b></span><span>Vales <b>${dinero(p.vales)}</b></span></div>
        ${p.por_definir ? `<div class="pg-aviso">${p.por_definir === 1 ? '1 trabajo terminado todavía no tiene monto' : p.por_definir + ' trabajos terminados todavía no tienen monto'}. El administrador lo completa.</div>` : ''}
      </div>
      ${vp ? `<div class="vale-pend">Vale de ${dinero(vp.monto)} esperando respuesta</div>`
           : '<button class="btn-secondary" type="button" id="btnAbrirVale" style="width:100%">Pedir un vale</button>'}
      <p class="pg-tit">Movimientos</p>
      ${movs.length ? movs.map(m => {
        const vale = m.tipo === 'vale';
        const estado = vale ? `<span class="pg-pill ${m.estado === 'pendiente' ? 'pendiente' : ''}">${m.estado === 'pendiente' ? 'Por aprobar' : m.estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>` : '';
        const monto = m.monto == null ? '<span class="pg-mov-m menos">Por definir</span>'
          : `<span class="pg-mov-m ${vale ? 'menos' : ''}">${vale ? '−' : '+'}${dinero(m.monto)}</span>`;
        return `<div class="pg-mov">
          <span style="min-width:0"><span class="pg-mov-t">${esc(m.titulo)}${estado}</span><span class="pg-mov-s">${esc([m.detalle, fechaCorta(m.fecha)].filter(Boolean).join(' · '))}</span></span>
          ${monto}
        </div>`;
      }).join('') : '<div class="tr-vacio">Aquí verás cada trabajo que termines y cada vale.</div>'}`;
  }

  async function refrescar(){
    try{
      await cargarTrabajador();
      pintarInicioTrabajador();
      if($('sheetTrabajos').classList.contains('open')) pintarTrabajos();
      if($('sheetPagos').classList.contains('open')) pintarPagos();
    } catch(err){
      toast('No se pudo actualizar: ' + ((err && err.message) || 'revisa tu internet'), 'error');
    }
  }

  function ver(que){
    if(que === 'trabajos'){ pintarTrabajos(); abrirHoja('sheetTrabajos'); }
    if(que === 'pagos'){ pintarPagos(); abrirHoja('sheetPagos'); }
  }

  $('vistaTrabajo').addEventListener('click', (e) => {
    const bt = e.target.closest('[data-terminar-t]');
    if(bt){ e.stopPropagation(); abrirTerminar(Number(bt.dataset.terminarT)); return; }
    const b = e.target.closest('[data-ver]');
    if(b) ver(b.dataset.ver);
  });

  $('listaTrabajos').addEventListener('click', async (e) => {
    const be = e.target.closest('[data-empezar]');
    const bp = e.target.closest('[data-pausar]');
    const bt = e.target.closest('[data-terminar-t]');
    if(bt){ abrirTerminar(Number(bt.dataset.terminarT)); return; }
    const b = be || bp;
    if(!b) return;
    b.disabled = true;
    try{
      const { error } = await db.rpc(be ? 'empezar_etapa' : 'pausar_etapa', { eid: Number(b.dataset.empezar || b.dataset.pausar) });
      if(error) throw error;
      toast(be ? 'Listo, a trabajar. Cuando lo termines, márcalo aquí.' : 'Lo dejaste para después');
      await refrescar();
    } catch(err){
      toast(err.message, 'error');
      b.disabled = false;
    }
  });

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
      cerrarHoja('sheetTerminarT');
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
    if(p.rol === 'trabajador' && (que === 'trabajos' || que === 'pagos')) ver(que);
    if(p.rol === 'admin' && que === 'vales') abrirVales();
  }

  window.Trabajo = {
    iniciarTrabajador, salirTrabajador, refrescar, abrirSegunURL,
    cargarVales, abrirVales, onValesCambian(fn){ alCambiarVales = fn; },
    esTrabajador: () => !!perfil
  };
})();
