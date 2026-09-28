// Especificaciones de un producto (medidas, color, vidrio, extras…) y su precio sugerido.
// Lo usan Nueva venta y "Fabricar para exhibición" en Producción: así se piden
// exactamente los mismos datos en los dos lugares.
// prod = { origen, tipo, estado, color, extraProteccion, ... }; modelo = fila del catálogo (o null).
(function(){
  'use strict';
  const { acabados, tieneColores, esquema, grupoActivo, esc, numOrNull, montoOrNull, dinero } = window.AH;

  const TARIFA_VENTANA = { 'Panorámica':[90, 190], 'Ecobel':[120, 220] }; // $/m² sin y con protección
  const PRECIO_MANILLON = 20;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const base = (modelo) => (modelo && modelo.especificaciones_base) || {};

  function pideMontoProteccion(prod, modelo){
    if(prod.origen === 'medida') return false;   // a medida: el precio escrito ya lo incluye todo
    const s = prod.estado || {}, b = base(modelo);
    if(prod.tipo === 'Puerta Multilock') return !!s.proteccion && !b.proteccion;
    if(prod.tipo === 'Combo') return s.variante === 'Con protección en puerta' && b.variante !== 'Con protección en puerta';
    return false;
  }

  // ¿Cuánto cuesta según lo elegido? Devuelve el precio y cómo se calculó.
  function calcular(prod, modelo){
    const s = prod.estado || {};
    const partes = [];
    let total = 0;
    if(prod.tipo === 'Ventana'){
      const alto = numOrNull(s.alto) || 0, ancho = numOrNull(s.ancho) || 0;
      const area = r2(alto * ancho);
      const tarifa = (TARIFA_VENTANA[s.aluminio] || TARIFA_VENTANA['Panorámica'])[s.proteccion ? 1 : 0];
      total = r2(area * tarifa);
      partes.push(`${area} m² × $${tarifa} (${s.aluminio || 'Panorámica'}${s.proteccion ? ' con protección' : ''})`);
    } else {
      total = Number(modelo && modelo.precio_base) || 0;
      partes.push(`Modelo ${dinero(total)}`);
    }
    const b = base(modelo);
    if(s.manillon && s.manillon !== 'Sin' && !b.manillon){ total += PRECIO_MANILLON; partes.push(`manillón ${dinero(PRECIO_MANILLON)}`); }
    if(pideMontoProteccion(prod, modelo)){
      const x = montoOrNull(prod.extraProteccion) || 0;
      total += x; partes.push(`protección ${x ? dinero(x) : '(escribe el monto)'}`);
    }
    return { total: r2(total), texto: partes.join(' + ') };
  }

  function optsHtml(grupo, sel){
    const cols = grupo.cols || grupo.opts.length;
    return `<div class="field"><span class="field-label">${esc(grupo.label)}</span>
      <div class="opts" style="--cols:${cols}">${grupo.opts.map(o => `
        <button type="button" class="opt ${o.v === sel ? 'selected' : ''}" data-g="${grupo.g}" data-v="${esc(o.v)}" aria-pressed="${o.v === sel}">${o.sw ? `<span class="swatch ${o.sw}"></span>` : ''}${esc(o.t || o.v)}</button>`).join('')}
      </div></div>`;
  }
  function medidasHtml(prod, label, kA, kB){
    const s = prod.estado;
    return `<div class="field"><span class="field-label">${esc(label)}</span>
      <div class="input-row">
        <div class="input-affix has-r"><input class="input" data-mkey="${kA}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kA] == null ? '' : s[kA])}" aria-label="Alto en metros"><span class="affix affix-r">alto</span></div>
        <div class="input-affix has-r"><input class="input" data-mkey="${kB}" type="text" inputmode="decimal" autocomplete="off" value="${esc(s[kB] == null ? '' : s[kB])}" aria-label="Ancho en metros"><span class="affix affix-r">ancho</span></div>
      </div><div class="field-hint">En metros</div></div>`;
  }
  function grupoHtml(prod, g){
    if(g.tipo === 'medidas') return medidasHtml(prod, g.label, g.keys[0], g.keys[1]);
    if(g.tipo === 'texto') return `<div class="field"><label class="field-label">${esc(g.label)}</label><input class="input" type="text" data-texto="${g.g}" value="${esc(prod.estado[g.g] || '')}" placeholder="${esc(g.placeholder || '')}" autocomplete="off"></div>`;
    return optsHtml(g, prod.estado[g.g]);
  }
  const ICON_PUERTA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M15 11v2.5"/></svg>';
  const ICON_VENTANA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/></svg>';

  function specsHtml(prod, modelo){
    const esq = esquema(prod.tipo, 'pedido');
    const s = prod.estado;
    const combo = prod.tipo === 'Combo';
    let html = combo ? `<div class="zona">${ICON_PUERTA}Puerta</div>` : '';
    html += medidasHtml(prod, esq.medidas.label || 'Medidas', 'alto', 'ancho');
    if(tieneColores(prod.tipo)){
      html += optsHtml({ g:'__color', label: combo ? 'Color (puerta y ventanas)' : 'Color', opts: acabados(prod.tipo).filter(a => a.sw).map(a => ({ v:a.key, sw:a.sw })) }, prod.color);
    }
    const dependeDeGrupo = (g) => g.si && typeof g.si === 'object';
    const dependeDeExtra = (g) => g.si && typeof g.si === 'string';
    esq.grupos.filter(g => !g.si && !g.zona).forEach(g => {
      html += grupoHtml(prod, g);
      esq.grupos.filter(h => dependeDeGrupo(h) && h.si.g === g.g && grupoActivo(h, s)).forEach(h => { html += grupoHtml(prod, h); });
    });
    if(esq.extras.length){
      html += `<div class="field"><span class="field-label">Extras</span><div class="toggles">${esq.extras.map(x => `
        <button type="button" class="tchip ${s[x.k] ? 'on' : ''}" data-k="${x.k}" aria-pressed="${!!s[x.k]}"><span class="tick"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>${esc(x.label)}</button>`).join('')}</div></div>`;
    }
    esq.grupos.filter(g => dependeDeExtra(g) && grupoActivo(g, s) && !g.zona).forEach(g => { html += grupoHtml(prod, g); });
    if(pideMontoProteccion(prod, modelo)){
      html += `<div class="field" id="campoProt"><label class="field-label" for="pProt">Monto de la protección</label>
        <div class="input-affix has-l"><span class="affix affix-l">$</span><input class="input" id="pProt" data-precio-extra type="text" inputmode="decimal" autocomplete="off" value="${esc(prod.extraProteccion || '')}"></div>
        <div class="field-error">Escribe cuánto cuesta la protección</div></div>`;
    }
    const zona = esq.grupos.filter(g => g.zona && grupoActivo(g, s));
    if(zona.length){
      html += `<div class="zona">${ICON_VENTANA}Ventanas</div>`;
      zona.forEach(g => { html += grupoHtml(prod, g); });
      html += '<div class="zona-fin"></div>';
    }
    return html;
  }

  // Toques dentro de las especificaciones. Devuelve true si cambió algo (hay que repintar).
  function tocar(prod, target){
    const o = target.closest('.opt[data-g]');
    if(o && o.dataset.g !== '__tipo'){
      if(o.dataset.g === '__color'){
        prod.color = o.dataset.v;
        if(prod.tipo === 'Combo') prod.estado.ventanas_color = o.dataset.v;  // las ventanas van del mismo color
      } else prod.estado[o.dataset.g] = o.dataset.v;
      return true;
    }
    const t = target.closest('.tchip[data-k]');
    if(t){ prod.estado[t.dataset.k] = !prod.estado[t.dataset.k]; return true; }
    return false;
  }
  // Lo que se escribe (medidas, texto, monto de protección). Devuelve true si afecta el precio.
  function escribir(prod, el){
    if(el.dataset.mkey){ prod.estado[el.dataset.mkey] = el.value; return true; }
    if(el.dataset.texto){ prod.estado[el.dataset.texto] = el.value; return false; }
    if(el.id === 'pProt'){ prod.extraProteccion = el.value; const c = document.getElementById('campoProt'); if(c) c.classList.remove('invalid'); return true; }
    return false;
  }

  window.SpecsProducto = { TARIFA_VENTANA, PRECIO_MANILLON, calcular, pideMontoProteccion, optsHtml, specsHtml, tocar, escribir };
})();
