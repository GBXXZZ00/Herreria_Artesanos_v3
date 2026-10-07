// Madera: solo quien la lleva asigna; quien la lleva y la vendedora de madera marcan cada paso
// con foto obligatoria. Categoría de pago "Madera" (un monto por puerta) y línea de la vendedora.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'x@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const H='http://127.0.0.1:8765/';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const E=(id,nombre,orden,extra)=>Object.assign({id,unidad:1,rama:'principal',nombre,orden,especialidad:'carpintero',oficio:'madera',estado:'pendiente',trabajador_id:'c1',trabajador:{nombre:'Pedro'},foto:null,terminada_en:null,monto:null},extra||{});
const ventas=()=>[{id:1061,fecha_entrega:null,interna:false,cliente:{nombre:'Ana Rivas'},estado:'en_produccion',items:[
  {id:7,nombre:'Puerta Roble',tipo:'Puerta de Madera',foto:null,cantidad:1,categoria_pago_id:5,especificaciones:{alto:2,ancho:1},etapas:[
    E(71,'Estructura',1,{estado:'hecha',terminada_en:new Date().toISOString(),monto:30}),E(72,'Armado',2),E(73,'Pintura',3),E(74,'Ensamblado',4)]}]}];
async function entrar(b,perfil,err,llamadas){
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  if(req.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:''});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/storage/v1/object/')){llamadas.push(['foto',u]);return j({Key:'etapas-fotos/x.jpg'});}
  if(u.includes('/rpc/terminar_etapa_madera')){llamadas.push(['terminar',JSON.parse(req.postData())]);return j({venta_id:1061,listo:false,monto:0});}
  if(u.includes('/rpc/usuario_linea')){llamadas.push(['linea',JSON.parse(req.postData())]);return j(null);}
  if(u.includes('/rpc/produccion_lectura'))return j(ventas());
  if(u.includes('/functions/v1/gestionar_usuarios'))return j({usuarios:[{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',especialidades:[],activo:true,orden:1},{id:'v2',usuario:'maria',nombre:'María',rol:'vendedor',especialidades:[],activo:true,orden:2}]});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(perfil); if(u.includes('rol=eq.vendedor'))return j([{id:'v2',linea:'hierro'}]); if(u.includes('rol=eq.trabajador'))return j([{id:'c1',nombre:'Pedro',especialidades:['carpintero']}]); return j([{usuario:perfil.usuario,nombre:perfil.nombre,rol:perfil.rol,orden:1}]);}
  if(u.includes('/categorias_pago'))return j([{id:5,nombre:'Madera estándar',producto:'Puerta de Madera',activo:true,tarifas:{madera:{monto:60,modo:'fijo'}}}]);
  if(u.includes('/ventas'))return j(ventas());
  return j([]);});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');
 return p;
}
async function ficha(p){ await p.goto(H+'produccion.html');await p.waitForSelector('.vcard');await p.waitForTimeout(500);await p.click('.vcard');await p.waitForSelector('#sheetFicha.open');await p.waitForTimeout(500); }
(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // 1. Gualfredo (lleva la madera)
 let ll=[]; let p=await entrar(b,{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',activo:true,lleva_madera:true,linea:'hierro'},err,ll);
 await ficha(p);
 const pasos=await p.$$eval('#fichaBody .e-nom',x=>x.map(n=>n.textContent.trim()));
 ok('La puerta de madera tiene sus 4 pasos',pasos.join('|')==='Estructura|Armado|Pintura|Ensamblado',pasos);
 ok('Quien lleva la madera puede asignar',await p.$('#fichaBody [data-asignar-todo]')!==null);
 const bm=await p.$$eval('#fichaBody [data-madera]',x=>x.map(n=>n.dataset.madera));
 ok('Solo el paso que toca tiene "Marcar terminado"',bm.join()==='72',bm);
 await p.screenshot({path:'shots6/m1-madera-ficha.png',fullPage:true});
 await p.click('#fichaBody [data-madera="72"]');await p.waitForSelector('#sheetMadera.open');await p.waitForTimeout(400);
 ok('Sin foto no deja marcar',await p.isDisabled('#btnMaderaOk')&&(await p.textContent('#btnMaderaOk')).includes('foto'));
 await p.setInputFiles('#maderaInput',{name:'f.png',mimeType:'image/png',buffer:PNG});await p.waitForTimeout(900);
 ok('Con la foto se activa el botón',!(await p.isDisabled('#btnMaderaOk')));
 await p.screenshot({path:'shots6/m2-madera-foto.png'});
 await p.click('#btnMaderaOk');await p.waitForTimeout(1500);
 const t=ll.find(x=>x[0]==='terminar');
 ok('Sube la foto y marca el paso en el servidor',ll.some(x=>x[0]==='foto')&&t&&t[1].eid===72&&/etapas-fotos\/\d{4}-\d{2}\//.test(t[1].foto_url),t&&t[1]);
 // Categoría de madera
 await p.goto(H+'categorias-pago.html');await p.waitForSelector('.c-card');await p.waitForTimeout(400);
 ok('La categoría de madera muestra su monto',(await p.textContent('.c-card')).includes('Puerta completa'));
 await p.click('.c-card');await p.waitForSelector('#sheetFicha.open');await p.waitForTimeout(400);
 ok('Madera: un solo monto por puerta, sin m²',(await p.$$('#filasTarifa .cat-fila')).length===1&&!(await p.isVisible('#filasTarifa .cat-modo'))&&(await p.textContent('#optsProducto')).includes('Madera'));
 await p.screenshot({path:'shots6/m3-categoria-madera.png'});
 const np=await p.evaluate(()=>[AH.notaPago('madera',0),AH.notaPago('madera',30),AH.notaPago('madera',null),AH.categoriaSirve({producto:'Puerta Multilock'},'Puerta de Madera'),AH.categoriaSirve({producto:'Puerta de Madera'},'Puerta de Madera')]);
 ok('Pasos del medio van en el pago de la puerta; la madera usa solo sus categorías',np[0]==='Va en el pago de la puerta'&&np[1]===''&&np[2]===''&&np[3]===false&&np[4]===true,np);
 // Línea de la vendedora
 await p.goto(H+'usuarios.html');await p.waitForSelector('.u-card');await p.waitForTimeout(600);
 await p.click('.u-card[data-id="v2"]');await p.waitForSelector('#sheetFicha.open');await p.waitForTimeout(300);
 ok('La vendedora arranca en Hierro',(await p.textContent('#optsLinea .selected')).trim()==='Hierro');
 await p.click('#optsLinea [data-linea="madera"]');await p.waitForTimeout(500);
 const l=ll.find(x=>x[0]==='linea');
 ok('Se guarda como vendedora de madera',l&&l[1].uid==='v2'&&l[1].p_linea==='madera'&&(await p.textContent('#optsLinea .selected')).trim()==='Madera',l&&l[1]);
 await p.screenshot({path:'shots6/m4-vendedora-linea.png'});
 await p.context().close();
 // 2. Ray (admin que no lleva la madera)
 ll=[]; p=await entrar(b,{id:'u1',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,lleva_madera:false,linea:'hierro'},err,ll);
 await ficha(p);
 ok('Ray ve la puerta pero no la asigna ni la marca',await p.$('#fichaBody [data-asignar-todo]')===null&&await p.$('#fichaBody [data-madera]')===null&&(await p.textContent('#fichaBody')).includes('las asigna Gualfredo'));
 await p.context().close();
 // 3. Vendedora de madera
 p=await entrar(b,{id:'u1',usuario:'maria',nombre:'María',rol:'vendedor',activo:true,lleva_madera:false,linea:'madera'},err,ll);
 await ficha(p);
 ok('La vendedora de madera marca pasos pero no asigna',await p.$('#fichaBody [data-madera="72"]')!==null&&await p.$('#fichaBody [data-asignar-todo]')===null);
 await p.context().close();
 // 4. Vendedora de hierro
 p=await entrar(b,{id:'u1',usuario:'ana',nombre:'Ana',rol:'vendedor',activo:true,lleva_madera:false,linea:'hierro'},err,ll);
 await ficha(p);
 ok('La vendedora de hierro solo mira',await p.$('#fichaBody [data-madera]')===null&&await p.$('#fichaBody [data-asignar-todo]')===null);
} catch(x){ ok('Sin excepción',false,x.message.split('\n')[0]); } finally { await b.close(); }
 res.forEach(x=>console.log(x)); console.log('Errores JS:',JSON.stringify(err)); console.log(fallas||err.length?'HAY FALLAS':'TODO OK');
})();
