// Nómina: cada trabajador con lo que se le debe esta semana (lunes a sábado, se paga el
// sábado), sus vales y el historial de pagos. Lo ven los administradores; solo Ray
// (quien confirma pagos) marca "Pagado", aprueba los vales que piden y anota vales.
// Todo lo calcula el servidor.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, heroZoom, verFoto, etiquetaOtroColor } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const ESPECIALIDAD = { herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Aluminio', carpintero:'Carpintero' };
  const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const CHEV_ABAJO = '<svg class="ac-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  let resumen = null;       // nomina_semana()
  let ficha = null;         // nomina_trabajador() del trabajador abierto
  let tab = 'semana';
  let items = {};           // id → trabajo (para abrir su ficha)
  let pagando = false;
  let resolviendo = false;

  // ---------- Fechas ----------
  const diaDe = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const corta = (d) => d.toLocaleDateString('es-VE', { day:'numeric', month:'short' }).replace('.', '');
  const fechaHora = (ts) => { const d = new Date(ts); return isNaN(d) ? '' : DIAS[d.getDay()] + ' ' + corta(d); };
  function rangoSemana(lunesIso){
    const l = diaDe(lunesIso), s = new Date(l); s.setDate(s.getDate() + 5);
    return (l.getMonth() === s.getMonth() ? l.getDate() : corta(l)) + ' al ' + corta(s);
  }
  const nombreEsp = (l) => (l || []).map(e => ESPECIALIDAD[e] || e).join(', ');
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
  const mensaje = (e) => {
    const m = String((e && e.message) || '');
    if(/fetch|network|Failed/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo';
    if(/invalid input syntax|uuid/i.test(m)) return 'No se encontró ese trabajador';   // enlace mal copiado
    return m || 'Algo salió mal';
  };
  const suma = (l) => Math.round((l || []).reduce((a, x) => a + (Number(x.monto) || 0), 0) * 100) / 100;

  // ---------- Lista ----------
  async function cargar(){
    try{
      const { data, error } = await db.rpc('nomina_semana');
      if(error) throw error;
      resumen = data || { trabajadores:[] };
      $('subtitulo').textContent = resumen.semana ? `${rangoSemana(resumen.semana)} · se paga el sábado` : 'Nómina';
      pintarLista();
    } catch(e){
      $('lista').innerHTML = '<div class="n-vacio">No se pudo cargar. Revisa tu internet y toca actualizar.</div>';
      toast(mensaje(e), 'error');
    }
  }
  function pintarLista(){
    const l = resumen.trabajadores || [];
    if(!l.length){ $('lista').innerHTML = '<div class="n-vacio">No hay trabajadores todavía. Créalos en Usuarios.</div>'; return; }
    $('lista').innerHTML = l.map((t, i) => {
      const neto = Number(t.neto) || 0;
      const partes = [t.trabajos ? (t.trabajos === 1 ? '1 trabajo' : t.trabajos + ' trabajos') : 'Nada esta semana'];
      if(Number(t.vales_monto)) partes.push('vales −' + dinero(t.vales_monto));
      if(t.por_definir) partes.push(t.por_definir === 1 ? '1 sin monto' : t.por_definir + ' sin monto');
      if(t.vale_pendiente != null) partes.push('pide vale ' + dinero(t.vale_pendiente));
      const u = t.ultimo_pago;
      return `<button class="n-card" type="button" data-trab="${esc(t.id)}" style="--i:${i}">
        <div class="n-top"><span class="n-av">${esc(inicial(t.nombre))}</span>
          <span style="min-width:0"><span class="n-nom" style="display:block">${esc(t.nombre)}</span><span class="n-s" style="display:block">${esc(partes.join(' · '))}</span></span>
          <span class="n-monto"><b class="${neto ? '' : 'cero'}">${esc(dinero(neto))}</b>${neto > 0 ? '<span class="n-est">Por pagar</span>' : ''}</span></div>
        <div class="n-ult"><span>Último pago</span><span>${u ? `<b>${esc(dinero(u.monto))}</b> · ${esc(fechaHora(u.pagado_en))}` : 'Todavía ninguno'}</span></div>
      </button>`;
    }).join('');
  }
  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-trab]');
    if(b) abrirTrabajador(b.dataset.trab);
  });

  // ---------- Ficha del trabajador ----------
  async function abrirTrabajador(tid, pestana){
    try{
      const { data, error } = await db.rpc('nomina_trabajador', { tid });
      if(error) throw error;
      ficha = data;
      tab = pestana || 'semana';
      pintarFicha();
      abrirHoja('sheetTrab');
    } catch(e){ toast(mensaje(e), 'error'); }
  }
  function refItem(it){
    return it.interna ? `<b>Exhibición</b>${it.sede ? ' · ' + esc(it.sede) : ''}` : `<b>${esc(it.cliente || 'Cliente')}</b> · N° ${esc(it.venta_id)}`;
  }
  function filaItem(it){
    items[it.id] = it;
    const nota = window.AH.notaPago(it.oficio, it.monto);
    const monto = nota ? `<span class="mov-m gris">${nota}${CHEV}</span>` : it.monto == null ? `<span class="mov-m gris rojo">Por definir${CHEV}</span>` : `<span class="mov-m">${esc(dinero(it.monto))}${CHEV}</span>`;
    return `<button class="mov" type="button" data-item="${it.id}">
      <span class="mov-foto">${it.foto ? window.AH.imgMini(it.foto, "", it.tipo) : iconoTipo(it.tipo, 20)}</span>
      <span style="min-width:0"><span class="mov-t">${esc(it.etapa)} · ${esc(it.producto)}${Number(it.de) > 1 ? ' · ' + esc(it.unidad) + ' de ' + esc(it.de) : it.cantidad > 1 ? ' ×' + esc(it.cantidad) : ''}</span>
      <span class="mov-s">${refItem(it)} · ${esc(fechaHora(it.fecha))}</span></span>${monto}</button>`;
  }
  function filaVale(v, pendiente){
    const bs = v.monto_bs ? ` · dado en Bs ${esc(Number(v.monto_bs).toLocaleString('es-VE'))}${v.tasa ? ' (a ' + esc(Number(v.tasa).toLocaleString('es-VE')) + ')' : ''}` : '';
    return `<div class="mov vale"><span style="min-width:0"><span class="mov-t">Vale${v.nota ? ' · ' + esc(v.nota) : ''}${pendiente ? '<span class="pill-p">Por aprobar</span>' : ''}</span>
      <span class="mov-s">${esc(fechaHora(v.fecha))}${bs}</span></span>
      <span class="mov-m ${pendiente ? 'gris' : 'rojo'}">${pendiente ? esc(dinero(v.monto)) : '−' + esc(dinero(v.monto))}</span></div>`;
  }
  function pintarFicha(){
    const t = ficha.trabajador;
    items = {};
    $('trabNombre').textContent = t.nombre;
    $('trabSub').textContent = nombreEsp(t.especialidades) || 'Sin especialidad';
    $('trabTabs').querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    if(tab === 'historial'){ pintarHistorial(); return; }
    const tr = ficha.trabajos || [], va = ficha.vales || [], px = ficha.proxima || [];
    const tot = suma(tr), tv = suma(va), neto = Math.round((tot - tv) * 100) / 100;
    const sinMonto = tr.filter(x => x.monto == null).length;
    let html = '';
    // El vale que pidió: arriba, con Aprobar / Rechazar (solo Ray)
    const vp = ficha.vale_pendiente;
    if(vp){
      html += `<div class="vp" data-vale="${esc(vp.id)}"><span style="min-width:0"><span class="vp-t">Pide un vale${vp.nota ? ' · ' + esc(vp.nota) : ''}</span>
        <span class="vp-s">${esc(fechaHora(vp.fecha))} · <b>${esc(dinero(vp.monto))}</b></span></span>
        ${ficha.puede_pagar ? '<span class="vp-acc"><button class="vp-no" type="button" data-resolver="no">Rechazar</button><button class="vp-si" type="button" data-resolver="si">Aprobar</button></span>'
          : '<span class="vp-ray">Ray lo decide</span>'}</div>`;
    }
    if(!tr.length && !va.length) html += `<div class="vacio-s">No tiene trabajos terminados esta semana.</div>`;
    if(tr.length) html += '<p class="tit">Trabajos terminados (hasta el sábado)</p>' + tr.map(filaItem).join('');
    if(va.length){
      html += '<p class="tit">Vales (se descuentan)</p>' + va.map(v => filaVale(v, false)).join('');
    }
    if(tr.length || va.length){
      html += `<div class="cuenta">
        <div class="cf"><span>Trabajos</span><b>${esc(dinero(tot))}</b></div>
        ${va.length ? `<div class="cf"><span>Vales</span><b class="rojo">−${esc(dinero(tv))}</b></div>` : ''}
        <div class="ct"><span>A pagar</span><b class="${neto < 0 ? 'rojo' : ''}">${esc(dinero(neto))}</b></div>
        ${sinMonto ? `<p class="aviso-m">${sinMonto === 1 ? '1 trabajo no tiene monto' : sinMonto + ' trabajos no tienen monto'}. Tócalos para resolverlo.</p>` : ''}
        ${neto < 0 ? '<p class="aviso-m">Los vales son más que lo trabajado: quedan para la próxima semana.</p>' : ''}
      </div>`;
    }
    const vpx = ficha.vales_proxima || [];
    if(px.length || vpx.length) html += '<p class="tit">Para la próxima semana (del domingo)</p>' + px.map(filaItem).join('') + vpx.map(v => filaVale(v, false)).join('');
    $('trabBody').innerHTML = html;
    // Pie: solo Ray marca pagado y anota vales
    if(ficha.puede_pagar){
      const puede = (tr.length || va.length) && !sinMonto && neto >= 0;
      $('trabFoot').innerHTML = `<div class="pie-dos">
        <button class="btn-primary" type="button" id="btnPagar" data-neto="${neto}" ${puede ? '' : 'disabled'}>${puede ? 'Marcar pagado ' + esc(dinero(neto)) : sinMonto ? 'Falta el monto de ' + (sinMonto === 1 ? 'un trabajo' : sinMonto + ' trabajos') : neto < 0 ? 'Los vales pasan lo trabajado' : 'Nada por pagar'}</button>
        <button class="btn-secondary" type="button" id="btnAnotarVale">Anotar un vale</button></div>`;
    } else {
      $('trabFoot').innerHTML = '<p class="solo-ray">Solo Ray marca los pagos y aprueba o anota vales.</p>';
    }
  }
  function pintarHistorial(){
    const pagos = ficha.pagos || [];
    $('trabFoot').innerHTML = '';
    if(!pagos.length){ $('trabBody').innerHTML = '<div class="vacio-s">Todavía no tiene pagos registrados.</div>'; return; }
    $('trabBody').innerHTML = pagos.map((p, i) => {
      const n = (p.trabajos || []).length;
      const sub = [p.semana ? rangoSemana(p.semana) : '', n === 1 ? '1 trabajo' : n + ' trabajos', Number(p.vales_monto) ? 'vales −' + dinero(p.vales_monto) : ''].filter(Boolean).join(' · ');
      return `<details class="rec" ${i === 0 ? 'open' : ''}>
        <summary><span style="min-width:0"><span class="rec-t">${esc(fechaHora(p.pagado_en))} · ${esc(dinero(p.monto))}</span><span class="rec-s">${esc(sub)}</span></span>
          <span class="rec-ok">Pagado</span>${CHEV_ABAJO}</summary>
        <div class="rec-body">
          <p class="rec-por">Pagado por ${esc(p.pagado_por || 'Ray')}</p>
          ${(p.trabajos || []).map(filaItem).join('')}${(p.vales || []).map(v => filaVale(v, false)).join('')}
          <div class="cuenta"><div class="cf"><span>Trabajos</span><b>${esc(dinero(p.trabajos_monto))}</b></div>
            ${Number(p.vales_monto) ? `<div class="cf"><span>Vales</span><b class="rojo">−${esc(dinero(p.vales_monto))}</b></div>` : ''}
            <div class="ct"><span>Pagado</span><b>${esc(dinero(p.monto))}</b></div></div>
        </div></details>`;
    }).join('');
  }
  $('trabTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if(!b || b.dataset.tab === tab) return;
    tab = b.dataset.tab; pintarFicha();
  });
  $('trabBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-item]'); if(!b) return;
    const it = items[b.dataset.item]; if(it) abrirItem(it);
  });

  // ---------- Aprobar o rechazar el vale que pidió ----------
  $('trabBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-resolver]'); if(!b || resolviendo || !ficha) return;
    const fila = b.closest('[data-vale]');
    const aprobar = b.dataset.resolver === 'si';
    const t = ficha.trabajador;
    resolviendo = true;
    fila.querySelectorAll('button').forEach(x => x.disabled = true);
    try{
      const { error } = await db.rpc('resolver_vale', { vid: Number(fila.dataset.vale), aprobar });
      if(error) throw error;
      toast(aprobar ? `Vale aprobado. Se descuenta en el próximo pago de ${t.nombre}.` : 'Vale rechazado. Le avisamos.');
      await Promise.all([abrirTrabajador(t.id, 'semana'), cargar()]);
    } catch(err){
      toast(mensaje(err), 'error');
      await abrirTrabajador(t.id).catch(() => {});
    } finally { resolviendo = false; }
  });

  // Atajo: un trabajo sin monto lleva a donde se arregla (categoría del producto o tarifa de la categoría)
  let categorias = null;   // se cargan la primera vez que hacen falta
  function atajoMontoHtml(it){
    if(it.monto != null || window.AH.notaPago(it.oficio, it.monto) || it.pago_id) return '';   // lo ya pagado no se toca
    const link = (href, t) => `<a class="btn-primary atajo-btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${href}">${t}</a>`;
    if(it.categoria_id) return `<div class="aviso-falta" style="margin:14px 0 0">A la categoría ${esc(it.categoria || '')} le falta la tarifa de este paso.
      ${link('categorias-pago.html?editar=' + esc(it.categoria_id), 'Poner la tarifa')}</div>`;
    let cuerpo;
    if(categorias === 'error') cuerpo = '<button class="btn-secondary atajo-btn" type="button" data-reintentar-cat style="width:100%">No se pudieron cargar. Reintentar</button>';
    else if(categorias === null) cuerpo = '<span class="atajo-t" style="margin-top:8px;font-weight:600">Cargando categorías…</span>';
    else if(!categorias.some(c => window.AH.categoriaSirve(c, it.tipo))) cuerpo = link('categorias-pago.html?nueva=1', 'Crear una categoría');
    else cuerpo = `<div class="atajo-caja"><span class="atajo-t">Elige su categoría. Se calcula el monto enseguida.</span>
      <div class="opts" style="--cols:2;margin-top:8px">${categorias.filter(c => window.AH.categoriaSirve(c, it.tipo)).map(c => `<button type="button" class="opt" data-cat-item="${esc(it.venta_item_id)}" data-trabajo="${esc(it.id)}" data-cid="${c.id}">${esc(c.nombre)}</button>`).join('')}</div></div>`;
    return `<div class="aviso-falta" style="margin:14px 0 0">Este producto no tiene categoría de pago: por eso no tiene monto.${cuerpo}</div>`;
  }
  async function cargarCategorias(it){
    try{
      const { data, error } = await db.from('categorias_pago').select('id,nombre,producto').order('id');
      if(error) throw error;
      categorias = data || [];   // se filtran por el tipo del producto al mostrarlas
    } catch(e){ categorias = 'error'; toast(mensaje(e), 'error'); }
    if($('sheetItem').classList.contains('open') && itemAbierto === it) abrirItem(it, true);
  }
  let itemAbierto = null, asignando = false;

  // ---------- Ficha de un trabajo ----------
  function abrirItem(it, repintar){
    itemAbierto = it;
    if(it.monto == null && !window.AH.notaPago(it.oficio, it.monto) && !it.pago_id && !it.categoria_id && (categorias === null || categorias === 'error') && !repintar){ categorias = null; cargarCategorias(it); }
    const e = it.especificaciones || {};
    const specs = resumenSpecs(it.tipo, e);
    $('itemBody').innerHTML = `
      <div ${heroAttrs(it.foto)}>${it.foto ? `<img src="${esc(it.foto)}" alt="${esc(it.producto)}">` : iconoTipo(it.tipo, 56)}${(() => { const lb = etiquetaOtroColor({ otroColor: !!(it.foto && it.foto_de && e.color && it.foto_de !== e.color), de: it.foto_de, color: e.color }, it.tipo); return lb ? `<span class="foto-otra">${esc(lb)}</span>` : ''; })()}${heroZoom(it.foto)}</div>
      <div class="d-parte">${esc(it.etapa)} · terminó ${esc(fechaHora(it.fecha))}</div>
      <div class="det-name" style="margin-top:10px">${esc(it.producto)}${Number(it.de) > 1 ? ' · ' + esc(it.unidad) + ' de ' + esc(it.de) : it.cantidad > 1 ? ' ×' + esc(it.cantidad) : ''}</div>
      <div class="det-type">${esc([it.tipo, e.color].filter(Boolean).join(' · '))}</div>
      ${atajoMontoHtml(it)}
      <div class="d-datos">
        <div class="d-dato"><span>${it.interna ? 'Para' : 'Cliente'}</span><b>${esc(it.interna ? 'Exhibición' : (it.cliente || ''))}</b></div>
        <div class="d-dato"><span>${it.interna ? 'Sede' : 'Pedido'}</span><b>${esc(it.interna ? (it.sede || '') : 'N° ' + it.venta_id)}</b></div>
        <div class="d-dato"><span>Pago por esta parte</span><b>${window.AH.notaPago(it.oficio, it.monto) ? window.AH.notaPago(it.oficio, it.monto) : it.monto == null ? 'Por definir' : esc(dinero(it.monto))}</b></div>
        <div class="d-dato"><span>Categoría</span><b>${esc(it.categoria || 'Sin categoría')}</b></div>
      </div>
      ${specs.length ? `<div class="det-section"><div class="det-label">Especificaciones</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>` : ''}
      ${it.foto_trabajo ? `<div class="d-suya"><button type="button" data-ver-foto="${esc(it.foto_trabajo)}" aria-label="Ver foto">${window.AH.imgMini(it.foto_trabajo)}</button>Foto que subió al terminar. Tócala para verla grande.</div>` : ''}
      ${it.interna ? '' : `<a class="d-link" href="ventas.html?abrir=${esc(it.venta_id)}">Ver la venta N° ${esc(it.venta_id)}</a>`}`;
    const body = $('itemBody'); if(body && !repintar) body.scrollTop = 0;
    if(!repintar) abrirHoja('sheetItem');
  }
  $('itemBody').addEventListener('click', async (e) => {
    if(e.target.closest('[data-reintentar-cat]') && itemAbierto){ categorias = null; abrirItem(itemAbierto, true); cargarCategorias(itemAbierto); return; }
    const c = e.target.closest('[data-cat-item]');
    if(c && !asignando && ficha){
      asignando = true;
      c.closest('.opts').querySelectorAll('button').forEach(x => x.disabled = true);
      try{
        const { error } = await db.rpc('asignar_categoria_item', { iid: Number(c.dataset.catItem), cid: Number(c.dataset.cid) });
        if(error) throw error;
        cerrarHoja('sheetItem', true);
        const idTrab = Number(c.dataset.trabajo);
        await Promise.all([abrirTrabajador(ficha.trabajador.id, tab), cargar()]);
        const nuevo = ficha && [...(ficha.trabajos || []), ...(ficha.proxima || [])].find(x => x.id === idTrab);
        toast(nuevo && nuevo.monto == null ? 'Categoría puesta. A esa categoría le falta la tarifa de este paso: tócalo otra vez para ponerla.' : 'Categoría puesta. Ya tiene su monto.');
      } catch(err){ toast(mensaje(err), 'error'); c.closest('.opts').querySelectorAll('button').forEach(x => x.disabled = false); }
      finally { asignando = false; }
      return;
    }
    const b = e.target.closest('[data-ver-foto]');
    if(b) verFoto(b.dataset.verFoto);
  });

  // ---------- Marcar pagado ----------
  $('trabFoot').addEventListener('click', async (e) => {
    if(e.target.closest('#btnAnotarVale')){ abrirVale(); return; }
    const b = e.target.closest('#btnPagar');
    if(!b || b.disabled || pagando) return;
    const neto = Number(b.dataset.neto);
    const t = ficha.trabajador;
    if(!confirm(`¿Marcar pagado ${dinero(neto)} a ${t.nombre}? Queda en su historial y le llega el aviso.`)) return;
    pagando = true; b.disabled = true;
    try{
      const { error } = await db.rpc('pagar_trabajador', { tid: t.id, esperado: neto });
      if(error) throw error;
      toast(`Pagado. Le avisamos a ${t.nombre}.`);
      await Promise.all([abrirTrabajador(t.id, 'historial'), cargar()]);
    } catch(err){
      toast(mensaje(err), 'error');
      await abrirTrabajador(t.id).catch(() => {});
    } finally { pagando = false; }
  });

  // ---------- Anotar vale ----------
  let enBs = false, guardandoVale = false;
  function abrirVale(){
    ['valeMonto', 'valeNota', 'valeBs', 'valeTasa'].forEach(id => { $(id).value = ''; });
    ['campoValeMonto'].forEach(id => $(id).classList.remove('invalid'));
    enBs = false; pintarBs();
    abrirHoja('sheetVale');
  }
  function pintarBs(){
    $('btnValeBs').classList.toggle('on', enBs);
    $('btnValeBs').setAttribute('aria-pressed', String(enBs));
    $('cajaBs').classList.toggle('hidden', !enBs);
    $('valeAyuda').textContent = enBs ? 'Escribe los bolívares y la tasa: el monto en dólares se calcula solo (puedes cambiarlo).' : 'Queda aprobado y se descuenta en su próximo pago.';
  }
  $('btnValeBs').addEventListener('click', () => { enBs = !enBs; pintarBs(); });
  function calcularDolares(){
    const bs = montoOrNull($('valeBs').value), tasa = montoOrNull($('valeTasa').value);
    if(bs > 0 && tasa > 0){ $('valeMonto').value = String(Math.round(bs / tasa * 100) / 100); $('campoValeMonto').classList.remove('invalid'); }
  }
  $('valeBs').addEventListener('input', calcularDolares);
  $('valeTasa').addEventListener('input', calcularDolares);
  $('valeMonto').addEventListener('input', () => $('campoValeMonto').classList.remove('invalid'));
  $('btnGuardarVale').addEventListener('click', async () => {
    if(guardandoVale || !ficha) return;
    const monto = montoOrNull($('valeMonto').value);
    if(!(monto > 0)){ $('campoValeMonto').classList.add('invalid'); $('valeMonto').focus(); return; }
    const bs = enBs ? montoOrNull($('valeBs').value) : null;
    const tasa = enBs ? montoOrNull($('valeTasa').value) : null;
    const btn = $('btnGuardarVale');
    guardandoVale = true; btn.disabled = true;
    try{
      const { error } = await db.rpc('anotar_vale', { tid: ficha.trabajador.id, p_monto: monto, p_nota: $('valeNota').value.trim() || null, p_bs: bs > 0 ? bs : null, p_tasa: tasa > 0 ? tasa : null });
      if(error) throw error;
      cerrarHoja('sheetVale', true);
      toast('Vale anotado. Se descuenta en su próximo pago.');
      await Promise.all([abrirTrabajador(ficha.trabajador.id, 'semana'), cargar()]);
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { guardandoVale = false; btn.disabled = false; }
  });

  $('btnActualizar').addEventListener('click', cargar);

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin'){ location.replace('index.html'); return; }
    await cargar();
    // nomina.html?t=ID (desde el aviso "Vale pedido" o el pendiente) abre a ese trabajador
    const q = new URLSearchParams(location.search);
    const abrir = q.get('t') || q.get('trabajador');
    if(abrir && /^[\w-]{1,64}$/.test(abrir)) abrirTrabajador(abrir);
  })();
})();
