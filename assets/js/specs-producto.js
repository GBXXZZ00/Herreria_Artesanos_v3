// Especificaciones de un producto (medidas, color, vidrio, extras…) y su precio sugerido.
// Lo usan Nueva venta y "Fabricar para exhibición" en Producción: así se piden
// exactamente los mismos datos en los dos lugares.
// prod = { origen, tipo, estado, color, extraProteccion, ... }; modelo = fila del catálogo (o null).
(function(){
  'use strict';
  const { acabados, tieneColores, esquema, grupoActivo, esc, numOrNull, montoOrNull, dinero, medidas, esFab, faltanDetalles } = window.AH;

  const TARIFA_VENTANA = { 'Panorámica':[90, 190], 'Ecobel':[120, 220] }; // $/m² sin y con protección
  const PRECIO_MANILLON = 20;
  const ECOBEL_COMBO = 80;   // el combo trae Panorámica; con Ecobel suma esto
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const base = (modelo) => (modelo && modelo.especificaciones_base) || {};

  function pideMontoProteccion(prod, modelo){
    if(prod.origen === 'medida') return false;   // a medida: el precio escrito ya lo incluye todo
    const s = prod.estado || {}, b = base(modelo);
    if(prod.tipo === 'Puerta Multilock') return !!s.proteccion && !b.proteccion;
    if(prod.tipo === 'Combo') return s.variante === 'Con protección en puerta' && b.variante !== 'Con protección en puerta';
    return false;
  }

  // Lo que no se cambia al vender, porque lo define el modelo del catálogo:
  //  - Combo: las medidas de la puerta y de las 2 ventanas (si son otras, ya no es combo)
  //  - Ventana: si lleva protección (una ventana con protección no se vende sin ella, ni al revés)
  //  (lo que ya estaba guardado en una venta conserva sus datos: prod.guardado)
  const fijasDelModelo = (prod) => prod.origen !== 'medida' && prod.origen !== 'pieza';
  function aplicarFijas(prod, modelo){
    if(!fijasDelModelo(prod) || !modelo || prod.guardado) return;
    const s = prod.estado || (prod.estado = {}), b = base(modelo);
    if(prod.tipo === 'Combo'){
      ['alto', 'ancho', 'ventanas_alto', 'ventanas_ancho'].forEach(k => { s[k] = b[k] != null ? b[k] : null; });
    }
    if(prod.tipo === 'Ventana'){
      s.proteccion = !!b.proteccion;
      if(!s.proteccion) s.marco_decorativo = false;
    }
  }
  // Atajo: poner ahí mismo las medidas de las ventanas del combo (se guardan en el Catálogo)
  function atajoMedidasHtml(){
    return `<div class="aviso-falta atajo" role="alert">A este combo le faltan las medidas de las 2 ventanas.
      <div class="atajo-caja"><span class="atajo-t">Ponlas aquí. Se guardan en el Catálogo para todas sus ventas.</span>
        <label class="field-label" for="atajoAlto" style="margin-top:10px">Medidas de cada ventana (en metros)</label>
        <div class="input-row">
          <div class="input-affix has-r"><input class="input" id="atajoAlto" data-atajo type="text" inputmode="decimal" autocomplete="off" aria-label="Alto de cada ventana en metros"><span class="affix affix-r">alto</span></div>
          <div class="input-affix has-r"><input class="input" id="atajoAncho" data-atajo type="text" inputmode="decimal" autocomplete="off" aria-label="Ancho de cada ventana en metros"><span class="affix affix-r">ancho</span></div>
        </div>
        <p class="field-error" id="atajoError">Escribe el alto y el ancho de cada ventana, en metros</p>
        <button class="btn-primary atajo-btn" type="button" data-atajo-medidas>Guardar medidas y seguir</button></div></div>`;
  }
  // Guarda las medidas del atajo. Devuelve true si quedaron guardadas (el modelo se actualiza aquí mismo).
  async function guardarAtajoMedidas(modelo, boton){
    const alto = numOrNull(document.getElementById('atajoAlto').value), ancho = numOrNull(document.getElementById('atajoAncho').value);
    const err = document.getElementById('atajoError');
    if(!(alto >= 0.2 && alto <= 5 && ancho >= 0.2 && ancho <= 5)){ err.style.display = 'block'; return false; }
    err.style.display = '';
    boton.disabled = true;
    try{
      const { data, error } = await window.db.rpc('catalogo_medidas_ventanas', { mid: modelo.id, alto, ancho });
      if(error) throw error;
      modelo.especificaciones_base = Object.assign({}, modelo.especificaciones_base || {}, { ventanas_alto: data.ventanas_alto, ventanas_ancho: data.ventanas_ancho });
      window.AH.toast('Medidas guardadas en el Catálogo');
      return true;
    } catch(e){
      const m = String((e && e.message) || '');
      window.AH.toast(/fetch|network|Failed/i.test(m) ? 'Sin conexión. Intenta de nuevo' : m || 'No se pudieron guardar', 'error');
      boton.disabled = false;
      return false;
    }
  }
  // Si falta algo en el catálogo para poder venderlo, dice qué
  function faltaEnModelo(prod, modelo){
    if(!fijasDelModelo(prod) || prod.tipo !== 'Combo' || prod.guardado) return '';
    const b = base(modelo);
    return (numOrNull(b.ventanas_alto) > 0 && numOrNull(b.ventanas_ancho) > 0) ? ''
      : 'A este combo le faltan las medidas de las 2 ventanas en el Catálogo. Complétalas y vuelve a venderlo.';
  }

  // ¿Cuánto cuesta según lo elegido? Devuelve el precio y cómo se calculó.
  function calcular(prod, modelo){
    aplicarFijas(prod, modelo);
    const s = prod.estado || {};
    const partes = [];
    let total = 0;
    if(prod.tipo === 'Ventana'){
      const alto = numOrNull(s.alto) || 0, ancho = numOrNull(s.ancho) || 0;
      const area = r2(alto * ancho);
      // Sin aluminio elegido no hay precio: se elige siempre (Panorámica o Ecobel)
      if(!TARIFA_VENTANA[s.aluminio]) return { total:0, texto:'elige el aluminio para ver el precio', sinAluminio:true };
      const tarifa = TARIFA_VENTANA[s.aluminio][s.proteccion ? 1 : 0];
      total = r2(area * tarifa);
      partes.push(`${area} m² × $${tarifa} (${s.aluminio}${s.proteccion ? ' con protección' : ''})`);
    } else {
      total = Number(modelo && modelo.precio_base) || 0;
      partes.push(`Modelo ${dinero(total)}`);
    }
    const b = base(modelo);
    if(s.manillon && s.manillon !== 'Sin' && !b.manillon){ total += PRECIO_MANILLON; partes.push(`manillón ${dinero(PRECIO_MANILLON)}`); }
    if(prod.tipo === 'Combo' && s.aluminio === 'Ecobel'){ total += ECOBEL_COMBO; partes.push(`Ecobel ${dinero(ECOBEL_COMBO)}`); }
    if(pideMontoProteccion(prod, modelo)){
      const x = montoOrNull(prod.extraProteccion) || 0;
      total += x; partes.push(`protección ${x ? dinero(x) : '(escribe el monto)'}`);
    }
    return { total: r2(total), texto: partes.join(' + ') };
  }

  // mal: el campo se marca en rojo con su error debajo (falta elegirlo)
  // Solo la etiqueta y las opciones (para meterlas en un campo propio con su error)
  function optsCuerpo(grupo, sel){
    const cols = grupo.cols || grupo.opts.length;
    return `<span class="field-label">${esc(grupo.label)}</span>
      <div class="opts" style="--cols:${cols}">${grupo.opts.map(o => `
        <button type="button" class="opt ${o.v === sel ? 'selected' : ''}" data-g="${grupo.g}" data-v="${esc(o.v)}" aria-pressed="${o.v === sel}">${o.sw ? `<span class="swatch ${o.sw}"></span>` : ''}${esc(o.t || o.v)}</button>`).join('')}
      </div>`;
  }
  function optsHtml(grupo, sel, mal){
    return `<div class="field ${mal ? 'invalid' : ''}" data-campo="${grupo.g}">${optsCuerpo(grupo, sel)}<div class="field-error">Elige una opción</div></div>`;
  }
  function medidasHtml(prod, label, kA, kB){
    const s = prod.estado;
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      <div class="input-row">
        <div class="input-affix has-r"><input class="input" data-mkey="${kA}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kA] == null ? '' : s[kA])}" aria-label="Alto en metros"><span class="affix affix-r">alto</span></div>
        <div class="input-affix has-r"><input class="input" data-mkey="${kB}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kB] == null ? '' : s[kB])}" aria-label="Ancho en metros"><span class="affix affix-r">ancho</span></div>
      </div><div class="field-hint">En metros</div></div>`;
  }
  // Medidas que no se cambian (combo): se muestran, sin campos para escribir
  function medidaFijaHtml(prod, label, kA, kB, ayuda){
    const s = prod.estado, a = numOrNull(s[kA]), b = numOrNull(s[kB]);
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      ${a > 0 && b > 0 ? `<div class="med-fija">${esc(medidas({ alto:a, ancho:b }))}</div>` : '<div class="med-fija falta">Falta en el Catálogo</div>'}
      ${ayuda ? `<div class="field-hint">${esc(ayuda)}</div>` : ''}</div>`;
  }
  // ver: qué mostrar ('cotizacion' esconde lo de fabricar); faltan: campos por marcar en rojo
  function grupoHtml(prod, g, fijas, ver){
    ver = ver || {};
    if(ver.modo === 'cotizacion' && esFab(g.g)) return '';
    if(g.tipo === 'medidas') return fijas ? medidaFijaHtml(prod, g.label, g.keys[0], g.keys[1]) : medidasHtml(prod, g.label, g.keys[0], g.keys[1]);
    if(g.tipo === 'texto') return `<div class="field"><label class="field-label">${esc(g.label)}</label><input class="input" type="text" data-texto="${g.g}" value="${esc(prod.estado[g.g] || '')}" placeholder="${esc(g.placeholder || '')}" autocomplete="off"></div>`;
    return optsHtml(g, prod.estado[g.g], (ver.faltan || []).includes(g.g));
  }
  // Lo que falta en un producto: el aluminio de la ventana (siempre) y, al vender, los detalles de instalación
  function faltanEn(prod, modo){
    if(prod.origen === 'pieza' || !prod.tipo) return [];
    const s = prod.estado || {};
    const l = [];
    if(prod.tipo === 'Ventana' && !s.aluminio) l.push('aluminio');
    if(modo === 'venta') faltanDetalles(prod.tipo, s).forEach(g => l.push(g));
    return l;
  }
  const ICON_PUERTA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M15 11v2.5"/></svg>';
  const ICON_VENTANA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/></svg>';

  // ver = { modo:'cotizacion'|'venta', marcar:true } (sin ver se muestra todo, como en exhibición)
  function specsHtml(prod, modelo, ver){
    ver = Object.assign({}, ver || {});
    ver.faltan = ver.marcar ? faltanEn(prod, ver.modo || 'venta') : [];
    aplicarFijas(prod, modelo);
    const esq = esquema(prod.tipo, 'pedido');
    const s = prod.estado;
    const combo = prod.tipo === 'Combo';
    const fijas = combo && fijasDelModelo(prod);
    const falta = faltaEnModelo(prod, modelo);
    let html = !falta ? '' : ver.atajo && modelo ? atajoMedidasHtml() : `<div class="aviso-falta" role="alert">${esc(falta)}</div>`;
    html += combo ? `<div class="zona">${ICON_PUERTA}Puerta</div>` : '';
    html += fijas ? medidaFijaHtml(prod, esq.medidas.label || 'Medidas', 'alto', 'ancho', 'Las medidas del combo son fijas. Si son otras, ya no es combo.')
      : medidasHtml(prod, esq.medidas.label || 'Medidas', 'alto', 'ancho');
    if(tieneColores(prod.tipo)){
      html += optsHtml({ g:'__color', label: combo ? 'Color (puerta y ventanas)' : 'Color', opts: acabados(prod.tipo).filter(a => a.sw).map(a => ({ v:a.key, sw:a.sw })) }, prod.color);
    }
    const dependeDeGrupo = (g) => g.si && typeof g.si === 'object';
    const dependeDeExtra = (g) => g.si && typeof g.si === 'string';
    esq.grupos.filter(g => !g.si && !g.zona).forEach(g => {
      html += grupoHtml(prod, g, false, ver);
      esq.grupos.filter(h => dependeDeGrupo(h) && h.si.g === g.g && grupoActivo(h, s)).forEach(h => { html += grupoHtml(prod, h, false, ver); });
    });
    if(esq.extras.length){
      // Ventana del catálogo: la protección la trae el modelo (no se toca) y el marco solo si lleva protección
      const protFija = prod.tipo === 'Ventana' && fijasDelModelo(prod);
      const TICK = '<span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>';
      const chips = esq.extras.map(x => {
        if(protFija && x.k === 'proteccion') return '';
        if(protFija && x.k === 'marco_decorativo' && !s.proteccion) return '';
        return `<button type="button" class="tchip ${s[x.k] ? 'on' : ''}" data-k="${x.k}" aria-pressed="${!!s[x.k]}">${TICK}${esc(x.label)}</button>`;
      }).join('');
      if(protFija) html += `<div class="field"><span class="field-label">Protección</span><div class="prot-fija ${s.proteccion ? 'si' : ''}">${s.proteccion ? 'Con protección' : 'Sin protección'}</div><div class="field-hint">Viene del modelo. Para otra opción, elige otro modelo.</div></div>`;
      if(chips) html += `<div class="field"><span class="field-label">Extras</span><div class="toggles">${chips}</div></div>`;
    }
    esq.grupos.filter(g => dependeDeExtra(g) && grupoActivo(g, s) && !g.zona).forEach(g => { html += grupoHtml(prod, g, false, ver); });
    if(pideMontoProteccion(prod, modelo)){
      html += `<div class="field" id="campoProt"><label class="field-label" for="pProt">Monto de la protección</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="pProt" data-precio-extra type="text" inputmode="decimal" autocomplete="off" value="${esc(prod.extraProteccion || '')}"></div>
        <div class="field-error">Escribe cuánto cuesta la protección</div></div>`;
    }
    const zona = esq.grupos.filter(g => g.zona && grupoActivo(g, s));
    if(zona.length){
      html += `<div class="zona">${ICON_VENTANA}Ventanas</div>`;
      zona.forEach(g => { html += grupoHtml(prod, g, fijas, ver); });
      html += '<div class="zona-fin"></div>';
    }
    return html;
  }

  // Toques dentro de las especificaciones. Devuelve true si cambió algo (hay que repintar).
  function tocar(prod, target){
    const o = target.closest('.opt[data-g]');
    if(o && o.dataset.g !== '__tipo'){
      const campo = o.closest('.field.invalid'); if(campo) campo.classList.remove('invalid');
      if(o.dataset.g === '__color') prod.color = o.dataset.v;   // un solo color para todo el producto
      else prod.estado[o.dataset.g] = o.dataset.v;
      return true;
    }
    const t = target.closest('.tchip[data-k]');
    if(t){
      if(prod.tipo === 'Ventana' && fijasDelModelo(prod) && t.dataset.k === 'proteccion') return false;
      prod.estado[t.dataset.k] = !prod.estado[t.dataset.k];
      return true;
    }
    return false;
  }
  // Lo que se escribe (medidas, texto, monto de protección). Devuelve true si afecta el precio.
  function escribir(prod, el){
    if(el.dataset.mkey){
      if(prod.tipo === 'Combo' && fijasDelModelo(prod)) return false;   // las medidas del combo no se cambian
      prod.estado[el.dataset.mkey] = el.value; return true;
    }
    if(el.dataset.texto){ prod.estado[el.dataset.texto] = el.value; return false; }
    if(el.id === 'pProt'){ prod.extraProteccion = el.value; const c = document.getElementById('campoProt'); if(c) c.classList.remove('invalid'); return true; }
    return false;
  }

  window.SpecsProducto = { TARIFA_VENTANA, PRECIO_MANILLON, ECOBEL_COMBO, calcular, pideMontoProteccion, optsHtml, optsCuerpo, specsHtml, tocar, escribir, faltaEnModelo, faltanEn, guardarAtajoMedidas };
})();
