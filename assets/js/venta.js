// Nueva venta: cliente, productos y cierre. Guarda como cotización o confirma con abono.
(function(){
  'use strict';
  const db = window.db;
  const { TIPOS, iconoTipo, acabados, tieneColores, especificacionesDesdeEstado,
          estadoDesdeEspecificaciones, resumenSpecs, fotoModelo, fotoPieza, esc, dinero, toast,
          abrirHoja, cerrarHoja, antesDeCerrar, montoOrNull } = window.AH;
  const $ = (id) => document.getElementById(id);

  const SP = window.SpecsProducto;   // especificaciones y precio sugerido (compartido con Producción)
  const METODOS = ['Binance', 'Zelle', 'Bolívares', 'Efectivo'];
  const BORRADOR = 'ah_borrador_venta';
  const NUMERO_NEGOCIO = '584220167079';

  let modelos = [], piezas = [], sedes = [], perfil = null;
  let items = [];           // productos de la venta
  let sedeId = null;
  const extras = { inst:false, tras:false };   // instalación y traslado: opcionales, cada uno con su monto
  let clienteExistente = null;
  let guardando = false;
  let terminado = false;
  let cargado = false;
  // Cotización: solo lo que cambia el precio. Venta: también los detalles para fabricar.
  let modo = 'cotizacion';
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
    const desc = montoOrNull($('vDesc').value) || 0;
    const inst = extras.inst ? (montoOrNull($('vInst').value) || 0) : 0;
    const tras = extras.tras ? (montoOrNull($('vTras').value) || 0) : 0;
    return { sub, desc, inst, tras, total: r2(sub - desc + inst + tras) };
  }
  function pintarResumen(){
    const t = totales();
    $('resumen').innerHTML = `
      <div class="res-fila"><span>Productos</span><b>${dinero(t.sub)}</b></div>
      ${t.desc ? `<div class="res-fila"><span>Descuento</span><b>- ${dinero(t.desc)}</b></div>` : ''}
      ${t.inst ? `<div class="res-fila"><span>Instalación</span><b>${dinero(t.inst)}</b></div>` : ''}
      ${t.tras ? `<div class="res-fila"><span>Traslado</span><b>${dinero(t.tras)}</b></div>` : ''}
      <div class="res-total"><span>Total</span><b>${dinero(t.total)}</b></div>`;
    $('pieTotal').textContent = dinero(t.total);
    $('campoDesc').classList.toggle('invalid', t.total < 0);
  }

  // ---------------------------------------------------------------------------
  // Lista de productos de la venta
  // ---------------------------------------------------------------------------
  function detalleItem(it){
    const partes = [];
    if(it.origen === 'medida'){
      if(!conSpecs(it)) return it.descripcion || 'Trabajo a medida';
      const p = [];
      if(it.color && tieneColores(it.tipo)) p.push(it.color);
      resumenSpecs(it.tipo, it.especificaciones).forEach(x => p.push(x.t));
      if(it.descripcion) p.push(it.descripcion);
      return p.join(' · ');
    }
    if(it.color && tieneColores(it.tipo)) partes.push(it.color);
    resumenSpecs(it.tipo, it.especificaciones).forEach(s => partes.push(s.t));
    if(it.origen === 'pieza') partes.unshift('Entrega inmediata');
    return partes.join(' · ');
  }
  const yaHechoTxt = (it) => it.yaHecho ? 'Ya está hecho · ' : '';
  // En modo venta, qué productos todavía no tienen sus detalles para fabricar
  // Lo que ya está hecho (solo se entrega) no pide detalles para fabricar
  const faltanDe = (it) => SP.faltanEn(it, it.yaHecho ? 'cotizacion' : modo);
  const faltaItem = (it) => !it.bloqueado && faltanDe(it).length > 0;   // lo que ya tiene pasos terminados no se toca
  function pintarItems(){
    $('items').innerHTML = items.length ? items.map((it, i) => `
      <div class="item ${faltaItem(it) ? 'falta' : ''}" style="--i:${i}">
        <div class="item-foto">${it.foto ? window.AH.imgMini(it.foto, "", it.tipo) : iconoTipo(it.tipo, 26)}</div>
        <div class="item-txt">
          <div class="item-nombre">${esc(it.nombre)}</div>
          <div class="item-det">${esc(yaHechoTxt(it) + detalleItem(it))}</div>
          ${it.bloqueado ? '<div class="item-bloq">Ya tiene pasos terminados: no se cambia</div>' : ''}
          <div class="item-pie">
            <span class="item-cant">${it.cantidad} × ${dinero(it.precio)}</span>
            <span class="item-precio">${dinero(subtotalItem(it))}</span>
          </div>
          ${faltaItem(it) ? `<button type="button" class="item-falta" data-editar="${i}">${ICON_ALERTA}Completar detalles</button>` : ''}
        </div>
        ${it.bloqueado ? '' : `<div class="item-acc">
          <button type="button" data-editar="${i}" aria-label="Editar ${esc(it.nombre)}">${ICON_EDIT}</button>
          <button type="button" class="quitar" data-quitar="${i}" aria-label="Quitar ${esc(it.nombre)}">${ICON_DEL}</button>
        </div>`}
      </div>`).join('')
      : '<div class="vacio-items">Todavía no hay productos.<br>Toca "Agregar producto".</div>';
    if(items.length) $('campoItems').classList.remove('invalid');
    pintarResumen();
    guardarBorrador();
  }
  $('items').addEventListener('click', (e) => {
    const ed = e.target.closest('[data-editar]');
    if(ed){ const it = items[+ed.dataset.editar]; abrirProducto(it, +ed.dataset.editar, faltaItem(it)); return; }
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
    if(o === 'medida') abrirProducto({ origen:'medida', tipo:null, nombre:'', descripcion:'', precio:'', precioManual:false, cantidad:1, foto:null, estado:{}, color:null }, null);
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
        <span class="item-foto">${f ? window.AH.imgMini(f, "", m.tipo) : iconoTipo(m.tipo, 24)}</span>
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
      estado: estadoDesdeEspecificaciones(m.tipo, m.especificaciones_base, 'pedido', true),
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
        <span class="item-foto">${f ? window.AH.imgMini(f, "", m && m.tipo) : iconoTipo(m ? m.tipo : '', 24)}</span>
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
  // Para la ayuda: qué producto se está viendo (sale solo lo de ese tipo)
  window.AyudaVenta = () => ({ origen: prod ? prod.origen : null, tipo: prod ? prod.tipo : null, modo });

  function modeloDe(it){ return modelos.find(x => x.id === it.catalogo_id) || null; }
  // A medida con tipo del catálogo: lleva las mismas especificaciones. "Otro" solo lleva descripción.
  function conSpecs(it){ return it.origen !== 'medida' || TIPOS.includes(it.tipo); }
  // Precio sugerido: catálogo siempre; a medida solo la ventana (por m²)
  function llevaCalculo(it){ return it.origen === 'catalogo' || (it.origen === 'medida' && it.tipo === 'Ventana'); }

  // Especificaciones y precio: el mismo motor que usa Producción (specs-producto.js)
  const calcular = (it) => SP.calcular(it, modeloDe(it));
  const specsHtml = () => SP.specsHtml(prod, modeloDe(prod), { modo, marcar: !!prod.marcar, atajo: true });

  function cantidadHtml(max){
    if(prod.fijo) return `<div class="field"><span class="field-label">Cantidad</span><div class="f-fijo">${prod.cantidad} (ya vendida)</div></div>`;
    return `<div class="field"><span class="field-label">Cantidad</span>
      <div class="stepper"><button type="button" data-cant="-1" aria-label="Una menos">−</button><span id="pCant">${prod.cantidad}</span><button type="button" data-cant="1" aria-label="Una más">+</button></div>
      ${max ? `<div class="field-hint">Hay ${max} en tienda.</div>` : ''}</div>`;
  }
  function precioHtml(){
    const conCalculo = llevaCalculo(prod);
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
      const elegido = prod.tipo === 'A medida' ? 'Otro' : prod.tipo;
      html = `<div class="field" id="campoMedTipo">${SP.optsCuerpo({ g:'__tipo', label:'¿Qué vas a fabricar?', cols:2, opts:[...TIPOS.filter(t => t !== 'Combo' || prod.tipo === 'Combo'), 'Otro'].map(t => ({ v:t })) }, elegido)}
        <div class="field-error">Elige qué vas a fabricar</div></div>`;
      if(!prod.tipo){ html += '<div class="field-hint" style="margin-top:-6px">Así se piden las mismas medidas y detalles que en el catálogo.</div>'; }
      else {
      const otro = !conSpecs(prod);
      if(!otro) html += specsHtml();
      html += `
        <div class="field"><span class="field-label">Foto que trae el cliente</span>
          <div class="photos single"><label class="photo-box ${prod.foto ? 'filled' : ''}">
            ${prod.foto ? `<img src="${esc(prod.foto)}" alt=""><span class="photo-tag">Cambiar foto</span>` : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>Tomar o elegir foto</span>`}
            <input type="file" accept="image/*" id="pFoto" aria-label="Foto del trabajo"></label></div>
          <div class="field-hint">Opcional. No se guarda en el catálogo.</div></div>
        ${otro ? `<div class="field" id="campoMedNombre"><label class="field-label" for="pNombre">Qué es</label>
          <input class="input" id="pNombre" type="text" autocomplete="off" value="${esc(prod.nombre)}" placeholder="Reja para ventana, escalera">
          <div class="field-error">Escribe qué es</div></div>`
        : `<div class="field"><label class="field-label" for="pNombre">Nombre (opcional)</label>
          <input class="input" id="pNombre" type="text" autocomplete="off" value="${esc(prod.nombre)}" placeholder="${esc(prod.tipo)} a medida"></div>`}
        <div class="field"><span class="field-label">¿Hay que fabricarlo?</span>
          <div class="toggles"><button type="button" class="tchip ${prod.yaHecho ? 'on' : ''}" data-ya-hecho aria-pressed="${!!prod.yaHecho}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>Ya está hecho, solo se entrega</button></div>
          <div class="field-hint">${prod.yaHecho ? 'No va al taller ni aparece en Producción.' : 'Márcalo si la pieza ya existe y solo falta entregarla.'}</div></div>
        <div class="field"><label class="field-label" for="pDesc">Detalles (opcional)</label>
          <textarea class="input" id="pDesc" rows="3" placeholder="${otro ? 'Medidas, color y lo que pidió el cliente' : 'Lo que pidió el cliente y no aparece arriba'}">${esc(prod.descripcion || '')}</textarea></div>
        ${cantidadHtml()}${precioHtml()}`;
      }
    } else {
      const m = modeloDe(prod);
      const foto = prod.origen === 'pieza' ? prod.foto : fotoModelo(m, prod.color);
      $('prodTitulo').textContent = prodIndex == null ? (prod.origen === 'pieza' ? 'Pieza de entrega inmediata' : 'Producto del catálogo') : 'Editar producto';
      html = `<div class="prod-cab">
          <div class="item-foto">${foto ? window.AH.imgMini(foto, "", prod.tipo) : iconoTipo(prod.tipo, 28)}</div>
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
    $('btnProdListo').textContent = prodIndex != null ? 'Guardar cambios' : modo === 'venta' ? 'Agregar a la venta' : 'Agregar a la cotización';
  }

  // Solo se actualiza el precio (sin repintar todo, para no perder el foco del teclado)
  function refrescarPrecio(){
    if(!llevaCalculo(prod)) return;
    const c = calcular(prod);
    if(!prod.precioManual && $('pPrecio')) $('pPrecio').value = c.total;
    const d = $('desglose');
    if(d) d.innerHTML = `Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}`;
  }

  // marcar: se abre con lo que falta ya en rojo
  function abrirProducto(it, index, marcar){
    prod = JSON.parse(JSON.stringify(it));
    if(it.fotoBlob) prod.fotoBlob = it.fotoBlob;
    prod.marcar = !!marcar;
    prodIndex = index;
    prodSucio = false;
    pintarProducto();
    $('prodBody').scrollTop = 0;
    abrirHoja('sheetProducto');
    // Lo que falta se ve de una vez
    if(marcar) setTimeout(() => { const f = $('prodBody').querySelector('.field.invalid'); if(f) f.scrollIntoView({ block:'center', behavior:'smooth' }); }, 320);
  }
  antesDeCerrar.sheetProducto = () => !prodSucio || confirm('¿Salir sin agregar este producto?');

  $('prodBody').addEventListener('click', async (e) => {
    const at = e.target.closest('[data-atajo-medidas]');
    if(at){ if(await SP.guardarAtajoMedidas(modeloDe(prod), at)) pintarProducto(); return; }
    if(e.target.closest('[data-ya-hecho]')){ prodSucio = true; prod.yaHecho = !prod.yaHecho; prod.marcar = false; pintarProducto(); return; }
    const o = e.target.closest('.opt[data-g]');
    if(o){
      prodSucio = true;
      if(o.dataset.g === '__tipo'){
        const t = o.dataset.v;
        prod.tipo = t === 'Otro' ? 'A medida' : t;
        prod.marcar = false;
        prod.precioManual = false;
        prod.precio = '';                                              // el precio de otro tipo no sirve
        if(/ a medida$/.test(prod.nombre || '')) prod.nombre = '';     // nombre automático del tipo anterior
        if(t !== 'Otro'){
          prod.estado = estadoDesdeEspecificaciones(t, {}, 'pedido', true);
          const col = acabados(t).find(a => a.sw);
          prod.color = tieneColores(t) && col ? col.key : null;
        } else { prod.estado = {}; prod.color = null; }
        $('campoMedTipo').classList.remove('invalid');
        pintarProducto(); return;
      }
      SP.tocar(prod, o);
      pintarProducto(); return;
    }
    if(SP.tocar(prod, e.target)){ prodSucio = true; pintarProducto(); return; }
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
    if(el.dataset.atajo !== undefined){ const er = $('atajoError'); if(er) er.style.display = ''; return; }
    if(el.dataset.mkey || el.dataset.texto || el.id === 'pProt' || el.id === 'pSoloProt' || el.id === 'pMarco'){ if(SP.escribir(prod, el)) refrescarPrecio(); return; }
    if(el.id === 'pPrecio'){ prod.precio = el.value; prod.precioManual = true; $('campoPrecio').classList.remove('invalid'); return; }
    if(el.id === 'pNombre'){ prod.nombre = el.value; if($('campoMedNombre')) $('campoMedNombre').classList.remove('invalid'); return; }
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
    if(prod.origen === 'medida' && !prod.tipo){ $('campoMedTipo').classList.add('invalid'); $('campoMedTipo').scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    if($('campoMedNombre') && !String(prod.nombre || '').trim()){ $('campoMedNombre').classList.add('invalid'); ok = false; }
    SP.montosFaltan(prod, modeloDe(prod)).forEach(id => { if($(id)){ $(id).classList.add('invalid'); ok = false; } });
    const precio = montoOrNull($('pPrecio').value);
    if(!(precio > 0)){ $('campoPrecio').classList.add('invalid'); ok = false; }
    const falta = SP.faltaEnModelo(prod, modeloDe(prod));
    if(falta){ toast(falta, 'error'); const a = $('prodBody').querySelector('.aviso-falta'); if(a) a.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    // Aluminio de la ventana siempre; al vender, también los detalles para fabricar
    const faltan = faltanDe(prod);
    if(faltan.length){
      prod.marcar = true;
      pintarProducto();
      const f = $('prodBody').querySelector('.field.invalid'); if(f) f.scrollIntoView({ block:'center', behavior:'smooth' });
      toast(faltan.length === 1 && faltan[0] === 'aluminio' ? 'Elige el aluminio' : 'Faltan detalles para fabricar', 'error');
      return;
    }
    if(!ok){ const f = $('prodBody').querySelector('.field.invalid'); if(f) f.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    prod.precio = precio;
    if(prod.origen === 'catalogo'){
      prod.especificaciones = especificacionesDesdeEstado(prod.tipo, prod.estado, 'pedido');
      prod.foto = fotoModelo(modeloDe(prod), prod.color) || prod.foto || null;
    }
    if(prod.origen === 'medida'){
      prod.nombre = String(prod.nombre || '').trim() || prod.tipo + ' a medida';
      prod.especificaciones = conSpecs(prod) ? especificacionesDesdeEstado(prod.tipo, prod.estado, 'pedido') : {};
    }
    delete prod.marcar;
    if(prod.id) prod.tocado = true;   // al editar una venta en fabricación: este producto cambió
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
  ['vDesc', 'vInst', 'vTras'].forEach(id => $(id).addEventListener('input', () => { pintarResumen(); guardarBorrador(); }));

  // Instalación y traslado: se activan tocando el botón y ahí aparece su monto
  function pintarExtrasCierre(enfocar){
    document.querySelectorAll('[data-extra]').forEach(b => { const on = extras[b.dataset.extra]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('campoInst').classList.toggle('hidden', !extras.inst);
    $('campoTras').classList.toggle('hidden', !extras.tras);
    if(enfocar === 'inst' && extras.inst) $('vInst').focus();
    if(enfocar === 'tras' && extras.tras) $('vTras').focus();
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
        desc:$('vDesc').value, inst:$('vInst').value, tras:$('vTras').value, notas:$('vNotas').value, sedeId, extras, modo,
        items: items.map(it => { const c = Object.assign({}, it); delete c.fotoBlob; if(c.origen === 'medida' && String(c.foto || '').startsWith('blob:')) c.foto = null; return c; })
      }));
    } catch(e){}
  }
  function cargarBorrador(){
    let b = null;
    try{ b = JSON.parse(localStorage.getItem(BORRADOR) || 'null'); } catch(e){}
    if(!b) return;
    $('cTel').value = b.tel || ''; $('cNombre').value = b.nombre || ''; $('cCedula').value = b.cedula || '';
    if(b.extras){ extras.inst = !!b.extras.inst; extras.tras = !!b.extras.tras; if(b.extras.desc === false) b.desc = ''; }   // borradores viejos: descuento apagado no cuenta
    $('vDesc').value = b.desc || ''; $('vInst').value = b.inst || ''; $('vTras').value = b.tras || ''; $('vNotas').value = b.notas || '';
    if(b.sedeId) sedeId = b.sedeId;
    if(b.modo === 'venta' || b.modo === 'cotizacion') modo = b.modo;
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
    ['cTel', 'cNombre', 'cCedula', 'vDesc', 'vInst', 'vTras', 'vNotas'].forEach(id => { $(id).value = ''; });
    extras.inst = false; extras.tras = false; pintarExtrasCierre();
    items = []; clienteExistente = null; ultimaBusqueda = '';
    modo = 'cotizacion'; pintarModo();
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
      try{ it.foto = await window.AH.subirFoto('catalogo-fotos', path, it.fotoBlob); }
      catch(error){ throw new Error('No se pudo subir la foto: ' + error.message); }
      delete it.fotoBlob;
    }
  }

  function payload(confirmar, abono){
    const t = totales();
    return {
      clave: claveVenta,
      cliente:{ telefono: normTel($('cTel').value), nombre: $('cNombre').value.trim(), cedula: normCed($('cCedula').value) },
      venta:{ sede_id: sedeId, descuento: t.desc, instalacion: t.inst, traslado: t.tras, notas: $('vNotas').value.trim(), confirmar,
        fecha_entrega: abono ? abono.fecha : (editId && $('vFecha') && $('vFecha').value ? $('vFecha').value : null) },
      items: items.map(it => ({
        catalogo_id: it.origen === 'medida' ? null : it.catalogo_id,
        pieza_id: it.origen === 'pieza' ? it.pieza_id : null,
        a_medida: it.origen === 'medida',
        ya_hecho: it.origen === 'medida' && !!it.yaHecho,
        id: it.id || null, tocado: !!it.tocado,
        tipo: it.tipo,
        nombre: it.nombre,
        especificaciones: it.origen === 'medida'
          ? Object.assign({}, conSpecs(it) ? it.especificaciones : {}, conSpecs(it) && it.color ? { color: it.color } : {}, conSpecs(it) ? SP.montosEsp(it, null) : {}, { descripcion: it.descripcion || '' })
          : Object.assign({}, it.especificaciones, it.color ? { color: it.color } : {},
              it.origen === 'catalogo' ? SP.montosEsp(it, modeloDe(it)) : {}),
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

  // ---------------------------------------------------------------------------
  // Cotización o venta: se elige arriba y cambia lo que se pide y el botón final
  // ---------------------------------------------------------------------------
  function pintarModo(){
    const venta = modo === 'venta';
    document.querySelectorAll('#modoVenta [data-modo]').forEach(b => { const on = b.dataset.modo === modo; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('modoVenta').classList.toggle('en-venta', venta);
    if(!editId){
      document.querySelector('.topbar-title').textContent = venta ? 'Nueva venta' : 'Nueva cotización';
      $('subVenta').textContent = venta ? 'Con los detalles para fabricar' : 'Solo lo que cambia el precio';
      $('btnGuardar').textContent = venta ? 'Continuar al pago' : 'Guardar cotización';
    }
  }
  $('modoVenta').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modo]');
    if(!b || b.dataset.modo === modo) return;
    modo = b.dataset.modo;
    pintarModo();
    pintarItems();
  });
  // Al vender: si un producto no tiene sus detalles, se abre para completarlos
  function detallesCompletos(){
    const i = items.findIndex(faltaItem);
    if(i < 0) return true;
    toast('Completa los detalles para fabricar', 'error');
    abrirProducto(items[i], i, true);
    return false;
  }

  $('btnGuardar').addEventListener('click', () => {
    if(!validar()) return;
    if(editId && $('vFecha') && !$('vFecha').value){ $('campoFechaEd').classList.add('invalid'); $('campoFechaEd').scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    if(!detallesCompletos()) return;
    // En fabricación: si se agregó algo que hay que fabricar, se pregunta una vez por la fecha de entrega
    if(editId && editVenta && editVenta.estado === 'en_produccion' && !fechaPreguntada
       && items.some(it => !it.id && it.origen !== 'pieza' && !it.yaHecho) && $('vFecha').value === (editVenta.fecha_entrega || '')){
      fechaPreguntada = true;
      $('avisoFechaEd').classList.remove('hidden');
      $('campoFechaEd').scrollIntoView({ block:'center', behavior:'smooth' });
      toast('Agregaste un producto: revisa la fecha de entrega y guarda de nuevo');
      return;
    }
    if(editId){ guardarEdicion(); return; }
    if(modo === 'cotizacion'){ guardar(false, null, $('btnGuardar')); return; }
    abrirPago();
  });
  let fechaPreguntada = false;
  async function guardarEdicion(){
    if(guardando) return;
    guardando = true;
    const btn = $('btnGuardar');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Guardando';
    try{
      await subirFotos();
      const p = payload(false, null);
      const enFab = editVenta && editVenta.estado === 'en_produccion';
      const { data, error } = enFab ? await db.rpc('editar_venta_fabricacion', { vid: editId, p }) : await db.rpc('actualizar_venta', { vid: editId, p });
      if(error) throw new Error(error.message);
      terminado = true;
      toast(enFab && data && (data.nuevos || []).length ? 'Guardado. Hay un producto nuevo por asignar en Producción' : 'Cambios guardados');
      setTimeout(() => {
        if(window.Sesion.esSubpantalla()) history.back();
        else location.replace(editVenta && editVenta.estado === 'cotizacion' ? 'cotizaciones.html' : 'ventas.html');
      }, 500);
    } catch(err){
      const m = String(err.message || '');
      toast(/fetch|network/i.test(m) ? 'Sin conexión. Tus cambios siguen aquí, intenta de nuevo'
        : /_item_(quitar|pasos_reiniciar)/.test(m) ? 'Todavía no se puede quitar ni cambiar el tipo de un producto en fabricación. Avísale al administrador' : m, 'error');
      btn.disabled = false; btn.textContent = 'Guardar cambios';
    } finally { guardando = false; }
  }
  function abrirPago(){
    const t = totales();
    // Exhibición (todo de entrega inmediata): pago completo y se entrega hoy. Lo demás: 50%.
    const inm = window.AV.soloInmediata(items);
    const modoPago = inm ? 'completo' : 'parcial';
    conf = { modo: modoPago, monto: String(inm ? t.total : r2(t.total * 0.5)), metodo:null, fecha: inm ? hoyISO() : habiles(20), comprobante:null, blob:null, clave: conf && conf.clave ? conf.clave : uuid() };
    pintarConfirmar();
    abrirHoja('sheetConfirmar');
  }

  // ---------------------------------------------------------------------------
  // Confirmar venta: pago (completo o parcial), método, comprobante y fecha de entrega
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
      ${window.AV.modoPagoHtml(conf.modo)}
      <div class="field ${conf.modo === 'completo' ? 'hidden' : ''}" id="campoAbono"><label class="field-label" for="aMonto">Monto del pago en dólares</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="aMonto" type="text" inputmode="decimal" autocomplete="off" value="${esc(conf.monto)}"></div>
        <div class="field-error" id="errAbono">Escribe el monto</div>
        <div id="avisoAbono"></div>
      </div>
      <div class="field" id="campoMetodo"><span class="field-label">Cómo pagó</span>
        <div class="opts" style="--cols:2">${METODOS.map(x => `<button type="button" class="opt ${x === conf.metodo ? 'selected' : ''}" data-metodo="${x}" aria-pressed="${x === conf.metodo}">${x}</button>`).join('')}</div>
        <div class="field-error">Elige cómo pagó</div>
      </div>
      ${window.AV.comprobanteHtml(conf.comprobante)}
      <div class="field" id="campoFecha"><label class="field-label" for="aFecha">Fecha de entrega</label>
        <input class="input" id="aFecha" type="date" min="${hoyISO()}" value="${esc(conf.fecha)}">
        <div class="field-hint">${window.AV.soloInmediata(items) ? 'Es de entrega inmediata: hoy. La puedes cambiar.' : '20 días hábiles desde hoy, sin sábados ni domingos. La puedes cambiar.'}</div>
        <div class="field-error">Elige la fecha de entrega</div>
      </div>`;
    avisoAbono();
  }
  function avisoAbono(){
    const t = totales().total;
    const m = montoOrNull(conf.monto) || 0;
    let html = '';
    if(m > t) html = '';
    else if(m > 0 && m < t * 0.5) html = `<div class="aviso-50">${ICON_ALERTA}Pago menor al 50%</div>`;
    if(m > 0 && m <= t) html += `<div class="resta">Resta por pagar: <b>${dinero(r2(t - m))}</b></div>`;
    $('avisoAbono').innerHTML = html;
    $('errAbono').textContent = m > t ? 'Es mayor que el total' : 'Escribe el monto';
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
        conf.blob = await comprimirFoto(e.target.files[0], window.AV.COMPROBANTE.lado, window.AV.COMPROBANTE.calidad);
        conf.comprobante = URL.createObjectURL(conf.blob);
        const scroll = $('confBody').scrollTop; pintarConfirmar(); $('confBody').scrollTop = scroll;
      } catch(err){ toast('No se pudo leer la foto', 'error'); }
    }
  });
  $('confBody').addEventListener('click', (e) => {
    const mp = e.target.closest('[data-modo-pago]');
    if(mp){
      conf.modo = mp.dataset.modoPago;
      const t = totales().total;
      conf.monto = String(conf.modo === 'completo' ? t : r2(t * 0.5));
      const scroll = $('confBody').scrollTop; pintarConfirmar(); $('confBody').scrollTop = scroll;
      if(conf.modo === 'parcial') $('aMonto').focus();
      return;
    }
    const b = e.target.closest('[data-metodo]');
    if(!b) return;
    conf.metodo = b.dataset.metodo;
    document.querySelectorAll('#confBody [data-metodo]').forEach(x => { const s = x === b; x.classList.toggle('selected', s); x.setAttribute('aria-pressed', s); });
    $('campoMetodo').classList.remove('invalid');
  });
  $('btnConfListo').addEventListener('click', (e) => {
    const t = totales().total;
    const m = conf.modo === 'completo' ? t : (montoOrNull(conf.monto) || 0);
    let primero = null;
    const marcar = (id, mal) => { $(id).classList.toggle('invalid', mal); if(mal && !primero) primero = $(id); };
    marcar('campoAbono', !(m > 0) || m > t);
    marcar('campoMetodo', !conf.metodo);
    marcar('campoComp', !conf.blob);
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
      const det = it.origen === 'medida' && !conSpecs(it) ? (it.descripcion || '') : detalleItem(it);
      lineas.push(`• ${it.cantidad > 1 ? it.cantidad + ' × ' : ''}*${it.nombre}*${det ? ' (' + det + ')' : ''}: ${dinero(subtotalItem(it))}`);
    });
    const t = totales();
    if(t.inst) lineas.push(`• Instalación: ${dinero(t.inst)}`);
    if(t.tras) lineas.push(`• Traslado: ${dinero(t.tras)}`);
    if(t.desc) lineas.push(`• Descuento: -${dinero(t.desc)}`);
    lineas.push('', `*Total: ${dinero(res.total)}*`);
    if(esVenta){
      const falta = r2(res.total - abono.monto);
      lineas.push(`Pagó: ${dinero(abono.monto)} (${abono.metodo})`);
      if(falta > 0) lineas.push(`Resta por pagar: ${dinero(falta)}`); else lineas.push('Pagado completo. ¡Gracias!');
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
    $('pagina').innerHTML = `
      <div class="listo">
        <div class="listo-ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div>
        <h1>${esVenta ? 'Venta confirmada' : 'Cotización guardada'}</h1>
        <p>N° ${res.id} · ${esc(p.cliente.nombre)}</p>
      </div>
      <div class="resumen listo-datos">
        <div class="res-fila"><span>Productos</span><b>${items.length}</b></div>
        ${esVenta ? `<div class="res-fila"><span>Pago (${esc(abono.metodo)})</span><b>${dinero(abono.monto)}</b></div>
          ${r2(res.total - abono.monto) > 0 ? `<div class="res-fila"><span>Resta por pagar</span><b>${dinero(r2(res.total - abono.monto))}</b></div>` : '<div class="res-fila"><span>Pago</span><b>Completo</b></div>'}
          <div class="res-fila"><span>Entrega</span><b>${esc(fechaLarga(abono.fecha))}</b></div>`
          : `<div class="res-fila"><span>Válida por</span><b>20 días</b></div>`}
        <div class="res-total"><span>Total</span><b>${dinero(res.total)}</b></div>
      </div>
      <div class="listo-btns">
        <button class="btn-wa" type="button" id="btnPdf" disabled><span class="spinner"></span>Preparando PDF</button>
        <button class="btn-secondary" type="button" id="btnMsj" style="height:54px" disabled>Enviar mensaje con su seguimiento</button>
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
        const m = $('btnMsj'); if(m) m.disabled = false;
        const b = $('btnPdf'); if(!b) return;
        b.disabled = false; b.innerHTML = `${ICON_WA}Enviar PDF al cliente`;
      } catch(e){
        const b = $('btnPdf'); if(b){ b.innerHTML = 'No se pudo preparar el PDF'; }
      }
    })();
    $('btnMsj').addEventListener('click', () => {
      if(!venta) return;
      const url = window.AV.linkSeguimientoWA(venta);
      const w = window.open(url, '_blank'); if(!w) location.href = url;
      db.rpc('marcar_paso', { vid: venta.id, paso: 'mensaje' });
      $('btnMsj').innerHTML = '✓ Mensaje enviado';
    });
    $('btnPdf').addEventListener('click', async () => {
      if(!blob) return;
      const bp = $('btnPdf');
      if(bp.dataset.paso2){ window.AV.abrirMensajePDF(venta); delete bp.dataset.paso2; bp.innerHTML = `${ICON_WA}Enviar PDF al cliente`; return; }
      const r = await window.AV.compartirPDF(blob, venta);
      if(r === 'paso2'){
        db.rpc('marcar_paso', { vid: venta.id, paso: 'pdf' });
        bp.dataset.paso2 = '1'; bp.innerHTML = `${ICON_WA}2. Enviar el mensaje`;
        toast('PDF enviado. Ahora toca "2. Enviar el mensaje" para mandarle el texto');
        return;
      }
      if(r !== 'cancelado') db.rpc('marcar_paso', { vid: venta.id, paso: 'pdf' });
      if(r === 'descargado') toast('PDF descargado');
      else if(r !== 'cancelado') toast(`Teléfono copiado (${window.AV.telBonito(venta)}). Pégalo en el buscador de WhatsApp si no ves el chat`);
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
    modo = cot ? 'cotizacion' : 'venta';
    $('modoVenta').classList.add('hidden');
    document.title = `Editar N° ${v.id} · Herrería Artesanos`;
    document.querySelector('.topbar-title').textContent = cot ? `Editar cotización` : `Editar venta`;
    $('subVenta').textContent = `N° ${v.id} · ${v.cliente.nombre}`;
    $('btnGuardar').textContent = 'Guardar cambios';
    const enFab = v.estado === 'en_produccion';
    const editable = ['cotizacion', 'confirmada', 'lista', 'en_produccion'].includes(v.estado);
    // En fabricación: los productos con pasos ya terminados no se cambian ni se quitan
    let hechasDe = {};
    if(enFab){
      const { data: av, error: eav } = await db.rpc('avance_venta', { vid: v.id });
      if(eav) throw new Error('No se pudo revisar el avance del taller. Intenta de nuevo');
      Object.keys((av && av.items) || {}).forEach(k => { hechasDe[k] = Number(av.items[k].hechas) || 0; });
    }
    if(!editable){
      $('pagina').innerHTML = `<div class="listo"><h1>Ya no se puede editar</h1><p>Esta venta está ${esc(window.AV.ESTADOS[v.estado].t.toLowerCase())}.</p></div>`;
      $('pie').classList.add('hidden');
      return false;
    }
    if(!cot){
      // En una venta confirmada también se puede mover la fecha de entrega
      const f = document.createElement('div');
      f.className = 'field'; f.id = 'campoFechaEd';
      f.innerHTML = `<label class="field-label" for="vFecha">Fecha de entrega</label><input class="input" id="vFecha" type="date" value="${esc(v.fecha_entrega || '')}"><div class="field-hint aviso hidden" id="avisoFechaEd">Agregaste un producto. Si hace falta, cambia la fecha de entrega y guarda de nuevo.</div><div class="field-error">Elige la fecha de entrega</div>`;
      $('optsSede').closest('.field').before(f);
    }
    $('cCedula').value = v.cliente.cedula || '';
    $('cTel').value = v.cliente.telefono ? '0' + String(v.cliente.telefono).replace(/^58/, '') : '';
    $('cNombre').value = v.cliente.nombre || '';
    $('vNotas').value = v.notas || '';
    if(Number(v.descuento)) $('vDesc').value = Number(v.descuento);
    if(Number(v.instalacion)){ extras.inst = true; $('vInst').value = Number(v.instalacion); }
    if(Number(v.traslado)){ extras.tras = true; $('vTras').value = Number(v.traslado); }
    if(v.sede_id) sedeId = v.sede_id;
    clienteExistente = v.cliente;
    ultimaBusqueda = $('cCedula').value.trim() ? 'c' + normCed($('cCedula').value) : 't' + normTel($('cTel').value);
    items = v.items.map(it => {
      const e = it.especificaciones || {};
      const base = { tipo: it.tipo, nombre: it.nombre, foto: it.foto, precio: Number(it.precio_unitario), cantidad: it.cantidad };
      if(enFab){ base.id = it.id; base.bloqueado = (hechasDe[it.id] || 0) > 0; }
      if(it.ya_hecho) base.yaHecho = true;
      if(it.a_medida){
        const conTipo = TIPOS.includes(it.tipo);
        return Object.assign(base, { origen:'medida', descripcion: e.descripcion || '', precioManual:true,
          color: conTipo ? (e.color || null) : null, especificaciones: conTipo ? e : {}, estado: conTipo ? estadoDesdeEspecificaciones(it.tipo, e, 'pedido', true) : {}, extraSoloProt: e.monto_proteccion_sola || '' });
      }
      if(it.pieza_id) return Object.assign(base, { origen:'pieza', pieza_id: it.pieza_id, catalogo_id: it.catalogo_id, color: e.color || null, especificaciones: e, precioManual:true, fijo: !cot });
      // guardado: ya estaba en la venta, conserva sus medidas y su protección (las reglas nuevas son para lo que se agrega)
      return Object.assign(base, { origen:'catalogo', catalogo_id: it.catalogo_id, color: e.color || null, especificaciones: e, guardado:true,
        estado: estadoDesdeEspecificaciones(it.tipo, e, 'pedido', true), extraProteccion: e.monto_proteccion || '', extraSoloProt: e.monto_proteccion_sola || '', extraMarco: e.monto_marco || '', marcoConMonto: e.monto_marco != null, precioManual:true });
    });
    auto.nombre = auto.tel = auto.ced = false;
    if(enFab) $('avisoBorrador').innerHTML = `<div class="borrador"><span>Este pedido ya está en fabricación. Puedes agregar productos y cambiar los que todavía no tienen pasos terminados. Queda anotado quién cambió qué.</span></div>`;
    else if(!cot) $('avisoBorrador').innerHTML = `<div class="borrador"><span>Es una venta confirmada: lo que cambies se refleja en el pedido y el PDF.</span></div>`;
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
      pintarModo();
      pintarExtrasCierre();
      pintarSedes();
      pintarItems();
      if($('cTel').value || $('cCedula').value) buscarCliente();
    } catch(e){
      cargado = true;
      // Si no cargó la venta que se iba a editar, no se deja guardar a medias
      if(editId) $('pie').classList.add('hidden');
      toast('Sin conexión. Revisa tu internet y vuelve a entrar', 'error');
    }
  })();
})();
