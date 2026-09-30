// Fotos chiquitas: las listas piden la copia chiquita; si no existe usan la grande; si falla, el ícono.
// Subir una foto guarda las 2; un admin prepara en segundo plano las que faltan.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const H='http://127.0.0.1:8765/';
const ST='https://vmrxfpgotbmmjxzizsuq.supabase.co/storage/v1/object/public/catalogo-fotos/';
const PERF={ u1:{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',activo:true,confirma_abonos:false} };
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
// a: tiene chiquita · b: solo la grande · c: no existe ninguna
const modelos=[{id:1,nombre:'Con chiquita',tipo:'Puerta Multilock',fotos:{Blanco:ST+'modelos/a.jpg'},especificaciones_base:{},precio_base:200},
 {id:2,nombre:'Sin chiquita',tipo:'Puerta Multilock',fotos:{Blanco:ST+'modelos/b.jpg'},especificaciones_base:{},precio_base:250},
 {id:3,nombre:'Rota',tipo:'Puerta Multilock',fotos:{Blanco:ST+'modelos/c.jpg'},especificaciones_base:{},precio_base:300}];

(async()=>{ const b=await chromium.launch(); try{
 const st={pedidas:[],subidas:[],err:[],rpc:[]};
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
 const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
 const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  const img=()=>r.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:PNG});
  if(u.includes('/object/public/')){ const path=u.split('/object/public/catalogo-fotos/')[1].split('?')[0]; st.pedidas.push(path);
    if(path==='mini/modelos/a.jpg'||path==='modelos/b.jpg'||path==='modelos/a.jpg') return img();
    return r.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"error":"not_found"}'}); }
  if(u.includes('/storage/v1/object/')&&req.method()==='POST'){ const cuerpo=(req.postDataBuffer()||Buffer.alloc(0)).toString('latin1');st.subidas.push({path:u.split('/storage/v1/object/')[1],cache:(req.headers()['cache-control']||'')+(/name="cacheControl"\r\n\r\n31536000/.test(cuerpo)?' form=31536000':'')}); return j({Key:u.split('/storage/v1/object/')[1]}); }
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];st.rpc.push(name);
    if(name==='fotos_sin_mini') return j(st.rpc.filter(x=>x==='fotos_sin_mini').length===1?[{bucket:'catalogo-fotos',nombre:'modelos/b.jpg'}]:[]);
    return j([]);}
  if(u.includes('/catalogo'))return j(modelos);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF.u1); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>st.err.push(e.message));p.on('dialog',d=>d.accept());
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 // Admin en Inicio: prepara la chiquita de la foto que no la tiene
 await w(4500);
 ok('Admin: pide qué fotos no tienen chiquita',st.rpc.includes('fotos_sin_mini'));
 const sb=st.subidas.find(x=>x.path==='catalogo-fotos/mini/modelos/b.jpg');
 ok('Baja la grande y sube su chiquita, guardada por un año',st.pedidas.includes('modelos/b.jpg')&&sb&&/31536000/.test(sb.cache),[st.subidas,st.pedidas]);
 ok('Avisa que las fotos quedaron listas',(await p.textContent('#toast')).includes('Fotos listas'),await p.textContent('#toast'));

 // Catálogo: cada tarjeta pide la chiquita
 st.pedidas=[];
 await p.goto(H+'catalogo.html');await w(5000);
 const srcs=await p.$$eval('.card-photo img',x=>x.map(y=>[y.getAttribute('src').split('catalogo-fotos/')[1],y.classList.contains('cargada')]));
 ok('Con chiquita: la lista usa la chiquita y no baja la grande',srcs.some(s=>s[0]==='mini/modelos/a.jpg'&&s[1])&&!st.pedidas.includes('modelos/a.jpg'),[srcs,st.pedidas]);
 ok('Sin chiquita: usa la grande',srcs.some(s=>s[0]==='modelos/b.jpg'&&s[1]),srcs);
 ok('Rota: reintenta y deja el ícono en vez del cuadro vacío',srcs.length===2&&st.pedidas.filter(x=>x.startsWith('modelos/c.jpg')).length===2&&(await p.$$eval('.card-photo',x=>x.filter(y=>!y.querySelector('img')&&y.querySelector('svg')).length))===1,[srcs.length,st.pedidas]);
 await p.screenshot({path:'shots5/f1-catalogo-fotos.png'});
 // Subir una foto guarda las 2, con caché de un año
 st.subidas=[];
 const url=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const bl=await new Promise(r=>c.toBlob(r,'image/jpeg',0.9));return window.AH.subirFoto('catalogo-fotos','modelos/nueva.jpg',bl);});
 ok('Subir: guarda la grande y la chiquita',st.subidas.map(x=>x.path).join()==='catalogo-fotos/modelos/nueva.jpg,catalogo-fotos/mini/modelos/nueva.jpg'&&st.subidas.every(x=>/31536000/.test(x.cache))&&url.endsWith('/catalogo-fotos/modelos/nueva.jpg'),[st.subidas,url]);
 ok('miniDe: solo cambia fotos de la app',await p.evaluate(()=>{const m=window.AH.miniDe;return m('https://x.supabase.co/storage/v1/object/public/etapas-fotos/2026-09/a.jpg').endsWith('/etapas-fotos/mini/2026-09/a.jpg')&&m('data:image/gif;base64,x')==='data:image/gif;base64,x'&&m('https://x.supabase.co/storage/v1/object/public/catalogo-fotos/mini/a.jpg').endsWith('/catalogo-fotos/mini/a.jpg')&&m(null)===null;}));
 // Producción: la lista de modelos para fabricar también usa la chiquita
 st.pedidas=[];
 await p.goto(H+'produccion.html');await w(1500);
 await p.click('#btnNuevaOrden');await p.waitForSelector('#sheetOrden.open');
 await p.click('#ordenBody [data-g="__otipo"][data-v="Puerta Multilock"]');await p.click('#btnModelo');await p.waitForSelector('#sheetModelos.open');await w(2500);
 const ps=await p.$$eval('#listaModelos .mini-foto img',x=>x.map(y=>y.getAttribute('src').split('catalogo-fotos/')[1]));
 ok('Producción, fabricar: la lista de modelos usa las chiquitas',ps.join()==='mini/modelos/a.jpg,modelos/b.jpg'&&!st.pedidas.includes('modelos/a.jpg'),[ps,st.pedidas]);
 await p.screenshot({path:'shots5/f2-produccion-modelos.png'});
 ok('Errores JS',!st.err.length,st.err);
 console.log(res.join('\n'));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
