// PDF de reportes (estado de cuenta, hoja de corte, plan de compra, cierre del mes y reportes)
// con el mismo diseño del PDF de la venta (ventas-comun.js): logo, línea teal, títulos teal, bandas grises y pie.
(function(){
  'use strict';
  const EMPRESA = { nombre:'Herrería Los Artesanos 2025, C.A.', lineas:['Av. 63 entre calles 85 y 92A, Cumbres de Maracaibo', 'Maracaibo, Zulia · RIF J-507772730', '+58 422 016 7079 · @Herreria.Artesanos'] };
  const TEAL = [23, 85, 92], TINTA = [28, 26, 23], GRIS = [110, 106, 100], LINEA = [226, 223, 218], FONDO = [247, 246, 244], ROJO = [180, 35, 24];
  let carga = null;
  function cargar(){
    if(window.jspdf) return Promise.resolve();
    if(!carga) carga = new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'assets/vendor/jspdf.js'; s.onload = () => ok(); s.onerror = () => { carga = null; mal(new Error('No se pudo cargar el generador de PDF')); }; document.head.appendChild(s); });
    return carga;
  }
  function logo(){
    return new Promise(ok => { const img = new Image(); img.onload = () => { try{ const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); ok({ data:c.toDataURL('image/png'), w:c.width, h:c.height }); } catch(e){ ok(null); } }; img.onerror = () => ok(null); img.src = 'assets/img/logo.png'; });
  }
  const sinAcentos = (t) => String(t == null ? '' : t);

  // bloques: [{ t:'titulo', texto }, { t:'sub', texto }, { t:'fila', a, b, fuerte, rojo }, { t:'total', a, b }, { t:'nota', texto }, { t:'barra', etiqueta, piezas:[{cm, txt}], largo, sobra }, { t:'espacio' }]
  async function crear(o){
    await cargar();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'letter' });
    const W = 215.9, M = 14, D = W - M, BAJO = 262;
    const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const lg = await logo();
    function cabecera(){
      let y = 12;
      if(lg){ const w = 44, h = w * lg.h / lg.w; doc.addImage(lg.data, 'PNG', M, y, w, Math.min(h, 26)); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(TINTA); doc.text(EMPRESA.nombre, D, y + 4, { align:'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(GRIS); EMPRESA.lineas.forEach((t, i) => doc.text(t, D, y + 9 + i * 4.3, { align:'right' }));
      y = 40; doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]); doc.setLineWidth(0.6); doc.line(M, y, D, y);
      return y + 9;
    }
    let y = cabecera();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); color(TEAL); doc.text(sinAcentos(o.titulo), M, y);
    if(o.derecha){ doc.setFontSize(11); color(TINTA); doc.text(sinAcentos(o.derecha), D, y, { align:'right' }); }
    y += 5;
    if(o.subtitulo){ doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(GRIS); doc.splitTextToSize(sinAcentos(o.subtitulo), D - M).forEach(l => { y += 4.2; doc.text(l, M, y); }); }
    y += 6;
    const espacio = (h) => { if(y + h > BAJO){ doc.addPage(); y = cabecera(); } };
    for(const b of o.bloques){
      if(b.t === 'titulo'){ espacio(14); y += 2; doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]); doc.roundedRect(M, y - 5, D - M, 8, 1.5, 1.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text(sinAcentos(b.texto), M + 3, y + 0.4); if(b.der) doc.text(sinAcentos(b.der), D - 3, y + 0.4, { align:'right' }); y += 8; }
      else if(b.t === 'sub'){ espacio(9); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(TINTA); doc.text(sinAcentos(b.texto), M, y); if(b.der){ doc.setFont('helvetica', 'normal'); color(GRIS); doc.text(sinAcentos(b.der), D, y, { align:'right' }); } y += 5.5; }
      else if(b.t === 'fila' || b.t === 'total'){
        espacio(7);
        if(b.t === 'total'){ doc.setFillColor(FONDO[0], FONDO[1], FONDO[2]); doc.rect(M, y - 4.2, D - M, 6.4, 'F'); }
        doc.setFont('helvetica', b.fuerte || b.t === 'total' ? 'bold' : 'normal'); doc.setFontSize(9.5); color(TINTA);
        const ls = doc.splitTextToSize(sinAcentos(b.a), D - M - 45); doc.text(ls, M + 2, y);
        b.rojo ? color(ROJO) : color(TINTA); doc.text(sinAcentos(b.b), D - 2, y, { align:'right' });
        y += Math.max(1, ls.length) * 4.3 + 1.6;
        doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.2); doc.line(M, y - 3.6, D, y - 3.6);
      }
      else if(b.t === 'nota'){ doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(GRIS); const ls = doc.splitTextToSize(sinAcentos(b.texto), D - M); espacio(ls.length * 3.9 + 2); doc.text(ls, M, y); y += ls.length * 3.9 + 2; }
      else if(b.t === 'barra'){
        espacio(15);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(TINTA); doc.text(sinAcentos(b.etiqueta), M, y);
        doc.setFont('helvetica', 'normal'); color(GRIS); doc.text(sinAcentos(b.der || ''), D, y, { align:'right' });
        y += 2;
        const ancho = D - M; let x = M; const k = ancho / b.largo;
        b.piezas.forEach((p, i) => { const w = p.cm * k; doc.setFillColor(i % 2 ? 46 : 23, i % 2 ? 110 : 85, i % 2 ? 118 : 92); doc.rect(x, y, Math.max(0.5, w - 0.4), 6.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); if(w > 9) doc.text(String(p.cm), x + w / 2, y + 4.3, { align:'center' }); x += w; });
        if(b.sobra > 0){ doc.setFillColor(241, 228, 214); doc.rect(x, y, Math.max(0.5, D - x), 6.5, 'F'); }
        y += 9.5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); color(GRIS);
        const ls = doc.splitTextToSize(sinAcentos(b.piezas.map(p => p.cm + ' cm ' + p.txt).join(' · ')), D - M); doc.text(ls, M, y); y += ls.length * 3.7 + 3;
      }
      else if(b.t === 'espacio'){ y += 3; }
      else if(b.t === 'firmas'){ espacio(22); y += 12; doc.setDrawColor(GRIS[0], GRIS[1], GRIS[2]); doc.setLineWidth(0.3); doc.line(M, y, M + 70, y); doc.line(D - 70, y, D, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(GRIS); doc.text(sinAcentos(b.a), M, y + 4.5); doc.text(sinAcentos(b.b), D - 70, y + 4.5); y += 10; }
    }
    const pags = doc.getNumberOfPages();
    for(let p = 1; p <= pags; p++){ doc.setPage(p); doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); color(TEAL); doc.text('Herrería Artesanos · Creando con distinción', W / 2, 272, { align:'center' }); if(pags > 1){ doc.setFont('helvetica', 'normal'); color(GRIS); doc.text(p + ' / ' + pags, D, 272, { align:'right' }); } }
    return doc.output('blob');
  }
  // Compartir (WhatsApp) o descargar
  async function compartir(blob, nombre){
    const file = new File([blob], nombre, { type:'application/pdf' });
    try{ if(navigator.canShare && navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:nombre }); return 'compartido'; } } catch(e){ if(e && e.name === 'AbortError') return 'cancelado'; }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'descargado';
  }
  window.PDFR = { crear, compartir };
})();
