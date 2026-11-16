// Costos (solo quien confirma pagos: Ray o Gualfredo). Misma fórmula del Costeador de Ray (costeo.js = _costeo de la base):
// materiales con IVA, consumibles por rendimiento, herrajes, mano de obra por categoría de pago,
// costo × (1 + ganancia) + gastos fijos por puerta. Los extras se cobran aparte (× ganancia, sin gastos fijos).
// Costeador (lote 8, maquetas C1, C2, R1, R2): pestañas Modelos · Precios (el plan de corte vive en Taller › Corte).
// Modelos: buscador, + Nuevo, filtros Todos · Puertas · Combos · Ventanas · Extras, grupos Listos · Borrador · Faltan
// por costear. Ficha en pantalla propia: los cortes se escriben en la fila (cant × cm × nota), la barra se redibuja y
// la franja del precio (fija abajo) cambia al instante; lo demás en acordeones con su subtotal. Un solo Guardar cuando
// hay cambios. La Ganancia por modelo vive en Finanzas › Mes y los gastos fijos en Finanzas › Gastos.
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const X = window.COSTEO;
  const D = () => X.datos();
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>';
  const TIPO = { hierro:'Hierro', aluminio:'Aluminio', laminas:'Láminas', vidrio:'Vidrio' };
  const COLOR = { verde:'#1B6B3A', amar:'var(--amber)', rojo:'var(--danger)', negro:'var(--ink)', gris:'var(--ink-faint)' };
  const QUE = ['Bastidor','Marco','Divisor','Travesaño','Ranura','Vitral','Otra'];
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const numLibre = (v) => { const s = String(v == null ? '' : v).trim(); if(!s) return NaN; if(/,\d{1,3}$/.test(s) && !/\./.test(s)) return parseFloat(s.replace(',', '.')); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  const num = (n, d) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits:d || 0, maximumFractionDigits:d == null ? 2 : d });
  const metros = (cm) => num(cm / 100, 2) + ' m';
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };
  const q = new URLSearchParams(location.search);
  const idDe = (codigo) => (D().fab.find(f => f.codigo === codigo) || {}).id;
  const fabDe = (id) => D().fab.find(f => String(f.id) === String(id));
  // Estructura estándar de todas las puertas (Memoria central): tubo 3" x 1", 2 de 200 cm (V) + 2 de 88 cm (H)
  const bastidor = () => { const t = idDe('t1x3') || (D().fab.find(f => f.pres === 'barra') || {}).id; return t ? [[t, 2, 200, '', 'Bastidor', 'V'], [t, 2, 88, '', 'Bastidor', 'H']] : []; };
  const insumoDe = (codigo) => D().insumos.find(i => i.codigo === codigo);
  const provNom = (id) => id === 'barato' ? 'El más barato' : ((D().proveedores.find(p => String(p.id) === String(id)) || {}).nombre || 'Proveedor').replace('Inversiones ', '').replace(' (ferretería y otros)', '');

  const TABS = ['modelos','materiales'];
  // El plan de corte se pasó a Taller › Corte (lote 5 y 6)
  if(q.get('tab') === 'semana'){ location.replace('taller.html?vista=corte'); return; }
  let tab = TABS.includes(q.get('tab')) ? q.get('tab') : 'modelos', filtro = 'Todos', busca = '';
  let sel = null, prov = null, modo = 'metro', F = null, ocupado = false, ini = null;
  let filPrecios = 'perfiles';
  window.CostosApp = { get prov(){ return prov; }, set prov(v){ prov = v; }, pintar:() => pintar(), recargar:() => recargar(), abrirCorte:(o) => abrirForm(Object.assign({ t:'corte' }, o)), repintarForm:() => { if(F && F.t === 'corte') pintarForm(); } };

  const modelo = (id) => D().catalogo.find(x => String(x.id) === String(id)) || D().enDiseno.find(x => String(x.id) === String(id));
  const foto = (m) => m.foto || 'assets/img/icon-192.png';
  const pill = (s) => `<span class="pill ${s[0]}">${esc(s[1])}</span>`;
  const fichaAbierta = () => $('sheetFicha').classList.contains('open');

  async function recargar(){ await X.cargar(); if(prov == null) prov = D().prov; pintar(); if(sel != null && fichaAbierta()){ cargarBorrador(); pintarFicha(); } }
  // Guarda y vuelve a cargar todo; avisa si falla (sin señal o regla de la base)
  async function hacer(fn, ok){
    if(ocupado) return false; ocupado = true;
    try{ await fn(); if(ok) toast(ok); await recargar(); return true; }
    catch(e){ toast(errTxt(e), 'error'); try{ await recargar(); } catch(_){} return false; }
    finally { ocupado = false; }
  }

  // ================= Pantalla =================
  function pintar(){
    if(!D()) return;
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tabs').querySelector('.seg-fondo').style.transform = `translateX(${TABS.indexOf(tab) * 100}%)`;
    if(tab === 'modelos'){ pintarFiltrosModelos(); $('cont').innerHTML = secModelos(); }
    else { pintarFiltrosPrecios(); $('cont').innerHTML = secPrecios(); }
  }

  // ================= Modelos: los productos del Catálogo por grupos =================
  const enFab = () => { const n = {}; (D().enFabricacion || []).forEach(id => { n[id] = 1; }); return n; };
  // La madera queda fuera del Costeador por ahora. Los modelos en diseño salen en Borrador.
  const sinMadera = (o) => o.m.tipo !== 'Puerta de Madera';
  const FIL = {
    'Todos':sinMadera, 'Puertas':(o) => /^Puerta/.test(o.m.tipo || '') && sinMadera(o), 'Combos':(o) => o.m.tipo === 'Combo',
    'Ventanas':(o) => /ventana/i.test(o.m.tipo || ''), 'Extras':() => false,
  };
  const listo = (o) => o.x && o.x.c.estado === 'listo' && !o.x.falta.length;
  function lista(){
    const d = D(), nf = enFab();
    return d.enDiseno.map(m => ({ m, x:X.costear(m.id, { prov }), dis:true, fab:0 }))
      .concat(d.catalogo.map(m => ({ m, x:X.costear(m.id, { prov }), dis:false, fab:nf[m.id] || 0 })))
      .sort((a, b) => (b.fab - a.fab));
  }
  function pintarFiltrosModelos(){
    $('filtros').querySelector('.mostrar-t').textContent = 'Ver';
    $('filtrosL').innerHTML = Object.keys(FIL).map(k => `<button type="button" class="fx ${k === filtro ? 'on' : ''}" data-filtro="${esc(k)}">${esc(k)}</button>`).join('');
  }
  // Cómo está contra el catálogo: "$6,79 abajo" (rojo) o "gana 31 %" (verde)
  function contraCatalogo(x){
    if(!x || x.hoy == null) return '';
    const dif = r2(x.hoy - x.final);
    return dif < -0.005 ? `<span class="mod-dif rojo">${dinero(-dif)} abajo</span>` : `<span class="mod-dif verde">gana ${Math.round(x.pct)} %</span>`;
  }
  const tipoCorto = (t) => /^Puerta/.test(t || '') ? 'Puerta' : (t || '');
  function filaModelo(o){
    const { m, x, dis, fab } = o;
    let der;
    if(listo(o) && !dis) der = `<b>${dinero(x.final)}</b>${contraCatalogo(x)}`;
    else if(x) der = `<b>${listo(o) ? dinero(x.final) : '·'}</b><span class="mod-dif gris">${dis ? 'en diseño' : x.falta.length ? 'falta ' + esc(x.falta[0]) : 'borrador'}</span>`;
    else der = '<b>·</b><span class="mod-dif amar">sin cortes</span>';
    const sub = dis ? esc(tipoCorto(m.tipo)) + ' · en diseño' + (x && x.c.codigo ? ' · ' + esc(x.c.codigo) : '') : esc(tipoCorto(m.tipo)) + (fab ? ' · <b style="color:var(--accent)">en fabricación</b>' : ' · catálogo ' + dinero(m.precio_base));
    return `<button class="mod" type="button" data-modelo="${esc(m.id)}"><img src="${esc(foto(m))}" alt="" loading="lazy">
      <span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${sub}</span></span>
      <span class="mat-n">${der}</span></button>`;
  }
  function secModelos(){
    const todos = lista(), cat = todos.filter(o => !o.dis);
    $('subtitulo').textContent = `${cat.filter(listo).length} de ${cat.length} modelos listos`;
    const t = (window.AH.normalizar ? window.AH.normalizar : (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    if(!FIL[filtro]) filtro = 'Todos';
    const ver = todos.filter(FIL[filtro]).filter(o => !busca || t(o.m.nombre).includes(t(busca)));
    let h = `<div class="mod-top"><label class="search-box"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="buscaModelo" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="${esc(busca)}" autocomplete="off"></label><button class="btn-nuevo-m" type="button" data-nuevo-modelo>+ Nuevo</button></div><div id="modLista">`;
    if(filtro === 'Extras') return h + listaExtras() + '</div>';
    const pend = (D().extrasPendientes || []).filter(p => modelo(p.catalogo_id));
    if(pend.length && !busca) h += `<div class="grp-t"><span>Extras vendidos sin costear</span><span>${pend.length}</span></div>` + pend.map(p => { const m = modelo(p.catalogo_id);
      return `<button class="mod" type="button" data-extra-pend="${esc(p.catalogo_id)}" data-k="${esc(p.k)}"><img src="${esc(foto(m))}" alt="" loading="lazy"><span class="grow"><span class="mat-t">${esc(p.extra)} del ${esc(m.nombre)}</span><span class="mat-s">vendido en ${p.n === 1 ? '1 puerta' : p.n + ' puertas'} en fabricación · sin cortes</span></span><span class="mat-n"><b style="font-size:14px;color:var(--amber)">Cargar cortes</b></span></button>`; }).join('');
    h += listaModelos(ver) + '</div>';
    return h;
  }
  // Extras: las fichas de extra de todos los modelos, no solo las que se vendieron sin costear
  function listaExtras(){
    const t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), L = [];
    D().catalogo.concat(D().enDiseno).forEach(m => { const c = D().costeo[m.id]; if(!c) return;
      (c.extras || []).forEach((e, i) => { if(busca && !t(e.n + ' ' + m.nombre).includes(t(busca))) return; L.push({ m, e, i, x:X.costearExtra(c, m, e, prov) }); }); });
    if(!L.length) return `<div class="vacio-d"><b>No hay extras aquí</b>${busca ? 'Prueba con otro nombre.' : 'Los extras se agregan dentro de la ficha de cada modelo, o con + Nuevo › Extra.'}</div>`;
    return `<div class="grp-t"><span>Extras</span><span>${L.length}</span></div>` + L.map(({ m, e, i, x }) => `<button class="mod" type="button" data-extra-de="${esc(m.id)}" data-i="${i}"><img src="${esc(foto(m))}" alt="" loading="lazy">
      <span class="grow"><span class="mat-t">${esc(e.n)}</span><span class="mat-s">del ${esc(m.nombre)}${e.ofrecer ? '' : ' · oculto'}</span></span>
      <span class="mat-n">${x.listo ? `<b>${dinero(x.venta)}</b><span class="mod-dif gris">cuesta ${dinero(x.costo)}</span>` : '<b>·</b><span class="mod-dif amar">falta</span>'}</span></button>`).join('');
  }
  function listaModelos(ver){
    if(!ver.length) return `<div class="vacio-d"><b>No hay modelos aquí</b>${busca ? 'Prueba con otro nombre.' : 'Cambia el filtro de arriba o toca + Nuevo.'}</div>`;
    const G = [['Listos', ver.filter(o => listo(o) && !o.dis)], ['Borrador', ver.filter(o => o.x && (!listo(o) || o.dis))], ['Faltan por costear', ver.filter(o => !o.x)]];
    return G.filter(([, l]) => l.length).map(([n, l]) => `<div class="grp-t"><span>${n}</span><span>${l.length}</span></div>${l.map(filaModelo).join('')}`).join('');
  }

  // ================= Ficha del modelo (pantalla completa) =================
  function abrirFicha(id){
    sel = id; ini = null; franja = false; abiertos = new Set();
    const m = modelo(id); if(!m) return;
    cargarBorrador();
    if(!D().costeo[id]){ const b = bases()[0]; ini = b ? { modo:'copiar', de:b.id } : { modo:'estandar' }; }
    pintarFicha(); abrirHoja('sheetFicha'); $('fichaBody').scrollTop = 0;
  }
  // Modelos que ya tienen cortes: sirven para copiar
  const bases = () => D().catalogo.concat(D().enDiseno).filter(c => D().costeo[c.id] && D().costeo[c.id].piezas.length && String(c.id) !== String(sel));
  const medida = (m) => { const e = m.especificaciones_base || {}; return e.alto && e.ancho ? Math.round(e.alto * 100) + ' × ' + Math.round(e.ancho * 100) : ''; };
  function trae(m){
    const e = m.especificaciones_base || {}, l = [];
    if(e.proteccion === false) l.push('Sin protección'); if(e.proteccion === true) l.push('Con protección');
    if(e.marco_decorativo === false) l.push('Sin marco decorativo'); if(e.marco_decorativo === true) l.push('Marco decorativo');
    if(e.manillon === true) l.push('Manillón' + (e.manillon_tipo ? ' ' + e.manillon_tipo : ''));
    if(e.vidrio_o_farquilla) l.push(e.vidrio_o_farquilla + (e.color_vidrio ? ' ' + e.color_vidrio : ''));
    return l;
  }
  // ---- Borrador de cortes: se escriben en la fila; el cálculo usa solo las filas completas
  let BOR = [], GUARD = '[]', abiertos = new Set(), franja = false, nuevaFila = null, abierto3d = null;
  const pzValidas = () => BOR.filter(p => numLibre(p.n) > 0 && numLibre(p.cm) > 0).map(p => [Number(p.mid), Math.round(numLibre(p.n)), numLibre(p.cm), String(p.nota || '').trim(), p.que || null, p.ori || null]);
  function cargarBorrador(){ const c = sel != null ? D().costeo[sel] : null; BOR = c ? c.piezas.map(p => ({ mid:p[0], n:String(p[1]), cm:String(p[2]), nota:p[3] || '', que:p[4] || null, ori:p[5] || null })) : []; GUARD = JSON.stringify(c ? c.piezas.map(p => [Number(p[0]), Number(p[1]), Number(p[2]), String(p[3] || '').trim(), p[4] || null, p[5] || null]) : []); nuevaFila = null; abierto3d = null; }
  const incompletas = () => BOR.filter(p => (String(p.n).trim() !== '' || String(p.cm).trim() !== '') && !(numLibre(p.n) > 0 && numLibre(p.cm) > 0));
  const sucio = () => !!(sel != null && D().costeo[sel]) && (JSON.stringify(pzValidas()) !== GUARD || incompletas().length > 0);
  function aplicarBorrador(){ const c = sel != null ? D().costeo[sel] : null; if(c) c.piezas = pzValidas(); }
  const metrosC = (cm) => num(cm / 100, 2) + ' m';
  // Barras dibujadas: máximo 3 por perfil
  function barrasHtml(g){
    const ver = g.barras.slice(0, 3), mas = g.barras.length - ver.length;
    return ver.map(b => `<div class="barra">${b.piezas.map(p => `<span style="flex:${p.cm}">${num(p.cm, p.cm % 1 ? 1 : 0)}</span>`).join('')}${b.libre > 0 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 60 ? 'sobra ' + metrosC(b.libre) : ''}</span>` : ''}</div>`).join('')
      + (mas > 0 ? `<p class="mat-s" style="margin:4px 2px 0">+${mas === 1 ? '1 barra' : mas + ' barras'}</p>` : '');
  }
  function filaPz(i){
    const p = BOR[i];
    return `<div class="pzf${nuevaFila === i ? ' nueva' : ''}" data-fila="${i}"><input class="pzf-in" data-pz="${i}:n" inputmode="numeric" value="${esc(p.n)}" aria-label="Cantidad"><span class="pzf-x">×</span><input class="pzf-in" data-pz="${i}:cm" inputmode="decimal" value="${esc(p.cm)}" aria-label="Medida en cm"><input class="pzf-nota" data-pz="${i}:nota" value="${esc(p.nota)}" maxlength="60" aria-label="Nota de la pieza"><button class="pzf-3d${p.que || p.ori ? ' on' : ''}" type="button" data-pz3d="${i}" aria-label="Para 3D" aria-expanded="${abierto3d === i}">3D</button><button class="pzf-q" type="button" data-pzx="${i}" aria-label="Quitar pieza">✕</button></div>`
      + (abierto3d === i ? `<div class="pz3d"><span class="field-label">Qué es (para 3D)</span>${chips(QUE.map(v => [v, v]), p.que, 'data-pzque')}<span class="field-label" style="margin-top:8px">Va</span>${chips([['V','Vertical'],['H','Horizontal']], p.ori, 'data-pzori')}</div>` : '');
  }
  const SECS = [['s-hojas','Lámina y vidrio'],['s-cons','Pintura y consumibles'],['s-herr','Herrajes y manillón'],['s-obra','Mano de obra'],['s-extras','Extras'],['s-notas','Notas']];
  function pintarFicha(){
    const m = modelo(sel); if(!m) return;
    aplicarBorrador();
    const x = X.costear(m.id, { prov, modo:'metro' });
    const dis = !!m.en_diseno, md = medida(m);
    const est = !x ? 'Faltan sus cortes' : dis ? 'En diseño' : x.c.estado === 'listo' && !x.falta.length ? 'Listo' : 'Borrador';
    const cat = x ? x.cat : null;
    $('fichaHead').innerHTML = `<div class="fi-fila1"><button class="fi-volver" type="button" data-salir-ficha>‹ Modelos</button><span class="pill ${est === 'Listo' ? 'verde' : 'gris'}">${esc(est)}</span></div>
      <div class="fi-tit"><div style="min-width:0"><h2 class="sheet-title" id="fichaTitulo">${esc(m.nombre)}</h2><span class="mat-s">${esc([x && x.c.codigo, tipoCorto(m.tipo) + (md ? ' ' + md + ' cm' : ''), cat && cat.nombre].filter(Boolean).join(' · '))}</span></div>
      ${x ? '<button class="fi-dup" type="button" data-duplicar>Duplicar</button>' : ''}</div>`;
    if(!x) return pintarInicio(m);
    const R = D().reglas, c = x.c, suma = (gs) => x.lineas.filter(l => gs.includes(l.g)).reduce((a, l) => a + l.v, 0);
    let h = `<div class="fi-idx" id="fiIdx"></div>`;
    if(x.falta.length) h += `<div class="caja-rara">Faltan datos: ${esc(x.falta.join(', '))}. Sin esto no se sabe cuánto cuesta.</div>`;
    // ---- Cortes: escritos en la fila, agrupados por perfil, con su barra dibujada
    const orden = []; BOR.forEach((p, i) => { let g = orden.find(o => String(o.mid) === String(p.mid)); if(!g){ g = { mid:p.mid, idx:[] }; orden.push(g); } g.idx.push(i); });
    h += `<section class="fi-sec" id="s-cortes"><div class="fi-sh"><h3>Cortes <small>cantidad × cm</small></h3><span id="totCortes"></span></div>`;
    if(!orden.length) h += '<p class="mat-s" style="margin:4px 2px">Todavía no tiene cortes. Toca "+ perfil" para elegir el primer material.</p>';
    orden.forEach(o => {
      const f = fabDe(o.mid) || { nombre:'Material' };
      h += `<div class="pf" data-pf="${esc(o.mid)}"><div class="fi-mat"><b>${esc(f.nombre)}</b><span class="pf-v"></span></div><div class="pf-s"></div>
        <div class="pzf-cab"><span>Cant.</span><span></span><span>cm</span><span>Nota</span></div>
        ${o.idx.map(filaPz).join('')}<div class="barras pf-b"></div><button class="pz-mas" type="button" data-pz-mas="${esc(o.mid)}">+ pieza</button></div>`;
    });
    h += '<button class="pz-mas pf-mas" type="button" data-pf-nuevo>+ perfil</button></section>';
    // ---- Lo demás en acordeones cerrados, con su subtotal
    const cuerpo = {};
    cuerpo['s-hojas'] = () => (c.hojas.map((p, i) => { const f = fabDe(p[0]); if(!f || !f.hoja) return ''; const pr = X.precioFab(f, prov), m2 = p[1] * p[2] * p[3] / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000;
      return `<button class="ln" type="button" data-hoja="${i}"><span class="ln-t">${esc(f.nombre)} · ${p[1] > 1 ? p[1] + ' de ' : ''}${num(p[2])} × ${num(p[3])}</span><span class="ln-v">${pr.p != null ? dinero(m2 * pr.p * (1 + R.iva / 100) / hm2) : 'sin precio'}</span><span class="ln-s">${num(m2, 2)} m² · ${Math.round(m2 / hm2 * 100)} % de la hoja${p[4] ? ' · ' + esc(p[4]) : ''}</span></button>`; }).join('') || '<p class="mat-s" style="margin:4px 2px">Sin lámina ni vidrio.</p>')
      + '<button class="btn-nuevo" type="button" data-hoja="nueva">+ Lámina o vidrio</button>';
    cuerpo['s-cons'] = () => '<p class="mat-s" style="margin:0 2px 2px">Toca uno para cambiar cuántas puertas rinde en este modelo.</p>' + D().insumos.filter(i => i.grupo !== 'Accesorios').map(it => {
      const propio = Number((c.rend || {})[it.id]) || 0, r = propio || Number(it.r) || 0, l = x.lineas.find(y => y.n === it.nombre && y.g === it.grupo);
      const txt = !r ? (it.grupo === 'Pintura y masilla' ? 'Falta cuántas puertas rinde' : 'Sin dato: no se cuenta') : (r >= 1 ? 'rinde ' + num(r) + (r === 1 ? ' puerta' : ' puertas') : num(1 / r, 0) + ' por puerta') + (propio ? ' · de este modelo' : ' · general');
      return `<button class="ln" type="button" data-rend="${it.id}"><span class="ln-t">${esc(it.nombre)}</span><span class="ln-v"${!r && it.grupo === 'Pintura y masilla' ? ' style="color:var(--danger)"' : ''}>${l ? dinero(l.v) : !r && it.grupo === 'Pintura y masilla' ? 'Falta' : '·'}</span><span class="ln-s">${esc(txt)}</span></button>`; }).join('');
    cuerpo['s-herr'] = () => (Object.entries(c.acc || {}).map(([k, n]) => { const it = D().insumos.find(y => String(y.id) === String(k)); if(!it) return ''; const l = x.lineas.find(y => y.g === 'Accesorios' && y.n === it.nombre);
      return `<button class="ln" type="button" data-acc="${esc(k)}"><span class="ln-t">${num(n)} × ${esc(it.nombre)}</span><span class="ln-v">${l ? dinero(l.v) : ''}</span><span class="ln-s">${dinero(it.p)} sin IVA cada uno</span></button>`; }).join('') || '<p class="mat-s" style="margin:4px 2px">Sin herrajes.</p>')
      + '<button class="btn-nuevo" type="button" data-acc="nuevo">+ Herraje</button>';
    cuerpo['s-obra'] = () => x.lineas.filter(l => l.g === 'Mano de obra').map(l => `<div class="ln"><span class="ln-t">${esc(l.n)}</span><span class="ln-v">${dinero(l.v)}</span></div>`).join('')
      + `<div class="field-label" style="margin-top:10px">Categoría de pago</div><div class="opts" style="--cols:2">${D().categorias.filter(k => !m.tipo || k.producto === m.tipo).map(k => `<button class="opt ${x.cat && String(x.cat.id) === String(k.id) ? 'selected' : ''}" type="button" data-cat="${k.id}">${esc(k.nombre)}</button>`).join('') || '<p class="mat-s">No hay categorías de este producto.</p>'}</div>
      <p class="mat-s" style="margin:6px 2px 0">Las tarifas se cambian en <a href="categorias-pago.html" style="color:var(--accent);font-weight:800">Categorías de pago</a>.</p>`;
    cuerpo['s-extras'] = () => (D().extrasPendientes || []).filter(p => String(p.catalogo_id) === String(m.id)).map(p => `<div class="caja-amar">${p.n === 1 ? 'Se vendió 1' : 'Se vendieron ' + p.n} con ${esc(String(p.extra).toLowerCase())} y no tiene sus cortes. Cárgalos para saber cuánto cuesta.</div>`).join('')
      + x.lineas.filter(l => l.g === 'Extras incluidos').map(l => `<div class="ln"><span class="ln-t">${esc(l.n)}</span><span class="ln-v">${dinero(l.v)}</span><span class="ln-s">Viene en el modelo (tildado en el Catálogo): ya está en el costo</span></div>`).join('')
      + (x.extras.length ? x.extras.map((e, i) => `<button class="ln" type="button" data-extra="${i}"><span class="ln-t">${esc(e.n)}${e.ofrecer ? '' : ' · oculto'}</span><span class="ln-v"${e.listo ? '' : ' style="color:var(--amber)"'}>${e.listo ? dinero(e.venta) : 'Falta'}</span><span class="ln-s">${e.listo ? 'Cuesta ' + dinero(e.costo) + ' · sin gastos fijos' : 'Falta ' + esc(e.falta.join(', ')) + '. Se vende igual: la vendedora escribe el monto.'}</span></button>`).join('') : '<p class="mat-s" style="margin:4px 2px">Sin extras. Ejemplo: protección, marco decorativo, yeso.</p>')
      + '<button class="btn-nuevo" type="button" data-extra="nuevo">+ Extra</button>';
    cuerpo['s-notas'] = () => `<div class="field" style="margin-top:6px"><label class="field-label" for="fNotas">Notas</label><textarea class="input" id="fNotas" rows="2">${esc(c.notas || '')}</textarea><div class="field-hint">Se guardan al salir del campo. Las fotos del modelo se cambian en el Catálogo.</div></div>`;
    const der = { 's-hojas':dinero(suma(['Lámina','Vidrio'])), 's-cons':dinero(suma(['Pintura y masilla','Consumibles'])), 's-herr':dinero(suma(['Accesorios'])), 's-obra':dinero(suma(['Mano de obra'])),
      's-extras':x.extras.length ? plural(x.extras.length, '1 extra', 'extras') : 'ninguno', 's-notas':c.notas ? 'con nota' : 'sin nota' };
    h += SECS.map(([id, t]) => { const on = abiertos.has(id);
      return `<section class="fi-sec fi-acc${on ? ' on' : ''}" id="${id}"><button class="fi-acc-h" type="button" data-acc-t="${id}" aria-expanded="${on}"><span>${t}</span><span>${esc(der[id])} ${on ? '⌃' : '›'}</span></button>${on ? `<div class="fi-acc-b">${cuerpo[id]()}</div>` : ''}</section>`; }).join('');
    $('fichaBody').innerHTML = h;
    refrescar();
  }
  // Recalcula sin repintar las filas (para no perder el teclado): perfiles, barras, chips y la franja
  function refrescar(){
    const m = modelo(sel); if(!m || sel == null) return;
    aplicarBorrador();
    const x = X.costear(m.id, { prov, modo:'metro' }); if(!x) return;
    const suma = (gs) => x.lineas.filter(l => gs.includes(l.g)).reduce((a, l) => a + l.v, 0);
    document.querySelectorAll('#fichaBody [data-pf]').forEach(el => {
      const g = x.grupos.find(y => String(y.id) === String(el.dataset.pf));
      el.querySelector('.pf-v').textContent = g ? dinero(g.v) : 'sin precio';
      el.querySelector('.pf-s').textContent = g ? `${metrosC(g.cm)} / ${plural(g.barras.length, '1 barra', 'barras')} / sobra ${metrosC(g.barras.reduce((a, b) => a + (Number(b.libre) || 0), 0))}` : 'escribe cantidad y medida';
      el.querySelector('.pf-b').innerHTML = g ? barrasHtml(g) : '';
    });
    const tc = $('totCortes'); if(tc) tc.textContent = dinero(suma(['Hierro']));
    const idx = $('fiIdx');
    if(idx) idx.innerHTML = [['s-cortes','Cortes',suma(['Hierro'])],['s-hojas','Lámina',suma(['Lámina'])],['s-hojas','Vidrio',suma(['Vidrio'])],['s-cons','Pintura',suma(['Pintura y masilla','Consumibles'])],['s-herr','Herrajes',suma(['Accesorios'])],['s-obra','Obra',suma(['Mano de obra'])]]
      .map(([id, t, v]) => `<button class="fx" type="button" data-ir="${id}">${t} ${dinero(v)}</button>`).join('');
    pintarFranja(x);
  }
  // ---- Franja del precio, fija abajo: cerrada muestra el sugerido; al tocarla se abre en el mismo lugar
  function pintarFranja(x){
    const m = modelo(sel), dis = !!m.en_diseno, R = D().reglas;
    const dif = x.hoy != null ? r2(x.hoy - x.final) : null;
    const etq = x.falta.length ? '<span class="pill gris">faltan datos</span>' : dis ? '<span class="pill gris">en diseño</span>' : Math.abs(dif) < 0.005 ? '<span class="pill verde">igual al catálogo</span>' : dif < 0 ? `<span class="pill rojo">${dinero(-dif)} abajo</span>` : `<span class="pill verde">${dinero(dif)} arriba</span>`;
    const guardar = sucio() ? `<button class="btn-primary fr-guardar" type="button" data-guardar-cortes>Guardar cambios</button>` : '';
    if(!franja){
      $('fichaFoot').innerHTML = guardar + `<button class="fr-cab" type="button" data-franja aria-expanded="false"><span class="fr-l"><small>Precio sugerido · toca para ver más</small><b>${dinero(x.final)}</b></span><span class="fr-r">${etq}<small>${dis ? 'todavía no está en el catálogo' : 'catálogo ' + dinero(x.hoy)}</small></span></button>`;
      return;
    }
    const xm = X.costear(m.id, { prov, modo }), xt = X.costear(m.id, { prov, modo:'tubo' }), provs = D().proveedores.filter(p => (p.tipos || []).includes('hierro'));
    const precio = xm.final, puede = !xm.falta.length && !sucio();
    $('fichaFoot').innerHTML = `<div class="fr-scrim" data-franja></div><div class="fr-panel" role="region" aria-label="Precio del modelo">
      <button class="fr-cab abierta" type="button" data-franja aria-expanded="true"><span class="fr-l"><small>Precio sugerido</small><b>${dinero(xm.final)}</b></span><span class="fr-r">${etq}<small>toca para cerrar</small></span></button>
      <div class="field-label">Precios de</div>${chips(provs.map(p => [p.id, esc(provNom(p.id))]).concat([['barato', 'Más barato']]), prov, 'data-fprov')}
      <div class="opts" style="--cols:2;margin-top:10px"><button class="opt ${modo === 'metro' ? 'selected' : ''}" type="button" data-fmodo="metro">Por metro usado</button><button class="opt ${modo === 'tubo' ? 'selected' : ''}" type="button" data-fmodo="tubo">Barra completa</button></div>
      ${xm.avisos.map(a => `<div class="caja-amar">${esc(a)}</div>`).join('')}
      <div class="tot" style="margin-top:10px">
        <div class="fila"><span>1 · Costo de la puerta</span><b>${dinero(xm.costo)}</b></div>
        <div class="fila"><span>2 · Con ganancia (+${num(R.ganancia)} %)</span><b>${dinero(xm.venta)}</b></div>
        <div class="fila"><span>3 · + Gastos fijos (${dinero(R.gastosMes)} ÷ ${R.puertasMes})</span><b>${dinero(xm.fijos)}</b></div>
        <div class="fila fin"><span>Precio sugerido</span><span>${dinero(xm.final)}</span></div></div>
      <p class="mat-s" style="margin:6px 2px 0">${[modo === 'metro' ? 'con barra completa: ' + dinero(xt.final) : '', !dis ? 'hoy en catálogo ' + dinero(xm.hoy) + ', ganas ' + Math.round(xm.pct) + ' %' : ''].filter(Boolean).join(' · ')}</p>
      ${sucio() ? '<p class="mat-s" style="margin:6px 2px 0;color:var(--amber);font-weight:700">Guarda los cambios de los cortes antes de pasar el precio al catálogo.</p>' : ''}
      <button class="btn-primary" type="button" data-al-catalogo="${precio}" ${puede ? '' : 'disabled'} style="margin-top:10px">${dis ? 'Pasar al Catálogo: ' + dinero(precio) : 'Catálogo: ' + dinero(xm.hoy) + ' → ' + dinero(precio)}</button>
    </div>`;
  }
  function enfocarFila(i){ const el = document.querySelector(`#fichaBody [data-pz="${i}:n"]`); if(el){ el.focus(); el.scrollIntoView({ block:'center' }); } setTimeout(() => { nuevaFila = null; const f = document.querySelector('#fichaBody .pzf.nueva'); if(f) f.classList.remove('nueva'); }, 900); }
  async function alCatalogo(precio){
    const m = modelo(sel), eraDis = !!m.en_diseno, c0 = D().costeo[sel];
    if(!confirm(eraDis ? `¿Pasar ${m.nombre} al Catálogo con ${dinero(precio)}?` : `¿Cambiar el precio de ${m.nombre} en el Catálogo de ${dinero(m.precio_base)} a ${dinero(precio)}?`)) return;
    let nuevoSel = sel;
    const ok = await hacer(async () => { if(!c0.mid) await X.guardarCosteo(sel); const r = await X.rpc('costeo_pasar_catalogo', { mid:c0.mid, p_precio:Math.round(precio * 100) / 100 }); nuevoSel = r.catalogo_id; },
      eraDis ? 'Listo: ya está en el Catálogo. Ponle foto y categoría de pago allí.' : 'Precio cambiado en el Catálogo');
    if(ok){ sel = nuevoSel; franja = false; cargarBorrador(); pintar(); pintarFicha(); }
  }
  async function guardarCortes(){
    const mal = incompletas();
    if(mal.length){ const i = BOR.indexOf(mal[0]); toast('Revisa la cantidad y la medida de cada corte', 'error'); const el = document.querySelector(`[data-pz="${i}:${numLibre(mal[0].n) > 0 ? 'cm' : 'n'}"]`); if(el) el.focus(); return; }
    aplicarBorrador();
    const ok = await hacer(() => X.guardarCosteo(sel), 'Cortes guardados. El precio ya está al día.');
    if(ok){ cargarBorrador(); pintarFicha(); }
  }
  const r2 = X.r2;
  function pintarInicio(m){
    const cat = D().categorias.find(k => String(k.id) === String(m.categoria_pago_id)), md = medida(m), bs = bases();
    const de = ini.de != null ? modelo(ini.de) : null;
    let h = `<div class="fi-cat"><img src="${esc(foto(m))}" alt=""><div style="min-width:0"><b>Del Catálogo</b><span>${esc([m.tipo, md ? md + ' cm' : '', dinero(m.precio_base), 'pago: ' + (cat ? cat.nombre : 'sin categoría')].filter(Boolean).join(' · '))}</span>
      ${trae(m).length ? `<div class="fi-chips">${trae(m).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div></div>
      <p class="mat-s" style="margin:6px 2px 12px">Foto, medida, precio y lo que trae se cambian en el Catálogo.</p>`;
    h += `<div class="opt-grande ${ini.modo === 'copiar' ? 'on' : ''}" role="button" tabindex="0" data-ini="copiar"><b>Copiar de otro modelo</b><span>Trae todo y cambias solo lo distinto.</span>
      <div class="fi-chips" style="margin-top:8px">${bs.slice(0, 2).concat(de && !bs.slice(0, 2).includes(de) ? [de] : []).map(b => `<button type="button" class="fx ${ini.modo === 'copiar' && String(ini.de) === String(b.id) ? 'on' : ''}" data-ini-de="${esc(b.id)}">${esc(b.nombre)}</button>`).join('')}${bs.length > 2 ? '<button type="button" class="fx" data-buscar-base>Buscar…</button>' : ''}${!bs.length ? '<span class="mat-s">Todavía no hay otro modelo con cortes.</span>' : ''}</div></div>
      <div class="opt-grande ${ini.modo === 'estandar' ? 'on' : ''}" role="button" tabindex="0" data-ini="estandar"><b>Estructura estándar</b><span>Bastidor 3" x 1" (2 × 200 y 2 × 88), ${D().reglas.bisagras} bisagras y cerradura.</span></div>
      <div class="opt-grande ${ini.modo === 'blanco' ? 'on' : ''}" role="button" tabindex="0" data-ini="blanco"><b>En blanco</b><span>Para portones, ventanas o madera.</span></div>`;
    $('fichaBody').innerHTML = h;
    const txt = ini.modo === 'copiar' ? (de ? 'Copiar del ' + de.nombre : 'Elige de cuál copiar') : ini.modo === 'estandar' ? 'Empezar con la estructura estándar' : 'Empezar en blanco';
    $('fichaFoot').innerHTML = `<button class="btn-primary" type="button" data-empezar ${ini.modo === 'copiar' && !de ? 'disabled' : ''}>${esc(txt)}</button>`;
  }
  async function empezar(){
    const R = D().reglas; let c;
    if(ini.modo === 'copiar'){ const b = D().costeo[ini.de]; if(!b) return; c = Object.assign(JSON.parse(JSON.stringify(b)), { mid:null, estado:'borrador', notas:'' }); }
    else if(ini.modo === 'estandar'){ const bis = insumoDe('bisagra'), cer = insumoDe('cerradura'), acc = {}; if(bis) acc[bis.id] = R.bisagras; if(cer) acc[cer.id] = 1; c = { mid:null, estado:'borrador', piezas:bastidor(), hojas:[], rend:{}, acc, extras:[], notas:'' }; }
    else c = { mid:null, estado:'borrador', piezas:[], hojas:[], rend:{}, acc:{}, extras:[], notas:'' };
    D().costeo[sel] = c;
    const ok = await hacer(() => X.guardarCosteo(sel), ini.modo === 'copiar' ? 'Copiado. Cambia solo lo que sea distinto.' : ini.modo === 'estandar' ? 'Estructura puesta. Agrega los cortes propios del modelo.' : 'Listo. Agrega su primer corte.');
    if(!ok) delete D().costeo[sel];
    pintarFicha();
  }

  // ================= Precios =================
  // Precios (C4): tabla material × proveedor, el precio sin IVA se escribe en la celda; el más barato en verde.
  // Un solo "Guardar precios (N cambios)". Pintura, consumibles y herrajes tienen un solo precio.
  const FILP = { perfiles:'Perfiles', laminas:'Láminas', vidrio:'Vidrio', aluminio:'Aluminio', 'Pintura y masilla':'Pintura', Consumibles:'Consumibles', Accesorios:'Herrajes' };
  const esFabP = (k) => ['perfiles','laminas','vidrio','aluminio'].includes(k);
  const matsP = (k) => D().fab.filter(f => f.activo && (k === 'perfiles' ? f.tipo === 'hierro' && f.pres === 'barra' : f.tipo === k));
  let PRE = {};   // cambios sin guardar: 'f:mid:prov' o 'i:id' -> texto
  function pintarFiltrosPrecios(){
    $('filtros').querySelector('.mostrar-t').textContent = 'Ver';
    const ks = Object.keys(FILP).filter(k => !esFabP(k) || matsP(k).length || k === 'perfiles');
    if(!ks.includes(filPrecios)) filPrecios = 'perfiles';
    $('filtrosL').innerHTML = ks.map(k => `<button type="button" class="fx ${k === filPrecios ? 'on' : ''}" data-filp="${esc(k)}">${FILP[k]}</button>`).join('');
  }
  const pn = (k) => provNom(k);
  const valPre = (k, base) => PRE[k] != null ? PRE[k] : base;
  const nCambios = () => Object.keys(PRE).length;
  const txtGuardarP = () => 'Guardar precios (' + (nCambios() === 1 ? '1 cambio' : nCambios() + ' cambios') + ')';
  const dos = (v) => v === '' || v == null || !isFinite(Number(v)) ? '' : Number(v).toFixed(2);
  function secPrecios(){
    const d = D(), R = d.reglas;
    $('subtitulo').textContent = 'Precios sin IVA, como en la factura';
    let h = '';
    if(esFabP(filPrecios)){
      const tipo = filPrecios === 'perfiles' ? 'hierro' : filPrecios, L = matsP(filPrecios);
      const provs = d.proveedores.filter(p => (p.tipos || []).includes(tipo) || L.some(f => (f.precios || {})[p.id]));
      h += `<div class="pre-wrap${provs.length >= 4 ? ' ancha' : ''}"><table class="pre"><thead><tr><th>Material</th>${provs.map(p => `<th>${esc(pn(p.id))}</th>`).join('')}</tr></thead><tbody>
        ${L.map(f => `<tr data-pre-fila="${f.id}"><th><button type="button" class="pre-mat" data-mat="${f.id}"><b>${esc(f.nombre)}</b><small>${f.pres === 'barra' ? 'barra ' + num(f.largo / 100) + ' m' : f.hoja ? 'hoja ' + num(f.hoja[0]) + ' × ' + num(f.hoja[1]) : ''}</small></button></th>
          ${provs.map(p => { const act = (f.precios || {})[p.id], k = 'f:' + f.id + ':' + p.id;
            return `<td><input class="pre-in" data-pre="${k}" inputmode="decimal" value="${esc(valPre(k, act ? dos(act.p) : ''))}" placeholder="·" aria-label="${esc(f.nombre)} en ${esc(pn(p.id))}"></td>`; }).join('')}</tr>`).join('')
        || `<tr><td colspan="${provs.length + 1}"><p class="mat-s" style="margin:8px 2px">No hay materiales de este tipo.</p></td></tr>`}</tbody></table></div>`;
    } else {
      const L = d.insumos.filter(i => i.grupo === filPrecios);
      h += `<div class="pre-wrap"><table class="pre"><thead><tr><th>${filPrecios === 'Accesorios' ? 'Herraje' : 'Material'}</th><th>Precio</th></tr></thead><tbody>
        ${L.map(i => { const k = 'i:' + i.id; return `<tr><th><button type="button" class="pre-mat" data-insumo="${i.id}"><b>${esc(i.nombre)}</b><small>${i.grupo === 'Accesorios' ? 'por unidad' : i.r ? 'rinde ' + num(i.r) + (Number(i.r) === 1 ? ' puerta' : ' puertas') : 'lo pone cada modelo'}</small></button></th>
          <td><input class="pre-in" data-pre="${k}" inputmode="decimal" value="${esc(valPre(k, dos(i.p)))}" aria-label="Precio de ${esc(i.nombre)}"></td></tr>`; }).join('')
        || '<tr><td colspan="2"><p class="mat-s" style="margin:8px 2px">No hay nada aquí todavía.</p></td></tr>'}</tbody></table></div>`;
    }
    h += `<p class="mat-s" style="margin:10px 2px 0">${esFabP(filPrecios) ? 'En verde el más barato. ' : ''}Al guardar se recalculan todos los modelos.</p>
      <div class="pre-atajos">${esFabP(filPrecios) ? '<button class="fx" type="button" data-mat="nuevo">+ Material</button>' : `<button class="fx" type="button" data-insumo="nuevo">+ ${filPrecios === 'Accesorios' ? 'Herraje' : filPrecios === 'Consumibles' ? 'Consumible' : 'Pintura o masilla'}</button>`}<button class="fx" type="button" data-prov-nuevo>+ Proveedor</button><button class="fx" type="button" data-reglas>Reglas: IVA ${num(R.iva)} % · ganancia ${num(R.ganancia)} %</button></div>
      <button class="btn-secondary" type="button" data-pdf-precios style="width:100%;margin-top:12px">Lista de precios en PDF</button>
      <div class="pre-pie${nCambios() ? '' : ' hidden'}" id="prePie"><button class="btn-primary" type="button" data-guardar-precios>${txtGuardarP()}</button></div>`;
    setTimeout(marcarBaratos, 0);
    return h;
  }
  // El más barato de cada fila en verde (con lo que está escrito, aunque no se haya guardado)
  function marcarBaratos(){
    document.querySelectorAll('#cont tr[data-pre-fila]').forEach(tr => {
      const ins = [...tr.querySelectorAll('.pre-in')], vs = ins.map(i => numLibre(i.value)), min = Math.min(...vs.filter(v => v > 0));
      ins.forEach((i, j) => i.classList.toggle('barato', vs[j] > 0 && vs[j] === min && vs.filter(v => v > 0).length > 1));
    });
  }
  function cambioPrecio(el){
    const k = el.dataset.pre, [t, a, b] = k.split(':');
    const base = t === 'f' ? (((fabDe(a) || {}).precios || {})[b] || {}).p : (D().insumos.find(i => String(i.id) === a) || {}).p;
    const v = String(el.value).trim();
    if(v === '' && base != null) delete PRE[k];          // borrar no quita el precio: se queda el de antes
    else if(base != null && numLibre(v) === Number(base)) delete PRE[k];
    else if(v === '') delete PRE[k];
    else PRE[k] = v;
    el.classList.toggle('mal', v !== '' && !(numLibre(v) > 0));
    const pie = $('prePie'); if(pie){ pie.classList.toggle('hidden', !nCambios()); pie.querySelector('button').textContent = txtGuardarP(); }
    marcarBaratos();
  }
  async function guardarPrecios(){
    const ks = Object.keys(PRE);
    for(const k of ks) if(!(numLibre(PRE[k]) > 0)){ const el = document.querySelector(`[data-pre="${k}"]`); if(el){ el.classList.add('mal'); el.focus(); } toast('Revisa ese precio: escribe un número mayor que 0', 'error'); return; }
    if(ocupado) return; ocupado = true;
    const btn = document.querySelector('[data-guardar-precios]'); if(btn) btn.disabled = true;
    let hechos = 0;
    try{
      for(const k of ks){
        const [t, a, b] = k.split(':'), v = Math.round(numLibre(PRE[k]) * 100) / 100;
        if(t === 'f'){ const act = ((fabDe(a) || {}).precios || {})[b] || {}; await X.rpc('material_precio_guardar', { p:{ material_id:Number(a), proveedor_id:Number(b), precio:v, espesor:act.esp || null } }); }
        else { const i = D().insumos.find(y => String(y.id) === a); await X.rpc('costeo_insumo_guardar', { p:{ id:i.id, nombre:i.nombre, grupo:i.grupo, precio:v, rendimiento:Number(i.r) > 0 ? Number(i.r) : null } }); }
        delete PRE[k]; hechos++;
      }
      toast(hechos === 1 ? 'Precio guardado. Los modelos se recalcularon.' : hechos + ' precios guardados. Los modelos se recalcularon.');
    } catch(e){
      const m = String((e && e.message) || '');
      toast(/fetch|network|Failed/i.test(m) ? 'No se guardaron los precios. Revisa la conexión y toca Guardar otra vez.' : (m || 'No se guardaron los precios'), 'error');
    } finally { ocupado = false; try{ await recargar(); } catch(_){} }
  }
  async function pdfPrecios(){
    const d = D(), b = [];
    d.fab.filter(f => f.activo).forEach(f => { const ps = Object.entries(f.precios || {}).map(([k, v]) => ({ k, p:Number(v.p) })).sort((a, c) => a.p - c.p); if(!ps.length) return;
      b.push({ t:'sub', texto:f.nombre, der:f.pres === 'barra' ? 'barra de ' + num(f.largo / 100) + ' m' : 'hoja ' + f.hoja[0] + ' × ' + f.hoja[1] });
      ps.forEach((p, i) => b.push({ t:'fila', a:provNom(p.k) + (i === 0 && ps.length > 1 ? ' (el más barato)' : ''), b:dinero(p.p) })); });
    b.push({ t:'titulo', texto:'Pintura, consumibles y herrajes' });
    d.insumos.forEach(i => b.push({ t:'fila', a:i.nombre + ' · ' + (i.grupo === 'Accesorios' ? 'Herrajes' : i.grupo), b:dinero(i.p) }));
    b.push({ t:'nota', texto:'Precios sin IVA. Costos les suma el IVA al calcular cada modelo.' });
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo:'Lista de precios', derecha:new Date().toLocaleDateString('es-VE'), subtitulo:'Por material y proveedor.', bloques:b });
      const r = await window.PDFR.compartir(blob, 'Lista-de-precios.pdf'); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }

  // ================= Formularios (hoja encima de la ficha) =================
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${valor != null && String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  const chips = (lista, valor, attr) => `<div class="fi-opc">${lista.map(([v, t]) => `<button class="fx ${valor != null && String(valor) === String(v) ? 'on' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  const campo = (id, label, val, extra, modoT) => `<div class="field" id="c_${id}"><label class="field-label" for="${id}">${label}</label><input class="input" id="${id}" ${modoT ? '' : 'inputmode="decimal"'} value="${esc(val == null ? '' : val)}"><div class="field-error">Revisa este dato</div>${extra ? `<div class="field-hint">${extra}</div>` : ''}</div>`;
  function abrirForm(f){ F = f; pintarForm(); abrirHoja('sheetForm'); }
  // Buscador de material dentro de la hoja (sin listas desplegables)
  function selector(pres){
    const t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const L = D().fab.filter(f => f.activo && f.pres === pres && (!F.bm || t(f.nombre).includes(t(F.bm))));
    return `<label class="search-box" style="margin:0 0 8px"><input id="fBuscaMat" type="search" placeholder="Buscar material" aria-label="Buscar material" value="${esc(F.bm || '')}" autocomplete="off"></label>
      <div id="listaMat">${L.map(f => `<button class="ln" type="button" data-f-mat="${f.id}"><span class="ln-t">${esc(f.nombre)}</span><span class="ln-v">${String(f.id) === String(F.mat) ? '✓' : ''}</span><span class="ln-s">${f.pres === 'barra' ? 'barra de ' + num(f.largo) + ' cm' : 'hoja ' + num(f.hoja[0]) + ' × ' + num(f.hoja[1]) + ' cm'}</span></button>`).join('') || '<p class="mat-s">No hay materiales con ese nombre.</p>'}</div>
      <button class="btn-nuevo" type="button" data-ir-precios>¿No está? Agrégalo en Costos › Precios</button>`;
  }
  // ---- Extras: tipos, lo que lleva el formulario y cuánto cuesta
  const EXK = ['Protección', 'Marco decorativo', 'Yeso', 'Vitrales', 'Farquilla', 'Ecobel', 'Detalles de ventana', 'Ventana con protección', 'Manillón'];
  function extraDeF(){
    const n = F.kind === 'Otro' ? String(F.n || '').trim() : (F.kind || ''), prot = /^protecci/i.test(n), sin = /^manill/i.test(n);
    const mano = (prot && F.manoModo !== 'propia') || String(F.mano == null ? '' : F.mano).trim() === '' ? null : numLibre(F.mano);
    return { id:F.id || null, n, v:sin ? (numLibre(F.v) || 0) : 0, piezas:sin ? [] : F.piezas, ofrecer:F.ofr !== 'no', sin_cortes:sin, mano };
  }
  function resumenExtra(){
    const e = extraDeF(); if(!e.n) return '<span>Costo</span>Elige qué extra es.';
    const x = X.costearExtra(D().costeo[sel], modelo(sel) || {}, Object.assign({}, e, { mano:Number.isFinite(e.mano) ? e.mano : null }), prov);
    const mo = x.lineas.filter(l => l.g === 'Mano de obra');
    if(!x.listo) return `<span>Falta</span>${esc(x.falta.join(', '))}. Se puede vender igual: la vendedora escribe el monto y sale el aviso.${mo.length ? '<br>Mano de obra: ' + mo.map(l => esc(l.n) + ' ' + dinero(l.v)).join(' · ') : ''}`;
    return `<span>Cuesta ${dinero(x.costo)}</span>${x.lineas.map(l => esc(l.n) + ' ' + dinero(l.v)).join(' · ')}<br>Se cobra al cliente <b>${dinero(x.venta)}</b>. Sin gastos fijos.`;
  }
  // Otros modelos que ya tienen los cortes de ese extra
  const copiables = (n) => { const k = X.claveExtra(n); return D().catalogo.concat(D().enDiseno).filter(m => String(m.id) !== String(sel) && D().costeo[m.id])
    .map(m => ({ id:m.id, nombre:m.nombre, ex:(D().costeo[m.id].extras || []).find(e => X.claveExtra(e.n) === k && (e.piezas || []).length) })).filter(o => o.ex); };
  function abrirExtra(i){
    const c = D().costeo[sel], o = i === 'nuevo' ? null : c.extras[i];
    if(!o) return abrirForm({ t:'extra', i:'nuevo', kind:null, n:'', v:'', piezas:[], ofr:'si', mano:'', manoModo:'cat' });
    abrirForm({ t:'extra', i, id:o.id, kind:EXK.includes(o.n) ? o.n : 'Otro', n:o.n, v:o.v || '', piezas:JSON.parse(JSON.stringify(o.piezas || [])), ofr:o.ofrecer === false ? 'no' : 'si', mano:o.mano == null ? '' : o.mano, manoModo:o.mano == null ? 'cat' : 'propia' });
  }
  // Abre el extra de un modelo por su clave (proteccion, marco_decorativo); si no existe, uno nuevo de ese tipo
  function abrirExtraClave(k){
    const c = D().costeo[sel]; if(!c) return;
    const i = (c.extras || []).findIndex(e => X.claveExtra(e.n) === k);
    if(i >= 0) return abrirExtra(i);
    abrirExtra('nuevo'); F.kind = EXK.find(n => X.claveExtra(n) === k) || null; pintarForm();
  }
  // ---- Elige el perfil (C2, tercera pantalla): buscador, filtros por tipo y el precio del proveedor elegido
  const CATP = [['Tubos', /^tubo/i], ['Platinas', /^platina/i], ['Marcos', /^marco/i], ['Otros', null]];
  const catPerfil = (f) => { const c = CATP.find(([, r]) => r && r.test(f.nombre)); return c ? c[0] : 'Otros'; };
  const normT = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function pintarPerfil(){
    $('formTitulo').textContent = 'Elige el perfil';
    const todos = D().fab.filter(f => f.activo && f.pres === 'barra'), cats = CATP.map(c => c[0]).filter(k => todos.some(f => catPerfil(f) === k));
    if(!cats.includes(F.cat)) F.cat = cats[0];
    const L = todos.filter(f => F.bm ? normT(f.nombre).includes(normT(F.bm)) : catPerfil(f) === F.cat);
    $('formBody').innerHTML = `<p class="mat-s" style="margin:-4px 2px 10px">Precio sin IVA de ${esc(provNom(prov))}.</p>
      <label class="search-box" style="margin:0 0 8px"><input id="fBuscaMat" type="search" placeholder="Buscar: tubo, platina, marco…" aria-label="Buscar perfil" value="${esc(F.bm || '')}" autocomplete="off"></label>
      ${F.bm ? '' : chips(cats.map(k => [k, k]), F.cat, 'data-fcat')}
      <div id="listaMat" style="margin-top:8px">${L.map(f => { const pr = X.precioFab(f, prov), ks = Object.keys(f.precios || {});
        return `<button class="ln" type="button" data-elige-perfil="${f.id}"><span class="ln-t">${esc(f.nombre)}</span><span class="ln-v">${pr.p != null ? dinero(pr.p) : 'sin precio'}</span><span class="ln-s">barra ${num(f.largo / 100)} m${ks.length === 1 ? ' · solo ' + esc(provNom(ks[0])) : ''}</span></button>`; }).join('') || '<p class="mat-s">No hay perfiles con ese nombre.</p>'}</div>
      <button class="btn-nuevo" type="button" data-mat-nuevo-perfil>+ Material nuevo</button>`;
    $('formFoot').innerHTML = ''; $('formFoot').style.display = 'none';
  }
  // ---- + Nuevo (C1, segunda pantalla): un modelo en diseño o un extra de un modelo
  const conCortes = () => D().catalogo.concat(D().enDiseno).filter(c => D().costeo[c.id] && D().costeo[c.id].piezas.length && c.tipo !== 'Puerta de Madera');
  function leerNuevo(){ const a = $('nvNom'), b = $('nvN'); if(a) F.nombre = a.value; if(b) F.n = b.value; }
  function pintarNuevo(){
    $('formTitulo').textContent = 'Nuevo';
    let h = `<p class="mat-s" style="margin:-4px 2px 10px">${F.que === 'modelo' ? 'Queda en diseño. Pasa al Catálogo con el botón de la franja del precio.' : 'Un extra va dentro de un modelo y se cobra aparte.'}</p>
      <div class="field"><span class="field-label">¿Qué es?</span>${opts([['modelo','Modelo'],['extra','Extra']], F.que, 'data-nv-que')}</div>`;
    if(F.que === 'modelo'){
      const bs = conCortes(), de = F.de != null ? modelo(F.de) : null;
      h += `<div class="field" id="c_nvNom"><label class="field-label" for="nvNom">Nombre</label><input class="input" id="nvNom" maxlength="60" value="${esc(F.nombre)}" autocomplete="off"><div class="field-error">Escribe el nombre</div></div>
        <div class="field"><span class="field-label">Tipo</span>${opts([['Puerta Multilock','Puerta'],['Portón','Portón'],['Ventana','Ventana'],['Combo','Combo']], F.tipo, 'data-nv-tipo', 4)}</div>
        <div class="field"><span class="field-label">Empezar</span>
        <div class="opt-grande ${F.modo === 'copiar' ? 'on' : ''}" role="button" tabindex="0" data-nv-modo="copiar"><b>Copiar de otro modelo</b><span>${de ? esc(de.nombre) + ' · cambias solo lo distinto' : 'Elige de cuál'}</span>
          ${F.modo === 'copiar' ? `<div class="fi-chips" style="margin-top:8px">${bs.slice(0, 8).map(b => `<button type="button" class="fx ${String(F.de) === String(b.id) ? 'on' : ''}" data-nv-de="${esc(b.id)}">${esc(b.nombre)}</button>`).join('') || '<span class="mat-s">Todavía no hay modelos con cortes.</span>'}</div>` : ''}</div>
        <div class="opt-grande ${F.modo === 'estandar' ? 'on' : ''}" role="button" tabindex="0" data-nv-modo="estandar"><b>Estructura estándar</b><span>bastidor 3"x1": 2 × 200 y 2 × 88 cm</span></div>
        <div class="opt-grande ${F.modo === 'blanco' ? 'on' : ''}" role="button" tabindex="0" data-nv-modo="blanco"><b>En blanco</b><span>para portones, ventanas o algo distinto</span></div></div>`;
    } else {
      const ms = D().catalogo.concat(D().enDiseno).filter(m => D().costeo[m.id] && m.tipo !== 'Puerta de Madera' && (!F.bm || normT(m.nombre).includes(normT(F.bm))));
      h += `<div class="field" id="c_nvMod"><span class="field-label">¿De qué modelo?</span><label class="search-box" style="margin:0 0 8px"><input id="nvBusca" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="${esc(F.bm || '')}" autocomplete="off"></label>
        <div class="fi-chips">${ms.slice(0, 10).map(m => `<button type="button" class="fx ${String(F.mid) === String(m.id) ? 'on' : ''}" data-nv-mod="${esc(m.id)}">${esc(m.nombre)}</button>`).join('') || '<span class="mat-s">No hay modelos costeados con ese nombre.</span>'}</div><div class="field-error">Elige el modelo</div></div>
        <div class="field" id="c_nvKind"><span class="field-label">Qué extra</span>${chips(EXK.concat(['Otro']).map(k => [k, k]), F.kind, 'data-nv-kind')}<div class="field-error">Elige qué extra es</div></div>
        ${F.kind === 'Otro' ? `<div class="field" id="c_nvN"><label class="field-label" for="nvN">Nombre del extra</label><input class="input" id="nvN" maxlength="40" value="${esc(F.n || '')}" autocomplete="off"><div class="field-error">Escribe el nombre</div></div>` : ''}`;
    }
    $('formBody').innerHTML = h;
    $('formFoot').innerHTML = '<button class="btn-primary" type="button" data-nv-crear style="flex:1">Crear y abrir</button>'; $('formFoot').style.display = 'flex';
  }
  async function crearNuevo(){
    leerNuevo();
    if(F.que === 'extra'){
      if(!F.mid){ $('c_nvMod').classList.add('invalid'); return; }
      if(!F.kind || (F.kind === 'Otro' && !String(F.n || '').trim())){ ($(F.kind === 'Otro' ? 'c_nvN' : 'c_nvKind') || {}).classList.add('invalid'); return; }
      const mid = F.mid, kind = F.kind, n = String(F.n || '').trim();
      cerrarHoja('sheetForm', true); F = null; abrirFicha(mid); abrirExtra('nuevo'); F.kind = kind; if(kind === 'Otro') F.n = n; pintarForm(); return;
    }
    const nombre = String(F.nombre || '').trim();
    if(!nombre){ $('c_nvNom').classList.add('invalid'); return; }
    if(F.modo === 'copiar' && !(F.de != null && D().costeo[F.de])){ toast('Elige de cuál modelo copiar', 'error'); return; }
    const R = D().reglas; let c;
    if(F.modo === 'copiar') c = Object.assign(JSON.parse(JSON.stringify(D().costeo[F.de])), { mid:null, estado:'borrador', notas:'', extras:(D().costeo[F.de].extras || []).map(e => Object.assign({}, e, { id:null })) });
    else if(F.modo === 'estandar'){ const bis = insumoDe('bisagra'), cer = insumoDe('cerradura'), acc = {}; if(bis) acc[bis.id] = R.bisagras; if(cer) acc[cer.id] = 1; c = { mid:null, estado:'borrador', piezas:bastidor(), hojas:[], rend:{}, acc, extras:[], notas:'' }; }
    else c = { mid:null, estado:'borrador', piezas:[], hojas:[], rend:{}, acc:{}, extras:[], notas:'' };
    D().enDiseno.push({ id:'nuevo', nombre, tipo:F.tipo, precio_base:0, en_diseno:true }); D().costeo.nuevo = c;
    let nid = null;
    const ok = await hacer(async () => { const r = await X.guardarCosteo('nuevo'); nid = 'd' + r.id; }, 'Creado en diseño. Escribe o cambia sus cortes.');
    if(ok && nid){ cerrarHoja('sheetForm', true); F = null; filtro = 'Todos'; pintar(); abrirFicha(nid); }
  }
  function leerProv(){ const a = $('pvNom'), b = $('pvTel'); if(a) F.nombre = a.value; if(b) F.tel = b.value; }
  function pintarProvNuevo(){
    $('formTitulo').textContent = 'Proveedor nuevo';
    $('formBody').innerHTML = `<div class="field" id="c_pvNom"><label class="field-label" for="pvNom">Nombre</label><input class="input" id="pvNom" maxlength="80" value="${esc(F.nombre)}" autocomplete="off"><div class="field-error">Escribe el nombre</div></div>
      <div class="field"><label class="field-label" for="pvTel">WhatsApp</label><input class="input" id="pvTel" inputmode="tel" maxlength="20" value="${esc(F.tel)}" autocomplete="off"></div>
      <div class="field"><span class="field-label">Qué vende</span><div class="fi-opc">${Object.entries(TIPO).map(([v, t]) => `<button class="fx ${F.tipos.includes(v) ? 'on' : ''}" type="button" data-pv-tipo="${v}">${t}</button>`).join('')}</div></div>
      <div class="field"><span class="field-label">¿Cobra IVA?</span>${opts([['si','Sí'],['no','No']], F.iva ? 'si' : 'no', 'data-pv-iva')}</div>
      <p class="mat-s" style="margin:0 2px">Su ficha y su estado de cuenta quedan en Finanzas. Sus precios se escriben aquí, en la tabla.</p>`;
    $('formFoot').innerHTML = '<button class="btn-primary" type="button" data-pv-guardar style="flex:1">Guardar proveedor</button>'; $('formFoot').style.display = 'flex';
  }
  async function guardarProv(){
    leerProv();
    if(!String(F.nombre).trim()){ $('c_pvNom').classList.add('invalid'); return; }
    if(!F.tipos.length){ toast('Elige qué vende', 'error'); return; }
    const ok = await hacer(() => X.rpc('proveedor_guardar', { p:{ nombre:F.nombre.trim(), telefono:String(F.tel || '').trim(), tipos:F.tipos.slice(), cobra_iva:!!F.iva } }), 'Proveedor guardado. Escribe sus precios en la tabla.');
    if(ok){ cerrarHoja('sheetForm', true); F = null; pintar(); }
  }
  function pintarForm(){
    if(F.t === 'perfil') return pintarPerfil();
    if(F.t === 'nuevo') return pintarNuevo();
    if(F.t === 'provnuevo') return pintarProvNuevo();
    $('formFoot').style.display = 'flex';
    const d = D(); let h = '', boton = 'Guardar', borrar = false, txtBorrar = 'Quitar';
    if(F.t === 'pieza' || F.t === 'hoja'){
      const f = fabDe(F.mat), pres = F.t === 'pieza' ? 'barra' : 'hoja';
      $('formTitulo').textContent = F.t === 'pieza' ? (F.i === 'nueva' ? 'Pieza nueva' : 'Pieza') : (F.i === 'nueva' ? 'Lámina o vidrio' : (f ? f.nombre : 'Hoja'));
      if(F.pick){ $('formBody').innerHTML = selector(pres); $('formFoot').innerHTML = '<button class="btn-secondary" type="button" data-f-pick="no" style="width:100%">Volver</button>'; return; }
      h = `<div class="field"><span class="field-label">Material</span><button class="fi-sel" type="button" data-f-pick="si"><span>${f ? esc(f.nombre) : 'Elegir material'}</span><b>Cambiar</b></button></div>`;
      if(F.t === 'pieza'){
        h += `<div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fCm', 'Medida (cm)', F.cm)}</div>
          <div class="field" id="c_fQue"><span class="field-label">Qué es</span>${chips(QUE.map(v => [v, v === 'Otra' ? 'Otra…' : v]), F.que, 'data-f-que')}<div class="field-error">Elige qué es</div></div>
          ${F.que === 'Otra' ? `<div class="field" id="c_fNota"><label class="field-label" for="fNota">¿Qué pieza es?</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-error">Escribe qué pieza es</div></div>` : ''}
          <div class="field" id="c_fOri"><span class="field-label">Va</span>${opts([['V','Vertical'],['H','Horizontal']], F.ori, 'data-f-ori')}<div class="field-error">Elige si va vertical u horizontal</div></div>
          <p class="mat-s" style="margin:-8px 2px 4px">"Qué es" y "Va" sirven después para dibujar la puerta en 3D.</p>`;
      } else {
        const m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f && f.hoja ? f.hoja[0] * f.hoja[1] / 10000 : 1;
        h += `<div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fA', 'Ancho (cm)', F.a)}</div>${campo('fH', 'Alto (cm)', F.h)}
          <div class="field"><label class="field-label" for="fNota">Para qué es</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-hint">Ejemplo: panel, franja de vidrio.</div></div>
          ${f && f.hoja ? `<div class="caja-nota" id="cajaHoja"><span>Uso de la hoja</span>${num(m2, 3)} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b></div>` : ''}`;
      }
      borrar = F.i !== 'nueva';
    }
    if(F.t === 'acc'){
      $('formTitulo').textContent = F.nuevo ? 'Herraje nuevo' : 'Herraje';
      h = `<div class="field"><span class="field-label">Herraje</span>${opts(d.insumos.filter(i => i.grupo === 'Accesorios').map(i => [i.id, esc(i.nombre) + '<br><small style="font-weight:600">' + dinero(i.p) + ' sin IVA</small>']), F.k, 'data-f-acc', 1)}</div>${campo('fCant', 'Cantidad por puerta', F.cant)}`;
      borrar = !F.nuevo;
    }
    if(F.t === 'rend'){
      const it = d.insumos.find(i => String(i.id) === String(F.id));
      $('formTitulo').textContent = it.nombre;
      h = `${campo('fRend', '¿Cuántas puertas rinde 1 en este modelo?', F.r, 'Si se usan 2 por puerta, escribe 0,5.')}
        <div class="caja-nota"><span>General</span>${it.r ? 'Rinde ' + num(it.r) + (Number(it.r) === 1 ? ' puerta' : ' puertas') + '. Se usa en todos los modelos que no digan otra cosa.' : 'Sin rendimiento general: cada modelo pone el suyo.'} El general se cambia en Costos › Precios.</div>`;
      borrar = F.propio; txtBorrar = 'Usar el general';
    }
    if(F.t === 'extra'){
      const e = extraDeF();
      if(F.sub === 'pieza'){
        $('formTitulo').textContent = 'Corte de ' + (e.n || 'el extra').toLowerCase();
        if(F.pick){ $('formBody').innerHTML = selector('barra'); $('formFoot').innerHTML = '<button class="btn-secondary" type="button" data-f-pick="no" style="width:100%">Volver</button>'; return; }
        const f = fabDe(F.mat);
        h = `<div class="field"><span class="field-label">Material</span><button class="fi-sel" type="button" data-f-pick="si"><span>${f ? esc(f.nombre) : 'Elegir material'}</span><b>Cambiar</b></button></div>
          <div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fCm', 'Medida (cm)', F.cm)}</div>`;
        boton = 'Listo'; borrar = F.pi !== 'nueva';
      } else if(F.sub === 'copiar'){
        $('formTitulo').textContent = 'Copiar cortes';
        const L = copiables(e.n);
        $('formBody').innerHTML = `<p class="mat-s" style="margin:0 2px 8px">Modelos que ya tienen los cortes de ${esc((e.n || 'este extra').toLowerCase())}. Después los puedes cambiar.</p>
          ${L.map(o => `<button class="ln" type="button" data-fx-de="${esc(o.id)}"><span class="ln-t">${esc(o.nombre)}</span><span class="ln-v"></span><span class="ln-s">${plural(o.ex.piezas.length, '1 corte', 'cortes')}</span></button>`).join('') || '<div class="vacio-d"><b>Ningún modelo lo tiene</b>Carga los cortes con "+ Pieza".</div>'}`;
        $('formFoot').innerHTML = '<button class="btn-secondary" type="button" data-fx-sub="" style="width:100%">Volver</button>'; return;
      } else {
        $('formTitulo').textContent = F.i === 'nuevo' ? 'Extra nuevo' : e.n || 'Extra';
        const prot = /^protecci/i.test(e.n || '');
        h = `<div class="field"><span class="field-label">¿Qué extra es?</span>${opts(EXK.concat('Otro').map(k => [k, k]), F.kind, 'data-f-kind')}</div>
          ${F.kind === 'Otro' ? `<div class="field" id="c_fN"><label class="field-label" for="fN">Nombre</label><input class="input" id="fN" value="${esc(F.n || '')}"><div class="field-error">Escribe el nombre</div></div>` : ''}
          <div class="field"><span class="field-label">En el Catálogo y la venta</span>${opts([['si','Se ofrece'],['no','Oculto']], F.ofr, 'data-fx-ofr')}<div class="field-hint">${F.ofr === 'no' ? 'Oculto: la vendedora no ve su precio.' : 'La vendedora ve su precio cuando el cliente lo pide.'}</div></div>`;
        if(e.sin_cortes) h += campo('fV', 'Cuánto te cuesta (con IVA)', F.v, 'No lleva cortes: solo su precio.');
        else {
          h += `<div class="field-label" style="margin-top:6px">Cortes</div>` + (F.piezas.length ? F.piezas.map((z, i) => { const f = fabDe(z[0]) || { nombre:'Material' };
            return `<button class="pzr" type="button" data-fx-pz="${i}"><span class="pzr-n">${z[1]}</span><span class="pzr-n pzr-cm">${num(z[2], z[2] % 1 ? 1 : 0)}</span><span class="pzr-t">${esc(f.nombre)}</span>${CHEV}</button>`; }).join('') : '<p class="mat-s" style="margin:4px 2px">Sin cortes todavía.</p>');
          h += `<div class="input-row" style="margin:8px 0 14px"><button class="btn-nuevo" type="button" data-fx-pz="nueva" style="margin:0">+ Pieza</button><button class="btn-nuevo" type="button" data-fx-sub="copiar" style="margin:0">Copiar de otro modelo</button></div>`;
        }
        if(prot) h += `<div class="field"><span class="field-label">Mano de obra</span>${opts([['cat','La de la categoría'],['propia','Otro monto']], F.manoModo, 'data-fx-mano')}</div>`;
        if(!prot || F.manoModo === 'propia') h += campo('fMano', 'Mano de obra del extra ($)', F.mano, prot ? 'Lo que se le paga al trabajador por la protección.' : 'Lo que se le paga al trabajador por este extra. Vacío si no se paga aparte.');
        h += `<div class="caja-nota" id="cajaExtra">${resumenExtra()}</div>`;
        borrar = F.i !== 'nuevo';
      }
    }
    if(F.t === 'precio'){
      const m = modelo(sel), x = X.costear(m.id, { prov, modo }), xt = X.costear(m.id, { prov, modo:'tubo' }), R = d.reglas, s = X.semaforo(x), dis = !!m.en_diseno;
      const provs = d.proveedores.filter(p => (p.tipos || []).includes('hierro'));
      $('formTitulo').textContent = 'Precio del ' + m.nombre;
      const compara = provs.length > 1 ? provs.map(p => ({ p, y:X.costear(m.id, { prov:p.id, modo }) })).concat([{ p:{ id:'barato', nombre:'El más barato de cada material' }, y:X.costear(m.id, { prov:'barato', modo }) }]) : [];
      h = `<div class="field-label">Precios de</div>${chips(provs.map(p => [p.id, esc(provNom(p.id))]).concat([['barato', 'Más barato']]), prov, 'data-prov')}
        <div class="opts" style="--cols:2;margin-top:10px"><button class="opt ${modo === 'metro' ? 'selected' : ''}" type="button" data-modo="metro">Por metro usado</button><button class="opt ${modo === 'tubo' ? 'selected' : ''}" type="button" data-modo="tubo">Barra completa</button></div>
        ${x.avisos.map(a => `<div class="caja-amar">${esc(a)}</div>`).join('')}
        ${x.falta.length ? `<div class="caja-rara">Faltan datos: ${esc(x.falta.join(', '))}.</div>` : ''}
        <div class="tot" style="margin-top:10px">
          <div class="fila"><span>Costo de la puerta</span><b>${dinero(x.costo)}</b></div>
          <div class="fila"><span>Con ganancia (+${num(R.ganancia)} %)</span><b>${dinero(x.venta)}</b></div>
          <div class="fila"><span>Gastos fijos (${dinero(R.gastosMes)} ÷ ${R.puertasMes})</span><b>${dinero(x.fijos)}</b></div>
          <div class="fila fin"><span>Precio sugerido${modo === 'metro' ? `<small class="mat-s" style="display:block;font-weight:600">con barra completa: ${dinero(xt.final)}</small>` : ''}</span><span>${dinero(x.final)}</span></div></div>
        ${!dis ? `<div class="fi-hoy"><span><b>Hoy en catálogo ${dinero(x.hoy)}</b><small>ganas ${x.ganancia < 0 ? '− ' : ''}${dinero(Math.abs(x.ganancia))} por puerta (${Math.round(x.pct)} %)</small></span>${pill(s)}</div>` : ''}
        ${compara.length ? `<div class="tit">Con cada proveedor</div>${compara.map(({ p, y }) => `<button class="rep-f" type="button" data-prov="${p.id}"><span>${esc(p.id === 'barato' ? p.nombre : provNom(p.id))}<small class="mat-s" style="display:block;font-weight:600">cuesta ${dinero(y.costo)}${y.avisos.length ? ' · usa precios de otro en ' + y.avisos.length : ''}</small></span><b>${dinero(y.final)}</b></button>`).join('')}` : ''}`;
      boton = x.falta.length ? 'Faltan datos' : dis ? 'Pasar al catálogo' : `Usar ${dinero(x.final)} en el catálogo`;
      F.dis = x.falta.length > 0;
    }
    if(F.t === 'reglas'){
      const R = d.reglas;
      $('formTitulo').textContent = 'Reglas';
      h = `<div class="input-row">${campo('rIva', 'IVA (%)', R.iva)}${campo('rGan', 'Ganancia (%)', R.ganancia)}</div>
        <div class="input-row">${campo('rCorte', 'Grosor del corte (cm)', R.corte, 'Lo que se come el disco en cada corte.')}${campo('rDesp', 'Despunte (cm)', R.despunte, 'Lo que se bota de la punta de cada barra.')}</div>
        ${campo('rPuertas', 'Puertas al mes', R.puertasMes, 'Se pone solo al cerrar el mes con las puertas vendidas; si no hubo ventas, 25. Puedes cambiarlo.')}
        <div class="caja-nota"><span>Gastos fijos ${dinero(R.gastosMes)} al mes</span>Se cambian en <a href="finanzas.html?tab=gastos" style="color:var(--accent);font-weight:800">Finanzas › Gastos</a>. Aquí se reparten: ${dinero(R.gastosMes)} ÷ ${R.puertasMes} = ${dinero(R.gastosMes / R.puertasMes)} por puerta.</div>`;
      boton = 'Guardar reglas';
    }
    if(F.t === 'mat'){
      const f = fabDe(F.id);
      $('formTitulo').textContent = f.nombre;
      const provs = d.proveedores.filter(p => (p.tipos || []).includes(f.tipo));
      const usan = Object.values(d.costeo).filter(c => c.piezas.some(p => String(p[0]) === String(f.id)) || c.hojas.some(p => String(p[0]) === String(f.id))).length;
      h = `<p class="mat-s" style="margin:-4px 2px 10px">${f.pres === 'barra' ? 'Barra de ' + num(f.largo) + ' cm' : 'Hoja de ' + num(f.hoja[0]) + ' × ' + num(f.hoja[1]) + ' cm'} · ${esc((TIPO[f.tipo] || '').toLowerCase())}</p>
        <div class="field-label">Precio sin IVA</div>
        ${provs.length ? provs.map(p => `<div class="input-row">${campo('fp_' + p.id, esc(provNom(p.id)), (F.precios[p.id] || {}).p)}<div class="field"><label class="field-label" for="fe_${p.id}">Espesor</label><input class="input" id="fe_${p.id}" value="${esc((F.precios[p.id] || {}).esp || '')}"></div></div>`).join('') : '<div class="caja-amar">Ningún proveedor vende este tipo. Márcalo en Finanzas, Proveedores, Editar.</div>'}
        ${f.tipo === 'hierro' ? `<div class="field"><span class="field-label">Para costear usar</span>${opts([['no', 'Última compra'], ['si', 'Precio fijo']], F.fijo != null && F.fijo !== '' ? 'si' : 'no', 'data-f-fijo')}</div>${F.fijo != null && F.fijo !== '' ? campo('fFijo', 'Precio fijo ($)', F.fijo) : ''}` : ''}
        <div class="tot"><div class="fila"><span>Si cambias el precio<small class="mat-s" style="display:block;font-weight:600">se recalculan los modelos que lo usan</small></span><b>${plural(usan, '1 modelo', 'modelos')}</b></div></div>
        <a class="row-link" href="deposito.html?tab=fab" style="margin-top:6px"><span>En el Depósito: ${num(f.stock || 0)} ${f.pres === 'barra' ? (Number(f.stock) === 1 ? 'barra' : 'barras') : (Number(f.stock) === 1 ? 'hoja' : 'hojas')} · ${plural((f.retazos || []).length + (f.sobrantes || []).length, '1 retazo', 'retazos')}</span>${CHEV}</a>`;
      boton = 'Guardar precios';
    }
    if(F.t === 'matnuevo'){
      $('formTitulo').textContent = 'Material nuevo';
      const hoja = F.tipo === 'laminas' || F.tipo === 'vidrio';
      h = `<div class="field" id="c_mNom"><label class="field-label" for="mNom">Nombre</label><input class="input" id="mNom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div><div class="field-hint">Ejemplo: Tubo 1" x 2" 0,90.</div></div>
        <div class="field" id="c_mTipo"><span class="field-label">Tipo</span>${opts([['hierro','Hierro'],['aluminio','Aluminio'],['laminas','Lámina'],['vidrio','Vidrio']], F.tipo, 'data-f-tipo')}<div class="field-error">Elige el tipo</div></div>
        ${F.tipo ? (hoja ? `<div class="input-row">${campo('mAn', 'Ancho de la hoja (cm)', F.an)}${campo('mAl', 'Alto de la hoja (cm)', F.al)}</div>` : campo('mLargo', 'Largo de la barra (cm)', F.largo == null ? 600 : F.largo)) : ''}
        ${campo('mEsp', 'Espesor (si aplica)', F.esp, 'Ejemplo: 0,90 mm.', true)}
        <p class="mat-s" style="margin:0 2px">Después le pones el precio de cada proveedor.</p>`;
      boton = 'Agregar material';
    }
    if(F.t === 'insumo'){
      const i = F.id === 'nuevo' ? null : d.insumos.find(y => String(y.id) === String(F.id)), g = i ? i.grupo : F.grupo;
      $('formTitulo').textContent = i ? i.nombre : 'Nuevo';
      h = (i ? '' : `<div class="field" id="c_fINom"><label class="field-label" for="fINom">Nombre</label><input class="input" id="fINom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div></div>`)
        + campo('fP', 'Precio sin IVA ($)', i ? i.p : F.p) + (g !== 'Accesorios' ? campo('fR', 'Rinde (puertas por unidad, general)', i ? i.r : F.r, 'Cada modelo lo puede cambiar en su ficha. Vacío: lo pone cada modelo.') : '');
    }
    if(F.t === 'usar'){
      const m = modelo(sel), x = X.costear(m.id, { prov });
      $('formTitulo').textContent = m.en_diseno ? 'Pasar al catálogo' : 'Usar en el catálogo';
      h = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${m.en_diseno ? 'El modelo aparece en el Catálogo con este precio y la vendedora ya lo puede vender. Después ponle fotos y su categoría de pago en Catálogo.' : `Hoy está en ${dinero(m.precio_base)}. El sugerido es ${dinero(x.final)}. El costeo queda "Listo".`}</p>
        ${campo('fPrecio', 'Precio de venta ($)', F.precio == null ? x.final : F.precio, 'Puedes redondearlo.')}`;
      boton = m.en_diseno ? 'Pasar al catálogo' : 'Cambiar precio';
    }
    if(F.t === 'buscarBase'){
      $('formTitulo').textContent = 'Copiar de otro modelo';
      const t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const L = bases().filter(b => !F.bm || t(b.nombre).includes(t(F.bm)));
      $('formBody').innerHTML = `<label class="search-box" style="margin:0 0 8px"><input id="fBuscaBase" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="${esc(F.bm || '')}" autocomplete="off"></label>
        <div id="listaBase">${L.map(b => `<button class="ln" type="button" data-elegir-base="${esc(b.id)}"><span class="ln-t">${esc(b.nombre)}</span><span class="ln-v"></span><span class="ln-s">${plural(D().costeo[b.id].piezas.length, '1 corte', 'cortes')}</span></button>`).join('') || '<p class="mat-s">No hay modelos con ese nombre.</p>'}</div>`;
      $('formFoot').innerHTML = ''; return;
    }
    if(F.t === 'corte' && window.CORTE){ const o = window.CORTE.form(F); h = o.h; boton = o.boton; $('formTitulo').textContent = o.titulo; }
    $('formBody').innerHTML = h;
    $('formFoot').innerHTML = `${borrar ? `<button class="btn-secondary" type="button" id="btnBorrar" style="height:54px;flex:1">${txtBorrar}</button>` : ''}<button class="btn-primary" type="button" id="btnForm" style="flex:2" ${F.dis ? 'disabled' : ''}>${boton}</button>`;
    $('formFoot').style.display = 'flex'; $('formFoot').style.gap = '10px';
  }
  const val = (id) => { const el = $(id); return el ? el.value : undefined; };
  function leer(){
    const map = { fCant:'cant', fCm:'cm', fNota:'nota', fA:'a', fH:'h', fRend:'r', fN:'n', fV:'v', fFijo:'fijo', fPrecio:'precio', fINom:'nombre', fP:'p', fR:'r', mNom:'nombre', mLargo:'largo', mAn:'an', mAl:'al', mEsp:'esp', fMano:'mano' };
    Object.entries(map).forEach(([id, k]) => { const v = val(id); if(v !== undefined) F[k] = v; });
    if(F.t === 'mat') D().proveedores.forEach(p => { const v = val('fp_' + p.id); if(v !== undefined){ F.precios[p.id] = { p:v, esp:val('fe_' + p.id) }; } });
  }
  const mal = (id) => { const c = $('c_' + id); if(c) c.classList.add('invalid'); return false; };
  // Copia de trabajo del costeo del modelo abierto; se guarda completa en la base
  const copia = () => JSON.parse(JSON.stringify(D().costeo[sel]));
  async function guardarCopia(c, ok){
    const d = D(), antes = d.costeo[sel];
    d.costeo[sel] = c;
    const listo = await hacer(() => X.guardarCosteo(sel), ok);
    if(!listo && antes) d.costeo[sel] = antes;
    return listo;
  }
  async function guardar(){
    if(!F) return;
    leer(); const d = D();
    if(F.t === 'corte' && window.CORTE){ const r = await window.CORTE.guardarForm(F); if(r !== false){ cerrarHoja('sheetForm', true); F = null; } return; }
    if(F.t === 'precio'){ if(F.dis) return; F = { t:'usar' }; pintarForm(); return; }
    let ok = false; const c = sel != null && d.costeo[sel] ? copia() : null;
    if(F.t === 'pieza'){
      const cant = Math.round(numLibre(F.cant)), cm = numLibre(F.cm);
      if(!F.mat) return toast('Elige el material', 'error');
      if(!(cant > 0) || cant > 99) return mal('fCant'); if(!(cm > 0) || cm > 1000) return mal('fCm');
      if(!F.que) return mal('fQue'); if(F.que === 'Otra' && !String(F.nota || '').trim()) return mal('fNota'); if(!F.ori) return mal('fOri');
      const p = [Number(F.mat), cant, cm, F.que === 'Otra' ? String(F.nota).trim() : (F.nota || ''), F.que, F.ori];
      if(F.i === 'nueva') c.piezas.push(p); else c.piezas[F.i] = p;
      ok = await guardarCopia(c, 'Pieza guardada. El costo se recalculó.');
    }
    if(F.t === 'hoja'){
      const cant = Math.round(numLibre(F.cant)), a = numLibre(F.a), h = numLibre(F.h);
      if(!F.mat) return toast('Elige el material', 'error');
      if(!(cant > 0)) return mal('fCant'); if(!(a > 0)) return mal('fA'); if(!(h > 0)) return mal('fH');
      const fila = [Number(F.mat), cant, a, h, F.nota || ''];
      if(F.i === 'nueva') c.hojas.push(fila); else c.hojas[F.i] = fila;
      ok = await guardarCopia(c, 'Guardado. El costo se recalculó.');
    }
    if(F.t === 'acc'){
      const n = numLibre(F.cant); if(!F.k) return toast('Elige el herraje', 'error'); if(!(n > 0)) return mal('fCant');
      c.acc = c.acc || {}; if(!F.nuevo && F.k0 && String(F.k0) !== String(F.k)) delete c.acc[F.k0]; c.acc[F.k] = n;
      ok = await guardarCopia(c, 'Herraje guardado');
    }
    if(F.t === 'rend'){ const r = numLibre(F.r); if(!(r > 0)) return mal('fRend'); (c.rend = c.rend || {})[F.id] = r; ok = await guardarCopia(c, 'Guardado para este modelo'); }
    if(F.t === 'extra'){
      if(F.sub === 'pieza'){
        const cant = Math.round(numLibre(F.cant)), cm = numLibre(F.cm);
        if(!F.mat) return toast('Elige el material', 'error');
        if(!(cant > 0) || cant > 99) return mal('fCant'); if(!(cm > 0) || cm > 1000) return mal('fCm');
        const z = [Number(F.mat), cant, cm]; if(F.pi === 'nueva') F.piezas.push(z); else F.piezas[F.pi] = z;
        F.sub = null; pintarForm(); return;
      }
      if(!F.kind) return toast('Elige qué extra es', 'error');
      const ex = extraDeF(); if(!ex.n) return mal('fN');
      if(ex.sin_cortes && !(ex.v > 0)) return mal('fV');
      if(ex.mano != null && !(ex.mano >= 0 && ex.mano <= 10000)) return mal('fMano');
      if((c.extras || []).some((o, i) => String(i) !== String(F.i) && X.claveExtra(o.n) === X.claveExtra(ex.n))) return toast('Ese extra ya está en este modelo', 'error');
      delete ex.id; c.extras = c.extras || []; if(F.i === 'nuevo') c.extras.push(ex); else c.extras[F.i] = ex;
      ok = await guardarCopia(c, 'Extra guardado');
    }
    if(F.t === 'reglas'){
      const R = d.reglas, v = { iva:numLibre(val('rIva')), ganancia:numLibre(val('rGan')), corte_cm:numLibre(val('rCorte')), despunte_cm:numLibre(val('rDesp')), puertas_mes:numLibre(val('rPuertas')) };
      if(!(v.iva >= 0 && v.iva <= 50)) return mal('rIva'); if(!(v.ganancia >= 0 && v.ganancia <= 300)) return mal('rGan');
      if(!(v.corte_cm >= 0 && v.corte_cm <= 2)) return mal('rCorte'); if(!(v.despunte_cm >= 0 && v.despunte_cm <= 20)) return mal('rDesp');
      if(!(v.puertas_mes >= 1) || v.puertas_mes % 1) return mal('rPuertas');
      const antes = { iva:R.iva, ganancia:R.ganancia, corte_cm:R.corte, despunte_cm:R.despunte, puertas_mes:R.puertasMes }, p = {};
      Object.keys(v).forEach(k => { if(Number(antes[k]) !== v[k]) p[k] = v[k]; });
      if(!Object.keys(p).length){ cerrarHoja('sheetForm', true); F = null; return; }
      ok = await hacer(() => X.rpc('costeo_reglas_guardar', { p }), 'Reglas guardadas. Todos los modelos se recalcularon.');
    }
    if(F.t === 'mat'){
      const f = fabDe(F.id), cambios = [];
      for(const [k, o] of Object.entries(F.precios)){ const p = numLibre(o.p), act = (f.precios || {})[k];
        if(o.p !== '' && o.p != null && !(p > 0)) return mal('fp_' + k);
        if(p > 0 && (!act || Number(act.p) !== p || String(act.esp || '') !== String(o.esp || ''))) cambios.push({ material_id:f.id, proveedor_id:Number(k), precio:p, espesor:o.esp || null }); }
      const fijo = f.tipo === 'hierro' ? numLibre(F.fijo) : NaN, fijoN = fijo > 0 ? fijo : null;
      ok = await hacer(async () => {
        for(const p of cambios) await X.rpc('material_precio_guardar', { p });
        if(f.tipo === 'hierro' && (fijoN || null) !== (f.fijo ? Number(f.fijo) : null)){
          const { data, error } = await db.rpc('deposito_fab_datos'); if(error) throw error;
          const m = data.fab.find(y => y.id === f.id);
          await X.rpc('material_fab_guardar', { p:{ id:m.id, nombre:m.nombre, tipo:m.tipo, presentacion:m.pres, largo_cm:m.largo, hoja_ancho_cm:m.hoja && m.hoja[0], hoja_alto_cm:m.hoja && m.hoja[1], espesor:m.espesor, precio_fijo:fijoN, minimo:m.minimo, activo:m.activo } });
        }
      }, 'Precios guardados. Los modelos se recalcularon.');
    }
    if(F.t === 'matnuevo'){
      const nom = String(F.nombre || '').trim(); if(!nom) return mal('mNom'); if(!F.tipo) return mal('mTipo');
      const hoja = F.tipo === 'laminas' || F.tipo === 'vidrio', largo = numLibre(F.largo == null ? 600 : F.largo), an = numLibre(F.an), al = numLibre(F.al);
      if(hoja){ if(!(an > 0)) return mal('mAn'); if(!(al > 0)) return mal('mAl'); } else if(!(largo > 0) || largo > 2000) return mal('mLargo');
      let nid = null;
      ok = await hacer(async () => { const r = await X.rpc('material_fab_guardar', { p:{ nombre:nom, tipo:F.tipo, presentacion:hoja ? 'hoja' : 'barra', largo_cm:hoja ? null : largo, hoja_ancho_cm:hoja ? an : null, hoja_alto_cm:hoja ? al : null, espesor:String(F.esp || '').trim() || null, precio_fijo:null, minimo:0, activo:true } }); nid = r && r.id; }, 'Material agregado. Ponle su precio.');
      if(ok && nid){ const f = fabDe(nid); if(f){ filPrecios = f.tipo === 'laminas' || f.tipo === 'vidrio' ? 'hojas' : f.tipo; pintar(); F = { t:'mat', id:f.id, precios:{}, fijo:null }; pintarForm(); return; } }
    }
    if(F.t === 'insumo'){
      const i = F.id === 'nuevo' ? null : d.insumos.find(y => String(y.id) === String(F.id)), p = numLibre(F.p);
      if(!i && !String(F.nombre || '').trim()) return mal('fINom');
      if(!(p >= 0)) return mal('fP');
      const r = numLibre(F.r); if(String(F.r || '').trim() && !(r > 0)) return mal('fR');
      ok = await hacer(() => X.rpc('costeo_insumo_guardar', { p:{ id:i ? i.id : null, nombre:i ? i.nombre : F.nombre.trim(), grupo:i ? i.grupo : F.grupo, precio:p, rendimiento:r > 0 ? r : null } }), 'Guardado. Los modelos se recalcularon.');
    }
    if(F.t === 'usar'){
      const precio = numLibre(F.precio); if(!(precio > 0) || precio > 100000) return mal('fPrecio');
      const m = modelo(sel), eraDis = m.en_diseno, c0 = d.costeo[sel];
      let nuevoSel = sel;
      ok = await hacer(async () => { if(!c0.mid) await X.guardarCosteo(sel); const r = await X.rpc('costeo_pasar_catalogo', { mid:c0.mid, p_precio:Math.round(precio * 100) / 100 }); nuevoSel = r.catalogo_id; }, eraDis ? 'Listo: ya está en el Catálogo' : 'Precio cambiado en el Catálogo');
      if(ok) sel = nuevoSel;
    }
    if(ok === false) return;
    cerrarHoja('sheetForm', true); F = null; pintar(); if(sel != null && fichaAbierta()) pintarFicha();
  }
  async function borrar(){
    if(!F) return;
    if(F.t === 'extra' && F.sub === 'pieza'){ F.piezas.splice(F.pi, 1); F.sub = null; pintarForm(); return; }
    const c = copia();
    if(F.t === 'pieza') c.piezas.splice(F.i, 1);
    if(F.t === 'extra') c.extras.splice(F.i, 1);
    if(F.t === 'hoja') c.hojas.splice(F.i, 1);
    if(F.t === 'acc') delete c.acc[F.k];
    if(F.t === 'rend') delete (c.rend || {})[F.id];
    const ok = await guardarCopia(c, F.t === 'rend' ? 'Ahora usa el general' : 'Quitado');
    if(ok){ cerrarHoja('sheetForm', true); F = null; pintar(); if(fichaAbierta()) pintarFicha(); }
  }

  // ================= Eventos =================
  document.addEventListener('click', async (e) => {
    if(!D()) return;
    const t = e.target.closest('#tabs [data-tab]'); if(t){ if(t.dataset.tab !== tab && nCambios() && !confirm('Tienes precios sin guardar. ¿Salir sin guardarlos?')) return; if(t.dataset.tab !== tab) PRE = {}; tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const fl = e.target.closest('[data-filtro]'); if(fl){ filtro = fl.dataset.filtro; pintar(); return; }
    const fp = e.target.closest('[data-filp]'); if(fp){ filPrecios = fp.dataset.filp; pintar(); return; }
    if(e.target.closest('[data-guardar-precios]')) return guardarPrecios();
    if(e.target.closest('[data-prov-nuevo]')) return abrirForm({ t:'provnuevo', nombre:'', tel:'', tipos:['hierro'], iva:false });
    if(e.target.closest('[data-pdf-precios]')) return pdfPrecios();
    if(window.CORTE && tab === 'semana' && !e.target.closest('#sheetFicha') && window.CORTE.click(e)) return;
    if(e.target.closest('#btnForm')) return guardar();
    if(e.target.closest('#btnBorrar')) return borrar();
    // ---- Dentro de una hoja de formulario
    if(F && e.target.closest('#sheetForm') && (F.t === 'perfil' || F.t === 'nuevo')){
      let b;
      if((b = e.target.closest('[data-fcat]'))){ F.cat = b.dataset.fcat; pintarForm(); return; }
      if((b = e.target.closest('[data-elige-perfil]'))){ BOR.push({ mid:Number(b.dataset.eligePerfil), n:'', cm:'', nota:'', que:null, ori:null }); nuevaFila = BOR.length - 1; cerrarHoja('sheetForm', true); F = null; pintarFicha(); enfocarFila(nuevaFila); return; }
      if(e.target.closest('[data-mat-nuevo-perfil]')){ abrirForm({ t:'matnuevo', tipo:'hierro' }); return; }
      if((b = e.target.closest('[data-nv-que]'))){ leerNuevo(); F.que = b.dataset.nvQue; pintarForm(); return; }
      if((b = e.target.closest('[data-nv-tipo]'))){ leerNuevo(); F.tipo = b.dataset.nvTipo; pintarForm(); return; }
      if((b = e.target.closest('[data-nv-de]'))){ leerNuevo(); F.de = isNaN(+b.dataset.nvDe) ? b.dataset.nvDe : +b.dataset.nvDe; F.modo = 'copiar'; pintarForm(); return; }
      if((b = e.target.closest('[data-nv-modo]'))){ leerNuevo(); F.modo = b.dataset.nvModo; pintarForm(); return; }
      if((b = e.target.closest('[data-nv-mod]'))){ leerNuevo(); F.mid = isNaN(+b.dataset.nvMod) ? b.dataset.nvMod : +b.dataset.nvMod; pintarForm(); return; }
      if((b = e.target.closest('[data-nv-kind]'))){ leerNuevo(); F.kind = b.dataset.nvKind; pintarForm(); return; }
      if(e.target.closest('[data-nv-crear]')) return crearNuevo();
      return;
    }
    if(F && e.target.closest('#sheetForm') && F.t === 'provnuevo'){
      let b;
      if((b = e.target.closest('[data-pv-tipo]'))){ leerProv(); const t = b.dataset.pvTipo; F.tipos = F.tipos.includes(t) ? F.tipos.filter(x => x !== t) : F.tipos.concat([t]); pintarForm(); return; }
      if((b = e.target.closest('[data-pv-iva]'))){ leerProv(); F.iva = b.dataset.pvIva === 'si'; pintarForm(); return; }
      if(e.target.closest('[data-pv-guardar]')) return guardarProv();
      return;
    }
    if(F && e.target.closest('#sheetForm')){
      const set = (attr, k) => { const b = e.target.closest('[' + attr + ']'); if(b){ leer(); F[k] = b.getAttribute(attr); pintarForm(); return true; } };
      const pk = e.target.closest('[data-f-pick]'); if(pk){ leer(); F.pick = pk.dataset.fPick === 'si'; F.bm = ''; pintarForm(); return; }
      const fm = e.target.closest('[data-f-mat]'); if(fm){ F.mat = Number(fm.dataset.fMat); F.pick = false; pintarForm(); return; }
      if(e.target.closest('[data-ir-precios]')){ cerrarHoja('sheetForm', true); cerrarHoja('sheetFicha', true); F = null; tab = 'materiales'; pintar(); return; }
      const eb = e.target.closest('[data-elegir-base]'); if(eb){ ini = { modo:'copiar', de:isNaN(+eb.dataset.elegirBase) ? eb.dataset.elegirBase : +eb.dataset.elegirBase }; cerrarHoja('sheetForm', true); F = null; pintarFicha(); return; }
      const pv = e.target.closest('[data-prov]'); if(pv && F.t === 'precio'){ prov = pv.dataset.prov; pintarForm(); pintarFicha(); return; }
      const mo = e.target.closest('[data-modo]'); if(mo && F.t === 'precio'){ modo = mo.dataset.modo; pintarForm(); return; }
      const xp = e.target.closest('[data-fx-pz]'); if(xp){ leer(); const i = xp.dataset.fxPz, u = F.piezas[F.piezas.length - 1];
        Object.assign(F, i === 'nueva' ? { sub:'pieza', pi:'nueva', mat:u ? u[0] : idDe('t1x1') || null, cant:1, cm:'' } : { sub:'pieza', pi:+i, mat:F.piezas[+i][0], cant:F.piezas[+i][1], cm:F.piezas[+i][2] }); F.pick = false; pintarForm(); return; }
      const xs = e.target.closest('[data-fx-sub]'); if(xs){ leer(); F.sub = xs.dataset.fxSub || null; F.pick = false; pintarForm(); return; }
      const xd = e.target.closest('[data-fx-de]'); if(xd){ const o = copiables(extraDeF().n).find(y => String(y.id) === xd.dataset.fxDe); if(o){ F.piezas = JSON.parse(JSON.stringify(o.ex.piezas)); if(o.ex.mano != null && /^protecci/i.test(o.ex.n)){ F.manoModo = 'propia'; F.mano = o.ex.mano; } else if(o.ex.mano != null && F.mano === ''){ F.mano = o.ex.mano; } toast('Cortes copiados del ' + o.nombre + '. Revísalos y guarda.'); } F.sub = null; pintarForm(); return; }
      if(set('data-fx-ofr', 'ofr') || set('data-fx-mano', 'manoModo')) return;
      if(set('data-f-que', 'que') || set('data-f-ori', 'ori') || set('data-f-acc', 'k') || set('data-f-kind', 'kind') || set('data-f-tipo', 'tipo')) return;
      const fj = e.target.closest('[data-f-fijo]'); if(fj){ leer(); F.fijo = fj.dataset.fFijo === 'si' ? (F.fijo || (Object.values(F.precios)[0] || {}).p || '0') : ''; pintarForm(); return; }
      if(F.t === 'corte' && window.CORTE && window.CORTE.clickForm(e, F)){ pintarForm(); return; }
      return;
    }
    // ---- Lista y ficha
    const md = e.target.closest('[data-modelo]'); if(md){ const id = isNaN(+md.dataset.modelo) ? md.dataset.modelo : +md.dataset.modelo; return abrirFicha(id); }
    const ir = e.target.closest('[data-ir]'); if(ir){ const id = ir.dataset.ir; if(id !== 's-cortes' && !abiertos.has(id)){ abiertos.add(id); pintarFicha(); } const s = $(id); if(s) s.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
    if(e.target.closest('[data-nuevo-modelo]')){ const b = conCortes()[0]; return abrirForm({ t:'nuevo', que:'modelo', nombre:'', tipo:'Puerta Multilock', modo:b ? 'copiar' : 'estandar', de:b ? b.id : null, mid:null, kind:null, n:'', bm:'' }); }
    const xd = e.target.closest('[data-extra-de]'); if(xd){ const id = isNaN(+xd.dataset.extraDe) ? xd.dataset.extraDe : +xd.dataset.extraDe; abrirFicha(id); if(D().costeo[id]) abrirExtra(+xd.dataset.i); return; }
    // ---- Ficha: cortes en la fila, acordeones y franja del precio
    if(e.target.closest('[data-salir-ficha]')){ if(sucio() && !confirm('Tienes cortes sin guardar. ¿Salir sin guardarlos?')) return; if(sucio()){ D().costeo[sel].piezas = JSON.parse(GUARD); } franja = false; cerrarHoja('sheetFicha', true); pintar(); return; }
    let fb;
    if((fb = e.target.closest('[data-pz-mas]'))){ BOR.push({ mid:isNaN(+fb.dataset.pzMas) ? fb.dataset.pzMas : +fb.dataset.pzMas, n:'', cm:'', nota:'', que:null, ori:null }); nuevaFila = BOR.length - 1; pintarFicha(); enfocarFila(nuevaFila); return; }
    if((fb = e.target.closest('[data-pzx]'))){ BOR.splice(+fb.dataset.pzx, 1); abierto3d = null; nuevaFila = null; pintarFicha(); return; }
    if((fb = e.target.closest('[data-pz3d]'))){ const i = +fb.dataset.pz3d; abierto3d = abierto3d === i ? null : i; pintarFicha(); return; }
    if((fb = e.target.closest('[data-pzque]')) && abierto3d != null){ const p = BOR[abierto3d]; p.que = p.que === fb.dataset.pzque ? null : fb.dataset.pzque; pintarFicha(); return; }
    if((fb = e.target.closest('[data-pzori]')) && abierto3d != null){ const p = BOR[abierto3d]; p.ori = p.ori === fb.dataset.pzori ? null : fb.dataset.pzori; pintarFicha(); return; }
    if(e.target.closest('[data-pf-nuevo]')) return abrirForm({ t:'perfil', bm:'', cat:'Tubos' });
    if((fb = e.target.closest('[data-acc-t]'))){ const id = fb.dataset.accT; if(abiertos.has(id)) abiertos.delete(id); else abiertos.add(id); pintarFicha(); return; }
    if(e.target.closest('[data-franja]')){ franja = !franja; refrescar(); return; }
    if((fb = e.target.closest('[data-fprov]'))){ prov = fb.dataset.fprov; refrescar(); return; }
    if((fb = e.target.closest('[data-fmodo]'))){ modo = fb.dataset.fmodo; refrescar(); return; }
    if((fb = e.target.closest('[data-al-catalogo]')) && !fb.disabled) return alCatalogo(Number(fb.dataset.alCatalogo));
    if(e.target.closest('[data-guardar-cortes]')) return guardarCortes();
    const ib = e.target.closest('[data-ini-de]'); if(ib){ ini = { modo:'copiar', de:isNaN(+ib.dataset.iniDe) ? ib.dataset.iniDe : +ib.dataset.iniDe }; return pintarFicha(); }
    if(e.target.closest('[data-buscar-base]')) return abrirForm({ t:'buscarBase', bm:'' });
    const io = e.target.closest('[data-ini]'); if(io){ ini = { modo:io.dataset.ini, de:io.dataset.ini === 'copiar' ? (ini.de != null ? ini.de : (bases()[0] || {}).id) : ini.de }; return pintarFicha(); }
    if(e.target.closest('[data-empezar]')) return empezar();
    if(e.target.closest('[data-precio]')) return abrirForm({ t:'precio' });
    const ct = e.target.closest('[data-cat]'); if(ct && D().costeo[sel]){ const c = copia(); c.categoria_pago_id = Number(ct.dataset.cat); await guardarCopia(c, 'Mano de obra cambiada'); pintarFicha(); return; }
    if(e.target.closest('[data-duplicar]')){
      const c = D().costeo[sel]; let nid = null;
      const ok = await hacer(async () => { const r = await X.rpc('costeo_duplicar', { mid:c.mid }); nid = 'd' + r.id; }, 'Copia creada en diseño. Cambia sus piezas y pásala al catálogo cuando esté lista.');
      if(ok && nid){ filtro = 'En diseño'; sel = nid; pintar(); pintarFicha(); $('fichaBody').scrollTop = 0; } return;
    }
    const pz = e.target.closest('[data-pieza]');
    if(pz){ const c = D().costeo[sel]; if(pz.dataset.pieza === 'nueva'){ const u = c.piezas[c.piezas.length - 1]; return abrirForm({ t:'pieza', i:'nueva', mat:u ? u[0] : idDe('t1x1') || null, cant:1, cm:'', nota:'', que:null, ori:null }); }
      const i = +pz.dataset.pieza, p = c.piezas[i]; return abrirForm({ t:'pieza', i, mat:p[0], cant:p[1], cm:p[2], nota:p[3], que:p[4] || null, ori:p[5] || null }); }
    const hj = e.target.closest('[data-hoja]'); if(hj){ if(hj.dataset.hoja === 'nueva') return abrirForm({ t:'hoja', i:'nueva', mat:idDe('lam14') || null, cant:1, a:'', h:'', nota:'' }); const i = +hj.dataset.hoja, p = D().costeo[sel].hojas[i]; return abrirForm({ t:'hoja', i, mat:p[0], cant:p[1], a:p[2], h:p[3], nota:p[4] }); }
    const ac = e.target.closest('[data-acc]'); if(ac){ const c = D().costeo[sel]; if(ac.dataset.acc === 'nuevo') return abrirForm({ t:'acc', k:null, nuevo:true, cant:1 }); return abrirForm({ t:'acc', k:ac.dataset.acc, k0:ac.dataset.acc, cant:c.acc[ac.dataset.acc] }); }
    const rd = e.target.closest('[data-rend]'); if(rd && D().costeo[sel]){ const it = D().insumos.find(y => String(y.id) === rd.dataset.rend); if(!it) return; const pr = Number((D().costeo[sel].rend || {})[it.id]) || 0; return abrirForm({ t:'rend', id:it.id, r:pr || it.r || '', propio:!!pr }); }
    const ex = e.target.closest('[data-extra]'); if(ex && D().costeo[sel]) return abrirExtra(ex.dataset.extra === 'nuevo' ? 'nuevo' : +ex.dataset.extra);
    const xp = e.target.closest('[data-extra-pend]'); if(xp){ const id = +xp.dataset.extraPend; abrirFicha(id); if(D().costeo[id]) abrirExtraClave(xp.dataset.k); return; }
    if(e.target.closest('[data-reglas]')) return abrirForm({ t:'reglas' });
    const mt = e.target.closest('[data-mat]'); if(mt){ if(mt.dataset.mat === 'nuevo') return abrirForm({ t:'matnuevo', tipo:filPrecios === 'perfiles' || !esFabP(filPrecios) ? 'hierro' : filPrecios }); const f = fabDe(mt.dataset.mat); return abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
    const ins = e.target.closest('[data-insumo]'); if(ins) return abrirForm({ t:'insumo', id:ins.dataset.insumo, grupo:filPrecios });
  });
  document.addEventListener('input', (e) => {
    if(e.target.matches && e.target.matches('#cont [data-pre]')){ cambioPrecio(e.target); return; }
    if(e.target.matches && e.target.matches('#fichaBody [data-pz]')){ const [i, k] = e.target.dataset.pz.split(':'); if(BOR[+i]){ BOR[+i][k] = e.target.value; refrescar(); } return; }
    if(e.target.id === 'buscaModelo'){ busca = e.target.value; const l = $('modLista'); if(l) l.innerHTML = listaModelos(lista().filter(FIL[filtro] || FIL.Todos).filter(o => { const t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return !busca || t(o.m.nombre).includes(t(busca)); })); return; }
    if(!F) return;
    if(e.target.id === 'fBuscaMat' || e.target.id === 'fBuscaBase' || e.target.id === 'nvBusca'){ if(e.target.id === 'nvBusca') leerNuevo(); F.bm = e.target.value; const pos = e.target.selectionStart; pintarForm(); const el = $(e.target.id); if(el){ el.focus(); try{ el.setSelectionRange(pos, pos); } catch(_){} } return; }
    if(F.t === 'hoja' && ['fCant','fA','fH'].includes(e.target.id)){ leer(); const f = fabDe(F.mat), caja = $('cajaHoja'); if(f && f.hoja && caja){ const m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000; caja.innerHTML = `<span>Uso de la hoja</span>${num(m2, 3)} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b>`; } }
    if(F.t === 'extra' && !F.sub && ['fV','fMano','fN'].includes(e.target.id)){ leer(); const caja = $('cajaExtra'); if(caja) caja.innerHTML = resumenExtra(); }
  });
  document.addEventListener('change', async (e) => {
    if(e.target.id === 'fNotas' && sel != null && D().costeo[sel]){ const c = copia(); c.notas = e.target.value; await guardarCopia(c, 'Notas guardadas'); }
  });

  (async () => {
    const perfil = await window.Sesion.requerir();
    if(!perfil) return;
    if(!perfil.confirma_abonos){ $('cont').innerHTML = '<div class="caja-amar" style="margin:16px 0">Costos es solo para Ray o Gualfredo.</div>'; $('filtros').classList.add('hidden'); return; }
    $('cont').innerHTML = '<p class="mat-s" style="margin:24px 2px">Cargando…</p>';
    try{ await X.cargar(); prov = D().prov; if(window.CORTE) await window.CORTE.cargar(); if(window.COMPRA) await window.COMPRA.cargar().catch(() => {}); if(window.COMPRA) window.COMPRA.alCambiar(() => recargar().catch(() => {})); }
    catch(e){ $('cont').innerHTML = `<div class="caja-amar" style="margin:16px 0">${esc(errTxt(e))}</div><button class="btn-secondary" type="button" data-recargar style="width:100%">Reintentar</button>`; document.addEventListener('click', (ev) => { if(ev.target.closest('[data-recargar]')) location.reload(); }); return; }
    pintar();
    const mq = q.get('modelo'); if(mq){ const id = isNaN(+mq) ? mq : +mq; if(modelo(id)){ abrirFicha(id); if(q.get('extra') && D().costeo[id]) abrirExtraClave(q.get('extra')); } }
    const mat = q.get('material'); if(mat && tab === 'materiales'){ const f = fabDe(mat); if(f) abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
  })();
})();
