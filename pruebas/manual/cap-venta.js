// Capturas para el manual: Nueva cotización o venta
const {chromium,contexto,foto,H,FOTO,PNG}=require('./lib');
const fs=require('fs');
const OUT=__dirname+'/shots-venta/';fs.mkdirSync(OUT,{recursive:true});
const f=(p,n,m,o)=>foto(p,OUT,n,m,o);
const modelos=[
 {id:4,nombre:'Modelo Lineal Con Bitral',tipo:'Puerta Multilock',fotos:{Blanco:FOTO,Negro:FOTO},especificaciones_base:{alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,marco_decorativo:false,proteccion:false},precio_base:320,categoria_pago_id:1},
 {id:6,nombre:'Ventana Panorámica',tipo:'Ventana',fotos:{},especificaciones_base:{alto:1,ancho:1,papel_ahumado:true,color_ahumado:'Espejo',proteccion:false},precio_base:90,categoria_pago_id:1},
 {id:7,nombre:'Ventana con protección',tipo:'Ventana',fotos:{},especificaciones_base:{alto:1,ancho:1,papel_ahumado:false,proteccion:true},precio_base:190,categoria_pago_id:1},
 {id:8,nombre:'Combo #1',tipo:'Combo',fotos:{Negro:FOTO,Blanco:FOTO},especificaciones_base:{variante:'Sin protección en puerta',alto:2,ancho:1,ventanas_alto:1,ventanas_ancho:1},precio_base:580,categoria_pago_id:1},
];
const piezas=[{id:9,catalogo_id:4,cantidad:2,estado:'disponible',precio:300,sede_id:1,color:'Negro',especificaciones:{alto:2,ancho:1,sentido:'Derecha',posicion:'Afuera',bloque:'15'}}];
const venta={id:1047,estado:'confirmada',total:1030,subtotal:1030,descuento:0,instalacion:0,traslado:0,sede_id:1,vendedor_id:'u2',token_seguimiento:'5f0c2d7e-1a2b-4c3d-9e8f-0a1b2c3d4e5f',creado_en:new Date().toISOString(),confirmada_en:new Date().toISOString(),fecha_entrega:'2026-10-28',notas:null,
 cliente:{id:1,nombre:'María González',telefono:'584141234567',cedula:'V12345678'},sede:{id:1,nombre:'Cumbres de Maracaibo'},
 items:[{id:1,orden:0,nombre:'Modelo Lineal Con Bitral',tipo:'Puerta Multilock',color:'Negro',cantidad:1,precio_unitario:320,especificaciones:{alto:2,ancho:1},catalogo_id:4,catalogo:{fotos:{Negro:FOTO}}}],
 abonos:[{id:1,tipo:'abono',monto:515,metodo:'Zelle',estado:'por_confirmar',fecha:new Date().toISOString()}]};
