// Finanzas › Mes: cierre del mes y reporte mensual (lote 10) y reportes por proveedor y por cuenta (lote 10b).
// Los números del mes los calcula la base (mes_datos); "Cerrar el mes" los congela (mes_cerrar).
// Los reportes por proveedor y por cuenta salen de la libreta de Finanzas, con filtro de fechas y PDF.
(function(){
  'use strict';
  const { esc, toast, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const F = () => window.FIN;
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const nomMes = (m) => { const [a, n] = m.split('-'); return MESES[+n - 1] + ' ' + a; };
  const suma = (l) => l.reduce((a, x) => a + Number(x[1]), 0);
  const q = new URLSearchParams(location.search);
  let vista = q.get('reporte') ? 'reportes' : 'cierre';
  let mesSel = q.get('mes') || null;
  const cache = {};
  let cargando = false;

  const signo = (v) => F().signo(Number(v));
  // Todos los meses desde el primer movimiento hasta hoy (el más nuevo primero)
  function meses(){
    const D = F().datos, act = F().mesActual();
    const fechas = D.movs.map(x => String(x.fecha).slice(0, 7)).filter(Boolean).sort();
    let [a, m] = (fechas[0] || act).split('-').map(Number); const out = [];
    while(true){ const k = a + '-' + String(m).padStart(2, '0'); out.push(k); if(k >= act) break; m++; if(m > 12){ m = 1; a++; } if(out.length > 120) break; }
    return out.reverse();
  }
  const mover = (d) => { const ms = meses(), i = ms.indexOf(mesSel), j = Math.min(ms.length - 1, Math.max(0, i - d)); mesSel = ms[j]; };
  async function traer(m){
    if(cache[m] || cargando) return;
    cargando = true;
    try{ const { data, error } = await db.rpc('mes_datos', { p_mes:m + '-01' }); if(error) throw error; cache[m] = data; }
    catch(e){ cache[m] = { error:F().errTxt(e) }; }
    finally { cargando = false; }
    F().pintar();
  }

  // ---------- Ganancia por modelo (antes en Costos › Ganancia): precio del catálogo menos costo y gastos fijos ----------
  let RES = null, cargandoRes = false;
  async function traerResumen(){
    if(RES || cargandoRes) return; cargandoRes = true;
    try{ const { data, error } = await db.rpc('costeo_resumen'); if(error) throw error; RES = data || {}; }
    catch(e){ RES = { _error:F().errTxt(e) }; }
    finally { cargandoRes = false; }
    F().pintar();
  }
  const filasGanancia = () => Object.entries(RES || {}).filter(([k, x]) => k !== '_error' && x && x.listo && !(x.falta || []).length)
    .map(([k, x]) => ({ id:k, n:x.modelo || 'Modelo', costo:Number(x.costo), final:Number(x.final), pct:Number(x.pct), gana:F().r2(Number(x.pct) * Number(x.costo) / 100) }))
    .sort((a, b) => a.pct - b.pct);
  const semPct = (p) => p >= 30 ? 'verde' : p >= 15 ? 'amar' : 'rojo';
  function gananciaModelos(acc){
    if(!RES){ traerResumen(); return acc('gmod', 'Ganancia por modelo', '…', '<p class="mat-s" style="margin:4px 2px">Cargando…</p>'); }
    if(RES._error) return acc('gmod', 'Ganancia por modelo', '', `<div class="caja-amar">${esc(RES._error)}</div>`);
    const L = filasGanancia();
    const b = L.length ? `<div class="rep">${L.map(o => `<a class="rep-f" href="costos.html?modelo=${encodeURIComponent(o.id)}" style="text-decoration:none;color:inherit"><span>${esc(o.n)}<small class="mat-s" style="display:block;font-weight:600">cuesta ${dinero(o.costo)} · sugerido ${dinero(o.final)}</small></span><b class="pill ${semPct(o.pct)}" style="white-space:nowrap">${o.gana < 0 ? '− ' : ''}${dinero(Math.abs(o.gana))} · ${Math.round(o.pct)} %</b></a>`).join('')}</div>
        <p class="mat-s" style="margin:8px 2px 0">Lo que deja cada puerta: precio del catálogo menos costo y gastos fijos. Los de abajo del 30 % conviene subirlos en Costos.</p>
        <button class="btn-secondary" type="button" data-pdf-gmod style="width:100%;margin-top:10px">Ganancia por modelo en PDF</button>`
      : '<p class="mat-s" style="margin:4px 2px">Todavía no hay modelos listos en Costos. Cuando Ray deje uno "Listo", sale aquí.</p>';
    return acc('gmod', 'Ganancia por modelo', L.length === 1 ? '1 modelo' : L.length + ' modelos', b);
  }
  async function pdfGanancia(){
    const L = filasGanancia(), b = [{ t:'titulo', texto:'Ganancia por modelo', der:'deja por puerta' }];
    L.forEach(o => b.push({ t:'fila', a:o.n + ' · cuesta ' + dinero(o.costo) + ' · sugerido ' + dinero(o.final), b:(o.gana < 0 ? '- ' : '') + dinero(Math.abs(o.gana)) + ' (' + Math.round(o.pct) + ' %)', rojo:o.pct < 15 }));
    b.push({ t:'nota', texto:'Precio del catálogo menos costo y gastos fijos por puerta.' });
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo:'Ganancia por modelo', derecha:new Date().toLocaleDateString('es-VE'), subtitulo:'Con los precios del proveedor principal.', bloques:b });
      const r = await window.PDFR.compartir(blob, 'Ganancia-por-modelo.pdf'); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }

  // ---------- Cierre del mes: lista de pasos (el primero es el arranque) ----------
  // 1 Cuentas (lo que dice el banco) · 2 Contar el Depósito · 3 Cuadrar cada proveedor · 4 Revisar y cerrar.
  // Cada diferencia queda con motivo (cierre_paso usa saldo_cambiar y conteo_guardar). Nada se borra.
  const CD = {}, CDn = {}; let cdCargando = false, PASO = null;
  const nCuentas = () => ((F().datos || {}).cuentas || []).filter(c => c.activa !== false).length;
  async function traerCierre(m, forzar){
    if((CD[m] && !forzar) || cdCargando) return; cdCargando = true;
    try{ const { data, error } = await db.rpc('cierre_datos', { p_mes:m + '-01' }); if(error) throw error; CD[m] = data; }
    catch(e){ CD[m] = { error:F().errTxt(e) }; }
    finally { cdCargando = false; }
    F().pintar(); if(PASO) pintarPaso();
  }
  const pillPaso = (hechos, total) => !total ? '<span class="pill amar">Falta</span>' : hechos >= total ? '<span class="pill verde">Listo</span>' : hechos ? `<span class="pill amar">${hechos} de ${total}</span>` : '<span class="pill amar">Falta</span>';
  function listaCierre(m){
    const X = CD[m];
    if(!X){ traerCierre(m); return '<p class="mat-s" style="margin:4px 2px 12px">Cargando la lista del cierre…</p>'; }
    if(!X.error && X.cuentas.length !== nCuentas() && CDn[m] !== nCuentas()){ CDn[m] = nCuentas(); traerCierre(m, true); }
    if(X.error) return `<div class="caja-amar">${esc(X.error)}</div>`;
    if(X.cerrado) return '';
    const cu = X.cuentas.filter(c => c.hecho).length, pv = X.proveedores.filter(p => p.hecho).length, dep = !!X.deposito.hecho;
    const todo = X.cuentas.length && cu === X.cuentas.length && dep && pv === X.proveedores.length;
    let h = `<div class="tit" style="margin-top:4px">Cierre de ${esc(nomMes(m))}</div><p class="mat-s" style="margin:-2px 2px 8px">Emparejar la app con lo real, en orden.</p>`;
    if(X.primero) h += '<div class="caja-ok cie-arr"><b>Primer cierre: es el arranque.</b> Además se crean las cuentas y se pone el saldo inicial de cada proveedor.</div>';
    if(X.en_camino) h += `<div class="caja-rara">${X.en_camino === 1 ? 'Hay 1 compra en camino. Confírmala o márcala como que no llegó' : 'Hay ' + X.en_camino + ' compras en camino. Confírmalas o márcalas como que no llegaron'} antes de cerrar.</div>`;
    const paso = (k, n, t, sub, pill) => `<button class="cie-paso" type="button" data-cierre-paso="${k}"><span><b>${n} · ${t}</b><small>${sub}</small></span>${pill}</button>`;
    h += paso('cuentas', 1, 'Cuentas y su saldo', X.cuentas.length ? esc(X.cuentas.map(c => c.nombre).slice(0, 3).join(', ')) + (X.cuentas.length > 3 ? '…' : '') + ' · lo que dice el banco' : 'Crea tus cuentas', pillPaso(cu, X.cuentas.length));
    h += paso('deposito', 2, 'Contar el Depósito', 'Barras, hojas y retazos', pillPaso(dep ? 1 : 0, 1));
    h += paso('proveedores', 3, 'Cuadrar proveedores', esc(X.proveedores.map(p => (p.nombre || '').replace('Inversiones ', '').replace(' (ferretería y otros)', '') + (p.hecho ? ' listo' : ' falta')).slice(0, 3).join(' · ')), pillPaso(pv, X.proveedores.length));
    h += `<div class="cie-paso cie-4"><span><b>4 · Revisar el mes y cerrar</b><small>Ganancia, compras y gastos: abajo. Al cerrar, los gastos fijos se reparten entre ${X.puertas > 0 ? (X.puertas === 1 ? 'la 1 puerta vendida' : 'las ' + X.puertas + ' puertas vendidas') : '25 puertas (no hubo ventas)'} este mes.</small></span>${todo ? '<span class="pill verde">Listo</span>' : '<span class="pill gris">Después</span>'}</div>`;
    h += '<p class="mat-s" style="margin:6px 2px 12px">Cada diferencia se corrige con motivo y queda guardada. Nada se borra.</p>';
    return h;
  }
  function abrirPaso(k, id){ PASO = { k, id }; pintarPaso(); window.AH.abrirHoja('sheetDet'); }
  function pintarPaso(){
    const X = CD[mesSel]; if(!PASO || !X || X.error) return;
    const prov = (id) => X.proveedores.find(p => String(p.id) === String(id));
    const corto = (n) => String(n || '').replace('Inversiones ', '').replace(' (ferretería y otros)', '');
    let h = '', foot = '';
    if(PASO.k === 'cuentas'){
      $('detTitulo').textContent = '1 · Cuentas y su saldo';
      h = '<p class="mat-s" style="margin:0 2px 10px">Escribe lo que dice el banco o la caja hoy. Si no cuadra, di por qué.</p>' + X.cuentas.map(c => {
        const hc = c.hecho && c.hecho.dato;
        return `<div class="cie-item"><div class="cie-ih"><b>${esc(c.nombre)}</b><span>${hc ? '<span class="pill verde">Listo</span>' : ''}</span></div>
          <p class="mat-s" style="margin:0 2px 6px">La app dice ${dinero(c.saldo)}${c.moneda === 'VES' ? ' (en dólares)' : ''}</p>
          <div class="input-row"><div class="field"><label class="field-label" for="cq_${c.id}">El banco dice ($)</label><input class="input" id="cq_${c.id}" inputmode="decimal" value="${esc(c.saldo)}"></div>
          <div class="field"><label class="field-label" for="cm_${c.id}">Motivo si no cuadra</label><input class="input" id="cm_${c.id}" value=""></div></div>
          <button class="btn-secondary" type="button" data-cq-ok="${c.id}" style="width:100%">${hc ? 'Volver a guardar' : 'Listo'}</button></div>`; }).join('');
      if(X.primero || !X.cuentas.length) h += '<button class="btn-nuevo" type="button" data-nueva-cuenta>+ Cuenta nueva</button>';
    } else if(PASO.k === 'deposito'){
      $('detTitulo').textContent = '2 · Contar el Depósito';
      h = '<p class="mat-s" style="margin:0 2px 10px">Cuenta las barras y hojas enteras. La app dice qué no cuadra y lo deja guardado.</p>' + X.deposito.fab.map(f => `<div class="input-row cie-cont"><div class="field"><label class="field-label" for="cd_${f.id}">${esc(f.nombre)}</label><small class="mat-s">La app dice ${f.stock} ${f.pres === 'barra' ? 'barras' : 'hojas'}${f.retazos ? ' · ' + f.retazos + ' retazos' : ''}</small></div><input class="input" id="cd_${f.id}" inputmode="numeric" value="${esc(f.stock)}" aria-label="Contado de ${esc(f.nombre)}"></div>`).join('');
      if(X.deposito.hecho) h += `<div class="caja-ok">Ya contado este mes. Puedes volver a contar.</div>`;
      foot = '<button class="btn-primary" type="button" data-cd-ok>Guardar conteo</button>';
    } else if(PASO.k === 'proveedores'){
      $('detTitulo').textContent = '3 · Cuadrar proveedores';
      h = X.proveedores.map(p => `<button class="rep-f" type="button" data-cie-prov="${p.id}"><span>${esc(p.nombre)}<small class="mat-s" style="display:block;font-weight:600">${p.saldo < -0.005 ? 'le debes ' + dinero(-p.saldo) : p.saldo > 0.005 ? 'a tu favor ' + dinero(p.saldo) : 'al día'}</small></span>${p.hecho ? '<span class="pill verde">Listo</span>' : '<span class="pill amar">Falta</span>'}</button>`).join('') || '<p class="mat-s">No hay proveedores.</p>';
    } else if(PASO.k === 'prov'){
      const p = prov(PASO.id); if(!p) return;
      $('detTitulo').textContent = '3 · Cuadrar ' + corto(p.nombre);
      const debe = -Number(p.saldo);
      h = `<div class="tot"><div class="fila"><span>Saldo al empezar el mes${X.primero ? ' (arranque)' : ''}</span><b>${dinero(-p.inicio)}</b></div><div class="fila"><span>+ Compras del mes</span><b>${dinero(p.compras)}</b></div><div class="fila"><span>− Pagos del mes</span><b>${dinero(p.pagos)}</b></div>
          <div class="fila fin"><span>La app dice que le debes</span><span>${dinero(debe)}</span></div></div>
        <div class="field" style="margin-top:12px"><label class="field-label" for="cpv">¿Cuánto dice ${esc(corto(p.nombre))} que le debes? ($)</label><input class="input" id="cpv" inputmode="decimal" value="${esc(PASO.v != null ? PASO.v : debe)}"><div class="field-hint">Si te debe él a ti, escríbelo en negativo.</div></div>
        <div id="cpvDif">${difTxt(debe, PASO.v != null ? PASO.v : debe)}</div>
        <div class="field" id="c_cpvm"><label class="field-label" for="cpvm">Motivo</label><input class="input" id="cpvm" value="${esc(PASO.m || '')}"><div class="field-error">Escribe el motivo</div><div class="field-hint">Ejemplo: nota 00-2901 sin cargar.</div></div>`;
      foot = `<div style="display:flex;gap:10px"><button class="btn-secondary" type="button" data-cierre-paso="proveedores" style="flex:1;height:54px">Volver</button><button class="btn-primary" type="button" data-cpv-ok style="flex:1.4">Cuadrar</button></div>`;
    }
    $('detBody').innerHTML = h; $('detFoot').innerHTML = foot;
  }
  const numIn = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const difTxt = (app, real) => { const d = Math.round((numIn(real) - app) * 100) / 100; return !isFinite(d) ? '' : Math.abs(d) < 0.005 ? '<div class="caja-ok">Cuadra con la app.</div>' : `<div class="caja-rara cie-dif"><span>Diferencia</span><b>${d > 0 ? '+' : '−'}${dinero(Math.abs(d))}</b></div>`; };
  async function guardarPaso(paso, ref, p, ok){
    try{ const { error } = await db.rpc('cierre_paso', { p_mes:mesSel + '-01', p_paso:paso, p_ref:ref, p }); if(error) throw error; toast(ok); await F().recargar(); await traerCierre(mesSel, true); return true; }
    catch(e){ toast(F().errTxt(e), 'error'); return false; }
  }

  // ---------- Pantalla ----------
  function html(){
    const ms = meses(); mesSel = mesSel && ms.includes(mesSel) ? mesSel : (mesSel || F().mesActual()); if(!ms.includes(mesSel)) ms.unshift(mesSel);
    let h = `<div class="opts" style="--cols:2;margin-bottom:12px"><button class="opt ${vista === 'cierre' ? 'selected' : ''}" type="button" data-fm-vista="cierre">Cierre del mes</button><button class="opt ${vista === 'reportes' ? 'selected' : ''}" type="button" data-fm-vista="reportes">Reportes</button></div>`;
    if(vista === 'reportes') return h + reportesHtml();
    $('subtitulo').textContent = 'Cierre de ' + nomMes(mesSel);
    const i = ms.indexOf(mesSel);
    h += `<div class="mes-nav"><button type="button" class="mes-fl" data-mes-mov="-1" aria-label="Mes anterior" ${i >= ms.length - 1 ? 'disabled' : ''}>‹</button>
      <button type="button" class="mes-c" data-mes-todos><b>${esc(nomMes(mesSel))}</b><small>${cache[mesSel] && cache[mesSel].cerrado ? 'cerrado' : mesSel === F().mesActual() ? 'en curso' : 'sin cerrar'} · ver todos los meses</small></button>
      <button type="button" class="mes-fl" data-mes-mov="1" aria-label="Mes siguiente" ${i <= 0 ? 'disabled' : ''}>›</button></div>`;
    const M = cache[mesSel];
    if(!M) return h + '<p class="mat-s" style="margin:12px 2px">Cargando…</p>';
    if(M.error) return h + `<div class="caja-amar">${esc(M.error)}</div><button class="btn-secondary" type="button" data-fm-reintentar style="width:100%">Reintentar</button>`;
    const C = M.datos;
    if(!M.cerrado && mesSel < F().mesActual()) h += listaCierre(mesSel);
    if(M.cerrado) h += `<div class="caja-ok">Mes cerrado el ${F().fecha(M.fecha)}${M.por ? ' por ' + esc(M.por) : ''}. Estos números quedaron fijos. Si hay que corregir algo, se hace con "Cambiar saldo" y un motivo.</div>`;
    else if(mesSel === F().mesActual()) h += `<div class="caja-nota"><span>Mes en curso</span>Los números cambian hasta que termine el mes. Se cierra a partir del día 1 del mes siguiente.</div>`;
    const neto = suma(C.entro) + suma(C.salio), ganancia = C.vendido - C.sinCosto - C.costo - C.gastoTot;
    const rep = F().reporte;
    const acc = (id, t, x, b, abierto) => `<details class="acc" ${abierto ? 'open' : ''}><summary><span>${t}</span><span class="acc-x">${x}</span></summary><div class="acc-b">${b}</div></details>`;
    h += `<div class="res" style="grid-template-columns:1fr 1fr">
      <div class="res-c ${ganancia < -0.005 ? 'rojo' : 'ok'}"><span>${ganancia >= 0 ? 'Ganancia' : 'Pérdida'}</span><b>${dinero(Math.abs(ganancia))}</b></div>
      <div class="res-c"><span>Entró</span><b>${dinero(suma(C.entro))}</b></div>
      <div class="res-c"><span>Salió</span><b>${dinero(-suma(C.salio))}</b></div>
      <div class="res-c"><span>Compras</span><b>${dinero(suma(C.compras))}</b></div></div>`;
    h += acc('gano', 'Lo que ganaste', signo(ganancia), rep([
        ['Vendido con costeo (' + (C.puertas - C.nSin === 1 ? '1 puerta' : (C.puertas - C.nSin) + ' puertas') + ')', C.vendido - C.sinCosto],
        ['Costo de lo vendido (materiales y mano de obra)', -C.costo],
        ['Gastos, nómina, vales y comisiones', -C.gastoTot]], ganancia >= 0 ? 'Ganancia del mes' : 'Pérdida del mes', ganancia)
      + (C.nSin ? `<div class="caja-amar">Además se vendieron ${C.nSin === 1 ? '1 puerta' : C.nSin + ' puertas'} sin costeo por ${dinero(C.sinCosto)}. No entran en la ganancia hasta cargar su costeo.</div>` : ''), true);
    const es = C.entro.concat(C.salio);
    h += acc('es', 'Dinero que entró y salió', signo(neto), rep(es.length ? es : [['Sin movimientos', 0]], neto >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró', neto));
    h += acc('comp', 'Compras a proveedores', dinero(suma(C.compras)), rep(C.compras.length ? C.compras.map(([n, v]) => [n, -v]) : [['Sin compras este mes', 0]], 'Total comprado', -suma(C.compras)));
    const pagF = C.pagadoFijo.reduce((a, g) => a + Number(g.pagado), 0);
    h += acc('fijos', 'Gastos fijos', dinero(pagF) + ' de ' + dinero(C.fijosPrev), `<div class="rep">${C.pagadoFijo.map(g => `<div class="rep-f"><span>${esc(g.cat)}<small class="mat-s" style="display:block;font-weight:600">previsto ${dinero(g.prev)}</small></span><b class="${Number(g.pagado) + 0.005 < Number(g.prev) ? 's-debe' : 's-favor'}">${Number(g.pagado) ? dinero(g.pagado) : 'Sin pagar'}</b></div>`).join('')}
      <div class="rep-f total"><span>Pagado de ${dinero(C.fijosPrev)} previstos</span><b>${dinero(pagF)}</b></div></div>`);
    h += gananciaModelos(acc);
    if(C.porModelo.length) h += acc('prod', 'Lo que dejó cada producto', signo(suma(C.porModelo)), rep(C.porModelo, 'Total después de gastos fijos', suma(C.porModelo)));
    h += acc('ctas', 'Así quedaron las cuentas', dinero(suma(C.cuentas)), rep(C.cuentas.length ? C.cuentas : [['Sin cuentas', 0]], 'En cuentas', suma(C.cuentas)));
    h += acc('provs', 'Así quedaron los proveedores', signo(suma(C.proveedores)), rep(C.proveedores.length ? C.proveedores : [['Sin proveedores', 0]], suma(C.proveedores) < 0 ? 'Les debes en total' : 'A tu favor en total', suma(C.proveedores)));
    if(C.ajustes) h += `<p class="mat-s" style="margin:8px 2px 0">${C.ajustes === 1 ? 'Hubo 1 ajuste de saldo' : 'Hubo ' + C.ajustes + ' ajustes de saldo'} este mes. Están en el historial con su motivo.</p>`;
    const puedeCerrar = !M.cerrado && mesSel < F().mesActual();
    h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" type="button" data-pdf-mes style="flex:1;height:54px">Reporte en PDF</button>${M.cerrado ? '' : `<button class="btn-primary" type="button" data-cerrar-mes style="flex:1.2" ${puedeCerrar ? '' : 'disabled'}>Cerrar el mes</button>`}</div>`;
    return h;
  }
  function despues(){ if(vista === 'cierre' && mesSel && !cache[mesSel]) traer(mesSel); }

  // Todos los meses en una hoja: cada uno con su estado
  function todosLosMeses(){
    $('detTitulo').textContent = 'Todos los meses';
    const ms = meses(), porAno = {};
    ms.forEach(m => (porAno[m.slice(0, 4)] ||= []).push(m));
    $('detBody').innerHTML = Object.entries(porAno).sort((a, b) => b[0] - a[0]).map(([a, L]) => `<div class="tit">${a}</div><div class="rep">${L.map(m => `<button class="rep-f" type="button" data-mes="${m}"><span>${esc(MESES[+m.slice(5) - 1])}</span><b class="${m === mesSel ? 's-favor' : ''}">${cache[m] && cache[m].cerrado ? 'Cerrado' : m === F().mesActual() ? 'En curso' : 'Ver'}</b></button>`).join('')}</div>`).join('');
    $('detFoot').innerHTML = '';
    window.AH.abrirHoja('sheetDet');
  }
  async function pdfMes(){
    const M = cache[mesSel]; if(!M || !M.datos) return;
    const C = M.datos;
    const f = (n, v) => ({ t:'fila', a:n, b:(v < -0.005 ? '- ' : v > 0.005 ? '+ ' : '') + dinero(Math.abs(v)), rojo:v < -0.005 });
    const tot = (n, v) => ({ t:'total', a:n, b:(v < -0.005 ? '- ' : '') + dinero(Math.abs(v)) });
    const ganancia = C.vendido - C.sinCosto - C.costo - C.gastoTot;
    const b = [{ t:'titulo', texto:'Lo que ganaste' }, f('Vendido con costeo', C.vendido - C.sinCosto), f('Costo de lo vendido', -C.costo), f('Gastos, nómina, vales y comisiones', -C.gastoTot), tot(ganancia >= 0 ? 'Ganancia del mes' : 'Pérdida del mes', ganancia)];
    if(C.nSin) b.push({ t:'nota', texto:'Vendido sin costeo: ' + dinero(C.sinCosto) + ' (no entra en la ganancia).' });
    b.push({ t:'titulo', texto:'Dinero que entró y salió' }); C.entro.concat(C.salio).forEach(([n, v]) => b.push(f(n, Number(v)))); b.push(tot('Neto', suma(C.entro) + suma(C.salio)));
    b.push({ t:'titulo', texto:'Compras a proveedores' }); C.compras.forEach(([n, v]) => b.push(f(n, -v))); b.push(tot('Total comprado', -suma(C.compras)));
    b.push({ t:'titulo', texto:'Gastos fijos', der:'previsto / pagado' }); C.pagadoFijo.forEach(g => b.push({ t:'fila', a:g.cat + ' (previsto ' + dinero(g.prev) + ')', b:Number(g.pagado) ? dinero(g.pagado) : 'Sin pagar', rojo:!Number(g.pagado) }));
    if(C.porModelo.length){ b.push({ t:'titulo', texto:'Lo que dejó cada producto' }); C.porModelo.forEach(([n, v]) => b.push(f(n, Number(v)))); }
    b.push({ t:'titulo', texto:'Cuentas al cerrar' }); C.cuentas.forEach(([n, v]) => b.push(f(n, Number(v)))); b.push(tot('En cuentas', suma(C.cuentas)));
    b.push({ t:'titulo', texto:'Proveedores al cerrar' }); C.proveedores.forEach(([n, v]) => b.push(f(n, Number(v))));
    b.push({ t:'nota', texto:'+ entra o es a tu favor · - sale o se debe.' });
    b.push({ t:'firmas', a:'Revisado por Ray', b:'Revisado por Gualfredo' });
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo:'Cierre del mes', derecha:nomMes(mesSel), subtitulo:M.cerrado ? 'Mes cerrado el ' + F().fecha(M.fecha) + '. Números fijos.' : 'Mes sin cerrar: los números pueden cambiar.', bloques:b });
      const r = await window.PDFR.compartir(blob, 'Cierre-' + mesSel + '.pdf'); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }
  async function cerrarMes(){
    if(!confirm('¿Cerrar ' + nomMes(mesSel) + '? Los números quedan fijos. Después solo se corrige con ajustes con motivo.')) return;
    try{ const { error } = await db.rpc('mes_cerrar', { p_mes:mesSel + '-01' }); if(error) throw error; delete cache[mesSel]; delete CD[mesSel]; toast('Mes cerrado. Los números quedaron fijos. Costos ya reparte los gastos fijos con las puertas de este mes.'); F().pintar(); }
    catch(e){ toast(F().errTxt(e), 'error'); }
  }

  // ---------- Reportes por proveedor y por cuenta (fechas: semana, mes, rango) ----------
  let R = { de:'prov', id:null, rango:'mes', desde:'', hasta:'' };
  function rango(){
    const h = F().hoy(), d = new Date(h + 'T12:00:00'), iso = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    if(R.rango === 'semana'){ const l = new Date(d); l.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(l), h]; }
    if(R.rango === 'mes') return [h.slice(0, 8) + '01', h];
    if(R.rango === 'mesant') return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
    return [R.desde || '2020-01-01', R.hasta || h];
  }
  // Un renglón por proveedor o cuenta: saldo al inicio, lo que entró y salió en las fechas, saldo al final
  function filas(){
    const [d0, d1] = rango(), D = F().datos, esProv = R.de === 'prov', campo = esProv ? 'ep' : 'ec';
    const lista = esProv ? D.proveedores : D.cuentas;
    return lista.map(x => {
      const movs = D.movs.filter(m => !m.anulado && String(m[esProv ? 'prov' : 'cuenta']) === String(x.id));
      const ini = movs.filter(m => String(m.fecha) < d0).reduce((a, m) => a + Number(m[campo] || 0), 0);
      const en = movs.filter(m => String(m.fecha) >= d0 && String(m.fecha) <= d1);
      const mas = en.filter(m => Number(m[campo]) > 0).reduce((a, m) => a + Number(m[campo]), 0), menos = en.filter(m => Number(m[campo]) < 0).reduce((a, m) => a + Number(m[campo]), 0);
      const comis = esProv ? 0 : en.reduce((a, m) => a + Math.max(0, Number(m.comision || 0)), 0);
      return { x, ini:F().r2(ini), mas:F().r2(mas), menos:F().r2(menos), fin:F().r2(ini + mas + menos), comis:F().r2(comis), en, d0, d1 };
    }).filter(o => o.en.length || Math.abs(o.ini) > 0.005 || o.x.activo !== false && o.x.activa !== false);
  }
  function reportesHtml(){
    const op = F().opts, [d0, d1] = rango(), esProv = R.de === 'prov';
    $('subtitulo').textContent = 'Reportes por ' + (esProv ? 'proveedor' : 'cuenta');
    let h = `<div class="field"><span class="field-label">Reporte de</span>${op([['prov', 'Proveedores'], ['cuenta', 'Cuentas']], R.de, 'data-fr-de', 2)}</div>
      <div class="field"><span class="field-label">¿De cuándo?</span>${op([['semana', 'Esta semana'], ['mes', 'Este mes'], ['mesant', 'Mes pasado'], ['rango', 'Otras fechas']], R.rango, 'data-fr-rango', 2)}</div>
      ${R.rango === 'rango' ? `<div class="input-row"><div class="field"><label class="field-label" for="frDesde">Desde</label><input class="input" type="date" id="frDesde" value="${esc(R.desde)}"></div><div class="field"><label class="field-label" for="frHasta">Hasta</label><input class="input" type="date" id="frHasta" value="${esc(R.hasta || F().hoy())}"></div></div>` : ''}
      <p class="mat-s" style="margin:0 2px 10px">Del ${F().fecha(d0)} al ${F().fecha(d1)}. Toca uno para ver su detalle y sacar el PDF.</p>`;
    const L = filas();
    if(!L.length) return h + `<p class="mat-s">Todavía no hay ${esProv ? 'proveedores' : 'cuentas'}.</p>`;
    h += `<div class="rep">${L.map(o => `<button class="rep-f" type="button" data-fr-ver="${o.x.id}"><span>${esc(o.x.nombre)}<small class="mat-s" style="display:block;font-weight:600">al inicio ${signo(o.ini)} · ${esProv ? 'pagos' : 'entró'} ${dinero(o.mas)} · ${esProv ? 'compras' : 'salió'} ${dinero(-o.menos)}${o.comis ? ' · comisión ' + dinero(o.comis) : ''}</small></span><b class="${o.fin > 0.005 ? 's-favor' : o.fin < -0.005 ? 's-debe' : ''}">${signo(o.fin)}</b></button>`).join('')}
      <div class="rep-f total"><span>${esProv ? (suma(L.map(o => [0, o.fin])) < 0 ? 'Les debes en total' : 'A tu favor en total') : 'En todas las cuentas'}</span><b>${signo(suma(L.map(o => [0, o.fin])))}</b></div></div>`;
    h += `<button class="btn-secondary" type="button" data-fr-pdf-todos style="width:100%;margin-top:12px">PDF del resumen</button>`;
    const sel = R.id && L.find(o => String(o.x.id) === String(R.id));
    if(sel) h += detalleHtml(sel);
    return h;
  }
  function detalleHtml(o){
    const esProv = R.de === 'prov', campo = esProv ? 'ep' : 'ec', D = F().datos;
    let s = o.ini;
    const comprasProv = esProv ? (D.movs || []).filter(m => m.compra && String(m.prov) === String(o.x.id) && String(m.fecha) >= o.d0 && String(m.fecha) <= o.d1 && !m.anulado) : [];
    return `<div class="tit" id="frDetalle">${esc(o.x.nombre)}</div><div class="rep">
      <div class="rep-f"><span>Saldo al ${F().fecha(o.d0)}</span><b>${signo(o.ini)}</b></div>
      ${o.en.map(m => { s += Number(m[campo] || 0); const otro = esProv ? F().cta(m.cuenta) : F().prov(m.prov);
        return `<div class="rep-f"><span>${F().fecha(m.fecha)} · ${esc(F().nomMov(m))}${m.ref ? ' · ' + esc(m.ref) : ''}<small class="mat-s" style="display:block;font-weight:600">${otro ? esc(otro.nombre) + ' · ' : ''}queda ${signo(s)}${!esProv && Number(m.comision) > 0.005 ? ' · comisión ' + dinero(m.comision) : ''}${m.bs ? ' · ' + esc(F().bsTxt(m.bs)) + ' a ' + esc(m.tasa) : ''}</small></span><b class="${Number(m[campo]) > 0 ? 's-favor' : 's-debe'}">${signo(Number(m[campo] || 0))}</b></div>`; }).join('')}
      <div class="rep-f total"><span>Saldo al ${F().fecha(o.d1)}</span><b>${signo(o.fin)}</b></div></div>
      ${esProv ? `<p class="mat-s" style="margin:6px 2px 0">${comprasProv.length ? (comprasProv.length === 1 ? '1 factura o nota' : comprasProv.length + ' facturas y notas') + ' en estas fechas.' : 'Sin compras en estas fechas.'}</p>` : ''}
      <button class="btn-primary" type="button" data-fr-pdf="${o.x.id}" style="width:100%;margin-top:12px">PDF de ${esc(o.x.nombre)}</button>`;
  }
  async function pdf(lista, titulo, nombre){
    const esProv = R.de === 'prov', campo = esProv ? 'ep' : 'ec', [d0, d1] = rango();
    const f = (n, v) => ({ t:'fila', a:n, b:(v < -0.005 ? '- ' : v > 0.005 ? '+ ' : '') + dinero(Math.abs(v)), rojo:v < -0.005 });
    const b = [];
    lista.forEach(o => {
      b.push({ t:'titulo', texto:o.x.nombre, der:'Monto' });
      let s = o.ini; b.push(f('Saldo al ' + F().fecha(d0), o.ini));
      o.en.forEach(m => { s += Number(m[campo] || 0); const otro = esProv ? F().cta(m.cuenta) : F().prov(m.prov);
        b.push(f(F().fecha(m.fecha) + ' · ' + F().nomMov(m) + (m.ref ? ' · ' + m.ref : '') + (otro ? ' · ' + otro.nombre : '') + (!esProv && Number(m.comision) > 0.005 ? ' · comisión ' + dinero(m.comision) : ''), Number(m[campo] || 0))); });
      b.push({ t:'total', a:'Saldo al ' + F().fecha(d1), b:(o.fin < -0.005 ? '- ' : '') + dinero(Math.abs(o.fin)) });
    });
    b.push({ t:'nota', texto:esProv ? '+ es lo que le pagamos (a nuestro favor) y - lo que le compramos.' : '+ entra a la cuenta y - sale. La comisión y el cambio van aparte en cada renglón.' });
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo, derecha:'Emitido el ' + F().fecha(F().hoy()), subtitulo:'Del ' + F().fecha(d0) + ' al ' + F().fecha(d1), bloques:b });
      const r = await window.PDFR.compartir(blob, nombre); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }

  document.addEventListener('click', (e) => {
    if(!F() || !F().datos) return;
    if(e.target.closest('[data-pdf-gmod]')) return pdfGanancia();
    const v = e.target.closest('[data-fm-vista]'); if(v){ vista = v.dataset.fmVista; F().pintar(); return; }
    const ms = e.target.closest('[data-mes]'); if(ms){ mesSel = ms.dataset.mes; if(ms.closest('#detBody')) window.AH.cerrarHoja('sheetDet', true); F().pintar(); return; }
    const mm = e.target.closest('[data-mes-mov]'); if(mm){ mover(+mm.dataset.mesMov); F().pintar(); return; }
    if(e.target.closest('[data-mes-todos]')){ todosLosMeses(); return; }
    if(e.target.closest('[data-fm-reintentar]')){ delete cache[mesSel]; F().pintar(); return; }
    if(e.target.closest('[data-pdf-mes]')) return pdfMes();
    if(e.target.closest('[data-cerrar-mes]')) return cerrarMes();
    const cp = e.target.closest('[data-cierre-paso]'); if(cp){ if(cp.closest('#detFoot,#detBody')) { PASO = { k:cp.dataset.cierrePaso }; pintarPaso(); } else abrirPaso(cp.dataset.cierrePaso); return; }
    const cpv = e.target.closest('[data-cie-prov]'); if(cpv){ PASO = { k:'prov', id:cpv.dataset.cieProv }; pintarPaso(); return; }
    const cq = e.target.closest('[data-cq-ok]'); if(cq){ const id = cq.dataset.cqOk, v = numIn(($('cq_' + id) || {}).value); if(!isFinite(v)){ toast('Escribe lo que dice el banco', 'error'); return; }
      guardarPaso('cuenta', +id, { saldo:v, motivo:String(($('cm_' + id) || {}).value || '').trim() || null }, 'Cuenta lista'); return; }
    if(e.target.closest('[data-cd-ok]')){ const X = CD[mesSel], conteo = [];
      for(const f of X.deposito.fab){ const v = numIn(($('cd_' + f.id) || {}).value); if(!(v >= 0) || v % 1){ toast('Revisa lo contado de ' + f.nombre, 'error'); return; } conteo.push({ material_id:f.id, contado:v }); }
      guardarPaso('deposito', null, { conteo }, 'Depósito contado. Las diferencias quedaron guardadas.'); return; }
    if(e.target.closest('[data-cpv-ok]')){ const v = numIn(($('cpv') || {}).value), m = String(($('cpvm') || {}).value || '').trim(), p = CD[mesSel].proveedores.find(x => String(x.id) === String(PASO.id));
      if(!isFinite(v)){ toast('Escribe lo que dice el proveedor', 'error'); return; }
      if(Math.abs(v + Number(p.saldo)) > 0.005 && !m){ const c = $('c_cpvm'); if(c) c.classList.add('invalid'); return; }
      guardarPaso('proveedor', p.id, { debo:v, motivo:m || null }, 'Proveedor cuadrado').then(ok => { if(ok){ PASO = { k:'proveedores' }; pintarPaso(); } }); return; }
    const de = e.target.closest('[data-fr-de]'); if(de){ R.de = de.dataset.frDe; R.id = null; F().pintar(); return; }
    const rg = e.target.closest('[data-fr-rango]'); if(rg){ R.rango = rg.dataset.frRango; F().pintar(); return; }
    const vr = e.target.closest('[data-fr-ver]'); if(vr){ R.id = vr.dataset.frVer; F().pintar(); const el = $('frDetalle'); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); return; }
    const pd = e.target.closest('[data-fr-pdf]'); if(pd){ const o = filas().find(x => String(x.x.id) === pd.dataset.frPdf); if(o) pdf([o], R.de === 'prov' ? 'Reporte del proveedor' : 'Reporte de la cuenta', 'Reporte-' + String(o.x.nombre).replace(/[^A-Za-z0-9]+/g, '-') + '.pdf'); return; }
    if(e.target.closest('[data-fr-pdf-todos]')) return pdf(filas(), R.de === 'prov' ? 'Reporte de proveedores' : 'Reporte de cuentas', 'Reporte-' + (R.de === 'prov' ? 'proveedores' : 'cuentas') + '.pdf');
  });
  document.addEventListener('change', (e) => {
    if(e.target.id === 'frDesde'){ R.desde = e.target.value; F().pintar(); }
    if(e.target.id === 'frHasta'){ R.hasta = e.target.value; F().pintar(); }
  });
  if(q.get('reporte') === 'cuenta') R.de = 'cuenta';

  document.addEventListener('input', (e) => {
    if(e.target.id === 'cpv' && PASO && PASO.k === 'prov'){ const p = CD[mesSel].proveedores.find(x => String(x.id) === String(PASO.id)); PASO.v = e.target.value; const d = $('cpvDif'); if(d) d.innerHTML = difTxt(-Number(p.saldo), e.target.value); }
    if(e.target.id === 'cpvm' && PASO) PASO.m = e.target.value;
  });
  window.FinMes = { html, despues };
})();
