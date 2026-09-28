// Catálogo: elegir varios modelos y darles la misma categoría de pago (solo admin).
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
  {id:4,nombre:'Ventana Simple',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:90,categoria_pago_id:null}
];
const categorias=[{id:7,nombre:'General'},{id:8,nombre:'Ventanas'}];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...h},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:rol==='admin'?'ray':'yuli',nombre:rol==='admin'?'Ray':'Yulimar',rol}); return j([{usuario:rol==='admin'?'ray':'yuli',nombre:rol==='admin'?'Ray':'Yulimar',rol,orden:1}]);}
  if(u.includes('/rpc/asignar_categoria_modelos')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(body);
    body.ids.forEach(id=>{const m=modelos.find(x=>x.id===id);if(m)m.categoria_pago_id=body.cid;});
    return j(body.ids.length);
  }
  if(u.includes('/categorias_pago'))return j(rol==='admin'?categorias:[]);
  if(u.includes('/catalogo'))return req.method()==='HEAD'?r.fulfill({status:200,headers:{'content-range':'0-3/4','access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''}):j(modelos,200,{'content-range':'0-3/4'});
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});}

async function entrar(b,user,rol,pin){
  const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,user,rol);
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of pin) await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');
  return p;
}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // Vendedora: no ve el botón de elegir ni el filtro
 const y=await entrar(b,'u3','vendedor','333333');y.on('pageerror',e=>err.push('vend:'+e.message));
 await y.goto('http://127.0.0.1:8765/catalogo.html');await y.waitForSelector('.card');await y.waitForTimeout(400);
 ok('Vendedora no ve el botón "Elegir varios"',!(await y.isVisible('#btnElegir')));
 ok('Vendedora no ve el filtro "Sin categoría de pago"',!(await y.textContent('#chips')).includes('Sin categoría'));

 // Admin
 const a=await entrar(b,'u2','admin','222222');a.on('pageerror',e=>err.push('admin:'+e.message));
 await a.goto('http://127.0.0.1:8765/catalogo.html');await a.waitForSelector('.card');await a.waitForTimeout(400);
 ok('Admin ve el botón "Elegir varios" con texto',await a.isVisible('#btnElegir') && (await a.textContent('#btnElegir')).includes('Elegir varios'));
 await a.screenshot({path:'shots5/c3b-boton.png'});
 ok('Filtro "Sin categoría de pago · 3"',(await a.textContent('#chips')).includes('Sin categoría de pago · 3'));
 await a.click('.chip[data-cat="Sin categoría"]');await a.waitForTimeout(300);
 ok('El filtro muestra solo los 3 sin categoría',(await a.$$('.card')).length===3);

 // Modo elegir
 await a.click('#btnElegir');await a.waitForTimeout(300);
 ok('El botón dice "Listo" mientras eliges',(await a.textContent('#btnElegir')).trim()==='Listo');
 ok('Aparece la barra y se esconde el menú',await a.evaluate(()=>document.body.classList.contains('eligiendo')));
 ok('Cada tarjeta muestra su casilla y "Sin categoría"',(await a.$$('.card-check')).length===3 && (await a.textContent('#grid')).includes('Sin categoría'));
 ok('"Dar categoría" desactivado sin elegir nada',await a.$eval('#btnSelAsignar',x=>x.disabled));
 await a.click('.card[data-id="1"]');await a.click('.card[data-id="4"]');
 ok('Dos tarjetas marcadas',(await a.$$('.card.sel')).length===2 && (await a.textContent('#selN'))==='2 elegidos');
 ok('Tocar una tarjeta NO abre la ficha',!(await a.$('#sheetDetalle.open')));
 await a.screenshot({path:'shots5/c4-elegir.png'});
 await a.click('#btnSelTodos');await a.waitForTimeout(200);
 ok('"Elegir todos los que ves" marca los 3',(await a.$$('.card.sel')).length===3 && (await a.textContent('#btnSelTodos'))==='Quitar todos');
 await a.click('#btnSelTodos');await a.waitForTimeout(200);
 ok('"Quitar todos" los desmarca',(await a.$$('.card.sel')).length===0);
 await a.click('.card[data-id="1"]');await a.click('.card[data-id="2"]');

 await a.click('#btnSelAsignar');await a.waitForSelector('#sheetCategoria.open');
 ok('El selector dice para cuántos modelos es',(await a.textContent('#categoriaTitulo'))==='Categoría para 2 modelos');
 ok('Ofrece las 2 categorías y "Quitarles la categoría"',(await a.$$('#listaCategorias .cat-fila-op')).length===3 && (await a.textContent('#listaCategorias')).includes('Quitarles la categoría'));
 await a.screenshot({path:'shots5/c5-selector.png'});
 await a.click('#listaCategorias [data-cat="7"]');await a.waitForTimeout(600);
 ok('Se llamó al servidor con los 2 modelos y la categoría',llamadas.length===1&&JSON.stringify(llamadas[0].ids.sort())==='[1,2]'&&llamadas[0].cid===7,llamadas[0]);
 ok('Sale del modo elegir',!(await a.evaluate(()=>document.body.classList.contains('eligiendo'))));
 ok('Queda 1 sin categoría en el filtro',(await a.textContent('#chips')).includes('Sin categoría de pago · 1') && (await a.$$('.card')).length===1);
 await a.screenshot({path:'shots5/c6-listo.png'});

 // Desde el aviso de Inicio: entra directo al filtro y en modo elegir
 await a.goto('http://127.0.0.1:8765/catalogo.html?filtro=sin-categoria');await a.waitForSelector('.card');await a.waitForTimeout(400);
 ok('Con ?filtro=sin-categoria abre el filtro ya eligiendo',await a.evaluate(()=>document.body.classList.contains('eligiendo')) && (await a.$$('.card')).length===1);
 await a.click('.card[data-id="4"]');await a.click('#btnSelAsignar');await a.waitForSelector('#sheetCategoria.open');
 await a.click('#listaCategorias [data-cat="8"]');await a.waitForTimeout(600);
 ok('Asignar el último deja todo con categoría y vuelve a "Todos"',!(await a.textContent('#chips')).includes('Sin categoría') && (await a.$$('.card')).length===4);

 // Tocar una tarjeta fuera del modo elegir sigue abriendo la ficha
 await a.click('.card[data-id="3"]');await a.waitForTimeout(400);
 ok('Fuera del modo elegir, la tarjeta abre la ficha',!!(await a.$('#sheetDetalle.open')));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