let modoRpc='confirmada';
const rutas=(u,req,j)=>{
 if(u.includes('/rpc/crear_venta')){const P=JSON.parse(req.postData());return j({id:1047,estado:P.p.venta.confirmar?'confirmada':'cotizacion',total:2112,cliente_id:1});}
 if(u.includes('/storage/v1/object/'))return j({Key:'x.jpg'});
 if(u.includes('/clientes')){ if(/cedula=eq.V12345678(&|$)/.test(u))return j({id:1,nombre:'María González',telefono:'584141234567',cedula:'V12345678'}); return j(null); }
 if(u.includes('/catalogo'))return j(modelos);
 if(u.includes('/disponibles'))return j(piezas);
 if(u.includes('/ventas'))return j(venta);
};
(async()=>{ const b=await chromium.launch(); try{
 const p=await contexto(b,'vendedor',rutas);
 const w=ms=>p.waitForTimeout(ms||450);
 await f(p,'a1-nueva',[['#btnNuevaVenta','1']],{alto:330});
 await p.click('#btnNuevaVenta');await p.waitForURL('**/venta.html');await w(1000);
 await f(p,'a2-modo',[['#modoVenta','']],{alto:240,sinScroll:true});
 await p.fill('#cCedula','12.345.678');await w(1000);
 await f(p,'a3-cliente',[['#campoCed','1'],['#avisoCliente','2']],{alto:380});
 await f(p,'a4-agregar',[['#btnAgregar','']],{alto:260});
 await p.click('#btnAgregar');await w();
 await f(p,'a5-origen',[['[data-origen="catalogo"]','1'],['[data-origen="pieza"]','2'],['[data-origen="medida"]','3']],{alto:420});
 await p.click('[data-origen="catalogo"]');await w(600);
 await f(p,'a6-modelos',[['#sheetModelos .search-box','1'],['[data-modelo="4"]','2']],{alto:420});
 // Puerta del catálogo con manillón y protección
 await p.click('[data-modelo="4"]');await w(700);
 await p.click('.opt[data-g="__color"][data-v="Negro"]').catch(()=>{});await w(200);
 await p.evaluate(()=>{const o=document.querySelector('.opt[data-g="__color"]');o.closest('.field').id='__color';});
 await f(p,'b1-puerta-color',[['#__color','']],{alto:280});
 await p.click('.opt[data-g="manillon"][data-v="H"]');await w(200);
 await p.click('.tchip[data-k="proteccion"]');await w(300);
 await p.fill('#pProt','80');await w(300);
 await f(p,'b2-puerta-extras',[['.tchip[data-k="proteccion"]','1'],['#campoProt','2']],{alto:360});
 await f(p,'b3-puerta-precio',[['#campoPrecio','']],{alto:330});
 await f(p,'b4-agregar-prod',[['#btnProdListo','']],{alto:200});
 await p.click('#btnProdListo');await w(600);
 // Ventana: aluminio y m²
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="6"]');await w(700);
 const med=await p.$$('#prodBody [data-mkey]');await med[0].fill('1,2');await med[1].fill('1,5');await w(200);
 await p.click('.opt[data-g="aluminio"][data-v="Panorámica"]');await w(200);
 const us=await p.$('#usarSugerido');if(us){await us.click();await w(200);}
 await f(p,'c1-ventana-aluminio',[['[data-campo="aluminio"]','1']],{alto:300});
 await f(p,'c2-ventana-precio',[['#campoPrecio','']],{alto:300});
 await p.click('#btnProdListo');await w(600);
 // Ventana con protección: solo protección
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="7"]');await w(700);
 await f(p,'c3-prot-fija',[['#prodBody .prot-fija','']],{alto:260});
 await p.click('.opt[data-g="aluminio"][data-v="Solo protección"]');await w(300);
 await p.fill('#pSoloProt','60');await w(300);
 await f(p,'c4-solo-prot',[['[data-campo="aluminio"]','1']],{alto:280});
 await f(p,'c5-solo-prot-monto',[['#campoSoloProt','2']],{alto:260});
 await p.click('#sheetProducto .icon-btn[data-cerrar]');await w(600);
 // Combo
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="8"]');await w(700);
 await f(p,'d1-combo-fijas',[['#prodBody .med-fija','']],{alto:300});
 await p.click('.opt[data-g="aluminio"][data-v="Ecobel"]');await w(300);
 await f(p,'d2-combo-ecobel',[['.opt[data-g="aluminio"][data-v="Ecobel"]','']],{alto:300});
 await p.click('#sheetProducto .icon-btn[data-cerrar]');await w(600);
 // Entrega inmediata
 await p.click('#btnAgregar');await w();await p.click('[data-origen="pieza"]');await w(600);
 await f(p,'e1-pieza',[['[data-pieza="9"]','']],{alto:300});
 await p.click('[data-pieza="9"]');await w(600);
 await f(p,'e2-pieza-cant',[['#prodBody [data-cant="1"]','']],{alto:300});
 await p.click('#btnProdListo');await w(600);
 // A medida
 await p.click('#btnAgregar');await w();await p.click('[data-origen="medida"]');await w(500);
 await f(p,'f1-medida-tipo',[['#campoMedTipo','']],{alto:320});
 await p.click('.opt[data-g="__tipo"][data-v="Portón"]');await w(500);
 await p.evaluate(()=>{const e=[...document.querySelectorAll('#prodBody .field-label')].find(x=>/Foto que trae/.test(x.textContent));if(e)e.parentElement.id='__fotoCli';});
 await p.fill('#pPrecio','1200');await w(200);
 await f(p,'f2-medida-foto',[['#__fotoCli','1']],{alto:300});
 await f(p,'f3-medida-precio',[['#campoPrecio','2']],{alto:260});
 await p.click('#btnProdListo');await w(600);
 // Lista y cierre
 await p.evaluate(()=>window.scrollTo(0,0));await w(200);
 await f(p,'g1-items',[['#items','']],{alto:520});
 await p.click('[data-extra="inst"]');await w(200);await p.fill('#vInst','30');await w(200);
 await f(p,'g2-cierre',[['[data-extra="inst"]','1'],['#campoInst','']],{alto:320});
 await f(p,'g2b-desc',[['#campoDesc','2']],{alto:260});
 await p.evaluate(()=>{document.querySelector('#optsSede').closest('.field').id='__sede';});
 await f(p,'g2c-sede',[['#__sede','3']],{alto:260});
 await p.evaluate(()=>window.scrollTo(0,0));await w(200);
 await f(p,'g3-guardar-cot',[['#btnGuardar','']],{alto:200,sinScroll:true});
 // Modo venta
 await p.click('#modoVenta [data-modo="venta"]');await w(500);
 await f(p,'h1-venta-falta',[['#items .item.falta','']],{alto:360});
 await p.click('#btnGuardar');await w(800);
 await f(p,'h2-detalles',[['[data-campo="sentido"]','1'],['[data-campo="posicion"]','2']],{alto:380});
 await f(p,'h3-bloque',[['[data-campo="bloque"]','3']],{alto:260});
 for(const [g,v] of [['sentido','Izquierda'],['posicion','Adentro'],['bloque','15'],['proteccion_sentido','Derecha']]){const o=await p.$(`.opt[data-g="${g}"][data-v="${v}"]`);if(o){await o.click();await w(120);}}
 await p.click('#btnProdListo');await w(600);
 for(let k=0;k<4;k++){ await p.click('#btnGuardar');await w(700); if(await p.isVisible('#sheetConfirmar'))break;
   for(const [g,v] of [['sentido','Izquierda'],['posicion','Adentro'],['bloque','15'],['proteccion_sentido','Derecha']]){const o=await p.$(`#prodBody .opt[data-g="${g}"][data-v="${v}"]`);if(o){await o.click();await w(100);}}
   await p.click('#btnProdListo');await w(600);}
 // Pago
 await f(p,'i1-pago-modo',[['[data-modo-pago="parcial"]','1'],['#campoAbono','2']],{alto:380});
 await p.fill('#aMonto','300');await w(300);
 await f(p,'i2-aviso50',[['#avisoAbono','']],{alto:300});
 await p.fill('#aMonto','1056');await w(300);
 await p.click('[data-metodo="Zelle"]');await w(200);
 await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:require('fs').readFileSync(__dirname+'/comprobante.png')});await w(800);
 await f(p,'i3-metodo',[['#campoMetodo','3']],{alto:280});
 await f(p,'i3b-comp',[['#campoComp','4']],{alto:330});
 await f(p,'i4-fecha',[['#campoFecha','5']],{alto:300});
 await f(p,'i5-guardar',[['#btnConfListo','6']],{alto:200});
 await p.click('#btnConfListo');await p.waitForSelector('.listo');await w(2500);
 await f(p,'j1-listo',[['#btnPdf','1'],['#btnMsj','2']],{completa:true,sinScroll:true});
 console.log('listo');
 }catch(x){console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
