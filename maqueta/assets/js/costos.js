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
  const COLOR = { verde:'#1B6B3A', amar:'#B7791F', rojo:'#B42318', negro:'#1C1A17', gris:'#A8A39B' };
  const numLibre = (v) => { const s = String(v == null ? '' : v).trim().replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const r2 = X.r2;
  const q = new URLSearchParams(location.search);

  let tab = 'modelos', filtro = 'Todos', sel = q.get('modelo') ? (isNaN(+q.get('modelo')) ? q.get('modelo') : +q.get('modelo')) : null;
  let prov = 'cya', modo = 'metro', F = null;

  const modelo = (id) => D().catalogo.find(x => String(x.id) === String(id)) || D().enDiseno.find(x => String(x.id) === String(id));
  const foto = (m) => { try{ return fotoModelo(m) || 'assets/img/foto-puerta.png'; } catch(e){ return 'assets/img/foto-puerta.png'; } };
  const pill = (s) => `<span class="pill ${s[0]}">${esc(s[1])}</span>`;

  // ================= Pantalla =================
  function pintar(){
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tabs').classList.toggle('en-2', tab === 'materiales'); $('tabs').classList.toggle('en-3', tab === 'reglas');
    $('filtros').classList.toggle('hidden', tab !== 'modelos');
    $('pieMat').classList.toggle('hidden', ancho.matches || tab !== 'materiales');
    const html = tab === 'modelos' ? secModelos() : tab === 'materiales' ? secMateriales() : secReglas();
    $('cont').innerHTML = `<div class="cos-grid"><div style="min-width:0">${html}</div><div id="panel"></div></div>`;
    if(ancho.matches && sel && tab === 'modelos') pintarFicha();
  }

  function lista(){
    const d = D();
    return d.enDiseno.map(m => ({ m, x:X.costear(m.id), dis:true })).concat(d.catalogo.map(m => ({ m, x:X.costear(m.id), dis:false })).sort((a, b) => (b.x ? 1 : 0) - (a.x ? 1 : 0)));
  }
  function secModelos(){
    const todos = lista();
    const FIL = { 'Todos':() => true, 'En diseño':(o) => o.dis, 'Sin costear':(o) => !o.x, 'Puertas':(o) => o.m.tipo === 'Puerta Multilock', 'Combos':(o) => o.m.tipo === 'Combo', 'Madera':(o) => o.m.tipo === 'Puerta de Madera' };
    const nDis = todos.filter(o => o.dis).length, nSin = todos.filter(o => !o.x).length;
    $('filtrosL').innerHTML = Object.keys(FIL).map(k => `<button type="button" class="fx ${k === filtro ? 'on' : ''} ${k === 'Sin costear' && nSin ? 'rev' : ''}" data-filtro="${esc(k)}">${esc(k)}${k === 'En diseño' && nDis ? ' · ' + nDis : ''}${k === 'Sin costear' ? ' · ' + nSin : ''}</button>`).join('');
    const ver = todos.filter(FIL[filtro]);
    const cost = todos.filter(o => o.x && !o.x.falta.length && !o.dis);
    const prom = cost.length ? cost.reduce((a, o) => a + o.x.pct, 0) / cost.length : 0;
    $('subtitulo').textContent = `${cost.length} de ${todos.filter(o => !o.dis).length} modelos costeados`;
    let h = `<div class="res"><div class="res-c"><span>Costeados</span><b>${cost.length} de ${todos.filter(o => !o.dis).length}</b></div><div class="res-c ${prom >= 30 ? 'ok' : ''}"><span>Ganancia promedio</span><b>${cost.length ? Math.round(prom) + ' %' : 'Sin datos'}</b></div></div>`;
    h += '<div class="leyenda" style="margin:0 2px 10px">' + [['verde','30 % o más'],['amar','15 a 30 %'],['rojo','0 a 15 %'],['negro','Pierde'],['gris','Sin costear o faltan datos']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('') + '</div>';
    h += ver.length ? ver.map(({ m, x, dis }) => { const s = X.semaforo(x);
      return `<button class="mod ${String(sel) === String(m.id) && ancho.matches ? 'sel' : ''}" type="button" data-modelo="${esc(m.id)}"><img src="${esc(foto(m))}" alt="">
        <span class="grow"><span class="mat-t">${esc(m.nombre)}</span><span class="mat-s">${dis ? 'En diseño · ' + esc(x.c.codigo) : esc(m.tipo) + (x ? ' · ' + esc(x.c.codigo) : '')}${x && !x.falta.length ? ' · cuesta ' + dinero(x.costo) : ''}</span></span>
        <span class="mat-n"><b>${dis ? dinero(x.final) : dinero(m.precio_base)}</b><span>${dis ? 'sugerido' : 'precio hoy'}</span><span style="margin-top:3px">${pill(s)}</span></span></button>`; }).join('')
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
        <div class="vacio-d" style="padding:28px 8px"><b>Este modelo no tiene costeo</b>Se cargan sus piezas (tubos con medida), hojas (lámina y vidrio), pintura y accesorios. La forma más rápida es copiar uno parecido y cambiar lo que sea distinto.</div>`;
      foot = `<button class="btn-primary" type="button" data-copiar-de="7">Copiar piezas del Modelo bitral</button>`;
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
        <div class="tit">Piezas de hierro (se cortan de barras de 6 m)</div>
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
    if(ancho.matches){ $('panel').innerHTML = `<h2 style="margin:0 0 12px;font-size:20px">${esc(m.nombre)}</h2>${body}<div style="margin-top:16px">${foot}</div>`; }
    else { $('detTitulo').textContent = m.nombre; $('detBody').innerHTML = body; $('detFoot').innerHTML = foot; }
  }

  // ================= Materiales =================
  function secMateriales(){
    const d = D();
    $('subtitulo').textContent = 'Precios sin IVA, por proveedor';
    let h = '<p class="mat-s" style="margin:0 2px 8px">Los precios entran solos cuando se registra una compra en Depósito. Si un material tiene "precio fijo para costear", Costos usa ese y no el de la compra.</p>';
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

  // ================= Reglas =================
  function secReglas(){
    const R = D().reglas;
    $('subtitulo').textContent = 'Reglas que usan todos los modelos';
    const fila = (k, t, s, v) => `<button class="regla" type="button" data-regla="${k}"><span class="grow"><span class="mat-t">${t}</span><span class="mat-s">${s}</span></span><b>${v}</b>${CHEV}</button>`;
    return `<div class="mat-lista">
      ${fila('iva', 'IVA', 'Se suma a los materiales', R.iva + ' %')}
      ${fila('ganancia', 'Ganancia', 'Se suma al costo de cada modelo y a los extras', R.ganancia + ' %')}
      ${fila('gastosMes', 'Gastos fijos del mes', 'Alquiler, luz, internet, teléfono, transporte', dinero(R.gastosMes))}
      ${fila('puertasMes', 'Puertas al mes', 'Entre cuántas puertas se reparten los gastos fijos', R.puertasMes)}
      ${fila('corte', 'Grosor del corte', 'Lo que se pierde en cada corte del disco (cm)', R.corte + ' cm')}
      ${fila('bisagras', 'Bisagras por puerta', 'Valor de arranque al costear un modelo nuevo', R.bisagras)}
    </div>
    <div class="tit">Gastos fijos por puerta</div>
    <div class="formula">${dinero(R.gastosMes)} ÷ ${R.puertasMes} puertas = <b>${dinero(R.gastosMes / R.puertasMes)} por puerta</b><br><span class="mat-s">En Finanzas ves los gastos reales de cada mes para ajustar este número.</span></div>
    <a class="btn-nuevo" href="finanzas.html?tab=gastos" style="text-decoration:none">Ver gastos reales en Finanzas</a>
    <div class="tit">Semáforo</div>
    <div class="leyenda">${[['verde','Gana 30 % o más'],['amar','Gana de 15 a 30 %'],['rojo','Gana menos de 15 %'],['negro','Pierde dinero'],['gris','Sin costear o faltan datos']].map(([c, t]) => `<span><span class="sem-dot" style="background:${COLOR[c]}"></span>${t}</span>`).join('')}</div>
    <a class="btn-nuevo" href="categorias-pago.html" style="text-decoration:none">Categorías de pago (mano de obra)</a>`;
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
    if(F.t === 'regla'){ const v = numLibre(val('fRegla')); if(!(v >= 0)) return mal('fRegla'); d.reglas[F.k] = v; toast('Regla cambiada. Todos los modelos se recalcularon.'); }
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
    X.guardar(); cerrarHoja('sheetForm', true); F = null; pintar(); if(!ancho.matches && sel != null) pintarFicha();
    return true;
  }
  function borrar(){
    const c = D().costeo[sel];
    if(F.t === 'pieza') c.piezas.splice(F.i, 1);
    if(F.t === 'extra') c.extras.splice(F.i, 1);
    if(F.t === 'hoja') c.hojas.splice(F.i, 1);
    if(F.t === 'acc') delete c.acc[F.k];
    X.guardar(); toast('Quitado'); cerrarHoja('sheetForm', true); F = null; pintar(); if(!ancho.matches) pintarFicha();
  }

  // ================= Eventos =================
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#tabs [data-tab]'); if(t){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const fl = e.target.closest('[data-filtro]'); if(fl){ filtro = fl.dataset.filtro; pintar(); return; }
    const md = e.target.closest('[data-modelo]'); if(md) return abrirFicha(isNaN(+md.dataset.modelo) ? md.dataset.modelo : +md.dataset.modelo);
    const pv = e.target.closest('[data-prov]'); if(pv){ prov = pv.dataset.prov; return pintarFicha(); }
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
