// Plan de corte (window.CORTE): Costos › Plan de corte, en 3 pasos.
// 1 Pedidos del sábado: salen de Producción (los pasos de Hierro asignados a un herrero para ese sábado, corte_datos).
// 2 Material, en metros: necesitas · hay (barras y retazos) · comprar. Tocar un material muestra sus barras dibujadas:
//   usar o no usar cada retazo, "+ Retazo que encontré", mover una pieza (también a un retazo no elegido) y volver a la
//   sugerencia. La lámina se acomoda en la hoja (guillotina simple) y el vidrio sale como lista de piezas cortadas.
// 3 Comprar lo que falta.
// Las barras bajan solas cuando el herrero termina TODOS sus pasos de Hierro del sábado (lo hace la base, v82); Ray
// lo puede marcar a mano y después "Corregir corte". El servidor recalcula lo que sobra: aquí solo se sugiere.
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
  const num = (n, d) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits:d == null ? 0 : d, maximumFractionDigits:d == null ? 2 : d });
  const mTxt = (cm) => num(cm / 100, 2) + ' m';
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
  const minRet = (f) => Number(f && f.minRet) || 50;   // un solo lugar: lo calcula la base (_retazo_minimo)
  const reglas = () => ({ corte:Number(D().reglas.corte) || 0, desp:Number(D().reglas.despunte) || 0 });

  // ---------- Cálculo del plan ----------
  function pasosHierro(){
    return (C.pasos || []).map(p => Object.assign({}, p, { herrero:p.herrero || null,
      etq:(p.interna ? 'Exhibición' : 'N° ' + p.venta) + (p.de > 1 ? ' (' + p.unidad + ' de ' + p.de + ')' : '') }));
  }
  const barraNueva = (f, tid) => ({ mid:f.id, tipo:'barra', largo:Number(f.largo), libre:Number(f.largo) - reglas().desp, piezas:[], tid });
  const retazoBarra = (f, r, tid) => ({ mid:f.id, tipo:'retazo', rid:r.id, num:r.num || null, largo:Number(r.largo), libre:Number(r.largo), piezas:[], tid });
  // Primero los retazos del depósito (el que deja menos desperdicio), después barras del depósito y, si faltan, a comprar
  function acomodar(piezas, f, noUsar, limiteBarras){
    const corte = reglas().corte, L = piezas.slice().sort((a, b) => b.cm - a.cm);
    const rets = (f.retazos || []).filter(r => !(noUsar || []).includes(r.id)).map(r => retazoBarra(f, r));
    const barras = [], sinLugar = [];
    for(const p of L){
      const r = rets.filter(x => x.libre + 1e-9 >= p.cm).sort((a, b) => a.libre - b.libre)[0]; if(r){ r.piezas.push(p); r.libre = Math.max(0, r.libre - p.cm - corte); continue; }
      let b = barras.find(x => x.libre + 1e-9 >= p.cm);
      if(!b){ if(limiteBarras != null && barras.length >= limiteBarras){ sinLugar.push(p); continue; } b = barraNueva(f); barras.push(b); }
      b.piezas.push(p); b.libre = Math.max(0, b.libre - p.cm - corte);
    }
    barras.forEach((b, i) => { b.n = i + 1; b.comprar = i >= f.stock; });
    return { usados:rets.filter(r => r.piezas.length), barras, sinLugar };
  }
  // El herrero de una barra: el que tiene más centímetros en ella
  function duenoBarra(b){ const cm = {}; b.piezas.forEach(p => { cm[p.tid] = (cm[p.tid] || 0) + p.cm; }); return Object.entries(cm).sort((a, b2) => b2[1] - a[1])[0][0]; }
  function piezasDe(unidades){
    const por = {};
    unidades.forEach(u => D().costeo[u.mid].piezas.forEach(([mid, n, cm, nota, que]) => { for(let i = 0; i < n; i++) (por[mid] ||= []).push({ cm:Number(cm), nota:que && que !== 'Otra' ? que : nota, eid:u.eid, etq:u.etq, tid:u.tid, color:u.color }); }));
    return por;
  }
  function sugerir(unidades, noUsar){
    const por = piezasDe(unidades), barras = [];
    Object.entries(por).forEach(([mid, pz]) => { const f = fabDe(mid); if(!f) return; const r = acomodar(pz, f, noUsar); r.usados.concat(r.barras).forEach(b => { b.tid = duenoBarra(b); barras.push(b); }); });
    return barras;
  }
  // La firma cambia si cambia lo asignado o las piezas de un modelo (versión del costeo)
  const firma = (unidades) => unidades.map(u => u.eid + ':' + u.tid + ':' + u.mid + '@' + ((D().costeo[u.mid] || {}).ver || '')).sort().join(',');
  // Lámina: guillotina simple por filas (las piezas más altas primero)
  function acomodarHoja(piezas, f){
    const W = Number(f.hoja[0]), H = Number(f.hoja[1]), hojas = [];
    const L = piezas.slice().sort((a, b) => Math.max(b.a, b.h) - Math.max(a.a, a.h));
    for(const p0 of L){
      const p = p0.a > p0.h ? { a:p0.a, h:p0.h, etq:p0.etq } : { a:p0.h, h:p0.a, etq:p0.etq };   // de pie: el lado largo a lo ancho
      if(p.a > W){ const t = p.a; p.a = p.h; p.h = t; }
      let ok = false;
      for(const hj of hojas){
        for(const fila of hj.filas){ if(fila.x + p.a <= W + 1e-9 && p.h <= fila.alto + 1e-9){ hj.piezas.push(Object.assign({ x:fila.x, y:fila.y }, p)); fila.x += p.a; ok = true; break; } }
        if(ok) break;
        if(hj.y + p.h <= H + 1e-9 && p.a <= W + 1e-9){ const fila = { y:hj.y, alto:p.h, x:p.a }; hj.filas.push(fila); hj.piezas.push(Object.assign({ x:0, y:hj.y }, p)); hj.y += p.h; ok = true; break; }
      }
      if(!ok){ const hj = { filas:[{ y:0, alto:p.h, x:p.a }], y:p.h, piezas:[Object.assign({ x:0, y:0 }, p)] }; hojas.push(hj); }
    }
    return hojas;
  }
  function planSemana(sab, prov){
    prov = prov || (window.CostosApp && window.CostosApp.prov) || D().prov;
    const todos = pasosHierro();
    const asign = todos.filter(u => u.tid && u.para === sab);
    asign.forEach((u, i) => { u.color = COLORES[i % COLORES.length]; u.conCortes = !!u.mid && tieneCortes(u.mid); u.x = u.conCortes ? X().costear(u.mid, { prov }) : null; });
    const conPlan = asign.filter(u => u.conCortes && !u.cortado), sinCortes = asign.filter(u => !u.conCortes), cortadas = asign.filter(u => u.conCortes && u.cortado);
    const pendientes = todos.filter(u => !u.tid), otroSab = todos.filter(u => u.tid && u.para !== sab);
    const guardado = (C.planes || {})[sab], f0 = firma(conPlan), noUsar = (guardado && guardado.no_usar) || [];
    let barras, cambio = false, ajustado = false;
    if(guardado && guardado.firma === f0 && (guardado.barras || []).length){ barras = JSON.parse(JSON.stringify(guardado.barras)); ajustado = !!guardado.ajustado;
      const col = {}; conPlan.forEach(u => { col[u.eid] = u.color; }); barras.forEach(b => b.piezas.forEach(p => { if(col[p.eid]) p.color = col[p.eid]; })); }
    else { barras = conPlan.length ? sugerir(conPlan, noUsar) : []; cambio = !!(guardado && (guardado.barras || []).length && !guardado.cerrado); }
    const iva = 1 + D().reglas.iva / 100, mats = {}, cm = {};
    Object.entries(piezasDe(conPlan)).forEach(([mid, pz]) => { cm[mid] = pz.reduce((a, p) => a + p.cm, 0); });
    barras.forEach(b => { const m = (mats[b.mid] ||= { f:fabDe(b.mid), barras:0, retazos:[], cm:cm[b.mid] || 0 }); if(b.tipo === 'barra') m.barras++; else m.retazos.push(b); });
    const camino = (mid) => window.COMPRA && window.COMPRA.datos ? window.COMPRA.enCamino(mid) : 0;
    const compras = Object.values(mats).filter(m => m.f).map(m => { const pr = X().precioFab(m.f, String(prov)), comprar = Math.max(0, m.barras - m.f.stock - camino(m.f.id)); m.camino = camino(m.f.id); return Object.assign(m, { comprar, precio:(pr.p || 0) * iva, costo:comprar * (pr.p || 0) * iva, de:pr.de }); });
    // Lámina y vidrio: la lámina se acomoda en la hoja; el vidrio se compra cortado (lista de piezas)
    const porHoja = {}; conPlan.forEach(u => (D().costeo[u.mid].hojas || []).forEach(([mid, n, a, h]) => { for(let i = 0; i < n; i++) (porHoja[mid] ||= []).push({ a:Number(a), h:Number(h), etq:u.etq, color:u.color }); }));
    const hj = Object.entries(porHoja).map(([mid, pz]) => { const f = fabDe(mid); if(!f || !f.hoja) return null; const hm2 = f.hoja[0] * f.hoja[1] / 10000, m2 = pz.reduce((a, p) => a + p.a * p.h / 10000, 0);
      if(f.tipo === 'vidrio'){ const g = {}; pz.forEach(p => { const k = Math.max(p.a, p.h) + ' × ' + Math.min(p.a, p.h); g[k] = (g[k] || 0) + 1; }); return { f, vidrio:true, m2, piezas:pz.length, lista:Object.entries(g).map(([k, n]) => ({ k, n })), comprar:pz.length }; }
      const acom = acomodarHoja(pz, f), sob = (f.sobrantes || []).reduce((a, s2) => a + s2[0] * s2[1] / 10000, 0);
      return { f, m2, hojas:m2 / hm2, sobrante:sob, acom, camino:camino(f.id), comprar:Math.max(0, acom.length - f.stock - camino(f.id)) }; }).filter(Boolean);
    const herreros = [...new Set(asign.map(u => u.tid))].map(tid => ({ tid, nombre:(asign.find(u => u.tid === tid) || {}).herrero || 'Herrero', barras:barras.filter(b => b.tid === tid), unidades:asign.filter(u => u.tid === tid),
      entregado:!!(guardado && guardado.entregado && guardado.entregado[tid]) }));
    let solas = 0; conPlan.forEach(u => Object.entries(piezasDe([u])).forEach(([mid, pz]) => { const f = fabDe(mid); if(f) solas += X().empacar(pz, f.largo, reglas().corte).length; }));
    const usadas = barras.filter(b => b.tipo === 'barra').length;
    const nBarras = compras.reduce((a, m) => a + m.comprar, 0), nHojas = hj.filter(x => !x.vidrio).reduce((a, x) => a + x.comprar, 0), nVidrio = hj.filter(x => x.vidrio).reduce((a, x) => a + x.comprar, 0);
    return { sab, prov, asign, conPlan, sinCortes, cortadas, pendientes, otroSab, barras, compras, hj, herreros, cambio, ajustado, noUsar,
      manual:(guardado && guardado.manual) || {}, aceptado:!!(guardado && guardado.firma === f0 && guardado.aceptado), cerrado:!!(guardado && guardado.cerrado), firma:f0,
      aviso:guardado && guardado.aviso, nuevos:(guardado && guardado.nuevos) || [], corregido:(guardado && guardado.corregido) || {}, algunoCorto:herreros.some(h => h.entregado),
      comprar:X().r2(compras.reduce((a, m) => a + m.costo, 0)), nBarras, nHojas, nVidrio, nComprar:nBarras + nHojas + nVidrio, ahorro:Math.max(0, solas - usadas), aluminio:C.aluminio || 0 };
  }
  // ¿Qué alcanzo con lo que hay? Agrega puertas en orden de entrega mientras alcancen las barras indicadas
  function alcanza(sab, hay){
    const P = planSemana(sab), orden = P.conPlan.slice().sort((a, b) => String(a.entrega).localeCompare(String(b.entrega)) || a.venta - b.venta);
    const si = [], no = [];
    for(const u of orden){
      const prueba = si.concat([u]), por = piezasDe(prueba);
      const ok = Object.entries(por).every(([mid, pz]) => { const f = fabDe(mid); const lim = hay[mid] != null ? hay[mid] : f.stock; return acomodar(pz, f, P.noUsar, lim).sinLugar.length === 0; });
      (ok ? si : no).push(u);
    }
    return { si, no };
  }
  // Para Depósito › Fabricación: cuánto usa y cuánto falta de cada material este sábado y el próximo
  async function necesita(){
    if(!C) await cargar();
    const out = { _sab:SAB.este };
    [SAB.este, SAB.proximo].forEach((sab, i) => { const P = planSemana(sab);
      P.compras.forEach(m => { const o = (out[m.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { usa:m.barras, retazos:m.retazos.length, falta:m.comprar }; });
      P.hj.forEach(x => { const o = (out[x.f.id] ||= { este:null, proximo:null }); o[i ? 'proximo' : 'este'] = { m2:x.m2, falta:x.comprar }; }); });
    return out;
  }

  // ---------- Pantalla ----------
  const etqRetazo = (b) => 'R-' + (b.num || '?') + ' · ' + mTxt(b.largo);
  function etiquetaBarra(b){ return b.tipo === 'retazo' ? 'Retazo ' + etqRetazo(b) : 'Barra ' + b.n + (b.comprar ? ' · comprar' : ''); }
  function barraHtml(b, i, P){
    const ajenas = b.piezas.filter(p => p.tid !== b.tid), f = fabDe(b.mid);
    const nomAj = [...new Set(ajenas.map(p => (P.herreros.find(h => h.tid === p.tid) || {}).nombre))];
    const sobra = b.libre >= minRet(f) ? 'retazo ' + mTxt(b.libre) : 'sobra ' + mTxt(b.libre);
    return `<button type="button" class="barra-btn" data-barra="${i}"><span class="barra-l"><span>${esc(etiquetaBarra(b))}${b.tipo === 'retazo' || !b.comprar ? ' <i class="tag-dep">del Depósito</i>' : ''}</span><span>${esc(sobra)}</span></span>
      <span class="barra ${b.tipo === 'retazo' ? 'es-ret' : ''} ${b.comprar ? 'es-comp' : ''}">${b.piezas.map(x => `<span style="flex:${x.cm};background:${esc(x.color || '#6F7C7E')}" title="${esc(x.etq)}">${num(x.cm)}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}"></span>` : ''}</span>
      ${nomAj.length ? `<span class="barra-n">Lleva piezas de ${esc(nomAj.join(' y '))}: se las pasa al terminar</span>` : ''}</button>`;
  }
  let PA = null;   // plan pintado
  const paso = (n, t, der) => `<div class="pc-paso"><span class="pc-n">${n}</span><b>${t}</b><span class="pc-der">${der || ''}</span></div>`;
  function html(){
    if(!C) return '<p class="mat-s" style="margin:24px 2px">Cargando…</p>';
    const P = PA = planSemana(semSab);
    $('subtitulo').textContent = 'Plan del ' + sabTxt(semSab);
    let h = `<div class="fi-opc" style="margin-bottom:10px">${[SAB.este, SAB.proximo].map(v => `<button class="fx ${v === semSab ? 'on' : ''}" type="button" data-sab="${v}">${esc(sabTxt(v))}</button>`).join('')}</div>`;
    if(window.COMPRA && window.COMPRA.datos) h += window.COMPRA.tarjetasHtml({ titulo:'Compra pedida' });
    if(P.aviso) h += `<div class="caja-rara">${esc(P.aviso)}. Cuando haya barras, márcalo a mano abajo.</div>`;
    if(P.cambio) h += `<div class="caja-amar">Cambió lo asignado en Producción o las piezas de un modelo. La app volvió a sugerir. Revísalo y acéptalo de nuevo.</div>`;
    if(P.cerrado) h += `<div class="caja-ok">Cortes de este sábado hechos. Las barras bajaron del Depósito y los retazos quedaron guardados. Si algo salió distinto, toca el material y "Corregir corte".</div>`;
    // ---- 1 Pedidos del sábado
    h += paso(1, 'Pedidos del sábado', 'vienen de Producción');
    if(!P.asign.length) h += `<div class="vacio-d"><b>No hay Hierro asignado para el ${esc(sabTxt(semSab))}</b>Asigna en Producción y aquí sale el plan.</div>`;
    const grupos = {}; P.asign.forEach(u => { const k = u.venta + ':' + u.mid; (grupos[k] ||= []).push(u); });
    h += Object.values(grupos).map(us => { const u = us[0], hs = [...new Set(us.map(x => x.herrero || 'sin herrero'))];
      return `<div class="ped-c ${!u.conCortes ? 'falta' : ''}"><span class="dot" style="background:${u.conCortes ? u.color : 'var(--ink-faint)'}"></span><span><b>${esc((u.interna ? 'Exhibición' : 'N° ' + u.venta) + ' · ' + u.nombre)}${us.length > 1 ? ' × ' + us.length : ''}</b><small>${esc(u.cliente)} · corta ${esc(hs.join(' y '))}${us.every(x => x.cortado) ? ' · ya cortado' : ''}</small></span><span class="m">${plural(us.length, '1 puerta', 'puertas')}</span></div>`; }).join('');
    P.sinCortes.forEach(u => {
      const manual = !!P.manual[u.eid];
      h += `<div class="caja-amar" style="margin-top:8px">${esc(u.etq)} · ${esc(u.nombre)} no tiene cortes: ${manual ? esc(u.herrero || 'el herrero') + ' lo corta a mano esta semana.' : 'no entra al plan.'}
        <span class="dos-btn">${u.mid ? `<a class="btn-mini" href="costos.html?modelo=${encodeURIComponent(u.mid)}&volver=semana&para=${semSab}">Cargar cortes</a>` : ''}${manual ? '' : `<button class="btn-mini sec" type="button" data-manual="${u.eid}">Cortar a mano</button>`}</span></div>`;
    });
    if(P.pendientes.length) h += `<a class="row-link" href="produccion.html" style="margin-top:6px"><span>${plural(P.pendientes.length, '1 puerta sin asignar', 'puertas sin asignar')} en Producción</span><span class="pill amar">Asignar</span></a>`;
    if(P.otroSab.length) h += `<p class="mat-s" style="margin:6px 2px 0">${plural(P.otroSab.length, '1 puerta asignada', 'puertas asignadas')} para otro sábado.</p>`;
    if(P.aluminio) h += `<div class="gris-l">Aluminio · ${plural(P.aluminio, '1 paso', 'pasos')} en fabricación. El plan de aluminio llega pronto.</div>`;
    // ---- 2 Material
    if(P.compras.length || P.hj.length){
      h += paso(2, 'Material', 'necesitas · hay · comprar');
      h += `<div class="pc-tabla"><div class="pc-fila pc-cab"><span></span><span>Necesitas</span><span>Hay</span><span>Comprar</span></div>`;
      h += P.compras.map(m => { const vivos = (m.f.retazos || []).length;
        return `<button class="pc-fila" type="button" data-cmat="${m.f.id}"><b>${esc(m.f.nombre)}</b><span>${mTxt(m.cm)}</span><span>${!Number(m.f.stock) && !vivos ? 'nada' : (Number(m.f.stock) ? plural(Number(m.f.stock), '1 barra', 'barras') : '') + (Number(m.f.stock) && vivos ? ' + ' : '') + (vivos ? plural(vivos, '1 retazo', 'retazos') : '')}${m.camino ? `<i class="cp-chip">+${m.camino} en camino</i>` : ''}</span><span class="${m.comprar ? 'rojo' : 'ok'}">${m.comprar}</span></button>`; }).join('');
      h += P.hj.map(x => x.vidrio
        ? `<button class="pc-fila" type="button" data-cmat="${x.f.id}"><b>${esc(x.f.nombre)}</b><span>${plural(x.piezas, '1 pieza', 'piezas')}</span><span>se compra cortado</span><span class="rojo">${x.comprar}</span></button>`
        : `<button class="pc-fila" type="button" data-cmat="${x.f.id}"><b>${esc(x.f.nombre)}</b><span>${num(x.hojas, 2)} hoja</span><span>${Number(x.f.stock) ? plural(Number(x.f.stock), '1 hoja', 'hojas') : 'nada'}</span><span class="${x.comprar ? 'rojo' : 'ok'}">${x.comprar ? plural(x.comprar, '1 hoja', 'hojas') : 0}</span></button>`).join('');
      h += `</div><p class="mat-s" style="margin:6px 2px 0">Toca un material para ver cómo se cortan sus barras.</p>`;
      if(P.ahorro) h += `<div class="ahorro">Cortando todo junto se usan ${plural(P.ahorro, '1 barra menos', 'barras menos')} que cortando cada puerta aparte.</div>`;
      // ---- 3 Comprar lo que falta
      const partes = [P.nBarras ? plural(P.nBarras, '1 barra', 'barras') : '', P.nHojas ? plural(P.nHojas, '1 hoja', 'hojas') : '', P.nVidrio ? plural(P.nVidrio, '1 vidrio cortado', 'vidrios cortados') : ''].filter(Boolean);
      h += paso(3, 'Comprar lo que falta', partes.length ? esc(partes.join(' y ')) : 'nada');
      h += partes.length ? `<div class="pie-dos2" style="display:flex;gap:10px;margin-top:6px"><button class="btn-secondary" type="button" data-pdf-compra style="flex:1;height:50px">Plan en PDF</button><button class="btn-primary" type="button" data-comprar style="flex:1.4;height:50px">Comprar lo que falta</button></div>`
        : `<div class="caja-ok">Con lo que hay en el Depósito alcanza. No hay que comprar.</div>`;
      // ---- Herreros: hoja, aceptar y lo cortado
      h += `<div class="tit">Hoja de cada herrero</div>` + P.herreros.filter(hr => hr.barras.length).map(hr => `<div class="pc-hr"><span><b>${esc(hr.nombre)}</b><small>${plural(hr.barras.length, '1 barra o retazo', 'barras y retazos')}${hr.entregado ? ' · ya cortó' : ''}</small></span>
        <button class="btn-mini sec2" type="button" data-hoja-h="${esc(hr.tid)}">Ver</button><button class="btn-mini sec2" type="button" data-pdf-hoja="${esc(hr.tid)}">PDF</button></div>`).join('');
      if(!P.cerrado){
        if(!P.aceptado) h += `<button class="btn-primary" type="button" data-aceptar style="margin-top:14px">Aceptar plan</button><p class="mat-s" style="margin:6px 2px 0">Al aceptarlo, cada herrero ve su hoja en Mi trabajo.</p>`;
        else h += `<div class="caja-ok" style="margin-top:12px">Plan aceptado. Las barras bajan solas cuando cada herrero termina sus pasos de Hierro del sábado.</div>`
          + P.herreros.filter(hr => hr.barras.length && !hr.entregado).map(hr => `<button class="btn-nuevo" type="button" data-ya-corto="${esc(hr.tid)}">Marcar a mano: ${esc(hr.nombre)} ya cortó</button>`).join('');
        if(P.ajustado && !P.algunoCorto) h += `<button class="btn-nuevo" type="button" data-plan-reiniciar>Volver a la sugerencia de la app</button>`;
      }
    }
    h += `<button class="btn-nuevo" type="button" data-alcanza style="margin-top:14px">+ Exhibición o simular</button>`;
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
      <div class="telefono"><div class="tel-h"><b>Tu hoja de corte</b><span>Para el ${esc(sabTxt(semSab))} · piezas en cm</span></div>
        <p class="tel-n">Corta primero los retazos. Un color por puerta.</p>
        ${Object.entries(o.porMat).map(([mid, bs]) => `<div class="tel-m">${esc(nomMat(mid))}</div>${bs.map(b => `<div class="tel-b"><span class="tel-bt">${esc(b.tipo === 'retazo' ? 'Retazo ' + etqRetazo(b) : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''))}</span>
          <span class="barra">${b.piezas.map(x => `<span style="flex:${x.cm};background:${esc(x.color || '#6F7C7E')}">${num(x.cm)}</span>`).join('')}${b.libre >= 1 ? `<span class="sob" style="flex:${b.libre}"></span>` : ''}</span>
          <span class="tel-p">${b.piezas.map(x => `${num(x.cm)} · ${esc(x.etq)}${x.tid !== o.hr.tid ? ' (de ' + esc(nomH(P, x.tid)) + ')' : ''}`).join('<br>')}${b.libre >= minRet(fabDe(b.mid)) ? '<br><b>Guarda el retazo de ' + mTxt(b.libre) + '</b>' : ''}</span></div>`).join('')}`).join('')}
        ${o.pasar.length ? `<div class="tel-m">Pásale a tu compañero</div>${o.pasar.map(x => `<div class="tel-p">${num(x.cm)} cm · ${esc(x.etq)} → ${esc(nomH(P, x.tid))}</div>`).join('')}` : ''}
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
    const bloques = [{ t:'nota', texto:'Corta primero los retazos. Piezas en cm. Guarda los retazos que dice cada barra.' }];
    Object.entries(o.porMat).forEach(([mid, bs]) => { bloques.push({ t:'titulo', texto:nomMat(mid), der:plural(bs.length, '1 barra o retazo', 'barras y retazos') });
      bs.forEach(b => bloques.push({ t:'barra', etiqueta:b.tipo === 'retazo' ? 'Retazo ' + etqRetazo(b) : 'Barra ' + b.n + (b.comprar ? ' (nueva)' : ''), der:'sobra ' + mTxt(b.libre) + (b.libre >= minRet(fabDe(b.mid)) ? ' · guardar' : ''), largo:b.largo, sobra:b.libre,
        piezas:b.piezas.map(x => ({ cm:x.cm, txt:'(' + x.etq + (x.tid !== tid ? ', de ' + nomH(P, x.tid) : '') + ')' })) })); });
    if(o.pasar.length){ bloques.push({ t:'titulo', texto:'Pásale a tu compañero' }); o.pasar.forEach(x => bloques.push({ t:'fila', a:x.cm + ' cm · ' + x.etq, b:nomH(P, x.tid) })); }
    if(o.manuales.length){ bloques.push({ t:'titulo', texto:'Sin plan: cortar a mano' }); o.manuales.forEach(u => bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre, b:'a mano' })); }
    await sacarPDF({ titulo:'Hoja de corte', derecha:o.hr.nombre, subtitulo:'Para el ' + sabTxt(semSab) + '. Sale de lo asignado en Producción.', bloques }, 'Hoja-de-corte-' + String(o.hr.nombre).replace(/[^A-Za-z0-9]+/g, '-') + '-' + semSab + '.pdf');
  }
  async function pdfCompra(){
    const P = planSemana(semSab), pv = D().proveedores.find(p => String(p.id) === String(P.prov));
    const bloques = [{ t:'titulo', texto:'Barras', der:'Precio con IVA' }];
    P.compras.filter(m => m.comprar).forEach(m => bloques.push({ t:'fila', a:m.f.nombre + ' · ' + plural(m.comprar, '1 barra', 'barras') + ' de ' + num(m.f.largo / 100) + ' m', b:dinero(m.costo) }));
    if(!P.compras.some(m => m.comprar)) bloques.push({ t:'fila', a:'Con lo que hay alcanza', b:'' });
    bloques.push({ t:'total', a:'Total barras', b:dinero(P.comprar) });
    P.hj.filter(x => !x.vidrio).forEach(x => { if(!bloques.some(b => b.texto === 'Lámina')) bloques.push({ t:'titulo', texto:'Lámina' }); bloques.push({ t:'fila', a:x.f.nombre + ' · usa ' + num(x.m2, 2) + ' m²', b:x.comprar ? 'Comprar ' + plural(x.comprar, '1 hoja', 'hojas') : 'Alcanza' }); });
    P.hj.filter(x => x.vidrio).forEach(x => { bloques.push({ t:'titulo', texto:x.f.nombre + ' (cortado a la medida)' }); x.lista.forEach(l => bloques.push({ t:'fila', a:l.k + ' cm', b:plural(l.n, '1 pieza', 'piezas') })); });
    if(P.conPlan.length){ bloques.push({ t:'titulo', texto:'Costo y ganancia por pedido' }); P.conPlan.forEach(u => { if(!u.x || u.x.falta.length) return bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre, b:'faltan datos' }); const g = u.interna ? -u.x.costo : u.precio - u.x.costo - u.x.fijos; bloques.push({ t:'fila', a:u.etq + ' · ' + u.nombre + ' · cuesta ' + dinero(u.x.costo), b:(u.interna ? 'exhibición ' : 'gana ') + dinero(Math.abs(g)), rojo:g < 0 && !u.interna }); }); }
    bloques.push({ t:'nota', texto:'Precios de ' + (pv ? pv.nombre : 'el proveedor principal') + '. Si no vende un material, se usó el precio de otro proveedor.' });
    await sacarPDF({ titulo:'Plan de compra', derecha:sabTxt(semSab), subtitulo:plural(P.conPlan.length, '1 puerta para cortar', 'puertas para cortar') + '. Primero se usan los retazos y las barras del Depósito.', bloques }, 'Plan-de-compra-' + semSab + '.pdf');
  }
  // Cambiar una barra: quién la corta y mover piezas (también a un retazo que no se eligió)
  function renumerar(P){
    P.barras = P.barras.filter(b => b.piezas.length);
    const por = {}; P.barras.filter(b => b.tipo === 'barra').forEach(b => (por[b.mid] ||= []).push(b));
    Object.entries(por).forEach(([mid, bs]) => { const f = fabDe(mid); bs.forEach((b, i) => { b.n = i + 1; b.comprar = i >= f.stock; }); });
  }
  const retazosLibres = (P, mid) => (fabDe(mid).retazos || []).filter(r => !P.barras.some(b => b.tipo === 'retazo' && String(b.rid) === String(r.id)));
  function moverPieza(P, bi, pi, destino){
    const corte = reglas().corte, b = P.barras[bi], p = b.piezas[pi], f = fabDe(b.mid);
    let dst;
    if(destino === 'nueva'){ dst = barraNueva(f, b.tid); P.barras.push(dst); }
    else if(String(destino).startsWith('r:')){ const r = (f.retazos || []).find(x => String(x.id) === String(destino).slice(2)); if(!r) return false; dst = retazoBarra(f, r, b.tid); P.barras.push(dst); }
    else dst = P.barras[+destino];
    if(!dst || dst.libre + 1e-9 < p.cm){ if(dst && !dst.piezas.length) P.barras.splice(P.barras.indexOf(dst), 1); return false; }
    b.piezas.splice(pi, 1); b.libre = Math.min(b.largo - (b.tipo === 'barra' ? reglas().desp : 0), b.libre + p.cm + corte);
    dst.piezas.push(p); dst.libre = Math.max(0, dst.libre - p.cm - corte);
    renumerar(P); return true;
  }
  const limpiar = (barras) => barras.map(b => ({ mid:b.mid, tipo:b.tipo, rid:b.rid || null, num:b.num || null, largo:b.largo, libre:Math.round(b.libre * 10) / 10, n:b.n || null, comprar:!!b.comprar, tid:b.tid,
    piezas:b.piezas.map(p => ({ cm:p.cm, nota:p.nota || '', eid:p.eid, etq:p.etq, tid:p.tid, color:p.color || null })) }));
  async function guardarPlan(P, cambios, ok){
    if(ocupado) return false; ocupado = true;
    try{
      const { error } = await db.rpc('corte_plan_guardar', { p_sab:semSab, p:Object.assign({ firma:P.firma, barras:limpiar(P.barras), aceptado:P.aceptado, ajustado:P.ajustado, no_usar:P.noUsar }, cambios) });
      if(error) throw error;
      await cargar(); if(ok) toast(ok); window.CostosApp.pintar(); return true;
    } catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { ocupado = false; }
  }
  async function llamar(fn, args, ok){
    if(ocupado) return false; ocupado = true;
    try{ const { data, error } = await db.rpc(fn, args); if(error) throw error; await window.CostosApp.recargar(); if(ok) toast(ok); return data || true; }
    catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { ocupado = false; }
  }
  const alcanzaMats = () => { const P = planSemana(semSab); return [...new Set(P.barras.map(b => String(b.mid)))].map(mid => fabDe(mid)).filter(Boolean); };

  // ---------- Hojas (dentro de la hoja de Costos, t:'corte') ----------
  const opts = (lista, valor, attr, cols) => `<div class="opts" style="--cols:${cols || 2}">${lista.map(([v, t]) => `<button class="opt ${valor != null && String(valor) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
  function hojaDibujo(x){
    const W = x.f.hoja[0], H = x.f.hoja[1];
    return x.acom.map((hj, i) => `<div class="barra-l"><span>Hoja ${i + 1}${i >= x.f.stock ? ' · comprar' : ' · del Depósito'}</span><span>${num(W)} × ${num(H)} cm</span></div>
      <div class="pc-hoja" style="aspect-ratio:${W} / ${H}">${hj.piezas.map(p => `<span style="left:${p.x / W * 100}%;top:${p.y / H * 100}%;width:${p.a / W * 100}%;height:${p.h / H * 100}%;background:${esc(p.color || '#6F7C7E')}">${num(p.a)}×${num(p.h)}</span>`).join('')}</div>`).join('');
  }
  function form(F){
    const P = planSemana(semSab);
    if(F.k === 'mat'){
      const f = fabDe(F.mid); if(!f) return { titulo:'Material', h:'', boton:'Listo' };
      const x = P.hj.find(y => String(y.f.id) === String(F.mid));
      if(x && x.vidrio) return { titulo:f.nombre + ' · cortado', boton:'Listo', h:`<p class="mat-s" style="margin:0 2px 10px">El vidrio se compra cortado a la medida. El costo del modelo no cambia.</p><div class="tot">${x.lista.map(l => `<div class="fila"><span>${esc(l.k)} cm</span><b>${plural(l.n, '1 pieza', 'piezas')}</b></div>`).join('')}<div class="fila fin"><span>Total</span><span>${plural(x.piezas, '1 pieza', 'piezas')}</span></div></div>` };
      if(x) return { titulo:f.nombre + ' · cómo se corta', boton:'Listo', h:`<p class="mat-s" style="margin:0 2px 10px">Usa ${num(x.m2, 2)} m² · hay ${plural(Number(f.stock), '1 hoja', 'hojas')}${x.sobrante ? ' y ' + num(x.sobrante, 2) + ' m² de sobrantes' : ''}.</p>${hojaDibujo(x)}` };
      const bs = P.barras.map((b, i) => [b, i]).filter(([b]) => String(b.mid) === String(F.mid));
      const nU = P.conPlan.filter(u => (D().costeo[u.mid].piezas || []).some(p => String(p[0]) === String(F.mid))).length;
      const libres = retazosLibres(P, F.mid), enPlan = bs.filter(([b]) => b.tipo === 'retazo').map(([b]) => b);
      const cambia = !P.cerrado && !P.algunoCorto;
      let h = `<p class="mat-s" style="margin:0 2px 8px">${plural(nU, '1 puerta', 'puertas')} · usa primero lo del Depósito. Retazo que sirve: ${mTxt(minRet(f))} o más.</p>
        <div class="leg">${P.conPlan.map(u => `<span><i style="background:${u.color}"></i>${esc(u.etq)}</span>`).join('')}</div>
        <div class="mat-b">${bs.map(([b, i]) => barraHtml(b, i, P)).join('') || '<p class="mat-s">Este material no tiene cortes este sábado.</p>'}</div>
        ${cambia ? '<p class="mat-s" style="margin:6px 2px 0">Toca una barra para cambiar quién la corta o mover una pieza.</p>' : ''}`;
      const todos = enPlan.map(b => ({ id:b.rid, num:b.num, largo:b.largo, usa:true })).concat((f.retazos || []).filter(r => P.noUsar.includes(r.id)).map(r => ({ id:r.id, num:r.num, largo:r.largo, usa:false }))).concat(libres.filter(r => !P.noUsar.includes(r.id)).map(r => ({ id:r.id, num:r.num, largo:r.largo, usa:null })));
      if(todos.length || cambia) h += `<div class="tit">Retazos del Depósito</div>` + todos.map(r => `<div class="pc-ret"><span><b>R-${esc(r.num || '?')} · ${mTxt(r.largo)}</b><small>${r.usa ? 'se usa en el plan' : r.usa === false ? 'no se usa' : 'no hizo falta'}</small></span>${cambia ? `<button class="btn-mini sec2" type="button" data-f-ret="${r.id}">${r.usa === false ? 'Usar' : 'No usar'}</button>` : ''}</div>`).join('');
      if(cambia) h += F.nuevoRet ? `<div class="input-row" style="margin-top:10px"><div class="field" id="c_fRetCm"><label class="field-label" for="fRetCm">Medida del retazo (cm)</label><input class="input" id="fRetCm" inputmode="decimal" value="${esc(F.retCm || '')}"><div class="field-error">De 10 a 1000 cm</div></div></div>`
        : '<button class="btn-nuevo" type="button" data-f-nuevoret>+ Retazo que encontré</button>';
      if(cambia && P.ajustado) h += '<button class="btn-nuevo" type="button" data-plan-reiniciar>Volver a la sugerencia</button>';
      if(P.algunoCorto) h += `<button class="btn-secondary" type="button" data-f-corregir style="width:100%;margin-top:12px">Corregir corte</button>`;
      return { titulo:f.nombre + ' · cómo se corta', h, boton:F.nuevoRet ? 'Agregar retazo' : 'Listo' };
    }
    if(F.k === 'corregir'){
      const f = fabDe(F.mid), cands = [...new Map(P.barras.filter(b => b.tipo === 'retazo' && String(b.mid) === String(F.mid)).map(b => [String(b.rid), { id:b.rid, num:b.num, largo:b.largo }])
        .concat((f.retazos || []).filter(r => !P.nuevos.some(n => String(n.id) === String(r.id))).map(r => [String(r.id), { id:r.id, num:r.num, largo:r.largo }]))).values()];
      return { titulo:'Corregir corte · ' + f.nombre, boton:'Guardar corrección', h:`<p class="mat-s" style="margin:0 2px 10px;font-size:14px">Pon lo que de verdad se cortó. La base hace la diferencia con el Depósito y deja el motivo. Nada se borra.</p>
        <div class="field" id="c_fCB"><label class="field-label" for="fCB">Barras enteras que se cortaron</label><input class="input" id="fCB" inputmode="numeric" value="${esc(F.barras)}"><div class="field-error">Escribe cuántas barras</div></div>
        <div class="field"><span class="field-label">Retazos del Depósito que se usaron</span>${cands.length ? `<div class="fi-opc">${cands.map(r => `<button class="fx ${F.usados.includes(String(r.id)) ? 'on' : ''}" type="button" data-f-usado="${r.id}">R-${esc(r.num || '?')} · ${mTxt(r.largo)}</button>`).join('')}</div>` : '<p class="mat-s">No había retazos.</p>'}</div>
        <div class="field"><span class="field-label">Retazos que quedaron (cm)</span>${F.quedaron.map((v, i) => `<div class="pc-q"><input class="input" id="fQ_${i}" inputmode="decimal" value="${esc(v)}" aria-label="Retazo ${i + 1} en cm"><button class="btn-mini sec2" type="button" data-f-quitarq="${i}">Quitar</button></div>`).join('')}<button class="btn-nuevo" type="button" data-f-masq>+ Otro retazo</button></div>
        <div class="field" id="c_fMot"><label class="field-label" for="fMot">Motivo</label><input class="input" id="fMot" value="${esc(F.motivo || '')}"><div class="field-error">Escribe el motivo</div><div class="field-hint">Ejemplo: el retazo estaba torcido.</div></div>` };
    }
    if(F.k === 'barra'){
      const b = P.barras[F.bi];
      if(!b) return { titulo:'Barra', h:'<p class="mat-s">Esta barra ya no está en el plan.</p>', boton:'Listo' };
      const destinos = F.mover != null ? P.barras.map((x, i) => [x, i]).filter(([x, i]) => i !== F.bi && String(x.mid) === String(b.mid) && x.libre + 1e-9 >= b.piezas[F.mover].cm) : [];
      const rets = F.mover != null ? retazosLibres(P, b.mid).filter(r => Number(r.largo) + 1e-9 >= b.piezas[F.mover].cm) : [];
      return { titulo:nomMat(b.mid) + ' · ' + (b.tipo === 'retazo' ? 'retazo R-' + (b.num || '?') : 'barra ' + b.n), boton:'Guardar cambio',
        h:`<div class="field"><span class="field-label">¿Quién la corta?</span>${opts(P.herreros.map(hr => [hr.tid, esc(hr.nombre)]), F.tid, 'data-f-tid')}</div>
        <div class="field-label">Piezas · toca una para moverla</div>
        ${b.piezas.map((x, i) => `<button type="button" class="pz ${F.mover === i ? 'on' : ''}" data-f-mover="${i}"><span class="pz-n" style="background:${esc(x.color || '#6F7C7E')};color:#fff">${num(x.cm)}</span><span><span class="pz-t">${esc(x.etq)}</span><span class="pz-s">${esc(x.nota || '')}</span></span><span class="pz-m">${F.mover === i ? 'Mover' : ''}</span></button>`).join('')}
        ${F.mover != null ? `<div class="field" style="margin-top:10px"><span class="field-label">¿A dónde la mueves?</span>${opts(destinos.map(([x, i]) => [i, esc(x.tipo === 'retazo' ? 'Retazo R-' + (x.num || '?') : 'Barra ' + x.n) + '<br><small style="font-weight:600">' + esc(nomH(P, x.tid)) + ' · le caben ' + mTxt(x.libre) + '</small>'])
          .concat(rets.map(r => ['r:' + r.id, 'Retazo R-' + esc(r.num || '?') + ' · ' + mTxt(r.largo) + '<br><small style="font-weight:600">del Depósito, no estaba elegido</small>']))
          .concat([['nueva', 'Barra nueva<br><small style="font-weight:600">puede que haya que comprarla</small>']]), F.dest, 'data-f-dest', 1)}</div>` : ''}` };
    }
    if(F.k === 'alcanza'){
      const mats = alcanzaMats();
      let h = `<p class="mat-s" style="margin:0 2px 10px;font-size:14px">Simula: pon cuántas barras enteras tienes de cada perfil (ya están las del Depósito). La app agrega las puertas en orden de entrega mientras alcance. Los retazos también cuentan.</p>
        ${mats.map(f => `<div class="field"><label class="field-label" for="fH_${f.id}">${esc(f.nombre)}</label><input class="input" id="fH_${f.id}" inputmode="numeric" value="${esc(F.hay[f.id] != null ? F.hay[f.id] : f.stock)}"></div>`).join('') || '<p class="mat-s">No hay puertas con cortes este sábado.</p>'}
        <a class="row-link" href="produccion.html" style="margin-top:4px"><span>Puerta de exhibición: se agrega en Producción</span>›</a>`;
      if(F.res) h += `<div class="tit">Alcanza para</div>${F.res.si.length ? F.res.si.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero || '')}</small></span><span class="pill verde">Sí</span></div>`).join('') : '<p class="mat-s">Ninguna puerta completa.</p>'}
        ${F.res.no.length ? `<div class="tit">No alcanza para</div>${F.res.no.map(u => `<div class="ped-c"><span class="dot" style="background:${u.color}"></span><span><b>${esc(u.etq)} · ${esc(u.nombre)}</b><small>${esc(u.herrero || '')} · quedaría pendiente</small></span><span class="pill rojo">Falta</span></div>`).join('')}` : ''}`;
      return { titulo:'Exhibición o simular', h, boton:'Calcular' };
    }
    return { titulo:'', h:'', boton:'Listo' };
  }
  const leerCorregir = (F) => { const v = ($('fCB') || {}).value; if(v !== undefined) F.barras = v; F.quedaron = F.quedaron.map((x, i) => ($('fQ_' + i) || {}).value != null ? $('fQ_' + i).value : x); const m = $('fMot'); if(m) F.motivo = m.value; };
  // Rehace la sugerencia con los retazos que no se usan y la guarda (sin perder si ya estaba aceptado)
  async function resugerir(noUsar, ok){
    const P = planSemana(semSab);
    P.noUsar = noUsar; P.barras = P.conPlan.length ? sugerir(P.conPlan, noUsar) : [];
    return guardarPlan(P, { ajustado:true, aceptado:false, no_usar:noUsar }, ok);
  }
  function clickForm(e, F){
    const b = (a) => { const x = e.target.closest('[' + a + ']'); return x && x.closest('#formBody') ? x : null; };
    const t = b('data-f-tid'); if(t){ F.tid = t.dataset.fTid; return true; }
    const m = b('data-f-mover'); if(m){ F.mover = F.mover === +m.dataset.fMover ? null : +m.dataset.fMover; F.dest = null; return true; }
    const d = b('data-f-dest'); if(d){ F.dest = d.dataset.fDest; return true; }
    // Material: barra, retazos, retazo encontrado, corregir
    const br = b('data-barra'); if(br && F.k === 'mat'){ const P = planSemana(semSab); if(P.cerrado || P.algunoCorto) return false; const x = P.barras[+br.dataset.barra]; if(x){ Object.assign(F, { k:'barra', bi:+br.dataset.barra, tid:x.tid, mover:null, dest:null, volver:F.mid }); } return true; }
    const rt = b('data-f-ret'); if(rt){ const P = planSemana(semSab), id = +rt.dataset.fRet, nu = P.noUsar.includes(id) ? P.noUsar.filter(x => x !== id) : P.noUsar.concat([id]);
      resugerir(nu, nu.includes(id) ? 'Ese retazo no se usa. La app volvió a acomodar.' : 'Ese retazo vuelve al plan.').then(() => { if(window.CostosApp && F.k === 'mat') window.CostosApp.repintarForm && window.CostosApp.repintarForm(); }); return false; }
    if(b('data-f-nuevoret')){ F.nuevoRet = true; return true; }
    if(b('data-f-corregir')){ const P = planSemana(semSab), co = P.corregido[F.mid];
      const nb = co ? co.barras : P.barras.filter(x => x.tipo === 'barra' && String(x.mid) === String(F.mid) && (P.herreros.find(h => h.tid === x.tid) || {}).entregado).length;
      const us = co ? (co.usados || []).map(String) : P.barras.filter(x => x.tipo === 'retazo' && String(x.mid) === String(F.mid) && (P.herreros.find(h => h.tid === x.tid) || {}).entregado).map(x => String(x.rid));
      Object.assign(F, { k:'corregir', barras:nb, usados:us, quedaron:P.nuevos.filter(n => String(n.mid) === String(F.mid)).map(n => String(n.cm)), motivo:'' }); return true; }
    const us = b('data-f-usado'); if(us){ leerCorregir(F); const k = us.dataset.fUsado; F.usados = F.usados.includes(k) ? F.usados.filter(x => x !== k) : F.usados.concat([k]); return true; }
    if(b('data-f-masq')){ leerCorregir(F); F.quedaron.push(''); return true; }
    const qq = b('data-f-quitarq'); if(qq){ leerCorregir(F); F.quedaron.splice(+qq.dataset.fQuitarq, 1); return true; }
    if(b('data-plan-reiniciar')){ llamar('corte_plan_reiniciar', { p_sab:semSab }, 'Volvió la sugerencia de la app').then(() => window.CostosApp.repintarForm && window.CostosApp.repintarForm()); return false; }
    return false;
  }
  async function guardarForm(F){
    if(F.k === 'barra'){
      const P = planSemana(semSab), b = P.barras[F.bi]; if(!b) return true;
      if(F.mover != null && F.dest == null){ toast('Elige a dónde mover la pieza', 'error'); return false; }
      if(F.tid) b.tid = F.tid;
      if(F.mover != null && !moverPieza(P, F.bi, F.mover, F.dest)){ toast('Esa pieza no cabe ahí', 'error'); return false; }
      const ok = await guardarPlan(P, { ajustado:true, aceptado:false }, 'Plan ajustado. Acéptalo cuando esté listo.');
      if(ok && F.volver != null){ Object.assign(F, { k:'mat', mid:F.volver, volver:null }); window.CostosApp.repintarForm && window.CostosApp.repintarForm(); return false; }
      return ok;
    }
    if(F.k === 'mat'){
      if(!F.nuevoRet) return true;
      const v = Number(String(($('fRetCm') || {}).value || '').replace(',', '.'));
      if(!(v >= 10 && v <= 1000)){ const c = $('c_fRetCm'); if(c) c.classList.add('invalid'); return false; }
      const r = await llamar('retazo_agregar', { mid:Number(F.mid), p_largo:v, p_ancho:null }, 'Retazo guardado en el Depósito');
      if(!r) return false;
      const P = planSemana(semSab); F.nuevoRet = false;
      if(!P.algunoCorto && !P.cerrado) await resugerir(P.noUsar, 'La app volvió a acomodar con el retazo nuevo.');
      window.CostosApp.repintarForm && window.CostosApp.repintarForm(); return false;
    }
    if(F.k === 'corregir'){
      leerCorregir(F);
      const nb = Number(F.barras); if(!(nb >= 0) || nb % 1 || nb > 99){ const c = $('c_fCB'); if(c) c.classList.add('invalid'); return false; }
      const qd = F.quedaron.map(x => String(x).trim()).filter(Boolean).map(x => Number(x.replace(',', '.')));
      if(qd.some(x => !(x > 0 && x <= 1000))){ toast('Revisa la medida de los retazos que quedaron', 'error'); return false; }
      if(!String(F.motivo || '').trim()){ const c = $('c_fMot'); if(c) c.classList.add('invalid'); return false; }
      const r = await llamar('corte_corregir', { p_sab:semSab, p:{ material_id:Number(F.mid), barras:nb, usados:F.usados.map(Number), quedaron:qd, motivo:F.motivo.trim() } }, 'Corte corregido. El Depósito ya cuadra y quedó el motivo.');
      return !!r;
    }
    if(F.k === 'alcanza'){
      const hay = {}; alcanzaMats().forEach(f => { const v = parseInt(($('fH_' + f.id) || {}).value, 10); hay[f.id] = isFinite(v) && v >= 0 ? v : f.stock; });
      F.hay = hay; const r = alcanza(semSab, hay), P = planSemana(semSab);
      const col = (u) => (P.conPlan.find(x => x.eid === u.eid) || {}).color; F.res = { si:r.si.map(u => Object.assign(u, { color:col(u) })), no:r.no.map(u => Object.assign(u, { color:col(u) })) };
      const o = form(F); $('formBody').innerHTML = o.h; return false;
    }
    return true;
  }
  // Clics de la pestaña Plan de corte. Devuelve true si lo atendió.
  function click(e){
    if(e.target.closest('#sheetForm')) return false;
    const sb = e.target.closest('[data-sab]'); if(sb){ semSab = sb.dataset.sab; window.CostosApp.pintar(); return true; }
    const ma = e.target.closest('[data-manual]'); if(ma){ llamar('corte_manual', { p_sab:semSab, eid:+ma.dataset.manual }, 'Lo corta a mano esta semana. Sale en su hoja.'); return true; }
    const hh = e.target.closest('[data-hoja-h]'); if(hh){ abrirHojaHerrero(hh.dataset.hojaH); return true; }
    const ph = e.target.closest('[data-pdf-hoja]'); if(ph){ pdfHoja(ph.dataset.pdfHoja); return true; }
    if(e.target.closest('[data-pdf-compra]')){ pdfCompra(); return true; }
    if(e.target.closest('[data-comprar]')){ if(window.COMPRA && window.COMPRA.abrirDesdePlan) window.COMPRA.abrirDesdePlan(planSemana(semSab)); else location.href = 'deposito.html?tab=compras'; return true; }
    if(e.target.closest('[data-alcanza]')){ window.CostosApp.abrirCorte({ k:'alcanza', hay:{}, res:null }); return true; }
    const cm = e.target.closest('[data-cmat]'); if(cm){ window.CostosApp.abrirCorte({ k:'mat', mid:cm.dataset.cmat, nuevoRet:false }); return true; }
    if(e.target.closest('[data-aceptar]')){ const P = planSemana(semSab); P.aceptado = true; guardarPlan(P, { aceptado:true, ajustado:P.ajustado }, 'Plan aceptado. Cada herrero ya tiene su hoja de corte en Mi trabajo.'); return true; }
    const yc = e.target.closest('[data-ya-corto]'); if(yc){ const hr = (PA && PA.herreros.find(h => String(h.tid) === yc.dataset.yaCorto)) || {}; if(!confirm(`¿${hr.nombre || 'El herrero'} ya cortó? Bajan sus barras del Depósito y se guardan los retazos que sirven.`)) return true; llamar('corte_ya_corto', { p_sab:semSab, tid:yc.dataset.yaCorto }, 'Bajaron las barras del Depósito y se guardaron los retazos.'); return true; }
    if(e.target.closest('[data-plan-reiniciar]')){ llamar('corte_plan_reiniciar', { p_sab:semSab }, 'Volvió la sugerencia de la app'); return true; }
    return false;
  }

  window.CORTE = { cargar, html, despues, click, form, clickForm, guardarForm, necesita, planSemana, alcanza, sabados, get sab(){ return semSab; } };
})();
