// Categorías de pago: "Asignar a modelos" (varios a la vez) sin equivocarse.
// Primero salen los sin categoría; en "Todos" se ve la de cada uno; los que ya están en
// esta no se marcan; si uno cambia de categoría se avisa y se confirma.
// También: Catálogo ya no tiene "Elegir varios", y el aviso de Inicio lleva aquí.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const modelos=[
  {id:1,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:200,categoria_pago_id:null},
  {id:2,nombre:'Imperial',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:300,categoria_pago_id:null},
  {id:3,nombre:'Colonial',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:250,categoria_pago_id:7},
  {id:4,nombre:'Ventana Simple',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:90,categoria_pago_id:8},
  {id:5,nombre:'Combo Real',tipo:'Combo',fotos:{},especificaciones_base:{},precio_base:700,categoria_pago_id:null}
];
const categorias=[{id:7,nombre:'General',tarifas:{herrero:{monto:25,modo:'fijo'}},activo:true},{id:8,nombre:'Ventanas',tarifas:{ventanero:{monto:10,modo:'fijo'}},activo:true}];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...h},body:JSON.stringify(x)});
  const head=(n)=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:'ray',nombre:'Ray',rol}); return j([{usuario:'ray',nombre:'Ray',rol,orden:1}]);}
  if(u.includes('/rpc/asignar_categoria_modelos')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(body);
    body.ids.forEach(id=>{const m=modelos.find(x=>x.id===id);if(m)m.categoria_pago_id=body.cid;});
    return j(body.ids.length);
  }
  if(u.includes('/categorias_pago'))return req.method()==='HEAD'?head(2):j(categorias);
  if(u.includes('/catalogo')){
    if(req.method()==='HEAD')return head(u.includes('is.null')?modelos.filter(m=>!m.categoria_pago_id).length:modelos.length);
    return j(modelos);
  }
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,'u2','admin');
 const a=await ctx.newPage();a.on('pageerror',e=>err.push(e.message));a._dlg=[];a.on('dialog',d=>{a._dlg.push(d.message());d.accept();});
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');await a.waitForSelector('.pend-fila');

 // El pendiente de Inicio lleva a Categorías de pago
 ok('Inicio: "3 modelos sin categoría" lleva a Categorías de pago',!!(await a.$('a.pend-fila[href="categorias-pago.html"]')));
 await a.click('a.pend-fila[href="categorias-pago.html"]');await a.waitForSelector('.c-card');
 ok('Arriba avisa cuántos modelos no tienen categoría',(await a.textContent('#avisoSin')).includes('3 modelos sin categoría'));
 ok('Cada categoría dice en cuántos modelos se usa',(await a.textContent('#lista')).includes('Usada en 1 modelo del catálogo'));
 await a.screenshot({path:'shots5/k0-lista.png'});

 // Abrir "General" y asignar a modelos
 await a.click('.c-card >> text=General');await a.waitForSelector('#sheetFicha.open');
 ok('La ficha tiene "Asignar a modelos" con cuántos usan y cuántos faltan',(await a.textContent('#btnAsignarModelos')).includes('Usada en 1 modelo') && (await a.textContent('#btnAsignarModelos')).includes('3 sin categoría'));
 await a.click('#btnAsignarModelos');await a.waitForSelector('#sheetModelos.open');
 ok('Abre en "Sin categoría" con solo los 3 que no tienen',(await a.textContent('#chipsModelos .chip.active')).includes('Sin categoría · 3') && (await a.$$('#listaModelos .m-fila')).length===3);
 ok('Botón desactivado sin marcar nada',await a.$eval('#btnAsignar',x=>x.disabled));
 await a.click('.m-fila[data-mid="1"]');await a.click('.m-fila[data-mid="2"]');
 ok('Al marcar 2, el botón dice "Asignar a 2 modelos"',(await a.textContent('#btnAsignar'))==='Asignar a 2 modelos');
 await a.screenshot({path:'shots5/k1-sin.png'});

 // Pestaña "Todos": se ve la categoría de cada uno
 await a.click('[data-pestana="todos"]');await a.waitForTimeout(150);
 const todos=await a.textContent('#listaModelos');
 ok('En "Todos" se ven los 5 con su categoría',(await a.$$('#listaModelos .m-fila')).length===5 && todos.includes('Tiene: Ventanas'));
 ok('El que ya está en General sale con ✓ y no se puede marcar',todos.includes('Ya está en General') && await a.$eval('.m-fila[data-mid="3"]',x=>x.disabled));
 ok('Al cambiar de pestaña no quedan marcados escondidos',(await a.$$('.m-fila.sel')).length===0 && (await a.textContent('#btnAsignar'))==='Elige los modelos');
 await a.click('.m-fila[data-mid="1"]');await a.click('.m-fila[data-mid="2"]');
 await a.click('.m-fila[data-mid="4"]');await a.waitForTimeout(100);
 ok('Marcar uno con otra categoría avisa que pasará de Ventanas a General',(await a.textContent('.m-fila[data-mid="4"]')).includes('Pasará de Ventanas a General'));
 await a.screenshot({path:'shots5/k2-todos.png'});

 // Confirmación antes de cambiar una categoría
 a._dlg=[];
 await a.click('#btnAsignar');await a.waitForTimeout(800);
 ok('Pregunta antes de cambiar la categoría de uno que ya tenía',a._dlg.length===1 && a._dlg[0].includes('1 modelo ya tiene otra categoría'),a._dlg);
 ok('Se guardan los 3 marcados con General',llamadas.length===1 && JSON.stringify(llamadas[0].ids.sort())==='[1,2,4]' && llamadas[0].cid===7,llamadas[0]);
 ok('La hoja se cierra y General dice "Usada en 4 modelos"',!(await a.$('#sheetModelos.open')) && (await a.textContent('#asigSub')).includes('Usada en 4 modelos'));

 // Si todos estaban sin categoría, no pregunta
 await a.click('#btnAsignarModelos');await a.waitForSelector('#sheetModelos.open');
 ok('Queda 1 sin categoría',(await a.$$('#listaModelos .m-fila')).length===1);
 a._dlg=[];
 await a.click('#btnMarcarTodos');await a.click('#btnAsignar');await a.waitForTimeout(800);
 ok('Sin cambios de categoría, guarda directo sin preguntar',a._dlg.length===0 && llamadas.length===2 && llamadas[1].ids[0]===5);
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(400);
 ok('El aviso de arriba desaparece cuando todos tienen categoría',(await a.textContent('#avisoSin')).trim()==='');

 // Nombre vacío: el error se ve debajo del campo
 await a.click('#btnNuevo');await a.waitForSelector('#sheetFicha.open');
 ok('Una categoría nueva todavía no muestra "Asignar a modelos"',!(await a.isVisible('#btnAsignarModelos')));
 await a.click('#btnGuardar');await a.waitForTimeout(150);
 ok('Sin nombre, el error se ve debajo del campo',await a.isVisible('#eNombre'));

 // Catálogo ya no tiene "Elegir varios"
 await a.goto('http://127.0.0.1:8765/catalogo.html');await a.waitForSelector('.card');
 ok('Catálogo ya no tiene "Elegir varios"',!(await a.$('#btnElegir')) && !(await a.textContent('#chips')).includes('Sin categoría'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
