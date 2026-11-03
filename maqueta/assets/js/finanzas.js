// MAQUETA: módulo Finanzas (solo admin). Dónde está el dinero, cuentas, pagos por ubicar,
// proveedores como cuenta corriente (transferencias y compras), ajustes con historial,
// estado de cuenta en PDF y gastos del mes. Las reglas de dinero viven en falso.js (el "servidor").
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const X = window.MAQUETA;
  const D = () => X.datos();
  const ancho = window.matchMedia('(min-width:1024px)');
  const TIPO = { hierro:'Hierro', aluminio:'Aluminio', laminas:'Láminas', vidrio:'Vidrio', pintura:'Pintura y masilla', consumibles:'Consumibles', accesorios:'Accesorios', madera:'Madera' };
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>';
  const ini = (t) => String(t).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const fecha = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}/${+m}/${a}`; };
  const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const mesActual = () => hoy().slice(0, 7);
  const prov = (id) => D().proveedores.find(p => p.id === id);
  const cta = (id) => D().cuentas.find(c => c.id === id);
  const num = (v) => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const numLibre = (v) => { const s = String(v || '').trim(); if(/,\d{1,2}$/.test(s)) return num(s); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };

  function saldoTxt(s){
    if(s > 0.005) return { cls:'s-favor', t:'a tu favor', corto:'A tu favor' };
    if(s < -0.005) return { cls:'s-debe', t:'le debes', corto:'Le debes' };
    return { cls:'s-cero', t:'al día', corto:'Al día' };
  }
  const NOMBRE_MOV = { apertura:'Saldo inicial', transferencia:'Transferencia', compra:'Compra', ajuste:'Ajuste de saldo', ubicar:'Pago de cliente', gasto:'Gasto', traspaso:'Movimiento entre cuentas' };

  let tab = new URLSearchParams(location.search).get('tab') || 'dinero';
  let sel = null;   // { t:'prov'|'cuenta', id }
  let F = null;     // formulario abierto

  // ================= Pantalla =================
  function pintar(){
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tabs').querySelector('.seg-fondo').style.transform = `translateX(${['dinero','prov','gastos','mes'].indexOf(tab) * 100}%)`;
    const r = X.resumen();
    const nConf = X.porConfirmar().length;
    $('subtitulo').textContent = nConf ? (nConf === 1 ? '1 pago por confirmar' : nConf + ' pagos por confirmar') : r.porUbicar ? `${dinero(r.porUbicar)} por ubicar` : 'Dónde está tu dinero';
    const grande = ancho.matches;
    $('pieProv').classList.toggle('hidden', grande || tab !== 'prov');
    $('pieGasto').classList.toggle('hidden', grande || tab !== 'gastos');
    if(tab === 'mes'){ $('pieProv').classList.add('hidden'); $('pieGasto').classList.add('hidden'); $('cont').innerHTML = `<div class="mes-wrap">${secMes()}</div>`; return; }
    $('cont').innerHTML = `<div class="fin-grid">
      <div class="fin-col ${tab === 'dinero' ? '' : 'oculta'}"><div class="col-t">Dinero</div>${secDinero()}</div>
      <div class="fin-col ${tab !== 'dinero' ? '' : 'oculta'}">
        <div class="${grande || tab === 'prov' ? '' : 'hidden'}"><div class="col-t">Proveedores</div>${secProveedores()}</div>
        <div class="${grande || tab === 'gastos' ? '' : 'hidden'}" style="${grande ? 'margin-top:24px' : ''}"><div class="col-t">Gastos del mes</div>${secGastos()}</div>
      </div>
      <div class="fin-col" id="panel"></div></div>`;
    if(grande && sel) pintarDetalle();
  }

  // Reporte sencillo: dos columnas, nombre y número (+ entra o es tuyo, − sale o debes)
  const signo = (v) => (v > 0.005 ? '+' : v < -0.005 ? '−' : '') + dinero(Math.abs(v));
  function reporte(filas, totalNombre, total){
    return `<div class="rep">${filas.map(([n, v, attr]) => `<button class="rep-f" type="button" ${attr || ''}><span>${esc(n)}</span><b class="${v > 0.005 ? 's-favor' : v < -0.005 ? 's-debe' : ''}">${signo(v)}</b></button>`).join('')}
      <div class="rep-f total"><span>${esc(totalNombre)}</span><b class="${total < -0.005 ? 's-debe' : ''}">${total < -0.005 ? '−' : ''}${dinero(Math.abs(total))}</b></div></div>`;
  }
  function secDinero(){
    const d = D(), r = X.resumen(), ub = X.porUbicar(), pc = X.porCobrar();
    const pc0 = X.porConfirmar();
    let top = '';
    if(pc0.length) top = `<div class="tit" style="margin-top:0">Pagos por confirmar · ${pc0.length}</div>` + pc0.map(a => `<button class="ub conf" type="button" data-confirmar="${a.id}"><span class="grow"><b>N° ${esc(a.venta_id)} · ${esc(a.cliente)}</b><small>${esc(a.metodo)} · lo registró ${esc(a.registrado_por === 'yulimar' ? 'Yulimar' : a.registrado_por)} · ¿Llegó?</small></span><span class="m">${dinero(a.monto)}</span>${CHEV}</button>`).join('') + '<div style="height:14px"></div>';
    let h = top + `<div class="tit" style="margin-top:4px">Tu dinero hoy</div>` + reporte([
      ['En tus cuentas', r.enCuentas, 'data-ir="cuentas"'],
      ['Pagos por ubicar', r.porUbicar, 'data-ir="ubicar"'],
      ['A tu favor con proveedores', r.aFavor, 'data-ir="prov"'],
      ['Te deben los clientes', r.porCobrar, 'data-ir="cobrar"'],
      ['Le debes a proveedores', -r.debes, 'data-ir="prov"'],
    ], 'Todo lo tuyo', r.total);
    h += secGanancia();
    // Por ubicar
    h += `<div class="tit" id="sec-ubicar">Pagos por ubicar · ${ub.length}</div>`;
    h += ub.length ? ub.map(a => `<button class="ub" type="button" data-ubicar="${a.id}"><span class="grow"><b>N° ${esc(a.venta_id)} · ${esc(a.cliente)}</b><small>${esc(a.metodo)} · confirmado el ${fecha(a.confirmado_en)} · ¿Dónde quedó?</small></span><span class="m">${dinero(a.monto)}</span>${CHEV}</button>`).join('')
      : '<p class="mat-s" style="margin:0 2px">Todo ubicado. Cuando Ray confirma un pago en Ventas, aparece aquí para decir dónde quedó.</p>';
    // Cuentas
    h += `<div class="tit" id="sec-cuentas" style="display:flex;justify-content:space-between;align-items:baseline">Cuentas <button type="button" class="link-btn" data-traspaso style="font-size:13px;font-weight:800;color:var(--accent)">Mover entre cuentas</button></div><div class="mat-lista ya">`;
    h += d.cuentas.map(c => { const s = X.saldoCuenta(c.id), bs = c.moneda === 'VES' ? X.saldoBs(c.id) : null;
      return `<button class="mat" type="button" data-cuenta="${esc(c.id)}"><span class="mat-ico">${esc(ini(c.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(c.nombre)}</span><span class="mat-s">${esc(c.tipo)}${bs != null ? ' · ' + bs.toLocaleString('es-VE') + ' Bs' : ''}</span></span>
        <span class="mat-n"><b style="font-size:19px">${dinero(s)}</b><span>${bs != null ? 'en dólares' : 'saldo'}</span></span></button>`; }).join('') + '</div>';
    // Por cobrar
    h += `<div class="tit" id="sec-cobrar">Te deben los clientes</div>`;
    h += pc.length ? pc.map(v => `<div class="cg-fila"><div class="cg-nom">N° ${v.id} · ${esc(v.cliente)}<span>${v.estado === 'confirmada' ? 'Confirmada' : v.estado === 'en_produccion' ? 'En fabricación' : 'Lista'} · total ${dinero(v.total)} · pagado ${dinero(v.pagado)}</span></div><div style="text-align:right;font-weight:800">${dinero(v.resta)}</div></div>`).join('')
      : '<p class="mat-s" style="margin:0 2px">Nadie debe nada.</p>';
    return h;
  }

  function secGanancia(){
    const d = D(), mes = mesActual();
    const filas = d.ventas.filter(v => v.estado !== 'cotizacion' && v.estado !== 'cancelada' && String(v.confirmada_en || '').slice(0, 7) === mes).map(v => {
      let costo = 0, sin = [];
      v.items.forEach(it => { const c = X.costear(it.catalogo_id); if(c && !c.falta.length) costo += c.costo * it.cantidad; else sin.push(it.nombre); });
      return { v, costo, sin, gana: sin.length ? null : v.total - costo };
    });
    const vendido = filas.reduce((a, f) => a + f.v.total, 0);
    const ganado = filas.filter(f => f.gana != null).reduce((a, f) => a + f.gana, 0);
    const gastos = -X.datos().movs.filter(m => m.tipo === 'gasto' && !m.anulado && String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + m.ec, 0);
    const costoV = filas.filter(f => f.gana != null).reduce((a, f) => a + f.costo, 0), sinCosto = filas.filter(f => f.gana == null);
    const vendidoC = filas.filter(f => f.gana != null).reduce((a, f) => a + f.v.total, 0);
    return `<div class="tit">Lo que ganas este mes</div>` + reporte([
        ['Vendido (modelos costeados)', vendidoC],
        ['Costo de lo vendido', -costoV],
        ['Gastos del mes pagados', -gastos],
      ], 'Te queda', vendidoC - costoV - gastos)
      + (sinCosto.length ? `<p class="mat-s" style="margin:6px 2px 0">No entran porque su modelo no tiene costo: ${sinCosto.map(f => 'N° ' + f.v.id).join(', ')} (${dinero(sinCosto.reduce((a, f) => a + f.v.total, 0))}). Cóstealos en Costos.</p>` : '')
      + '<p class="mat-s" style="margin:6px 2px 0">El costo sale de Costos (materiales y mano de obra). Toca un renglón de arriba para ver el detalle.</p>';
  }

  function secProveedores(){
    const d = D();
    const lista = d.proveedores.map(p => ({ p, s:X.saldoProv(p.id), ult:X.movsProv(p.id).filter(m => !m.anulado && m.tipo !== 'apertura').pop() }))
      .sort((a, b) => (a.s < 0 ? 0 : a.s > 0 ? 1 : 2) - (b.s < 0 ? 0 : b.s > 0 ? 1 : 2) || a.s - b.s);
    const debes = -lista.filter(x => x.s < 0).reduce((a, x) => a + x.s, 0), favor = lista.filter(x => x.s > 0).reduce((a, x) => a + x.s, 0);
    let h = `<div class="res"><div class="res-c ${debes ? 'rojo' : ''}"><span>Les debes</span><b>${dinero(debes)}</b></div><div class="res-c ok"><span>A tu favor</span><b>${dinero(favor)}</b></div></div><div class="mat-lista ya">`;
    h += lista.map(({ p, s, ult }) => { const st = saldoTxt(s);
      return `<button class="mat" type="button" data-prov="${esc(p.id)}"><span class="mat-ico">${esc(ini(p.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">${ult ? esc(NOMBRE_MOV[ult.tipo] + ' · ' + (ult.ref || '') + ' · ' + fecha(ult.fecha)) : 'Sin movimientos'} · ${p.iva ? 'con IVA' : 'sin IVA'}</span></span>
        <span class="mat-n"><b class="${st.cls}" style="font-size:19px">${dinero(Math.abs(s))}</b><span>${st.t}</span></span></button>`; }).join('');
    h += '</div>';
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-nuevo-prov>+ Agregar proveedor</button>';
    return h;
  }

  function secGastos(){
    const d = D(), mes = mesActual();
    const pagos = d.movs.filter(m => m.tipo === 'gasto' && !m.anulado && String(m.fecha).slice(0, 7) === mes);
    const porCat = (cat) => -pagos.filter(m => m.cat === cat).reduce((a, m) => a + m.ec, 0);
    const fijos = d.gastosFijos.reduce((a, g) => a + g.monto, 0), pagado = -pagos.reduce((a, m) => a + m.ec, 0);
    let h = `<div class="res"><div class="res-c"><span>Pagado este mes</span><b>${dinero(pagado)}</b></div><div class="res-c"><span>Gastos fijos previstos</span><b>${dinero(fijos)}</b></div></div>`;
    h += d.gastosFijos.map(g => { const p = porCat(g.cat);
      return `<div class="gasto"><div class="cg-nom">${esc(g.cat)}<span>Previsto ${dinero(g.monto)}</span></div><div style="font-weight:800">${p ? dinero(p) : ''}</div>${p >= g.monto - 0.005 ? '<span class="pill verde">Pagado</span>' : `<button class="pill amar" type="button" data-gasto-cat="${esc(g.cat)}">Falta</button>`}</div>`; }).join('');
    const otros = pagos.filter(m => !d.gastosFijos.some(g => g.cat === m.cat));
    if(otros.length) h += '<div class="tit">Otros gastos</div>' + otros.map(m => `<div class="gasto"><div class="cg-nom">${esc(m.cat)}<span>${esc(cta(m.cuenta).nombre)} · ${fecha(m.fecha)}</span></div><div style="font-weight:800">${dinero(-m.ec)}</div><span></span></div>`).join('');
    h += `<div class="caja-nota"><span>Conexión con Costos</span>Costos reparte ${dinero(d.reglas.gastosMes)} al mes entre ${d.reglas.puertasMes} puertas (${dinero(d.reglas.gastosMes / d.reglas.puertasMes)} por puerta). Con los gastos reales de cada mes, Ray puede ajustar esa regla.</div>`;
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-nuevo-gasto>+ Registrar gasto</button>';
    return h;
  }

  // ================= Detalle (hoja en el teléfono, panel al lado en computadora) =================
  function abrirDetalle(t, id){ sel = { t, id }; pintarDetalle(); if(!ancho.matches) abrirHoja('sheetDet'); }
  function pintarDetalle(){
    if(!sel) return;
    const { titulo, body, foot } = sel.t === 'prov' ? fichaProv(sel.id) : fichaCuenta(sel.id);
    if(ancho.matches){ $('panel').innerHTML = `<h2 style="margin:0 0 12px;font-size:20px">${esc(titulo)}</h2>${body}<div class="pie-dos2" style="margin-top:16px">${foot}</div>`; }
    else { $('detTitulo').textContent = titulo; $('detBody').innerHTML = body; $('detFoot').innerHTML = `<div class="pie-dos2" style="margin:0">${foot}</div>`; }
  }
  function libretaHtml(lista, campo){
    if(!lista.length) return '<p class="mat-s" style="margin:0 2px">Sin movimientos.</p>';
    return lista.slice().reverse().map(m => { const v = m[campo] || 0;
      return `<button class="lib ${m.anulado ? 'anulado' : ''}" type="button" data-mov="${m.id}">
        <span class="lib-t">${esc(NOMBRE_MOV[m.tipo] || m.tipo)}${m.ref ? ' · ' + esc(m.ref) : ''}</span>
        <span class="lib-m" style="color:${m.anulado ? '' : v > 0 ? 'var(--accent)' : v < 0 ? '#B42318' : 'var(--ink-soft)'}">${v > 0 ? '+' : v < 0 ? '−' : ''}${dinero(Math.abs(v))}</span>
        <span class="lib-s">${fecha(m.fecha)}${m.cuenta && campo === 'ep' ? ' · ' + esc(cta(m.cuenta).nombre) : ''}${m.prov && campo === 'ec' ? ' · ' + esc(prov(m.prov).nombre) : ''}${m.bs ? ' · ' + m.bs.toLocaleString('es-VE') + ' Bs a ' + m.tasa : ''}${m.anulado ? ' · anulado: ' + esc(m.anulado.motivo) : ''}</span>
        <span class="lib-c">queda ${dinero(m.saldo)}</span></button>`; }).join('');
  }
  function fichaProv(id){
    const p = prov(id), s = X.saldoProv(id), st = saldoTxt(s), movs = X.movsProv(id), d = D();
    const facturas = d.facturas.filter(f => f.prov === id);
    const mats = d.fab.filter(f => f.precios[id]);
    const ajustes = movs.filter(m => m.tipo === 'ajuste' || m.tipo === 'apertura');
    const body = `<div class="grande ${s > 0.005 ? 'favor' : s < -0.005 ? 'debe' : ''}"><span>${st.corto}</span><b>${dinero(Math.abs(s))}</b>
        <p>${s > 0.005 ? 'Le transferiste de más. Se descuenta solo en la próxima compra.' : s < -0.005 ? 'Compraste más de lo que le has transferido.' : 'No le debes nada y no tienes saldo a favor.'}</p></div>
      <div class="d-datos">
        <div class="d-dato"><span>RIF</span><b>${esc(p.rif || 'Sin RIF')}</b></div>
        <div class="d-dato"><span>IVA</span><b>${p.iva ? 'Cobra IVA (factura)' : 'Sin IVA (nota)'}</b></div>
        <div class="d-dato" style="grid-column:1/-1"><span>Vende</span><b style="white-space:normal">${p.tipos.map(t => esc(TIPO[t])).join(', ')}</b></div>
        ${p.cuadre ? `<div class="d-dato" style="grid-column:1/-1"><span>Último cuadre</span><b>${fecha(p.cuadre.fecha)} · saldo ${dinero(p.cuadre.saldo)}</b></div>` : ''}
      </div>
      <div class="pie-dos" style="margin-top:10px"><button class="btn-secondary" type="button" data-ajustar-prov="${esc(id)}">Cambiar saldo</button><button class="btn-secondary" type="button" data-editar-prov="${esc(id)}">Editar</button></div>
      <div class="tit">Movimientos (el más nuevo arriba)</div>${libretaHtml(movs, 'ep')}
      <div class="tit">Facturas y notas</div>
      ${facturas.length ? facturas.map(f => `<div class="cg-fila"><div class="cg-nom">${f.doc === 'factura' ? 'Factura' : 'Nota de entrega'} ${esc(f.numero)}<span>${fecha(f.fecha)} · ${f.iva ? 'con IVA ' + dinero(f.iva) : 'sin IVA'}${f.foto ? ' · con foto' : ''}</span></div><div style="text-align:right;font-weight:800">${dinero(f.total)}</div></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin compras registradas.</p>'}
      <div class="tit">Lo que te vende (precio sin IVA)</div>
      ${mats.length ? mats.map(f => `<div class="cg-fila"><div class="cg-nom">${esc(f.nombre)}<span>${esc(TIPO[f.tipo])}${f.precios[id].esp ? ' · ' + esc(f.precios[id].esp) : ''}</span></div><div style="text-align:right;font-weight:800">${dinero(f.precios[id].p)}</div></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Todavía no hay precios de este proveedor.</p>'}
      <div class="tit">Historial de saldos que cambió Ray</div>
      ${ajustes.map(m => `<div class="cg-fila"><div class="cg-nom">${esc(NOMBRE_MOV[m.tipo])} · ${fecha(m.fecha)}<span>${esc(m.nota || '')} · ${esc(m.por)}</span></div><div style="text-align:right;font-weight:800">${(m.ep || 0) >= 0 ? '+' : '−'}${dinero(Math.abs(m.ep || 0))}</div></div>`).join('')}
      <button class="btn-nuevo" type="button" data-cuadrar="${esc(id)}">Cuadrar con el proveedor</button>`;
    const foot = `<button class="btn-secondary" type="button" data-pdf="${esc(id)}" style="height:54px">Estado de cuenta</button><button class="btn-primary" type="button" data-transferir="${esc(id)}">Le transferí</button>`;
    return { titulo:p.nombre, body, foot };
  }
  function fichaCuenta(id){
    const c = cta(id), s = X.saldoCuenta(id), movs = X.movsCuenta(id);
    const body = `<div class="grande"><span>${esc(c.tipo)}</span><b>${dinero(s)}</b>${c.moneda === 'VES' ? `<p>${X.saldoBs(id).toLocaleString('es-VE')} Bs</p>` : ''}</div>
      <div class="tit">Movimientos (el más nuevo arriba)</div>${libretaHtml(movs, 'ec')}`;
    const foot = `<button class="btn-secondary" type="button" data-ajustar-cuenta="${esc(id)}" style="height:54px">Cambiar saldo</button><button class="btn-primary" type="button" data-traspaso="${esc(id)}">Mover a otra cuenta</button>`;
    return { titulo:c.nombre, body, foot };
  }

  // ================= Formularios =================
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  function abrirForm(f){ F = f; pintarForm(); abrirHoja('sheetForm'); }
  function pintarForm(){
    const d = D(); let h = '', boton = 'Guardar';
    if(F.t === 'transferencia'){
      const p = prov(F.prov), antes = X.saldoProv(F.prov), m = numLibre(F.monto) || 0, desp = antes + m;
      const c = F.cuenta ? cta(F.cuenta) : null;
      $('formTitulo').textContent = 'Transferencia a ' + p.nombre.replace('Inversiones ', '');
      h = `<div class="field"><label class="field-label" for="fMonto">Monto en dólares</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fMonto" inputmode="decimal" value="${esc(F.monto || '')}"></div><div class="field-error">Escribe el monto</div></div>
        <div class="field"><span class="field-label">¿De qué cuenta sale?</span>${opts(d.cuentas.map(x => [x.id, `${esc(x.nombre)}<br><small style="font-weight:600">${dinero(X.saldoCuenta(x.id))}</small>`]), F.cuenta, 'data-f-cuenta')}</div>
        ${c && c.moneda === 'VES' ? `<div class="input-row"><div class="field"><label class="field-label" for="fBs">Monto en Bs</label><input class="input" id="fBs" inputmode="decimal" value="${esc(F.bs || '')}"></div><div class="field"><label class="field-label" for="fTasa">Tasa del día</label><input class="input" id="fTasa" inputmode="decimal" value="${esc(F.tasa || '')}"></div></div><div class="field-hint" style="margin:-8px 2px 12px">Los dólares salen de Bs ÷ tasa.</div>` : ''}
        <div class="input-row"><div class="field"><label class="field-label" for="fRef">Referencia</label><input class="input" id="fRef" value="${esc(F.ref || '')}"></div><div class="field"><label class="field-label" for="fFecha">Fecha</label><input class="input" id="fFecha" type="date" value="${esc(F.fecha || hoy())}"></div></div>
        <div class="field"><span class="field-label">Comprobante</span><button class="btn-secondary" type="button" style="width:100%" data-maq-msg="En la maqueta no se sube la foto">Agregar foto del comprobante</button></div>
        <div class="caja-nota"><span>Saldo con ${esc(p.nombre)}</span>${saldoTxt(antes).corto} ${dinero(Math.abs(antes))} → después de esta transferencia: <b>${saldoTxt(desp).corto.toLowerCase()} ${dinero(Math.abs(desp))}</b></div>`;
      boton = 'Guardar transferencia';
    }
    if(F.t === 'ubicar'){
      const a = X.porUbicar().find(x => x.id === F.abono);
      const metodo = a.metodo === 'Bolívares' ? 'Bolívares' : a.metodo;
      $('formTitulo').textContent = '¿Dónde quedó este pago?';
      h = `<div class="conf-total" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:var(--ink-soft)">N° ${a.venta_id} · ${esc(a.cliente)} · ${esc(a.metodo)}</span><b style="font-size:24px">${dinero(a.monto)}</b></div>
        <div class="field"><span class="field-label">Este dinero quedó…</span>${opts([['cuenta', 'En mi cuenta'], ['prov', 'Con un proveedor']], F.destino, 'data-f-destino')}</div>
        ${F.destino === 'cuenta' ? `<div class="field"><span class="field-label">¿En cuál cuenta?</span>${opts(d.cuentas.filter(c => c.tipo === metodo || (metodo === 'Efectivo' && c.tipo === 'Efectivo')).concat(d.cuentas.filter(c => c.tipo !== metodo)).map(c => [c.id, esc(c.nombre)]), F.cuenta, 'data-f-cuenta')}<div class="field-hint">Primero salen las cuentas ${esc(a.metodo)}.</div></div>` : ''}
        ${F.destino === 'prov' ? `<div class="field"><span class="field-label">¿A cuál proveedor?</span>${opts(d.proveedores.map(p => [p.id, esc(p.nombre)]), F.prov, 'data-f-prov', 1)}<div class="field-hint">Queda a tu favor con ese proveedor y se descuenta de su próxima compra.</div></div>` : ''}`;
      boton = 'Guardar';
    }
    if(F.t === 'confirmar'){
      const a = X.porConfirmar().find(x => x.id === F.abono);
      $('formTitulo').textContent = '¿Llegó este pago?';
      h = `<div class="conf-total" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:var(--ink-soft)">N° ${a.venta_id} · ${esc(a.cliente)} · ${esc(a.metodo)}</span><b style="font-size:24px">${dinero(a.monto)}</b></div>
        <div class="comp"><img src="assets/img/foto-puerta.png" alt="Comprobante"><span>Comprobante que subió la vendedora<br><small>Venta de ${dinero(a.total)} · pagado antes ${dinero(a.pagado)}</small></span></div>
        <div class="field" style="margin-top:12px"><span class="field-label">¿Llegó a tu cuenta?</span>${opts([['si', 'Sí llegó'], ['no', 'No llegó']], F.llego, 'data-f-llego')}</div>
        ${F.llego === 'si' ? `<div class="field"><span class="field-label">¿Dónde quedó?</span>${opts([['cuenta', 'Mi cuenta'], ['prov', 'Proveedor'], ['luego', 'Después']], F.destino, 'data-f-destino', 3)}</div>
          ${F.destino === 'cuenta' ? `<div class="field"><span class="field-label">¿En cuál cuenta?</span>${opts(d.cuentas.filter(c => c.tipo === a.metodo).concat(d.cuentas.filter(c => c.tipo !== a.metodo)).map(c => [c.id, esc(c.nombre)]), F.cuenta, 'data-f-cuenta')}</div>` : ''}
          ${F.destino === 'prov' ? `<div class="field"><span class="field-label">¿A cuál proveedor?</span>${opts(d.proveedores.map(p => [p.id, esc(p.nombre)]), F.prov, 'data-f-prov', 1)}<div class="field-hint">Queda a tu favor con ese proveedor.</div></div>` : ''}
          ${F.destino === 'luego' ? '<div class="field-hint" style="margin:-6px 2px 10px">Queda en "Pagos por ubicar" con su aviso en Inicio.</div>' : ''}
          ${a.estadoVenta === 'confirmada' && a.pagado + a.monto >= a.total * 0.5 - 0.005 ? '<div class="caja-ok" style="margin-top:4px">Con este pago llega al 50 %: el pedido pasa solo a producción, como hoy.</div>' : ''}` : ''}
        ${F.llego === 'no' ? `<div class="field" id="campoMotivo"><label class="field-label" for="fMotivo">¿Qué pasó?</label><input class="input" id="fMotivo" value="${esc(F.motivo || '')}"><div class="field-error">Escribe qué pasó</div><div class="field-hint">La vendedora ve el aviso "El pago no llegó", como hoy.</div></div>` : ''}`;
      boton = F.llego === 'no' ? 'Marcar que no llegó' : 'Confirmar pago';
    }
    if(F.t === 'ajuste'){
      const actual = F.cuenta ? X.saldoCuenta(F.cuenta) : X.saldoProv(F.prov);
      const nombre = F.cuenta ? cta(F.cuenta).nombre : prov(F.prov).nombre;
      $('formTitulo').textContent = 'Cambiar saldo';
      h = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${esc(nombre)}. Hoy la app dice <b>${F.prov ? saldoTxt(actual).corto.toLowerCase() + ' ' + dinero(Math.abs(actual)) : dinero(actual)}</b>. Escribe el saldo real. El cambio queda en el historial con tu nombre y el motivo.</p>
        ${F.prov ? `<div class="field"><span class="field-label">El saldo real es…</span>${opts([['favor', 'A tu favor'], ['debe', 'Le debes'], ['cero', 'Al día']], F.signo, 'data-f-signo', 3)}</div>` : ''}
        ${F.signo !== 'cero' ? `<div class="field"><label class="field-label" for="fNuevo">Monto</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fNuevo" inputmode="decimal" value="${esc(F.nuevo || '')}"></div></div>` : ''}
        <div class="field" id="campoMotivo"><label class="field-label" for="fMotivo">Motivo</label><input class="input" id="fMotivo" value="${esc(F.motivo || '')}"><div class="field-error">Escribe por qué cambias el saldo</div><div class="field-hint">Ejemplo: saldo inicial, cuadre con el proveedor, error al registrar.</div></div>`;
      boton = 'Guardar saldo';
    }
    if(F.t === 'proveedor'){
      $('formTitulo').textContent = F.id ? 'Editar proveedor' : 'Proveedor nuevo';
      h = `<div class="field" id="campoNom"><label class="field-label" for="fNom">Nombre</label><input class="input" id="fNom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div></div>
        <div class="input-row"><div class="field"><label class="field-label" for="fRif">RIF</label><input class="input" id="fRif" value="${esc(F.rif || '')}"></div><div class="field"><label class="field-label" for="fTel">Teléfono</label><input class="input" id="fTel" inputmode="tel" value="${esc(F.telefono || '')}"></div></div>
        <div class="field"><span class="field-label">¿Cobra IVA?</span>${opts([['si', 'Sí, da factura'], ['no', 'No, da nota']], F.iva ? 'si' : 'no', 'data-f-iva')}<div class="field-hint">La compra lo trae marcado, pero se puede cambiar en cada factura.</div></div>
        <div class="field" id="campoTipos"><span class="field-label">¿Qué tipos de material vende?</span><div class="toggles">${Object.entries(TIPO).map(([k, t]) => `<button type="button" class="tchip ${F.tipos.includes(k) ? 'on' : ''}" data-f-tipo="${k}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg></span>${t}</button>`).join('')}</div>
          <div class="field-error">Elige al menos uno</div><div class="field-hint">Al registrar una compra o un precio de este proveedor, solo salen esos tipos.</div></div>`;
      boton = 'Guardar proveedor';
    }
    if(F.t === 'gasto'){
      $('formTitulo').textContent = 'Registrar gasto';
      h = `<div class="field"><span class="field-label">¿Qué gasto es?</span>${opts(d.gastosFijos.map(g => [g.cat, esc(g.cat)]).concat([['Otro', 'Otro']]), F.cat, 'data-f-cat')}</div>
        ${F.cat === 'Otro' ? `<div class="field"><label class="field-label" for="fCatOtro">Nombre del gasto</label><input class="input" id="fCatOtro" value="${esc(F.catOtro || '')}"></div>` : ''}
        <div class="field"><label class="field-label" for="fMonto">Monto en dólares</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fMonto" inputmode="decimal" value="${esc(F.monto || '')}"></div></div>
        <div class="field"><span class="field-label">¿De qué cuenta sale?</span>${opts(d.cuentas.map(x => [x.id, esc(x.nombre)]), F.cuenta, 'data-f-cuenta')}</div>`;
      boton = 'Guardar gasto';
    }
    if(F.t === 'traspaso'){
      $('formTitulo').textContent = 'Mover entre cuentas';
      h = `<div class="field"><span class="field-label">Sale de</span>${opts(d.cuentas.map(x => [x.id, esc(x.nombre)]), F.de, 'data-f-de')}</div>
        <div class="field"><span class="field-label">Entra en</span>${opts(d.cuentas.filter(x => x.id !== F.de).map(x => [x.id, esc(x.nombre)]), F.a, 'data-f-a')}</div>
        <div class="field"><label class="field-label" for="fMonto">Monto en dólares</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fMonto" inputmode="decimal" value="${esc(F.monto || '')}"></div></div>
        <div class="field-hint">No es gasto ni ingreso: solo cambia dónde está el dinero.</div>`;
      boton = 'Mover';
    }
    if(F.t === 'mov'){
      const m = D().movs.find(x => x.id === F.id);
      $('formTitulo').textContent = NOMBRE_MOV[m.tipo] || 'Movimiento';
      h = `<div class="d-datos"><div class="d-dato"><span>Fecha</span><b>${fecha(m.fecha)}</b></div><div class="d-dato"><span>Registró</span><b>${esc(m.por)}</b></div>
        ${m.cuenta ? `<div class="d-dato"><span>Cuenta</span><b>${esc(cta(m.cuenta).nombre)}</b></div>` : ''}${m.prov ? `<div class="d-dato"><span>Proveedor</span><b>${esc(prov(m.prov).nombre)}</b></div>` : ''}
        <div class="d-dato" style="grid-column:1/-1"><span>Detalle</span><b style="white-space:normal">${esc([m.ref, m.nota].filter(Boolean).join(' · ') || 'Sin detalle')}</b></div></div>
        ${m.anulado ? `<div class="caja-rara">Anulado el ${fecha(m.anulado.fecha)} por ${esc(m.anulado.por)}: ${esc(m.anulado.motivo)}</div>` : m.tipo === 'apertura' ? '<p class="mat-s" style="margin:12px 2px 0">El saldo inicial se cambia con "Cambiar saldo".</p>' :
        `<div class="field" id="campoMotivo" style="margin-top:14px"><label class="field-label" for="fMotivo">Si está mal, anúlalo con un motivo</label><input class="input" id="fMotivo" value=""><div class="field-error">Escribe el motivo</div><div class="field-hint">No se borra: queda tachado en la lista y el saldo se corrige.</div></div>`}`;
      boton = m.anulado || m.tipo === 'apertura' ? 'Listo' : 'Anular movimiento';
    }
    $('formBody').innerHTML = h; $('btnForm').textContent = boton;
  }
  function leerCampos(){ ['fMonto','fBs','fTasa','fRef','fFecha','fNuevo','fMotivo','fNom','fRif','fTel','fCatOtro'].forEach(id => { const el = $(id); if(el) F[{fMonto:'monto',fBs:'bs',fTasa:'tasa',fRef:'ref',fFecha:'fecha',fNuevo:'nuevo',fMotivo:'motivo',fNom:'nombre',fRif:'rif',fTel:'telefono',fCatOtro:'catOtro'}[id]] = el.value; }); }
  function guardarForm(){
    leerCampos();
    const err = (msg) => { toast(msg, 'error'); return false; };
    if(F.t === 'transferencia'){
      const c = F.cuenta && cta(F.cuenta); let monto = numLibre(F.monto);
      if(c && c.moneda === 'VES'){ const bs = numLibre(F.bs), t = numLibre(F.tasa); if(bs > 0 && t > 0) monto = X.r2(bs / t); }
      if(!(monto > 0)) return err('Escribe el monto');
      if(!F.cuenta) return err('Elige de qué cuenta sale');
      X.transferir({ prov:F.prov, cuenta:F.cuenta, monto, bs:numLibre(F.bs) || null, tasa:numLibre(F.tasa) || null, ref:F.ref || null, fecha:F.fecha });
      const s = X.saldoProv(F.prov); toast(`Transferencia guardada. ${saldoTxt(s).corto}: ${dinero(Math.abs(s))}`);
    }
    if(F.t === 'confirmar'){
      if(!F.llego) return err('Dime si llegó');
      if(F.llego === 'no'){ if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; } X.confirmar({ aid:F.abono, llego:false, nota:F.motivo.trim() }); toast('Marcado: el pago no llegó. La vendedora recibe el aviso.'); }
      else {
        if(!F.destino) return err('Elige dónde quedó');
        if(F.destino === 'cuenta' && !F.cuenta) return err('Elige la cuenta');
        if(F.destino === 'prov' && !F.prov) return err('Elige el proveedor');
        const r = X.confirmar({ aid:F.abono, llego:true, destino:F.destino === 'luego' ? null : F.destino === 'prov' ? 'proveedor' : 'cuenta', cuenta:F.cuenta, prov:F.prov });
        toast('Pago confirmado' + (r.produccion ? '. El pedido pasó a producción.' : '.') + (F.destino === 'luego' ? ' Queda por ubicar.' : ''));
      }
    }
    if(F.t === 'ubicar'){
      if(!F.destino) return err('Elige dónde quedó');
      if(F.destino === 'cuenta' && !F.cuenta) return err('Elige la cuenta');
      if(F.destino === 'prov' && !F.prov) return err('Elige el proveedor');
      X.ubicar(F.abono, { destino:F.destino === 'prov' ? 'proveedor' : 'cuenta', cuenta:F.cuenta, prov:F.prov });
      toast(F.destino === 'prov' ? 'Listo: quedó a tu favor con ' + prov(F.prov).nombre : 'Listo: quedó en ' + cta(F.cuenta).nombre);
    }
    if(F.t === 'ajuste'){
      if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; }
      let n = F.signo === 'cero' ? 0 : numLibre(F.nuevo);
      if(!(n >= 0)) return err('Escribe el monto');
      if(F.prov && F.signo === 'debe') n = -n;
      const dif = X.ajustar({ cuenta:F.cuenta, prov:F.prov, nuevo:n, motivo:F.motivo });
      toast(dif ? 'Saldo cambiado. Quedó en el historial.' : 'El saldo ya era ese');
    }
    if(F.t === 'proveedor'){
      if(!String(F.nombre || '').trim()){ $('campoNom').classList.add('invalid'); return false; }
      if(!F.tipos.length){ $('campoTipos').classList.add('invalid'); return false; }
      const p = X.proveedorGuardar({ id:F.id, nombre:F.nombre.trim(), rif:F.rif || '', telefono:F.telefono || '', iva:!!F.iva, tipos:F.tipos.slice(), principal:false });
      toast(F.id ? 'Proveedor guardado' : 'Proveedor agregado. Ponle su saldo inicial con "Cambiar saldo".');
      if(!F.id){ cerrarHoja('sheetForm', true); F = null; pintar(); abrirDetalle('prov', p.id); return true; }
    }
    if(F.t === 'gasto'){
      const monto = numLibre(F.monto); const cat = F.cat === 'Otro' ? (F.catOtro || '').trim() : F.cat;
      if(!cat) return err('Elige qué gasto es'); if(!(monto > 0)) return err('Escribe el monto'); if(!F.cuenta) return err('Elige la cuenta');
      X.gasto({ cat, monto, cuenta:F.cuenta }); toast('Gasto guardado');
    }
    if(F.t === 'traspaso'){
      const monto = numLibre(F.monto);
      if(!F.de || !F.a) return err('Elige las dos cuentas'); if(!(monto > 0)) return err('Escribe el monto');
      X.traspaso({ de:F.de, a:F.a, monto }); toast('Listo: se movió ' + dinero(monto));
    }
    if(F.t === 'mov'){
      const m = D().movs.find(x => x.id === F.id);
      if(!m.anulado && m.tipo !== 'apertura'){
        if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; }
        X.anular(m.id, F.motivo.trim()); toast('Movimiento anulado. El saldo se corrigió.');
      }
    }
    cerrarHoja('sheetForm', true); F = null; pintar(); pintarDetalle();
    return true;
  }

  // ================= Estado de cuenta =================
  function abrirPdf(id){
    const p = prov(id), movs = X.movsProv(id).filter(m => !m.anulado), s = X.saldoProv(id), d = new Date();
    $('pdfBody').innerHTML = `<div class="pdf">
      <div class="pdf-h"><img src="assets/img/logo.png" alt=""><span><b style="color:#1C1A17;font-size:13px">Herrería Artesanos</b><br>Maracaibo</span><div><b>Estado de cuenta</b><span>Emitido el ${d.toLocaleDateString('es-VE')}</span></div></div>
      <div class="pdf-banda">${esc(p.nombre)}${p.rif ? ' · RIF ' + esc(p.rif) : ''}</div>
      <div class="tw"><table><thead><tr><th>Movimiento</th><th class="r">Monto</th></tr></thead><tbody>
      ${movs.map(m => `<tr><td>${esc(NOMBRE_MOV[m.tipo])}${m.ref ? ' · ' + esc(m.ref) : ''}<br><span style="color:#6E6A64">${fecha(m.fecha)}${m.cuenta ? ' · ' + esc(cta(m.cuenta).nombre) : ''}${m.bs ? ' · ' + m.bs.toLocaleString('es-VE') + ' Bs a ' + m.tasa : ''}</span></td><td class="r" style="font-weight:700;color:${m.ep > 0 ? '#17555C' : m.ep < 0 ? '#B42318' : '#6E6A64'}">${signo(m.ep || 0)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="pdf-caja"><span>${s > 0.005 ? 'Saldo a favor de Herrería Artesanos' : s < -0.005 ? 'Herrería Artesanos debe' : 'Saldo'}</span><b>${dinero(Math.abs(s))}</b></div>
      <div class="pdf-firmas"><div>Herrería Artesanos</div><div>${esc(p.nombre)}<br>Cuadrado el ___/___/______</div></div></div>
      <p class="mat-s" style="margin:10px 2px 0">+ es lo que le pagamos (suma a nuestro favor) y − lo que le compramos. Así se ve el PDF. En la app real sale con el mismo diseño del PDF de la venta y se comparte por WhatsApp.</p>`;
    abrirHoja('sheetPdf');
  }

  // ================= Mes: cierre completo y reporte mensual =================
  // Junta todo lo del mes en reportes de dos columnas: lo que entró y salió, la ganancia,
  // las compras, los gastos, lo que dejó cada producto y cómo quedaron cuentas y proveedores.
  // "Cerrar el mes" congela los números; después se corrige solo con ajustes que llevan motivo.
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const nomMes = (m) => { const [a, n] = m.split('-'); return MESES[+n - 1] + ' ' + a; };
  let mesSel = new URLSearchParams(location.search).get('mes') || mesActual();
  const enMes = (f, m) => String(f || '').slice(0, 7) === m;
  function calcMes(m){
    const d = D(), r2 = X.r2;
    // Entró: pagos de clientes confirmados, por forma de pago
    const porMetodo = {};
    d.ventas.forEach(v => (v.abonos || []).forEach(a => { if(a.estado === 'confirmado' && enMes(a.fecha, m)) porMetodo[a.metodo] = (porMetodo[a.metodo] || 0) + (a.tipo === 'devolucion' ? -1 : 1) * a.monto; }));
    const movs = d.movs.filter(x => !x.anulado && enMes(x.fecha, m));
    const transf = {}; movs.filter(x => x.tipo === 'transferencia').forEach(x => { transf[x.prov] = (transf[x.prov] || 0) + x.ep; });
    const gastos = {}; movs.filter(x => x.tipo === 'gasto').forEach(x => { gastos[x.cat] = (gastos[x.cat] || 0) - x.ec; });
    const compras = {}; movs.filter(x => x.tipo === 'compra').forEach(x => { compras[x.prov] = (compras[x.prov] || 0) - x.ep; });
    const ajustes = movs.filter(x => x.tipo === 'ajuste').length;
    // Ganancia: lo vendido en el mes menos su costo (Costos) y los gastos pagados
    let vendido = 0, costo = 0, sinCosto = 0, nSin = 0, puertas = 0; const porModelo = {};
    d.ventas.filter(v => !v.interna && !['cotizacion','cancelada'].includes(v.estado) && enMes(v.confirmada_en, m)).forEach(v => v.items.forEach(it => {
      const n = it.cantidad, x = X.costear(it.catalogo_id); puertas += n; vendido += it.precio_unitario * n;
      if(x && !x.falta.length){ costo += x.costo * n; const pm = (porModelo[it.nombre] ||= { n:0, gana:0 }); pm.n += n; pm.gana += (it.precio_unitario - x.costo - x.fijos) * n; }
      else { sinCosto += it.precio_unitario * n; nSin += n; } }));
    const gastoTot = Object.values(gastos).reduce((a, x) => a + x, 0);
    const fijosPrev = d.gastosFijos.reduce((a, g) => a + g.monto, 0);
    const pagadoFijo = d.gastosFijos.map(g => ({ cat:g.cat, prev:g.monto, pagado:gastos[g.cat] || 0 }));
    // Saldos al final del mes
    const fin = m + '-31';
    const saldoCta = (id) => r2(d.movs.filter(x => !x.anulado && x.cuenta === id && String(x.fecha) <= fin).reduce((a, x) => a + (x.ec || 0), 0));
    const saldoPrv = (id) => r2(d.movs.filter(x => !x.anulado && x.prov === id && String(x.fecha) <= fin).reduce((a, x) => a + (x.ep || 0), 0));
    return {
      entro:Object.entries(porMetodo).map(([k, v]) => ['Pagos de clientes · ' + k, r2(v)]),
      salio:Object.entries(transf).map(([k, v]) => ['Transferencias a ' + (prov(k) || {}).nombre, -r2(v)]).concat(Object.entries(gastos).map(([k, v]) => ['Gasto · ' + k, -r2(v)])),
      compras:Object.entries(compras).map(([k, v]) => [(prov(k) || {}).nombre, r2(v)]),
      vendido:r2(vendido), costo:r2(costo), sinCosto:r2(sinCosto), nSin, puertas, gastoTot:r2(gastoTot), fijosPrev, pagadoFijo,
      porModelo:Object.entries(porModelo).map(([k, v]) => [k + ' × ' + v.n, r2(v.gana)]).sort((a, b) => b[1] - a[1]),
      cuentas:d.cuentas.map(c => [c.nombre, saldoCta(c.id)]), proveedores:d.proveedores.map(p => [p.nombre, saldoPrv(p.id)]), ajustes,
    };
  }
  const suma = (l) => l.reduce((a, x) => a + x[1], 0);
  function secMes(){
    const d = D(), cierre = (d.cierres || {})[mesSel], C = cierre ? cierre.datos : calcMes(mesSel);
    $('subtitulo').textContent = 'Cierre de ' + nomMes(mesSel);
    const meses = [...new Set(d.movs.map(x => String(x.fecha).slice(0, 7)).concat([mesActual()]))].sort().reverse().slice(0, 4);
    let h = `<div class="opts" style="--cols:${meses.length};margin-bottom:12px">${meses.map(m => `<button class="opt ${m === mesSel ? 'selected' : ''}" type="button" data-mes="${m}">${esc(MESES[+m.slice(5) - 1])}${(d.cierres || {})[m] ? '<br><small style="font-weight:600">cerrado</small>' : ''}</button>`).join('')}</div>`;
    if(cierre) h += `<div class="caja-ok">Mes cerrado el ${fecha(cierre.fecha)} por ${esc(cierre.por)}. Estos números quedaron fijos. Si hay que corregir algo, se hace con un ajuste con motivo.</div>`;
    else if(mesSel === mesActual()) h += `<div class="caja-nota"><span>Mes en curso</span>Los números cambian hasta que termine el mes. Se cierra a partir del día 1 del mes siguiente.</div>`;
    const neto = suma(C.entro) + suma(C.salio), ganancia = C.vendido - C.sinCosto - C.costo - C.gastoTot;
    h += `<div class="tit">Lo que ganaste</div>` + reporte([
        ['Vendido con costeo (' + (C.puertas - C.nSin) + ' puertas)', C.vendido - C.sinCosto],
        ['Costo de lo vendido (materiales y mano de obra)', -C.costo],
        ['Gastos pagados', -C.gastoTot]], ganancia >= 0 ? 'Ganancia del mes' : 'Pérdida del mes', ganancia)
      + (C.nSin ? `<div class="caja-amar">Además se vendieron ${C.nSin === 1 ? '1 puerta' : C.nSin + ' puertas'} sin costeo por ${dinero(C.sinCosto)}. No entran en la ganancia hasta cargar su costeo.</div>` : '');
    h += `<div class="tit">Dinero que entró y salió</div>` + reporte(C.entro.concat(C.salio).length ? C.entro.concat(C.salio) : [['Sin movimientos', 0]], neto >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró', neto);
    h += `<div class="gris-l">Nómina y vales: falta decidir de qué cuenta salen. Cuando se decida, salen aquí.</div>`;
    h += `<div class="tit">Compras a proveedores</div>` + reporte(C.compras.length ? C.compras.map(([n, v]) => [n, -v]) : [['Sin compras este mes', 0]], 'Total comprado', -suma(C.compras));
    h += `<div class="tit">Gastos fijos: previsto y pagado</div><div class="rep">${C.pagadoFijo.map(g => `<div class="rep-f"><span>${esc(g.cat)}<small class="mat-s" style="display:block;font-weight:600">previsto ${dinero(g.prev)}</small></span><b class="${g.pagado + 0.005 < g.prev ? 's-debe' : 's-favor'}">${g.pagado ? dinero(g.pagado) : 'Sin pagar'}</b></div>`).join('')}
      <div class="rep-f total"><span>Pagado de ${dinero(C.fijosPrev)} previstos</span><b>${dinero(C.pagadoFijo.reduce((a, g) => a + g.pagado, 0))}</b></div></div>`;
    if(C.porModelo.length) h += `<div class="tit">Lo que dejó cada producto</div>` + reporte(C.porModelo, 'Total después de gastos fijos', suma(C.porModelo));
    h += `<div class="tit">Así quedaron las cuentas</div>` + reporte(C.cuentas, 'En cuentas', suma(C.cuentas));
    h += `<div class="tit">Así quedaron los proveedores</div>` + reporte(C.proveedores, suma(C.proveedores) < 0 ? 'Les debes en total' : 'A tu favor en total', suma(C.proveedores));
    if(C.ajustes) h += `<p class="mat-s" style="margin:8px 2px 0">${C.ajustes === 1 ? 'Hubo 1 ajuste de saldo' : 'Hubo ' + C.ajustes + ' ajustes de saldo'} este mes. Están en el historial con su motivo.</p>`;
    const puedeCerrar = !cierre && mesSel < mesActual();
    h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" type="button" data-pdf-mes style="flex:1;height:54px">Reporte en PDF</button>${cierre ? '' : `<button class="btn-primary" type="button" data-cerrar-mes style="flex:1.2" ${puedeCerrar ? '' : 'disabled'}>Cerrar el mes</button>`}</div>`;
    return h;
  }
  async function pdfMes(){
    const d = D(), cierre = (d.cierres || {})[mesSel], C = cierre ? cierre.datos : calcMes(mesSel);
    const f = (n, v) => ({ t:'fila', a:n, b:(v < -0.005 ? '- ' : v > 0.005 ? '+ ' : '') + dinero(Math.abs(v)), rojo:v < -0.005 });
    const tot = (n, v) => ({ t:'total', a:n, b:(v < -0.005 ? '- ' : '') + dinero(Math.abs(v)) });
    const ganancia = C.vendido - C.sinCosto - C.costo - C.gastoTot;
    const b = [{ t:'titulo', texto:'Lo que ganaste' }, f('Vendido con costeo', C.vendido - C.sinCosto), f('Costo de lo vendido', -C.costo), f('Gastos pagados', -C.gastoTot), tot(ganancia >= 0 ? 'Ganancia del mes' : 'Pérdida del mes', ganancia)];
    if(C.nSin) b.push({ t:'nota', texto:'Vendido sin costeo: ' + dinero(C.sinCosto) + ' (no entra en la ganancia).' });
    b.push({ t:'titulo', texto:'Dinero que entró y salió' }); C.entro.concat(C.salio).forEach(([n, v]) => b.push(f(n, v))); b.push(tot('Neto', suma(C.entro) + suma(C.salio)));
    b.push({ t:'titulo', texto:'Compras a proveedores' }); C.compras.forEach(([n, v]) => b.push(f(n, -v))); b.push(tot('Total comprado', -suma(C.compras)));
    b.push({ t:'titulo', texto:'Gastos fijos', der:'previsto / pagado' }); C.pagadoFijo.forEach(g => b.push({ t:'fila', a:g.cat + ' (previsto ' + dinero(g.prev) + ')', b:g.pagado ? dinero(g.pagado) : 'Sin pagar', rojo:!g.pagado }));
    if(C.porModelo.length){ b.push({ t:'titulo', texto:'Lo que dejó cada producto' }); C.porModelo.forEach(([n, v]) => b.push(f(n, v))); }
    b.push({ t:'titulo', texto:'Cuentas al cerrar' }); C.cuentas.forEach(([n, v]) => b.push(f(n, v))); b.push(tot('En cuentas', suma(C.cuentas)));
    b.push({ t:'titulo', texto:'Proveedores al cerrar' }); C.proveedores.forEach(([n, v]) => b.push(f(n, v)));
    b.push({ t:'nota', texto:'+ entra o es a tu favor · - sale o se debe. Nómina y vales: pendiente decidir de qué cuenta salen.' });
    b.push({ t:'firmas', a:'Revisado por Ray', b:'Revisado por Gualfredo' });
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo:'Cierre del mes', derecha:nomMes(mesSel), subtitulo:cierre ? 'Mes cerrado el ' + fecha(cierre.fecha) + '. Números fijos.' : 'Mes sin cerrar: los números pueden cambiar.', bloques:b });
      const r = await window.PDFR.compartir(blob, 'Cierre-' + mesSel + '.pdf'); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }

  // ================= Eventos =================
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]'); if(t && t.closest('#tabs')){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const ir = e.target.closest('[data-ir]');
    if(ir){ const k = ir.dataset.ir; if(k === 'prov'){ tab = 'prov'; pintar(); window.scrollTo(0, 0); } else { const el = $('sec-' + k); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); } return; }
    const pv = e.target.closest('[data-prov]'); if(pv) return abrirDetalle('prov', pv.dataset.prov);
    const cu = e.target.closest('[data-cuenta]'); if(cu) return abrirDetalle('cuenta', cu.dataset.cuenta);
    const cf = e.target.closest('[data-confirmar]'); if(cf) return abrirForm({ t:'confirmar', abono:+cf.dataset.confirmar, llego:null, destino:null });
    const ub = e.target.closest('[data-ubicar]'); if(ub) return abrirForm({ t:'ubicar', abono:+ub.dataset.ubicar, destino:null });
    const tr = e.target.closest('[data-transferir]'); if(tr) return abrirForm({ t:'transferencia', prov:tr.dataset.transferir, cuenta:null });
    const tp = e.target.closest('[data-traspaso]'); if(tp) return abrirForm({ t:'traspaso', de:tp.dataset.traspaso || null, a:null });
    const ap = e.target.closest('[data-ajustar-prov]'); if(ap){ const s = X.saldoProv(ap.dataset.ajustarProv); return abrirForm({ t:'ajuste', prov:ap.dataset.ajustarProv, signo:s > 0.005 ? 'favor' : s < -0.005 ? 'debe' : 'cero', nuevo:Math.abs(s) || '' }); }
    const ac = e.target.closest('[data-ajustar-cuenta]'); if(ac) return abrirForm({ t:'ajuste', cuenta:ac.dataset.ajustarCuenta, signo:'favor', nuevo:X.saldoCuenta(ac.dataset.ajustarCuenta) });
    const ep = e.target.closest('[data-editar-prov]'); if(ep){ const p = prov(ep.dataset.editarProv); return abrirForm(Object.assign({ t:'proveedor' }, JSON.parse(JSON.stringify(p)))); }
    if(e.target.closest('[data-nuevo-prov]') || e.target.closest('#btnNuevoProv')) return abrirForm({ t:'proveedor', nombre:'', tipos:[], iva:true });
    const gc = e.target.closest('[data-gasto-cat]'); if(gc) return abrirForm({ t:'gasto', cat:gc.dataset.gastoCat, monto:(D().gastosFijos.find(g => g.cat === gc.dataset.gastoCat) || {}).monto });
    if(e.target.closest('[data-nuevo-gasto]') || e.target.closest('#btnNuevoGasto')) return abrirForm({ t:'gasto', cat:null });
    const mv = e.target.closest('[data-mov]'); if(mv) return abrirForm({ t:'mov', id:+mv.dataset.mov });
    const pd = e.target.closest('[data-pdf]'); if(pd) return abrirPdf(pd.dataset.pdf);
    const cq = e.target.closest('[data-cuadrar]'); if(cq){ const p = prov(cq.dataset.cuadrar); p.cuadre = { fecha:hoy(), saldo:X.saldoProv(p.id) }; X.guardar(); toast('Marcado como cuadrado hoy con ' + p.nombre); pintar(); pintarDetalle(); return; }
    const mm = e.target.closest('[data-maq-msg]'); if(mm) return toast(mm.dataset.maqMsg);
    const ms = e.target.closest('[data-mes]'); if(ms){ mesSel = ms.dataset.mes; return pintar(); }
    if(e.target.closest('[data-pdf-mes]')) return pdfMes();
    if(e.target.closest('[data-cerrar-mes]')){ const d = D(); (d.cierres ||= {})[mesSel] = { fecha:hoy(), por:'Ray', datos:calcMes(mesSel) }; X.guardar(); toast('Mes cerrado. Los números quedaron fijos.'); return pintar(); }
    if(F){
      const set = (attr, campo) => { const b = e.target.closest('[' + attr + ']'); if(b){ leerCampos(); F[campo] = b.getAttribute(attr); pintarForm(); return true; } return false; };
      if(set('data-f-llego', 'llego')) return;
      if(set('data-f-cuenta', 'cuenta') || set('data-f-destino', 'destino') || set('data-f-prov', 'prov') || set('data-f-signo', 'signo') || set('data-f-cat', 'cat') || set('data-f-de', 'de') || set('data-f-a', 'a')) return;
      const iv = e.target.closest('[data-f-iva]'); if(iv){ leerCampos(); F.iva = iv.dataset.fIva === 'si'; return pintarForm(); }
      const tc = e.target.closest('[data-f-tipo]'); if(tc){ leerCampos(); const k = tc.dataset.fTipo; F.tipos = F.tipos.includes(k) ? F.tipos.filter(x => x !== k) : F.tipos.concat(k); return pintarForm(); }
    }
  });
  document.addEventListener('input', (e) => { if(F && F.t === 'transferencia' && e.target.id === 'fMonto'){ F.monto = e.target.value; const caja = $('formBody').querySelector('.caja-nota'); if(caja){ const antes = X.saldoProv(F.prov), desp = antes + (numLibre(F.monto) || 0); caja.innerHTML = `<span>Saldo con ${esc(prov(F.prov).nombre)}</span>${saldoTxt(antes).corto} ${dinero(Math.abs(antes))} → después de esta transferencia: <b>${saldoTxt(desp).corto.toLowerCase()} ${dinero(Math.abs(desp))}</b>`; } } });
  $('btnForm').onclick = guardarForm;
  $('btnCompartirPdf').onclick = () => toast('En la app real se comparte el PDF por WhatsApp');
  $('btnReiniciar').onclick = () => { X.reiniciar(); sel = null; toast('Datos de ejemplo reiniciados'); pintar(); };
  ancho.addEventListener('change', pintar);

  pintar();
  const q = new URLSearchParams(location.search);
  if(q.get('prov')){ tab = 'prov'; pintar(); abrirDetalle('prov', q.get('prov')); }
  if(q.get('confirmar')){ const pc = X.porConfirmar(); if(pc.length) abrirForm({ t:'confirmar', abono:pc[0].id, llego:null, destino:null }); }
  if(q.get('ubicar')){ const ub = X.porUbicar(); if(ub.length) abrirForm({ t:'ubicar', abono:ub[0].id, destino:null }); }
})();
