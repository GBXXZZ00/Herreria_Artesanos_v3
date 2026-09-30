// Categorías de pago: los "grupos" que definen cuánto se le paga a cada trabajador por
// oficio al terminar un paso (fijo o por m²), más un extra si el producto lleva protección
// (puerta con protección o combo con protección en la puerta). Instalar no se paga. Solo lo ve un admin.
// Las tarifas viejas por especialidad (pedidos de antes) se conservan al guardar.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, fotoModelo, iconoTipo } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const OFICIOS = [
    { v:'hierro', n:'Hierro', prot:true },
    { v:'masilla', n:'Masilla', prot:true },
    { v:'pintura', n:'Pintura', prot:true },
    { v:'detalles', n:'Detalles' },
    { v:'armar', n:'Armar ventana' }
  ];
  const ESPECIALIDADES_VIEJAS = [
    { v:'herrero', n:'Herrero' }, { v:'masilla_pintura', n:'Masilla y pintura' }, { v:'acabados', n:'Detalles' }, { v:'ventanero', n:'Ventanero' }
  ];
  const ICONO_MONEDA = '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>';

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

  const precio = (monto, modo) => '$' + Number(monto) + (modo === 'm2' ? '/m²' : '');
  function tarifasHtml(t){
    let filas = OFICIOS
      .filter(e => t && t[e.v] && Number(t[e.v].monto) > 0)
      .map(e => `<span class="c-tarifa">${esc(e.n)} <b>${precio(t[e.v].monto, t[e.v].modo)}</b>${Number(t[e.v].prot_monto) > 0 ? ` <span class="c-prot">+${precio(t[e.v].prot_monto, t[e.v].prot_modo)} prot.</span>` : ''}</span>`);
    // Categoría de antes (por especialidad), hasta que se llene con los oficios nuevos
    if(!filas.length) filas = ESPECIALIDADES_VIEJAS
      .filter(e => t && t[e.v] && Number(t[e.v].monto) > 0)
      .map(e => `<span class="c-tarifa vieja">${esc(e.n)} <b>${precio(t[e.v].monto, t[e.v].modo)}</b></span>`);
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
          <div class="c-nom">${esc(c.nombre)}</div>
          ${tarifasHtml(c.tarifas)}
          <div class="c-usado">${usados ? `Usada en ${usados} ${usados === 1 ? 'modelo' : 'modelos'} del catálogo` : 'Todavía no se usa en el catálogo'}</div>
        </span>
      </button>`;
    }).join('');
  }

  // ---------------- Ficha: crear/editar ----------------
  let categoriaActual = null;
  function filaHtml(of, nombre, modo, monto, prot){
    return `
      <div class="cat-fila ${prot ? 'prot' : ''}" data-esp="${of.v}" ${prot ? 'data-prot="1"' : ''}>
        <span class="cat-esp">${esc(nombre)}</span>
        <div class="cat-modo" role="group" aria-label="${esc(nombre)}: fijo o por m²">
          <button type="button" data-modo="fijo" class="${modo === 'fijo' ? 'on' : ''}" aria-pressed="${modo === 'fijo'}">Fijo</button>
          <button type="button" data-modo="m2" class="${modo === 'm2' ? 'on' : ''}" aria-pressed="${modo === 'm2'}">m²</button>
        </div>
        <div class="cat-monto"><input type="text" inputmode="decimal" value="${esc(monto)}" placeholder="0" aria-label="${esc(nombre)}: monto"></div>
      </div>`;
  }
  function filaTarifaHtml(of, datos){
    const d = datos || {};
    const val = (x) => x != null && x !== '' ? x : '';
    return `<div class="cat-oficio">${filaHtml(of, of.n, d.modo || 'fijo', val(d.monto), false)}
      ${of.prot ? filaHtml(of, 'Si lleva protección, suma', d.prot_modo || 'fijo', val(d.prot_monto), true) : ''}</div>`;
  }
  function pintarFicha(c){
    categoriaActual = c;
    $('fichaTitulo').textContent = c ? 'Editar categoría' : 'Nueva categoría';
    $('fNombre').value = c ? c.nombre : '';
    $('campoNombre').classList.remove('invalid');
    $('btnAsignarModelos').classList.toggle('hidden', !c);
    pintarAsigSub();
    $('filasTarifa').innerHTML = OFICIOS.map(e => filaTarifaHtml(e, c && c.tarifas ? c.tarifas[e.v] : null)).join('');
    $('btnEliminar').classList.toggle('hidden', !c);
    abrirHoja('sheetFicha');
  }
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

  // Se parte de lo que ya tenía (así no se pierden las tarifas viejas por especialidad)
  function leerTarifas(){
    const tarifas = Object.assign({}, (categoriaActual && categoriaActual.tarifas) || {});
    OFICIOS.forEach(of => { delete tarifas[of.v]; });
    $('filasTarifa').querySelectorAll('.cat-fila').forEach(fila => {
      const of = fila.dataset.esp;
      const monto = parseFloat(fila.querySelector('.cat-monto input').value.replace(',', '.'));
      const modo = fila.querySelector('button[data-modo].on').dataset.modo;
      if(isNaN(monto) || !(monto > 0)) return;
      if(fila.dataset.prot){
        if(tarifas[of]){ tarifas[of].prot_monto = monto; tarifas[of].prot_modo = modo; }
      } else tarifas[of] = { monto, modo };
    });
    return tarifas;
  }

  $('btnGuardar').addEventListener('click', async () => {
    const nombre = $('fNombre').value.trim();
    $('campoNombre').classList.remove('invalid');
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; $('campoNombre').classList.add('invalid'); $('fNombre').focus(); return; }
    // El extra de protección necesita la tarifa del oficio
    const sinBase = [...$('filasTarifa').querySelectorAll('.cat-oficio')].find(g => {
      const n = (f) => parseFloat((f && f.querySelector('input').value || '').replace(',', '.'));
      return n(g.querySelector('.cat-fila.prot')) > 0 && !(n(g.querySelector('.cat-fila:not(.prot)')) > 0);
    });
    $('filasTarifa').querySelectorAll('.cat-oficio.invalid').forEach(g => g.classList.remove('invalid'));
    if(sinBase){
      sinBase.classList.add('invalid');
      sinBase.scrollIntoView({ block:'center', behavior:'smooth' });
      toast('Escribe cuánto se paga por ' + sinBase.querySelector('.cat-esp').textContent.toLowerCase() + ' para poder sumar el extra de protección', 'error');
      return;
    }
    const tarifas = leerTarifas();
    $('btnGuardar').disabled = true;
    try{
      if(categoriaActual){
        const { error } = await db.from('categorias_pago').update({ nombre, tarifas }).eq('id', categoriaActual.id);
        if(error) throw error;
        toast('Categoría actualizada');
      } else {
        const { error } = await db.from('categorias_pago').insert({ nombre, tarifas });
        if(error) throw error;
        toast('Categoría creada');
      }
      cerrarHoja('sheetFicha');
      cargar();
    } catch(e){
      toast(e.message || 'No se pudo guardar', 'error');
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
  function pintarAsigSub(){
    const c = categoriaActual; if(!c) return;
    const n = usoPorCategoria[c.id] || 0, sin = sinCategoria().length;
    $('asigSub').textContent = (n ? `Usada en ${n} ${n === 1 ? 'modelo' : 'modelos'}` : 'Todavía no la usa ningún modelo') + (sin ? ` · ${sin} sin categoría` : '');
  }
  function visibles(){
    return pestana === 'sin' ? sinCategoria() : modelos;
  }
  function pintarModelosAsignar(){
    const c = categoriaActual;
    const nSin = sinCategoria().length;
    $('chipsModelos').innerHTML = [['sin', `Sin categoría · ${nSin}`], ['todos', `Todos · ${modelos.length}`]]
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
        <span class="m-foto">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : iconoTipo(m.tipo, 22)}</span>
        <span class="m-txt"><span class="m-nom">${esc(m.nombre)}</span>${tag}</span>
        <span class="m-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>
      </button>`;
    }).join('') : `<div class="m-vacio">${pestana === 'sin' ? 'Todos los modelos tienen categoría.' : 'No hay modelos en el catálogo.'}</div>`;
    const n = marcados.size;
    $('btnAsignar').disabled = !n;
    $('btnAsignar').textContent = n ? `Asignar a ${n === 1 ? '1 modelo' : n + ' modelos'}` : 'Elige los modelos';
  }
  $('btnAsignarModelos').addEventListener('click', () => {
    if(!categoriaActual) return;
    pestana = sinCategoria().length ? 'sin' : 'todos';
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
    const cambian = modelos.filter(m => marcados.has(m.id) && m.categoria_pago_id && m.categoria_pago_id !== c.id);
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
