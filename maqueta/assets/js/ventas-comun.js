// Piezas compartidas de Ventas: estados, cálculos, carga de una venta, PDF y compartir.
// Queda en window.AV.
(function(){
  'use strict';
  const db = window.db;
  const { resumenSpecs, tieneColores, dinero, esc } = window.AH;

  const ESTADOS = {
    cotizacion:    { t:'Cotización',    c:'e-gris' },
    confirmada:    { t:'Confirmada',    c:'e-azul' },
    en_produccion: { t:'En fabricación', c:'e-ambar' },
    lista:         { t:'Lista',         c:'e-verde' },
    entregada:     { t:'Entregada',     c:'e-tinta' },
    cancelada:     { t:'Cancelada',     c:'e-rojo' }
  };
  const METODOS = ['Binance', 'Zelle', 'Bolívares', 'Efectivo'];
  const EMPRESA = {
    nombre:'Herrería Los Artesanos 2025, C.A.',
    lineas:['Av. 63 entre calles 85 y 92A, Cumbres de Maracaibo', 'Maracaibo, Zulia · RIF J-507772730', '+58 422 016 7079 · @Herreria.Artesanos']
  };

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  // Lo pagado cuenta los abonos por confirmar y los confirmados (los que "no llegaron" no cuentan)
  const cuenta = (x) => x.estado !== 'rechazado';
  function pagado(abonos){ return r2((abonos || []).filter(cuenta).reduce((a, x) => a + (x.tipo === 'devolucion' ? -1 : 1) * Number(x.monto || 0), 0)); }
  const porConfirmar = (abonos) => (abonos || []).filter(x => x.tipo === 'abono' && x.estado === 'por_confirmar');
  function resta(v){ return r2(Number(v.total || 0) - pagado(v.abonos)); }
  const esCotizacion = (v) => v.estado === 'cotizacion' || (v.estado === 'cancelada' && !v.confirmada_en);

  // Fechas (las de la base vienen como 'aaaa-mm-dd')
  function fechaLocal(iso){ if(!iso) return null; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
  function hoy(){ const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function diasHasta(iso){ const f = fechaLocal(iso); return f ? Math.round((f - hoy()) / 86400000) : null; }
  function diasDesde(ts){ const d = new Date(ts); d.setHours(0, 0, 0, 0); return Math.round((hoy() - d) / 86400000); }
  function fechaCorta(iso){ const f = fechaLocal(iso); return f ? f.toLocaleDateString('es-VE', { day:'numeric', month:'short' }).replace('.', '') : ''; }
  function fechaLarga(iso){ const f = fechaLocal(iso); return f ? f.toLocaleDateString('es-VE', { day:'numeric', month:'long', year:'numeric' }) : ''; }
  function fechaNum(ts){ const d = new Date(ts); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }
  function hace(ts){ const n = diasDesde(ts); return n <= 0 ? 'Hoy' : n === 1 ? 'Ayer' : `Hace ${n} días`; }
  function iso(d){ const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
  function habiles(n){ const d = new Date(); let k = 0; while(k < n){ d.setDate(d.getDate() + 1); const w = d.getDay(); if(w !== 0 && w !== 6) k++; } return iso(d); }

  // Texto corto de un producto guardado
  function detalleItem(it){
    const e = it.especificaciones || {};
    const partes = [];
    if(it.a_medida && !window.AH.TIPOS.includes(it.tipo)) return e.descripcion || 'Trabajo a medida';
    if(it.pieza_id) partes.push('Entrega inmediata');
    if(e.color && tieneColores(it.tipo)) partes.push(e.color);
    resumenSpecs(it.tipo, e).forEach(s => partes.push(s.t));
    if(it.a_medida && e.descripcion) partes.push(e.descripcion);
    return partes.join(' · ');
  }
  function resumenProductos(items){
    const lista = (items || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if(!lista.length) return 'Sin productos';
    const primero = (lista[0].cantidad > 1 ? lista[0].cantidad + ' × ' : '') + lista[0].nombre;
    return lista.length === 1 ? primero : `${primero} y ${lista.length - 1} más`;
  }

  // Una venta completa, lista para la ficha y el PDF
  let perfilesCache = null;
  async function perfiles(){
    if(perfilesCache) return perfilesCache;
    const { data } = await db.from('perfiles').select('id,nombre');
    perfilesCache = {}; (data || []).forEach(p => { perfilesCache[p.id] = p.nombre; });
    return perfilesCache;
  }
  const SELECT_VENTA = '*, cliente:clientes(*), sede:sedes(id,nombre), items:venta_items(*, catalogo:catalogo(fotos)), abonos(*), cambios:venta_cambios(*)';
  async function cargarVenta(id){
    const [{ data, error }, ps] = await Promise.all([db.from('ventas').select(SELECT_VENTA).eq('id', id).single(), perfiles()]);
    if(error) throw error;
    data.items.sort((a, b) => a.orden - b.orden);
    // La foto de cada producto sale del catálogo en su color (se actualiza sola si la suben después)
    data.items.forEach(it => { const f = window.AH.fotoItem(it); it.foto = f.url; it._foto = f; delete it.catalogo; });
    data.abonos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    data.vendedor = ps[data.vendedor_id] || '';
    (data.cambios || []).forEach(c => { c.quien = ps[c.por] || ''; });
    return data;
  }

  // Mensaje de texto para WhatsApp (cuando no se manda el PDF)
  function mensaje(v){
    const nombre = (v.cliente.nombre || '').split(' ')[0];
    const cot = esCotizacion(v);
    const l = [`Hola ${nombre}, te saluda Herrería Artesanos.`, cot ? `Esta es tu cotización N° ${v.id}:` : `Tu pedido N° ${v.id}:`, ''];
    v.items.forEach(it => { const d = detalleItem(it); l.push(`• ${it.cantidad > 1 ? it.cantidad + ' × ' : ''}*${it.nombre}*${d ? ' (' + d + ')' : ''}: ${dinero(it.precio_unitario * it.cantidad)}`); });
    if(Number(v.instalacion)) l.push(`• Instalación: ${dinero(v.instalacion)}`);
    if(Number(v.traslado)) l.push(`• Traslado: ${dinero(v.traslado)}`);
    if(Number(v.descuento)) l.push(`• Descuento: -${dinero(v.descuento)}`);
    l.push('', `*Total: ${dinero(v.total)}*`);
    if(!cot){
      l.push(`Pagado: ${dinero(pagado(v.abonos))}`, `Resta por pagar: ${dinero(resta(v))}`);
      if(v.fecha_entrega) l.push('', `Fecha de entrega: ${fechaLarga(v.fecha_entrega)}`);
    } else {
      l.push('', `Precios válidos hasta el ${fechaLarga(v.vence_en)}.`);
    }
    l.push('', 'Gracias por preferirnos.');
    return l.join('\n');
  }
  const linkWhatsApp = (v) => `https://wa.me/${v.cliente.telefono}?text=${encodeURIComponent(mensaje(v))}`;

  // ---------------------------------------------------------------------------
  // PDF (mismo contenido que la factura de la app vieja, en dólares y sin IVA)
  // ---------------------------------------------------------------------------
  let jspdfCarga = null;
  function cargarJsPDF(){
    if(window.jspdf) return Promise.resolve();
    if(!jspdfCarga) jspdfCarga = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'assets/vendor/jspdf.js';
      s.onload = () => ok(); s.onerror = () => { jspdfCarga = null; mal(new Error('No se pudo cargar el generador de PDF')); };
      document.head.appendChild(s);
    });
    return jspdfCarga;
  }
  // Imagen → JPEG pequeño (para que el PDF pese poco). Si falla, null.
  function imagenData(url, lado, png){
    return new Promise((ok) => {
      if(!url) return ok(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const t = setTimeout(() => ok(null), 6000);
      img.onload = () => {
        clearTimeout(t);
        try{
          const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          const g = c.getContext('2d');
          if(!png){ g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(img, 0, 0, c.width, c.height);
          ok({ data: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.82), w: c.width, h: c.height });
        } catch(e){ ok(null); }
      };
      img.onerror = () => { clearTimeout(t); ok(null); };
      img.src = url;
    });
  }

  async function crearPDF(v){
    await cargarJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'letter' });
    const W = 215.9, M = 14, D = W - M;
    const TEAL = [23, 85, 92], TINTA = [28, 26, 23], GRIS = [110, 106, 100], LINEA = [226, 223, 218], FONDO = [247, 246, 244];
    const cot = esCotizacion(v);
    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);

    const [logo, ...fotos] = await Promise.all([imagenData('assets/img/logo.png', 500, true), ...v.items.map(it => imagenData(it.foto, 180))]);

    function cabecera(){
      let y = 12;
      if(logo){ const w = 44, h = w * logo.h / logo.w; doc.addImage(logo.data, 'PNG', M, y, w, Math.min(h, 26)); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(TINTA);
      doc.text(EMPRESA.nombre, D, y + 4, { align:'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(GRIS);
      EMPRESA.lineas.forEach((t, i) => doc.text(t, D, y + 9 + i * 4.3, { align:'right' }));
      y = 40;
      doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]); doc.setLineWidth(0.6); doc.line(M, y, D, y);
      return y;
    }

    let y = cabecera() + 9;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); color(TEAL);
    doc.text(cot ? 'Cotización' : 'Nota de pedido', M, y);
    doc.setFontSize(12); color(TINTA);
    doc.text(`N° ${String(v.id).padStart(5, '0')}`, D, y, { align:'right' });
    if(v.estado === 'cancelada'){ doc.setFontSize(9); doc.setTextColor(180, 35, 24); doc.text('CANCELADA', D, y + 5, { align:'right' }); }

    // Datos del cliente
    y += 6;
    doc.setFillColor(FONDO[0], FONDO[1], FONDO[2]); doc.roundedRect(M, y, D - M, 25, 3, 3, 'F');
    const par = (x, yy, et, val) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); color(GRIS); doc.text(et, x, yy);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); color(TINTA); doc.text(String(val || '-'), x, yy + 4.2);
    };
    par(M + 5, y + 6, 'Cliente', v.cliente.nombre);
    par(M + 5, y + 16, 'Cédula o RIF', v.cliente.cedula);
    const telc = String(v.cliente.telefono || '');
    par(M + 68, y + 6, 'Teléfono', /^\d+$/.test(telc) ? '+' + telc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4') : telc);
    par(M + 68, y + 16, 'Sede', v.sede ? v.sede.nombre : '');
    par(M + 130, y + 6, 'Fecha de emisión', fechaNum(cot ? v.creado_en : (v.confirmada_en || v.creado_en)));
    par(M + 130, y + 16, cot ? 'Válida hasta' : 'Fecha de entrega', cot ? fechaNum(fechaLocal(v.vence_en)) : (v.fecha_entrega ? fechaNum(fechaLocal(v.fecha_entrega)) : '-'));
    y += 33;

    // Tabla de productos
    const C = { foto:M, prod:M + 20, desc:M + 74, precio:D - 42, cant:D - 27, sub:D };
    function encabezadoTabla(){
      doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]); doc.roundedRect(M, y, D - M, 8, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
      doc.text('Producto', C.prod, y + 5.3); doc.text('Descripción', C.desc, y + 5.3);
      doc.text('Precio', C.precio, y + 5.3, { align:'right' }); doc.text('Cant.', C.cant, y + 5.3, { align:'center' }); doc.text('Subtotal', C.sub - 2, y + 5.3, { align:'right' });
      y += 11;
    }
    encabezadoTabla();
    v.items.forEach((it, i) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2);
      const desc = doc.splitTextToSize(detalleItem(it) || '-', C.precio - 16 - C.desc);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2);
      const nom = doc.splitTextToSize(it.nombre, C.desc - C.prod - 3);
      const h = Math.max(18, desc.length * 3.6 + 5, nom.length * 4 + 9);
      if(y + h > 232){ doc.addPage(); y = cabecera() + 6; encabezadoTabla(); }
      const f = fotos[i];
      if(f){ const s = 16, k = Math.min(s / f.w, s / f.h); doc.addImage(f.data, 'JPEG', C.foto + (s - f.w * k) / 2, y + (s - f.h * k) / 2 - 1, f.w * k, f.h * k); }
      else { doc.setFillColor(FONDO[0], FONDO[1], FONDO[2]); doc.roundedRect(C.foto, y - 1, 16, 16, 2, 2, 'F'); }
      color(TINTA); doc.text(nom, C.prod, y + 3);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); color(GRIS);
      doc.text(it.a_medida ? (window.AH.TIPOS.includes(it.tipo) ? it.tipo + ' a medida' : 'A medida') : (it.tipo || ''), C.prod, y + 3 + nom.length * 4);
      doc.setFontSize(8.2); color(TINTA); doc.text(desc, C.desc, y + 3, { lineHeightFactor:1.25 });
      doc.setFontSize(9); doc.text(dinero(it.precio_unitario), C.precio, y + 3, { align:'right' });
      doc.text(String(it.cantidad), C.cant, y + 3, { align:'center' });
      doc.setFont('helvetica', 'bold'); doc.text(dinero(it.precio_unitario * it.cantidad), C.sub - 2, y + 3, { align:'right' });
      y += h;
      if(i < v.items.length - 1){ doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.2); doc.line(C.prod, y - 3, D, y - 3); }
    });

    // Totales y pagos
    const abonos = (v.abonos || []).filter(cuenta);
    const pendientes = porConfirmar(abonos).length;
    const alto = 30 + (cot ? 0 : 12 + abonos.length * 5);
    if(y + alto > 262){ doc.addPage(); y = cabecera() + 8; }
    y += 2;
    doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.3); doc.line(M, y, D, y);
    y += 7;
    const X = D - 78;
    const fila = (et, val, negrita, col) => {
      doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.setFontSize(negrita ? 10 : 9); color(col || (negrita ? TINTA : GRIS));
      doc.text(et, X, y); color(col || TINTA); doc.text(val, D - 2, y, { align:'right' }); y += 5.5;
    };
    const yNotas = y;
    fila('Productos', dinero(v.subtotal));
    if(Number(v.descuento)) fila('Descuento', '- ' + dinero(v.descuento));
    if(Number(v.instalacion)) fila('Instalación', dinero(v.instalacion));
    if(Number(v.traslado)) fila('Traslado', dinero(v.traslado));
    y += 1;
    doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]); doc.roundedRect(X - 3, y - 5, D - X + 3, 9.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(255, 255, 255);
    doc.text('Monto total', X, y + 1.3); doc.text(dinero(v.total), D - 2, y + 1.3, { align:'right' });
    y += 11;
    if(!cot){
      abonos.forEach(a => fila(`${a.tipo === 'devolucion' ? 'Devolución' : 'Pago'} ${fechaNum(a.fecha)} · ${a.metodo}${a.estado === 'por_confirmar' ? ' (por confirmar)' : ''}`, (a.tipo === 'devolucion' ? '- ' : '') + dinero(a.monto)));
      fila('Resta por pagar', dinero(resta(v)), true, resta(v) > 0 ? TEAL : TINTA);
    }

    // Notas a la izquierda de los totales
    let yn = yNotas;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.2); color(GRIS);
    const notas = ['Precios en dólares (USD).'];
    if(cot) notas.push(`Cotización válida hasta el ${fechaLarga(v.vence_en)}.`);
    if(!cot && abonos.length){ const ult = abonos.filter(a => a.tipo === 'abono').pop(); if(ult) notas.push(`Método de pago: ${ult.metodo}.`); }
    if(!cot && pendientes) notas.push(pendientes === 1 ? 'Hay un pago pendiente por confirmar. Al confirmarlo se actualiza en tu seguimiento.' : 'Hay pagos pendientes por confirmar. Al confirmarlos se actualizan en tu seguimiento.');
    if(v.notas) notas.push('Nota: ' + v.notas);
    notas.forEach(t => { const ls = doc.splitTextToSize(t, X - M - 10); doc.text(ls, M, yn); yn += ls.length * 3.8 + 1.5; });

    // Pie
    const paginas = doc.getNumberOfPages();
    for(let p = 1; p <= paginas; p++){
      doc.setPage(p);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); color(TEAL);
      doc.text('Herrería Artesanos · Creando con distinción', W / 2, 272, { align:'center' });
      if(paginas > 1){ doc.setFont('helvetica', 'normal'); color(GRIS); doc.text(`${p} / ${paginas}`, D, 272, { align:'right' }); }
    }
    return doc.output('blob');
  }

  function nombrePDF(v){
    const n = (v.cliente.nombre || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${esCotizacion(v) ? 'Cotizacion' : 'Pedido'}-${v.id}-${n}.pdf`;
  }

  // Mensaje corto que acompaña al PDF (los detalles van en el PDF).
  // Cotización: sin enlace de seguimiento (la cotización no lo tiene).
  // Nota de pedido: aquí nace el enlace de seguimiento, la primera vez que se manda como venta.
  function mensajeCorto(v){
    const nombre = (v.cliente.nombre || '').split(' ')[0];
    if(esCotizacion(v)){
      return [`Hola ${nombre}, te saluda Herrería Artesanos.`, '',
        `Aquí tienes tu cotización N° ${v.id} por ${dinero(v.total)}.`, '',
        `Cotización válida hasta el ${fechaLarga(v.vence_en)}.`, '',
        'Cualquier duda, aquí estamos.'].join('\n');
    }
    const l = [`Hola ${nombre}, te saluda Herrería Artesanos.`, '', `Te envío tu nota de pedido N° ${v.id}.`, '',
      `Total: ${dinero(v.total)}`, `Pagado: ${dinero(pagado(v.abonos))}`, `Resta por pagar: ${dinero(resta(v))}`];
    if(v.fecha_entrega && !['cancelada', 'entregada'].includes(v.estado)) l.push(`Fecha de entrega: ${fechaLarga(v.fecha_entrega)}`);
    l.push('', 'Puedes seguir tu pedido aquí:', '', urlSeguimiento(v), '', 'Gracias por preferirnos.');
    return l.join('\n');
  }
  // Teléfono para buscar en WhatsApp: los 10 números (414…), que coinciden como sea que esté guardado
  const telBuscar = (v) => String(v.cliente.telefono || '').replace(/^58/, '');
  const telBonito = (v) => telBuscar(v).replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

  // Compartir el PDF con el mensaje (en el iPhone se elige WhatsApp y el chat del cliente).
  // En el mismo toque se copia el teléfono del cliente para pegarlo en el buscador.
  // Todo se llama sin esperar nada antes: el iPhone solo lo permite dentro del toque.
  async function compartirPDF(blob, v){
    let copiado = false;
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(telBuscar(v)).then(() => { copiado = true; }).catch(() => {});
      }
    } catch(e){}
    const file = new File([blob], nombrePDF(v), { type:'application/pdf' });
    // Android: WhatsApp bota el texto que va junto al archivo; el mensaje se manda después (paso 2)
    const android = esAndroid();
    const datos = android ? { files:[file] } : { files:[file], text: mensajeCorto(v) };
    const puede = (d) => { try{ return navigator.canShare && navigator.canShare(d); } catch(e){ return false; } };
    if(navigator.share && (puede(datos) || puede({ files:[file] }))){
      try{
        await navigator.share(puede(datos) ? datos : { files:[file] });
        if(android) return 'paso2';
        return copiado ? 'compartido-copiado' : 'compartido';
      } catch(e){ if(e && e.name === 'AbortError') return 'cancelado'; }
    }
    descargarPDF(blob, v);
    return 'descargado';
  }
  const esAndroid = () => /Android/i.test(navigator.userAgent);
  // Paso 2 en Android: abre el chat del cliente con el mensaje (y el enlace de seguimiento) ya escrito
  const linkMensajePDF = (v) => `https://wa.me/${String(v.cliente.telefono || '')}?text=${encodeURIComponent(mensajeCorto(v))}`;
  function abrirMensajePDF(v){ const u = linkMensajePDF(v); const w = window.open(u, '_blank'); if(!w) location.href = u; }
  function descargarPDF(blob, v){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombrePDF(v);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  // Enlace público del seguimiento del cliente
  function urlSeguimiento(v){ return new URL('seguimiento.html?t=' + v.token_seguimiento, location.href).href; }
  // Mensaje de WhatsApp según cómo va el pedido, con su enlace de seguimiento
  function mensajeSeguimiento(v){
    const n = (v.cliente.nombre || '').split(' ')[0];
    const url = urlSeguimiento(v);
    const entrega = v.fecha_entrega ? fechaLarga(v.fecha_entrega) : '';
    const cot = esCotizacion(v);
    let t;
    if(v.estado === 'cotizacion') t = `Hola ${n}, te saluda Herrería Artesanos. Aquí tienes tu cotización N° ${v.id} por ${dinero(v.total)}, válida hasta el ${fechaLarga(v.vence_en)}. Puedes verla y descargarla aquí:\n${url}\n\nCualquier duda, aquí estamos.`;
    else if(v.estado === 'confirmada') t = `Hola ${n}, recibimos tu pago. Tu pedido N° ${v.id} está confirmado${entrega ? ' y la entrega estimada es el ' + entrega : ''}.${porConfirmar(v.abonos).length ? ' Tu pago está en revisión: cuando lo confirmemos lo verás actualizado en tu seguimiento.' : ''} Aquí puedes seguir tu pedido y descargar tu nota:\n${url}`;
    else if(v.estado === 'en_produccion') t = `Hola ${n}, tu pedido N° ${v.id} ya está en fabricación.${entrega ? ' Entrega estimada: ' + entrega + '.' : ''} Síguelo aquí:\n${url}`;
    else if(v.estado === 'lista') t = `Hola ${n}, ¡tu pedido N° ${v.id} está listo!${resta(v) > 0 ? ' Resta por pagar ' + dinero(resta(v)) + '.' : ''} Escríbenos para coordinar la entrega. Detalles aquí:\n${url}`;
    else if(v.estado === 'entregada') t = `Hola ${n}, gracias por confiar en Herrería Artesanos. Aquí puedes descargar tu nota de pedido final (disponible por 3 días):\n${url}`;
    else t = cot ? `Hola ${n}, te escribimos por tu cotización N° ${v.id}. Aquí tienes el detalle:\n${url}` : `Hola ${n}, tu pedido N° ${v.id} fue cancelado. Aquí tienes el detalle:\n${url}`;
    return t;
  }
  const linkSeguimientoWA = (v) => `https://wa.me/${v.cliente.telefono}?text=${encodeURIComponent(mensajeSeguimiento(v))}`;

  // Formulario de pago compartido: completo o parcial, y comprobante obligatorio
  const COMPROBANTE = { lado:1280, calidad:0.7 };   // ~150 KB, se lee bien
  function modoPagoHtml(modo, etiquetaCompleto){
    const op = [['completo', etiquetaCompleto || 'Pago completo'], ['parcial', 'Pago parcial']];
    return `<div class="field"><span class="field-label">¿Cuánto pagó?</span><div class="opts" style="--cols:2">${op.map(([k, t]) =>
      `<button type="button" class="opt ${k === modo ? 'selected' : ''}" data-modo-pago="${k}" aria-pressed="${k === modo}">${t}</button>`).join('')}</div></div>`;
  }
  function comprobanteHtml(foto){
    return `<div class="field" id="campoComp"><span class="field-label">Comprobante</span>
      <div class="photos single"><label class="photo-box ${foto ? 'filled' : ''}" style="aspect-ratio:3/1">
        ${foto ? `<img src="${esc(foto)}" alt=""><span class="photo-tag">Cambiar comprobante</span>` : `<span class="plus"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>Foto o captura del pago</span>`}
        <input type="file" accept="image/*" id="aComprobante" aria-label="Comprobante del pago"></label></div>
      <div class="field-hint">Obligatorio, también en efectivo (foto del dinero o del recibo).</div>
      <div class="field-error">Sube la foto o captura del pago</div></div>`;
  }
  const soloInmediata = (items) => !!(items && items.length && items.every(it => it.pieza_id || it.origen === 'pieza'));

  window.AV = { porConfirmar, COMPROBANTE, modoPagoHtml, comprobanteHtml, soloInmediata, ESTADOS, METODOS, pagado, resta, esCotizacion, diasHasta, diasDesde, fechaCorta, fechaLarga, fechaNum, hace, habiles, iso,
    detalleItem, resumenProductos, cargarVenta, perfiles, mensaje, mensajeCorto, telBonito, linkWhatsApp, urlSeguimiento, mensajeSeguimiento, linkSeguimientoWA, crearPDF, compartirPDF, descargarPDF, esAndroid, linkMensajePDF, abrirMensajePDF, nombrePDF, SELECT_VENTA, esc };
})();
