// Compra pedida (amarilla) y "¿Llegó?" (window.COMPRA). Se usa en Costos › Plan de corte, Depósito y Finanzas.
// Pedir: con los últimos precios pagados, "Más barato" (divide por proveedor) o "Todo en <proveedor>"; + Material,
// + Otro lugar, + Gasto (flete). No toca nada real: queda en amarillo (compra_pedir).
// ¿Llegó?: cantidades y precios de la factura, número, foto, total del papel para cuadrar, y cómo se paga en una sola
// hoja (Lo debo · Pagué · Una parte · Saqué dinero, con tasa en bolívares). Confirma el admin (compra_confirmar).
// "No llegó" anula ese lugar con motivo (compra_no_llego). Nada se borra.
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const numL = (v) => { const s = String(v == null ? '' : v).trim(); if(!s) return NaN; if(/,\d{1,3}$/.test(s) && !/\./.test(s)) return parseFloat(s.replace(',', '.')); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };
  const corto = (n) => String(n || '').replace('Inversiones ', '').replace(' (ferretería y otros)', '');
  const fechaTxt = (iso) => { try{ return new Date(iso).toLocaleDateString('es-VE', { day:'numeric', month:'short' }); } catch(e){ return ''; } };
  let E = null, S = null, ocupado = false;
  const cambios = [];

  async function cargar(){ const { data, error } = await db.rpc('compras_en_camino'); if(error) throw error; E = data; return E; }
  const prov = (id) => (E.proveedores || []).find(p => String(p.id) === String(id)) || { nombre:'Proveedor', iva:false, saldo:0, tipos:[] };
  const fab = (id) => (E.fab || []).find(f => String(f.id) === String(id));
  // Lo que está en camino de un material (para "+4 en camino")
  function enCamino(mid){ let n = 0; (E && E.grupos || []).forEach(g => (g.lugares || []).forEach(l => (l.lineas || []).forEach(x => { if(String(x.material_id) === String(mid)) n += Number(x.cantidad) || 0; }))); return n; }
  function resumenGrupo(g){
    let barras = 0, hojas = 0, otros = 0;
    (g.lugares || []).forEach(l => (l.lineas || []).forEach(x => { if(x.pres === 'barra') barras += Number(x.cantidad) || 0; else if(x.pres === 'hoja') hojas += Number(x.cantidad) || 0; else otros++; }));
    return [barras ? plural(barras, '1 barra', 'barras') : '', hojas ? plural(hojas, '1 hoja', 'hojas') : '', otros ? plural(otros, '1 cosa más', 'cosas más') : ''].filter(Boolean).join(' y ');
  }
  // Tarjetas amarillas de lo que está en camino. o: {proveedor?:id, titulo?:'Compra pedida'|'En camino'}
  function tarjetasHtml(o){
    o = o || {}; if(!E) return '';
    return (E.grupos || []).filter(g => !o.proveedor || (g.lugares || []).some(l => String(l.proveedor_id) === String(o.proveedor))).map(g => {
      const nom = (g.lugares || []).map(l => corto(l.proveedor)).join(' y ');
      return `<button class="cp-amar" type="button" data-compra-llego="${g.grupo}"><span><b>${esc((o.titulo || 'Compra pedida') + ' a ' + nom)} · ${dinero(g.total)}</b><small>${esc(resumenGrupo(g))} · pedida ${esc(fechaTxt(g.fecha))} · por confirmar</small></span><span class="cp-llego">¿Llegó? ›</span></button>`; }).join('');
  }
  const alCambiar = (fn) => cambios.push(fn);
  async function avisar(){ try{ await cargar(); } catch(e){} cambios.forEach(fn => { try{ fn(); } catch(e){} }); }

  // ---------- Hoja propia ----------
  function hoja(){
    if($('sheetCompra')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="sheet-scrim scrim-top cp-scrim" id="scrimCompra" data-cerrar="sheetCompra"></div>
      <section class="sheet sheet-top cp-sheet" id="sheetCompra" role="dialog" aria-modal="true" aria-labelledby="compraTitulo">
        <div class="sheet-handle"></div>
        <div class="sheet-head"><h2 class="sheet-title" id="compraTitulo">Compra</h2>
          <button class="icon-btn" data-cerrar="sheetCompra" aria-label="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
        <div class="sheet-body" id="compraBody"></div>
        <div class="sheet-foot" id="compraFoot"></div>
      </section>`);
  }
  const subLugar = (l) => r2(l.lineas.reduce((a, x) => a + (numL(x.cantidad) || 0) * (numL(x.precio) || 0), 0));
  const totLugar = (l) => r2(subLugar(l) * (prov(l.proveedor_id).iva ? 1.16 : 1));
  const totGastos = () => r2(S.gastos.reduce((a, g) => a + (numL(g.monto) || 0), 0));
  const totalPapel = (l) => { const v = numL(l.papel); return v > 0 ? v : totLugar(l); };
  const totGrupo = () => r2(S.lugares.reduce((a, l) => a + (S.modo === 'llego' ? totalPapel(l) : totLugar(l)), 0) + totGastos());
  const cuenta = () => (E.cuentas || []).find(c => String(c.id) === String(S.pago.cuenta_id));
  const nomLinea = (x) => x.n || (x.material_id ? (fab(x.material_id) || {}).nombre : x.consumible_id ? ((E.consumibles || []).find(c => String(c.id) === String(x.consumible_id)) || {}).nombre : x.descripcion) || 'Material';
  const vaA = (x) => x.material_id ? 'Depósito · ' + ({ hierro:'hierro', aluminio:'aluminio', laminas:'lámina', vidrio:'vidrio' }[(fab(x.material_id) || {}).tipo] || 'material') : x.consumible_id ? 'Depósito · consumibles' : 'Otro (sin depósito)';

  // ---------- Pedir desde el plan ----------
  function itemsDelPlan(P){
    const it = [];
    P.compras.filter(m => m.comprar > 0).forEach(m => it.push({ material_id:m.f.id, cantidad:m.comprar }));
    P.hj.filter(x => !x.vidrio && x.comprar > 0).forEach(x => it.push({ material_id:x.f.id, cantidad:x.comprar }));
    P.hj.filter(x => x.vidrio).forEach(x => it.push({ descripcion:x.f.nombre + ' cortado: ' + x.lista.map(l => l.n + ' de ' + l.k).join(', ') + ' cm', cantidad:1, vidrio:x.f.id }));
    return it;
  }
  // Reparte los materiales: el más barato de cada uno (últimos precios) o todo en un proveedor
  function repartir(items, en){
    const prin = (E.proveedores || [])[0], lug = {};
    items.forEach(x => {
      const f = x.material_id ? fab(x.material_id) : x.vidrio ? fab(x.vidrio) : null, precios = (f && f.precios) || {};
      let pid, pr;
      if(en === 'barato'){ const ps = Object.entries(precios).sort((a, b) => a[1] - b[1]); if(ps.length){ pid = ps[0][0]; pr = ps[0][1]; } else { const v = (E.proveedores || []).find(p => f && (p.tipos || []).includes(f.tipo)) || prin; pid = v && v.id; pr = 0; } }
      else { pid = en; pr = precios[en] != null ? precios[en] : 0; }
      if(pid == null) return;
      (lug[pid] ||= { proveedor_id:Number(pid), lineas:[] }).lineas.push({ material_id:x.material_id || null, descripcion:x.descripcion || null, cantidad:String(x.cantidad), precio:x.descripcion && x.vidrio ? '0' : String(pr || 0) });
    });
    return Object.values(lug);
  }
  async function abrirDesdePlan(P){
    try{ await cargar(); } catch(e){ toast(errTxt(e), 'error'); return; }
    const items = itemsDelPlan(P);
    S = { modo:'pedir', plan_sab:P.sab, items, en:'barato', lugares:repartir(items, 'barato'), gastos:[], pago:{}, agregar:null, titulo:'Comprar lo que falta' };
    hoja(); pintar(); abrirHoja('sheetCompra');
  }
  function abrirNueva(){
    return cargar().then(() => { S = { modo:'pedir', plan_sab:null, items:[], en:'barato', lugares:[], gastos:[], pago:{}, agregar:{ que:'lugar' }, titulo:'Pedir compra' }; hoja(); pintar(); abrirHoja('sheetCompra'); })
      .catch(e => toast(errTxt(e), 'error'));
  }
  async function abrirLlego(grupo){
    try{ await cargar(); } catch(e){ toast(errTxt(e), 'error'); return; }
    const g = (E.grupos || []).find(x => String(x.grupo) === String(grupo)); if(!g){ toast('Esa compra ya no está en camino', 'error'); return; }
    S = { modo:'llego', grupo:g.grupo, fecha:g.fecha, totalPedido:g.total, lugares:(g.lugares || []).map(l => ({ pedida_id:l.id, proveedor_id:l.proveedor_id, numero:'', papel:'', foto:null, noLlego:false, motivo:'',
      lineas:(l.lineas || []).map(x => ({ material_id:x.material_id || null, consumible_id:x.consumible_id || null, descripcion:x.descripcion || null, n:x.n, cantidad:String(x.cantidad), precio:String(x.precio) })) })),
      gastos:(g.gastos || []).map(x => ({ categoria:x.categoria, monto:String(x.total) })), pago:{ modo:'debo', cuenta_id:null, origen:'BCV' }, agregar:null, titulo:'¿Llegó la compra?' };
    hoja(); pintar(); abrirHoja('sheetCompra');
  }

  // ---------- Pintar ----------
  const inp = (k, v, extra) => `<input class="input cp-in" data-k="${k}" inputmode="decimal" value="${esc(v == null ? '' : v)}" ${extra || ''}>`;
  function pintar(){
    $('compraTitulo').textContent = S.titulo;
    const cs = E.cuentas || [], tienes = r2(cs.reduce((a, c) => a + Number(c.saldo || 0), 0)), mayor = cs.slice().sort((a, b) => b.saldo - a.saldo)[0];
    let h = '';
    if(S.agregar) return pintarAgregar();
    if(S.modo === 'pedir'){
      const debe = S.lugares.reduce((a, l) => a + Math.min(0, Number(prov(l.proveedor_id).saldo || 0)), 0);
      h += `<div class="cp-saldos"><div><span>Tienes en cuentas</span><b>${cs.length ? dinero(tienes) : '·'}</b><small>${mayor ? esc('más en ' + mayor.nombre) : 'Crea tus cuentas en Finanzas'}</small></div>
        <div class="${debe < 0 ? 'rojo' : ''}"><span>${S.lugares.length === 1 ? 'Le debes a ' + esc(corto(prov(S.lugares[0].proveedor_id).nombre)) : 'Le debes a estos'}</span><b>${dinero(Math.abs(debe))}</b><small>${debe < 0 ? 'antes de esta compra' : 'al día'}</small></div></div>`;
      if(S.items.length){ const ps = (E.proveedores || []).filter(p => (p.tipos || []).some(t => ['hierro','laminas','vidrio'].includes(t)));
        h += `<div class="field-label" style="margin-top:12px">Comprar en</div><div class="fi-opc">${[['barato', 'Más barato']].concat(ps.map(p => [String(p.id), esc(corto(p.nombre))])).map(([v, t]) => `<button class="fx ${String(S.en) === v ? 'on' : ''}" type="button" data-cp-en="${v}">${t}</button>`).join('')}</div>`; }
    } else {
      h += `<div class="cp-amar cp-fijo"><span><b>Pedida ${esc(fechaTxt(S.fecha))} · ${dinero(S.totalPedido)}</b><small>por confirmar · cambia cantidad o precio si la factura dice otra cosa</small></span></div>`;
    }
    S.lugares.forEach((l, i) => {
      const p = prov(l.proveedor_id), sinPrecio = l.lineas.filter(x => !(numL(x.precio) > 0)).length;
      h += `<div class="cp-lugar ${l.noLlego ? 'anulado' : ''}"><div class="cp-lh"><b>${esc(corto(p.nombre))}</b><span>${dinero(S.modo === 'llego' ? totalPapel(l) : totLugar(l))}</span></div>
        <div class="cp-fila cp-cab"><span>Material</span><span>${S.modo === 'llego' ? 'Llegó' : 'Cant.'}</span><span>s/IVA</span></div>
        ${l.lineas.map((x, j) => `<div class="cp-fila"><span>${esc(nomLinea(x))}<small>${esc(vaA(x))}</small></span>${inp('l:' + i + ':' + j + ':cantidad', x.cantidad, 'aria-label="Cantidad"')}${inp('l:' + i + ':' + j + ':precio', x.precio, 'aria-label="Precio sin IVA"')}</div>`).join('')}
        ${sinPrecio ? `<p class="cp-aviso">${plural(sinPrecio, '1 línea sin precio', 'líneas sin precio')}: escríbelo cuando lo sepas.</p>` : ''}
        <p class="mat-s" style="margin:4px 2px 0">${p.iva ? 'Con IVA 16 %' : 'Sin IVA'}${p.saldo < 0 ? ' · le debes ' + dinero(-p.saldo) : ''}</p>
        <div class="cp-mas"><button type="button" data-cp-mas="${i}">+ Material</button>${S.modo === 'llego' && l.pedida_id ? `<button type="button" data-cp-nollego="${i}">No llegó</button>` : `<button type="button" data-cp-quitarl="${i}">Quitar lugar</button>`}</div>
        ${S.modo === 'llego' ? `${l.noLlego ? `<div class="field" style="margin-top:8px"><label class="field-label" for="cpMot${i}">¿Por qué no llegó?</label><input class="input" id="cpMot${i}" data-k="m:${i}" value="${esc(l.motivo)}"><button class="btn-secondary" type="button" data-cp-anular="${i}" style="width:100%;margin-top:8px">Anular este lugar</button></div>` : `
          <div class="input-row" style="margin-top:10px"><div class="field"><label class="field-label" for="cpNum${i}">N° factura</label><input class="input" id="cpNum${i}" data-k="n:${i}" value="${esc(l.numero)}"></div>
          <div class="field"><span class="field-label">Foto</span><label class="btn-secondary cp-foto">${l.foto ? 'Foto lista' : 'Tomar foto'}<input type="file" accept="image/*" data-cp-foto="${i}" hidden></label></div></div>
          <div class="field"><label class="field-label" for="cpPapel${i}">Total del papel (para cuadrar)</label><input class="input" id="cpPapel${i}" data-k="p:${i}" inputmode="decimal" value="${esc(l.papel)}"><div class="field-hint" id="cpCuadra${i}">${cuadreTxt(l)}</div></div>`}` : ''}
      </div>`;
    });
    // Gastos de la compra
    if(S.gastos.length) h += `<div class="cp-lugar"><div class="cp-lh"><b>Otros gastos de la compra</b><span>${dinero(totGastos())}</span></div>${S.gastos.map((g, i) => `<div class="cp-fila cp-g"><span>${esc(g.categoria)}<small>gasto del mes</small></span>${inp('g:' + i, g.monto, 'aria-label="Monto"')}<button class="btn-mini sec2" type="button" data-cp-quitarg="${i}">Quitar</button></div>`).join('')}</div>`;
    h += `<div class="cp-mas" style="margin-top:10px"><button type="button" data-cp-otro>+ Otro lugar</button><button type="button" data-cp-gasto>+ Gasto</button></div>`;
    if(S.modo === 'llego') h += pagoHtml();
    $('compraBody').innerHTML = h;
    pie();
  }
  function cuadreTxt(l){
    const v = numL(l.papel), c = totLugar(l);
    if(!(v > 0)) return 'Las líneas suman ' + dinero(c) + '. Si el papel dice otra cosa, escríbelo.';
    return Math.abs(v - c) < 0.02 ? '<b style="color:var(--accent)">Cuadra con las líneas</b>' : `<b style="color:var(--amber)">No cuadra: las líneas suman ${dinero(c)}.</b> Revisa cantidades o precios; se guarda lo del papel.`;
  }
  function pagoHtml(){
    const P = S.pago, c = cuenta(), ves = c && c.moneda === 'VES', gast = totGrupo();
    let h = `<div class="tit">¿Cómo se paga?</div><div class="fi-opc">${[['debo','Lo debo'],['pague','Pagué'],['parte','Una parte'],['saque','Saqué dinero']].map(([v, t]) => `<button class="fx ${P.modo === v ? 'on' : ''}" type="button" data-cp-modo="${v}">${t}</button>`).join('')}</div>`;
    const necesitaCuenta = P.modo !== 'debo' || S.gastos.some(g => numL(g.monto) > 0);
    if(necesitaCuenta){
      h += `<div class="field-label" style="margin-top:12px">${P.modo === 'debo' ? '¿De qué cuenta salieron los gastos?' : 'De qué cuenta'}</div>${(E.cuentas || []).length ? `<div class="fi-opc">${E.cuentas.map(x => `<button class="fx ${String(P.cuenta_id) === String(x.id) ? 'on' : ''}" type="button" data-cp-cuenta="${x.id}">${esc(x.nombre)} · ${dinero(x.saldo)}</button>`).join('')}</div>` : '<div class="caja-amar">No hay cuentas. Créalas en Finanzas.</div>'}`;
      if(ves) h += `<div class="input-row" style="margin-top:10px"><div class="field"><label class="field-label" for="cpTasa">Tasa (Bs por $)</label><input class="input" id="cpTasa" data-k="tasa" inputmode="decimal" value="${esc(P.tasa || '')}"></div>
        <div class="field"><span class="field-label">De dónde</span><div class="fi-opc">${['BCV','Binance','Otra'].map(o => `<button class="fx ${P.origen === o ? 'on' : ''}" type="button" data-cp-origen="${o}">${o}</button>`).join('')}</div></div></div>`;
    }
    if(P.modo === 'parte') h += `<div class="field" style="margin-top:10px"><label class="field-label" for="cpParte">Cuánto pagaste ($)</label><input class="input" id="cpParte" data-k="parte" inputmode="decimal" value="${esc(P.monto || '')}"><div class="field-hint" id="cpParteH">${parteTxt()}</div></div>`;
    if(P.modo === 'saque') h += `<div class="field" style="margin-top:10px"><label class="field-label" for="cpSac">Cuánto saqué ($)</label><input class="input" id="cpSac" data-k="sacado" inputmode="decimal" value="${esc(P.sacado || '')}"></div>
      <div class="cp-gasto"><b>Lo que se gastó</b>${S.lugares.filter(l => !l.noLlego).map(l => `<div><span>${esc(corto(prov(l.proveedor_id).nombre))}${l.numero ? ' · ' + esc(l.numero) : ''}</span><span>${dinero(totalPapel(l))}</span></div>`).join('')}${S.gastos.map(g => `<div><span>${esc(g.categoria)}</span><span>${dinero(numL(g.monto) || 0)}</span></div>`).join('')}<div class="fin"><span>Gastado</span><span id="cpGastado">${dinero(gast)}</span></div></div>
      <div id="cpVuelto">${vueltoHtml()}</div>
      <div class="field"><label class="field-label" for="cpVR">Vuelto que de verdad trajiste ($)</label><input class="input" id="cpVR" data-k="vuelto" inputmode="decimal" value="${esc(P.vuelto || '')}"><div class="field-hint">Si lo dejas vacío, es el que calcula la app.</div></div>
      <div class="field" id="cpMotW"><label class="field-label" for="cpMotV">Motivo si falta o sobra</label><input class="input" id="cpMotV" data-k="motivo" value="${esc(P.motivo || '')}"></div>`;
    if(ves && P.modo !== 'debo') h += `<p class="mat-s" id="cpBs" style="margin:6px 2px 0">${bsTxt()}</p>`;
    h += `<p class="mat-s" style="margin:10px 2px 0">Al confirmar: entra al Depósito, la deuda o la salida de dinero quedan reales y cada precio queda como el último de ese proveedor.</p>`;
    return h;
  }
  const bsTxt = () => { const P = S.pago, t = numL(P.tasa); return t > 0 ? 'En bolívares: ' + ((P.modo === 'parte' ? (numL(P.monto) || 0) : totGrupo()) * t).toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' Bs a ' + t.toLocaleString('es-VE') : 'Escribe la tasa del día.'; };
  const parteTxt = () => { const m = numL(S.pago.monto) || 0, t = r2(S.lugares.filter(l => !l.noLlego).reduce((a, l) => a + totalPapel(l), 0)); return m > 0 ? `Quedas debiendo ${dinero(Math.max(0, t - m))}.` : 'Lo que no pagues queda como deuda.'; };
  function vueltoHtml(){
    const sac = numL(S.pago.sacado); if(!(sac > 0)) return '';
    const v = r2(sac - totGrupo()), c = cuenta(), real = numL(S.pago.vuelto), cuadra = !(real >= 0) || Math.abs(real - v) < 0.005;
    if(v < 0) return `<div class="caja-rara">Gastaste ${dinero(-v)} más de lo que sacaste. Revisa lo que sacaste.</div>`;
    return `<div class="cp-vuelto ${cuadra ? '' : 'no'}"><span><b>Vuelto ${dinero(v)}</b><small>vuelve a ${esc(c ? c.nombre : 'la cuenta')}</small></span><span>${cuadra ? 'cuadra' : (real < v ? 'faltan ' + dinero(v - real) : 'sobran ' + dinero(real - v)) + ': escribe el motivo'}</span></div>`;
  }
  function pie(){
    const t = totGrupo(), f = $('compraFoot');
    if(S.modo === 'pedir'){
      f.innerHTML = `<div class="cp-total"><span>Total con IVA<small>${S.lugares.length > 1 ? 'cada lugar se confirma con su factura cuando llega' : 'últimos precios pagados'}</small></span><b id="cpTot">${dinero(t)}</b></div>
        <button class="btn-primary" type="button" data-cp-pedir ${S.lugares.some(l => l.lineas.length) ? '' : 'disabled'}>Pedir compra · <span id="cpTot2">${dinero(t)}</span></button>
        <p class="mat-s" style="text-align:center;margin:6px 0 0">Queda en amarillo hasta que llegue el material y confirmes.</p>`;
    } else {
      const vivos = S.lugares.filter(l => !l.noLlego).length;
      f.innerHTML = `<button class="btn-primary" type="button" data-cp-confirmar ${vivos ? '' : 'disabled'}>Confirmar · <span id="cpTot2">${dinero(t)}</span></button>`;
    }
  }
  function pintarAgregar(){
    const A = S.agregar, t = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let h = '';
    if(A.que === 'lugar'){
      $('compraTitulo').textContent = 'Otro lugar';
      h = `<p class="mat-s" style="margin:0 2px 10px">¿Dónde más compraste? La ferretería sin factura es un lugar más.</p>${(E.proveedores || []).filter(p => !S.lugares.some(l => String(l.proveedor_id) === String(p.id))).map(p => `<button class="ln" type="button" data-cp-elegirp="${p.id}"><span class="ln-t">${esc(p.nombre)}</span><span class="ln-v">${p.saldo < 0 ? 'le debes ' + dinero(-p.saldo) : ''}</span><span class="ln-s">${p.iva ? 'con IVA' : 'sin IVA'}</span></button>`).join('')}`;
    } else if(A.que === 'gasto'){
      $('compraTitulo').textContent = 'Gasto de la compra';
      h = `<div class="field"><span class="field-label">Qué es</span><div class="fi-opc">${['Flete','Transporte','Otro'].map(x => `<button class="fx ${A.cat === x ? 'on' : ''}" type="button" data-cp-gcat="${x}">${x}</button>`).join('')}</div></div>
        ${A.cat === 'Otro' ? `<div class="field"><label class="field-label" for="cpGNom">Nombre</label><input class="input" id="cpGNom" value="${esc(A.nom || '')}"></div>` : ''}
        <div class="field" id="cpGMW"><label class="field-label" for="cpGM">Monto ($)</label><input class="input" id="cpGM" inputmode="decimal" value="${esc(A.monto || '')}"><div class="field-error">Escribe el monto</div><div class="field-hint">Es gasto del mes; el cierre lo compara con el flete de los gastos fijos.</div></div>`;
    } else {
      $('compraTitulo').textContent = 'Agregar a ' + corto(prov(S.lugares[A.i].proveedor_id).nombre);
      const L = (E.fab || []).map(f => ({ k:'f' + f.id, n:f.nombre, s:'Depósito · ' + f.tipo, material_id:f.id, precio:(f.precios || {})[S.lugares[A.i].proveedor_id] })).concat((E.consumibles || []).map(c => ({ k:'c' + c.id, n:c.nombre, s:'Depósito · consumibles', consumible_id:c.id })))
        .filter(x => !A.bus || t(x.n).includes(t(A.bus))).slice(0, 40);
      h = `<label class="search-box" style="margin:0 0 8px"><input id="cpBus" type="search" placeholder="Buscar material" aria-label="Buscar material" value="${esc(A.bus || '')}" autocomplete="off"></label>
        ${L.map(x => `<button class="ln" type="button" data-cp-elegirm="${x.k}"><span class="ln-t">${esc(x.n)}</span><span class="ln-v">${x.precio != null ? dinero(x.precio) : ''}</span><span class="ln-s">${esc(x.s)}</span></button>`).join('') || '<p class="mat-s">No hay nada con ese nombre.</p>'}
        <div class="field" style="margin-top:12px"><label class="field-label" for="cpDesc">¿No está? Escríbelo (no entra al Depósito)</label><input class="input" id="cpDesc" value="${esc(A.desc || '')}"></div>`;
    }
    $('compraBody').innerHTML = h;
    $('compraFoot').innerHTML = `<div style="display:flex;gap:10px"><button class="btn-secondary" type="button" data-cp-volver style="flex:1;height:54px">Volver</button>${A.que === 'gasto' ? '<button class="btn-primary" type="button" data-cp-gastook style="flex:1.4">Agregar gasto</button>' : A.que === 'mat' ? '<button class="btn-primary" type="button" data-cp-descok style="flex:1.4">Agregar escrito</button>' : ''}</div>`;
  }

  // ---------- Leer campos sin repintar ----------
  function leer(){
    document.querySelectorAll('#compraBody [data-k]').forEach(el => {
      const k = el.dataset.k.split(':'), v = el.value;
      if(k[0] === 'l') S.lugares[+k[1]].lineas[+k[2]][k[3]] = v;
      else if(k[0] === 'g') S.gastos[+k[1]].monto = v;
      else if(k[0] === 'n') S.lugares[+k[1]].numero = v;
      else if(k[0] === 'p') S.lugares[+k[1]].papel = v;
      else if(k[0] === 'm') S.lugares[+k[1]].motivo = v;
      else if(k[0] === 'tasa') S.pago.tasa = v;
      else if(k[0] === 'parte') S.pago.monto = v;
      else if(k[0] === 'sacado') S.pago.sacado = v;
      else if(k[0] === 'vuelto') S.pago.vuelto = v;
      else if(k[0] === 'motivo') S.pago.motivo = v;
    });
  }
  function totales(){
    const t = dinero(totGrupo());
    ['cpTot','cpTot2','cpGastado'].forEach(id => { const el = $(id); if(el) el.textContent = t; });
    S.lugares.forEach((l, i) => { const c = $('cpCuadra' + i); if(c) c.innerHTML = cuadreTxt(l); });
    const v = $('cpVuelto'); if(v) v.innerHTML = vueltoHtml();
    const ph = $('cpParteH'); if(ph) ph.textContent = parteTxt();
    const bs = $('cpBs'); if(bs) bs.textContent = bsTxt();
    document.querySelectorAll('#compraBody .cp-lh span').forEach((el, i) => { const l = S.lugares[i]; if(l) el.textContent = dinero(S.modo === 'llego' ? totalPapel(l) : totLugar(l)); });
  }

  // ---------- Guardar ----------
  const lineasOk = (l) => l.lineas.map(x => ({ material_id:x.material_id || null, consumible_id:x.consumible_id || null, descripcion:x.material_id || x.consumible_id ? null : (x.descripcion || x.n), cantidad:numL(x.cantidad), precio:numL(x.precio) || 0 }));
  function validarLineas(){
    for(const l of S.lugares.filter(x => !x.noLlego)){
      if(!l.lineas.length){ toast('Cada lugar necesita al menos un material. Quita el lugar o agrégale algo.', 'error'); return false; }
      for(const x of lineasOk(l)){
        if(!(x.cantidad > 0)){ toast('Revisa la cantidad de ' + (x.descripcion || 'cada material'), 'error'); return false; }
        if((x.material_id || x.consumible_id) && x.cantidad % 1){ toast('Las barras, hojas y consumibles se cuentan enteros', 'error'); return false; }
        if(x.precio < 0){ toast('El precio no puede ser negativo', 'error'); return false; }
      }
    }
    return true;
  }
  async function pedir(){
    leer(); if(!validarLineas()) return;
    if(S.gastos.some(g => !(numL(g.monto) >= 0))){ toast('Revisa el monto de cada gasto', 'error'); return; }
    if(ocupado) return; ocupado = true;
    try{
      const { error } = await db.rpc('compra_pedir', { p:{ plan_sab:S.plan_sab || null, lugares:S.lugares.filter(l => l.lineas.length).map(l => ({ proveedor_id:l.proveedor_id, lineas:lineasOk(l) })), gastos:S.gastos.map(g => ({ categoria:g.categoria, monto:numL(g.monto) || 0 })) } });
      if(error) throw error;
      toast('Compra pedida. Queda en amarillo hasta que llegue.'); cerrarHoja('sheetCompra', true); S = null; await avisar();
    } catch(e){ toast(errTxt(e), 'error'); }
    finally { ocupado = false; }
  }
  async function subirFoto(blob){
    const d = new Date(), path = `compras/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db.storage.from('comprobantes').upload(path, blob, { contentType:'image/jpeg' });
    if(error) throw new Error('No se pudo subir la foto. Revisa el internet.');
    return path;
  }
  async function confirmar(){
    leer(); if(!validarLineas()) return;
    const P = S.pago, c = cuenta(), vivos = S.lugares.filter(l => !l.noLlego);
    if(S.lugares.some(l => l.noLlego)){ toast('Primero anula el lugar que no llegó (o vuelve a marcarlo).', 'error'); return; }
    const conGastos = S.gastos.some(g => numL(g.monto) > 0);
    if((P.modo !== 'debo' || conGastos) && !c){ toast('Elige de qué cuenta salió el dinero', 'error'); return; }
    if(c && c.moneda === 'VES' && !(numL(P.tasa) > 0)){ toast('Escribe la tasa del día', 'error'); return; }
    if(P.modo === 'parte' && !(numL(P.monto) > 0)){ toast('Escribe cuánto pagaste', 'error'); return; }
    if(P.modo === 'saque'){
      const sac = numL(P.sacado), v = r2(sac - totGrupo()), real = numL(P.vuelto);
      if(!(sac > 0)){ toast('Escribe cuánto sacaste', 'error'); return; }
      if(v < 0){ toast('Gastaste más de lo que sacaste. Revisa lo que sacaste.', 'error'); return; }
      if(real >= 0 && Math.abs(real - v) > 0.005 && !String(P.motivo || '').trim()){ const w = $('cpMotW'); if(w) w.classList.add('invalid'); toast('El vuelto no cuadra: escribe el motivo', 'error'); return; }
    }
    if(ocupado) return; ocupado = true;
    const btn = document.querySelector('[data-cp-confirmar]'); if(btn) btn.disabled = true;
    try{
      const lugares = [];
      for(const l of vivos){ let foto = null; if(l.foto) foto = await subirFoto(l.foto);
        lugares.push({ pedida_id:l.pedida_id || null, proveedor_id:l.proveedor_id, numero:String(l.numero || '').trim() || null, foto, total:numL(l.papel) > 0 ? numL(l.papel) : null, lineas:lineasOk(l) }); }
      const pago = { modo:P.modo, cuenta_id:c ? c.id : null, monto:P.modo === 'parte' ? numL(P.monto) : null, sacado:P.modo === 'saque' ? numL(P.sacado) : null,
        vuelto:P.modo === 'saque' && numL(P.vuelto) >= 0 ? numL(P.vuelto) : null, motivo:String(P.motivo || '').trim() || null, tasa:c && c.moneda === 'VES' ? numL(P.tasa) : null, tasa_origen:c && c.moneda === 'VES' ? P.origen : null };
      const { data, error } = await db.rpc('compra_confirmar', { grupo_id:S.grupo, p:{ lugares, gastos:S.gastos.map(g => ({ categoria:g.categoria, monto:numL(g.monto) || 0 })), pago } });
      if(error) throw error;
      toast(P.modo === 'saque' && data && data.vuelto != null ? 'Compra confirmada. Vuelto ' + dinero(data.vuelto) + ' de vuelta a ' + c.nombre + '.' : P.modo === 'debo' ? 'Compra confirmada. Entró al Depósito y quedó la deuda.' : 'Compra confirmada y pagada. Entró al Depósito.');
      cerrarHoja('sheetCompra', true); S = null; await avisar();
    } catch(e){ toast(errTxt(e), 'error'); }
    finally { ocupado = false; if(btn) btn.disabled = false; }
  }
  async function anular(i){
    leer(); const l = S.lugares[i], mot = String(l.motivo || '').trim();
    if(!mot){ toast('Escribe por qué no llegó', 'error'); return; }
    if(ocupado) return; ocupado = true;
    try{ const { error } = await db.rpc('compra_no_llego', { pid:l.pedida_id, motivo:mot }); if(error) throw error;
      toast('Anulado: ' + corto(prov(l.proveedor_id).nombre) + ' no llegó.'); S.lugares.splice(i, 1); await avisar();
      if(!S.lugares.length){ cerrarHoja('sheetCompra', true); S = null; } else pintar(); }
    catch(e){ toast(errTxt(e), 'error'); }
    finally { ocupado = false; }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const ll = e.target.closest('[data-compra-llego]'); if(ll){ abrirLlego(ll.dataset.compraLlego); return; }
    if(!S || !e.target.closest('#sheetCompra')) return;
    const q = (a) => e.target.closest('[' + a + ']');
    let x;
    if((x = q('data-cp-en'))){ leer(); S.en = x.dataset.cpEn; S.lugares = repartir(S.items, S.en); return pintar(); }
    if((x = q('data-cp-mas'))){ leer(); S.agregar = { que:'mat', i:+x.dataset.cpMas, bus:'' }; return pintar(); }
    if(q('data-cp-otro')){ leer(); S.agregar = { que:'lugar' }; return pintar(); }
    if(q('data-cp-gasto')){ leer(); S.agregar = { que:'gasto', cat:'Flete' }; return pintar(); }
    if(q('data-cp-volver')){ S.agregar = null; return pintar(); }
    if((x = q('data-cp-elegirp'))){ S.lugares.push({ proveedor_id:+x.dataset.cpElegirp, lineas:[], numero:'', papel:'', foto:null }); S.agregar = { que:'mat', i:S.lugares.length - 1, bus:'' }; return pintar(); }
    if((x = q('data-cp-elegirm'))){ const k = x.dataset.cpElegirm, l = S.lugares[S.agregar.i], id = +k.slice(1);
      if(k[0] === 'f'){ const f = fab(id); l.lineas.push({ material_id:id, cantidad:'1', precio:String(((f && f.precios) || {})[l.proveedor_id] || 0) }); }
      else l.lineas.push({ consumible_id:id, cantidad:'1', precio:'0' });
      S.agregar = null; return pintar(); }
    if(q('data-cp-descok')){ const d = String(($('cpDesc') || {}).value || '').trim(); if(!d){ toast('Escribe qué es', 'error'); return; } S.lugares[S.agregar.i].lineas.push({ descripcion:d, cantidad:'1', precio:'0' }); S.agregar = null; return pintar(); }
    if((x = q('data-cp-gcat'))){ S.agregar.monto = ($('cpGM') || {}).value; S.agregar.cat = x.dataset.cpGcat; return pintar(); }
    if(q('data-cp-gastook')){ const m = numL(($('cpGM') || {}).value), nom = S.agregar.cat === 'Otro' ? String(($('cpGNom') || {}).value || '').trim() : S.agregar.cat;
      if(!(m >= 0) || !nom){ const w = $('cpGMW'); if(w) w.classList.add('invalid'); return; } S.gastos.push({ categoria:nom, monto:String(m) }); S.agregar = null; return pintar(); }
    if((x = q('data-cp-quitarg'))){ leer(); S.gastos.splice(+x.dataset.cpQuitarg, 1); return pintar(); }
    if((x = q('data-cp-quitarl'))){ leer(); S.lugares.splice(+x.dataset.cpQuitarl, 1); return pintar(); }
    if((x = q('data-cp-nollego'))){ leer(); const l = S.lugares[+x.dataset.cpNollego]; l.noLlego = !l.noLlego; return pintar(); }
    if((x = q('data-cp-anular'))) return anular(+x.dataset.cpAnular);
    if((x = q('data-cp-modo'))){ leer(); S.pago.modo = x.dataset.cpModo; return pintar(); }
    if((x = q('data-cp-cuenta'))){ leer(); S.pago.cuenta_id = +x.dataset.cpCuenta; return pintar(); }
    if((x = q('data-cp-origen'))){ leer(); S.pago.origen = x.dataset.cpOrigen; return pintar(); }
    if(q('data-cp-pedir')) return pedir();
    if(q('data-cp-confirmar')) return confirmar();
  });
  document.addEventListener('input', (e) => {
    if(!S || !e.target.closest('#sheetCompra')) return;
    if(e.target.id === 'cpBus'){ S.agregar.bus = e.target.value; const pos = e.target.selectionStart; pintar(); const el = $('cpBus'); if(el){ el.focus(); try{ el.setSelectionRange(pos, pos); } catch(_){} } return; }
    if(e.target.dataset.k){ leer(); totales(); }
  });
  document.addEventListener('change', async (e) => {
    if(!S || !e.target.matches || !e.target.matches('[data-cp-foto]') || !e.target.files || !e.target.files[0]) return;
    leer();
    try{ const i = +e.target.dataset.cpFoto, f = e.target.files[0]; S.lugares[i].foto = typeof window.comprimirFoto === 'function' ? await window.comprimirFoto(f, 1600, 0.72) : f; pintar(); }
    catch(err){ toast('No se pudo leer la foto', 'error'); }
  });

  window.COMPRA = { cargar, get datos(){ return E; }, enCamino, tarjetasHtml, resumenGrupo, alCambiar, abrirDesdePlan, abrirNueva, abrirLlego };
})();
