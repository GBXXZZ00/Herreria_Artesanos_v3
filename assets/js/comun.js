// Piezas compartidas por todas las pantallas (catálogo interno, catálogo público y,
// más adelante, ventas): tipos de producto, especificaciones, formatos y hojas inferiores.
// Todo queda en window.AH para no chocar con nombres globales de librerías.
(function(){
  'use strict';
  // En iPhone, el efecto de "presionado" (:active) solo aparece al instante si la página escucha toques
  document.addEventListener('touchstart', () => {}, { passive:true });

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

  // Opciones que se repiten en varios tipos
  const OPC_SENTIDO   = [{v:'Derecha'},{v:'Izquierda'}];
  const OPC_POSICION  = [{v:'Adentro'},{v:'Afuera'}];
  const OPC_BLOQUE    = [{v:'10'},{v:'15'},{v:'Tubo'}];
  const OPC_ALUMINIO  = [{v:'Panorámica'},{v:'Ecobel'}];
  const OPC_COLOR     = [{v:'Blanco',sw:'sw-blanco'},{v:'Negro',sw:'sw-negro'}];
  const OPC_CERRADURA = [{v:'Manilla de pomo', t:'Pomo'},{v:'Manilla negra', t:'Manilla negra'},{v:'Personalizada'}];
  const CON_PROT_COMBO = { g:'variante', v:'Con protección en puerta' };

  // Qué se pregunta en cada tipo al crear el MODELO del catálogo, en orden.
  // Valores por defecto tomados de la app original.
  //   si: 'extra'          -> el grupo solo aparece si ese extra está marcado
  //   si: {g, v}           -> el grupo solo aparece si otro grupo tiene ese valor
  //   tipo: 'medidas'      -> par de medidas (keys)
  //   tipo: 'texto'        -> campo de texto libre
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
        { g:'variante', label:'Protección en la puerta', opts:OPC_VARIANTE, def:'Con protección en puerta', cols:2 },
        { g:'vidrio', label:'Vidrio o farquilla de la puerta', opts:OPC_VIDRIO, def:'Negro' },
        { g:'manillon', label:'Manillón de la puerta', opts:OPC_MANILLON, def:'Sin' },
        { g:'ahumado', label:'Papel ahumado de las ventanas', opts:OPC_AHUMADO, def:'Espejo', zona:'ventanas' },
        { g:'ventanas_medidas', label:'Medidas de las 2 ventanas', tipo:'medidas', keys:['ventanas_alto','ventanas_ancho'], def:[1, 1], zona:'ventanas' }
      ],
      extras:[ { k:'marco_decorativo', label:'Marco decorativo en la puerta' } ]
    },
    'Puerta de Madera': {
      medidas:{ alto:2, ancho:0.9 },
      grupos:[
        { g:'cerradura', label:'Cerradura', opts:OPC_CERRADURA, def:'Manilla de pomo', cols:3 },
        { g:'cerradura_detalle', label:'¿Qué cerradura lleva?', tipo:'texto', placeholder:'Ej: Manilla dorada con llave', si:{ g:'cerradura', v:'Personalizada' } }
      ],
      extras:[]
    }
  };

  // Lo que se decide por pieza física o por venta, no por modelo (igual que la app original:
  // el modelo de catálogo no lleva sentido, posición ni bloque).
  const PEDIDO = {
    'Ventana': {
      antes:[ { g:'aluminio', label:'Aluminio', opts:OPC_ALUMINIO, def:'Panorámica' } ],
      despues:[ { g:'bloque', label:'Tipo de bloque (protección)', opts:OPC_BLOQUE, def:'15', si:'proteccion' } ]
    },
    'Portón': {
      antes:[],
      despues:[
        { g:'sentido', label:'Sentido de apertura', opts:OPC_SENTIDO, def:'Derecha' },
        { g:'posicion', label:'Posición de instalación', opts:OPC_POSICION, def:'Afuera' },
        { g:'bloque', label:'Tipo de bloque', opts:OPC_BLOQUE, def:'15' }
      ]
    },
    'Puerta Multilock': {
      antes:[],
      despues:[
        { g:'sentido', label:'Sentido de apertura', opts:OPC_SENTIDO, def:'Derecha' },
        { g:'posicion', label:'Posición de apertura', opts:OPC_POSICION, def:'Afuera' },
        { g:'bloque', label:'Tipo de bloque', opts:OPC_BLOQUE, def:'15' },
        { g:'proteccion_sentido', label:'¿Hacia dónde abre la protección?', opts:OPC_SENTIDO, def:'Derecha', si:'proteccion' }
      ]
    },
    'Combo': {
      antes:[],
      despues:[
        { g:'proteccion_sentido', label:'¿Hacia dónde abre la protección?', opts:OPC_SENTIDO, def:'Derecha', si:CON_PROT_COMBO },
        { g:'sentido', label:'Sentido de apertura', opts:OPC_SENTIDO, def:'Derecha' },
        { g:'posicion', label:'Posición de apertura', opts:OPC_POSICION, def:'Afuera' },
        { g:'bloque', label:'Tipo de bloque', opts:OPC_BLOQUE, def:'10' },
        { g:'aluminio', label:'Aluminio de las ventanas', opts:OPC_ALUMINIO, def:'Panorámica', zona:'ventanas' }
      ]
    },
    'Puerta de Madera': {
      antes:[],
      despues:[
        { g:'sentido', label:'Sentido de apertura', opts:OPC_SENTIDO, def:'Derecha' },
        { g:'posicion', label:'Posición de apertura', opts:OPC_POSICION, def:'Afuera' },
        { g:'bloque', label:'Tipo de bloque', opts:OPC_BLOQUE, def:'15' }
      ]
    }
  };
  // Grupos que se guardan tal cual (mismo nombre de campo y valor)
  const DIRECTOS = ['sentido', 'posicion', 'bloque', 'aluminio', 'proteccion_sentido', 'cerradura'];

  // Esquema según dónde se usa: 'modelo' (catálogo) o 'pedido' (pieza disponible / venta).
  function esquema(tipo, modo){
    const base = ESQUEMA[tipo] || ESQUEMA['Puerta Multilock'];
    if(modo !== 'pedido') return base;
    const extra = PEDIDO[tipo] || { antes:[], despues:[] };
    // Lo de las ventanas del combo va junto, después de todo lo de la puerta
    const todos = [...extra.antes, ...base.grupos, ...extra.despues];
    return { medidas: base.medidas, grupos: [...todos.filter(g => !g.zona), ...todos.filter(g => g.zona)], extras: base.extras };
  }
  // Un grupo condicional se muestra y se guarda solo si aplica.
  function grupoActivo(gr, s){
    if(!gr.si) return true;
    if(typeof gr.si === 'string') return !!s[gr.si];
    return s[gr.si.g] === gr.si.v;
  }

  // Qué campos guardados controla cada grupo del formulario
  function clavesGrupo(gr){
    if(gr.tipo === 'medidas') return gr.keys;
    if(gr.g === 'vidrio') return ['vidrio_o_farquilla', 'color_vidrio'];
    if(gr.g === 'manillon') return ['manillon', 'manillon_tipo'];
    if(gr.g === 'ahumado') return ['papel_ahumado', 'color_ahumado'];
    return [gr.g];
  }

  // Convierte lo elegido en pantalla a los mismos campos que usa el resto del sistema.
  function especificacionesDesdeEstado(tipo, s, modo){
    const out = { alto: numOrNull(s.alto), ancho: numOrNull(s.ancho) };
    const esq = esquema(tipo, modo);
    esq.grupos.forEach((gr)=>{
      const g = gr.g;
      if(!grupoActivo(gr, s)) return;
      if(gr.tipo === 'medidas'){ gr.keys.forEach(k => { out[k] = numOrNull(s[k]); }); return; }
      if(gr.tipo === 'texto'){ const t = String(s[g] || '').trim(); if(t) out[g] = t; return; }
      const v = s[g];
      if(DIRECTOS.includes(g)){ out[g] = v; return; }
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
  function estadoDesdeEspecificaciones(tipo, e, modo){
    e = e || {};
    const esq = esquema(tipo, modo);
    const s = {
      alto: e.alto != null ? e.alto : esq.medidas.alto,
      ancho: e.ancho != null ? e.ancho : esq.medidas.ancho
    };
    esq.grupos.forEach((gr)=>{
      const g = gr.g, def = gr.def;
      if(gr.tipo === 'medidas'){ gr.keys.forEach((k, i) => { s[k] = e[k] != null ? e[k] : gr.def[i]; }); return; }
      if(gr.tipo === 'texto'){ s[g] = e[g] || ''; return; }
      let v = def;
      if(g === 'vidrio' && e.vidrio_o_farquilla){
        v = e.vidrio_o_farquilla === 'Farquilla' ? 'Farquilla' : (e.color_vidrio || def);
      } else if(g === 'manillon' && e.manillon != null){
        v = e.manillon ? (e.manillon_tipo || 'H') : 'Sin';
      } else if(g === 'ahumado' && e.papel_ahumado != null){
        v = e.papel_ahumado ? (e.color_ahumado || 'Espejo') : 'Sin';
      } else if(g === 'variante' && e.variante){
        v = e.variante;
      } else if(DIRECTOS.includes(g) && e[g]){
        v = e[g];
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
    if(e.aluminio) out.push({ t:'Aluminio ' + e.aluminio });
    if(e.variante) out.push({ t:e.variante });
    if(e.vidrio_o_farquilla === 'Farquilla') out.push({ t:'Farquilla' });
    else if(e.vidrio_o_farquilla === 'Vidrio') out.push({ t:'Vidrio ' + (e.color_vidrio || '').toLowerCase(), sw:SW_COLOR[e.color_vidrio] });
    if(e.papel_ahumado === true) out.push({ t:'Ahumado ' + (e.color_ahumado || '').toLowerCase(), sw:SW_COLOR[e.color_ahumado] });
    else if(e.papel_ahumado === false) out.push({ t:'Sin ahumado' });
    if(e.manillon === true) out.push({ t:'Manillón ' + (e.manillon_tipo || '') });
    if(e.cerradura) out.push({ t: e.cerradura === 'Personalizada' ? 'Cerradura: ' + (e.cerradura_detalle || 'personalizada') : e.cerradura });
    if(e.proteccion) out.push({ t:'Protección' });
    if(e.proteccion_sentido) out.push({ t:'Protección abre a la ' + e.proteccion_sentido.toLowerCase() });
    if(e.marco_decorativo) out.push({ t: tipo === 'Ventana' ? 'Marco en protección' : 'Marco decorativo' });
    if(e.mas_hojas) out.push({ t:'Más de 2 hojas' });
    if(e.sentido) out.push({ t:'Abre a la ' + e.sentido.toLowerCase() });
    if(e.posicion) out.push({ t:(tipo === 'Portón' ? 'Instalación ' : 'Apertura ') + e.posicion.toLowerCase() });
    if(e.bloque) out.push({ t:'Bloque ' + e.bloque });
    if(e.ventanas_alto && e.ventanas_ancho) out.push({ t:`Ventanas ${fmt.format(e.ventanas_alto)} × ${fmt.format(e.ventanas_ancho)} m` });
    // Pedidos viejos con las ventanas de otro color (ya no se puede elegir)
    if(e.ventanas_color && e.color && e.ventanas_color !== e.color) out.push({ t:'Ventanas ' + e.ventanas_color.toLowerCase(), sw:SW_COLOR[e.ventanas_color] });
    return out;
  }

  // ¿La pieza lleva protección pero la foto que se muestra es la del modelo sin protección?
  function llevaProteccion(tipo, e){
    e = e || {};
    return tipo === 'Combo' ? e.variante === 'Con protección en puerta' : !!e.proteccion;
  }
  function avisoFotoProteccion(p, m){
    if(!p || p.foto || !m) return '';
    const pieza = llevaProteccion(m.tipo, p.especificaciones);
    const modelo = llevaProteccion(m.tipo, m.especificaciones_base);
    if(pieza && !modelo) return 'Lleva protección (no sale en la foto)';
    if(!pieza && modelo) return 'Sin protección (la foto sí la muestra)';
    return '';
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
  // Foto de un producto de un pedido: siempre la del catálogo en el color del pedido, así
  // cuando se sube la foto que faltaba se ve sola en todos lados. Si ese color no tiene
  // foto, la que haya, y se dice de qué color es (otroColor) para avisarle al trabajador.
  // Acepta el producto con su modelo (it.catalogo.fotos) o ya resuelto por el servidor (foto_de).
  function fotoItem(it){
    it = it || {};
    const color = ((it.especificaciones || {}).color) || it.color || null;
    let url = it.foto || null;
    let de = it.foto_de != null ? it.foto_de : null;
    const f = it.catalogo && it.catalogo.fotos;
    if(f && !it.pieza_id){
      if(color && f[color]){ url = f[color]; de = color; }
      else if(url){ de = Object.keys(f).find(k => f[k] === url) || null; }
      else {
        const k = ['Blanco', 'Negro'].concat(Object.keys(f)).find(k => f[k]);
        url = k ? f[k] : null; de = k || null;
      }
    }
    return { url, de, color, otroColor: !!(url && de && color && de !== color) };
  }
  // "Foto en blanco · el tuyo va en NEGRO"
  // En un Combo el color del pedido es el de la puerta: "la puerta va en NEGRO"
  function etiquetaOtroColor(fi, tipo){
    return fi && fi.otroColor ? `Foto en ${String(fi.de).toLowerCase()} · ${tipo === 'Combo' ? 'la puerta' : 'el tuyo'} va en ${String(fi.color).toUpperCase()}` : '';
  }
  // Fechas tope del taller: la semana va de lunes a sábado y el domingo ya es de la siguiente.
  function isoLocal(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function sabados(){
    const d = new Date(); d.setHours(12, 0, 0, 0);
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? 6 : 6 - dow));
    const este = isoLocal(d);
    d.setDate(d.getDate() + 7);
    return { este, proximo: isoLocal(d), hoy: isoLocal(new Date()) };
  }
  function sabadoCorto(iso){
    if(!iso) return '';
    const [y, m, dd] = String(iso).slice(0, 10).split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    return 'sáb ' + d.getDate() + ' ' + d.toLocaleDateString('es-VE', { month:'short' }).replace('.', '');
  }
  // Texto de la fecha tope de un trabajo pendiente: "Para el sáb 3 oct" o, si ya pasó, "Se pasó del sáb 26 sep"
  function topeTexto(iso){
    if(!iso) return { t:'', tarde:false };
    const tarde = String(iso).slice(0, 10) < isoLocal(new Date());
    return { t: (tarde ? 'Se pasó del ' : 'Para el ') + sabadoCorto(iso), tarde };
  }

  // ---------------------------------------------------------------------------
  // Formatos
  // ---------------------------------------------------------------------------
  function esc(t){
    return String(t == null ? '' : t)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function numOrNull(v){ const n = parseFloat(String(v == null ? '' : v).replace(',', '.').trim()); return isFinite(n) ? n : null; }
  // Montos: acepta 1.500 / 1.500,50 (como se escribe aquí), 1,500.50 y 150,5
  function montoOrNull(v){
    let t = String(v == null ? '' : v).replace(/[\s$]/g, '');
    if(!t) return null;
    if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else t = t.replace(',', '.');
    if(!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
    const n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const fmtCent = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function dinero(n){ const x = Math.round((Number(n) || 0) * 100) / 100; return '$' + (Number.isInteger(x) ? fmt : fmtCent).format(x); }
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
  const antesDeCerrar = {}; // id -> función que devuelve false para impedir el cierre

  // ---- Historial: cada hoja abierta (y el visor de fotos) ocupa un paso de "atrás".
  // Así, deslizar hacia atrás en el iPhone cierra la hoja en vez de salir de la página.
  // Cada paso guarda { ah: n } con su profundidad. capas[] refleja esos pasos.
  const capas = [];          // { id } para hojas, { visor:true } para el visor; .muerta si ya se cerró
  let base = (history.state && typeof history.state.ah === 'number') ? history.state.ah : 0;
  let pendiente = 0;         // pasos por quitar del historial (se quitan juntos, un instante después)
  let ignorar = false;       // el próximo popstate lo provocamos nosotros
  const prof = () => base + capas.length;
  function empujarCapa(c){
    capas.push(c);
    const st = Object.assign({}, history.state || {}, { ah: prof() });
    delete st.ahBase;
    // Si justo se cerró otra hoja, se reutiliza su paso en vez de agregar uno nuevo
    if(pendiente > 0){ pendiente--; history.replaceState(st, ''); }
    else history.pushState(st, '');
  }
  function soltarCapas(){
    let k = 0;
    while(capas.length && capas[capas.length - 1].muerta){ capas.pop(); k++; }
    if(!k) return;
    pendiente += k;
    setTimeout(() => {
      if(pendiente > 0){ const n = pendiente; pendiente = 0; ignorar = true; history.go(-n); }
    }, 0);
  }
  function marcarMuerta(pred){
    for(let i = capas.length - 1; i >= 0; i--){ if(!capas[i].muerta && pred(capas[i])){ capas[i].muerta = true; break; } }
    soltarCapas();
  }

  function abrirHoja(id){
    const s = document.getElementById(id);
    s.style.transform = '';
    const yaAbierta = s.classList.contains('open');
    s.classList.add('open');
    document.getElementById(id.replace('sheet', 'scrim')).classList.add('open');
    if(!pila.includes(id)) pila.push(id);
    document.body.style.overflow = 'hidden';
    if(!yaAbierta) empujarCapa({ id });
  }
  function cerrarInterno(id, forzar){
    if(!forzar && antesDeCerrar[id] && antesDeCerrar[id]() === false){
      const s0 = document.getElementById(id);
      s0.style.transition = ''; s0.style.transform = '';
      return false;
    }
    const s = document.getElementById(id);
    s.classList.remove('open');
    s.style.transform = '';
    document.getElementById(id.replace('sheet', 'scrim')).classList.remove('open');
    const i = pila.indexOf(id);
    if(i > -1) pila.splice(i, 1);
    if(!pila.length) document.body.style.overflow = '';
    if(alCerrar[id]) alCerrar[id]();
    return true;
  }
  function cerrarHoja(id, forzar){
    const abierta = document.getElementById(id).classList.contains('open');
    const ok = cerrarInterno(id, forzar);
    if(ok && abierta){
      capas.forEach(c => { if(c.id === id || c.sub === id) c.muerta = true; });
      soltarCapas();
    }
    return ok;
  }

  // Las hojas con varias vistas avisan cuando muestran una vista con "Volver" (un paso más)
  // o regresan a la vista principal (se quita ese paso).
  let desdeHistorial = false;
  function vistaInterna(id, conVolver){
    const top = capas[capas.length - 1];
    const enSub = top && !top.muerta && top.sub === id;
    if(conVolver && !enSub){
      const sh = document.getElementById(id);
      if(sh && sh.classList.contains('open')) empujarCapa({ sub:id });
    } else if(!conVolver && enSub && !desdeHistorial){
      top.muerta = true; soltarCapas();
    }
  }
  // Tocar "Volver" es lo mismo que ir atrás: así el historial y la vista siempre coinciden
  document.addEventListener('click', (e) => {
    if(desdeHistorial) return;
    const b = e.target.closest('.sheet-back');
    if(!b) return;
    const sh = b.closest('.sheet');
    const top = capas[capas.length - 1];
    if(sh && top && !top.muerta && top.sub === sh.id){ e.preventDefault(); e.stopPropagation(); history.back(); }
  }, true);

  window.addEventListener('popstate', (e) => {
    if(ignorar){ ignorar = false; return; }
    const st = e.state || {};
    // Paso de "Inicio" debajo de un módulo abierto directamente
    if(st.ahBase){ location.replace('index.html'); return; }
    const d = typeof st.ah === 'number' ? st.ah : 0;
    const actual = prof();
    if(d > actual){ ignorar = true; history.go(actual - d); return; } // adelante: pasos viejos, no aplican
    if(d < base){ base = d; capas.length = 0; return; }             // pasos de antes de recargar
    let n = actual - d;
    while(n-- > 0){
      const c = capas.pop();
      if(!c || c.muerta) continue;
      if(c.visor){ cerrarVisorInterno(); continue; }
      if(c.sub){
        // Vista interna de una hoja (ej. una pieza dentro de la lista): vuelve a la vista anterior
        const sh = document.getElementById(c.sub);
        const b = sh && sh.classList.contains('open') && sh.querySelector('.sheet-back');
        if(b){ desdeHistorial = true; try{ b.click(); } finally { desdeHistorial = false; } }
        continue;
      }
      const sheet = document.getElementById(c.id);
      if(!sheet || !sheet.classList.contains('open')) continue;
      if(!cerrarInterno(c.id, false)){ capas.push(c); history.pushState(Object.assign({}, st, { ah: prof() }), ''); }
    }
    // Si arriba quedó un paso de una hoja ya cerrada, se salta
    if(capas.length && capas[capas.length - 1].muerta) soltarCapas();
  });
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
      const body = sheet.querySelector('.sheet-body');
      // Si el contenido empezó a desplazarse, esto es scroll y no un gesto para cerrar
      if(body && body.scrollTop > 0){ y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; return; }
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

  // ---------------------------------------------------------------------------
  // Foto principal (hero): fondo difuminado y visor a pantalla completa
  // ---------------------------------------------------------------------------
  const ICON_ZOOM = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>';
  function heroAttrs(url){
    return url ? `class="hero" style="--bg:url('${esc(url)}')"` : 'class="hero sin-foto"';
  }
  function heroZoom(url){ return url ? `<span class="zoom-hint">${ICON_ZOOM}</span>` : ''; }
  // Al cambiar Blanco/Negro, el fondo difuminado sigue a la foto visible
  function actualizarFondoHero(hero){
    if(!hero) return;
    const img = hero.querySelector('img:not(.off)');
    if(img) hero.style.setProperty('--bg', `url('${img.getAttribute('src')}')`);
  }
  let visor = null;
  function verFoto(src){
    if(!visor){
      visor = document.createElement('div');
      visor.className = 'visor';
      visor.innerHTML = `<div class="visor-scroll"><img alt=""></div>
        <button class="visor-x" aria-label="Cerrar foto"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <div class="visor-ayuda">Toca la foto para acercar</div>`;
      document.body.appendChild(visor);
      visor.querySelector('.visor-x').addEventListener('click', ()=>{
        if(!visor.classList.contains('open')) return;
        cerrarVisorInterno();
        marcarMuerta(c => c.visor);
      });
      visor.querySelector('img').addEventListener('click', (e)=>{
        const sc = visor.querySelector('.visor-scroll');
        const r = e.target.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        const acercar = !visor.classList.contains('zoom');
        visor.classList.toggle('zoom', acercar);
        visor.querySelector('.visor-ayuda').textContent = acercar ? 'Toca de nuevo para alejar' : 'Toca la foto para acercar';
        if(acercar){
          requestAnimationFrame(()=>{
            const im = e.target;
            sc.scrollLeft = fx * im.offsetWidth - sc.clientWidth / 2;
            sc.scrollTop = fy * im.offsetHeight - sc.clientHeight / 2;
          });
        }
      });
    }
    visor.querySelector('img').src = src;
    visor.classList.remove('zoom');
    visor.querySelector('.visor-ayuda').textContent = 'Toca la foto para acercar';
    if(!visor.classList.contains('open')) empujarCapa({ visor:true });
    requestAnimationFrame(()=> visor.classList.add('open'));
  }
  function cerrarVisorInterno(){ if(visor) visor.classList.remove('open', 'zoom'); }
  document.addEventListener('click', (e)=>{
    const img = e.target.closest('.hero img');
    if(img && !img.classList.contains('off')) verFoto(img.getAttribute('src'));
  });

  window.AH = {
    heroAttrs, heroZoom, actualizarFondoHero, verFoto,
    TIPOS, TIPO_INFO, iconoTipo, acabados, tieneColores, ESQUEMA, SW_COLOR, esquema, grupoActivo, avisoFotoProteccion,
    especificacionesDesdeEstado, estadoDesdeEspecificaciones, resumenSpecs, medidas,
    fotoModelo, fotoPieza, fotoItem, etiquetaOtroColor, sabados, sabadoCorto, topeTexto, esc, numOrNull, montoOrNull, fmt, dinero, specChipsHtml, toast,
    abrirHoja, cerrarHoja, hojaAbierta, alCerrar, antesDeCerrar, clavesGrupo,
    profundidad: prof, vistaInterna
  };
})();
