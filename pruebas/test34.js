// Atajos: lo que antes te mandaba a otra pantalla se arregla ahí mismo (o te lleva justo a donde se arregla)
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const H='http://127.0.0.1:8765/';
const PERF={ u1:{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',activo:true,confirma_abonos:false}, u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,sede_id:1} };
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const modelos=[{id:8,nombre:'Combo #1',tipo:'Combo',fotos:{Blanco:GIF},especificaciones_base:{variante:'Sin protección en puerta',alto:2,ancho:1},precio_base:500}];
const item=(x)=>Object.assign({id:701,etapa:'Hierro',producto:'Lineal',tipo:'Puerta Multilock',cantidad:1,venta_id:12,venta_item_id:55,interna:false,cliente:'María',sede:'Cumbres',fecha:new Date().toISOString(),foto:GIF,foto_de:'Blanco',foto_trabajo:null,especificaciones:{},categoria:null,categoria_id:null,monto:null,oficio:'hierro'},x||{});
let ficha={trabajador:{id:'t1',nombre:'Pedro',especialidades:['herrero']},semana:'2026-09-28',puede_pagar:false,trabajos:[item(),item({id:702,producto:'Imperial',categoria:'Puertas',categoria_id:4})],proxima:[],vales:[],vales_proxima:[],vale_pendiente:null,pagos:[]};

async function pagina(b,uid,st){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/functions/v1/gestionar_usuarios')){const a=JSON.parse(req.postData()||'{}');st.rpcs.push(['usuarios',a]);return j({usuarios:[{id:'u1',nombre:'Gualfredo',usuario:'gualfredo',rol:'admin',activo:true,orden:1},{id:'t1',nombre:'Pedro',usuario:'pedro',rol:'trabajador',activo:true,orden:2,especialidades:['herrero']}]});}
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');st.rpcs.push([name,a]);
      if(name==='catalogo_medidas_ventanas')return j({id:a.mid,ventanas_alto:a.alto,ventanas_ancho:a.ancho});
      if(name==='nomina_semana')return j({semana:'2026-09-28',trabajadores:[{id:'t1',nombre:'Pedro',trabajos:2,neto:0,por_definir:2,vales_monto:0,ultimo_pago:null}]});
      if(name==='nomina_trabajador')return j(ficha);
      if(name==='asignar_categoria_item'){ficha.trabajos[0].monto=40;ficha.trabajos[0].categoria_id=a.cid;return j(null);}
      if(name==='usuario_especialidades')return j({id:a.uid});
      return j([]);}
    if(u.includes('/categorias_pago'))return j([{id:4,nombre:'Puertas',tarifas:{}},{id:5,nombre:'Ventanas',tarifas:{}}]);
    if(u.includes('/catalogo'))return j(modelos);
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF[uid]); return j([PERF.u1,PERF.u3].map(p=>({usuario:p.usuario,nombre:p.nombre,rol:p.rol,orden:1})));}
    if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>st.err.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');
  await p.click(`.quien-btn:has-text("${PERF[uid].nombre}")`).catch(async()=>{await p.click('.quien-btn');});
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(700);
  return p;
}

