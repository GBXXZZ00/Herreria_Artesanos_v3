// Categorías de pago: los "grupos" que definen cuánto se le paga a cada trabajador por
// especialidad al terminar una etapa (fijo o por m²). Solo lo ve un admin.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja } = window.AH;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const ESPECIALIDADES = [
    { v:'herrero', n:'Herrero' },
    { v:'masilla_pintura', n:'Masilla y pintura' },
    { v:'acabados', n:'Detalles' },
    { v:'ventanero', n:'Ventanero' },
    { v:'carpintero', n:'Carpintero' }
  ];
  const ICONO_MONEDA = '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>';

  let categorias = [];
  let usoPorCategoria = {};

  async function cargar(){
    try{
      const [{ data: cats, error: e1 }, { data: cat, error: e2 }] = await Promise.all([
        db.from('categorias_pago').select('*').order('id'),
        db.from('catalogo').select('categoria_pago_id').not('categoria_pago_id', 'is', null)
      ]);
      if(e1) throw e1;
      if(e2) throw e2;
      categorias = cats || [];
      usoPorCategoria = {};
      (cat || []).forEach(r => { usoPorCategoria[r.categoria_pago_id] = (usoPorCategoria[r.categoria_pago_id] || 0) + 1; });
      pintarLista();
    } catch(e){
      $('lista').innerHTML = '<div class="c-vacio">No se pudo cargar. Desliza para reintentar.</div>';
      toast(e.message || 'No se pudo cargar', 'error');
    }
  }

  function tarifasHtml(t){
    const filas = ESPECIALIDADES
      .filter(e => t && t[e.v] && Number(t[e.v].monto) > 0)
      .map(e => `<span class="c-tarifa">${esc(e.n)} <b>$${Number(t[e.v].monto)}${t[e.v].modo === 'm2' ? '/m²' : ''}</b></span>`);
    return filas.length ? `<div class="c-tarifas">${filas.join('')}</div>` : '<p class="c-usado" style="margin-top:9px">Sin tarifas todavía</p>';
  }

  function pintarLista(){
    const cont = $('lista');
    $('subtitulo').textContent = categorias.length + (categorias.length === 1 ? ' grupo' : ' grupos');
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
  function filaTarifaHtml(esp, datos){
    const monto = datos && datos.monto != null ? datos.monto : '';
    const modo = (datos && datos.modo) || 'fijo';
    return `
      <div class="cat-fila" data-esp="${esp.v}">
        <span class="cat-esp">${esc(esp.n)}</span>
        <div class="cat-modo">
          <button type="button" data-modo="fijo" class="${modo === 'fijo' ? 'on' : ''}">Fijo</button>
          <button type="button" data-modo="m2" class="${modo === 'm2' ? 'on' : ''}">m²</button>
        </div>
        <div class="cat-monto"><input type="text" inputmode="decimal" value="${esc(monto)}" placeholder="0"></div>
      </div>`;
  }
  function pintarFicha(c){
    categoriaActual = c;
    $('fichaTitulo').textContent = c ? 'Editar categoría' : 'Nueva categoría';
    $('fNombre').value = c ? c.nombre : '';
    $('eNombre').textContent = '';
    $('filasTarifa').innerHTML = ESPECIALIDADES.map(e => filaTarifaHtml(e, c && c.tarifas ? c.tarifas[e.v] : null)).join('');
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
    fila.querySelectorAll('button[data-modo]').forEach(x => x.classList.toggle('on', x === b));
  });

  function leerTarifas(){
    const tarifas = {};
    $('filasTarifa').querySelectorAll('.cat-fila').forEach(fila => {
      const esp = fila.dataset.esp;
      const monto = parseFloat(fila.querySelector('.cat-monto input').value.replace(',', '.'));
      const modo = fila.querySelector('button[data-modo].on').dataset.modo;
      if(!isNaN(monto) && monto > 0) tarifas[esp] = { monto, modo };
    });
    return tarifas;
  }

  $('btnGuardar').addEventListener('click', async () => {
    const nombre = $('fNombre').value.trim();
    $('eNombre').textContent = '';
    if(!nombre){ $('eNombre').textContent = 'Escribe el nombre'; return; }
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
    cargar();
  })();
})();
