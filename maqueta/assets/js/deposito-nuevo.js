// MAQUETA: lo nuevo del Depósito. Fabricación (barras y hojas, plan de corte de la semana,
// conteo del sábado) y Compras (facturas, foto de la factura, proveedores).
// Usa las mismas piezas de la app (hojas, toasts, listas). Los datos salen de falso.js.
(function(){
  'use strict';
  const { esc, toast, abrirHoja, cerrarHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const M = () => window.MAQUETA.datos();
  const IVA = 1.16;
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const ini = (t) => String(t).replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const TIPO = { hierro:'Hierro', laminas:'Láminas', vidrio:'Vidrio', aluminio:'Aluminio', pintura:'Pintura y masilla', consumibles:'Consumibles', accesorios:'Accesorios', madera:'Madera' };
  const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const fmtM = (cm) => (cm / 100).toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' m';

  // ---------- Fabricación: lo que hay, por tubo ----------
  // El depósito solo lleva el stock: barras enteras, retazos con su medida, hojas y sobrantes.
  // Lo que se corta cada sábado y cómo vive en Costos › Semana (sale de lo asignado en Producción).
  const SAB = () => window.MAQUETA.sabados();
  const sabTxt = (iso) => { try{ return window.AH.sabadoCorto(iso); } catch(e){ return iso; } };
  function necesita(){
    const out = {}, X = window.MAQUETA;
    [SAB().este, SAB().proximo].forEach((sab, i) => { const P = X.planSemana(sab);
      P.compras.forEach(m => { const o = (out[m.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { usa:m.barras, retazos:m.retazos, falta:m.comprar }; });
      P.hj.forEach(x => { const o = (out[x.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { m2:x.m2, falta:x.comprar }; }); });
    return out;
  }
  const retazosHtml = (f) => (f.retazos || []).length ? `<span class="ret-l">${f.retazos.slice().sort((a, b) => b - a).map(r => `<span class="ret-c">${r} cm</span>`).join('')}</span>` : '';
  function pintarFab(){
    const d = M(), nec = necesita(), S = SAB();
    const falta = Object.values(nec).reduce((a, x) => a + (x.este ? x.este.falta : 0), 0);
    const barras = d.fab.filter(f => f.pres === 'barra').reduce((a, f) => a + f.stock, 0), rets = d.fab.reduce((a, f) => a + (f.retazos || []).length, 0);
    $('subtitulo').textContent = falta ? 'Faltan ' + plural(falta, '1 barra u hoja', 'barras u hojas') + ' para el ' + sabTxt(S.este) : 'Hay material para el ' + sabTxt(S.este);
    let h = `<div class="res">
      <div class="res-c ${falta ? 'rojo' : 'ok'}"><span>Para el ${esc(sabTxt(S.este))}</span><b>${falta ? 'Faltan ' + falta : 'Alcanza'}</b></div>
      <div class="res-c"><span>Barras y retazos</span><b>${esc(barras)} · ${esc(rets)}</b></div></div>`;
    if(falta) h += `<a class="caja-amar" style="display:block;text-decoration:none;margin:0 0 12px" href="costos.html?tab=semana&para=${S.este}">Faltan ${plural(falta, '1 barra u hoja', 'barras u hojas')} para lo asignado al ${esc(sabTxt(S.este))}. Ver el plan de corte y qué comprar →</a>`;
    if(d.conteo) h += `<div class="${d.conteo.dif ? 'caja-rara' : 'caja-ok'}" style="margin:0 0 12px">${esc(d.conteo.txt)}</div>`;
    [['hierro', 'Tubos, platinas y marcos'], ['laminas', 'Láminas'], ['vidrio', 'Vidrio']].forEach(([t, tit]) => {
      const L = d.fab.filter(f => f.tipo === t); if(!L.length) return;
      h += `<div class="tit">${tit}</div><div class="mat-lista ya">` + L.map(f => {
        const x = nec[f.id] && nec[f.id].este, fp = nec[f.id] && nec[f.id].proximo;
        const pill = x && x.falta ? `<span class="pill rojo">Faltan ${x.falta}</span>` : x ? '<span class="pill verde">Alcanza</span>' : '';
        const med = f.pres === 'barra' ? 'Barra de ' + fmtM(f.largo) : 'Hoja ' + f.hoja[0] + ' × ' + f.hoja[1] + ' cm';
        const sob = (f.sobrantes || []).length ? ' · ' + plural(f.sobrantes.length, '1 sobrante', 'sobrantes') : '';
        return `<button class="mat ${x && x.falta ? 'bajo' : ''}" type="button" data-fab="${esc(f.id)}">
          <span class="mat-ico fab">${esc(ini(f.nombre))}</span>
          <span style="min-width:0"><span class="mat-t">${esc(f.nombre)}</span>
            <span class="mat-s">${esc(med)}${sob}${x && f.pres === 'barra' ? ' · el ' + esc(sabTxt(S.este)) + ' usa ' + x.usa : ''}${fp && fp.falta ? ' · próximo sáb faltan ' + fp.falta : ''} ${pill}</span>
            ${retazosHtml(f)}</span>
          <span class="mat-n"><b>${esc(f.stock)}</b><span>${f.pres === 'barra' ? (f.stock === 1 ? 'barra' : 'barras') : (f.stock === 1 ? 'hoja' : 'hojas')}</span></span>
        </button>`; }).join('') + '</div>';
    });
    h += `<button class="btn-nuevo" type="button" data-maq="Agregar material de fabricación">+ Agregar material de fabricación</button>
      <p class="mat-s" style="margin:8px 2px 0">Las barras suben con cada compra y bajan cuando Ray marca en Costos › Semana que el herrero ya cortó. Los retazos de 50 cm o más quedan anotados con su medida y el plan siguiente los usa primero.</p>`;
    $('cont').innerHTML = h;
  }
  function abrirFab(id){
    const d = M(), f = d.fab.find(x => x.id === id), n = necesita()[id] || {}, x = n.este, S = SAB();
    $('fabTitulo').textContent = f.nombre;
    const movs = (d.movsFab || []).filter(m => m.id === id);
    const hoja = f.pres === 'hoja';
    $('fabBody').innerHTML = `
      <div class="bento">
        <div class="res-c"><span>En depósito</span><b>${esc(f.stock)}</b></div>
        <div class="res-c"><span>${hoja ? 'Usa' : 'Usa el'} ${esc(sabTxt(S.este))}</span><b>${x ? (hoja ? x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m²' : esc(x.usa)) : 0}</b></div>
        <div class="res-c ${x && x.falta ? 'rojo' : 'ok'}"><span>Falta</span><b>${x ? esc(x.falta) : 0}</b></div>
      </div>
      ${hoja ? `<div class="tit">Sobrantes útiles</div><p style="margin:0 2px;font-size:15px;font-weight:700">${(f.sobrantes || []).length ? f.sobrantes.map(s2 => s2[0] + ' × ' + s2[1] + ' cm').join(' · ') : '<span class="mat-s">Ninguno</span>'}</p>`
        : `<div class="tit">Retazos útiles</div>${(f.retazos || []).length ? retazosHtml(f) : '<p class="mat-s" style="margin:0 2px">Ninguno</p>'}<p class="mat-s" style="margin:6px 2px 0">El plan de corte los usa primero.</p>`}
      <a class="row-link" href="costos.html?tab=semana&para=${S.este}" style="margin-top:12px"><span>Ver cómo se corta el ${esc(sabTxt(S.este))}</span>${CHEV}</a>
      <a class="row-link" href="costos.html?tab=materiales"><span>Precios por proveedor (en Costos)</span>${CHEV}</a>
      <div class="tit">Movimientos</div>
      ${movs.length ? movs.map(m => `<div class="mov"><span style="min-width:0"><span class="mov-t">${esc(m.t)}</span><span class="mov-s">${new Date(m.fecha).toLocaleDateString('es-VE', { day:'numeric', month:'short' })} · ${esc(m.por)}</span></span><span class="mov-m ${m.n > 0 ? 'mas' : 'menos'}">${m.n > 0 ? '+' : ''}${m.n || ''}</span></div>`).join('') : '<p class="mat-s" style="margin:0 2px">Sin movimientos todavía.</p>'}`;
    abrirHoja('sheetFab');
  }
  function abrirConteo(){
    const d = M();
    $('conteoBody').innerHTML = `<p class="mat-s" style="margin:0 2px 8px;font-size:14px">Cuenta las barras enteras de cada perfil y escribe cuántas hay. La app compara con lo que tiene anotado.</p>
      ${d.fab.filter(f => f.pres === 'barra').map(f => `<div class="cg-fila"><div class="cg-nom">${esc(f.nombre)}<span>La app dice ${esc(f.stock)}</span></div><input class="input cg-in" id="cn-${esc(f.id)}" type="text" inputmode="numeric" value="${f.stock}" aria-label="Barras contadas de ${esc(f.nombre)}"></div>`).join('')}`;
    abrirHoja('sheetConteo');
  }
  function guardarConteo(){
    const d = M(), difs = [];
    for(const f of d.fab.filter(x => x.pres === 'barra')){
      const v = parseInt($('cn-' + f.id).value, 10);
      if(!isNaN(v) && v !== f.stock){ difs.push(`${f.nombre}: la app decía ${f.stock}, contaste ${v}`); d.movsFab.unshift({ id:f.id, t:'Ajuste por conteo', n:v - f.stock, fecha:new Date().toISOString(), por:'Ray' }); f.stock = v; }
    }
    d.conteo = { dif:difs.length, txt: difs.length ? `Conteo guardado con ${plural(difs.length, '1 diferencia', 'diferencias')}. ${difs.join('. ')}.` : 'Conteo guardado. Todo cuadra con la app.' };
    window.MAQUETA.guardar(); cerrarHoja('sheetConteo', true); toast(difs.length ? 'Conteo guardado con diferencias' : 'Conteo guardado'); pintarFab();
  }

  // ---------- Compras ----------
  // Una compra NO pregunta "cómo se pagó": se descuenta del saldo del proveedor (cuenta corriente).
  // Lo que le transfieres va en Finanzas, o aquí mismo con "Ya le transferí aparte".
  const X = () => window.MAQUETA;
  const fecha = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}/${+m}/${a}`; };
  const hoyIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const r2 = (n) => Math.round(n * 100) / 100;
  const st = (s) => s > 0.005 ? { cls:'s-favor', t:'A tu favor' } : s < -0.005 ? { cls:'s-debe', t:'Le debes' } : { cls:'', t:'Al día' };
  const saldoTxt = (s) => `${st(s).t}${Math.abs(s) > 0.005 ? ' ' + dinero(Math.abs(s)) : ''}`;
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).trim().replace(',', '.')); return isFinite(n) ? n : NaN; };

  function pintarCompras(){
    const d = M(), mes = hoyIso().slice(0, 7);
    const delMes = d.facturas.filter(f => String(f.fecha).slice(0, 7) === mes || String(f.fecha).slice(0, 7) === '2026-10');
    const saldos = d.proveedores.map(p => X().saldoProv(p.id));
    const debes = -saldos.filter(s => s < 0).reduce((a, s) => a + s, 0), favor = saldos.filter(s => s > 0).reduce((a, s) => a + s, 0);
    $('subtitulo').textContent = debes ? 'Le debes ' + dinero(debes) + ' a proveedores' : favor ? dinero(favor) + ' a tu favor en proveedores' : 'Al día con los proveedores';
    let h = `<div class="res">
      <div class="res-c"><span>Compras recientes</span><b>${dinero(delMes.reduce((a, f) => a + f.total, 0))}</b></div>
      <div class="res-c ${debes ? 'rojo' : 'ok'}"><span>${debes ? 'Le debes' : 'A tu favor'}</span><b>${dinero(debes || favor)}</b></div></div>
      <div class="tit" style="margin-top:4px">Facturas y notas</div><div class="mat-lista ya">`;
    h += d.facturas.length ? d.facturas.map(f => {
      const p = d.proveedores.find(x => x.id === f.prov);
      return `<button class="mat" type="button" data-factura="${esc(f.id)}"><span class="mat-ico">${esc(ini(p.nombre))}</span>
        <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">${f.doc === 'factura' ? 'Factura' : 'Nota'} ${esc(f.numero)} · ${esc(fecha(f.fecha))} <span class="pill ${f.iva ? 'verde' : 'gris'}">${f.iva ? 'Con IVA' : 'Sin IVA'}</span></span></span>
        <span class="mat-n"><b style="font-size:18px">${dinero(f.total)}</b><span>${f.foto ? 'con foto' : 'a mano'}</span></span></button>`;
    }).join('') : '<p class="mat-s">Sin compras todavía.</p>';
    h += `</div><button class="btn-nuevo" type="button" data-compra-mano>Cargar compra a mano</button>
      <div class="tit">Proveedores · toca para ver su cuenta</div><div class="mat-lista ya">
      ${d.proveedores.map(p => { const s = X().saldoProv(p.id);
        return `<a class="mat" href="finanzas.html?prov=${esc(p.id)}" style="text-decoration:none;color:inherit"><span class="mat-ico">${esc(ini(p.nombre))}</span>
          <span style="min-width:0"><span class="mat-t">${esc(p.nombre)}</span><span class="mat-s">Vende: ${p.tipos.map(t => esc(TIPO[t] || t)).join(', ')} · ${p.iva ? 'con IVA' : 'sin IVA'}</span></span>
          <span class="mat-n"><b class="${st(s).cls}" style="font-size:18px">${dinero(Math.abs(s))}</b><span>${st(s).t.toLowerCase()}</span></span></a>`; }).join('')}</div>`;
    $('cont').innerHTML = h;
  }
  function abrirFactura(id){
    const d = M(), f = d.facturas.find(x => String(x.id) === String(id)), p = d.proveedores.find(x => x.id === f.prov);
    $('facturaTitulo').textContent = (f.doc === 'factura' ? 'Factura ' : 'Nota ') + f.numero;
    const s = X().saldoProv(p.id);
    $('facturaBody').innerHTML = `<div class="d-datos">
        <div class="d-dato" style="grid-column:1/-1"><span>Proveedor</span><b>${esc(p.nombre)}</b></div>
        <div class="d-dato"><span>Fecha</span><b>${esc(fecha(f.fecha))}</b></div>
        <div class="d-dato"><span>Documento</span><b>${f.doc === 'factura' ? 'Factura con IVA' : 'Nota sin IVA'}</b></div></div>
      ${f.items ? `<div class="tit">Materiales</div>${f.items.map(i => `<div class="cg-fila"><div class="cg-nom">${esc(i.n)}<span>${esc(i.q)} × ${dinero(i.p)} sin IVA</span></div><div style="text-align:right;font-weight:800">${dinero(i.q * i.p)}</div></div>`).join('')}` : `<p class="mat-s" style="margin:10px 2px 0">${esc(f.lineas || '')} productos. ${esc(f.nota || '')}</p>`}
      <div class="tot"><div class="fila"><span>Subtotal sin IVA</span><b>${dinero(f.subtotal)}</b></div><div class="fila"><span>IVA</span><b>${f.iva ? dinero(f.iva) : 'No cobra'}</b></div><div class="fila fin"><span>Total</span><span>${dinero(f.total)}</span></div></div>
      <div class="caja-nota"><span>Cuenta con ${esc(p.nombre)} hoy</span><b class="${st(s).cls}">${saldoTxt(s)}</b>. Esta compra se descontó de su saldo.</div>
      <a class="btn-secondary" href="finanzas.html?prov=${esc(p.id)}" style="display:flex;align-items:center;justify-content:center;width:100%;margin-top:12px;text-decoration:none">Ver la cuenta del proveedor</a>`;
    abrirHoja('sheetFactura');
  }

  // Foto de la factura: los precios son los reales de Colores y Ambiente; las cantidades son de ejemplo
  const LEIDA = { prov:'cya', numero:'0045821', fecha:'2026-10-28', lineas:[
    { leido:'MARCO P/PUERTA 10 0.70', m:'m10', q:3, p:10.31 },
    { leido:'TUBO RECT 1X3 0.90', m:'t1x3', q:4, p:12.98 },
    { leido:'TUBO RECT 1X2 0.90', m:'t1x2', q:2, p:9.69 },
    { leido:'LAMINA PULIDA C/14 4X8', m:'lam14', q:1, p:61.05 },
    { leido:'PLAT 1/2X2MM', m:null, sug:['pl12', 'pl1'], q:2, p:2.19 },
  ]};
  let F = null;
  function abrirFoto(){ F = { fase:'tomar', img:null }; $('fotoTitulo').textContent = 'Compra con foto'; pintarFoto(); abrirHoja('sheetFoto'); }
  function abrirMano(){
    const p = M().proveedores[0];
    F = { fase:'revisar', foto:false, prov:p.id, doc:p.iva ? 'factura' : 'nota', numero:'', fecha:hoyIso(), lineas:[], aparte:false, agregar:{ m:null, q:'', p:'' } };
    $('fotoTitulo').textContent = 'Compra a mano'; pintarFoto(); abrirHoja('sheetFoto');
  }
  function leerCampos(){
    const v = (id) => { const el = $(id); return el ? el.value : undefined; };
    if(v('fNum') !== undefined) F.numero = v('fNum'); if(v('fFecha') !== undefined) F.fecha = v('fFecha');
    if(v('aQ') !== undefined){ F.agregar.q = v('aQ'); F.agregar.p = v('aP'); }
    if(v('tMonto') !== undefined) F.tMonto = v('tMonto'); if(v('tRef') !== undefined) F.tRef = v('tRef');
    F.lineas.forEach((l, i) => { const q = v('lq' + i), p = v('lp' + i); if(q !== undefined){ l.q = num(q) || 0; l.p = num(p) || 0; } });
  }
  const totales = () => { const sub = r2(F.lineas.reduce((a, l) => a + l.q * l.p, 0)); const iva = F.doc === 'factura' ? r2(sub * 0.16) : 0; return { sub, iva, total:r2(sub + iva) }; };
  function pintarFoto(){
    const d = M();
    $('fotoFoot').classList.toggle('hidden', F.fase !== 'revisar');
    if(F.fase === 'tomar'){
      $('fotoBody').innerHTML = `<p style="margin:0 2px 14px;font-size:15px;color:var(--ink-soft)">Toma la foto de la factura o nota de entrega. La app la lee y te muestra la compra llena para revisar.</p>
        <label class="btn-primary" style="cursor:pointer">Tomar o elegir foto<input type="file" accept="image/*" capture="environment" id="fotoArchivo" hidden></label>
        <button class="btn-secondary" type="button" id="fotoEjemplo" style="width:100%;margin-top:10px">Usar factura de ejemplo</button>
        <p class="mat-s" style="margin:10px 2px 0">En la maqueta la lectura siempre devuelve la misma factura de ejemplo.</p>`;
      $('fotoEjemplo').onclick = () => leer(null);
      $('fotoArchivo').onchange = (e) => { const f = e.target.files[0]; leer(f ? URL.createObjectURL(f) : null); };
      return;
    }
    if(F.fase === 'leyendo'){
      $('fotoBody').innerHTML = `<div class="escaneo"><img src="${esc(F.img || 'assets/img/foto-puerta.png')}" alt=""></div><p style="text-align:center;color:var(--ink-soft);margin-top:12px;font-weight:700">Leyendo la factura…</p>`;
      return;
    }
    const prov = d.proveedores.find(x => x.id === F.prov);
    const vende = d.fab.filter(f => prov.tipos.includes(f.tipo));
    const { sub, iva, total } = totales();
    const antes = X().saldoProv(prov.id), trans = F.aparte ? (num(F.tMonto) || 0) : 0, despues = r2(antes + trans - total);
    const sinElegir = F.lineas.some(l => !l.m);
    let h = F.foto ? '<div class="caja-ok">Leída. Revisa y toca Guardar compra. Nada se guarda solo.</div>' : '';
    h += `<div class="field"><span class="field-label">Proveedor</span>
        <div class="opts" style="--cols:1">${d.proveedores.map(p => `<button class="opt ${p.id === F.prov ? 'selected' : ''}" type="button" data-c-prov="${esc(p.id)}">${esc(p.nombre)}</button>`).join('')}</div>
        <div class="field-hint">${F.foto ? 'Lo reconoció por el RIF. ' : ''}Vende: ${prov.tipos.map(t => esc(TIPO[t] || t)).join(', ')}. Solo salen esos materiales.</div></div>
      <div class="field"><span class="field-label">Documento</span>
        <div class="opts">${[['factura', 'Factura con IVA'], ['nota', 'Nota sin IVA']].map(([k, t]) => `<button class="opt ${F.doc === k ? 'selected' : ''}" type="button" data-c-doc="${k}">${t}</button>`).join('')}</div>
        <div class="field-hint">${esc(prov.nombre)} ${prov.iva ? 'normalmente da factura con IVA' : 'normalmente da nota sin IVA'}. Se puede cambiar en esta compra.</div></div>
      <div class="input-row">
        <div class="field"><label class="field-label" for="fNum">N° del documento</label><input class="input" id="fNum" type="text" value="${esc(F.numero)}"></div>
        <div class="field"><label class="field-label" for="fFecha">Fecha</label><input class="input" id="fFecha" type="date" value="${esc(F.fecha)}"></div></div>
      <div class="field"><span class="field-label">Materiales${F.foto ? ' leídos' : ''} (precio sin IVA)</span>
        ${F.lineas.map((l, i) => { const f = l.m ? d.fab.find(x => x.id === l.m) : null; const noVende = f && !prov.tipos.includes(f.tipo);
          return `<div class="lin">${l.leido ? `<span class="lin-leido">${esc(l.leido)}</span>` : ''}
            <span>${f ? `<span class="lin-t">${esc(f.nombre)}</span><br><span class="lin-s">${esc(TIPO[f.tipo])} · sube en Fabricación</span>` : `<span class="lin-t" style="color:#8A5A00">¿Cuál material es?</span><br><span class="lin-s">Elige y la app lo recuerda para la próxima de ${esc(prov.nombre)}</span>`}</span>
            <span class="lin-n" style="display:flex;gap:6px;align-items:center"><input class="input" id="lq${i}" inputmode="decimal" value="${l.q}" style="width:54px;height:40px;padding:0 8px;text-align:center" aria-label="Cantidad">×<input class="input" id="lp${i}" inputmode="decimal" value="${l.p}" style="width:78px;height:40px;padding:0 8px;text-align:right" aria-label="Precio sin IVA"></span>
            ${!f ? `<div class="opts">${l.sug.map(s => `<button class="opt" type="button" data-elegir="${i}:${esc(s)}">${esc(d.fab.find(x => x.id === s).nombre)}</button>`).join('')}</div>` : ''}
            ${noVende ? `<div class="caja-amar">${esc(prov.nombre)} no tiene marcado ${esc(TIPO[f.tipo].toLowerCase())}. Revisa el proveedor o márcalo en Finanzas.</div>` : ''}
            ${f && f.fijo && Math.abs(l.p - f.fijo) > 0.005 ? `<div class="caja-amar">Costos usa ${dinero(f.fijo)} para este marco (precio fijo de Ray). La compra se guarda con ${dinero(l.p)} y el costeo sigue igual.</div>` : ''}
          </div>`; }).join('')}
        <div class="lin" style="background:var(--surface-2);border-radius:14px;padding:10px 12px;margin-top:6px">
          <span class="lin-t" style="grid-column:1/-1">Agregar material de ${esc(prov.nombre.replace('Inversiones ', ''))}</span>
          <div class="opts" style="--cols:2;grid-column:1/-1">${vende.map(f => `<button class="opt ${F.agregar && F.agregar.m === f.id ? 'selected' : ''}" type="button" data-agregar-m="${esc(f.id)}" style="font-size:13px">${esc(f.nombre)}</button>`).join('')}</div>
          <div class="input-row" style="grid-column:1/-1;margin-top:8px"><div class="field" style="margin:0"><label class="field-label" for="aQ">Cantidad</label><input class="input" id="aQ" inputmode="decimal" value="${esc((F.agregar || {}).q || '')}"></div><div class="field" style="margin:0"><label class="field-label" for="aP">Precio sin IVA</label><input class="input" id="aP" inputmode="decimal" value="${esc((F.agregar || {}).p || '')}"></div></div>
          <button class="btn-secondary" type="button" data-agregar style="grid-column:1/-1;width:100%;margin-top:8px">Agregar a la compra</button>
        </div>
        <div class="field-hint">Si trae lijas, discos o pintura, suben en Consumibles.</div></div>
      <div class="tot"><div class="fila"><span>Subtotal sin IVA</span><b>${dinero(sub)}</b></div><div class="fila"><span>IVA 16 %</span><b>${F.doc === 'factura' ? dinero(iva) : 'No cobra'}</b></div><div class="fila fin"><span>Total de la compra</span><span>${dinero(total)}</span></div></div>
      <div class="tit">Cuenta con ${esc(prov.nombre)}</div>
      <div class="tot" style="background:var(--accent-soft)">
        <div class="fila"><span>Antes de esta compra</span><b class="${st(antes).cls}">${saldoTxt(antes)}</b></div>
        ${F.aparte ? `<div class="fila"><span>Le transferiste aparte</span><b class="s-favor">+ ${dinero(trans)}</b></div>` : ''}
        <div class="fila"><span>Esta compra</span><b>− ${dinero(total)}</b></div>
        <div class="fila fin"><span>Queda</span><span class="${st(despues).cls}">${saldoTxt(despues)}</span></div></div>
      <p class="mat-s" style="margin:6px 2px 0">${antes > 0.005 ? 'Primero se usa el saldo a tu favor.' : 'No había saldo a favor: queda como deuda hasta que le transfieras.'}</p>
      <button type="button" class="tchip ${F.aparte ? 'on' : ''}" data-aparte style="margin-top:12px"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4"><path d="M5 12l5 5 9-10"/></svg></span>Ya le transferí aparte para esta compra</button>
      ${F.aparte ? `<div class="field" style="margin-top:12px"><label class="field-label" for="tMonto">Monto transferido</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="tMonto" inputmode="decimal" value="${esc(F.tMonto || '')}"></div></div>
        <div class="field"><span class="field-label">¿De qué cuenta salió?</span><div class="opts">${d.cuentas.map(c => `<button class="opt ${F.tCuenta === c.id ? 'selected' : ''}" type="button" data-t-cuenta="${esc(c.id)}">${esc(c.nombre)}</button>`).join('')}</div></div>
        <div class="field"><label class="field-label" for="tRef">Referencia</label><input class="input" id="tRef" value="${esc(F.tRef || '')}"></div>` : ''}
      ${F.foto ? '<p class="mat-s" style="margin:8px 2px 0">Precios reales de Colores y Ambiente. Las cantidades son de ejemplo.</p>' : ''}`;
    $('fotoBody').innerHTML = h;
    $('btnGuardarFoto').disabled = !F.lineas.length || sinElegir || (F.aparte && (!F.tCuenta || !(num(F.tMonto) > 0)));
  }
  function leer(img){
    F.fase = 'leyendo'; F.img = img; pintarFoto();
    setTimeout(() => { if(F && F.fase === 'leyendo'){
      const p = M().proveedores.find(x => x.id === LEIDA.prov);
      Object.assign(F, { fase:'revisar', foto:true, prov:LEIDA.prov, doc:p.iva ? 'factura' : 'nota', numero:LEIDA.numero, fecha:LEIDA.fecha, lineas:JSON.parse(JSON.stringify(LEIDA.lineas)), aparte:false, agregar:{ m:null, q:'', p:'' } });
      pintarFoto(); } }, 1400);
  }
  function guardarFoto(){
    leerCampos();
    const d = M(), prov = d.proveedores.find(x => x.id === F.prov), items = [];
    for(const l of F.lineas){
      if(!(l.q > 0)) continue;
      const f = d.fab.find(x => x.id === l.m);
      f.stock += l.q; items.push({ n:f.nombre, q:l.q, p:l.p });
      f.precios[F.prov] = Object.assign({}, f.precios[F.prov], { p:l.p }); // el precio de la compra (sin IVA) pasa a Costos; si hay precio fijo, Costos sigue con el fijo
      d.movsFab.unshift({ id:f.id, t:'Compra a ' + prov.nombre.replace('Inversiones ', ''), n:l.q, fecha:new Date().toISOString(), por:'Ray' });
    }
    const { sub, iva, total } = totales();
    if(F.aparte) X().transferir({ prov:F.prov, cuenta:F.tCuenta, monto:num(F.tMonto), ref:F.tRef || null, fecha:F.fecha, nota:'Transferido para la compra ' + (F.numero || '') });
    X().compra({ prov:F.prov, doc:F.doc, numero:F.numero || 'Sin número', fecha:F.fecha, subtotal:sub, iva, total, foto:!!F.foto, items });
    const s = X().saldoProv(F.prov);
    cerrarHoja('sheetFoto', true); F = null;
    toast(`Compra guardada. Con ${prov.nombre.replace('Inversiones ', '')}: ${saldoTxt(s).toLowerCase()}`);
    pintarCompras();
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const fb = e.target.closest('[data-fab]'); if(fb) return abrirFab(fb.dataset.fab);
    const fa = e.target.closest('[data-factura]'); if(fa) return abrirFactura(fa.dataset.factura);
    const mq = e.target.closest('[data-maq]'); if(mq) return toast(mq.dataset.maq + ': en la maqueta no se guarda.');
    if(e.target.closest('[data-compra-mano]')) return abrirMano();
    if(F && F.fase === 'revisar'){
      const el = e.target.closest('[data-elegir]'); if(el){ leerCampos(); const [i, m] = el.dataset.elegir.split(':'); F.lineas[+i].m = m; return pintarFoto(); }
      const pv = e.target.closest('[data-c-prov]'); if(pv){ leerCampos(); F.prov = pv.dataset.cProv; const p = M().proveedores.find(x => x.id === F.prov); F.doc = p.iva ? 'factura' : 'nota'; F.agregar = { m:null, q:'', p:'' }; return pintarFoto(); }
      const dc = e.target.closest('[data-c-doc]'); if(dc){ leerCampos(); F.doc = dc.dataset.cDoc; return pintarFoto(); }
      const am = e.target.closest('[data-agregar-m]'); if(am){ leerCampos(); const f = M().fab.find(x => x.id === am.dataset.agregarM); F.agregar.m = f.id; if(!F.agregar.p) F.agregar.p = (f.precios[F.prov] || {}).p || ''; return pintarFoto(); }
      if(e.target.closest('[data-agregar]')){ leerCampos(); const q = num(F.agregar.q), pr = num(F.agregar.p); if(!F.agregar.m) return toast('Elige el material', 'error'); if(!(q > 0)) return toast('Escribe la cantidad', 'error'); if(!(pr > 0)) return toast('Escribe el precio sin IVA', 'error'); F.lineas.push({ m:F.agregar.m, q, p:pr }); F.agregar = { m:null, q:'', p:'' }; return pintarFoto(); }
      if(e.target.closest('[data-aparte]')){ leerCampos(); F.aparte = !F.aparte; if(F.aparte && !F.tMonto) F.tMonto = totales().total; return pintarFoto(); }
      const tc = e.target.closest('[data-t-cuenta]'); if(tc){ leerCampos(); F.tCuenta = tc.dataset.tCuenta; return pintarFoto(); }
    }
  });
  document.addEventListener('change', (e) => { if(F && F.fase === 'revisar' && /^(lq|lp)\d+$|^tMonto$/.test(e.target.id)){ leerCampos(); pintarFoto(); } });
  $('btnContar').onclick = abrirConteo;
  $('btnGuardarConteo').onclick = guardarConteo;
  $('btnFoto').onclick = abrirFoto;
  $('btnGuardarFoto').onclick = guardarFoto;
  $('btnReiniciar').onclick = () => { window.MAQUETA.reiniciar(); toast('Datos de ejemplo reiniciados'); window.DepositoMaqueta.cargar(); };

  window.DepNuevo = { pintarFab, pintarCompras };
})();
