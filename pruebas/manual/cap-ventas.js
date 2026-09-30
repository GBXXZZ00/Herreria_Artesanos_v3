// Capturas para los manuales de Cotizaciones y Ventas
const {chromium,contexto,foto,H,FOTO}=require('./lib');
const fs=require('fs');
const OUT=__dirname+'/shots-ventas/';fs.mkdirSync(OUT,{recursive:true});
const f=(p,n,m,o)=>foto(p,OUT,n,m,o);
const COMP=fs.readFileSync(__dirname+'/comprobante.png');
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const hace=(n)=>new Date(Date.now()-n*864e5).toISOString();
const cli=(id,nombre,ced,tel)=>({id,nombre,cedula:ced,telefono:tel});
const C1=cli(1,'María González','V12345678','584141234567'),C2=cli(2,'José Fuenmayor','V14555111','584246551187'),C3=cli(3,'Carmen Urdaneta','V9876543','584146120930'),C4=cli(4,'Luis Parra','V20111222','584146002231'),C5=cli(5,'Ana Rincón','V18999000','584243187702');
const IT=(id,nombre,tipo,precio,cant,esp,extra)=>Object.assign({id,catalogo_id:4,pieza_id:null,a_medida:false,tipo,nombre,especificaciones:Object.assign({color:'Negro',alto:2,ancho:1},esp||{}),precio_unitario:precio,cantidad:cant,orden:0,catalogo:{fotos:{Negro:FOTO,Blanco:FOTO}}},extra||{});
const base={descuento:0,instalacion:0,traslado:0,notas:null,cancelada_en:null,cancelada_motivo:null,mensaje_en:null,mensaje_estado:null,pdf_en:null,interna:false};
const V=(o)=>Object.assign({},base,o,{token_seguimiento:'5f0c2d7e-1a2b-4c3d-9e8f-00000000'+o.id,subtotal:o.total,sede:{id:o.sede_id||1,nombre:o.sede_id===2?'Avenida Universidad':'Cumbres de Maracaibo'},actualizado_en:o.creado_en});
let ventas=[
 V({id:1047,estado:'cotizacion',cliente_id:1,cliente:C1,vendedor_id:'u2',total:640,vence_en:dia(12),creado_en:hace(8),items:[IT(1,'Modelo Lineal Con Bitral','Puerta Multilock',320,2,{vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'})],abonos:[]}),
 V({id:1049,estado:'cotizacion',cliente_id:4,cliente:C4,vendedor_id:'u2',total:580,vence_en:dia(2),creado_en:hace(18),items:[IT(2,'Combo #1','Combo',580,1,{variante:'Sin protección en puerta',ventanas_alto:1,ventanas_ancho:1,aluminio:'Panorámica'})],abonos:[],pdf_en:hace(18)}),
 V({id:1050,estado:'cotizacion',cliente_id:5,cliente:C5,vendedor_id:'u2',total:250,vence_en:dia(-3),creado_en:hace(23),items:[IT(3,'Modelo Lineal 5 Vidrios','Puerta Multilock',250,1)],abonos:[],pdf_en:hace(23)}),
 V({id:1048,estado:'confirmada',cliente_id:2,cliente:C2,vendedor_id:'u2',total:1030,fecha_entrega:dia(26),confirmada_en:hace(0),creado_en:hace(0),items:[IT(4,'Modelo Cuadro','Puerta Multilock',480,1,{sentido:'Derecha',posicion:'Afuera',bloque:'15'}),IT(5,'Ventana Panorámica','Ventana',275,2,{alto:1.2,ancho:1.5,aluminio:'Ecobel',sentido:null})],
   abonos:[{id:1,tipo:'abono',monto:515,metodo:'Zelle',estado:'por_confirmar',comprobante:'2026-09/c.jpg',fecha:hace(0),registrado_por:'u2'}]}),
 V({id:1044,estado:'en_produccion',cliente_id:3,cliente:C3,vendedor_id:'u2',total:960,fecha_entrega:dia(4),confirmada_en:hace(12),creado_en:hace(12),pdf_en:hace(12),mensaje_en:hace(11),mensaje_estado:'en_produccion',items:[IT(6,'Modelo Lineal Con Bitral','Puerta Multilock',480,2,{sentido:'Derecha',posicion:'Afuera',bloque:'15'})],
   abonos:[{id:2,tipo:'abono',monto:480,metodo:'Zelle',estado:'confirmado',confirmado_en:hace(11),confirmado_por:'u1',nota_confirmacion:'Llegó a Zelle de Ray',comprobante:'2026-09/c.jpg',fecha:hace(12),registrado_por:'u2'}]}),
 V({id:1041,estado:'lista',cliente_id:5,cliente:C5,vendedor_id:'u2',total:640,fecha_entrega:dia(-1),confirmada_en:hace(20),creado_en:hace(20),pdf_en:hace(20),mensaje_en:hace(19),mensaje_estado:'en_produccion',items:[IT(7,'Modelo Cuadro','Puerta Multilock',640,1)],
   abonos:[{id:3,tipo:'abono',monto:320,metodo:'Efectivo',estado:'confirmado',confirmado_en:hace(19),confirmado_por:'u1',comprobante:'2026-09/c.jpg',fecha:hace(20),registrado_por:'u2'}]}),
];
const pag=v=>v.abonos.filter(a=>a.estado!=='rechazado').reduce((s,a)=>s+(a.tipo==='devolucion'?-1:1)*a.monto,0);
const rutas=(u,req,j)=>{
 if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');const v=ventas.find(x=>x.id===a.vid);
  if(name==='avance_venta')return j({total:4,hechas:2,actuales:['Masilla'],items:{'6':{total:4,hechas:2,ahora:[{paso:'Masilla',quien:'Luis Paz',haciendo:true}]}}});
  if(name==='marcar_paso')return j({id:a.vid});
  if(name==='seguimiento_publico'){const x=ventas.find(z=>z.token_seguimiento===a.t);return j(Object.assign({},x,{cliente:{nombre:x.cliente.nombre,cedula:'V12•••678',telefono:'•••0930'},items:x.items.map(i=>Object.assign({},i,{pasos:[{nombre:'Hierro',rama:'principal',orden:1,oficio:'hierro',estado:'hecha',terminada_en:hace(6)},{nombre:'Masilla',rama:'principal',orden:2,oficio:'masilla',estado:'pendiente',trabajando:true},{nombre:'Pintura',rama:'principal',orden:3,oficio:'pintura',estado:'pendiente',espera:true},{nombre:'Detalles',rama:'principal',orden:4,oficio:'detalles',estado:'pendiente',espera:true}]}))}));}
  return j({id:a.vid||1});}
 if(u.includes('/storage/v1/object/sign/'))return j({signedURL:'/object/sign/comprobantes/c.jpg?token=1'});
 if(u.includes('/storage/v1/object/'))return j({Key:'x.jpg'});
 if(u.includes('/perfiles') && u.includes('select=id,nombre'))return j([{id:'u1',nombre:'Ray'},{id:'u2',nombre:'Yulimar'}]);
 if(u.includes('/abonos'))return j(ventas.flatMap(v=>v.abonos.filter(a=>a.estado==='por_confirmar').map(a=>Object.assign({venta_id:v.id},a))));
 if(u.includes('/ventas')){const m=u.match(/[?&]id=eq\.(\d+)/);if(m)return j(ventas.find(x=>x.id===+m[1]));let l=ventas;const e=u.match(/estado=eq\.(\w+)/);if(e)l=l.filter(x=>x.estado===e[1]);return j(l,200,{'content-range':'0-'+(l.length-1)+'/'+l.length});}
 if(u.includes('/catalogo'))return j([]);
 if(u.includes('/categorias_pago'))return j([{id:1,nombre:'Puerta'}]);
};
async function ficha(p,id){await p.click(`.vcard[data-id="${id}"]`);await p.waitForTimeout(1500);}
async function abrirMas(p){const d=await p.$('#fichaBody details[data-sec="mas"]');if(d && !(await d.evaluate(x=>x.open))){await p.click('#fichaBody details[data-sec="mas"] summary');await p.waitForTimeout(350);}}
(async()=>{ const b=await chromium.launch(); try{
 // ===== Vendedora =====
 const p=await contexto(b,'vendedor',rutas);
 const w=ms=>p.waitForTimeout(ms||450);
 await f(p,'i-vend',[['.pend','1']],{completa:true,sinScroll:true});
 const nf=await p.$('.notif-fila'); if(nf) await f(p,'i-notif',[['.notif-fila','']],{alto:260});
 await f(p,'k0-inicio',[['a.ini-tile[href="cotizaciones.html"]','1'],['a.ini-tile[href="ventas.html"]','2']],{alto:360});
 await p.goto(H+'cotizaciones.html');await p.waitForSelector('.vcard');await w(700);
 await f(p,'k1-chips',[['#chips','']],{alto:260,sinScroll:true});
 await f(p,'k2-card',[['.vcard[data-id="1047"]','']],{alto:300});
 await ficha(p,1047);
 await p.waitForSelector('#fichaBody .avisar-wrap [data-accion="pdf"]:not([disabled])',{timeout:20000}).catch(()=>{});
 await f(p,'k3-ficha',[['#fichaBody .avisar-wrap','1'],['#fichaBody [data-accion="convertir"]','2']],{alto:560,sinScroll:true});
 await abrirMas(p);
 await f(p,'k4-mas',[['#fichaBody details[data-sec="mas"] .grid-acciones','1'],['#fichaBody [data-accion="cancelar"]','2']],{alto:420});
 await p.click('#fichaBody [data-accion="convertir"]');await w(700);
 await f(p,'k5-det',[['#accionTitulo','1'],['#accionBody [data-g="sentido"]','2']],{alto:560,sinScroll:true});
 for(const [g,v] of [['sentido','Izquierda'],['posicion','Adentro'],['bloque','15']]){const o=await p.$(`#accionBody .opt[data-g="${g}"][data-v="${v}"]`);if(o){await o.click();await w(100);}}
 await p.click('#btnAccion');await w(600);
 await f(p,'k6-pago',[['#accionBody [data-modo-pago]','3'],['#btnAccion','4']],{alto:600,sinScroll:true});
 await p.click('#sheetAccion [data-cerrar]').catch(()=>{});await w(500);
 // Ventas
 await p.goto(H+'ventas.html');await p.waitForSelector('.vcard');await w(800);
 await f(p,'s1-chips',[['#chips','']],{alto:260,sinScroll:true});
 await ficha(p,1048);
 await f(p,'s2-estados',[['#fichaBody .estados','1'],['#fichaBody .btn-guia.espera','2']],{alto:420,sinScroll:true});
 await f(p,'s3-pagos',[['#fichaBody .f-abono','']],{alto:420});
 await p.click('#sheetFicha [data-cerrar]').catch(()=>{});await w(500);
 await ficha(p,1044);
 await f(p,'s4-avance',[['#fichaBody .avance-fino','1']],{alto:360,sinScroll:true});
 await p.evaluate(()=>{const d=document.querySelector('#fichaBody details[data-sec="productos"]');if(d)d.open=true;});await w(600);
 await f(p,'s5-productos',[['#fichaBody .fab-chip','2'],['#fichaBody .f-ver-prod','3']],{alto:420});
 await f(p,'s6-registrar',[['#fichaBody [data-accion="abono"]','']],{alto:320});
 await p.click('#fichaBody [data-accion="abono"]');await w(700);
 await p.click('#accionBody [data-metodo="Efectivo"]');await w(200);
 await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:COMP});await w(800);
 await f(p,'s7-hoja-pago',[['#accionBody [data-modo-pago]','1'],['#campoMetodo','2']],{alto:560,sinScroll:true});
 await p.click('#sheetAccion [data-cerrar]').catch(()=>{});await w(500);
 await p.click('#sheetFicha [data-cerrar]').catch(()=>{});await w(500);
 await p.goto(H+'ventas.html?abrir=1041');await p.waitForSelector('#fichaBody .estados');await w(1500);
 await f(p,'s8-entregar',[['#fichaBody [data-estado="entregada"]','']],{alto:360,sinScroll:true});
 await p.waitForSelector('#fichaBody .avisar-wrap [data-accion]:not([disabled])',{timeout:20000}).catch(()=>{});
 await f(p,'s9-avisar',[['#fichaBody .avisar-wrap','']],{alto:300});
 await abrirMas(p);
 await f(p,'s10-mas-vend',[['#fichaBody details[data-sec="mas"] .ac-body','']],{alto:360});
 // ===== Administrador (Ray) =====
 const a=await contexto(b,'admin',rutas);
 await a.waitForSelector('.pend-fila').catch(()=>{});
 await f(a,'i-admin',[['.pend','1']],{completa:true,sinScroll:true});
 const pf=await a.$('a.pend-fila[href*="ventas.html"]');
 if(pf) await f(a,'r1-pendiente',[['a.pend-fila[href*="ventas.html"]','1']],{alto:320});
 await a.goto(H+'ventas.html?abrir=1048');await a.waitForSelector('#fichaBody .estados');await a.waitForTimeout(1500);
 await f(a,'r2-toca',[['#fichaBody [data-confirmar="1"]','2']],{alto:380});
 await a.click('#fichaBody [data-confirmar="1"]');await a.waitForTimeout(700);
 await a.fill('#aNota','Llegó a Zelle de Ray');
 await f(a,'r3-confirmar',[['#accionBody [data-ver-comprobante]','3'],['#aNota','4'],['#btnAccion','5'],['#accionBody [data-no-llego]','6']],{completa:true,sinScroll:true});
 await a.click('#sheetAccion [data-cerrar]').catch(()=>{});await a.waitForTimeout(500);
 await abrirMas(a);
 await f(a,'r4-cancelar',[['#fichaBody [data-accion="cancelar"]','']],{alto:320});
 await a.click('#fichaBody [data-accion="cancelar"]');await a.waitForTimeout(700);
 await f(a,'r5-hoja-cancelar',[['#accionBody .conf-total','1'],['#campoMetodo','2'],['#aMotivo','3']],{completa:true,sinScroll:true});
 // Página que ve el cliente
 const cc=await b.newContext({...require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright').devices['iPhone 13'],locale:'es-VE'});
 await cc.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=x=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});const x=rutas(u,req,j);if(x)return x;return j([]);});
 const c=await cc.newPage();await c.goto(H+'seguimiento.html?t='+ventas[4].token_seguimiento);await c.waitForSelector('.hola',{timeout:15000});await c.waitForTimeout(1200);
 await c.screenshot({path:OUT+'pub1.png'});
 console.log('listo');
 }catch(x){console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
