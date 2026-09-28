// Nueva venta: cliente, productos y cierre. Guarda como cotización o confirma con abono.
(function(){
  'use strict';
  const db = window.db;
  const { TIPOS, iconoTipo, acabados, tieneColores, esquema, grupoActivo, especificacionesDesdeEstado,
          estadoDesdeEspecificaciones, resumenSpecs, fotoModelo, fotoPieza, esc, numOrNull, dinero, toast,
          abrirHoja, cerrarHoja, antesDeCerrar, montoOrNull } = window.AH;
  const $ = (id) => document.getElementById(id);

  const TARIFA_VENTANA = { 'Panorámica':[90, 190], 'Ecobel':[120, 220] }; // $/m² sin y con protección
  const PRECIO_MANILLON = 20;
  const METODOS = ['Binance', 'Zelle', 'Bolívares', 'Efectivo'];
  const BORRADOR = 'ah_borrador_venta';
  const NUMERO_NEGOCIO = '584220167079';

  let modelos = [], piezas = [], sedes = [], perfil = null;
  let items = [];           // productos de la venta
  let sedeId = null;
  const extras = { desc:false, inst:false };   // descuento e instalación: opcionales
  let clienteExistente = null;
  let guardando = false;
  let terminado = false;
  let cargado = false;
  const editId = +(new URLSearchParams(location.search).get('editar') || 0) || null;   // editar una cotización o venta
  let editVenta = null;      // hasta que se recupere el borrador no se sobrescribe

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  // Clave única: si se reintenta por mala conexión, el servidor no duplica
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  const claveVenta = uuid();
  const ICON_EDIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const ICON_DEL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>';
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
  const ICON_ALERTA = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  const ICON_WA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';

  // ---------------------------------------------------------------------------
  // Teléfono: siempre se guarda como 58 + 10 números
  // ---------------------------------------------------------------------------
  function normTel(t){
    const d = String(t || '').replace(/\D/g, '');
    if(/^0\d{10}$/.test(d)) return '58' + d.slice(1);
    if(/^4\d{9}$/.test(d)) return '58' + d;
    return d;
  }
  const telValido = (t) => /^58\d{10}$/.test(normTel(t));
  // Cédula o RIF: sin puntos ni guiones; si son solo números es V
  function normCed(t){
    const d = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^\d+$/.test(d) ? 'V' + d : d;
  }
  const cedValida = (t) => /^[VEJGP]\d{5,10}$/.test(normCed(t));

  // ---------------------------------------------------------------------------
  // Totales
  // ---------------------------------------------------------------------------
  function subtotalItem(it){ return r2((montoOrNull(it.precio) || 0) * (it.cantidad || 1)); }
  function totales(){
    const sub = r2(items.reduce((a, it) => a + subtotalItem(it), 0));
    const desc = extras.desc ? (montoOrNull($('vDesc').value) || 0) : 0;
    const inst = extras.inst ? (montoOrNull($('vInst').value) || 0) : 0;
    return { sub, desc, inst, total: r2(sub - desc + inst) };
  }
  function pintarResumen(){
    const t = totales();
    $('resumen').innerHTML = `
      <div class="res-fila"><span>Productos</span><b>${dinero(t.sub)}</b></div>
      ${t.desc ? `<div class="res-fila"><span>Descuento</span><b>- ${dinero(t.desc)}</b></div>` : ''}
      ${t.inst ? `<div class="res-fila"><span>Instalación o traslado</span><b>${dinero(t.inst)}</b></div>` : ''}
      <div class="res-total"><span>Total</span><b>${dinero(t.total)}</b></div>`;
    $('pieTotal').textContent = dinero(t.total);
    $('campoDesc').classList.toggle('invalid', t.total < 0);
  }

  // ---------------------------------------------------------------------------
  // Lista de productos de la venta
  // ---------------------------------------------------------------------------
  function detalleItem(it){
    const partes = [];
    if(it.origen === 'medida') return it.descripcion || 'Trabajo a medida';
    if(it.color && tieneColores(it.tipo)) partes.push(it.color);
    resumenSpecs(it.tipo, it.especificaciones).forEach(s => partes.push(s.t));
    if(it.origen === 'pieza') partes.unshift('Entrega inmediata');
    return partes.join(' · ');
  }
  function pintarItems(){
    $('items').innerHTML = items.length ? items.map((it, i) => `
      <div class="item" style="--i:${i}">
        <div class="item-foto">${it.foto ? `<img src="${esc(it.foto)}" alt="">` : iconoTipo(it.tipo, 26)}</div>
        <div class="item-txt">
          <div class="item-nombre">${esc(it.nombre)}</div>
          <div class="item-det">${esc(detalleItem(it))}</div>
          <div class="item-pie">
            <span class="item-cant">${it.cantidad} × ${dinero(it.precio)}</span>
            <span class="item-precio">${dinero(subtotalItem(it))}</span>
          </div>
        </div>
        <div class="item-acc">
          <button type="button" data-editar="${i}" aria-label="Editar ${esc(it.nombre)}">${ICON_EDIT}</button>
          <button type="button" class="quitar" data-quitar="${i}" aria-label="Quitar ${esc(it.nombre)}">${ICON_DEL}</button>
        </div>
      </div>`).join('')
      : '<div class="vacio-items">Todavía no hay productos.<br>Toca "Agregar producto".</div>';
    if(items.length) $('campoItems').classList.remove('invalid');
    pintarResumen();
    guardarBorrador();
  }
  $('items').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-editar]');
    if(ed){ abrirProducto(items[+ed.dataset.editar], +ed.dataset.editar); return; }
    const q = e.target.closest('[data-quitar]');
    if(q){
      const it = items[+q.dataset.quitar];
      if(!confirm(`¿Quitar "${it.nombre}" de la venta?`)) return;
      items.splice(+q.dataset.quitar, 1);
      pintarItems();
    }
  });

  // ---------------------------------------------------------------------------
  // Agregar producto: elegir de dónde viene
  // ---------------------------------------------------------------------------
  $('btnAgregar').addEventListener('click', () => {
    const n = piezas.filter(p => p.cantidad > 0).length;
    $('origenPiezaSub').textContent = n ? (n === 1 ? '1 pieza lista en tienda' : `${n} piezas listas en tienda`) : 'No hay piezas en tienda ahora';
    $('origenPieza').disabled = !n;
    $('origenPieza').style.opacity = n ? '' : '0.5';
    abrirHoja('sheetAgregar');
  });
  document.querySelector('#sheetAgregar .origenes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-origen]');
    if(!b || b.disabled) return;
    const o = b.dataset.origen;
    cerrarHoja('sheetAgregar', true);
    if(o === 'catalogo'){ filtroModelo = 'Todos'; $('buscaModelo').value = ''; pintarModelos(); abrirHoja('sheetModelos'); }
    if(o === 'pieza'){ pintarPiezas(); abrirHoja('sheetPiezas'); }
    if(o === 'medida') abrirProducto({ origen:'medida', tipo:'A medida', nombre:'', descripcion:'', precio:'', cantidad:1, foto:null }, null);
  });

  // Modelos del catálogo
  let filtroModelo = 'Todos';
  function pintarModelos(){
    const tipos = TIPOS.filter(t => modelos.some(m => m.tipo === t));
    $('chipsModelos').innerHTML = ['Todos', ...tipos].map(t => `<button class="chip ${t === filtroModelo ? 'active' : ''}" data-cat="${esc(t)}">${esc(t)}</button>`).join('');
    const q = $('buscaModelo').value.trim().toLowerCase();
    const lista = modelos.filter(m => (filtroModelo === 'Todos' || m.tipo === filtroModelo) && (!q || (m.nombre || '').toLowerCase().includes(q)));
    $('listaModelos').innerHTML = lista.length ? lista.map(m => {
      const f = fotoModelo(m);
      return `<button class="elegir" type="button" data-modelo="${m.id}">
        <span class="item-foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : iconoTipo(m.tipo, 24)}</span>
        <span style="min-width:0"><span class="elegir-t">${esc(m.nombre)}</span><span class="elegir-s">${esc(m.tipo)}</span></span>
        <span class="elegir-p">${m.tipo === 'Ventana' ? 'Por m²' : dinero(m.precio_base)}</span>
      </button>`;
    }).join('') : '<div class="vacio-items">No hay modelos con ese nombre.</div>';
  }
  $('chipsModelos').addEventListener('click', (e) => { const c = e.target.closest('[data-cat]'); if(c){ filtroModelo = c.dataset.cat; pintarModelos(); } });
  $('buscaModelo').addEventListener('input', pintarModelos);
  $('listaModelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modelo]');
    if(!b) return;
    const m = modelos.find(x => String(x.id) === b.dataset.modelo);
    if(!m) return;
    cerrarHoja('sheetModelos', true);
    const cols = acabados(m.tipo).filter(a => a.sw && (m.fotos || {})[a.key]);
    const color = tieneColores(m.tipo) ? ((cols[0] && cols[0].key) || 'Blanco') : null;
    abrirProducto({
      origen:'catalogo', catalogo_id:m.id, tipo:m.tipo, nombre:m.nombre, color,
      estado: Object.assign(estadoDesdeEspecificaciones(m.tipo, m.especificaciones_base, 'pedido'), m.tipo === 'Combo' && color ? { ventanas_color: color } : {}),
      extraProteccion:'', precio:'', precioManual:false, cantidad:1
    }, null);
  });

  // Piezas de entrega inmediata
  const nombreSede = (id) => (sedes.find(s => s.id === id) || {}).nombre || '';
  function pintarPiezas(){
    const lista = piezas.filter(p => p.cantidad > 0);
    $('listaPiezas').innerHTML = lista.map(p => {
      const m = modelos.find(x => x.id === p.catalogo_id);
      const f = fotoPieza(p, m);
      return `<button class="elegir" type="button" data-pieza="${p.id}">
        <span class="item-foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : iconoTipo(m ? m.tipo : '', 24)}</span>
        <span style="min-width:0"><span class="elegir-t">${esc(m ? m.nombre : 'Pieza')}</span><span class="elegir-s">${esc([p.color, nombreSede(p.sede_id), p.cantidad > 1 ? p.cantidad + ' en tienda' : ''].filter(Boolean).join(' · '))}</span></span>
        <span class="elegir-p">${dinero(p.precio)}</span>
      </button>`;
    }).join('');
  }
  $('listaPiezas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pieza]');
    if(!b) return;
    const p = piezas.find(x => String(x.id) === b.dataset.pieza);
    const m = p && modelos.find(x => x.id === p.catalogo_id);
    if(!p || !m) return;
    cerrarHoja('sheetPiezas', true);
    abrirProducto({
      origen:'pieza', pieza_id:p.id, catalogo_id:m.id, tipo:m.tipo, nombre:m.nombre, color:p.color || null,
      especificaciones: p.especificaciones || {}, foto: fotoPieza(p, m), precio: p.precio, precioManual:true, cantidad:1
    }, null);
  });

  // ---------------------------------------------------------------------------
  // Hoja del producto
  // ---------------------------------------------------------------------------
  let prod = null;        // copia que se edita
  let prodIndex = null;   // null = nuevo
  let prodSucio = false;

  function modeloDe(it){ return modelos.find(x => x.id === it.catalogo_id) || null; }
  function base(it){ const m = modeloDe(it); return (m && m.especificaciones_base) || {}; }

  // ¿Cuánto cuesta según lo elegido? Devuelve el precio y cómo se calculó.
  function calcular(it){
    const m = modeloDe(it);
    const s = it.estado || {};
    const partes = [];
    let total = 0;
    if(it.tipo === 'Ventana'){
      const alto = numOrNull(s.alto) || 0, ancho = numOrNull(s.ancho) || 0;
      const area = r2(alto * ancho);
      const tarifa = (TARIFA_VENTANA[s.aluminio] || TARIFA_VENTANA['Panorámica'])[s.proteccion ? 1 : 0];
      total = r2(area * tarifa);
      partes.push(`${area} m² × $${tarifa} (${s.aluminio || 'Panorámica'}${s.proteccion ? ' con protección' : ''})`);
    } else {
      total = Number(m && m.precio_base) || 0;
      partes.push(`Modelo ${dinero(total)}`);
    }
    const b = base(it);
    if(s.manillon && s.manillon !== 'Sin' && !b.manillon){ total += PRECIO_MANILLON; partes.push(`manillón ${dinero(PRECIO_MANILLON)}`); }
    if(pideMontoProteccion(it)){
      const x = montoOrNull(it.extraProteccion) || 0;
      total += x; partes.push(`protección ${x ? dinero(x) : '(escribe el monto)'}`);
    }
    return { total: r2(total), texto: partes.join(' + ') };
  }
  function pideMontoProteccion(it){
    const s = it.estado || {}, b = base(it);
    if(it.tipo === 'Puerta Multilock') return !!s.proteccion && !b.proteccion;
    if(it.tipo === 'Combo') return s.variante === 'Con protección en puerta' && b.variante !== 'Con protección en puerta';
    return false;
  }

  function optsHtml(grupo, sel){
    const cols = grupo.cols || grupo.opts.length;
    return `<div class="field"><span class="field-label">${esc(grupo.label)}</span>
      <div class="opts" style="--cols:${cols}">${grupo.opts.map(o => `
        <button type="button" class="opt ${o.v === sel ? 'selected' : ''}" data-g="${grupo.g}" data-v="${esc(o.v)}" aria-pressed="${o.v === sel}">${o.sw ? `<span class="swatch ${o.sw}"></span>` : ''}${esc(o.t || o.v)}</button>`).join('')}
      </div></div>`;
  }
  function medidasHtml(label, kA, kB){
    const s = prod.estado;
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      <div class="input-row">
        <div class="input-affix has-r"><input class="input" data-mkey="${kA}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kA] == null ? '' : s[kA])}" aria-label="Alto en metros"><span class="affix affix-r">alto</span></div>
        <div class="input-affix has-r"><input class="input" data-mkey="${kB}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kB] == null ? '' : s[kB])}" aria-label="Ancho en metros"><span class="affix affix-r">ancho</span></div>
      </div><div class="field-hint">En metros</div></div>`;
  }
  function grupoHtml(g){
    if(g.tipo === 'medidas') return medidasHtml(g.label, g.keys[0], g.keys[1]);
    if(g.tipo === 'texto') return `<div class="field"><label class="field-label">${esc(g.label)}</label><input class="input" type="text" data-texto="${g.g}" value="${esc(prod.estado[g.g] || '')}" placeholder="${esc(g.placeholder || '')}" autocomplete="off"></div>`;
    return optsHtml(g, prod.estado[g.g]);
  }
  const ICON_PUERTA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M15 11v2.5"/></svg>';
  const ICON_VENTANA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/></svg>';
  function specsHtml(){
    const esq = esquema(prod.tipo, 'pedido');
    const s = prod.estado;
    const combo = prod.tipo === 'Combo';
    let html = combo ? `<div class="zona">${ICON_PUERTA}Puerta</div>` : '';
    html += medidasHtml(esq.medidas.label || 'Medidas', 'alto', 'ancho');
    if(tieneColores(prod.tipo)){
      html += optsHtml({ g:'__color', label: combo ? 'Color (puerta y ventanas)' : 'Color', opts: acabados(prod.tipo).filter(a => a.sw).map(a => ({ v:a.key, sw:a.sw })) }, prod.color);
    }
    const dependeDeGrupo = (g) => g.si && typeof g.si === 'object';
    const dependeDeExtra = (g) => g.si && typeof g.si === 'string';
    esq.grupos.filter(g => !g.si && !g.zona).forEach(g => {
      html += grupoHtml(g);
      esq.grupos.filter(h => dependeDeGrupo(h) && h.si.g === g.g && grupoActivo(h, s)).forEach(h => { html += grupoHtml(h); });
    });
    if(esq.extras.length){
      html += `<div class="field"><span class="field-label">Extras</span><div class="toggles">${esq.extras.map(x => `
        <button type="button" class="tchip ${s[x.k] ? 'on' : ''}" data-k="${x.k}" aria-pressed="${!!s[x.k]}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>${esc(x.label)}</button>`).join('')}</div></div>`;
    }
    esq.grupos.filter(g => dependeDeExtra(g) && grupoActivo(g, s) && !g.zona).forEach(g => { html += grupoHtml(g); });
    if(pideMontoProteccion(prod)){
      html += `<div class="field" id="campoProt"><label class="field-label" for="pProt">Monto de la protección</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="pProt" data-precio-extra type="text" inputmode="decimal" autocomplete="off" value="${esc(prod.extraProteccion || '')}"></div>
        <div class="field-error">Escribe cuánto cuesta la protección</div></div>`;
    }
    const zona = esq.grupos.filter(g => g.zona && grupoActivo(g, s));
    if(zona.length){
      html += `<div class="zona">${ICON_VENTANA}Ventanas</div>`;
      zona.forEach(g => { html += grupoHtml(g); });
      html += '<div class="zona-fin"></div>';
    }
    return html;
  }

  function cantidadHtml(max){
    if(prod.fijo) return `<div class="field"><span class="field-label">Cantidad</span><div class="f-fijo">${prod.cantidad} (ya vendida)</div></div>`;
    return `<div class="field"><span class="field-label">Cantidad</span>
      <div class="stepper"><button type="button" data-cant="-1" aria-label="Una menos">−</button><span id="pCant">${prod.cantidad}</span><button type="button" data-cant="1" aria-label="Una más">+</button></div>
      ${max ? `<div class="field-hint">Hay ${max} en tienda.</div>` : ''}</div>`;
  }
  function precioHtml(){
    const conCalculo = prod.origen === 'catalogo';
    const c = conCalculo ? calcular(prod) : null;
    const valor = conCalculo && !prod.precioManual ? c.total : prod.precio;
    return `<div class="precio-caja">
      <div class="field" id="campoPrecio"><label class="field-label" for="pPrecio">Precio por unidad</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="pPrecio" type="text" inputmode="decimal" autocomplete="off" value="${esc(valor === '' || valor == null ? '' : valor)}"></div>
        <div class="field-error">Escribe el precio</div>
      </div>
      ${conCalculo ? `<div class="desglose" id="desglose">Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}</div>
        ${prod.precioManual && Number(prod.precio) !== c.total ? `<button type="button" class="usar-sugerido" id="usarSugerido">Usar el sugerido</button>` : ''}` : ''}
    </div>`;
  }

  function pintarProducto(){
    const scroll = $('prodBody').scrollTop;
    let html = '';
    if(prod.origen === 'medida'){
      $('prodTitulo').textContent = prodIndex == null ? 'Trabajo a medida' : 'Editar trabajo';
      html = `
        <div class="field"><span class="field-label">Foto que trae el cliente</span>
          <div class="photos single"><label class="photo-box ${prod.foto ? 'filled' : ''}">
            ${prod.foto ? `<img src="${esc(prod.foto)}" alt=""><span class="photo-tag">Cambiar foto</span>` : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>Tomar o elegir foto</span>`}
            <input type="file" accept="image/*" id="pFoto" aria-label="Foto del trabajo"></label></div>
          <div class="field-hint">Opcional. No se guarda en el catálogo.</div></div>
        <div class="field" id="campoMedNombre"><label class="field-label" for="pNombre">Qué es</label>
          <input class="input" id="pNombre" type="text" autocomplete="off" value="${esc(prod.nombre)}" placeholder="Reja para ventana, portón de 2 hojas">
          <div class="field-error">Escribe qué es</div></div>
        <div class="field"><label class="field-label" for="pDesc">Detalles (opcional)</label>
          <textarea class="input" id="pDesc" rows="3" placeholder="Medidas, color y lo que pidió el cliente">${esc(prod.descripcion || '')}</textarea></div>
        ${cantidadHtml()}${precioHtml()}`;
    } else {
      const m = modeloDe(prod);
      const foto = prod.origen === 'pieza' ? prod.foto : fotoModelo(m, prod.color);
      $('prodTitulo').textContent = prodIndex == null ? (prod.origen === 'pieza' ? 'Pieza de entrega inmediata' : 'Producto del catálogo') : 'Editar producto';
      html = `<div class="prod-cab">
          <div class="item-foto">${foto ? `<img src="${esc(foto)}" alt="">` : iconoTipo(prod.tipo, 28)}</div>
          <div><div class="prod-nombre">${esc(prod.nombre)}</div><div class="prod-tipo">${esc(prod.tipo)}${prod.origen === 'pieza' ? ' · Entrega inmediata' : ''}</div></div>
        </div>`;
      if(prod.origen === 'pieza'){
        const specs = resumenSpecs(prod.tipo, prod.especificaciones);
        const p = piezas.find(x => x.id === prod.pieza_id);
        html += `${specs.length || prod.color ? `<div class="field"><span class="field-label">Esta pieza</span><div class="spec-chips">${prod.color ? `<span class="spec-chip">${esc(prod.color)}</span>` : ''}${window.AH.specChipsHtml(specs)}</div></div>` : ''}
          ${cantidadHtml(p ? p.cantidad : 1)}${precioHtml()}`;
      } else {
        html += specsHtml() + cantidadHtml() + precioHtml();
      }
    }
    $('prodBody').innerHTML = html;
    $('prodBody').scrollTop = scroll;
    $('btnProdListo').textContent = prodIndex == null ? 'Agregar a la venta' : 'Guardar cambios';
  }

  // Solo se actualiza el precio (sin repintar todo, para no perder el foco del teclado)
  function refrescarPrecio(){
    if(prod.origen !== 'catalogo') return;
    const c = calcular(prod);
    if(!prod.precioManual && $('pPrecio')) $('pPrecio').value = c.total;
    const d = $('desglose');
    if(d) d.innerHTML = `Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}`;
  }

  function abrirProducto(it, index){
    prod = JSON.parse(JSON.stringify(it));
    if(it.fotoBlob) prod.fotoBlob = it.fotoBlob;
    prodIndex = index;
    prodSucio = false;
    pintarProducto();
    $('prodBody').scrollTop = 0;
    abrirHoja('sheetProducto');
  }
  antesDeCerrar.sheetProducto = () => !prodSucio || confirm('¿Salir sin agregar este producto?');

  $('prodBody').addEventListener('click', (e) => {
    const o = e.target.closest('.opt[data-g]');
    if(o){
      prodSucio = true;
      if(o.dataset.g === '__color'){
        prod.color = o.dataset.v;
        if(prod.tipo === 'Combo') prod.estado.ventanas_color = o.dataset.v;  // las ventanas van del mismo color
      }
      else prod.estado[o.dataset.g] = o.dataset.v;
      pintarProducto(); return;
    }
    const t = e.target.closest('.tchip[data-k]');
    if(t){ prodSucio = true; prod.estado[t.dataset.k] = !prod.estado[t.dataset.k]; pintarProducto(); return; }
    const c = e.target.closest('[data-cant]');
    if(c){
      prodSucio = true;
      const p = prod.origen === 'pieza' ? piezas.find(x => x.id === prod.pieza_id) : null;
      const max = p ? p.cantidad : 99;
      prod.cantidad = Math.min(max, Math.max(1, prod.cantidad + (+c.dataset.cant)));
      $('pCant').textContent = prod.cantidad; return;
    }
    if(e.target.closest('#usarSugerido')){ prod.precioManual = false; pintarProducto(); }
  });
  $('prodBody').addEventListener('input', (e) => {
    prodSucio = true;
    const el = e.target;
    if(el.dataset.mkey){ prod.estado[el.dataset.mkey] = el.value; refrescarPrecio(); return; }
    if(el.dataset.texto){ prod.estado[el.dataset.texto] = el.value; return; }
    if(el.id === 'pProt'){ prod.extraProteccion = el.value; $('campoProt').classList.remove('invalid'); refrescarPrecio(); return; }
    if(el.id === 'pPrecio'){ prod.precio = el.value; prod.precioManual = true; $('campoPrecio').classList.remove('invalid'); return; }
    if(el.id === 'pNombre'){ prod.nombre = el.value; $('campoMedNombre').classList.remove('invalid'); return; }
    if(el.id === 'pDesc'){ prod.descripcion = el.value; }
  });
  $('prodBody').addEventListener('change', async (e) => {
    if(e.target.id !== 'pFoto' || !e.target.files[0]) return;
    prodSucio = true;
    try{
      const blob = await comprimirFoto(e.target.files[0]);
      prod.fotoBlob = blob;
      prod.foto = URL.createObjectURL(blob);
      pintarProducto();
    } catch(err){ toast('No se pudo leer la foto', 'error'); }
  });

  $('btnProdListo').addEventListener('click', () => {
    let ok = true;
    if(prod.origen === 'medida' && !String(prod.nombre || '').trim()){ $('campoMedNombre').classList.add('invalid'); ok = false; }
    if($('campoProt') && !(montoOrNull(prod.extraProteccion) > 0)){ $('campoProt').classList.add('invalid'); ok = false; }
    const precio = montoOrNull($('pPrecio').value);
    if(!(precio > 0)){ $('campoPrecio').classList.add('invalid'); ok = false; }
    if(!ok){ const f = $('prodBody').querySelector('.field.invalid'); if(f) f.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    prod.precio = precio;
    if(prod.origen === 'catalogo'){
      prod.especificaciones = especificacionesDesdeEstado(prod.tipo, prod.estado, 'pedido');
      prod.foto = fotoModelo(modeloDe(prod), prod.color) || prod.foto || null;
    }
    if(prod.origen === 'medida') prod.nombre = prod.nombre.trim();
    if(prodIndex == null) items.push(prod); else items[prodIndex] = prod;
    prodSucio = false;
    cerrarHoja('sheetProducto', true);
    pintarItems();
    toast(prodIndex == null ? 'Producto agregado' : 'Producto actualizado');
  });

  // ---------------------------------------------------------------------------
  // Cliente: si el teléfono ya existe, se llenan sus datos
  // ---------------------------------------------------------------------------
  let buscarTimer = null, ultimaBusqueda = '';
  function programarBusqueda(){ clearTimeout(buscarTimer); buscarTimer = setTimeout(buscarCliente, 350); }
  $('cCedula').addEventListener('input', () => { $('campoCed').classList.remove('invalid'); programarBusqueda(); guardarBorrador(); });
  $('cTel').addEventListener('input', () => { $('campoTel').classList.remove('invalid'); programarBusqueda(); guardarBorrador(); });
  // Qué campos llenó la búsqueda (para poder limpiarlos si la cédula cambia)
  const auto = { nombre:false, tel:false, ced:false };
  async function buscarCliente(){
    const cedTxt = $('cCedula').value.trim();
    const ced = cedValida(cedTxt) ? normCed(cedTxt) : null;
    const tel = !cedTxt && telValido($('cTel').value) ? normTel($('cTel').value) : null;   // por teléfono solo si no hay cédula
    const clave = ced ? 'c' + ced : tel ? 't' + tel : '';
    if(clave === ultimaBusqueda) return;
    ultimaBusqueda = clave;
    let data = null;
    if(ced){ const r = await db.from('clientes').select('*').eq('cedula', ced).maybeSingle(); if(!r.error) data = r.data; }
    else if(tel){ const r = await db.from('clientes').select('*').eq('telefono', tel).maybeSingle(); if(!r.error) data = r.data; }
    if(clave !== ultimaBusqueda) return;   // llegó tarde: ya se escribió otra cosa
    if(data){
      clienteExistente = data;
      if(!ced && data.cedula){ $('cCedula').value = data.cedula; auto.ced = true; }
      if(data.telefono && (auto.tel || !$('cTel').value.trim() || ced)){ $('cTel').value = '0' + String(data.telefono).replace(/^58/, ''); auto.tel = true; }
      if(auto.nombre || !$('cNombre').value.trim() || ced){ $('cNombre').value = data.nombre || ''; auto.nombre = true; }
      ['campoCed', 'campoTel', 'campoNombreC'].forEach(id => $(id).classList.remove('invalid'));
      $('avisoCliente').innerHTML = `<div class="aviso-cliente">${ICON_CHECK}Ya es cliente. Sus datos se llenaron solos.</div>`;
    } else {
      // No existe: se quita lo que se había llenado de otro cliente
      if(clienteExistente){
        if(auto.nombre) $('cNombre').value = '';
        if(auto.tel) $('cTel').value = '';
        if(auto.ced) $('cCedula').value = '';
      }
      auto.nombre = auto.tel = auto.ced = false;
      clienteExistente = null;
      $('avisoCliente').innerHTML = '';
    }
    guardarBorrador();
  }
  $('cNombre').addEventListener('input', () => { auto.nombre = false; });
  $('cTel').addEventListener('input', () => { auto.tel = false; });
  $('cCedula').addEventListener('input', () => { auto.ced = false; });
  ['cNombre', 'vNotas'].forEach(id => $(id).addEventListener('input', () => {
    const f = $(id).closest('.field'); if(f) f.classList.remove('invalid');
    guardarBorrador();
  }));
  ['vDesc', 'vInst'].forEach(id => $(id).addEventListener('input', () => { pintarResumen(); guardarBorrador(); }));

  // Descuento e instalación: se activan tocando el botón y ahí aparece el monto
  function pintarExtrasCierre(enfocar){
    document.querySelectorAll('[data-extra]').forEach(b => { const on = extras[b.dataset.extra]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('campoDesc').classList.toggle('hidden', !extras.desc);
    $('campoInst').classList.toggle('hidden', !extras.inst);
    if(enfocar === 'desc' && extras.desc) $('vDesc').focus();
    if(enfocar === 'inst' && extras.inst) $('vInst').focus();
    pintarResumen();
  }
  document.querySelector('[data-extra]').parentElement.addEventListener('click', (e) => {
    const b = e.target.closest('[data-extra]');
    if(!b) return;
    extras[b.dataset.extra] = !extras[b.dataset.extra];
    pintarExtrasCierre(b.dataset.extra);
    guardarBorrador();
  });

  function pintarSedes(){
    $('optsSede').innerHTML = sedes.map(s => `<button type="button" class="opt ${s.id === sedeId ? 'selected' : ''}" data-sede="${s.id}" aria-pressed="${s.id === sedeId}">${esc(s.nombre)}</button>`).join('');
  }
  $('optsSede').addEventListener('click', (e) => { const b = e.target.closest('[data-sede]'); if(b){ sedeId = +b.dataset.sede; pintarSedes(); guardarBorrador(); } });

  // ---------------------------------------------------------------------------
  // Borrador: si se sale sin guardar, al volver se recupera
  // ---------------------------------------------------------------------------
  function hayDatos(){ return items.length || $('cTel').value.trim() || $('cNombre').value.trim() || $('cCedula').value.trim(); }
  function guardarBorrador(){
    if(terminado || !cargado || editId) return;
    try{
      if(!hayDatos()){ localStorage.removeItem(BORRADOR); return; }
      localStorage.setItem(BORRADOR, JSON.stringify({
        tel:$('cTel').value, nombre:$('cNombre').value, cedula:$('cCedula').value,
        desc:$('vDesc').value, inst:$('vInst').value, notas:$('vNotas').value, sedeId, extras,
        items: items.map(it => { const c = Object.assign({}, it); delete c.fotoBlob; if(c.origen === 'medida' && String(c.foto || '').startsWith('blob:')) c.foto = null; return c; })
      }));
    } catch(e){}
  }
  function cargarBorrador(){
    let b = null;
    try{ b = JSON.parse(localStorage.getItem(BORRADOR) || 'null'); } catch(e){}
    if(!b) return;
    $('cTel').value = b.tel || ''; $('cNombre').value = b.nombre || ''; $('cCedula').value = b.cedula || '';
    if(b.extras){ extras.desc = !!b.extras.desc; extras.inst = !!b.extras.inst; }
    $('vDesc').value = b.desc || ''; $('vInst').value = b.inst || ''; $('vNotas').value = b.notas || '';
    if(b.sedeId) sedeId = b.sedeId;
    // Las piezas de entrega inmediata que ya no están se quitan
    items = (b.items || []).filter(it => it.origen !== 'pieza' || piezas.some(p => p.id === it.pieza_id && p.cantidad >= it.cantidad));
    $('avisoBorrador').innerHTML = `<div class="borrador"><span>Seguimos con la venta que dejaste sin terminar.</span><button type="button" id="btnDescartar">Empezar de cero</button></div>`;
  }
  $('avisoBorrador').addEventListener('click', (e) => {
    if(!e.target.closest('#btnDescartar')) return;
    if(!confirm('¿Borrar lo que llevas y empezar de cero?')) return;
    limpiarTodo();
  });
  function limpiarTodo(){
    try{ localStorage.removeItem(BORRADOR); }catch(e){}
    ['cTel', 'cNombre', 'cCedula', 'vDesc', 'vInst', 'vNotas'].forEach(id => { $(id).value = ''; });
    extras.desc = false; extras.inst = false; pintarExtrasCierre();
    items = []; clienteExistente = null; ultimaBusqueda = '';
    sedeId = (perfil && perfil.sede_id) || (sedes[0] && sedes[0].id) || null;
    $('avisoCliente').innerHTML = ''; $('avisoBorrador').innerHTML = '';
    document.querySelectorAll('.field.invalid').forEach(f => f.classList.remove('invalid'));
    pintarSedes(); pintarItems();
  }

  // ---------------------------------------------------------------------------
  // Validar y guardar
  // ---------------------------------------------------------------------------
  function validar(){
    let primero = null;
    const marcar = (id, mal) => { $(id).classList.toggle('invalid', mal); if(mal && !primero) primero = $(id); };
    marcar('campoCed', !cedValida($('cCedula').value));
    marcar('campoTel', !telValido($('cTel').value));
    marcar('campoNombreC', !$('cNombre').value.trim());
    marcar('campoItems', !items.length);
    marcar('campoDesc', totales().total < 0);
    if(primero){ primero.scrollIntoView({ block:'center', behavior:'smooth' }); toast('Revisa lo que está en rojo', 'error'); return false; }
    return true;
  }

  async function subirFotos(){
    for(const it of items){
      if(it.origen !== 'medida' || !it.fotoBlob) continue;
      const path = `ventas/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await db.storage.from('catalogo-fotos').upload(path, it.fotoBlob, { contentType:'image/jpeg' });
      if(error) throw new Error('No se pudo subir la foto: ' + error.message);
      it.foto = db.storage.from('catalogo-fotos').getPublicUrl(path).data.publicUrl;
      delete it.fotoBlob;
    }
  }

  function payload(confirmar, abono){
    const t = totales();
    return {
      clave: claveVenta,
      cliente:{ telefono: normTel($('cTel').value), nombre: $('cNombre').value.trim(), cedula: normCed($('cCedula').value) },
      venta:{ sede_id: sedeId, descuento: t.desc, instalacion: t.inst, notas: $('vNotas').value.trim(), confirmar,
        fecha_entrega: abono ? abono.fecha : (editId && $('vFecha') && $('vFecha').value ? $('vFecha').value : null) },
      items: items.map(it => ({
        catalogo_id: it.origen === 'medida' ? null : it.catalogo_id,
        pieza_id: it.origen === 'pieza' ? it.pieza_id : null,
        a_medida: it.origen === 'medida',
        tipo: it.tipo,
        nombre: it.nombre,
        especificaciones: it.origen === 'medida'
          ? { descripcion: it.descripcion || '' }
          : Object.assign({}, it.especificaciones, it.color ? { color: it.color } : {},
              it.origen === 'catalogo' && pideMontoProteccion(it) ? { monto_proteccion: montoOrNull(it.extraProteccion) } : {}),
        foto: it.foto || null,
        precio_unitario: montoOrNull(it.precio) || 0,
        cantidad: it.cantidad || 1
      })),
      abono: abono ? { monto: abono.monto, metodo: abono.metodo, comprobante: abono.comprobante || null, clave: abono.clave } : null
    };
  }

  async function guardar(confirmar, abono, boton){
    if(guardando) return;
    guardando = true;
    const txt = boton.textContent;
    boton.disabled = true;
    boton.innerHTML = '<span class="spinner"></span>Guardando';
    try{
      await subirFotos();
      if(abono && abono.comprobanteBlob && !abono.comprobante){
        const path = `${new Date().toISOString().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await db.storage.from('comprobantes').upload(path, abono.comprobanteBlob, { contentType:'image/jpeg' });
        if(error) throw new Error('No se pudo subir el comprobante: ' + error.message);
        abono.comprobante = path;
      }
      const p = payload(confirmar, abono);
      const { data, error } = await db.rpc('crear_venta', { p });
      if(error) throw new Error(error.message);
      terminado = true;
      try{ localStorage.removeItem(BORRADOR); }catch(e){}
      if(confirmar) cerrarHoja('sheetConfirmar', true);
      mostrarListo(data, p, abono);
    } catch(err){
      const m = String(err.message || '');
      toast(/fetch|network/i.test(m) ? 'Sin conexión. Tus datos siguen aquí, intenta de nuevo' : m || 'No se pudo guardar', 'error');
    } finally {
      guardando = false;
      boton.disabled = false;
      boton.textContent = txt;
    }
  }

  $('btnGuardar').addEventListener('click', () => {
    if(!validar()) return;
    if(editId && $('vFecha') && !$('vFecha').value){ $('campoFechaEd').classList.add('invalid'); $('campoFechaEd').scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    if(editId) guardarEdicion(); else abrirHoja('sheetGuardar');
  });
  async function guardarEdicion(){
    if(guardando) return;
    guardando = true;
    const btn = $('btnGuardar');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Guardando';
    try{
      await subirFotos();
      const p = payload(false, null);
      const { error } = await db.rpc('actualizar_venta', { vid: editId, p });
      if(error) throw new Error(error.message);
      terminado = true;
      toast('Cambios guardados');
      setTimeout(() => {
        if(window.Sesion.esSubpantalla()) history.back();
        else location.replace(editVenta && editVenta.estado === 'cotizacion' ? 'cotizaciones.html' : 'ventas.html');
      }, 500);
    } catch(err){
      const m = String(err.message || '');
      toast(/fetch|network/i.test(m) ? 'Sin conexión. Tus cambios siguen aquí, intenta de nuevo' : m, 'error');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
    } finally { guardando = false; }
  }
  $('optCotizacion').addEventListener('click', () => {
    cerrarHoja('sheetGuardar', true);
    guardar(false, null, $('btnGuardar'));
  });
  $('optVenta').addEventListener('click', () => {
    cerrarHoja('sheetGuardar', true);
    const t = totales();
    conf = { monto: String(Math.round(t.total * 0.5 * 100) / 100), metodo:null, fecha: habiles(20), comprobante:null, blob:null, clave: conf && conf.clave ? conf.clave : uuid() };
    pintarConfirmar();
    abrirHoja('sheetConfirmar');
  });

  // ---------------------------------------------------------------------------
  // Confirmar venta: abono, método y fecha de entrega
  // ---------------------------------------------------------------------------
  let conf = null;
  function iso(d){ const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
  function hoyISO(){ return iso(new Date()); }
  // N días hábiles desde hoy, sin contar sábados ni domingos
  function habiles(n){
    const d = new Date();
    let k = 0;
    while(k < n){ d.setDate(d.getDate() + 1); const w = d.getDay(); if(w !== 0 && w !== 6) k++; }
    return iso(d);
  }
  function pintarConfirmar(){
    const t = totales();
    $('confBody').innerHTML = `
      <div class="conf-total"><span>Total de la venta</span><b>${dinero(t.total)}</b></div>
      <div class="field" id="campoAbono"><label class="field-label" for="aMonto">Abono en dólares</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="aMonto" type="text" inputmode="decimal" autocomplete="off" value="${esc(conf.monto)}"></div>
        <div class="field-error" id="errAbono">Escribe el abono</div>
        <div id="avisoAbono"></div>
      </div>
      <div class="field" id="campoMetodo"><span class="field-label">Cómo pagó</span>
        <div class="opts" style="--cols:2">${METODOS.map(x => `<button type="button" class="opt ${x === conf.metodo ? 'selected' : ''}" data-metodo="${x}" aria-pressed="${x === conf.metodo}">${x}</button>`).join('')}</div>
        <div class="field-error">Elige cómo pagó</div>
      </div>
      <div class="field"><span class="field-label">Comprobante (opcional)</span>
        <div class="photos single"><label class="photo-box ${conf.comprobante ? 'filled' : ''}" style="aspect-ratio:3/1">
          ${conf.comprobante ? `<img src="${esc(conf.comprobante)}" alt=""><span class="photo-tag">Cambiar comprobante</span>` : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>Foto o captura del pago</span>`}
          <input type="file" accept="image/*" id="aComprobante" aria-label="Comprobante de pago"></label></div>
      </div>
      <div class="field" id="campoFecha"><label class="field-label" for="aFecha">Fecha de entrega</label>
        <input class="input" id="aFecha" type="date" min="${hoyISO()}" value="${esc(conf.fecha)}">
        <div class="field-hint">20 días hábiles desde hoy, sin sábados ni domingos. La puedes cambiar.</div>
        <div class="field-error">Elige la fecha de entrega</div>
      </div>`;
    avisoAbono();
  }
  function avisoAbono(){
    const t = totales().total;
    const m = montoOrNull(conf.monto) || 0;
    let html = '';
    if(m > t) html = '';
    else if(m > 0 && m < t * 0.5) html = `<div class="aviso-50">${ICON_ALERTA}Abono menor al 50%</div>`;
    if(m > 0 && m <= t) html += `<div class="resta">Resta por pagar: <b>${dinero(r2(t - m))}</b></div>`;
    $('avisoAbono').innerHTML = html;
    $('errAbono').textContent = m > t ? 'El abono es mayor que el total' : 'Escribe el abono';
    $('campoAbono').classList.toggle('invalid', m > t);
  }
  $('confBody').addEventListener('input', (e) => {
    if(e.target.id === 'aMonto'){ conf.monto = e.target.value; avisoAbono(); }
    if(e.target.id === 'aFecha'){ conf.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
  });
  $('confBody').addEventListener('change', async (e) => {
    if(e.target.id === 'aFecha'){ conf.fecha = e.target.value; $('campoFecha').classList.remove('invalid'); }
    if(e.target.id === 'aComprobante' && e.target.files[0]){
      try{
        conf.blob = await comprimirFoto(e.target.files[0], 1600, 0.8);
        conf.comprobante = URL.createObjectURL(conf.blob);
        const scroll = $('confBody').scrollTop; pintarConfirmar(); $('confBody').scrollTop = scroll;
      } catch(err){ toast('No se pudo leer la foto', 'error'); }
    }
  });
  $('confBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-metodo]');
    if(!b) return;
    conf.metodo = b.dataset.metodo;
    document.querySelectorAll('#confBody [data-metodo]').forEach(x => { const s = x === b; x.classList.toggle('selected', s); x.setAttribute('aria-pressed', s); });
    $('campoMetodo').classList.remove('invalid');
  });
  $('btnConfListo').addEventListener('click', (e) => {
    const t = totales().total;
    const m = montoOrNull(conf.monto) || 0;
    let primero = null;
    const marcar = (id, mal) => { $(id).classList.toggle('invalid', mal); if(mal && !primero) primero = $(id); };
    marcar('campoAbono', !(m > 0) || m > t);
    marcar('campoMetodo', !conf.metodo);
    marcar('campoFecha', !conf.fecha || conf.fecha < hoyISO());
    if(primero){ primero.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    guardar(true, { monto: r2(m), metodo: conf.metodo, fecha: conf.fecha, comprobanteBlob: conf.blob, clave: conf.clave }, e.currentTarget);
  });

  // ---------------------------------------------------------------------------
  // Listo: resumen y mensaje por WhatsApp para el cliente
  // ---------------------------------------------------------------------------
  function fechaLarga(iso){
    if(!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-VE', { day:'numeric', month:'long' });
  }
  function mensajeCliente(res, p, abono){
    const nombre = p.cliente.nombre.split(' ')[0];
    const lineas = [];
    const esVenta = !!abono;
    lineas.push(`Hola ${nombre}, te saluda Herrería Artesanos.`);
    lineas.push(esVenta ? `Confirmamos tu pedido N° ${res.id}:` : `Esta es tu cotización N° ${res.id}:`);
    lineas.push('');
    items.forEach(it => {
      const det = it.origen === 'medida' ? (it.descripcion || '') : detalleItem(it);
      lineas.push(`• ${it.cantidad > 1 ? it.cantidad + ' × ' : ''}*${it.nombre}*${det ? ' (' + det + ')' : ''}: ${dinero(subtotalItem(it))}`);
    });
    const t = totales();
    if(t.inst) lineas.push(`• Instalación o traslado: ${dinero(t.inst)}`);
    if(t.desc) lineas.push(`• Descuento: -${dinero(t.desc)}`);
    lineas.push('', `*Total: ${dinero(res.total)}*`);
    if(esVenta){
      lineas.push(`Abono: ${dinero(abono.monto)} (${abono.metodo})`, `Resta por pagar: ${dinero(r2(res.total - abono.monto))}`);
      lineas.push('', `Fecha de entrega: ${fechaLarga(abono.fecha)}`);
    } else {
      const v = new Date(); v.setDate(v.getDate() + 20);
      lineas.push('', `Precios válidos hasta el ${v.toLocaleDateString('es-VE', { day:'numeric', month:'long' })}.`);
    }
    lineas.push('', 'Gracias por preferirnos.');
    return lineas.join('\n');
  }
  function mostrarListo(res, p, abono){
    const esVenta = !!abono;
    $('pie').classList.add('hidden');
    $('subVenta').textContent = esVenta ? 'Venta confirmada' : 'Cotización guardada';
    const texto = mensajeCliente(res, p, abono);
    const wa = `https://wa.me/${p.cliente.telefono}?text=${encodeURIComponent(texto)}`;
    $('pagina').innerHTML = `
      <div class="listo">
        <div class="listo-ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div>
        <h1>${esVenta ? 'Venta confirmada' : 'Cotización guardada'}</h1>
        <p>N° ${res.id} · ${esc(p.cliente.nombre)}</p>
      </div>
      <div class="resumen listo-datos">
        <div class="res-fila"><span>Productos</span><b>${items.length}</b></div>
        ${esVenta ? `<div class="res-fila"><span>Abono (${esc(abono.metodo)})</span><b>${dinero(abono.monto)}</b></div>
          <div class="res-fila"><span>Resta por pagar</span><b>${dinero(r2(res.total - abono.monto))}</b></div>
          <div class="res-fila"><span>Entrega</span><b>${esc(fechaLarga(abono.fecha))}</b></div>`
          : `<div class="res-fila"><span>Válida por</span><b>20 días</b></div>`}
        <div class="res-total"><span>Total</span><b>${dinero(res.total)}</b></div>
      </div>
      <div class="listo-btns">
        <button class="btn-wa" type="button" id="btnPdf" disabled><span class="spinner"></span>Preparando PDF</button>
        <a class="link-simple" href="${esc(wa)}" target="_blank" rel="noopener" style="text-align:center;margin-top:0">Mandar solo el resumen en texto</a>
        <button class="btn-secondary" type="button" id="btnOtra" style="height:54px">Hacer otra venta</button>
        <button class="link-simple" type="button" id="btnIrInicio">Volver a Inicio</button>
      </div>`;
    window.scrollTo(0, 0);
    $('btnOtra').addEventListener('click', () => {
      try{ sessionStorage.setItem(window.Sesion.esSubpantalla() ? 'ah_sub' : 'ah_desdeInicio', '1'); }catch(e){}
      location.replace('venta.html');
    });
    $('btnIrInicio').addEventListener('click', () => window.Sesion.irInicio());
    // El PDF se prepara de una vez para que al tocar "Enviar" se abra WhatsApp enseguida
    let blob = null, venta = null;
    (async () => {
      try{
        venta = await window.AV.cargarVenta(res.id);
        blob = await window.AV.crearPDF(venta);
        const b = $('btnPdf'); if(!b) return;
        b.disabled = false; b.innerHTML = `${ICON_WA}Enviar PDF al cliente`;
      } catch(e){
        const b = $('btnPdf'); if(b){ b.innerHTML = 'No se pudo preparar el PDF'; }
      }
    })();
    $('btnPdf').addEventListener('click', async () => {
      if(!blob) return;
      const r = await window.AV.compartirPDF(blob, venta);
      if(r === 'descargado') toast('PDF descargado');
    });
  }

  // ---------------------------------------------------------------------------
  // Salir
  // ---------------------------------------------------------------------------
  $('btnSalirVenta').addEventListener('click', () => {
    // Lo escrito queda guardado como borrador y se recupera al volver
    if(window.Sesion.esSubpantalla()) history.back(); else window.Sesion.irInicio();
  });

  window.addEventListener('scroll', () => $('topbar').classList.toggle('scrolled', window.scrollY > 4), { passive:true });

  // ---------------------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------------------
  async function cargarEdicion(){
    const v = await window.AV.cargarVenta(editId);
    editVenta = v;
    const cot = v.estado === 'cotizacion';
    document.title = `Editar N° ${v.id} · Herrería Artesanos`;
    document.querySelector('.topbar-title').textContent = cot ? `Editar cotización` : `Editar venta`;
    $('subVenta').textContent = `N° ${v.id} · ${v.cliente.nombre}`;
    $('btnGuardar').textContent = 'Guardar cambios';
    const editable = ['cotizacion', 'confirmada', 'lista'].includes(v.estado);
    if(!editable){
      $('pagina').innerHTML = `<div class="listo"><h1>Ya no se puede editar</h1><p>Esta venta está ${esc(window.AV.ESTADOS[v.estado].t.toLowerCase())}.</p></div>`;
      $('pie').classList.add('hidden');
      return false;
    }
    if(!cot){
      // En una venta confirmada también se puede mover la fecha de entrega
      const f = document.createElement('div');
      f.className = 'field'; f.id = 'campoFechaEd';
      f.innerHTML = `<label class="field-label" for="vFecha">Fecha de entrega</label><input class="input" id="vFecha" type="date" value="${esc(v.fecha_entrega || '')}"><div class="field-error">Elige la fecha de entrega</div>`;
      $('optsSede').closest('.field').before(f);
    }
    $('cCedula').value = v.cliente.cedula || '';
    $('cTel').value = v.cliente.telefono ? '0' + String(v.cliente.telefono).replace(/^58/, '') : '';
    $('cNombre').value = v.cliente.nombre || '';
    $('vNotas').value = v.notas || '';
    if(Number(v.descuento)){ extras.desc = true; $('vDesc').value = Number(v.descuento); }
    if(Number(v.instalacion)){ extras.inst = true; $('vInst').value = Number(v.instalacion); }
    if(v.sede_id) sedeId = v.sede_id;
    clienteExistente = v.cliente;
    ultimaBusqueda = $('cCedula').value.trim() ? 'c' + normCed($('cCedula').value) : 't' + normTel($('cTel').value);
    items = v.items.map(it => {
      const e = it.especificaciones || {};
      const base = { tipo: it.tipo, nombre: it.nombre, foto: it.foto, precio: Number(it.precio_unitario), cantidad: it.cantidad };
      if(it.a_medida) return Object.assign(base, { origen:'medida', descripcion: e.descripcion || '' });
      if(it.pieza_id) return Object.assign(base, { origen:'pieza', pieza_id: it.pieza_id, catalogo_id: it.catalogo_id, color: e.color || null, especificaciones: e, precioManual:true, fijo: !cot });
      return Object.assign(base, { origen:'catalogo', catalogo_id: it.catalogo_id, color: e.color || null, especificaciones: e,
        estado: estadoDesdeEspecificaciones(it.tipo, e, 'pedido'), extraProteccion: e.monto_proteccion || '', precioManual:true });
    });
    auto.nombre = auto.tel = auto.ced = false;
    if(!cot) $('avisoBorrador').innerHTML = `<div class="borrador"><span>Es una venta confirmada: lo que cambies se refleja en el pedido y el PDF.</span></div>`;
  }

  (async function(){
    pintarItems();
    try{
      const [rc, rp, rs, pf] = await Promise.all([
        db.from('catalogo').select('*').order('nombre', { ascending:true }),
        db.from('disponibles').select('*').eq('estado', 'disponible').gt('cantidad', 0).order('id', { ascending:true }),
        db.from('sedes').select('*').eq('activa', true).order('orden', { ascending:true }),
        window.Sesion.perfil()
      ]);
      const err = rc.error || rp.error || rs.error;
      if(err) throw err;
      modelos = rc.data || []; piezas = rp.data || []; sedes = rs.data || []; perfil = pf;
      sedeId = (perfil && perfil.sede_id) || (sedes[0] && sedes[0].id) || null;
      if(editId){ if(await cargarEdicion() === false){ cargado = true; return; } } else cargarBorrador();
      cargado = true;
      pintarExtrasCierre();
      pintarSedes();
      pintarItems();
      if($('cTel').value || $('cCedula').value) buscarCliente();
    } catch(e){
      cargado = true;
      toast('Sin conexión. Revisa tu internet y vuelve a entrar', 'error');
    }
  })();
})();
