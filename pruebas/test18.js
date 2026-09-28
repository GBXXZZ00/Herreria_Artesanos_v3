const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u3',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u3',aud:'authenticated',role:'authenticated',email:'yulimar@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[{id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF,Negro:GIF},especificaciones_base:{vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,marco_decorativo:true,proteccion:false},precio_base:200},
 {id:6,nombre:'Ventana Clásica',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{papel_ahumado:true,color_ahumado:'Espejo',proteccion:false},precio_base:0}];
modelos.push({id:8,nombre:'Combo Imperial',tipo:'Combo',fotos:{Negro:GIF},especificaciones_base:{variante:'Sin protección en puerta'},precio_base:500});
const piezas=[{id:9,catalogo_id:4,cantidad:2,estado:'disponible',precio:250,sede_id:1,color:'Blanco',especificaciones:{sentido:'Derecha'}}];
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const ventaCache={id:21,estado:'confirmada',total:500,creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),confirmada_en:new Date().toISOString(),fecha_entrega:new Date(Date.now()+5*864e5).toISOString().slice(0,10),vendedor_id:'u3',cliente:{nombre:'Pedro Cache',cedula:'V1',telefono:'584140000000'},items:[{nombre:'Lineal',cantidad:1,orden:0}],abonos:[{id:1,monto:250,tipo:'abono',estado:'confirmado'}]};
const ventaEd={id:30,estado:'cotizacion',cliente_id:3,sede_id:1,vendedor_id:'u3',descuento:5,instalacion:0,traslado:15,subtotal:180,total:190,vence_en:new Date(Date.now()+9*864e5).toISOString().slice(0,10),creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),notas:'',cliente:{id:3,nombre:'María González',telefono:'584141234567',cedula:'V12345678'},
 items:[{id:1,venta_id:30,catalogo_id:null,pieza_id:null,a_medida:true,tipo:'Ventana',nombre:'Ventana baño',especificaciones:{alto:1,ancho:2,aluminio:'Ecobel',color:'Negro',descripcion:'Con rejilla'},foto:null,precio_unitario:180,cantidad:1,orden:0}],abonos:[]};
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13']});const err=[];let rpc=null,rpcEd=null;let lentas=false;
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/crear_venta')){rpc=JSON.parse(req.postData());return j({id:7,estado:'confirmada',total:rpc.p.items.reduce((a,i)=>a+i.precio_unitario*i.cantidad,0),cliente_id:3});}
  if(u.includes('/rpc/actualizar_venta')){rpcEd=JSON.parse(req.postData());return j({id:30});}
  if(u.includes('/storage/v1/object/comprobantes'))return j({Key:'comprobantes/x.jpg'});
  if(u.includes('/clientes')){ if(/cedula=eq.V12345678(&|$)/.test(u))return j({id:3,nombre:'María González',telefono:'584141234567',cedula:'V12345678'}); return j(null); }
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1}); if(u.includes('select=id,nombre'))return j([{id:'u3',nombre:'Yulimar'}]); return j([{usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',orden:3}]);}
  if(u.includes('/rest/v1/ventas')){ if(u.includes('id=eq.30'))return j(ventaEd); if(lentas) await new Promise(x=>setTimeout(x,2500)); return j([ventaCache]); }
  if(u.includes('/catalogo'))return j(modelos);
  if(u.includes('/disponibles'))return j(piezas);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true},{id:2,nombre:'Avenida Universidad',orden:2,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '333333') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await w(500);
 // 1) Venta de exhibición: solo pieza de entrega inmediata
 await p.click('#btnNuevaVenta');await p.waitForURL('**/venta.html');await w(900);
 await p.fill('#cCedula','12.345.678');await w(900);
 await p.click('#btnAgregar');await w();await p.click('[data-origen="pieza"]');await w(400);await p.click('[data-pieza="9"]');await w(400);await p.click('#btnProdListo');await w(400);
 await p.click('#btnGuardar');await w(400);await p.click('#optVenta');await w(600);
 ok('Exhibición: pago completo por defecto',await p.$eval('[data-modo-pago="completo"]',x=>x.classList.contains('selected'))&&await p.$eval('#campoAbono',x=>x.classList.contains('hidden')));
 const hoy=await p.evaluate(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');});
 ok('Exhibición: entrega hoy',(await p.inputValue('#aFecha'))===hoy,await p.inputValue('#aFecha'));
 await p.click('[data-metodo="Efectivo"]');await p.click('#btnConfListo');await w(300);
 ok('Efectivo sin comprobante no deja guardar',await p.$eval('#campoComp',x=>x.classList.contains('invalid'))&&!rpc);
 await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await w(700);
 await p.click('#btnConfListo');await p.waitForSelector('.listo');await w(400);
 ok('Exhibición: se envía el total completo',rpc&&rpc.p.abono.monto===250&&!!rpc.p.abono.comprobante,rpc&&rpc.p.abono);
 ok('Pantalla final dice "Pago"',(await p.textContent('.listo-datos')).includes('Pago (Efectivo)'));
 // 2) Ventana a medida con especificaciones + borrador
 rpc=null;await p.click('#btnOtra');await w(900);
 await p.fill('#cCedula','12.345.678');await w(900);
 await p.click('#btnAgregar');await w();await p.click('[data-origen="medida"]');await w(400);
 await p.click('.opt[data-g="__tipo"][data-v="Ventana"]');await w(300);
 await p.fill('[data-mkey="alto"]','1');await p.fill('[data-mkey="ancho"]','2');
 await p.click('.opt[data-g="__color"][data-v="Negro"]');await w(200);
 await p.fill('#pDesc','Con rejilla');await p.click('#btnProdListo');await w(400);
 const det=await p.textContent('#items .item');
 ok('Tarjeta muestra tipo, color y medidas',det.includes('Ventana a medida')&&det.includes('Negro')&&det.includes('Con rejilla'),det);
 await p.reload();await w(1200);
 ok('Borrador recupera la ventana a medida',(await p.$$('#items .item')).length===1&&(await p.textContent('#items .item')).includes('Negro'));
 await p.click('#items [data-editar="0"]');await w(400);
 ok('Al editar conserva tipo y medidas',await p.$eval('.opt[data-g="__tipo"].selected',x=>x.dataset.v)==='Ventana'&&(await p.inputValue('[data-mkey="ancho"]'))==='2');
 await p.click('#btnProdListo');await w(400);
 await p.click('#btnGuardar');await w(400);await p.click('#optVenta');await w(600);
 ok('Por encargo: pago parcial por defecto',await p.$eval('[data-modo-pago="parcial"]',x=>x.classList.contains('selected')));
 await p.click('[data-metodo="Zelle"]');await p.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await w(700);
 await p.click('#btnConfListo');await p.waitForSelector('.listo');await w(400);
 const it=rpc&&rpc.p.items[0];
 ok('A medida se guarda con tipo y especificaciones (no catálogo)',it&&it.a_medida===true&&it.catalogo_id===null&&it.tipo==='Ventana'&&it.nombre==='Ventana a medida'&&it.especificaciones.alto===1&&it.especificaciones.ancho===2&&it.especificaciones.color==='Negro'&&it.especificaciones.descripcion==='Con rejilla',it);
 ok('Detalle compartido (PDF/seguimiento)',await p.evaluate(()=>AV.detalleItem({a_medida:true,tipo:'Ventana',especificaciones:{alto:1,ancho:2,color:'Negro',aluminio:'Ecobel',descripcion:'Con rejilla'}})).then(t=>t.includes('Negro')&&t.includes('Ecobel')&&t.includes('Con rejilla')));
 ok('Detalle "Otro" sigue igual',(await p.evaluate(()=>AV.detalleItem({a_medida:true,tipo:'A medida',especificaciones:{descripcion:'Reja 1x1'}})))==='Reja 1x1');
 // 3) Editar cotización con ventana a medida y traslado
 await p.goto(H+'venta.html?editar=30');await w(1500);
 ok('Editar: carga traslado y descuento',(await p.inputValue('#vTras'))==='15'&&!(await p.$eval('#campoTras',x=>x.classList.contains('hidden')))&&(await p.inputValue('#vDesc'))==='5');
 await p.click('#items [data-editar="0"]');await w(400);
 ok('Editar: la ventana a medida abre con sus especificaciones',await p.$eval('.opt[data-g="__tipo"].selected',x=>x.dataset.v)==='Ventana'&&await p.$eval('.opt[data-g="aluminio"].selected',x=>x.dataset.v)==='Ecobel');
 ok('Editar: respeta el precio escrito',(await p.inputValue('#pPrecio'))==='180');
 await p.click('#btnProdListo');await w(300);await p.click('#btnGuardar');await w(1200);
 ok('Editar: envía traslado',rpcEd&&rpcEd.p.venta.traslado===15&&rpcEd.p.items[0].especificaciones.aluminio==='Ecobel',rpcEd&&rpcEd.p.venta);
 // 4) Lista desde la copia local
 await p.goto(H+'ventas.html');await p.waitForSelector('.vcard');await w(300);
 ok('Guarda copia local de la lista',await p.evaluate(()=>!!localStorage.getItem('ah_cache_ventas')));
 lentas=true;await p.goto(H+'ventas.html');await w(700);
 ok('Con internet lento, la lista aparece al instante desde la copia',!!(await p.$('.vcard[data-id="21"]')));
 await w(2600);ok('Y sigue ahí al terminar de actualizar',!!(await p.$('.vcard[data-id="21"]')));
 lentas=false;
 // 5) Service worker guarda los archivos con versión
 const cache=await p.evaluate(async()=>{await navigator.serviceWorker.ready;await new Promise(r=>setTimeout(r,300));location.reload;return true;});
 await p.reload();await w(1500);
 const claves=await p.evaluate(async()=>{const c=await caches.open('ah-archivos-v1');return (await c.keys()).map(k=>k.url);});
 ok('Service worker guarda css/js con versión',claves.some(u=>/base\.css\?v=/.test(u))&&claves.some(u=>/comun\.js\?v=/.test(u))&&!claves.some(u=>/\.html/.test(u)),claves.length);
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
