// Taller › Pedidos: una tarjeta por pedido (o por orden de exhibición) con cada producto y sus
// pasos como fichitas de colores. El drawer del pedido muestra quién hace cada paso, su foto y
// lo que se le paga. Asignar usa la hoja de siempre. Un paso que era para un sábado que ya pasó
// y no se terminó lleva la marca ↩ (no se mueve solo: sigue con el mismo trabajador).
// El administrador asigna; cada trabajador marca terminado lo suyo desde su teléfono.
// La vendedora solo mira el avance (sin montos ni botones).
(function(){
  'use strict';
  const db = window.db;
  const { esc, toast, abrirHoja, cerrarHoja, dinero, montoOrNull, iconoTipo, fotoModelo, fotoItem, etiquetaOtroColor, acabados, tieneColores,
          estadoDesdeEspecificaciones, especificacionesDesdeEstado, sabados, sabadoCorto, topeTexto, medidas, imgMini, verFoto } = window.AH;
  const AV = window.AV;
  const S = window.Sesion;
  const $ = (id) => document.getElementById(id);

  const NOMBRE_ESPECIALIDAD = { herrero:'Herrero', masilla_pintura:'Masilla y pintura', acabados:'Detalles', ventanero:'Aluminio', carpintero:'Carpintero' };
  const TIPOS_PRODUCCION = ['Puerta Multilock', 'Portón', 'Puerta de Madera', 'Ventana', 'Combo'];
  const inicial = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
  const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const ICON_OK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const ICON_VUELTA = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

  let pedidos = [];
  let trabajadores = [];
  let categorias = [];
  let montos = {};          // lo que se paga por cada paso que falta (solo administradores)
  let lectura = false;      // vendedora: solo mirar
  let llevaMadera = false;  // quien asigna la madera (Gualfredo)
  let puedeMadera = false;  // quien marca los pasos de madera (quien la lleva y la vendedora de madera)
  let SAB = sabados();
  const esMadera = (it) => it.tipo === 'Puerta de Madera';
  const FILTROS_ADMIN = [ { id:'todos', t:'Todos' }, { id:'asignar', t:'Por asignar' }, { id:'proceso', t:'En proceso' }, { id:'listos', t:'Listos' } ];
  let FILTROS = FILTROS_ADMIN;
  const SUBTITULO = { asignar:'Por asignar', proceso:'Pedidos en proceso', listos:'Listos para entregar' };
  // Enlaces viejos (Inicio, avisos): atrasados y sin categoría caen en el filtro que los muestra
  const ALIAS = { atrasados:'proceso', sincat:'asignar' };
  const params = new URLSearchParams(location.search);
  let filtro = ALIAS[params.get('filtro')] || params.get('filtro') || 'todos';
  if(!FILTROS.some(f => f.id === filtro)) filtro = 'todos';
  let abrirAlCargar = Number(params.get('abrir') || params.get('pedido')) || null;

  // ---------------------------------------------------------------------------
  // Cálculos sobre las etapas de un pedido
  // ---------------------------------------------------------------------------
  // La "etapa actual" de una rama es la primera pendiente en orden; las de antes ya
  // están hechas y las de después todavía no se pueden tocar.
  // Pedidos nuevos: primero la protección y luego la ventana (que se instala en ella). Viejos: como antes.
  const ORDEN_RAMA = { principal:1, proteccion:2, ventana:3 };
  const ORDEN_RAMA_VIEJO = { principal:1, ventana:2, proteccion:3 };
  function ramas(item){
    const porRama = {};
    const ord = (item.etapas || []).some(e => e.oficio) ? ORDEN_RAMA : ORDEN_RAMA_VIEJO;
    (item.etapas || []).slice().sort((a, b) => (ord[a.rama] || 9) - (ord[b.rama] || 9))
      .forEach(e => { (porRama[e.rama] = porRama[e.rama] || []).push(e); });
    Object.values(porRama).forEach(l => l.sort((a, b) => a.orden - b.orden));
    return porRama;
  }
  // Título de cada bloque (línea) de un producto, con sus medidas
  function tituloRama(it, rama, lista){
    const e = it.especificaciones || {};
    const med = (a, b) => (a && b) ? ' · ' + medidas({ alto:a, ancho:b }) : '';
    const cu = e.ventanas_alto && e.ventanas_ancho ? ' c/u' : '';
    const nuevo = (lista || []).some(x => x.oficio);
    if(nuevo){
      if(it.tipo === 'Combo') return rama === 'ventana' ? '2 ventanas' + med(e.ventanas_alto, e.ventanas_ancho) + cu : 'Puerta y protecciones';
      if(rama === 'proteccion') return 'Protección' + med(e.alto, e.ancho);
      if(rama === 'ventana') return 'Ventana' + med(e.alto, e.ancho);
      return '';
    }
    if(rama === 'ventana') return '2 ventanas' + med(e.ventanas_alto, e.ventanas_ancho) + cu;
    if(rama === 'proteccion') return '2 protecciones' + med(e.ventanas_alto, e.ventanas_ancho) + cu;
    return 'Puerta' + med(e.alto, e.ancho);
  }
  // Qué le falta a un paso para poder empezar: el anterior de su línea o un paso de otra línea
  // que espera (ej. "Instalar" espera la "Pintura" de la protección)
  function esperaDe(it, e){
    if(e.estado !== 'pendiente') return null;
    const et = it.etapas || [];
    const antes = et.filter(x => x.rama === e.rama && x.orden < e.orden && x.estado === 'pendiente').sort((a, b) => a.orden - b.orden)[0];
    if(antes) return antes;
    const refs = e.despues_de || [];
    return et.find(x => x.estado === 'pendiente' && refs.includes(x.rama + '/' + x.orden)) || null;
  }
  // ↩ "De la semana pasada": asignado para un sábado anterior al de esta semana y sin terminar.
  // Que el Hierro se haga una semana y la Masilla la siguiente es normal: solo se marca el mismo paso.
  const arrastrado = (e) => e.estado === 'pendiente' && !!e.trabajador_id && !!e.para_el && String(e.para_el).slice(0, 10) < SAB.este;
  // Cómo va cada paso: h hecho · p haciendo · a asignado y puede empezar · w asignado, espera el anterior
  // · s sin asignar · r ↩ era para un sábado que ya pasó
  function estadoPaso(it, e){
    if(e.estado === 'hecha') return 'h';
    if(!e.trabajador_id) return 's';
    if(arrastrado(e)) return 'r';
    if(e.iniciada_en) return 'p';
    if(esperaDe(it, e)) return 'w';
    return 'a';
  }
  // Solo los productos que se fabrican (una pieza de exhibición ya está hecha)
  const itemsFabrica = (v) => (v.items || []).filter(it => (it.etapas || []).length);
  // Producto que se agregó (o cambió) cuando el pedido ya estaba en fabricación y todavía tiene pasos sin asignar
  const esNuevo = (it) => !!it.agregado_en && (it.etapas || []).some(e => e.estado === 'pendiente' && !e.trabajador_id);
  // Criterio único en todo el Taller: "por asignar" cuenta todos los pasos sin trabajador
  function resumenPedido(v){
    let total = 0, hechas = 0, sinAsignar = 0, sinCat = 0, asignados = 0, nuevos = 0, madera = false;
    const arrastre = [], fotosHoy = [];
    itemsFabrica(v).forEach(it => {
      if(esNuevo(it)) nuevos++;
      if(!it.categoria_pago_id) sinCat++;
      if(esMadera(it)) madera = true;
      (it.etapas || []).forEach(e => {
        total++;
        if(e.estado === 'hecha'){
          hechas++; asignados++;
          if(e.foto && e.terminada_en && diaDe(e.terminada_en) === SAB.hoy && e.trabajador) fotosHoy.push(primerNombre(e.trabajador.nombre));
        }
        else if(!e.trabajador_id) sinAsignar++;
        else { asignados++; if(arrastrado(e)) arrastre.push(e); }
      });
    });
    const lista = v.estado === 'lista' || (total > 0 && hechas === total);
    return { total, hechas, sinAsignar, sinCat, asignados, nuevos, madera, arrastre, fotosHoy: [...new Set(fotosHoy)], lista };
  }
  function diasAtraso(v){
    if(!v.fecha_entrega) return null;
    return -AV.diasHasta(v.fecha_entrega); // positivo = atrasado
  }
  const nombreCategoria = (id) => (categorias.find(c => c.id === id) || {}).nombre || '';
  // Fechas y horas en la hora del teléfono (terminada_en viene en UTC)
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function diaDe(ts){ const d = new Date(ts); return isNaN(d) ? '' : iso(d); }
  function hora(ts){
    const d = new Date(ts);
    if(isNaN(d)) return '';
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return ((h % 12) || 12) + ':' + m + (h < 12 ? ' am' : ' pm');
  }
  // "sáb 21" o "sáb 21 nov"
  function fechaDia(f, conMes){
    const [y, m, d] = String(f || '').slice(0, 10).split('-').map(Number);
    if(!y) return '';
    const x = new Date(y, m - 1, d);
    const dia = x.toLocaleDateString('es-VE', { weekday:'short' }).replace('.', '');
    return dia + ' ' + d + (conMes ? ' ' + x.toLocaleDateString('es-VE', { month:'short' }).replace('.', '') : '');
  }
  function cuando(ts){
    const f = diaDe(ts);
    if(!f) return '';
    const d = AV.diasHasta(f);
    return d === 0 ? 'hoy ' + hora(ts) : d === -1 ? 'ayer' : 'el ' + fechaDia(f, true);
  }
  function enDias(d){ return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d > 1 ? 'en ' + d + ' días' : d === -1 ? 'atrasada 1 día' : 'atrasada ' + (-d) + ' días'; }
  // En qué va un pedido (para la vendedora): la etapa actual de cada línea
  function enQueVa(v){
    const act = [];
    itemsFabrica(v).forEach(it => (it.etapas || []).forEach(e => { if(e.estado === 'pendiente' && !esperaDe(it, e) && !act.includes(e.nombre)) act.push(e.nombre); }));
    return act.length ? 'En ' + act.join(' y ').toLowerCase() : 'Casi listo';
  }
  const tituloPedido = (v) => v.interna
    ? 'Exhibición' + (v.sede && v.sede.nombre ? ' · ' + v.sede.nombre : '')
    : `N° ${v.id} · ${(v.cliente || {}).nombre || 'Sin nombre'}`;
  // Se puede asignar desde aquí (madera: solo quien la lleva)
  const puedeAsignar = (it) => !lectura && !!it.categoria_pago_id && !(esMadera(it) && !llevaMadera) && (it.etapas || []).some(e => e.estado === 'pendiente');

  // ---------------------------------------------------------------------------
  // Cargar
  // ---------------------------------------------------------------------------
  async function cargar(){
    SAB = sabados();
    try{
      if(lectura){
        const { data, error } = await db.rpc('produccion_lectura');
        if(error) throw error;
        montos = {};
        return mostrarPedidos(data || []);
      }
      const [rv, rc] = await Promise.all([
        db.from('ventas')
          .select('id,estado,total,fecha_entrega,lista_en,token_seguimiento,interna,sede:sedes(nombre),cliente:clientes(nombre,telefono),abonos(monto,tipo,estado),items:venta_items(id,nombre,tipo,foto,pieza_id,cantidad,agregado_en,categoria_pago_id,especificaciones,catalogo:catalogo(id,fotos),etapas(id,unidad,rama,nombre,orden,especialidad,oficio,incluye,despues_de,estado,unidades,para_el,trabajador_id,foto,terminada_en,iniciada_en,monto,pago_id,trabajador:perfiles(nombre)))')
          .in('estado', ['en_produccion', 'lista']),
        db.from('categorias_pago').select('id,nombre,producto').eq('activo', true).order('nombre', { ascending:true })
      ]);
      if(rv.error) throw rv.error;
      if(rc.error) toast('No se pudieron cargar las categorías de pago', 'error');
      categorias = rc.data || [];
      await cargarMontos((rv.data || []).filter(v => v.estado === 'en_produccion').map(v => v.id));
      mostrarPedidos(rv.data || []);
    } catch(e){
      const red = /fetch|network|Failed/i.test(String((e && e.message) || ''));
      $('lista').innerHTML = '<div class="vacio"><h3>No se pudo cargar</h3><p>Revisa tu internet y toca actualizar.</p></div>';
      toast(red ? 'Sin conexión. Revisa tu internet y toca actualizar.' : ((e && e.message) || 'No se pudo cargar'), 'error');
    }
  }
  // Lo que se paga por cada paso que falta. Si falla (o la función todavía no está en la base),
  // la pantalla sigue igual, sin esos montos.
  async function cargarMontos(ids){
    montos = {};
    if(lectura || !ids.length) return;
    try{
      const { data, error } = await db.rpc('montos_pasos', { p_ventas: ids });
      if(!error && data && typeof data === 'object' && !Array.isArray(data)) montos = data;
    } catch(e){}
  }
  const montoDe = (e) => {
    if(lectura) return null;
    const m = e.estado === 'hecha' ? e.monto : montos[e.id];
    return m == null || Number(m) === 0 ? null : Number(m);
  };

  // Cada unidad de un producto (ej. 2 puertas iguales) es un trabajo aparte: se muestra y se asigna por separado
  function porUnidad(items){
    const out = [];
    (items || []).forEach(it => {
      const us = [...new Set((it.etapas || []).map(e => e.unidad || 1))].sort((a, b) => a - b);
      if(us.length <= 1){ out.push(it); return; }
      us.forEach(u => out.push(Object.assign({}, it, { _key: it.id + '-' + u, _unidad: u, _de: us.length, etapas: it.etapas.filter(e => (e.unidad || 1) === u) })));
    });
    return out;
  }
  const claveItem = (it) => String(it._key || it.id);
  function mostrarPedidos(lista){
    lista.forEach(v => { v._prod = (v.items || []).filter(it => (it.etapas || []).length).map(it => it.nombre + (it.cantidad > 1 ? ' ×' + it.cantidad : '')).join(', '); v.items = porUnidad(v.items); });
    pedidos = lista.map(v => Object.assign(v, { _resumen: resumenPedido(v) }));
    pedidos.sort((a, b) => {
      if(a._resumen.lista !== b._resumen.lista) return a._resumen.lista ? 1 : -1;
      const da = diasAtraso(a) || 0, db_ = diasAtraso(b) || 0;
      if((da > 0) !== (db_ > 0)) return db_ > 0 ? 1 : -1;
      if(da > 0 && db_ > 0) return db_ - da;
      if(a.interna !== b.interna) return a.interna ? 1 : -1;
      const fa = a.fecha_entrega || '9999', fb = b.fecha_entrega || '9999';
      return fa < fb ? -1 : fa > fb ? 1 : a.id - b.id;
    });
    pintarChips();
    pintarLista();
    if(abrirAlCargar){
      const v = pedidos.find(x => x.id === abrirAlCargar);
      abrirAlCargar = null;
      // se quita ?abrir de la dirección: al recargar no se vuelve a abrir
      if(params.has('abrir') || params.has('pedido')){ try{ params.delete('abrir'); params.delete('pedido'); history.replaceState(history.state, '', location.pathname + (params.toString() ? '?' + params : '')); } catch(e){} }
      if(v) pintarFicha(v);
      else toast('Ese pedido ya no está en el taller', 'error');
    }
  }

  const enFiltro = (v, f) => {
    const r = v._resumen;
    if(f === 'asignar') return !r.lista && r.sinAsignar > 0;
    if(f === 'proceso') return !r.lista && r.asignados > 0;
    if(f === 'listos') return r.lista;
    return true;
  };
  function pintarChips(){
    $('chips').innerHTML = FILTROS.map(f =>
      `<button class="chip ${filtro === f.id ? 'active' : ''}" role="tab" aria-selected="${filtro === f.id}" data-f="${f.id}">${f.t} ${pedidos.filter(v => enFiltro(v, f.id)).length}</button>`).join('');
    const n = pedidos.length;
    $('subtitulo').textContent = SUBTITULO[filtro] || (n === 1 ? '1 pedido en el taller' : n + ' pedidos en el taller');
  }
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if(!b) return;
    filtro = b.dataset.f;
    pintarChips(); pintarLista();
    b.scrollIntoView({ block:'nearest', inline:'nearest' });
  });

  // Píldora de la fecha de entrega: ámbar si faltan 2 días o menos, roja si pasó, verde si está lista
  function pildora(v){
    const r = v._resumen;
    if(r.lista){
      const d = v.lista_en ? AV.diasHasta(diaDe(v.lista_en)) : null;
      const desde = d === 0 ? ' desde hoy' : d === -1 ? ' desde ayer' : d != null && d < -1 ? ' hace ' + (-d) + ' días' : '';
      return `<span class="tl-pill ok">Lista${filtro === 'listos' ? esc(desde) : ''}</span>`;
    }
    if(!v.fecha_entrega) return '<span class="tl-pill">sin fecha</span>';
    const d = AV.diasHasta(v.fecha_entrega);
    if(d < 0) return `<span class="tl-pill rj">${esc(fechaDia(v.fecha_entrega))} · ${esc(enDias(d))}</span>`;
    if(d <= 2) return `<span class="tl-pill am">${esc(fechaDia(v.fecha_entrega))} · ${esc(enDias(d))}</span>`;
    return `<span class="tl-pill">${esc(fechaDia(v.fecha_entrega, true))}</span>`;
  }
  const NOMBRE_CORTO = { 'Masilla y pintura':'Masilla' };
  function fichitas(it){
    return Object.values(ramas(it)).flat().map(e => {
      const st = estadoPaso(it, e);
      const quien = e.trabajador && (st === 'p' || st === 'a' || st === 'r') ? ' · ' + esc(primerNombre(e.trabajador.nombre)) : '';
      return `<i class="tl-f ${st}">${esc(NOMBRE_CORTO[e.nombre] || e.nombre)}${quien}${st === 'h' ? ' ✓' : st === 'r' ? ' ↩' : ''}</i>`;
    }).join('');
  }
  // Lo que pide atención, al pie de la tarjeta
  function pieTarjeta(v){
    const r = v._resumen;
    if(r.lista){
      const d = v.lista_en ? AV.diasHasta(diaDe(v.lista_en)) : null;
      const desde = d === 0 ? 'Lista desde hoy' : d === -1 ? 'Lista desde ayer' : d != null && d < -1 ? `Lista hace ${-d} días` : 'Lista para entregar';
      return { t: desde + (v.interna || lectura ? '' : ' · avisar al cliente') };
    }
    if(lectura) return { t: enQueVa(v) };
    if(r.arrastre.length){
      const para = r.arrastre.map(e => String(e.para_el).slice(0, 10)).sort()[0];
      return { t: `↩ Era para el ${fechaDia(para)} y no se terminó`, rojo:true };
    }
    const partes = [];
    if(r.fotosHoy.length) partes.push(`Foto nueva de ${r.fotosHoy.join(' y ')} hoy`);
    if(r.madera) partes.push('Madera · la lleva Gualfredo');
    if(r.sinAsignar) partes.push(r.sinAsignar === 1 ? '1 paso por asignar' : r.sinAsignar + ' pasos por asignar');
    if(r.sinCat && !partes.length) partes.push('Falta la categoría de pago');
    return { t: partes.join(' · ') };
  }
  // Primera unidad con pasos sin asignar que se puede asignar desde aquí
  const primeraPorAsignar = (v) => (v.items || []).find(it => puedeAsignar(it) && (it.etapas || []).some(e => e.estado === 'pendiente' && !e.trabajador_id));
  function tarjeta(v, i){
    const r = v._resumen;
    const pie = pieTarjeta(v);
    const botonAsignar = !lectura && !r.lista && r.asignados === 0 && r.sinAsignar > 0 && primeraPorAsignar(v);
    const prods = itemsFabrica(v).map(it => `<div class="tl-prod"><span>${esc(it.nombre)}${it._de ? ` ${it._unidad} de ${it._de}` : it.cantidad > 1 ? ' ×' + it.cantidad : ''}</span><div class="tl-trk">${fichitas(it)}</div></div>`).join('');
    let abajo;
    if(filtro === 'listos' && r.lista && !v.interna && !lectura){
      const resta = AV.resta(v);
      const tel = v.cliente && v.cliente.telefono;
      abajo = `<div class="tl-kv"><div><span>Debe el cliente</span><b class="${resta > 0 ? 'debe' : 'ok'}">${resta > 0 ? dinero(resta) : '$0 · pagado'}</b></div>
          <div><span>Entrega</span><b>${v.fecha_entrega ? esc(fechaDia(v.fecha_entrega, true)) : 'sin fecha'}</b></div></div>
        <div class="tl-ats">${tel ? `<a href="${esc(AV.linkSeguimientoWA(v))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button type="button" data-abrir="${v.id}">Fotos</button><a href="ventas.html?abrir=${v.id}" data-sub>Venta</a></div>
        <button class="btn-primary tl-entregar" type="button" data-entregar="${v.id}">Marcar entregada</button>`;
    } else {
      abajo = `<div class="tl-pie"><span class="${pie.rojo ? 'rojo' : ''}">${esc(pie.t)}</span>${botonAsignar
        ? `<button class="tl-btn-asignar" type="button" data-asignar-pedido="${v.id}">Asignar</button>`
        : `<button class="tl-abrir" type="button" data-abrir="${v.id}">Abrir ›</button>`}</div>`;
    }
    return `<article class="tl-card" style="--i:${i}" data-id="${v.id}">
      <div class="tl-top"><b>${esc(tituloPedido(v))}</b>${pildora(v)}</div>
      ${prods}
      ${abajo}
    </article>`;
  }
  function pintarLista(){
    const vistos = pedidos.filter(v => enFiltro(v, filtro));
    const cont = $('lista');
    if(!vistos.length){
      const vacio = {
        asignar: ['Nada por asignar', 'Todo lo que entró ya tiene quién lo haga.', pedidos.some(v => enFiltro(v, 'proceso')) ? '<button class="btn-secondary tl-vacio-btn" type="button" data-ir="proceso">Ver lo asignado</button>' : ''],
        proceso: ['Nada en proceso', 'Cuando asignes un paso, el pedido sale aquí.', ''],
        listos: ['Nada listo todavía', 'Aquí sale un pedido cuando todos sus pasos están hechos.', '']
      }[filtro];
      cont.innerHTML = pedidos.length && vacio
        ? `<div class="vacio"><h3>${vacio[0]}</h3><p>${vacio[1]}</p>${vacio[2]}</div>`
        : `<div class="vacio"><h3>El taller está libre</h3><p>Cuando un pedido pase a fabricación aparece aquí.${lectura ? '' : ' Con el botón + puedes fabricar algo para exhibición.'}</p></div>`;
      return;
    }
    cont.innerHTML = vistos.map(tarjeta).join('')
      + (filtro === 'listos' ? '<p class="tl-nota">Aquí sale un pedido cuando todos sus pasos están hechos, sin importar en qué semana se asignaron.</p>' : '');
  }
  $('lista').addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]');
    if(ir){ filtro = ir.dataset.ir; pintarChips(); pintarLista(); return; }
    if(e.target.closest('a')) return;   // WhatsApp y Venta siguen su enlace
    const be = e.target.closest('[data-entregar]');
    if(be){ const v = pedidos.find(x => String(x.id) === be.dataset.entregar); if(v) marcarEntregada(v, be); return; }
    const ba = e.target.closest('[data-asignar-pedido]');
    if(ba){ const v = pedidos.find(x => String(x.id) === ba.dataset.asignarPedido); if(v) asignarDesdeTarjeta(v); return; }
    const card = e.target.closest('.tl-card'); if(!card) return;
    const v = pedidos.find(x => String(x.id) === card.dataset.id);
    if(v) pintarFicha(v);
  });
  function asignarDesdeTarjeta(v){
    pedidoActual = v;
    const it = primeraPorAsignar(v);
    if(it) abrirAsignarTodo(claveItem(it));
    else pintarFicha(v);
  }
  let entregando = false;
  async function marcarEntregada(v, btn){
    if(entregando) return;
    const r = AV.resta(v);
    const pregunta = r > 0 ? `Todavía debe ${dinero(r)}. ¿Marcarlo como entregado igual?` : `¿Marcar el pedido N° ${v.id} como entregado?`;
    if(!confirm(pregunta)) return;
    entregando = true; btn.disabled = true;
    try{
      const { error } = await db.rpc('cambiar_estado_venta', { vid: v.id, nuevo:'entregada', desde: v.estado });
      if(error) throw error;
      toast(`Pedido N° ${v.id} entregado.`);
      await cargar();
    } catch(err){
      const m = String((err && err.message) || '');
      toast(/fetch|network|Failed/i.test(m) ? 'No se pudo guardar. Revisa la conexión y toca Marcar entregada otra vez.' : m || 'No se pudo marcar', 'error');
      btn.disabled = false;
    } finally { entregando = false; }
  }

  // ---------------------------------------------------------------------------
  // Drawer del pedido: atajos, y por cada unidad sus pasos con quién, foto y monto
  // ---------------------------------------------------------------------------
  let pedidoActual = null;
  // El Hierro asignado entra al plan de corte de ese sábado; Costeo abre el modelo (solo Ray o Gualfredo)
  let verCostos = false;
  if(window.Sesion) window.Sesion.perfil().then(p => { verCostos = !!(p && p.confirma_abonos); }).catch(() => {});
  function atajosHtml(v){
    const a = [];
    if(!v.interna) a.push(`<a href="ventas.html?abrir=${v.id}" data-sub>Venta</a>`);
    if(!v.interna && v.token_seguimiento) a.push(`<a href="seguimiento.html?t=${encodeURIComponent(v.token_seguimiento)}" target="_blank" rel="noopener">Seguimiento</a>`);
    if(!lectura && verCostos){
      const sab = [...new Set((v.items || []).flatMap(it => (it.etapas || []).filter(e => e.oficio === 'hierro' && e.estado === 'pendiente' && e.trabajador_id && e.para_el).map(e => String(e.para_el).slice(0, 10))))].sort()[0];
      a.push(`<a href="costos.html?tab=semana${sab ? '&para=' + encodeURIComponent(sab) : ''}" data-sub>✂ Corte</a>`);
      const mod = (itemsFabrica(v).find(it => it.catalogo && it.catalogo.id) || {}).catalogo;
      if(mod) a.push(`<a href="costos.html?modelo=${encodeURIComponent(mod.id)}" data-sub>Costeo</a>`);
    }
    return a.length ? `<div class="tl-ats">${a.join('')}</div>` : '';
  }
  function pintarFicha(v){
    pedidoActual = v;
    const r = v._resumen;
    let sub;
    if(v.interna) sub = (v._prod || '') + ' · orden para exhibir';
    else {
      const p = [];
      if(v.fecha_entrega) p.push('Entrega ' + fechaDia(v.fecha_entrega, true) + ' · ' + enDias(AV.diasHasta(v.fecha_entrega)));
      if(r.lista) p.push('lista para entregar');
      if(!lectura && v.total != null){ const resta = AV.resta(v); p.push(resta > 0 ? 'debe ' + dinero(resta) : 'pagado completo'); }
      sub = p.join(' · ');
    }
    const hayFoto = itemsFabrica(v).some(it => (it.etapas || []).some(e => e.estado === 'hecha' && e.foto));
    $('fichaBody').innerHTML = `
      <h2 class="tl-dt">${esc(tituloPedido(v))}</h2>
      ${sub ? `<p class="tl-ds">${esc(sub)}</p>` : ''}
      ${atajosHtml(v)}
      ${itemsFabrica(v).map(it => itemHtml(it)).join('')}
      ${hayFoto ? '<p class="tl-nota">Toca un paso hecho para ver su foto en grande.</p>' : ''}
      ${r.arrastre.length ? '<p class="tl-nota">Que el Hierro y la Masilla caigan en semanas distintas es normal: eso no se marca.</p>' : ''}
      ${v.interna && !lectura ? `<button class="btn-cancelar-orden" type="button" data-cancelar-orden="${v.id}">Cancelar esta orden</button>` : ''}`;
    abrirHoja('sheetFicha');
  }
  function catHtml(it){
    if(lectura || !it.categoria_pago_id) return '';
    return `<button class="p-cat" type="button" data-cat-item="${it.id}"><span>Pago: ${esc(nombreCategoria(it.categoria_pago_id) || 'Categoría')}</span></button>`;
  }
  // Sin categoría no se asigna: el aviso lleva directo a elegirla
  function catFaltaHtml(it){
    if(lectura || it.categoria_pago_id) return '';
    return `<button class="cat-falta" type="button" data-cat-item="${it.id}"><b>Primero dale una categoría de pago.</b> Sin ella no se puede asignar. Toca aquí.</button>`;
  }
  function pasoHtml(it, e, n, grupos){
    const st = estadoPaso(it, e);
    const espera = esperaDe(it, e);
    const quien = e.trabajador ? esc(e.trabajador.nombre) : '';
    let sub;
    if(st === 'h') sub = (quien ? quien + ' · ' : '') + 'terminó ' + esc(cuando(e.terminada_en));
    else if(st === 's') sub = '<span class="e-por">sin asignar</span>';
    else if(st === 'r') sub = `${quien} · era para el ${esc(fechaDia(e.para_el))} · no lo terminó`;
    else if(st === 'p') sub = `${quien} · <span class="e-ahora">${diaDe(e.iniciada_en) === SAB.hoy ? 'haciéndolo desde ' + esc(hora(e.iniciada_en)) : 'haciéndolo desde el ' + esc(fechaDia(diaDe(e.iniciada_en)))}</span>`;
    else if(st === 'w' && espera) sub = `${quien} · ${espera.rama === e.rama ? 'después de ' : 'espera: '}${esc(espera.nombre.toLowerCase())}${espera.rama !== e.rama ? ' de ' + esc(tituloRama(it, espera.rama, grupos[espera.rama]).split(' · ')[0].toLowerCase()) : ''}`;
    else sub = `${quien} · ya puede empezar`;
    const m = montoDe(e);
    const monto = m == null ? '' : `<span class="tl-monto">${dinero(m)}${st === 'h' ? `<small class="${e.pago_id ? '' : 'pp'}">${e.pago_id ? 'pagado' : 'por pagar'}</small>` : ''}</span>`;
    // Madera: el carpintero no usa teléfono; el paso que toca lo marca quien lleva la madera
    const btnMadera = puedeMadera && e.oficio === 'madera' && e.estado === 'pendiente' && !espera && e.trabajador_id
      ? `<button class="btn-madera" type="button" data-madera="${e.id}">Marcar terminado</button>` : '';
    const foto = st === 'h' && e.foto;
    return `<div class="tl-paso ${st}"${foto ? ` data-foto="${esc(e.foto)}" role="button" tabindex="0" aria-label="Ver la foto de ${esc(e.nombre)}"` : ''}>
      <span class="tl-dot ${st}">${st === 'h' ? ICON_OK : st === 'r' ? ICON_VUELTA : n}</span>
      <div class="tl-pt"><b class="e-nom">${esc(e.nombre)}</b><span class="tl-ps">${sub}</span>${btnMadera}</div>
      ${foto ? `<span class="tl-mini">${imgMini(e.foto, 'Foto de ' + e.nombre)}</span>` : ''}${monto}
    </div>`;
  }
  function itemHtml(it){
    const grupos = ramas(it);
    const claves = Object.keys(grupos);
    // Un Combo tiene tres líneas en paralelo (puerta, 2 ventanas y 2 protecciones): cada una en su bloque
    const bloques = claves.map(r => {
      const lista = grupos[r];
      const tit = claves.length > 1 || it.tipo === 'Combo' ? tituloRama(it, r, lista) : '';
      // Lo que incluye el bloque cuando junta varias piezas (ej. "Puerta + 2 protecciones de ventana")
      const inc = (lista.find(x => x.incluye && x.incluye.includes('+')) || {}).incluye;
      const etiqueta = (tit ? `<p class="e-rama-tit">${esc(tit)}</p>` : '') + (inc ? `<p class="e-rama-inc">Incluye: ${esc(inc.charAt(0).toLowerCase() + inc.slice(1))}</p>` : '');
      // ↩ Lo de la semana pasada sigue con el mismo trabajador hasta que alguien lo cambie
      const quienes = [...new Set(lista.filter(arrastrado).map(e => primerNombre(e.trabajador ? e.trabajador.nombre : '')))];
      const caja = !lectura && quienes.length
        ? `<p class="tl-carry">Sigue en la lista de ${esc(quienes.join(' y '))} para este sábado.${puedeAsignar(it) ? ' Con Asignar se lo das a otro.' : ''}</p>` : '';
      return etiqueta + '<div class="tl-pasos">' + lista.map((e, i) => pasoHtml(it, e, i + 1, grupos)).join('') + '</div>' + caja;
    }).join('');
    const fi = fotoItem(it);
    const nombre = esc(it.nombre) + (it._de ? ` · ${it._unidad} de ${it._de}` : it.cantidad > 1 ? ' ×' + it.cantidad : '');
    const sub = it.tipo === 'Combo' ? 'Combo · 1 puerta + 2 ventanas + 2 protecciones' : '';
    return `<section class="tl-unidad">
      <div class="tl-uh"><div class="tl-uh-t"><b>${nombre}</b>${esNuevo(it) ? ' <span class="p-unidad p-nuevo">Nuevo</span>' : ''}${sub ? `<span class="tl-uh-s">${esc(sub)}</span>` : ''}</div>
        ${puedeAsignar(it) ? `<button class="tl-btn-asignar" type="button" data-asignar-todo="${esc(claveItem(it))}">Asignar</button>` : ''}</div>
      ${catHtml(it)}
      ${fi.otroColor ? `<p class="p-foto-otra">${esc(etiquetaOtroColor(fi, it.tipo))}.${lectura ? '' : ` Sube la foto en ${esc(String(fi.color).toLowerCase())} en Catálogo.`}</p>` : ''}
      ${catFaltaHtml(it)}
      ${!lectura && esMadera(it) && !llevaMadera ? '<p class="p-madera-nota">Las puertas de madera las asigna Gualfredo.</p>' : ''}
      ${bloques}
    </section>`;
  }
  // ---------------------------------------------------------------------------
  // Asignar trabajadores: quién hace cada paso y para cuándo (este sábado o el próximo)
  // ---------------------------------------------------------------------------
  let itemTodo = null, elegidos = {}, guardandoTodo = false, paraElegido = null, paraTocado = false;
  async function abrirAsignarTodo(iid){
    const v = pedidoActual; if(!v) return;
    const it = (v.items || []).find(x => claveItem(x) === String(iid)); if(!it) return;
    const todos = await cargarTrabajadores();
    itemTodo = it; elegidos = {}; paraTocado = false;
    const sab = sabados();
    const pend = (it.etapas || []).filter(e => e.estado === 'pendiente');
    // Si todo lo asignado ya es para el próximo sábado, arranca ahí; si no, este sábado
    paraElegido = pend.some(e => e.trabajador_id) && pend.filter(e => e.trabajador_id).every(e => e.para_el === sab.proximo) ? sab.proximo : sab.este;
    const grupos = ramas(it);
    let html = `<div class="at-cuando"><p class="field-label">¿Para cuándo?</p>
      <div class="seg" role="radiogroup" id="segPara">
        <button type="button" class="seg-op ${paraElegido === sab.este ? 'on' : ''}" data-para="${sab.este}" role="radio" aria-checked="${paraElegido === sab.este}">Este ${esc(sabadoCorto(sab.este))}</button>
        <button type="button" class="seg-op ${paraElegido === sab.proximo ? 'on' : ''}" data-para="${sab.proximo}" role="radio" aria-checked="${paraElegido === sab.proximo}">Próximo ${esc(sabadoCorto(sab.proximo))}</button>
      </div></div>`;
    Object.keys(grupos).forEach(r => {
      const pendR = grupos[r].filter(e => e.estado === 'pendiente');
      if(!pendR.length) return;
      const tit = Object.keys(grupos).length > 1 || it.tipo === 'Combo' ? tituloRama(it, r, grupos[r]) : '';
      if(tit) html += `<p class="e-rama-tit">${esc(tit)}</p>`;
      // Un rol, una persona: los pasos del mismo oficio (Masilla y Pintura, Aluminio e Instalar) se asignan juntos
      const porRol = [];
      pendR.forEach(e => { let g = porRol.find(x => x.esp === e.especialidad); if(!g){ g = { esp:e.especialidad, l:[] }; porRol.push(g); } g.l.push(e); });
      porRol.forEach(g => {
        const e = g.l[0], ids = g.l.map(x => x.id).join(',');
        const mismo = g.l.every(x => (x.trabajador_id || '') === (e.trabajador_id || ''));
        const tidActual = mismo ? (e.trabajador_id || '') : null;
        // Un paso que ya empezó sale fijo con quien lo está haciendo
        const empezo = g.l.some(x => x.trabajador_id && x.iniciada_en);
        if(!empezo) g.l.forEach(x => { elegidos[x.id] = x.trabajador_id || ''; });
        // Lo que se le paga por este paso (Masilla y pintura juntas suman las dos)
        const ms = g.l.map(x => montos[x.id]);
        const monto = !lectura && ms.every(m => m != null) ? ms.reduce((a, m) => a + Number(m), 0) : null;
        const derecha = [monto ? dinero(monto) : '', empezo ? 'ya empezó' : ''].filter(Boolean).join(' · ');
        const ops = todos.filter(t => (t.especialidades || []).includes(e.especialidad));
        const nombre = g.l.length > 1
          ? ({ masilla_pintura:'Masilla y pintura', ventanero:'Aluminio e instalar' }[e.especialidad] || g.l.map(x => x.nombre).join(' y '))
          : e.nombre;
        const inc = (g.l.find(x => x.incluye && x.incluye.includes('+')) || {}).incluye;
        const sub = [inc, g.l.length > 1 ? g.l.length + ' pasos · la misma persona' : ''].filter(Boolean).join(' · ');
        // Si está asignado a alguien que ya no está activo, se muestra marcado para que se vea y se pueda cambiar
        const fuera = e.trabajador_id && !ops.some(t => t.id === e.trabajador_id)
          ? `<button type="button" class="at-op ${tidActual ? 'on' : ''}" data-eid="${e.id}" data-eids="${ids}" data-tid="${esc(e.trabajador_id)}"><span class="ini">${esc(inicial(e.trabajador ? e.trabajador.nombre : '?'))}</span>${esc(e.trabajador ? e.trabajador.nombre : 'Otro')} (inactivo)</button>` : '';
        const tt = e.trabajador_id && e.para_el ? topeTexto(e.para_el) : null;
        html += `<div class="at-paso" data-eid="${e.id}"><div class="at-cab"><p class="at-nom">${esc(nombre)}${tt ? ` <span class="e-tope ${tt.tarde ? 'tarde' : ''}">${esc(tt.t)}</span>` : ''}</p>${derecha ? `<span class="at-monto">${esc(derecha)}</span>` : ''}</div>
          ${sub ? `<p class="at-sub">${esc(sub)}</p>` : ''}
          ${empezo ? `<div class="at-ops"><span class="at-op on fijo"><span class="ini">${esc(inicial(e.trabajador ? e.trabajador.nombre : '?'))}</span>${esc(e.trabajador ? e.trabajador.nombre : '')}</span></div>`
            : ops.length || fuera ? `<div class="at-ops">${fuera}${ops.map(t => `<button type="button" class="at-op ${tidActual === t.id ? 'on' : ''}" data-eid="${e.id}" data-eids="${ids}" data-tid="${esc(t.id)}"><span class="ini">${esc(inicial(t.nombre))}</span>${esc(t.nombre)}</button>`).join('')}
            <button type="button" class="at-op nadie ${tidActual === '' ? 'on' : ''}" data-eid="${e.id}" data-eids="${ids}" data-tid="">Sin asignar</button></div>`
            : `<p class="at-vacio">Nadie tiene la especialidad ${esc(NOMBRE_ESPECIALIDAD[e.especialidad] || e.especialidad)}. <a class="at-link" href="usuarios.html?especialidad=${esc(e.especialidad)}">Dársela a un trabajador</a></p>`}
        </div>`;
      });
    });
    $('todoTitulo').textContent = 'Asignar: ' + it.nombre + (it._de ? ' (' + it._unidad + ' de ' + it._de + ')' : '');
    $('todoSub').textContent = v.interna ? 'Exhibición' : `N° ${v.id} · ${(v.cliente || {}).nombre || ''}`;
    $('todoBody').innerHTML = html;
    pintarBotonTodo();
    abrirHoja('sheetTodo');
  }
  // Cambia quien cambió de trabajador. Si se tocó "¿Para cuándo?", también los ya asignados con otra fecha.
  function cambiosTodo(){
    return (itemTodo ? (itemTodo.etapas || []) : []).filter(e => {
      if(e.estado !== 'pendiente' || !(e.id in elegidos)) return false;
      const tid = elegidos[e.id] || '';
      if(tid !== (e.trabajador_id || '')) return true;
      return paraTocado && !!tid && e.para_el !== paraElegido;
    }).map(e => {
      const tid = elegidos[e.id] || null;
      return tid ? { eid:e.id, tid, para:paraElegido } : { eid:e.id, tid:null };
    });
  }
  function pintarBotonTodo(){
    const n = cambiosTodo().length;
    $('btnGuardarTodo').disabled = !n;
    $('btnGuardarTodo').textContent = n ? (n === 1 ? 'Guardar 1 cambio' : `Guardar ${n} cambios`) : 'Elige quién hace cada paso';
  }
  $('todoBody').addEventListener('click', (e) => {
    const sp = e.target.closest('[data-para]');
    if(sp){
      paraElegido = sp.dataset.para; paraTocado = true;
      $('segPara').querySelectorAll('.seg-op').forEach(x => { x.classList.toggle('on', x === sp); x.setAttribute('aria-checked', String(x === sp)); });
      pintarBotonTodo();
      return;
    }
    const b = e.target.closest('.at-op'); if(!b) return;
    String(b.dataset.eids || b.dataset.eid).split(',').forEach(id => { elegidos[id] = b.dataset.tid; });
    b.closest('.at-ops').querySelectorAll('.at-op').forEach(x => x.classList.toggle('on', x === b));
    pintarBotonTodo();
  });
  $('btnGuardarTodo').addEventListener('click', async () => {
    const cambios = cambiosTodo();
    if(!cambios.length || guardandoTodo) return;
    const btn = $('btnGuardarTodo');
    guardandoTodo = true; btn.disabled = true;
    try{
      const { error } = await db.rpc('asignar_etapas', { p: cambios });
      if(error) throw error;
      cerrarHoja('sheetTodo', true);
      toast('Listo. A cada uno le llega el aviso cuando le toque.');
      await refrescarFicha();
    } catch(err){
      const red = /fetch|network/i.test(String(err.message));
      toast(red ? 'Sin conexión. Intenta de nuevo' : err.message, 'error');
      if(red){ btn.disabled = false; }
      else {
        // Algo cambió en el taller mientras la hoja estaba abierta: se vuelve a pintar con lo último
        cerrarHoja('sheetTodo', true);
        await refrescarFicha();
      }
    } finally { guardandoTodo = false; }
  });

  async function refrescarFicha(){
    await cargar();
    if(!$('sheetFicha').classList.contains('open')) return;   // se asignó desde la tarjeta
    const v = pedidoActual && pedidos.find(x => x.id === pedidoActual.id);
    if(v) pintarFicha(v); else cerrarHoja('sheetFicha');
  }

  async function cargarTrabajadores(){
    if(trabajadores.length) return trabajadores;
    const { data, error } = await db.from('perfiles').select('id,nombre,especialidades').eq('rol', 'trabajador').eq('activo', true);
    if(error){ toast(error.message, 'error'); return []; }
    trabajadores = data || [];
    return trabajadores;
  }
  $('fichaBody').addEventListener('click', async (e) => {
    const bc = e.target.closest('[data-cat-item]');
    if(bc){ abrirCatItem(Number(bc.dataset.catItem)); return; }
    const bo = e.target.closest('[data-cancelar-orden]');
    if(bo){ cancelarOrden(Number(bo.dataset.cancelarOrden), bo); return; }
    const bat = e.target.closest('[data-asignar-todo]');
    if(bat){ abrirAsignarTodo(bat.dataset.asignarTodo); return; }
    const bm = e.target.closest('[data-madera]');
    if(bm){ abrirMadera(Number(bm.dataset.madera)); return; }
    // Paso hecho: su foto en grande
    const bf = e.target.closest('[data-foto]');
    if(bf && !e.target.closest('a')){ verFoto(bf.dataset.foto); return; }
  });
  $('fichaBody').addEventListener('keydown', (e) => {
    const bf = (e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-foto]');
    if(bf){ e.preventDefault(); verFoto(bf.dataset.foto); }
  });

  // ---------------------------------------------------------------------------
  // Madera: marcar un paso terminado con su foto (obligatoria)
  // ---------------------------------------------------------------------------
  let maderaId = null, maderaBlob = null, maderaUrlObj = null, maderaSubida = null;
  function soltarMadera(){ if(maderaUrlObj) URL.revokeObjectURL(maderaUrlObj); maderaBlob = null; maderaUrlObj = null; maderaSubida = null; }
  function pintarMadera(){
    $('maderaFoto').innerHTML = maderaUrlObj ? `<img src="${maderaUrlObj}" alt="Foto del paso terminado">` : '<span>Falta la foto</span>';
    $('btnMaderaFoto').textContent = maderaBlob ? 'Tomar otra foto' : 'Tomar la foto';
    const b = $('btnMaderaOk'); b.disabled = !maderaBlob; b.textContent = maderaBlob ? 'Marcar terminado' : 'Primero toma la foto';
  }
  function abrirMadera(eid){
    const v = pedidoActual; if(!v) return;
    let et = null, item = null;
    (v.items || []).forEach(it => (it.etapas || []).forEach(e => { if(e.id === eid){ et = e; item = it; } }));
    if(!et) return;
    maderaId = eid; soltarMadera();
    $('maderaInput').value = '';
    $('maderaTitulo').textContent = 'Terminar ' + et.nombre;
    $('maderaSub').textContent = item.nombre + (et.trabajador ? ' · ' + et.trabajador.nombre : '');
    pintarMadera();
    abrirHoja('sheetMadera');
  }
  $('btnMaderaFoto').addEventListener('click', () => $('maderaInput').click());
  $('maderaInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if(!f) return;
    try{
      const blob = typeof window.comprimirFoto === 'function' ? await window.comprimirFoto(f) : f;
      if(maderaUrlObj) URL.revokeObjectURL(maderaUrlObj);
      maderaBlob = blob; maderaUrlObj = URL.createObjectURL(blob);
      pintarMadera();
    } catch(err){ toast('No se pudo procesar la foto. Tómala otra vez.', 'error'); }
  });
  $('btnMaderaOk').addEventListener('click', async () => {
    const btn = $('btnMaderaOk');
    if(!maderaId || btn.disabled || !maderaBlob) return;
    const eid = maderaId, blob = maderaBlob;   // fijos: aunque se abra otro paso mientras sube
    btn.disabled = true; btn.textContent = 'Subiendo la foto…';
    try{
      let subida = maderaSubida && maderaSubida.blob === blob ? maderaSubida : null;
      if(!subida){
        const path = new Date().toISOString().slice(0, 7) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        subida = { blob, url: await window.AH.subirFoto('etapas-fotos', path, blob) };
        if(maderaBlob === blob) maderaSubida = subida;
      }
      const { data, error } = await db.rpc('terminar_etapa_madera', { eid, foto_url: subida.url });
      if(error) throw error;
      cerrarHoja('sheetMadera');
      const listo = data && data.listo;
      abrirAlCargar = listo ? null : pedidoActual && pedidoActual.id;
      if(listo) cerrarHoja('sheetFicha');
      maderaId = null; soltarMadera();
      toast(listo ? 'Puerta terminada. El pedido quedó listo para entregar.' : 'Paso terminado. Sigue el próximo.');
      await cargar();
    } catch(err){
      const m = String((err && err.message) || '');
      toast(/fetch|network|Failed/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m || 'No se pudo marcar', 'error');
      if(maderaId) pintarMadera();
    }
  });

  // ---------------------------------------------------------------------------
  // Categoría de pago de un producto
  // ---------------------------------------------------------------------------
  let itemParaCat = null;
  function abrirCatItem(iid){
    const it = pedidoActual && itemsFabrica(pedidoActual).find(x => x.id === iid);
    if(!it) return;
    itemParaCat = it;
    $('catItemSub').textContent = it.nombre + ': con esto se calcula lo que gana cada trabajador.';
    const cats = categorias.filter(c => window.AH.categoriaSirve(c, it.tipo));
    $('listaCatItem').innerHTML = cats.length
      ? cats.map(c => `<button class="fila-cat ${c.id === it.categoria_pago_id ? 'sel' : ''}" type="button" data-cid="${c.id}">${esc(c.nombre)}</button>`).join('')
      : `<p class="field-error" style="display:block">Aún no hay categorías de pago de ${esc(window.AH.nombreProducto(it.tipo) || it.tipo)}.</p><a class="btn-primary" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:10px;height:46px" href="categorias-pago.html?nueva=1">Crear una categoría</a>`;
    abrirHoja('sheetCatItem');
  }
  $('listaCatItem').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cid]'); if(!b || !itemParaCat) return;
    const cid = Number(b.dataset.cid);
    if(cid === itemParaCat.categoria_pago_id){ cerrarHoja('sheetCatItem'); return; }
    [...$('listaCatItem').children].forEach(x => x.disabled = true);
    b.classList.add('sel');
    try{
      const { error } = await db.rpc('asignar_categoria_item', { iid: itemParaCat.id, cid });
      if(error) throw error;
      cerrarHoja('sheetCatItem');
      toast('Categoría guardada');
      await refrescarFicha();
    } catch(err){
      toast(err.message, 'error');
      [...$('listaCatItem').children].forEach(x => x.disabled = false);
      b.classList.remove('sel');
    }
  });

  async function cancelarOrden(vid, boton){
    if(!confirm('¿Cancelar esta orden para exhibición? Lo que ya se terminó queda pagado a quien lo hizo.')) return;
    boton.disabled = true;
    try{
      const { error } = await db.rpc('cancelar_orden_exhibicion', { vid });
      if(error) throw error;
      cerrarHoja('sheetFicha');
      toast('Orden cancelada');
      await cargar();
    } catch(err){
      toast(err.message, 'error');
      boton.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Fabricar para exhibición (sin cliente): igual que agregar un producto en Nueva
  // venta. Primero el tipo, luego el modelo, luego sus especificaciones. Al terminar
  // queda en Entrega inmediata con esas especificaciones.
  // ---------------------------------------------------------------------------
  const SP = window.SpecsProducto;
  let modelosCat = null;
  let sedes = [];
  let orden = null;   // { tipo, modelo, prod, sede, cat }
  let enviandoOrden = false;

  async function cargarModelos(){
    if(modelosCat) return modelosCat;
    const [rm, rs] = await Promise.all([
      db.from('catalogo').select('id,nombre,tipo,fotos,precio_base,especificaciones_base,categoria_pago_id').in('tipo', TIPOS_PRODUCCION).order('nombre', { ascending:true }),
      db.from('sedes').select('id,nombre').eq('activa', true).order('orden', { ascending:true })
    ]);
    if(rm.error || rs.error) throw (rm.error || rs.error);
    modelosCat = rm.data || [];
    sedes = rs.data || [];
    return modelosCat;
  }
  const tiposConModelos = () => TIPOS_PRODUCCION.filter(t => (modelosCat || []).some(m => m.tipo === t));
  const fieldErr = (id, texto) => `<p class="field-error" id="${id}">${esc(texto)}</p>`;

  function prodDesdeModelo(m){
    const cols = acabados(m.tipo).filter(a => a.sw && (m.fotos || {})[a.key]);
    const color = tieneColores(m.tipo) ? ((cols[0] && cols[0].key) || 'Blanco') : null;
    return {
      origen:'catalogo', catalogo_id:m.id, tipo:m.tipo, nombre:m.nombre, color,
      estado: estadoDesdeEspecificaciones(m.tipo, m.especificaciones_base, 'pedido'),
      extraProteccion:'', precio:'', precioManual:false, cantidad:1
    };
  }

  function pintarOrden(){
    const cuerpo = $('ordenBody');
    const scroll = cuerpo.scrollTop;
    const o = orden;
    let html = `<div class="field" id="campoOTipo">${SP.optsCuerpo({ g:'__otipo', label:'¿Qué vas a fabricar?', cols:2, opts: tiposConModelos().map(t => ({ v:t })) }, o.tipo)}
      ${fieldErr('eOTipo', 'Elige qué vas a fabricar')}</div>`;
    if(o.tipo){
      const m = o.modelo;
      const foto = m ? fotoModelo(m, o.prod && o.prod.color) : null;
      html += `<div class="field" id="campoModelo"><span class="field-label">Modelo</span>
        <button class="f-link-box" type="button" id="btnModelo">
          <span class="mini-foto">${foto ? window.AH.imgMini(foto, "", m && m.tipo) : (m ? iconoTipo(m.tipo, 20) : '')}</span>
          <span style="min-width:0"><span class="mod-nom ${m ? '' : 'ph'}">${m ? esc(m.nombre) : 'Elige un modelo del catálogo'}</span>${m ? `<span class="mod-sub">${esc(m.tipo)}</span>` : ''}</span>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
        </button>${fieldErr('eModelo', 'Elige el modelo')}</div>`;
    }
    if(o.modelo){
      const catsO = categorias.filter(c => window.AH.categoriaSirve(c, o.modelo.tipo));
      if(!o.modelo.categoria_pago_id){
        html += catsO.length
          ? `<div class="field" id="campoOCat">${SP.optsCuerpo({ g:'__ocat', label:'Categoría de pago', cols:1, opts: catsO.map(c => ({ v:String(c.id), t:c.nombre })) }, o.cat == null ? null : String(o.cat))}
              <p class="field-hint aviso">Este modelo no tiene. La que elijas queda guardada en el modelo.</p>${fieldErr('eOCat', 'Elige la categoría de pago')}</div>`
          : `<div class="field"><p class="field-error" style="display:block">Este modelo no tiene categoría de pago y todavía no hay ninguna de ${esc(window.AH.nombreProducto(o.modelo.tipo) || o.modelo.tipo)}.</p><a class="btn-primary" style="display:flex;align-items:center;justify-content:center;text-decoration:none;margin-top:10px;height:46px" href="categorias-pago.html?nueva=1">Crear una categoría</a></div>`;
      }
      html += SP.specsHtml(o.prod, o.modelo, { marcar: !!o.marcar, atajo: true });   // en exhibición se ve todo; el aluminio de la ventana se elige
      html += `<div class="field" id="campoOSede">${SP.optsCuerpo({ g:'__osede', label:'Sede donde quedará', cols:2, opts: sedes.map(x => ({ v:String(x.id), t:x.nombre })) }, o.sede == null ? null : String(o.sede))}
        ${fieldErr('eSede', 'Elige dónde quedará la pieza')}</div>`;
      html += `<div class="field"><span class="field-label">Cantidad</span>
        <div class="stepper"><button type="button" data-cant="-1" aria-label="Una menos">−</button><span id="cantValor">${o.prod.cantidad}</span><button type="button" data-cant="1" aria-label="Una más">+</button></div></div>`;
      const c = SP.calcular(o.prod, o.modelo);
      const valor = o.prod.precioManual ? o.prod.precio : c.total;
      html += `<div class="precio-caja">
        <div class="field" id="campoPrecio"><label class="field-label" for="fPrecio">Precio en exhibición (por unidad)</label>
          <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="fPrecio" type="text" inputmode="decimal" autocomplete="off" value="${esc(valor === '' || valor == null ? '' : valor)}"></div>
          ${fieldErr('ePrecio', 'Ingresa un precio mayor a 0')}
        </div>
        <div class="desglose" id="desglose">Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}</div>
        ${o.prod.precioManual && Number(montoOrNull(o.prod.precio)) !== c.total ? '<button type="button" class="usar-sugerido" id="usarSugerido">Usar el sugerido</button>' : ''}
      </div>`;
    }
    cuerpo.innerHTML = html;
    cuerpo.scrollTop = scroll;
    $('btnCrearOrden').disabled = enviandoOrden || !!(o.modelo && !o.modelo.categoria_pago_id && !categorias.some(c => window.AH.categoriaSirve(c, o.modelo.tipo)));
  }
  function refrescarPrecioOrden(){
    const o = orden; if(!o || !o.modelo) return;
    const c = SP.calcular(o.prod, o.modelo);
    if(!o.prod.precioManual && $('fPrecio')) $('fPrecio').value = c.total;
    if($('desglose')) $('desglose').innerHTML = `Sugerido: <b>${dinero(c.total)}</b> · ${esc(c.texto)}`;
  }

  $('btnNuevaOrden').addEventListener('click', async () => {
    try{ await cargarModelos(); }
    catch(err){ toast('No se pudieron cargar los modelos: ' + ((err && err.message) || ''), 'error'); return; }
    if(!tiposConModelos().length){ toast('No hay modelos en el catálogo para fabricar', 'error'); return; }
    orden = { tipo:null, modelo:null, prod:null, sede: sedes.length === 1 ? sedes[0].id : null, cat:null };
    pintarOrden();
    $('ordenBody').scrollTop = 0;
    abrirHoja('sheetOrden');
  });

  $('ordenBody').addEventListener('click', (e) => {
    const o = orden; if(!o) return;
    const op = e.target.closest('.opt[data-g]');
    if(op && op.dataset.g === '__otipo'){
      if(op.dataset.v !== o.tipo){ o.tipo = op.dataset.v; o.modelo = null; o.prod = null; o.cat = null; }
      pintarOrden(); return;
    }
    if(op && op.dataset.g === '__ocat'){ o.cat = Number(op.dataset.v); pintarOrden(); return; }
    if(op && op.dataset.g === '__osede'){ o.sede = Number(op.dataset.v); pintarOrden(); return; }
    if(e.target.closest('#btnModelo')){
      $('buscaModelo').value = '';
      $('modelosTitulo').textContent = o.tipo;
      pintarModelos();
      abrirHoja('sheetModelos');
      return;
    }
    const at = e.target.closest('[data-atajo-medidas]');
    if(at && o.modelo){ SP.guardarAtajoMedidas(o.modelo, at).then(ok => { if(ok) pintarOrden(); }); return; }
    if(o.prod && SP.tocar(o.prod, e.target)){ pintarOrden(); return; }
    const c = e.target.closest('[data-cant]');
    if(c && o.prod){
      o.prod.cantidad = Math.min(50, Math.max(1, o.prod.cantidad + Number(c.dataset.cant)));
      $('cantValor').textContent = o.prod.cantidad;
      return;
    }
    if(e.target.closest('#usarSugerido')){ o.prod.precioManual = false; pintarOrden(); }
  });
  $('ordenBody').addEventListener('input', (e) => {
    const o = orden; if(!o || !o.prod) return;
    const el = e.target;
    if(el.id === 'fPrecio'){ o.prod.precio = el.value; o.prod.precioManual = true; $('campoPrecio').classList.remove('invalid'); return; }
    if(SP.escribir(o.prod, el)) refrescarPrecioOrden();
  });

  function pintarModelos(){
    const q = $('buscaModelo').value.trim().toLowerCase();
    const lista = (modelosCat || []).filter(m => m.tipo === (orden && orden.tipo) && (!q || m.nombre.toLowerCase().includes(q)));
    $('listaModelos').innerHTML = lista.length ? lista.map(m => {
      const f = fotoModelo(m);
      return `<button class="fila-mod" type="button" data-mid="${m.id}">
        <span class="mini-foto">${f ? window.AH.imgMini(f, "", m.tipo) : iconoTipo(m.tipo, 20)}</span>
        <span style="min-width:0"><span class="mod-nom">${esc(m.nombre)}</span><span class="mod-sub">${m.tipo === 'Ventana' ? 'Por m²' : dinero(m.precio_base)}${m.categoria_pago_id ? '' : ' · sin categoría de pago'}</span></span>
      </button>`;
    }).join('') : '<div class="vacio" style="padding:28px 10px"><p>Ningún modelo coincide.</p></div>';
  }
  $('buscaModelo').addEventListener('input', pintarModelos);
  $('listaModelos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mid]'); if(!b || !orden) return;
    const m = modelosCat.find(x => String(x.id) === b.dataset.mid); if(!m) return;
    orden.modelo = m;
    orden.prod = prodDesdeModelo(m);
    orden.cat = null;
    cerrarHoja('sheetModelos');
    pintarOrden();
  });

  $('btnCrearOrden').addEventListener('click', async () => {
    const o = orden; if(!o || enviandoOrden) return;
    let primero = null;
    const falla = (campo) => { const c = $(campo); if(!c) return; c.classList.add('invalid'); primero = primero || c; };
    if(!o.tipo) falla('campoOTipo');
    else if(!o.modelo) falla('campoModelo');
    else {
      if(!o.modelo.categoria_pago_id && o.cat == null) falla('campoOCat');
      if(o.sede == null) falla('campoOSede');
      SP.montosFaltan(o.prod, o.modelo).forEach(falla);
      if(!(montoOrNull($('fPrecio').value) > 0)) falla('campoPrecio');
      const falta = SP.faltaEnModelo(o.prod, o.modelo);
      if(falta){ toast(falta, 'error'); return; }
      if(SP.faltanEn(o.prod, 'venta').length){
        o.marcar = true; pintarOrden();
        const f = $('ordenBody').querySelector('.field.invalid'); if(f) f.scrollIntoView({ block:'center', behavior:'smooth' });
        toast('Elige lo que está en rojo', 'error'); return;
      }
    }
    if(primero){ primero.scrollIntoView({ block:'center', behavior:'smooth' }); return; }
    const precio = montoOrNull($('fPrecio').value);
    const esp = Object.assign({}, especificacionesDesdeEstado(o.prod.tipo, o.prod.estado, 'pedido'),
      o.prod.color ? { color: o.prod.color } : {},
      SP.montosEsp(o.prod, o.modelo));
    const btn = $('btnCrearOrden');
    enviandoOrden = true;
    btn.disabled = true;
    try{
      const { data, error } = await db.rpc('crear_orden_exhibicion', { p: {
        catalogo_id: o.modelo.id, sede_id: o.sede, cantidad: o.prod.cantidad, precio,
        especificaciones: esp, categoria_pago_id: o.modelo.categoria_pago_id ? null : o.cat
      } });
      if(error) throw error;
      if(!o.modelo.categoria_pago_id) o.modelo.categoria_pago_id = o.cat;
      cerrarHoja('sheetOrden');
      orden = null;
      toast('Listo, ya está en fabricación. Asigna quién la fabrica.');
      abrirAlCargar = data && data.id;
      await cargar();
    } catch(err){
      toast(err.message, 'error');
    } finally {
      enviandoOrden = false;
      btn.disabled = false;
    }
  });

  $('btnActualizar').addEventListener('click', cargar);

  (async function(){
    const p = await S.requerir();
    if(!p) return;
    if(p.rol !== 'admin' && p.rol !== 'vendedor'){ location.replace('index.html'); return; }
    if(p.rol === 'vendedor'){
      lectura = true;
      // La vendedora ve Todos y En proceso, sin montos ni Asignar ni Nómina (sus Listos llegan después)
      FILTROS = FILTROS_ADMIN.filter(f => f.id === 'todos' || f.id === 'proceso');
      if(!FILTROS.some(f => f.id === filtro)) filtro = 'todos';
      document.body.classList.add('solo-lectura');
    }
    // Madera: quién la asigna y quién marca sus pasos (el servidor lo vuelve a revisar)
    try{
      const r = await db.from('perfiles').select('lleva_madera,linea').eq('id', p.id).maybeSingle();
      if(r.error) toast('No se pudo revisar lo de madera. Toca actualizar.', 'error');
      if(r.data){ llevaMadera = !!r.data.lleva_madera; puedeMadera = llevaMadera || (p.rol === 'vendedor' && r.data.linea === 'madera'); }
    } catch(e){}
    cargar();
  })();
})();
