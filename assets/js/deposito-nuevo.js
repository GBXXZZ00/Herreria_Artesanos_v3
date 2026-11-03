// Depósito › Fabricación (barras y hojas, retazos con su medida, conteo) y Compras (facturas y notas,
// a mano o solo con el total y el material "por registrar"). Solo el administrador.
// Lo que se corta cada sábado vive en Costos › Semana (sale de lo asignado en Producción).
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const ini = (t) => String(t).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const TIPO = { hierro:'Hierro', laminas:'Láminas', vidrio:'Vidrio', aluminio:'Aluminio', pintura:'Pintura y masilla', consumibles:'Consumibles', accesorios:'Accesorios', madera:'Madera' };
  const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const fmtM = (cm) => (cm / 100).toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' m';
  const fecha = (iso) => { if(!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}/${+m}/${a}`; };
  const hoyIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const num = (v) => { const s = String(v == null ? '' : v).trim(); if(!s) return NaN; if(/,\d{1,2}$/.test(s)) return parseFloat(s.replace(/\./g, '').replace(',', '.')); const n = parseFloat(s.replace(/,/g, '')); return isFinite(n) ? n : NaN; };
  const st = (s) => s > 0.005 ? { cls:'s-favor', t:'A tu favor' } : s < -0.005 ? { cls:'s-debe', t:'Le debes' } : { cls:'', t:'Al día' };
  const saldoTxt = (s) => `${st(s).t}${Math.abs(s) > 0.005 ? ' ' + dinero(Math.abs(s)) : ''}`;
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if(error) throw error; return data; };
  const sabTxt = (iso) => { try{ return window.AH.sabadoCorto(iso); } catch(e){ return iso; } };

  let D = null, NEC = {}, cargando = null;
  const prov = (id) => D.proveedores.find(p => String(p.id) === String(id));
  const mat = (id) => D.fab.find(f => String(f.id) === String(id));
  async function cargar(){
    D = await rpc('deposito_fab_datos');
    NEC = {};
    if(window.CORTE){ try{ NEC = await window.CORTE.necesita(); } catch(e){ NEC = {}; } }
  }
  function asegurar(pintarFn){
    if(D) return true;
    $('cont').innerHTML = '<p class="mat-s" style="margin:24px 18px">Cargando…</p>';
    if(!cargando) cargando = cargar().then(() => { cargando = null; pintarFn(); }).catch(e => { cargando = null; $('cont').innerHTML = `<div class="caja-amar" style="margin:16px 0">${esc(errTxt(e))}</div><button class="btn-secondary" type="button" data-dn-reintentar>Reintentar</button>`; });
    return false;
  }
  async function recargar(){ await cargar(); const t = window.Deposito && window.Deposito.tab; if(t === 'fab') pintarFab(); else if(t === 'compras') pintarCompras(); }

  // ================= Fabricación: lo que hay, por tubo =================
  const retazosHtml = (f) => (f.retazos || []).length ? `<span class="ret-l">${f.retazos.map(r => `<span class="ret-c">${r.ancho ? r.largo + ' × ' + r.ancho : r.largo} cm</span>`).join('')}</span>` : '';
  function pintarFab(){
    if(!asegurar(pintarFab)) return;
    const sab = NEC._sab || null;
    const falta = Object.keys(NEC).filter(k => k[0] !== '_').reduce((a, k) => a + (NEC[k].este ? NEC[k].este.falta : 0), 0);
    const barras = D.fab.filter(f => f.pres === 'barra').reduce((a, f) => a + f.stock, 0), rets = D.fab.reduce((a, f) => a + (f.retazos || []).length, 0);
    $('subtitulo').textContent = !sab ? 'Barras, hojas y retazos' : falta ? 'Faltan ' + plural(falta, '1 barra u hoja', 'barras u hojas') + ' para el ' + sabTxt(sab) : 'Hay material para el ' + sabTxt(sab);
    let h = `<div class="res">
      ${sab ? `<div class="res-c ${falta ? 'rojo' : 'ok'}"><span>Para el ${esc(sabTxt(sab))}</span><b>${falta ? 'Faltan ' + falta : 'Alcanza'}</b></div>` : ''}
      <div class="res-c"><span>Barras y retazos</span><b>${esc(barras)} · ${esc(rets)}</b></div></div>`;
    if(falta) h += `<a class="caja-amar" style="display:block;text-decoration:none;margin:0 0 12px" href="costos.html?tab=semana&para=${esc(sab)}">Faltan ${plural(falta, '1 barra u hoja', 'barras u hojas')} para lo asignado al ${esc(sabTxt(sab))}. Ver el plan de corte y qué comprar →</a>`;
    if(D.conteo){ const n = (D.conteo.diferencias || []).length; h += `<div class="${n ? 'caja-rara' : 'caja-ok'}" style="margin:0 0 12px">Último conteo: ${fecha(D.conteo.fecha)} · ${esc(D.conteo.por)}. ${n ? plural(n, '1 diferencia', 'diferencias') + ': ' + D.conteo.diferencias.map(x => `${esc(x.nombre)} decía ${x.antes}, había ${x.contado}`).join('. ') : 'Todo cuadró.'}</div>`; }
    if(!D.fab.length) h += '<p class="mat-s" style="margin:8px 2px">Todavía no hay material de fabricación.</p>';
    [['hierro', 'Tubos, platinas y marcos'], ['laminas', 'Láminas'], ['vidrio', 'Vidrio'], ['aluminio', 'Aluminio']].forEach(([t, tit]) => {
      const L = D.fab.filter(f => f.tipo === t && f.activo); if(!L.length) return;
      h += `<div class="tit">${tit}</div><div class="mat-lista ya">` + L.map(f => {
        const x = NEC[f.id] && NEC[f.id].este, fp = NEC[f.id] && NEC[f.id].proximo;
        const pill = x && x.falta ? `<span class="pill rojo">Faltan ${x.falta}</span>` : x ? '<span class="pill verde">Alcanza</span>' : '';
        const med = f.pres === 'barra' ? 'Barra de ' + fmtM(f.largo) : 'Hoja ' + f.hoja[0] + ' × ' + f.hoja[1] + ' cm';
        return `<button class="mat ${x && x.falta ? 'bajo' : ''}" type="button" data-fab="${f.id}">
          <span class="mat-ico fab">${esc(ini(f.nombre))}</span>
          <span style="min-width:0"><span class="mat-t">${esc(f.nombre)}</span>
            <span class="mat-s">${esc(med)}${x && f.pres === 'barra' && x.usa ? ' · el ' + esc(sabTxt(sab)) + ' usa ' + x.usa : ''}${fp && fp.falta ? ' · próximo sáb faltan ' + fp.falta : ''} ${pill}</span>
            ${retazosHtml(f)}</span>
          <span class="mat-n"><b>${esc(f.stock)}</b><span>${f.pres === 'barra' ? (f.stock === 1 ? 'barra' : 'barras') : (f.stock === 1 ? 'hoja' : 'hojas')}</span></span>
        </button>`; }).join('') + '</div>';
    });
    const apagados = D.fab.filter(f => !f.activo);
    if(apagados.length) h += `<p class="mat-s" style="margin:8px 2px">${plural(apagados.length, '1 material apagado', 'materiales apagados')}: ${apagados.map(f => `<button class="link-btn" type="button" data-fab="${f.id}">${esc(f.nombre)}</button>`).join(', ')}</p>`;
    h += `<button class="btn-nuevo" type="button" data-fab-nuevo>+ Agregar material de fabricación</button>
      <button class="btn-secondary" type="button" data-pdf-existencias style="width:100%;margin-top:10px">Existencias en PDF</button>
      <p class="mat-s" style="margin:8px 2px 0">Las barras suben con cada compra y bajan cuando en Costos › Semana se marca que el herrero ya cortó. Los retazos de 50 cm o más quedan anotados con su medida y el plan siguiente los usa primero.</p>`;
    $('cont').innerHTML = h;
  }
  let FM = null;   // material abierto o en edición
  function abrirFab(id){
    const f = mat(id); if(!f) return;
    FM = { id:f.id, editar:false, retazo:false };
    pintarFicha(); abrirHoja('sheetFab');
  }
  function pintarFicha(){
    const f = mat(FM.id); if(!f) return;
    if(FM.editar) return pintarFormMat(f);
    const x = NEC[f.id] && NEC[f.id].este, sab = NEC._sab, hoja = f.pres === 'hoja';
    const movs = D.movs.filter(m => m.mid === f.id).slice(0, 20);
    const precios = Object.entries(f.precios || {}).map(([pid, v]) => ({ p:prov(pid), v })).filter(x2 => x2.p);
    $('fabTitulo').textContent = f.nombre;
    $('fabBody').innerHTML = `
      <div class="bento">
        <div class="res-c"><span>En depósito</span><b>${esc(f.stock)}</b></div>
        <div class="res-c"><span>${sab ? 'Usa el ' + esc(sabTxt(sab)) : 'Medida'}</span><b>${sab ? (x ? (hoja ? (x.m2 || 0).toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m²' : esc(x.usa || 0)) : 0) : (hoja ? f.hoja[0] + '×' + f.hoja[1] : fmtM(f.largo))}</b></div>
        <div class="res-c ${x && x.falta ? 'rojo' : 'ok'}"><span>Falta</span><b>${x ? esc(x.falta) : 0}</b></div>
      </div>
      <div class="tit">${hoja ? 'Sobrantes útiles' : 'Retazos útiles'}</div>
      ${(f.retazos || []).length ? `<div class="ret-l">${f.retazos.map(r => `<button class="ret-c" type="button" data-ret-quitar="${r.id}" aria-label="Quitar ${esc(r.largo)} cm">${r.ancho ? r.largo + ' × ' + r.ancho : r.largo} cm ×</button>`).join('')}</div><p class="mat-s" style="margin:4px 2px 0">Toca uno para quitarlo si ya no está.</p>` : '<p class="mat-s" style="margin:0 2px">Ninguno</p>'}
      ${FM.retazo ? `<div class="input-row" style="margin-top:10px"><div class="field"><label class="field-label" for="rLargo">Largo en cm</label><input class="input" id="rLargo" inputmode="decimal"></div>${hoja ? '<div class="field"><label class="field-label" for="rAncho">Ancho en cm</label><input class="input" id="rAncho" inputmode="decimal"></div>' : ''}</div>
        <button class="btn-primary" type="button" data-ret-guardar style="width:100%">Guardar ${hoja ? 'sobrante' : 'retazo'}</button>`
        : `<button class="btn-secondary" type="button" data-ret-nuevo style="width:100%;margin-top:10px">Anotar ${hoja ? 'un sobrante' : 'un retazo'}</button>`}
      <div class="tit">Precio sin IVA por proveedor</div>
      ${precios.length ? precios.map(({ p, v }) => `<div class="cg-fila"><div class="cg-nom">${esc(p.nombre)}<span>${v.esp ? esc(v.esp) + ' · ' : ''}desde ${fecha(v.desde)}</span></div><div style="text-align:right;font-weight:800">${dinero(v.p)}</div></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin precios todavía.</p>'}
      ${f.fijo ? `<p class="mat-s" style="margin:6px 2px 0">Para costear se usa el precio fijo ${dinero(f.fijo)}.</p>` : ''}
      ${sab ? `<a class="row-link" href="costos.html?tab=semana&para=${esc(sab)}" style="margin-top:12px"><span>Ver cómo se corta el ${esc(sabTxt(sab))}</span>${CHEV}</a>` : ''}
      <a class="row-link" href="costos.html?tab=precios&material=${f.id}"><span>Cambiar precios (en Costos)</span>${CHEV}</a>
      <div class="tit">Movimientos</div>
      ${movs.length ? movs.map(m => `<div class="mov"><span style="min-width:0"><span class="mov-t">${esc(m.ref || m.motivo)}</span><span class="mov-s">${new Date(m.fecha).toLocaleDateString('es-VE', { day:'numeric', month:'short' })} · ${esc(m.por)}</span></span><span class="mov-m ${m.n > 0 ? 'mas' : 'menos'}">${m.n > 0 ? '+' : ''}${m.n}</span></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin movimientos todavía.</p>'}
      <button class="btn-secondary" type="button" data-fab-editar style="width:100%;margin-top:14px">Editar material</button>`;
  }
  function pintarFormMat(f){
    const o = FM.form;
    $('fabTitulo').textContent = f ? 'Editar material' : 'Material nuevo';
    const op = (lista, val, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${String(val) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
    $('fabBody').innerHTML = `
      <div class="field" id="campoMNom"><label class="field-label" for="mNom">Nombre</label><input class="input" id="mNom" value="${esc(o.nombre || '')}"><div class="field-error">Escribe el nombre</div><div class="field-hint">Ejemplo: Tubo 1" x 3".</div></div>
      <div class="field"><span class="field-label">Tipo</span>${op([['hierro','Hierro'],['laminas','Láminas'],['vidrio','Vidrio'],['aluminio','Aluminio']], o.tipo, 'data-m-tipo', 2)}</div>
      <div class="field"><span class="field-label">Viene en</span>${op([['barra','Barra'],['hoja','Hoja']], o.pres, 'data-m-pres', 2)}</div>
      ${o.pres === 'hoja' ? `<div class="input-row"><div class="field"><label class="field-label" for="mAncho">Ancho de la hoja (cm)</label><input class="input" id="mAncho" inputmode="decimal" value="${esc(o.ancho || '')}"></div><div class="field"><label class="field-label" for="mAlto">Alto de la hoja (cm)</label><input class="input" id="mAlto" inputmode="decimal" value="${esc(o.alto || '')}"></div></div>`
        : `<div class="field"><label class="field-label" for="mLargo">Largo de la barra (cm)</label><input class="input" id="mLargo" inputmode="decimal" value="${esc(o.largo || '')}"><div class="field-hint">Las barras de 6 m son 600.</div></div>`}
      <div class="input-row"><div class="field"><label class="field-label" for="mEsp">Espesor</label><input class="input" id="mEsp" value="${esc(o.espesor || '')}"></div><div class="field"><label class="field-label" for="mFijo">Precio fijo para costear</label><input class="input" id="mFijo" inputmode="decimal" value="${esc(o.fijo || '')}"></div></div>
      <div class="field-hint" style="margin:-8px 2px 12px">El precio fijo es opcional. Si lo pones, Costos usa ese y no el de la compra.</div>
      ${f ? `<div class="field"><span class="field-label">¿Se sigue usando?</span>${op([['si','Sí'],['no','Ya no se usa']], o.activo === false ? 'no' : 'si', 'data-m-activo', 2)}</div>` : ''}
      <button class="btn-primary" type="button" data-m-guardar style="width:100%">Guardar material</button>`;
  }
  function leerMat(){ const v = (id) => { const el = $(id); return el ? el.value : undefined; }; const o = FM.form;
    [['mNom','nombre'],['mAncho','ancho'],['mAlto','alto'],['mLargo','largo'],['mEsp','espesor'],['mFijo','fijo']].forEach(([id, k]) => { const x = v(id); if(x !== undefined) o[k] = x; }); }
  async function guardarMat(){
    leerMat(); const o = FM.form;
    if(!String(o.nombre || '').trim()){ $('campoMNom').classList.add('invalid'); return; }
    if(!o.tipo) return toast('Elige el tipo', 'error');
    if(!o.pres) return toast('Elige si viene en barra u hoja', 'error');
    const p = { id:FM.id || null, nombre:o.nombre.trim(), tipo:o.tipo, presentacion:o.pres, espesor:o.espesor || null, precio_fijo:num(o.fijo) > 0 ? num(o.fijo) : null, activo:o.activo !== false };
    if(o.pres === 'barra'){ if(!(num(o.largo) > 0)) return toast('Escribe el largo de la barra', 'error'); p.largo_cm = num(o.largo); }
    else { if(!(num(o.ancho) > 0) || !(num(o.alto) > 0)) return toast('Escribe las medidas de la hoja', 'error'); p.hoja_ancho_cm = num(o.ancho); p.hoja_alto_cm = num(o.alto); }
    try{ const r = await rpc('material_fab_guardar', { p }); toast(FM.id ? 'Material guardado' : 'Material agregado. Ponle su precio en Costos › Precios.'); FM = { id:r.id, editar:false }; await recargar(); pintarFicha(); }
    catch(e){ toast(errTxt(e), 'error'); }
  }

  // ---------- Conteo de barras y hojas ----------
  function abrirConteo(){
    if(!D) return;
    $('conteoBody').innerHTML = `<p class="mat-s" style="margin:0 2px 8px;font-size:14px">Cuenta las barras y hojas enteras de cada material y escribe cuántas hay. La app compara con lo que tiene anotado.</p>
      ${D.fab.filter(f => f.activo).map(f => `<div class="cg-fila"><div class="cg-nom">${esc(f.nombre)}<span>La app dice ${esc(f.stock)}</span></div><input class="input cg-in" id="cn-${f.id}" type="text" inputmode="numeric" value="${f.stock}" aria-label="Contadas de ${esc(f.nombre)}"></div>`).join('') || '<p class="mat-s">Todavía no hay material de fabricación.</p>'}`;
    abrirHoja('sheetConteo');
  }
  async function guardarConteo(){
    const conteo = [];
    for(const f of D.fab.filter(x => x.activo)){ const el = $('cn-' + f.id); if(!el) continue; const v = parseInt(el.value, 10); if(isNaN(v) || v < 0) return toast('Revisa lo contado de ' + f.nombre, 'error'); conteo.push({ material_id:f.id, contado:v }); }
    const btn = $('btnGuardarConteo'); btn.disabled = true;
    try{ const r = await rpc('conteo_guardar', { p:{ conteo } }); cerrarHoja('sheetConteo', true); const n = (r.diferencias || []).length; toast(n ? 'Conteo guardado con ' + plural(n, '1 diferencia', 'diferencias') : 'Conteo guardado. Todo cuadra.'); await recargar(); }
    catch(e){ toast(errTxt(e), 'error'); }
    finally { btn.disabled = false; }
  }

  // ================= Compras =================
  // Una compra NO pregunta cómo se pagó: se descuenta del saldo del proveedor (cuenta corriente).
  // Lo que le transfieres va en Finanzas, o aquí mismo con "Ya le transferí aparte".
  function pintarCompras(){
    if(!asegurar(pintarCompras)) return;
    const mes = hoyIso().slice(0, 7);
    const vivas = D.compras.filter(f => !f.anulada);
    const delMes = vivas.filter(f => String(f.fecha).slice(0, 7) === mes);
    const debes = -D.proveedores.filter(p => p.saldo < 0).reduce((a, p) => a + Number(p.saldo), 0), favor = D.proveedores.filter(p => p.saldo > 0).reduce((a, p) => a + Number(p.saldo), 0);
    const pend = vivas.filter(f => f.pendiente);
    $('subtitulo').textContent = debes ? 'Le debes ' + dinero(debes) + ' a proveedores' : favor ? dinero(favor) + ' a tu favor en proveedores' : 'Al día con los proveedores';
    let h = `<div class="res">
      <div class="res-c"><span>Compras del mes</span><b>${dinero(delMes.reduce((a, f) => a + Number(f.total), 0))}</b></div>
      <div class="res-c ${debes ? 'rojo' : 'ok'}"><span>${debes ? 'Le debes' : 'A tu favor'}</span><b>${dinero(debes || favor)}</b></div></div>`;
    if(pend.length) h += `<div class="caja-amar" style="margin:0 0 12px">${plural(pend.length, '1 compra tiene', 'compras tienen')} el material por registrar. Tócala para cargarlo y que suba en Fabricación.</div>`;
    h += '<div class="tit" style="margin-top:4px">Facturas y notas</div><div class="mat-lista ya">';
    h += D.compras.length ? D.compras.map(f => {
      const p = prov(f.prov) || { nombre:'Proveedor' };
      return `<button class="mat ${f.anulada ? 'apagado' : ''}" type="button" data-factura="${f.id}"><span class="mat-ico">${esc(ini(p.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">${f.doc === 'factura' ? 'Factura' : 'Nota'} ${esc(f.numero || 'sin número')} · ${esc(fecha(f.fecha))} ${f.anulada ? '<span class="pill gris">Anulada</span>' : f.pendiente ? '<span class="pill amar">Material por registrar</span>' : `<span class="pill ${Number(f.iva) ? 'verde' : 'gris'}">${Number(f.iva) ? 'Con IVA' : 'Sin IVA'}</span>`}</span></span>
        <span class="mat-n"><b style="font-size:18px">${dinero(f.total)}</b><span>${f.foto ? 'con foto' : 'a mano'}</span></span></button>`;
    }).join('') : '<p class="mat-s">Sin compras todavía.</p>';
    h += `</div>
      <button class="btn-secondary" type="button" data-pdf-compras style="width:100%;margin-top:10px">Compras del mes en PDF</button>
      <div class="tit">Proveedores · toca para ver su cuenta</div><div class="mat-lista ya">
      ${D.proveedores.filter(p => p.activo).map(p => `<a class="mat" href="finanzas.html?prov=${p.id}" style="text-decoration:none;color:inherit"><span class="mat-ico">${esc(ini(p.nombre))}</span>
          <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">Vende: ${(p.tipos || []).map(t => esc(TIPO[t] || t)).join(', ')} · ${p.iva ? 'con IVA' : 'sin IVA'}</span></span>
          <span class="mat-n"><b class="${st(p.saldo).cls}" style="font-size:18px">${dinero(Math.abs(p.saldo))}</b><span>${st(p.saldo).t.toLowerCase()}</span></span></a>`).join('')}</div>`;
    $('cont').innerHTML = h;
  }
  let FA = null;   // factura abierta
  function abrirFactura(id){
    const f = D.compras.find(x => String(x.id) === String(id)); if(!f) return;
    const p = prov(f.prov) || { nombre:'Proveedor', saldo:0 };
    FA = { id:f.id, anular:false };
    $('facturaTitulo').textContent = (f.doc === 'factura' ? 'Factura ' : 'Nota ') + (f.numero || 'sin número');
    const sub = r2((f.lineas || []).reduce((a, l) => a + l.q * l.p, 0));
    $('facturaBody').innerHTML = `<div class="d-datos">
        <div class="d-dato" style="grid-column:1/-1"><span>Proveedor</span><b>${esc(p.nombre)}</b></div>
        <div class="d-dato"><span>Fecha</span><b>${esc(fecha(f.fecha))}</b></div>
        <div class="d-dato"><span>Documento</span><b>${f.doc === 'factura' ? 'Factura con IVA' : 'Nota sin IVA'}</b></div></div>
      ${f.anulada ? `<div class="caja-rara">Anulada: ${esc(f.anulada.motivo)}</div>` : ''}
      ${(f.lineas || []).length ? `<div class="tit">Materiales</div>${f.lineas.map(i => `<div class="cg-fila"><div class="cg-nom">${esc(i.n)}<span>${esc(i.q)} × ${dinero(i.p)} sin IVA</span></div><div style="text-align:right;font-weight:800">${dinero(i.q * i.p)}</div></div>`).join('')}
        ${f.pendiente ? '' : Math.abs(sub - Number(f.subtotal)) > 0.05 ? `<p class="mat-s" style="margin:6px 2px 0">Los materiales suman ${dinero(sub)} sin IVA; el papel dice ${dinero(f.subtotal)}.</p>` : ''}`
        : `<div class="caja-amar" style="margin-top:12px">El material de esta compra está por registrar. Cárgalo para que suba en Fabricación y pase su precio a Costos.</div>`}
      ${f.nota ? `<p class="mat-s" style="margin:10px 2px 0">${esc(f.nota)}</p>` : ''}
      <div class="tot"><div class="fila"><span>Subtotal sin IVA</span><b>${dinero(f.subtotal)}</b></div><div class="fila"><span>IVA</span><b>${Number(f.iva) ? dinero(f.iva) : 'No cobra'}</b></div><div class="fila fin"><span>Total</span><span>${dinero(f.total)}</span></div></div>
      <div class="caja-nota"><span>Cuenta con ${esc(p.nombre)} hoy</span><b class="${st(p.saldo).cls}">${saldoTxt(p.saldo)}</b>.${f.anulada ? '' : ' Esta compra se descontó de su saldo.'}</div>
      ${f.foto ? '<button class="btn-secondary" type="button" data-ver-foto style="width:100%;margin-top:12px">Ver foto de la factura</button>' : ''}
      <a class="row-link" href="finanzas.html?prov=${p.id}" style="margin-top:12px"><span>Ver la cuenta del proveedor</span>${CHEV}</a>
      ${!f.anulada ? '<div id="anularCaja"><button class="link-btn" type="button" data-anular-compra style="color:var(--danger);font-weight:800;margin:14px 2px 0">¿Está mal cargada? Anular compra</button></div>' : ''}`;
    $('facturaFoot').classList.toggle('hidden', !(f.pendiente && !f.anulada));
    $('facturaFoot').innerHTML = f.pendiente && !f.anulada ? '<button class="btn-primary" type="button" data-registrar-material>Registrar el material</button>' : '';
    abrirHoja('sheetFactura');
  }

  // ---------- Compra nueva a mano (o solo el total) y registrar el material de una compra ----------
  let F = null;
  function abrirCompra(){
    if(!D) return;
    const p = D.proveedores.find(x => x.activo);
    if(!p) return toast('Primero agrega un proveedor en Finanzas', 'error');
    F = { modo:'nueva', prov:p.id, doc:p.iva ? 'factura' : 'nota', numero:'', fecha:hoyIso(), conMaterial:true, total:'', lineas:[], aparte:false, agregar:{ m:null, q:'', p:'' }, foto:null };
    $('fotoTitulo').textContent = 'Compra nueva'; pintarCompra(); abrirHoja('sheetFoto');
  }
  function abrirRegistrar(cid){
    const f = D.compras.find(x => x.id === cid); if(!f) return;
    cerrarHoja('sheetFactura', true);
    F = { modo:'registrar', compra:cid, prov:f.prov, doc:f.doc, lineas:[], agregar:{ m:null, q:'', p:'' } };
    $('fotoTitulo').textContent = 'Material de la ' + (f.doc === 'factura' ? 'factura ' : 'nota ') + (f.numero || ''); pintarCompra(); abrirHoja('sheetFoto');
  }
  function leerCampos(){
    const v = (id) => { const el = $(id); return el ? el.value : undefined; };
    if(v('fNum') !== undefined) F.numero = v('fNum'); if(v('fFecha') !== undefined) F.fecha = v('fFecha'); if(v('fTotal') !== undefined) F.total = v('fTotal'); if(v('fNota') !== undefined) F.nota = v('fNota');
    if(v('aQ') !== undefined){ F.agregar.q = v('aQ'); F.agregar.p = v('aP'); }
    if(v('tMonto') !== undefined) F.tMonto = v('tMonto'); if(v('tRef') !== undefined) F.tRef = v('tRef');
    F.lineas.forEach((l, i) => { const q = v('lq' + i), p = v('lp' + i); if(q !== undefined){ l.q = num(q) || 0; l.p = num(p) || 0; } });
  }
  const totales = () => { const sub = r2(F.lineas.reduce((a, l) => a + l.q * l.p, 0)); const iva = F.doc === 'factura' ? r2(sub * 0.16) : 0; return { sub, iva, total:r2(sub + iva) }; };
  function totalCompra(){ if(F.modo === 'nueva' && !F.conMaterial) return num(F.total) > 0 ? num(F.total) : 0; return totales().total; }
  function pintarCompra(){
    const p = prov(F.prov);
    const vende = D.fab.filter(f => f.activo && (p.tipos || []).includes(f.tipo));
    const consum = (p.tipos || []).some(t => ['pintura','consumibles','accesorios'].includes(t)) ? D.consumibles : [];
    const nueva = F.modo === 'nueva';
    const tot = totalCompra();
    const antes = Number(p.saldo) || 0, trans = F.aparte ? (num(F.tMonto) || 0) : 0, despues = r2(antes + trans - (nueva ? tot : 0));
    let h = '';
    if(nueva){
      h += `<div class="field"><span class="field-label">Proveedor</span>
          <div class="opts" style="--cols:1">${D.proveedores.filter(x => x.activo).map(x => `<button class="opt ${x.id === F.prov ? 'selected' : ''}" type="button" data-c-prov="${x.id}">${esc(x.nombre)}</button>`).join('')}</div>
          <div class="field-hint">Vende: ${(p.tipos || []).map(t => esc(TIPO[t] || t)).join(', ')}. Solo salen esos materiales.</div></div>
        <div class="field"><span class="field-label">Documento</span>
          <div class="opts">${[['factura', 'Factura con IVA'], ['nota', 'Nota sin IVA']].map(([k, t]) => `<button class="opt ${F.doc === k ? 'selected' : ''}" type="button" data-c-doc="${k}">${t}</button>`).join('')}</div>
          <div class="field-hint">${esc(p.nombre)} ${p.iva ? 'normalmente da factura con IVA' : 'normalmente da nota sin IVA'}. Se puede cambiar en esta compra.</div></div>
        <div class="input-row">
          <div class="field"><label class="field-label" for="fNum">N° del documento</label><input class="input" id="fNum" type="text" value="${esc(F.numero)}"></div>
          <div class="field"><label class="field-label" for="fFecha">Fecha</label><input class="input" id="fFecha" type="date" max="${hoyIso()}" value="${esc(F.fecha)}"></div></div>
        <div class="field"><span class="field-label">¿Qué cargas ahora?</span><div class="opts">${[['si', 'Con los materiales'], ['no', 'Solo el total']].map(([k, t]) => `<button class="opt ${(F.conMaterial ? 'si' : 'no') === k ? 'selected' : ''}" type="button" data-c-modo="${k}">${t}</button>`).join('')}</div>
          ${!F.conMaterial ? '<div class="field-hint">El material queda "por registrar" y lo cargas después desde la compra.</div>' : ''}</div>
        ${!F.conMaterial ? `<div class="field"><label class="field-label" for="fTotal">Total del papel${F.doc === 'factura' ? ' (con IVA)' : ''}</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fTotal" inputmode="decimal" value="${esc(F.total)}"></div></div>
          <div class="field"><label class="field-label" for="fNota">Nota (opcional)</label><input class="input" id="fNota" value="${esc(F.nota || '')}"></div>` : ''}
        <div class="field"><span class="field-label">Foto del papel (opcional)</span><label class="btn-secondary" style="width:100%;display:flex;align-items:center;justify-content:center;cursor:pointer">${F.foto ? 'Foto lista · cambiar' : 'Tomar o elegir foto'}<input type="file" accept="image/*" id="cFoto" hidden></label></div>`;
    } else {
      const c = D.compras.find(x => x.id === F.compra);
      h += `<div class="caja-nota"><span>${esc(p.nombre)}</span>Total del papel ${dinero(c.total)} · ${fecha(c.fecha)}. Carga lo que trajo: sube en Fabricación y su precio pasa a Costos. El saldo del proveedor no cambia.</div>`;
    }
    if(!nueva || F.conMaterial){
      h += `<div class="field"><span class="field-label">Materiales (precio sin IVA)</span>
        ${F.lineas.map((l, i) => { const f = l.m ? mat(l.m) : null, k = l.k ? D.consumibles.find(x => x.id === l.k) : null;
          return `<div class="lin">
            <span><span class="lin-t">${esc(f ? f.nombre : k ? k.nombre : 'Material')}</span><br><span class="lin-s">${f ? esc(TIPO[f.tipo]) + ' · sube en Fabricación' : 'Consumible · sube en Consumibles'}</span></span>
            <span class="lin-n" style="display:flex;gap:6px;align-items:center"><input class="input" id="lq${i}" inputmode="decimal" value="${l.q}" style="width:54px;height:40px;padding:0 8px;text-align:center" aria-label="Cantidad">×<input class="input" id="lp${i}" inputmode="decimal" value="${l.p}" style="width:78px;height:40px;padding:0 8px;text-align:right" aria-label="Precio sin IVA"></span>
            <button class="link-btn" type="button" data-quitar-lin="${i}" style="grid-column:1/-1;justify-self:start;color:var(--danger);font-size:13px;font-weight:800">Quitar</button>
            ${f && f.fijo && Math.abs(l.p - f.fijo) > 0.005 ? `<div class="caja-amar">Costos usa ${dinero(f.fijo)} para este material (precio fijo). La compra se guarda con ${dinero(l.p)} y el costeo sigue igual.</div>` : ''}
          </div>`; }).join('')}
        <div class="lin" style="background:var(--surface-2);border-radius:14px;padding:10px 12px;margin-top:6px">
          <span class="lin-t" style="grid-column:1/-1">Agregar material de ${esc(p.nombre.replace('Inversiones ', ''))}</span>
          <div class="opts" style="--cols:2;grid-column:1/-1">${vende.map(f => `<button class="opt ${F.agregar.m === 'f' + f.id ? 'selected' : ''}" type="button" data-agregar-m="f${f.id}" style="font-size:13px">${esc(f.nombre)}</button>`).join('')}${consum.map(k => `<button class="opt ${F.agregar.m === 'k' + k.id ? 'selected' : ''}" type="button" data-agregar-m="k${k.id}" style="font-size:13px">${esc(k.nombre)}</button>`).join('')}</div>
          ${!vende.length && !consum.length ? '<p class="mat-s" style="grid-column:1/-1;margin:4px 0">No hay materiales de los tipos de este proveedor. Agrégalos en Fabricación.</p>' : ''}
          <div class="input-row" style="grid-column:1/-1;margin-top:8px"><div class="field" style="margin:0"><label class="field-label" for="aQ">Cantidad</label><input class="input" id="aQ" inputmode="decimal" value="${esc(F.agregar.q || '')}"></div><div class="field" style="margin:0"><label class="field-label" for="aP">Precio sin IVA</label><input class="input" id="aP" inputmode="decimal" value="${esc(F.agregar.p || '')}"></div></div>
          <button class="btn-secondary" type="button" data-agregar style="grid-column:1/-1;width:100%;margin-top:8px">Agregar a la compra</button>
        </div></div>`;
      const { sub, iva, total } = totales();
      h += `<div class="tot"><div class="fila"><span>Subtotal sin IVA</span><b>${dinero(sub)}</b></div><div class="fila"><span>IVA 16 %</span><b>${F.doc === 'factura' ? dinero(iva) : 'No cobra'}</b></div><div class="fila fin"><span>${nueva ? 'Total de la compra' : 'Suman los materiales'}</span><span>${dinero(total)}</span></div></div>`;
    }
    if(nueva){
      h += `<div class="tit">Cuenta con ${esc(p.nombre)}</div>
        <div class="tot" style="background:var(--accent-soft)">
          <div class="fila"><span>Antes de esta compra</span><b class="${st(antes).cls}">${saldoTxt(antes)}</b></div>
          ${F.aparte ? `<div class="fila"><span>Le transferiste aparte</span><b class="s-favor">+ ${dinero(trans)}</b></div>` : ''}
          <div class="fila"><span>Esta compra</span><b>− ${dinero(tot)}</b></div>
          <div class="fila fin"><span>Queda</span><span class="${st(despues).cls}">${saldoTxt(despues)}</span></div></div>
        <p class="mat-s" style="margin:6px 2px 0">${antes > 0.005 ? 'Primero se usa el saldo a tu favor.' : 'No había saldo a favor: queda como deuda hasta que le transfieras.'}</p>
        ${D.cuentas.length ? `<button type="button" class="tchip ${F.aparte ? 'on' : ''}" data-aparte style="margin-top:12px"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg></span>Ya le transferí aparte para esta compra</button>` : ''}
        ${F.aparte ? `<div class="field" style="margin-top:12px"><label class="field-label" for="tMonto">Monto transferido</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="tMonto" inputmode="decimal" value="${esc(F.tMonto || '')}"></div></div>
          <div class="field"><span class="field-label">¿De qué cuenta salió?</span><div class="opts">${D.cuentas.filter(c => c.moneda !== 'VES').map(c => `<button class="opt ${String(F.tCuenta) === String(c.id) ? 'selected' : ''}" type="button" data-t-cuenta="${c.id}">${esc(c.nombre)}</button>`).join('')}</div><div class="field-hint">Si salió de bolívares, regístralo en Finanzas.</div></div>
          <div class="field"><label class="field-label" for="tRef">Referencia</label><input class="input" id="tRef" value="${esc(F.tRef || '')}"></div>` : ''}`;
    }
    $('fotoBody').innerHTML = h;
    $('fotoFoot').classList.remove('hidden');
    $('btnGuardarFoto').textContent = nueva ? 'Guardar compra' : 'Guardar material';
  }
  async function guardarCompra(){
    if(!F || F.guardando) return;
    leerCampos();
    const nueva = F.modo === 'nueva';
    const lineas = F.lineas.filter(l => l.q > 0).map(l => ({ material_id:l.m || null, consumible_id:l.k || null, cantidad:l.q, precio:l.p }));
    if((!nueva || F.conMaterial) && !lineas.length) return toast('Agrega al menos un material', 'error');
    if(nueva && !F.conMaterial && !(num(F.total) > 0)) return toast('Escribe el total del papel', 'error');
    if(nueva && F.aparte && (!F.tCuenta || !(num(F.tMonto) > 0))) return toast('Escribe el monto transferido y la cuenta', 'error');
    const btn = $('btnGuardarFoto'); F.guardando = true; btn.disabled = true;
    try{
      if(nueva){
        let foto = null;
        if(F.foto){
          const path = `compras/${hoyIso().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const { error } = await db.storage.from('comprobantes').upload(path, F.foto, { contentType:'image/jpeg' });
          if(error) throw new Error('No se pudo subir la foto. Revisa el internet.');
          foto = path;
        }
        const p = { proveedor_id:F.prov, documento:F.doc, numero:F.numero || null, fecha:F.fecha || null, foto, nota:F.nota || null, lineas:F.conMaterial ? lineas : [] };
        if(!F.conMaterial) p.total = num(F.total);
        if(F.aparte) p.aparte = { cuenta_id:+F.tCuenta, monto_salio:num(F.tMonto), referencia:F.tRef || null };
        const r = await rpc('compra_guardar', { p });
        cerrarHoja('sheetFoto', true);
        toast(`Compra guardada. Con ${prov(F.prov).nombre.replace('Inversiones ', '')}: ${saldoTxt(r.saldo_proveedor).toLowerCase()}`);
      } else {
        const r = await rpc('compra_material_registrar', { cid:F.compra, lineas });
        cerrarHoja('sheetFoto', true);
        toast('Material registrado. Ya subió en Fabricación.' + (Math.abs(Number(r.subtotal_lineas) - Number(r.subtotal_papel)) > 0.05 ? ' Ojo: no suma lo mismo que el papel.' : ''));
      }
      F = null; await recargar();
    } catch(e){ toast(errTxt(e), 'error'); }
    finally { if(F) F.guardando = false; btn.disabled = false; }
  }

  async function sacarPDF(o, nombre){
    if(!window.PDFR) return;
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear(o); const r = await window.PDFR.compartir(blob, nombre); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }
  function pdfExistencias(){
    const b = [];
    [['hierro', 'Tubos, platinas y marcos'], ['laminas', 'Láminas'], ['vidrio', 'Vidrio'], ['aluminio', 'Aluminio']].forEach(([t, tit]) => {
      const L = D.fab.filter(f => f.tipo === t && f.activo); if(!L.length) return;
      b.push({ t:'titulo', texto:tit, der:'Hay' });
      L.forEach(f => b.push({ t:'fila', a:f.nombre + ((f.retazos || []).length ? ' · retazos: ' + f.retazos.map(r => (r.ancho ? r.largo + '×' + r.ancho : r.largo) + ' cm').join(', ') : ''), b:f.stock + (f.pres === 'barra' ? (f.stock === 1 ? ' barra' : ' barras') : (f.stock === 1 ? ' hoja' : ' hojas')) }));
    });
    sacarPDF({ titulo:'Existencias de fabricación', derecha:fecha(hoyIso()), subtitulo:'Barras, hojas y retazos del depósito.', bloques:b }, 'Existencias-' + hoyIso() + '.pdf');
  }
  function pdfCompras(){
    const mes = hoyIso().slice(0, 7), L = D.compras.filter(f => !f.anulada && String(f.fecha).slice(0, 7) === mes);
    const b = [{ t:'titulo', texto:'Facturas y notas del mes', der:'Total' }];
    L.forEach(f => b.push({ t:'fila', a:fecha(f.fecha) + ' · ' + ((prov(f.prov) || {}).nombre || '') + ' · ' + (f.doc === 'factura' ? 'Factura ' : 'Nota ') + (f.numero || 's/n') + (f.pendiente ? ' · material por registrar' : ''), b:dinero(f.total) }));
    if(!L.length) b.push({ t:'nota', texto:'Sin compras este mes.' });
    b.push({ t:'total', a:'Total comprado', b:dinero(L.reduce((a, f) => a + Number(f.total), 0)) });
    b.push({ t:'titulo', texto:'Saldo con cada proveedor' });
    D.proveedores.filter(p => p.activo).forEach(p => b.push({ t:'fila', a:p.nombre, b:saldoTxt(p.saldo), rojo:p.saldo < -0.005 }));
    sacarPDF({ titulo:'Compras del mes', derecha:mes, subtitulo:'Facturas y notas de proveedores.', bloques:b }, 'Compras-' + mes + '.pdf');
  }
  // ---------- Eventos ----------
  document.addEventListener('click', async (e) => {
    if(e.target.closest('[data-pdf-existencias]') && D) return pdfExistencias();
    if(e.target.closest('[data-pdf-compras]') && D) return pdfCompras();
    if(e.target.closest('[data-dn-reintentar]')){ const t = window.Deposito && window.Deposito.tab; return t === 'compras' ? pintarCompras() : pintarFab(); }
    const fb = e.target.closest('[data-fab]'); if(fb && D) return abrirFab(+fb.dataset.fab);
    if(e.target.closest('[data-fab-nuevo]')){ FM = { id:null, editar:true, form:{ tipo:'hierro', pres:'barra', largo:'600' } }; pintarFormMat(null); abrirHoja('sheetFab'); return; }
    if(FM){
      if(e.target.closest('[data-fab-editar]')){ const f = mat(FM.id); FM.editar = true; FM.form = { nombre:f.nombre, tipo:f.tipo, pres:f.pres, largo:f.largo, ancho:f.hoja && f.hoja[0], alto:f.hoja && f.hoja[1], espesor:f.espesor, fijo:f.fijo, activo:f.activo }; pintarFormMat(f); return; }
      const mt = e.target.closest('[data-m-tipo]'); if(mt){ leerMat(); FM.form.tipo = mt.dataset.mTipo; if(['laminas','vidrio'].includes(FM.form.tipo)) FM.form.pres = 'hoja'; return pintarFormMat(FM.id ? mat(FM.id) : null); }
      const mp = e.target.closest('[data-m-pres]'); if(mp){ leerMat(); FM.form.pres = mp.dataset.mPres; return pintarFormMat(FM.id ? mat(FM.id) : null); }
      const ma = e.target.closest('[data-m-activo]'); if(ma){ leerMat(); FM.form.activo = ma.dataset.mActivo === 'si'; return pintarFormMat(mat(FM.id)); }
      if(e.target.closest('[data-m-guardar]')) return guardarMat();
      if(e.target.closest('[data-ret-nuevo]')){ FM.retazo = true; pintarFicha(); const el = $('rLargo'); if(el) el.focus(); return; }
      if(e.target.closest('[data-ret-guardar]')){
        const l = num($('rLargo').value), a = $('rAncho') ? num($('rAncho').value) : null;
        if(!(l > 0)) return toast('Escribe la medida', 'error');
        try{ await rpc('retazo_agregar', { mid:FM.id, p_largo:l, p_ancho:a > 0 ? a : null }); FM.retazo = false; toast('Anotado'); await recargar(); pintarFicha(); } catch(err){ toast(errTxt(err), 'error'); }
        return;
      }
      const rq = e.target.closest('[data-ret-quitar]'); if(rq){
        if(!confirm('¿Quitar este retazo? Ya no lo usará el plan de corte.')) return;
        try{ await rpc('retazo_quitar', { rid:+rq.dataset.retQuitar, motivo:'Se quitó a mano' }); toast('Quitado'); await recargar(); pintarFicha(); } catch(err){ toast(errTxt(err), 'error'); }
        return;
      }
    }
    const fa = e.target.closest('[data-factura]'); if(fa && D) return abrirFactura(+fa.dataset.factura);
    if(FA){
      if(e.target.closest('[data-registrar-material]')) return abrirRegistrar(FA.id);
      if(e.target.closest('[data-ver-foto]')){ const f = D.compras.find(x => x.id === FA.id); const { data } = await db.storage.from('comprobantes').createSignedUrl(f.foto, 600).catch(() => ({})); if(data && data.signedUrl) window.open(data.signedUrl, '_blank', 'noopener'); else toast('No se pudo abrir la foto', 'error'); return; }
      if(e.target.closest('[data-anular-compra]')){ $('anularCaja').innerHTML = `<div class="field" style="margin-top:12px" id="campoAnular"><label class="field-label" for="anMotivo">¿Por qué la anulas?</label><input class="input" id="anMotivo"><div class="field-error">Escribe el motivo</div><div class="field-hint">Se devuelve lo que subió en Fabricación y el saldo del proveedor se corrige.</div></div><button class="btn-secondary" type="button" data-anular-si style="width:100%;color:var(--danger)">Anular compra</button>`; return; }
      if(e.target.closest('[data-anular-si]')){
        const m = $('anMotivo').value.trim(); if(!m){ $('campoAnular').classList.add('invalid'); return; }
        try{ await rpc('compra_anular', { cid:FA.id, motivo:m }); cerrarHoja('sheetFactura', true); FA = null; toast('Compra anulada'); await recargar(); } catch(err){ toast(errTxt(err), 'error'); }
        return;
      }
    }
    if(F && $('sheetFoto').classList.contains('open')){
      const pv = e.target.closest('[data-c-prov]'); if(pv){ leerCampos(); F.prov = +pv.dataset.cProv; const p = prov(F.prov); F.doc = p.iva ? 'factura' : 'nota'; F.lineas = []; F.agregar = { m:null, q:'', p:'' }; return pintarCompra(); }
      const dc = e.target.closest('[data-c-doc]'); if(dc){ leerCampos(); F.doc = dc.dataset.cDoc; return pintarCompra(); }
      const md = e.target.closest('[data-c-modo]'); if(md){ leerCampos(); F.conMaterial = md.dataset.cModo === 'si'; return pintarCompra(); }
      const ql = e.target.closest('[data-quitar-lin]'); if(ql){ leerCampos(); F.lineas.splice(+ql.dataset.quitarLin, 1); return pintarCompra(); }
      const am = e.target.closest('[data-agregar-m]'); if(am){ leerCampos(); F.agregar.m = am.dataset.agregarM; if(F.agregar.m[0] === 'f' && !F.agregar.p){ const f = mat(F.agregar.m.slice(1)); const pr = f && f.precios && f.precios[F.prov]; if(pr) F.agregar.p = pr.p; } return pintarCompra(); }
      if(e.target.closest('[data-agregar]')){ leerCampos(); const q = num(F.agregar.q), pr = num(F.agregar.p); if(!F.agregar.m) return toast('Elige el material', 'error'); if(!(q > 0)) return toast('Escribe la cantidad', 'error'); if(!(pr >= 0)) return toast('Escribe el precio sin IVA', 'error');
        const k = F.agregar.m; F.lineas.push({ m:k[0] === 'f' ? +k.slice(1) : null, k:k[0] === 'k' ? +k.slice(1) : null, q, p:pr }); F.agregar = { m:null, q:'', p:'' }; return pintarCompra(); }
      if(e.target.closest('[data-aparte]')){ leerCampos(); F.aparte = !F.aparte; if(F.aparte && !F.tMonto) F.tMonto = totalCompra() || ''; return pintarCompra(); }
      const tc = e.target.closest('[data-t-cuenta]'); if(tc){ leerCampos(); F.tCuenta = tc.dataset.tCuenta; return pintarCompra(); }
    }
  });
  document.addEventListener('change', async (e) => {
    if(F && /^(lq|lp)\d+$|^tMonto$|^fTotal$/.test(e.target.id)){ leerCampos(); pintarCompra(); }
    if(F && e.target.id === 'cFoto' && e.target.files && e.target.files[0]){ try{ leerCampos(); F.foto = await comprimirFoto(e.target.files[0], 1600, 0.72); pintarCompra(); } catch(err){ toast('No se pudo leer la foto', 'error'); } }
  });
  $('btnContar').onclick = abrirConteo;
  $('btnGuardarConteo').onclick = guardarConteo;
  $('btnFoto').onclick = abrirCompra;
  $('btnGuardarFoto').onclick = guardarCompra;

  window.DepNuevo = { pintarFab, pintarCompras, recargar };
})();
