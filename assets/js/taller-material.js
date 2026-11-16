// Taller › Corte › Material (lote 6, maquetas K09 y K11 a K18). Solo Ray y Gualfredo.
// Material: lo que viene en camino (amarillo, con ¿Llegó? y ⋯), una tabla Material · Hay · Apartado · Libre ·
// Falta (apartado = lo que usan los planes abiertos de este sábado y el próximo), los retazos con su número y ✕,
// Proveedores, y abajo un solo Comprar, + Retazo encontrado y Contar barras.
// Comprar y ¿Llegó? son las hojas de compra.js. Después de pedir (aquí o al enviar un corte) se abre el mensaje
// para el proveedor, ya escrito, para mandarlo por WhatsApp. También: barra dañada (K09, corte_barra_danada).
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, sabados } = window.AH;
  const $ = (id) => document.getElementById(id);
  const plural = (n, uno, varios) => n === 1 ? uno : n + ' ' + varios;
  const num = (n) => Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits:2 });
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const iniciales = (n) => { const p = String(n || '?').trim().split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase(); };
  const errTxt = (e) => { const m = String((e && e.message) || ''); return /fetch|network|Failed/i.test(m) ? 'Sin señal. Revisa la conexión y vuelve a intentarlo.' : (m || 'No se pudo guardar'); };
  const corto = (n) => String(n || '').replace('Inversiones ', '').replace(' (ferretería y otros)', '');
  const CP = () => window.COMPRA, X = () => window.COSTEO.datos(), K = () => window.CORTE;
  const fabDe = (mid) => (X().fab || []).find(f => String(f.id) === String(mid));
  const telTxt = (t) => { const d = String(t || '').replace(/\D/g, ''); const l = d.startsWith('58') ? '0' + d.slice(2) : d; return l.length === 11 ? l.slice(0, 4) + '-' + l.slice(4, 7) + '-' + l.slice(7) : l; };
  const TIPOS = [['hierro','Hierro'], ['laminas','Láminas'], ['vidrio','Vidrio'], ['aluminio','Aluminio'], ['pintura','Pintura'], ['accesorios','Accesorios']];
  let yo = '', ocupado = false;
  if(window.Sesion && window.Sesion.perfil) window.Sesion.perfil().then(p => { yo = primerNombre(p && p.nombre); }).catch(() => {});

  // ---------- Cuentas de cada material ----------
  function filas(){
    const S = sabados(), usa = {}, C = K(), volver = window.TallerCorte ? window.TallerCorte.sab : S.este;
    try{
      [S.este, S.proximo].forEach(s => { C.setSab(s); const P = C.planSemana(s);
        P.compras.forEach(m => { usa[m.f.id] = (usa[m.f.id] || 0) + m.barras; });
        P.hj.filter(x => !x.vidrio).forEach(x => { usa[x.f.id] = (usa[x.f.id] || 0) + (x.acom || []).length; }); });
    } finally { C.setSab(volver); }
    return (X().fab || []).filter(f => f.activo !== false && (f.tipo === 'hierro' || f.tipo === 'laminas')).map(f => {
      const hay = Number(f.stock) || 0, u = usa[f.id] || 0, apartado = Math.min(u, hay), camino = CP() && CP().datos ? CP().enCamino(f.id) : 0;
      const esp = Object.values(f.precios || {}).filter(p => p && p.esp).sort((a, b) => a.p - b.p)[0];
      return { f, hay, usa:u, apartado, libre:hay - apartado, camino, falta:Math.max(0, u - hay - camino), esp:esp ? esp.esp : '', hoja:f.pres === 'hoja' };
    });
  }
  // Lo que está en camino, un renglón por proveedor de cada compra
  function enCamino(){
    const E = CP() && CP().datos; if(!E) return [];
    const out = []; (E.grupos || []).forEach(g => (g.lugares || []).forEach(l => out.push(Object.assign({ grupo:g.grupo, fecha:g.fecha }, l))));
    return out;
  }
  const lugarDe = (pid) => enCamino().find(l => String(l.id) === String(pid));
  const provDe = (id) => ((CP().datos || {}).proveedores || []).find(p => String(p.id) === String(id)) || { nombre:'Proveedor', saldo:0 };

  // ---------- Material (K11) ----------
  function pintar(cont, arriba){
    let F;
    try{ F = filas(); } catch(e){ cont.innerHTML = arriba + '<div class="vacio"><h3>No se pudo armar el material</h3><p>' + esc(errTxt(e)) + '</p></div>'; return; }
    const L = enCamino(), provs = (CP().datos || {}).proveedores || [], debes = -provs.filter(p => p.saldo < 0).reduce((a, p) => a + Number(p.saldo), 0);
    let h = arriba;
    h += L.map(l => `<div class="mt-camino"><div class="mt-cam-t"><b>En camino · ${esc(corto(l.proveedor))}</b><span>${esc(CP().resumenGrupo({ lugares:[l] }))} · ${dinero(l.total)}${l.herrero ? ' · para ' + esc(primerNombre(l.herrero)) : ''}</span></div>
      <button class="tl-btn-sm mt-amb" type="button" data-compra-llego="${esc(l.grupo)}">¿Llegó?</button><button class="mt-dots" type="button" data-mt-cm="${esc(l.id)}" aria-label="Más de esta compra">⋯</button></div>`).join('');
    h += `<div class="mt-tabla" role="table" aria-label="Material del taller"><div class="mt-fila mt-cab" role="row"><span>Material</span><span>Hay</span><span>Apartado</span><span>Libre</span><span>Falta</span></div>
      ${F.map(r => { const sub = [r.esp ? String(r.esp).replace(/\s*mm$/, '') : '', r.hoja ? 'hojas' : 'barras', r.camino ? r.camino + ' en camino' : '', r.usa && !r.falta && r.libre === 0 && !r.camino ? 'quedas en 0' : ''].filter(Boolean).join(' · ');
        const rets = r.hoja ? [] : (r.f.retazos || []);
        return `<div class="mt-fila" role="row"><span class="mt-nom"><b>${esc(r.f.nombre)}</b><small>${esc(sub)}</small></span><span>${r.hay}</span><span>${r.apartado}</span><span>${r.libre}</span><span class="${r.falta ? 'mt-rojo' : 'mt-gris'}">${r.falta || '·'}</span></div>
          ${rets.length ? `<div class="mt-rets">${rets.map(t => `<span class="mt-ret">R-${esc(t.num || t.id)} · ${num(Number(t.largo) / 100)} m<button type="button" data-mt-retq="${esc(t.id)}" aria-label="Ya no está el retazo R-${esc(t.num || t.id)}">✕</button></span>`).join('')}</div>` : ''}`; }).join('') || '<p class="tl-nota">No hay material de hierro ni láminas. Agrégalo en el Costeador.</p>'}</div>`;
    h += `<button class="nm-row mt-provs" type="button" data-mt-provs><span class="nm-av">PR</span><span class="nm-tx"><b>Proveedores</b><span>${debes > 0.005 ? 'le debes ' + dinero(debes) : 'al día'}${L.length ? ' · ' + plural(L.length, '1 compra en camino', 'compras en camino') : ''}</span></span><span class="nm-m">Ver ›</span></button>`;
    h += `<div class="mt-pie"><button class="btn-primary nm-teal" type="button" data-mt-comprar>Comprar</button>
      <div class="mt-links"><button type="button" class="ck-link" data-mt-retazo>+ Retazo encontrado</button><button type="button" class="ck-link" data-mt-contar>Contar barras</button></div></div>`;
    cont.innerHTML = h;
  }
  function comprar(){
    const F = filas();
    const items = F.filter(r => r.falta > 0).map(r => ({ material_id:r.f.id, cantidad:r.falta }));
    const sug = F.filter(r => !r.falta && r.usa && r.libre === 0 && !r.camino).map(r => ({ material_id:r.f.id, cantidad:1 }));
    CP().abrirMaterial(items, sug);
  }

  // ---------- Hoja de esta parte (una sola, cambia de contenido) ----------
  function hoja(){
    if($('sheetMt')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="sheet-scrim scrim-top" id="scrimMt" data-cerrar="sheetMt"></div>
      <section class="sheet sheet-auto sheet-top" id="sheetMt" role="dialog" aria-modal="true" aria-labelledby="mtTitulo">
        <div class="sheet-handle"></div>
        <div class="sheet-head"><div style="min-width:0"><h2 class="sheet-title" id="mtTitulo"></h2><p class="sheet-sub" id="mtSub"></p></div>
          <button class="icon-btn" data-cerrar="sheetMt" aria-label="Cerrar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <div class="sheet-body" id="mtBody"></div>
        <div class="sheet-foot" id="mtFoot"></div>
      </section>`);
    $('sheetMt').addEventListener('click', clicHoja);
    $('sheetMt').addEventListener('input', (e) => { if(e.target.id === 'mtMsg' && M) M.texto = e.target.value; if(e.target.id === 'mtLargo' && M){ M.largo = e.target.value; avisoRetazo(); } });
  }
  let M = null;   // lo que muestra la hoja
  function mostrar(titulo, sub, body, foot){ hoja(); $('mtTitulo').textContent = titulo; $('mtSub').textContent = sub || ''; $('mtBody').innerHTML = body; $('mtFoot').innerHTML = foot || ''; $('mtFoot').classList.toggle('hidden', !foot); if(!$('sheetMt').classList.contains('open')) abrirHoja('sheetMt'); }
  const opc = (attr, lista, sel) => `<div class="fi-opc">${lista.map(([v, t, off]) => `<button class="fx ${String(sel) === String(v) ? 'on' : ''}" type="button" ${attr}="${esc(v)}" ${off ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>`;

  // ---------- Mensaje al proveedor (K13) ----------
  function lineaMsg(x, prov){
    const f = x.material_id ? fabDe(x.material_id) : null, n = Number(x.cantidad) || 0;
    let nom = String(x.n || (f && f.nombre) || x.descripcion || 'material'); nom = nom.charAt(0).toLowerCase() + nom.slice(1);
    if(n > 1 && f) nom = nom.replace(/^(\S+)/, w => /[aeiouáéíóú]$/i.test(w) ? w + 's' : w + 'es');
    const pr = f && f.precios && f.precios[prov], esp = pr && pr.esp ? String(pr.esp).replace(/\s*mm$/, '') : '';
    return '• ' + num(n) + ' ' + nom + (esp && !nom.includes(esp) ? ' calibre ' + esp : '') + (f && f.pres === 'barra' ? ' (barra de ' + num(Number(f.largo) / 100) + ' m)' : f && f.pres === 'hoja' ? ' (hoja)' : '');
  }
  function textoMsg(){
    const l = lugarDe(M.pid); if(!l) return '';
    const fin = M.como === 'busco' ? 'Lo paso buscando' + (M.cuando === 'mañana' ? ' en la mañana' : '') + '.' : '¿Me lo puede mandar' + (M.cuando === 'mañana' ? ' en la mañana' : '') + '?';
    return `Buenos días, le escribe ${yo || 'Ray'} de Herrería Artesanos. Para ${M.cuando} necesito:\n${(l.lineas || []).map(x => lineaMsg(x, l.proveedor_id)).join('\n')}\n¿Me confirma precio y si lo tiene? ${fin} Gracias.`;
  }
  // grupo: la compra recién pedida (se abre con su primer proveedor); pid: un lugar en particular
  async function abrirMensaje(grupo, pid){
    if(!CP().datos) try{ await CP().cargar(); } catch(e){ toast(errTxt(e), 'error'); return; }
    const ls = enCamino().filter(l => pid ? String(l.id) === String(pid) : String(l.grupo) === String(grupo));
    if(!ls.length) return;
    M = { k:'msg', pid:ls[0].id, grupo:ls[0].grupo, como:'busco', cuando:'mañana', otros:enCamino().filter(l => String(l.grupo) === String(ls[0].grupo)).map(l => l.id) };
    M.texto = textoMsg(); pintarMensaje();
  }
  function pintarMensaje(){
    const l = lugarDe(M.pid), p = provDe(l.proveedor_id), tel = p.telefono || '';
    mostrar('Mensaje para el proveedor', corto(l.proveedor) + ' · compra pedida',
      `${M.otros.length > 1 ? `<div class="field-label">¿A cuál?</div>${opc('data-mt-mpid', M.otros.map(id => [id, corto((lugarDe(id) || {}).proveedor)]), M.pid)}` : ''}
       <div class="field-label" style="margin-top:10px">¿Cómo llega?</div>${opc('data-mt-como', [['busco','Lo busco'], ['traen','Me lo traen']], M.como)}
       <div class="field-label" style="margin-top:10px">¿Cuándo?</div>${opc('data-mt-cuando', [['hoy','Hoy'], ['mañana','Mañana']], M.cuando)}
       <div class="field" style="margin-top:10px"><label class="field-label" for="mtMsg">Mensaje (lo puedes cambiar)</label><textarea class="input mt-msg" id="mtMsg" rows="8">${esc(M.texto)}</textarea></div>
       <div class="mt-dato"><span>Total estimado</span><b>${dinero(l.total)} ${l.iva ? 'con IVA' : ''}</b></div>
       <div class="mt-dato"><span>WhatsApp</span><b>${tel ? esc(telTxt(tel)) : 'sin número: lo escoges al enviar'}</b></div>
       <div class="mt-links"><button type="button" class="ck-link" data-mt-copiar>Copiar mensaje</button><button type="button" class="ck-link" data-mt-vercompra>Ver la compra</button></div>`,
      `<a class="btn-primary nm-teal mt-wa" id="mtWa" href="https://wa.me/${esc(String(tel).replace(/\D/g, ''))}?text=${esc(encodeURIComponent(M.texto))}" target="_blank" rel="noopener" data-mt-wa>Enviar por WhatsApp</a>`);
  }

  // ---------- Compra en camino ⋯ (K15) ----------
  function abrirCompraMenu(pid){
    const l = lugarDe(pid); if(!l) return;
    M = { k:'cm', pid:l.id, grupo:l.grupo };
    const fila = (k, t, s) => `<button type="button" class="ck-mrow" data-mt-cmo="${k}"><b>${t}</b><span>${s} ›</span></button>`;
    mostrar('Compra en camino', corto(l.proveedor) + ' · ' + CP().resumenGrupo({ lugares:[l] }) + ' · ' + dinero(l.total),
      fila('llego', '¿Llegó?', 'todo, una parte o nada') + fila('cambiar', 'Cambiar la compra', 'cantidades o proveedor') + fila('msg', 'Volver a mandar el mensaje', 'WhatsApp') + fila('cancelar', 'Cancelar la compra', 'no se va a comprar')
      + `<p class="ck-nota">Si la cancelas, lo que faltaba vuelve a salir en rojo en Material${l.herrero ? ' y en el corte de ' + esc(primerNombre(l.herrero)) : ''}.</p>`);
  }
  function abrirCambiar(){
    const l = lugarDe(M.pid); if(!l) return;
    M = { k:'cambiar', pid:l.id, grupo:l.grupo, prov:l.proveedor_id, lineas:(l.lineas || []).map(x => ({ material_id:x.material_id || null, consumible_id:x.consumible_id || null, descripcion:x.descripcion || null, n:x.n, cantidad:Number(x.cantidad) || 0, precio:Number(x.precio) || 0 })) };
    pintarCambiar();
  }
  function pintarCambiar(){
    const provs = ((CP().datos || {}).proveedores || []).filter(p => (p.tipos || []).some(t => t === 'hierro' || t === 'laminas'));
    mostrar('Cambiar la compra', corto(provDe(M.prov).nombre),
      `<div class="field-label">Proveedor</div>${opc('data-mt-cprov', provs.map(p => [p.id, corto(p.nombre)]), M.prov)}
       ${M.lineas.map((x, i) => `<div class="ck-step"><span>${esc(x.n || x.descripcion || 'Material')}</span><button type="button" data-mt-lmenos="${i}" aria-label="Uno menos">−</button><b>${num(x.cantidad)}</b><button type="button" data-mt-lmas="${i}" aria-label="Uno más">+</button></div>`).join('')}
       <p class="ck-nota">Lo que quede en 0 sale de la compra. Para quitarla toda, cancélala.</p>`,
      '<button class="btn-primary nm-teal" type="button" data-mt-cguardar>Guardar cambios</button>');
  }
  function abrirCancelar(){
    const l = lugarDe(M.pid); if(!l) return;
    M = { k:'cancelar', pid:l.id, motivo:'' };
    mostrar('Cancelar la compra', corto(l.proveedor) + ' · ' + dinero(l.total),
      `<div class="field" id="campoMtMot"><label class="field-label" for="mtMot">¿Por qué se cancela?</label><input class="input" id="mtMot" maxlength="140" autocomplete="off"><p class="field-error">Escribe por qué</p></div>
       <p class="ck-nota">No se borra: queda anotada como cancelada. Lo que faltaba vuelve a salir en rojo.</p>`,
      '<button class="btn-primary mt-peligro" type="button" data-mt-cancelar>Cancelar la compra</button>');
  }

  // ---------- Contar barras (K16) ----------
  function abrirContar(){
    const F = (X().fab || []).filter(f => f.activo !== false && (f.tipo === 'hierro' || f.tipo === 'laminas'));
    M = { k:'contar', mats:F.map(f => ({ id:f.id, nombre:f.nombre, app:Number(f.stock) || 0, n:Number(f.stock) || 0, hoja:f.pres === 'hoja' })) };
    pintarContar();
  }
  function pintarContar(){
    const difs = M.mats.filter(m => m.n !== m.app);
    mostrar('Contar barras', 'Escribe lo que hay de verdad en el taller',
      M.mats.map((m, i) => `<div class="mt-cont"><div class="ck-mh"><b>${esc(m.nombre)}</b><span>la app dice ${m.app}</span></div>
        <div class="ck-step"><span>${m.hoja ? 'Hojas' : 'Barras'}</span><button type="button" data-mt-cmenos="${i}" aria-label="Una menos">−</button><b>${m.n}</b><button type="button" data-mt-cmas="${i}" aria-label="Una más">+</button></div></div>`).join('')
      + `<p class="ck-nota">${difs.length ? plural(difs.length, '1 diferencia', 'diferencias') + ': ' + esc(difs.map(m => m.nombre.toLowerCase() + (m.n < m.app ? ' baja' : ' sube') + ' de ' + m.app + ' a ' + m.n).join(' · ')) + '.' : 'Todo cuadra con la app.'} Queda anotado quién contó y cuándo.</p>`,
      '<button class="btn-primary nm-teal" type="button" data-mt-conteo>Guardar conteo</button>');
  }

  // ---------- Retazo encontrado (K17) ----------
  function abrirRetazo(){
    const F = (X().fab || []).filter(f => f.activo !== false && f.tipo === 'hierro' && f.pres === 'barra');
    M = { k:'retazo', mid:F[0] ? F[0].id : null, largo:'', mats:F };
    pintarRetazo();
  }
  function pintarRetazo(){
    mostrar('Retazo encontrado', 'Entra con número para usarlo en un plan',
      `<div class="field-label">Material</div>${opc('data-mt-rmat', M.mats.map(f => [f.id, f.nombre]), M.mid)}
       <div class="field" id="campoMtLargo" style="margin-top:10px"><label class="field-label" for="mtLargo">Largo (cm)</label><input class="input" id="mtLargo" inputmode="decimal" value="${esc(M.largo)}" autocomplete="off"><p class="field-error">Escribe el largo en cm (de 10 a 1000)</p><p class="field-hint" id="mtRetAviso"></p></div>
       <div class="ck-nota"><b>¿Un retazo ya no está?</b><br>En Material toca la ✕ al lado del retazo.</div>`,
      '<button class="btn-primary nm-teal" type="button" data-mt-rguardar>Guardar retazo</button>');
    avisoRetazo();
  }
  function avisoRetazo(){
    const el = $('mtRetAviso'); if(!el || !M || M.k !== 'retazo') return;
    const f = fabDe(M.mid), v = parseFloat(String(M.largo).replace(',', '.')), min = Number(f && f.minRet) || 0;
    el.textContent = v > 0 && min && v < min ? `Es más corto que ${num(min)} cm: casi no sirve para las piezas de este material.` : 'Sale con el número que sigue.';
  }

  // ---------- Proveedores (K18) ----------
  function abrirProveedores(){
    M = { k:'provs', nuevo:null };
    pintarProveedores();
  }
  function pintarProveedores(){
    const provs = (CP().datos || {}).proveedores || [], L = enCamino();
    const debes = -provs.filter(p => p.saldo < 0).reduce((a, p) => a + Number(p.saldo), 0);
    if(M.nuevo){
      const N = M.nuevo;
      mostrar('Proveedor nuevo', 'Nombre y WhatsApp',
        `<div class="field" id="campoMtPNom"><label class="field-label" for="mtPNom">Nombre</label><input class="input" id="mtPNom" maxlength="80" value="${esc(N.nombre)}" autocomplete="off"><p class="field-error">Escribe el nombre</p></div>
         <div class="field"><label class="field-label" for="mtPTel">WhatsApp</label><input class="input" id="mtPTel" inputmode="tel" maxlength="20" value="${esc(N.tel)}" autocomplete="off"></div>
         <div class="field-label">Qué vende</div><div class="fi-opc">${TIPOS.map(([v, t]) => `<button class="fx ${N.tipos.includes(v) ? 'on' : ''}" type="button" data-mt-ptipo="${v}">${t}</button>`).join('')}</div>
         <div class="field-label" style="margin-top:10px">¿Cobra IVA?</div>${opc('data-mt-piva', [['si','Sí'], ['no','No']], N.iva ? 'si' : 'no')}`,
        '<button class="btn-primary nm-teal" type="button" data-mt-pguardar>Guardar proveedor</button>');
      return;
    }
    mostrar('Proveedores', 'Lo que les debes y lo que viene en camino',
      `<div class="ck-nums mt-nums"><div><b>${dinero(debes)}</b><span>Le debes en total</span></div><div><b>${L.length}</b><span>${L.length === 1 ? 'Compra en camino' : 'Compras en camino'} · ${dinero(L.reduce((a, l) => a + Number(l.total || 0), 0))}</span></div></div>
       ${provs.map(p => { const cam = L.filter(l => String(l.proveedor_id) === String(p.id));
         return `<a class="nm-row" href="finanzas.html?prov=${esc(p.id)}" style="text-decoration:none;color:inherit"><span class="nm-av">${esc(iniciales(p.nombre))}</span><span class="nm-tx"><b>${esc(p.nombre)}</b><span>${cam.length ? 'en camino: ' + esc(cam.map(l => CP().resumenGrupo({ lugares:[l] })).join(' y ')) : p.telefono ? esc(telTxt(p.telefono)) : 'sin WhatsApp'}</span></span><span class="nm-m ${p.saldo < -0.005 ? 'mt-rojo' : ''}">${dinero(Math.abs(Math.min(0, p.saldo)))} ›</span></a>`; }).join('')}
       <button class="nm-row" type="button" data-mt-pnuevo><span class="nm-av">+</span><span class="nm-tx"><b>+ Proveedor</b><span>nombre y WhatsApp</span></span></button>
       <p class="ck-nota">Toca uno para ver su estado de cuenta, pagarle o sacar el PDF. Sus precios se cambian en Costeador › Precios.</p>`);
  }

  // ---------- Barra dañada (K09) ----------
  // o: { sab, tid, nombre, barras } (las barras que se le enviaron)
  function abrirDanada(o){
    const bs = (o.barras || []).map((b, i) => Object.assign({ i }, b)).filter(b => b.tipo === 'barra');
    if(!bs.length){ toast('En su corte no hay barras enteras para reportar'); return; }
    M = { k:'danada', o, bs, mid:String(bs[0].mid), idx:null, reemplazo:null };
    pintarDanada();
  }
  function pintarDanada(){
    const mats = [...new Set(M.bs.map(b => String(b.mid)))], bs = M.bs.filter(b => String(b.mid) === M.mid), f = fabDe(M.mid) || { nombre:'Material', stock:0 };
    if(M.idx == null || !bs.some(b => b.i === M.idx)) M.idx = bs[0].i;
    const hayOtra = Number(f.stock) >= 2;
    if(!M.reemplazo || (M.reemplazo === 'taller' && !hayOtra)) M.reemplazo = hayOtra ? 'taller' : 'compra';
    const nom = String(f.nombre).toLowerCase();
    mostrar('Barra dañada', 'Corte de ' + primerNombre(M.o.nombre) + (M.o.empezo ? ' · está cortando' : ' · ya se le envió'),
      `<div class="field-label">¿Qué material?</div>${opc('data-mt-dmat', mats.map(m => [m, (fabDe(m) || {}).nombre || 'Material']), M.mid)}
       <div class="field-label" style="margin-top:10px">¿Cuál barra?</div>
       ${bs.map((b, j) => `<button type="button" class="mt-barra ${b.i === M.idx ? 'on' : ''}" data-mt-dbar="${b.i}"><b>Barra ${esc(b.n || j + 1)} · ${b.comprar ? 'la nueva' : 'la del taller'}</b><span>${esc((b.piezas || []).map(p => num(p.cm)).join(' · ') || 'sin piezas')}</span></button>`).join('')}
       <div class="field-label" style="margin-top:10px">¿Con qué la reemplaza?</div>${opc('data-mt-drem', [['taller', 'Otra del taller', !hayOtra], ['compra', 'Se compra']], M.reemplazo)}
       <p class="ck-nota">${M.reemplazo === 'taller' ? `Usa otra barra de ${esc(nom)} del taller. La dañada sale del Depósito.` : `${hayOtra ? '' : 'No hay ' + esc(nom) + ' libre: '}se suma 1 barra a la compra en camino y la dañada sale del Depósito.`}</p>`,
      '<button class="btn-primary nm-teal" type="button" data-mt-dguardar>Reportar y reemplazar</button>');
  }

  // ---------- Guardar ----------
  async function rpc(fn, args){
    if(ocupado) return null; ocupado = true;
    try{ const { data, error } = await db.rpc(fn, args); if(error) throw error; return data || {}; }
    catch(e){ toast(errTxt(e), 'error'); return null; }
    finally { ocupado = false; }
  }
  async function recargarTodo(){
    if(CP()) await CP().cargar().catch(() => {});
    if(window.TallerCorte) await window.TallerCorte.recargar();
  }
  async function clicHoja(e){
    const q = (a) => e.target.closest('[' + a + ']');
    let x;
    // Mensaje
    if((x = q('data-mt-mpid'))){ M.pid = x.dataset.mtMpid; M.texto = textoMsg(); return pintarMensaje(); }
    if((x = q('data-mt-como'))){ M.como = x.dataset.mtComo; M.texto = textoMsg(); return pintarMensaje(); }
    if((x = q('data-mt-cuando'))){ M.cuando = x.dataset.mtCuando; M.texto = textoMsg(); return pintarMensaje(); }
    if(q('data-mt-wa')){ const a = $('mtWa'); if(a) a.href = a.href.split('?')[0] + '?text=' + encodeURIComponent(M.texto); return; }
    if(q('data-mt-copiar')){ try{ await navigator.clipboard.writeText(M.texto); toast('Mensaje copiado. Pégalo en WhatsApp.'); } catch(_){ toast('No se pudo copiar. Mantén presionado el mensaje y cópialo.', 'error'); } return; }
    if(q('data-mt-vercompra')){ cerrarHoja('sheetMt', true); if(window.TallerCorte) window.TallerCorte.verMaterial(); return; }
    // Compra en camino
    if((x = q('data-mt-cmo'))){ const k = x.dataset.mtCmo;
      if(k === 'llego'){ cerrarHoja('sheetMt', true); CP().abrirLlego(M.grupo); return; }
      if(k === 'cambiar') return abrirCambiar();
      if(k === 'msg') return abrirMensaje(null, M.pid);
      if(k === 'cancelar') return abrirCancelar(); }
    if((x = q('data-mt-cprov'))){ M.prov = x.dataset.mtCprov; const E = CP().datos;
      M.lineas.forEach(l => { const f = l.material_id && (E.fab || []).find(y => String(y.id) === String(l.material_id)); const p = f && (f.precios || {})[M.prov]; if(p != null) l.precio = Number(p); });
      return pintarCambiar(); }
    if((x = q('data-mt-lmenos')) || (x = q('data-mt-lmas'))){ const i = +(x.dataset.mtLmenos ?? x.dataset.mtLmas), l = M.lineas[i]; l.cantidad = Math.max(0, Math.min(999, l.cantidad + (x.dataset.mtLmas != null ? 1 : -1))); return pintarCambiar(); }
    if(q('data-mt-cguardar')){
      const ls = M.lineas.filter(l => l.cantidad > 0).map(l => ({ material_id:l.material_id, consumible_id:l.consumible_id, descripcion:l.material_id || l.consumible_id ? null : l.descripcion, cantidad:l.cantidad, precio:l.precio }));
      if(!ls.length){ toast('Deja al menos un material. Para quitarla toda, cancélala.', 'error'); return; }
      if(await rpc('compra_pedida_cambiar', { pid:Number(M.pid), p:{ proveedor_id:Number(M.prov), lineas:ls } })){ toast('Compra cambiada. Vuelve a mandarle el mensaje al proveedor.'); cerrarHoja('sheetMt', true); await recargarTodo(); }
      return; }
    if(q('data-mt-cancelar')){
      const mot = ($('mtMot').value || '').trim(); if(!mot){ $('campoMtMot').classList.add('invalid'); return; }
      if(await rpc('compra_no_llego', { pid:Number(M.pid), motivo:mot })){ toast('Compra cancelada. Lo que faltaba vuelve a salir en rojo.'); cerrarHoja('sheetMt', true); await recargarTodo(); }
      return; }
    // Contar
    if((x = q('data-mt-cmenos')) || (x = q('data-mt-cmas'))){ const i = +(x.dataset.mtCmenos ?? x.dataset.mtCmas), m = M.mats[i]; m.n = Math.max(0, Math.min(9999, m.n + (x.dataset.mtCmas != null ? 1 : -1))); return pintarContar(); }
    if(q('data-mt-conteo')){
      const r = await rpc('conteo_guardar', { p:{ conteo:M.mats.map(m => ({ material_id:m.id, contado:m.n })) } });
      if(r){ const n = (r.diferencias || []).length; toast(n ? 'Conteo guardado con ' + plural(n, '1 diferencia', 'diferencias') + '.' : 'Conteo guardado. Todo cuadra.'); cerrarHoja('sheetMt', true); await recargarCosteo(); }
      return; }
    // Retazo
    if((x = q('data-mt-rmat'))){ M.largo = $('mtLargo').value; M.mid = x.dataset.mtRmat; return pintarRetazo(); }
    if(q('data-mt-rguardar')){
      const v = parseFloat(String($('mtLargo').value).replace(',', '.'));
      if(!(v >= 10 && v <= 1000)){ $('campoMtLargo').classList.add('invalid'); return; }
      if(!M.mid){ toast('Elige el material', 'error'); return; }
      if(await rpc('retazo_agregar', { mid:Number(M.mid), p_largo:v, p_ancho:null })){ toast('Retazo guardado. Sale en Material con su número.'); cerrarHoja('sheetMt', true); await recargarCosteo(); }
      return; }
    // Proveedores
    if(q('data-mt-pnuevo')){ M.nuevo = { nombre:'', tel:'', tipos:['hierro'], iva:false }; return pintarProveedores(); }
    if((x = q('data-mt-ptipo'))){ leerProv(); const t = x.dataset.mtPtipo, T = M.nuevo.tipos; if(T.includes(t)) T.splice(T.indexOf(t), 1); else T.push(t); return pintarProveedores(); }
    if((x = q('data-mt-piva'))){ leerProv(); M.nuevo.iva = x.dataset.mtPiva === 'si'; return pintarProveedores(); }
    if(q('data-mt-pguardar')){
      leerProv(); const N = M.nuevo;
      if(!N.nombre.trim()){ $('campoMtPNom').classList.add('invalid'); return; }
      if(!N.tipos.length){ toast('Elige qué vende', 'error'); return; }
      if(await rpc('proveedor_guardar', { p:{ nombre:N.nombre.trim(), telefono:N.tel.trim(), tipos:N.tipos.slice(), cobra_iva:N.iva } })){ toast('Proveedor guardado. Ponle sus precios en Costeador › Precios.'); M.nuevo = null; await CP().cargar().catch(() => {}); pintarProveedores(); }
      return; }
    // Barra dañada
    if((x = q('data-mt-dmat'))){ M.mid = x.dataset.mtDmat; M.idx = null; return pintarDanada(); }
    if((x = q('data-mt-dbar'))){ M.idx = +x.dataset.mtDbar; return pintarDanada(); }
    if((x = q('data-mt-drem')) && !x.disabled){ M.reemplazo = x.dataset.mtDrem; return pintarDanada(); }
    if(q('data-mt-dguardar')){
      const b = M.bs.find(y => y.i === M.idx);
      const r = await rpc('corte_barra_danada', { p_sab:M.o.sab, p_tid:M.o.tid, p_mid:Number(M.mid), p_barra:Number(b && b.n) || (M.idx + 1), p_compra:M.reemplazo === 'compra' });
      if(r){ toast(M.reemplazo === 'compra' ? 'Listo: la dañada salió del Depósito y se sumó 1 barra a la compra.' : 'Listo: la dañada salió del Depósito. Usa otra del taller.');
        cerrarHoja('sheetMt', true); await recargarCosteo(); if(r.compra && r.compra.grupo) abrirMensaje(r.compra.grupo); }
    }
  }
  function leerProv(){ const N = M.nuevo; if(!N) return; const a = $('mtPNom'), b = $('mtPTel'); if(a) N.nombre = a.value; if(b) N.tel = b.value; }
  // Contar, retazos y barra dañada cambian el depósito: se recargan los datos del costeo (stock y retazos)
  async function recargarCosteo(){ try{ if(window.COSTEO && window.COSTEO.cargar) await window.COSTEO.cargar(); } catch(_){} await recargarTodo(); }

  // ---------- Clics en Material ----------
  document.addEventListener('click', async (e) => {
    if(!e.target.closest('#vCorte')) return;
    let x;
    if((x = e.target.closest('[data-mt-cm]'))) return abrirCompraMenu(x.dataset.mtCm);
    if(e.target.closest('[data-mt-provs]')) return abrirProveedores();
    if(e.target.closest('[data-mt-comprar]')) return comprar();
    if(e.target.closest('[data-mt-retazo]')) return abrirRetazo();
    if(e.target.closest('[data-mt-contar]')) return abrirContar();
    if((x = e.target.closest('[data-mt-retq]'))){
      if(!confirm('¿Este retazo ya no está? Sale del Depósito y, si estaba en un plan, el plan se rehace.')) return;
      if(await rpc('retazo_quitar', { rid:Number(x.dataset.mtRetq), motivo:'Ya no está' })){ toast('Retazo quitado.'); await recargarCosteo(); }
    }
  });
  // Después de pedir una compra (Comprar o Enviar y pedir), el mensaje para el proveedor
  if(window.COMPRA){ window.COMPRA.alPedir((d) => { if(d && d.grupo && document.getElementById('vCorte')) abrirMensaje(d.grupo); });
    window.COMPRA.alCambiar(() => { if(window.TallerCorte && window.TallerCorte.cargado) window.TallerCorte.repintar(); }); }

  window.TallerMaterial = { pintar, abrirMensaje, abrirDanada, filas };
})();
