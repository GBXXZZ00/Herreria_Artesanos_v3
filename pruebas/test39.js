// Producción: 2 puertas iguales en una venta son 2 trabajos aparte ("1 de 2", "2 de 2"),
// cada una con sus pasos y su "Asignar trabajadores". Masilla y pintura es un solo paso.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const E=(id,u,nombre,orden,esp,oficio,extra)=>Object.assign({id,unidad:u,rama:'principal',nombre,orden,especialidad:esp,oficio,estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},extra||{});
const ventas=[{id:1047,fecha_entrega:null,interna:false,cliente:{nombre:'Raymundo Parra'},estado:'en_produccion',items:[
  {id:1,nombre:'Lineal Economico',tipo:'Puerta Multilock',foto:null,cantidad:2,categoria_pago_id:1,especificaciones:{alto:2,ancho:1,color:'Blanco'},etapas:[
    E(11,1,'Hierro',1,'herrero','hierro',{estado:'hecha',trabajador_id:'t1',trabajador:{nombre:'Luis Paz'},terminada_en:new Date().toISOString()}),
    E(12,1,'Masilla y pintura',2,'masilla_pintura','masilla_pintura'),
    E(13,1,'Detalles',3,'acabados','detalles'),
    E(21,2,'Hierro',1,'herrero','hierro'),
    E(22,2,'Masilla y pintura',2,'masilla_pintura','masilla_pintura'),
    E(23,2,'Detalles',3,'acabados','detalles')]}]}];
(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const u=decodeURIComponent(r.request().url());const j=(x)=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',activo:true}); if(u.includes('rol=eq.trabajador'))return j([{id:'t1',nombre:'Luis Paz',especialidades:['herrero']},{id:'t2',nombre:'Diógenes',especialidades:['herrero']},{id:'t3',nombre:'Nicolás',especialidades:['masilla_pintura']}]); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/categorias_pago'))return j([{id:1,nombre:'Puerta Sencilla',producto:'Puerta Multilock'}]);
  if(u.includes('/ventas'))return j(ventas);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 await p.goto(H+'produccion.html');await p.waitForSelector('.vcard');await p.waitForTimeout(500);
 ok('La lista dice el producto con su cantidad',(await p.textContent('.vcard')).includes('Lineal Economico ×2'));
 await p.click('.vcard');await p.waitForSelector('#sheetFicha.open');await p.waitForTimeout(500);
 const noms=await p.$$eval('#fichaBody .p-item-nom',x=>x.map(n=>n.textContent.trim()));
 ok('Cada puerta sale aparte: 1 de 2 y 2 de 2',noms.length===2&&noms[0].includes('1 de 2')&&noms[1].includes('2 de 2'),noms);
 const pasos=await p.$$eval('#fichaBody .p-item',x=>x.map(it=>[...it.querySelectorAll('.e-nom')].map(n=>n.textContent.trim()).join('|')));
 ok('Cada una con sus pasos: Hierro, Masilla y pintura, Detalles',pasos.length===2&&pasos.every(x=>x==='Hierro|Masilla y pintura|Detalles'),pasos);
 await p.screenshot({path:'shots6/u1-dos-puertas.png',fullPage:true});
 const bts=await p.$$eval('#fichaBody [data-asignar-todo]',x=>x.map(b=>b.dataset.asignarTodo));
 ok('Cada puerta tiene su "Asignar trabajadores"',bts.join()==='1-1,1-2',bts);
 await p.click('#fichaBody [data-asignar-todo="1-2"]');await p.waitForSelector('#sheetTodo.open');await p.waitForTimeout(400);
 ok('Asignar la puerta 2 dice cuál es',(await p.textContent('#todoTitulo')).includes('(2 de 2)'));
 const filas=await p.$$eval('#todoBody .at-paso',x=>x.map(f=>f.querySelector('.at-nom').textContent.trim()));
 ok('Asigna solo los pasos de la puerta 2 (Hierro pendiente incluido)',filas.length===3&&filas[0].startsWith('Hierro'),filas);
 await p.screenshot({path:'shots6/u2-asignar-puerta2.png'});
} catch(x){ ok('Sin excepción',false,x.message.split('\n')[0]); } finally { await b.close(); }
 res.forEach(x=>console.log(x)); console.log('Errores JS:',JSON.stringify(err)); console.log(fallas||err.length?'HAY FALLAS':'TODO OK');
})();
