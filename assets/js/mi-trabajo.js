// Inicio del trabajador: el trabajo que está haciendo (uno solo a la vez), con cuál sigue,
// el orden que él le da a su trabajo y sus pagos (cada trabajo con la foto del catálogo y la suya).
// El trabajador ve solo lo suyo: lo que tiene asignado, lo que ha ganado y sus vales.
// Los vales se aprueban en Nómina (solo Ray); aquí solo se cuentan para el Inicio del administrador.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, heroZoom, SW_COLOR,
          topeTexto, sabadoCorto, sabados, medidas } = window.AH;
  const $ = (id) => document.getElementById(id);

  const ICON_CANDADO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  const icoP = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_DINERO_P = icoP('<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>');
  const CHEV = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const ICON_CAMARA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
  const MAX_DESPUES = 4;   // en la fila "Después"; si hay más, "Ver todos"
  const MAX_OPC = 4;       // en "¿Con cuál empiezas?"; si hay más, "Ver todos"
  const ICON_ORDEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg>';

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
  let elegidoId = null;     // el que marcó en "¿Con cuál empiezas?"
  let ordenLocal = [];      // ids en la hoja "Ordena el trabajo"
  const suma = (l) => Math.round((l || []).reduce((a, x) => a + (Number(x.monto) || 0), 0) * 100) / 100;
  // Lo que se cobra este sábado (lo del domingo queda para la próxima semana)
  const deEstePago = (l) => (l || []).filter(x => !(pagos && pagos.semana_pago && x.semana && x.semana > pagos.semana_pago));
  const ganado = () => suma(deEstePago(pagos && pagos.trabajos));
  const valesTotal = () => suma(deEstePago(pagos && pagos.vales));
  const porCobrar = () => Math.round((ganado() - valesTotal()) * 100) / 100;
  // Uno solo a la vez: el que empezó (el servidor lo manda de primero)
  const enProceso = () => trabajos.find(t => t.iniciada_en) || null;
  // Los que puede empezar, en su orden (los que esperan a otro no)
  const disponibles = () => trabajos.filter(t => !t.espera && !t.iniciada_en);

  async function cargarTrabajador(){
    const [rt, rp] = await Promise.all([db.rpc('mis_trabajos'), db.rpc('mis_pagos')]);
    if(rt.error || rp.error) throw (rt.error || rp.error);
    trabajos = rt.data || [];
    pagos = rp.data || {};
  }

  const fotoHtml = (t, size) => t.foto ? window.AH.imgMini(t.foto, t.producto, t.tipo) : iconoTipo(t.tipo, size);
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
    const quien = t.tipo === 'Combo' ? 'el combo va' : 'el tuyo va';
    return `Foto en ${String(fi.de).toLowerCase()} · ${quien} en ${String(fi.color).toUpperCase()}`;
  }
  // Color de lo que hace: un solo color para todo el producto (puerta, ventanas y protecciones)
  // (Pedidos viejos: si las ventanas se vendieron de otro color, se respeta ese dato)
  const ventanasOtroColor = (e) => !!(e.ventanas_color && e.color && e.ventanas_color !== e.color);
  function colorDe(t){
    const e = t.especificaciones || {};
    if((t.rama === 'ventana' || t.rama === 'proteccion') && ventanasOtroColor(e)){
      return { c: e.ventanas_color, t: `Las ventanas van en color ${String(e.ventanas_color).toUpperCase()}` };
    }
    const c = e.color || t.color;
    return c ? { c, t: `Va en color ${String(c).toUpperCase()}` } : null;
  }
  const specsDe = (t) => {
    const cd = colorDe(t);
    return (cd ? [{ t:'Color ' + String(cd.c).toLowerCase(), sw:SW_COLOR[cd.c] }] : []).concat(resumenSpecs(t.tipo, t.especificaciones || {}));
  };
  // Todas las especificaciones, en una tabla (nombre arriba, valor abajo)
  function specsTabla(t){
    const e = t.especificaciones || {};
    const f = [];
    const add = (l, v, ancho) => { if(v !== undefined && v !== null && v !== '') f.push({ l, v:String(v), ancho }); };
    const combo = t.tipo === 'Combo';
    if(e.alto && e.ancho) add(combo ? 'Puerta' : 'Medidas', medidas(e));
    if(combo && e.ventanas_alto && e.ventanas_ancho) add('2 ventanas y 2 protecciones', medidas({ alto:e.ventanas_alto, ancho:e.ventanas_ancho }) + ' c/u', true);
    if(combo && ventanasOtroColor(e)) add('Color de las ventanas', e.ventanas_color);
    const soloProt = e.aluminio === 'Solo protección';
    if(soloProt) add('Qué se hace', 'Solo la protección (sin ventana)', true);
    else if(e.aluminio) add('Aluminio', e.aluminio);
    if(combo && e.variante) add('Protección en la puerta', e.variante === 'Con protección en puerta' ? 'Sí' : 'No');
    if(e.vidrio_o_farquilla === 'Farquilla') add('Vidrio o farquilla', 'Farquilla');
    else if(e.vidrio_o_farquilla === 'Vidrio') add('Vidrio', e.color_vidrio || 'Sí');
    if(soloProt){}
    else if(e.papel_ahumado === true) add('Papel ahumado', e.color_ahumado || 'Sí');
    else if(e.papel_ahumado === false) add('Papel ahumado', 'Sin');
    if(e.manillon === true) add('Manillón', e.manillon_tipo || 'Sí');
    else if(e.manillon === false) add('Manillón', 'Sin');
    if(e.cerradura) add('Cerradura', e.cerradura === 'Personalizada' ? (e.cerradura_detalle || 'Personalizada') : e.cerradura);
    if(e.proteccion && !soloProt) add('Protección', 'Sí');
    if(e.proteccion_sentido) add('La protección abre a la', e.proteccion_sentido);
    if(e.marco_decorativo) add(t.tipo === 'Ventana' && !soloProt ? 'Marco en protección' : 'Marco decorativo', 'Sí');
    if(e.mas_hojas) add('Hojas', 'Más de 2');
    if(e.sentido) add('Abre a la', e.sentido);
    if(e.posicion) add(t.tipo === 'Portón' ? 'Instalación' : 'Apertura', e.posicion);
    if(e.bloque) add('Bloque', e.bloque);
    return f.length ? `<div class="tj-specs">${f.map(x => `<div class="${x.ancho ? 'ancho' : ''}"><span>${esc(x.l)}</span>${esc(x.v)}</div>`).join('')}</div>` : '';
  }
  const refPedidoCorto = (t) => t.interna ? 'Para exhibición' : refPedido(t);
  // Las piezas que incluye un trabajo (reglas nuevas, con "oficio"): ej. Hierro de un combo =
  // la puerta, su protección si la lleva y las 2 protecciones de las ventanas, cada una con su medida
  const PROT = ['hierro', 'masilla', 'pintura'];
  // "masilla y pintura" / "la pintura de las protecciones": qué espera, en minúscula
  function esperaTxt(t){
    const e = String(t.espera || '').toLowerCase();
    if(t.oficio === 'instalar' && /^pintura/.test(e)) return 'la pintura de ' + (t.tipo === 'Combo' ? 'las protecciones' : 'la protección');
    return e;
  }
  // Instalar no se paga; la masilla se paga junto con la pintura
  const noSePaga = (t) => !!window.AH.notaPago(t.oficio);
  function piezasDe(t){
    if(!t.oficio) return [];
    const e = t.especificaciones || {}, c = Number(t.cantidad) || 1;
    const m = (a, b) => (a && b) ? medidas({ alto:a, ancho:b }) : '';
    const puerta = m(e.alto, e.ancho), vent = m(e.ventanas_alto, e.ventanas_ancho);
    if(t.tipo === 'Combo'){
      if(t.oficio === 'detalles') return [{ n:c, t:'Puerta', d:puerta }];
      if(!PROT.includes(t.oficio)) return [{ n:2 * c, t:'Ventanas', d:vent }];
      return [{ n:c, t:'Puerta', d:puerta }]
        .concat(e.variante === 'Con protección en puerta' ? [{ n:c, t:'Protección de puerta', d:puerta }] : [])
        .concat([{ n:2 * c, t:'Protecciones de ventana', d:vent }]);
    }
    if(t.tipo === 'Ventana') return [{ n:c, t: t.rama === 'proteccion' ? 'Protección' : 'Ventana', d:puerta }];
    const nom = t.tipo === 'Portón' ? 'Portón' : 'Puerta';
    return [{ n:c, t:nom, d:puerta }].concat(t.tipo === 'Puerta Multilock' && PROT.includes(t.oficio) && e.proteccion ? [{ n:c, t:'Protección', d:puerta }] : []);
  }
  function piezasHtml(t){
    const p = piezasDe(t);
    if(p.length < 2 && t.tipo !== 'Combo') return '';
    return `<div class="pz" aria-label="Lo que incluye">${p.map(x => `<span class="pz-n">${x.n}</span><span><b>${esc(x.t)}</b>${x.d ? ' ' + esc(x.d) : ''}</span>`).join('')}</div>`;
  }
  function topeTrab(iso){
    const tt = topeTexto(iso);
    if(!tt.tarde) return tt;
    const a = new Date(sabados().este + 'T12:00'), b = new Date(String(iso).slice(0, 10) + 'T12:00');
    const sem = Math.max(1, Math.round((a - b) / (7 * 864e5)));
    return { t: sem === 1 ? 'De la semana pasada' : `De hace ${sem} semanas`, tarde:true };
  }
  function topeHtml(t, cls){
    if(!t.para_el) return '';
    const tt = topeTrab(t.para_el);
    return `<span class="${cls} ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>`;
  }
  const horaCorta = (d) => d.toLocaleTimeString('es-VE', { hour:'numeric', minute:'2-digit', hour12:true })
    .replace(/\s/g, ' ').replace('a. m.', 'am').replace('p. m.', 'pm');
  // "desde las 8:40 am" si empezó hoy; "desde el lun 28 sept" si fue antes
  function desde(iso){
    const d = new Date(iso);
    if(isNaN(d)) return '';
    if(d.toDateString() === new Date().toDateString()){
      return 'desde las ' + horaCorta(d);
    }
    return 'desde el ' + diaCorto(iso);
  }

  // Arriba: saludo y cuántos trabajos tiene para el sábado
  function leadHtml(){
    const n = trabajos.length;
    if(!n) return '';
    const tarde = trabajos.filter(t => t.para_el && topeTexto(t.para_el).tarde).length;
    const topes = [...new Set(trabajos.map(t => t.para_el).filter(Boolean))].sort();
    let txt = esc(n === 1 ? '1 trabajo' : n + ' trabajos');
    if(tarde === 1){
      const t1 = trabajos.find(t => t.para_el && topeTexto(t.para_el).tarde);
      txt += ` · <span class="tarde">1 es ${esc(topeTrab(t1.para_el).t.replace(/^De /, 'de '))}</span>`;
    } else if(tarde) txt += ` · <span class="tarde">${tarde} son de semanas pasadas</span>`;
    else if(topes.length) txt += ' para el ' + esc(sabadoCorto(topes[0]));
    return `<p class="hoy-lead">${txt}</p>`;
  }

  // Tarjeta grande: lo que está haciendo; si no está haciendo nada, "¿Con cuál empiezas?"
  function ahoraHtml(){
    if(!trabajos.length){
      return `<div class="hoy"><div class="hoy-vacio"><b>No tienes trabajos asignados</b><span>Te avisamos cuando Ray te asigne uno.</span></div></div>`;
    }
    const t = enProceso();
    if(!t){
      if(!disponibles().length){
        return leadHtml() + `<div class="hoy"><div class="hoy-vacio"><b>Tus trabajos esperan a otro</b><span>Cuando terminen su parte, te toca a ti. Te avisamos.</span></div></div>`;
      }
      return leadHtml() + elegirHtml();
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
          <div class="hoy-etapa haciendo"><span class="en-dot"></span>Estás haciendo · ${esc(desde(t.iniciada_en))}</div>
          <div class="hoy-nom">${esc(t.nombre)} · ${esc(t.producto)}</div>
          <div class="hoy-sub">${esc([t.cantidad > 1 ? t.cantidad + ' unidades' : '', refPedidoCorto(t)].filter(Boolean).join(' · '))}${t.para_el ? ' · ' + topeHtml(t, 'hoy-tope') : ''}</div>
          ${piezasHtml(t)}
          ${chips.length ? `<div class="spec-chips">${specChipsHtml(chips)}</div>` : ''}
        </div>
        <div class="hoy-acc"><button class="btn-primary" type="button" data-terminar-t="${t.id}">Ya lo terminé · tomar foto</button></div>
      </div>`;
  }

  // "¿Con cuál empiezas?": sus trabajos en su orden; marca uno y lo empieza
  function elegirHtml(){
    const disp = disponibles();
    if(!disp.some(x => x.id === elegidoId)) elegidoId = disp[0].id;
    const sigue = disp[0].id;
    const vistos = trabajos.slice(0, trabajos.length > MAX_OPC + 1 ? MAX_OPC : trabajos.length);
    // Si el que marcó quedó fuera de los visibles, se muestra también
    if(!vistos.some(x => x.id === elegidoId)) vistos.push(trabajos.find(x => x.id === elegidoId));
    const op = (t) => {
      const sel = t.id === elegidoId;
      const sub = t.espera ? `<span class="el-s">Espera ${esc(esperaTxt(t))}</span>`
        : t.para_el ? `<span class="el-s ${topeTrab(t.para_el).tarde ? 'tarde' : ''}">${esc([refPedidoCorto(t), topeTrab(t.para_el).t].join(' · '))}</span>`
        : `<span class="el-s">${esc(refPedidoCorto(t))}</span>`;
      return `<div class="el-op ${t.espera ? 'gris' : ''} ${sel ? 'sel' : ''}" ${t.espera ? 'aria-disabled="true"' : `role="radio" tabindex="0" aria-checked="${sel}" data-elegir="${t.id}"`}>
        <span class="el-foto">${fotoHtml(t, 22)}</span>
        <span class="el-txt" style="min-width:0">
          <span class="el-etapa">${esc(t.nombre)}${t.id === sigue ? '<span class="el-sigue">Sigue</span>' : ''}</span>
          <span class="el-nom">${esc(t.producto)}</span>${sub}
          ${sel ? `<button type="button" class="el-ver" data-detalle="${t.id}">Ver todo</button>` : ''}
        </span>
        ${t.espera ? '' : '<span class="el-radio"></span>'}
      </div>`;
    };
    const elegido = trabajos.find(x => x.id === elegidoId);
    const verTodos = trabajos.length > vistos.length ? `<button class="el-link" type="button" data-ver="trabajos">Ver todos (${trabajos.length})</button>` : '<span></span>';
    const ordenar = trabajos.length > 1 ? `<button class="btn-orden" type="button" data-ordenar>${ICON_ORDEN}Ordena el trabajo</button>` : '';
    return `<div class="hoy elegir">
        <div class="el-tit">¿Con cuál empiezas?</div>
        <div class="el-sub">Elige uno. Lo terminas y eliges el siguiente.</div>
        <div role="radiogroup" aria-label="Tus trabajos">${vistos.map(op).join('')}</div>
        ${verTodos !== '<span></span>' || ordenar ? `<div class="el-pie">${verTodos}${ordenar}</div>` : '<div style="height:12px"></div>'}
        <button class="btn-primary el-btn" type="button" data-empezar="${elegido.id}">Empezar ${esc(elegido.producto)}</button>
      </div>`;
  }

  // "Después": los demás trabajos (en su orden) en una fila que se desliza; los que esperan a otro en gris
  function despuesHtml(){
    const a = enProceso();
    if(!a && disponibles().length) return '';   // el "¿Con cuál empiezas?" ya los muestra
    const resto = trabajos.filter(t => !a || t.id !== a.id);
    if(!resto.length) return '';
    const vistos = resto.length > MAX_DESPUES + 1 ? resto.slice(0, MAX_DESPUES) : resto;
    const mini = (t, i) => {
      const sub = t.espera ? `<span class="dp-s">Espera ${esc(esperaTxt(t))}</span>`
        : t.para_el ? topeHtml(t, 'dp-s') : `<span class="dp-s">${esc(refPedidoCorto(t))}</span>`;
      return `<button class="dp ${t.espera ? 'gris' : ''}" type="button" data-detalle="${t.id}">
        <span class="dp-foto">${fotoHtml(t, 26)}</span>
        <span class="dp-etapa">${i + 1} · ${esc(t.nombre)}</span><span class="dp-nom">${esc(t.producto)}</span>${sub}</button>`;
    };
    const mas = resto.length > vistos.length
      ? `<button class="dp dp-mas" type="button" data-ver="trabajos"><span class="dp-foto"><span>Ver todos</span><span>(${trabajos.length})</span></span></button>` : '';
    const ordenar = resto.length > 1 ? `<button class="btn-orden" type="button" data-ordenar>${ICON_ORDEN}Ordena el trabajo</button>` : '';
    return `<div class="despues-head"><p class="despues-tit">Después</p>${ordenar}</div><div class="despues">${vistos.map(mini).join('')}${mas}</div>`;
  }

  // Una sola fila de pagos: lo que cobra el sábado (y si tiene un vale esperando)
  function pagosFilaHtml(){
    const pc = porCobrar();
    const vp = pagos && pagos.vale_pendiente;
    const det = (pc < 0 ? 'vales por descontar ' + dinero(-pc) : 'cobras ' + dinero(pc) + ' el sábado') + (vp ? ' · vale esperando' : '');
    return `<div class="pend-lista"><button class="pend-fila verde" type="button" data-ver="pagos" style="--i:0">
      <span class="pend-ico">${ICON_DINERO_P}</span><span class="pend-t">Pagos y vales <span>· ${esc(det)}</span></span>${CHEV}</button></div>`;
  }

  // La animación de entrada solo la primera vez: al repintar (elegir, volver a la app) no parpadea
  function pintarInicioTrabajador(){
    const v = $('vistaTrabajo');
    if(v.dataset.pintado) v.classList.add('sin-entrada');
    v.innerHTML = ahoraHtml() + despuesHtml() + pagosFilaHtml();
    v.dataset.pintado = '1';
  }
  function pintarCargando(){
    $('vistaTrabajo').innerHTML = '<div class="sk-linea" style="width:220px;height:26px;margin:6px 2px 14px"></div><div class="sk-hoy"></div>';
  }

  // ---------- Todos los trabajos (desde "Ver todos") ----------
  function trabajoHtml(t){
    const det = [t.cantidad > 1 ? t.cantidad + ' unidades' : '', refPedidoCorto(t)].filter(Boolean).join(' · ');
    const tt = t.para_el ? topeTrab(t.para_el) : null;
    const estado = t.iniciada_en ? `<span class="tr-estado" style="color:#1B6B3A"><span class="en-dot" style="margin-top:4px"></span>Estás haciendo este</span>`
      : t.espera ? `<span class="tr-estado bloq">${ICON_CANDADO}Espera ${esc(esperaTxt(t))}</span>`
      : tt ? `<span class="tr-estado" style="${tt.tarde ? 'color:var(--danger)' : ''}">${esc(tt.t)}</span>`
      : noSePaga(t) ? '' : t.monto != null ? `<span class="tr-estado">Ganas ${esc(dinero(t.monto))}</span>` : '';
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
    $('trabajosAyuda').textContent = enProceso() ? 'Toca uno para ver su foto y todos sus detalles.' : 'Toca uno para verlo y empezarlo.';
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
    const tt = t.para_el ? topeTrab(t.para_el) : null;
    $('trabajoBody').innerHTML = `
      <div ${heroAttrs(t.foto)}>${t.foto ? `<img src="${esc(t.foto)}" alt="${esc(t.producto)}">` : iconoTipo(t.tipo, 56)}${etq ? `<span class="hoy-badge">${esc(etq)}</span>` : ''}${heroZoom(t.foto)}</div>
      <div><span class="tj-parte">Tu parte: ${esc(t.nombre)}</span>${tt ? `<span class="tj-tope ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>` : ''}</div>
      <div class="det-name" style="margin-top:10px">${esc(t.producto)}</div>
      <div class="det-type">${esc(t.tipo === 'Combo' ? 'Combo · 1 puerta + 2 ventanas + 2 protecciones' : (t.tipo || ''))}</div>
      ${piezasHtml(t)}
      <div class="tj-datos">
        ${t.cantidad > 1 ? `<span><b>${t.cantidad}</b> unidades</span>` : ''}
        <span>${t.interna ? '<b>Para exhibición</b>' : `<b>${esc(refPedido(t))}</b>${t.fecha_entrega ? ' · entrega al cliente ' + esc(fechaCorta(t.fecha_entrega)) : ''}`}</span>
        ${noSePaga(t) ? (t.oficio === 'masilla' ? '<span>Se paga <b>al terminar la pintura</b></span>' : '<span>Este paso <b>no se paga</b></span>') : t.monto != null ? `<span>Ganas <b>${esc(dinero(t.monto))}</b></span>` : ''}
      </div>
      ${cd ? `<div class="tj-color"><span class="sw ${SW_COLOR[cd.c] || ''}"></span>${esc(cd.t)}</div>` : ''}
      ${specsTabla(t)}
      ${t.notas ? `<div class="tj-nota"><b>Nota de la venta:</b> ${esc(t.notas)}</div>` : ''}`;
    const ep = enProceso();
    $('trabajoFoot').innerHTML = t.espera
      ? `<div class="tj-bloq" style="padding:0 14px;text-align:center">${ICON_CANDADO}Espera ${esc(esperaTxt(t))}</div>`
      : t.iniciada_en
      ? `<button class="btn-primary" type="button" data-terminar-t="${t.id}" style="width:100%;white-space:nowrap">Ya lo terminé · tomar foto</button>`
      : ep
      ? `<div class="tj-bloq" style="padding:0 14px;text-align:center">Primero termina ${esc(ep.nombre)} · ${esc(ep.producto)}</div>`
      : `<button class="btn-primary" type="button" data-empezar="${t.id}" style="width:100%;white-space:nowrap">Empezar este trabajo</button>`;
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
  const miniFoto = (url, tipo) => `<span>${url ? window.AH.imgMini(url, "", tipo) : iconoTipo(tipo, 18)}</span>`;
  // Cada trabajo hecho: la foto del catálogo y la suya, juntas. Al tocarlo se ve el detalle.
  function filaTrabajo(m){
    const monto = noSePaga(m) ? `<span class="pg-mov-m gris">${esc(window.AH.notaPago(m.oficio))}</span>` : m.monto == null ? '<span class="pg-mov-m gris">Por definir</span>' : `<span class="pg-mov-m">${esc(dinero(m.monto))}</span>`;
    return `<button class="pg-mov" type="button" data-hecho="${m.id}">
      <span class="duo">${miniFoto(m.foto, m.tipo)}${miniFoto(m.foto_trabajo, m.tipo)}</span>
      <span style="min-width:0"><span class="pg-mov-t">${esc(m.etapa)} · ${esc(m.producto)}</span>
      <span class="pg-mov-s">${esc([diaCorto(m.fecha), refDe(m)].filter(Boolean).join(' · '))}</span></span>${monto}${CHEV}</button>`;
  }
  function filaVale(v, pendiente){
    const bs = v.monto_bs ? 'dado en Bs ' + Number(v.monto_bs).toLocaleString('es-VE') : '';
    return `<div class="pg-mov vale"><span style="min-width:0"><span class="pg-mov-t">Vale${pendiente ? '<span class="pg-pill">Por aprobar</span>' : ''}</span>
      <span class="pg-mov-s">${esc([diaCorto(v.fecha), v.nota, bs].filter(Boolean).join(' · '))}</span></span>
      <span class="pg-mov-m ${pendiente ? 'gris' : 'rojo'}">${pendiente ? esc(dinero(v.monto)) : '−' + esc(dinero(v.monto))}</span></div>`;
  }
  // El sábado en que se cobra (la semana va de lunes a sábado)
  function sabadoDePago(){
    const sp = pagos && pagos.semana_pago;
    if(!sp) return '';
    const d = new Date(sp + 'T12:00'); d.setDate(d.getDate() + 5);
    return isoDia(d);
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
    const porDefinir = tr.filter(m => m.monto == null && !noSePaga(m)).length;
    let html = '';
    if(!tr.length && !va.length && !vp){
      html += '<div class="tr-vacio">Aquí verás cada trabajo que termines, con su foto, y lo que te toca cobrar.</div>';
    }
    if(tr.length || va.length){
      const pc = porCobrar(), sab = sabadoDePago();
      html += pc < 0
        ? `<div class="pg-cobra"><span>Vales por descontar</span><b class="rojo">${esc(dinero(-pc))}</b></div>`
        : `<div class="pg-cobra"><span>Cobras el ${esc(sab ? sabadoCorto(sab) : 'sábado')}</span><b>${esc(dinero(pc))}</b></div>`;
      if(porDefinir) html += `<div class="pg-aviso">${porDefinir === 1 ? '1 trabajo todavía no tiene monto' : porDefinir + ' trabajos todavía no tienen monto'}. Ray lo completa.</div>`;
    }
    grupos.forEach(g => {
      const n = g.l.length;
      html += `<p class="pg-tit">${esc(nombreSemana(g.k))} · ${n === 1 ? '1 trabajo' : n + ' trabajos'}</p>` + g.l.map(filaTrabajo).join('');
    });
    if(va.length || vp){
      html += '<p class="pg-tit">Vales</p>' + (vp ? filaVale(vp, true) : '') + va.map(v => filaVale(v, false)).join('');
    }
    if(trProx.length || vaProx.length) html += '<p class="pg-tit">Para la próxima semana</p>' + trProx.map(filaTrabajo).join('') + vaProx.map(v => filaVale(v, false)).join('');
    html += vp ? '' : '<button class="btn-secondary" type="button" id="btnAbrirVale" style="width:100%;margin-top:14px">Pedir un vale</button>';
    return html;
  }

  // Historial: cada pago que le hizo Ray, por semana y siempre cerrado; al abrirlo, sus trabajos con fotos
  function pintarHistorial(){
    const pg = (pagos && pagos.pagos) || [];
    if(!pg.length) return '<div class="tr-vacio">Todavía no tienes pagos. Cuando Ray te pague, aquí verás cada semana.</div>';
    return pg.map((p) => {
      const tr = p.trabajos || [], va = p.vales || [];
      const sub = esc([p.semana ? rangoSemana(p.semana) : '', tr.length === 1 ? '1 trabajo' : tr.length + ' trabajos'].filter(Boolean).join(' · '))
        + (Number(p.vales_monto) ? ` · <span style="white-space:nowrap">vales −${esc(dinero(p.vales_monto))}</span>` : '');
      return `<details class="pg-sem">
        <summary>
          <span style="min-width:0"><span class="pg-sem-t">${esc(diaCorto(p.pagado_en))}</span><span class="pg-sem-s">${sub}</span></span>
          <span class="pg-sem-m"><b>${esc(dinero(p.monto))}</b><span class="pg-est pagado">Pagado</span></span>
          <svg class="ac-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </summary>
        <div class="pg-sem-body">${tr.map(filaTrabajo).join('')}${va.map(x => filaVale(x, false)).join('')}
          <div class="pg-cobra chico"><span>Te pagaron · ${esc(p.pagado_por || 'Ray')}</span><b>${esc(dinero(p.monto))}</b></div>
        </div>
      </details>`;
    }).join('');
  }

  // Detalle de lo que hizo: la foto del catálogo al lado de la suya, cuándo lo terminó y todo el producto
  function buscarHecho(id){
    const p = pagos || {};
    return (p.trabajos || []).find(x => x.id === id)
      || ((p.pagos || []).map(q => (q.trabajos || []).find(x => x.id === id)).find(Boolean)) || null;
  }
  function abrirHecho(id){
    const m = buscarHecho(id);
    if(!m) return;
    const t = Object.assign({}, m, { nombre:m.etapa });
    const etq = etiquetaFoto(t);
    const cd = colorDe(t);
    const d = new Date(m.fecha);
    const hora = isNaN(d) ? '' : ', ' + horaCorta(d);
    const foto = (url, lb) => url
      ? `<div ${heroAttrs(url)}><img src="${esc(url)}" alt="${esc(lb)}"><span class="cmp-lb">${esc(lb)}</span></div>`
      : `<div class="hero sin-foto"><span class="cmp-lb">${esc(lb)}</span>${iconoTipo(m.tipo, 36)}<span>Sin foto</span></div>`;
    $('hechoTitulo').textContent = `${m.etapa} · ${m.producto}`;
    $('hechoBody').innerHTML = `
      <p class="hecho-sub">${esc(refPedidoCorto(m))} · Terminado ${esc(diaCorto(m.fecha) + hora)}</p>
      <div class="cmp">${foto(m.foto, 'Catálogo')}${foto(m.foto_trabajo, 'Tu foto')}</div>
      ${etq ? `<p class="cmp-nota">${esc(etq)}</p>` : ''}
      ${piezasHtml(t)}
      <div class="tj-datos">
        ${m.cantidad > 1 ? `<span><b>${m.cantidad}</b> unidades</span>` : ''}
        <span>${noSePaga(m) ? (m.oficio === 'masilla' ? 'Se paga <b>al terminar la pintura</b>' : 'Este paso <b>no se paga</b>') : m.monto == null ? 'Monto <b>por definir</b>' : `Te suma <b>${esc(dinero(m.monto))}</b>`}</span>
      </div>
      ${cd ? `<div class="tj-color"><span class="sw ${SW_COLOR[cd.c] || ''}"></span>${esc(cd.t)}</div>` : ''}
      ${specsTabla(t)}
      ${m.notas ? `<div class="tj-nota"><b>Nota de la venta:</b> ${esc(m.notas)}</div>` : ''}`;
    $('hechoBody').scrollTop = 0;
    abrirHoja('sheetHecho');
  }
  $('pagosBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hecho]');
    if(b) abrirHecho(Number(b.dataset.hecho));
  });

  function pintarPagos(){
    $('pagosTabs').querySelectorAll('[data-pg-tab]').forEach(b => b.classList.toggle('active', b.dataset.pgTab === tabPagos));
    $('pagosBody').innerHTML = tabPagos === 'historial' ? pintarHistorial() : pintarPorCobrar();
  }
  $('pagosTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pg-tab]'); if(!b || b.dataset.pgTab === tabPagos) return;
    tabPagos = b.dataset.pgTab;
    pintarPagos();
  });

  async function refrescar(silencioso){
    try{
      await cargarTrabajador();
      pintarInicioTrabajador();
      if($('sheetTrabajos').classList.contains('open')) pintarTrabajos();
      if($('sheetTrabajo').classList.contains('open')) pintarDetalle();
      if($('sheetPagos').classList.contains('open')) pintarPagos();
    } catch(err){
      if(!silencioso) toast('No se pudo actualizar: ' + ((err && err.message) || 'revisa tu internet'), 'error');
    }
  }

  function ver(que){
    if(que === 'trabajos'){ pintarTrabajos(); abrirHoja('sheetTrabajos'); }
    if(que === 'pagos' || que === 'historial'){ tabPagos = que === 'historial' ? 'historial' : 'cobrar'; pintarPagos(); abrirHoja('sheetPagos'); }
  }

  function clicTrabajo(e){
    const bt = e.target.closest('[data-terminar-t]');
    if(bt){ abrirTerminar(Number(bt.dataset.terminarT)); return true; }
    const be = e.target.closest('[data-empezar]');
    if(be){ empezar(Number(be.dataset.empezar), be); return true; }
    const bd = e.target.closest('[data-detalle]');
    if(bd){ abrirDetalle(Number(bd.dataset.detalle)); return true; }
    return false;
  }
  // Marcar otro: solo cambia la marca y el botón, sin volver a dibujar (las fotos no parpadean)
  function elegir(id){
    const t = disponibles().find(x => x.id === id);
    if(id === elegidoId || !t) return;
    elegidoId = id;
    const v = $('vistaTrabajo');
    v.querySelectorAll('[data-elegir]').forEach(op => {
      const sel = Number(op.dataset.elegir) === id;
      op.classList.toggle('sel', sel);
      op.setAttribute('aria-checked', String(sel));
      const ver = op.querySelector('.el-ver');
      if(!sel && ver) ver.remove();
      if(sel && !ver) op.querySelector('.el-txt').insertAdjacentHTML('beforeend', `<button type="button" class="el-ver" data-detalle="${id}">Ver todo</button>`);
    });
    const b = v.querySelector('.el-btn');
    if(b){ b.dataset.empezar = String(id); b.textContent = 'Empezar ' + t.producto; }
    const op = v.querySelector(`[data-elegir="${id}"]`);
    if(op) op.focus({ preventScroll:true });
  }
  $('vistaTrabajo').addEventListener('click', (e) => {
    if(clicTrabajo(e)) return;
    const eo = e.target.closest('[data-elegir]');
    if(eo){ elegir(Number(eo.dataset.elegir)); return; }
    if(e.target.closest('[data-ordenar]')){ abrirOrden(); return; }
    const b = e.target.closest('[data-ver]');
    if(b) ver(b.dataset.ver);
  });
  $('vistaTrabajo').addEventListener('keydown', (e) => {
    const eo = e.target.closest('[data-elegir]');
    if(!eo || e.target.closest('[data-detalle]')) return;
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); elegir(Number(eo.dataset.elegir)); return; }
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      const ops = [...$('vistaTrabajo').querySelectorAll('[data-elegir]')];
      const k = ops.indexOf(eo) + (e.key === 'ArrowDown' ? 1 : -1);
      if(ops[k]){ e.preventDefault(); elegir(Number(ops[k].dataset.elegir)); }
    }
  });

  // Empezar: uno solo a la vez (el servidor no deja tener dos)
  let empezando = false;
  async function empezar(id, btn){
    const t = trabajos.find(x => x.id === id);
    if(!t || empezando) return;
    empezando = true;
    if(btn) btn.disabled = true;
    try{
      const { error } = await db.rpc('empezar_etapa', { eid: id });
      if(error) throw error;
      cerrarHoja('sheetTrabajo', true);
      cerrarHoja('sheetTrabajos', true);
      elegidoId = null;
      toast(`Empezaste ${t.nombre} · ${t.producto}. Al terminar, toma la foto.`);
      await refrescar();
    } catch(err){
      toast((err && err.message) || 'No se pudo empezar. Revisa tu internet.', 'error');
      if(btn) btn.disabled = false;
      await refrescar(true);
    } finally {
      empezando = false;
    }
  }

  // ---------- Ordena el trabajo: toca los trabajos en el orden en que los vas a hacer ----------
  let ordenTocados = [];    // ids en el orden en que los tocó
  function pintarOrden(){
    const ep = enProceso();
    const lista = ordenLocal.map(id => trabajos.find(x => x.id === id)).filter(Boolean);
    $('listaOrden').innerHTML = lista.map((t) => {
      const n = ordenTocados.indexOf(t.id) + 1;
      const tt = t.para_el ? topeTrab(t.para_el) : null;
      const sub = t.espera ? `${t.nombre} · espera ${esperaTxt(t)}` : [t.nombre, tt ? tt.t : refPedidoCorto(t)].join(' · ');
      return `<button type="button" class="ord-f ${t.espera ? 'gris' : ''} ${n ? 'on' : ''}" data-tocar="${t.id}" aria-pressed="${!!n}">
        <span class="ord-n">${n || ''}</span>
        <span class="ord-t"><b>${esc(t.producto)}</b><span class="${tt && tt.tarde && !t.espera ? 'tarde' : ''}">${esc(sub)}</span></span>
      </button>`;
    }).join('') + (ep ? `<p class="field-hint" style="margin:10px 0 0">Ahora estás haciendo ${esc(ep.nombre)} · ${esc(ep.producto)}.</p>` : '');
    $('btnOrdenDeNuevo').disabled = !ordenTocados.length;
    $('btnGuardarOrden').disabled = !ordenTocados.length;
  }
  function abrirOrden(){
    const ep = enProceso();
    ordenLocal = trabajos.filter(t => !ep || t.id !== ep.id).map(t => t.id);
    if(ordenLocal.length < 2) return;
    ordenTocados = [];
    pintarOrden();
    abrirHoja('sheetOrden');
  }
  // Tocar uno le pone el siguiente número; tocar uno que ya tiene número se lo quita
  $('listaOrden').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tocar]');
    if(!b) return;
    const id = Number(b.dataset.tocar);
    const k = ordenTocados.indexOf(id);
    if(k >= 0) ordenTocados.splice(k, 1); else ordenTocados.push(id);
    pintarOrden();
    const nb = $('listaOrden').querySelector(`[data-tocar="${id}"]`);
    if(nb) nb.focus({ preventScroll:true });
  });
  $('btnOrdenDeNuevo').addEventListener('click', () => { ordenTocados = []; pintarOrden(); });
  $('btnGuardarOrden').addEventListener('click', async () => {
    const btn = $('btnGuardarOrden');
    if(btn.disabled || !ordenTocados.length) return;
    btn.disabled = true;
    // Primero los que tocó, en ese orden; los que no tocó quedan después, como estaban
    const ids = ordenTocados.concat(ordenLocal.filter(id => !ordenTocados.includes(id)));
    try{
      const { error } = await db.rpc('ordenar_mis_trabajos', { p_ids: ids });
      if(error) throw error;
      cerrarHoja('sheetOrden', true);
      elegidoId = null;
      toast('Listo. Tu trabajo quedó en ese orden.');
      await refrescar();
    } catch(err){
      toast((err && err.message) || 'No se pudo guardar. Revisa tu internet.', 'error');
      await refrescar(true);
      // Si su lista cambió mientras tanto (entró o salió un trabajo), se cierra para volver a ordenar
      const ep = enProceso();
      const ahoraIds = trabajos.filter(t => !ep || t.id !== ep.id).map(t => t.id);
      if(ahoraIds.length !== ordenLocal.length || ahoraIds.some(id => !ordenLocal.includes(id))) cerrarHoja('sheetOrden', true);
      else pintarOrden();
    } finally {
      btn.disabled = !ordenTocados.length;
    }
  });
  $('listaTrabajos').addEventListener('click', clicTrabajo);
  $('trabajoFoot').addEventListener('click', clicTrabajo);

  // Terminar: solo el que está haciendo, y la foto es obligatoria (el servidor también la exige)
  let terminarId = null;
  let fotoBlob = null;
  let fotoUrlObj = null;
  let fotoSubida = null;    // { blob, url }: si falla el terminar, al reintentar no se sube otra vez
  function soltarFoto(){
    if(fotoUrlObj) URL.revokeObjectURL(fotoUrlObj);
    fotoUrlObj = null; fotoBlob = null; fotoSubida = null;
  }
  function pintarTerminar(){
    const t = trabajos.find(x => x.id === terminarId);
    const btn = $('btnTConfirmar');
    $('btnTFoto').classList.toggle('lista', !!fotoBlob);
    $('btnTFoto').innerHTML = fotoBlob ? `<img src="${esc(fotoUrlObj)}" alt="Tu foto">` : `${ICON_CAMARA}<span>Toca para tomar la foto</span>`;
    $('btnTFoto').setAttribute('aria-label', fotoBlob ? 'Tomar la foto otra vez' : 'Tomar la foto');
    $('tFotoAyuda').textContent = fotoBlob ? 'Si no se ve bien, tócala para tomarla otra vez.' : 'La foto es obligatoria para terminar.';
    $('tFotoAyuda').classList.toggle('ok', !!fotoBlob);
    btn.disabled = !fotoBlob;
    btn.textContent = fotoBlob && t && t.monto != null && !noSePaga(t) ? `Terminar · suma ${dinero(t.monto)}` : 'Terminar';
  }
  function abrirTerminar(id){
    const t = trabajos.find(x => x.id === id);
    if(!t || !t.iniciada_en) return;
    terminarId = id;
    soltarFoto();
    $('tFotoInput').value = '';
    $('terminarTTitulo').textContent = 'Terminar ' + t.nombre;
    $('terminarTSub').textContent = `${t.producto} · ${refPedidoCorto(t)}`;
    pintarTerminar();
    abrirHoja('sheetTerminarT');
    // "Ya lo terminé · tomar foto": abre la cámara de una vez
    try{ $('tFotoInput').click(); } catch(e){}
  }
  $('btnTFoto').addEventListener('click', () => $('tFotoInput').click());
  $('tFotoInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    try{
      const blob = await comprimirFoto(f);
      if(fotoUrlObj) URL.revokeObjectURL(fotoUrlObj);
      fotoBlob = blob;
      fotoUrlObj = URL.createObjectURL(blob);
      pintarTerminar();
    } catch(err){ toast('No se pudo procesar la foto. Tómala otra vez.', 'error'); }
  });
  $('btnTConfirmar').addEventListener('click', async () => {
    if(!terminarId) return;
    const btn = $('btnTConfirmar');
    if(btn.disabled) return;
    if(!fotoBlob){ toast('Toma la foto del trabajo terminado', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'Subiendo la foto…';
    try{
      if(!fotoSubida || fotoSubida.blob !== fotoBlob){
        const path = new Date().toISOString().slice(0, 7) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        fotoSubida = { blob: fotoBlob, url: await window.AH.subirFoto('etapas-fotos', path, fotoBlob) };
      }
      const { data, error } = await db.rpc('marcar_etapa_terminada', { eid: terminarId, foto_url: fotoSubida.url });
      if(error) throw error;
      cerrarHoja('sheetTerminarT', true);
      cerrarHoja('sheetTrabajo', true);
      terminarId = null;
      soltarFoto();
      elegidoId = null;
      toast(data && data.monto != null && Number(data.monto) > 0 ? `¡Bien hecho! Sumaste ${dinero(data.monto)}` : '¡Bien hecho! Quedó terminado');
      await refrescar();
    } catch(err){
      toast((err && err.message) || 'No se pudo terminar. Revisa tu internet.', 'error');
      await refrescar(true);
      // Si ese trabajo ya no está (lo reasignaron o se canceló el pedido), se cierra la hoja
      if(!trabajos.some(x => x.id === terminarId)){ cerrarHoja('sheetTerminarT', true); terminarId = null; soltarFoto(); }
      else pintarTerminar();
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
    $('vistaTrabajo').classList.remove('sin-entrada');
    delete $('vistaTrabajo').dataset.pintado;
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
