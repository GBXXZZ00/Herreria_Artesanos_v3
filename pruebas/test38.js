// Categorías por producto en el Catálogo, "Lleva detalles" en ventanas y combos (solo en el modelo),
// pagos especiales (masilla con la pintura, instalar no se paga) y Usuarios: errores visibles y
// usuario sin acentos ni espacios.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const modelos=[
  {id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{alto:2,ancho:1},precio_base:200,categoria_pago_id:1},
  {id:5,nombre:'Ventana Pro',tipo:'Ventana',fotos:{Blanco:GIF},especificaciones_base:{alto:1,ancho:1,proteccion:true,lleva_detalles:true},precio_base:120,categoria_pago_id:2}
];
const categorias=[{id:1,nombre:'General',producto:'Puerta Multilock'},{id:2,nombre:'Ventanas',producto:'Ventana'},{id:3,nombre:'Combos',producto:'Combo'},{id:9,nombre:'Vieja sin producto',producto:null}];
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const llamadas=[];
(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=req.url();const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*',...h},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/functions/v1/gestionar_usuarios')){ const body=JSON.parse(req.postData()||'{}'); llamadas.push(['usuarios',body]); if(body.accion==='listar') return j({usuarios:[{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',especialidades:[],activo:true,orden:1}]}); return j({id:'n1'}); }
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'}); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/categorias_pago'))return j(categorias);
  if(u.includes('/catalogo')){
    if(req.method()==='HEAD')return r.fulfill({status:200,headers:{'content-range':'0-1/1','access-control-expose-headers':'content-range'},body:''});
    if(req.method()==='PATCH'){ const body=JSON.parse(req.postData()||'{}'); llamadas.push(['editar',body]); return j({...modelos[0],...body}); }
    if(req.method()==='POST'){ const body=JSON.parse(req.postData()||'{}'); llamadas.push(['crear',body]); return j({...body,id:50+llamadas.length},201); }
    return j(modelos,200,{'content-range':'0-1/1'});
  }
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
 const espera=ms=>p.waitForTimeout(ms||450);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');

 // ---------- Ayudas de pago ----------
 const np=await p.evaluate(()=>[AH.notaPago('masilla'),AH.notaPago('instalar'),AH.notaPago('pintura'),AH.notaPago(null)]);
 ok('La masilla se paga con la pintura; instalar no se paga; la pintura sí lleva monto',np[0]==='Se paga con la pintura'&&np[1]==='No se paga'&&np[2]===''&&np[3]==='',np);
 const sirve=await p.evaluate(()=>[AH.categoriaSirve({producto:'Ventana'},'Puerta Multilock'),AH.categoriaSirve({producto:'Puerta Multilock'},'Puerta de Madera'),AH.categoriaSirve({producto:null},'Combo'),AH.categoriaSirve({producto:'Combo'},'Combo')]);
 ok('Una categoría sirve solo para su producto (la madera tiene las suyas)',sirve.join()==='false,false,true,true',sirve);
 const ext=await p.evaluate(()=>[AH.esquema('Ventana','modelo').extras.map(x=>x.k),AH.esquema('Ventana','pedido').extras.map(x=>x.k),AH.esquema('Combo','modelo').extras.map(x=>x.k),AH.esquema('Combo','pedido').extras.map(x=>x.k)]);
 ok('"Lleva detalles" está en el modelo y no en la venta',ext[0].includes('lleva_detalles')&&!ext[1].includes('lleva_detalles')&&ext[2].includes('ventanas_detalles')&&!ext[3].includes('ventanas_detalles'),ext);
 const pedido=await p.evaluate(()=>AH.especificacionesDesdeEstado('Ventana',{alto:1,ancho:1,lleva_detalles:true,proteccion:true},'pedido'));
 ok('Lo que se vende no manda "lleva detalles" (lo copia el servidor del modelo)',!('lleva_detalles' in pedido),pedido);
 const resu=await p.evaluate(()=>AH.resumenSpecs('Ventana',{alto:1,ancho:1,lleva_detalles:true}).map(x=>x.t));
 ok('El cliente no ve "lleva detalles" en el resumen (es del taller)',!resu.some(t=>/detalles/i.test(t)),resu);

 // ---------- Catálogo ----------
 await p.goto(H+'catalogo.html');await p.waitForSelector('.card');await espera();await p.click('.chip[data-cat="Todos"]');await espera(300);
 await p.click('.card[data-id="4"]');await espera();await p.click('#detalleFoot [data-accion="editar-modelo"]');await espera(600);
 await p.click('#btnCategoria');await p.waitForSelector('#sheetCategoria.open');
 const ops=await p.$$eval('#listaCategorias .cat-fila-op',x=>x.map(b=>b.textContent.trim()));
 ok('Puerta: solo salen sus categorías (y las viejas sin producto)',ops.join('|')==='Sin categoría|General|Vieja sin producto',ops);
 await p.screenshot({path:'shots6/k1-categoria-puerta.png'});
 await p.click('#sheetCategoria [data-cat="1"]');await espera(300);
 // Cambiar el tipo a Ventana: la categoría de puerta se quita
 await p.click('#tipoFila [data-accion="cambiar-tipo"]');await espera(400);
 await p.click('#tipoGrid [data-elegir="Ventana"]');await espera(500);
 ok('Al cambiar a Ventana, la categoría de puerta se quita',(await p.textContent('#categoriaTexto'))==='Sin categoría');
 ok('La ventana del modelo tiene "Lleva detalles"',(await p.textContent('#specs')).includes('Lleva detalles'));
 await p.click('#sheetForm [data-cerrar="sheetForm"]');await espera(500);
 await p.goto(H+'catalogo.html');await p.waitForSelector('.card');await espera();
 // Nueva ventana con detalles
 await p.click('#btnNuevo');await espera();await p.click('#tipoGrid [data-elegir="Ventana"]');await espera(600);
 await p.fill('#fNombre','Ventana Deco');await p.fill('#fPrecio','140');
 await p.click('#specs .tchip[data-k="lleva_detalles"]');await espera(150);
 await p.click('#btnCategoria');await p.waitForSelector('#sheetCategoria.open');
 ok('Ventana: solo salen las categorías de ventana',(await p.$$eval('#listaCategorias .cat-fila-op',x=>x.map(b=>b.textContent.trim()).join('|')))==='Sin categoría|Ventanas|Vieja sin producto');
 await p.click('#sheetCategoria [data-cat="2"]');await espera(300);
 await p.screenshot({path:'shots6/k2-ventana-detalles.png'});
 await p.click('#btnGuardar');await espera(700);
 const cv=llamadas.find(x=>x[0]==='crear'&&x[1].nombre==='Ventana Deco');
 ok('Guarda la ventana con "lleva detalles" y su categoría',cv&&cv[1].especificaciones_base.lleva_detalles===true&&cv[1].categoria_pago_id===2,cv&&cv[1]);
 // Combo
 await p.click('#btnNuevo');await espera();await p.click('#tipoGrid [data-elegir="Combo"]');await espera(600);
 ok('El combo tiene "Las ventanas llevan detalles"',(await p.textContent('#specs')).includes('Las ventanas llevan detalles'));
 await p.click('#btnCategoria');await p.waitForSelector('#sheetCategoria.open');
 ok('Combo: solo salen las de combo',(await p.$$eval('#listaCategorias .cat-fila-op',x=>x.map(b=>b.textContent.trim()).join('|')))==='Sin categoría|Combos|Vieja sin producto');
 await p.click('#sheetCategoria [data-cerrar="sheetCategoria"]');await espera(300);
 await p.screenshot({path:'shots6/k3-combo.png'});

 // ---------- Usuarios ----------
 await p.goto(H+'usuarios.html');await espera(1200);
 await p.click('#btnNuevo');await p.waitForSelector('#sheetNuevo.open');
 await p.fill('#nUsuario','Jesús Pérez');await espera(100);
 ok('El usuario se arregla solo: sin acentos ni espacios',(await p.textContent('#hUsuario'))==='Entrará como: jesusperez'&&await p.isVisible('#hUsuario'));
 await p.click('#btnCrear');await espera(500);
 ok('Si falta algo, los errores se ven debajo de cada campo',await p.isVisible('#eNombre')&&await p.isVisible('#ePin')&&await p.isVisible('#eRol')&&!(await p.isVisible('#eUsuario')));
 ok('No se llama al servidor con datos incompletos',!llamadas.some(x=>x[0]==='usuarios'&&x[1].accion==='crear'));
 await p.screenshot({path:'shots6/k4-usuario-errores.png'});
 await p.fill('#nNombre','Jesús');await p.fill('#nPin','482915');
 await p.click('#nRol .opt[data-v="trabajador"]');await espera(150);
 ok('La especialidad de ventanas se llama Aluminio',(await p.textContent('#nEspecialidad')).includes('Aluminio')&&!(await p.textContent('#nEspecialidad')).includes('Ventanero'));
 await p.click('#nEspecialidad .opt[data-v="ventanero"]');
 await p.click('#btnCrear');await espera(700);
 const cu=llamadas.find(x=>x[0]==='usuarios'&&x[1].accion==='crear');
 ok('Crea el usuario "jesusperez"',cu&&cu[1].payload.usuario==='jesusperez'&&cu[1].payload.especialidades.join()==='ventanero',cu&&cu[1]);
} catch(x){ ok('Sin excepción',false,x.message.split('\n')[0]); } finally { await b.close(); }
 res.forEach(x=>console.log(x));
 console.log('Errores JS:',JSON.stringify(err));
 console.log(fallas||err.length?'HAY FALLAS':'TODO OK');
})();
