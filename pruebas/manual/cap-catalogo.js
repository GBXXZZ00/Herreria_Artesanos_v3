// Capturas para el manual de Catálogo (datos simulados, no toca la base).
// Las marcas rojas se dibujan sobre el elemento real y la foto se recorta alrededor: quedan exactas.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const FOTO='data:image/png;base64,'+fs.readFileSync(__dirname+'/../foto-puerta.png').toString('base64');
const P=(id,nombre,tipo,precio,esp,cat)=>({id,nombre,tipo,precio_base:precio,fotos:tipo==='Ventana'?{}:{Blanco:FOTO,Negro:FOTO},especificaciones_base:esp,caracteristicas:['Lámina calibre 16','Cerradura tipo multilock'],descripcion_publica:'Medidas: 2 m alto x 1 m ancho',badge:null,categoria_pago_id:cat});
const modelos=[
 P(7,'Modelo Lineal Con Bitral','Puerta Multilock',320,{alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'},1),
 P(118,'Modelo Lineal 5 Vidrios','Puerta Multilock',250,{alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Azul',proteccion:true},null),
 P(108,'Modelo Cuadro','Puerta Multilock',480,{alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'},null),
 P(112,'Combo #1','Combo',580,{alto:2,ancho:1,variante:'Sin protección en puerta',ventanas_alto:1,ventanas_ancho:1},null),
 P(51,'Ventana','Ventana',150,{alto:1,ancho:1,papel_ahumado:true,color_ahumado:'Espejo'},3),
 P(119,'Cuatro cuartos','Ventana',220,{alto:1,ancho:1,proteccion:true},null),
 P(121,'Modelo Cuadro','Puerta Multilock',470,{alto:2,ancho:1},null),
];
const piezas=[{id:50,catalogo_id:7,color:'Negro',sede_id:1,cantidad:1,precio:300,especificaciones:{alto:2,ancho:1,sentido:'Derecha',posicion:'Afuera'},foto:null}];
const cats=[{id:1,nombre:'Puerta sencilla',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:40}},activo:true},{id:2,nombre:'Combo',producto:'Combo',tarifas:{},activo:true},{id:3,nombre:'Ventana',producto:'Ventana',tarifas:{armar:{modo:'m2',monto:10}},activo:true}];
const H='http://127.0.0.1:8765/';
const OUT=__dirname+'/shots/';fs.mkdirSync(OUT,{recursive:true});

async function contexto(b,rol){
 const uid=rol==='admin'?'u1':'u2', nombre=rol==='admin'?'Ray':'Yulimar';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:uid+'@artesanos.app',user_metadata:{}};
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
 const ses={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());
  const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*',...h},body:JSON.stringify(x)});
  const head=n=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  if(u.includes('/auth/v1/token'))return j(ses);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:uid,usuario:nombre.toLowerCase(),nombre,rol,sede_id:1}); return j([{usuario:nombre.toLowerCase(),nombre,rol,orden:1}]);}
  if(u.includes('/categorias_pago')){ if(rol!=='admin')return req.method()==='HEAD'?head(0):j([]); return req.method()==='HEAD'?head(cats.length):j(cats);}
  if(u.includes('/catalogo')){ if(req.method()==='HEAD')return head(u.includes('is.null')?modelos.filter(m=>!m.categoria_pago_id).length:modelos.length); const l=u.includes('tipo=eq.Combo')?modelos.filter(m=>m.tipo==='Combo'):modelos; return j(l,200,{'content-range':'0-'+(l.length-1)+'/'+l.length});}
  if(u.includes('/disponibles'))return j(piezas);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true},{id:2,nombre:'Avenida Universidad',orden:2,activa:true}]);
  if(u.includes('/rpc/nomina_semana'))return j({trabajadores:[]});
  return j([]);});
 const p=await ctx.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('ERR',rol,e.message));
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(900);
 return p;
}
// Marca con rojo los elementos (en orden) y guarda la foto recortada alrededor
async function foto(p,nombre,marcas,opc={}){
 const el0=await p.$(marcas[0][0]); if(!el0) throw new Error('No encontré '+marcas[0][0]);
 if(!opc.sinScroll) await el0.evaluate(e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(350);
 const caja=await p.evaluate(ms=>{
  document.querySelectorAll('.__mk').forEach(x=>x.remove());
  let t=1e9,bt=-1e9;
  ms.forEach(([sel,n])=>{const e=document.querySelector(sel);if(!e)return;const r=e.getBoundingClientRect();
   const d=document.createElement('div');d.className='__mk';const pad=5;
   d.style.cssText=`position:fixed;left:${r.left-pad}px;top:${r.top-pad}px;width:${r.width+pad*2}px;height:${r.height+pad*2}px;border:3px solid #B42318;border-radius:14px;box-shadow:0 0 0 4px rgba(180,35,24,.16);z-index:2147483647;pointer-events:none;box-sizing:border-box`;
   if(n){const i=document.createElement('span');i.textContent=n;i.style.cssText='position:absolute;top:-13px;right:-13px;width:24px;height:24px;border-radius:50%;background:#B42318;color:#fff;font:800 13px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center';d.appendChild(i);}
   document.body.appendChild(d);t=Math.min(t,r.top-pad);bt=Math.max(bt,r.bottom+pad);});
  return {t,b:bt,h:innerHeight,w:innerWidth};},marcas);
 const alto=opc.alto||330; let y=Math.max(0,Math.round((caja.t+caja.b)/2-alto/2)); y=Math.min(y,caja.h-alto);
 if(opc.completa) await p.screenshot({path:OUT+nombre+'.png'});
 else await p.screenshot({path:OUT+nombre+'.png',clip:{x:0,y,width:caja.w,height:alto}});
 await p.evaluate(()=>document.querySelectorAll('.__mk').forEach(x=>x.remove()));
}
async function catalogo(p){await p.goto(H+'catalogo.html');await p.waitForSelector('.card');await p.waitForTimeout(700);const t=await p.$('.chip[data-cat="Todos"]');if(t){await t.click();await p.waitForTimeout(300);}}
async function nuevo(p,tipo){await catalogo(p);await p.click('#btnNuevo');await p.waitForTimeout(600);if(tipo){await p.click(`#tipoGrid [data-elegir="${tipo}"]`);await p.waitForTimeout(700);}}

(async()=>{ const b=await chromium.launch(); try{
 // ---------- Vendedora (Yulimar) ----------
 const v=await contexto(b,'vendedor');
 await catalogo(v);
 await foto(v,'v1-mas',[['#btnNuevo','1']],{completa:true,sinScroll:true});
 await v.click('#btnNuevo');await v.waitForTimeout(600);
 await foto(v,'v2-tipo',[['#tipoGrid','2']],{alto:470});
 await v.click('#tipoGrid [data-elegir="Puerta Multilock"]');await v.waitForTimeout(700);
 await v.fill('#fNombre','Modelo Arco 5 vidrios');
 await foto(v,'v3-fotos-nombre',[['#fotosLabel','3']],{alto:360});
 await v.evaluate(()=>{const f=document.querySelector('#fotosLabel').parentElement;f.id='__fotos';});
 await foto(v,'v3-fotos-nombre',[['#__fotos','3'],['#fNombre','']],{alto:380});
 await foto(v,'v4-specs',[['#specs','4']],{alto:470});
 await v.fill('#fPrecio','270');
 await foto(v,'v5-precio',[['#campoPrecio','5']],{alto:260});
 await foto(v,'v6-guardar',[['#btnGuardar','6']],{alto:200});
 await nuevo(v,'Combo');
 await v.evaluate(()=>{const e=[...document.querySelectorAll('#specs .field-label')].find(x=>/2 ventanas/.test(x.textContent));e.parentElement.id='__vent';});
 await foto(v,'combo-ventanas',[['#__vent','!']],{alto:260});
 await catalogo(v);await v.click('.card[data-id="118"]');await v.waitForTimeout(800);
 await foto(v,'entrega-inmediata',[['#sheetDetalle [data-accion="marcar"]','1']],{alto:300,sinScroll:true});

 // ---------- Después de registrar (vendedora) ----------
 await catalogo(v);
 await foto(v,'d1-buscar',[['.search-box','1'],['.chip[data-cat="Todos"]','2']],{alto:300,sinScroll:true});
 await v.evaluate(()=>document.querySelector('.chip-revisar').scrollIntoView({inline:'center',block:'nearest'}));await v.waitForTimeout(300);
 await foto(v,'d7-repetidos',[['.chip-revisar','']],{alto:260,sinScroll:true});
 await v.evaluate(()=>document.querySelector('#chips').scrollLeft=0);
 await v.click('.card[data-id="108"]');await v.waitForTimeout(800);
 await foto(v,'d2-editar',[['#sheetDetalle [data-accion="editar-modelo"]','1']],{alto:300,sinScroll:true});
 await foto(v,'d6-eliminar',[['#sheetDetalle [data-accion="eliminar-modelo"]','']],{alto:300,sinScroll:true});
 await v.click('#sheetDetalle [data-accion="editar-modelo"]');await v.waitForTimeout(800);
 await foto(v,'d3-form-editar',[['#formTitulo','2']],{alto:330,sinScroll:true});
 await v.click('#foldPublicoBtn');await v.waitForTimeout(500);
 await v.fill('#fBadge','Nuevo');await v.fill('#fDescripcion','Medidas: 2 m alto x 1 m ancho');
 await foto(v,'d4-publico',[['#foldPublico .fold-body','3']],{alto:520});
 await catalogo(v);await v.click('.card[data-id="7"]');await v.waitForTimeout(800);
 await foto(v,'d5a-piezas',[['#sheetDetalle [data-pieza="50"]','1']],{alto:360});
 await v.click('#sheetDetalle [data-pieza="50"]');await v.waitForTimeout(700);
 await foto(v,'d5b-pieza',[['#sheetDetalle [data-accion="editar-pieza"]','2'],['#sheetDetalle [data-accion="quitar-pieza"]','3']],{alto:320,sinScroll:true});
 await v.goto(H+'index.html');await v.waitForSelector('#btnCuenta');await v.waitForTimeout(700);
 await v.click('#btnCuenta');await v.waitForTimeout(700);
 await foto(v,'d8-publico-menu',[['#grupoCatPublico','']],{alto:330});
 // ---------- Administrador (Ray) ----------
 const a=await contexto(b,'admin');
 const pend=await a.$('a.pend-fila[href="categorias-pago.html?asignar=1"]');
 if(pend) await foto(a,'a1-pendiente',[['a.pend-fila[href="categorias-pago.html?asignar=1"]','1']],{alto:300}); else console.log('sin pendiente de categoría');
 await a.goto(H+'categorias-pago.html?asignar=1');await a.waitForSelector('.c-card');await a.waitForTimeout(600);
 await a.click('.c-card >> text=Puerta sencilla');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(500);
 await foto(a,'a2-asignar',[['#btnAsignarModelos','2']],{alto:300});
 await a.click('#btnAsignarModelos');await a.waitForSelector('#sheetModelos.open');await a.waitForTimeout(500);
 await a.click('.m-fila[data-mid="118"]');await a.click('.m-fila[data-mid="108"]');await a.waitForTimeout(200);
 await foto(a,'a3-marcar',[['.m-fila[data-mid="118"]','3'],['.m-fila[data-mid="108"]','']],{alto:330});
 await foto(a,'a4-boton',[['#btnAsignar','4']],{alto:200});
 await nuevo(a,'Puerta Multilock');
 await foto(a,'a5-campo',[['#campoCategoria','']],{alto:230});
 console.log('listo');
 }catch(x){console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
