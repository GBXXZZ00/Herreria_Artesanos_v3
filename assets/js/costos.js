// Costos (solo quien confirma pagos: Ray o Gualfredo). Misma fórmula del Costeador de Ray:
// materiales con IVA, consumibles por rendimiento, accesorios, mano de obra por categoría de pago,
// costo × (1 + ganancia) + gastos fijos por puerta. Los extras se cobran aparte (× ganancia, sin gastos fijos).
// Pestañas: Modelos · Semana (plan de corte, corte.js) · Ganancia · Precios. Todo se guarda en la base.
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const X = window.COSTEO;
  const D = () => X.datos();
  const ancho = window.matchMedia('(min-width:1024px)');
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>';
  const TIPO = { hierro:'Hierro', aluminio:'Aluminio', laminas:'Láminas', vidrio:'Vidrio' };
  const COLOR = { verde:'#1B6B3A', amar:'var(--amber)', rojo:'var(--danger)', negro:'var(--ink)', gris:'var(--ink-faint)' };
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const numLibre = (v) => { const s = String(v == null ? '' : v).trim(); if(!s) return NaN; if(/,\d{1,3}$/.test(s) && !/\./.test(s)) return parseFloat(s.replace(',', '.')); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  const r2 = X.r2;
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };
  const q = new URLSearchParams(location.search);
  const idDe = (codigo) => (D().fab.find(f => f.codigo === codigo) || {}).id;
  // Bastidor estándar de todas las puertas (Memoria central): tubo 3" x 1", 2 de 200 cm + 2 de 88 cm
  const bastidor = () => { const t = idDe('t1x3') || (D().fab.find(f => f.pres === 'barra') || {}).id; return t ? [[t, 2, 200, 'Bastidor largo'], [t, 2, 88, 'Bastidor ancho']] : []; };
  const insumoDe = (codigo) => D().insumos.find(i => i.codigo === codigo);

  let tab = ['modelos','semana','ganancia','materiales'].includes(q.get('tab')) ? q.get('tab') : 'modelos', filtro = 'Todos';
  let sel = q.get('modelo') ? (isNaN(+q.get('modelo')) ? q.get('modelo') : +q.get('modelo')) : null;
  let prov = null, modo = 'metro', F = null, ocupado = false;
  window.CostosApp = { get prov(){ return prov; }, set prov(v){ prov = v; }, pintar:() => pintar(), recargar:() => recargar(), abrirCorte:(o) => abrirForm(Object.assign({ t:'corte' }, o)) };

  const modelo = (id) => D().catalogo.find(x => String(x.id) === String(id)) || D().enDiseno.find(x => String(x.id) === String(id));
  const foto = (m) => m.foto || 'assets/img/icon-192.png';
  const pill = (s) => `<span class="pill ${s[0]}">${esc(s[1])}</span>`;

  async function recargar(){ await X.cargar(); if(prov == null) prov = D().prov; if(window.CORTE) await window.CORTE.cargar().catch(() => {}); pintar(); if(sel != null && !ancho.matches && $('sheetDet').classList.contains('open')) pintarFicha(); }
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
    const idx = ['modelos','semana','ganancia','materiales'].indexOf(tab); $('tabs').querySelector('.seg-fondo').style.transform = `translateX(${idx * 100}%)`;
    $('filtros').classList.toggle('hidden', tab !== 'modelos');
    $('pieMat').classList.toggle('hidden', ancho.matches || tab !== 'materiales');
    const html = tab === 'modelos' ? secModelos() : tab === 'semana' ? (window.CORTE ? window.CORTE.html() : '') : tab === 'materiales' ? secMateriales() : secGanancia();
    $('cont').innerHTML = `<div class="cos-grid"><div style="min-width:0">${html}</div><div id="panel"></div></div>`;
    if(tab === 'semana' && window.CORTE) window.CORTE.despues();
    if(ancho.matches && sel != null && tab === 'modelos') pintarFicha();
  }

  // Modelos en fabricación primero
  const enFab = () => { const n = {}; (D().enFabricacion || []).forEach(id => { n[id] = 1; }); return n; };
  const ESTADO = { listo:['verde','Listo'], borrador:['amar','Borrador'], diseno:['amar','En diseño'] };
  function lista(){
    const d = D(), nf = enFab();
    const peso = (o) => (nf[o.m.id] ? 0 : 2) + (o.x ? 0 : 1);
    return d.enDiseno.map(m => ({ m, x:X.costear(m.id, { prov }), dis:true, fab:0 })).concat(d.catalogo.map(m => ({ m, x:X.costear(m.id, { prov }), dis:false, fab:nf[m.id] || 0 })).sort((a, b) => peso(a) - peso(b)));
  }
  function secModelos(){
    const todos = lista();
    const FIL = { 'Todos':() => true, 'En fabricación':(o) => o.fab, 'Sin costear':(o) => !o.x && !o.dis, 'Borrador':(o) => o.x && o.x.c.estado !== 'listo', 'Puertas':(o) => o.m.tipo === 'Puerta Multilock', 'Combos':(o) => o.m.tipo === 'Combo', 'Madera':(o) => o.m.tipo === 'Puerta de Madera' };
    const nSin = todos.filter(o => !o.x && !o.dis).length, nFabSin = todos.filter(o => o.fab && !(o.x && o.x.c.piezas.length)).length;
    $('filtrosL').innerHTML = Object.keys(FIL).map(k => `<button type="button" class="fx ${k === filtro ? 'on' : ''} ${k === 'Sin costear' && nSin ? 'rev' : ''}" data-filtro="${esc(k)}">${esc(k)}${k === 'Sin costear' ? ' · ' + nSin : ''}${k === 'En fabricación' ? ' · ' + todos.filter(o => o.fab).length : ''}</button>`).join('');
    const ver = todos.filter(FIL[filtro] || FIL.Todos);
    const cat = todos.filter(o => !o.dis), listos = cat.filter(o => o.x && o.x.c.estado === 'listo' && !o.x.falta.length);
    const cost = cat.filter(o => o.x && !o.x.falta.length);
    const prom = cost.length ? cost.reduce((a, o) => a + o.x.pct, 0) / cost.length : 0;
    $('subtitulo').textContent = `${listos.length} de ${cat.length} modelos listos`;
    let h = `<div class="meta"><div class="meta-b"><span style="width:${cat.length ? Math.round(listos.length / cat.length * 100) : 0}%"></span></div><div class="meta-t"><b>${listos.length} de ${cat.length} listos</b><span>${cost.length ? 'Ganancia promedio ' + Math.round(prom) + ' %' : 'Sin datos de ganancia'}</span></div></div>`;
    if(nFabSin) h += `<div class="caja-amar" style="margin:0 0 10px">${plural(nFabSin, '1 modelo en fabricación no tiene', 'modelos en fabricación no tienen')} cortes. Están arriba: empieza por ellos.</div>`;
    h += '<div class="leyenda" style="margin:0 2px 10px">' + [['gris','Sin costear'],['amar','Borrador'],['verde','Listo']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('') + '</div>';
    h += ver.length ? ver.map(({ m, x, dis, fab }) => { const st = !x ? ['gris','Sin costear'] : ESTADO[x.c.estado] || ESTADO.borrador, s = X.semaforo(x);
      return `<button class="mod ${String(sel) === String(m.id) && ancho.matches ? 'sel' : ''}" type="button" data-modelo="${esc(m.id)}"><img src="${esc(foto(m))}" alt="" loading="lazy">
        <span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${dis ? 'En diseño · ' + esc(x.c.codigo || '') : esc(m.tipo) + (x ? ' · ' + esc(x.c.codigo || '') : '')}${x && !x.falta.length ? ' · cuesta ' + dinero(x.costo) : ''}</span>
        ${fab ? `<span class="mat-s" style="color:var(--accent);font-weight:800">En fabricación</span>` : ''}</span>
        <span class="mat-n"><b>${dis ? dinero(x.final) : dinero(m.precio_base)}</b><span>${dis ? 'sugerido' : 'precio hoy'}</span><span style="margin-top:3px">${pill(st)}${x && !x.falta.length && !dis ? ' ' + pill(s) : ''}</span></span></button>`; }).join('')
      : '<div class="vacio-d"><b>No hay modelos aquí</b>Cambia el filtro de arriba.</div>';
    return h;
  }

  // ================= Ficha del modelo =================
  function abrirFicha(id){ sel = id; if(ancho.matches){ pintar(); return; } pintarFicha(); abrirHoja('sheetDet'); }
  function pintarFicha(){
    const m = modelo(sel); if(!m) return;
    const x = X.costear(m.id, { prov, modo });
    const R = D().reglas;
    let body, foot;
    if(!x){
      const base = D().catalogo.find(c => D().costeo[c.id] && D().costeo[c.id].piezas.length);
      body = `<div class="mod" style="padding-top:0"><img src="${esc(foto(m))}" alt=""><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(m.tipo)} · precio hoy ${dinero(m.precio_base)}</span></span></div>
        <div class="vacio-d" style="padding:28px 8px"><b>Este modelo no tiene costeo ni cortes</b>Se cargan sus cortes (tubos con medida), hojas (lámina y vidrio), pintura y accesorios. Así sale su costo, su precio sugerido y entra al plan de corte.</div>
        <button class="opt-grande" type="button" data-bastidor><b>Empezar con el bastidor estándar</b><span>Tubo 3" x 1": 2 de 200 cm y 2 de 88 cm, ${R.bisagras} bisagras y cerradura. Después agregas lo propio del modelo.</span></button>`;
      foot = base ? `<button class="btn-primary" type="button" data-copiar-de="${esc(base.id)}">Copiar todo del ${esc(base.nombre)}</button>` : '';
    } else {
      const s = X.semaforo(x), c = x.c, dis = !!m.en_diseno;
      const sub = (g) => x.lineas.filter(l => l.g === g);
      const grupos = ['Hierro','Lámina','Vidrio','Pintura y masilla','Consumibles','Accesorios','Mano de obra'].filter(g => sub(g).length);
      const provsHierro = D().proveedores.filter(p => (p.tipos || []).includes('hierro'));
      // Cuánto saldría la puerta con los precios de cada proveedor (lado a lado)
      const compara = provsHierro.length > 1 ? provsHierro.map(p => ({ p, y:X.costear(m.id, { prov:p.id, modo }) })) : [];
      body = `<div class="mod" style="padding-top:0"><img src="${esc(foto(m))}" alt=""><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(c.codigo || '')} · ${dis ? 'En diseño (no está en el catálogo)' : c.estado === 'borrador' ? 'Borrador' : 'En el catálogo'} · ${esc(x.cat ? x.cat.nombre : 'sin categoría de pago')}</span></span>${dis ? '' : pill(s)}</div>
        <div class="field-label" style="margin-top:6px">Precios de</div>
        <div class="opts" style="--cols:2">${provsHierro.map(p => `<button class="opt ${String(p.id) === String(prov) ? 'selected' : ''}" type="button" data-prov="${p.id}">${esc(p.nombre.replace('Inversiones ', ''))}</button>`).join('')}</div>
        <div class="field-label" style="margin-top:10px">Cobrar el hierro</div>
        <div class="opts" style="--cols:2"><button class="opt ${modo === 'metro' ? 'selected' : ''}" type="button" data-modo="metro">Por metro usado</button><button class="opt ${modo === 'tubo' ? 'selected' : ''}" type="button" data-modo="tubo">Barra completa</button></div>
        ${x.avisos.map(a => `<div class="caja-amar">${esc(a)}</div>`).join('')}
        ${x.falta.length ? `<div class="caja-rara">Faltan datos: ${esc(x.falta.join(', '))}. Sin esto no se puede saber si gana.</div>` : ''}
        <div class="precio-caja" style="margin-top:12px">
          <div class="res-c"><span>Costo</span><b>${dinero(x.costo)}</b></div>
          <div class="res-c"><span>${dis ? 'Precio hoy' : 'Precio en catálogo'}</span><b>${dis ? 'Sin precio' : dinero(x.hoy)}</b></div>
          <div class="res-c final"><span>Precio sugerido (costo + ${R.ganancia} % + gastos fijos)</span><b>${dinero(x.final)}</b></div>
        </div>
        ${compara.length ? `<div class="tit">Con cada proveedor</div><div class="rep">${compara.map(({ p, y }) => `<button class="rep-f" type="button" data-prov="${p.id}"><span>${esc(p.nombre.replace('Inversiones ', ''))}<small class="mat-s" style="display:block;font-weight:600">cuesta ${dinero(y.costo)}${y.avisos.length ? ' · usa precios de otro en ' + y.avisos.length : ''}</small></span><b>${dinero(y.final)}</b></button>`).join('')}</div><p class="mat-s" style="margin:6px 2px 0">Precio sugerido de la puerta comprando el material a cada uno.</p>` : ''}
        ${!dis ? `<div class="tot"><div class="fila"><span>Precio en catálogo</span><b>${dinero(x.hoy)}</b></div><div class="fila"><span>Menos costo</span><b>− ${dinero(x.costo)}</b></div><div class="fila"><span>Menos gastos fijos por puerta</span><b>− ${dinero(x.fijos)}</b></div><div class="fila fin"><span>Ganas por puerta</span><span style="color:${COLOR[s[0]]}">${x.ganancia < 0 ? '− ' : ''}${dinero(Math.abs(x.ganancia))} · ${Math.round(x.pct)} %</span></div></div>` : ''}
        <div class="tit">Cómo sale el precio</div>
        <div class="formula">Costo ${dinero(x.costo)} × ${String(1 + R.ganancia / 100).replace('.', ',')} = ${dinero(x.venta)}<br>+ gastos fijos ${dinero(R.gastosMes)} ÷ ${R.puertasMes} puertas = ${dinero(x.fijos)}<br><b>Precio sugerido ${dinero(x.final)}</b></div>
        ${grupos.map(g => `<div class="grp"><div class="grp-h"><span>${g}</span><span>${dinero(sub(g).reduce((a, l) => a + l.v, 0))}</span></div>
          ${sub(g).map(l => `<${g === 'Pintura y masilla' || g === 'Consumibles' ? `button type="button" data-rend="${esc(l.n)}"` : 'div'} class="ln"><span class="ln-t">${esc(l.n)}</span><span class="ln-v">${dinero(l.v)}</span><span class="ln-s">${esc(l.det)}${g === 'Pintura y masilla' || g === 'Consumibles' ? ' · tocar para cambiar' : ''}</span></${g === 'Pintura y masilla' || g === 'Consumibles' ? 'button' : 'div'}>`).join('')}</div>`).join('')}
        ${x.falta.filter(f => D().insumos.some(i => i.nombre === f)).map(f => `<button type="button" class="ln" data-rend="${esc(f)}"><span class="ln-t">${esc(f)}</span><span class="ln-v" style="color:var(--danger)">Falta</span><span class="ln-s">¿Cuántas puertas rinde? Tocar para ponerlo</span></button>`).join('')}
        <div class="tit">Cortes de hierro (entran al plan de corte de la semana)</div>
        ${c.piezas.map((p, i) => { const f = D().fab.find(y => String(y.id) === String(p[0])) || { nombre:'Material' }; return `<button class="pz" type="button" data-pieza="${i}"><span class="pz-n">${p[1]}×</span><span><span class="pz-t">${esc(f.nombre)}</span><span class="pz-s">${esc(p[3] || '')}</span></span><span class="pz-m">${p[2]} cm</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-pieza="nueva">+ Agregar pieza</button>
        ${x.grupos.length ? '<div class="tit">Cómo se cortan las barras</div>' : ''}
        ${x.grupos.map(g => `<div class="barra-t">${esc(g.nombre)} · ${g.barras.length} ${g.barras.length === 1 ? 'barra' : 'barras'} de ${String(g.largo / 100).replace('.', ',')} m${g.fijo ? ' · precio fijo para costear' : ''}</div>
          <div class="barras">${g.barras.map(b => `<div class="barra">${b.piezas.map(p => `<span style="flex:${p.cm}" title="${esc(p.nota || '')}">${p.cm}</span>`).join('')}${b.libre > 0 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 40 ? 'sobra ' + Math.round(b.libre) : ''}</span>` : ''}</div>`).join('')}</div>`).join('')}
        <div class="tit">Hojas (lámina y vidrio)</div>
        ${c.hojas.map((p, i) => { const f = D().fab.find(y => String(y.id) === String(p[0])) || { nombre:'Material' }; return `<button class="pz" type="button" data-hoja="${i}"><span class="pz-n">${p[1]}×</span><span><span class="pz-t">${esc(f.nombre)}</span><span class="pz-s">${esc(p[4] || '')}</span></span><span class="pz-m">${p[2]} × ${p[3]} cm</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-hoja="nueva">+ Agregar hoja</button>
        <div class="tit">Accesorios</div>
        ${Object.entries(c.acc || {}).map(([k, n]) => { const it = D().insumos.find(y => String(y.id) === String(k)); if(!it) return ''; return `<button class="pz" type="button" data-acc="${esc(k)}"><span class="pz-n">${n}×</span><span class="pz-t">${esc(it.nombre)}</span><span class="pz-m">${dinero(it.p)}</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-acc="nuevo">+ Agregar accesorio</button>
        <div class="tit">Extras (se cobran aparte, sin gastos fijos)</div>
        ${x.extras.length ? x.extras.map((e, i) => `<button class="ln" type="button" data-extra="${i}"><span class="ln-t">${esc(e.n)}</span><span class="ln-v">${dinero(e.venta)}</span><span class="ln-s">Cuesta ${dinero(e.costo)} · se suma a la venta si el cliente lo pide</span></button>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin extras. Ejemplo: protección, marco decorativo.</p>'}
        <button class="btn-nuevo" type="button" data-extra="nuevo">+ Agregar extra</button>
        <div class="tit">Mano de obra</div>
        <div class="opts" style="--cols:2">${D().categorias.filter(k => !m.tipo || k.producto === m.tipo || (m.tipo === 'Puerta Multilock' && k.producto === 'Puerta Multilock')).map(k => `<button class="opt ${x.cat && String(x.cat.id) === String(k.id) ? 'selected' : ''}" type="button" data-cat="${k.id}">${esc(k.nombre)}</button>`).join('')}</div>
        <p class="mat-s" style="margin:6px 2px 0">${c.categoria_pago_id ? 'Costos usa esta categoría para costear.' : 'Sale de la categoría de pago del modelo en el Catálogo.'} Las tarifas se cambian en <a href="categorias-pago.html" style="color:var(--accent);font-weight:800">Categorías de pago</a>.</p>
        <div class="field" style="margin-top:14px"><label class="field-label" for="fNotas">Notas</label><textarea class="input" id="fNotas" rows="2">${esc(c.notas || '')}</textarea><div class="field-hint">Se guardan al salir del campo.</div></div>`;
      foot = `<div class="pie-dos2" style="display:flex;gap:10px;margin:0"><button class="btn-secondary" type="button" data-duplicar style="flex:1;height:54px">Duplicar</button><button class="btn-primary" type="button" data-usar style="flex:1.4" ${x.falta.length ? 'disabled' : ''}>${dis ? 'Pasar al catálogo' : 'Usar este precio'}</button></div>`;
    }
    if(q.get('volver') === 'semana') body = `<a class="caja-ok" style="display:block;text-decoration:none" href="costos.html?tab=semana&para=${esc(q.get('para') || '')}">${x && x.c.piezas.length ? 'Cortes cargados. Volver al plan de corte' : 'Cuando cargues sus cortes, vuelve al plan de corte'} →</a>` + body;
    if(ancho.matches){ const pn = $('panel'); if(pn) pn.innerHTML = `<h2 style="margin:0 0 12px;font-size:20px">${esc(m.nombre)}</h2>${body}<div style="margin-top:16px">${foot}</div>`; }
    else { $('detTitulo').textContent = m.nombre; $('detBody').innerHTML = body; $('detFoot').innerHTML = foot; }
  }

  // ================= Precios (lista sin IVA por proveedor) =================
  function secMateriales(){
    const d = D();
    $('subtitulo').textContent = 'Lista de precios sin IVA, por proveedor';
    const pn = (k) => ((d.proveedores.find(x => String(x.id) === String(k)) || {}).nombre || '').replace('Inversiones ', '').replace(' (ferretería y otros)', '');
    let h = '<div class="caja-nota" style="margin:0 0 6px"><span>Qué es esta lista</span>Lo que cuesta cada material con cada proveedor, sin IVA. No es por pedido: es la lista de precios que usa Costos para calcular cada modelo. El costo de cada pedido está en la pestaña Semana.</div><p class="mat-s" style="margin:6px 2px 8px">Los precios entran solos cuando se registra una compra en Depósito. Si un material tiene "precio fijo para costear", Costos usa ese.</p>';
    ['hierro','laminas','vidrio','aluminio'].forEach(t => {
      const L = d.fab.filter(f => f.tipo === t && f.activo); if(!L.length) return;
      h += `<div class="tit">${TIPO[t]}</div><div class="mat-lista ya">` + L.map(f => {
        const ps = Object.entries(f.precios || {}).map(([k, v]) => ({ k, p:Number(v.p), esp:v.esp })).sort((a, b) => a.p - b.p);
        return `<button class="mat" type="button" data-mat="${f.id}"><span class="mat-ico fab">${f.pres === 'barra' ? String(f.largo / 100).replace('.', ',') + 'm' : '▭'}</span>
          <span style="min-width:0"><span class="mat-t">${esc(f.nombre)}</span><span class="mat-s">${ps.length ? ps.map(p => esc(pn(p.k)) + ' ' + dinero(p.p) + (p.esp ? ' · ' + esc(p.esp) : '')).join(' · ') : 'Sin precios todavía'}</span>${f.fijo ? `<span class="mat-s" style="color:var(--accent);font-weight:800">Precio fijo para costear ${dinero(f.fijo)}</span>` : ''}</span>
          <span class="mat-n"><b style="font-size:18px">${ps.length ? dinero(ps[0].p) : 'Sin precio'}</b><span>${ps.length && f.pres === 'barra' ? dinero(ps[0].p / (f.largo / 100)) + ' el metro' : f.pres === 'hoja' ? 'la hoja' : ''}</span></span></button>`; }).join('') + '</div>';
    });
    ['Pintura y masilla','Consumibles','Accesorios'].forEach(g => {
      h += `<div class="tit">${g}</div><div class="mat-lista ya">` + d.insumos.filter(i => i.grupo === g).map(i => `<button class="mat" type="button" data-insumo="${i.id}"><span class="mat-ico fab">${esc(i.nombre[0])}</span><span style="min-width:0"><span class="mat-t">${esc(i.nombre)}</span><span class="mat-s">${g === 'Accesorios' ? 'Por unidad' : i.r ? 'Rinde ' + String(i.r).replace('.', ',') + (Number(i.r) === 1 ? ' puerta' : ' puertas') + ' (general)' : 'Rendimiento: lo pone cada modelo'}</span></span><span class="mat-n"><b style="font-size:18px">${dinero(i.p)}</b><span>sin IVA</span></span></button>`).join('') + '</div>';
    });
    h += '<button class="btn-nuevo" type="button" data-insumo="nuevo">+ Agregar pintura, consumible o accesorio</button>';
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-mat="nuevo">+ Agregar material</button>';
    return h;
  }

  // ================= Ganancia =================
  const totalFijos = () => D().gastosFijos.reduce((a, g) => a + (Number(g.monto) || 0), 0);
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  let VENTAS = null;
  async function cargarVentasMes(){
    const hoy = new Date(), ini = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-01';
    const { data, error } = await db.from('ventas').select('id,total,confirmada_en,interna,estado,items:venta_items(catalogo_id,nombre,cantidad,precio_unitario)').gte('confirmada_en', ini).not('estado', 'in', '(cotizacion,cancelada)');
    VENTAS = error ? [] : (data || []).filter(v => !v.interna);
  }
  function mesVentas(){
    const out = { puertas:0, vendido:0, costo:0, aporte:0, sinCosto:0, nSin:0 };
    (VENTAS || []).forEach(v => (v.items || []).forEach(it => {
      const n = it.cantidad, x = it.catalogo_id ? X.costear(it.catalogo_id) : null, ok = x && !x.falta.length;
      out.puertas += n; out.vendido += Number(it.precio_unitario) * n;
      if(ok){ out.costo += x.costo * n; out.aporte += (Number(it.precio_unitario) - x.costo) * n; }
      else { out.sinCosto += Number(it.precio_unitario) * n; out.nSin += n; }
    }));
    return out;
  }
  function secGanancia(){
    const d = D(), R = d.reglas;
    const fijos = totalFijos(), porPuerta = fijos / R.puertasMes;
    const hoy = new Date(), M = mesVentas();
    $('subtitulo').textContent = 'Gastos fijos y ganancia por producto';
    const cubre = Math.min(1, fijos ? M.aporte / fijos : 0), falta = Math.max(0, fijos - M.aporte);
    const prom = M.puertas - M.nSin > 0 ? M.aporte / (M.puertas - M.nSin) : null;
    let h = `<div class="tit" style="margin-top:0">¿Alcanzamos este mes? · ${MESES[hoy.getMonth()]}</div>
      <div class="meta"><div class="meta-b"><span style="width:${Math.round(cubre * 100)}%"></span></div>
        <div class="meta-t"><b>${falta > 0.005 ? 'Faltan ' + dinero(falta) : 'Gastos fijos cubiertos'}</b><span>Cubres ${dinero(Math.min(M.aporte, fijos))} de ${dinero(fijos)}</span></div></div>
      <div class="tot">
        <div class="fila"><span>Vendido con costeo (${plural(M.puertas - M.nSin, '1 puerta', 'puertas')})</span><b>+ ${dinero(M.vendido - M.sinCosto)}</b></div>
        <div class="fila"><span>Costo de materiales y mano de obra</span><b>− ${dinero(M.costo)}</b></div>
        <div class="fila"><span>Gastos fijos del mes</span><b>− ${dinero(fijos)}</b></div>
        <div class="fila fin"><span>${M.aporte - fijos >= 0 ? 'Te queda' : 'Te falta'}</span><span style="color:${M.aporte - fijos >= 0 ? 'var(--accent)' : 'var(--danger)'}">${dinero(Math.abs(M.aporte - fijos))}</span></div></div>
      ${falta > 0.005 && prom > 0 ? `<p class="mat-s" style="margin:8px 2px 0">Al ritmo de este mes cada puerta deja ${dinero(prom)}. Faltan unas <b>${Math.ceil(falta / prom)} puertas</b> para cubrir los gastos fijos. Previstas al mes: ${R.puertasMes}; vas ${M.puertas}.</p>` : ''}
      ${M.nSin ? `<div class="caja-amar">Además vendiste ${plural(M.nSin, '1 puerta', 'puertas')} sin costeo por ${dinero(M.sinCosto)}. No se sabe cuánto dejan: carga su costeo para que este número sea exacto.</div>` : ''}`;
    h += `<div class="tit">Gastos fijos del mes</div><div class="mat-lista">${d.gastosFijos.map((g, i) => `<button class="regla" type="button" data-gfijo="${i}"><span class="grow"><span class="mat-t">${esc(g.cat)}</span></span><b>${dinero(g.monto)}</b>${CHEV}</button>`).join('')}
      <div class="regla" style="cursor:default"><span class="grow"><span class="mat-t">Total</span></span><b>${dinero(fijos)}</b></div></div>
      <button class="btn-nuevo" type="button" data-gfijo="nuevo">+ Agregar gasto fijo</button>
      <div class="mat-lista" style="margin-top:8px"><button class="regla" type="button" data-regla="puertasMes"><span class="grow"><span class="mat-t">Puertas al mes</span><span class="mat-s">Entre cuántas puertas se reparten</span></span><b>${R.puertasMes}</b>${CHEV}</button></div>
      <div class="formula" style="margin-top:8px">${dinero(fijos)} ÷ ${R.puertasMes} puertas = <b>${dinero(porPuerta)} por puerta</b>. Esto se suma al precio sugerido de cada modelo.<br><span class="mat-s"><a href="finanzas.html?tab=gastos" style="color:var(--accent);font-weight:800">En Finanzas, Gastos</a> ves lo que se pagó de verdad cada mes.</span></div>`;
    const gr = d.gastoReal;
    if(gr && Math.abs(gr.porPuerta - porPuerta) > porPuerta * 0.1) h += `<div class="caja-amar">Tu gasto real por puerta es ${dinero(gr.porPuerta)} (últimos 3 meses: ${dinero(gr.gastos)} ÷ ${gr.puertas} puertas); usas ${dinero(porPuerta)}. Si quieres, cambia los gastos fijos o las puertas al mes. No cambia solo.</div>`;
    else if(!gr) h += '<p class="mat-s" style="margin:6px 2px 0">Cuando haya 3 meses de gastos cargados en Finanzas, aquí sale el gasto real por puerta para comparar.</p>';
    const filas = d.catalogo.filter(m => m.tipo !== 'Puerta de Madera').map(m => ({ m, x:X.costear(m.id, { prov }) }));
    const cost = filas.filter(o => o.x && !o.x.falta.length).sort((a, b) => a.x.pct - b.x.pct), sin = filas.filter(o => !(o.x && !o.x.falta.length));
    h += `<div class="tit">Ganancia por producto</div><p class="mat-s" style="margin:0 2px 6px">Precio del catálogo menos costo y gastos fijos. Los de abajo del 30 % conviene subirlos.</p>`;
    h += cost.map(({ m, x }) => { const s = X.semaforo(x); return `<button class="rent" type="button" data-modelo="${esc(m.id)}" data-ir-modelos><span class="grow"><span class="mat-t">${esc(m.nombre)}</span>
        <span class="mat-s">Cuesta ${dinero(x.costo)} · sugerido ${dinero(x.final)} · catálogo ${dinero(x.hoy)}</span></span>
        <span class="mat-n"><b style="color:${COLOR[s[0]]}">${x.ganancia < 0 ? '− ' : ''}${dinero(Math.abs(x.ganancia))}</b><span>${pill(s)}</span></span></button>`; }).join('') || '<p class="mat-s">Todavía no hay modelos costeados.</p>';
    if(sin.length) h += `<details class="sin-c"><summary>${plural(sin.length, '1 modelo sin costear', 'modelos sin costear')} · no se sabe si ganan</summary>${sin.map(({ m }) => `<button class="rent" type="button" data-modelo="${esc(m.id)}" data-ir-modelos><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(m.tipo)} · catálogo ${dinero(m.precio_base)}</span></span><span class="pill gris">Costear</span></button>`).join('')}</details>`;
    h += `<p class="mat-s" style="margin:8px 2px 0">La madera se costea aparte, más adelante.</p>`;
    const fila = (k, t, s2, v) => `<button class="regla" type="button" data-regla="${k}"><span class="grow"><span class="mat-t">${t}</span><span class="mat-s">${s2}</span></span><b>${v}</b>${CHEV}</button>`;
    h += `<div class="tit">Reglas</div><div class="mat-lista">
      ${fila('iva', 'IVA', 'Se suma a los materiales', R.iva + ' %')}
      ${fila('ganancia', 'Ganancia', 'Se suma al costo de cada modelo y a los extras', R.ganancia + ' %')}
      ${fila('corte', 'Grosor del corte', 'Lo que se pierde en cada corte del disco (cm)', String(R.corte).replace('.', ',') + ' cm')}</div>
      <div class="leyenda">${[['verde','Gana 30 % o más'],['amar','Gana de 15 a 30 %'],['rojo','Gana menos de 15 %'],['negro','Pierde dinero'],['gris','Sin costear o faltan datos']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('')}</div>
      <a class="btn-nuevo" href="categorias-pago.html" style="text-decoration:none">Categorías de pago (mano de obra)</a>`;
    return h;
  }

  // ================= Formularios =================
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${valor != null && String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  const campo = (id, label, val, extra) => `<div class="field" id="c_${id}"><label class="field-label" for="${id}">${label}</label><input class="input" id="${id}" inputmode="decimal" value="${esc(val == null ? '' : val)}"><div class="field-error">Revisa este dato</div>${extra ? `<div class="field-hint">${extra}</div>` : ''}</div>`;
  function abrirForm(f){ F = f; pintarForm(); abrirHoja('sheetForm'); }
  function pintarForm(){
    const d = D(); let h = '', boton = 'Guardar', borrar = false;
    if(F.t === 'pieza'){
      $('formTitulo').textContent = F.i === 'nueva' ? 'Pieza nueva' : 'Pieza';
      h = `<div class="field"><span class="field-label">Material</span>${opts(d.fab.filter(f => f.pres === 'barra' && f.activo).map(f => [f.id, esc(f.nombre)]), F.mat, 'data-f-mat')}</div>
        <div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fCm', 'Medida (cm)', F.cm)}</div>
        <div class="field"><label class="field-label" for="fNota">Para qué es</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-hint">Ejemplo: bastidor largo, divisor, marco.</div></div>
        <a class="btn-secondary" href="deposito.html?tab=fab" style="display:flex;align-items:center;justify-content:center;width:100%;text-decoration:none">¿No está el material? Agrégalo en Depósito</a>`;
      borrar = F.i !== 'nueva';
    }
    if(F.t === 'acc'){
      $('formTitulo').textContent = F.nuevo ? 'Accesorio nuevo' : 'Accesorio';
      h = `<div class="field"><span class="field-label">Accesorio</span>${opts(d.insumos.filter(i => i.grupo === 'Accesorios').map(i => [i.id, esc(i.nombre) + '<br><small style="font-weight:600">' + dinero(i.p) + ' sin IVA</small>']), F.k, 'data-f-acc', 1)}</div>${campo('fCant', 'Cantidad por puerta', F.cant)}`;
      borrar = !F.nuevo;
    }
    if(F.t === 'hoja'){
      $('formTitulo').textContent = F.i === 'nueva' ? 'Hoja nueva' : 'Hoja';
      const f = d.fab.find(y => String(y.id) === String(F.mat));
      const m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f ? f.hoja[0] * f.hoja[1] / 10000 : 1;
      h = `<div class="field"><span class="field-label">Material</span>${opts(d.fab.filter(x => x.pres === 'hoja' && x.activo).map(x => [x.id, esc(x.nombre)]), F.mat, 'data-f-mat')}</div>
        <div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fA', 'Ancho (cm)', F.a)}</div>${campo('fH', 'Alto (cm)', F.h)}
        <div class="field"><label class="field-label" for="fNota">Para qué es</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-hint">Ejemplo: panel, franja de vidrio.</div></div>
        ${f ? `<div class="caja-nota" id="cajaHoja"><span>Uso de la hoja</span>${m2.toLocaleString('es-VE', { maximumFractionDigits:3 })} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b></div>` : ''}`;
      borrar = F.i !== 'nueva';
    }
    if(F.t === 'rend'){
      $('formTitulo').textContent = F.nombre;
      h = `${campo('fRend', '¿Cuántas puertas rinde 1 unidad?', F.r, 'Si se usan 2 por puerta, escribe 0,5.')}`;
    }
    if(F.t === 'extra'){
      $('formTitulo').textContent = F.i === 'nuevo' ? 'Extra nuevo' : 'Extra';
      const v = numLibre(F.v) || 0;
      const KIND = ['Protección', 'Marco decorativo', 'Vitral', 'Yeso'];
      const k = KIND.includes(F.n) ? F.n : (F.n ? 'Otro' : null);
      h = `<div class="field"><span class="field-label">¿Qué extra es?</span>${opts(KIND.concat('Otro').map(x => [x, x]), F.kind || k, 'data-f-kind')}<div class="field-hint">Protección y marco decorativo salen solos en la venta con este precio.</div></div>
        ${(F.kind || k) === 'Otro' ? `<div class="field" id="c_fN"><label class="field-label" for="fN">Nombre</label><input class="input" id="fN" value="${esc(KIND.includes(F.n) ? '' : F.n || '')}"><div class="field-error">Escribe el nombre</div></div>` : ''}
        ${campo('fV', 'Cuánto te cuesta (con IVA)', F.v)}
        <div class="caja-nota" id="cajaExtra"><span>Se cobra al cliente</span>${dinero(v)} × ${String(1 + d.reglas.ganancia / 100).replace('.', ',')} = <b>${dinero(v * (1 + d.reglas.ganancia / 100))}</b>. Sin gastos fijos. En la venta aparece como sugerencia del modelo.</div>`;
      borrar = F.i !== 'nuevo';
    }
    if(F.t === 'regla'){
      const N = { iva:'IVA (%)', ganancia:'Ganancia (%)', puertasMes:'Puertas al mes', corte:'Grosor del corte (cm)' };
      $('formTitulo').textContent = 'Cambiar regla';
      h = campo('fRegla', N[F.k], d.reglas[F.k], 'Cambia el precio sugerido de todos los modelos.');
    }
    if(F.t === 'mat'){
      const f = d.fab.find(y => String(y.id) === String(F.id));
      $('formTitulo').textContent = f ? f.nombre : 'Material';
      const provs = d.proveedores.filter(p => (p.tipos || []).includes(f.tipo));
      h = `<div class="tit" style="margin-top:4px">Precio sin IVA por proveedor</div>
        <p class="mat-s" style="margin:0 2px 8px">Solo salen los proveedores que venden ${esc((TIPO[f.tipo] || '').toLowerCase())}. Para que salga otro, márcalo en Finanzas, Proveedores, Editar.</p>
        ${provs.length ? provs.map(p => `<div class="input-row">${campo('fp_' + p.id, esc(p.nombre.replace('Inversiones ', '')), (F.precios[p.id] || {}).p)}<div class="field"><label class="field-label" for="fe_${p.id}">Espesor</label><input class="input" id="fe_${p.id}" value="${esc((F.precios[p.id] || {}).esp || '')}"></div></div>`).join('') : '<div class="caja-amar">Ningún proveedor vende este tipo. Márcalo en Finanzas, Proveedores, Editar.</div>'}
        ${f.tipo === 'hierro' ? `<div class="field"><span class="field-label">Para costear usar</span>${opts([['no', 'Última compra'], ['si', 'Precio fijo']], F.fijo != null && F.fijo !== '' ? 'si' : 'no', 'data-f-fijo')}</div>${F.fijo != null && F.fijo !== '' ? campo('fFijo', 'Precio fijo ($)', F.fijo) : ''}` : ''}
        <a class="row-link" href="deposito.html?tab=fab" style="margin-top:6px"><span>Medidas y existencias (en Depósito)</span>${CHEV}</a>`;
    }
    if(F.t === 'insumo'){
      const i = F.id === 'nuevo' ? null : d.insumos.find(y => String(y.id) === String(F.id));
      $('formTitulo').textContent = i ? i.nombre : 'Insumo nuevo';
      h = (i ? '' : `<div class="field" id="c_fINom"><label class="field-label" for="fINom">Nombre</label><input class="input" id="fINom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div></div>
          <div class="field"><span class="field-label">Grupo</span>${opts([['Pintura y masilla','Pintura y masilla'],['Consumibles','Consumibles'],['Accesorios','Accesorios']], F.grupo, 'data-f-grupo', 1)}</div>`)
        + campo('fP', 'Precio sin IVA ($)', i ? i.p : F.p) + ((i ? i.grupo : F.grupo) !== 'Accesorios' ? campo('fR', 'Rinde (puertas por unidad, general)', i ? i.r : F.r, 'Vacío = lo pone cada modelo (fondo, esmalte y masilla).') : '');
    }
    if(F.t === 'gfijo'){
      $('formTitulo').textContent = F.i === 'nuevo' ? 'Gasto fijo nuevo' : F.cat;
      h = `<div class="field" id="c_fGNom"><label class="field-label" for="fGNom">Qué gasto es</label><input class="input" id="fGNom" value="${esc(F.cat || '')}"><div class="field-error">Escribe el nombre</div><div class="field-hint">Ejemplo: alquiler, luz, contador.</div></div>
        ${campo('fGMonto', 'Cuánto es al mes ($)', F.monto, 'Cambia el precio sugerido de todos los modelos.')}`;
      borrar = F.i !== 'nuevo';
    }
    if(F.t === 'usar'){
      const m = modelo(sel), x = X.costear(m.id, { prov }), redondo = Math.ceil(x.final / 5) * 5;
      $('formTitulo').textContent = m.en_diseno ? 'Pasar al catálogo' : 'Usar este precio';
      h = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${m.en_diseno ? 'El modelo aparece en el Catálogo con este precio y la vendedora ya lo puede vender. Después ponle fotos y su categoría de pago en Catálogo.' : `Hoy está en ${dinero(m.precio_base)}. El sugerido es ${dinero(x.final)}. El costeo queda "Listo".`}</p>
        ${campo('fPrecio', 'Precio de venta ($)', F.precio || redondo, 'Redondeado hacia arriba de 5 en 5. Puedes cambiarlo.')}`;
      boton = m.en_diseno ? 'Pasar al catálogo' : 'Cambiar precio';
    }
    if(F.t === 'corte' && window.CORTE){ const o = window.CORTE.form(F); h = o.h; boton = o.boton; $('formTitulo').textContent = o.titulo; }
    $('formBody').innerHTML = h;
    $('formFoot').innerHTML = `${borrar ? '<button class="btn-secondary" type="button" id="btnBorrar" style="height:54px;flex:1">Quitar</button>' : ''}<button class="btn-primary" type="button" id="btnForm" style="flex:2">${boton}</button>`;
    $('formFoot').style.display = 'flex'; $('formFoot').style.gap = '10px';
  }
  const val = (id) => { const el = $(id); return el ? el.value : undefined; };
  function leer(){
    const map = { fCant:'cant', fCm:'cm', fNota:'nota', fA:'a', fH:'h', fRend:'r', fN:'n', fV:'v', fFijo:'fijo', fPrecio:'precio', fINom:'nombre', fP:'p', fR:'r' };
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
    let ok = false, c = sel != null && d.costeo[sel] ? copia() : null;
    if(F.t === 'pieza'){
      const cant = Math.round(numLibre(F.cant)), cm = numLibre(F.cm);
      if(!F.mat) return toast('Elige el material', 'error');
      if(!(cant > 0)) return mal('fCant'); if(!(cm > 0) || cm > 1000) return mal('fCm');
      const p = [Number(F.mat), cant, cm, F.nota || ''];
      if(F.i === 'nueva') c.piezas.push(p); else c.piezas[F.i] = p;
      ok = await guardarCopia(c, 'Pieza guardada. El costo se recalculó.');
    }
    if(F.t === 'hoja'){
      const cant = Math.round(numLibre(F.cant)), a = numLibre(F.a), h = numLibre(F.h);
      if(!F.mat) return toast('Elige el material', 'error');
      if(!(cant > 0)) return mal('fCant'); if(!(a > 0)) return mal('fA'); if(!(h > 0)) return mal('fH');
      const fila = [Number(F.mat), cant, a, h, F.nota || ''];
      if(F.i === 'nueva') c.hojas.push(fila); else c.hojas[F.i] = fila;
      ok = await guardarCopia(c, 'Hoja guardada');
    }
    if(F.t === 'acc'){
      const n = numLibre(F.cant); if(!F.k) return toast('Elige el accesorio', 'error'); if(!(n > 0)) return mal('fCant');
      c.acc = c.acc || {}; if(!F.nuevo && F.k0 && String(F.k0) !== String(F.k)) delete c.acc[F.k0]; c.acc[F.k] = n;
      ok = await guardarCopia(c, 'Accesorio guardado');
    }
    if(F.t === 'rend'){ const r = numLibre(F.r); if(!(r > 0)) return mal('fRend'); (c.rend = c.rend || {})[F.id] = r; ok = await guardarCopia(c, 'Rendimiento guardado para este modelo'); }
    if(F.t === 'extra'){
      if(F.kind && F.kind !== 'Otro') F.n = F.kind;
      const v = numLibre(F.v); if(!String(F.n || '').trim()) return F.kind ? mal('fN') : toast('Elige qué extra es', 'error'); if(!(v > 0)) return mal('fV');
      c.extras = c.extras || []; if(F.i === 'nuevo') c.extras.push({ n:F.n.trim(), v }); else c.extras[F.i] = { n:F.n.trim(), v };
      ok = await guardarCopia(c, 'Extra guardado');
    }
    if(F.t === 'regla'){
      const v = numLibre(val('fRegla')); if(!(v >= 0) || (F.k === 'puertasMes' && !(v >= 1))) return mal('fRegla');
      const k = { iva:'iva', ganancia:'ganancia', puertasMes:'puertas_mes', corte:'corte_cm' }[F.k];
      ok = await hacer(() => X.rpc('costeo_reglas_guardar', { p:{ [k]:v } }), 'Regla cambiada. Todos los modelos se recalcularon.');
    }
    if(F.t === 'gfijo'){
      const nom = String(val('fGNom') || '').trim(), monto = numLibre(val('fGMonto'));
      if(!nom) return mal('fGNom'); if(!(monto >= 0)) return mal('fGMonto');
      const g = F.i === 'nuevo' ? null : d.gastosFijos[F.i];
      ok = await hacer(() => X.rpc('gasto_fijo_guardar', { p:{ id:g ? g.id : null, categoria:nom, monto } }), 'Gasto fijo guardado. El precio sugerido se recalculó.');
    }
    if(F.t === 'mat'){
      const f = d.fab.find(y => String(y.id) === String(F.id)), cambios = [];
      for(const [k, o] of Object.entries(F.precios)){ const p = numLibre(o.p), act = (f.precios || {})[k];
        if(p > 0 && (!act || Number(act.p) !== p || String(act.esp || '') !== String(o.esp || ''))) cambios.push({ material_id:f.id, proveedor_id:Number(k), precio:p, espesor:o.esp || null }); }
      const fijo = f.tipo === 'hierro' ? numLibre(F.fijo) : NaN, fijoN = fijo > 0 ? fijo : null;
      ok = await hacer(async () => {
        for(const p of cambios) await X.rpc('material_precio_guardar', { p });
        if(f.tipo === 'hierro' && (fijoN || null) !== (f.fijo ? Number(f.fijo) : null)){
          const { data, error } = await db.rpc('deposito_fab_datos'); if(error) throw error;
          const m = data.fab.find(y => y.id === f.id);
          await X.rpc('material_fab_guardar', { p:{ id:m.id, nombre:m.nombre, tipo:m.tipo, presentacion:m.pres, largo_cm:m.largo, hoja_ancho_cm:m.hoja && m.hoja[0], hoja_alto_cm:m.hoja && m.hoja[1], espesor:m.espesor, precio_fijo:fijoN, minimo:m.minimo, activo:m.activo } });
        }
      }, 'Precios guardados');
    }
    if(F.t === 'insumo'){
      const i = F.id === 'nuevo' ? null : d.insumos.find(y => String(y.id) === String(F.id)), p = numLibre(F.p);
      if(!i && !String(F.nombre || '').trim()) return mal('fINom');
      if(!i && !F.grupo) return toast('Elige el grupo', 'error');
      if(!(p >= 0)) return mal('fP');
      const r = numLibre(F.r);
      ok = await hacer(() => X.rpc('costeo_insumo_guardar', { p:{ id:i ? i.id : null, nombre:i ? i.nombre : F.nombre.trim(), grupo:i ? i.grupo : F.grupo, precio:p, rendimiento:r > 0 ? r : null } }), 'Guardado');
    }
    if(F.t === 'usar'){
      const precio = numLibre(F.precio); if(!(precio > 0)) return mal('fPrecio');
      const m = modelo(sel), eraDis = m.en_diseno, c0 = d.costeo[sel];
      let nuevoSel = sel;
      ok = await hacer(async () => { if(!c0.mid) await X.guardarCosteo(sel); const r = await X.rpc('costeo_pasar_catalogo', { mid:c0.mid, p_precio:precio }); nuevoSel = r.catalogo_id; }, eraDis ? 'Listo: ya está en el Catálogo' : 'Precio cambiado en el Catálogo');
      if(ok) sel = nuevoSel;
    }
    if(ok === false) return;
    const t1 = F.t; cerrarHoja('sheetForm', true); F = null; pintar(); if(!ancho.matches && sel != null && !['gfijo','regla','insumo','mat'].includes(t1)) pintarFicha();
  }
  async function borrar(){
    if(!F) return;
    if(F.t === 'gfijo'){
      const g = D().gastosFijos[F.i];
      const ok = await hacer(() => X.rpc('gasto_fijo_guardar', { p:{ id:g.id, categoria:g.cat, monto:g.monto, activo:false } }), 'Quitado');
      if(ok){ cerrarHoja('sheetForm', true); F = null; pintar(); } return;
    }
    const c = copia();
    if(F.t === 'pieza') c.piezas.splice(F.i, 1);
    if(F.t === 'extra') c.extras.splice(F.i, 1);
    if(F.t === 'hoja') c.hojas.splice(F.i, 1);
    if(F.t === 'acc') delete c.acc[F.k];
    const ok = await guardarCopia(c, 'Quitado');
    if(ok){ cerrarHoja('sheetForm', true); F = null; pintar(); if(!ancho.matches) pintarFicha(); }
  }

  // ================= Eventos =================
  document.addEventListener('click', async (e) => {
    if(!D()) return;
    const t = e.target.closest('#tabs [data-tab]'); if(t){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const fl = e.target.closest('[data-filtro]'); if(fl){ filtro = fl.dataset.filtro; pintar(); return; }
    if(window.CORTE && tab === 'semana' && window.CORTE.click(e)) return;
    const md = e.target.closest('[data-modelo]'); if(md && md.hasAttribute('data-ir-modelos')) tab = 'modelos';
    if(md) return abrirFicha(isNaN(+md.dataset.modelo) ? md.dataset.modelo : +md.dataset.modelo);
    const pv = e.target.closest('[data-prov]'); if(pv && e.target.closest('#detBody,#panel')){ prov = pv.dataset.prov; return pintarFicha(); }
    if(e.target.closest('[data-bastidor]')){
      const R = D().reglas, bis = insumoDe('bisagra'), cer = insumoDe('cerradura'), acc = {};
      if(bis) acc[bis.id] = R.bisagras; if(cer) acc[cer.id] = 1;
      D().costeo[sel] = { mid:null, estado:'borrador', piezas:bastidor(), hojas:[], rend:{}, acc, extras:[], notas:'' };
      const ok = await hacer(() => X.guardarCosteo(sel), 'Bastidor puesto. Agrega los cortes propios del modelo.');
      if(!ok) delete D().costeo[sel];
      if(!ancho.matches) pintarFicha(); return;
    }
    const mo = e.target.closest('[data-modo]'); if(mo){ modo = mo.dataset.modo; return pintarFicha(); }
    const ct = e.target.closest('[data-cat]'); if(ct && D().costeo[sel]){ const c = copia(); c.categoria_pago_id = Number(ct.dataset.cat); await guardarCopia(c, 'Mano de obra cambiada'); if(!ancho.matches) pintarFicha(); return; }
    const cp = e.target.closest('[data-copiar-de]'); if(cp){
      const base = D().costeo[cp.dataset.copiarDe]; if(!base) return;
      D().costeo[sel] = Object.assign(JSON.parse(JSON.stringify(base)), { mid:null, estado:'borrador', notas:'' });
      const ok = await hacer(() => X.guardarCosteo(sel), 'Piezas copiadas. Cambia lo que sea distinto.');
      if(!ok) delete D().costeo[sel];
      if(!ancho.matches) pintarFicha(); return;
    }
    if(e.target.closest('[data-duplicar]')){
      const c = D().costeo[sel]; let nid = null;
      const ok = await hacer(async () => { const r = await X.rpc('costeo_duplicar', { mid:c.mid }); nid = 'd' + r.id; }, 'Copia creada en diseño. Cambia sus piezas y pásala al catálogo cuando esté lista.');
      if(ok && nid){ filtro = 'Todos'; sel = nid; pintar(); if(!ancho.matches) pintarFicha(); } return;
    }
    if(e.target.closest('[data-usar]')) return abrirForm({ t:'usar' });
    const pz = e.target.closest('[data-pieza]');
    if(pz){ const c = D().costeo[sel]; if(pz.dataset.pieza === 'nueva') return abrirForm({ t:'pieza', i:'nueva', mat:idDe('t1x1') || null, cant:1, cm:'', nota:'' }); const i = +pz.dataset.pieza, p = c.piezas[i]; return abrirForm({ t:'pieza', i, mat:p[0], cant:p[1], cm:p[2], nota:p[3] }); }
    const hj = e.target.closest('[data-hoja]'); if(hj){ if(hj.dataset.hoja === 'nueva') return abrirForm({ t:'hoja', i:'nueva', mat:idDe('lam14') || null, cant:1, a:'', h:'', nota:'' }); const i = +hj.dataset.hoja, p = D().costeo[sel].hojas[i]; return abrirForm({ t:'hoja', i, mat:p[0], cant:p[1], a:p[2], h:p[3], nota:p[4] }); }
    const ac = e.target.closest('[data-acc]'); if(ac){ const c = D().costeo[sel]; if(ac.dataset.acc === 'nuevo') return abrirForm({ t:'acc', k:null, nuevo:true, cant:1 }); return abrirForm({ t:'acc', k:ac.dataset.acc, k0:ac.dataset.acc, cant:c.acc[ac.dataset.acc] }); }
    const rd = e.target.closest('[data-rend]'); if(rd){ const it = D().insumos.find(y => y.nombre === rd.dataset.rend); if(!it || !D().costeo[sel]) return; const c = D().costeo[sel]; return abrirForm({ t:'rend', id:it.id, nombre:it.nombre, r:(c.rend || {})[it.id] || it.r || '' }); }
    const ex = e.target.closest('[data-extra]'); if(ex){ if(ex.dataset.extra === 'nuevo') return abrirForm({ t:'extra', i:'nuevo' }); const i = +ex.dataset.extra, o = D().costeo[sel].extras[i]; return abrirForm({ t:'extra', i, n:o.n, v:o.v }); }
    const rg = e.target.closest('[data-regla]'); if(rg) return abrirForm({ t:'regla', k:rg.dataset.regla });
    const gf = e.target.closest('[data-gfijo]'); if(gf){ if(gf.dataset.gfijo === 'nuevo') return abrirForm({ t:'gfijo', i:'nuevo', cat:'', monto:'' }); const g = D().gastosFijos[+gf.dataset.gfijo]; return abrirForm({ t:'gfijo', i:+gf.dataset.gfijo, cat:g.cat, monto:g.monto }); }
    const mt = e.target.closest('[data-mat]'); if(mt){ if(mt.dataset.mat === 'nuevo'){ location.href = 'deposito.html?tab=fab'; return; } const f = D().fab.find(y => String(y.id) === mt.dataset.mat); return abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
    if(e.target.closest('#btnNuevoMat')){ location.href = 'deposito.html?tab=fab'; return; }
    const ins = e.target.closest('[data-insumo]'); if(ins) return abrirForm({ t:'insumo', id:ins.dataset.insumo, grupo:null });
    if(e.target.closest('#btnForm')) return guardar();
    if(e.target.closest('#btnBorrar')) return borrar();
    if(F){
      const set = (attr, k) => { const b = e.target.closest('[' + attr + ']'); if(b && b.closest('#formBody')){ leer(); F[k] = b.getAttribute(attr); pintarForm(); return true; } };
      if(set('data-f-acc', 'k')) return;
      if(set('data-f-kind', 'kind')) return;
      if(set('data-f-mat', 'mat') || set('data-f-grupo', 'grupo')) return;
      const fj = e.target.closest('[data-f-fijo]'); if(fj){ leer(); F.fijo = fj.dataset.fFijo === 'si' ? (F.fijo || (Object.values(F.precios)[0] || {}).p || '0') : ''; pintarForm(); return; }
      if(F.t === 'corte' && window.CORTE && window.CORTE.clickForm(e, F)){ pintarForm(); return; }
    }
  });
  document.addEventListener('input', (e) => {
    if(!F) return;
    if(F.t === 'hoja' && ['fCant','fA','fH'].includes(e.target.id)){ leer(); const f = D().fab.find(y => String(y.id) === String(F.mat)); const caja = $('cajaHoja'); if(f && caja){ const m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000; caja.innerHTML = `<span>Uso de la hoja</span>${m2.toLocaleString('es-VE', { maximumFractionDigits:3 })} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b>`; } }
    if(F.t === 'extra' && e.target.id === 'fV'){ leer(); const v = numLibre(F.v) || 0, g = 1 + D().reglas.ganancia / 100, caja = $('cajaExtra'); if(caja) caja.innerHTML = `<span>Se cobra al cliente</span>${dinero(v)} × ${String(g).replace('.', ',')} = <b>${dinero(v * g)}</b>. Sin gastos fijos. En la venta aparece como sugerencia del modelo.`; }
  });
  document.addEventListener('change', async (e) => {
    if(e.target.id === 'fNotas' && sel != null && D().costeo[sel]){ const c = copia(); c.notas = e.target.value; await guardarCopia(c, 'Notas guardadas'); }
  });
  ancho.addEventListener('change', pintar);

  (async () => {
    const perfil = await window.Sesion.requerir();
    if(!perfil) return;
    if(!perfil.confirma_abonos){ $('cont').innerHTML = '<div class="caja-amar" style="margin:16px 18px">Costos es solo para Ray o Gualfredo.</div>'; $('filtros').classList.add('hidden'); return; }
    $('cont').innerHTML = '<p class="mat-s" style="margin:24px 18px">Cargando…</p>';
    try{ await X.cargar(); prov = D().prov; await Promise.all([cargarVentasMes(), window.CORTE ? window.CORTE.cargar() : null]); }
    catch(e){ $('cont').innerHTML = `<div class="caja-amar" style="margin:16px 18px">${esc(errTxt(e))}</div><div style="margin:0 18px"><button class="btn-secondary" type="button" onclick="location.reload()">Reintentar</button></div>`; return; }
    pintar();
    if(sel != null && modelo(sel)) abrirFicha(sel);
    const mq = q.get('material'); if(mq && tab === 'materiales'){ const f = D().fab.find(y => String(y.id) === mq); if(f) abrirForm({ t:'mat', id:f.id, precios:JSON.parse(JSON.stringify(f.precios || {})), fijo:f.fijo }); }
  })();
})();
