// Plan de corte semanal (window.CORTE): Costos › Semana. Sale de Producción: los pasos de Hierro asignados a un
// herrero para ese sábado (corte_datos). Junta las piezas de todas esas puertas por perfil, usa primero los retazos
// del depósito y acomoda el resto en barras (más largas primero, con el grosor del corte); lo que no alcanza son
// barras a comprar. Cada barra va al herrero con más centímetros en ella. Ray o Gualfredo aceptan o cambian;
// el plan se guarda en la base (corte_plan_guardar) y "Ya cortó" baja las barras (corte_ya_corto).
(function(){
  'use strict';
  const { esc, toast, abrirHoja, dinero } = window.AH;
  const $ = (id) => document.getElementById(id);
  const X = () => window.COSTEO;
  const D = () => X().datos();
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const COLORES = ['#17555C', '#B7791F', '#3F6E4E', '#6F7C7E', '#8A5A00', '#2E4A62', '#7A4E3A'];
  const isoL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function sabados(){ const d = new Date(); d.setHours(12, 0, 0, 0); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? 6 : 6 - w)); const este = isoL(d); d.setDate(d.getDate() + 7); return { este, proximo:isoL(d) }; }
  const sabTxt = (iso) => { try{ return window.AH.sabadoCorto(iso); } catch(e){ return iso; } };
  const errTxt = (e) => { const m = (e && e.message) || ''; return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa el internet y vuelve a intentar.' : (m || 'No se pudo guardar'); };
  const SAB = sabados();
  const q = new URLSearchParams(location.search);
  let semSab = q.get('para') === SAB.proximo ? SAB.proximo : SAB.este;
  let C = null;   // corte_datos()
  let ocupado = false;

  async function cargar(){
    if(X() && !D()) await X().cargar();
    const { data, error } = await db.rpc('corte_datos');
    if(error) throw error;
    C = data;
  }
  const nomMat = (mid) => (D().fab.find(f => String(f.id) === String(mid)) || {}).nombre || 'Material';
  const fabDe = (mid) => D().fab.find(f => String(f.id) === String(mid));
  const tieneCortes = (mid) => { const c = D().costeo[mid]; return !!(c && c.piezas && c.piezas.length); };

  // ---------- Cálculo del plan ----------
  function pasosHierro(){
    return (C.pasos || []).map(p => Object.assign({}, p, { herrero:p.herrero || null,
      etq:(p.interna ? 'Exhibición' : 'N° ' + p.venta) + (p.de > 1 ? ' (' + p.unidad + ' de ' + p.de + ')' : '') }));
  }
  // Primero los retazos del depósito, después las barras del depósito y, si faltan, barras a comprar
  function acomodar(piezas, f, corte, limiteBarras){
    const L = piezas.slice().sort((a, b) => b.cm - a.cm);
    const rets = (f.retazos || []).map(r => ({ mid:f.id, tipo:'retazo', rid:r.id, largo:Number(r.largo), libre:Number(r.largo), piezas:[] })).sort((a, b) => a.libre - b.libre);
    const barras = [], sinLugar = [];
    for(const p of L){
      const r = rets.find(x => x.libre + 1e-9 >= p.cm); if(r){ r.piezas.push(p); r.libre = Math.max(0, r.libre - p.cm - corte); continue; }
      let b = barras.find(x => x.libre + 1e-9 >= p.cm);
      if(!b){ if(limiteBarras != null && barras.length >= limiteBarras){ sinLugar.push(p); continue; } b = { mid:f.id, tipo:'barra', largo:Number(f.largo), libre:Number(f.largo), piezas:[] }; barras.push(b); }
      b.piezas.push(p); b.libre = Math.max(0, b.libre - p.cm - corte);
    }
    barras.forEach((b, i) => { b.n = i + 1; b.comprar = i >= f.stock; });
    return { usados:rets.filter(r => r.piezas.length), barras, sinLugar };
  }
  // El herrero de una barra: el que tiene más centímetros en ella
  function duenoBarra(b){ const cm = {}; b.piezas.forEach(p => { cm[p.tid] = (cm[p.tid] || 0) + p.cm; }); return Object.entries(cm).sort((a, b2) => b2[1] - a[1])[0][0]; }
  function piezasDe(unidades){
    const por = {};
    unidades.forEach(u => D().costeo[u.mid].piezas.forEach(([mid, n, cm, nota]) => { for(let i = 0; i < n; i++) (por[mid] ||= []).push({ cm:Number(cm), nota, eid:u.eid, etq:u.etq, tid:u.tid, color:u.color }); }));
    return por;
  }
  function sugerir(unidades){
    const por = piezasDe(unidades), barras = [];
    Object.entries(por).forEach(([mid, pz]) => { const f = fabDe(mid); if(!f) return; const r = acomodar(pz, f, D().reglas.corte); r.usados.concat(r.barras).forEach(b => { b.tid = duenoBarra(b); barras.push(b); }); });
    return barras;
  }
  const firma = (unidades) => unidades.map(u => u.eid + ':' + u.tid).sort().join(',');
  function planSemana(sab, prov){
    prov = prov || (window.CostosApp && window.CostosApp.prov) || D().prov;
    const todos = pasosHierro();
    const asign = todos.filter(u => u.tid && u.para === sab);
    asign.forEach((u, i) => { u.color = COLORES[i % COLORES.length]; u.conCortes = !!u.mid && tieneCortes(u.mid); u.x = u.conCortes ? X().costear(u.mid, { prov }) : null; });
    const conPlan = asign.filter(u => u.conCortes && !u.cortado), sinCortes = asign.filter(u => !u.conCortes), cortadas = asign.filter(u => u.conCortes && u.cortado);
    const pendientes = todos.filter(u => !u.tid), otroSab = todos.filter(u => u.tid && u.para !== sab);
    const guardado = (C.planes || {})[sab], f0 = firma(conPlan);
    let barras, cambio = false, ajustado = false;
    if(guardado && guardado.firma === f0 && (guardado.barras || []).length){ barras = JSON.parse(JSON.stringify(guardado.barras)); ajustado = !!guardado.ajustado;
      const col = {}; conPlan.forEach(u => { col[u.eid] = u.color; }); barras.forEach(b => b.piezas.forEach(p => { if(col[p.eid]) p.color = col[p.eid]; })); }
    else { barras = conPlan.length ? sugerir(conPlan) : []; cambio = !!(guardado && (guardado.barras || []).length && !guardado.cerrado); }
    const iva = 1 + D().reglas.iva / 100, mats = {};
    barras.forEach(b => { const m = (mats[b.mid] ||= { f:fabDe(b.mid), barras:0, retazos:0, cm:0 }); if(b.tipo === 'barra') m.barras++; else m.retazos++; m.cm += b.piezas.reduce((a, p) => a + p.cm, 0); });
    const compras = Object.values(mats).filter(m => m.f).map(m => { const pr = X().precioFab(m.f, String(prov)), comprar = Math.max(0, m.barras - m.f.stock); return Object.assign(m, { comprar, precio:(pr.p || 0) * iva, costo:comprar * (pr.p || 0) * iva, de:pr.de }); });
    const hojas = {}; conPlan.forEach(u => (D().costeo[u.mid].hojas || []).forEach(([mid, n, a, h]) => { hojas[mid] = (hojas[mid] || 0) + n * a * h / 10000; }));
    const hj = Object.entries(hojas).map(([mid, m2]) => { const f = fabDe(mid); if(!f) return null; const hm2 = f.hoja[0] * f.hoja[1] / 10000, sob = (f.sobrantes || []).reduce((a, s2) => a + s2[0] * s2[1] / 10000, 0);
      return { f, m2, hojas:m2 / hm2, sobrante:sob, comprar:Math.max(0, Math.ceil((m2 - sob) / hm2 - 1e-9) - f.stock) }; }).filter(Boolean);
    const herreros = [...new Set(asign.map(u => u.tid))].map(tid => ({ tid, nombre:(asign.find(u => u.tid === tid) || {}).herrero || 'Herrero', barras:barras.filter(b => b.tid === tid), unidades:asign.filter(u => u.tid === tid),
      entregado:!!(guardado && guardado.entregado && guardado.entregado[tid]) }));
    let solas = 0; conPlan.forEach(u => Object.entries(piezasDe([u])).forEach(([mid, pz]) => { const f = fabDe(mid); if(f) solas += X().empacar(pz, f.largo, D().reglas.corte).length; }));
    const usadas = barras.filter(b => b.tipo === 'barra').length;
    return { sab, prov, asign, conPlan, sinCortes, cortadas, pendientes, otroSab, barras, compras, hj, herreros, cambio, ajustado,
      manual:(guardado && guardado.manual) || {}, aceptado:!!(guardado && guardado.firma === f0 && guardado.aceptado), cerrado:!!(guardado && guardado.cerrado), firma:f0,
      comprar:X().r2(compras.reduce((a, m) => a + m.costo, 0)), nComprar:compras.reduce((a, m) => a + m.comprar, 0) + hj.reduce((a, x) => a + x.comprar, 0), ahorro:Math.max(0, solas - usadas), aluminio:C.aluminio || 0 };
  }
  // ¿Qué alcanzo con lo que hay? Agrega puertas en orden de entrega mientras alcancen las barras indicadas
  function alcanza(sab, hay){
    const P = planSemana(sab), orden = P.conPlan.slice().sort((a, b) => String(a.entrega).localeCompare(String(b.entrega)) || a.venta - b.venta);
    const si = [], no = [];
    for(const u of orden){
      const prueba = si.concat([u]), por = piezasDe(prueba);
      const ok = Object.entries(por).every(([mid, pz]) => { const f = fabDe(mid); const lim = hay[mid] != null ? hay[mid] : f.stock; return acomodar(pz, f, D().reglas.corte, lim).sinLugar.length === 0; });
      (ok ? si : no).push(u);
    }
    return { si, no };
  }
  // Para Depósito › Fabricación: cuánto usa y cuánto falta de cada material este sábado y el próximo
  async function necesita(){
    if(!C) await cargar();
    const out = { _sab:SAB.este };
    [SAB.este, SAB.proximo].forEach((sab, i) => { const P = planSemana(sab);
      P.compras.forEach(m => { const o = (out[m.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { usa:m.barras, retazos:m.retazos, falta:m.comprar }; });
      P.hj.forEach(x => { const o = (out[x.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { m2:x.m2, falta:x.comprar }; }); });
    return out;
  }

  // ---------- Pantalla (Costos › Semana) ----------
  const cmTxt = (n) => Math.round(n) + ' cm';
  function etiquetaBarra(b){ return b.tipo === 'retazo' ? 'Retazo de ' + Math.round(b.largo) + ' cm del depósito' : 'Barra ' + b.n + (b.comprar ? ' · hay que comprarla' : ' · del depósito'); }
  function barraHtml(b, i, P){
    const ajenas = b.piezas.filter(p => p.tid !== b.tid);
    const nomAj = [...new Set(ajenas.map(p => (P.herreros.find(h => h.tid === p.tid) || {}).nombre))];
    return `<button type="button" class="barra-btn" data-barra="${i}" ${P.aceptado && !P.cerrado ? '' : ''}><span class="barra-l"><span>${esc(etiquetaBarra(b))}</span><span>sobra ${cmTxt(b.libre)}${b.libre >= 50 ? ' · retazo' : ''}</span></span>
      <span class="barra ${b.tipo === 'retazo' ? 'es-ret' : ''} ${b.comprar ? 'es-comp' : ''}">${b.piezas.map(x => `<span style="flex:${x.cm};background:${esc(x.color || '#6F7C7E')}" title="${esc(x.etq)}">${x.cm}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}">${b.libre >= 40 ? Math.round(b.libre) : ''}</span>` : ''}</span>
      ${nomAj.length ? `<span class="barra-n">Lleva piezas de ${esc(nomAj.join(' y '))}: se las pasa al terminar</span>` : ''}</button>`;
  }
  let PA = null;   // plan pintado
  function html(){
    if(!C) return '<p class="mat-s" style="margin:24px 2px">Cargando…</p>';
    const P = PA = planSemana(semSab), d = D(), prov = P.prov;
    $('subtitulo').textContent = 'Plan de corte del ' + sabTxt(semSab);
    let h = `<div class="opts" style="--cols:2;margin-bottom:12px">${[[SAB.este, 'Este ' + sabTxt(SAB.este)], [SAB.proximo, 'Próximo ' + sabTxt(SAB.proximo)]].map(([v, t]) => `<button class="opt ${v === semSab ? 'selected' : ''}" type="button" data-sab="${v}">${esc(t)}</button>`).join('')}</div>`;
    if(P.cambio) h += `<div class="caja-amar">Cambió lo asignado en Producción desde que ajustaste el plan. La app volvió a sugerir. Revísalo y acéptalo de nuevo.</div>`;
    if(P.cerrado) h += `<div class="caja-ok">Cortes de este sábado hechos. Las barras bajaron del depósito y los retazos quedaron guardados.</div>`;
    else if(P.aceptado) h += `<div class="caja-ok">Plan aceptado. Cada herrero ya tiene su hoja de corte en Mi trabajo. Cuando termine de cortar, toca "Ya cortó".</div>`;
    h += `<div class="res"><div class="res-c"><span>Puertas para cortar</span><b>${P.conPlan.length}</b></div><div class="res-c ${P.nComprar ? 'rojo' : 'ok'}"><span>${P.nComprar ? 'Hay que comprar' : 'Material'}</span><b>${P.nComprar ? dinero(P.comprar) : 'Alcanza'}</b></div></div>`;
    h += `<div class="tit" style="margin-top:4px">Asignado en Producción</div>`;
    if(!P.asign.length) h += `<div class="vacio-d"><b>No hay Hierro asignado para el ${esc(sabTxt(semSab))}</b>Asigna en Producción y aquí sale el plan.</div>`;
    P.herreros.forEach(hr => {
      h += `<div class="hr-h"><b>${esc(hr.nombre)}</b><span>${plural(hr.unidades.length, '1 puerta', 'puertas')}${hr.barras.length ? ' · ' + plural(hr.barras.length, '1 barra o retazo', 'barras y retazos') : ''}</span></div>`;
      h += hr.unidades.map(u => {
        const sub = u.cortado ? 'Ya cortado' : !u.conCortes ? 'Sin cortes cargados' : u.x && u.x.falta.length ? 'Faltan datos de costo' : u.interna ? 'Exhibición · costo ' + dinero(u.x.costo) : 'Costo ' + dinero(u.x.costo) + ' · gana ' + dinero(u.precio - u.x.costo - u.x.fijos);
        return `<div class="ped-c ${!u.conCortes ? 'falta' : ''}"><span class="dot" style="background:${u.conCortes ? u.color : 'var(--ink-faint)'}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.cliente)} · ${esc(sub)}</small></span>${u.conCortes ? '' : `<span class="pill gris">Sin cortes</span>`}</div>`;
      }).join('');
    });
    P.sinCortes.forEach(u => {
      const manual = !!P.manual[u.eid];
      h += `<div class="caja-rara" style="margin-top:8px"><b>${esc(u.etq)} · ${esc(u.nombre)} no tiene cortes cargados.</b> ${manual ? esc(u.herrero || 'El herrero') + ' lo corta a mano esta semana. Carga sus cortes cuando puedas para que entre al plan.' : 'No entra al plan. Puedes cargarlos ahora o dejar que ' + esc(u.herrero || 'el herrero') + ' lo corte a mano.'}
        <span class="dos-btn">${u.mid ? `<a class="btn-mini" href="costos.html?modelo=${encodeURIComponent(u.mid)}&volver=semana&para=${semSab}">Cargar cortes ahora</a>` : ''}${manual ? '' : `<button class="btn-mini sec" type="button" data-manual="${u.eid}">Cortar a mano</button>`}</span></div>`;
    });
    if(P.pendientes.length){
      h += `<div class="tit">Sin asignar en Producción</div><p class="mat-s" style="margin:0 2px 6px">No entra al plan hasta que tenga herrero y sábado.</p>`;
      h += P.pendientes.map(u => `<a class="ped-c" href="produccion.html"><span class="dot" style="background:var(--line)"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.cliente)}${u.mid && tieneCortes(u.mid) ? '' : ' · sin cortes'}</small></span><span class="pill amar">Asignar</span></a>`).join('');
    }
    if(P.otroSab.length) h += `<p class="mat-s" style="margin:8px 2px 0">${plural(P.otroSab.length, '1 puerta asignada', 'puertas asignadas')} para otro sábado.</p>`;
    if(P.aluminio) h += `<div class="gris-l">Aluminio · ${plural(P.aluminio, '1 paso', 'pasos')} en fabricación. El plan de corte de aluminio llega pronto.</div>`;
    if(P.barras.length){
      h += `<div class="tit">Qué comprar</div>`;
      const compras = P.compras.filter(m => m.comprar);
      h += compras.length || P.hj.some(x => x.comprar) ? `<div class="tot">${compras.map(m => `<div class="fila"><span>${esc(m.f.nombre)} · ${plural(m.comprar, '1 barra', 'barras')} (hay ${m.f.stock})</span><b>${dinero(m.costo)}</b></div>`).join('')}
          ${P.hj.filter(x => x.comprar).map(x => `<div class="fila"><span>${esc(x.f.nombre)} · ${plural(x.comprar, '1 hoja', 'hojas')} (usa ${x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 })} m²)</span><b>Ver precio</b></div>`).join('')}
          <div class="fila fin"><span>Total barras con IVA</span><span>${dinero(P.comprar)}</span></div></div>`
        : `<div class="caja-ok">Con lo que hay en el depósito alcanza. No hay que comprar.</div>`;
      h += `<div class="field-label" style="margin-top:10px">Precios de</div><div class="opts" style="--cols:2">${d.proveedores.filter(p => (p.tipos || []).includes('hierro')).map(p => `<button class="opt ${String(p.id) === String(prov) ? 'selected' : ''}" type="button" data-cprov="${p.id}">${esc(p.nombre.replace('Inversiones ', ''))}</button>`).join('')}</div>`;
      if(P.ahorro) h += `<div class="ahorro">Cortando todo junto se usan ${plural(P.ahorro, '1 barra menos', 'barras menos')} que cortando cada puerta aparte.</div>`;
      h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:12px"><button class="btn-secondary" type="button" data-pdf-compra style="flex:1;height:50px">Plan de compra</button><a class="btn-primary" href="deposito.html?tab=compras" style="flex:1;display:flex;align-items:center;justify-content:center;text-decoration:none;height:50px">Cargar la compra</a></div>`;
      h += `<div class="tit">Cómo se corta ${P.ajustado ? '· ajustado por ti' : '· sugerencia de la app'}</div>
        <p class="mat-s" style="margin:0 2px 8px">Cada tubo junta piezas de varias puertas.${P.cerrado ? '' : ' Toca una barra para cambiar quién la corta o mover una pieza.'}</p>
        <div class="leg">${P.conPlan.map(u => `<span><i style="background:${u.color}"></i>${esc(u.etq)}</span>`).join('')}<span><i style="background:#F1E4D6"></i>Sobra</span></div>`;
      P.herreros.filter(hr => hr.barras.length).forEach(hr => {
        h += `<div class="hr-h" style="margin-top:12px"><b>${esc(hr.nombre)}</b><button type="button" class="link-b" data-hoja-h="${esc(hr.tid)}">Ver su hoja</button></div>`;
        const porMat = {}; hr.barras.forEach(b => (porMat[b.mid] ||= []).push(b));
        Object.entries(porMat).forEach(([mid, bs]) => { h += `<div class="mat-b"><div class="mat-b-h"><b>${esc(nomMat(mid))}</b></div>${bs.map(b => barraHtml(b, P.barras.indexOf(b), P)).join('')}</div>`; });
      });
      if(P.hj.length) h += `<div class="tit">Lámina y vidrio</div>` + P.hj.map(x => `<div class="cg-fila"><div class="cg-nom">${esc(x.f.nombre)}<span>Usa ${x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 })} m² · hay ${plural(x.f.stock, '1 hoja', 'hojas')}${x.sobrante ? ' y ' + x.sobrante.toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m² de sobrantes' : ''}</span></div><div style="text-align:right;font-weight:800">${x.comprar ? 'Comprar ' + x.comprar : 'Alcanza'}</div></div>`).join('');
      if(!P.cerrado){
        if(!P.aceptado) h += `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:16px"><button class="btn-secondary" type="button" data-alcanza style="flex:1;height:54px">¿Qué alcanzo?</button><button class="btn-primary" type="button" data-aceptar style="flex:1.3">Aceptar plan</button></div>`;
        else h += `<div class="tit">¿Quién ya cortó?</div>` + P.herreros.filter(hr => hr.barras.length).map(hr => hr.entregado ? `<div class="caja-ok" style="margin-top:6px">${esc(hr.nombre)} ya cortó</div>` : `<button class="btn-secondary" type="button" data-ya-corto="${esc(hr.tid)}" style="width:100%;margin-top:8px">${esc(hr.nombre)} ya cortó</button>`).join('');
        if(P.ajustado && !P.herreros.some(hr => hr.entregado)) h += `<button class="btn-nuevo" type="button" data-plan-reiniciar>Volver a la sugerencia de la app</button>`;
      }
    }
    return h;
  }
  function despues(){}

  function hojaHerrero(P, tid){
    const hr = P.herreros.find(x => String(x.tid) === String(tid)); if(!hr) return null;
    const porMat = {}; hr.barras.forEach(b => (porMat[b.mid] ||= []).push(b));
    const manuales = P.sinCortes.filter(u => u.tid === tid);
    const pasar = []; hr.barras.forEach(b => b.piezas.filter(p => p.tid !== tid).forEach(p => pasar.push(p)));
    return { hr, porMat, manuales, pasar };
  }
  const nomH = (P, tid) => (P.herreros.find(h2 => h2.tid === tid) || {}).nombre || '';
  function abrirHojaHerrero(tid){
    const P = planSemana(semSab), o = hojaHerrero(P, tid); if(!o) return;
    $('detTitulo').textContent = 'Hoja de corte de ' + o.hr.nombre;
    $('detBody').innerHTML = `<p class="mat-s" style="margin:0 2px 10px">Así le llega a ${esc(o.hr.nombre)} en Mi trabajo${P.aceptado ? '' : ' cuando aceptes el plan'}.</p>
      <div class="telefono"><div class="tel-h"><b>Tu hoja de corte</b><span>Para el ${esc(sabTxt(semSab))} · medidas en cm</span></div>
        <p class="tel-n">Corta primero los retazos. Guarda lo que sobre de 50 cm o más.</p>
        ${Object.entries(o.porMat).map(([mid, bs]) => `<div class="tel-m">${esc(nomMat(mid))}</div>${bs.map(b => `<div class="tel-b"><span class="tel-bt">${esc(b.tipo === 'retazo' ? 'Retazo de ' + Math.round(b.largo) : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''))}</span>
          <span class="barra">${b.piezas.map(x => `<span style="flex:${x.cm};background:${esc(x.color || '#6F7C7E')}">${x.cm}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}"></span>` : ''}</span>
          <span class="tel-p">${b.piezas.map(x => `${x.cm} · ${esc(x.etq)}${x.tid !== o.hr.tid ? ' (de ' + esc(nomH(P, x.tid)) + ')' : ''}`).join('<br>')}${b.libre >= 50 ? '<br><b>Guarda el retazo de ' + Math.round(b.libre) + '</b>' : ''}</span></div>`).join('')}`).join('')}
        ${o.pasar.length ? `<div class="tel-m">Pásale a tu compañero</div>${o.pasar.map(x => `<div class="tel-p">${x.cm} cm · ${esc(x.etq)} → ${esc(nomH(P, x.tid))}</div>`).join('')}` : ''}
        ${o.manuales.map(u => `<div class="tel-m">${esc(u.etq)} · ${esc(u.nombre)}</div><div class="tel-p">Este modelo no tiene plan. Córtalo como siempre.</div>`).join('')}
      </div>`;
    $('detFoot').innerHTML = `<button class="btn-primary" type="button" data-pdf-hoja="${esc(tid)}">PDF de la hoja de ${esc(o.hr.nombre)}</button>`;
    abrirHoja('sheetDet');
  }
  async function sacarPDF(o, nombre){
    try{ toast('Preparando el PDF…'); const blob = await window.PDFR.crear(o); const r = await window.PDFR.compartir(blob, nombre); if(r === 'descargado') toast('PDF listo'); }
    catch(e){ toast((e && e.message) || 'No se pudo hacer el PDF', 'error'); }
  }
  async function pdfHoja(tid){
    const P = planSemana(semSab), o = hojaHerrero(P, tid); if(!o) return;
    const bloques = [{ t:'nota', texto:'Corta primero los retazos. Guarda lo que sobre de 50 cm o más y anótalo. Medidas en cm.' }];
    Object.entries(o.porMat).forEach(([mid, bs]) => { bloques.push({ t:'titulo', texto:nomMat(mid), der:plural(bs.length, '1 barra o retazo', 'barras y retazos') });
      bs.forEach(b => bloques.push({ t:'barra', etiqueta:b.tipo === 'retazo' ? 'Retazo de ' + Math.round(b.largo) + ' cm' : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''), der:'sobra ' + Math.round(b.libre) + ' cm' + (b.libre >= 50 ? ' · guardar' : ''), largo:b.largo, sobra:b.libre,
        piezas:b.piezas.map(x => ({ cm:x.cm, txt:'(' + x.etq + (x.tid !== tid ? ', de ' + nomH(P, x.tid) : '') + ')' })) })); });
    if(o.pasar.length){ bloques.push({ t:'titulo', texto:'Pásale a tu compañero' }); o.pasar.forEach(x => bloques.push({ t:'fila', a:x.cm + ' cm · ' + x.etq, b:nomH(P, x.tid) })); }
    if(o.manuales.length){ bloques.push({ t:'titulo', texto:'Sin plan: cortar a mano' }); o.manuales.forEach(u => bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre, b:'a mano' })); }
    await sacarPDF({ titulo:'Hoja de corte', derecha:o.hr.nombre, subtitulo:'Para el ' + sabTxt(semSab) + '. Sale de lo asignado en Producción.', bloques }, 'Hoja-de-corte-' + String(o.hr.nombre).replace(/[^A-Za-z0-9]+/g, '-') + '-' + semSab + '.pdf');
  }
  async function pdfCompra(){
    const P = planSemana(semSab), pv = D().proveedores.find(p => String(p.id) === String(P.prov));
    const bloques = [{ t:'titulo', texto:'Barras', der:'Precio con IVA' }];
    P.compras.filter(m => m.comprar).forEach(m => bloques.push({ t:'fila', a:m.f.nombre + ' · ' + plural(m.comprar, '1 barra', 'barras') + ' de ' + String(m.f.largo / 100).replace('.', ',') + ' m', b:dinero(m.costo) }));
    if(!P.compras.some(m => m.comprar)) bloques.push({ t:'fila', a:'Con lo que hay alcanza', b:'' });
    bloques.push({ t:'total', a:'Total barras', b:dinero(P.comprar) });
    if(P.hj.length){ bloques.push({ t:'titulo', texto:'Lámina y vidrio' }); P.hj.forEach(x => bloques.push({ t:'fila', a:x.f.nombre + ' · usa ' + x.m2.toLocaleString('es-VE', { maximumFractionDigits:2 }) + ' m²', b:x.comprar ? 'Comprar ' + x.comprar : 'Alcanza' })); }
    // Resumen con ganancia por pedido
    if(P.conPlan.length){ bloques.push({ t:'titulo', texto:'Costo y ganancia por pedido' }); P.conPlan.forEach(u => { if(!u.x || u.x.falta.length) return bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre, b:'faltan datos' }); const g = u.interna ? -u.x.costo : u.precio - u.x.costo - u.x.fijos; bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre + ' · cuesta ' + dinero(u.x.costo), b:(u.interna ? 'exhibición ' : 'gana ') + dinero(Math.abs(g)), rojo:g < 0 && !u.interna }); }); }
    bloques.push({ t:'nota', texto:'Precios de ' + (pv ? pv.nombre : 'el proveedor principal') + '. Si no vende un material, se usó el precio de otro proveedor.' });
    await sacarPDF({ titulo:'Plan de compra', derecha:sabTxt(semSab), subtitulo:plural(P.conPlan.length, '1 puerta para cortar', 'puertas para cortar') + '. Primero se usan los retazos y las barras del depósito.', bloques }, 'Plan-de-compra-' + semSab + '.pdf');
  }
  // Cambiar una barra: quién la corta y mover piezas
  function renumerar(P){
    P.barras = P.barras.filter(b => b.piezas.length);
    const por = {}; P.barras.filter(b => b.tipo === 'barra').forEach(b => (por[b.mid] ||= []).push(b));
    Object.entries(por).forEach(([mid, bs]) => { const f = fabDe(mid); bs.forEach((b, i) => { b.n = i + 1; b.comprar = i >= f.stock; }); });
  }
  function moverPieza(P, bi, pi, destino){
    const R = D().reglas, b = P.barras[bi], p = b.piezas[pi];
    let dst;
    if(destino === 'nueva'){ const f = fabDe(b.mid); dst = { mid:b.mid, tipo:'barra', largo:Number(f.largo), libre:Number(f.largo), piezas:[], tid:b.tid }; P.barras.push(dst); }
    else dst = P.barras[+destino];
    if(!dst || dst.libre + 1e-9 < p.cm) return false;
    b.piezas.splice(pi, 1); b.libre = Math.min(b.largo, b.libre + p.cm + R.corte);
    dst.piezas.push(p); dst.libre = Math.max(0, dst.libre - p.cm - R.corte);
    renumerar(P); return true;
  }
  const limpiar = (barras) => barras.map(b => ({ mid:b.mid, tipo:b.tipo, rid:b.rid || null, largo:b.largo, libre:Math.round(b.libre * 10) / 10, n:b.n || null, comprar:!!b.comprar, tid:b.tid,
    piezas:b.piezas.map(p => ({ cm:p.cm, nota:p.nota || '', eid:p.eid, etq:p.etq, tid:p.tid })) }));
  async function guardarPlan(P, cambios, ok){
    if(ocupado) return false; ocupado = true;
    try{
      const { error } = await db.rpc('corte_plan_guardar', { p_sab:semSab, p:Object.assign({ firma:P.firma, barras:limpiar(P.barras), aceptado:P.aceptado, ajustado:P.ajustado }, cambios) });
      if(error) throw error;
      await cargar(); if(ok) toast(ok); window.CostosApp.pintar(); return true;
    } catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { ocupado = false; }
  }
  async function llamar(fn, args, ok){
    if(ocupado) return; ocupado = true;
    try{ const { error } = await db.rpc(fn, args); if(error) throw error; await window.CostosApp.recargar(); if(ok) toast(ok); }
    catch(e){ toast(errTxt(e), 'error'); }
    finally { ocupado = false; }
  }
  const alcanzaMats = () => { const P = planSemana(semSab); return [...new Set(P.barras.map(b => String(b.mid)))].map(mid => fabDe(mid)).filter(Boolean); };

  // Formularios dentro de la hoja de Costos (t:'corte')
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${valor != null && String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  function form(F){
    if(F.k === 'barra'){
      const P = planSemana(semSab), b = P.barras[F.bi];
      if(!b) return { titulo:'Barra', h:'<p class="mat-s">Esta barra ya no está en el plan.</p>', boton:'Listo' };
      const destinos = F.mover != null ? P.barras.map((x, i) => [x, i]).filter(([x, i]) => i !== F.bi && String(x.mid) === String(b.mid) && x.libre + 1e-9 >= b.piezas[F.mover].cm) : [];
      return { titulo:nomMat(b.mid) + ' · ' + (b.tipo === 'retazo' ? 'retazo ' + Math.round(b.largo) : 'barra ' + b.n), boton:'Guardar cambio',
        h:`<div class="field"><span class="field-label">¿Quién la corta?</span>${opts(P.herreros.map(hr => [hr.tid, esc(hr.nombre)]), F.tid, 'data-f-tid')}</div>
        <div class="field-label">Piezas · toca una para moverla</div>
        ${b.piezas.map((x, i) => `<button type="button" class="pz ${F.mover === i ? 'on' : ''}" data-f-mover="${i}"><span class="pz-n" style="background:${esc(x.color || '#6F7C7E')};color:#fff">${x.cm}</span><span><span class="pz-t">${esc(x.etq)}</span><span class="pz-s">${esc(x.nota || '')}</span></span><span class="pz-m">${F.mover === i ? 'Mover' : ''}</span></button>`).join('')}
        ${F.mover != null ? `<div class="field" style="margin-top:10px"><span class="field-label">¿A dónde la mueves?</span>${opts(destinos.map(([x, i]) => [i, esc(x.tipo === 'retazo' ? 'Retazo ' + Math.round(x.largo) : 'Barra ' + x.n) + '<br><small style="font-weight:600">' + esc(nomH(P, x.tid)) + ' · le caben ' + Math.round(x.libre) + ' cm</small>']).concat([['nueva', 'Barra nueva<br><small style="font-weight:600">puede que haya que comprarla</small>']]), F.dest, 'data-f-dest', 1)}</div>` : ''}` };
    }
    if(F.k === 'alcanza'){
      const mats = alcanzaMats();
      let h = `<p class="mat-s" style="margin:0 2px 10px;font-size:14px">Pon cuántas barras enteras tienes de cada perfil (ya están las del depósito). La app agrega las puertas en orden de entrega mientras alcance. Los retazos también cuentan.</p>
        ${mats.map(f => `<div class="field"><label class="field-label" for="fH_${f.id}">${esc(f.nombre)}</label><input class="input" id="fH_${f.id}" inputmode="numeric" value="${esc(F.hay[f.id] != null ? F.hay[f.id] : f.stock)}"></div>`).join('')}`;
      if(F.res) h += `<div class="tit">Alcanza para</div>${F.res.si.length ? F.res.si.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero || '')}</small></span><span class="pill verde">Sí</span></div>`).join('') : '<p class="mat-s">Ninguna puerta completa.</p>'}
        ${F.res.no.length ? `<div class="tit">No alcanza para</div>${F.res.no.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero || '')} · quedaría pendiente</small></span><span class="pill rojo">Falta</span></div>`).join('')}` : ''}`;
      return { titulo:'¿Qué alcanzo con lo que hay?', h, boton:'Calcular' };
    }
    return { titulo:'', h:'', boton:'Listo' };
  }
  function clickForm(e, F){
    const b = (a) => { const x = e.target.closest('[' + a + ']'); return x && x.closest('#formBody') ? x : null; };
    const t = b('data-f-tid'); if(t){ F.tid = t.dataset.fTid; return true; }
    const m = b('data-f-mover'); if(m){ F.mover = F.mover === +m.dataset.fMover ? null : +m.dataset.fMover; F.dest = null; return true; }
    const d = b('data-f-dest'); if(d){ F.dest = d.dataset.fDest; return true; }
    return false;
  }
  async function guardarForm(F){
    if(F.k === 'barra'){
      const P = planSemana(semSab), b = P.barras[F.bi]; if(!b) return true;
      if(F.mover != null && F.dest == null){ toast('Elige a dónde mover la pieza', 'error'); return false; }
      if(F.tid) b.tid = F.tid;
      if(F.mover != null && !moverPieza(P, F.bi, F.mover, F.dest)){ toast('Esa pieza no cabe ahí', 'error'); return false; }
      return await guardarPlan(P, { ajustado:true, aceptado:false }, 'Plan ajustado. Acéptalo cuando esté listo.');
    }
    if(F.k === 'alcanza'){
      const hay = {}; alcanzaMats().forEach(f => { const v = parseInt(($('fH_' + f.id) || {}).value, 10); hay[f.id] = isFinite(v) && v >= 0 ? v : f.stock; });
      F.hay = hay; const r = alcanza(semSab, hay), P = planSemana(semSab);
      const col = (u) => (P.conPlan.find(x => x.eid === u.eid) || {}).color; F.res = { si:r.si.map(u => Object.assign(u, { color:col(u) })), no:r.no.map(u => Object.assign(u, { color:col(u) })) };
      const o = form(F); $('formBody').innerHTML = o.h; return false;
    }
    return true;
  }
  // Clics de la pestaña Semana. Devuelve true si lo atendió.
  function click(e){
    const sb = e.target.closest('[data-sab]'); if(sb){ semSab = sb.dataset.sab; window.CostosApp.pintar(); return true; }
    const cp = e.target.closest('[data-cprov]'); if(cp){ window.CostosApp.prov = cp.dataset.cprov; window.CostosApp.pintar(); return true; }
    const ma = e.target.closest('[data-manual]'); if(ma){ llamar('corte_manual', { p_sab:semSab, eid:+ma.dataset.manual }, 'Lo corta a mano esta semana. Sale en su hoja.'); return true; }
    const hh = e.target.closest('[data-hoja-h]'); if(hh){ abrirHojaHerrero(hh.dataset.hojaH); return true; }
    const ph = e.target.closest('[data-pdf-hoja]'); if(ph){ pdfHoja(ph.dataset.pdfHoja); return true; }
    if(e.target.closest('[data-pdf-compra]')){ pdfCompra(); return true; }
    if(e.target.closest('[data-alcanza]')){ window.CostosApp.abrirCorte({ k:'alcanza', hay:{}, res:null }); return true; }
    if(e.target.closest('[data-aceptar]')){ const P = planSemana(semSab); P.aceptado = true; guardarPlan(P, { aceptado:true, ajustado:P.ajustado }, 'Plan aceptado. Cada herrero ya tiene su hoja de corte en Mi trabajo.'); return true; }
    const yc = e.target.closest('[data-ya-corto]'); if(yc){ const hr = (PA && PA.herreros.find(h => String(h.tid) === yc.dataset.yaCorto)) || {}; if(!confirm(`¿${hr.nombre || 'El herrero'} ya cortó? Bajan sus barras del depósito y se guardan los retazos de 50 cm o más.`)) return true; llamar('corte_ya_corto', { p_sab:semSab, tid:yc.dataset.yaCorto }, 'Bajaron las barras del depósito y se guardaron los retazos.'); return true; }
    if(e.target.closest('[data-plan-reiniciar]')){ llamar('corte_plan_reiniciar', { p_sab:semSab }, 'Volvió la sugerencia de la app'); return true; }
    const br = e.target.closest('[data-barra]'); if(br){ const P = planSemana(semSab); if(P.cerrado) return true; const b = P.barras[+br.dataset.barra]; if(b) window.CostosApp.abrirCorte({ k:'barra', bi:+br.dataset.barra, tid:b.tid, mover:null, dest:null }); return true; }
    return false;
  }

  window.CORTE = { cargar, html, despues, click, form, clickForm, guardarForm, necesita, planSemana, alcanza, sabados };
})();
