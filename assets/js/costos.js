// Costos (solo quien confirma pagos: Ray o Gualfredo). Misma fórmula del Costeador de Ray (costeo.js = _costeo de la base):
// materiales con IVA, consumibles por rendimiento, herrajes, mano de obra por categoría de pago,
// costo × (1 + ganancia) + gastos fijos por puerta. Los extras se cobran aparte (× ganancia, sin gastos fijos).
// Pestañas: Modelos · Plan de corte (corte.js) · Precios. La Ganancia por modelo vive en Finanzas › Mes y los
// gastos fijos en Finanzas › Gastos. La ficha de cada modelo ocupa toda la pantalla (una sola lista de cortes).
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

  const TABS = ['modelos','semana','materiales'];
  let tab = TABS.includes(q.get('tab')) ? q.get('tab') : 'modelos', filtro = 'Todos', busca = '';
  let sel = null, prov = null, modo = 'metro', F = null, ocupado = false, ini = null;
  let filPrecios = 'hierro', vistaPrecios = 'material';
  window.CostosApp = { get prov(){ return prov; }, set prov(v){ prov = v; }, pintar:() => pintar(), recargar:() => recargar(), abrirCorte:(o) => abrirForm(Object.assign({ t:'corte' }, o)), repintarForm:() => { if(F && F.t === 'corte') pintarForm(); } };

  const modelo = (id) => D().catalogo.find(x => String(x.id) === String(id)) || D().enDiseno.find(x => String(x.id) === String(id));
  const foto = (m) => m.foto || 'assets/img/icon-192.png';
  const pill = (s) => `<span class="pill ${s[0]}">${esc(s[1])}</span>`;
  const fichaAbierta = () => $('sheetFicha').classList.contains('open');

  async function recargar(){ await X.cargar(); if(prov == null) prov = D().prov; if(window.CORTE) await window.CORTE.cargar().catch(() => {}); if(window.COMPRA) await window.COMPRA.cargar().catch(() => {}); pintar(); if(sel != null && fichaAbierta()) pintarFicha(); }
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
    $('filtros').classList.toggle('hidden', tab === 'semana');
    if(tab === 'modelos'){ pintarFiltrosModelos(); $('cont').innerHTML = secModelos(); }
    else if(tab === 'materiales'){ pintarFiltrosPrecios(); $('cont').innerHTML = secPrecios(); }
    else { $('cont').innerHTML = window.CORTE ? window.CORTE.html() : ''; window.CORTE && window.CORTE.despues(); }
  }

  // ================= Modelos: los productos del Catálogo por grupos =================
  const enFab = () => { const n = {}; (D().enFabricacion || []).forEach(id => { n[id] = 1; }); return n; };
  const FIL = {
    'Todos':(o) => !o.dis, 'Puertas':(o) => !o.dis && /^Puerta/.test(o.m.tipo || '') && o.m.tipo !== 'Puerta de Madera', 'Combos':(o) => !o.dis && o.m.tipo === 'Combo',
    'Ventanas':(o) => !o.dis && /ventana/i.test(o.m.tipo || ''), 'Madera':(o) => !o.dis && o.m.tipo === 'Puerta de Madera', 'En diseño':(o) => o.dis,
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
  function filaModelo(o){
    const { m, x, dis, fab } = o, s = X.semaforo(x);
    let der;
    if(listo(o)) der = `<b>${dinero(x.final)}</b><span style="margin-top:3px">${dis ? pill(['gris','En diseño']) : pill(s)}</span>`;
    else if(x) der = `<b style="font-size:14px;color:var(--amber)">${esc(x.falta.length ? 'falta ' + x.falta[0] : 'en borrador')}</b>`;
    else der = CHEV;
    const sub = dis ? 'En diseño' + (x && x.c.codigo ? ' · ' + x.c.codigo : '') : esc(m.tipo || '') + (fab ? ' · <b style="color:var(--accent)">en fabricación</b>' : x ? '' : ' · catálogo ' + dinero(m.precio_base));
    return `<button class="mod" type="button" data-modelo="${esc(m.id)}"><img src="${esc(foto(m))}" alt="" loading="lazy">
      <span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${sub}</span></span>
      <span class="mat-n">${der}</span></button>`;
  }
  function secModelos(){
    const todos = lista(), cat = todos.filter(o => !o.dis);
    $('subtitulo').textContent = `${cat.filter(listo).length} de ${cat.length} modelos listos`;
    const t = (window.AH.normalizar ? window.AH.normalizar : (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    const ver = todos.filter(FIL[filtro] || FIL.Todos).filter(o => !busca || t(o.m.nombre).includes(t(busca)));
    let h = `<label class="search-box" style="margin:0 0 6px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="buscaModelo" type="search" placeholder="Buscar modelo" aria-label="Buscar modelo" value="${esc(busca)}" autocomplete="off"></label><div id="modLista">`;
    h += listaModelos(ver) + '</div>';
    return h;
  }
  function listaModelos(ver){
    if(!ver.length) return `<div class="vacio-d"><b>No hay modelos aquí</b>${busca ? 'Prueba con otro nombre.' : filtro === 'En diseño' ? 'Los modelos nuevos se hacen duplicando uno que ya esté costeado.' : 'Cambia el filtro de arriba.'}</div>`;
    if(filtro === 'En diseño') return `<div class="grp-t"><span>En diseño</span><span>${ver.length}</span></div>` + ver.map(filaModelo).join('');
    const G = [['Listos', ver.filter(listo)], ['Borrador', ver.filter(o => o.x && !listo(o))], ['Faltan por costear', ver.filter(o => !o.x)]];
    return G.filter(([, l]) => l.length).map(([n, l]) => `<div class="grp-t"><span>${n}</span><span>${l.length}</span></div>${l.map(filaModelo).join('')}`).join('');
  }

  // ================= Ficha del modelo (pantalla completa) =================
  function abrirFicha(id){
    sel = id; ini = null;
    const m = modelo(id); if(!m) return;
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
  function pintarFicha(){
    const m = modelo(sel); if(!m) return;
    const x = X.costear(m.id, { prov, modo:'metro' });
    const dis = !!m.en_diseno, md = medida(m);
    const est = !x ? 'Faltan sus cortes' : dis ? 'En diseño' : x.c.estado === 'listo' && !x.falta.length ? 'Listo' : 'Borrador';
    $('fichaHead').innerHTML = `<button class="fi-volver" type="button" data-cerrar="sheetFicha">‹ Modelos</button>
      <div class="fi-tit"><div style="min-width:0"><h2 class="sheet-title" id="fichaTitulo">${esc(m.nombre)}</h2><span class="mat-s">${esc([x && x.c.codigo, md, est].filter(Boolean).join(' · '))}</span></div>
      ${x ? '<button class="fi-dup" type="button" data-duplicar>Duplicar</button>' : ''}</div>`;
    if(!x) return pintarInicio(m);
    const R = D().reglas, c = x.c, suma = (gs) => x.lineas.filter(l => gs.includes(l.g)).reduce((a, l) => a + l.v, 0);
    const S = [['s-cortes','Cortes',suma(['Hierro'])],['s-hojas','Lámina',suma(['Lámina','Vidrio'])],['s-cons','Consumibles',suma(['Pintura y masilla','Consumibles'])],['s-herr','Herrajes',suma(['Accesorios'])],['s-obra','Obra',suma(['Mano de obra'])],['s-extras','Extras',null]];
    let h = `<div class="fi-idx">${S.map(([id, t, v]) => `<button class="fx" type="button" data-ir="${id}">${t}${v != null ? ' ' + dinero(v) : ''}</button>`).join('')}</div>`;
    if(x.falta.length) h += `<div class="caja-rara">Faltan datos: ${esc(x.falta.join(', '))}. Sin esto no se sabe cuánto cuesta.</div>`;
    // ---- Cortes: una sola lista, agrupada por material, con su barra dibujada
    h += `<section class="fi-sec" id="s-cortes"><div class="fi-sh"><h3>Cortes</h3><span>${dinero(S[0][2])}</span></div>`;
    const orden = []; c.piezas.forEach((p, i) => { let g = orden.find(o => String(o.mid) === String(p[0])); if(!g){ g = { mid:p[0], idx:[] }; orden.push(g); } g.idx.push(i); });
    if(!orden.length) h += '<p class="mat-s" style="margin:4px 2px">Todavía no tiene cortes. Toca "+ Pieza" para agregar el primero.</p>';
    orden.forEach(o => {
      const f = fabDe(o.mid) || { nombre:'Material' }, g = x.grupos.find(y => String(y.id) === String(o.mid));
      h += `<div class="fi-mat"><b>${esc(f.nombre)}</b><span>${g ? metros(g.cm) + ' · ' + plural(g.barras.length, '1 barra', 'barras') + ' · ' + dinero(g.v) : 'sin precio'}</span></div>`;
      h += o.idx.map(i => { const p = c.piezas[i], et = p[4] ? (p[4] === 'Otra' ? (p[3] || 'Otra') : p[4]) : (p[3] || 'Sin decir qué es');
        return `<button class="pzr" type="button" data-pieza="${i}"><span class="pzr-n">${p[1]}</span><span class="pzr-n pzr-cm">${num(p[2], p[2] % 1 ? 1 : 0)}</span><span class="pzr-t${p[4] ? '' : ' gris'}">${esc(et)}${p[5] ? `<i>${p[5]}</i>` : ''}</span>${CHEV}</button>`; }).join('');
      if(g) h += `<div class="barras">${g.barras.map(b => `<div class="barra">${b.piezas.map(p => `<span style="flex:${p.cm}">${num(p.cm, p.cm % 1 ? 1 : 0)}</span>`).join('')}${b.libre > 0 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 60 ? 'sobra ' + metros(b.libre) : ''}</span>` : ''}</div>`).join('')}</div>`;
    });
    h += '<button class="btn-nuevo" type="button" data-pieza="nueva">+ Pieza</button></section>';
    // ---- Lámina y vidrio
    h += `<section class="fi-sec" id="s-hojas"><div class="fi-sh"><h3>Lámina y vidrio</h3><span>${dinero(S[1][2])}</span></div>`;
    h += c.hojas.map((p, i) => { const f = fabDe(p[0]); if(!f || !f.hoja) return ''; const pr = X.precioFab(f, prov), m2 = p[1] * p[2] * p[3] / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000;
      return `<button class="ln" type="button" data-hoja="${i}"><span class="ln-t">${esc(f.nombre)} · ${p[1] > 1 ? p[1] + ' de ' : ''}${num(p[2])} × ${num(p[3])}</span><span class="ln-v">${pr.p != null ? dinero(m2 * pr.p * (1 + R.iva / 100) / hm2) : 'sin precio'}</span><span class="ln-s">${num(m2, 2)} m² · ${Math.round(m2 / hm2 * 100)} % de la hoja${p[4] ? ' · ' + esc(p[4]) : ''}</span></button>`; }).join('') || '<p class="mat-s" style="margin:4px 2px">Sin lámina ni vidrio.</p>';
    h += '<button class="btn-nuevo" type="button" data-hoja="nueva">+ Lámina o vidrio</button></section>';
    // ---- Pintura y consumibles: siempre a la vista, con su rendimiento
    h += `<section class="fi-sec" id="s-cons"><div class="fi-sh"><h3>Pintura y consumibles</h3><span>${dinero(S[2][2])}</span></div><p class="mat-s" style="margin:0 2px 2px">Toca uno para cambiar cuántas puertas rinde en este modelo.</p>`;
    h += D().insumos.filter(i => i.grupo !== 'Accesorios').map(it => {
      const propio = Number((c.rend || {})[it.id]) || 0, r = propio || Number(it.r) || 0, l = x.lineas.find(y => y.n === it.nombre && y.g === it.grupo);
      const txt = !r ? (it.grupo === 'Pintura y masilla' ? 'Falta cuántas puertas rinde' : 'Sin dato: no se cuenta') : (r >= 1 ? 'rinde ' + num(r) + (r === 1 ? ' puerta' : ' puertas') : num(1 / r, 0) + ' por puerta') + (propio ? ' · de este modelo' : ' · general');
      return `<button class="ln" type="button" data-rend="${it.id}"><span class="ln-t">${esc(it.nombre)}</span><span class="ln-v"${!r && it.grupo === 'Pintura y masilla' ? ' style="color:var(--danger)"' : ''}>${l ? dinero(l.v) : !r && it.grupo === 'Pintura y masilla' ? 'Falta' : '·'}</span><span class="ln-s">${esc(txt)}</span></button>`; }).join('');
    h += '</section>';
    // ---- Herrajes
    h += `<section class="fi-sec" id="s-herr"><div class="fi-sh"><h3>Herrajes</h3><span>${dinero(S[3][2])}</span></div>`;
    h += Object.entries(c.acc || {}).map(([k, n]) => { const it = D().insumos.find(y => String(y.id) === String(k)); if(!it) return ''; const l = x.lineas.find(y => y.g === 'Accesorios' && y.n === it.nombre);
      return `<button class="ln" type="button" data-acc="${esc(k)}"><span class="ln-t">${num(n)} × ${esc(it.nombre)}</span><span class="ln-v">${l ? dinero(l.v) : ''}</span><span class="ln-s">${dinero(it.p)} sin IVA cada uno</span></button>`; }).join('') || '<p class="mat-s" style="margin:4px 2px">Sin herrajes.</p>';
    h += '<button class="btn-nuevo" type="button" data-acc="nuevo">+ Herraje</button></section>';
    // ---- Mano de obra
    h += `<section class="fi-sec" id="s-obra"><div class="fi-sh"><h3>Mano de obra</h3><span>${dinero(S[4][2])}</span></div>`;
    h += x.lineas.filter(l => l.g === 'Mano de obra').map(l => `<div class="ln"><span class="ln-t">${esc(l.n)}</span><span class="ln-v">${dinero(l.v)}</span></div>`).join('');
    h += `<div class="field-label" style="margin-top:10px">Categoría de pago</div><div class="opts" style="--cols:2">${D().categorias.filter(k => !m.tipo || k.producto === m.tipo).map(k => `<button class="opt ${x.cat && String(x.cat.id) === String(k.id) ? 'selected' : ''}" type="button" data-cat="${k.id}">${esc(k.nombre)}</button>`).join('') || '<p class="mat-s">No hay categorías de este producto.</p>'}</div>
      <p class="mat-s" style="margin:6px 2px 0">Las tarifas se cambian en <a href="categorias-pago.html" style="color:var(--accent);font-weight:800">Categorías de pago</a>.</p></section>`;
    // ---- Extras
    h += `<section class="fi-sec" id="s-extras"><div class="fi-sh"><h3>Extras</h3><span>se cobran aparte</span></div>`;
    h += x.extras.length ? x.extras.map((e, i) => `<button class="ln" type="button" data-extra="${i}"><span class="ln-t">${esc(e.n)}</span><span class="ln-v">${dinero(e.venta)}</span><span class="ln-s">Cuesta ${dinero(e.costo)} · sin gastos fijos</span></button>`).join('') : '<p class="mat-s" style="margin:4px 2px">Sin extras. Ejemplo: protección, marco decorativo.</p>';
    h += `<button class="btn-nuevo" type="button" data-extra="nuevo">+ Extra</button></section>
      <div class="field" style="margin-top:16px"><label class="field-label" for="fNotas">Notas</label><textarea class="input" id="fNotas" rows="2">${esc(c.notas || '')}</textarea><div class="field-hint">Se guardan al salir del campo.</div></div>`;
    if(q.get('volver') === 'semana') h = `<a class="caja-ok" style="display:block;text-decoration:none;margin-bottom:10px" href="costos.html?tab=semana&para=${esc(q.get('para') || '')}">${c.piezas.length ? 'Cortes cargados. Volver al plan de corte' : 'Cuando cargues sus cortes, vuelve al plan de corte'} ›</a>` + h;
    $('fichaBody').innerHTML = h;
    // ---- Precio siempre abajo
    const dif = x.hoy != null ? r2(x.hoy - x.final) : null;
    const etq = x.falta.length ? '<span class="pill gris">Faltan datos</span>' : dis ? '<span class="pill gris">En diseño</span>' : Math.abs(dif) < 0.005 ? '<span class="pill verde">Igual al catálogo</span>' : dif < 0 ? `<span class="pill rojo">${dinero(-dif)} abajo del catálogo</span>` : `<span class="pill verde">${dinero(dif)} arriba del catálogo</span>`;
    $('fichaFoot').innerHTML = `<button class="fi-precio" type="button" data-precio><span class="fi-pl"><small>Sugerido · cuesta ${dinero(x.costo)}</small><b>${dinero(x.final)}</b></span><span class="fi-pr">${etq}<small>${esc(provNom(prov))} · por metro ›</small></span></button>`;
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
  const FILP = { hierro:'Hierro', hojas:'Lámina y vidrio', aluminio:'Aluminio', 'Pintura y masilla':'Pintura', Consumibles:'Consumibles', Accesorios:'Herrajes' };
  function pintarFiltrosPrecios(){
    $('filtros').querySelector('.mostrar-t').textContent = 'Ver';
    $('filtrosL').innerHTML = Object.entries(FILP).map(([k, t]) => `<button type="button" class="fx ${k === filPrecios ? 'on' : ''}" data-filp="${esc(k)}">${t}</button>`).join('');
  }
  const pn = (k) => provNom(k);
  function secPrecios(){
    const d = D(), R = d.reglas;
    $('subtitulo').textContent = 'Precios sin IVA por proveedor';
    let h = '';
    const esFab = ['hierro','hojas','aluminio'].includes(filPrecios);
    if(esFab){
      const tipos = filPrecios === 'hojas' ? ['laminas','vidrio'] : [filPrecios];
      const activos = d.fab.filter(f => f.activo && tipos.includes(f.tipo));
      h += `<div class="opts" style="--cols:2;margin-bottom:6px"><button class="opt ${vistaPrecios === 'material' ? 'selected' : ''}" type="button" data-vprecios="material">Por material</button><button class="opt ${vistaPrecios === 'proveedor' ? 'selected' : ''}" type="button" data-vprecios="proveedor">Por proveedor</button></div>`;
      if(vistaPrecios === 'proveedor'){
        d.proveedores.forEach(p => {
          const L = activos.filter(f => f.precios && f.precios[p.id]); if(!L.length) return;
          h += `<div class="grp-t"><span>${esc(p.nombre)}</span><span>${plural(L.length, '1 material', 'materiales')}</span></div>` + L.map(f => { const v = f.precios[p.id], otros = Object.entries(f.precios).filter(([k]) => String(k) !== String(p.id)).map(([, o]) => Number(o.p)), min = otros.length ? Math.min(...otros) : null;
            return `<button class="ln" type="button" data-mat="${f.id}"><span class="ln-t">${esc(f.nombre)}</span><span class="ln-v">${dinero(v.p)}</span><span class="ln-s">${v.esp ? esc(v.esp) + ' · ' : ''}${min == null ? 'solo lo vende este' : Number(v.p) <= min ? 'el más barato' : 'otro lo vende a ' + dinero(min)}</span></button>`; }).join('');
        });
        if(!activos.some(f => Object.keys(f.precios || {}).length)) h += '<p class="mat-s" style="margin:8px 2px">Todavía no hay precios de este tipo.</p>';
      } else {
        h += activos.map(f => { const ps = Object.entries(f.precios || {}).map(([k, v]) => ({ k, p:Number(v.p) })).sort((a, b) => a.p - b.p);
          const sub = (f.pres === 'barra' ? '' : '') + (ps.length > 1 ? pn(ps[0].k) + ' el más barato · ' + ps.length + ' proveedores' : ps.length ? pn(ps[0].k) : 'Sin precio todavía') + (f.pres === 'barra' ? ' · barra ' + num(f.largo) + ' cm' : f.hoja ? ' · hoja ' + num(f.hoja[0]) + ' × ' + num(f.hoja[1]) : '');
          const otro = ps.length > 1 ? ps.slice(1).map(o => pn(o.k) + ' ' + dinero(o.p) + ' (' + Math.round((o.p - ps[0].p) / ps[0].p * 100) + ' % más caro)').join(' · ') : '';
          return `<button class="ln" type="button" data-mat="${f.id}"><span class="ln-t">${esc(f.nombre)}</span><span class="ln-v">${ps.length ? dinero(ps[0].p) : '<span style="color:var(--danger)">Falta</span>'}</span><span class="ln-s">${esc(sub)}${otro ? '<br>' + esc(otro) : ''}</span></button>`; }).join('') || '<p class="mat-s" style="margin:8px 2px">No hay materiales de este tipo.</p>';
      }
      h += '<button class="btn-nuevo" type="button" data-mat="nuevo">+ Material nuevo</button>';
    } else {
      const L = d.insumos.filter(i => i.grupo === filPrecios);
      h += L.map(i => `<button class="ln" type="button" data-insumo="${i.id}"><span class="ln-t">${esc(i.nombre)}</span><span class="ln-v">${dinero(i.p)}</span><span class="ln-s">${i.grupo === 'Accesorios' ? 'Por unidad, sin IVA' : i.r ? 'Rinde ' + num(i.r) + (Number(i.r) === 1 ? ' puerta' : ' puertas') + ' (general)' : 'Sin rendimiento general: lo pone cada modelo'}</span></button>`).join('') || '<p class="mat-s" style="margin:8px 2px">No hay nada aquí todavía.</p>';
      h += `<button class="btn-nuevo" type="button" data-insumo="nuevo">+ ${filPrecios === 'Accesorios' ? 'Herraje' : filPrecios === 'Consumibles' ? 'Consumible' : 'Pintura o masilla'} nuevo</button>`;
    }
    h += `<button class="regla" type="button" data-reglas style="margin-top:14px;border-top:1px solid var(--line)"><span class="grow"><span class="mat-t">Reglas</span><span class="mat-s">IVA ${num(R.iva)} % · ganancia ${num(R.ganancia)} % · gastos ${dinero(R.gastosMes)} ÷ ${R.puertasMes} puertas · corte ${num(R.corte)} cm · despunte ${num(R.despunte)} cm</span></span>${CHEV}</button>`;
    h += '<button class="btn-secondary" type="button" data-pdf-precios style="width:100%;margin-top:10px">Lista de precios en PDF</button>';
    return h;
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
  function pintarForm(){
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
      $('formTitulo').textContent = F.i === 'nuevo' ? 'Extra nuevo' : 'Extra';
      const v = numLibre(F.v) || 0, KIND = ['Protección', 'Marco decorativo', 'Vitral', 'Yeso'], k = KIND.includes(F.n) ? F.n : (F.n ? 'Otro' : null);
      h = `<div class="field"><span class="field-label">¿Qué extra es?</span>${opts(KIND.concat('Otro').map(x => [x, x]), F.kind || k, 'data-f-kind')}<div class="field-hint">Protección y marco decorativo salen solos en la venta con este precio.</div></div>
        ${(F.kind || k) === 'Otro' ? `<div class="field" id="c_fN"><label class="field-label" for="fN">Nombre</label><input class="input" id="fN" value="${esc(KIND.includes(F.n) ? '' : F.n || '')}"><div class="field-error">Escribe el nombre</div></div>` : ''}
        ${campo('fV', 'Cuánto te cuesta (con IVA)', F.v)}
        <div class="caja-nota" id="cajaExtra"><span>Se cobra al cliente</span>${dinero(v)} × ${num(1 + d.reglas.ganancia / 100)} = <b>${dinero(v * (1 + d.reglas.ganancia / 100))}</b>. Sin gastos fijos.</div>`;
      borrar = F.i !== 'nuevo';
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
    const map = { fCant:'cant', fCm:'cm', fNota:'nota', fA:'a', fH:'h', fRend:'r', fN:'n', fV:'v', fFijo:'fijo', fPrecio:'precio', fINom:'nombre', fP:'p', fR:'r', mNom:'nombre', mLargo:'largo', mAn:'an', mAl:'al', mEsp:'esp' };
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
      if(F.kind && F.kind !== 'Otro') F.n = F.kind;
      const v = numLibre(F.v); if(!String(F.n || '').trim()) return F.kind ? mal('fN') : toast('Elige qué extra es', 'error'); if(!(v > 0)) return mal('fV');
      c.extras = c.extras || []; if(F.i === 'nuevo') c.extras.push({ n:F.n.trim(), v }); else c.extras[F.i] = { n:F.n.trim(), v };
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
    const t = e.target.closest('#tabs [data-tab]'); if(t){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const fl = e.target.closest('[data-filtro]'); if(fl){ filtro = fl.dataset.filtro; pintar(); return; }
    const fp = e.target.closest('[data-filp]'); if(fp){ filPrecios = fp.dataset.filp; pintar(); return; }
    const vp = e.target.closest('[data-vprecios]'); if(vp){ vistaPrecios = vp.dataset.vprecios; pintar(); return; }
    if(e.target.closest('[data-pdf-precios]')) return pdfPrecios();
    if(window.CORTE && tab === 'semana' && !e.target.closest('#sheetFicha') && window.CORTE.click(e)) return;
    if(e.target.closest('#btnForm')) return guardar();
    if(e.target.closest('#btnBorrar')) return borrar();
    // ---- Dentro de una hoja de formulario
    if(F && e.target.closest('#sheetForm')){
      const set = (attr, k) => { const b = e.target.closest('[' + attr + ']'); if(b){ leer(); F[k] = b.getAttribute(attr); pintarForm(); return true; } };
      const pk = e.target.closest('[data-f-pick]'); if(pk){ leer(); F.pick = pk.dataset.fPick === 'si'; F.bm = ''; pintarForm(); return; }
      const fm = e.target.closest('[data-f-mat]'); if(fm){ F.mat = Number(fm.dataset.fMat); F.pick = false; pintarForm(); return; }
      if(e.target.closest('[data-ir-precios]')){ cerrarHoja('sheetForm', true); cerrarHoja('sheetFicha', true); F = null; tab = 'materiales'; pintar(); return; }
      const eb = e.target.closest('[data-elegir-base]'); if(eb){ ini = { modo:'copiar', de:isNaN(+eb.dataset.elegirBase) ? eb.dataset.elegirBase : +eb.dataset.elegirBase }; cerrarHoja('sheetForm', true); F = null; pintarFicha(); return; }
      const pv = e.target.closest('[data-prov]'); if(pv && F.t === 'precio'){ prov = pv.dataset.prov; pintarForm(); pintarFicha(); return; }
      const mo = e.target.closest('[data-modo]'); if(mo && F.t === 'precio'){ modo = mo.dataset.modo; pintarForm(); return; }
      if(set('data-f-que', 'que') || set('data-f-ori', 'ori') || set('data-f-acc', 'k') || set('data-f-kind', 'kind') || set('data-f-tipo', 'tipo')) return;
      const fj = e.target.closest('[data-f-fijo]'); if(fj){ leer(); F.fijo = fj.dataset.fFijo === 'si' ? (F.fijo || (Object.values(F.precios)[0] || {}).p || '0') : ''; pintarForm(); return; }
      if(F.t === 'corte' && window.CORTE && window.CORTE.clickForm(e, F)){ pintarForm(); return; }
      return;
    }
    // ---- Lista y ficha
    const md = e.target.closest('[data-modelo]'); if(md){ const id = isNaN(+md.dataset.modelo) ? md.dataset.modelo : +md.dataset.modelo; return abrirFicha(id); }
    const ir = e.target.closest('[data-ir]'); if(ir){ const s = $(ir.dataset.ir); if(s) s.scrollIntoView({ behavior:'smooth', block:'start' }); return; }
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
    const ex = e.target.closest('[data-extra]'); if(ex){ if(ex.dataset.extra === 'nuevo') return abrirForm({ t:'extra', i:'nuevo' }); const i = +ex.dataset.extra, o = D().costeo[sel].extras[i]; return abrirForm({ t:'extra', i, n:o.n, v:o.v }); }
    if(e.target.closest('[data-reglas]')) return abrirForm({ t:'reglas' });
    const mt = e.target.closest('[data-mat]'); if(mt){ if(mt.dataset.mat === 'nuevo') return abrirForm({ t:'matnuevo', tipo:filPrecios === 'hojas' ? 'laminas' : filPrecios }); const f = fabDe(mt.dataset.mat); return abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
    const ins = e.target.closest('[data-insumo]'); if(ins) return abrirForm({ t:'insumo', id:ins.dataset.insumo, grupo:filPrecios });
  });
  document.addEventListener('input', (e) => {
    if(e.target.id === 'buscaModelo'){ busca = e.target.value; const l = $('modLista'); if(l) l.innerHTML = listaModelos(lista().filter(FIL[filtro] || FIL.Todos).filter(o => { const t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return !busca || t(o.m.nombre).includes(t(busca)); })); return; }
    if(!F) return;
    if(e.target.id === 'fBuscaMat' || e.target.id === 'fBuscaBase'){ F.bm = e.target.value; const pos = e.target.selectionStart; pintarForm(); const el = $(e.target.id); if(el){ el.focus(); try{ el.setSelectionRange(pos, pos); } catch(_){} } return; }
    if(F.t === 'hoja' && ['fCant','fA','fH'].includes(e.target.id)){ leer(); const f = fabDe(F.mat), caja = $('cajaHoja'); if(f && f.hoja && caja){ const m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000; caja.innerHTML = `<span>Uso de la hoja</span>${num(m2, 3)} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b>`; } }
    if(F.t === 'extra' && e.target.id === 'fV'){ leer(); const v = numLibre(F.v) || 0, g = 1 + D().reglas.ganancia / 100, caja = $('cajaExtra'); if(caja) caja.innerHTML = `<span>Se cobra al cliente</span>${dinero(v)} × ${num(g)} = <b>${dinero(v * g)}</b>. Sin gastos fijos.`; }
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
    const mq = q.get('modelo'); if(mq){ const id = isNaN(+mq) ? mq : +mq; if(modelo(id)) abrirFicha(id); }
    const mat = q.get('material'); if(mat && tab === 'materiales'){ const f = fabDe(mat); if(f) abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
  })();
})();
