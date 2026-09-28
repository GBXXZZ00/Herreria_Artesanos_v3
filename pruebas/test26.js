// Inicio del trabajador (sus trabajos: empezar uno a la vez, terminar; sus pagos y vales)
// y avisos del administrador (vales por aprobar, trabajos sin asignar, falta categoría).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

let trabajos=[
  {id:501,nombre:'Hierro',especialidad:'herrero',rama:'principal',iniciada_en:null,venta_id:40,interna:false,fecha_entrega:dia(3),producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:null,cantidad:1,color:'Blanco',medidas:'2 × 1 m',espera:null,monto:25},
  {id:502,nombre:'Ensamblar',especialidad:'ventanero',rama:'ventana',iniciada_en:null,venta_id:41,interna:false,fecha_entrega:dia(6),producto:'Combo Imperial',tipo:'Combo',foto:null,cantidad:1,color:'Negro',medidas:'2 × 1 m',espera:null,monto:null},
  {id:503,nombre:'Detalles',especialidad:'acabados',rama:'principal',iniciada_en:null,venta_id:40,interna:false,fecha_entrega:dia(3),producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:null,cantidad:1,color:'Blanco',medidas:'2 × 1 m',espera:'Masilla y pintura',monto:5}
];
let pagos={ganado:30,vales:0,por_definir:1,vale_pendiente:null,movimientos:[
  {tipo:'trabajo',id:400,fecha:new Date().toISOString(),titulo:'Hierro',detalle:'Puerta Colonial · N° 38',monto:30},
  {tipo:'trabajo',id:401,fecha:new Date().toISOString(),titulo:'Masilla y pintura',detalle:'Ventana · N° 39',monto:null}
]};
let vales=[{id:9,monto:20,nota:'pasaje',creado_en:new Date().toISOString(),trabajador:{nombre:'Jesús'}}];
const llamadas=[];

function mock(ctx,user,rol,nombre){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const m=req.method();
  const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...h},body:JSON.stringify(x)});
  const head=(n)=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  const body=()=>JSON.parse(req.postData()||'{}');
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/mis_trabajos'))return j(trabajos);
  if(u.includes('/rpc/mis_pagos'))return j(pagos);
  if(u.includes('/rpc/empezar_etapa')){const bd=body();llamadas.push(['empezar',bd]);
    if(trabajos.some(t=>t.iniciada_en))return j({message:'Primero termina el trabajo que ya empezaste'},400);
    trabajos.find(t=>t.id===bd.eid).iniciada_en=new Date().toISOString();
    trabajos.sort((a,b)=>(a.iniciada_en?0:1)-(b.iniciada_en?0:1));return j(null);}
  if(u.includes('/rpc/pausar_etapa')){const bd=body();llamadas.push(['pausar',bd]);trabajos.find(t=>t.id===bd.eid).iniciada_en=null;return j(null);}
  if(u.includes('/rpc/marcar_etapa_terminada')){const bd=body();llamadas.push(['terminar',bd]);
    const t=trabajos.find(x=>x.id===bd.eid);trabajos=trabajos.filter(x=>x.id!==bd.eid);
    pagos.ganado+=t.monto||0;pagos.movimientos.unshift({tipo:'trabajo',id:t.id,fecha:new Date().toISOString(),titulo:t.nombre,detalle:t.producto,monto:t.monto});
    return j({venta_id:t.venta_id,listo:false,interna:false,monto:t.monto});}
  if(u.includes('/rpc/pedir_vale')){const bd=body();llamadas.push(['vale',bd]);
    pagos.vale_pendiente={id:10,monto:bd.p_monto};pagos.movimientos.unshift({tipo:'vale',id:10,fecha:new Date().toISOString(),titulo:'Vale',detalle:bd.p_nota||'',monto:bd.p_monto,estado:'pendiente'});return j({id:10});}
  if(u.includes('/rpc/resolver_vale')){const bd=body();llamadas.push(['resolver',bd]);vales=vales.filter(v=>v.id!==bd.vid);return j(null);}
  if(u.includes('/vales'))return j(vales);
  if(u.includes('/perfiles')){
    if(u.includes('id=eq'))return j({id:user,usuario:nombre.toLowerCase(),nombre,rol,sede_id:1,confirma_abonos:false});
    return j([{usuario:nombre.toLowerCase(),nombre,rol,orden:1}]);
  }
  if(u.includes('/categorias_pago'))return m==='HEAD'?head(2):j([]);
  if(u.includes('/catalogo'))return m==='HEAD'?head(u.includes('categoria_pago_id=is.null')?3:37):j([]);
  if(u.includes('/ventas')){
    if(u.includes('estado=eq.en_produccion'))return j([{id:40,items:[
      {categoria_pago_id:null,etapas:[{rama:'principal',orden:1,estado:'hecha',trabajador_id:'x'},{rama:'principal',orden:2,estado:'pendiente',trabajador_id:null}]},
      {categoria_pago_id:7,etapas:[]}
    ]}]);
    return j([]);
  }
  return j([]);});}

