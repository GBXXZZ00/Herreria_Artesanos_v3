// Cotización → venta: al convertir primero pide los detalles para fabricar que faltan
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u3',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u3',aud:'authenticated',role:'authenticated',email:'yulimar@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
const base={cliente_id:3,sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,traslado:0,notas:null,vence_en:dia(12),fecha_entrega:null,confirmada_en:null,cancelada_en:null,creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),abonos:[],token_seguimiento:'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'};
// Cotización 5: puerta con protección sin detalles, combo sin detalles, pieza y reja (no piden nada)
const ventas=[Object.assign({},base,{id:5,estado:'cotizacion',subtotal:1100,total:1100,items:[
  {id:51,venta_id:5,catalogo_id:4,pieza_id:null,a_medida:false,tipo:'Puerta Multilock',nombre:'Lineal',orden:0,cantidad:1,precio_unitario:300,foto:GIF,
   especificaciones:{color:'Blanco',alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,proteccion:true,marco_decorativo:false,sentido:null,posicion:null,bloque:null,proteccion_sentido:null}},
  {id:52,venta_id:5,catalogo_id:8,pieza_id:null,a_medida:false,tipo:'Combo',nombre:'Combo Imperial',orden:1,cantidad:1,precio_unitario:500,foto:null,
   especificaciones:{color:'Negro',alto:2.1,ancho:1,ventanas_alto:1.2,ventanas_ancho:1,variante:'Sin protección en puerta',aluminio:'Panorámica',vidrio_o_farquilla:'Farquilla',papel_ahumado:true,color_ahumado:'Espejo'}},
  {id:53,venta_id:5,catalogo_id:4,pieza_id:9,a_medida:false,tipo:'Puerta Multilock',nombre:'Pieza lista',orden:2,cantidad:1,precio_unitario:250,foto:GIF,especificaciones:{color:'Blanco'}},
  {id:54,venta_id:5,catalogo_id:null,pieza_id:null,a_medida:true,tipo:'A medida',nombre:'Reja',orden:3,cantidad:1,precio_unitario:50,foto:null,especificaciones:{descripcion:'Reja 1x1'}}]}),
 // Cotización 6: ya tiene todo (cotizaciones viejas): no pide detalles
 Object.assign({},base,{id:6,estado:'cotizacion',subtotal:300,total:300,items:[
  {id:61,venta_id:6,catalogo_id:4,pieza_id:null,a_medida:false,tipo:'Puerta Multilock',nombre:'Lineal',orden:0,cantidad:1,precio_unitario:300,foto:GIF,
   especificaciones:{color:'Blanco',alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,proteccion:false,sentido:'Derecha',posicion:'Afuera',bloque:'15'}}]})];
