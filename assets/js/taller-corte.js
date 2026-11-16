// Taller › Corte (lote 5, maquetas K01 a K10 y K19 a K20). Solo Ray y Gualfredo.
// Por herrero: lo que tiene cada uno de Hierro para el sábado, su estado (sin enviar, enviado, cortando, cambió)
// y su drawer: una tarjeta por puerta con su lista de corte, de dónde sale el material (TALLER, R-n, NUEVA) y un
// solo botón "Enviar a … (y pedir N barras)". El plan sale del motor de siempre (corte.js: la sugerencia, mover
// una pieza); se guarda con corte_plan_guardar y se envía con corte_enviar (plan, envío y compra juntos, v91).
// Lo que se le envió a cada herrero queda fijo (v89): si cambia algo, "Cambió · vuelve a enviar"; si ya empezó, el
// plan de ese herrero no se cambia (candado) y después se corrige lo que cortó (corte_corregir).
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, sabados, sabadoCorto, iconoTipo } = window.AH;
  const $ = (id) => document.getElementById(id);
  const K = () => window.CORTE;
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const iniciales = (n) => { const p = String(n || '?').trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase(); };
  const errTxt = (e) => { const m = String((e && e.message) || ''); return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa la conexión y vuelve a intentarlo.' : (m || 'No se pudo guardar'); };
  const num = (n) => Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits:1 });
  const hora = (ts) => { const d = new Date(ts); if(isNaN(d)) return ''; const h = d.getHours(); return ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); };
  const isoL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function cuando(ts){ const d = new Date(ts); if(isNaN(d)) return ''; const h = isoL(new Date()), f = isoL(d); const ay = new Date(); ay.setDate(ay.getDate() - 1);
    return f === h ? 'hoy ' + hora(ts) : f === isoL(ay) ? 'ayer ' + hora(ts) : sabadoCorto(f).replace('sáb ', '') + ' ' + hora(ts); }

  let SAB = sabados(), sab = SAB.este;
  let cargado = false, cargando = false, error = false, trabajadores = [];
  let abierto = null;            // tid del drawer abierto
  let ocupado = false;

  // ---------- Datos ----------
  async function cargar(){
    if(cargando) return;
    cargando = true; error = false;
    try{
      const [, rt] = await Promise.all([K().cargar(), trabajadores.length ? null : db.from('perfiles').select('id,nombre,especialidades').eq('rol', 'trabajador').eq('activo', true).order('nombre')]);
      if(rt && !rt.error) trabajadores = rt.data || [];
      cargado = true;
    } catch(e){ error = true; toast(errTxt(e), 'error'); }
    finally { cargando = false; }
    pintar();
    if(abierto && $('sheetCorte').classList.contains('open')) pintarHerrero(abierto);
    if(window.Taller && window.Taller.repintarResumen) window.Taller.repintarResumen();
  }
  const plan = () => { K().setSab(sab); return K().planSemana(sab); };
  const enviados = () => ((K().datos() || {}).planes || {})[sab] ? (K().datos().planes[sab].enviados || {}) : {};
  const herrerosConHierro = () => trabajadores.filter(t => (t.especialidades || []).includes('herrero'));
  // Las barras de un herrero en orden fijo (como las compara la base)
  const firmaBarras = (bs) => JSON.stringify((bs || []).map(b => ({ mid:String(b.mid), tipo:b.tipo, rid:b.rid || null, piezas:(b.piezas || []).map(p => String(p.eid) + ':' + Number(p.cm)).sort() })).map(x => JSON.stringify(x)).sort());
  function estado(P, h){
    const env = enviados()[h.tid];
    const unidades = h.unidades || [];
    if(unidades.length && unidades.every(u => !u.conCortes)) return { k:'sin', t:'Sin cortes · cárgalos en el Costeador' };
    if(!env) return { k:'gris', t:'Sin enviar' };
    const cambio = env.firma_hoy !== env.firma || firmaBarras(env.barras) !== firmaBarras(h.barras);
    if(env.empezo) return { k:'ok', t:'Enviado · cortando', cambio, empezo:true };
    if(cambio) return { k:'rj', t:'Cambió · vuelve a enviar', cambio:true };
    return { k:'ok', t:'Enviado' };
  }
  // Puertas que salieron del plan de un herrero después de enviarle (cancelado o movido)
  function salieron(P, h){
    const env = enviados()[h.tid]; if(!env) return [];
    const ahora = new Set((h.unidades || []).map(u => String(u.eid)));
    const m = new Map();
    (env.barras || []).forEach(b => (b.piezas || []).forEach(p => { if(p.tid === h.tid && !ahora.has(String(p.eid))) m.set(String(p.eid), p.etq); }));
    return [...m.values()];
  }

  // ---------- Por herrero (K01) ----------
  function pintar(){
    const cont = $('vCorte'); if(!cont) return;
    const tabsSab = `<div class="seg ck-sab" role="radiogroup" aria-label="Sábado">
      <button type="button" class="seg-op ${sab === SAB.este ? 'on' : ''}" data-ck-sab="${SAB.este}" role="radio" aria-checked="${sab === SAB.este}">Este ${esc(sabadoCorto(SAB.este))}</button>
      <button type="button" class="seg-op ${sab === SAB.proximo ? 'on' : ''}" data-ck-sab="${SAB.proximo}" role="radio" aria-checked="${sab === SAB.proximo}">Próximo ${esc(sabadoCorto(SAB.proximo))}</button></div>`;
    if(!cargado){
      cont.innerHTML = tabsSab + (error ? '<div class="vacio"><h3>No se pudo cargar el corte</h3><p>Revisa la conexión y toca Actualizar.</p></div>'
        : '<div class="tl-sk"></div><div class="tl-sk"></div>');
      return;
    }
    let P;
    try{ P = plan(); } catch(e){ cont.innerHTML = tabsSab + '<div class="vacio"><h3>No se pudo armar el plan</h3><p>' + esc(errTxt(e)) + '</p></div>'; return; }
    const hs = P.herreros;
    const pend = P.pendientes.filter(u => !u.entrega || String(u.entrega) <= isoL(new Date(Date.now() + 15 * 864e5)));
    let h = tabsSab;
    // Avisos (K19)
    const avisos = [];
    if(P.aviso) avisos.push(`<div class="ck-aviso rj">${esc(P.aviso)}</div>`);
    hs.forEach(x => { const s = salieron(P, x); if(s.length) avisos.push(`<div class="ck-aviso rj"><b>${esc(s.join(' · '))} salió del plan de ${esc(x.nombre)}.</b> Lo apartado volvió a libre. <button type="button" class="ck-link" data-ck-abrir="${esc(x.tid)}">Volver a enviar a ${esc(primerNombre(x.nombre))} ›</button></div>`); });
    if(P.cambio) avisos.push(`<div class="ck-aviso"><b>El plan guardado ya no cuadra</b> con lo asignado o con un modelo que cambió en el Costeador. <button type="button" class="ck-link" data-ck-rehacer>Rehacer ›</button></div>`);
    if(!hs.length && !pend.length){
      cont.innerHTML = h + avisos.join('') + `<div class="vacio"><h3>Nadie tiene Hierro asignado</h3><p>Asigna el Hierro en Pedidos y sale aquí solo.</p><button class="btn-secondary" type="button" data-ck-pedidos style="margin-top:12px">Ir a Pedidos</button></div>`;
      return;
    }
    const est = hs.map(x => estado(P, x));
    const porCortar = P.asign.filter(u => !u.cortado).length;
    const nEnv = est.filter(e => e.k === 'ok' || e.k === 'rj').length, nSin = hs.length - nEnv;
    h += `<div class="ck-nums"><div><b>${porCortar}</b><span>${porCortar === 1 ? 'Puerta por cortar' : 'Puertas por cortar'}</span></div><div><b>${nEnv}</b><span>${nEnv === 1 ? 'Enviado' : 'Enviados'}</span></div><div><b>${nSin}</b><span>Sin enviar</span></div></div>`;
    if(pend.length) h += `<div class="ck-card ck-sinasig"><div><b>${plural(pend.length, '1 puerta sin asignar', 'puertas sin asignar')}</b><span>entregan esta semana o la próxima</span></div><button class="tl-btn-sm" type="button" data-ck-asignar>Asignar</button></div>`;
    const faltan = [...new Set(P.barras.filter(b => b.tipo === 'barra' && b.comprar).flatMap(b => b.piezas.map(p => p.etq)))];
    if(faltan.length) h += `<div class="ck-aviso rj">Falta material para ${esc(faltan.join(' · '))}. Se pide al enviar el corte de su herrero.</div>`;
    h += avisos.join('');
    h += '<div class="ck-lista">' + hs.map((x, i) => {
      const e = est[i], us = x.unidades || [];
      const modelos = [...new Set(us.map(u => u.nombre))].join(' · ');
      const cargar = e.k === 'sin' ? us.find(u => u.mid) : null;
      return `<button class="nm-row" type="button" ${cargar ? `data-ck-cargar="${esc(cargar.mid)}"` : `data-ck-abrir="${esc(x.tid)}"`}>
        <span class="nm-av">${esc(iniciales(x.nombre))}</span>
        <span class="nm-tx"><b>${esc(x.nombre)} · ${plural(us.length, '1 puerta', 'puertas')}</b><span>${esc(us.map(u => u.etq).join(' · '))}${modelos ? ' · ' + esc(modelos) : ''}</span><span class="nm-tag ck-e ${e.k}">${esc(e.t)}</span></span>
        <span class="nm-m">${cargar ? 'Cargar' : 'Abrir'} ›</span></button>`;
    }).join('') + '</div>';
    h += '<p class="tl-nota" style="text-align:left">Asignas el Hierro → aquí revisas y escoges de dónde sale el material → envías → el herrero lo ve en Mi trabajo.</p>';
    cont.innerHTML = h;
  }
  $('vCorte').addEventListener('click', async (e) => {
    const s = e.target.closest('[data-ck-sab]'); if(s){ sab = s.dataset.ckSab; pintar(); return; }
    const a = e.target.closest('[data-ck-abrir]'); if(a){ abrirHerrero(a.dataset.ckAbrir); return; }
    const c = e.target.closest('[data-ck-cargar]'); if(c){ location.href = 'costos.html?modelo=' + encodeURIComponent(c.dataset.ckCargar); return; }
    if(e.target.closest('[data-ck-asignar]')){ abrirAsignar(); return; }
    if(e.target.closest('[data-ck-pedidos]')){ window.Taller && window.Taller.irA && window.Taller.irA('pedidos'); return; }
    if(e.target.closest('[data-ck-rehacer]')){ await rehacer(); }
  });

  // ---------- Corte de un herrero (K02, K07, K08) ----------
  function abrirHerrero(tid){ abierto = tid; pintarHerrero(tid); abrirHoja('sheetCorte'); }
  function listaPuerta(u){
    const X = window.COSTEO.datos(), c = X.costeo[u.mid] || {}, por = {};
    (c.piezas || []).forEach(([mid, n, cm]) => { (por[mid] ||= {})[cm] = ((por[mid] || {})[cm] || 0) + Number(n); });
    (u.ext || []).forEach(x => x.piezas.forEach(([mid, n, cm]) => { (por[mid] ||= {})[cm] = ((por[mid] || {})[cm] || 0) + Number(n); }));
    const filas = Object.entries(por).map(([mid, g]) => [K().nomMat(mid), Object.entries(g).sort((a, b) => b[0] - a[0]).map(([cm, n]) => `${n} de ${num(cm)}`).join(' · ')]);
    (c.hojas || []).forEach(([mid, n, a, h]) => filas.push([K().nomMat(mid), `${n} de ${num(a)} × ${num(h)}`]));
    return filas;
  }
  function pintarHerrero(tid){
    let P;
    try{ P = plan(); } catch(e){ return; }
    const x = P.herreros.find(h => String(h.tid) === String(tid));
    if(!x){ $('ckTitulo').textContent = 'Corte'; $('ckSub').textContent = ''; $('ckBody').innerHTML = '<p class="tl-nota">Este herrero ya no tiene Hierro para el ' + esc(sabadoCorto(sab)) + '.</p>'; $('ckFoot').innerHTML = ''; return; }
    const env = enviados()[x.tid], e = estado(P, x), us = (x.unidades || []).slice().sort((a, b) => String(a.entrega || '9').localeCompare(String(b.entrega || '9')) || a.venta - b.venta);
    const candado = !!(env && env.empezo) || x.entregado;
    $('ckTitulo').textContent = 'Corte de ' + x.nombre;
    $('ckSub').textContent = 'Hierro para el ' + sabadoCorto(sab) + ' · ' + plural(us.length, '1 puerta', 'puertas');
    let h = '';
    // Línea de estado
    if(candado) h += `<div class="ck-estado lock">🔒 ${esc(x.nombre)} ${x.entregado ? 'ya cortó' : 'ya empezó a cortar'} · el plan no se puede cambiar</div>`;
    else if(e.k === 'rj'){ const s = salieron(P, x); h += `<div class="ck-estado rj">⚠ Cambió${s.length ? ': ' + esc(s.join(', ')) + ' salió de su plan' : ''} · vuelve a enviar</div>`; }
    else if(env) h += `<div class="ck-estado ok">● Enviado · ${esc(cuando(env.en))}</div>`;
    else h += '<div class="ck-estado">● Sin enviar · revisa y envía</div>';
    // Línea de tiempo (K07, K08)
    if(env){
      const pasos = [`<li class="h"><b>Enviado a ${esc(primerNombre(x.nombre))}</b><span>${esc(cuando(env.en))}</span></li>`];
      if(e.k === 'rj') pasos.push(`<li class="h"><b>Cambio</b><span>después de enviar</span></li><li class="a"><b>Falta volver a enviar</b><span>${esc(primerNombre(x.nombre))} todavía ve el plan viejo</span></li>`);
      if(env.empezo) pasos.push(`<li class="h"><b>${esc(primerNombre(x.nombre))} empezó el Hierro</b><span>está cortando</span></li>`);
      pasos.push(`<li class="${x.entregado ? 'h' : 'w'}"><b>Termina el Hierro de sus puertas</b><span>ahí bajan las barras del Depósito y se guardan los retazos</span></li>`);
      h += `<ul class="ck-tiempo">${pasos.join('')}</ul>`;
    }
    // Una tarjeta por puerta
    const vistos = {};
    us.forEach((u, i) => {
      const color = u.color || K().COLORES[i % K().COLORES.length];
      const igual = u.conCortes && vistos[u.mid + '|' + (u.ext || []).map(z => z.n).join(',')];
      const filas = u.conCortes ? listaPuerta(u) : [];
      const faltan = {};
      x.barras.filter(b => b.tipo === 'barra' && b.comprar && b.piezas.some(p => String(p.eid) === String(u.eid))).forEach(b => { faltan[b.mid] = (faltan[b.mid] || 0) + 1; });
      const falta = Object.entries(faltan).map(([mid, n]) => `${n} ${K().nomMat(mid).toLowerCase()}`).join(' y ');
      h += `<section class="ck-puerta">
        <div class="ck-ph"><span class="ck-dot" style="background:${esc(color)}"></span><div class="nm-tx"><b>${esc(u.etq)} · ${esc(u.nombre)}</b><span>${esc(u.interna ? 'Exhibición' : (u.cliente || ''))} · ${i === 0 ? 'le toca primero' : 'después'}</span></div>
          ${candado ? '' : `<button type="button" class="ck-mas" data-ck-puerta="${esc(u.eid)}" aria-label="Opciones de ${esc(u.etq)}">⋯</button>`}</div>
        ${!u.conCortes ? `<p class="ck-sinc">Sin cortes · cárgalos en el Costeador. <a href="costos.html?modelo=${encodeURIComponent(u.mid || '')}" data-sub>Cargar ›</a></p>`
          : igual ? `<details class="ck-igual"><summary>Igual que ${esc(igual)} <span>ver lista ▸</span></summary>${tablaLista(filas)}</details>` : tablaLista(filas)}
        ${u.conCortes ? (falta ? `<p class="ck-mat rj">Falta ${esc(falta)} · se pide al enviar</p>` : '<p class="ck-mat ok">Material: hay todo ✓</p>') : ''}
        ${(u.extFalta || []).length ? `<p class="ck-mat">${esc(u.extFalta.map(z => z.n).join(', '))}: sin cortes, córtalo como siempre</p>` : ''}
      </section>`;
      if(u.conCortes && !igual) vistos[u.mid + '|' + (u.ext || []).map(z => z.n).join(',')] = u.etq;
    });
    // De dónde sale el material
    const porMat = {};
    x.barras.forEach(b => (porMat[b.mid] ||= []).push(b));
    if(Object.keys(porMat).length){
      const leyenda = us.filter(u => u.conCortes).map((u, i) => `<span><i style="background:${esc(u.color || K().COLORES[i % K().COLORES.length])}"></i>${esc(u.etq)}</span>`).join('');
      h += `<div class="ck-tit"><b>De dónde sale el material</b><span>${candado ? '' : 'toca una pieza'}</span></div><div class="tj-leg ck-leg">${leyenda}</div>`;
      Object.entries(porMat).forEach(([mid, bs]) => {
        const f = K().fabDe(mid), g = {};
        bs.forEach(b => b.piezas.forEach(p => { g[p.cm] = (g[p.cm] || 0) + 1; }));
        h += `<div class="ck-m"><div class="ck-mh"><b>${esc(K().nomMat(mid))}</b><span>${Object.entries(g).sort((a, b2) => b2[0] - a[0]).map(([cm, n]) => `${n} de ${num(cm)}`).join(' · ')}</span></div>`;
        bs.forEach(b => {
          const bi = P.barras.indexOf(b);
          const tag = b.tipo === 'retazo' ? `<span class="ck-tag ret">R-${esc(b.num || '?')}</span>` : b.comprar ? '<span class="ck-tag nueva">NUEVA</span>' : '<span class="ck-tag taller">TALLER</span>';
          const guarda = b.libre >= K().minRet(f) ? 'guarda ' + num(b.libre) + ' cm' : 'sobra ' + num(b.libre);
          const txt = b.tipo === 'retazo' ? 'retazo de ' + K().mTxt(b.largo) + ' · ' + guarda : b.comprar ? '1 barra · ' + guarda : 'barra de ' + K().mTxt(b.largo) + ' · ' + guarda;
          h += `<div class="ck-b">${tag}<span>${esc(txt)}</span></div><div class="ck-barra">${b.piezas.map((p, pi) => `<button type="button" class="ck-pz" style="flex:${Number(p.cm)};background:${esc(p.color || '#6F7C7E')}" ${candado ? 'disabled' : `data-ck-pz="${bi}:${pi}"`} aria-label="Pieza de ${esc(num(p.cm))} cm de ${esc(p.etq)}">${esc(num(p.cm))}<small>·${esc(String(p.etq).replace(/^N° /, ''))}</small></button>`).join('')}${b.libre >= 1 ? `<span class="ck-sob" style="flex:${Number(b.libre)}"></span>` : ''}</div>`;
        });
        h += '</div>';
      });
    }
    $('ckBody').innerHTML = h;
    // Pie: un solo botón
    const nNuevas = x.barras.filter(b => b.tipo === 'barra' && b.comprar).length;
    const sinCortes = us.length && us.every(u => !u.conCortes);
    if(candado){
      $('ckFoot').innerHTML = `<button class="btn-secondary" type="button" data-ck-corregir ${x.entregado ? '' : 'disabled'} style="width:100%">Corregir lo que cortó</button>
        <p class="nm-nota">${x.entregado ? 'Si cortó distinto, corrígelo aquí: el Depósito queda bien.' : 'Se activa cuando ' + esc(primerNombre(x.nombre)) + ' termina el Hierro.'}</p>
        <div class="ck-pie"><span></span><button type="button" class="ck-link" data-ck-masmenu>⋯ Más</button></div>`;
    } else if(sinCortes){
      $('ckFoot').innerHTML = '<p class="nm-nota">Carga los cortes de su modelo en el Costeador para poder enviarle el corte.</p>';
    } else {
      const ya = env && e.k !== 'rj';
      const txt = (env ? 'Volver a enviar a ' : 'Enviar a ') + primerNombre(x.nombre) + (nNuevas ? ' y pedir ' + plural(nNuevas, '1 barra', 'barras') : '');
      $('ckFoot').innerHTML = (ya ? `<p class="nm-nota" style="margin:0 0 8px">Ya se lo enviaste. Si cambias algo, sale "Cambió · vuelve a enviar".</p>` : `<button class="btn-primary nm-teal" type="button" data-ck-enviar>${esc(txt)}</button>`)
        + `<div class="ck-pie"><span>${nNuevas && !ya ? 'Se envía el corte y se pide la compra juntos' : ''}</span><button type="button" class="ck-link" data-ck-masmenu>⋯ Más</button></div>`;
    }
  }
  const tablaLista = (filas) => filas.length ? `<div class="ck-lista-c">${filas.map(([m, t]) => `<span>${esc(m)}</span><b>${esc(t)}</b>`).join('')}</div>` : '<p class="tl-nota" style="text-align:left">Sin piezas</p>';

  // ---------- Enviar (y pedir la compra), en una sola llamada ----------
  // La compra de las barras nuevas de ese herrero: cada material a su proveedor (el principal o, con
  // "el más barato", donde sale más barato), con su precio
  function compraDe(P, x){
    const nuevas = x.barras.filter(b => b.tipo === 'barra' && b.comprar);
    if(!nuevas.length) return null;
    const por = {}; nuevas.forEach(b => { por[b.mid] = (por[b.mid] || 0) + 1; });
    const lugares = {};
    for(const [mid, n] of Object.entries(por)){
      const f = K().fabDe(mid), pr = window.COSTEO.precioFab(f, String(P.prov)) || {};
      const prov = pr.de || (/^\d+$/.test(String(P.prov)) ? String(P.prov) : null);
      if(!prov) return { falta:true, material:f ? f.nombre : 'un material' };
      (lugares[prov] ||= []).push({ material_id:Number(mid), cantidad:n, precio:Number(pr.p) || 0 });
    }
    return { lugares:Object.entries(lugares).map(([prov, lineas]) => ({ proveedor_id:Number(prov), lineas })), nota:'Para el corte de ' + x.nombre + ' del ' + sabadoCorto(sab) };
  }
  const datosPlan = (P, extra) => Object.assign({ firma:P.firma, barras:K().limpiar(P.barras), aceptado:P.aceptado, ajustado:P.ajustado, no_usar:P.noUsar, manual:P.manual, extras_mano:P.extrasMano }, extra || {});
  async function enviar(btn){
    if(ocupado) return;
    const P = plan(), x = P.herreros.find(h => String(h.tid) === String(abierto)); if(!x) return;
    const compra = compraDe(P, x);
    if(compra && compra.falta){ toast('Ningún proveedor tiene precio de ' + compra.material + '. Ponlo en Costeador › Precios y vuelve a enviar.', 'error'); return; }
    ocupado = true; btn.disabled = true;
    try{
      const { error } = await db.rpc('corte_enviar', { p_sab:sab, p_tid:x.tid, p_plan:datosPlan(P), p_compra:compra });
      if(error) throw error;
      toast(compra ? `Enviado a ${primerNombre(x.nombre)} y se pidió la compra. Lo ve en Mi trabajo.` : `Enviado a ${primerNombre(x.nombre)}. Lo ve en Mi trabajo.`);
      await cargar();
    } catch(e){
      const m = String((e && e.message) || '');
      toast(/fetch|network|Failed/i.test(m) ? 'No se envió el corte ni se pidió la compra. Revisa la conexión y toca Enviar otra vez.' : (m || 'No se envió el corte'), 'error');
      btn.disabled = false;
    } finally { ocupado = false; }
  }
  async function guardarPlan(P, ok){
    if(ocupado) return false; ocupado = true;
    try{
      const { error } = await db.rpc('corte_plan_guardar', { p_sab:sab, p:datosPlan(P, { ajustado:true }) });
      if(error) throw error;
      if(ok) toast(ok);
      return true;
    } catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { ocupado = false; }
  }
  async function llamar(fn, args, ok){
    if(ocupado) return false; ocupado = true;
    try{ const { error } = await db.rpc(fn, args); if(error) throw error; if(ok) toast(ok); return true; }
    catch(e){ toast(errTxt(e), 'error'); return false; }
    finally { ocupado = false; }
  }
  async function rehacer(){
    if(await llamar('corte_plan_reiniciar', { p_sab:sab }, 'Volvió la sugerencia de la app. Revisa y envía.')) await cargar();
  }
  $('ckFoot').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ck-enviar]'); if(b && !b.disabled){ enviar(b); return; }
    if(e.target.closest('[data-ck-masmenu]')){ abrirMas(); return; }
    const c = e.target.closest('[data-ck-corregir]'); if(c && !c.disabled) abrirCorregir();
  });
  $('ckBody').addEventListener('click', (e) => {
    const p = e.target.closest('[data-ck-pz]'); if(p){ const [bi, pi] = p.dataset.ckPz.split(':').map(Number); abrirPieza(bi, pi); return; }
    const u = e.target.closest('[data-ck-puerta]'); if(u) abrirPuerta(u.dataset.ckPuerta);
  });

  // ---------- Una pieza: de dónde sale (K04) ----------
  let PZ = null;
  function abrirPieza(bi, pi){
    const P = plan(), b = P.barras[bi], p = b && b.piezas[pi]; if(!p) return;
    const f = K().fabDe(b.mid), corte = K().reglas().corte;
    const ops = [];
    const etq = (x) => x.tipo === 'retazo' ? 'R-' + (x.num || '?') : x.comprar ? 'NUEVA' : 'TALLER';
    const tagCls = (x) => x.tipo === 'retazo' ? 'ret' : x.comprar ? 'nueva' : 'taller';
    P.barras.forEach((x, i) => {
      if(String(x.mid) !== String(b.mid) || String(x.tid) !== String(b.tid)) return;
      if(i === bi){ ops.push({ v:String(i), t:x.tipo === 'retazo' ? `Retazo R-${x.num || '?'} · ${K().mTxt(x.largo)}` : x.comprar ? 'Barra nueva' : 'Barra del taller', s:'donde está ahora', tag:etq(x), cls:tagCls(x), on:true }); return; }
      const cabe = x.libre + 1e-9 >= p.cm;
      ops.push({ v:String(i), t:x.tipo === 'retazo' ? `Retazo R-${x.num || '?'} · ${K().mTxt(x.largo)}` : x.comprar ? 'Barra nueva' : 'Barra del taller', s:cabe ? 'cabe · sobran ' + num(Math.max(0, x.libre - p.cm - corte)) + ' cm' : 'ya está llena', tag:etq(x), cls:tagCls(x), off:!cabe });
    });
    K().retazosLibres(P, b.mid).forEach(r => { if(Number(r.largo) + 1e-9 >= p.cm) ops.push({ v:'r:' + r.id, t:`Retazo R-${r.num || '?'} · ${K().mTxt(r.largo)}`, s:'cabe · sobran ' + num(Number(r.largo) - p.cm) + ' cm', tag:'R-' + (r.num || '?'), cls:'ret', ret:true }); });
    if(!(b.tipo === 'barra' && b.comprar && b.piezas.length === 1)) ops.push({ v:'nueva', t:'Barra nueva', s:'la que se compra', tag:'NUEVA', cls:'nueva' });
    PZ = { bi, pi, sel:String(bi), ops, sola:b.piezas.length === 1 };
    $('ckPzTitulo').textContent = 'Pieza de ' + num(p.cm) + ' cm';
    $('ckPzSub').textContent = K().nomMat(b.mid) + ' · ' + p.etq + ' · ' + (P.herreros.find(h => h.tid === b.tid) || {}).nombre;
    pintarPieza();
    abrirHoja('sheetCkPieza');
  }
  function pintarPieza(){
    const o = PZ.ops.find(x => x.v === PZ.sel);
    const nota = o && o.ret && !PZ.sola ? `Usar el ${esc(o.tag)} no te ahorra una barra: las otras piezas igual la necesitan.` : '';
    $('ckPzBody').innerHTML = `<p class="field-label">¿De dónde sale?</p><div class="nm-cuentas" role="radiogroup">${PZ.ops.map(x => `<button type="button" class="nm-cta ${x.v === PZ.sel ? 'on' : ''}" role="radio" aria-checked="${x.v === PZ.sel}" data-ck-op="${esc(x.v)}" ${x.off ? 'disabled' : ''}>
      <span class="nm-rad"></span><span class="nm-tx"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span><span class="ck-tag ${x.cls}">${esc(x.tag)}</span></button>`).join('')}</div>
      ${nota ? `<p class="ck-nota">${nota}</p>` : ''}`;
  }
  $('ckPzBody').addEventListener('click', (e) => { const b = e.target.closest('[data-ck-op]'); if(!b || b.disabled) return; PZ.sel = b.dataset.ckOp; pintarPieza(); });
  $('btnCkPieza').addEventListener('click', async () => {
    if(!PZ) return;
    if(PZ.sel === String(PZ.bi)){ cerrarHoja('sheetCkPieza'); return; }
    const P = plan();
    if(!K().moverPieza(P, PZ.bi, PZ.pi, PZ.sel)){ toast('No cabe ahí. Elige otra.', 'error'); return; }
    if(await guardarPlan(P, 'Listo. Si ya lo habías enviado, vuelve a enviarlo.')){ cerrarHoja('sheetCkPieza', true); await cargar(); }
  });

  // ---------- ⋯ de una puerta (K05) ----------
  let PU = null;
  function abrirPuerta(eid){
    const P = plan(), u = P.asign.find(x => String(x.eid) === String(eid)); if(!u) return;
    const dueno = P.herreros.find(h => h.tid === u.tid) || {};
    PU = { u, que:'otro', tid:null, nombre:dueno.nombre || '' };
    $('ckPuTitulo').textContent = u.etq + ' · ' + u.nombre;
    $('ckPuSub').textContent = 'En el corte de ' + PU.nombre;
    pintarPuerta();
    abrirHoja('sheetCkPuerta');
  }
  function pintarPuerta(){
    const otros = herrerosConHierro().filter(t => t.id !== PU.u.tid);
    const op = (k, t, s, extra) => `<button type="button" class="nm-cta ${PU.que === k ? 'on' : ''}" role="radio" aria-checked="${PU.que === k}" data-ck-que="${k}"><span class="nm-rad"></span><span class="nm-tx"><b>${t}</b><span>${s}</span></span></button>${extra || ''}`;
    $('ckPuBody').innerHTML = `<p class="field-label">¿Qué quieres hacer?</p><div class="nm-cuentas" role="radiogroup">
      ${op('otro', 'Pasarla a otro herrero', `sale del plan de ${esc(primerNombre(PU.nombre))} y entra en el del otro`, PU.que === 'otro' ? `<div class="at-ops ck-hs">${otros.map(t => `<button type="button" class="at-op ${PU.tid === t.id ? 'on' : ''}" data-ck-h="${esc(t.id)}"><span class="ini">${esc(iniciales(t.nombre))}</span>${esc(t.nombre)}</button>`).join('') || '<p class="at-vacio">No hay otro herrero.</p>'}</div>` : '')}
      ${op('prox', 'Pasarla al próximo sábado', `${esc(sabadoCorto(siguienteSab(sab)))} · lo apartado vuelve a libre`)}
      ${op('quitar', 'Quitarla del plan', `sigue asignada a ${esc(primerNombre(PU.nombre))}, pero sin lista de corte`)}</div>
      <p class="ck-nota">El plan de ${esc(primerNombre(PU.nombre))} se rehace solo. Si ya lo enviaste, te pide volver a enviarlo.</p>`;
    const t = PU.que === 'otro' ? (PU.tid ? 'Pasar a ' + primerNombre((trabajadores.find(x => x.id === PU.tid) || {}).nombre) : 'Elige a quién') : PU.que === 'prox' ? 'Pasar al ' + sabadoCorto(siguienteSab(sab)) : 'Quitar del plan';
    $('btnCkPuerta').textContent = t;
    $('btnCkPuerta').disabled = PU.que === 'otro' && !PU.tid;
  }
  const siguienteSab = (s) => { const [y, m, d] = s.split('-').map(Number); return isoL(new Date(y, m - 1, d + 7)); };
  $('ckPuBody').addEventListener('click', (e) => {
    const q = e.target.closest('[data-ck-que]'); if(q){ PU.que = q.dataset.ckQue; pintarPuerta(); return; }
    const h = e.target.closest('[data-ck-h]'); if(h){ PU.tid = h.dataset.ckH; pintarPuerta(); }
  });
  $('btnCkPuerta').addEventListener('click', async () => {
    if(!PU || $('btnCkPuerta').disabled) return;
    let ok;
    if(PU.que === 'quitar') ok = await llamar('corte_manual', { p_sab:sab, eid:Number(PU.u.eid) }, 'Quitada del plan. Sigue asignada, sin lista de corte.');
    else ok = await llamar('asignar_etapas', { p:[{ eid:Number(PU.u.eid), tid:PU.que === 'otro' ? PU.tid : PU.u.tid, para:PU.que === 'prox' ? siguienteSab(sab) : sab }] },
      PU.que === 'otro' ? 'Listo. Pasó al corte de ' + primerNombre((trabajadores.find(x => x.id === PU.tid) || {}).nombre) + '.' : 'Listo. Pasó al ' + sabadoCorto(siguienteSab(sab)) + '.');
    if(ok){ cerrarHoja('sheetCkPuerta', true); await cargar(); if(window.Taller && window.Taller.recargar) window.Taller.recargar(); }
  });

  // ---------- Asignar puertas (K06) ----------
  let AS = null;
  function abrirAsignar(){
    AS = { filtro:'sin', para:sab, elegidos:{} };
    pintarAsignar();
    abrirHoja('sheetCkAsignar');
  }
  function pintarAsignar(){
    const P = plan(), todos = (K().datos().pasos || []);
    const sin = P.pendientes, otro = P.asign;
    const lista = AS.filtro === 'sin' ? sin : otro;
    const cuenta = {}; otro.forEach(u => { cuenta[u.tid] = (cuenta[u.tid] || 0) + 1; });
    const monto = (eid) => window.Taller && window.Taller.montoDe ? window.Taller.montoDe(eid) : null;
    $('ckAsBody').innerHTML = `<div class="chips nm-tabs" role="tablist"><button type="button" class="chip ${AS.filtro === 'sin' ? 'active' : ''}" data-ck-f="sin">Sin asignar ${sin.length}</button><button type="button" class="chip ${AS.filtro === 'otro' ? 'active' : ''}" data-ck-f="otro">De otro herrero</button></div>
      <p class="field-label">¿Para cuándo?</p><div class="seg" role="radiogroup">${[SAB.este, SAB.proximo].map(s => `<button type="button" class="seg-op ${AS.para === s ? 'on' : ''}" data-ck-para="${s}">${s === SAB.este ? 'Este' : 'Próximo'} ${esc(sabadoCorto(s))}</button>`).join('')}</div>
      ${lista.length ? lista.map(u => { const m = monto(u.eid); return `<section class="ck-as">
        <div class="ck-ash"><span class="ck-asf">${iconoTipo(u.tipo, 26)}</span><div class="nm-tx"><b>${esc(u.nombre)}${u.de > 1 ? ' · ' + u.unidad + ' de ' + u.de : ''}</b><span>${esc(u.etq.split(' (')[0])} · ${esc(u.interna ? 'Exhibición' : (u.cliente || ''))}${u.entrega ? ' · entrega ' + esc(sabadoCorto(u.entrega).replace('sáb ', '')) : ''}</span>${u.tid ? `<span>la tiene ${esc((todos.find(x => x.eid === u.eid) || {}).herrero || '')}</span>` : ''}${m ? `<span>${dinero(m)}</span>` : ''}
          <button type="button" class="ck-link" data-ck-ver="${esc(u.venta)}">Ver pedido ${u.interna ? '' : 'N° ' + esc(u.venta)}</button></div></div>
        <div class="at-ops">${herrerosConHierro().map(t => `<button type="button" class="at-op ${AS.elegidos[u.eid] === t.id ? 'on' : ''}" data-ck-as="${esc(u.eid)}" data-tid="${esc(t.id)}"><span class="ini">${esc(iniciales(t.nombre))}</span>${esc(t.nombre)} · ${cuenta[t.id] || 0}</button>`).join('')}</div>
      </section>`; }).join('') : `<p class="tl-nota">${AS.filtro === 'sin' ? 'No hay puertas sin herrero.' : 'Nadie tiene puertas para este sábado.'}</p>`}
      <p class="tl-nota" style="text-align:left">El número es cuántas puertas tiene ya esa semana. Cada puerta entra sola al corte de su herrero.</p>`;
    const n = Object.keys(AS.elegidos).length;
    $('btnCkAsignar').textContent = n ? 'Asignar ' + plural(n, '1 puerta', 'puertas') : 'Elige el herrero de cada puerta';
    $('btnCkAsignar').disabled = !n;
  }
  $('ckAsBody').addEventListener('click', (e) => {
    const f = e.target.closest('[data-ck-f]'); if(f){ AS.filtro = f.dataset.ckF; AS.elegidos = {}; pintarAsignar(); return; }
    const p = e.target.closest('[data-ck-para]'); if(p){ AS.para = p.dataset.ckPara; pintarAsignar(); return; }
    const v = e.target.closest('[data-ck-ver]'); if(v){ cerrarHoja('sheetCkAsignar', true); window.Taller && window.Taller.abrirPedido && window.Taller.abrirPedido(Number(v.dataset.ckVer)); return; }
    const a = e.target.closest('[data-ck-as]'); if(a){ const eid = a.dataset.ckAs; if(AS.elegidos[eid] === a.dataset.tid) delete AS.elegidos[eid]; else AS.elegidos[eid] = a.dataset.tid; pintarAsignar(); }
  });
  $('btnCkAsignar').addEventListener('click', async () => {
    const p = Object.entries(AS.elegidos).map(([eid, tid]) => ({ eid:Number(eid), tid, para:AS.para }));
    if(!p.length) return;
    if(await llamar('asignar_etapas', { p }, 'Listo. A cada uno le llega el aviso cuando le toque.')){ cerrarHoja('sheetCkAsignar', true); await cargar(); if(window.Taller && window.Taller.recargar) window.Taller.recargar(); }
  });

  // ---------- Más (K03) ----------
  function abrirMas(){
    const P = plan(), x = P.herreros.find(h => String(h.tid) === String(abierto)); if(!x) return;
    const env = enviados()[x.tid], empezo = !!(env && env.empezo) || x.entregado;
    const fila = (k, t, s, off) => `<button type="button" class="ck-mrow" data-ck-m="${k}" ${off ? 'disabled' : ''}><b>${t}</b><span>${s} ›</span></button>`;
    $('ckMasSub').textContent = 'Corte de ' + x.nombre;
    $('ckMasBody').innerHTML = fila('pdf', 'Ver en PDF', 'para imprimir')
      + fila('rehacer', 'Sugerir de nuevo', P.ajustado ? 'pregunta antes de borrar tus cambios' : 'vuelve a la sugerencia', empezo)
      + (env ? fila('deshacer', 'Deshacer envío', 'solo si no ha empezado', empezo) : '')
      + fila('corregir', 'Corregir lo que cortó', 'después de terminar', !x.entregado)
      + '<div id="ckRehacer"></div>';
    abrirHoja('sheetCkMas');
  }
  $('ckMasBody').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ck-m]');
    if(b && !b.disabled){
      const k = b.dataset.ckM;
      if(k === 'pdf'){ K().setSab(sab); K().pdfHoja(abierto); return; }
      if(k === 'rehacer'){
        const P = plan();
        if(P.ajustado){ $('ckRehacer').innerHTML = `<div class="ck-card"><b>¿Rehacer la sugerencia?</b><p class="tl-nota" style="text-align:left;margin:4px 0 10px">Moviste piezas a mano. Si rehaces, se pierden esos cambios.</p>
          <div class="nm-pie2" style="flex-direction:row"><button class="btn-secondary" type="button" data-ck-no style="flex:1">Dejar como está</button><button class="btn-primary nm-teal" type="button" data-ck-si style="flex:1">Rehacer</button></div></div>`; return; }
        cerrarHoja('sheetCkMas', true); await rehacer(); return;
      }
      if(k === 'deshacer'){ if(await llamar('corte_deshacer_envio', { p_sab:sab, p_tid:abierto }, 'Envío deshecho. Ya no lo ve en Mi trabajo.')){ cerrarHoja('sheetCkMas', true); await cargar(); } return; }
      if(k === 'corregir'){ cerrarHoja('sheetCkMas', true); abrirCorregir(); return; }
    }
    if(e.target.closest('[data-ck-no]')){ $('ckRehacer').innerHTML = ''; return; }
    if(e.target.closest('[data-ck-si]')){ cerrarHoja('sheetCkMas', true); await rehacer(); }
  });

  // ---------- Corregir lo que cortó (K10) ----------
  let CO = null;
  function abrirCorregir(){
    const P = plan(), x = P.herreros.find(h => String(h.tid) === String(abierto)); if(!x) return;
    const mats = [...new Set(x.barras.map(b => String(b.mid)))];
    CO = { mats:mats.map(mid => { const bs = P.barras.filter(b => String(b.mid) === mid && b.tipo === 'barra'), co = (P.corregido || {})[mid];
      return { mid, plan:bs.length, barras:co ? Number(co.barras) : bs.length, usados:co ? co.usados : P.barras.filter(b => String(b.mid) === mid && b.tipo === 'retazo').map(b => b.rid),
        quedaron:(P.nuevos || []).filter(n => String(n.mid) === mid).map(n => Number(n.cm)), cambio:false }; }), motivo:'' };
    $('ckCoSub').textContent = primerNombre(x.nombre) + ' terminó el Hierro · ' + sabadoCorto(sab);
    pintarCorregir();
    abrirHoja('sheetCkCorregir');
  }
  function pintarCorregir(){
    $('ckCoBody').innerHTML = `<p class="tl-nota" style="text-align:left;margin-top:0">Cambia solo lo que fue distinto al plan. Lo demás queda como se envió.</p>
      ${CO.mats.map((m, i) => `<div class="ck-co"><div class="ck-mh"><b>${esc(K().nomMat(m.mid))}</b><span>plan: ${plural(m.plan, '1 barra', 'barras')}</span></div>
        <div class="ck-step"><span>Barras que usó</span><button type="button" data-ck-menos="${i}" aria-label="Una menos">−</button><b>${m.barras}</b><button type="button" data-ck-mas2="${i}" aria-label="Una más">+</button></div></div>`).join('')}
      <div class="field" id="campoCkMotivo"><label class="field-label" for="ckMotivo">¿Qué pasó?</label><input class="input" id="ckMotivo" maxlength="140" value="${esc(CO.motivo)}" autocomplete="off"><p class="field-error">Escribe qué pasó</p></div>
      <p class="ck-nota">El Depósito se ajusta con la diferencia y queda el motivo.</p>`;
  }
  $('ckCoBody').addEventListener('click', (e) => {
    const a = e.target.closest('[data-ck-menos]'), b = e.target.closest('[data-ck-mas2]');
    const i = a ? +a.dataset.ckMenos : b ? +b.dataset.ckMas2 : -1; if(i < 0) return;
    CO.motivo = $('ckMotivo').value;
    const m = CO.mats[i]; m.barras = Math.max(0, Math.min(99, m.barras + (b ? 1 : -1))); m.cambio = true; pintarCorregir();
  });
  $('btnCkCorregir').addEventListener('click', async () => {
    CO.motivo = $('ckMotivo').value.trim();
    if(!CO.motivo){ $('campoCkMotivo').classList.add('invalid'); return; }
    const cambios = CO.mats.filter(m => m.cambio);
    if(!cambios.length){ toast('No cambiaste nada'); return; }
    for(const m of cambios){
      const ok = await llamar('corte_corregir', { p_sab:sab, p:{ material_id:Number(m.mid), barras:m.barras, usados:(m.usados || []).map(Number), quedaron:m.quedaron, motivo:CO.motivo } }, null);
      if(!ok) return;
    }
    toast('Corrección guardada. El Depósito ya cuadra.');
    cerrarHoja('sheetCkCorregir', true); await cargar();
  });

  // Avisos del corte para el Resumen (K19): los importantes salen también allí
  function avisos(){
    if(!cargado) return [];
    try{ const P = plan(), out = [];
      if(P.aviso) out.push(P.aviso);
      P.herreros.forEach(x => { if(estado(P, x).k === 'rj') out.push(`Cambió el corte de ${x.nombre}: vuelve a enviar`); });
      return out;
    } catch(e){ return []; }
  }

  window.TallerCorte = { mostrar(){ if(!cargado) cargar(); else pintar(); }, recargar:cargar, avisos, get cargado(){ return cargado; } };
})();