async function entrar(b,user,rol,nombre){
  const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,user,rol,nombre);
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '555555') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');
  return p;
}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // ---------- Trabajador ----------
 const t=await entrar(b,'u5','trabajador','Jesús');t.on('pageerror',e=>err.push('trab:'+e.message));
 await t.waitForSelector('.t-tile');
 ok('Trabajador no ve "Nueva venta", módulos ni menú de abajo',!(await t.isVisible('#btnNuevaVenta')) && !(await t.isVisible('#modulos')) && !(await t.isVisible('#menuModulos')));
 ok('Ve "3 Trabajos pendientes"',(await t.textContent('#vistaTrabajo')).includes('3') && (await t.textContent('#vistaTrabajo')).includes('Trabajos pendientes'));
 ok('Ve "$30 Por cobrar"',(await t.textContent('#vistaTrabajo')).includes('$30') && (await t.textContent('#vistaTrabajo')).includes('Por cobrar'));
 ok('Sin trabajo empezado no sale la tarjeta "Estás trabajando en"',!(await t.$('.t-activo')));
 await t.screenshot({path:'shots5/t1-inicio.png'});

 await t.click('.t-tile[data-ver="trabajos"]');await t.waitForSelector('#sheetTrabajos.open');
 ok('Lista sus 3 trabajos',(await t.$$('#listaTrabajos .tr')).length===3);
 ok('Muestra cuánto gana',(await t.textContent('#listaTrabajos')).includes('Ganas $25'));
 ok('El que espera otra etapa está bloqueado y lo dice',(await t.textContent('#listaTrabajos')).includes('Espera que terminen Masilla y pintura') && !(await t.$('[data-empezar="503"]')));
 ok('Los otros dos se pueden empezar',!!(await t.$('[data-empezar="501"]')) && !!(await t.$('[data-empezar="502"]')));
 await t.screenshot({path:'shots5/t2-trabajos.png'});
 await t.click('[data-empezar="501"]');await t.waitForTimeout(600);
 ok('Se llamó a empezar con el trabajo elegido',llamadas.some(x=>x[0]==='empezar'&&x[1].eid===501));
 ok('El empezado queda arriba y marcado "en curso"',(await t.textContent('#listaTrabajos .tr.activo')).includes('en curso') && (await t.textContent('#listaTrabajos .tr.activo')).includes('Hierro'));
 ok('Los demás quedan bloqueados',!(await t.$('[data-empezar]')) && (await t.textContent('#listaTrabajos')).includes('Primero termina el que empezaste'));
 await t.screenshot({path:'shots5/t3-empezado.png'});
 // Dejar para después y volver a empezar
 await t.click('[data-pausar="501"]');await t.waitForTimeout(600);
 ok('"Dejar para después" libera los demás',!!(await t.$('[data-empezar="502"]')));
 await t.click('[data-empezar="501"]');await t.waitForTimeout(600);

 // Marcar terminado
 await t.click('#listaTrabajos [data-terminar-t="501"]');await t.waitForSelector('#sheetTerminarT.open');
 ok('La hoja de terminar dice cuál es',(await t.textContent('#terminarTSub')).includes('Hierro · Puerta Lineal · N° 40'));
 await t.click('#btnTConfirmar');await t.waitForTimeout(700);
 ok('Se llamó a marcar terminado',llamadas.some(x=>x[0]==='terminar'&&x[1].eid===501));
 ok('Le dice cuánto sumó',(await t.textContent('#toast')).includes('Sumaste $25'));
 ok('Quedan 2 trabajos y ninguno bloqueado por otro activo',(await t.$$('#listaTrabajos .tr')).length===2 && !!(await t.$('[data-empezar="502"]')));
 await t.click('#sheetTrabajos [data-cerrar="sheetTrabajos"]');await t.waitForTimeout(400);
 ok('Inicio se actualiza: $55 por cobrar',(await t.textContent('#vistaTrabajo')).includes('$55'));

 // Tarjeta "Estás trabajando en" en Inicio
 await t.click('.t-tile[data-ver="trabajos"]');await t.waitForSelector('#sheetTrabajos.open');
 await t.click('[data-empezar="502"]');await t.waitForTimeout(600);
 await t.click('#sheetTrabajos [data-cerrar="sheetTrabajos"]');await t.waitForTimeout(400);
 ok('En Inicio aparece "Estás trabajando en" con su trabajo',(await t.textContent('.t-activo')).includes('Ensamblar · Combo Imperial'));
 await t.screenshot({path:'shots5/t4-activo.png'});

 // Pagos y vale
 await t.click('.t-tile[data-ver="pagos"]');await t.waitForSelector('#sheetPagos.open');
 const pg=await t.textContent('#pagosBody');
 ok('Pagos: por cobrar, ganado y vales',pg.includes('$55') && pg.includes('Ganado') && pg.includes('Vales'));
 ok('Avisa lo que está sin monto',pg.includes('1 trabajo terminado todavía no tiene monto'));
 ok('Movimiento sin monto dice "Por definir"',pg.includes('Por definir'));
 await t.screenshot({path:'shots5/t5-pagos.png'});
 await t.click('#btnAbrirVale');await t.waitForSelector('#sheetVale.open');
 await t.click('#btnPedirVale');await t.waitForTimeout(200);
 ok('Sin monto muestra el error debajo del campo',await t.isVisible('#campoValeMonto .field-error'));
 await t.fill('#valeMonto','15');await t.fill('#valeNota','medicinas');
 await t.click('#btnPedirVale');await t.waitForTimeout(700);
 const va=llamadas.find(x=>x[0]==='vale');
 ok('Se pidió el vale con monto y nota',va&&va[1].p_monto===15&&va[1].p_nota==='medicinas',va&&va[1]);
 ok('Ahora dice que el vale espera respuesta y no deja pedir otro',(await t.textContent('#pagosBody')).includes('Vale de $15 esperando respuesta') && !(await t.$('#btnAbrirVale')));
 ok('El vale aparece "Por aprobar" en movimientos',(await t.textContent('#pagosBody')).includes('Por aprobar'));

 // Aviso tocado: index.html?ver=pagos abre sus pagos
 await t.goto('http://127.0.0.1:8765/index.html?ver=pagos');await t.waitForSelector('#sheetPagos.open',{timeout:8000});
 ok('?ver=pagos abre "Mis pagos"',true);
 await t.goto('http://127.0.0.1:8765/ventas.html');await t.waitForURL('**/index.html',{timeout:8000});
 ok('Trabajador que escribe ventas.html vuelve a su Inicio',t.url().includes('index.html'));
 await t.goto('http://127.0.0.1:8765/catalogo.html');await t.waitForURL('**/index.html',{timeout:8000});
 ok('Y catalogo.html también',t.url().includes('index.html'));

 // ---------- Administrador ----------
 const a=await entrar(b,'u2','admin','Ray');a.on('pageerror',e=>err.push('admin:'+e.message));
 await a.waitForSelector('[data-abrir-vales]');
 const av=await a.textContent('#avisosAdmin');
 ok('Admin ve "1 vale por aprobar"',av.includes('1 vale por aprobar') && av.includes('Jesús'));
 ok('Admin ve "1 trabajo sin asignar"',av.includes('1 trabajo sin asignar'));
 ok('Admin ve "1 producto sin categoría de pago"',av.includes('1 producto sin categoría'));
 ok('Admin ve "3 modelos sin categoría de pago"',av.includes('3 modelos sin categoría'));
 ok('Los avisos llevan al lugar correcto',!!(await a.$('a.pend-fila[href="produccion.html?filtro=asignar"]')) && !!(await a.$('a.pend-fila[href="produccion.html?filtro=sincat"]')) && !!(await a.$('a.pend-fila[href="categorias-pago.html"]')));
 ok('Los pendientes van en una sola caja con su contador',(await a.$$('#avisosAdmin .pend')).length===1 && (await a.$$('.pend-fila')).length===4 && (await a.textContent('.pend-n'))==='4');
 ok('Cada pendiente tiene su color',!!(await a.$('.pend-fila.naranja')) && !!(await a.$('.pend-fila.verde')) && !!(await a.$('.pend-fila.teal')));
 ok('El aviso de notificaciones va aparte',!!(await a.$('#avisosAdmin > .notif-fila')));
 ok('Admin sigue viendo sus módulos',await a.isVisible('#modulos') && await a.isVisible('#btnNuevaVenta'));
 ok('La cajita Producción dice cuántos hay en taller',(await a.textContent('#cuenta-produccion'))==='1 sin asignar',await a.textContent('#cuenta-produccion'));
 await a.screenshot({path:'shots5/t6-admin.png',fullPage:true});
 await a.click('[data-abrir-vales]');await a.waitForSelector('#sheetVales.open');
 ok('Hoja con el vale de Jesús',(await a.textContent('#valesBody')).includes('Jesús · $20'));
 await a.screenshot({path:'shots5/t7-vales.png'});
 await a.click('[data-resolver="si"]');await a.waitForTimeout(800);
 const rv=llamadas.find(x=>x[0]==='resolver');
 ok('Aprobar llama al servidor',rv&&rv[1].vid===9&&rv[1].aprobar===true,rv&&rv[1]);
 ok('La hoja se cierra y el aviso desaparece',!(await a.$('#sheetVales.open')) && !(await a.textContent('#avisosAdmin')).includes('vale por aprobar'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
