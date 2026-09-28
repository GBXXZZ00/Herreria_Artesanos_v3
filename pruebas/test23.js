// Catálogo: campo "Categoría de pago" en el formulario del modelo (no en pieza), guarda categoria_pago_id.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[{id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:200,categoria_pago_id:1}];
const piezas=[];
const categorias=[{id:1,nombre:'General'},{id:2,nombre:'Ventana con protección'}];
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const llamadas=[];
(async()=>{ try{
 const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});
 const err=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=req.url();const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*',...h},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'}); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/categorias_pago'))return j(categorias);
  if(u.includes('/catalogo')){
    if(req.method()==='HEAD')return r.fulfill({status:200,headers:{'content-range':'0-1/1','access-control-expose-headers':'content-range'},body:''});
    if(req.method()==='PATCH'){ const body=JSON.parse(req.postData()||'{}'); llamadas.push(['editar',body]); return j({...modelos[0],...body}); }
    if(req.method()==='POST'){ const body=JSON.parse(req.postData()||'{}'); llamadas.push(['crear',body]); return j({...body,id:5},201); }
    return j(modelos,200,{'content-range':'0-1/1'});
  }
  if(u.includes('/disponibles'))return j(piezas);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));
 const espera=ms=>p.waitForTimeout(ms||450);

 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);

 // Editar el modelo existente: el campo se ve y muestra su categoría actual
 await p.click('.card[data-id="4"]');await espera();await p.click('#detalleFoot [data-accion="editar-modelo"]');
 await espera(600);
 ok('Campo Categoría de pago visible al editar un modelo',await p.isVisible('#campoCategoria'));
 ok('Muestra la categoría actual del modelo',(await p.textContent('#categoriaTexto'))==='General');

 // Abrir el selector y cambiar a "Ventana con protección"
 await p.click('#btnCategoria');await p.waitForSelector('#sheetCategoria.open');
 ok('Lista las categorías disponibles más "Sin categoría"',(await p.$$('#listaCategorias .cat-fila-op')).length===3);
 await p.click('#listaCategorias [data-cat="2"]');await espera(300);
 ok('Se cierra el selector y actualiza el texto',!(await p.$('#sheetCategoria.open'))&&(await p.textContent('#categoriaTexto'))==='Ventana con protección');

 await p.click('#btnGuardar');await espera(600);
 const edita=llamadas.find(x=>x[0]==='editar');
 ok('Guarda el modelo con la nueva categoria_pago_id',edita&&edita[1].categoria_pago_id===2,edita&&edita[1]);

 // Nuevo modelo: por defecto "Sin categoría", y puede quedar así (null)
 await p.click('#btnNuevo');await espera();await p.click('#tipoGrid [data-elegir]');await espera(600);
 ok('Nuevo modelo abre con "Sin categoría" por defecto',(await p.textContent('#categoriaTexto'))==='Sin categoría');
 await p.fill('#fNombre','Colonial');await p.fill('#fPrecio','150');
 await p.click('#btnGuardar');await espera(600);
 const crea=llamadas.find(x=>x[0]==='crear');
 ok('Un modelo nuevo sin elegir categoría se guarda con categoria_pago_id null',crea&&crea[1].categoria_pago_id===null,crea&&crea[1]);

 // El campo NO aparece al marcar una pieza de entrega inmediata
 await p.click('.card[data-id="4"]');await espera();await p.click('#detalleFoot [data-accion="marcar"]');await espera(600);
 ok('El campo no aparece en el formulario de pieza',!(await p.isVisible('#campoCategoria')));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?`${fallas} FALLAS`:'TODO OK');
 await b.close();}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);process.exit(1);} })();
