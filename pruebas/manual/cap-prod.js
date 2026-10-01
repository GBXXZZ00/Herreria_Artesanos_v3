// Capturas para el manual de Producción (datos simulados)
const {chromium,contexto,foto,H,FOTO}=require('./lib');
const fs=require('fs');
const OUT=__dirname+'/shots-prod/';fs.mkdirSync(OUT,{recursive:true});
const f=(p,n,m,o)=>foto(p,OUT,n,m,o);
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const iso=(d)=>d.toISOString().slice(0,10);
const SAB=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));const este=iso(d);d.setDate(d.getDate()+7);const prox=iso(d);d.setDate(d.getDate()-14);return {este,prox,pasado:iso(d)};})();
const trab=[{id:'t1',nombre:'Jesús',especialidades:['herrero','acabados']},{id:'t2',nombre:'Luis Paz',especialidades:['masilla_pintura']},{id:'t3',nombre:'Carlos',especialidades:['ventanero']}];
const porId=id=>trab.find(t=>t.id===id);
const E=(id,rama,nombre,orden,esp,oficio,extra)=>Object.assign({id,rama,nombre,orden,especialidad:esp,oficio,estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null,incluye:null,despues_de:null,para_el:null,iniciada_en:null},extra||{});
const hecha=(tid)=>({estado:'hecha',trabajador_id:tid,trabajador:{nombre:porId(tid).nombre},terminada_en:new Date(Date.now()-2*864e5).toISOString(),para_el:SAB.pasado});
const asig=(tid,para,ahora)=>({trabajador_id:tid,trabajador:{nombre:porId(tid).nombre},para_el:para,iniciada_en:ahora?new Date().toISOString():null});
const inc='Puerta';
let ventas=[
 {id:1044,interna:false,fecha_entrega:dia(-3),cliente:{nombre:'Carmen Urdaneta'},estado:'en_produccion',items:[
  {id:101,nombre:'Modelo Lineal Con Bitral',tipo:'Puerta Multilock',cantidad:2,categoria_pago_id:1,especificaciones:{alto:2.1,ancho:1,color:'Negro',sentido:'Derecha',posicion:'Afuera',bloque:'15'},catalogo:{fotos:{Negro:FOTO}},etapas:[
   E(1,'principal','Hierro',1,'herrero','hierro',hecha('t1')),
   E(2,'principal','Masilla',2,'masilla_pintura','masilla',asig('t2',SAB.pasado,true)),
   E(3,'principal','Pintura',3,'masilla_pintura','pintura',asig('t2',SAB.este)),
   E(4,'principal','Detalles',4,'acabados','detalles')]}]},
 {id:1048,interna:false,fecha_entrega:dia(24),cliente:{nombre:'José Fuenmayor'},estado:'en_produccion',items:[
  {id:201,nombre:'Combo #1',tipo:'Combo',cantidad:1,categoria_pago_id:1,especificaciones:{alto:2,ancho:1,color:'Negro',ventanas_alto:1,ventanas_ancho:1,variante:'Con protección en puerta',aluminio:'Ecobel'},catalogo:{fotos:{Negro:FOTO}},etapas:[
   E(11,'principal','Hierro',1,'herrero','hierro',Object.assign({incluye:'Puerta con protección + 2 protecciones de ventana'},asig('t1',SAB.este))),
   E(12,'principal','Masilla',2,'masilla_pintura','masilla',{incluye:'Puerta con protección + 2 protecciones de ventana'}),
   E(13,'principal','Pintura',3,'masilla_pintura','pintura',{incluye:'Puerta con protección + 2 protecciones de ventana'}),
   E(14,'principal','Detalles',4,'acabados','detalles',{incluye:'Solo la puerta'}),
   E(15,'ventana','Aluminio 2 ventanas',1,'ventanero','armar',{incluye:'2 ventanas'}),
   E(16,'ventana','Instalar en las protecciones',2,'ventanero','instalar',{incluye:'2 ventanas en sus protecciones',despues_de:['principal/3']})]},
  {id:202,nombre:'Ventana Panorámica',tipo:'Ventana',cantidad:2,categoria_pago_id:null,especificaciones:{alto:1.2,ancho:1.5,color:'Negro',aluminio:'Ecobel'},catalogo:{fotos:{}},etapas:[
   E(21,'ventana','Aluminio',1,'ventanero','armar',{incluye:'La ventana'})]}]},
 {id:1051,interna:false,fecha_entrega:dia(10),cliente:{nombre:'Luis Parra'},estado:'en_produccion',items:[
  {id:301,nombre:'Modelo Arco 3 vidrios',tipo:'Puerta Multilock',cantidad:1,categoria_pago_id:1,especificaciones:{alto:2,ancho:0.9,color:'Blanco'},catalogo:{fotos:{Blanco:FOTO}},etapas:[
   E(31,'principal','Hierro',1,'herrero','hierro',hecha('t1')),E(32,'principal','Masilla',2,'masilla_pintura','masilla',hecha('t2')),E(33,'principal','Pintura',3,'masilla_pintura','pintura',hecha('t2')),E(34,'principal','Detalles',4,'acabados','detalles',asig('t1',SAB.este))]}]}
];
const lect=v=>({id:v.id,fecha_entrega:v.fecha_entrega,interna:v.interna,cliente:v.cliente,items:v.items.map(it=>Object.assign({},it,{foto:null}))});
const rutas=(u,req,j)=>{
 if(u.includes('/rpc/asignar_etapas')){const body=JSON.parse(req.postData()||'{}');body.p.forEach(c=>{for(const v of ventas)for(const it of v.items)for(const e of it.etapas)if(e.id===c.eid){e.trabajador_id=c.tid;e.trabajador=c.tid?{nombre:porId(c.tid).nombre}:null;e.para_el=c.tid?(c.para||SAB.este):null;}});return j(body.p.length);}
 if(u.includes('/rpc/produccion_lectura'))return j(ventas.map(lect));
 if(u.includes('/perfiles')&&u.includes('rol=eq.trabajador'))return j(trab);
 if(u.includes('/categorias_pago'))return j([{id:1,nombre:'Puerta sencilla'},{id:2,nombre:'Ventana'},{id:3,nombre:'Combo'}]);
 if(u.includes('/ventas'))return j(ventas);
 if(u.includes('/catalogo'))return j([{id:4,nombre:'Modelo Lineal Con Bitral',tipo:'Puerta Multilock',fotos:{Negro:FOTO,Blanco:FOTO},especificaciones_base:{alto:2,ancho:1},precio_base:320,categoria_pago_id:1}]);
};
(async()=>{ const b=await chromium.launch(); try{
 // Vendedora: solo mira
 const y=await contexto(b,'vendedor',rutas);
 await y.goto(H+'produccion.html');await y.waitForSelector('.vcard');await y.waitForTimeout(800);
 await f(y,'v1-lista',[['#chips','1'],['.vcard','2']],{alto:420,sinScroll:true});
 await y.click('.vcard >> nth=0');await y.waitForSelector('#sheetFicha.open');await y.waitForTimeout(700);
 await f(y,'v2-ficha',[['#fichaBody .e-ahora','']],{alto:520});
 // Administrador
 const a=await contexto(b,'admin',rutas);
 const pa=await a.$('a.pend-fila[href*="produccion.html"]');
 if(pa) await f(a,'a0-pend',[['a.pend-fila[href*="produccion.html?filtro=asignar"]','1'],['a.pend-fila[href*="atrasados"]','2']],{alto:360});
 await a.goto(H+'produccion.html');await a.waitForSelector('.vcard');await a.waitForTimeout(800);
 await f(a,'a1-lista',[['#chips','1'],['#btnNuevaOrden','2']],{completa:true,sinScroll:true});
 await a.click('.vcard >> text=José Fuenmayor');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(800);
 await f(a,'a2-sincat',[['#fichaBody .cat-falta','']],{alto:320});
 await f(a,'a3-ramas',[['#fichaBody .e-rama-tit','1'],['#fichaBody .e-rama-inc','2']],{alto:520});
 await f(a,'a4-boton',[['[data-asignar-todo="201"]','3']],{alto:300});
 await a.click('[data-asignar-todo="201"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(400);
 await a.evaluate(()=>{const o=document.querySelector('#todoBody .at-op[data-tid="t2"]');o.closest('.at-paso').id='__paso';});await a.click('#__paso .at-op[data-tid="t2"]');await a.waitForTimeout(150);
 await a.evaluate(()=>{const s=document.querySelector('#todoBody .seg-op');if(s)s.closest('.field, .at-cuando, div').id='__cuando';});
 await f(a,'a5-asignar',[['#__paso','1']],{alto:420});
 const cu=await a.$('#todoBody .seg-op'); if(cu){ await a.evaluate(()=>{const s=document.querySelector('#todoBody .seg-op');s.parentElement.id='__segs';}); await f(a,'a6-cuando',[['#__segs','2']],{alto:300}); }
 await f(a,'a7-guardar',[['#btnGuardarTodo','3']],{alto:220});
 await a.click('#sheetTodo [data-cerrar="sheetTodo"]').catch(()=>{});await a.waitForTimeout(400);
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]').catch(()=>{});await a.waitForTimeout(400);
 await a.click('.vcard >> text=Carmen Urdaneta');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(800);
 await f(a,'a8-atrasado',[['#fichaBody .e-ahora','']],{alto:520});
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]').catch(()=>{});await a.waitForTimeout(400);
 await a.click('#btnNuevaOrden');await a.waitForTimeout(800);
 await a.screenshot({path:OUT+'a9-exhibicion.png'});
 console.log('listo');
 }catch(x){console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
