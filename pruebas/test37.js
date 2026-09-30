// Ayuda en la app: botón "Ayuda" (libro con su palabra) al lado del botón de cada pantalla,
// que también lleva su palabra. Sale solo lo de esa pantalla y según quién entró.
// Página "Manuales de uso" (ayuda.html) con los manuales que le tocan a cada quien.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const modelos=[{id:1,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{},especificaciones_base:{},precio_base:200,activo:true}];
const ROLES={admin:{nombre:'Gualfredo',usuario:'gualfredo'},vendedor:{nombre:'Yulimar',usuario:'yulimar'},trabajador:{nombre:'Jesús',usuario:'jesus',especialidad:['Hierro']}};

async function entrar(b, rol, err, extra){
 const P={id:'u1',activo:true,confirma_abonos:false,rol,...ROLES[rol],...(extra||{})};
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
 const user={id:'u1',aud:'authenticated',role:'authenticated',email:P.usuario+'@artesanos.app',user_metadata:{}};
 const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const u=decodeURIComponent(r.request().url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/'))return j([]);
  if(u.includes('/catalogo'))return j(modelos);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(P); return j([{usuario:P.usuario,nombre:P.nombre,rol,orden:1}]);}
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(rol+': '+e.message));p.on('dialog',d=>d.accept());
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 return {ctx,p};
}
const bloques=p=>p.$$eval('#ayudaBody > section',x=>x.map(s=>s.dataset.b));
async function abrirAyuda(p, sel){
 await p.click(sel);
 await p.waitForSelector('#sheetAyuda.open');
 await p.waitForFunction(()=>!document.querySelector('#ayudaBody .ayuda-cargando'));
 await p.waitForTimeout(350);
}
async function cerrarAyuda(p){ await p.click('#sheetAyuda [data-cerrar="sheetAyuda"]'); await p.waitForTimeout(450); }

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // ---------------- Administrador ----------------
 let {ctx,p}=await entrar(b,'admin',err);
 const w=ms=>p.waitForTimeout(ms||400);
 // Inicio: Ayuda al lado de "Mi cuenta"
 ok('Inicio: Ayuda y Mi cuenta juntos, cada uno con su palabra',await p.$$eval('#topbar .ayuda-par',x=>x.length===1&&x[0].querySelector('.ayuda-btn .ayuda-pal').textContent==='Ayuda'&&x[0].querySelector('.ayuda-col #btnCuenta')&&x[0].querySelector('.ayuda-col .ayuda-pal').textContent==='Mi cuenta'));
 await p.screenshot({path:'shots6/a1-inicio-boton.png'});
 await abrirAyuda(p,'#topbar .ayuda-btn');
 let bs=await bloques(p);
 ok('Inicio admin: avisos, pendientes y los avisos del taller',bs.includes('activar-los-avisos-en-el-celular')&&bs.includes('pendientes')&&bs.includes('los-avisos-que-le-llegan-al-taller-admin'),bs);
 ok('Título con el módulo',(await p.textContent('#ayudaMod'))==='Ayuda · Inicio y avisos',await p.textContent('#ayudaMod'));
 ok('Las fotos salen de assets/ayuda/img con versión',await p.$$eval('#ayudaBody img',x=>x.length>0&&x.every(i=>/assets\/ayuda\/img\/.+\?v=\d+/.test(i.getAttribute('src'))&&i.loading==='lazy')));
 ok('Desde la barra sí se ofrece el manual completo',await p.isVisible('#ayudaTodo'));
 ok('"Ver el manual completo" lleva al manual de Inicio',(await p.getAttribute('#ayudaTodo','href'))==='ayuda.html?m=inicio');
 await p.screenshot({path:'shots6/a2-inicio-hoja.png'});
 await cerrarAyuda(p);
 ok('Se cierra y Mi cuenta sigue funcionando',!(await p.$('#sheetAyuda.open')));
 await p.click('#btnCuenta'); await w(500);
 ok('Mi cuenta tiene "Manuales de uso"',await p.isVisible('#btnManuales'));
 await p.screenshot({path:'shots6/a3-cuenta.png'});
 await p.click('#btnManuales'); await p.waitForSelector('.m-item');
 let mods=await p.$$eval('.m-item',x=>x.map(a=>a.getAttribute('href').split('m=')[1]));
 ok('Admin ve los 10 manuales',mods.length===10&&mods.includes('nomina')&&mods.includes('admin')&&mods.includes('taller'),mods);
 await p.screenshot({path:'shots6/a4-manuales.png'});
 await p.click('.m-item[href$="m=catalogo"]'); await p.waitForSelector('.m-manual section',{state:'attached'});
 ok('Manual completo del catálogo, sin repetir los bloques de cada tipo',await p.$$eval('.m-manual > section',x=>x.length>=10&&x.some(s=>s.dataset.b==='segun-el-tipo')&&!x.some(s=>s.dataset.b.startsWith('tipo-'))));
 ok('Estilos del manual no chocan con los de la app (recuadro de portada normal)',await p.$eval('.m-manual .ay-hero',x=>x.getBoundingClientRect().height<300&&getComputedStyle(x).aspectRatio==='auto'));
 ok('Título del manual',(await p.textContent('#titulo'))==='Catálogo');
 await p.screenshot({path:'shots6/a5-manual-catalogo.png'});
 await p.click('#btnVolver'); await p.waitForSelector('.m-item');
 ok('Volver regresa a la lista',true);

 // Catálogo: Ayuda + Actualizar
 await p.goto(H+'catalogo.html'); await p.waitForSelector('.card'); await w(600);
 ok('Catálogo: Ayuda al lado de Actualizar',await p.$eval('#btnActualizar',x=>x.parentElement.classList.contains('ayuda-col')&&x.parentElement.querySelector('.ayuda-pal').textContent==='Actualizar'&&!!x.closest('.ayuda-par').querySelector('.ayuda-btn')));
 await p.screenshot({path:'shots6/a6-catalogo-boton.png'});
 await p.click('#btnActualizar'); await w(300);
 await abrirAyuda(p,'.topbar .ayuda-btn');
 bs=await bloques(p);
 ok('Catálogo admin: registrar, normas y categoría de pago',bs.includes('registrar-un-modelo')&&bs.includes('poner-la-categoria-de-pago-admin')&&bs.includes('avisos-que-te-salen-admin'),bs);
 await cerrarAyuda(p);
 // Dentro de un modelo: la ayuda flotante habla de lo que se hace ahí
 await p.click('.card'); await p.waitForSelector('#sheetDetalle.open'); await w(500);
 ok('Detalle: botón Ayuda flotante con su palabra',await p.isVisible('#sheetDetalle .ayuda-flota'));
 await p.screenshot({path:'shots6/a7-detalle-boton.png'});
 await abrirAyuda(p,'#sheetDetalle .ayuda-flota');
 bs=await bloques(p);
 ok('Detalle: lo que se puede hacer (editar, etc.)',bs[0]==='despues-de-registrar',bs);
 ok('La hoja de ayuda queda encima del detalle',await p.evaluate(()=>+getComputedStyle(document.getElementById('sheetAyuda')).zIndex>+getComputedStyle(document.getElementById('sheetDetalle')).zIndex));
 await p.screenshot({path:'shots6/a8-detalle-hoja.png'});
 await cerrarAyuda(p);
 ok('Al cerrar la ayuda el detalle sigue abierto',!!(await p.$('#sheetDetalle.open')));
 // Editar el modelo: solo lo de su tipo
 await p.click('#sheetDetalle [data-accion="editar-modelo"]'); await p.waitForSelector('#sheetForm.open'); await w(500);
 ok('Formulario: Ayuda al lado de Cerrar',await p.$eval('#sheetForm [data-cerrar="sheetForm"]',x=>x.parentElement.querySelector('.ayuda-pal').textContent==='Cerrar'&&!!x.closest('.ayuda-par').querySelector('.ayuda-btn')));
 await p.screenshot({path:'shots6/a9-form-boton.png'});
 await abrirAyuda(p,'#sheetForm .ayuda-btn');
 bs=await bloques(p);
 ok('Formulario de Puerta Multilock: solo su tipo',bs.includes('tipo-puerta-multilock')&&!bs.includes('tipo-ventana')&&bs.includes('poner-la-categoria-de-pago-admin'),bs);
 ok('Desde un formulario no se ofrece salir al manual completo',await p.$eval('#sheetAyuda .sheet-foot',x=>x.classList.contains('hidden')));
 ok('Título del formulario',(await p.textContent('#ayudaTitulo'))==='Editar modelo',await p.textContent('#ayudaTitulo'));
 await p.screenshot({path:'shots6/a10-form-hoja.png'});
 await cerrarAyuda(p);
 ok('Al cerrar la ayuda el formulario sigue abierto',!!(await p.$('#sheetForm.open')));
 // Atrás del teléfono cierra la ayuda y no la pantalla
 await abrirAyuda(p,'#sheetForm .ayuda-btn');
 await p.goBack(); await w(600);
 ok('Atrás cierra solo la ayuda',!(await p.$('#sheetAyuda.open'))&&!!(await p.$('#sheetForm.open')));

 // Páginas sin botón en la barra: la Ayuda va al final de la barra
 for(const [pg,mod] of [['venta.html','venta'],['categorias-pago.html','admin'],['usuarios.html','admin']]){
  await p.goto(H+pg); await w(1500);
  ok(pg+': Ayuda en la barra',await p.$$eval('#topbar > .ayuda-btn',x=>x.length===1));
  await abrirAyuda(p,'#topbar > .ayuda-btn');
  ok(pg+': manual correcto',(await p.getAttribute('#ayudaTodo','href'))==='ayuda.html?m='+mod);
  if(pg==='venta.html') await p.screenshot({path:'shots6/a11-venta-hoja.png'});
  await cerrarAyuda(p);
 }
 for(const [pg,mod] of [['cotizaciones.html','cotizaciones'],['ventas.html','ventas'],['produccion.html','produccion'],['nomina.html','nomina'],['deposito.html','deposito']]){
  await p.goto(H+pg); await w(1500);
  ok(pg+': Ayuda al lado de Actualizar',await p.$eval('#btnActualizar',x=>x.parentElement.classList.contains('ayuda-col')));
  await abrirAyuda(p,'.topbar .ayuda-btn');
  const n=(await bloques(p)).length;
  ok(pg+': abre su manual con contenido',(await p.getAttribute('#ayudaTodo','href'))==='ayuda.html?m='+mod&&n>=3,n);
  ok(pg+': fichas con Ayuda flotante bajan su contenido',await p.$$eval('.sheet .ayuda-flota',x=>x.every(b=>b.closest('.sheet').classList.contains('con-ayuda-flota'))));
  if(pg==='produccion.html') await p.screenshot({path:'shots6/a12-produccion-hoja.png'});
  await cerrarAyuda(p);
 }
 await ctx.close();

 // ---------------- Vendedora ----------------
 ({ctx,p}=await entrar(b,'vendedor',err));
 await p.goto(H+'catalogo.html'); await p.waitForSelector('.card'); await p.waitForTimeout(600);
 await abrirAyuda(p,'.topbar .ayuda-btn');
 bs=await bloques(p);
 ok('Vendedora: no ve lo del administrador en el catálogo',!bs.some(x=>/admin/.test(x))&&bs.includes('registrar-un-modelo'),bs);
 await p.screenshot({path:'shots6/v1-catalogo-hoja.png'});
 await p.goto(H+'ayuda.html'); await p.waitForSelector('.m-item');
 mods=await p.$$eval('.m-item',x=>x.map(a=>a.getAttribute('href').split('m=')[1]));
 ok('Vendedora ve 7 manuales, sin Nómina ni Administración',mods.length===7&&!mods.includes('nomina')&&!mods.includes('admin'),mods);
 await p.goto(H+'ayuda.html?m=nomina'); await p.waitForSelector('.m-item');
 ok('Vendedora: si pide Nómina ve la lista',(await p.textContent('#titulo'))==='Manuales de uso');
 await p.goto(H+'ayuda.html?m=ventas'); await p.waitForSelector('.m-manual section',{state:'attached'});
 ok('Vendedora: manual de ventas sin confirmar pago ni cancelar',await p.$$eval('.m-manual > section',x=>x.length>5&&!x.some(s=>/admin/.test(s.dataset.b))));
 await p.screenshot({path:'shots6/v2-manual-ventas.png',fullPage:false});
 // Sin internet: mensaje claro y Reintentar
 await p.goto(H+'deposito.html'); await w(1200);
 await p.evaluate(()=>{window._f=window.fetch;window.fetch=(u,o)=>String(u).includes('assets/ayuda/')?Promise.reject(new TypeError('Failed to fetch')):window._f(u,o);});
 await abrirAyuda(p,'.topbar .ayuda-btn');
 ok('Sin internet: error claro con Reintentar',await p.isVisible('[data-ayuda-reintentar]'));
 await p.evaluate(()=>{window.fetch=window._f;});
 await p.click('[data-ayuda-reintentar]'); await p.waitForSelector('#ayudaBody > section');
 ok('Reintentar carga la ayuda',(await bloques(p)).length>0);
 await p.screenshot({path:'shots6/a13-reintentar.png'});
 await p.evaluate(()=>Ayuda.abrir({mod:'ventas',t:'Confirmar pago',b:['confirmar-un-pago-admin']})); await p.waitForTimeout(800);
 ok('Vendedora sin permiso: no ve cómo confirmar pagos',(await bloques(p)).length===0);
 await ctx.close();
 ({ctx,p}=await entrar(b,'vendedor',err,{confirma_abonos:true}));
 await p.evaluate(()=>Ayuda.abrir({mod:'ventas',t:'Confirmar pago',b:['confirmar-un-pago-admin']})); await p.waitForTimeout(800);
 ok('Quien confirma pagos (sin ser admin) sí ve cómo confirmarlos',(await bloques(p)).join()==='confirmar-un-pago-admin');
 await ctx.close();

 // ---------------- Trabajador ----------------
 ({ctx,p}=await entrar(b,'trabajador',err));
 await p.waitForTimeout(800);
 ok('Trabajador: Ayuda al lado de Mi cuenta',await p.isVisible('#topbar .ayuda-btn'));
 await p.screenshot({path:'shots6/t1-inicio-boton.png'});
 await abrirAyuda(p,'#topbar .ayuda-btn');
 bs=await bloques(p);
 ok('Trabajador: su manual del taller',(await p.textContent('#ayudaMod'))==='Ayuda · Manual del taller'&&bs.includes('tu-dia-en-4-pasos')&&bs.includes('tus-pagos'),bs);
 await p.screenshot({path:'shots6/t2-inicio-hoja.png'});
 await cerrarAyuda(p);
 await p.click('#btnCuenta'); await p.waitForTimeout(500);
 await p.click('#btnManuales'); await p.waitForSelector('.m-item');
 mods=await p.$$eval('.m-item',x=>x.map(a=>a.getAttribute('href').split('m=')[1]));
 ok('Trabajador: solo el manual del taller',mods.join()==='taller',mods);
 await p.goto(H+'ayuda.html?m=ventas'); await p.waitForSelector('.m-item');
 ok('Trabajador: no abre otros manuales',(await p.textContent('#titulo'))==='Manuales de uso');
 await ctx.close();
} catch(e){ ok('Sin excepción',false,e.message); } finally { await b.close(); }
 res.forEach(x=>console.log(x));
 console.log('Errores JS:',JSON.stringify(err));
 console.log(fallas||err.length?'HAY FALLAS':'TODO OK');
})();
