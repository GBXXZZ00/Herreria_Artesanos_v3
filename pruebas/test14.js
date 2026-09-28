const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[{id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF,Negro:GIF},especificaciones_base:{},precio_base:200},{id:5,nombre:'Imperial',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:300}];
const piezas=[{id:9,catalogo_id:4,cantidad:2,estado:'disponible',precio:250,sede_id:1,color:'Blanco',especificaciones:{}}];
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;
function ok(nombre,cond,extra){res.push((cond?'OK   ':'FALLA')+' '+nombre+(extra?'  → '+JSON.stringify(extra):''));if(!cond)fallas++;}
(async()=>{ try{
 const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});
 const err=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=req.url();const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*',...h},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/auth/v1/logout'))return r.fulfill({status:204,body:''});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'}); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/catalogo'))return req.method()==='HEAD'?r.fulfill({status:200,headers:{'content-range':'0-1/2','access-control-expose-headers':'content-range'},body:''}):j(modelos,200,{'content-range':'0-1/2'});
  if(u.includes('/disponibles'))return j(piezas);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>{p._dlg=(p._dlg||0)+1; p._acepta?d.accept():d.dismiss();});
 const est=()=>p.evaluate(()=>({pag:location.pathname.split('/').pop()||'index.html',hojas:[...document.querySelectorAll('.sheet.open')].map(s=>s.id),visor:!!document.querySelector('.visor.open'),volver:!!document.querySelector('.sheet.open .sheet-back'),inicio:!!document.querySelector('#vInicio.entra'),acceso:!!document.querySelector('#vAcceso.entra'),hist:history.length}));
 const atras=async()=>{await p.goBack({waitUntil:'commit'}).catch(()=>{});await p.waitForTimeout(700);};
 const espera=ms=>p.waitForTimeout(ms||450);

 // Entrar
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 let e=await est();ok('Login lleva a Inicio',e.inicio,e);

 // 1. Inicio → Catálogo → atrás = Inicio
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await atras();e=await est();ok('Catálogo + atrás → Inicio',e.pag==='index.html'&&e.inicio,e);
 // Inicio es el tope: atrás sale (no hay otro Inicio ni catálogo detrás)
 await atras();e=await p.evaluate(()=>location.href).catch(()=>'');ok('Inicio + atrás → nada de la app detrás',!/index|catalogo/.test(e),e);
 await p.goForward().catch(()=>{});await espera(800);

 // 2. Hoja de modelo: atrás la cierra y te deja en el catálogo
 await p.goto(H+'index.html');await p.waitForSelector('#vInicio.entra');
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('.card[data-id="5"]');await espera();e=await est();ok('Abre ficha de modelo',e.hojas.includes('sheetDetalle'),e);
 await atras();e=await est();ok('Ficha + atrás → se cierra, sigo en Catálogo',e.pag==='catalogo.html'&&!e.hojas.length,e);

 // 3. Modelo con entrega inmediata: lista → pieza → atrás → lista → atrás → cerrado
 await p.click('.card[data-id="4"]');await espera();
 await p.click('#detalleBody [data-pieza="9"]');await espera();e=await est();ok('Ficha de pieza con Volver',e.volver,e);
 await atras();e=await est();ok('Pieza + atrás → vuelve a la lista (hoja abierta)',e.hojas.includes('sheetDetalle')&&!e.volver&&e.pag==='catalogo.html',e);
 await p.click('#detalleBody [data-ir="modelo"]').catch(()=>{});await espera();e=await est();
 if(e.volver){await atras();e=await est();ok('Modelo (desde lista) + atrás → lista',e.hojas.includes('sheetDetalle')&&!e.volver,e);}
 await atras();e=await est();ok('Lista + atrás → hoja cerrada',!e.hojas.length&&e.pag==='catalogo.html',e);

 // 4. Visor de foto
 await p.click('.card[data-id="5"]');await espera();await p.click('#detalleBody .hero img');await espera();e=await est();ok('Abre foto a pantalla completa',e.visor,e);
 await atras();e=await est();ok('Foto + atrás → cierra foto, ficha sigue',!e.visor&&e.hojas.includes('sheetDetalle'),e);
 await p.click('.visor-x').catch(()=>{});
 await atras();e=await est();ok('Luego atrás → cierra ficha',!e.hojas.length&&e.pag==='catalogo.html',e);

 // 5. Cerrar con la X y luego atrás → Inicio directo (sin pasos fantasma)
 await p.click('.card[data-id="5"]');await espera();await p.click('#sheetDetalle .sheet-x');await espera(600);
 e=await est();ok('X cierra la ficha',!e.hojas.length,e);
 await atras();e=await est();ok('X y luego atrás → Inicio',e.pag==='index.html'&&e.inicio,e);

 // 6. Nuevo modelo: tipo → formulario; atrás cierra; con cambios pregunta
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('#btnNuevo');await espera();await p.click('#tipoGrid [data-elegir]');await espera(600);
 e=await est();ok('Tipo → formulario abierto (sin selector detrás)',e.hojas.length===1&&e.hojas[0]==='sheetForm',e);
 await atras();e=await est();ok('Formulario vacío + atrás → cierra',!e.hojas.length&&e.pag==='catalogo.html',e);
 await p.click('#btnNuevo');await espera();await p.click('#tipoGrid [data-elegir]');await espera(600);
 await p.fill('#fNombre','Prueba');p._acepta=false;p._dlg=0;
 await atras();e=await est();ok('Formulario con cambios + atrás → pregunta y NO cierra si cancelo',p._dlg===1&&e.hojas.includes('sheetForm'),{...e,dialogos:p._dlg});
 p._acepta=true;await atras();e=await est();ok('Atrás otra vez + acepto → cierra',!e.hojas.length&&e.pag==='catalogo.html',e);
 await atras();e=await est();ok('Luego atrás → Inicio',e.pag==='index.html'&&e.inicio,e);

 // 7. Menú de abajo: Catálogo → Inicio por el menú, y atrás desde Inicio no regresa al catálogo
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('#menuModulos a[href="index.html"]');await p.waitForSelector('#vInicio.entra');await espera();
 e=await est();ok('Menú Inicio desde Catálogo → Inicio',e.pag==='index.html',e);
 await atras();e=await p.evaluate(()=>location.href).catch(()=>'');ok('Inicio + atrás no vuelve al catálogo',!/catalogo/.test(e),e);

 // 8. Catálogo abierto directo (sin pasar por Inicio) → atrás lleva a Inicio
 const p2=await ctx.newPage();p2.on('pageerror',e=>err.push('p2:'+e.message));
 await p2.goto(H+'catalogo.html');await p2.waitForSelector('.card');await p2.waitForTimeout(500);
 await p2.goBack({waitUntil:'commit'}).catch(()=>{});await p2.waitForTimeout(1200);
 e=await p2.evaluate(()=>({pag:location.pathname.split('/').pop(),inicio:!!document.querySelector('#vInicio.entra')}));ok('Catálogo directo + atrás → Inicio',e.pag==='index.html'&&e.inicio,e);
 await p2.goBack({waitUntil:'commit'}).catch(()=>{});await p2.waitForTimeout(800);e=await p2.evaluate(()=>location.href).catch(()=>'');ok('…y de ahí atrás ya sale (Inicio es el tope)',!/index|catalogo/.test(e),e);

 // 9. Inicio: hojas de cuenta y PIN
 await p.goto(H+'index.html');await p.waitForSelector('#vInicio.entra');
 await p.click('#btnCuenta');await espera();e=await est();ok('Abre Mi cuenta',e.hojas.includes('sheetCuenta'),e);
 await atras();e=await est();ok('Mi cuenta + atrás → cierra, sigo en Inicio',!e.hojas.length&&e.inicio,e);
 await p.click('#btnCuenta');await espera();await p.click('#btnCambiarPin');await espera(600);e=await est();ok('Cambiar PIN abierto solo',e.hojas.length===1&&e.hojas[0]==='sheetPin',e);
 await atras();e=await est();ok('Cambiar PIN + atrás → cierra',!e.hojas.length&&e.inicio,e);

 // 10. Deslizar la hoja hacia abajo sigue funcionando y no deja pasos fantasma
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('.card[data-id="5"]');await espera();
 await p.evaluate(()=>{const s=document.getElementById('sheetDetalle');const h=s.querySelector('.sheet-handle');const t=(type,y)=>{const tc=new Touch({identifier:1,target:h,clientX:200,clientY:y});h.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[tc],changedTouches:[tc],bubbles:true}));};t('touchstart',300);t('touchmove',360);t('touchmove',480);t('touchend',480);});
 await espera(700);e=await est();ok('Deslizar hacia abajo cierra la ficha',!e.hojas.length,e);
 await atras();e=await est();ok('Luego atrás → Inicio',e.pag==='index.html',e);

 // 11. Catálogo público: categoría → ficha → atrás cierra → atrás a inicio del catálogo
 const p3=await ctx.newPage();p3.on('pageerror',e=>err.push('p3:'+e.message));
 await p3.goto(H+'catalogo-publico.html');await p3.waitForSelector('.ini-tile');await p3.waitForTimeout(500);
 await p3.click('.ini-tile[data-ver="Puerta Multilock"]');await p3.waitForSelector('.card');await p3.waitForTimeout(500);
 await p3.click('.card');await p3.waitForTimeout(500);
 const e3=()=>p3.evaluate(()=>({hash:location.hash,hojas:[...document.querySelectorAll('.sheet.open')].map(s=>s.id),volver:!!document.querySelector('.sheet.open .sheet-back')}));
 e=await e3();ok('Público: abre ficha',e.hojas.length===1,e);
 if(e.volver===false){ /* modelo con piezas abre lista; entra a pieza si existe */ }
 await p3.click('#detalleBody [data-pieza]').catch(()=>{});await p3.waitForTimeout(400);e=await e3();
 if(e.volver){await p3.goBack({waitUntil:'commit'});await p3.waitForTimeout(600);e=await e3();ok('Público: pieza + atrás → lista',e.hojas.length===1&&!e.volver,e);}
 await p3.goBack({waitUntil:'commit'});await p3.waitForTimeout(600);e=await e3();ok('Público: ficha + atrás → cierra, sigo en la categoría',!e.hojas.length&&e.hash.includes('ver='),e);
 await p3.goBack({waitUntil:'commit'});await p3.waitForTimeout(600);e=await e3();ok('Público: atrás → pantalla de inicio del catálogo',!e.hash.includes('ver='),e);

 // 12. Formulario encima de la ficha: cerrar con X, atrás cierra ficha, atrás → Inicio
 await p.goto(H+'index.html');await p.waitForSelector('#vInicio.entra');
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('.card[data-id="5"]');await espera();await p.click('#sheetDetalle [data-accion="marcar"]');await espera(600);
 e=await est();ok('Entrega inmediata abre formulario sobre la ficha',e.hojas.includes('sheetForm')&&e.hojas.includes('sheetDetalle'),e);
 await atras();e=await est();ok('Atrás cierra solo el formulario',!e.hojas.includes('sheetForm')&&e.hojas.includes('sheetDetalle'),e);
 await p.click('#sheetDetalle [data-accion="marcar"]');await espera(600);await p.click('#sheetForm [data-cerrar="sheetForm"]');await espera(600);
 e=await est();ok('X del formulario deja la ficha',e.hojas.length===1&&e.hojas[0]==='sheetDetalle',e);
 await atras();e=await est();ok('Atrás cierra la ficha',!e.hojas.length&&e.pag==='catalogo.html',e);
 await atras();e=await est();ok('Atrás → Inicio',e.pag==='index.html'&&e.inicio,e);

 // 13. Vista interna con su propio paso: el Volver y el atrás coinciden
 await p.goto(H+'index.html');await p.waitForSelector('#vInicio.entra');
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();
 await p.click('.card[data-id="4"]');await espera();
 const d0=await p.evaluate(()=>AH.profundidad());
 await p.click('#detalleBody [data-pieza="9"]');await espera();
 const d1=await p.evaluate(()=>AH.profundidad());ok('Entrar a la pieza agrega un paso',d1===d0+1,{d0,d1});
 await p.click('#sheetDetalle .sheet-back');await espera(600);e=await est();const d2=await p.evaluate(()=>AH.profundidad());
 ok('Tocar Volver regresa a la lista y quita el paso',e.hojas.includes('sheetDetalle')&&!e.volver&&d2===d0,{...e,d2});
 await atras();e=await est();ok('Luego atrás cierra la ficha',!e.hojas.length&&e.pag==='catalogo.html',e);
 await p.click('.card[data-id="4"]');await espera();await p.click('#detalleBody [data-pieza="9"]');await espera();
 await p.click('#sheetDetalle .sheet-x');await espera(600);e=await est();ok('X desde la pieza cierra todo',!e.hojas.length,e);
 await atras();e=await est();ok('Luego atrás → Inicio (sin pasos fantasma)',e.pag==='index.html'&&e.inicio,e);
 await p.click('a.ini-tile[href="catalogo.html"]');await p.waitForSelector('.card');await espera();
 e=await p.evaluate(()=>[...document.querySelectorAll('.card-disp')].map(x=>x.textContent));ok('Etiqueta bajo la foto',e.includes('2 de entrega inmediata'),e);
 await p.screenshot({path:'shots4/9-tarjetas.png'});

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?`${fallas} FALLAS`:'TODO OK');
 await b.close();}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);process.exit(1);} })();
