// MAQUETA: módulo Costos (solo admin). Misma fórmula del Costeador de Ray:
// materiales con IVA, consumibles por rendimiento, accesorios, mano de obra por categoría de pago,
// costo × (1 + ganancia) + gastos fijos por puerta. Los extras se cobran aparte (× ganancia, sin gastos fijos).
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero, fotoModelo } = window.AH;
  const $ = (id) => document.getElementById(id);
  const X = window.MAQUETA;
  const D = () => X.datos();
  const ancho = window.matchMedia('(min-width:1024px)');
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>';
  const TIPO = { hierro:'Hierro', aluminio:'Aluminio', laminas:'Láminas', vidrio:'Vidrio', madera:'Madera' };
  const COLOR = { verde:'#1B6B3A', amar:'var(--amber)', rojo:'var(--danger)', negro:'var(--ink)', gris:'var(--ink-faint)' };
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const tieneCortes = (mid) => { const c = D().costeo[mid]; return !!(c && c.piezas && c.piezas.length); };
  // Bastidor estándar de todas las puertas (Memoria central): tubo 3" x 1", 2 de 200 cm + 2 de 88 cm
  const BASTIDOR = [['t1x3',2,200,'Bastidor largo'],['t1x3',2,88,'Bastidor ancho']];
  const numLibre = (v) => { const s = String(v == null ? '' : v).trim().replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const r2 = X.r2;
  const q = new URLSearchParams(location.search);

  let tab = ['modelos','semana','ganancia','materiales'].includes(q.get('tab')) ? q.get('tab') : 'modelos', filtro = 'Todos', sel = q.get('modelo') ? (isNaN(+q.get('modelo')) ? q.get('modelo') : +q.get('modelo')) : null;
  let prov = 'cya', modo = 'metro', F = null;

  const modelo = (id) => D().catalogo.find(x => String(x.id) === String(id)) || D().enDiseno.find(x => String(x.id) === String(id));
  const foto = (m) => { try{ return fotoModelo(m) || 'assets/img/foto-puerta.png'; } catch(e){ return 'assets/img/foto-puerta.png'; } };
  const pill = (s) => `<span class="pill ${s[0]}">${esc(s[1])}</span>`;

  // ================= Pantalla =================
  function pintar(){
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const idx = ['modelos','semana','ganancia','materiales'].indexOf(tab); $('tabs').querySelector('.seg-fondo').style.transform = `translateX(${idx * 100}%)`;
    $('filtros').classList.toggle('hidden', tab !== 'modelos');
    $('pieMat').classList.toggle('hidden', ancho.matches || tab !== 'materiales');
    const html = tab === 'modelos' ? secModelos() : tab === 'semana' ? secSemana() : tab === 'materiales' ? secMateriales() : secGanancia();
    $('cont').innerHTML = `<div class="cos-grid"><div style="min-width:0">${html}</div><div id="panel"></div></div>`;
    if(ancho.matches && sel && tab === 'modelos') pintarFicha();
  }

  // Cuántas unidades de cada modelo están hoy en fabricación (para ponerlas primero)
  function enFab(){ const n = {}; D().ventas.filter(v => v.estado === 'en_produccion').forEach(v => v.items.forEach(it => { if((it.etapas || []).some(e => e.estado === 'pendiente')) n[it.catalogo_id] = (n[it.catalogo_id] || 0) + it.cantidad; })); return n; }
  const ESTADO = { listo:['verde','Listo'], borrador:['amar','Borrador'], diseno:['amar','En diseño'] };
  function lista(){
    const d = D(), nf = enFab();
    const peso = (o) => (nf[o.m.id] ? 0 : 2) + (o.x ? 0 : 1);
    return d.enDiseno.map(m => ({ m, x:X.costear(m.id), dis:true, fab:0 })).concat(d.catalogo.map(m => ({ m, x:X.costear(m.id), dis:false, fab:nf[m.id] || 0 })).sort((a, b) => peso(a) - peso(b)));
  }
  function secModelos(){
    const todos = lista();
    const FIL = { 'Todos':() => true, 'En fabricación':(o) => o.fab, 'Sin costear':(o) => !o.x, 'Borrador':(o) => o.x && o.x.c.estado !== 'listo', 'Puertas':(o) => o.m.tipo === 'Puerta Multilock', 'Combos':(o) => o.m.tipo === 'Combo', 'Madera':(o) => o.m.tipo === 'Puerta de Madera' };
    const nSin = todos.filter(o => !o.x && !o.dis).length, nFabSin = todos.filter(o => o.fab && !o.x).length;
    $('filtrosL').innerHTML = Object.keys(FIL).map(k => `<button type="button" class="fx ${k === filtro ? 'on' : ''} ${k === 'Sin costear' && nSin ? 'rev' : ''}" data-filtro="${esc(k)}">${esc(k)}${k === 'Sin costear' ? ' · ' + nSin : ''}${k === 'En fabricación' ? ' · ' + todos.filter(o => o.fab).length : ''}</button>`).join('');
    const ver = todos.filter(FIL[filtro]);
    const cat = todos.filter(o => !o.dis), listos = cat.filter(o => o.x && o.x.c.estado === 'listo' && !o.x.falta.length);
    const cost = cat.filter(o => o.x && !o.x.falta.length);
    const prom = cost.length ? cost.reduce((a, o) => a + o.x.pct, 0) / cost.length : 0;
    $('subtitulo').textContent = `${listos.length} de ${cat.length} modelos listos`;
    let h = `<div class="meta"><div class="meta-b"><span style="width:${Math.round(listos.length / cat.length * 100)}%"></span></div><div class="meta-t"><b>${listos.length} de ${cat.length} listos</b><span>${cost.length ? 'Ganancia promedio ' + Math.round(prom) + ' %' : 'Sin datos de ganancia'}</span></div></div>`;
    if(nFabSin) h += `<div class="caja-amar" style="margin:0 0 10px">${plural(nFabSin, '1 modelo en fabricación no tiene', 'modelos en fabricación no tienen')} costeo ni cortes. Están arriba: empieza por ellos.</div>`;
    h += '<div class="leyenda" style="margin:0 2px 10px">' + [['gris','Sin costear'],['amar','Borrador'],['verde','Listo']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('') + '</div>';
    h += ver.length ? ver.map(({ m, x, dis, fab }) => { const st = !x ? ['gris','Sin costear'] : ESTADO[x.c.estado] || ESTADO.borrador, s = X.semaforo(x);
      return `<button class="mod ${String(sel) === String(m.id) && ancho.matches ? 'sel' : ''}" type="button" data-modelo="${esc(m.id)}"><img src="${esc(foto(m))}" alt="">
        <span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${dis ? 'En diseño · ' + esc(x.c.codigo) : esc(m.tipo) + (x ? ' · ' + esc(x.c.codigo) : '')}${x && !x.falta.length ? ' · cuesta ' + dinero(x.costo) : ''}</span>
        ${fab ? `<span class="mat-s" style="color:var(--accent);font-weight:800">${plural(fab, '1 en fabricación', 'en fabricación')}</span>` : ''}</span>
        <span class="mat-n"><b>${dis ? dinero(x.final) : dinero(m.precio_base)}</b><span>${dis ? 'sugerido' : 'precio hoy'}</span><span style="margin-top:3px">${pill(st)}${x && !x.falta.length ? ' ' + pill(s) : ''}</span></span></button>`; }).join('')
      : '<div class="vacio-d"><b>No hay modelos aquí</b>Cambia el filtro de arriba.</div>';
    return h;
  }

  // ================= Ficha del modelo =================
  function abrirFicha(id){ sel = id; if(ancho.matches){ pintar(); return; } pintarFicha(); abrirHoja('sheetDet'); }
  function pintarFicha(){
    const m = modelo(sel); if(!m) return;
    const x = X.costear(m.id);
    let body, foot;
    if(!x){
      body = `<div class="mod" style="padding-top:0"><img src="${esc(foto(m))}" alt=""><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(m.tipo)} · precio hoy ${dinero(m.precio_base)}</span></span></div>
        <div class="vacio-d" style="padding:28px 8px"><b>Este modelo no tiene costeo ni cortes</b>Se cargan sus cortes (tubos con medida), hojas (lámina y vidrio), pintura y accesorios. Así sale su costo, su precio sugerido y entra al plan de corte.</div>
        <button class="opt-grande" type="button" data-bastidor><b>Empezar con el bastidor estándar</b><span>Tubo 3" x 1": 2 de 200 cm y 2 de 88 cm, 3 bisagras y cerradura. Después agregas lo propio del modelo.</span></button>`;
      foot = `<button class="btn-primary" type="button" data-copiar-de="7">Copiar todo del Modelo bitral</button>`;
    } else {
      const s = X.semaforo(x), c = x.c, dis = !!m.en_diseno;
      const sub = (g) => x.lineas.filter(l => l.g === g);
      const grupos = ['Hierro','Lámina','Vidrio','Pintura y masilla','Consumibles','Accesorios','Mano de obra'].filter(g => sub(g).length);
      body = `<div class="mod" style="padding-top:0"><img src="${esc(foto(m))}" alt=""><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(c.codigo)} · ${dis ? 'En diseño (no está en el catálogo)' : c.estado === 'borrador' ? 'Borrador' : 'En el catálogo'} · ${esc(x.cat ? x.cat.nombre : 'sin categoría de pago')}</span></span>${pill(s)}</div>
        <div class="field-label" style="margin-top:6px">Precios de</div>
        <div class="opts" style="--cols:2">${D().proveedores.filter(p => p.tipos.includes('hierro')).map(p => `<button class="opt ${p.id === prov ? 'selected' : ''}" type="button" data-prov="${p.id}">${esc(p.nombre.replace('Inversiones ', ''))}</button>`).join('')}</div>
        <div class="field-label" style="margin-top:10px">Cobrar el hierro</div>
        <div class="opts" style="--cols:2"><button class="opt ${modo === 'metro' ? 'selected' : ''}" type="button" data-modo="metro">Por metro usado</button><button class="opt ${modo === 'tubo' ? 'selected' : ''}" type="button" data-modo="tubo">Barra completa</button></div>
        ${x.avisos.map(a => `<div class="caja-amar">${esc(a)}</div>`).join('')}
        ${x.falta.length ? `<div class="caja-rara">Faltan datos: ${esc(x.falta.join(', '))}. Sin esto no se puede saber si gana.</div>` : ''}
        <div class="precio-caja" style="margin-top:12px">
          <div class="res-c"><span>Costo</span><b>${dinero(x.costo)}</b></div>
          <div class="res-c"><span>${dis ? 'Precio hoy' : 'Precio en catálogo'}</span><b>${dis ? 'Sin precio' : dinero(x.hoy)}</b></div>
          <div class="res-c final"><span>Precio sugerido (costo + ${D().reglas.ganancia} % + gastos fijos)</span><b>${dinero(x.final)}</b></div>
        </div>
        ${!dis ? `<div class="tot"><div class="fila"><span>Precio en catálogo</span><b>${dinero(x.hoy)}</b></div><div class="fila"><span>Menos costo</span><b>− ${dinero(x.costo)}</b></div><div class="fila"><span>Menos gastos fijos por puerta</span><b>− ${dinero(x.fijos)}</b></div><div class="fila fin"><span>Ganas por puerta</span><span style="color:${COLOR[s[0]]}">${x.ganancia < 0 ? '− ' : ''}${dinero(Math.abs(x.ganancia))} · ${Math.round(x.pct)} %</span></div></div>` : ''}
        <div class="tit">Cómo sale el precio</div>
        <div class="formula">Costo ${dinero(x.costo)} × ${1 + D().reglas.ganancia / 100} = ${dinero(x.venta)}<br>+ gastos fijos ${dinero(D().reglas.gastosMes)} ÷ ${D().reglas.puertasMes} puertas = ${dinero(x.fijos)}<br><b>Precio sugerido ${dinero(x.final)}</b></div>
        ${grupos.map(g => `<div class="grp"><div class="grp-h"><span>${g}</span><span>${dinero(sub(g).reduce((a, l) => a + l.v, 0))}</span></div>
          ${sub(g).map(l => `<${g === 'Pintura y masilla' || g === 'Consumibles' ? `button type="button" data-rend="${esc(l.n)}"` : 'div'} class="ln"><span class="ln-t">${esc(l.n)}</span><span class="ln-v">${dinero(l.v)}</span><span class="ln-s">${esc(l.det)}${g === 'Pintura y masilla' || g === 'Consumibles' ? ' · tocar para cambiar' : ''}</span></${g === 'Pintura y masilla' || g === 'Consumibles' ? 'button' : 'div'}>`).join('')}</div>`).join('')}
        ${x.falta.filter(f => f !== 'categoría de pago').map(f => `<button type="button" class="ln" data-rend="${esc(f)}"><span class="ln-t">${esc(f)}</span><span class="ln-v" style="color:#B42318">Falta</span><span class="ln-s">¿Cuántas puertas rinde? Tocar para ponerlo</span></button>`).join('')}
        <div class="tit">Cortes de hierro (entran al plan de corte de la semana)</div>
        ${c.piezas.map((p, i) => { const f = D().fab.find(y => y.id === p[0]); return `<button class="pz" type="button" data-pieza="${i}"><span class="pz-n">${p[1]}×</span><span><span class="pz-t">${esc(f.nombre)}</span><span class="pz-s">${esc(p[3] || '')}</span></span><span class="pz-m">${p[2]} cm</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-pieza="nueva">+ Agregar pieza</button>
        <div class="tit">Cómo se cortan las barras</div>
        ${x.grupos.map(g => `<div class="barra-t">${esc(g.nombre)} · ${g.barras.length} ${g.barras.length === 1 ? 'barra' : 'barras'} de ${g.largo / 100} m${g.fijo ? ' · precio fijo para costear' : ''}</div>
          <div class="barras">${g.barras.map(b => `<div class="barra">${b.piezas.map(p => `<span style="flex:${p.cm}" title="${esc(p.nota || '')}">${p.cm}</span>`).join('')}${b.libre > 0 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 40 ? 'sobra ' + b.libre : ''}</span>` : ''}</div>`).join('')}</div>`).join('')}
        <div class="tit">Hojas (lámina y vidrio)</div>
        ${c.hojas.map((p, i) => { const f = D().fab.find(y => y.id === p[0]); return `<button class="pz" type="button" data-hoja="${i}"><span class="pz-n">${p[1]}×</span><span><span class="pz-t">${esc(f.nombre)}</span><span class="pz-s">${esc(p[4] || '')}</span></span><span class="pz-m">${p[2]} × ${p[3]} cm</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-hoja="nueva">+ Agregar hoja</button>
        <div class="tit">Accesorios</div>
        ${Object.entries(c.acc || {}).map(([k, n]) => { const it = D().insumos.find(y => y.id === k); return `<button class="pz" type="button" data-acc="${esc(k)}"><span class="pz-n">${n}×</span><span class="pz-t">${esc(it.nombre)}</span><span class="pz-m">${dinero(it.p)}</span></button>`; }).join('')}
        <button class="btn-nuevo" type="button" data-acc="nuevo">+ Agregar accesorio</button>
        <div class="tit">Extras (se cobran aparte, sin gastos fijos)</div>
        ${x.extras.length ? x.extras.map((e, i) => `<button class="ln" type="button" data-extra="${i}"><span class="ln-t">${esc(e.n)}</span><span class="ln-v">${dinero(e.venta)}</span><span class="ln-s">Cuesta ${dinero(e.costo)} · se suma a la venta si el cliente lo pide</span></button>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin extras. Ejemplo: manillón más largo, vidrio especial.</p>'}
        <button class="btn-nuevo" type="button" data-extra="nuevo">+ Agregar extra</button>
        <div class="tit">Mano de obra</div>
        <p class="mat-s" style="margin:0 2px">Sale de la categoría de pago del modelo (${esc(x.cat ? x.cat.nombre : 'sin categoría')}). Las tarifas se cambian en <a href="categorias-pago.html" style="color:var(--accent);font-weight:800">Categorías de pago</a>.</p>
        <div class="field" style="margin-top:14px"><label class="field-label" for="fNotas">Notas</label><textarea class="input" id="fNotas" rows="2" placeholder="">${esc(c.notas || '')}</textarea></div>`;
      foot = `<div class="pie-dos2" style="display:flex;gap:10px;margin:0"><button class="btn-secondary" type="button" data-duplicar style="flex:1;height:54px">Duplicar</button><button class="btn-primary" type="button" data-usar style="flex:1.4">${dis ? 'Pasar al catálogo' : 'Usar este precio'}</button></div>`;
    }
    if(q.get('volver') === 'semana') body = `<a class="caja-ok" style="display:block;text-decoration:none" href="costos.html?tab=semana&para=${esc(q.get('para') || '')}">${x ? 'Cortes cargados. Volver al plan de corte' : 'Cuando cargues sus cortes, vuelve al plan de corte'} →</a>` + body;
    if(ancho.matches){ $('panel').innerHTML = `<h2 style="margin:0 0 12px;font-size:20px">${esc(m.nombre)}</h2>${body}<div style="margin-top:16px">${foot}</div>`; }
    else { $('detTitulo').textContent = m.nombre; $('detBody').innerHTML = body; $('detFoot').innerHTML = foot; }
  }

  // ================= Plan semanal de corte =================
  // Sale de Producción: los pasos de Hierro asignados a un herrero para ese sábado (lo calcula window.MAQUETA.planSemana).
  // Junta las piezas de todas esas puertas por perfil, usa primero los retazos y acomoda el resto en las barras.
  // La app sugiere; Ray acepta o cambia. Al aceptar, cada herrero ve su hoja de corte en Mi trabajo.
  const SAB = X.sabados();
  let semSab = q.get('para') === SAB.proximo ? SAB.proximo : SAB.este;
  const sabTxt = (iso) => { try{ return window.AH.sabadoCorto(iso); } catch(e){ return iso; } };
  const nomMat = (mid) => (D().fab.find(f => f.id === mid) || {}).nombre || mid;
  const cmTxt = (n) => Math.round(n) + ' cm';
  function etiquetaBarra(b){ return b.tipo === 'retazo' ? 'Retazo de ' + b.largo + ' cm del depósito' : 'Barra ' + b.n + (b.comprar ? ' · hay que comprarla' : ' · del depósito'); }
  function barraHtml(b, i, P){
    const ajenas = b.piezas.filter(p => p.tid !== b.tid);
    const nomAj = [...new Set(ajenas.map(p => (P.herreros.find(h => h.tid === p.tid) || {}).nombre))];
    return `<button type="button" class="barra-btn" data-barra="${i}"><span class="barra-l"><span>${esc(etiquetaBarra(b))}</span><span>sobra ${cmTxt(b.libre)}${b.libre >= 50 ? ' · retazo' : ''}</span></span>
      <span class="barra ${b.tipo === 'retazo' ? 'es-ret' : ''} ${b.comprar ? 'es-comp' : ''}">${b.piezas.map(x => `<span style="flex:${x.cm};background:${x.color}" title="${esc(x.etq)}">${x.cm}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 40 ? Math.round(b.libre) : ''}</span>` : ''}</span>
      ${nomAj.length ? `<span class="barra-n">Lleva piezas de ${esc(nomAj.join(' y '))}: se las pasa al terminar</span>` : ''}</button>`;
  }
  function secSemana(){
    const P = X.planSemana(semSab, prov), d = D();
    $('subtitulo').textContent = 'Plan de corte del ' + sabTxt(semSab);
    const nPuertas = P.conPlan.length;
    let h = `<div class="opts" style="--cols:2;margin-bottom:12px">${[[SAB.este, 'Este ' + sabTxt(SAB.este)], [SAB.proximo, 'Próximo ' + sabTxt(SAB.proximo)]].map(([v, t]) => `<button class="opt ${v === semSab ? 'selected' : ''}" type="button" data-sab="${v}">${esc(t)}</button>`).join('')}</div>`;
    if(P.cambio) h += `<div class="caja-amar">Cambió lo asignado en Producción desde que ajustaste el plan. La app volvió a sugerir. Revísalo y acéptalo de nuevo.</div>`;
    if(P.cerrado) h += `<div class="caja-ok">Cortes de este sábado hechos. Las barras bajaron del depósito y los retazos quedaron guardados.</div>`;
    else if(P.aceptado) h += `<div class="caja-ok">Plan aceptado. Cada herrero ya tiene su hoja de corte en Mi trabajo. Cuando termine de cortar, toca "Ya cortó".</div>`;
    h += `<div class="res"><div class="res-c"><span>Puertas para cortar</span><b>${nPuertas}</b></div><div class="res-c ${P.nComprar ? 'rojo' : 'ok'}"><span>${P.nComprar ? 'Hay que comprar' : 'Material'}</span><b>${P.nComprar ? dinero(P.comprar) : 'Alcanza'}</b></div></div>`;

    // 1. Lo asignado en Producción, por herrero
    h += `<div class="tit" style="margin-top:4px">Asignado en Producción</div>`;
    if(!P.asign.length) h += `<div class="vacio-d"><b>No hay Hierro asignado para el ${esc(sabTxt(semSab))}</b>Asigna en Producción y aquí sale el plan.</div>`;
    P.herreros.forEach(hr => {
      h += `<div class="hr-h"><b>${esc(hr.nombre)}</b><span>${plural(hr.unidades.length, '1 puerta', 'puertas')}${hr.barras.length ? ' · ' + plural(hr.barras.length, '1 barra o retazo', 'barras y retazos') : ''}</span></div>`;
      h += hr.unidades.map(u => {
        const sub = u.cortado ? 'Ya cortado' : !u.conCortes ? 'Sin cortes cargados' : u.interna ? 'Exhibición · costo ' + dinero(u.x.costo) : 'Costo ' + dinero(u.x.costo) + ' · gana ' + dinero(u.precio - u.x.costo - u.x.fijos);
        return `<div class="ped-c ${!u.conCortes ? 'falta' : ''}"><span class="dot" style="background:${u.conCortes ? u.color : 'var(--ink-faint)'}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.cliente)} · ${esc(sub)}</small></span>${u.conCortes ? '' : `<span class="pill gris">Sin cortes</span>`}</div>`;
      }).join('');
    });
    // Modelos sin cortes: no frenan el trabajo
    P.sinCortes.forEach(u => {
      const manual = !!(d.manual || {})[u.eid];
      h += `<div class="caja-rara" style="margin-top:8px"><b>${esc(u.etq)} · ${esc(u.nombre)} no tiene cortes cargados.</b> ${manual ? esc(u.herrero) + ' lo corta a mano esta semana. Carga sus cortes cuando puedas para que entre al plan.' : 'No entra al plan. Puedes cargarlos ahora o dejar que ' + esc(u.herrero) + ' lo corte a mano.'}
        <span class="dos-btn"><a class="btn-mini" href="costos.html?modelo=${encodeURIComponent(u.mid)}&volver=semana&para=${semSab}">Cargar cortes ahora</a>${manual ? '' : `<button class="btn-mini sec" type="button" data-manual="${u.eid}">Cortar a mano</button>`}</span></div>`;
    });
    // 2. Pendiente sin asignar y lo de otro sábado
    if(P.pendientes.length){
      h += `<div class="tit">Sin asignar en Producción</div><p class="mat-s" style="margin:0 2px 6px">No entra al plan hasta que tenga herrero y sábado.</p>`;
      h += P.pendientes.map(u => `<a class="ped-c" href="produccion.html"><span class="dot" style="background:var(--line)"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.cliente)}${tieneCortes(u.mid) ? '' : ' · sin cortes'}</small></span><span class="pill amar">Asignar</span></a>`).join('');
    }
    const otro = P.otroSab.filter(u => u.para !== semSab);
    if(otro.length) h += `<p class="mat-s" style="margin:8px 2px 0">${plural(otro.length, '1 puerta asignada', 'puertas asignadas')} para otro sábado. Toca arriba para verlas.</p>`;
    if(P.aluminio) h += `<div class="gris-l">Aluminio · ${plural(P.aluminio, '1 ventana', 'ventanas')} en fabricación. El plan de corte de aluminio llega pronto.</div>`;

    if(P.barras.length){
      // 3. Lo que hay que comprar
      h += `<div class="tit">Qué comprar</div>`;
      const compras = P.compras.filter(m => m.comprar);
      h += compras.length || P.hj.some(x => x.comprar) ? `<div class="tot">${compras.map(m => `<div class="fila"><span>${esc(m.f.nombre)} · ${plural(m.comprar, '1 barra', 'barras')} (hay ${m.f.stock})</span><b>${dinero(m.costo)}</b></div>`).join('')}
          ${P.hj.filter(x => x.comprar).map(x => `<div class="fila"><span>${esc(x.f.nombre)} · ${plural(x.comprar, '1 hoja', 'hojas')} (usa ${x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 })} m²)</span><b>Ver precio</b></div>`).join('')}
          <div class="fila fin"><span>Total barras con IVA</span><span>${dinero(P.comprar)}</span></div></div>`
        : `<div class="caja-ok">Con lo que hay en el depósito alcanza. No hay que comprar.</div>`;
      h += `<div class="field-label" style="margin-top:10px">Precios de</div><div class="opts" style="--cols:2">${d.proveedores.filter(p => p.tipos.includes('hierro')).map(p => `<button class="opt ${p.id === prov ? 'selected' : ''}" type="button" data-prov="${p.id}">${esc(p.nombre.replace('Inversiones ', ''))}</button>`).join('')}</div>`;
      if(P.ahorro) h += `<div class="ahorro">Cortando todo junto se usan ${plural(P.ahorro, '1 barra menos', 'barras menos')} que cortando cada puerta aparte.</div>`;
      h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:12px"><button class="btn-secondary" type="button" data-pdf-compra style="flex:1;height:50px">Plan de compra</button><a class="btn-primary" href="deposito.html?tab=compras" style="flex:1;display:flex;align-items:center;justify-content:center;text-decoration:none;height:50px">Cargar la compra</a></div>`;
      // 4. Cómo se corta, por herrero (lo que la app sugiere; Ray lo cambia tocando una barra)
      h += `<div class="tit">Cómo se corta ${P.ajustado ? '· ajustado por ti' : '· sugerencia de la app'}</div>
        <p class="mat-s" style="margin:0 2px 8px">Cada tubo junta piezas de varias puertas. Toca una barra para cambiar quién la corta o mover una pieza.</p>
        <div class="leg">${P.conPlan.map(u => `<span><i style="background:${u.color}"></i>${esc(u.etq)}</span>`).join('')}<span><i style="background:#F1E4D6"></i>Sobra</span></div>`;
      P.herreros.filter(hr => hr.barras.length).forEach(hr => {
        h += `<div class="hr-h" style="margin-top:12px"><b>${esc(hr.nombre)}</b><button type="button" class="link-b" data-hoja-h="${hr.tid}">Ver su hoja</button></div>`;
        const porMat = {}; hr.barras.forEach(b => (porMat[b.mid] ||= []).push(b));
        Object.entries(porMat).forEach(([mid, bs]) => { h += `<div class="mat-b"><div class="mat-b-h"><b>${esc(nomMat(mid))}</b></div>${bs.map(b => barraHtml(b, P.barras.indexOf(b), P)).join('')}</div>`; });
      });
      if(P.hj.length) h += `<div class="tit">Lámina y vidrio</div>` + P.hj.map(x => `<div class="cg-fila"><div class="cg-nom">${esc(x.f.nombre)}<span>Usa ${x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 })} m² · hay ${plural(x.f.stock, '1 hoja', 'hojas')}${x.sobrante ? ' y ' + x.sobrante.toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m² de sobrantes' : ''}</span></div><div style="text-align:right;font-weight:800">${x.comprar ? 'Comprar ' + x.comprar : 'Alcanza'}</div></div>`).join('');
      // 5. Acciones
      if(!P.cerrado){
        if(!P.aceptado) h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" type="button" data-alcanza style="flex:1;height:54px">¿Qué alcanzo?</button><button class="btn-primary" type="button" data-aceptar style="flex:1.3">Aceptar plan</button></div>`;
        else h += `<div class="tit">¿Quién ya cortó?</div>` + P.herreros.filter(hr => hr.barras.length).map(hr => hr.entregado ? `<div class="caja-ok" style="margin-top:6px">${esc(hr.nombre)} ya cortó</div>` : `<button class="btn-secondary" type="button" data-ya-corto="${hr.tid}" style="width:100%;margin-top:8px">${esc(hr.nombre)} ya cortó</button>`).join('');
        if(P.ajustado) h += `<button class="btn-nuevo" type="button" data-plan-reiniciar>Volver a la sugerencia de la app</button>`;
      }
    }
    return h;
  }
  // ---- Hoja de corte de un herrero: lo que ve en Mi trabajo ----
  function hojaHerrero(P, tid){
    const hr = P.herreros.find(x => x.tid === tid); if(!hr) return null;
    const porMat = {}; hr.barras.forEach(b => (porMat[b.mid] ||= []).push(b));
    const manuales = P.sinCortes.filter(u => u.tid === tid);
    const pasar = []; hr.barras.forEach(b => b.piezas.filter(p => p.tid !== tid).forEach(p => pasar.push(p)));
    return { hr, porMat, manuales, pasar };
  }
  function abrirHojaHerrero(tid){
    const P = X.planSemana(semSab, prov), o = hojaHerrero(P, tid); if(!o) return;
    $('detTitulo').textContent = 'Hoja de corte de ' + o.hr.nombre;
    $('detBody').innerHTML = `<p class="mat-s" style="margin:0 2px 10px">Así le llega a ${esc(o.hr.nombre)} en Mi trabajo${P.aceptado ? '' : ' cuando aceptes el plan'}.</p>
      <div class="telefono"><div class="tel-h"><b>Tu hoja de corte</b><span>Para el ${esc(sabTxt(semSab))} · medidas en cm</span></div>
        <p class="tel-n">Corta primero los retazos. Guarda lo que sobre de 50 cm o más.</p>
        ${Object.entries(o.porMat).map(([mid, bs]) => `<div class="tel-m">${esc(nomMat(mid))}</div>${bs.map(b => `<div class="tel-b"><span class="tel-bt">${esc(b.tipo === 'retazo' ? 'Retazo de ' + b.largo : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''))}</span>
          <span class="barra">${b.piezas.map(x => `<span style="flex:${x.cm};background:${x.color}">${x.cm}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}"></span>` : ''}</span>
          <span class="tel-p">${b.piezas.map(x => `${x.cm} · ${esc(x.etq)}${x.tid !== o.hr.tid ? ' (de ' + esc((P.herreros.find(h2 => h2.tid === x.tid) || {}).nombre) + ')' : ''}`).join('<br>')}${b.libre >= 50 ? '<br><b>Guarda el retazo de ' + Math.round(b.libre) + '</b>' : ''}</span></div>`).join('')}`).join('')}
        ${o.pasar.length ? `<div class="tel-m">Pásale a tu compañero</div>${o.pasar.map(x => `<div class="tel-p">${x.cm} cm · ${esc(x.etq)} → ${esc((P.herreros.find(h2 => h2.tid === x.tid) || {}).nombre)}</div>`).join('')}` : ''}
        ${o.manuales.map(u => `<div class="tel-m">${esc(u.etq)} · ${esc(u.nombre)}</div><div class="tel-p">Este modelo no tiene plan. Córtalo como siempre.</div>`).join('')}
      </div>`;
    $('detFoot').innerHTML = `<button class="btn-primary" type="button" data-pdf-hoja="${tid}">PDF de la hoja de ${esc(o.hr.nombre)}</button>`;
    abrirHoja('sheetDet');
  }
  async function pdfHoja(tid){
    const P = X.planSemana(semSab, prov), o = hojaHerrero(P, tid); if(!o) return;
    const bloques = [{ t:'nota', texto:'Corta primero los retazos. Guarda lo que sobre de 50 cm o más y anótalo. Medidas en cm.' }];
    Object.entries(o.porMat).forEach(([mid, bs]) => { bloques.push({ t:'titulo', texto:nomMat(mid), der:plural(bs.length, '1 pieza de material', 'piezas de material') });
      bs.forEach(b => bloques.push({ t:'barra', etiqueta:b.tipo === 'retazo' ? 'Retazo de ' + b.largo + ' cm' : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''), der:'sobra ' + Math.round(b.libre) + ' cm' + (b.libre >= 50 ? ' · guardar' : ''), largo:b.largo, sobra:b.libre,
        piezas:b.piezas.map(x => ({ cm:x.cm, txt:'(' + x.etq + (x.tid !== tid ? ', de ' + (P.herreros.find(h2 => h2.tid === x.tid) || {}).nombre : '') + ')' })) })); });
    if(o.manuales.length){ bloques.push({ t:'titulo', texto:'Sin plan: cortar a mano' }); o.manuales.forEach(u => bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre, b:'a mano' })); }
    await sacarPDF({ titulo:'Hoja de corte', derecha:o.hr.nombre, subtitulo:'Para el ' + sabTxt(semSab) + '. Sale de lo asignado en Producción.', bloques }, 'Hoja-de-corte-' + o.hr.nombre + '-' + semSab + '.pdf');
  }
  async function pdfCompra(){
    const P = X.planSemana(semSab, prov), pv = D().proveedores.find(p => p.id === prov);
    const bloques = [{ t:'titulo', texto:'Barras', der:'Precio con IVA' }];
    P.compras.filter(m => m.comprar).forEach(m => bloques.push({ t:'fila', a:m.f.nombre + ' · ' + plural(m.comprar, '1 barra', 'barras') + ' de ' + (m.f.largo / 100) + ' m', b:dinero(m.costo) }));
    if(!P.compras.some(m => m.comprar)) bloques.push({ t:'fila', a:'Con lo que hay alcanza', b:'' });
    bloques.push({ t:'total', a:'Total barras', b:dinero(P.comprar) });
    if(P.hj.length){ bloques.push({ t:'titulo', texto:'Lámina y vidrio' }); P.hj.forEach(x => bloques.push({ t:'fila', a:x.f.nombre + ' · usa ' + x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m²', b:x.comprar ? 'Comprar ' + x.comprar : 'Alcanza' })); }
    bloques.push({ t:'nota', texto:'Precios de ' + (pv ? pv.nombre : prov) + '. Si no vende un material, se usó el precio de otro proveedor.' });
    await sacarPDF({ titulo:'Plan de compra', derecha:sabTxt(semSab), subtitulo:plural(P.conPlan.length, '1 puerta para cortar', 'puertas para cortar') + '. Primero se usan los retazos y las barras del depósito.', bloques }, 'Plan-de-compra-' + semSab + '.pdf');
  }
  async function sacarPDF(o, nombre){
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear(o); const r = await window.PDFR.compartir(blob, nombre); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }
  // ---- Cambiar una barra: quién la corta y mover piezas ----
  function renumerar(P){
    const d = D();
    P.barras = P.barras.filter(b => b.piezas.length);
    const por = {}; P.barras.filter(b => b.tipo === 'barra').forEach(b => (por[b.mid] ||= []).push(b));
    Object.entries(por).forEach(([mid, bs]) => { const f = d.fab.find(x => x.id === mid); bs.forEach((b, i) => { b.n = i + 1; b.comprar = i >= f.stock; }); });
  }
  function moverPieza(P, bi, pi, destino){
    const R = D().reglas, b = P.barras[bi], p = b.piezas[pi];
    let dst;
    if(destino === 'nueva'){ const f = D().fab.find(x => x.id === b.mid); dst = { mid:b.mid, tipo:'barra', largo:f.largo, libre:f.largo, piezas:[], tid:b.tid }; P.barras.push(dst); }
    else dst = P.barras[+destino];
    if(!dst || dst.libre + 1e-9 < p.cm) return false;
    b.piezas.splice(pi, 1); b.libre = Math.min(b.largo, b.libre + p.cm + R.corte);
    dst.piezas.push(p); dst.libre = Math.max(0, dst.libre - p.cm - R.corte);
    renumerar(P); return true;
  }
  // ---- ¿Qué alcanzo con lo que hay? ----
  function alcanzaMats(){ const P = X.planSemana(semSab, prov); return [...new Set(P.barras.map(b => b.mid))].map(mid => D().fab.find(f => f.id === mid)); }

  // ================= Materiales =================
  function secMateriales(){
    const d = D();
    $('subtitulo').textContent = 'Lista de precios sin IVA, por proveedor';
    let h = '<div class="caja-nota" style="margin:0 0 6px"><span>Qué es esta lista</span>Lo que cuesta cada material con cada proveedor, sin IVA. No es por pedido: es la lista de precios que usa Costos para calcular cada modelo. El costo de cada pedido está en la pestaña Corte.</div><p class="mat-s" style="margin:6px 2px 8px">Los precios entran solos cuando se registra una compra en Depósito. Si un material tiene "precio fijo para costear", Costos usa ese.</p>';
    ['hierro','laminas','vidrio'].forEach(t => {
      const L = d.fab.filter(f => f.tipo === t); if(!L.length) return;
      h += `<div class="tit">${TIPO[t]}</div><div class="mat-lista ya">` + L.map(f => {
        const ps = Object.entries(f.precios).map(([k, v]) => ({ k, ...v })).sort((a, b) => a.p - b.p);
        return `<button class="mat" type="button" data-mat="${esc(f.id)}"><span class="mat-ico fab">${f.pres === 'barra' ? (f.largo / 100) + 'm' : '▭'}</span>
          <span style="min-width:0"><span class="mat-t">${esc(f.nombre)}</span><span class="mat-s">${ps.map(p => esc((d.proveedores.find(x => x.id === p.k) || {}).nombre || p.k).replace('Inversiones ', '').replace(' (ferretería y otros)', '') + ' ' + dinero(p.p) + (p.esp ? ' · ' + esc(p.esp) : '')).join(' · ')}</span>${f.fijo ? `<span class="mat-s" style="color:var(--accent);font-weight:800">Precio fijo para costear ${dinero(f.fijo)}</span>` : ''}</span>
          <span class="mat-n"><b style="font-size:18px">${dinero(ps[0].p)}</b><span>${f.pres === 'barra' ? dinero(ps[0].p / (f.largo / 100)) + ' el metro' : 'la hoja'}</span></span></button>`; }).join('') + '</div>';
    });
    ['Pintura y masilla','Consumibles','Accesorios'].forEach(g => {
      h += `<div class="tit">${g}</div><div class="mat-lista ya">` + d.insumos.filter(i => i.grupo === g).map(i => `<button class="mat" type="button" data-insumo="${esc(i.id)}"><span class="mat-ico fab">${esc(i.nombre[0])}</span><span style="min-width:0"><span class="mat-t">${esc(i.nombre)}</span><span class="mat-s">${g === 'Accesorios' ? 'Por unidad' : i.r ? 'Rinde ' + i.r + (i.r === 1 ? ' puerta' : ' puertas') + ' (general)' : 'Rendimiento: lo pone cada modelo'}</span></span><span class="mat-n"><b style="font-size:18px">${dinero(i.p)}</b><span>sin IVA</span></span></button>`).join('') + '</div>';
    });
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-mat="nuevo">+ Agregar material</button>';
    return h;
  }

  // ================= Ganancia (rentabilidad) =================
  // Gastos fijos del mes, ¿alcanzamos este mes? y ganancia por producto. Las reglas generales van al final.
  const totalFijos = () => D().gastosFijos.reduce((a, g) => a + (Number(g.monto) || 0), 0);
  const sincronizarFijos = () => { D().reglas.gastosMes = r2(totalFijos()); };
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  // Lo vendido en el mes: cada puerta aporta (precio − costo) para pagar los gastos fijos
  function mesVentas(mes){
    const d = D(), out = { puertas:0, vendido:0, costo:0, aporte:0, sinCosto:0, nSin:0, porModelo:{} };
    d.ventas.filter(v => !v.interna && !['cotizacion','cancelada'].includes(v.estado) && String(v.confirmada_en || '').slice(0, 7) === mes).forEach(v => v.items.forEach(it => {
      const n = it.cantidad, x = X.costear(it.catalogo_id), ok = x && !x.falta.length;
      out.puertas += n; out.vendido += it.precio_unitario * n;
      if(ok){ out.costo += x.costo * n; out.aporte += (it.precio_unitario - x.costo) * n; const pm = (out.porModelo[it.catalogo_id] ||= { nombre:it.nombre, n:0, gana:0 }); pm.n += n; pm.gana += (it.precio_unitario - x.costo - x.fijos) * n; }
      else { out.sinCosto += it.precio_unitario * n; out.nSin += n; }
    }));
    return out;
  }
  function secGanancia(){
    const d = D(), R = d.reglas; sincronizarFijos();
    const fijos = totalFijos(), porPuerta = fijos / R.puertasMes;
    const hoy = new Date(), mes = hoy.toISOString().slice(0, 7), M = mesVentas(mes);
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

    // Gastos fijos (con los que se reparte el precio sugerido)
    h += `<div class="tit">Gastos fijos del mes</div><div class="mat-lista">${d.gastosFijos.map((g, i) => `<button class="regla" type="button" data-gfijo="${i}"><span class="grow"><span class="mat-t">${esc(g.cat)}</span></span><b>${dinero(g.monto)}</b>${CHEV}</button>`).join('')}
      <div class="regla" style="cursor:default"><span class="grow"><span class="mat-t">Total</span></span><b>${dinero(fijos)}</b></div></div>
      <button class="btn-nuevo" type="button" data-gfijo="nuevo">+ Agregar gasto fijo</button>
      <div class="mat-lista" style="margin-top:8px"><button class="regla" type="button" data-regla="puertasMes"><span class="grow"><span class="mat-t">Puertas al mes</span><span class="mat-s">Entre cuántas puertas se reparten</span></span><b>${R.puertasMes}</b>${CHEV}</button></div>
      <div class="formula" style="margin-top:8px">${dinero(fijos)} ÷ ${R.puertasMes} puertas = <b>${dinero(porPuerta)} por puerta</b>. Esto se suma al precio sugerido de cada modelo.<br><span class="mat-s">En Finanzas, Gastos ves lo que se pagó de verdad cada mes.</span></div>`;

    // Ganancia por producto, con el precio publicado en el catálogo
    const filas = d.catalogo.filter(m => m.tipo !== 'Puerta de Madera').map(m => ({ m, x:X.costear(m.id) }));
    const cost = filas.filter(o => o.x && !o.x.falta.length).sort((a, b) => a.x.pct - b.x.pct), sin = filas.filter(o => !(o.x && !o.x.falta.length));
    h += `<div class="tit">Ganancia por producto</div><p class="mat-s" style="margin:0 2px 6px">Precio del catálogo menos costo y gastos fijos. Los de abajo del 30 % conviene subirlos.</p>`;
    h += cost.map(({ m, x }) => { const s = X.semaforo(x); return `<button class="rent" type="button" data-modelo="${esc(m.id)}" data-ir-modelos><span class="grow"><span class="mat-t">${esc(m.nombre)}</span>
        <span class="mat-s">Cuesta ${dinero(x.costo)} · sugerido ${dinero(x.final)} · catálogo ${dinero(x.hoy)}</span></span>
        <span class="mat-n"><b style="color:${COLOR[s[0]]}">${x.ganancia < 0 ? '− ' : ''}${dinero(Math.abs(x.ganancia))}</b><span>${pill(s)}</span></span></button>`; }).join('') || '<p class="mat-s">Todavía no hay modelos costeados.</p>';
    if(sin.length) h += `<details class="sin-c"><summary>${plural(sin.length, '1 modelo sin costear', 'modelos sin costear')} · no se sabe si ganan</summary>${sin.map(({ m }) => `<button class="rent" type="button" data-modelo="${esc(m.id)}" data-ir-modelos><span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${esc(m.tipo)} · catálogo ${dinero(m.precio_base)}</span></span><span class="pill gris">Costear</span></button>`).join('')}</details>`;
    h += `<p class="mat-s" style="margin:8px 2px 0">La madera se costea aparte, más adelante.</p>`;

    // Reglas generales
    const fila = (k, t, s2, v) => `<button class="regla" type="button" data-regla="${k}"><span class="grow"><span class="mat-t">${t}</span><span class="mat-s">${s2}</span></span><b>${v}</b>${CHEV}</button>`;
    h += `<div class="tit">Reglas</div><div class="mat-lista">
      ${fila('iva', 'IVA', 'Se suma a los materiales', R.iva + ' %')}
      ${fila('ganancia', 'Ganancia', 'Se suma al costo de cada modelo y a los extras', R.ganancia + ' %')}
      ${fila('corte', 'Grosor del corte', 'Lo que se pierde en cada corte del disco (cm)', R.corte + ' cm')}
      ${fila('bisagras', 'Bisagras por puerta', 'Valor de arranque al costear un modelo nuevo', R.bisagras)}</div>
      <div class="leyenda">${[['verde','Gana 30 % o más'],['amar','Gana de 15 a 30 %'],['rojo','Gana menos de 15 %'],['negro','Pierde dinero'],['gris','Sin costear o faltan datos']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('')}</div>
      <a class="btn-nuevo" href="categorias-pago.html" style="text-decoration:none">Categorías de pago (mano de obra)</a>`;
    return h;
  }

  // ================= Formularios =================
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  const campo = (id, label, val, extra) => `<div class="field" id="c_${id}"><label class="field-label" for="${id}">${label}</label><input class="input" id="${id}" inputmode="decimal" value="${esc(val == null ? '' : val)}"><div class="field-error">Revisa este dato</div>${extra ? `<div class="field-hint">${extra}</div>` : ''}</div>`;
  function abrirForm(f){ F = f; pintarForm(); abrirHoja('sheetForm'); }
  function pintarForm(){
    const d = D(); let h = '', boton = 'Guardar', borrar = false;
    if(F.t === 'pieza'){
      $('formTitulo').textContent = F.i === 'nueva' ? 'Pieza nueva' : 'Pieza';
      h = `<div class="field"><span class="field-label">Material</span>${opts(d.fab.filter(f => f.pres === 'barra').map(f => [f.id, esc(f.nombre)]), F.mat, 'data-f-mat')}</div>
        <div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fCm', 'Medida (cm)', F.cm)}</div>
        <div class="field"><label class="field-label" for="fNota">Para qué es</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-hint">Ejemplo: bastidor largo, divisor, marco.</div></div>
        <button class="btn-secondary" type="button" style="width:100%" data-mat-desde-pieza>¿No está el material? Crearlo aquí</button>`;
      borrar = F.i !== 'nueva';
    }
    if(F.t === 'acc'){
      $('formTitulo').textContent = F.nuevo ? 'Accesorio nuevo' : 'Accesorio';
      h = `<div class="field"><span class="field-label">Accesorio</span>${opts(d.insumos.filter(i => i.grupo === 'Accesorios').map(i => [i.id, esc(i.nombre) + '<br><small style="font-weight:600">' + dinero(i.p) + ' sin IVA</small>']), F.k, 'data-f-acc', 1)}</div>${campo('fCant', 'Cantidad por puerta', F.cant)}`;
      borrar = !F.nuevo;
    }
    if(F.t === 'hoja'){
      $('formTitulo').textContent = F.i === 'nueva' ? 'Hoja nueva' : 'Hoja';
      const f = d.fab.find(y => y.id === F.mat), m2 = (numLibre(F.cant) || 0) * (numLibre(F.a) || 0) * (numLibre(F.h) || 0) / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000;
      h = `<div class="field"><span class="field-label">Material</span>${opts(d.fab.filter(x => x.pres === 'hoja').map(x => [x.id, esc(x.nombre)]), F.mat, 'data-f-mat')}</div>
        <div class="input-row">${campo('fCant', 'Cantidad', F.cant)}${campo('fA', 'Ancho (cm)', F.a)}</div>${campo('fH', 'Alto (cm)', F.h)}
        <div class="field"><label class="field-label" for="fNota">Para qué es</label><input class="input" id="fNota" value="${esc(F.nota || '')}"><div class="field-hint">Ejemplo: panel, franja de vidrio.</div></div>
        <div class="caja-nota"><span>Uso de la hoja</span>${m2.toLocaleString('es-VE', { maximumFractionDigits:3 })} m² de una hoja de ${f.hoja[0]} × ${f.hoja[1]} cm = <b>${Math.round(m2 / hm2 * 100)} %</b></div>`;
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
        <div class="caja-nota"><span>Se cobra al cliente</span>${dinero(v)} × ${1 + d.reglas.ganancia / 100} = <b>${dinero(v * (1 + d.reglas.ganancia / 100))}</b>. Sin gastos fijos. En la venta aparece como opción del modelo.</div>`;
      borrar = F.i !== 'nuevo';
    }
    if(F.t === 'regla'){
      const N = { iva:'IVA (%)', ganancia:'Ganancia (%)', gastosMes:'Gastos fijos del mes ($)', puertasMes:'Puertas al mes', corte:'Grosor del corte (cm)', bisagras:'Bisagras por puerta' };
      $('formTitulo').textContent = 'Cambiar regla';
      h = campo('fRegla', N[F.k], d.reglas[F.k], 'Cambia el precio sugerido de todos los modelos.');
    }
    if(F.t === 'mat'){
      const f = F.id === 'nuevo' ? null : d.fab.find(y => y.id === F.id);
      $('formTitulo').textContent = f ? f.nombre : 'Material nuevo';
      const tipo = F.tipo;
      const provs = d.proveedores.filter(p => p.tipos.includes(tipo));
      h = `${f ? '' : `<div class="field" id="c_fNom"><label class="field-label" for="fNom">Nombre</label><input class="input" id="fNom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div></div>
        <div class="field"><span class="field-label">Tipo</span>${opts(Object.entries(TIPO).map(([k, t]) => [k, t]), tipo, 'data-f-tipo', 3)}</div>
        <div class="field"><span class="field-label">Viene en</span>${opts([['barra', 'Barra'], ['hoja', 'Hoja']], F.pres, 'data-f-pres')}</div>
        ${F.pres === 'barra' ? campo('fLargo', 'Largo de la barra (cm)', F.largo) : `<div class="input-row">${campo('fHa', 'Ancho de la hoja (cm)', F.ha)}${campo('fHh', 'Alto de la hoja (cm)', F.hh)}</div>`}`}
        <div class="tit" style="margin-top:4px">Precio sin IVA por proveedor</div>
        <p class="mat-s" style="margin:0 2px 8px">Solo salen los proveedores que venden ${esc((TIPO[tipo] || '').toLowerCase())}. Para que salga otro, márcalo en Finanzas, Proveedores, Editar.</p>
        ${provs.length ? provs.map(p => `<div class="input-row">${campo('fp_' + p.id, esc(p.nombre.replace('Inversiones ', '')), (F.precios[p.id] || {}).p)}<div class="field"><label class="field-label" for="fe_${p.id}">Espesor</label><input class="input" id="fe_${p.id}" value="${esc((F.precios[p.id] || {}).esp || '')}"></div></div>`).join('') : '<div class="caja-amar">Ningún proveedor vende este tipo. Márcalo en Finanzas, Proveedores, Editar.</div>'}
        ${tipo === 'hierro' ? `<div class="field"><span class="field-label">Para costear usar</span>${opts([['no', 'Última compra'], ['si', 'Precio fijo']], F.fijo != null && F.fijo !== '' ? 'si' : 'no', 'data-f-fijo')}</div>${F.fijo != null && F.fijo !== '' ? campo('fFijo', 'Precio fijo ($)', F.fijo) : ''}` : ''}`;
    }
    if(F.t === 'insumo'){
      const i = d.insumos.find(y => y.id === F.id);
      $('formTitulo').textContent = i.nombre;
      h = campo('fP', 'Precio sin IVA ($)', i.p) + (i.grupo !== 'Accesorios' ? campo('fR', 'Rinde (puertas por unidad, general)', i.r, 'Vacío = lo pone cada modelo (fondo, esmalte y masilla).') : '');
    }
    if(F.t === 'gfijo'){
      $('formTitulo').textContent = F.i === 'nuevo' ? 'Gasto fijo nuevo' : F.cat;
      h = `<div class="field" id="c_fGNom"><label class="field-label" for="fGNom">Qué gasto es</label><input class="input" id="fGNom" value="${esc(F.cat || '')}"><div class="field-error">Escribe el nombre</div><div class="field-hint">Ejemplo: alquiler, luz, contador.</div></div>
        ${campo('fGMonto', 'Cuánto es al mes ($)', F.monto, 'Cambia el precio sugerido de todos los modelos.')}`;
      borrar = F.i !== 'nuevo';
    }
    if(F.t === 'barra'){
      const P = X.planSemana(semSab, prov), b = P.barras[F.bi];
      if(!b){ $('formBody').innerHTML = '<p class="mat-s">Esta barra ya no está en el plan.</p>'; return; }
      $('formTitulo').textContent = nomMat(b.mid) + ' · ' + (b.tipo === 'retazo' ? 'retazo ' + b.largo : 'barra ' + b.n);
      const destinos = F.mover != null ? P.barras.map((x, i) => [x, i]).filter(([x, i]) => i !== F.bi && x.mid === b.mid && x.libre + 1e-9 >= b.piezas[F.mover].cm) : [];
      h = `<div class="field"><span class="field-label">¿Quién la corta?</span>${opts(P.herreros.map(hr => [hr.tid, esc(hr.nombre)]), F.tid, 'data-f-tid')}</div>
        <div class="field-label">Piezas · toca una para moverla</div>
        ${b.piezas.map((x, i) => `<button type="button" class="pz ${F.mover === i ? 'on' : ''}" data-f-mover="${i}"><span class="pz-n" style="background:${x.color};color:#fff">${x.cm}</span><span><span class="pz-t">${esc(x.etq)}</span><span class="pz-s">${esc(x.nota || '')}</span></span><span class="pz-m">${F.mover === i ? 'Mover' : ''}</span></button>`).join('')}
        ${F.mover != null ? `<div class="field" style="margin-top:10px"><span class="field-label">¿A dónde la mueves?</span>${opts(destinos.map(([x, i]) => [i, esc(x.tipo === 'retazo' ? 'Retazo ' + x.largo : 'Barra ' + x.n) + '<br><small style="font-weight:600">' + (P.herreros.find(hr => hr.tid === x.tid) || {}).nombre + ' · le caben ' + Math.round(x.libre) + ' cm</small>']).concat([['nueva', 'Barra nueva<br><small style="font-weight:600">puede que haya que comprarla</small>']]), F.dest, 'data-f-dest', 1)}</div>` : ''}`;
      boton = 'Guardar cambio';
    }
    if(F.t === 'alcanza'){
      $('formTitulo').textContent = '¿Qué alcanzo con lo que hay?';
      const mats = alcanzaMats();
      h = `<p class="mat-s" style="margin:0 2px 10px;font-size:14px">Pon cuántas barras enteras tienes de cada perfil (ya están las del depósito). La app agrega las puertas en orden de entrega mientras alcance. Los retazos también cuentan.</p>
        ${mats.map(f => campo('fH_' + f.id, esc(f.nombre), F.hay[f.id] != null ? F.hay[f.id] : f.stock)).join('')}`;
      if(F.res) h += `<div class="tit">Alcanza para</div>${F.res.si.length ? F.res.si.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero)}</small></span><span class="pill verde">Sí</span></div>`).join('') : '<p class="mat-s">Ninguna puerta completa.</p>'}
        ${F.res.no.length ? `<div class="tit">No alcanza para</div>${F.res.no.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero)} · quedaría pendiente</small></span><span class="pill rojo">Falta</span></div>`).join('')}` : ''}`;
      boton = 'Calcular';
    }
    if(F.t === 'usar'){
      const m = modelo(sel), x = X.costear(m.id), redondo = Math.ceil(x.final / 5) * 5;
      $('formTitulo').textContent = m.en_diseno ? 'Pasar al catálogo' : 'Usar este precio';
      h = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${m.en_diseno ? 'El modelo aparece en el Catálogo con este precio y la vendedora ya lo puede vender.' : `Hoy está en ${dinero(m.precio_base)}. El sugerido es ${dinero(x.final)}.`}</p>
        ${campo('fPrecio', 'Precio de venta ($)', F.precio || redondo, 'Redondeado hacia arriba de 5 en 5. Puedes cambiarlo.')}`;
      boton = m.en_diseno ? 'Pasar al catálogo' : 'Cambiar precio';
    }
    $('formBody').innerHTML = h;
    $('formFoot').innerHTML = `${borrar ? '<button class="btn-secondary" type="button" id="btnBorrar" style="height:54px;flex:1">Quitar</button>' : ''}<button class="btn-primary" type="button" id="btnForm" style="flex:2">${boton}</button>`;
    $('formFoot').style.display = 'flex'; $('formFoot').style.gap = '10px';
  }
  const val = (id) => { const el = $(id); return el ? el.value : undefined; };
  function leer(){
    const map = { fCant:'cant', fCm:'cm', fNota:'nota', fA:'a', fH:'h', fRend:'r', fN:'n', fV:'v', fNom:'nombre', fLargo:'largo', fHa:'ha', fHh:'hh', fFijo:'fijo', fPrecio:'precio' };
    Object.entries(map).forEach(([id, k]) => { const v = val(id); if(v !== undefined) F[k] = v; });
    if(F.t === 'mat') D().proveedores.forEach(p => { const v = val('fp_' + p.id); if(v !== undefined){ F.precios[p.id] = { p:v, esp:val('fe_' + p.id) }; } });
  }
  const mal = (id) => { const c = $('c_' + id); if(c) c.classList.add('invalid'); return false; };
  function guardar(){
    leer(); const d = D();
    const c = sel != null ? d.costeo[sel] : null;
    if(F.t === 'pieza'){
      const cant = Math.round(numLibre(F.cant)), cm = numLibre(F.cm);
      if(!(cant > 0)) return mal('fCant'); if(!(cm > 0)) return mal('fCm');
      const p = [F.mat, cant, cm, F.nota || ''];
      if(F.i === 'nueva') c.piezas.push(p); else c.piezas[F.i] = p;
      toast('Pieza guardada. El costo se recalculó.');
    }
    if(F.t === 'hoja'){
      const cant = Math.round(numLibre(F.cant)), a = numLibre(F.a), h = numLibre(F.h);
      if(!(cant > 0)) return mal('fCant'); if(!(a > 0)) return mal('fA'); if(!(h > 0)) return mal('fH');
      const fila = [F.mat, cant, a, h, F.nota || ''];
      if(F.i === 'nueva') c.hojas.push(fila); else c.hojas[F.i] = fila; toast('Hoja guardada');
    }
    if(F.t === 'acc'){
      const n = Math.round(numLibre(F.cant)); if(!F.k) return toast('Elige el accesorio', 'error'); if(!(n > 0)) return mal('fCant');
      c.acc ||= {}; c.acc[F.k] = n; toast('Accesorio guardado');
    }
    if(F.t === 'rend'){ const r = numLibre(F.r); if(!(r > 0)) return mal('fRend'); (c.rend ||= {})[F.id] = r; toast('Rendimiento guardado para este modelo'); }
    if(F.t === 'extra'){
      if(F.kind && F.kind !== 'Otro') F.n = F.kind;
      const v = numLibre(F.v); if(!String(F.n || '').trim()) return F.kind ? mal('fN') : toast('Elige qué extra es', 'error'); if(!(v > 0)) return mal('fV');
      c.extras ||= []; if(F.i === 'nuevo') c.extras.push({ n:F.n.trim(), v }); else c.extras[F.i] = { n:F.n.trim(), v };
      toast('Extra guardado');
    }
    if(F.t === 'regla'){ const v = numLibre(val('fRegla')); if(!(v >= 0) || (F.k === 'puertasMes' && !(v >= 1))) return mal('fRegla'); d.reglas[F.k] = v; toast('Regla cambiada. Todos los modelos se recalcularon.'); }
    if(F.t === 'gfijo'){
      const nom = String(val('fGNom') || '').trim(), monto = numLibre(val('fGMonto'));
      if(!nom) return mal('fGNom'); if(!(monto >= 0)) return mal('fGMonto');
      if(F.i === 'nuevo') d.gastosFijos.push({ cat:nom, monto }); else Object.assign(d.gastosFijos[F.i], { cat:nom, monto });
      sincronizarFijos(); toast('Gasto fijo guardado. El precio sugerido se recalculó.');
    }
    if(F.t === 'barra'){
      const P = X.planSemana(semSab, prov), b = P.barras[F.bi]; if(!b){ cerrarHoja('sheetForm', true); return; }
      if(F.mover != null && F.dest == null) return toast('Elige a dónde mover la pieza', 'error');
      if(F.tid) b.tid = F.tid;
      if(F.mover != null && !moverPieza(P, F.bi, F.mover, F.dest)) return toast('Esa pieza no cabe ahí', 'error');
      X.planGuardar(semSab, P, { ajustado:true, aceptado:false }); toast('Plan ajustado. Acéptalo cuando esté listo.');
    }
    if(F.t === 'alcanza'){
      const hay = {}; alcanzaMats().forEach(f => { const v = numLibre(val('fH_' + f.id)); hay[f.id] = isFinite(v) && v >= 0 ? Math.floor(v) : f.stock; });
      F.hay = hay; const r = X.alcanza(semSab, hay); const P = X.planSemana(semSab, prov);
      const col = (u) => (P.conPlan.find(x => x.eid === u.eid) || {}).color; F.res = { si:r.si.map(u => Object.assign(u, { color:col(u) })), no:r.no.map(u => Object.assign(u, { color:col(u) })) };
      pintarForm(); return true;
    }
    if(F.t === 'mat'){
      let f = F.id === 'nuevo' ? null : d.fab.find(y => y.id === F.id);
      if(!f){
        if(!String(F.nombre || '').trim()) return mal('fNom');
        f = { id:'n' + Date.now(), nombre:F.nombre.trim(), tipo:F.tipo, pres:F.pres, stock:0, retazos:[], precios:{} };
        if(F.pres === 'barra'){ f.largo = numLibre(F.largo) || 600; } else { f.hoja = [numLibre(F.ha) || 122, numLibre(F.hh) || 244]; }
        d.fab.push(f);
        if(F.volver){ const v = F.volver; v.mat = f.id; Object.entries(F.precios).forEach(([k, o]) => { const p = numLibre(o.p); if(p > 0) f.precios[k] = o.esp ? { p, esp:o.esp } : { p }; }); X.guardar(); toast('Material creado. Sigue con la pieza.'); F = v; pintarForm(); return true; }
      }
      const precios = {};
      Object.entries(F.precios).forEach(([k, o]) => { const p = numLibre(o.p); if(p > 0) precios[k] = o.esp ? { p, esp:o.esp } : { p }; });
      f.precios = precios;
      if(f.tipo === 'hierro'){ const fj = numLibre(F.fijo); if(fj > 0) f.fijo = fj; else delete f.fijo; }
      toast('Precios guardados');
    }
    if(F.t === 'insumo'){
      const i = d.insumos.find(y => y.id === F.id), p = numLibre(val('fP')); if(!(p > 0)) return mal('fP');
      i.p = p; const r = val('fR'); if(r !== undefined){ const n = numLibre(r); if(n > 0) i.r = n; else delete i.r; }
      toast('Guardado');
    }
    if(F.t === 'usar'){
      const precio = numLibre(F.precio); if(!(precio > 0)) return mal('fPrecio');
      const m = modelo(sel), eraDis = m.en_diseno; sel = X.pasarAlCatalogo(m.id, precio);
      toast(eraDis ? 'Listo: ya está en el Catálogo' : 'Precio cambiado en el Catálogo');
    }
    const t1 = F.t; X.guardar(); cerrarHoja('sheetForm', true); F = null; pintar(); if(!ancho.matches && sel != null && !['gfijo','barra','regla'].includes(t1)) pintarFicha();
    return true;
  }
  function borrar(){
    const c = D().costeo[sel] || {};
    if(F.t === 'pieza') c.piezas.splice(F.i, 1);
    if(F.t === 'extra') c.extras.splice(F.i, 1);
    if(F.t === 'hoja') c.hojas.splice(F.i, 1);
    if(F.t === 'acc') delete c.acc[F.k];
    if(F.t === 'gfijo'){ D().gastosFijos.splice(F.i, 1); sincronizarFijos(); }
    X.guardar(); toast('Quitado'); cerrarHoja('sheetForm', true); const t2 = F.t; F = null; pintar(); if(!ancho.matches && t2 !== 'gfijo') pintarFicha();
  }

  // ================= Eventos =================
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#tabs [data-tab]'); if(t){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const fl = e.target.closest('[data-filtro]'); if(fl){ filtro = fl.dataset.filtro; pintar(); return; }
    const md = e.target.closest('[data-modelo]'); if(md && md.hasAttribute('data-ir-modelos')) tab = 'modelos';
    if(md) return abrirFicha(isNaN(+md.dataset.modelo) ? md.dataset.modelo : +md.dataset.modelo);
    const pv = e.target.closest('[data-prov]'); if(pv){ prov = pv.dataset.prov; if(tab === 'semana' && !e.target.closest('#detBody,#panel')) return pintar(); return pintarFicha(); }
    // Plan semanal
    const sb = e.target.closest('[data-sab]'); if(sb){ semSab = sb.dataset.sab; return pintar(); }
    const ma = e.target.closest('[data-manual]'); if(ma){ const d = D(); (d.manual ||= {})[ma.dataset.manual] = semSab; X.guardar(); toast('Lo corta a mano esta semana. Sale en su hoja.'); return pintar(); }
    const hh = e.target.closest('[data-hoja-h]'); if(hh) return abrirHojaHerrero(hh.dataset.hojaH);
    const ph = e.target.closest('[data-pdf-hoja]'); if(ph) return pdfHoja(ph.dataset.pdfHoja);
    if(e.target.closest('[data-pdf-compra]')) return pdfCompra();
    if(e.target.closest('[data-alcanza]')) return abrirForm({ t:'alcanza', hay:{}, res:null });
    if(e.target.closest('[data-aceptar]')){ const P = X.planSemana(semSab, prov); X.planGuardar(semSab, P, { aceptado:true, ajustado:P.ajustado }); toast('Plan aceptado. Cada herrero ya tiene su hoja en Mi trabajo.'); return pintar(); }
    const yc = e.target.closest('[data-ya-corto]'); if(yc){ X.yaCorto(semSab, yc.dataset.yaCorto); toast('Bajaron las barras del depósito y se guardaron los retazos.'); return pintar(); }
    if(e.target.closest('[data-plan-reiniciar]')){ X.planReiniciar(semSab); toast('Volvió la sugerencia de la app'); return pintar(); }
    const br = e.target.closest('[data-barra]'); if(br){ const P = X.planSemana(semSab, prov), b = P.barras[+br.dataset.barra]; return abrirForm({ t:'barra', bi:+br.dataset.barra, tid:b.tid, mover:null, dest:null }); }
    const gf = e.target.closest('[data-gfijo]'); if(gf){ if(gf.dataset.gfijo === 'nuevo') return abrirForm({ t:'gfijo', i:'nuevo', cat:'', monto:'' }); const g = D().gastosFijos[+gf.dataset.gfijo]; return abrirForm({ t:'gfijo', i:+gf.dataset.gfijo, cat:g.cat, monto:g.monto }); }
    if(e.target.closest('[data-bastidor]')){ const n = Object.keys(D().costeo).length + 1; D().costeo[sel] = { codigo:'M-' + String(n).padStart(2, '0'), estado:'borrador', piezas:JSON.parse(JSON.stringify(BASTIDOR)), hojas:[], rend:{}, acc:{ bisagra:D().reglas.bisagras, cerradura:1 }, extras:[] }; X.guardar(); toast('Bastidor puesto. Agrega los cortes propios del modelo.'); pintar(); if(!ancho.matches) pintarFicha(); return; }
    const mo = e.target.closest('[data-modo]'); if(mo){ modo = mo.dataset.modo; return pintarFicha(); }
    const cp = e.target.closest('[data-copiar-de]'); if(cp){ X.costeoDesde(sel, +cp.dataset.copiarDe); toast('Piezas copiadas. Cambia lo que sea distinto.'); pintar(); if(!ancho.matches) pintarFicha(); return; }
    if(e.target.closest('[data-duplicar]')){ const nid = X.duplicar(sel); toast('Copia creada en diseño. Cambia sus piezas y pásala al catálogo cuando esté lista.'); filtro = 'En diseño'; sel = nid; pintar(); if(!ancho.matches) pintarFicha(); return; }
    if(e.target.closest('[data-usar]')) return abrirForm({ t:'usar' });
    const pz = e.target.closest('[data-pieza]');
    if(pz){ const c = D().costeo[sel]; if(pz.dataset.pieza === 'nueva') return abrirForm({ t:'pieza', i:'nueva', mat:'t1x1', cant:1, cm:'', nota:'' }); const i = +pz.dataset.pieza, p = c.piezas[i]; return abrirForm({ t:'pieza', i, mat:p[0], cant:p[1], cm:p[2], nota:p[3] }); }
    const hj = e.target.closest('[data-hoja]'); if(hj){ if(hj.dataset.hoja === 'nueva') return abrirForm({ t:'hoja', i:'nueva', mat:'lam14', cant:1, a:'', h:'', nota:'' }); const i = +hj.dataset.hoja, p = D().costeo[sel].hojas[i]; return abrirForm({ t:'hoja', i, mat:p[0], cant:p[1], a:p[2], h:p[3], nota:p[4] }); }
    const ac = e.target.closest('[data-acc]'); if(ac){ const c = D().costeo[sel]; if(ac.dataset.acc === 'nuevo') return abrirForm({ t:'acc', k:null, nuevo:true, cant:1 }); return abrirForm({ t:'acc', k:ac.dataset.acc, cant:c.acc[ac.dataset.acc] }); }
    const rd = e.target.closest('[data-rend]'); if(rd){ const it = D().insumos.find(y => y.nombre === rd.dataset.rend); if(!it) return; const c = D().costeo[sel]; return abrirForm({ t:'rend', id:it.id, nombre:it.nombre, r:(c.rend || {})[it.id] || it.r || '' }); }
    const ex = e.target.closest('[data-extra]'); if(ex){ if(ex.dataset.extra === 'nuevo') return abrirForm({ t:'extra', i:'nuevo' }); const i = +ex.dataset.extra, o = D().costeo[sel].extras[i]; return abrirForm({ t:'extra', i, n:o.n, v:o.v }); }
    const rg = e.target.closest('[data-regla]'); if(rg) return abrirForm({ t:'regla', k:rg.dataset.regla });
    const mt = e.target.closest('[data-mat]'); if(mt){ if(mt.dataset.mat === 'nuevo') return abrirForm({ t:'mat', id:'nuevo', tipo:'hierro', pres:'barra', largo:600, precios:{} }); const f = D().fab.find(y => y.id === mt.dataset.mat); return abrirForm({ t:'mat', id:f.id, tipo:f.tipo, precios:JSON.parse(JSON.stringify(f.precios)), fijo:f.fijo }); }
    if(e.target.closest('#btnNuevoMat')) return abrirForm({ t:'mat', id:'nuevo', tipo:'hierro', pres:'barra', largo:600, precios:{} });
    const ins = e.target.closest('[data-insumo]'); if(ins) return abrirForm({ t:'insumo', id:ins.dataset.insumo });
    if(e.target.closest('[data-mat-desde-pieza]')){ leer(); const volver = Object.assign({}, F); return abrirForm({ t:'mat', id:'nuevo', tipo:'hierro', pres:'barra', largo:600, precios:{}, volver }); }
    const mm = e.target.closest('[data-maq-msg]'); if(mm) return toast(mm.dataset.maqMsg);
    if(e.target.closest('#btnForm')) return guardar();
    if(e.target.closest('#btnBorrar')) return borrar();
    if(F){
      const set = (attr, k) => { const b = e.target.closest('[' + attr + ']'); if(b){ leer(); F[k] = b.getAttribute(attr); pintarForm(); return true; } };
      if(set('data-f-acc', 'k')) return;
      if(set('data-f-tid', 'tid')) return;
      const fm = e.target.closest('[data-f-mover]'); if(fm){ F.mover = F.mover === +fm.dataset.fMover ? null : +fm.dataset.fMover; F.dest = null; pintarForm(); return; }
      if(set('data-f-dest', 'dest')) return;
      if(set('data-f-kind', 'kind')){ return; }
      if(set('data-f-mat', 'mat') || set('data-f-tipo', 'tipo') || set('data-f-pres', 'pres')) return;
      const fj = e.target.closest('[data-f-fijo]'); if(fj){ leer(); F.fijo = fj.dataset.fFijo === 'si' ? (F.fijo || (F.precios.cya || {}).p || '0') : ''; pintarForm(); return; }
    }
  });
  document.addEventListener('input', (e) => {
    if(e.target.id === 'fNotas' && sel != null){ D().costeo[sel].notas = e.target.value; X.guardar(); }
    if(F && (F.t === 'hoja' || F.t === 'extra') && ['fCant','fA','fH','fV'].includes(e.target.id)){ const pos = e.target.selectionStart, id = e.target.id; leer(); pintarForm(); const el = $(id); el.focus(); try{ el.setSelectionRange(pos, pos); } catch(_){} }
  });
  $('btnReiniciar').onclick = () => { X.reiniciar(); sel = null; filtro = 'Todos'; toast('Datos de ejemplo reiniciados'); pintar(); };
  ancho.addEventListener('change', pintar);

  pintar();
  if(sel != null && modelo(sel)) abrirFicha(sel);
})();
