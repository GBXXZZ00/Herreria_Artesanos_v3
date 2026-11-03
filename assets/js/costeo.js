// Costeo en el teléfono (window.COSTEO): carga los datos de Costos desde la base (costos_datos) y calcula con la
// MISMA fórmula de la función _costeo de la base (v78), para que la ficha cambie al instante mientras se edita.
// El número que vale para Finanzas, el cierre del mes y los avisos es el de la base.
// Fórmula del Costeador de Ray: IVA × 1,16 · perfiles por metro usado · barra completa solo para comparar ·
// lámina y vidrio por m² de hoja · rendimiento del modelo o el general · accesorios × cantidad · mano de obra de la
// categoría de pago · costo × (1 + ganancia) + gastos fijos ÷ puertas al mes · extras × (1 + ganancia).
(function(){
  'use strict';
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  let D = null;

  // ---------- Datos ----------
  async function cargar(){
    const { data, error } = await db.rpc('costos_datos');
    if(error) throw error;
    const d = data;
    D = {
      prov: d.prov, reglas: Object.assign({ bisagras:3 }, d.reglas), gastosFijos: d.gastosFijos || [],
      proveedores: d.proveedores || [], insumos: d.insumos || [], fab: d.fab || [], categorias: d.categorias || [],
      catalogo: d.catalogo || [], enFabricacion: d.enFabricacion || [], vendidos: d.vendidos || [],
      costeo: {}, enDiseno: [], servidor: {},
    };
    (d.modelos || []).forEach(m => {
      const key = m.catalogo_id != null ? m.catalogo_id : 'd' + m.id;
      D.costeo[key] = { mid:m.id, codigo:m.codigo, estado:m.estado, categoria_pago_id:m.categoria_pago_id, notas:m.nota || '',
        piezas:(m.piezas || []).map(p => [p[0], Number(p[1]), Number(p[2]), p[3] || '']),
        hojas:(m.hojas || []).map(h => [h[0], Number(h[1]), Number(h[2]), Number(h[3]), h[4] || '']),
        rend:m.rend || {}, acc:m.acc || {}, extras:(m.extras || []).map(e => ({ n:e.n, v:Number(e.v) })) };
      D.servidor[key] = m.x;
      if(m.catalogo_id == null) D.enDiseno.push({ id:key, nombre:m.nombre, tipo:m.tipo || 'Puerta Multilock', precio_base:0, categoria_pago_id:m.categoria_pago_id, en_diseno:true });
    });
    return D;
  }

  // ---------- Cálculo ----------
  // Acomoda piezas en barras: más largas primero, primera barra donde quepa, con el grosor del corte
  function empacar(piezas, largo, corte){
    const L = piezas.slice().sort((a, b) => b.cm - a.cm), barras = [];
    for(const p of L){ if(p.cm > largo){ barras.push({ piezas:[p], libre:0, larga:true }); continue; }
      let b = barras.find(x => !x.larga && x.libre + 1e-9 >= p.cm); if(!b){ b = { piezas:[], libre:largo }; barras.push(b); }
      b.piezas.push(p); b.libre = Math.max(0, b.libre - p.cm - (corte || 0)); }
    return barras;
  }
  const provN = (id) => (D.proveedores.find(p => String(p.id) === String(id)) || {}).nombre || 'Ese proveedor';
  const principal = (id) => !!(D.proveedores.find(p => String(p.id) === String(id)) || {}).principal;
  // Precio sin IVA: el del proveedor elegido; si no lo vende, el del principal u otro. El fijo manda con el principal.
  function precioFab(f, prov){
    const usar = (k) => ({ p:(principal(k) && f.fijo) ? Number(f.fijo) : Number(f.precios[k].p), de:String(k), esp:f.precios[k].esp, fijo:principal(k) && !!f.fijo });
    // "El más barato": de todos los proveedores, el menor precio (con el fijo si sale del principal)
    if(prov === 'barato'){ const ks = Object.keys(f.precios || {}); if(!ks.length) return { p:null, de:null }; return ks.map(usar).sort((a, b) => a.p - b.p)[0]; }
    if(f.precios && f.precios[prov]) return usar(prov);
    const orden = D.proveedores.map(p => String(p.id)).concat(Object.keys(f.precios || {}));
    for(const k of orden) if(f.precios && f.precios[k]) return usar(k);
    return { p:null, de:null };
  }
  const modeloDe = (id) => D.catalogo.find(x => String(x.id) === String(id)) || D.enDiseno.find(x => String(x.id) === String(id));
  function costear(id, o){
    if(!D) return null;
    o = o || {}; const prov = String(o.prov || D.prov), modo = o.modo || 'metro';
    const c = D.costeo[id], m = modeloDe(id) || {};
    if(!c) return null;
    const R = D.reglas, iva = 1 + R.iva / 100, lineas = [], avisos = new Set(), falta = [];
    const add = (g, n, det, v) => lineas.push({ g, n, det, v });
    const porMat = {};
    for(const [mid, cant, cm, nota] of c.piezas) for(let i = 0; i < cant; i++) (porMat[mid] ||= []).push({ cm, nota });
    const grupos = [];
    const ordenFab = (a, b) => D.fab.findIndex(f => String(f.id) === a) - D.fab.findIndex(f => String(f.id) === b);
    for(const mid of Object.keys(porMat).sort(ordenFab)){
      const piezas = porMat[mid], f = D.fab.find(x => String(x.id) === mid); if(!f) continue;
      const pr = precioFab(f, prov);
      if(pr.p == null){ falta.push('precio de ' + f.nombre); continue; }
      if(prov !== 'barato' && pr.de !== prov) avisos.add(provN(prov) + ' no vende ' + f.nombre + ': se usó el precio de ' + provN(pr.de));
      const barra = pr.p * iva, porM = barra / (f.largo / 100);
      const cm = piezas.reduce((a, x) => a + x.cm, 0), barras = empacar(piezas, f.largo, R.corte);
      const v = modo === 'tubo' ? barras.length * barra : cm / 100 * porM;
      add('Hierro', f.nombre, modo === 'tubo' ? barras.length + (barras.length === 1 ? ' barra' : ' barras') : (cm / 100).toLocaleString('es-VE', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' m', v);
      grupos.push({ id:f.id, nombre:f.nombre, cm, barras, largo:f.largo, piezas, v, porM, fijo:pr.fijo });
    }
    for(const [mid, cant, a, h, nota] of c.hojas){
      const f = D.fab.find(x => String(x.id) === String(mid)); if(!f) continue;
      const pr = precioFab(f, prov);
      if(pr.p == null){ falta.push('precio de ' + f.nombre); continue; }
      if(prov !== 'barato' && pr.de !== prov && !/^Sin factura/i.test(provN(pr.de))) avisos.add(provN(prov) + ' no vende ' + f.nombre + ': se usó el precio de ' + provN(pr.de));
      const m2 = cant * a * h / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000;
      add(f.tipo === 'vidrio' ? 'Vidrio' : 'Lámina', f.nombre, m2.toLocaleString('es-VE', { maximumFractionDigits:3 }) + ' m² (' + Math.round(m2 / hm2 * 100) + ' % de la hoja)' + (nota ? ' · ' + nota : ''), m2 * pr.p * iva / hm2);
    }
    for(const it of D.insumos){
      if(it.grupo === 'Accesorios') continue;
      const r = Number((c.rend || {})[it.id]) || Number(it.r) || 0;
      if(!r){ if(it.grupo === 'Pintura y masilla') falta.push(it.nombre); continue; }
      add(it.grupo, it.nombre, r >= 1 ? '1 rinde ' + String(r).replace('.', ',') + (r === 1 ? ' puerta' : ' puertas') : Math.round(1 / r) + ' por puerta', it.p * iva / r);
    }
    for(const it of D.insumos.filter(i => i.grupo === 'Accesorios')){
      const q = Number((c.acc || {})[it.id]); if(!(q > 0)) continue;
      add('Accesorios', it.nombre, q + ' × $' + r2(it.p * iva).toFixed(2), q * it.p * iva);
    }
    const catId = c.categoria_pago_id || m.categoria_pago_id;
    const cat = D.categorias.find(x => String(x.id) === String(catId));
    if(cat){
      const ea = m.especificaciones_base || {}, area = (Number(ea.alto) || 2) * (Number(ea.ancho) || 1);
      [['Hierro','hierro'],['Masilla y pintura','masilla_pintura'],['Detalles','detalles']].forEach(([n, k]) => { const t = (cat.tarifas || {})[k]; if(t && Number(t.monto)) add('Mano de obra', n, cat.nombre, Number(t.monto) * (t.modo === 'm2' ? area : 1)); });
    } else falta.push('categoría de pago');
    if(!c.piezas.length && !c.hojas.length) falta.push('cortes');
    const costo = lineas.reduce((a, l) => a + l.v, 0), venta = costo * (1 + R.ganancia / 100), fijos = R.gastosMes / R.puertasMes, final = venta + fijos;
    const hoy = m.en_diseno ? null : Number(m.precio_base || 0), ganancia = hoy == null ? null : hoy - fijos - costo, pct = costo && hoy != null ? ganancia / costo * 100 : 0;
    const extras = (c.extras || []).map(e => ({ n:e.n, costo:e.v, venta:e.v * (1 + R.ganancia / 100) }));
    return { lineas, grupos, avisos:[...avisos], falta, costo:r2(costo), venta:r2(venta), fijos:r2(fijos), final:r2(final), hoy, ganancia:ganancia == null ? null : r2(ganancia), pct, cat, c, m, extras, prov, modo };
  }
  const semaforo = (x) => !x ? ['gris','Sin costear'] : x.falta.length ? ['gris','Faltan datos'] : x.hoy == null ? ['gris','En diseño'] : x.pct >= 30 ? ['verde','Gana ' + Math.round(x.pct) + ' %'] : x.pct >= 15 ? ['amar','Gana ' + Math.round(x.pct) + ' %'] : x.pct >= 0 ? ['rojo','Gana ' + Math.round(x.pct) + ' %'] : ['negro','Pierde'];

  // ---------- Guardar en la base ----------
  const rpc = async (n, a) => { const { data, error } = await db.rpc(n, a); if(error) throw error; return data; };
  async function guardarCosteo(key){
    const c = D.costeo[key], m = modeloDe(key) || {};
    const p = { id:c.mid || null, catalogo_id:typeof key === 'number' || /^\d+$/.test(String(key)) ? Number(key) : null, estado:c.estado || 'borrador',
      categoria_pago_id:c.categoria_pago_id || null, nota:c.notas || null, piezas:c.piezas, hojas:c.hojas, rend:c.rend || {}, acc:c.acc || {}, extras:c.extras || [] };
    if(p.catalogo_id == null){ p.nombre = m.nombre; p.tipo = m.tipo; }
    const r = await rpc('costeo_guardar', { p });
    c.mid = r.id;
    return r;
  }

  window.COSTEO = { cargar, datos:() => D, costear, semaforo, empacar, precioFab, guardarCosteo, rpc, r2 };
})();
