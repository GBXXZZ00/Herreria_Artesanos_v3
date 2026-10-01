// Categorías de pago: cuánto se le paga al taller por cada trabajo de un producto
// (Puerta, Portón, Ventana o Combo), fijo o por m². Cada categoría es de un solo producto y
// muestra solo sus trabajos. Masilla y pintura es un solo monto (se paga al terminar la
// pintura). Aluminio es por cada ventana. La puerta y el combo tienen aparte el extra si la
// puerta lleva protección. Instalar no se paga. Solo lo ve un admin.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, fotoModelo, iconoTipo, PRODUCTOS_PAGO, nombreProducto, categoriaSirve } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  // Trabajos de cada producto (k = clave de la tarifa). sub: qué abarca. cu: por cada ventana.
  const TRABAJOS = {
    'Puerta Multilock': [
      { k:'hierro', n:'Hierro' },
      { k:'masilla_pintura', n:'Masilla y pintura', sub:'Se paga al terminar la pintura' },
      { k:'detalles', n:'Detalles' }
    ],
    'Portón': [
      { k:'hierro', n:'Hierro' },
      { k:'masilla_pintura', n:'Masilla y pintura', sub:'Se paga al terminar la pintura' },
      { k:'detalles', n:'Detalles' }
    ],
    'Ventana': [
      { k:'hierro', n:'Hierro', sub:'De la protección' },
      { k:'masilla_pintura', n:'Masilla y pintura', sub:'De la protección' },
      { k:'armar', n:'Aluminio', sub:'Por cada ventana', cu:true },
      { k:'detalles', n:'Detalles', sub:'Si el modelo lleva detalles', cu:true }
    ],
    'Combo': [
      { k:'hierro', n:'Hierro', sub:'Puerta y 2 protecciones' },
      { k:'masilla_pintura', n:'Masilla y pintura', sub:'Puerta y 2 protecciones' },
      { k:'detalles', n:'Detalles', sub:'De la puerta' },
      { k:'armar', n:'Aluminio', sub:'Por cada ventana (son 2)', cu:true },
      { k:'detalles_ventana', n:'Detalles de ventana', sub:'Por cada ventana, si el modelo los lleva', cu:true }
    ]
  };
  const PIE = {
    'Puerta Multilock':'Masilla y pintura es un solo monto. Instalar no se paga.',
    'Portón':'Masilla y pintura es un solo monto.',
    'Ventana':'Hierro y Masilla y pintura se pagan solo si el modelo trae protección. Instalar no se paga.',
    'Combo':'Por m² se suman la puerta y las 2 ventanas. Instalar no se paga.'
  };
  // Extra si la puerta lleva protección (solo puerta y combo)
  const CON_EXTRA = ['Puerta Multilock', 'Combo'];
  const EXTRA = [{ k:'hierro', n:'Hierro' }, { k:'masilla_pintura', n:'Masilla y pintura' }];
  const ICONO_MONEDA = '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>';
  const ESCUDO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>';

  let categorias = [];
  let usoPorCategoria = {};
  let modelos = [];   // todo el catálogo: id, nombre, tipo, fotos, categoria_pago_id

  async function cargar(){
    try{
      const [{ data: cats, error: e1 }, { data: cat, error: e2 }] = await Promise.all([
        db.from('categorias_pago').select('*').order('id'),
        db.from('catalogo').select('id,nombre,tipo,fotos,categoria_pago_id').order('nombre', { ascending:true })
      ]);
      if(e1) throw e1;
      if(e2) throw e2;
      categorias = cats || [];
      modelos = cat || [];
      contarUso();
      pintarLista();
    } catch(e){
      $('lista').innerHTML = '<div class="c-vacio">No se pudo cargar. Desliza para reintentar.</div>';
      toast(e.message || 'No se pudo cargar', 'error');
    }
  }

  function contarUso(){
    usoPorCategoria = {};
    modelos.forEach(m => { if(m.categoria_pago_id) usoPorCategoria[m.categoria_pago_id] = (usoPorCategoria[m.categoria_pago_id] || 0) + 1; });
  }
  const sinCategoria = () => modelos.filter(m => !m.categoria_pago_id);
  const nombreCat = (id) => (categorias.find(c => c.id === id) || {}).nombre || '';
  function pintarAviso(){
    const n = sinCategoria().length;
    $('avisoSin').innerHTML = n && categorias.length ? `<div class="c-aviso"><span class="c-ico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/></svg></span>
      <span><b>${n === 1 ? '1 modelo sin categoría.' : n + ' modelos sin categoría.'}</b> Abre una categoría y toca "Asignar a modelos".</span></div>` : '';
  }

  const precio = (monto, modo, cu) => '$' + Number(monto) + (modo === 'm2' ? '/m²' : '') + (cu ? ' c/u' : '');
  function tarifasHtml(c){
    const t = c.tarifas || {};
    const filas = (TRABAJOS[c.producto] || [])
      .filter(e => t[e.k] && Number(t[e.k].monto) > 0)
      .map(e => `<span class="c-tarifa">${esc(e.n)} <b>${precio(t[e.k].monto, t[e.k].modo, e.cu)}</b>${CON_EXTRA.includes(c.producto) && EXTRA.some(x => x.k === e.k) && Number(t[e.k].prot_monto) > 0 ? ` <span class="c-prot">+${precio(t[e.k].prot_monto, t[e.k].prot_modo)} prot.</span>` : ''}</span>`);
    if(!c.producto) return '<p class="c-usado c-falta" style="margin-top:9px">Falta elegir el producto</p>';
    return filas.length ? `<div class="c-tarifas">${filas.join('')}</div>` : '<p class="c-usado" style="margin-top:9px">Sin tarifas todavía</p>';
  }

  function pintarLista(){
    const cont = $('lista');
    $('subtitulo').textContent = categorias.length + (categorias.length === 1 ? ' grupo' : ' grupos');
    pintarAviso();
    if(!categorias.length){ cont.innerHTML = '<div class="c-vacio">Todavía no hay categorías. Toca + para crear la primera.</div>'; return; }
    cont.innerHTML = categorias.map((c, i) => {
      const usados = usoPorCategoria[c.id] || 0;
      return `
      <button class="c-card" data-id="${esc(c.id)}" style="--i:${i}">
        <span class="c-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONO_MONEDA}</svg></span>
        <span class="c-body">
          <div class="c-nom">${esc(c.nombre)}${c.producto ? ` <span class="c-prod">${esc(nombreProducto(c.producto))}</span>` : ''}</div>
          ${tarifasHtml(c)}
          <div class="c-usado">${usados ? `Usada en ${usados} ${usados === 1 ? 'modelo' : 'modelos'} del catálogo` : 'Todavía no se usa en el catálogo'}</div>
        </span>
      </button>`;
    }).join('');
  }

  // ---------------- Ficha: crear/editar ----------------
  let categoriaActual = null;
  let producto = null;
  let memo = {};   // lo escrito del producto que se está viendo
  let memoPor = {};   // lo escrito en cada producto, por si cambia de producto antes de guardar (no se mezcla)
  function filaHtml(k, nombre, sub, modo, monto, prot){
    return `
      <div class="cat-fila ${prot ? 'prot' : ''}" data-k="${k}" ${prot ? 'data-prot="1"' : ''}>
        <span class="cat-esp">${esc(nombre)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
        <div class="cat-modo" role="group" aria-label="${esc(nombre)}: fijo o por m²">
          <button type="button" data-modo="fijo" class="${modo === 'fijo' ? 'on' : ''}" aria-pressed="${modo === 'fijo'}">Fijo</button>
          <button type="button" data-modo="m2" class="${modo === 'm2' ? 'on' : ''}" aria-pressed="${modo === 'm2'}">m²</button>
        </div>
        <div class="cat-monto"><input type="text" inputmode="decimal" value="${esc(monto)}" aria-label="${esc(nombre)}${prot ? ' (extra por protección)' : ''}: monto"></div>
      </div>`;
  }
  const val = (x) => x != null && x !== '' ? x : '';
  function pintarTrabajos(){
    const cont = $('filasTarifa');
    $('tarifasPie').textContent = producto ? PIE[producto] : '';
    $('tarifasTit').classList.toggle('hidden', !producto);
    if(!producto){ cont.innerHTML = '<p class="cat-elige">Elige el producto para ver sus trabajos.</p>'; return; }
    let html = TRABAJOS[producto].map(e => {
      const d = memo[e.k] || {};
      return filaHtml(e.k, e.n, e.sub, d.modo || 'fijo', val(d.monto), false);
    }).join('');
    if(CON_EXTRA.includes(producto)){
      html += `<div class="cat-extra">
        <div class="cat-extra-h">${ESCUDO}Extra si la puerta lleva protección</div>
        <p class="cat-extra-s">Se suma solo cuando ${producto === 'Combo' ? 'el combo tiene protección en la puerta' : 'la puerta sale con protección'}.</p>
        ${EXTRA.map(e => { const d = memo[e.k] || {}; return filaHtml(e.k, e.n, '', d.prot_modo || 'fijo', val(d.prot_monto), true); }).join('')}
      </div>`;
    }
    cont.innerHTML = html;
  }
  function pintarProducto(){
    // Si ya la usan modelos, el producto no se cambia (si todavía no tiene producto, sí se elige)
    const enUso = !!(categoriaActual && categoriaActual.producto && usoPorCategoria[categoriaActual.id]);
    $('optsProducto').innerHTML = PRODUCTOS_PAGO.map(p =>
      `<button type="button" class="opt ${producto === p.v ? 'selected' : ''}" data-v="${esc(p.v)}" ${enUso && producto !== p.v ? 'disabled' : ''} aria-pressed="${producto === p.v}">${esc(p.t)}</button>`).join('');
    $('hintProducto').textContent = enUso ? 'Ya la usan modelos. Para cambiar el producto, quítasela primero.' : 'Solo verás los trabajos de ese producto.';
    $('campoProducto').classList.remove('invalid');
  }
  function pintarFicha(c){
    categoriaActual = c;
    producto = c ? (c.producto || null) : null;
    memo = JSON.parse(JSON.stringify((c && c.tarifas) || {}));
    memoPor = {};
    $('fichaTitulo').textContent = c ? 'Editar categoría' : 'Nueva categoría';
    $('fNombre').value = c ? c.nombre : '';
    $('campoNombre').classList.remove('invalid');
    $('btnAsignarModelos').classList.toggle('hidden', !c || !c.producto);
    pintarAsigSub();
    pintarProducto();
    pintarTrabajos();
    $('btnEliminar').classList.toggle('hidden', !c);
    abrirHoja('sheetFicha');
  }
  // Guarda en memo lo que hay escrito en pantalla
  function recordar(){
    $('filasTarifa').querySelectorAll('.cat-fila').forEach(fila => {
      const k = fila.dataset.k;
      const monto = fila.querySelector('.cat-monto input').value.trim();
      const modo = fila.querySelector('button[data-modo].on').dataset.modo;
      memo[k] = memo[k] || {};
      if(fila.dataset.prot){ memo[k].prot_monto = monto; memo[k].prot_modo = modo; }
      else { memo[k].monto = monto; memo[k].modo = modo; }
    });
  }
  $('optsProducto').addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if(!b || b.disabled || b.dataset.v === producto) return;
    recordar();
    if(producto) memoPor[producto] = memo;
    producto = b.dataset.v;
    memo = memoPor[producto] || (categoriaActual && categoriaActual.producto === producto ? JSON.parse(JSON.stringify(categoriaActual.tarifas || {})) : {});
    pintarProducto();
    pintarTrabajos();
  });
  $('btnNuevo').addEventListener('click', () => pintarFicha(null));
  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('.c-card'); if(!b) return;
    const c = categorias.find(x => String(x.id) === b.dataset.id);
    if(c) pintarFicha(c);
  });
  $('filasTarifa').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-modo]'); if(!b) return;
    const fila = b.closest('.cat-fila');
    fila.querySelectorAll('button[data-modo]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  });
  $('filasTarifa').addEventListener('input', (e) => { const f = e.target.closest('.cat-fila'); if(f) f.classList.remove('invalid'); });

  const num = (t) => parseFloat(String(t || '').replace(',', '.'));
  // Solo los trabajos de este producto (lo de otros productos no se guarda)
  function leerTarifas(){
    const tarifas = {};
    $('filasTarifa').querySelectorAll('.cat-fila').forEach(fila => {
      const k = fila.dataset.k;
      const monto = num(fila.querySelector('.cat-monto input').value);
      const modo = fila.querySelector('button[data-modo].on').dataset.modo;
      if(isNaN(monto) || !(monto > 0)) return;
      if(fila.dataset.prot){ if(tarifas[k]){ tarifas[k].prot_monto = monto; tarifas[k].prot_modo = modo; } }
      else tarifas[k] = { monto, modo };
    });
    return tarifas;
  }

  $('btnGuardar').addEventListener('click', async () => {
    const nombre = $('fNombre').value.trim();
    $('campoNombre').classList.remove('invalid');
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; $('campoNombre').classList.add('invalid'); $('fNombre').focus(); return; }
    if(!producto){ $('campoProducto').classList.add('invalid'); $('campoProducto').scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    // El extra de protección necesita el monto de ese trabajo
    const filas = [...$('filasTarifa').querySelectorAll('.cat-fila')];
    const baseDe = (k) => filas.find(x => !x.dataset.prot && x.dataset.k === k);
    const monto = (f) => f ? num(f.querySelector('input').value) : NaN;
    const sinBase = filas.find(f => f.dataset.prot && monto(f) > 0 && !(monto(baseDe(f.dataset.k)) > 0));
    filas.forEach(f => f.classList.remove('invalid'));
    if(sinBase){
      const base = baseDe(sinBase.dataset.k);
      if(base){ base.classList.add('invalid'); base.scrollIntoView({ block:'center', behavior:'smooth' }); }
      toast('Escribe cuánto se paga por ' + sinBase.querySelector('.cat-esp').firstChild.textContent.toLowerCase() + ' para poder sumar el extra', 'error');
      return;
    }
    const tarifas = leerTarifas();
    $('btnGuardar').disabled = true;
    try{
      if(categoriaActual){
        const { error } = await db.from('categorias_pago').update({ nombre, producto, tarifas }).eq('id', categoriaActual.id);
        if(error) throw error;
        toast('Categoría actualizada');
      } else {
        const { error } = await db.from('categorias_pago').insert({ nombre, producto, tarifas });
        if(error) throw error;
        toast('Categoría creada');
      }
      cerrarHoja('sheetFicha');
      cargar();
    } catch(e){
      const m = String((e && e.message) || '');
      toast(/fetch|network|Failed/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m || 'No se pudo guardar', 'error');
    } finally {
      $('btnGuardar').disabled = false;
    }
  });

  $('fNombre').addEventListener('input', () => $('campoNombre').classList.remove('invalid'));

  // ---------------- Asignar esta categoría a varios modelos ----------------
  // Primero salen los que no tienen categoría (no se pisa nada). En "Todos" se ve la
  // categoría de cada uno; los que ya están en esta no se pueden marcar, y si marcas
  // uno que tiene otra, se avisa en la fila y se pide confirmar antes de guardar.
  let pestana = 'sin';
  const marcados = new Set();
  // Solo los modelos del producto de la categoría
  const delProducto = () => modelos.filter(m => categoriaSirve(categoriaActual, m.tipo));
  const sinCategoriaProd = () => delProducto().filter(m => !m.categoria_pago_id);
  function pintarAsigSub(){
    const c = categoriaActual; if(!c) return;
    const n = usoPorCategoria[c.id] || 0, sin = sinCategoriaProd().length;
    $('asigSub').textContent = (n ? `Usada en ${n} ${n === 1 ? 'modelo' : 'modelos'}` : 'Todavía no la usa ningún modelo') + (sin ? ` · ${sin} sin categoría` : '');
  }
  function visibles(){
    return pestana === 'sin' ? sinCategoriaProd() : delProducto();
  }
  function pintarModelosAsignar(){
    const c = categoriaActual;
    const nSin = sinCategoriaProd().length;
    $('chipsModelos').innerHTML = [['sin', `Sin categoría · ${nSin}`], ['todos', `Todos · ${delProducto().length}`]]
      .map(([id, t]) => `<button class="chip ${pestana === id ? 'active' : ''}" type="button" role="tab" aria-selected="${pestana === id}" data-pestana="${id}">${esc(t)}</button>`).join('');
    const lista = visibles();
    const elegibles = lista.filter(m => m.categoria_pago_id !== c.id);
    $('mCuenta').textContent = lista.length ? (pestana === 'sin' ? 'Ninguno tiene categoría' : 'Los que ya están en esta salen con ✓') : '';
    const todos = elegibles.length && elegibles.every(m => marcados.has(m.id));
    $('btnMarcarTodos').textContent = todos ? 'Quitar todos' : 'Marcar todos';
    $('btnMarcarTodos').classList.toggle('hidden', !elegibles.length);
    $('listaModelos').innerHTML = lista.length ? lista.map(m => {
      const misma = m.categoria_pago_id === c.id;
      const sel = marcados.has(m.id);
      let tag;
      if(misma) tag = `<span class="m-tag misma">Ya está en ${esc(c.nombre)}</span>`;
      else if(m.categoria_pago_id && sel) tag = `<span class="m-tag cambia">Pasará de ${esc(nombreCat(m.categoria_pago_id))} a ${esc(c.nombre)}</span>`;
      else if(m.categoria_pago_id) tag = `<span class="m-tag otra">Tiene: ${esc(nombreCat(m.categoria_pago_id))}</span>`;
      else tag = '<span class="m-tag">Sin categoría</span>';
      const f = fotoModelo(m);
      return `<button class="m-fila ${sel ? 'sel' : ''}" type="button" data-mid="${m.id}" ${misma ? 'disabled' : ''} aria-pressed="${sel || misma}">
        <span class="m-foto">${f ? window.AH.imgMini(f, "", m.tipo) : iconoTipo(m.tipo, 22)}</span>
        <span class="m-txt"><span class="m-nom">${esc(m.nombre)}</span>${tag}</span>
        <span class="m-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
      </button>`;
    }).join('') : `<div class="m-vacio">${pestana === 'sin' ? 'Todos tienen categoría.' : 'No hay modelos de ' + esc(nombreProducto(c.producto)) + ' en el catálogo.'}</div>`;
    const n = marcados.size;
    $('btnAsignar').disabled = !n;
    $('btnAsignar').textContent = n ? `Asignar a ${n === 1 ? '1 modelo' : n + ' modelos'}` : 'Elige los modelos';
  }
  $('btnAsignarModelos').addEventListener('click', () => {
    if(!categoriaActual) return;
    pestana = sinCategoriaProd().length ? 'sin' : 'todos';
    marcados.clear();
    $('modelosTitulo').textContent = 'Asignar ' + categoriaActual.nombre;
    pintarModelosAsignar();
    abrirHoja('sheetModelos');
  });
  $('chipsModelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pestana]'); if(!b) return;
    if(b.dataset.pestana === pestana) return;
    pestana = b.dataset.pestana;
    marcados.clear();   // lo marcado es solo lo que se ve: no quedan elegidos escondidos
    pintarModelosAsignar();
  });
  $('listaModelos').addEventListener('click', (e) => {
    const b = e.target.closest('.m-fila'); if(!b || b.disabled) return;
    const id = Number(b.dataset.mid);
    if(marcados.has(id)) marcados.delete(id); else marcados.add(id);
    pintarModelosAsignar();
  });
  $('btnMarcarTodos').addEventListener('click', () => {
    const elegibles = visibles().filter(m => m.categoria_pago_id !== categoriaActual.id);
    const todos = elegibles.every(m => marcados.has(m.id));
    elegibles.forEach(m => { if(todos) marcados.delete(m.id); else marcados.add(m.id); });
    pintarModelosAsignar();
  });
  $('btnAsignar').addEventListener('click', async () => {
    const c = categoriaActual; if(!c || !marcados.size) return;
    const ids = [...marcados];
    const cambian = delProducto().filter(m => marcados.has(m.id) && m.categoria_pago_id && m.categoria_pago_id !== c.id);
    if(cambian.length && !confirm(`${cambian.length === 1 ? '1 modelo ya tiene otra categoría y se cambiará' : cambian.length + ' modelos ya tienen otra categoría y se cambiarán'} a ${c.nombre}. ¿Seguro?`)) return;
    const btn = $('btnAsignar');
    btn.disabled = true;
    try{
      const { error } = await db.rpc('asignar_categoria_modelos', { ids, cid: c.id });
      if(error) throw error;
      modelos.forEach(m => { if(marcados.has(m.id)) m.categoria_pago_id = c.id; });
      contarUso();
      marcados.clear();
      cerrarHoja('sheetModelos');
      toast(`Listo: ${ids.length === 1 ? '1 modelo' : ids.length + ' modelos'} con ${c.nombre}`);
      pintarAsigSub();
      pintarLista();
    } catch(err){
      toast('No se pudo guardar: ' + ((err && err.message) || 'revisa tu conexión'), 'error');
      pintarModelosAsignar();
    }
  });

  $('btnEliminar').addEventListener('click', async () => {
    if(!categoriaActual) return;
    const usados = usoPorCategoria[categoriaActual.id] || 0;
    const aviso = usados
      ? `${usados} ${usados === 1 ? 'modelo usa' : 'modelos usan'} esta categoría; se quedarán sin categoría de pago. ¿Eliminar "${categoriaActual.nombre}"?`
      : `¿Eliminar la categoría "${categoriaActual.nombre}"?`;
    if(!confirm(aviso)) return;
    try{
      const { error } = await db.from('categorias_pago').delete().eq('id', categoriaActual.id);
      if(error) throw error;
      cerrarHoja('sheetFicha');
      toast('Categoría eliminada');
      cargar();
    } catch(e){
      toast(e.message || 'No se pudo eliminar', 'error');
    }
  });

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin'){ location.replace('index.html'); return; }
    await cargar();
    // Atajos desde avisos: ?nueva=1 · ?editar=ID (tarifa que falta) · ?asignar=1 (modelos sin categoría)
    const q = new URLSearchParams(location.search);
    try{ if(q.toString()) history.replaceState(null, '', location.pathname); } catch(e){}
    if(q.get('nueva')){ pintarFicha(null); return; }
    const ed = categorias.find(c => String(c.id) === q.get('editar'));
    if(ed){ pintarFicha(ed); return; }
    if(q.get('asignar')){
      if(categorias.length === 1){ pintarFicha(categorias[0]); $('btnAsignarModelos').click(); }
      else if(categorias.length) toast('Toca la categoría y luego "Asignar a modelos"');
      else pintarFicha(null);
    }
  })();
})();
