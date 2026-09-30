// Ventas: "Solo protección" (sin ventana, con su precio) y monto del marco decorativo
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u3',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u3',aud:'authenticated',role:'authenticated',email:'yulimar@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[
 {id:6,nombre:'Ventana Clásica',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{papel_ahumado:true,color_ahumado:'Espejo',proteccion:false},precio_base:0},
 {id:7,nombre:'Ventana Protegida',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{papel_ahumado:false,proteccion:true},precio_base:0},
 {id:10,nombre:'Recta',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,marco_decorativo:false,proteccion:false},precio_base:200}];
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
const venta5={id:5,cliente_id:3,estado:'cotizacion',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,traslado:0,subtotal:130,total:130,notas:null,vence_en:null,fecha_entrega:null,confirmada_en:null,creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),token_seguimiento:'aaaaaaaa-bbbb-4ccc-8ddd-000000000005',
 items:[{id:1,venta_id:5,catalogo_id:7,pieza_id:null,a_medida:false,tipo:'Ventana',nombre:'Ventana Protegida',especificaciones:{alto:1,ancho:1,proteccion:true,aluminio:'Solo protección',marco_decorativo:true,color:'Blanco',monto_proteccion_sola:100,monto_marco:30},foto:GIF,precio_unitario:130,cantidad:1,orden:0}],abonos:[],cliente:cli,sede:{id:1,nombre:'Cumbres de Maracaibo'}};
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13']});const err=[];const rpcs=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
    if(name==='crear_venta')return j({id:8,estado:'cotizacion',total:1,cliente_id:3});
    if(name==='actualizar_venta')return j({id:5,estado:'cotizacion',total:1});
    return j({});}
  if(u.includes('/ventas'))return j(venta5);
  if(u.includes('/clientes')){ if(/cedula=eq.V12345678(&|$)/.test(u))return j(cli); return j(null); }
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1}); return j([{usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',orden:3}]);}
  if(u.includes('/catalogo'))return j(modelos);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '333333') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await w(500);
 await p.goto(H+'venta.html');await w(1200);
 await p.fill('#cCedula','12.345.678');await w(900);
 // Ventana sin protección: no ofrece "Solo protección"
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="6"]');await w(500);
 ok('Ventana sin protección: solo Panorámica y Ecobel',(await p.$$eval('.opt[data-g="aluminio"]',x=>x.map(y=>y.dataset.v))).join()==='Panorámica,Ecobel');
 await p.click('#sheetProducto .icon-btn[data-cerrar]');await w(500);
 // Ventana con protección: tres opciones
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="7"]');await w(500);
 ok('Ventana con protección: Panorámica, Ecobel y Solo protección',(await p.$$eval('.opt[data-g="aluminio"]',x=>x.map(y=>y.dataset.v))).join()==='Panorámica,Ecobel,Solo protección');
 const ins=await p.$$('#prodBody [data-mkey]');await ins[0].fill('1');await ins[1].fill('1');await w(200);
 // Ir y volver: lo que tenía (más de 2 hojas) no se pierde
 await p.click('.opt[data-g="aluminio"][data-v="Ecobel"]');await w(200);await p.click('.tchip[data-k="mas_hojas"]');await w(200);
 await p.click('.opt[data-g="aluminio"][data-v="Solo protección"]');await w(200);await p.click('.opt[data-g="aluminio"][data-v="Ecobel"]');await w(200);
 ok('Volver a Ecobel devuelve "Más de 2 hojas"',await p.$eval('.tchip[data-k="mas_hojas"]',x=>x.classList.contains('on')));
 await p.click('.tchip[data-k="mas_hojas"]');await w(200);
 await p.click('.opt[data-g="aluminio"][data-v="Solo protección"]');await w(300);
 ok('Solo protección: pide su precio y quita el ahumado y las hojas',await p.isVisible('#campoSoloProt')&&!(await p.$('.opt[data-g="ahumado"]'))&&!(await p.$('.tchip[data-k="mas_hojas"]'))&&(await p.textContent('#campoSoloProt')).includes('No se instala'));
 await p.click('#btnProdListo');await w(300);
 ok('Sin el precio no se agrega',await p.$eval('#campoSoloProt',x=>x.classList.contains('invalid'))&&await p.isVisible('#sheetProducto'));
 await p.fill('#pSoloProt','100');await w(200);
 ok('El precio es el de la protección sola',(await p.inputValue('#pPrecio'))==='100',await p.inputValue('#pPrecio'));
 await p.click('.tchip[data-k="marco_decorativo"]');await w(300);
 ok('Marco decorativo: aparece su casilla de monto',await p.isVisible('#campoMarco'));
 await p.click('#btnProdListo');await w(300);
 ok('Sin el monto del marco no se agrega',await p.$eval('#campoMarco',x=>x.classList.contains('invalid')));
 await p.fill('#pMarco','30');await w(200);
 ok('Suma el marco: 100 + 30',(await p.inputValue('#pPrecio'))==='130',await p.inputValue('#pPrecio'));
 await p.screenshot({path:'shots5/s1-solo-proteccion.png'});
 await p.click('#btnProdListo');await w(500);
 ok('Resumen dice Solo protección',(await p.textContent('#items')).includes('Solo protección (sin ventana) · Marco decorativo')&&!(await p.textContent('#items')).includes('· Protección'),await p.textContent('#items'));
 // Puerta sin marco en el modelo: marcarlo pide el monto
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="10"]');await w(500);
 ok('Puerta: sin marco no pide monto',!(await p.$('#campoMarco')));
 await p.click('.tchip[data-k="marco_decorativo"]');await w(300);
 await p.click('#btnProdListo');await w(300);
 ok('Puerta con marco: pide el monto',await p.$eval('#campoMarco',x=>x.classList.contains('invalid')));
 await p.fill('#pMarco','25');await w(200);
 ok('Puerta: 200 + 25',(await p.inputValue('#pPrecio'))==='225',await p.inputValue('#pPrecio'));
 await p.click('#btnProdListo');await w(500);
 await p.click('#btnGuardar');await w(1500);
 const cv=rpcs.find(x=>x[0]==='crear_venta');const it=cv&&cv[1].p.items;
 ok('Guarda Solo protección con su precio y el marco',it&&it[0].especificaciones.aluminio==='Solo protección'&&it[0].especificaciones.monto_proteccion_sola===100&&it[0].especificaciones.monto_marco===30&&it[0].precio_unitario===130,it&&it[0]);
 ok('Guarda el monto del marco de la puerta',it&&it[1].especificaciones.monto_marco===25&&it[1].especificaciones.monto_proteccion_sola===undefined,it&&it[1].especificaciones);
 // A medida: la protección sola también pide su precio
 await p.goto(H+'venta.html');await w(1200);
 await p.click('#btnAgregar');await w();await p.click('[data-origen="medida"]');await w();
 await p.click('.opt[data-g="__tipo"][data-v="Ventana"]');await w(300);
 const im=await p.$$('#prodBody [data-mkey]');await im[0].fill('1');await im[1].fill('1');await w(200);
 await p.click('.tchip[data-k="proteccion"]');await w(300);
 await p.click('.opt[data-g="aluminio"][data-v="Solo protección"]');await w(300);
 await p.fill('#pSoloProt','90');await w(200);
 ok('A medida: Solo protección toma su precio',(await p.inputValue('#pPrecio'))==='90',await p.inputValue('#pPrecio'));
 // Editar: carga los montos guardados
 await p.goto(H+'venta.html?editar=5');await w(1500);
 await p.click('#items [data-editar="0"]');await w(500);
 ok('Editar: trae el precio de la protección sola y del marco',(await p.inputValue('#pSoloProt'))==='100'&&(await p.inputValue('#pMarco'))==='30',[await p.inputValue('#pSoloProt').catch(()=>null),await p.inputValue('#pMarco').catch(()=>null)]);
 await p.click('#btnProdListo');await w(400);
 await p.click('#btnGuardar');await w(1500);
 const av=rpcs.find(x=>x[0]==='actualizar_venta');
 ok('Editar: no pierde los montos',av&&av[1].p.items[0].especificaciones.monto_proteccion_sola===100&&av[1].p.items[0].especificaciones.monto_marco===30,av&&av[1].p.items[0].especificaciones);
 ok('Errores JS',!err.length,err);
 console.log(res.join('\n'));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
