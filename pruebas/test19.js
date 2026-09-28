// Aviso 1/2 → confirmar ya abierto; el paso "Mensaje" reacciona a pagos confirmados; el
// resaltado al llegar desde un aviso; y la nueva cuadrícula de "Más opciones".
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
// v3: pago por confirmar (para el enlace "confirmar ya abierto")
const v3={id:3,cliente_id:3,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,subtotal:150,total:150,vence_en:dia(-5),fecha_entrega:dia(20),confirmada_en:new Date().toISOString(),creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),token_seguimiento:'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',produccion_pedida_en:null,
 items:[{id:9,nombre:'Imperial',tipo:'Puerta Multilock',especificaciones:{},foto:GIF,precio_unitario:150,cantidad:1,orden:0}],
 abonos:[{id:5,monto:150,metodo:'Zelle',tipo:'abono',estado:'por_confirmar',registrado_por:'u3',fecha:new Date().toISOString()}]};
// v4: mensaje ya enviado, pero DESPUÉS se confirmó un pago → el paso "Mensaje" debe verse pendiente
const v4={id:4,cliente_id:3,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,subtotal:200,total:200,vence_en:dia(-5),fecha_entrega:dia(20),confirmada_en:new Date(Date.now()-2*864e5).toISOString(),creado_en:new Date(Date.now()-2*864e5).toISOString(),actualizado_en:new Date().toISOString(),token_seguimiento:'aaaaaaaa-bbbb-4ccc-8ddd-000000000004',produccion_pedida_en:null,
 mensaje_en:new Date(Date.now()-2*864e5).toISOString(),mensaje_estado:'confirmada',
 items:[{id:9,nombre:'Imperial',tipo:'Puerta Multilock',especificaciones:{},foto:GIF,precio_unitario:200,cantidad:1,orden:0}],
 abonos:[{id:7,monto:200,metodo:'Zelle',tipo:'abono',estado:'confirmado',registrado_por:'u3',confirmado_en:new Date(Date.now()-3600e3).toISOString(),fecha:new Date(Date.now()-2*864e5).toISOString()}]};
const VENTAS={3:v3,4:v4};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const rpcs=[];
function mock(ctx,user,rol,confirma){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a,user]);return j({});}
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:'x',nombre:rol==='admin'?(confirma?'Ray':'Gualfredo'):'Yulimar',rol,sede_id:1,confirma_abonos:confirma}); if(u.includes('select=id,nombre'))return j([{id:'u2',nombre:'Ray'},{id:'u3',nombre:'Yulimar'}]); return j([{usuario:'x',nombre:'x',rol,orden:1}]);}
  if(u.includes('/ventas')){ const full=v=>Object.assign({},v,{cliente:cli,sede:{id:1,nombre:'Cumbres'}}); const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full(VENTAS[+m[1]])); return j(Object.values(VENTAS).map(full)); }
  if(u.includes('/abonos'))return j([]);
  if(u.includes('/catalogo'))return j([]);
  if(u.includes('/disponibles'))return j([]);
  return j([]);});}
async function entrar(page){
 await page.goto('http://127.0.0.1:8765/index.html');await page.waitForSelector('.quien-btn');await page.click('.quien-btn');
 for(const d of '111111') await page.click(`#pinTeclado [data-t="${d}"]`);
 await page.waitForSelector('#vInicio.entra');
}
(async()=>{ const b=await chromium.launch(); try{
 const err=[];
 // Ray (confirma_abonos:true) toca el enlace del aviso "Nuevo pago" → confirmar ya abierto
 const c1=await b.newContext({...devices['iPhone 13']});await mock(c1,'u2','admin',true);
 const p1=await c1.newPage();p1.on('pageerror',e=>err.push('ray:'+e.message));
 await entrar(p1);
 await p1.goto('http://127.0.0.1:8765/ventas.html?abrir=3&confirmar=5');
 await p1.waitForSelector('#sheetAccion.open',{timeout:8000});
 ok('Ray: enlace del aviso abre "Confirmar pago" ya lista',(await p1.textContent('#accionTitulo'))==='Confirmar pago');
 ok('Ray: muestra el pago correcto',(await p1.textContent('#accionBody')).includes('150'));
 ok('La dirección se limpia (no reabre al refrescar)',!p1.url().includes('confirmar='));
 await p1.screenshot({path:'shots4/s5-confirmar-desde-aviso.png'});

 // Gualfredo (admin, confirma_abonos:false) toca el mismo tipo de enlace → NO se abre confirmar (no puede)
 const c2=await b.newContext({...devices['iPhone 13']});await mock(c2,'u1','admin',false);
 const p2=await c2.newPage();p2.on('pageerror',e=>err.push('gualfredo:'+e.message));
 await entrar(p2);
 await p2.goto('http://127.0.0.1:8765/ventas.html?abrir=3&confirmar=5');
 await p2.waitForSelector('#sheetFicha.open');await p2.waitForTimeout(1200);
 ok('Gualfredo: no puede confirmar, se queda solo en la ficha',!(await p2.$eval('#sheetAccion',x=>x.classList.contains('open'))));

 // Mensaje: si se confirmó un pago después del último mensaje, el paso vuelve a pendiente
 const c3=await b.newContext({...devices['iPhone 13']});await mock(c3,'u2','admin',true);
 const p3=await c3.newPage();p3.on('pageerror',e=>err.push('mensaje:'+e.message));
 await entrar(p3);
 await p3.goto('http://127.0.0.1:8765/ventas.html?abrir=4');
 await p3.waitForSelector('#sheetFicha.open');await p3.waitForTimeout(1200);
 ok('Paso "Mensaje" pendiente tras confirmar un pago nuevo',!(await p3.$eval('#fichaBody .paso3[data-accion="mensaje"]',x=>x.classList.contains('hecho'))));
 ok('Resaltado se aplica al llegar desde el aviso',await p3.$eval('#fichaBody .paso3[data-accion="mensaje"]',x=>x.classList.contains('resaltar')));
 await p3.waitForTimeout(1800);
 ok('Resaltado se quita solo después de un rato',!(await p3.$eval('#fichaBody .paso3[data-accion="mensaje"]',x=>x.classList.contains('resaltar'))));

 // Más opciones: cuadrícula de botones en vez de lista de texto
 await p3.click('#fichaBody details[data-sec="mas"] summary');await p3.waitForTimeout(300);
 ok('4 botones en la cuadrícula (venta editable)',(await p3.$$('#fichaBody .grid-acciones .btn-grid')).length===4);
 ok('Botón "Cancelar venta" separado abajo',(await p3.textContent('#fichaBody .btn-peligro')).includes('Cancelar venta'));
 ok('Sin "Devolver a…" (es el primer estado)',!(await p3.$('#fichaBody .f-link-chico')));
 await p3.screenshot({path:'shots4/s6-mas-opciones.png'});

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
