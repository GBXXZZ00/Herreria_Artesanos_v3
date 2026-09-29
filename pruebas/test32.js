// Catálogo: una ventana de entrega inmediata no se guarda sin su aluminio
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[{id:7,nombre:'Ventana Clásica',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{alto:1,ancho:1,papel_ahumado:true,color_ahumado:'Espejo',proteccion:false},precio_base:0}];
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
let insertada=null;
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13']});const err=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=req.url();const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*',...h},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'}); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/catalogo'))return req.method()==='HEAD'?r.fulfill({status:200,headers:{'content-range':'0-1/1','access-control-expose-headers':'content-range'},body:''}):j(modelos,200,{'content-range':'0-1/1'});
  if(u.includes('/disponibles')){ if(req.method()==='POST'){insertada=JSON.parse(req.postData());const f=Array.isArray(insertada)?insertada[0]:insertada;return j(Object.assign({id:50},f));} return j([]); }
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
 const w=ms=>p.waitForTimeout(ms||450);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await w();
 const todos=await p.$('.chip[data-cat="Todos"]');if(todos){await todos.click();await w(300);}
 await p.click('.card[data-id="7"]');await w();await p.click('#sheetDetalle [data-accion="marcar"]');await w(700);
 ok('El aluminio no viene marcado',!!(await p.$('#specs .opt[data-g="aluminio"]'))&&!(await p.$('#specs .opt[data-g="aluminio"].selected')));
 await p.fill('#fPrecio','150');await p.click('#btnGuardar');await w(500);
 ok('Sin aluminio no se guarda y lo marca en rojo',!insertada&&await p.$eval('#specs [data-campo="aluminio"]',x=>x.classList.contains('invalid')));
 await p.screenshot({path:'shots5/k1-ventana-sin-aluminio.png'});
 await p.click('#specs .opt[data-g="aluminio"][data-v="Ecobel"]');await w(200);
 ok('Al elegirlo se quita el rojo',!(await p.$eval('#specs [data-campo="aluminio"]',x=>x.classList.contains('invalid'))));
 await p.click('#btnGuardar');await w(1200);
 const f=insertada&&(Array.isArray(insertada)?insertada[0]:insertada);
 ok('Se guarda con su aluminio',f&&f.especificaciones.aluminio==='Ecobel',f&&f.especificaciones);
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
