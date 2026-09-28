const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
const sede={id:1,nombre:'Cumbres de Maracaibo'};
const it=(id,vid,nombre,precio,cant,extra)=>Object.assign({id,venta_id:vid,catalogo_id:4,pieza_id:null,a_medida:false,tipo:'Puerta Multilock',nombre,especificaciones:{color:'Blanco',alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:true,manillon_tipo:'H',sentido:'Derecha',posicion:'Afuera',bloque:'15'},foto:GIF,precio_unitario:precio,cantidad:cant,orden:0},extra||{});
let ventas=[
 {id:1,cliente_id:3,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:50,subtotal:800,total:850,notas:'Pintar antes',vence_en:dia(-5),fecha_entrega:dia(3),confirmada_en:new Date().toISOString(),cancelada_en:null,cancelada_motivo:null,creado_en:new Date(Date.now()-25*864e5).toISOString(),actualizado_en:new Date().toISOString(),
  items:[it(1,1,'Lineal',300,2),it(2,1,'Reja para ventana',200,1,{a_medida:true,tipo:'A medida',catalogo_id:null,especificaciones:{descripcion:'Reja de 1.2 x 1'}})],abonos:[{id:1,venta_id:1,tipo:'abono',monto:400,metodo:'Zelle',comprobante:'2026-09/x.jpg',fecha:new Date().toISOString(),registrado_por:'u3'}]},
 {id:2,cliente_id:3,estado:'cotizacion',sede_id:1,vendedor_id:'u1',descuento:10,instalacion:0,subtotal:260,total:250,notas:null,vence_en:dia(12),fecha_entrega:null,confirmada_en:null,cancelada_en:null,creado_en:new Date(Date.now()-8*864e5).toISOString(),actualizado_en:new Date().toISOString(),
  items:[it(3,2,'Imperial',260,1)],abonos:[]},
 {id:3,cliente_id:3,estado:'cotizacion',sede_id:1,vendedor_id:'u1',descuento:0,instalacion:0,subtotal:100,total:100,vence_en:dia(-3),fecha_entrega:null,confirmada_en:null,creado_en:new Date(Date.now()-23*864e5).toISOString(),actualizado_en:new Date().toISOString(),items:[it(4,3,'Cuadro',100,1)],abonos:[]},
 {id:4,cliente_id:3,estado:'entregada',sede_id:2,vendedor_id:'u2',descuento:0,instalacion:0,subtotal:300,total:300,vence_en:dia(-30),fecha_entrega:dia(-2),confirmada_en:new Date().toISOString(),creado_en:new Date(Date.now()-40*864e5).toISOString(),actualizado_en:new Date().toISOString(),items:[it(5,4,'Lineal',300,1)],abonos:[{id:2,venta_id:4,tipo:'abono',monto:300,metodo:'Efectivo',fecha:new Date().toISOString(),registrado_por:'u2'}]}
];
ventas.forEach(v=>{v.token_seguimiento='aaaaaaaa-bbbb-4ccc-8ddd-00000000000'+v.id;v.mensaje_en=null;v.pdf_en=null;v.produccion_pedida_en=null;});
const full=v=>Object.assign({},v,{cliente:cli,sede:v.sede_id===2?{id:2,nombre:'Avenida Universidad'}:sede});
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const pag=v=>v.abonos.reduce((a,x)=>a+(x.tipo==='devolucion'?-1:1)*x.monto,0);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const rpcs=[];
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13'],acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 await ctx.route('https://wa.me/**',r=>r.fulfill({status:200,contentType:'text/html',body:'wa'}));const err=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
    const v=ventas.find(x=>x.id===a.vid);
    if(name==='convertir_en_venta'){v.estado='confirmada';v.fecha_entrega=a.a.fecha_entrega;v.confirmada_en=new Date().toISOString();v.abonos.push({id:9,tipo:'abono',monto:a.a.monto,metodo:a.a.metodo,fecha:new Date().toISOString(),registrado_por:'u1'});return j({id:v.id,estado:'confirmada'});}
    if(name==='registrar_abono'){if(pag(v)+a.a.monto>v.total)return j({message:'El abono es mayor que lo que resta por pagar'},400);v.abonos.push({id:10,tipo:'abono',monto:a.a.monto,metodo:a.a.metodo,fecha:new Date().toISOString(),registrado_por:'u1'});v.actualizado_en=new Date().toISOString();return j({id:v.id});}
    if(name==='cambiar_estado_venta'){v.estado=a.nuevo;v.actualizado_en=new Date().toISOString();return j({id:v.id});}
    if(name==='cancelar_venta'){const p=pag(v);if(p>0)v.abonos.push({id:11,tipo:'devolucion',monto:p,metodo:a.metodo_devolucion,fecha:new Date().toISOString()});v.estado='cancelada';v.cancelada_en=new Date().toISOString();v.cancelada_motivo=a.motivo;return j({id:v.id});}
    if(name==='marcar_paso'){if(a.paso==='mensaje'){v.mensaje_en=new Date().toISOString();v.mensaje_estado=v.estado;v.mensaje_por='u1';}else{v.pdf_en=new Date().toISOString();v.pdf_por='u1';}return j({id:v.id});}
    if(name==='pedir_produccion'){v.produccion_pedida_en=new Date().toISOString();v.produccion_pedida_por='u1';return j({id:v.id});}
    if(name==='seguimiento_publico'){const x=ventas.find(z=>z.token_seguimiento===a.t);if(!x)return j({error:'no_existe'});return j(Object.assign({},full(x),{cliente:{nombre:cli.nombre,cedula:'V12•••678',telefono:'•••4567'}}));}
    if(name==='actualizar_venta'){v.items=a.p.items.map((x,i)=>Object.assign({id:100+i,venta_id:v.id,orden:i},x));v.subtotal=v.items.reduce((s,x)=>s+x.precio_unitario*x.cantidad,0);v.total=v.subtotal-(a.p.venta.descuento||0)+(a.p.venta.instalacion||0);v.actualizado_en=new Date().toISOString();return j({id:v.id,estado:v.estado,total:v.total});}
    return j({});}
  if(u.includes('/storage/v1/object/comprobantes'))return j({Key:'comprobantes/x.jpg'});
  if(u.includes('/storage/v1/object/sign/'))return j({signedURL:'/object/sign/comprobantes/x.jpg?token=1'});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',sede_id:2}); if(u.includes('select=id,nombre'))return j([{id:'u1',nombre:'Gualfredo'},{id:'u2',nombre:'Ray'},{id:'u3',nombre:'Yulimar'}]); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/ventas')){ const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full(ventas.find(x=>x.id===+m[1]))); let l=ventas; const e=u.match(/estado=eq\.(\w+)/); if(e) l=l.filter(x=>x.estado===e[1]); if(u.includes('produccion_pedida_en=not.is.null')) l=l.filter(x=>x.produccion_pedida_en); return j(l.map(full)); }
  if(u.includes('/catalogo'))return j([{id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:300}]);
  if(u.includes('/disponibles'))return j([]);
  if(u.includes('/sedes'))return j([sede,{id:2,nombre:'Avenida Universidad',orden:2,activa:true}]);
  if(u.includes('/clientes'))return j(null);
  return j([]);});
 await ctx.addInitScript(()=>{window.__share=null;window.__clip=null;
  navigator.canShare=(d)=>!!(d&&d.files);
  navigator.share=async(d)=>{window.__share={files:d.files.map(f=>[f.name,f.type,f.size]),text:d.text};};
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{window.__clip=t;}},configurable:true});});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/400/.test(m.text()))err.push('console:'+m.text())});
 let dialogos=[];p.on('dialog',d=>{dialogos.push(d.message());d.accept();});
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await w(900);
 ok('Inicio: cotizaciones abiertas',(await p.textContent('#cuenta-cotizaciones')).includes('1 abierta'),await p.textContent('#cuenta-cotizaciones'));
 ok('Inicio: ventas activas y por cobrar',(await p.textContent('#cuenta-ventas')).includes('1 activa')&&(await p.textContent('#cuenta-ventas')).includes('1 por cobrar'),await p.textContent('#cuenta-ventas'));
 await p.screenshot({path:'shots4/l0-inicio.png'});
 // Cotizaciones
 await p.click('a.ini-tile[href="cotizaciones.html"]');await p.waitForSelector('.vcard');await w(500);
 ok('Chips de cotizaciones',(await p.$$eval('.chip',x=>x.map(c=>c.textContent))).join('|')==='Abiertas · 1|Vencidas · 1|Descartadas',await p.$$eval('.chip',x=>x.map(c=>c.textContent)));
 ok('Etiqueta de vencimiento',(await p.textContent('.vcard .plazo')).includes('Vence en 12 días'));
 await p.screenshot({path:'shots4/l1-cot.png'});
 await p.click('.chip[data-f="vencidas"]');await w(300);
 ok('Vencida marcada',(await p.textContent('.vcard .plazo')).includes('Vencida hace 3 días'));
 await p.fill('#buscador','zzz');await w(200);ok('Buscador sin resultados',(await p.textContent('.vacio h3'))==='No hay resultados');
 await p.fill('#buscador','');await p.click('.chip[data-f="abiertas"]');await w(300);
 await p.click('.vcard[data-id="2"]');await w(1500);
 ok('Ficha de cotización',(await p.textContent('.f-num')).includes('Cotización N° 2'));
 await p.waitForSelector('#fichaBody .avisar-wrap [data-accion="pdf"]:not([disabled])',{timeout:20000});
 ok('PDF listo en la ficha',true);
 await p.screenshot({path:'shots4/l2-ficha-cot.png'});
 ok('Avisar al cliente: cotización es un solo botón (PDF, sin enlace)',(await p.$$('#fichaBody .avisar-wrap [data-accion]')).length===1&&(await p.textContent('#fichaBody .avisar-wrap')).includes('Enviar cotización'));
 ok('Cotización: botón guía Convertir en venta',(await p.textContent('#fichaBody .btn-guia[data-accion="convertir"]')).includes('Cuando el cliente pague'));
 ok('Menús: Pagos/Precio abierto, Más opciones cerrado',await p.$eval('#fichaBody details[data-sec="precio"]',x=>x.open)&&!(await p.$eval('#fichaBody details[data-sec="mas"]',x=>x.open)));
 // Enviar PDF de la cotización (menú de compartir simulado)
 await p.click('#fichaBody .avisar-wrap [data-accion="pdf"]');await w(800);
 ok('PDF queda marcado con ✓',rpcs.some(x=>x[0]==='marcar_paso'&&x[1].paso==='pdf'));
 const sh=await p.evaluate(()=>({s:window.__share,c:window.__clip,t:document.getElementById('toast').textContent}));
 ok('Comparte PDF + mensaje (sin enlace de seguimiento) y copia el teléfono',sh.s&&sh.s.files[0][0]==='Cotizacion-2-Maria-Gonzalez.pdf'&&sh.s.files[0][1]==='application/pdf'&&sh.s.text.startsWith('Hola María')&&sh.s.text.includes('cotización N° 2')&&!sh.s.text.includes('seguimiento.html')&&sh.c==='4141234567'&&sh.t.includes('414 123 4567'),sh);
 ok('Después de enviarlo se ve "Cliente avisado"',(await p.textContent('#fichaBody .avisar-wrap')).includes('Cliente avisado'));
 // Descargar PDF
 await p.click('#fichaBody details[data-sec="mas"] summary');await w(300);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('[data-accion="descargar"]')]);
 await dl.saveAs('cot2.pdf');ok('PDF de cotización descargado',fs.statSync('cot2.pdf').size>5000,fs.statSync('cot2.pdf').size);
 ok('Nombre del PDF',dl.suggestedFilename()==='Cotizacion-2-Maria-Gonzalez.pdf',dl.suggestedFilename());
 // Convertir
 await p.click('#fichaBody [data-accion="convertir"]');await w(500);
 ok('Convertir: abono 50% sugerido',(await p.inputValue('#aMonto'))==='125');
 await p.click('#btnAccion');await w(300);ok('Convertir pide método',await p.$eval('#campoMetodo',x=>x.classList.contains('invalid')));
 ok('Convertir pide comprobante',await p.$eval('#campoComp',x=>x.classList.contains('invalid')));
 await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await w(700);
 await p.click('#accionBody [data-metodo="Binance"]');await p.click('#btnAccion');await w(1500);
 const conv=rpcs.find(x=>x[0]==='convertir_en_venta');ok('Convertir envía abono y fecha',conv&&conv[1].vid===2&&conv[1].a.monto===125&&conv[1].a.metodo==='Binance'&&/^\d{4}-\d{2}-\d{2}$/.test(conv[1].a.fecha_entrega),conv&&conv[1]);
 ok('La cotización sale de la lista',!(await p.$('.vcard[data-id="2"]')));
 // Atrás → Inicio
 await p.goBack({waitUntil:'commit'});await p.waitForSelector('#vInicio.entra');ok('Atrás desde Cotizaciones → Inicio',p.url().endsWith('index.html'));
 // Ventas
 await p.click('a.ini-tile[href="ventas.html"]');await p.waitForSelector('.vcard');await w(500);
 ok('Chips de ventas',(await p.$$eval('.chip',x=>x.map(c=>c.textContent))).join('|')==='Activas · 2|Por cobrar · 2|Entregadas · 1|Canceladas',await p.$$eval('.chip',x=>x.map(c=>c.textContent)));
 ok('Orden por fecha de entrega (la más cercana primero)',(await p.$$eval('.vcard',x=>x.map(c=>c.dataset.id))).join()==='1,2',await p.$$eval('.vcard',x=>x.map(c=>c.dataset.id)));
 await p.screenshot({path:'shots4/l3-ventas.png'});
 await p.click('.vcard[data-id="1"]');await w(1500);
 await p.screenshot({path:'shots4/l4-ficha-venta.png'});
 await p.evaluate(()=>{const b=document.getElementById('fichaBody');b.scrollTop=b.scrollHeight;});await w(200);await p.screenshot({path:'shots4/l4b-ficha-venta.png'});
 if(!(await p.$eval('#fichaBody details[data-sec="mas"]',x=>x.open))){await p.click('#fichaBody details[data-sec="mas"] summary');await w(300);}
 ok('Estados uno al lado del otro',(await p.$$('#fichaBody .estados .est-i')).length===4&&(await p.$$('#fichaBody .est-i.actual')).length===1);
 const [dl2]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('[data-accion="descargar"]')]);await dl2.saveAs('ped1.pdf');
 ok('PDF de pedido descargado',fs.statSync('ped1.pdf').size>5000);
 ok('Siguiente paso: "Pasar a En producción" con explicación',(await p.textContent('#fichaBody .btn-guia[data-estado="en_produccion"]')).includes('entra a fabricación'));
 ok('No hay botón para saltar a Lista',!(await p.$('#fichaBody [data-estado="lista"]')));
 // Abono mayor que resta
 await p.click('[data-accion="abono"]');await w(500);
 ok('Registrar pago: por defecto paga lo que resta',(await p.textContent('#accionBody [data-modo-pago="completo"]'))==='Paga lo que resta'&&await p.$eval('#campoMonto',x=>x.classList.contains('hidden'))&&(await p.textContent('#accionTitulo'))==='Registrar pago');
 await p.click('#accionBody [data-modo-pago="parcial"]');await w(200);
 await p.fill('#aMonto','500');await w(200);ok('Abono mayor que resta marcado',await p.$eval('#campoMonto',x=>x.classList.contains('invalid')));
 await p.fill('#aMonto','150,50');await w(200);ok('Abono con coma',(await p.textContent('#avisoMonto')).includes('$299.50'),await p.textContent('#avisoMonto'));await p.fill('#aMonto','150');await p.click('#accionBody [data-metodo="Efectivo"]');await p.click('#btnAccion');await w(300);
 ok('Efectivo también pide comprobante',await p.$eval('#campoComp',x=>x.classList.contains('invalid')));
 await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await w(700);await p.click('#btnAccion');await w(1500);
 ok('Abono guardado y ficha actualizada',(await p.textContent('#fichaBody')).includes('$550')&&(await p.textContent('#fichaBody')).includes('Resta $300'),(await p.textContent('.barra-txt')));
 // Estado (③ Enviar a producción)
 dialogos=[];await p.click('#fichaBody .btn-guia[data-estado="en_produccion"]');await w(1200);
 ok('Cambiar estado pide confirmación y se guarda',dialogos.length===1&&rpcs.some(x=>x[0]==='cambiar_estado_venta'&&x[1].nuevo==='en_produccion'&&x[1].desde==='confirmada'));
 ok('Admin puede devolver un paso (en Más opciones)',!!(await p.$('#fichaBody [data-retro="confirmada"]')));
 ok('Siguiente: "Marcar como Lista"',(await p.textContent('#fichaBody .btn-guia[data-estado="lista"]')).includes('Marcar como Lista'));
 ok('En producción ya no deja editar',(await p.textContent('#fichaBody')).includes('No se puede editar'));
 // Cancelar con devolución
 if(!(await p.$eval('#fichaBody details[data-sec="mas"]',x=>x.open))){await p.click('#fichaBody details[data-sec="mas"] summary');await w(300);}
 await p.click('[data-accion="cancelar"]');await w(500);
 ok('Cancelar muestra lo que se devuelve',(await p.textContent('#accionBody')).includes('$550'));
 await p.click('#btnAccion');await w(300);ok('Cancelar pide método de devolución',await p.$eval('#campoMetodo',x=>x.classList.contains('invalid')));
 await p.fill('#aMotivo','Cliente se mudó');await p.click('#accionBody [data-metodo="Zelle"]');dialogos=[];await p.click('#btnAccion');await w(1500);
 const can=rpcs.find(x=>x[0]==='cancelar_venta');ok('Cancelar envía método y motivo',can&&can[1].metodo_devolucion==='Zelle'&&can[1].motivo==='Cliente se mudó'&&dialogos.length===1,can&&can[1]);
 ok('Ficha muestra cancelada y devolución',(await p.textContent('#fichaBody')).includes('Devolución'));
 await p.goBack({waitUntil:'commit'});await w(600);ok('Atrás cierra la ficha',!(await p.$('#sheetFicha.open')));
 // Editar la venta 2 (confirmada)
 await p.click('.chip[data-f="activas"]');await w(300);await p.click('.vcard[data-id="2"]');await w(1500);
 if(!(await p.$eval('#fichaBody details[data-sec="mas"]',x=>x.open))){await p.click('#fichaBody details[data-sec="mas"] summary');await w(300);}await p.click('a.btn-grid[href^="venta.html?editar="]');await p.waitForURL('**/venta.html?editar=2');await w(1500);
 ok('Editar carga los datos',(await p.inputValue('#cNombre'))==='María González'&&(await p.$$('#items .item')).length===1&&(await p.textContent('#btnGuardar'))==='Guardar cambios');
 ok('Editar mantiene el descuento',await p.inputValue('#vDesc')==='10');
 await p.click('#items [data-editar="0"]');await w(500);await p.fill('#pPrecio','280');await p.click('#btnProdListo');await w(400);
 await p.click('#btnGuardar');await w(1800);
 const act=rpcs.find(x=>x[0]==='actualizar_venta');ok('Editar guarda con actualizar_venta',act&&act[1].vid===2&&act[1].p.items[0].precio_unitario===280,act&&act[1].p.items[0].precio_unitario);
 ok('Después de editar vuelve a Ventas',p.url().endsWith('ventas.html'),p.url());
 await w(1200);ok('Ficha actualizada al volver',(await p.textContent('#fichaBody')).includes('$270'),(await p.textContent('.t-total')));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
