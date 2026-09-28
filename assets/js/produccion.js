// Producción: pedidos en fabricación, sus productos y las etapas de cada uno
// (asignar trabajador, marcar terminado). Solo lo usan los administradores.
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja } = window.AH;
  const AV = window.AV;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const NOMBRE_ESPECIALIDAD = { herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Ventanero', carpintero:'Carpintero' };
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();

  let pedidos = [];
  let trabajadores = [];
  const FILTROS = [ { id:'todos', t:'Todos' }, { id:'asignar', t:'Por asignar' }, { id:'atrasados', t:'Atrasados' } ];
  let filtro = 'todos';

  // ---------------------------------------------------------------------------
  // Cálculos sobre las etapas de un pedido
  // ---------------------------------------------------------------------------
  // La "etapa actual" de una rama es la primera pendiente en orden; las de antes ya
  // están hechas y las de después todavía no se pueden tocar.
  function ramas(item){
    const porRama = {};
    (item.etapas || []).forEach(e => { (porRama[e.rama] = porRama[e.rama] || []).push(e); });
    Object.values(porRama).forEach(l => l.sort((a, b) => a.orden - b.orden));
    return porRama;
  }
  function etapaActual(lista){
    return lista.find(e => e.estado === 'pendiente') || null;
  }
  function resumenPedido(v){
    let total = 0, hechas = 0, sinAsignar = 0;
    (v.items || []).forEach(it => {
      Object.values(ramas(it)).forEach(lista => {
        total += lista.length;
        hechas += lista.filter(e => e.estado === 'hecha').length;
        const act = etapaActual(lista);
        if(act && !act.trabajador_id) sinAsignar++;
      });
    });
    return { total, hechas, sinAsignar };
  }
  function diasAtraso(v){
    if(!v.fecha_entrega) return null;
    return -AV.diasHasta(v.fecha_entrega); // positivo = atrasado
  }

  // ---------------------------------------------------------------------------
  // Cargar
  // ---------------------------------------------------------------------------
  async function cargar(){
    try{
      const { data, error } = await db.from('ventas')
        .select('id,fecha_entrega,cliente:clientes(nombre),items:venta_items(id,nombre,tipo,foto,etapas(id,rama,nombre,orden,especialidad,estado,trabajador_id,foto,terminada_en,trabajador:perfiles(nombre)))')
        .eq('estado', 'en_produccion');
      if(error) throw error;
      pedidos = (data || []).map(v => Object.assign(v, { _resumen: resumenPedido(v) }));
      pedidos.sort((a, b) => {
        const da = diasAtraso(a) || 0, db_ = diasAtraso(b) || 0;
        if((da > 0) !== (db_ > 0)) return db_ > 0 ? 1 : -1;
        if(da > 0 && db_ > 0) return db_ - da;
        const fa = a.fecha_entrega || '9999', fb = b.fecha_entrega || '9999';
        return fa < fb ? -1 : fa > fb ? 1 : 0;
      });
      pintarChips();
      pintarLista();
    } catch(e){
      $('lista').innerHTML = '<div class="vacio">No se pudo cargar. Desliza para reintentar.</div>';
      toast(e.message, 'error');
    }
  }

  function pintarChips(){
    const asignar = pedidos.filter(v => v._resumen.sinAsignar > 0).length;
    const atrasados = pedidos.filter(v => (diasAtraso(v) || 0) > 0).length;
    const cont = $('chips');
    cont.innerHTML = FILTROS.map(f => {
      const n = f.id === 'todos' ? pedidos.length : f.id === 'asignar' ? asignar : atrasados;
      return `<button class="chip ${filtro === f.id ? 'active' : ''}" data-f="${f.id}">${f.t} · ${n}</button>`;
    }).join('');
    $('subtitulo').textContent = pedidos.length + (pedidos.length === 1 ? ' pedido en taller' : ' pedidos en taller');
  }
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if(!b) return;
    filtro = b.dataset.f;
    pintarChips(); pintarLista();
  });

  function pintarLista(){
    let vistos = pedidos;
    if(filtro === 'asignar') vistos = pedidos.filter(v => v._resumen.sinAsignar > 0);
    if(filtro === 'atrasados') vistos = pedidos.filter(v => (diasAtraso(v) || 0) > 0);
    const cont = $('lista');
    if(!vistos.length){ cont.innerHTML = '<div class="vacio">No hay pedidos aquí.</div>'; return; }
    cont.innerHTML = vistos.map((v, i) => {
      const r = v._resumen;
      const da = diasAtraso(v);
      const plazo = da > 0 ? `<span class="plazo tarde">${da} ${da === 1 ? 'día' : 'días'} atrasada</span>`
        : v.fecha_entrega ? `<span class="plazo">Entrega ${AV.fechaCorta(v.fecha_entrega)}</span>` : '';
      const badge = r.sinAsignar > 0 ? `<span class="plazo">${r.sinAsignar} sin asignar</span>` : '<span class="plazo ok">Todo asignado</span>';
      const prod = (v.items || []).map(it => it.nombre).join(', ');
      const pct = r.total ? r.hechas / r.total : 0;
      return `<button class="vcard" style="--i:${i}" data-id="${v.id}">
        <div class="vcard-top">
          <div><div class="vcard-nombre">${esc((v.cliente || {}).nombre || 'Sin nombre')}</div><div class="vcard-num">N° ${v.id}</div></div>
          ${plazo}
        </div>
        <div class="vcard-prod">${esc(prod)}</div>
        <div class="barra"><i style="transform:scaleX(${pct})"></i></div>
        <div class="barra-txt"><span>${r.hechas} de ${r.total} etapas listas</span>${badge}</div>
      </button>`;
    }).join('');
  }
  $('lista').addEventListener('click', (e) => {
    const b = e.target.closest('.vcard'); if(!b) return;
    const v = pedidos.find(x => String(x.id) === b.dataset.id);
    if(v) pintarFicha(v);
  });

  // ---------------------------------------------------------------------------
  // Ficha del pedido: productos y su línea de etapas
  // ---------------------------------------------------------------------------
  let pedidoActual = null;
  function pintarFicha(v){
    pedidoActual = v;
    $('fichaBody').innerHTML = `
      <p class="field-label" style="margin-bottom:2px">N° ${v.id} · ${esc((v.cliente || {}).nombre || '')}</p>
      ${(v.items || []).map(it => itemHtml(it)).join('')}`;
    abrirHoja('sheetFicha');
  }
  function itemHtml(it){
    const grupos = ramas(it);
    const claves = Object.keys(grupos);
    // Un Combo tiene dos líneas en paralelo (puerta y ventana): cada una en su propio
    // bloque para que la línea que las conecta no salte de una rama a la otra.
    const bloques = claves.map(r => grupos[r]).map((lista, idx) => {
      const act = etapaActual(lista);
      const etiqueta = claves.length > 1 ? `<p class="e-rama-tit">${idx === 0 ? 'Puerta' : 'Ventana'}</p>` : '';
      return etiqueta + '<div class="e-rama">' + lista.map(e => {
        const cls = e.estado === 'hecha' ? 'hecha' : (act && act.id === e.id) ? 'actual' : '';
        const dot = e.estado === 'hecha'
          ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '';
        let accion = '';
        if(e.estado === 'hecha'){
          accion = `<span class="e-hecha-info">Terminó${e.trabajador ? ' · ' + esc(e.trabajador.nombre) : ''}</span>`;
        } else if(cls === 'actual'){
          if(e.trabajador_id){
            accion = `<span class="e-chip"><span class="ini">${esc(inicial(e.trabajador ? e.trabajador.nombre : ''))}</span>${esc(e.trabajador ? e.trabajador.nombre : '')}</span><button class="e-terminar" data-terminar="${e.id}">Marcar terminado</button>`;
          } else {
            accion = `<button class="e-asignar" data-asignar="${e.id}" data-esp="${e.especialidad}" data-nombre="${esc(e.nombre)}">Sin asignar · toca para asignar</button>`;
          }
        }
        return `<div class="etapa ${cls}"><div class="e-dot">${dot}</div><div class="e-cuerpo"><div class="e-nom">${esc(e.nombre)}</div><div class="e-fila">${accion}</div></div></div>`;
      }).join('') + '</div>';
    }).join('');
    return `<div class="p-item">
      <div class="p-item-cab">
        <div class="p-item-foto">${it.foto ? `<img src="${esc(it.foto)}" alt="">` : ''}</div>
        <div><div class="p-item-nom">${esc(it.nombre)}</div><div class="p-item-cant">${esc(it.tipo || '')}</div></div>
      </div>
      ${bloques}
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // Asignar trabajador
  // ---------------------------------------------------------------------------
  let etapaParaAsignar = null;
  async function cargarTrabajadores(){
    if(trabajadores.length) return trabajadores;
    const { data, error } = await db.from('perfiles').select('id,nombre,especialidades').eq('rol', 'trabajador').eq('activo', true);
    if(error){ toast(error.message, 'error'); return []; }
    trabajadores = data || [];
    return trabajadores;
  }
  $('fichaBody').addEventListener('click', async (e) => {
    const ba = e.target.closest('[data-asignar]');
    if(ba){
      etapaParaAsignar = { id:Number(ba.dataset.asignar), esp:ba.dataset.esp };
      $('asignarTitulo').textContent = 'Asignar: ' + ba.dataset.nombre;
      const todos = await cargarTrabajadores();
      const filtrados = todos.filter(t => (t.especialidades || []).includes(ba.dataset.esp));
      $('asignarSub').textContent = 'Solo se muestran trabajadores de ' + (NOMBRE_ESPECIALIDAD[ba.dataset.esp] || ba.dataset.esp);
      $('listaTrabajadores').innerHTML = filtrados.length
        ? filtrados.map(t => `<button class="fila-t" data-tid="${t.id}"><span class="u-avatar">${esc(inicial(t.nombre))}</span><span><span class="nom">${esc(t.nombre)}</span><span class="esp">${esc((t.especialidades || []).map(x => NOMBRE_ESPECIALIDAD[x] || x).join(' · '))}</span></span></button>`).join('')
        : '<p class="field-error" style="display:block">No hay trabajadores activos con esa especialidad. Créalos en Usuarios.</p>';
      abrirHoja('sheetAsignar');
      return;
    }
    const bt = e.target.closest('[data-terminar]');
    if(bt){
      etapaParaTerminar = Number(bt.dataset.terminar);
      fotoTerminarBlob = null;
      $('terminarFotoPrev').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/></svg>';
      abrirHoja('sheetTerminar');
    }
  });
  $('listaTrabajadores').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tid]'); if(!b || !etapaParaAsignar) return;
    b.disabled = true;
    try{
      const { error } = await db.rpc('asignar_etapa', { eid: etapaParaAsignar.id, tid: b.dataset.tid });
      if(error) throw error;
      cerrarHoja('sheetAsignar');
      toast('Trabajador asignado');
      await cargar();
      const v = pedidos.find(x => x.id === pedidoActual.id);
      if(v) pintarFicha(v);
    } catch(err){
      toast(err.message, 'error');
      b.disabled = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Marcar terminado (con foto opcional)
  // ---------------------------------------------------------------------------
  let etapaParaTerminar = null;
  let fotoTerminarBlob = null;
  $('btnTerminarFoto').addEventListener('click', () => $('terminarFotoInput').click());
  $('terminarFotoInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    try{
      fotoTerminarBlob = await comprimirFoto(f);
      $('terminarFotoPrev').innerHTML = `<img src="${URL.createObjectURL(fotoTerminarBlob)}" alt="">`;
    } catch(err){ toast('No se pudo procesar la foto', 'error'); }
  });
  $('btnConfirmarTerminar').addEventListener('click', async () => {
    if(!etapaParaTerminar) return;
    $('btnConfirmarTerminar').disabled = true;
    try{
      let fotoUrl = null;
      if(fotoTerminarBlob){
        const path = new Date().toISOString().slice(0, 7) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const { error: errSub } = await db.storage.from('etapas-fotos').upload(path, fotoTerminarBlob, { contentType:'image/jpeg' });
        if(errSub) throw errSub;
        fotoUrl = db.storage.from('etapas-fotos').getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await db.rpc('marcar_etapa_terminada', { eid: etapaParaTerminar, foto_url: fotoUrl });
      if(error) throw error;
      cerrarHoja('sheetTerminar');
      cerrarHoja('sheetFicha');
      toast(data && data.listo ? 'Etapa terminada. El pedido quedó Listo y se avisó a quien lo vendió.' : 'Etapa terminada');
      await cargar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      $('btnConfirmarTerminar').disabled = false;
    }
  });

  $('btnActualizar').addEventListener('click', cargar);

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin'){ location.replace('index.html'); return; }
    cargar();
  })();
})();