(async()=>{ const b=await chromium.launch(); try{
 // ===== 1) Venta: combo sin medidas de ventanas, se arregla desde el producto =====
 const s1={rpcs:[],err:[]};const p=await pagina(b,'u3',s1);const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'venta.html');await w(1200);
 await p.click('#btnAgregar');await w();await p.click('[data-origen="catalogo"]');await w();await p.click('[data-modelo="8"]');await w(600);
 ok('Combo sin medidas: el aviso trae dónde ponerlas',!!(await p.$('#atajoAlto'))&&!!(await p.$('[data-atajo-medidas]')));
 await p.click('[data-atajo-medidas]');await w(300);
 ok('Sin medidas no guarda y lo dice',!s1.rpcs.some(x=>x[0]==='catalogo_medidas_ventanas')&&await p.$eval('#atajoError',x=>getComputedStyle(x).display!=='none'));
 await p.fill('#atajoAlto','1,2');await p.fill('#atajoAncho','1');
 await p.screenshot({path:'shots5/a1-combo-atajo.png'});
 await p.click('[data-atajo-medidas]');await w(700);
 const cm=s1.rpcs.find(x=>x[0]==='catalogo_medidas_ventanas');
 ok('Guarda las medidas en el Catálogo',cm&&cm[1].mid===8&&cm[1].alto===1.2&&cm[1].ancho===1,cm&&cm[1]);
 ok('Se quita el aviso y salen las medidas fijas',!(await p.$('#prodBody .aviso-falta'))&&(await p.$$eval('#prodBody .med-fija',x=>x.map(y=>y.textContent))).join('|')==='2 × 1 m|1.2 × 1 m',await p.$$eval('#prodBody .med-fija',x=>x.map(y=>y.textContent)));
 await p.click('#btnProdListo');await w(500);
 ok('Y ya se agrega a la cotización',(await p.$$('#items .item')).length===1);
 ok('Errores JS (venta)',!s1.err.length,s1.err);
 await p.context().close();

 // ===== 2) Nómina: trabajo sin monto =====
 const s2={rpcs:[],err:[]};const n=await pagina(b,'u1',s2);const wn=ms=>n.waitForTimeout(ms||400);
 await n.goto(H+'nomina.html?t=t1');await n.waitForSelector('#sheetTrab.open');await wn(800);
 ok('Nómina: dice que se tocan para resolver',(await n.textContent('#trabBody')).includes('Tócalos para resolverlo'));
 await n.click('[data-item="701"]');await wn(900);
 ok('Sin categoría: elige la categoría ahí mismo',(await n.$$('#itemBody [data-cat-item]')).length===2);
 await n.screenshot({path:'shots5/a2-nomina-atajo.png'});
 await n.click('#itemBody [data-cid="4"]');await wn(900);
 const ac=s2.rpcs.find(x=>x[0]==='asignar_categoria_item');
 ok('Pone la categoría al producto y recarga',ac&&ac[1].iid===55&&ac[1].cid===4&&(await n.textContent('#toast')).includes('Ya tiene su monto'),ac&&ac[1]);
 await n.click('[data-item="702"]');await wn(600);
 ok('Con categoría pero sin tarifa: lleva a poner la tarifa',(await n.getAttribute('#itemBody a[href^="categorias-pago.html"]','href'))==='categorias-pago.html?editar=4');
 await n.goto(H+'categorias-pago.html?editar=4');await wn(1200);
 ok('Categorías: ?editar abre esa categoría',await n.isVisible('#sheetFicha')&&(await n.inputValue('#fNombre'))==='Puertas');
 await n.goto(H+'categorias-pago.html?nueva=1');await wn(1200);
 ok('Categorías: ?nueva abre una nueva',await n.isVisible('#sheetFicha')&&(await n.textContent('#fichaTitulo'))==='Nueva categoría');
 // Usuarios: darle una especialidad a un trabajador
 await n.goto(H+'usuarios.html?especialidad=masilla_pintura');await wn(1200);
 ok('Usuarios: dice qué hacer',(await n.textContent('#toast')).includes('Masilla y pintura'));
 await n.click('.u-card[data-id="t1"]');await wn(500);
 await n.click('#fichaBody [data-esp="masilla_pintura"]');await n.click('#fichaBody [data-accion="especialidades"]');await wn(700);
 const ue=s2.rpcs.find(x=>x[0]==='usuario_especialidades');
 ok('Guarda las especialidades del trabajador',ue&&ue[1].uid==='t1'&&ue[1].esp.join()==='herrero,masilla_pintura',ue&&ue[1]);
 await n.screenshot({path:'shots5/a3-usuarios-esp.png'});
 await n.goto(H+'catalogo.html');await wn(1200);
 ok('Catálogo: botones Ver catálogo público y Copiar enlace',(await n.getAttribute('#btnVerPublico','href'))==='catalogo-publico.html'&&await n.isVisible('#btnCopiarPublico'));
 await n.screenshot({path:'shots5/a4-catalogo-publico.png'});
 ok('Errores JS (admin)',!s2.err.length,s2.err);
 console.log(res.join('\n'));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
