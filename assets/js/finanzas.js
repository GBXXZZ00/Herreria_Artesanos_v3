// Finanzas (solo quien confirma pagos: Ray o Gualfredo). Dónde está el dinero: cuentas, pagos por
// confirmar y por ubicar, proveedores como cuenta corriente (transferencias y compras), ajustes con
// historial, estado de cuenta en PDF, gastos del mes y cierre del mes.
// Las reglas de dinero viven en la base (funciones de Supabase); aquí solo se muestra y se llama.
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const ancho = window.matchMedia('(min-width:1024px)');
  const TIPO = { hierro:'Hierro', aluminio:'Aluminio', laminas:'Láminas', vidrio:'Vidrio', pintura:'Pintura y masilla', consumibles:'Consumibles', accesorios:'Accesorios', madera:'Madera' };
  const TIPOS_CUENTA = ['Zelle', 'Efectivo', 'Binance', 'Banco', 'Bolívares', 'Otra'];
  const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ink-faint);flex-shrink:0"><path d="M9 6l6 6-6 6"/></svg>';
  const ini = (t) => String(t).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const fecha = (iso) => { if(!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}/${+m}/${a}`; };
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const hoy = () => (D && D.hoy) || new Date().toISOString().slice(0, 10);
  const mesActual = () => hoy().slice(0, 7);
  const numLibre = (v) => { const s = String(v == null ? '' : v).trim(); if(!s) return NaN; if(/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.')); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  const bsTxt = (n) => Number(n).toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' Bs';
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };

  // ================= Datos (de la base) =================
  let D = null;          // finanzas_datos()
  let EXTRA = { compras:[], precios:[], materiales:[] };   // compras y precios por proveedor (Depósito)
  let VENTAS_MES = [];   // ventas del mes con sus productos (para "Lo que ganas este mes")
  let COSTOS = null;     // costo por modelo del catálogo (Costos), si existe
  const vivos = () => D.movs.filter(m => !m.anulado);
  const prov = (id) => D.proveedores.find(p => String(p.id) === String(id));
  const cta = (id) => D.cuentas.find(c => String(c.id) === String(id));
  const saldoCuenta = (id) => r2(vivos().filter(m => String(m.cuenta) === String(id)).reduce((a, m) => a + Number(m.ec || 0), 0));
  const saldoBs = (id) => r2(vivos().filter(m => String(m.cuenta) === String(id)).reduce((a, m) => a + (m.bs ? Math.sign(Number(m.ec) || 0) * Number(m.bs) : 0), 0));
  const saldoProv = (id) => r2(vivos().filter(m => String(m.prov) === String(id)).reduce((a, m) => a + Number(m.ep || 0), 0));
  function libreta(filtro, campo){
    let s = 0;
    return D.movs.filter(filtro).map(m => { if(!m.anulado) s = r2(s + Number(m[campo] || 0)); return Object.assign({}, m, { saldo:s }); });
  }
  const movsCuenta = (id) => libreta(m => String(m.cuenta) === String(id), 'ec');
  const movsProv = (id) => libreta(m => String(m.prov) === String(id), 'ep');
  const porUbicar = () => D.porUbicar || [];
  const salidasPorUbicar = () => vivos().filter(m => m.por_ubicar);
  const montoUb = (a) => (a.tipo === 'devolucion' ? -1 : 1) * Number(a.monto);
  function resumen(){
    const enCuentas = r2(D.cuentas.reduce((a, c) => a + saldoCuenta(c.id), 0));
    const ub = r2(porUbicar().reduce((a, x) => a + montoUb(x), 0) - salidasPorUbicar().filter(m => !m.cuenta).reduce((a, m) => a + Number(m.salio || 0), 0));
    const provs = D.proveedores.map(p => saldoProv(p.id));
    const aFavor = r2(provs.filter(x => x > 0).reduce((a, x) => a + x, 0));
    const debes = r2(-provs.filter(x => x < 0).reduce((a, x) => a + x, 0));
    const cobrar = r2((D.porCobrar || []).reduce((a, x) => a + Number(x.resta), 0));
    return { enCuentas, porUbicar:ub, aFavor, debes, porCobrar:cobrar, total:r2(enCuentas + ub + aFavor + cobrar - debes) };
  }

  async function cargar(){
    const { data, error } = await db.rpc('finanzas_datos');
    if(error) throw error;
    D = data;
    // Lo que sigue es extra: si falla, Finanzas igual funciona
    const ini0 = mesActual() + '-01';
    const [rc, rp, rv] = await Promise.all([
      db.from('compras').select('id,proveedor_id,documento,numero,fecha,subtotal,iva,total,material_pendiente,foto,nota').order('fecha', { ascending:false }).limit(300),
      db.from('material_precios').select('material_id,proveedor_id,precio,espesor,desde,vigente').eq('vigente', true),
      db.from('ventas').select('id,total,confirmada_en,interna,estado,items:venta_items(catalogo_id,nombre,cantidad,precio_unitario)').gte('confirmada_en', ini0).not('estado', 'in', '(cotizacion,cancelada)'),
    ]).catch(() => [{}, {}, {}]);
    EXTRA.compras = (rc && !rc.error && rc.data) || [];
    EXTRA.precios = (rp && !rp.error && rp.data) || [];
    VENTAS_MES = ((rv && !rv.error && rv.data) || []).filter(v => !v.interna);
    if(EXTRA.precios.length){
      const { data:mats } = await db.from('materiales').select('id,nombre,tipo').in('id', [...new Set(EXTRA.precios.map(x => x.material_id))]);
      EXTRA.materiales = mats || [];
    }
    if(window.COSTEO && VENTAS_MES.length){ try{ COSTOS = await window.COSTEO.costosModelos(); } catch(e){ COSTOS = null; } }
  }
  async function recargar(){ try{ await cargar(); pintar(); pintarDetalle(); } catch(e){ toast(errTxt(e), 'error'); } }

  function saldoTxt(s){
    if(s > 0.005) return { cls:'s-favor', t:'a tu favor', corto:'A tu favor' };
    if(s < -0.005) return { cls:'s-debe', t:'le debes', corto:'Le debes' };
    return { cls:'s-cero', t:'al día', corto:'Al día' };
  }
  const NOMBRE_MOV = { transferencia:'Transferencia', compra:'Compra', ajuste:'Ajuste de saldo', ubicar:'Pago de cliente', gasto:'Gasto', traspaso:'Movimiento entre cuentas', nomina:'Nómina', vale:'Vale (adelanto)' };
  const nomMov = (m) => (m.tipo === 'ubicar' && Number(m.ec) < 0) ? 'Devolución' : (NOMBRE_MOV[m.tipo] || m.tipo);

  const q0 = new URLSearchParams(location.search);
  let tab = q0.get('tab') || 'dinero';
  if(!['dinero','prov','gastos','mes'].includes(tab)) tab = 'dinero';
  let sel = null;   // { t:'prov'|'cuenta', id }
  let F = null;     // formulario abierto

  // ================= Pantalla =================
  function pintar(){
    if(!D) return;
    document.querySelectorAll('#tabs [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('tabs').querySelector('.seg-fondo').style.transform = `translateX(${['dinero','prov','gastos','mes'].indexOf(tab) * 100}%)`;
    const r = resumen();
    const nConf = D.porConfirmar.length;
    $('subtitulo').textContent = nConf ? (nConf === 1 ? '1 pago por confirmar' : nConf + ' pagos por confirmar') : r.porUbicar ? `${dinero(Math.abs(r.porUbicar))} por ubicar` : 'Dónde está tu dinero';
    const grande = ancho.matches;
    $('pieProv').classList.toggle('hidden', grande || tab !== 'prov');
    $('pieGasto').classList.toggle('hidden', grande || tab !== 'gastos');
    if(tab === 'mes'){ $('pieProv').classList.add('hidden'); $('pieGasto').classList.add('hidden'); $('cont').innerHTML = `<div class="mes-wrap">${window.FinMes ? window.FinMes.html() : ''}</div>`; if(window.FinMes) window.FinMes.despues(); return; }
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
    return `<div class="rep">${filas.map(([n, v, attr]) => `<${attr ? 'button' : 'div'} class="rep-f" ${attr ? 'type="button" ' + attr : ''}><span>${esc(n)}</span><b class="${v > 0.005 ? 's-favor' : v < -0.005 ? 's-debe' : ''}">${signo(v)}</b></${attr ? 'button' : 'div'}>`).join('')}
      <div class="rep-f total"><span>${esc(totalNombre)}</span><b class="${total < -0.005 ? 's-debe' : ''}">${total < -0.005 ? '−' : ''}${dinero(Math.abs(total))}</b></div></div>`;
  }
  function secDinero(){
    const r = resumen(), ub = porUbicar(), sal = salidasPorUbicar(), pc = D.porCobrar || [], pc0 = D.porConfirmar;
    let top = '';
    if(pc0.length) top = `<div class="tit" style="margin-top:0">Pagos por confirmar · ${pc0.length}</div>` + pc0.map(a => `<button class="ub conf" type="button" data-confirmar="${a.id}"><span class="grow"><b>N° ${esc(a.venta_id)} · ${esc(a.cliente)}</b><small>${esc(a.metodo)} · lo registró ${esc(a.registro || 'la vendedora')} · ¿Llegó?</small></span><span class="m">${dinero(a.monto)}</span>${CHEV}</button>`).join('') + '<div style="height:14px"></div>';
    let h = top + `<div class="tit" style="margin-top:4px">Tu dinero hoy</div>` + reporte([
      ['En tus cuentas', r.enCuentas, 'data-ir="cuentas"'],
      ['Pagos por ubicar', r.porUbicar, 'data-ir="ubicar"'],
      ['A tu favor con proveedores', r.aFavor, 'data-ir="prov"'],
      ['Te deben los clientes', r.porCobrar, 'data-ir="cobrar"'],
      ['Le debes a proveedores', -r.debes, 'data-ir="prov"'],
    ], 'Todo lo tuyo', r.total);
    h += secGanancia();
    // Por ubicar: pagos de clientes y salidas sin cuenta o sin proveedor
    h += `<div class="tit" id="sec-ubicar">Pagos por ubicar · ${ub.length + sal.length}</div>`;
    h += ub.map(a => `<button class="ub" type="button" data-ubicar="${a.id}"><span class="grow"><b>${a.tipo === 'devolucion' ? 'Devolución' : 'N°'} ${esc(a.venta_id)} · ${esc(a.cliente)}</b><small>${esc(a.metodo || '')} · ${a.tipo === 'devolucion' ? '¿De qué cuenta salió?' : 'confirmado el ' + fecha(a.confirmado_en) + ' · ¿Dónde quedó?'}</small></span><span class="m">${a.tipo === 'devolucion' ? '−' : ''}${dinero(a.monto)}</span>${CHEV}</button>`).join('');
    h += sal.map(m => `<button class="ub" type="button" data-ubicar-mov="${m.id}"><span class="grow"><b>${esc(nomMov(m))}${m.ref ? ' · ' + esc(m.ref) : ''}</b><small>${fecha(m.fecha)} · ${m.cuenta ? '¿A cuál proveedor?' : '¿De qué cuenta salió?'}</small></span><span class="m">−${dinero(m.salio)}</span>${CHEV}</button>`).join('');
    if(!ub.length && !sal.length) h += '<p class="mat-s" style="margin:0 2px">Todo ubicado. Cuando confirmas un pago y eliges "Después", aparece aquí para decir dónde quedó.</p>';
    // Cuentas
    h += `<div class="tit" id="sec-cuentas" style="display:flex;justify-content:space-between;align-items:baseline">Cuentas <button type="button" class="link-btn" data-traspaso style="font-size:13px;font-weight:800;color:var(--accent)">Mover entre cuentas</button></div><div class="mat-lista ya">`;
    h += D.cuentas.filter(c => c.activa || Math.abs(saldoCuenta(c.id)) > 0.005).map(c => { const s = saldoCuenta(c.id), bs = c.moneda === 'VES' ? saldoBs(c.id) : null;
      return `<button class="mat" type="button" data-cuenta="${c.id}"><span class="mat-ico">${esc(ini(c.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(c.nombre)}</span><span class="mat-s">${esc(c.tipo)}${bs != null ? ' · ' + esc(bsTxt(bs)) : ''}${c.activa ? '' : ' · apagada'}</span></span>
        <span class="mat-n"><b style="font-size:19px">${dinero(s)}</b><span>${bs != null ? 'en dólares' : 'saldo'}</span></span></button>`; }).join('') + '</div>';
    if(!D.cuentas.length) h += '<p class="mat-s" style="margin:0 2px 8px">Todavía no hay cuentas. Agrega las tuyas: Zelle, efectivo de cada sede, Binance, banco o bolívares.</p>';
    h += '<button class="btn-nuevo" type="button" data-nueva-cuenta>+ Agregar cuenta</button>';
    // Por cobrar
    h += `<div class="tit" id="sec-cobrar">Te deben los clientes</div>`;
    h += pc.length ? pc.map(v => `<a class="cg-fila" href="ventas.html?abrir=${v.id}"><div class="cg-nom">N° ${v.id} · ${esc(v.cliente)}<span>${v.estado === 'confirmada' ? 'Confirmada' : v.estado === 'en_produccion' ? 'En fabricación' : 'Lista'} · total ${dinero(v.total)} · pagado ${dinero(v.pagado)}</span></div><div style="text-align:right;font-weight:800">${dinero(v.resta)}</div></a>`).join('')
      : '<p class="mat-s" style="margin:0 2px">Nadie debe nada.</p>';
    return h;
  }

  function secGanancia(){
    const mes = mesActual();
    const filas = VENTAS_MES.map(v => {
      let costo = 0; const sin = [];
      (v.items || []).forEach(it => { const c = COSTOS && it.catalogo_id ? COSTOS[it.catalogo_id] : null; if(c && c.listo) costo += c.costo * it.cantidad; else sin.push(it.nombre); });
      return { v, costo, sin, gana: sin.length ? null : Number(v.total) - costo };
    });
    const gastos = r2(vivos().filter(m => ['gasto','nomina','vale'].includes(m.tipo) && String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + Number(m.salio || 0), 0)
      + vivos().filter(m => !['gasto','nomina','vale'].includes(m.tipo) && String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + Math.max(0, Number(m.comision || 0)), 0));
    const con = filas.filter(f => f.gana != null), sinCosto = filas.filter(f => f.gana == null);
    const costoV = con.reduce((a, f) => a + f.costo, 0), vendidoC = con.reduce((a, f) => a + Number(f.v.total), 0);
    return `<div class="tit">Lo que ganas este mes</div>` + reporte([
        ['Vendido (modelos costeados)', vendidoC],
        ['Costo de lo vendido', -costoV],
        ['Gastos, nómina y comisiones', -gastos],
      ], 'Te queda', vendidoC - costoV - gastos)
      + (sinCosto.length ? `<p class="mat-s" style="margin:6px 2px 0">No entran porque su modelo no tiene costo: ${sinCosto.map(f => 'N° ' + f.v.id).join(', ')} (${dinero(sinCosto.reduce((a, f) => a + Number(f.v.total), 0))}). Cóstealos en Costos.</p>` : '')
      + '<p class="mat-s" style="margin:6px 2px 0">El costo sale de Costos (materiales y mano de obra).</p>';
  }

  function secProveedores(){
    const lista = D.proveedores.filter(p => p.activo || Math.abs(saldoProv(p.id)) > 0.005).map(p => ({ p, s:saldoProv(p.id), ult:movsProv(p.id).filter(m => !m.anulado).pop() }))
      .sort((a, b) => (a.s < 0 ? 0 : a.s > 0 ? 1 : 2) - (b.s < 0 ? 0 : b.s > 0 ? 1 : 2) || a.s - b.s);
    const debes = -lista.filter(x => x.s < 0).reduce((a, x) => a + x.s, 0), favor = lista.filter(x => x.s > 0).reduce((a, x) => a + x.s, 0);
    let h = `<div class="res"><div class="res-c ${debes ? 'rojo' : ''}"><span>Les debes</span><b>${dinero(debes)}</b></div><div class="res-c ok"><span>A tu favor</span><b>${dinero(favor)}</b></div></div><div class="mat-lista ya">`;
    h += lista.map(({ p, s, ult }) => { const st = saldoTxt(s);
      return `<button class="mat" type="button" data-prov="${p.id}"><span class="mat-ico">${esc(ini(p.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">${ult ? esc(nomMov(ult) + (ult.ref ? ' · ' + ult.ref : '') + ' · ' + fecha(ult.fecha)) : 'Sin movimientos'} · ${p.iva ? 'con IVA' : 'sin IVA'}</span></span>
        <span class="mat-n"><b class="${st.cls}" style="font-size:19px">${dinero(Math.abs(s))}</b><span>${st.t}</span></span></button>`; }).join('');
    h += '</div>';
    if(!lista.length) h += '<p class="mat-s" style="margin:8px 2px">Todavía no hay proveedores.</p>';
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-nuevo-prov>+ Agregar proveedor</button>';
    return h;
  }

  function secGastos(){
    const mes = mesActual();
    const pagos = vivos().filter(m => m.tipo === 'gasto' && String(m.fecha).slice(0, 7) === mes);
    const porCat = (cat) => pagos.filter(m => m.cat === cat).reduce((a, m) => a + Number(m.llego || m.salio || 0), 0);
    const fijos = D.gastosFijos.reduce((a, g) => a + Number(g.monto), 0);
    const nom = vivos().filter(m => m.tipo === 'nomina' && String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + Number(m.llego || 0), 0);
    const vales = vivos().filter(m => m.tipo === 'vale' && String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + Number(m.llego || 0), 0);
    const comis = vivos().filter(m => String(m.fecha).slice(0, 7) === mes).reduce((a, m) => a + Number(m.comision || 0), 0);
    const pagado = pagos.reduce((a, m) => a + Number(m.llego || m.salio || 0), 0);
    let h = `<div class="res"><div class="res-c"><span>Gastos pagados este mes</span><b>${dinero(pagado)}</b></div><div class="res-c"><span>Gastos fijos previstos</span><b>${dinero(fijos)}</b></div></div>`;
    h += D.gastosFijos.map(g => { const p = porCat(g.cat);
      return `<div class="gasto"><div class="cg-nom">${esc(g.cat)}<span>Previsto ${dinero(g.monto)}</span></div><div style="font-weight:800">${p ? dinero(p) : ''}</div>${p >= Number(g.monto) - 0.005 ? '<span class="pill verde">Pagado</span>' : `<button class="pill amar" type="button" data-gasto-cat="${esc(g.cat)}">Falta</button>`}</div>`; }).join('');
    if(!D.gastosFijos.length) h += '<p class="mat-s" style="margin:4px 2px">Los gastos fijos (alquiler, luz, internet…) se ponen en Costos › Ganancia.</p>';
    const otros = pagos.filter(m => !D.gastosFijos.some(g => g.cat === m.cat));
    if(otros.length) h += '<div class="tit">Otros gastos</div>' + otros.map(m => `<button class="gasto" type="button" data-mov="${m.id}" style="width:100%;text-align:left"><div class="cg-nom">${esc(m.cat)}<span>${esc((cta(m.cuenta) || {}).nombre || '')} · ${fecha(m.fecha)}</span></div><div style="font-weight:800">${dinero(m.llego || m.salio)}</div><span></span></button>`).join('');
    h += '<div class="tit">Taller y comisiones del mes</div>' + reporte([['Nómina pagada', -nom], ['Vales (adelantos)', -vales], ['Comisión y cambio', -comis]], 'Total', -(nom + vales + comis));
    h += `<div class="caja-nota"><span>Conexión con Costos</span>Costos reparte los gastos fijos entre las puertas del mes. Con los gastos reales puedes ajustar esa regla en Costos › Ganancia.</div>`;
    if(ancho.matches) h += '<button class="btn-nuevo" type="button" data-nuevo-gasto>+ Registrar gasto</button>';
    return h;
  }

  // ================= Detalle (hoja en el teléfono, panel al lado en computadora) =================
  function abrirDetalle(t, id){ sel = { t, id }; pintarDetalle(); if(!ancho.matches) abrirHoja('sheetDet'); }
  function pintarDetalle(){
    if(!sel || !D) return;
    const x = sel.t === 'prov' ? (prov(sel.id) && fichaProv(sel.id)) : (cta(sel.id) && fichaCuenta(sel.id));
    if(!x) return;
    const { titulo, body, foot } = x;
    if(ancho.matches){ const pn = $('panel'); if(pn) pn.innerHTML = `<h2 style="margin:0 0 12px;font-size:20px">${esc(titulo)}</h2>${body}<div class="pie-dos2" style="margin-top:16px">${foot}</div>`; }
    else { $('detTitulo').textContent = titulo; $('detBody').innerHTML = body; $('detFoot').innerHTML = `<div class="pie-dos2" style="margin:0">${foot}</div>`; }
  }
  function libretaHtml(lista, campo){
    if(!lista.length) return '<p class="mat-s" style="margin:0 2px">Sin movimientos.</p>';
    return lista.slice().reverse().map(m => { const v = Number(m[campo] || 0);
      const c = cta(m.cuenta), p = prov(m.prov);
      return `<button class="lib ${m.anulado ? 'anulado' : ''}" type="button" data-mov="${m.id}">
        <span class="lib-t">${esc(nomMov(m))}${m.ref ? ' · ' + esc(m.ref) : ''}</span>
        <span class="lib-m" style="color:${m.anulado ? '' : v > 0 ? 'var(--accent)' : v < 0 ? 'var(--danger)' : 'var(--ink-soft)'}">${v > 0 ? '+' : v < 0 ? '−' : ''}${dinero(Math.abs(v))}</span>
        <span class="lib-s">${fecha(m.fecha)}${c && campo === 'ep' ? ' · ' + esc(c.nombre) : ''}${p && campo === 'ec' ? ' · ' + esc(p.nombre) : ''}${m.bs ? ' · ' + esc(bsTxt(m.bs)) + ' a ' + esc(m.tasa) : ''}${Number(m.comision) > 0.005 && campo === 'ec' ? ' · comisión ' + dinero(m.comision) : ''}${m.anulado ? ' · anulado: ' + esc(m.anulado.motivo) : ''}</span>
        <span class="lib-c">queda ${dinero(m.saldo)}</span></button>`; }).join('');
  }
  function fichaProv(id){
    const p = prov(id), s = saldoProv(id), st = saldoTxt(s), movs = movsProv(id);
    const facturas = EXTRA.compras.filter(f => String(f.proveedor_id) === String(id));
    const precios = EXTRA.precios.filter(x => String(x.proveedor_id) === String(id));
    const mat = (mid) => EXTRA.materiales.find(m => m.id === mid) || {};
    const ajustes = movs.filter(m => m.tipo === 'ajuste');
    const body = `<div class="grande ${s > 0.005 ? 'favor' : s < -0.005 ? 'debe' : ''}"><span>${st.corto}</span><b>${dinero(Math.abs(s))}</b>
        <p>${s > 0.005 ? 'Le transferiste de más. Se descuenta solo en la próxima compra.' : s < -0.005 ? 'Compraste más de lo que le has transferido.' : 'No le debes nada y no tienes saldo a favor.'}</p></div>
      <div class="d-datos">
        <div class="d-dato"><span>RIF</span><b>${esc(p.rif || 'Sin RIF')}</b></div>
        <div class="d-dato"><span>IVA</span><b>${p.iva ? 'Cobra IVA (factura)' : 'Sin IVA (nota)'}</b></div>
        <div class="d-dato" style="grid-column:1/-1"><span>Vende</span><b style="white-space:normal">${(p.tipos || []).map(t => esc(TIPO[t] || t)).join(', ')}</b></div>
        ${p.datos_pago ? `<div class="d-dato" style="grid-column:1/-1"><span>Datos de pago</span><b style="white-space:normal">${esc(p.datos_pago)}</b></div>` : ''}
        ${p.cuadre ? `<div class="d-dato" style="grid-column:1/-1"><span>Último cuadre</span><b>${fecha(p.cuadre.fecha)} · saldo ${dinero(p.cuadre.saldo)}</b></div>` : ''}
      </div>
      <div class="pie-dos" style="margin-top:10px"><button class="btn-secondary" type="button" data-ajustar-prov="${p.id}">Cambiar saldo</button><button class="btn-secondary" type="button" data-editar-prov="${p.id}">Editar</button></div>
      <div class="tit">Movimientos (el más nuevo arriba)</div>${libretaHtml(movs, 'ep')}
      <div class="tit">Facturas y notas</div>
      ${facturas.length ? facturas.map(f => `<a class="cg-fila" href="deposito.html?tab=compras&compra=${f.id}"><div class="cg-nom">${f.documento === 'factura' ? 'Factura' : 'Nota de entrega'} ${esc(f.numero || '')}<span>${fecha(f.fecha)} · ${Number(f.iva) ? 'con IVA ' + dinero(f.iva) : 'sin IVA'}${f.foto ? ' · con foto' : ''}${f.material_pendiente ? ' · material por registrar' : ''}</span></div><div style="text-align:right;font-weight:800">${dinero(f.total)}</div></a>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin compras registradas.</p>'}
      <div class="tit">Lo que te vende (precio sin IVA)</div>
      ${precios.length ? precios.map(x => `<div class="cg-fila"><div class="cg-nom">${esc(mat(x.material_id).nombre || 'Material')}<span>${esc(TIPO[mat(x.material_id).tipo] || '')}${x.espesor ? ' · ' + esc(x.espesor) : ''} · desde ${fecha(x.desde)}</span></div><div style="text-align:right;font-weight:800">${dinero(x.precio)}</div></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Todavía no hay precios de este proveedor.</p>'}
      <div class="tit">Historial de saldos cambiados</div>
      ${ajustes.length ? ajustes.map(m => `<div class="cg-fila"><div class="cg-nom">Ajuste de saldo · ${fecha(m.fecha)}<span>${esc(m.nota || '')} · ${esc(m.por)}${m.anulado ? ' · anulado' : ''}</span></div><div style="text-align:right;font-weight:800">${Number(m.ep) >= 0 ? '+' : '−'}${dinero(Math.abs(m.ep))}</div></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin cambios de saldo.</p>'}
      <button class="btn-nuevo" type="button" data-cuadrar="${p.id}">Cuadrar con el proveedor</button>`;
    const foot = `<button class="btn-secondary" type="button" data-pdf="${p.id}" style="height:54px">Estado de cuenta</button><button class="btn-primary" type="button" data-transferir="${p.id}">Le transferí</button>`;
    return { titulo:p.nombre, body, foot };
  }
  function fichaCuenta(id){
    const c = cta(id), s = saldoCuenta(id), movs = movsCuenta(id);
    const body = `<div class="grande"><span>${esc(c.tipo)}${c.activa ? '' : ' · apagada'}</span><b>${dinero(s)}</b>${c.moneda === 'VES' ? `<p>${esc(bsTxt(saldoBs(id)))}</p>` : ''}</div>
      <div class="pie-dos" style="margin:0 0 4px"><button class="btn-secondary" type="button" data-salida="${c.id}">Pagué a un proveedor</button><button class="btn-secondary" type="button" data-editar-cuenta="${c.id}">Editar</button></div>
      <div class="tit">Movimientos (el más nuevo arriba)</div>${libretaHtml(movs, 'ec')}
      <button class="btn-nuevo" type="button" data-pdf-cuenta="${c.id}">Estado de cuenta en PDF</button>`;
    const foot = `<button class="btn-secondary" type="button" data-ajustar-cuenta="${c.id}" style="height:54px">Cambiar saldo</button><button class="btn-primary" type="button" data-traspaso="${c.id}">Mover a otra cuenta</button>`;
    return { titulo:c.nombre, body, foot };
  }

  // ================= Formularios =================
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${valor != null && String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  const cuentasActivas = () => D.cuentas.filter(c => c.activa);
  const sinCuentas = '<div class="caja-amar">Primero agrega una cuenta en Dinero › Cuentas.</div>';
  // Montos de una salida: lo que salió de la cuenta, lo que llegó o se pagó (si fue menos) y bolívares
  function camposSalida(etqSalio){
    const c = F.cuenta ? cta(F.cuenta) : null, ves = c && c.moneda === 'VES';
    let h = '';
    if(ves){
      h += `<div class="input-row"><div class="field"><label class="field-label" for="fBs">Bolívares que salieron</label><input class="input" id="fBs" inputmode="decimal" value="${esc(F.bs || '')}"></div><div class="field"><label class="field-label" for="fTasa">Tasa</label><input class="input" id="fTasa" inputmode="decimal" value="${esc(F.tasa || '')}"></div></div>
        <div class="field"><span class="field-label">¿De dónde es la tasa?</span>${opts([['BCV','BCV'],['Binance','Binance'],['Otra','Otra']], F.origen, 'data-f-origen', 3)}</div>
        <div class="field-hint" style="margin:-8px 2px 12px">Los dólares salen de Bs ÷ tasa.</div>`;
    } else {
      h += `<div class="field"><label class="field-label" for="fMonto">${esc(etqSalio || 'Monto que salió de la cuenta')}</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fMonto" inputmode="decimal" value="${esc(F.monto || '')}"></div></div>`;
    }
    h += `<button type="button" class="link-btn" data-f-menos style="font-size:13px;font-weight:800;color:var(--accent);margin:-4px 2px 10px">${F.menos ? 'Llegó lo mismo que salió' : '¿Llegó o se pagó menos? (comisión o cambio)'}</button>`;
    if(F.menos) h += `<div class="field"><label class="field-label" for="fLlego">Llegó o se pagó</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fLlego" inputmode="decimal" value="${esc(F.llego || '')}"></div><div class="field-hint">La diferencia queda sola como gasto "Comisión y cambio".</div></div>`;
    return h;
  }
  // Lee los montos de una salida y los valida. Devuelve el objeto para la función de la base o null.
  function montosSalida(){
    const c = F.cuenta ? cta(F.cuenta) : null, o = {};
    if(c && c.moneda === 'VES'){
      const bs = numLibre(F.bs), t = numLibre(F.tasa);
      if(!(bs > 0) || !(t > 0)){ toast('Escribe los bolívares y la tasa', 'error'); return null; }
      if(!F.origen){ toast('Elige de dónde es la tasa', 'error'); return null; }
      Object.assign(o, { monto_bs:bs, tasa:t, tasa_origen:F.origen }); o._salio = r2(bs / t);
    } else {
      const m = numLibre(F.monto); if(!(m > 0)){ toast('Escribe el monto', 'error'); return null; }
      o.monto_salio = m; o._salio = m;
    }
    if(F.menos){ const l = numLibre(F.llego); if(!(l > 0)){ toast('Escribe lo que llegó o se pagó', 'error'); return null; } o.monto_llego = l; }
    return o;
  }
  function abrirForm(f){ F = f; pintarForm(); abrirHoja('sheetForm'); }
  function pintarForm(){
    let h = '', boton = 'Guardar';
    if(F.t === 'transferencia'){
      const p = F.prov ? prov(F.prov) : null, antes = p ? saldoProv(F.prov) : 0;
      $('formTitulo').textContent = p && !F.elegirProv ? 'Transferencia a ' + p.nombre.replace('Inversiones ', '') : 'Pago a un proveedor';
      if(F.elegirProv) h += `<div class="field"><span class="field-label">¿A quién le pagaste?</span>${opts(D.proveedores.filter(x => x.activo).map(x => [x.id, esc(x.nombre)]).concat([['luego', 'Todavía no sé']]), F.prov || (F.luego ? 'luego' : null), 'data-f-prov', 1)}${F.luego ? '<div class="field-hint">Queda "por ubicar" con aviso hasta que digas a quién fue.</div>' : ''}</div>`;
      h += cuentasActivas().length ? `<div class="field"><span class="field-label">¿De qué cuenta salió?</span>${opts(cuentasActivas().map(x => [x.id, `${esc(x.nombre)}<br><small style="font-weight:600">${dinero(saldoCuenta(x.id))}</small>`]), F.cuenta, 'data-f-cuenta')}</div>` : sinCuentas;
      h += camposSalida();
      h += `<div class="input-row"><div class="field"><label class="field-label" for="fRef">Referencia</label><input class="input" id="fRef" value="${esc(F.ref || '')}"></div><div class="field"><label class="field-label" for="fFecha">Fecha</label><input class="input" id="fFecha" type="date" max="${hoy()}" value="${esc(F.fecha || hoy())}"></div></div>
        <div class="field"><span class="field-label">Comprobante (opcional)</span><label class="btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center">${F.fotoBlob ? 'Foto lista · cambiar' : 'Agregar foto del comprobante'}<input type="file" accept="image/*" id="fFoto" hidden></label></div>`;
      if(p) h += `<div class="caja-nota" id="cajaSaldo">${cajaSaldo()}</div>`;
      boton = 'Guardar transferencia';
    }
    if(F.t === 'ubicar'){
      const a = porUbicar().find(x => x.id === F.abono);
      if(!a){ F = null; cerrarHoja('sheetForm', true); return; }
      const dev = a.tipo === 'devolucion';
      $('formTitulo').textContent = dev ? '¿De dónde salió la devolución?' : '¿Dónde quedó este pago?';
      h = `<div class="conf-total" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:var(--ink-soft)">N° ${a.venta_id} · ${esc(a.cliente)} · ${esc(a.metodo || '')}</span><b style="font-size:24px">${dinero(a.monto)}</b></div>`;
      if(!dev) h += `<div class="field"><span class="field-label">Este dinero quedó…</span>${opts([['cuenta', 'En mi cuenta'], ['prov', 'Con un proveedor']], F.destino, 'data-f-destino')}</div>`;
      if(dev || F.destino === 'cuenta') h += cuentasActivas().length ? `<div class="field"><span class="field-label">¿En cuál cuenta?</span>${opts(ordenCuentas(a.metodo).map(c => [c.id, esc(c.nombre)]), F.cuenta, 'data-f-cuenta')}<div class="field-hint">Primero salen las cuentas ${esc(a.metodo || '')}.</div></div>` : sinCuentas;
      if(!dev && F.destino === 'prov') h += `<div class="field"><span class="field-label">¿A cuál proveedor?</span>${opts(D.proveedores.filter(p => p.activo).map(p => [p.id, esc(p.nombre)]), F.prov, 'data-f-prov', 1)}<div class="field-hint">Queda a tu favor con ese proveedor y se descuenta de su próxima compra.</div></div>`;
      boton = 'Guardar';
    }
    if(F.t === 'ubicarMov'){
      const m = D.movs.find(x => x.id === F.id);
      if(!m){ F = null; cerrarHoja('sheetForm', true); return; }
      $('formTitulo').textContent = m.cuenta ? '¿A quién le pagaste?' : '¿De qué cuenta salió?';
      h = `<div class="conf-total" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:var(--ink-soft)">${esc(nomMov(m))}${m.ref ? ' · ' + esc(m.ref) : ''} · ${fecha(m.fecha)}</span><b style="font-size:24px">${dinero(m.salio)}</b></div>`;
      h += m.cuenta ? `<div class="field"><span class="field-label">Proveedor</span>${opts(D.proveedores.filter(p => p.activo).map(p => [p.id, esc(p.nombre)]), F.prov, 'data-f-prov', 1)}</div>`
        : (cuentasActivas().length ? `<div class="field"><span class="field-label">Cuenta</span>${opts(cuentasActivas().map(c => [c.id, esc(c.nombre)]), F.cuenta, 'data-f-cuenta')}</div>` : sinCuentas);
      boton = 'Guardar';
    }
    if(F.t === 'confirmar'){
      const a = D.porConfirmar.find(x => x.id === F.abono);
      if(!a){ F = null; cerrarHoja('sheetForm', true); return; }
      $('formTitulo').textContent = '¿Llegó este pago?';
      const llega50 = a.estadoVenta === 'confirmada' && Number(a.pagado) + Number(a.monto) >= Number(a.total) * 0.5 - 0.005;
      h = `<div class="conf-total" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span style="font-weight:700;color:var(--ink-soft)">N° ${a.venta_id} · ${esc(a.cliente)} · ${esc(a.metodo)}</span><b style="font-size:24px">${dinero(a.monto)}</b></div>
        <div class="comp">${F.compUrl ? `<a href="${esc(F.compUrl)}" target="_blank" rel="noopener"><img src="${esc(F.compUrl)}" alt="Comprobante"></a>` : '<span class="mat-ico">…</span>'}<span>Comprobante que subió ${esc(a.registro || 'la vendedora')}<br><small>Venta de ${dinero(a.total)} · pagado antes ${dinero(a.pagado)}</small></span></div>
        <div class="field" style="margin-top:12px"><span class="field-label">¿Llegó a tu cuenta?</span>${opts([['si', 'Sí llegó'], ['no', 'No llegó']], F.llego, 'data-f-llego')}</div>
        ${F.llego === 'si' ? `<div class="field"><span class="field-label">¿Dónde quedó?</span>${opts([['cuenta', 'Mi cuenta'], ['prov', 'Proveedor'], ['luego', 'Después']], F.destino, 'data-f-destino', 3)}</div>
          ${F.destino === 'cuenta' ? (cuentasActivas().length ? `<div class="field"><span class="field-label">¿En cuál cuenta?</span>${opts(ordenCuentas(a.metodo).map(c => [c.id, esc(c.nombre)]), F.cuenta, 'data-f-cuenta')}</div>` : sinCuentas) : ''}
          ${F.destino === 'prov' ? `<div class="field"><span class="field-label">¿A cuál proveedor?</span>${opts(D.proveedores.filter(p => p.activo).map(p => [p.id, esc(p.nombre)]), F.prov, 'data-f-prov', 1)}<div class="field-hint">Queda a tu favor con ese proveedor.</div></div>` : ''}
          ${F.destino === 'luego' ? '<div class="field-hint" style="margin:-6px 2px 10px">Queda en "Pagos por ubicar" con su aviso en Inicio.</div>' : ''}
          ${llega50 ? '<div class="caja-ok" style="margin-top:4px">Con este pago llega al 50 %: el pedido pasa solo a producción.</div>' : ''}` : ''}
        ${F.llego === 'no' ? `<div class="field" id="campoMotivo"><label class="field-label" for="fMotivo">¿Qué pasó?</label><input class="input" id="fMotivo" value="${esc(F.motivo || '')}"><div class="field-error">Escribe qué pasó</div><div class="field-hint">La vendedora recibe el aviso "Pago no llegó".</div></div>` : ''}`;
      boton = F.llego === 'no' ? 'Marcar que no llegó' : 'Confirmar pago';
    }
    if(F.t === 'ajuste'){
      const actual = F.cuenta ? saldoCuenta(F.cuenta) : saldoProv(F.prov);
      const nombre = F.cuenta ? cta(F.cuenta).nombre : prov(F.prov).nombre;
      $('formTitulo').textContent = 'Cambiar saldo';
      h = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${esc(nombre)}. Hoy la app dice <b>${F.prov ? saldoTxt(actual).corto.toLowerCase() + ' ' + dinero(Math.abs(actual)) : dinero(actual)}</b>. Escribe el saldo real. El cambio queda en el historial con tu nombre y el motivo.</p>
        ${F.prov ? `<div class="field"><span class="field-label">El saldo real es…</span>${opts([['favor', 'A tu favor'], ['debe', 'Le debes'], ['cero', 'Al día']], F.signo, 'data-f-signo', 3)}</div>` : ''}
        ${F.signo !== 'cero' ? `<div class="field"><label class="field-label" for="fNuevo">Monto en dólares</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fNuevo" inputmode="decimal" value="${esc(F.nuevo === 0 ? '0' : (F.nuevo || ''))}"></div></div>` : ''}
        <div class="field" id="campoMotivo"><label class="field-label" for="fMotivo">Motivo</label><input class="input" id="fMotivo" value="${esc(F.motivo || '')}"><div class="field-error">Escribe por qué cambias el saldo</div><div class="field-hint">Ejemplo: saldo inicial, cuadre con el proveedor, error al registrar.</div></div>`;
      boton = 'Guardar saldo';
    }
    if(F.t === 'proveedor'){
      $('formTitulo').textContent = F.id ? 'Editar proveedor' : 'Proveedor nuevo';
      h = `<div class="field" id="campoNom"><label class="field-label" for="fNom">Nombre</label><input class="input" id="fNom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div></div>
        <div class="input-row"><div class="field"><label class="field-label" for="fRif">RIF</label><input class="input" id="fRif" value="${esc(F.rif || '')}"></div><div class="field"><label class="field-label" for="fTel">Teléfono</label><input class="input" id="fTel" inputmode="tel" value="${esc(F.telefono || '')}"></div></div>
        <div class="field"><span class="field-label">¿Cobra IVA?</span>${opts([['si', 'Sí, da factura'], ['no', 'No, da nota']], F.iva ? 'si' : 'no', 'data-f-iva')}<div class="field-hint">La compra lo trae marcado, pero se puede cambiar en cada factura.</div></div>
        <div class="field" id="campoTipos"><span class="field-label">¿Qué tipos de material vende?</span><div class="toggles">${Object.entries(TIPO).map(([k, t]) => `<button type="button" class="tchip ${(F.tipos || []).includes(k) ? 'on' : ''}" data-f-tipo="${k}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg></span>${t}</button>`).join('')}</div>
          <div class="field-error">Elige al menos uno</div><div class="field-hint">Al registrar una compra o un precio de este proveedor, solo salen esos tipos.</div></div>
        <div class="field"><label class="field-label" for="fPago">Datos de pago (opcional)</label><input class="input" id="fPago" value="${esc(F.datos_pago || '')}"><div class="field-hint">Zelle, pago móvil, banco y titular. Sirve para buscarlo al ubicar un pago.</div></div>
        ${F.id ? `<div class="field"><span class="field-label">¿Sigue activo?</span>${opts([['si', 'Activo'], ['no', 'Apagado']], F.activo === false ? 'no' : 'si', 'data-f-activo')}</div>` : ''}`;
      boton = 'Guardar proveedor';
    }
    if(F.t === 'cuenta'){
      $('formTitulo').textContent = F.id ? 'Editar cuenta' : 'Cuenta nueva';
      h = `<div class="field" id="campoNom"><label class="field-label" for="fNom">Nombre</label><input class="input" id="fNom" value="${esc(F.nombre || '')}"><div class="field-error">Escribe el nombre</div><div class="field-hint">Ejemplo: Zelle de Ray, Efectivo Cumbres.</div></div>
        <div class="field" id="campoTipoCta"><span class="field-label">Tipo</span>${opts(TIPOS_CUENTA.map(t => [t, t]), F.tipo, 'data-f-tipocta', 3)}<div class="field-error">Elige el tipo</div>${F.tipo === 'Bolívares' ? '<div class="field-hint">Se lleva en bolívares con la tasa de cada movimiento.</div>' : ''}</div>
        ${F.id ? `<div class="field"><span class="field-label">¿Sigue activa?</span>${opts([['si', 'Activa'], ['no', 'Apagada']], F.activa === false ? 'no' : 'si', 'data-f-activa')}</div>` : ''}`;
      boton = 'Guardar cuenta';
    }
    if(F.t === 'gasto'){
      $('formTitulo').textContent = 'Registrar gasto';
      h = `<div class="field"><span class="field-label">¿Qué gasto es?</span>${opts(D.gastosFijos.map(g => [g.cat, esc(g.cat)]).concat([['Otro', 'Otro']]), F.cat, 'data-f-cat')}</div>
        ${F.cat === 'Otro' ? `<div class="field"><label class="field-label" for="fCatOtro">Nombre del gasto</label><input class="input" id="fCatOtro" value="${esc(F.catOtro || '')}"></div>` : ''}
        ${cuentasActivas().length ? `<div class="field"><span class="field-label">¿De qué cuenta salió?</span>${opts(cuentasActivas().map(x => [x.id, esc(x.nombre)]), F.cuenta, 'data-f-cuenta')}</div>` : sinCuentas}
        ${camposSalida()}
        <div class="field"><label class="field-label" for="fFecha">Fecha</label><input class="input" id="fFecha" type="date" max="${hoy()}" value="${esc(F.fecha || hoy())}"></div>`;
      boton = 'Guardar gasto';
    }
    if(F.t === 'traspaso'){
      $('formTitulo').textContent = 'Mover entre cuentas';
      F.cuenta = F.de;
      h = `<div class="field"><span class="field-label">Sale de</span>${opts(cuentasActivas().map(x => [x.id, esc(x.nombre)]), F.de, 'data-f-de')}</div>
        <div class="field"><span class="field-label">Entra en</span>${opts(cuentasActivas().filter(x => String(x.id) !== String(F.de)).map(x => [x.id, esc(x.nombre)]), F.a, 'data-f-a')}</div>
        ${camposSalida()}
        <div class="field-hint">No es gasto ni ingreso: solo cambia dónde está el dinero.</div>`;
      boton = 'Mover';
    }
    if(F.t === 'mov'){
      const m = D.movs.find(x => x.id === F.id);
      if(!m){ F = null; cerrarHoja('sheetForm', true); return; }
      $('formTitulo').textContent = nomMov(m);
      const c = cta(m.cuenta), p = prov(m.prov);
      h = `<div class="d-datos"><div class="d-dato"><span>Fecha</span><b>${fecha(m.fecha)}</b></div><div class="d-dato"><span>Registró</span><b>${esc(m.por || 'Sin nombre')}</b></div>
        ${c ? `<div class="d-dato"><span>Cuenta</span><b>${esc(c.nombre)}</b></div>` : ''}${p ? `<div class="d-dato"><span>Proveedor</span><b>${esc(p.nombre)}</b></div>` : ''}
        ${m.salio != null ? `<div class="d-dato"><span>Salió</span><b>${dinero(m.salio)}</b></div>` : ''}${m.llego != null && Number(m.comision) ? `<div class="d-dato"><span>Llegó o se pagó</span><b>${dinero(m.llego)}</b></div>` : ''}
        ${m.bs ? `<div class="d-dato"><span>Bolívares</span><b>${esc(bsTxt(m.bs))} a ${esc(m.tasa)}${m.tasa_origen ? ' (' + esc(m.tasa_origen) + ')' : ''}</b></div>` : ''}
        <div class="d-dato" style="grid-column:1/-1"><span>Detalle</span><b style="white-space:normal">${esc([m.ref, m.nota].filter(Boolean).join(' · ') || 'Sin detalle')}</b></div></div>
        ${m.comp ? '<button class="btn-secondary" type="button" data-ver-comp style="width:100%;margin-top:10px">Ver comprobante</button>' : ''}
        ${m.anulado ? `<div class="caja-rara">Anulado el ${fecha(m.anulado.fecha)} por ${esc(m.anulado.por)}: ${esc(m.anulado.motivo)}</div>` :
        `<div class="field" id="campoMotivo" style="margin-top:14px"><label class="field-label" for="fMotivo">Si está mal, anúlalo con un motivo</label><input class="input" id="fMotivo" value=""><div class="field-error">Escribe el motivo</div><div class="field-hint">No se borra: queda tachado en la lista y el saldo se corrige.${m.compra ? ' Una compra se anula desde Depósito › Compras.' : ''}</div></div>`}`;
      boton = m.anulado || m.compra ? 'Listo' : 'Anular movimiento';
    }
    $('formBody').innerHTML = h; $('btnForm').textContent = boton;
  }
  function ordenCuentas(metodo){
    const m = metodo === 'Bolívares' ? 'Bolívares' : metodo;
    return cuentasActivas().filter(c => c.tipo === m).concat(cuentasActivas().filter(c => c.tipo !== m));
  }
  function cajaSaldo(){
    const p = prov(F.prov); if(!p) return '';
    const antes = saldoProv(F.prov), c = F.cuenta ? cta(F.cuenta) : null;
    let m = numLibre(F.menos ? F.llego : F.monto);
    if(!F.menos && c && c.moneda === 'VES'){ const bs = numLibre(F.bs), t = numLibre(F.tasa); m = bs > 0 && t > 0 ? bs / t : NaN; }
    const desp = antes + (m > 0 ? m : 0);
    return `<span>Saldo con ${esc(p.nombre)}</span>${saldoTxt(antes).corto} ${dinero(Math.abs(antes))} → después de esta transferencia: <b>${saldoTxt(desp).corto.toLowerCase()} ${dinero(Math.abs(desp))}</b>`;
  }
  const CAMPOS = { fMonto:'monto', fLlego:'llego', fBs:'bs', fTasa:'tasa', fRef:'ref', fFecha:'fecha', fNuevo:'nuevo', fMotivo:'motivo', fNom:'nombre', fRif:'rif', fTel:'telefono', fCatOtro:'catOtro', fPago:'datos_pago' };
  function leerCampos(){ Object.keys(CAMPOS).forEach(id => { const el = $(id); if(el) F[CAMPOS[id]] = el.value; }); }
  async function subirComp(blob){
    const path = `finanzas/${hoy().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db.storage.from('comprobantes').upload(path, blob, { contentType:'image/jpeg' });
    if(error) throw new Error('No se pudo subir el comprobante. Revisa el internet.');
    return path;
  }
  const sinGuion = (o) => { const x = {}; Object.keys(o).forEach(k => { if(k[0] !== '_') x[k] = o[k]; }); return x; };
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if(error) throw error; return data; };

  async function guardarForm(){
    if(!F || F.guardando) return;
    leerCampos();
    const err = (msg) => { toast(msg, 'error'); return false; };
    const btn = $('btnForm');
    // Validaciones antes de tocar la base
    let accion = null, ok = '';
    if(F.t === 'transferencia'){
      if(F.elegirProv && !F.prov && !F.luego) return err('Elige a quién le pagaste');
      if(!F.cuenta) return err('Elige de qué cuenta salió');
      const m = montosSalida(); if(!m) return false;
      accion = async () => {
        const comp = F.fotoBlob ? await subirComp(F.fotoBlob) : null;
        const r = await rpc('transferencia_guardar', { p:Object.assign({ cuenta_id:+F.cuenta, proveedor_id:F.prov ? +F.prov : null, referencia:F.ref || null, fecha:F.fecha || null, comprobante:comp }, sinGuion(m)) });
        return F.prov ? `Transferencia guardada. ${saldoTxt(r.saldo_proveedor).corto}: ${dinero(Math.abs(r.saldo_proveedor))}` : 'Pago guardado. Queda por ubicar hasta que digas a quién fue.';
      };
    }
    if(F.t === 'confirmar'){
      if(!F.llego) return err('Dime si llegó');
      if(F.llego === 'no'){
        if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; }
        accion = async () => { await rpc('pago_confirmar_y_ubicar', { aid:F.abono, llego:false, nota:F.motivo.trim(), p:{} }); return 'Marcado: el pago no llegó. La vendedora recibe el aviso.'; };
      } else {
        if(!F.destino) return err('Elige dónde quedó');
        if(F.destino === 'cuenta' && !F.cuenta) return err('Elige la cuenta');
        if(F.destino === 'prov' && !F.prov) return err('Elige el proveedor');
        const p = F.destino === 'cuenta' ? { cuenta_id:+F.cuenta } : F.destino === 'prov' ? { proveedor_id:+F.prov } : {};
        accion = async () => { const r = await rpc('pago_confirmar_y_ubicar', { aid:F.abono, llego:true, nota:null, p }); return 'Pago confirmado' + (r && r.produccion ? '. El pedido pasó a producción.' : '.') + (F.destino === 'luego' ? ' Queda por ubicar.' : ''); };
      }
    }
    if(F.t === 'ubicar'){
      const a = porUbicar().find(x => x.id === F.abono), dev = a && a.tipo === 'devolucion';
      if(!dev && !F.destino) return err('Elige dónde quedó');
      if((dev || F.destino === 'cuenta') && !F.cuenta) return err('Elige la cuenta');
      if(!dev && F.destino === 'prov' && !F.prov) return err('Elige el proveedor');
      const p = (dev || F.destino === 'cuenta') ? { cuenta_id:+F.cuenta } : { proveedor_id:+F.prov };
      accion = async () => { await rpc('pago_ubicar', { aid:F.abono, p }); return p.proveedor_id ? 'Listo: quedó a tu favor con ' + prov(F.prov).nombre : 'Listo: quedó en ' + cta(F.cuenta).nombre; };
    }
    if(F.t === 'ubicarMov'){
      const m = D.movs.find(x => x.id === F.id);
      if(m.cuenta && !F.prov) return err('Elige el proveedor');
      if(!m.cuenta && !F.cuenta) return err('Elige la cuenta');
      accion = async () => { await rpc('movimiento_ubicar', { mid:F.id, p:m.cuenta ? { proveedor_id:+F.prov } : { cuenta_id:+F.cuenta } }); return 'Listo: quedó ubicado'; };
    }
    if(F.t === 'ajuste'){
      if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; }
      let n = F.signo === 'cero' ? 0 : numLibre(F.nuevo);
      if(!(n >= 0)) return err('Escribe el monto');
      if(F.prov && F.signo === 'debe') n = -n;
      accion = async () => { const r = await rpc('saldo_cambiar', { p:{ cuenta_id:F.cuenta ? +F.cuenta : null, proveedor_id:F.prov ? +F.prov : null, nuevo:n, motivo:F.motivo.trim() } }); return Number(r.diferencia) ? 'Saldo cambiado. Quedó en el historial.' : 'El saldo ya era ese'; };
    }
    if(F.t === 'proveedor'){
      if(!String(F.nombre || '').trim()){ $('campoNom').classList.add('invalid'); return false; }
      if(!(F.tipos || []).length){ $('campoTipos').classList.add('invalid'); return false; }
      accion = async () => {
        const r = await rpc('proveedor_guardar', { p:{ id:F.id || null, nombre:F.nombre.trim(), rif:F.rif || '', telefono:F.telefono || '', cobra_iva:!!F.iva, tipos:F.tipos.slice(), datos_pago:F.datos_pago || '', activo:F.activo !== false } });
        F.nuevoId = F.id ? null : r.id;
        return F.id ? 'Proveedor guardado' : 'Proveedor agregado. Ponle su saldo con "Cambiar saldo".';
      };
    }
    if(F.t === 'cuenta'){
      if(!String(F.nombre || '').trim()){ $('campoNom').classList.add('invalid'); return false; }
      if(!F.tipo){ $('campoTipoCta').classList.add('invalid'); return false; }
      accion = async () => { await rpc('cuenta_guardar', { p:{ id:F.id || null, nombre:F.nombre.trim(), tipo:F.tipo, activa:F.activa !== false } }); return F.id ? 'Cuenta guardada' : 'Cuenta agregada. Ponle su saldo con "Cambiar saldo".'; };
    }
    if(F.t === 'gasto'){
      const cat = F.cat === 'Otro' ? (F.catOtro || '').trim() : F.cat;
      if(!cat) return err('Elige qué gasto es'); if(!F.cuenta) return err('Elige la cuenta');
      const m = montosSalida(); if(!m) return false;
      accion = async () => { await rpc('gasto_guardar', { p:Object.assign({ cuenta_id:+F.cuenta, categoria:cat, fecha:F.fecha || null }, sinGuion(m)) }); return 'Gasto guardado'; };
    }
    if(F.t === 'traspaso'){
      if(!F.de || !F.a) return err('Elige las dos cuentas');
      const m = montosSalida(); if(!m) return false;
      accion = async () => { await rpc('traspaso_guardar', { p:Object.assign({ de:+F.de, a:+F.a }, sinGuion(m)) }); return 'Listo: se movió ' + dinero(m.monto_llego || m._salio); };
    }
    if(F.t === 'mov'){
      const m = D.movs.find(x => x.id === F.id);
      if(!m.anulado && !m.compra){
        if(!String(F.motivo || '').trim()){ $('campoMotivo').classList.add('invalid'); return false; }
        accion = async () => { await rpc('movimiento_anular', { mid:m.id, motivo:F.motivo.trim() }); return 'Movimiento anulado. El saldo se corrigió.'; };
      }
    }
    if(!accion){ cerrarHoja('sheetForm', true); F = null; return true; }
    F.guardando = true; btn.disabled = true;
    try{
      ok = await accion();
      const nuevo = F.t === 'proveedor' ? F.nuevoId : null;
      cerrarHoja('sheetForm', true); F = null;
      toast(ok);
      await recargar();
      if(nuevo){ tab = 'prov'; pintar(); abrirDetalle('prov', nuevo); }
      return true;
    } catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { if(F) F.guardando = false; btn.disabled = false; }
  }

  // ================= Estado de cuenta en PDF (dos columnas: movimiento y monto con + o −) =================
  async function pdfEstado(t, id, desde, hasta){
    const esProv = t === 'prov', x = esProv ? prov(id) : cta(id), campo = esProv ? 'ep' : 'ec';
    const todos = (esProv ? movsProv(id) : movsCuenta(id)).filter(m => !m.anulado);
    const d0 = desde || null, d1 = hasta || null;
    const antes = d0 ? r2(todos.filter(m => String(m.fecha) < d0).reduce((a, m) => a + Number(m[campo] || 0), 0)) : 0;
    const lista = todos.filter(m => (!d0 || String(m.fecha) >= d0) && (!d1 || String(m.fecha) <= d1));
    const fin = r2(antes + lista.reduce((a, m) => a + Number(m[campo] || 0), 0));
    const f = (n, v) => ({ t:'fila', a:n, b:(v < -0.005 ? '- ' : v > 0.005 ? '+ ' : '') + dinero(Math.abs(v)), rojo:v < -0.005 });
    const b = [{ t:'titulo', texto:esProv ? x.nombre + (x.rif ? ' · RIF ' + x.rif : '') : x.nombre + ' · ' + x.tipo, der:'Monto' }];
    if(d0) b.push(f('Saldo al ' + fecha(d0), antes));
    lista.forEach(m => { const o = esProv ? cta(m.cuenta) : prov(m.prov); b.push(f(fecha(m.fecha) + ' · ' + nomMov(m) + (m.ref ? ' · ' + m.ref : '') + (o ? ' · ' + o.nombre : '') + (m.bs ? ' · ' + bsTxt(m.bs) + ' a ' + m.tasa : ''), Number(m[campo] || 0))); });
    if(!lista.length) b.push({ t:'nota', texto:'Sin movimientos en estas fechas.' });
    b.push({ t:'total', a:esProv ? (fin > 0.005 ? 'Saldo a favor de Herrería Artesanos' : fin < -0.005 ? 'Herrería Artesanos debe' : 'Saldo al día') : 'Saldo final', b:dinero(Math.abs(fin)) });
    b.push({ t:'nota', texto:esProv ? '+ es lo que le pagamos (suma a nuestro favor) y - lo que le compramos.' : '+ entra a la cuenta y - sale de la cuenta.' });
    if(esProv) b.push({ t:'firmas', a:'Herrería Artesanos', b:x.nombre });
    const sub = (d0 || d1) ? 'Del ' + (d0 ? fecha(d0) : 'inicio') + ' al ' + (d1 ? fecha(d1) : fecha(hoy())) : 'Todos los movimientos';
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear({ titulo:'Estado de cuenta', derecha:'Emitido el ' + fecha(hoy()), subtitulo:sub, bloques:b });
      const r = await window.PDFR.compartir(blob, 'Estado-de-cuenta-' + String(x.nombre).replace(/[^A-Za-z0-9]+/g, '-') + '.pdf'); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }
  // Hoja para elegir las fechas del estado de cuenta (semana, mes, rango o todo)
  function abrirPdf(t, id){
    const x = t === 'prov' ? prov(id) : cta(id);
    $('pdfTitulo').textContent = 'Estado de cuenta';
    PDFSEL = { t, id, rango:'todo' };
    pintarPdf(x);
    abrirHoja('sheetPdf');
  }
  let PDFSEL = null;
  function rangoFechas(r){
    const h = hoy(), d = new Date(h + 'T12:00:00');
    if(r === 'semana'){ const l = new Date(d); l.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [l.toISOString().slice(0, 10), h]; }
    if(r === 'mes') return [h.slice(0, 8) + '01', h];
    if(r === 'mesant'){ const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), z = new Date(d.getFullYear(), d.getMonth(), 0); const f = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); return [f(a), f(z)]; }
    if(r === 'rango') return [PDFSEL.desde || null, PDFSEL.hasta || null];
    return [null, null];
  }
  function pintarPdf(x){
    const s = PDFSEL;
    $('pdfBody').innerHTML = `<p class="mat-s" style="margin:0 2px 12px;font-size:14px">${esc(x.nombre)}. Elige las fechas. El PDF lleva cada movimiento con su fecha, el saldo al inicio y el saldo final.</p>
      <div class="field"><span class="field-label">¿De cuándo?</span>${opts([['semana', 'Esta semana'], ['mes', 'Este mes'], ['mesant', 'Mes pasado'], ['todo', 'Todo'], ['rango', 'Otras fechas']], s.rango, 'data-pdf-rango', 2)}</div>
      ${s.rango === 'rango' ? `<div class="input-row"><div class="field"><label class="field-label" for="pDesde">Desde</label><input class="input" type="date" id="pDesde" max="${hoy()}" value="${esc(s.desde || '')}"></div><div class="field"><label class="field-label" for="pHasta">Hasta</label><input class="input" type="date" id="pHasta" max="${hoy()}" value="${esc(s.hasta || hoy())}"></div></div>` : ''}`;
    $('btnCompartirPdf').textContent = 'Hacer el PDF';
  }

  async function verComprobante(path){
    const { data, error } = await db.storage.from('comprobantes').createSignedUrl(path, 600);
    if(error || !data){ toast('No se pudo abrir el comprobante', 'error'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  // ================= Eventos =================
  document.addEventListener('click', (e) => {
    if(!D) return;
    const t = e.target.closest('[data-tab]'); if(t && t.closest('#tabs')){ tab = t.dataset.tab; pintar(); window.scrollTo(0, 0); return; }
    const ir = e.target.closest('[data-ir]');
    if(ir){ const k = ir.dataset.ir; if(k === 'prov'){ tab = 'prov'; pintar(); window.scrollTo(0, 0); } else { const el = $('sec-' + k); if(el) el.scrollIntoView({ block:'start', behavior:'smooth' }); } return; }
    const pr = e.target.closest('[data-pdf-rango]'); if(pr && PDFSEL){ PDFSEL.rango = pr.dataset.pdfRango; pintarPdf(PDFSEL.t === 'prov' ? prov(PDFSEL.id) : cta(PDFSEL.id)); return; }
    if(F){
      const set = (attr, campo) => { const b = e.target.closest('[' + attr + ']'); if(b && b.closest('#formBody')){ leerCampos(); F[campo] = b.getAttribute(attr); pintarForm(); return true; } return false; };
      const fp = e.target.closest('[data-f-prov]'); if(fp && fp.closest('#formBody')){ leerCampos(); if(fp.dataset.fProv === 'luego'){ F.prov = null; F.luego = true; } else { F.prov = fp.dataset.fProv; F.luego = false; } pintarForm(); return; }
      if(set('data-f-llego', 'llego')) return;
      if(set('data-f-cuenta', 'cuenta') || set('data-f-destino', 'destino') || set('data-f-signo', 'signo') || set('data-f-cat', 'cat') || set('data-f-de', 'de') || set('data-f-a', 'a') || set('data-f-origen', 'origen') || set('data-f-tipocta', 'tipo')) return;
      const mn = e.target.closest('[data-f-menos]'); if(mn){ leerCampos(); F.menos = !F.menos; pintarForm(); return; }
      const iv = e.target.closest('[data-f-iva]'); if(iv){ leerCampos(); F.iva = iv.dataset.fIva === 'si'; return pintarForm(); }
      const ac = e.target.closest('[data-f-activo]'); if(ac){ leerCampos(); F.activo = ac.dataset.fActivo === 'si'; return pintarForm(); }
      const aa = e.target.closest('[data-f-activa]'); if(aa){ leerCampos(); F.activa = aa.dataset.fActiva === 'si'; return pintarForm(); }
      const tc = e.target.closest('[data-f-tipo]'); if(tc){ leerCampos(); const k = tc.dataset.fTipo; F.tipos = (F.tipos || []).includes(k) ? F.tipos.filter(x => x !== k) : (F.tipos || []).concat(k); return pintarForm(); }
      const vc = e.target.closest('[data-ver-comp]'); if(vc){ const m = D.movs.find(x => x.id === F.id); if(m && m.comp) verComprobante(m.comp); return; }
    }
    const pv = e.target.closest('[data-prov]'); if(pv && !pv.closest('#formBody')) return abrirDetalle('prov', pv.dataset.prov);
    const cu = e.target.closest('[data-cuenta]'); if(cu) return abrirDetalle('cuenta', cu.dataset.cuenta);
    const cf = e.target.closest('[data-confirmar]'); if(cf) return abrirConfirmar(+cf.dataset.confirmar);
    const ub = e.target.closest('[data-ubicar]'); if(ub) return abrirForm({ t:'ubicar', abono:+ub.dataset.ubicar, destino:null });
    const um = e.target.closest('[data-ubicar-mov]'); if(um) return abrirForm({ t:'ubicarMov', id:+um.dataset.ubicarMov });
    const tr = e.target.closest('[data-transferir]'); if(tr) return abrirForm({ t:'transferencia', prov:tr.dataset.transferir, cuenta:null });
    const sa = e.target.closest('[data-salida]'); if(sa) return abrirForm({ t:'transferencia', prov:null, cuenta:sa.dataset.salida, elegirProv:true });
    const tp = e.target.closest('[data-traspaso]'); if(tp) return abrirForm({ t:'traspaso', de:tp.dataset.traspaso || null, a:null });
    const ap = e.target.closest('[data-ajustar-prov]'); if(ap){ const s = saldoProv(ap.dataset.ajustarProv); return abrirForm({ t:'ajuste', prov:ap.dataset.ajustarProv, signo:s > 0.005 ? 'favor' : s < -0.005 ? 'debe' : 'cero', nuevo:Math.abs(s) || '' }); }
    const acu = e.target.closest('[data-ajustar-cuenta]'); if(acu) return abrirForm({ t:'ajuste', cuenta:acu.dataset.ajustarCuenta, signo:'favor', nuevo:saldoCuenta(acu.dataset.ajustarCuenta) });
    const ep = e.target.closest('[data-editar-prov]'); if(ep){ const p = prov(ep.dataset.editarProv); return abrirForm(Object.assign({ t:'proveedor' }, JSON.parse(JSON.stringify(p)), { telefono:p.telefono || '', rif:p.rif || '' })); }
    const ec = e.target.closest('[data-editar-cuenta]'); if(ec){ const c = cta(ec.dataset.editarCuenta); return abrirForm({ t:'cuenta', id:c.id, nombre:c.nombre, tipo:c.tipo, activa:c.activa }); }
    if(e.target.closest('[data-nueva-cuenta]')) return abrirForm({ t:'cuenta', nombre:'', tipo:null });
    if(e.target.closest('[data-nuevo-prov]') || e.target.closest('#btnNuevoProv')) return abrirForm({ t:'proveedor', nombre:'', tipos:[], iva:true });
    const gc = e.target.closest('[data-gasto-cat]'); if(gc) return abrirForm({ t:'gasto', cat:gc.dataset.gastoCat, monto:(D.gastosFijos.find(g => g.cat === gc.dataset.gastoCat) || {}).monto });
    if(e.target.closest('[data-nuevo-gasto]') || e.target.closest('#btnNuevoGasto')) return abrirForm({ t:'gasto', cat:null });
    const mv = e.target.closest('[data-mov]'); if(mv) return abrirForm({ t:'mov', id:+mv.dataset.mov });
    const pd = e.target.closest('[data-pdf]'); if(pd) return abrirPdf('prov', pd.dataset.pdf);
    const pc = e.target.closest('[data-pdf-cuenta]'); if(pc) return abrirPdf('cuenta', pc.dataset.pdfCuenta);
    const cq = e.target.closest('[data-cuadrar]'); if(cq){ cuadrar(cq.dataset.cuadrar); return; }
  });
  async function cuadrar(id){
    const p = prov(id); if(!p) return;
    try{ await rpc('proveedor_cuadrar', { pid:+id, p_saldo:saldoProv(id) }); toast('Marcado como cuadrado hoy con ' + p.nombre); await recargar(); }
    catch(e){ toast(errTxt(e), 'error'); }
  }
  async function abrirConfirmar(aid){
    const a = D.porConfirmar.find(x => x.id === aid); if(!a) return;
    abrirForm({ t:'confirmar', abono:aid, llego:null, destino:null });
    if(a.comprobante){
      const { data } = await db.storage.from('comprobantes').createSignedUrl(a.comprobante, 600).catch(() => ({}));
      if(F && F.abono === aid && data && data.signedUrl){ F.compUrl = data.signedUrl; leerCampos(); pintarForm(); }
    }
  }
  document.addEventListener('input', (e) => {
    if(F && F.t === 'transferencia' && ['fMonto','fLlego','fBs','fTasa'].includes(e.target.id)){ leerCampos(); const caja = $('cajaSaldo'); if(caja) caja.innerHTML = cajaSaldo(); }
    if(PDFSEL && e.target.id === 'pDesde') PDFSEL.desde = e.target.value;
    if(PDFSEL && e.target.id === 'pHasta') PDFSEL.hasta = e.target.value;
  });
  document.addEventListener('change', async (e) => {
    if(e.target.id === 'fFoto' && F && e.target.files && e.target.files[0]){
      try{ leerCampos(); F.fotoBlob = await comprimirFoto(e.target.files[0], 1600, 0.72); pintarForm(); }
      catch(err){ toast('No se pudo leer la foto', 'error'); }
    }
  });
  $('btnForm').onclick = guardarForm;
  $('btnCompartirPdf').onclick = () => {
    if(!PDFSEL) return;
    const [d0, d1] = rangoFechas(PDFSEL.rango);
    if(PDFSEL.rango === 'rango' && (!d0 || !d1)) return toast('Elige las dos fechas', 'error');
    if(d0 && d1 && d0 > d1) return toast('La fecha "desde" va antes de "hasta"', 'error');
    pdfEstado(PDFSEL.t, PDFSEL.id, d0, d1);
  };
  ancho.addEventListener('change', pintar);

  // Para Finanzas › Mes y los reportes (lotes 10 y 10b)
  window.FIN = { get datos(){ return D; }, prov, cta, saldoCuenta, saldoProv, movsCuenta, movsProv, nomMov, reporte, signo, opts, fecha, hoy, mesActual, r2, bsTxt, errTxt, pintar, recargar, get ventasMes(){ return VENTAS_MES; }, get costos(){ return COSTOS; } };

  (async () => {
    const perfil = await window.Sesion.requerir();
    if(!perfil) return;
    if(!perfil.confirma_abonos){ $('cont').innerHTML = '<div class="caja-amar" style="margin:16px 18px">Finanzas es solo para Ray o Gualfredo.</div>'; return; }
    $('cont').innerHTML = '<p class="mat-s" style="margin:24px 18px">Cargando…</p>';
    try{ await cargar(); }
    catch(e){ $('cont').innerHTML = `<div class="caja-amar" style="margin:16px 18px">${esc(errTxt(e))}</div><div style="margin:0 18px"><button class="btn-secondary" type="button" onclick="location.reload()">Reintentar</button></div>`; return; }
    pintar();
    const q = new URLSearchParams(location.search);
    if(q.get('prov') && prov(q.get('prov'))){ tab = 'prov'; pintar(); abrirDetalle('prov', q.get('prov')); }
    if(q.get('cuenta') && cta(q.get('cuenta'))) abrirDetalle('cuenta', q.get('cuenta'));
    if(q.get('confirmar')){ const pc = D.porConfirmar; const a = pc.find(x => String(x.id) === q.get('confirmar')) || pc[0]; if(a) abrirConfirmar(a.id); }
    if(q.get('ubicar')){ const ub = porUbicar(); if(ub.length) abrirForm({ t:'ubicar', abono:ub[0].id, destino:null }); else { const sm = salidasPorUbicar(); if(sm.length) abrirForm({ t:'ubicarMov', id:sm[0].id }); } }
  })();
})();
