// Taller › Nómina (lote 3, maquetas T5 y T6). Va dentro de taller.html (nomina.html redirige aquí).
// Por pagar y lo ya pagado esta semana, una fila por trabajador, y su drawer con Por pagar ·
// Historial · Vales. Se paga lo marcado, el día que sea (pagar_lo_marcado): lo que se desmarca
// queda para después con ↩. Revisar un vale es otra hoja (Aprobar / No aprobar).
// Al carpintero solo lo ve quien lleva la madera (es quien le paga; el servidor lo vuelve a revisar).
// Lo ven los administradores; paga quien puede pagarle a ese trabajador (_puede_pagar_a).
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, resumenSpecs, specChipsHtml, heroAttrs, verFoto, etiquetaOtroColor, sabados } = window.AH;
  const $ = (id) => document.getElementById(id);

  const ESP = { herrero:'Hierro', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Aluminio', carpintero:'Madera' };
  const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
  const CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  let llevaMadera = false;
  let resumen = null, pagosSemana = [], viejos = {};
  let ficha = null, tab = 'pagar', marcados = null, haciendo = [];
  let cargado = false;

  // ---------- Fechas y montos ----------
  const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const diaDe = (ts) => { const d = new Date(ts); return isNaN(d) ? '' : isoLocal(d); };
  const fechaDe = (f) => { const [y, m, d] = String(f).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  function lunes(){ const s = fechaDe(sabados().este); s.setDate(s.getDate() - 5); return s; }
  const lunesTs = () => lunes().toISOString();
  const corto = (f, conMes) => { const d = fechaDe(f); return d.toLocaleDateString('es-VE', { weekday:'short' }).replace('.', '') + ' ' + d.getDate() + (conMes ? ' ' + d.toLocaleDateString('es-VE', { month:'short' }).replace('.', '') : ''); };
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  function hora(ts){ const d = new Date(ts); const h = d.getHours(); return ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (h < 12 ? ' am' : ' pm'); }
  function cuando(ts){
    const f = diaDe(ts); if(!f) return '';
    const hoy = isoLocal(new Date());
    if(f === hoy) return 'hoy ' + hora(ts);
    const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
    if(f === isoLocal(ayer)) return 'ayer';
    return f >= isoLocal(lunes()) ? corto(f).split(' ')[0] : corto(f, true);
  }
  const deAntes = (ts) => !!ts && new Date(ts) < lunes();
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const centimos = (n) => '$' + r2(n).toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const suma = (l) => r2((l || []).reduce((a, x) => a + (Number(x.monto) || 0), 0));
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  function iniciales(n){ const p = String(n || '?').trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase(); }
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0];
  const mensaje = (e) => {
    const m = String((e && e.message) || '');
    if(/fetch|network|Failed/i.test(m)) return 'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.';
    if(/invalid input syntax|uuid/i.test(m)) return 'No se encontró ese trabajador';
    if(/pagar_lo_marcado/i.test(m)) return 'Falta un cambio en la base para pagar lo marcado. Avísale a Gualfredo.';
    return m || 'Algo salió mal';
  };
  // Quién se ve: al carpintero le paga quien lleva la madera; a los demás, Ray
  const seVe = (t) => llevaMadera || !(t.especialidades || []).includes('carpintero');

  // ---------- Lista ----------
  async function cargar(){
    const cont = $('vNomina');
    try{
      const [rn, rp, rv] = await Promise.all([
        db.rpc('nomina_semana'),
        db.from('pagos_trabajador').select('trabajador_id,monto,pagado_en').gte('pagado_en', lunesTs()),
        db.from('etapas').select('id,trabajador_id').eq('estado', 'hecha').is('pago_id', null).lt('terminada_en', lunesTs())
      ]);
      if(rn.error) throw rn.error;
      resumen = rn.data || { trabajadores:[] };
      pagosSemana = rp.error ? [] : (rp.data || []);
      viejos = {};
      (rv.error ? [] : (rv.data || [])).forEach(e => { viejos[e.trabajador_id] = (viejos[e.trabajador_id] || 0) + 1; });
      cargado = true;
      pintarLista();
    } catch(e){
      if(!cargado) cont.innerHTML = '<div class="vacio"><h3>No se pudo cargar</h3><p>Revisa tu internet y toca Actualizar.</p></div>';
      toast(mensaje(e), 'error');
    }
  }
  function pintarLista(){
    const l = (resumen.trabajadores || []).filter(seVe);
    const tm = r2(l.reduce((a, t) => a + Number(t.trabajos_monto || 0), 0));
    const vm = r2(l.reduce((a, t) => a + Number(t.vales_monto || 0), 0));
    const pagos = pagosSemana.filter(p => l.some(t => t.id === p.trabajador_id));
    const pagado = r2(pagos.reduce((a, p) => a + Number(p.monto || 0), 0));
    const filas = l.map((t, i) => {
      const neto = Number(t.neto) || 0;
      const p = [ESP[(t.especialidades || [])[0]] || 'Sin especialidad'];
      const pagoSem = pagos.filter(x => x.trabajador_id === t.id).sort((a, b) => String(b.pagado_en).localeCompare(String(a.pagado_en)))[0];
      if(Number(t.trabajos)) p.push(plural(Number(t.trabajos), '1 trabajo', 'trabajos'));
      if(Number(t.vales_monto)) p.push('vale −' + dinero(t.vales_monto));
      if(!Number(t.trabajos) && !Number(t.vales_monto)) p.push(pagoSem ? `le pagaste ${dinero(pagoSem.monto)} el ${corto(diaDe(pagoSem.pagado_en)).split(' ')[0]}` : 'nada esta semana');
      if(Number(t.por_definir)) p.push(plural(Number(t.por_definir), '1 sin monto', 'sin monto'));
      const tags = (viejos[t.id] ? `<span class="nm-tag rj">${plural(viejos[t.id], '1 de la semana pasada', 'de semanas pasadas')}</span>` : '')
        + (t.vale_pendiente != null ? `<span class="nm-tag am">Pidió vale ${esc(dinero(t.vale_pendiente))} · revisar</span>` : '');
      return `<button class="nm-row" type="button" data-trab="${esc(t.id)}" style="--i:${i}">
        <span class="nm-av">${esc(iniciales(t.nombre))}</span>
        <span class="nm-tx"><b>${esc(t.nombre)}</b><span>${esc(p.join(' · '))}</span>${tags}</span>
        <span class="nm-m ${neto > 0 ? '' : 'dia'}">${neto > 0 ? esc(dinero(neto)) : 'al día'} ›</span></button>`;
    }).join('');
    $('vNomina').innerHTML = `
      <div class="nm-bento">
        <div class="nm-big"><span>Por pagar</span><b>${dinero(tm - vm)}</b><small>trabajos <span class="nm-nw">${dinero(tm)}</span>${vm ? ` · vales <span class="nm-nw">−${dinero(vm)}</span>` : ''}</small></div>
        <div class="nm-sm"><b>${dinero(pagado)}</b><span>Ya pagado esta semana</span></div>
      </div>
      <div class="nm-cab"><span>Por trabajador</span><span>a pagar</span></div>
      <div class="nm-lista">${filas || '<p class="tl-nota">No hay trabajadores todavía. Créalos en Usuarios.</p>'}</div>
      <div class="tl-atajos" style="margin-top:14px"><button type="button" data-nm-vale>+ Vale</button><a href="categorias-pago.html" data-sub>Categorías de pago</a><button type="button" data-nm-hist>Historial</button></div>`;
  }
  $('vNomina').addEventListener('click', (e) => {
    const b = e.target.closest('[data-trab]');
    if(b){ abrirTrabajador(b.dataset.trab); return; }
    if(e.target.closest('[data-nm-vale]')){ abrirVale(null); return; }
    if(e.target.closest('[data-nm-hist]')) abrirHistGeneral();
  });

  // ---------- Drawer del trabajador: Por pagar · Historial · Vales ----------
  async function abrirTrabajador(tid, pestana){
    try{
      const [rf, rh] = await Promise.all([
        db.rpc('nomina_trabajador', { tid }),
        db.from('etapas').select('id,nombre,iniciada_en,item:venta_items(nombre,venta_id)').eq('trabajador_id', tid).eq('estado', 'pendiente').not('iniciada_en', 'is', null)
      ]);
      if(rf.error) throw rf.error;
      const nueva = !ficha || ficha.trabajador.id !== tid;
      ficha = rf.data;
      haciendo = rh.error ? [] : (rh.data || []);
      if(nueva || !marcados || pestana) marcados = null;
      tab = pestana || (nueva ? 'pagar' : tab);
      pintarFicha();
      abrirHoja('sheetTrab');
    } catch(e){ toast(mensaje(e), 'error'); }
  }
  const trabajosDe = () => [...(ficha.trabajos || []), ...(ficha.proxima || [])];
  const valesDe = () => [...(ficha.vales || []), ...(ficha.vales_proxima || [])];
  const pagable = (it) => it.monto != null || !!window.AH.notaPago(it.oficio, it.monto);
  function seleccion(){
    if(!marcados){
      marcados = { e: new Set(trabajosDe().filter(pagable).map(x => x.id)), v: new Set(valesDe().map(x => x.id)) };
    }
    const tr = trabajosDe().filter(x => marcados.e.has(x.id)), va = valesDe().filter(x => marcados.v.has(x.id));
    const tt = suma(tr), tv = suma(va);
    return { tr, va, tt, tv, neto: r2(tt - tv) };
  }
  function refPedido(it){
    return it.interna ? 'Exhibición' + (it.sede ? ' · ' + esc(it.sede) : '') : `<a href="ventas.html?abrir=${encodeURIComponent(it.venta_id)}" data-sub class="nm-ped">N° ${esc(it.venta_id)}</a>`;
  }
  function nombreTrabajo(it){
    return `${esc(it.etapa)} · ${esc(it.producto)}${Number(it.de) > 1 ? ' ' + esc(it.unidad) + ' de ' + esc(it.de) : it.cantidad > 1 ? ' ×' + esc(it.cantidad) : ''}`;
  }
  function filaTrabajo(it, conCasilla){
    const nota = window.AH.notaPago(it.oficio, it.monto);
    const on = marcados && marcados.e.has(it.id);
    const ok = pagable(it);
    const antes = deAntes(it.fecha) && !it.pago_id;
    const monto = nota ? `<span class="nm-im gris">${esc(nota)}</span>` : it.monto == null ? '<span class="nm-im rojo">Sin monto</span>' : `<span class="nm-im">${esc(dinero(it.monto))}</span>`;
    return `<div class="nm-it" data-item="${it.id}">
      ${conCasilla ? `<button type="button" class="nm-ck ${on ? 'on' : ''}" data-ck-e="${it.id}" role="checkbox" aria-checked="${on}" aria-label="Pagar ${esc(it.etapa)}"${ok ? '' : ' disabled'}>${CHECK}</button>` : ''}
      <span class="nm-foto">${it.foto_trabajo || it.foto ? window.AH.imgMini(it.foto_trabajo || it.foto, '', it.tipo) : iconoTipo(it.tipo, 20)}</span>
      <span class="nm-tx"><b>${nombreTrabajo(it)}${antes ? ' <span class="nm-vuelta" aria-label="de la semana pasada">↩</span>' : ''}</b>
        <span>${esc(antes ? corto(diaDe(it.fecha)) + ' · no se pagó' : cuando(it.fecha))} · ${refPedido(it)}</span></span>
      ${monto}</div>`;
  }
  function filaVale(v, conCasilla, txt){
    const on = marcados && marcados.v.has(v.id);
    const bs = v.monto_bs ? ` · en Bs ${esc(Number(v.monto_bs).toLocaleString('es-VE'))}${v.tasa ? ' a ' + esc(Number(v.tasa).toLocaleString('es-VE')) : ''}` : '';
    return `<div class="nm-it">
      ${conCasilla ? `<button type="button" class="nm-ck ${on ? 'on' : ''}" data-ck-v="${v.id}" role="checkbox" aria-checked="${on}" aria-label="Descontar el vale">${CHECK}</button>` : ''}
      <span class="nm-foto vale">vale</span>
      <span class="nm-tx"><b>Vale del ${esc(DIAS_LARGOS[new Date(v.fecha).getDay()] || '')}${v.nota ? ' · ' + esc(v.nota) : ''}</b><span>${esc(txt)}${bs}</span></span>
      <span class="nm-im rojo">−${esc(dinero(v.monto))}</span></div>`;
  }
  function pintarFicha(){
    const t = ficha.trabajador;
    const s = seleccion();
    const debe = r2(suma(trabajosDe().filter(pagable)) - suma(valesDe()));
    $('trabNombre').textContent = t.nombre;
    $('trabSub').innerHTML = `${esc(ESP[(t.especialidades || [])[0]] || 'Sin especialidad')} · ${debe > 0 ? `por pagar <b>${esc(dinero(debe))}</b>` : 'al día'}`;
    $('trabTabs').querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
    if(tab === 'historial') return pintarHistorial();
    if(tab === 'vales') return pintarVales();
    const tr = trabajosDe(), va = valesDe();
    let h = '';
    const vp = ficha.vale_pendiente;
    if(vp) h += `<div class="nm-vp"><span class="nm-tx"><b>Pidió vale ${esc(dinero(vp.monto))}</b><span>${vp.nota ? esc(vp.nota) + ' · ' : ''}${esc(cuando(vp.fecha))}</span></span><button type="button" class="tl-btn-sm" data-revisar-vale>Revisar</button></div>`;
    if(!tr.length && !va.length) h += '<p class="tl-nota">No tiene trabajos terminados por pagar.</p>';
    h += tr.map(it => filaTrabajo(it, ficha.puede_pagar)).join('');
    h += va.map(v => filaVale(v, ficha.puede_pagar, 'aprobado · se descuenta')).join('');
    const sinMonto = tr.filter(x => !pagable(x)).length;
    if(sinMonto) h += `<p class="aviso-m">${sinMonto === 1 ? '1 trabajo no tiene monto' : sinMonto + ' trabajos no tienen monto'}: tócalo para ponérselo. Mientras, no se puede pagar.</p>`;
    if(haciendo.length){
      h += '<p class="nm-tit">Haciendo ahora (se suma cuando termine)</p>' + haciendo.map(e => `<div class="nm-it"><span class="nm-reloj" aria-hidden="true"></span>
        <span class="nm-tx"><b>${esc(e.nombre)} · ${esc(e.item ? e.item.nombre : '')}</b><span>desde ${esc(cuando(e.iniciada_en))}${e.item ? ' · N° ' + esc(e.item.venta_id) : ''}</span></span></div>`).join('');
    }
    $('trabBody').innerHTML = h;
    // Pie: lo marcado y Pagar (solo quien le paga a este trabajador)
    if(!ficha.puede_pagar){
      $('trabFoot').innerHTML = `<p class="solo-ray">A ${esc(primerNombre(t.nombre))} le paga ${(t.especialidades || []).includes('carpintero') ? 'quien lleva la madera' : 'Ray'}.</p>`;
      return;
    }
    const n = s.tr.length;
    const resumenTxt = [n ? `${plural(n, '1 trabajo', 'trabajos')} ${dinero(s.tt)}` : '', s.va.length ? `${s.va.length === 1 ? 'vale' : s.va.length + ' vales'} −${dinero(s.tv)}` : ''].filter(Boolean).join(' · ') || 'Nada marcado';
    const puede = (n || s.va.length) && s.neto >= 0;
    $('trabFoot').innerHTML = `<div class="nm-tot"><span>${esc(resumenTxt)}</span><b>${esc(centimos(s.neto))}</b></div>
      <button class="btn-primary nm-teal" type="button" id="btnPagar" ${puede ? '' : 'disabled'}>${puede ? `Pagar ${esc(dinero(s.neto))} a ${esc(primerNombre(t.nombre))}` : s.neto < 0 ? 'Los vales son más que lo marcado' : 'Marca lo que vas a pagar'}</button>
      <p class="nm-nota">Lo que desmarques pasa a la semana siguiente con ↩.</p>`;
  }
  function pintarVales(){
    const t = ficha.trabajador;
    const vp = ficha.vale_pendiente, va = valesDe();
    const pagados = (ficha.pagos || []).flatMap(p => (p.vales || []).map(v => Object.assign({}, v, { pagadoEn: p.pagado_en }))).slice(0, 6);
    let h = '';
    if(vp) h += `<div class="nm-vp"><span class="nm-tx"><b>Pidió vale ${esc(dinero(vp.monto))}</b><span>${vp.nota ? esc(vp.nota) + ' · ' : ''}${esc(cuando(vp.fecha))}</span></span><button type="button" class="tl-btn-sm" data-revisar-vale>Revisar</button></div>`;
    h += va.map(v => filaVale(v, false, 'aprobado · se descuenta en el próximo pago')).join('');
    if(pagados.length) h += '<p class="nm-tit">Ya descontados</p>' + pagados.map(v => filaVale(v, false, 'descontado el ' + corto(diaDe(v.pagadoEn), true))).join('');
    if(!h) h = '<p class="tl-nota">No tiene vales.</p>';
    $('trabBody').innerHTML = h;
    $('trabFoot').innerHTML = ficha.puede_pagar ? '<button class="btn-secondary" type="button" id="btnAnotarVale" style="width:100%">Anotar un vale</button>'
      : `<p class="solo-ray">Los vales de ${esc(primerNombre(t.nombre))} los anota quien le paga.</p>`;
  }
  let cuentasPago = {};
  async function pintarHistorial(){
    const pagos = ficha.pagos || [];
    $('trabFoot').innerHTML = '';
    if(!pagos.length){ $('trabBody').innerHTML = '<p class="tl-nota">Todavía no tiene pagos registrados.</p>'; return; }
    const faltan = pagos.filter(p => !(p.id in cuentasPago)).map(p => p.id);
    if(faltan.length){
      try{
        const { data, error } = await db.from('movimientos').select('pago_id,por_ubicar,cuenta:cuentas(nombre)').in('pago_id', faltan);
        if(!error) (data || []).forEach(m => { cuentasPago[m.pago_id] = m.cuenta && !m.por_ubicar ? m.cuenta.nombre : 'Cuenta por ubicar'; });
      } catch(e){}
      faltan.forEach(id => { if(!(id in cuentasPago)) cuentasPago[id] = ''; });
      if(tab !== 'historial') return;
    }
    $('trabBody').innerHTML = pagos.map((p, i) => {
      const n = (p.trabajos || []).length;
      const sub = [cuentasPago[p.id], p.pagado_por ? 'pagó ' + p.pagado_por : '', plural(n, '1 trabajo', 'trabajos'), Number(p.vales_monto) ? 'vale −' + dinero(p.vales_monto) : ''].filter(Boolean).join(' · ');
      return `<details class="nm-rec" ${i === 0 ? 'open' : ''}><summary><span class="nm-tx"><b>${esc(mayus(corto(diaDe(p.pagado_en), true)))}</b><span>${esc(sub)}</span></span><b class="nm-rm">${esc(centimos(p.monto))}</b></summary>
        <div class="nm-rec-b">${(p.trabajos || []).map(it => filaTrabajo(it, false)).join('')}${(p.vales || []).map(v => filaVale(v, false, 'descontado')).join('')}</div></details>`;
    }).join('') + '<p class="tl-nota">Los pagos hechos no se cambian.</p>';
  }
  $('trabTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if(!b || b.dataset.tab === tab || !ficha) return;
    tab = b.dataset.tab; pintarFicha();
  });
  $('trabBody').addEventListener('click', (e) => {
    if(e.target.closest('a')) return;
    if(e.target.closest('[data-revisar-vale]')){ abrirValeRev(); return; }
    const ce = e.target.closest('[data-ck-e]');
    if(ce){ if(ce.disabled) return; const id = Number(ce.dataset.ckE); marcados.e.has(id) ? marcados.e.delete(id) : marcados.e.add(id); pintarFicha(); return; }
    const cv = e.target.closest('[data-ck-v]');
    if(cv){ const id = Number(cv.dataset.ckV); marcados.v.has(id) ? marcados.v.delete(id) : marcados.v.add(id); pintarFicha(); return; }
    const b = e.target.closest('[data-item]'); if(!b || !ficha) return;
    const id = Number(b.dataset.item);
    const it = [...trabajosDe(), ...(ficha.pagos || []).flatMap(p => p.trabajos || [])].find(x => x.id === id);
    if(it) abrirItem(it);
  });
  $('trabFoot').addEventListener('click', (e) => {
    if(e.target.closest('#btnAnotarVale')){ abrirVale(ficha && ficha.trabajador); return; }
    const b = e.target.closest('#btnPagar');
    if(b && !b.disabled) abrirPago();
  });

  // ---------- Revisar el vale que pidió (T6) ----------
  let resolviendo = false;
  function abrirValeRev(){
    const vp = ficha && ficha.vale_pendiente; if(!vp) return;
    const t = ficha.trabajador;
    const debe = r2(suma(trabajosDe().filter(pagable)) - suma(valesDe()));
    $('valeRevTitulo').textContent = 'Vale de ' + t.nombre;
    $('valeRevSub').textContent = 'Lo pidió ' + cuando(vp.fecha);
    $('valeRevBody').innerHTML = `<div class="tl-kv2"><div><span>Pide</span><b>${esc(centimos(vp.monto))}</b></div><div><span>Por pagarle hoy</span><b>${esc(centimos(debe))}</b></div></div>
      ${vp.nota ? `<div class="nm-motivo"><span>Motivo</span><b>${esc(vp.nota)}</b></div>` : ''}
      <p class="nm-nota" style="text-align:left">Si lo apruebas, se descuenta cuando le pagues: quedarían ${esc(dinero(debe - Number(vp.monto)))}.</p>`;
    $('valeRevFoot').innerHTML = ficha.puede_pagar
      ? `<button class="btn-primary nm-teal" type="button" data-resolver="si">Aprobar vale ${esc(dinero(vp.monto))}</button><button class="btn-secondary nm-no" type="button" data-resolver="no">No aprobar</button>`
      : `<p class="solo-ray">Lo decide quien le paga a ${esc(primerNombre(t.nombre))}.</p>`;
    abrirHoja('sheetValeRev');
  }
  $('valeRevFoot').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-resolver]'); if(!b || resolviendo || !ficha || !ficha.vale_pendiente) return;
    const aprobar = b.dataset.resolver === 'si';
    const t = ficha.trabajador, vid = Number(ficha.vale_pendiente.id);
    resolviendo = true;
    $('valeRevFoot').querySelectorAll('button').forEach(x => { x.disabled = true; });
    try{
      const { error } = await db.rpc('resolver_vale', { vid, aprobar });
      if(error) throw error;
      cerrarHoja('sheetValeRev', true);
      toast(aprobar ? `Vale aprobado. Se descuenta cuando le pagues a ${primerNombre(t.nombre)}.` : 'Vale no aprobado. Le avisamos.');
      await Promise.all([abrirTrabajador(t.id), cargar()]);
      avisarCambio();
      if(aprobar) ubicarSalida('vale_salida', { vid, p: {} }, null, `Vale de ${t.nombre}.`);
    } catch(err){
      toast(mensaje(err), 'error');
      $('valeRevFoot').querySelectorAll('button').forEach(x => { x.disabled = false; });
    } finally { resolviendo = false; }
  });

  // ---------- Un trabajo: de qué cliente y pedido es; sin monto lleva a arreglarlo ----------
  let categorias = null, itemAbierto = null, asignando = false;
  function atajoMontoHtml(it){
    if(it.monto != null || window.AH.notaPago(it.oficio, it.monto) || it.pago_id) return '';
    const link = (href, t) => `<a class="btn-primary atajo-btn" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${href}">${t}</a>`;
    if(it.categoria_id) return `<div class="aviso-falta" style="margin:14px 0 0">A la categoría ${esc(it.categoria || '')} le falta la tarifa de este paso.
      ${link('categorias-pago.html?editar=' + encodeURIComponent(it.categoria_id), 'Poner la tarifa')}</div>`;
    let cuerpo;
    if(categorias === 'error') cuerpo = '<button class="btn-secondary atajo-btn" type="button" data-reintentar-cat style="width:100%">No se pudieron cargar. Reintentar</button>';
    else if(categorias === null) cuerpo = '<span class="atajo-t" style="margin-top:8px;font-weight:600">Cargando categorías…</span>';
    else if(!categorias.some(c => window.AH.categoriaSirve(c, it.tipo))) cuerpo = link('categorias-pago.html?nueva=1', 'Crear una categoría');
    else cuerpo = `<div class="atajo-caja"><span class="atajo-t">Elige su categoría. Se calcula el monto enseguida.</span>
      <div class="opts" style="--cols:2;margin-top:8px">${categorias.filter(c => window.AH.categoriaSirve(c, it.tipo)).map(c => `<button type="button" class="opt" data-cat-item="${esc(it.venta_item_id)}" data-trabajo="${esc(it.id)}" data-cid="${c.id}">${esc(c.nombre)}</button>`).join('')}</div></div>`;
    return `<div class="aviso-falta" style="margin:14px 0 0">Este producto no tiene categoría de pago: por eso no tiene monto.${cuerpo}</div>`;
  }
  async function cargarCategorias(it){
    try{
      const { data, error } = await db.from('categorias_pago').select('id,nombre,producto').order('id');
      if(error) throw error;
      categorias = data || [];
    } catch(e){ categorias = 'error'; toast(mensaje(e), 'error'); }
    if($('sheetItem').classList.contains('open') && itemAbierto === it) abrirItem(it, true);
  }
  function abrirItem(it, repintar){
    itemAbierto = it;
    if(it.monto == null && !window.AH.notaPago(it.oficio, it.monto) && !it.pago_id && !it.categoria_id && (categorias === null || categorias === 'error') && !repintar){ categorias = null; cargarCategorias(it); }
    const e = it.especificaciones || {};
    const specs = resumenSpecs(it.tipo, e);
    const otro = etiquetaOtroColor({ otroColor: !!(it.foto && it.foto_de && e.color && it.foto_de !== e.color), de: it.foto_de, color: e.color }, it.tipo);
    $('itemBody').innerHTML = `
      <div ${heroAttrs(it.foto)}>${it.foto ? `<img src="${esc(it.foto)}" alt="${esc(it.producto)}">` : iconoTipo(it.tipo, 56)}${otro ? `<span class="foto-otra">${esc(otro)}</span>` : ''}</div>
      <div class="d-parte">${esc(it.etapa)} · terminó ${esc(cuando(it.fecha))}</div>
      <div class="det-name" style="margin-top:10px">${nombreTrabajo(it)}</div>
      <div class="det-type">${esc([it.tipo, e.color].filter(Boolean).join(' · '))}</div>
      ${atajoMontoHtml(it)}
      <div class="d-datos">
        <div class="d-dato"><span>${it.interna ? 'Para' : 'Cliente'}</span><b>${esc(it.interna ? 'Exhibición' : (it.cliente || ''))}</b></div>
        <div class="d-dato"><span>${it.interna ? 'Sede' : 'Pedido'}</span><b>${esc(it.interna ? (it.sede || '') : 'N° ' + it.venta_id)}</b></div>
        <div class="d-dato"><span>Pago por esta parte</span><b>${window.AH.notaPago(it.oficio, it.monto) ? esc(window.AH.notaPago(it.oficio, it.monto)) : it.monto == null ? 'Por definir' : esc(dinero(it.monto))}</b></div>
        <div class="d-dato"><span>Categoría</span><b>${esc(it.categoria || 'Sin categoría')}</b></div>
      </div>
      ${specs.length ? `<div class="det-section"><div class="det-label">Especificaciones</div><div class="spec-chips">${specChipsHtml(specs)}</div></div>` : ''}
      ${it.foto_trabajo ? `<div class="d-suya"><button type="button" data-ver-foto="${esc(it.foto_trabajo)}" aria-label="Ver foto">${window.AH.imgMini(it.foto_trabajo)}</button>Foto que subió al terminar. Tócala para verla grande.</div>` : ''}
      ${it.interna ? '' : `<a class="d-link" href="ventas.html?abrir=${encodeURIComponent(it.venta_id)}" data-sub>Ver la venta N° ${esc(it.venta_id)}</a>`}`;
    if(!repintar){ $('itemBody').scrollTop = 0; abrirHoja('sheetItem'); }
  }
  $('itemBody').addEventListener('click', async (e) => {
    if(e.target.closest('[data-reintentar-cat]') && itemAbierto){ categorias = null; abrirItem(itemAbierto, true); cargarCategorias(itemAbierto); return; }
    const c = e.target.closest('[data-cat-item]');
    if(c && !asignando && ficha){
      asignando = true;
      c.closest('.opts').querySelectorAll('button').forEach(x => { x.disabled = true; });
      try{
        const { error } = await db.rpc('asignar_categoria_item', { iid: Number(c.dataset.catItem), cid: Number(c.dataset.cid) });
        if(error) throw error;
        cerrarHoja('sheetItem', true);
        const idTrab = Number(c.dataset.trabajo);
        marcados = null;
        await Promise.all([abrirTrabajador(ficha.trabajador.id), cargar()]);
        const nuevo = ficha && trabajosDe().find(x => x.id === idTrab);
        toast(nuevo && nuevo.monto == null ? 'Categoría puesta. A esa categoría le falta la tarifa de este paso: tócalo otra vez para ponerla.' : 'Categoría puesta. Ya tiene su monto.');
      } catch(err){ toast(mensaje(err), 'error'); c.closest('.opts').querySelectorAll('button').forEach(x => { x.disabled = false; }); }
      finally { asignando = false; }
      return;
    }
    const b = e.target.closest('[data-ver-foto]');
    if(b) verFoto(b.dataset.verFoto);
  });

  // ---------- Anotar un vale (desde la lista elige a quién) ----------
  let enBs = false, guardandoVale = false, valeTid = null;
  function abrirVale(t){
    ['valeMonto', 'valeNota', 'valeBs', 'valeTasa'].forEach(id => { $(id).value = ''; });
    $('campoValeMonto').classList.remove('invalid');
    $('campoValeQuien').classList.remove('invalid');
    enBs = false; pintarBs();
    valeTid = t ? t.id : null;
    const lista = ((resumen && resumen.trabajadores) || []).filter(seVe);
    $('campoValeQuien').classList.toggle('hidden', !!t);
    $('valeQuien').innerHTML = lista.map(x => `<button type="button" class="opt" data-vale-quien="${esc(x.id)}">${esc(x.nombre)}</button>`).join('');
    $('valeTitulo').textContent = t ? 'Vale para ' + primerNombre(t.nombre) : 'Anotar un vale';
    abrirHoja('sheetVale');
  }
  $('valeQuien').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vale-quien]'); if(!b) return;
    valeTid = b.dataset.valeQuien;
    $('valeQuien').querySelectorAll('.opt').forEach(x => x.classList.toggle('selected', x === b));
    $('campoValeQuien').classList.remove('invalid');
  });
  function pintarBs(){
    $('btnValeBs').classList.toggle('on', enBs);
    $('btnValeBs').setAttribute('aria-pressed', String(enBs));
    $('cajaBs').classList.toggle('hidden', !enBs);
    $('valeAyuda').textContent = enBs ? 'Escribe los bolívares y la tasa: el monto en dólares se calcula solo (puedes cambiarlo).' : 'Queda aprobado y se descuenta en su próximo pago.';
  }
  $('btnValeBs').addEventListener('click', () => { enBs = !enBs; pintarBs(); });
  function calcularDolares(){
    const bs = montoOrNull($('valeBs').value), tasa = montoOrNull($('valeTasa').value);
    if(bs > 0 && tasa > 0){ $('valeMonto').value = String(Math.round(bs / tasa * 100) / 100); $('campoValeMonto').classList.remove('invalid'); }
  }
  $('valeBs').addEventListener('input', calcularDolares);
  $('valeTasa').addEventListener('input', calcularDolares);
  $('valeMonto').addEventListener('input', () => $('campoValeMonto').classList.remove('invalid'));
  $('btnGuardarVale').addEventListener('click', async () => {
    if(guardandoVale) return;
    if(!valeTid){ $('campoValeQuien').classList.add('invalid'); return; }
    const monto = montoOrNull($('valeMonto').value);
    if(!(monto > 0)){ $('campoValeMonto').classList.add('invalid'); $('valeMonto').focus(); return; }
    const bs = enBs ? montoOrNull($('valeBs').value) : null;
    const tasa = enBs ? montoOrNull($('valeTasa').value) : null;
    const btn = $('btnGuardarVale');
    guardandoVale = true; btn.disabled = true;
    const tid = valeTid;
    const nom = (((resumen && resumen.trabajadores) || []).find(x => x.id === tid) || (ficha && ficha.trabajador) || {}).nombre || '';
    try{
      const { data, error } = await db.rpc('anotar_vale', { tid, p_monto: monto, p_nota: $('valeNota').value.trim() || null, p_bs: bs > 0 ? bs : null, p_tasa: tasa > 0 ? tasa : null });
      if(error) throw error;
      cerrarHoja('sheetVale', true);
      toast('Vale anotado. Se descuenta en su próximo pago.');
      marcados = null;
      await Promise.all([ficha && ficha.trabajador.id === tid && $('sheetTrab').classList.contains('open') ? abrirTrabajador(tid) : null, cargar()]);
      avisarCambio();
      if(data && data.id) ubicarSalida('vale_salida', { vid: data.id, p: {} }, monto, `Vale de ${nom}: ${dinero(monto)}.`);
    } catch(err){ toast(mensaje(err), 'error'); }
    finally { guardandoVale = false; btn.disabled = false; }
  });

  // ---------- Pagar (T5): de qué cuenta sale y Confirmar pago ----------
  // También sirve, después de un vale, para decir de qué cuenta salió (queda en Finanzas).
  let CUENTAS = null, SAL = null, pagando = false;
  async function cuentasActivas(){
    if(CUENTAS) return CUENTAS;
    const { data, error } = await db.from('cuentas').select('id,nombre,tipo,moneda,orden').eq('activa', true).order('orden');
    if(error) throw error;
    CUENTAS = data || []; return CUENTAS;
  }
  async function abrirPago(){
    const s = seleccion();
    const t = ficha.trabajador;
    let cs = [];
    try{ cs = await cuentasActivas(); } catch(e){ cs = []; }
    SAL = { modo:'pago', tid: t.id, nombre: t.nombre, etapas: s.tr.map(x => x.id), vales: s.va.map(x => x.id), neto: s.neto,
      sub: [s.tr.length ? `${plural(s.tr.length, '1 trabajo', 'trabajos')} ${dinero(s.tt)}` : '', s.va.length ? `${s.va.length === 1 ? 'vale' : s.va.length + ' vales'} −${dinero(s.tv)}` : ''].filter(Boolean).join(' · '),
      cuentas: cs, cuenta:null, origen:null, mas:false, guardando:false };
    pintarSal(); abrirHoja('sheetSalida');
  }
  async function ubicarSalida(fn, args, monto, texto){
    let mid = null;
    try{ const { data, error } = await db.rpc(fn, args); if(error) throw error; mid = data && data.id; }
    catch(e){ toast('Quedó guardado. No se pudo anotar en Finanzas: ' + mensaje(e), 'error'); return; }
    if(!mid) return;
    let cs = [];
    try{ cs = await cuentasActivas(); } catch(e){ cs = []; }
    if(!cs.length){ toast('Queda por ubicar en Finanzas: agrega tus cuentas allí.'); return; }
    SAL = { modo:'ubicar', mid, monto, texto, cuentas: cs, cuenta:null, origen:null, mas:false, guardando:false };
    pintarSal(); abrirHoja('sheetSalida');
  }
  function pintarSal(){
    const cs = SAL.cuentas || [];
    const c = SAL.cuenta ? cs.find(x => x.id === SAL.cuenta) : null, ves = c && c.moneda === 'VES';
    const pago = SAL.modo === 'pago';
    $('salTitulo').textContent = pago ? `Pagar ${dinero(SAL.neto)} a ${primerNombre(SAL.nombre)}` : '¿De qué cuenta salió?';
    $('salSub').textContent = pago ? SAL.sub : '';
    const opt = (lista, val, attr, cols) => `<div class="opts" style="--cols:${cols}">${lista.map(([v, t]) => `<button class="opt ${String(val) === String(v) ? 'selected' : ''}" type="button" ${attr}="${esc(v)}">${t}</button>`).join('')}</div>`;
    const cuentasHtml = cs.length
      ? `<div class="field"><span class="field-label">¿De qué cuenta salió?</span><div class="nm-cuentas" role="radiogroup">${cs.map(x => `<button type="button" class="nm-cta ${SAL.cuenta === x.id ? 'on' : ''}" role="radio" aria-checked="${SAL.cuenta === x.id}" data-sal-cuenta="${x.id}"><span class="nm-rad"></span><span class="nm-tx"><b>${esc(x.nombre)}</b><span>${x.moneda === 'VES' ? 'pide la tasa del día' : esc(x.moneda === 'USD' || !x.moneda ? 'en dólares' : x.moneda)}</span></span></button>`).join('')}</div></div>`
      : '<p class="aviso-m">No hay cuentas en Finanzas: el pago queda "por ubicar" allí.</p>';
    $('salBody').innerHTML = (pago ? '' : `<p class="field-hint" style="margin:0 2px 12px;font-size:14px">${esc(SAL.texto)} Si cierras, queda "por ubicar" en Finanzas.</p>`)
      + cuentasHtml
      + (ves ? `<div class="input-row"><div class="field"><label class="field-label" for="salBs">Bolívares que salieron</label><input class="input" id="salBs" inputmode="decimal"></div><div class="field"><label class="field-label" for="salTasa">Tasa</label><input class="input" id="salTasa" inputmode="decimal"></div></div>
          <div class="field"><span class="field-label">¿De dónde es la tasa?</span>${opt([['BCV', 'BCV'], ['Binance', 'Binance'], ['Otra', 'Otra']], SAL.origen, 'data-sal-origen', 3)}</div>`
        : c ? `<button type="button" class="link-btn" data-sal-mas style="font-size:13px;font-weight:800;color:var(--accent)">${SAL.mas ? 'Salió lo mismo' : '¿Salió más de la cuenta? (comisión o cambio)'}</button>
          ${SAL.mas ? `<div class="field" style="margin-top:8px"><label class="field-label" for="salMonto">Salió de la cuenta</label><div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="salMonto" inputmode="decimal"></div></div>` : ''}` : '')
      + (pago ? `<div class="field" style="margin-top:12px"><span class="field-label">Monto</span><div class="nm-montofijo">${esc(centimos(SAL.neto))}</div></div>` : '');
    $('btnSalida').textContent = pago ? 'Confirmar pago' : 'Guardar';
    $('btnSalida').classList.toggle('nm-teal', pago);
    $('salNota').textContent = pago ? `${primerNombre(SAL.nombre)} recibe un aviso. Sale en Finanzas como nómina.` : '';
  }
  $('salBody').addEventListener('click', (e) => {
    if(!SAL) return;
    const keep = () => ({ bs: $('salBs') ? $('salBs').value : '', ta: $('salTasa') ? $('salTasa').value : '' });
    const c = e.target.closest('[data-sal-cuenta]'); if(c){ SAL.cuenta = Number(c.dataset.salCuenta); SAL.mas = false; pintarSal(); return; }
    const o = e.target.closest('[data-sal-origen]'); if(o){ const k = keep(); SAL.origen = o.dataset.salOrigen; pintarSal(); $('salBs').value = k.bs; $('salTasa').value = k.ta; return; }
    if(e.target.closest('[data-sal-mas]')){ SAL.mas = !SAL.mas; pintarSal(); }
  });
  // Lo que se le dice a Finanzas de la cuenta (null si falta algo)
  function datosCuenta(){
    if(!SAL.cuenta) return null;
    const c = SAL.cuentas.find(x => x.id === SAL.cuenta), p = { cuenta_id: SAL.cuenta };
    if(c.moneda === 'VES'){
      const bs = montoOrNull($('salBs').value), ta = montoOrNull($('salTasa').value);
      if(!(bs > 0) || !(ta > 0)){ toast('Escribe los bolívares y la tasa', 'error'); return false; }
      if(!SAL.origen){ toast('Elige de dónde es la tasa', 'error'); return false; }
      Object.assign(p, { monto_bs: bs, tasa: ta, tasa_origen: SAL.origen });
    } else if(SAL.mas){
      const m = montoOrNull($('salMonto').value);
      if(!(m > 0)){ toast('Escribe lo que salió de la cuenta', 'error'); return false; }
      p.monto_salio = m;
    }
    return p;
  }
  $('btnSalida').addEventListener('click', async () => {
    if(!SAL || SAL.guardando) return;
    if(SAL.cuentas.length && !SAL.cuenta){ toast('Elige de qué cuenta salió', 'error'); return; }
    const p = datosCuenta();
    if(p === false) return;
    const nombreCuenta = p ? (SAL.cuentas.find(x => x.id === SAL.cuenta) || {}).nombre : '';
    SAL.guardando = true; $('btnSalida').disabled = true;
    try{
      if(SAL.modo === 'pago'){
        pagando = true;
        const { data, error } = await db.rpc('pagar_lo_marcado', { tid: SAL.tid, esperado: SAL.neto, p_etapas: SAL.etapas, p_vales: SAL.vales });
        if(error) throw error;
        // El pago ya quedó. La cuenta se anota aparte: si falla, queda "por ubicar" en Finanzas.
        const tid = SAL.tid, nombre = SAL.nombre;
        cerrarHoja('sheetSalida', true); SAL = null;
        let enCuenta = false;
        if(data && data.id){
          try{
            const r = await db.rpc('nomina_salida', { pid: data.id, p: {} });
            if(r.error) throw r.error;
            if(p && r.data && r.data.id){ const u = await db.rpc('movimiento_ubicar', { mid: r.data.id, p }); if(u.error) throw u.error; enCuenta = true; }
          } catch(e){ toast(`Pagado. No se pudo anotar la cuenta: queda por ubicar en Finanzas.`, 'error'); }
        }
        if(enCuenta || !p) toast(`Pagado. Le avisamos a ${primerNombre(nombre)}.` + (enCuenta ? ` Salió de ${nombreCuenta}.` : ''));
        marcados = null;
        await Promise.all([abrirTrabajador(tid, 'historial'), cargar()]);
        avisarCambio();
        return;
      }
      if(!p){ toast('Elige la cuenta', 'error'); return; }
      const { error } = await db.rpc('movimiento_ubicar', { mid: SAL.mid, p });
      if(error) throw error;
      cerrarHoja('sheetSalida', true); toast('Listo: quedó en ' + nombreCuenta); SAL = null;
    } catch(err){
      toast(mensaje(err), 'error');
      if(SAL && SAL.modo === 'pago' && ficha){ marcados = null; await abrirTrabajador(ficha.trabajador.id).catch(() => {}); }
    } finally { pagando = false; if(SAL) SAL.guardando = false; $('btnSalida').disabled = false; }
  });

  // ---------- Historial de todos los pagos ----------
  async function abrirHistGeneral(){
    $('histBody').innerHTML = '<div class="tl-sk" style="height:80px"></div>';
    abrirHoja('sheetHist');
    try{
      const { data, error } = await db.from('pagos_trabajador').select('id,trabajador_id,monto,pagado_en,pagado_por').order('pagado_en', { ascending:false }).limit(40);
      if(error) throw error;
      const ids = [...new Set((data || []).flatMap(p => [p.trabajador_id, p.pagado_por]).filter(Boolean))];
      let nombres = {};
      if(ids.length){ const r = await db.from('perfiles').select('id,nombre,especialidades').in('id', ids); (r.data || []).forEach(x => { nombres[x.id] = x; }); }
      const l = (data || []).filter(p => seVe(nombres[p.trabajador_id] || {}));
      $('histBody').innerHTML = l.length ? l.map(p => `<button type="button" class="nm-row" data-hist-trab="${esc(p.trabajador_id)}"><span class="nm-av">${esc(iniciales((nombres[p.trabajador_id] || {}).nombre))}</span>
        <span class="nm-tx"><b>${esc((nombres[p.trabajador_id] || {}).nombre || 'Trabajador')}</b><span>${esc(mayus(corto(diaDe(p.pagado_en), true)))}${p.pagado_por && nombres[p.pagado_por] ? ' · pagó ' + esc(nombres[p.pagado_por].nombre) : ''}</span></span>
        <span class="nm-m">${esc(centimos(p.monto))} ›</span></button>`).join('') + '<p class="tl-nota">Los pagos hechos no se cambian.</p>'
        : '<p class="tl-nota">Todavía no hay pagos registrados.</p>';
    } catch(e){ $('histBody').innerHTML = '<p class="tl-nota">No se pudo cargar. Revisa la conexión.</p>'; toast(mensaje(e), 'error'); }
  }
  $('histBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hist-trab]'); if(!b) return;
    cerrarHoja('sheetHist');
    abrirTrabajador(b.dataset.histTrab, 'historial');
  });

  // El Taller vuelve a leer su Resumen cuando aquí cambia algo de dinero
  function avisarCambio(){ if(window.Taller && window.Taller.refrescarResumen) window.Taller.refrescarResumen(); }

  window.Nomina = {
    iniciar(op){ llevaMadera = !!(op && op.llevaMadera); },
    seVe,
    mostrar(){ if(!cargado) cargar(); },
    recargar: cargar,
    abrir(tid, que){
      if(!tid || !/^[\w-]{1,64}$/.test(tid)) return;
      if(que === 'vale') abrirTrabajador(tid).then(() => { if(ficha && ficha.vale_pendiente && ficha.trabajador.id === tid) abrirValeRev(); });
      else abrirTrabajador(tid);
    }
  };
})();
