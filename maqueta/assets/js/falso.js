// MAQUETA: reemplaza a Supabase con datos de ejemplo guardados en este teléfono.
// La app es la misma; solo cambia de dónde salen los datos. Nada toca la base real.
// Precios de materiales y cálculo del costeo: Memoria central de Ray.
// Cantidades, ventas, saldos de cuentas y de proveedores: EJEMPLO (Ray los llenará).
// window.MAQUETA hace de "servidor": las reglas de dinero viven aquí, como en las funciones de la base.
// SEGURIDAD: en la dirección de la app publicada (github.io) no corre, porque guardaría una sesión
// falsa encima de la sesión real del teléfono. La maqueta se abre solo en local o en el enlace de Claude.
if(/github\.io$/i.test(location.hostname)){
  document.documentElement.innerHTML = '<body style="font:16px -apple-system,sans-serif;padding:24px">Esta es la maqueta. No se abre en la app publicada.</body>';
  throw new Error('Maqueta bloqueada en la app publicada');
}
(function(){
  'use strict';
  const REF = 'vmrxfpgotbmmjxzizsuq';
  const KEY = 'maqueta_artesanos_v3';
  const FOTO = 'assets/img/foto-puerta.png';
  const ahora = () => new Date().toISOString();
  const hace = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const dia = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso).slice(0, 10) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const lunes = (ms) => { const t = new Date(ms); t.setHours(0,0,0,0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0,10); };
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const PERF = {
    ray:{ id:'ray', usuario:'ray', nombre:'Ray', rol:'admin', activo:true, confirma_abonos:true, lleva_madera:false, linea:'hierro', especialidades:[], sede_id:1, orden:1 },
    gualfredo:{ id:'gualfredo', usuario:'gualfredo', nombre:'Gualfredo', rol:'admin', activo:true, confirma_abonos:false, lleva_madera:true, linea:'hierro', especialidades:[], sede_id:1, orden:2 },
    yulimar:{ id:'yulimar', usuario:'yulimar', nombre:'Yulimar', rol:'vendedor', activo:true, confirma_abonos:false, lleva_madera:false, linea:'hierro', especialidades:[], sede_id:1, orden:3 },
    jesus:{ id:'jesus', usuario:'jesus', nombre:'Jesus', rol:'trabajador', activo:true, especialidades:['herrero'], orden:4 },
    luis:{ id:'luis', usuario:'luispaz', nombre:'Luis Paz', rol:'trabajador', activo:true, especialidades:['masilla_pintura'], orden:5 },
  };

  // Catálogo real (nombres, tipos y precios de la base). Fotos de ejemplo.
  const CAT = [
    [93,'Combo','Combo Modelo Lineal',500],[83,'Combo','Combo #2',550],[112,'Combo','Combo #1',580],[28,'Combo','Puerta Proteccion',630],[129,'Combo','Puerta Protección 2',680],
    [148,'Puerta de Madera','Vinil Beige',115],[128,'Puerta de Madera','Vinil Negra',135],[147,'Puerta de Madera','Vinil Negro Mate',135],[123,'Puerta de Madera','Vinil Gris',135],[126,'Puerta de Madera','Vinil Negra Rayas',145],[122,'Puerta de Madera','Americana',165],
    [4,'Puerta Multilock','Lineal Economico',200],[97,'Puerta Multilock','Modelo Escalera',220],[29,'Puerta Multilock','Modelo 5 Lineas',240],[137,'Puerta Multilock','Modelo 4 vidrio',240],[118,'Puerta Multilock','Modelo Lineal 5 Vidrios',250],
    [136,'Puerta Multilock','Modelo L1',260],[21,'Puerta Multilock','Modelo Media Luna 4 Vidrios',260],[24,'Puerta Multilock','Modelo Arco 5 vidrios',260],[101,'Puerta Multilock','Modelo Bitralito',260],[131,'Puerta Multilock','Modelo 1 vidrio',260],
    [18,'Puerta Multilock','Modelo Taco Punto',260],[132,'Puerta Multilock','Modelo K',260],[134,'Puerta Multilock','Modelo Rayo',280],[25,'Puerta Multilock','Modelo Arco de cuadros',280],[26,'Puerta Multilock','Modelo Arco 3 vidrios',280],
    [113,'Puerta Multilock','Modelo Media Luna 5 Vidrios',280],[133,'Puerta Multilock','Modelo B',280],[145,'Puerta Multilock','Modelo farquilla',280],[19,'Puerta Multilock','Modelo Estrambotico 6 Vidrios',300],[7,'Puerta Multilock','Modelo bitral',320],
    [110,'Puerta Multilock','Modelo Luis',320],[45,'Puerta Multilock','Modelo Lineal Cuatro Vidrios',350],[144,'Puerta Multilock','Puerta Protección B',380],[143,'Puerta Multilock','Puerta Protección Bitralito',420],[142,'Puerta Multilock','Puerta protección lineal',420],
    [130,'Puerta Multilock','Modelo B con marco decorativo',430],[141,'Puerta Multilock','Puerta protección Rombo',440],[138,'Puerta Multilock','Media Luna',450],[12,'Puerta Multilock','Modelo Taco',450],[15,'Puerta Multilock','Modelo Estrambótica Con Yeso',450],
    [135,'Puerta Multilock','Modelo Arco grande',450],[108,'Puerta Multilock','Modelo Cuadro',480],[146,'Puerta Multilock','Modelo Luis 1 bital',580],[52,'Puerta Multilock','Modelo Villa con Bitral',650],[72,'Puerta Multilock','Santorini',650],
    [140,'Puerta Multilock','3L con yeso y farquilla',800],[139,'Puerta Multilock','3L con yeso',800],
  ];
  // Categorías de pago reales (tarifas de la base)
  const CATPAGO = [
    {id:1,nombre:'Ventana',producto:'Ventana',activo:true,tarifas:{armar:{modo:'fijo',monto:10},hierro:{modo:'m2',monto:10},detalles:{modo:'fijo',monto:3},masilla_pintura:{modo:'m2',monto:10}}},
    {id:2,nombre:'Puerta Sencilla',producto:'Puerta Multilock',activo:true,tarifas:{hierro:{modo:'fijo',monto:25,prot_modo:'fijo',prot_monto:25},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:25,prot_modo:'fijo',prot_monto:25}}},
    {id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',activo:true,tarifas:{hierro:{modo:'fijo',monto:30,prot_modo:'fijo',prot_monto:25},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:30,prot_modo:'fijo',prot_monto:25}}},
    {id:4,nombre:'Combo sencillo',producto:'Combo',activo:true,tarifas:{armar:{modo:'fijo',monto:20},hierro:{modo:'fijo',monto:45},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:45},detalles_ventana:{modo:'fijo',monto:3}}},
    {id:5,nombre:'Combo Estandar',producto:'Combo',activo:true,tarifas:{armar:{modo:'fijo',monto:20},hierro:{modo:'fijo',monto:50},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:50},detalles_ventana:{modo:'fijo',monto:3}}},
    {id:6,nombre:'Porton',producto:'Portón',activo:true,tarifas:{hierro:{modo:'m2',monto:25},detalles:{modo:'fijo',monto:20},masilla_pintura:{modo:'m2',monto:25}}},
  ];

  function inicial(){
    const catalogo = CAT.map(([id, tipo, nombre, precio]) => ({
      id, tipo, nombre, precio_base:precio, fotos: tipo === 'Puerta de Madera' ? { Principal:FOTO + '?' + id } : { Blanco:FOTO + '?b' + id, Negro:FOTO + '?' + id },
      especificaciones_base: tipo === 'Puerta de Madera' ? { alto:2, ancho:0.87 } : { alto:2, ancho:1, manillon: id === 7 },
      categoria_pago_id: id === 7 ? 3 : id === 4 ? 2 : null, badge:null, caracteristicas:[], descripcion_publica:null, creado_en:hace(30)
    }));
    const cli = { a:{id:1,nombre:'Cliente de ejemplo A',telefono:'0414 000 0001',cedula:'V-1',direccion:null}, b:{id:2,nombre:'Cliente de ejemplo B',telefono:'0414 000 0002',cedula:'V-2',direccion:null}, c:{id:3,nombre:'Cliente de ejemplo C',telefono:'0414 000 0003',cedula:'V-3',direccion:null} };
    const item = (vid, id, cant, precio) => ({ id:vid*10, venta_id:vid, catalogo_id:id, pieza_id:null, a_medida:false, tipo:'Puerta Multilock', nombre:CAT.find(c => c[0] === id)[2], especificaciones:{ color:'Negro', alto:2, ancho:1 }, foto:null, precio_unitario:precio, cantidad:cant, orden:0, categoria_pago_id:3, ya_hecho:false, catalogo:{ fotos:{ Blanco:FOTO, Negro:FOTO } } });
    const venta = (id, c, estado, total, items, abonos, dias) => ({ id, cliente_id:c.id, cliente:c, estado, sede_id:1, sede:{id:1,nombre:'Cumbres de Maracaibo'}, vendedor_id:'yulimar', descuento:0, instalacion:0, traslado:0, subtotal:total, total, notas:null,
      vence_en:dia(hace(-20)), fecha_entrega:dia(hace(-15)), confirmada_en: estado === 'cotizacion' ? null : hace(dias), cancelada_en:null, creado_en:hace(dias), actualizado_en:hace(dias), token_seguimiento:'demo'+id, interna:false,
      produccion_en: estado === 'en_produccion' ? hace(dias - 1) : null, lista_en:null, entregada_en: estado === 'entregada' ? hace(1) : null, mensaje_en:null, mensaje_estado:null, pdf_en:null, items, abonos, cambios:[] });
    const ab = (id, vid, monto, metodo, estado, dias, ubicado) => ({ id, venta_id:vid, tipo:'abono', monto, metodo, tasa:null, monto_bs:null, comprobante:'demo.jpg', nota:null, fecha:hace(dias), registrado_por:'yulimar', estado, confirmado_por: estado === 'confirmado' ? 'ray' : null, confirmado_en: estado === 'confirmado' ? hace(dias) : null, ubicado: ubicado || null });
    const ventas = [
      venta(1071, cli.b, 'confirmada', 640, [item(1071, 7, 2, 320)], [ab(9, 1071, 320, 'Zelle', 'por_confirmar', 0)], 0),
      venta(1066, cli.a, 'en_produccion', 320, [item(1066, 7, 1, 320)], [ab(8, 1066, 160, 'Zelle', 'confirmado', 3, null)], 4),
      venta(1060, cli.c, 'entregada', 480, [item(1060, 108, 1, 480)], [ab(6, 1060, 240, 'Zelle', 'confirmado', 9, { a:'cuenta', cuenta:'zr' }), ab(7, 1060, 240, 'Efectivo', 'confirmado', 1, null)], 10),
    ];
    return {
      catalogo, ventas, clientes:Object.values(cli),
      // ---------- Depósito: consumibles (los 18 reales; stock real, mínimos de ejemplo) ----------
      materiales:[
        {id:1,nombre:'Bisagras',stock:41,minimo:15,oficio:'hierro',activo:true,costo_unidad:1},
        {id:2,nombre:'Cerradura',stock:24,minimo:8,oficio:'hierro',activo:true,costo_unidad:15},
        {id:3,nombre:'Disco de corte 14"',stock:27,minimo:6,oficio:'hierro',activo:true,costo_unidad:6},
        {id:4,nombre:'Disco de corte 7"',stock:12,minimo:6,oficio:'hierro',activo:true,costo_unidad:1},
        {id:5,nombre:'Espejitos',stock:32,minimo:10,oficio:'hierro',activo:true,costo_unidad:null},
        {id:6,nombre:'Soldadura',stock:40,minimo:10,oficio:'hierro',activo:true,costo_unidad:null},
        {id:7,nombre:'Disco de cartón',stock:15,minimo:6,oficio:'masilla',activo:true,costo_unidad:1},
        {id:8,nombre:'Disco de esmerilar 4"',stock:14,minimo:4,oficio:'masilla',activo:true,costo_unidad:null},
        {id:9,nombre:'Disco flap',stock:12,minimo:4,oficio:'masilla',activo:true,costo_unidad:1},
        {id:10,nombre:'Fondo',stock:7,minimo:4,oficio:'masilla',activo:true,costo_unidad:20},
        {id:11,nombre:'Lija 40',stock:32,minimo:10,oficio:'masilla',activo:true,costo_unidad:4},
        {id:12,nombre:'Lija 80',stock:20,minimo:10,oficio:'masilla',activo:true,costo_unidad:1},
        {id:13,nombre:'Lija 150',stock:15,minimo:6,oficio:'masilla',activo:true,costo_unidad:null},
        {id:14,nombre:'Masilla',stock:6,minimo:4,oficio:'masilla',activo:true,costo_unidad:25},
        {id:15,nombre:'Tinner',stock:11,minimo:6,oficio:'masilla',activo:true,costo_unidad:10},
        {id:16,nombre:'Pintura blanca',stock:9,minimo:4,oficio:'masilla',activo:true,costo_unidad:null},
        {id:17,nombre:'Manillon Mediano',stock:2,minimo:3,oficio:'detalles',activo:true,costo_unidad:20},
        {id:18,nombre:'Silicon',stock:4,minimo:5,oficio:'detalles',activo:true,costo_unidad:null},
      ],
      entregas:[
        {id:3,material_id:11,trabajador_id:'luis',trabajador:'Luis Paz',entregado_por:'Yulimar',fecha:hace(1),semana:lunes(Date.now()),nota:null,estado:'por_revisar',rara:false,trabajos:2,abierta:true},
        {id:2,material_id:3,trabajador_id:'jesus',trabajador:'Jesus',entregado_por:'Yulimar',fecha:hace(2),semana:lunes(Date.now()),nota:null,estado:'por_revisar',rara:false,trabajos:3,abierta:true},
        {id:1,material_id:3,trabajador_id:'jesus',trabajador:'Jesus',entregado_por:'Ray',fecha:hace(9),semana:lunes(Date.now()-9*864e5),nota:null,estado:'aprobada',revisado_por:'Ray',revisado_en:hace(8),rara:false,trabajos:6,abierta:false},
      ],
      compras:[{id:1,material_id:11,cantidad:20,costo:80,nota:'Ferretería',fecha:hace(12),por:'Ray'}],
      trabajadores:[{id:'jesus',nombre:'Jesus',especialidades:['herrero'],pendientes:[{oficio:'hierro',especialidad:'herrero',n:3}]},{id:'luis',nombre:'Luis Paz',especialidades:['masilla_pintura'],pendientes:[{oficio:'masilla_pintura',especialidad:'masilla_pintura',n:2}]}],

      // ---------- Proveedores: cada uno con los tipos que vende y si cobra IVA ----------
      proveedores:[
        {id:'cya',nombre:'Colores y Ambiente',rif:'',telefono:'',tipos:['hierro','laminas'],iva:true,principal:true,nota:'Da factura'},
        {id:'tor',nombre:'Inversiones Torniplemaca',rif:'J-40218850-1',telefono:'',tipos:['hierro','laminas'],iva:false,principal:false,nota:'Da nota de entrega'},
        {id:'otro',nombre:'Sin factura (ferretería y otros)',rif:'',telefono:'',tipos:['vidrio','pintura','consumibles','accesorios'],iva:false,principal:false,nota:'Precios dados por Ray'},
      ],
      // ---------- Material de fabricación ----------
      fab:[
        {id:'t1x3',nombre:'Tubo 1" x 3"',tipo:'hierro',pres:'barra',largo:600,stock:1,retazos:[],precios:{cya:{p:12.98,esp:'0,90 mm'}}},
        {id:'t1x2',nombre:'Tubo 1" x 2"',tipo:'hierro',pres:'barra',largo:600,stock:3,retazos:[120],precios:{cya:{p:9.69,esp:'0,90 mm'},tor:{p:9.50,esp:'0,80 mm'}}},
        {id:'t1x1',nombre:'Tubo 1" x 1"',tipo:'hierro',pres:'barra',largo:600,stock:5,retazos:[],precios:{cya:{p:6.43,esp:'0,90 mm'},tor:{p:6.50,esp:'0,80 mm'}}},
        {id:'t12',nombre:'Tubo 1/2" x 1/2" 0,70',tipo:'hierro',pres:'barra',largo:600,stock:2,retazos:[210],precios:{cya:{p:2.66,esp:'0,70 mm'}}},
        {id:'pl12',nombre:'Platina 1/2" x 2 mm',tipo:'hierro',pres:'barra',largo:600,stock:4,retazos:[],precios:{cya:{p:2.19,esp:'2 mm'}}},
        {id:'pl1',nombre:'Platina 1" x 1/8"',tipo:'hierro',pres:'barra',largo:600,stock:3,retazos:[],precios:{cya:{p:6.51},tor:{p:6.50}}},
        {id:'m10',nombre:'Marco de puerta 10',tipo:'hierro',pres:'barra',largo:510,stock:1,retazos:[],precios:{cya:{p:12.28,esp:'0,70 mm'},tor:{p:13.00,esp:'0,70 mm'}},fijo:12.28},
        {id:'m15',nombre:'Marco de puerta 15',tipo:'hierro',pres:'barra',largo:510,stock:2,retazos:[],precios:{cya:{p:15.07},tor:{p:15.50}}},
        {id:'lam14',nombre:'Lámina pulida C/14',tipo:'laminas',pres:'hoja',hoja:[122,244],stock:1,precios:{cya:{p:61.05}}},
        {id:'lam16',nombre:'Lámina calibre 16',tipo:'laminas',pres:'hoja',hoja:[122,244],stock:2,precios:{cya:{p:49.66},tor:{p:52.00}}},
        {id:'vid5',nombre:'Vidrio 5 mm',tipo:'vidrio',pres:'hoja',hoja:[330,244],stock:0,precios:{otro:{p:100}}},
      ],
      // Insumos para costear (Memoria central): precio sin IVA y rendimiento general (puertas por unidad)
      insumos:[
        {id:'fondo',nombre:'Fondo anticorrosivo',grupo:'Pintura y masilla',p:20},{id:'esmalte',nombre:'Esmalte',grupo:'Pintura y masilla',p:22},
        {id:'masilla',nombre:'Masilla',grupo:'Pintura y masilla',p:25},{id:'thinner',nombre:'Thinner',grupo:'Pintura y masilla',p:10,r:2},
        {id:'electrodo',nombre:'Electrodos (kg)',grupo:'Consumibles',p:3,r:2},{id:'d14',nombre:'Disco de corte 14"',grupo:'Consumibles',p:6,r:3},
        {id:'d7',nombre:'Disco de corte 7"',grupo:'Consumibles',p:1,r:1},{id:'flap',nombre:'Disco flap',grupo:'Consumibles',p:1,r:4},
        {id:'carton',nombre:'Disco de cartón',grupo:'Consumibles',p:1,r:4},{id:'l40',nombre:'Lija 40',grupo:'Consumibles',p:4,r:1},
        {id:'l80',nombre:'Lija 80',grupo:'Consumibles',p:1,r:0.5},{id:'l100',nombre:'Lija 100',grupo:'Consumibles',p:1,r:1},{id:'l120',nombre:'Lija 120',grupo:'Consumibles',p:1,r:1},
        {id:'bisagra',nombre:'Bisagra',grupo:'Accesorios',p:1},{id:'cerradura',nombre:'Cerradura multilock',grupo:'Accesorios',p:15},{id:'manillon',nombre:'Manillón inox 30 cm',grupo:'Accesorios',p:20},
      ],
      reglas:{ iva:16, ganancia:30, gastosMes:915, puertasMes:25, bisagras:3, corte:0 },
      // Costeo del Bitral (catálogo id 7) = Vitral M-01 de la Memoria central
      costeo:{
        7:{ codigo:'M-01', estado:'listo', piezas:[['t1x3',2,200,'Bastidor largo'],['t1x3',2,88,'Bastidor ancho'],['m10',1,500,'Marco'],['t1x2',1,194,'Divisor vertical'],['pl12',1,600,'Ranuras, frente'],['t12',1,600,'Ranuras, atrás'],['t12',1,390,'Vitral largo']],
            hojas:[['lam14',1,61.5,179,'Panel'],['vid5',1,184,10,'Franja de vidrio'],['vid5',5,50,4,'Ranuras de vidrio']],
            rend:{fondo:3,esmalte:3,masilla:3,thinner:3,d7:3,carton:3}, acc:{bisagra:3,cerradura:1,manillon:1}, extras:[] }
      },
      enDiseno:[],
      cortes:{ 'Modelo bitral':[['t1x3',2,200],['t1x3',2,88],['m10',1,500],['t1x2',1,194],['pl12',1,600],['t12',1,600],['t12',1,390]] },
      enFabricacion:[{venta:1066,cliente:'Cliente de ejemplo A',producto:'Modelo bitral',cantidad:1}],
      movsFab:[{id:'t1x3',t:'Compra',n:2,fecha:hace(10),por:'Ray'},{id:'t1x3',t:'Corte',n:-1,fecha:hace(5),por:'Jesus'}],
      conteo:null, cortado:false,
      // ---------- Compras (facturas y notas) ----------
      facturas:[{id:1,prov:'tor',doc:'nota',numero:'00-2884',fecha:'2026-10-31',subtotal:1674.50,iva:0,total:1674.50,foto:false,lineas:12,nota:'Nota de entrega real de Torniplemaca'}],
      // ---------- Cuentas y libreta de movimientos (saldos de EJEMPLO: los llena Ray) ----------
      cuentas:[
        {id:'zr',nombre:'Zelle de Ray',tipo:'Zelle',moneda:'USD',orden:1},
        {id:'zg',nombre:'Zelle de Gualfredo',tipo:'Zelle',moneda:'USD',orden:2},
        {id:'bin',nombre:'Binance',tipo:'Binance',moneda:'USD',orden:3},
        {id:'efc',nombre:'Efectivo Cumbres',tipo:'Efectivo',moneda:'USD',orden:4},
        {id:'efu',nombre:'Efectivo Av. Universidad',tipo:'Efectivo',moneda:'USD',orden:5},
        {id:'bs',nombre:'Bolívares',tipo:'Bolívares',moneda:'VES',orden:6},
      ],
      movs:[
        {id:1,fecha:'2026-10-29',tipo:'apertura',cuenta:'zr',ec:3250,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:2,fecha:'2026-10-29',tipo:'apertura',cuenta:'zg',ec:600,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:3,fecha:'2026-10-29',tipo:'apertura',cuenta:'bin',ec:410,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:4,fecha:'2026-10-29',tipo:'apertura',cuenta:'efc',ec:530,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:5,fecha:'2026-10-29',tipo:'apertura',cuenta:'efu',ec:240,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:6,fecha:'2026-10-29',tipo:'apertura',cuenta:'bs',ec:120,bs:4320,tasa:36,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:7,fecha:'2026-10-29',tipo:'apertura',prov:'tor',ep:0,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:8,fecha:'2026-10-29',tipo:'apertura',prov:'cya',ep:0,nota:'Saldo inicial (lo llena Ray)',por:'Ray'},
        {id:9,fecha:'2026-10-30',tipo:'transferencia',cuenta:'zr',ec:-2000,prov:'tor',ep:2000,ref:'Zelle 8841',nota:'Anticipo de ejemplo',por:'Ray'},
        {id:10,fecha:'2026-10-31',tipo:'compra',prov:'tor',ep:-1674.50,factura:1,ref:'Nota 00-2884',por:'Gualfredo'},
        {id:11,fecha:dia(hace(9)),tipo:'ubicar',cuenta:'zr',ec:240,abono:6,ref:'Pago N° 1060',nota:'Quedó en la cuenta',por:'Ray'},
        {id:12,fecha:dia(hace(1)),tipo:'gasto',cuenta:'zr',ec:-800,cat:'Alquiler',ref:'Alquiler noviembre',por:'Ray'},
      ],
      gastosFijos:[{cat:'Alquiler',monto:800},{cat:'Electricidad',monto:60},{cat:'Internet',monto:30},{cat:'Teléfono',monto:5},{cat:'Transporte',monto:20}],
    };
  }
  let D;
  try{ D = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ D = null; }
  if(!D || !D.movs) D = inicial();
  const guardar = () => { try{ localStorage.setItem(KEY, JSON.stringify(D)); } catch(e){} };
  let sig = Date.now();
  const nuevoId = () => ++sig;

  // ---------- Reglas del "servidor" ----------
  const vivos = () => D.movs.filter(m => !m.anulado);
  const saldoCuenta = (id) => r2(vivos().filter(m => m.cuenta === id).reduce((a, m) => a + (m.ec || 0), 0));
  const saldoBs = (id) => r2(vivos().filter(m => m.cuenta === id).reduce((a, m) => a + (m.bs ? Math.sign(m.ec || 0) * m.bs : 0), 0));
  const saldoProv = (id) => r2(vivos().filter(m => m.prov === id).reduce((a, m) => a + (m.ep || 0), 0));
  function libreta(filtro, campo){
    let s = 0;
    return D.movs.filter(filtro).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id)).map(m => { if(!m.anulado) s = r2(s + (m[campo] || 0)); return Object.assign({}, m, { saldo:s }); });
  }
  const pagado = (v) => r2((v.abonos || []).filter(a => a.estado === 'confirmado').reduce((x, a) => x + (a.tipo === 'devolucion' ? -1 : 1) * a.monto, 0));
  const porUbicar = () => D.ventas.flatMap(v => v.abonos.filter(a => a.estado === 'confirmado' && !a.ubicado).map(a => Object.assign({}, a, { cliente:v.cliente.nombre })));
  const porCobrar = () => D.ventas.filter(v => ['confirmada','en_produccion','lista'].includes(v.estado)).map(v => ({ id:v.id, cliente:v.cliente.nombre, estado:v.estado, total:v.total, pagado:pagado(v), resta:r2(v.total - pagado(v)) })).filter(x => x.resta > 0.005);
  const mov = (m) => { const x = Object.assign({ id:nuevoId(), fecha:dia(ahora()), por:'Ray' }, m); D.movs.push(x); return x; };

  const API = {
    datos:()=>D, guardar,
    reiniciar(){ try{ localStorage.removeItem(KEY); } catch(e){} D = inicial(); },
    r2, saldoCuenta, saldoBs, saldoProv, porUbicar, porCobrar, pagado,
    movsCuenta:(id) => libreta(m => m.cuenta === id, 'ec'),
    movsProv:(id) => libreta(m => m.prov === id, 'ep'),
    resumen(){
      const enCuentas = r2(D.cuentas.reduce((a, c) => a + saldoCuenta(c.id), 0));
      const ub = r2(porUbicar().reduce((a, x) => a + x.monto, 0));
      const provs = D.proveedores.map(p => saldoProv(p.id));
      const aFavor = r2(provs.filter(x => x > 0).reduce((a, x) => a + x, 0));
      const debes = r2(-provs.filter(x => x < 0).reduce((a, x) => a + x, 0));
      const cobrar = r2(porCobrar().reduce((a, x) => a + x.resta, 0));
      return { enCuentas, porUbicar:ub, aFavor, debes, porCobrar:cobrar, total:r2(enCuentas + ub + aFavor + cobrar - debes) };
    },
    // Ray dice dónde quedó un pago ya confirmado
    ubicar(abonoId, o){
      const v = D.ventas.find(x => x.abonos.some(a => a.id === abonoId)); const a = v.abonos.find(x => x.id === abonoId);
      const ref = 'Pago N° ' + v.id;
      if(o.destino === 'cuenta'){ mov({ tipo:'ubicar', cuenta:o.cuenta, ec:a.monto, abono:a.id, ref, nota:'Quedó en la cuenta' }); }
      else { mov({ tipo:'ubicar', prov:o.prov, ep:a.monto, abono:a.id, ref, nota:'Se transfirió directo al proveedor' }); }
      a.ubicado = { a:o.destino, cuenta:o.cuenta || null, prov:o.prov || null }; guardar();
    },
    transferir(o){ mov({ tipo:'transferencia', cuenta:o.cuenta, ec:-o.monto, bs:o.bs || null, tasa:o.tasa || null, prov:o.prov, ep:o.monto, ref:o.ref || null, nota:o.nota || null, fecha:o.fecha || dia(ahora()) }); guardar(); },
    traspaso(o){ const g = nuevoId(); mov({ tipo:'traspaso', cuenta:o.de, ec:-o.monto, grupo:g, ref:'A ' + (D.cuentas.find(c => c.id === o.a) || {}).nombre }); mov({ tipo:'traspaso', cuenta:o.a, ec:o.monto, grupo:g, ref:'De ' + (D.cuentas.find(c => c.id === o.de) || {}).nombre }); guardar(); },
    // Ray corrige un saldo: queda en el historial como ajuste con su motivo
    ajustar(o){
      const actual = o.cuenta ? saldoCuenta(o.cuenta) : saldoProv(o.prov); const dif = r2(o.nuevo - actual);
      if(Math.abs(dif) < 0.005) return 0;
      mov(Object.assign({ tipo:'ajuste', nota:o.motivo, ref:'Ajuste de saldo' }, o.cuenta ? { cuenta:o.cuenta, ec:dif } : { prov:o.prov, ep:dif })); guardar(); return dif;
    },
    anular(id, motivo){ const m = D.movs.find(x => x.id === id); m.anulado = { motivo, por:'Ray', fecha:dia(ahora()) }; guardar(); },
    gasto(o){ mov({ tipo:'gasto', cuenta:o.cuenta, ec:-o.monto, cat:o.cat, ref:o.ref || o.cat, nota:o.nota || null }); guardar(); },
    compra(o){
      const f = Object.assign({ id:nuevoId() }, o); D.facturas.unshift(f);
      mov({ tipo:'compra', prov:o.prov, ep:-o.total, factura:f.id, ref:(o.doc === 'factura' ? 'Factura ' : 'Nota ') + (o.numero || ''), fecha:o.fecha });
      guardar(); return f;
    },
    proveedorGuardar(p){ const x = D.proveedores.find(y => y.id === p.id); if(x) Object.assign(x, p); else { p.id = 'p' + nuevoId(); D.proveedores.push(p); mov({ tipo:'apertura', prov:p.id, ep:0, nota:'Saldo inicial' }); } guardar(); return p; },
  };
  // ---------- Costeo (misma fórmula del Costeador de Ray) ----------
  function empacar(piezas, largo, corte){
    const L = piezas.slice().sort((a, b) => b.cm - a.cm), barras = [];
    for(const p of L){ if(p.cm > largo){ barras.push({ piezas:[p], libre:0, larga:true }); continue; }
      let b = barras.find(x => !x.larga && x.libre + 1e-9 >= p.cm); if(!b){ b = { piezas:[], libre:largo }; barras.push(b); } b.piezas.push(p); b.libre = Math.max(0, b.libre - p.cm - (corte || 0)); }
    return barras;
  }
  const PROV_N = (id) => (D.proveedores.find(p => p.id === id) || {}).nombre || id;
  function precioFab(f, prov){
    const usar = (k) => ({ p:(k === 'cya' && f.fijo) ? f.fijo : f.precios[k].p, de:k, esp:f.precios[k].esp });
    if(f.precios[prov]) return usar(prov);
    for(const k of ['cya','tor','otro']) if(f.precios[k]) return usar(k);
    return { p:0, de:null };
  }
  function costear(id, o){
    o = o || {}; const prov = o.prov || 'cya', modo = o.modo || 'metro';
    const c = D.costeo[id]; const m = D.catalogo.find(x => x.id === id) || (D.enDiseno.find(x => x.id === id) || {});
    if(!c) return null;
    const R = D.reglas, iva = 1 + R.iva / 100, lineas = [], avisos = new Set(), falta = [];
    const add = (g, n, det, v) => lineas.push({ g, n, det, v });
    const porMat = {};
    for(const [mid, cant, cm, nota] of c.piezas) for(let i = 0; i < cant; i++) (porMat[mid] ||= []).push({ cm, nota });
    const grupos = [];
    for(const [mid, piezas] of Object.entries(porMat)){
      const f = D.fab.find(x => x.id === mid), pr = precioFab(f, prov), barra = pr.p * iva, porM = barra / (f.largo / 100);
      if(pr.de && pr.de !== prov) avisos.add(PROV_N(prov) + ' no vende ' + f.nombre + ': se usó el precio de ' + PROV_N(pr.de));
      const cm = piezas.reduce((a, x) => a + x.cm, 0), barras = empacar(piezas, f.largo, R.corte);
      const v = modo === 'tubo' ? barras.length * barra : cm / 100 * porM;
      add('Hierro', f.nombre, modo === 'tubo' ? barras.length + (barras.length === 1 ? ' barra' : ' barras') : (cm / 100).toLocaleString('es-VE', { minimumFractionDigits:2 }) + ' m', v);
      grupos.push({ id:mid, nombre:f.nombre, cm, barras, largo:f.largo, piezas, v, porM, fijo:!!f.fijo && pr.de === 'cya' });
    }
    for(const [mid, cant, a, h, nota] of c.hojas){
      const f = D.fab.find(x => x.id === mid), pr = precioFab(f, prov);
      if(pr.de && pr.de !== prov && pr.de !== 'otro') avisos.add(PROV_N(prov) + ' no vende ' + f.nombre + ': se usó el precio de ' + PROV_N(pr.de));
      const m2 = cant * a * h / 10000, hm2 = f.hoja[0] * f.hoja[1] / 10000;
      add(f.tipo === 'vidrio' ? 'Vidrio' : 'Lámina', f.nombre, m2.toLocaleString('es-VE', { maximumFractionDigits:3 }) + ' m² (' + Math.round(m2 / hm2 * 100) + ' % de la hoja) · ' + nota, m2 * pr.p * iva / hm2);
    }
    for(const it of D.insumos){
      if(it.grupo === 'Accesorios') continue;
      const r = (c.rend || {})[it.id] || it.r;
      if(!r){ if(it.grupo === 'Pintura y masilla') falta.push(it.nombre); continue; }
      add(it.grupo, it.nombre, r >= 1 ? '1 rinde ' + r + (r === 1 ? ' puerta' : ' puertas') : Math.round(1 / r) + ' por puerta', it.p * iva / r);
    }
    for(const [k, q] of Object.entries(c.acc || {})){ const it = D.insumos.find(x => x.id === k); add('Accesorios', it.nombre, q + ' × $' + r2(it.p * iva).toFixed(2), q * it.p * iva); }
    const cat = CATPAGO.find(x => x.id === m.categoria_pago_id);
    if(cat){ const t = cat.tarifas; [['Hierro','hierro'],['Masilla y pintura','masilla_pintura'],['Detalles','detalles']].forEach(([n, k]) => { if(t[k]) add('Mano de obra', n, cat.nombre, t[k].monto); }); }
    else falta.push('categoría de pago');
    const costo = lineas.reduce((a, l) => a + l.v, 0), venta = costo * (1 + R.ganancia / 100), fijos = R.gastosMes / R.puertasMes, final = venta + fijos;
    const hoy = m.precio_base || 0, ganancia = hoy - fijos - costo, pct = costo ? ganancia / costo * 100 : 0;
    const extras = (c.extras || []).map(e => ({ n:e.n, costo:e.v, venta:e.v * (1 + R.ganancia / 100) }));
    return { lineas, grupos, avisos:[...avisos], falta, costo, venta, fijos, final, hoy, ganancia, pct, cat, c, m, extras };
  }
  // Duplicar un modelo costeado: queda "en diseño" hasta que Ray lo pase al catálogo
  API.duplicar = (id) => {
    const o = D.costeo[id], m = D.catalogo.find(x => x.id === id) || D.enDiseno.find(x => x.id === id);
    const n = Object.keys(D.costeo).length + 1, nid = 'd' + nuevoId();
    D.enDiseno.push({ id:nid, nombre:m.nombre + ' (copia)', tipo:m.tipo, precio_base:0, categoria_pago_id:m.categoria_pago_id, fotos:m.fotos, en_diseno:true });
    D.costeo[nid] = JSON.parse(JSON.stringify(Object.assign({}, o, { codigo:'M-' + String(n).padStart(2, '0'), estado:'diseno' }))); guardar(); return nid;
  };
  // Empezar el costeo de un modelo del catálogo copiando las piezas de otro
  API.costeoDesde = (id, base) => { const n = Object.keys(D.costeo).length + 1; D.costeo[id] = JSON.parse(JSON.stringify(Object.assign({}, D.costeo[base], { codigo:'M-' + String(n).padStart(2, '0'), estado:'borrador' }))); guardar(); };
  API.pasarAlCatalogo = (id, precio) => {
    const m = D.enDiseno.find(x => x.id === id);
    if(m){ D.enDiseno = D.enDiseno.filter(x => x !== m); const nid = 900 + D.enDiseno.length + Object.keys(D.costeo).length; const c = D.costeo[id]; delete D.costeo[id];
      D.catalogo.push(Object.assign({}, m, { id:nid, precio_base:precio, en_diseno:false, especificaciones_base:{ alto:2, ancho:1 }, badge:'Nuevo', caracteristicas:[], descripcion_publica:null, creado_en:ahora() })); c.estado = 'listo'; D.costeo[nid] = c; guardar(); return nid; }
    const x = D.catalogo.find(y => y.id === id); x.precio_base = precio; D.costeo[id].estado = 'listo'; guardar(); return id;
  };
  // Confirmar un pago (la misma regla de la función confirmar_abono de hoy). Si "llegó" y se dice
  // dónde quedó, en el mismo paso queda ubicado. Si no se dice, queda "por ubicar".
  API.confirmar = (a) => {
    const v = D.ventas.find(x => x.abonos.some(y => y.id === a.aid)); const ab = v.abonos.find(y => y.id === a.aid);
    ab.estado = a.llego ? 'confirmado' : 'rechazado'; ab.confirmado_por = 'ray'; ab.confirmado_en = ahora(); ab.nota_confirmacion = a.nota || null;
    let produccion = false;
    if(a.llego && v.estado === 'confirmada' && pagado(v) >= v.total * 0.5 - 0.005){ v.estado = 'en_produccion'; v.produccion_en = ahora(); produccion = true;
      v.items.forEach(it => D.enFabricacion.push({ venta:v.id, cliente:v.cliente.nombre, producto:it.nombre, cantidad:it.cantidad })); }
    guardar();
    if(a.llego && a.destino) API.ubicar(a.aid, { destino:a.destino, cuenta:a.cuenta, prov:a.prov });
    return { id:a.aid, produccion };
  };
  API.porConfirmar = () => D.ventas.flatMap(v => v.abonos.filter(x => x.estado === 'por_confirmar' && x.tipo === 'abono').map(x => Object.assign({}, x, { cliente:v.cliente.nombre, total:v.total, pagado:pagado(v), estadoVenta:v.estado })));
  API.costear = costear; API.empacar = empacar; API.precioFab = precioFab; API.CATPAGO = CATPAGO;
  API.semaforo = (x) => !x ? ['gris','Sin costear'] : x.falta.length ? ['gris','Faltan datos'] : x.pct >= 30 ? ['verde','Gana ' + Math.round(x.pct) + ' %'] : x.pct >= 15 ? ['amar','Gana ' + Math.round(x.pct) + ' %'] : x.pct >= 0 ? ['rojo','Gana ' + Math.round(x.pct) + ' %'] : ['negro','Pierde'];
  window.MAQUETA = API;

  // ---------- Sesión de Ray ya abierta (no pide PIN) ----------
  const user = { id:'ray', aud:'authenticated', role:'authenticated', email:'ray@artesanos.app', user_metadata:{ nombre:'Ray', rol:'admin' } };
  const sesion = { access_token:'maqueta.'+btoa('{"sub":"ray"}')+'.x', token_type:'bearer', expires_in:315360000, expires_at:Math.floor(Date.now()/1000)+315360000, refresh_token:'maqueta', user };
  try{ localStorage.setItem('sb-'+REF+'-auth-token', JSON.stringify(sesion)); } catch(e){}

  const json = (x) => new Response(JSON.stringify(x), { status:200, headers:{ 'content-type':'application/json', 'content-range':'0-'+(Array.isArray(x)?Math.max(0,x.length-1):0)+'/'+(Array.isArray(x)?x.length:1) } });
  const cuenta = (n) => new Response('', { status:200, headers:{ 'content-range':'*/'+n } });

  function rpc(nombre, a){
    if(nombre === 'deposito_resumen') return { materiales:D.materiales, entregas:D.entregas, compras:D.compras, trabajadores:D.trabajadores, es_admin:true, es_ray:true };
    if(nombre === 'deposito_entregar'){ const m = D.materiales.find(x => x.id === a.mid); m.stock--; const t = D.trabajadores.find(x => x.id === a.tid);
      D.entregas.unshift({ id:nuevoId(), material_id:a.mid, trabajador_id:a.tid, trabajador:t.nombre, entregado_por:'Ray', fecha:ahora(), semana:lunes(Date.now()), nota:a.nota, estado:'por_revisar', rara:false, trabajos:0, abierta:true }); guardar(); return { id:1, stock:m.stock, rara:false }; }
    if(nombre === 'deposito_revisar'){ const e = D.entregas.find(x => x.id === a.eid); e.estado = a.aprobar ? 'aprobada' : 'cuestionada'; e.revisado_por = 'Ray'; e.revisado_en = ahora(); e.revision_nota = a.nota; guardar(); return { id:a.eid }; }
    if(nombre === 'deposito_material_guardar'){ if(a.p.id) Object.assign(D.materiales.find(x => x.id === a.p.id), a.p); else D.materiales.push(Object.assign({ id:nuevoId(), stock:0, activo:true }, a.p)); guardar(); return { id:a.p.id || 1 }; }
    if(nombre === 'deposito_comprar'){ const m = D.materiales.find(x => x.id === a.mid); m.stock += a.cantidad; guardar(); return { id:a.mid, stock:m.stock }; }
    if(nombre === 'deposito_comprar_varios'){ a.items.forEach(x => { D.materiales.find(m => m.id === x.mid).stock += x.cantidad; }); guardar(); return { factura:1, materiales:a.items.length }; }
    if(nombre === 'confirmar_abono') return API.confirmar(a);
    if(nombre === 'avance_venta') return { pasos:[], productos:[] };
    if(nombre === 'pagado_venta') return 0;
    if(nombre === 'nomina_semana') return { trabajadores:[] };
    if(nombre === 'produccion_lectura') return { ventas:[], ordenes:[] };
    return [];
  }

  function filtrar(lista, params){
    let r = lista;
    for(const [k, v] of params.entries()){
      if(['select','order','limit','offset'].includes(k)) continue;
      const [op, val] = [v.split('.')[0], v.slice(v.indexOf('.') + 1)];
      if(op === 'eq') r = r.filter(x => String(x[k]) === val);
      else if(op === 'in') { const s = val.replace(/[()]/g, '').split(',').map(z => z.replace(/"/g, '')); r = r.filter(x => s.includes(String(x[k]))); }
      else if(op === 'is' && val === 'null') r = r.filter(x => x[k] == null);
      else if(op === 'gt') r = r.filter(x => Number(x[k]) > Number(val));
    }
    return r;
  }
  function tabla(t, params){
    if(t === 'perfiles'){ const id = params.get('id'); if(id && id.startsWith('eq.')) return [PERF[id.slice(3)]].filter(Boolean); return Object.values(PERF); }
    if(t === 'sedes') return [{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true},{id:2,nombre:'Avenida Universidad',orden:2,activa:true}];
    if(t === 'materiales') return D.materiales.filter(m => m.activo).map(m => ({ id:m.id, nombre:m.nombre, stock:m.stock, minimo:m.minimo }));
    if(t === 'catalogo') return filtrar(D.catalogo, params);
    if(t === 'categorias_pago') return CATPAGO;
    if(t === 'disponibles') return [];
    if(t === 'clientes') return D.clientes;
    if(t === 'ventas') return filtrar(D.ventas, params);
    if(t === 'abonos') return filtrar(D.ventas.flatMap(v => v.abonos), params);
    if(t === 'deposito_entregas') return D.entregas.filter(e => e.estado === 'por_revisar');
    return [];
  }

  const original = window.fetch.bind(window);
  window.fetch = async function(input, init){
    const url = typeof input === 'string' ? input : input.url;
    if(!url || url.indexOf('.supabase.co') < 0) return original(input, init);
    const u = new URL(url);
    const metodo = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    await new Promise(r => setTimeout(r, 100));
    if(u.pathname.startsWith('/auth/v1/token')) return json(sesion);
    if(u.pathname.startsWith('/auth/v1/user')) return json(user);
    if(u.pathname.startsWith('/auth/v1/logout')) return new Response('', { status:204 });
    if(u.pathname.startsWith('/rest/v1/rpc/')){
      let a = {}; try{ a = JSON.parse((init && init.body) || '{}'); } catch(e){}
      return json(rpc(u.pathname.split('/rpc/')[1], a));
    }
    if(u.pathname.startsWith('/rest/v1/')){
      const t = u.pathname.slice('/rest/v1/'.length);
      const r = tabla(t, u.searchParams);
      const hdrs = (init && init.headers) || {};
      const accept = hdrs instanceof Headers ? (hdrs.get('Accept') || '') : (hdrs.Accept || hdrs.accept || '');
      if(metodo === 'HEAD') return cuenta(r.length);
      if(metodo !== 'GET') return json(accept.indexOf('vnd.pgrst.object') >= 0 ? (r[0] || {}) : r);
      if(accept.indexOf('vnd.pgrst.object') >= 0) return json(r[0] || null);
      return json(r);
    }
    if(u.pathname.startsWith('/storage/')) return json({ Key:'maqueta', signedURL:'/' + FOTO, signedUrl:FOTO });
    if(u.pathname.startsWith('/functions/')) return json({ ok:true });
    return json([]);
  };
})();