const full=v=>Object.assign({},v,{cliente:cli,sede:{id:1,nombre:'Cumbres de Maracaibo'}});
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const rpcs=[];let fallarConvertir=false;
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13']});const err=[];
 const ruta=async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
    const v=ventas.find(x=>x.id===a.vid);
    if(name==='completar_detalles'){a.items.forEach(x=>{const it=v.items.find(y=>y.id===x.id);Object.assign(it.especificaciones,x.e);});return j({id:v.id,items:a.items.length});}
    if(name==='convertir_en_venta'){if(fallarConvertir)return j({message:'Faltan detalles para fabricar en "Lineal": el bloque.'},400);v.estado='confirmada';v.fecha_entrega=a.a.fecha_entrega;return j({id:v.id,estado:'confirmada'});}
    if(name==='avance_venta')return j({total:0,hechas:0,actuales:[]});
    return j({});}
  if(u.includes('/storage/v1/object/comprobantes'))return j({Key:'comprobantes/x.jpg'});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1}); if(u.includes('select=id,nombre'))return j([{id:'u3',nombre:'Yulimar'}]); return j([{usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',orden:3}]);}
  if(u.includes('/ventas')){ const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full(ventas.find(x=>x.id===+m[1]))); let l=ventas; const e=u.match(/estado=eq\.(\w+)/); if(e) l=l.filter(x=>x.estado===e[1]); return j(l.map(full)); }
  if(u.includes('/catalogo'))return j([]);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
  return j([]);};
 await ctx.route('**/*.supabase.co/**',ruta);
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '333333') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await w(600);
 await p.goto(H+'cotizaciones.html?abrir=5');await p.waitForSelector('#sheetFicha.open');await w(1200);
 await p.click('#fichaBody [data-accion="convertir"]');await w(600);
 ok('Convertir: primero "Completa los detalles para fabricar"',(await p.textContent('#accionTitulo'))==='Detalles para fabricar'&&(await p.textContent('#btnAccion'))==='Seguir al pago');
 const noms=await p.$$eval('#accionBody .det-nom',x=>x.map(y=>y.textContent));
 ok('Solo aparecen los que se fabrican y les falta algo (no la pieza ni la reja)',noms.join('|')==='Lineal|Combo Imperial',noms);
 ok('Puerta con protección: pide hacia dónde abre, adentro o afuera, bloque y hacia dónde abre la protección',(await p.$$('#accionBody [data-det="0"][data-g="proteccion_sentido"]')).length===2&&(await p.$$('#accionBody [data-det="0"][data-g="sentido"]')).length===2);
 ok('Nada de instalación viene marcado',!(await p.$('#accionBody [data-g="sentido"].selected'))&&!(await p.$('#accionBody [data-g="bloque"].selected')));
 ok('Vidrio y ahumado vienen de la cotización para revisarlos',await p.$eval('#accionBody [data-det="0"][data-g="vidrio"].selected',x=>x.dataset.v)==='Negro'&&await p.$eval('#accionBody [data-det="1"][data-g="vidrio"].selected',x=>x.dataset.v)==='Farquilla'&&await p.$eval('#accionBody [data-det="1"][data-g="ahumado"].selected',x=>x.dataset.v)==='Espejo');
 ok('Combo sin protección en puerta: no pregunta la protección',!(await p.$('#accionBody [data-det="1"][data-g="proteccion_sentido"]')));
 await p.screenshot({path:'shots5/c1-detalles.png'});
 await p.click('#btnAccion');await w(400);
 ok('Sin elegir no pasa al pago: marca en rojo',(await p.textContent('#accionTitulo'))==='Detalles para fabricar'&&(await p.$$('#accionBody .field.invalid')).length===7,(await p.$$('#accionBody .field.invalid')).length);
 await p.screenshot({path:'shots5/c2-detalles-rojo.png'});
 for(const [i,g,v] of [[0,'sentido','Izquierda'],[0,'posicion','Adentro'],[0,'bloque','15'],[0,'proteccion_sentido','Derecha'],[1,'sentido','Derecha'],[1,'posicion','Afuera']]){await p.click(`#accionBody [data-det="${i}"][data-g="${g}"][data-v="${v}"]`);await w(80);}
 await p.click('#accionBody [data-det="1"][data-g="ahumado"][data-v="Sin"]');await w(80);
 await p.click('#btnAccion');await w(400);
 ok('Si falta uno sigue sin pasar (bloque del combo)',(await p.$$('#accionBody .field.invalid')).length===1&&!!(await p.$('#accionBody .field.invalid [data-det="1"][data-g="bloque"]')));
 await p.click('#accionBody [data-det="1"][data-g="bloque"][data-v="10"]');await w(80);
 await p.click('#btnAccion');await w(500);
 ok('Completo: pasa al pago',(await p.textContent('#accionTitulo'))==='Convertir en venta'&&!!(await p.$('#aMonto'))&&(await p.textContent('#btnAccion'))==='Guardar venta');
 await p.click('#accionBody [data-det-volver]');await w(300);
 ok('Se puede volver a los detalles y siguen elegidos',await p.$eval('#accionBody [data-det="0"][data-g="sentido"].selected',x=>x.dataset.v)==='Izquierda');
 await p.click('#btnAccion');await w(400);
 await p.click('#accionBody [data-metodo="Zelle"]');await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await w(700);
 await p.screenshot({path:'shots5/c3-pago.png'});
 fallarConvertir=true;
 await p.click('#btnAccion');await w(1200);
 ok('Si el servidor dice que falta algo, lo muestra y no cierra',(await p.textContent('#toast')).includes('Faltan detalles')&&await p.isVisible('#sheetAccion'));
 fallarConvertir=false;rpcs.length=0;
 await p.click('#btnAccion');await w(1500);
 const cd=rpcs.find(x=>x[0]==='completar_detalles'), cv=rpcs.findIndex(x=>x[0]==='convertir_en_venta');
 ok('Primero guarda los detalles y después convierte',cd&&cv>rpcs.findIndex(x=>x[0]==='completar_detalles'));
 const e0=cd&&cd[1].items.find(x=>x.id===51).e, e1=cd&&cd[1].items.find(x=>x.id===52).e;
 ok('Detalles de la puerta',e0&&e0.sentido==='Izquierda'&&e0.posicion==='Adentro'&&e0.bloque==='15'&&e0.proteccion_sentido==='Derecha'&&e0.color_vidrio==='Negro',e0);
 ok('Detalles del combo (ahumado cambiado a Sin, sin medidas ni precio)',e1&&e1.sentido==='Derecha'&&e1.bloque==='10'&&e1.papel_ahumado===false&&!('color_ahumado' in e1)&&!('alto' in e1)&&!('aluminio' in e1)&&e1.vidrio_o_farquilla==='Farquilla',e1);
 ok('Solo manda los 2 que se fabrican',cd&&cd[1].items.length===2);
 // Cotización vieja con todo: va directo al pago
 await p.goto(H+'cotizaciones.html?abrir=6');await p.waitForSelector('#sheetFicha.open');await w(1200);
 await p.click('#fichaBody [data-accion="convertir"]');await w(600);
 ok('Si ya tiene todo, igual se revisa: todo viene elegido',(await p.textContent('#accionTitulo'))==='Detalles para fabricar'&&await p.$eval('#accionBody [data-g="sentido"].selected',x=>x.dataset.v)==='Derecha');
 await p.click('#btnAccion');await w(500);
 ok('Y pasa al pago con un toque',(await p.textContent('#accionTitulo'))==='Convertir en venta'&&!(await p.$('#accionBody .field.invalid')));
 // Android: el PDF va solo (WhatsApp bota el texto) y el mensaje en un segundo paso
 const ctxA=await b.newContext({...devices['Pixel 7']});
 await ctxA.route('**/*.supabase.co/**',ruta);
 await ctxA.addInitScript(()=>{window.__share=null;window.__abre=null;
  navigator.canShare=(d)=>!!(d&&d.files);
  navigator.share=async(d)=>{window.__share={files:d.files.length,text:d.text||null};};
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
  window.open=(u)=>{window.__abre=u;return {};};});
 const a=await ctxA.newPage();a.on('pageerror',e=>err.push(e.message));
 await a.goto(H+'index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '333333') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');await a.waitForTimeout(500);
 await a.goto(H+'cotizaciones.html?abrir=6');await a.waitForSelector('#sheetFicha.open');
 await a.waitForSelector('#fichaBody [data-accion="pdf"]:not([disabled])',{timeout:20000});
 await a.click('#fichaBody [data-accion="pdf"]');await a.waitForTimeout(900);
 const sh=await a.evaluate(()=>window.__share);
 ok('Android: comparte solo el PDF (sin texto)',sh&&sh.files===1&&sh.text===null,sh);
 ok('Android: el botón pasa a "2. Enviar el mensaje"',(await a.textContent('#fichaBody .avisar-wrap')).includes('2. Enviar el mensaje'));
 await a.screenshot({path:'shots5/p1-android-paso2.png'});
 await a.click('#fichaBody [data-accion="pdf2"]');await a.waitForTimeout(500);
 const ab=await a.evaluate(()=>window.__abre);
 ok('Paso 2: abre WhatsApp del cliente con el mensaje',ab&&ab.startsWith('https://wa.me/584141234567?text=')&&decodeURIComponent(ab).includes('cotización N° 6'),ab);
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
