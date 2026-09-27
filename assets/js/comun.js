// Piezas compartidas por todas las pantallas (catálogo interno, catálogo público y,
// más adelante, ventas): tipos de producto, especificaciones, formatos y hojas inferiores.
// Todo queda en window.AH para no chocar con nombres globales de librerías.
(function(){
  'use strict';

  // ---------------------------------------------------------------------------
  // Tipos de producto
  // ---------------------------------------------------------------------------
  const TIPOS = ['Puerta Multilock', 'Ventana', 'Portón', 'Combo', 'Puerta de Madera'];

  const TIPO_INFO = {
    'Puerta Multilock': { hint:'Puerta de seguridad', icon:'<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M15 11v2.5"/><path d="M9 7h.01M9 12h.01M9 17h.01"/>' },
    'Ventana':          { hint:'Con o sin protección', icon:'<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M12 4.5v15M3.5 12h17"/>' },
    'Portón':           { hint:'Vidrio o farquilla', icon:'<path d="M2.5 20.5h19"/><rect x="3.5" y="6" width="17" height="14.5" rx="1"/><path d="M7.8 6v14.5M12 6v14.5M16.2 6v14.5"/>' },
    'Combo':            { hint:'Puerta y 2 ventanas', icon:'<rect x="3" y="3" width="9" height="18" rx="1.2"/><path d="M9.5 11.5v2"/><rect x="14" y="6" width="7" height="7" rx="1"/><path d="M17.5 6v7M14 9.5h7"/>' },
    'Puerta de Madera': { hint:'Un solo acabado', icon:'<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><rect x="8.5" y="5" width="7" height="6" rx=".8"/><rect x="8.5" y="13" width="7" height="6" rx=".8"/>' }
  };
  function iconoTipo(t, size){
    const s = size || 22;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${(TIPO_INFO[t] || TIPO_INFO['Puerta Multilock']).icon}</svg>`;
  }

  // Madera tiene un solo acabado; el resto, blanco y negro (igual que la app vieja).
  function acabados(tipo){
    if(tipo === 'Puerta de Madera') return [{ key:'Principal', label:'Foto', sw:null }];
    return [
      { key:'Blanco', label:'Blanco', sw:'sw-blanco' },
      { key:'Negro',  label:'Negro',  sw:'sw-negro' }
    ];
  }
  function tieneColores(tipo){ return tipo !== 'Puerta de Madera'; }

  const OPC_VIDRIO   = [{v:'Farquilla'},{v:'Azul',sw:'sw-azul'},{v:'Espejo',sw:'sw-espejo'},{v:'Negro',sw:'sw-negro'}];
  const OPC_MANILLON = [{v:'Sin'},{v:'H'},{v:'S'},{v:'Luna'}];
  const OPC_AHUMADO  = [{v:'Sin'},{v:'Espejo',sw:'sw-espejo'},{v:'Azul',sw:'sw-azul'},{v:'Negro',sw:'sw-negro'}];
  const OPC_VARIANTE = [{v:'Con protección en puerta', t:'Con protección'},{v:'Sin protección en puerta', t:'Sin protección'}];
  const SW_COLOR = { Azul:'sw-azul', Espejo:'sw-espejo', Negro:'sw-negro', Blanco:'sw-blanco' };

  // Qué se pregunta en cada tipo, en orden. Valores por defecto tomados de la app original.
  const ESQUEMA = {
    'Ventana': {
      medidas:{ alto:1, ancho:1 },
      grupos:[ { g:'ahumado', label:'Papel ahumado', opts:OPC_AHUMADO, def:'Espejo' } ],
      extras:[
        { k:'proteccion', label:'Protección' },
        { k:'marco_decorativo', label:'Marco en protección' },
        { k:'mas_hojas', label:'Más de 2 hojas' }
      ]
    },
    'Portón': {
      medidas:{ alto:2.2, ancho:3 },
      grupos:[
        { g:'vidrio', label:'Vidrio o farquilla', opts:OPC_VIDRIO, def:'Espejo' },
        { g:'manillon', label:'Manillón', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[]
    },
    'Puerta Multilock': {
      medidas:{ alto:2, ancho:1 },
      grupos:[
        { g:'vidrio', label:'Vidrio o farquilla', opts:OPC_VIDRIO, def:'Negro' },
        { g:'manillon', label:'Manillón', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[
        { k:'marco_decorativo', label:'Marco decorativo' },
        { k:'proteccion', label:'Protección' }
      ]
    },
    'Combo': {
      medidas:{ alto:2, ancho:1, label:'Medidas de la puerta' },
      grupos:[
        { g:'variante', label:'Variante', opts:OPC_VARIANTE, def:'Con protección en puerta', cols:2 },
        { g:'ahumado', label:'Papel ahumado de las ventanas', opts:OPC_AHUMADO, def:'Espejo' },
        { g:'manillon', label:'Manillón de la puerta', opts:OPC_MANILLON, def:'Sin' }
      ],
      extras:[ { k:'marco_decorativo', label:'Marco decorativo' } ]
    },
    'Puerta de Madera': {
      medidas:{ alto:2, ancho:0.9 },
      grupos:[],
      extras:[]
    }
  };

  // Convierte lo elegido en pantalla a los mismos campos que usa el resto del sistema.
  function especificacionesDesdeEstado(tipo, s){
    const out = { alto: numOrNull(s.alto), ancho: numOrNull(s.ancho) };
    const esq = ESQUEMA[tipo];
    esq.grupos.forEach(({g})=>{
      const v = s[g];
      if(g === 'vidrio'){
        if(v === 'Farquilla') out.vidrio_o_farquilla = 'Farquilla';
        else { out.vidrio_o_farquilla = 'Vidrio'; out.color_vidrio = v; }
      } else if(g === 'manillon'){
        out.manillon = v !== 'Sin';
        if(out.manillon) out.manillon_tipo = v;
      } else if(g === 'ahumado'){
        out.papel_ahumado = v !== 'Sin';
        if(out.papel_ahumado) out.color_ahumado = v;
      } else if(g === 'variante'){
        out.variante = v;
      }
    });
    esq.extras.forEach(({k})=>{ out[k] = !!s[k]; });
    return out;
  }

  // Lo contrario: a partir de campos guardados, lo que se ve en pantalla.
  function estadoDesdeEspecificaciones(tipo, e){
    e = e || {};
    const esq = ESQUEMA[tipo];
    const s = {
      alto: e.alto != null ? e.alto : esq.medidas.alto,
      ancho: e.ancho != null ? e.ancho : esq.medidas.ancho
    };
    esq.grupos.forEach(({g, def})=>{
      let v = def;
      if(g === 'vidrio' && e.vidrio_o_farquilla){
        v = e.vidrio_o_farquilla === 'Farquilla' ? 'Farquilla' : (e.color_vidrio || def);
      } else if(g === 'manillon' && e.manillon != null){
        v = e.manillon ? (e.manillon_tipo || 'H') : 'Sin';
      } else if(g === 'ahumado' && e.papel_ahumado != null){
        v = e.papel_ahumado ? (e.color_ahumado || 'Espejo') : 'Sin';
      } else if(g === 'variante' && e.variante){
        v = e.variante;
      }
      s[g] = v;
    });
    esq.extras.forEach(({k})=>{ s[k] = !!e[k]; });
    return s;
  }

  // Especificaciones en frases cortas (chips). sinMedidas: para no repetir medidas.
  function resumenSpecs(tipo, e, sinMedidas){
    e = e || {};
    const out = [];
    if(!sinMedidas && e.alto && e.ancho) out.push({ t:medidas(e) });
    if(e.variante) out.push({ t:e.variante });
    if(e.vidrio_o_farquilla === 'Farquilla') out.push({ t:'Farquilla' });
    else if(e.vidrio_o_farquilla === 'Vidrio') out.push({ t:'Vidrio ' + (e.color_vidrio || '').toLowerCase(), sw:SW_COLOR[e.color_vidrio] });
    if(e.papel_ahumado === true) out.push({ t:'Ahumado ' + (e.color_ahumado || '').toLowerCase(), sw:SW_COLOR[e.color_ahumado] });
    else if(e.papel_ahumado === false) out.push({ t:'Sin ahumado' });
    if(e.manillon === true) out.push({ t:'Manillón ' + (e.manillon_tipo || '') });
    if(e.proteccion) out.push({ t:'Protección' });
    if(e.marco_decorativo) out.push({ t: tipo === 'Ventana' ? 'Marco en protección' : 'Marco decorativo' });
    if(e.mas_hojas) out.push({ t:'Más de 2 hojas' });
    return out;
  }
  function medidas(e){
    if(!e || !e.alto || !e.ancho) return '';
    return `${fmt.format(e.alto)} × ${fmt.format(e.ancho)} m`;
  }

  // ---------------------------------------------------------------------------
  // Fotos
  // ---------------------------------------------------------------------------
  // Foto de un modelo para un color dado; si no existe, la que haya.
  function fotoModelo(m, color){
    const f = (m && m.fotos) || {};
    if(color && f[color]) return f[color];
    for(const a of acabados(m && m.tipo)){ if(f[a.key]) return f[a.key]; }
    return Object.values(f).find(Boolean) || null;
  }
  // Foto de una pieza disponible: la foto real si la tiene; si no, la del modelo en ese color.
  function fotoPieza(p, m){ return (p && p.foto) || fotoModelo(m, p && p.color); }

  // ---------------------------------------------------------------------------
  // Formatos
  // ---------------------------------------------------------------------------
  function esc(t){
    return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function numOrNull(v){ const n = parseFloat(v); return isFinite(n) ? n : null; }
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  function dinero(n){ return '$' + fmt.format(Number(n) || 0); }
  function specChipsHtml(lista){
    return lista.map(s => `<span class="spec-chip">${s.sw ? `<span class="swatch ${s.sw}"></span>` : ''}${esc(s.t)}</span>`).join('');
  }

  let toastTimer = null;
  function toast(msg, tipo){
    const t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.toggle('error', tipo === 'error');
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.remove('show'), tipo === 'error' ? 4200 : 2400);
  }

  // ---------------------------------------------------------------------------
  // Hojas inferiores: abrir, cerrar, cerrar deslizando hacia abajo
  // ---------------------------------------------------------------------------
  const pila = [];
  const alCerrar = {};
  function abrirHoja(id){
    const s = document.getElementById(id);
    s.style.transform = '';
    s.classList.add('open');
    document.getElementById(id.replace('sheet', 'scrim')).classList.add('open');
    if(!pila.includes(id)) pila.push(id);
    document.body.style.overflow = 'hidden';
  }
  function cerrarHoja(id){
    const s = document.getElementById(id);
    s.classList.remove('open');
    s.style.transform = '';
    document.getElementById(id.replace('sheet', 'scrim')).classList.remove('open');
    const i = pila.indexOf(id);
    if(i > -1) pila.splice(i, 1);
    if(!pila.length) document.body.style.overflow = '';
    if(alCerrar[id]) alCerrar[id]();
  }
  function hojaAbierta(){ return pila.length > 0; }

  function activarDeslizar(sheet){
    let y0 = null, dy = 0;
    sheet.addEventListener('touchstart', (e)=>{
      const body = sheet.querySelector('.sheet-body');
      if(e.target.closest('input, textarea, select, .opts, .toggles, .chips')){ y0 = null; return; }
      if(body && body.contains(e.target) && body.scrollTop > 0){ y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive:true });
    sheet.addEventListener('touchmove', (e)=>{
      if(y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if(dy <= 0){ sheet.style.transition = ''; sheet.style.transform = ''; return; }
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive:true });
    sheet.addEventListener('touchend', ()=>{
      if(y0 == null) return;
      sheet.style.transition = '';
      if(dy > 110) cerrarHoja(sheet.id);
      else sheet.style.transform = '';
      y0 = null;
    });
  }

  document.addEventListener('click', (e)=>{
    const c = e.target.closest('[data-cerrar]');
    if(c) cerrarHoja(c.dataset.cerrar);
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && pila.length) cerrarHoja(pila[pila.length - 1]);
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('.sheet').forEach(activarDeslizar);
  });

  window.AH = {
    TIPOS, TIPO_INFO, iconoTipo, acabados, tieneColores, ESQUEMA, SW_COLOR,
    especificacionesDesdeEstado, estadoDesdeEspecificaciones, resumenSpecs, medidas,
    fotoModelo, fotoPieza, esc, numOrNull, fmt, dinero, specChipsHtml, toast,
    abrirHoja, cerrarHoja, hojaAbierta, alCerrar
  };
})();
