// Inicio del trabajador: lo que le toca ahora, lo que viene después y sus pagos.
// El trabajador ve solo lo suyo: lo que tiene asignado, lo que ha ganado y sus vales.
// Los vales se aprueban en Nómina (solo Ray); aquí solo se cuentan para el Inicio del administrador.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, heroZoom, SW_COLOR,
          topeTexto, sabadoCorto, medidas } = window.AH;
  const $ = (id) => document.getElementById(id);

  const ICON_CANDADO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const icoP = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_DINERO_P = icoP('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>');
  const CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_CAMARA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
  const MAX_DESPUES = 4;   // en la fila "Después"; si hay más, "Ver todos"

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
  const suma = (l) => Math.round((l || []).reduce((a, x) => a + (Number(x.monto) || 0), 0) * 100) / 100;
  // Lo que se cobra este sábado (lo del domingo queda para la próxima semana)
  const deEstePago = (l) => (l || []).filter(x => !(pagos && pagos.semana_pago && x.semana && x.semana > pagos.semana_pago));
  const ganado = () => suma(deEstePago(pagos && pagos.trabajos));
  const valesTotal = () => suma(deEstePago(pagos && pagos.vales));
  const porCobrar = () => Math.round((ganado() - valesTotal()) * 100) / 100;
  // "Ahora": el primero que no espera a nadie (vienen ordenados por fecha tope y de entrega)
  const ahora = () => trabajos.find(t => !t.espera) || null;

  async function cargarTrabajador(){
    const [rt, rp] = await Promise.all([db.rpc('mis_trabajos'), db.rpc('mis_pagos')]);
    if(rt.error || rp.error) throw (rt.error || rp.error);
    trabajos = rt.data || [];
    pagos = rp.data || {};
  }

  const fotoHtml = (t, size) => t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}" loading="lazy">` : iconoTipo(t.tipo, size);
  // La foto puede ser de otro color si el modelo no tiene la de ese: se dice arriba de la foto
  // En las ventanas o protecciones de un Combo lo que importa es el color de las ventanas
  const fotoInfo = (t) => {
    const cd = colorDe(t);
    const color = cd ? cd.c : null;
    return { de: t.foto_de, color, otroColor: !!(t.foto && t.foto_de && color && t.foto_de !== color) };
  };
  function etiquetaFoto(t){
    const fi = fotoInfo(t);
    if(!fi.otroColor) return '';
    const quien = t.rama === 'ventana' ? 'las ventanas van' : t.rama === 'proteccion' ? 'las protecciones van' : t.tipo === 'Combo' ? 'la puerta va' : 'el tuyo va';
    return `Foto en ${String(fi.de).toLowerCase()} · ${quien} en ${String(fi.color).toUpperCase()}`;
  }
  // Color de lo que hace: las ventanas y sus protecciones de un Combo van en el color de las ventanas
  function colorDe(t){
    const e = t.especificaciones || {};
    const c = (t.rama === 'ventana' || t.rama === 'proteccion') ? (e.ventanas_color || e.color) : (e.color || t.color);
    const quien = t.rama === 'ventana' ? 'Las ventanas van' : t.rama === 'proteccion' ? 'Las protecciones van' : 'Va';
    return c ? { c, t: `${quien} en color ${String(c).toUpperCase()}` } : null;
  }
  const specsDe = (t) => {
    const cd = colorDe(t);
    const pre = t.rama === 'ventana' || t.rama === 'proteccion' ? 'Ventanas ' : 'Color ';
    return (cd ? [{ t:pre + String(cd.c).toLowerCase(), sw:SW_COLOR[cd.c] }] : []).concat(resumenSpecs(t.tipo, t.especificaciones || {}));
  };
  // Todas las especificaciones, en una tabla (nombre arriba, valor abajo)
  function specsTabla(t){
    const e = t.especificaciones || {};
    const f = [];
    const add = (l, v, ancho) => { if(v !== undefined && v !== null && v !== '') f.push({ l, v:String(v), ancho }); };
    const combo = t.tipo === 'Combo';
    if(e.alto && e.ancho) add(combo ? 'Puerta' : 'Medidas', medidas(e));
    if(combo && e.ventanas_alto && e.ventanas_ancho) add('2 ventanas y 2 protecciones', medidas({ alto:e.ventanas_alto, ancho:e.ventanas_ancho }) + ' c/u', true);
    if(combo && e.ventanas_color) add('Color de las ventanas', e.ventanas_color);
    if(e.aluminio) add('Aluminio', e.aluminio);
    if(combo && e.variante) add('Protección en la puerta', e.variante === 'Con protección en puerta' ? 'Sí' : 'No');
    if(e.vidrio_o_farquilla === 'Farquilla') add('Vidrio o farquilla', 'Farquilla');
    else if(e.vidrio_o_farquilla === 'Vidrio') add('Vidrio', e.color_vidrio || 'Sí');
    if(e.papel_ahumado === true) add('Papel ahumado', e.color_ahumado || 'Sí');
    else if(e.papel_ahumado === false) add('Papel ahumado', 'Sin');
    if(e.manillon === true) add('Manillón', e.manillon_tipo || 'Sí');
    else if(e.manillon === false) add('Manillón', 'Sin');
    if(e.cerradura) add('Cerradura', e.cerradura === 'Personalizada' ? (e.cerradura_detalle || 'Personalizada') : e.cerradura);
    if(e.proteccion) add('Protección', 'Sí');
    if(e.proteccion_sentido) add('La protección abre a la', e.proteccion_sentido);
    if(e.marco_decorativo) add(t.tipo === 'Ventana' ? 'Marco en protección' : 'Marco decorativo', 'Sí');
    if(e.mas_hojas) add('Hojas', 'Más de 2');
    if(e.sentido) add('Abre a la', e.sentido);
    if(e.posicion) add(t.tipo === 'Portón' ? 'Instalación' : 'Apertura', e.posicion);
    if(e.bloque) add('Bloque', e.bloque);
    return f.length ? `<div class="tj-specs">${f.map(x => `<div class="${x.ancho ? 'ancho' : ''}"><span>${esc(x.l)}</span>${esc(x.v)}</div>`).join('')}</div>` : '';
  }
  const refPedidoCorto = (t) => t.interna ? 'Para exhibición' : refPedido(t);
  function topeHtml(t, cls){
    if(!t.para_el) return '';
    const tt = topeTexto(t.para_el);
    return `<span class="${cls} ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>`;
  }

  // Arriba: saludo y cuántos trabajos tiene para el sábado
  function leadHtml(){
    const n = trabajos.length;
    if(!n) return '';
    const tarde = trabajos.filter(t => t.para_el && topeTexto(t.para_el).tarde).length;
    const topes = [...new Set(trabajos.map(t => t.para_el).filter(Boolean))].sort();
    let txt = esc(n === 1 ? '1 trabajo' : n + ' trabajos');
    if(tarde) txt += ` · <span class="tarde">${tarde === 1 ? '1 se pasó de su sábado' : tarde + ' se pasaron de su sábado'}</span>`;
    else if(topes.length) txt += ' para el ' + esc(sabadoCorto(topes[0]));
    return `<p class="hoy-lead">${txt}</p>`;
  }

  // Tarjeta "Ahora": lo que le toca, con un solo botón para terminarlo
  function ahoraHtml(){
    if(!trabajos.length){
      return `<div class="hoy"><div class="hoy-vacio"><b>No tienes trabajos asignados</b><span>Te avisamos cuando Ray te asigne uno.</span></div></div>`;
    }
    const t = ahora();
    if(!t){
      return leadHtml() + `<div class="hoy"><div class="hoy-vacio"><b>Tus trabajos esperan a otro</b><span>Cuando terminen su parte, te toca a ti. Te avisamos.</span></div></div>`;
    }
    const etq = etiquetaFoto(t);
    const chips = specsDe(t).slice(0, 3);
    return leadHtml() + `
      <div class="hoy">
        <button class="hoy-foto" type="button" data-detalle="${t.id}" aria-label="Ver todo">
          ${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}">` : `<span class="sin">${iconoTipo(t.tipo, 56)}</span>`}
          ${etq ? `<span class="hoy-badge">${esc(etq)}</span>` : ''}
          <span class="ver">Ver todo</span>
        </button>
        <div class="hoy-txt">
          <div class="hoy-etapa">Ahora: ${esc(t.nombre)}</div>
          <div class="hoy-nom">${esc(t.producto)}</div>
          <div class="hoy-sub">${esc([t.cantidad > 1 ? t.cantidad + ' unidades' : '', refPedidoCorto(t)].filter(Boolean).join(' · '))}${t.para_el ? ' · ' + topeHtml(t, 'hoy-tope') : ''}</div>
          ${chips.length ? `<div class="spec-chips">${specChipsHtml(chips)}</div>` : ''}
        </div>
        <div class="hoy-acc"><button class="btn-primary" type="button" data-terminar-t="${t.id}">Ya lo terminé · tomar foto</button></div>
      </div>`;
  }

  // "Después": los demás trabajos en una fila que se desliza; los que esperan a otro en gris
  function despuesHtml(){
    const a = ahora();
    const resto = trabajos.filter(t => !a || t.id !== a.id);
    if(!resto.length) return '';
    const vistos = resto.length > MAX_DESPUES + 1 ? resto.slice(0, MAX_DESPUES) : resto;
    const mini = (t) => {
      const sub = t.espera ? `<span class="dp-s">Espera ${esc(t.espera.toLowerCase())}</span>`
        : t.para_el ? topeHtml(t, 'dp-s') : `<span class="dp-s">${esc(refPedidoCorto(t))}</span>`;
      return `<button class="dp ${t.espera ? 'gris' : ''}" type="button" data-detalle="${t.id}">
        <span class="dp-foto">${fotoHtml(t, 26)}</span>
        <span class="dp-etapa">${esc(t.nombre)}</span><span class="dp-nom">${esc(t.producto)}</span>${sub}</button>`;
    };
    const mas = resto.length > vistos.length
      ? `<button class="dp dp-mas" type="button" data-ver="trabajos"><span class="dp-foto"><span>Ver todos</span><span>(${trabajos.length})</span></span></button>` : '';
    return `<p class="despues-tit">Después</p><div class="despues">${vistos.map(mini).join('')}${mas}</div>`;
  }

  // Una sola fila de pagos: lo que cobra el sábado (y si tiene un vale esperando)
  function pagosFilaHtml(){
    const pc = porCobrar();
    const vp = pagos && pagos.vale_pendiente;
    const det = (pc < 0 ? 'vales por descontar ' + dinero(-pc) : 'cobras ' + dinero(pc) + ' el sábado') + (vp ? ' · vale esperando' : '');
    return `<div class="pend-lista"><button class="pend-fila verde" type="button" data-ver="pagos" style="--i:0">
      <span class="pend-ico">${ICON_DINERO_P}</span><span class="pend-t">Pagos y vales <span>· ${esc(det)}</span></span>${CHEV}</button></div>`;
  }

  function pintarInicioTrabajador(){
    $('vistaTrabajo').innerHTML = ahoraHtml() + despuesHtml() + pagosFilaHtml();
  }
  function pintarCargando(){
    $('vistaTrabajo').innerHTML = '<div class="sk-linea" style="width:220px;height:26px;margin:6px 2px 14px"></div><div class="sk-hoy"></div>';
  }

  // ---------- Todos los trabajos (desde "Ver todos") ----------
  function trabajoHtml(t){
    const det = [t.cantidad > 1 ? t.cantidad + ' unidades' : '', refPedidoCorto(t)].filter(Boolean).join(' · ');
    const tt = t.para_el ? topeTexto(t.para_el) : null;
    const estado = t.espera ? `<span class="tr-estado bloq">${ICON_CANDADO}Espera que terminen ${esc(t.espera)}</span>`
      : tt ? `<span class="tr-estado" style="${tt.tarde ? 'color:var(--danger)' : ''}">${esc(tt.t)}</span>`
      : t.monto != null ? `<span class="tr-estado">Ganas ${esc(dinero(t.monto))}</span>` : '';
    return `<button class="tr ${t.espera ? 'gris' : ''}" type="button" data-detalle="${t.id}">
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
    $('trabajosAyuda').textContent = 'Toca uno para ver su foto y todos sus detalles.';
    $('listaTrabajos').innerHTML = trabajos.length
      ? trabajos.map(trabajoHtml).join('')
      : '<div class="tr-vacio">No tienes trabajos pendientes. Te avisamos cuando te asignen uno.</div>';
  }

  // ---------- Detalle: foto grande, color, todas las especificaciones y la nota ----------
  function pintarDetalle(){
    const t = trabajos.find(x => x.id === detalleId);
    if(!t){ cerrarHoja('sheetTrabajo'); return; }
    const etq = etiquetaFoto(t);
    const cd = colorDe(t);
    const tt = t.para_el ? topeTexto(t.para_el) : null;
    $('trabajoBody').innerHTML = `
      <div ${heroAttrs(t.foto)}>${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}">` : iconoTipo(t.tipo, 56)}${etq ? `<span class="hoy-badge">${esc(etq)}</span>` : ''}${heroZoom(t.foto)}</div>
      <div><span class="tj-parte">Tu parte: ${esc(t.nombre)}</span>${tt ? `<span class="tj-tope ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>` : ''}</div>
      <div class="det-name" style="margin-top:10px">${esc(t.producto)}</div>
      <div class="det-type">${esc(t.tipo === 'Combo' ? 'Combo · 1 puerta + 2 ventanas + 2 protecciones' : (t.tipo || ''))}</div>
      <div class="tj-datos">
        ${t.cantidad > 1 ? `<span><b>${t.cantidad}</b> unidades</span>` : ''}
        <span>${t.interna ? '<b>Para exhibición</b>' : `<b>${esc(refPedido(t))}</b>${t.fecha_entrega ? ' · entrega al cliente ' + esc(fechaCorta(t.fecha_entrega)) : ''}`}</span>
        ${t.monto != null ? `<span>Ganas <b>${esc(dinero(t.monto))}</b></span>` : ''}
      </div>
      ${cd ? `<div class="tj-color"><span class="sw ${SW_COLOR[cd.c] || ''}"></span>${esc(cd.t)}</div>` : ''}
      ${specsTabla(t)}
      ${t.notas ? `<div class="tj-nota"><b>Nota de la venta:</b> ${esc(t.notas)}</div>` : ''}`;
    $('trabajoFoot').innerHTML = t.espera
      ? `<div class="tj-bloq">${ICON_CANDADO}Espera que terminen ${esc(t.espera)}</div>`
      : `<button class="btn-primary" type="button" data-terminar-t="${t.id}" style="width:100%;white-space:nowrap">Ya lo terminé · tomar foto</button>`;
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

  function clicTrabajo(e){
    const bt = e.target.closest('[data-terminar-t]');
    if(bt){ abrirTerminar(Number(bt.dataset.terminarT)); return true; }
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
    $('terminarTSub').textContent = `${t.nombre} · ${t.producto} · ${refPedidoCorto(t)}`;
    abrirHoja('sheetTerminarT');
    // "Ya lo terminé · tomar foto": abre la cámara de una vez (si la cierra, puede terminar sin foto)
    try{ $('tFotoInput').click(); } catch(e){}
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
  // Administrador: vales por aprobar (se cuentan para Pendientes; se aprueban en Nómina)
  // ===========================================================================
  async function cargarVales(){
    const { data, error } = await db.from('vales')
      .select('id,monto,nota,creado_en,trabajador_id,trabajador:perfiles!vales_trabajador_id_fkey(nombre)')
      .eq('estado', 'pendiente').order('creado_en', { ascending:true });
    if(error) throw error;
    return data || [];
  }

  // Abrir lo que pide un aviso tocado (index.html?ver=trabajos|pagos|historial). Los avisos
  // viejos de vales (ver=vales) ahora llevan a Nómina.
  function abrirSegunURL(p){
    const que = new URLSearchParams(location.search).get('ver');
    if(!que || !p) return;
    try{ history.replaceState(history.state, '', location.pathname); } catch(e){}
    if(p.rol === 'trabajador' && (que === 'trabajos' || que === 'pagos' || que === 'historial')) ver(que);
    if(p.rol === 'admin' && que === 'vales') location.href = 'nomina.html';
  }

  window.Trabajo = {
    iniciarTrabajador, salirTrabajador, refrescar, abrirSegunURL,
    cargarVales,
    esTrabajador: () => !!perfil
  };
})();
