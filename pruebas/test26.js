// Inicio del trabajador (sus trabajos: empezar uno a la vez, terminar; sus pagos y vales)
// y avisos del administrador (vales por aprobar, trabajos sin asignar, falta categoría).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const hace=(n)=>{const d=new Date();d.setDate(d.getDate()-n);d.setHours(12);return d.toISOString();};
const lunes=(n)=>{const d=new Date();d.setHours(12);d.setDate(d.getDate()-((d.getDay()+6)%7)-7*n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
let trabajos=[
  {id:501,nombre:'Hierro',especialidad:'herrero',rama:'principal',iniciada_en:null,venta_id:40,interna:false,fecha_entrega:dia(3),producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,cantidad:1,color:'Blanco',medidas:'2 × 1 m',especificaciones:{color:'Blanco',alto:2,ancho:1,manillon:true,manillon_tipo:'H',sentido:'Derecha',cerradura:'Multilock'},espera:null,monto:25},
  {id:502,nombre:'Ensamblar',especialidad:'ventanero',rama:'ventana',iniciada_en:null,venta_id:41,interna:false,fecha_entrega:dia(6),producto:'Combo Imperial',tipo:'Combo',foto:null,cantidad:2,color:'Negro',medidas:'2 × 1 m',especificaciones:{color:'Negro',alto:2,ancho:1,ventanas_alto:1,ventanas_ancho:1},espera:null,monto:null},
  {id:503,nombre:'Detalles',especialidad:'acabados',rama:'principal',iniciada_en:null,venta_id:40,interna:false,fecha_entrega:dia(3),producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,cantidad:1,color:'Blanco',medidas:'2 × 1 m',especificaciones:{color:'Blanco'},espera:'Masilla y pintura',monto:5}
];
let pagos={
  trabajos:[
    {id:400,etapa:'Hierro',producto:'Puerta Colonial',tipo:'Puerta Multilock',ref:'N° 38',fecha:hace(0),monto:30},
    {id:401,etapa:'Masilla y pintura',producto:'Ventana Simple',tipo:'Ventana',ref:'N° 39',fecha:hace(0),monto:null},
    {id:399,etapa:'Hierro',producto:'Portón Real',tipo:'Portón',ref:'N° 35',fecha:hace(7),monto:40}
  ],
  vales:[{id:7,monto:10,nota:'pasaje',fecha:hace(1)}],
  vale_pendiente:null,
  semanas:[
    {semana:lunes(0),trabajos:[{etapa:'Hierro',producto:'Puerta Colonial',ref:'N° 38',fecha:hace(0),monto:30,pagado:false}],vales:[{monto:10,nota:'pasaje',fecha:hace(1),pagado:false}],pagado_en:null},
    {semana:lunes(2),trabajos:[{etapa:'Hierro',producto:'Puerta Real',ref:'N° 30',fecha:hace(15),monto:50,pagado:true}],vales:[],pagado_en:hace(12)}
  ]
};
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
  if(u.includes('/rpc/pausar_etapa')){const bd=body();llamadas.push(['pausar',bd]);trabajos.find(t=>t.id===bd.eid).iniciada_en=null;trabajos.sort((x,y)=>(x.iniciada_en?0:1)-(y.iniciada_en?0:1)||x.fecha_entrega.localeCompare(y.fecha_entrega));return j(null);}
  if(u.includes('/rpc/marcar_etapa_terminada')){const bd=body();llamadas.push(['terminar',bd]);
    const t=trabajos.find(x=>x.id===bd.eid);trabajos=trabajos.filter(x=>x.id!==bd.eid);
    pagos.trabajos.unshift({id:t.id,etapa:t.nombre,producto:t.producto,tipo:t.tipo,ref:'N° '+t.venta_id,fecha:new Date().toISOString(),monto:t.monto});
    return j({venta_id:t.venta_id,listo:false,interna:false,monto:t.monto});}
  if(u.includes('/rpc/pedir_vale')){const bd=body();llamadas.push(['vale',bd]);
    pagos.vale_pendiente={id:10,monto:bd.p_monto,fecha:new Date().toISOString()};return j({id:10});}
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
 await t.waitForSelector('.hoy');
 ok('Trabajador no ve "Nueva venta", módulos ni menú de abajo',!(await t.isVisible('#btnNuevaVenta')) && !(await t.isVisible('#modulos')) && !(await t.isVisible('#menuModulos')));
 ok('Mensaje grande: "¿Qué vas a hacer hoy?"',(await t.textContent('.hoy-tit'))==='¿Qué vas a hacer hoy?');
 ok('Le sugiere el que le toca, con foto, nombre y especificaciones',(await t.textContent('.hoy')).includes('Te toca: Hierro') && (await t.textContent('.hoy-nom'))==='Puerta Lineal' && !!(await t.$('.hoy-foto img')) && (await t.textContent('.hoy .spec-chips')).includes('2 × 1 m') && (await t.textContent('.hoy .spec-chip'))==='Color blanco');
 ok('Filas largas con flecha: trabajos por hacer, te toca cobrar, historial',(await t.textContent('#vistaTrabajo .pend-fila.naranja')).includes('3 trabajos por hacer') && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('Te toca cobrar · $60') && (await t.textContent('#vistaTrabajo .pend-fila.teal')).includes('Historial de pagos') && (await t.$$('#vistaTrabajo .pend-fila .chev')).length===3);
 ok('Ve la fila de avisos del teléfono como en el Inicio',!!(await t.$('#avisosAdmin .notif-fila')));
 await t.screenshot({path:'shots5/t1-inicio.png',fullPage:true});

 // Foto → detalle con todas las especificaciones
 await t.click('.hoy-foto');await t.waitForSelector('#sheetTrabajo.open');
 const det=await t.textContent('#trabajoBody');
 ok('Detalle: foto grande, modelo, su parte y todas las especificaciones',!!(await t.$('#trabajoBody .hero img')) && det.includes('Puerta Lineal') && det.includes('Tu parte: Hierro') && det.includes('Manillón H') && det.includes('Abre a la derecha') && det.includes('Ganas $25') && det.includes('N° 40'));
 await t.screenshot({path:'shots5/t2-detalle.png'});
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);

 // Lista de trabajos
 await t.click('#vistaTrabajo [data-ver="trabajos"]');await t.waitForSelector('#sheetTrabajos.open');
 ok('Lista sus 3 trabajos con foto',(await t.$$('#listaTrabajos .tr')).length===3 && (await t.$$('#listaTrabajos .tr-foto img')).length===2);
 ok('Muestra cuánto gana',(await t.textContent('#listaTrabajos')).includes('Ganas $25'));
 ok('El que espera otra etapa lo dice',(await t.textContent('#listaTrabajos')).includes('Espera que terminen Masilla y pintura'));
 ok('La lista no tiene botones de acción (se ve la foto antes de empezar)',!(await t.$('#listaTrabajos [data-empezar]')));
 await t.screenshot({path:'shots5/t3-trabajos.png'});
 await t.click('#listaTrabajos [data-detalle="503"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('Detalle del bloqueado: no se puede empezar y dice por qué',!(await t.$('#trabajoFoot [data-empezar]')) && (await t.textContent('#trabajoFoot')).includes('Espera que terminen Masilla y pintura'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 await t.click('#listaTrabajos [data-detalle="502"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('Sin foto muestra el ícono y las unidades',!(await t.$('#trabajoBody .hero img')) && (await t.textContent('#trabajoBody')).includes('2 unidades'));
 await t.click('#trabajoFoot [data-empezar="502"]');await t.waitForTimeout(800);
 ok('Empezar llama al servidor y cierra las hojas',llamadas.some(x=>x[0]==='empezar'&&x[1].eid===502) && !(await t.$('#sheetTrabajo.open')) && !(await t.$('#sheetTrabajos.open')));
 ok('Inicio: "Hoy estás haciendo" con su trabajo en curso',(await t.textContent('.hoy-tit'))==='Hoy estás haciendo' && (await t.textContent('.hoy-nom'))==='Combo Imperial' && !!(await t.$('.hoy.activo .hoy-en')) && !!(await t.$('.hoy [data-terminar-t="502"]')));
 await t.screenshot({path:'shots5/t4-activo.png',fullPage:true});

 // Otro trabajo queda bloqueado mientras hay uno en curso
 await t.click('#vistaTrabajo [data-ver="trabajos"]');await t.waitForSelector('#sheetTrabajos.open');
 ok('El empezado queda arriba y dice "En curso"',(await t.textContent('#listaTrabajos .tr.activo')).includes('En curso'));
 await t.click('#listaTrabajos [data-detalle="501"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('Los demás dicen "Primero termina el que empezaste"',(await t.textContent('#trabajoFoot')).includes('Primero termina el que empezaste'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(300);
 await t.click('#listaTrabajos [data-detalle="502"]');await t.waitForSelector('#sheetTrabajo.open');
 await t.click('#trabajoFoot [data-pausar="502"]');await t.waitForTimeout(700);
 ok('"Dejar para después" lo libera',llamadas.some(x=>x[0]==='pausar') && !!(await t.$('#trabajoFoot [data-empezar="502"]')));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(300);
 await t.click('#sheetTrabajos [data-cerrar="sheetTrabajos"]');await t.waitForTimeout(400);

 // Empezar desde Inicio y marcar terminado
 await t.click('.hoy [data-empezar="501"]');await t.waitForTimeout(700);
 ok('Empezar desde la tarjeta de Hoy',(await t.textContent('.hoy-tit'))==='Hoy estás haciendo' && (await t.textContent('.hoy-nom'))==='Puerta Lineal');
 await t.click('.hoy [data-terminar-t="501"]');await t.waitForSelector('#sheetTerminarT.open');
 ok('La hoja de terminar dice cuál es',(await t.textContent('#terminarTSub')).includes('Hierro · Puerta Lineal · N° 40'));
 await t.click('#btnTConfirmar');await t.waitForTimeout(700);
 ok('Se llamó a marcar terminado',llamadas.some(x=>x[0]==='terminar'&&x[1].eid===501));
 ok('Le dice cuánto sumó',(await t.textContent('#toast')).includes('Sumaste $25'));
 ok('Inicio se actualiza: 2 por hacer y $85 por cobrar',(await t.textContent('#vistaTrabajo .pend-fila.naranja')).includes('2 trabajos por hacer') && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('$85'));

 // Mis pagos: por cobrar
 await t.click('#vistaTrabajo [data-ver="pagos"]');await t.waitForSelector('#sheetPagos.open');
 const pg=await t.textContent('#pagosBody');
 ok('Por cobrar: esta semana y semana pasada',pg.includes('Esta semana') && pg.includes('Semana pasada'));
 ok('Vales en rojo que restan',(await t.textContent('#pagosBody .pg-mov.vale .pg-mov-m.rojo'))==='−$10');
 ok('Suma abajo: trabajos, vales y "Te toca cobrar"',(await t.textContent('.pg-cuenta')).includes('Trabajos$95') && (await t.textContent('.pg-cuenta')).includes('−$10') && (await t.textContent('.pg-cuenta-total b'))==='$85');
 ok('Sin monto dice "Por definir" y avisa',pg.includes('Por definir') && pg.includes('1 trabajo todavía no tiene monto'));
 await t.screenshot({path:'shots5/t5-pagos.png',fullPage:true});

 // Historial
 await t.click('[data-pg-tab="historial"]');await t.waitForTimeout(200);
 const hi=await t.textContent('#pagosBody');
 ok('Historial por semana: esta semana por cobrar, otra pagada',(await t.$$('.pg-sem')).length===2 && hi.includes('Esta semana') && hi.includes('Por cobrar') && hi.includes('Pagado'));
 ok('La semana abierta muestra lo que hizo y el neto',(await t.textContent('.pg-sem[open]')).includes('Puerta Colonial') && (await t.textContent('.pg-sem[open] .pg-sem-m b'))==='$20');
 await t.screenshot({path:'shots5/t6-historial.png',fullPage:true});

 // Vale
 await t.click('[data-pg-tab="cobrar"]');await t.waitForTimeout(200);
 await t.click('#btnAbrirVale');await t.waitForSelector('#sheetVale.open');
 await t.click('#btnPedirVale');await t.waitForTimeout(200);
 ok('Sin monto muestra el error debajo del campo',await t.isVisible('#campoValeMonto .field-error'));
 await t.fill('#valeMonto','15');await t.fill('#valeNota','medicinas');
 await t.click('#btnPedirVale');await t.waitForTimeout(700);
 const va=llamadas.find(x=>x[0]==='vale');
 ok('Se pidió el vale con monto y nota',va&&va[1].p_monto===15&&va[1].p_nota==='medicinas',va&&va[1]);
 ok('El vale sale "Por aprobar" sin restar y no deja pedir otro',(await t.textContent('#pagosBody')).includes('Por aprobar') && (await t.textContent('.pg-cuenta-total b'))==='$85' && !(await t.$('#btnAbrirVale')));
 await t.click('#sheetPagos [data-cerrar="sheetPagos"]');await t.waitForTimeout(400);
 ok('En Inicio: fila amarilla del vale esperando respuesta',(await t.textContent('#vistaTrabajo .pend-fila.amarillo')).includes('Vale de $15'));

 // Aviso tocado
 await t.goto('http://127.0.0.1:8765/index.html?ver=pagos');await t.waitForSelector('#sheetPagos.open',{timeout:8000});
 ok('?ver=pagos abre "Mis pagos"',true);
 await t.goto('http://127.0.0.1:8765/ventas.html',{waitUntil:'commit'}).catch(()=>{});await t.waitForURL('**/index.html',{timeout:8000}).catch(()=>{});await t.waitForTimeout(1500);
 ok('Trabajador que escribe ventas.html vuelve a su Inicio',t.url().includes('index.html'));

 // Sin trabajos
 trabajos=[];
 await t.goto('http://127.0.0.1:8765/index.html');await t.waitForSelector('.hoy');
 ok('Sin trabajos: mensaje claro y sin fila de trabajos',(await t.textContent('.hoy')).includes('No tienes trabajos asignados') && !(await t.$('#vistaTrabajo .pend-fila.naranja')));

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
 ok('Cada pendiente tiene su color: naranja, verde, azul y teal con ícono de catálogo',!!(await a.$('.pend-fila.naranja')) && !!(await a.$('.pend-fila.verde')) && (await a.textContent('.pend-fila.azul')).includes('producto sin categoría') && (await a.textContent('.pend-fila.teal')).includes('modelos sin categoría'));
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
