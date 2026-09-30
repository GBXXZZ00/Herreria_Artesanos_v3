const __L=require('./lib');const __fs=require('fs');const __OUT=__dirname+'/shots-taller/';__fs.mkdirSync(__OUT,{recursive:true});
const __MAP={"t1-elegir":[[[".el-op","1"]]],
 "t1b-ordenar":[[["#listaOrden","1"],["#btnGuardarOrden","2"]]],
 "t1c-haciendo":[[[".hoy [data-terminar-t=\"501\"]","1"]]],
 "t2-detalle":[],
 "t3-terminar":[],
 "t3c-terminar-foto":[[["#btnTConfirmar",""]]],
 "t5-pagos":[],
 "t5b-hecho":[],
 "t6-historial":[[["[data-pg-tab=\"historial\"]",""]]],
 "t8-vale":[],"t1d-empezar":[[[".hoy [data-empezar=\"501\"]","1"]]],
 "__insertar":[["await t.click('#btnAbrirVale');await t.waitForSelector('#sheetVale.open');","await F(t,'t8-vale');"],
   ["await t.click('.el-op[data-elegir=\"501\"]');await t.waitForTimeout(150);","await F(t,'t1d-empezar');"]]}
;
async function F(pg,n){const m=__MAP[n];if(m===undefined)return;try{await pg.waitForTimeout(300);if(!m.length)return await pg.screenshot({path:__OUT+n+'.png'});await __L.foto(pg,__OUT,n,m[0],Object.assign({completa:true},m[1]||{}));}catch(e){console.log('marca',n,e.message.split('\n')[0]);await pg.screenshot({path:__OUT+n+'.png'});}}
// Inicio del trabajador: "¿Con cuál empiezas?" (uno solo en proceso), "Estás haciendo" con un solo botón
// para terminar (foto obligatoria), "Ordena el trabajo", fila "Después" con margen a los lados, detalle con
// todas las especificaciones, "de la semana pasada", Mis pagos con las dos fotos (catálogo y la suya),
// detalle de lo hecho e historial cerrado. Y los pendientes
// del administrador (vales que llevan a Nómina, trabajos sin asignar o atrasados, fotos que faltan).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const GIF2='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const hace=(n)=>{const d=new Date();d.setDate(d.getDate()-n);d.setHours(12);return d.toISOString();};
// Semana de lunes a sábado: el domingo cuenta para la semana siguiente (igual que el servidor)
const semanaDe=(iso)=>{const d=new Date(iso);d.setHours(12);d.setDate(d.getDate()+1);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const iso=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const SAB=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));const este=iso(d);d.setDate(d.getDate()-7);const pasado=iso(d);d.setDate(d.getDate()-7);return {este,pasado,dosAtras:iso(d)};})();
let trabajos=[
  {id:501,nombre:'Hierro',especialidad:'herrero',rama:'principal',unidades:1,para_el:SAB.este,venta_id:40,interna:false,fecha_entrega:dia(3),notas:null,producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,foto_de:'Blanco',cantidad:1,color:'Blanco',especificaciones:{color:'Blanco',alto:2,ancho:1,manillon:true,manillon_tipo:'H',sentido:'Derecha',posicion:'Afuera',bloque:'15',vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'},espera:null,monto:25},
  {id:502,nombre:'Ensamblar 2 ventanas',especialidad:'ventanero',rama:'ventana',unidades:2,para_el:SAB.este,venta_id:41,interna:false,fecha_entrega:dia(6),notas:'El cliente quiere las ventanas con seguro por dentro',producto:'Combo Imperial',tipo:'Combo',foto:GIF,foto_de:'Blanco',cantidad:2,color:'Negro',especificaciones:{color:'Negro',alto:2,ancho:1,ventanas_alto:1.2,ventanas_ancho:1,variante:'Sin protección en puerta'},espera:null,monto:null},
  {id:503,nombre:'Detalles',especialidad:'acabados',rama:'principal',unidades:1,para_el:SAB.este,venta_id:40,interna:false,fecha_entrega:dia(3),notas:null,producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,foto_de:'Blanco',cantidad:1,color:'Blanco',especificaciones:{color:'Blanco'},espera:'Masilla y pintura',monto:5}
];
let pagos={
  trabajos:[
    {id:400,etapa:'Hierro',rama:'principal',producto:'Puerta Colonial',tipo:'Puerta Multilock',venta_id:38,interna:false,fecha:hace(0),semana:semanaDe(hace(0)),monto:30,foto:GIF,foto_de:'Negro',foto_trabajo:GIF2,especificaciones:{color:'Negro',alto:2.1,ancho:0.9,sentido:'Derecha'},notas:'Cerradura de dos vueltas'},
    {id:401,etapa:'Masilla y pintura',producto:'Ventana Simple',tipo:'Ventana',venta_id:39,interna:false,fecha:hace(0),semana:semanaDe(hace(0)),monto:null},
    {id:399,etapa:'Hierro',producto:'Portón Real',tipo:'Portón',venta_id:35,interna:false,fecha:hace(7),semana:semanaDe(hace(7)),monto:40},
    {id:398,etapa:'Detalles',producto:'Reja Domingo',tipo:'Ventana',venta_id:36,interna:false,fecha:hace(0),semana:'2099-01-05',monto:7}
  ],
  vales:[{id:7,monto:10,nota:'pasaje',fecha:hace(1)}],
  vale_pendiente:null,
  semana_actual:semanaDe(new Date().toISOString()),
  semana_pago:semanaDe(new Date().toISOString()),
  pagos:[
    {id:2,pagado_en:hace(2),semana:semanaDe(hace(9)),monto:40,trabajos_monto:50,vales_monto:10,pagado_por:'Ray',
     trabajos:[{id:380,etapa:'Hierro',rama:'principal',producto:'Puerta Real',tipo:'Puerta Multilock',venta_id:30,interna:false,fecha:hace(10),monto:50,foto:GIF,foto_de:'Blanco',foto_trabajo:GIF2,especificaciones:{color:'Blanco'}}],vales:[{id:3,monto:10,nota:'comida',fecha:hace(11),monto_bs:400,tasa:40}]},
    {id:1,pagado_en:hace(9),semana:semanaDe(hace(16)),monto:25,trabajos_monto:25,vales_monto:0,pagado_por:'Ray',
     trabajos:[{id:370,etapa:'Detalles',producto:'Ventana Real',venta_id:28,interna:false,fecha:hace(16),monto:25}],vales:[]}
]
};
let vales=[{id:9,monto:20,nota:'pasaje',creado_en:new Date().toISOString(),trabajador_id:'u5',trabajador:{nombre:'Jesús'}}];
const llamadas=[];let fallaTerminar=false;
// Como el servidor: el que está haciendo primero, luego su orden, luego los que esperan y la fecha
const ordenar=()=>trabajos.slice().sort((a,b)=>(a.iniciada_en?0:1)-(b.iniciada_en?0:1)||(a.orden_trabajador||1e9)-(b.orden_trabajador||1e9)||(a.espera?1:0)-(b.espera?1:0)||(a.para_el||'z').localeCompare(b.para_el||'z')||a.id-b.id);

function mock(ctx,user,rol,nombre){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const m=req.method();
  const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...h},body:JSON.stringify(x)});
  const head=(n)=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  const body=()=>JSON.parse(req.postData()||'{}');
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/mis_trabajos'))return j(ordenar());
  if(u.includes('/storage/v1/object/etapas-fotos/')){llamadas.push(['subir',u]);return j({Key:'etapas-fotos/x.jpg'});}
  if(u.includes('/rpc/ordenar_mis_trabajos')){const bd=body();llamadas.push(['ordenar',bd]);bd.p_ids.forEach((id,i)=>{trabajos.find(t=>t.id===id).orden_trabajador=i+1;});return j(null);}
  if(u.includes('/rpc/mis_pagos'))return j(pagos);
  if(u.includes('/rpc/empezar_etapa')){const bd=body();llamadas.push(['empezar',bd]);
    if(trabajos.some(t=>t.iniciada_en))return j({message:'Primero termina el trabajo que ya empezaste'},400);
    trabajos.find(t=>t.id===bd.eid).iniciada_en=new Date().toISOString();
    trabajos.sort((a,b)=>(a.iniciada_en?0:1)-(b.iniciada_en?0:1));return j(null);}
  if(u.includes('/rpc/pausar_etapa')){const bd=body();llamadas.push(['pausar',bd]);trabajos.find(t=>t.id===bd.eid).iniciada_en=null;trabajos.sort((x,y)=>(x.iniciada_en?0:1)-(y.iniciada_en?0:1)||x.fecha_entrega.localeCompare(y.fecha_entrega));return j(null);}
  if(u.includes('/rpc/marcar_etapa_terminada')){const bd=body();llamadas.push(['terminar',bd]);
    if(fallaTerminar){fallaTerminar=false;return j({message:'Sin conexión con el servidor'},500);}
    if(!bd.foto_url||!bd.foto_url.includes('/etapas-fotos/'))return j({message:'Toma la foto del trabajo terminado para poder terminarlo'},400);
    const t=trabajos.find(x=>x.id===bd.eid);if(!t.iniciada_en)return j({message:'Primero empieza este trabajo en tu inicio'},400);trabajos=trabajos.filter(x=>x.id!==bd.eid);
    pagos.trabajos.unshift({id:t.id,etapa:t.nombre,producto:t.producto,tipo:t.tipo,venta_id:t.venta_id,interna:false,fecha:new Date().toISOString(),semana:semanaDe(new Date().toISOString()),monto:t.monto});
    return j({venta_id:t.venta_id,listo:false,interna:false,monto:t.monto});}
  if(u.includes('/rpc/pedir_vale')){const bd=body();llamadas.push(['vale',bd]);
    pagos.vale_pendiente={id:10,monto:bd.p_monto,fecha:new Date().toISOString()};return j({id:10});}
  if(u.includes('/rpc/resolver_vale')){const bd=body();llamadas.push(['resolver',bd]);vales=vales.filter(v=>v.id!==bd.vid);return j(null);}
  if(u.includes('/vales'))return j(vales);
  if(u.includes('/venta_items'))return j([{catalogo_id:12,especificaciones:{color:'Negro'},catalogo:{id:12,nombre:'Combo Lineal',fotos:{Blanco:GIF}},venta:{estado:'en_produccion'}},{catalogo_id:13,especificaciones:{color:'Blanco'},catalogo:{id:13,nombre:'Taco',fotos:{Blanco:GIF}},venta:{estado:'lista'}}]);
  if(u.includes('/perfiles')){
    if(u.includes('id=eq'))return j({id:user,usuario:nombre.toLowerCase(),nombre,rol,sede_id:1,confirma_abonos:false});
    return j([{usuario:nombre.toLowerCase(),nombre,rol,orden:1}]);
  }
  if(u.includes('/categorias_pago'))return m==='HEAD'?head(2):j([]);
  if(u.includes('/catalogo'))return m==='HEAD'?head(u.includes('categoria_pago_id=is.null')?3:37):u.includes('tipo=eq.Combo')?j([{id:21,nombre:'Combo Viejo',especificaciones_base:{alto:2,ancho:1}},{id:22,nombre:'Combo Bien',especificaciones_base:{alto:2,ancho:1,ventanas_alto:1.2,ventanas_ancho:1}}]):j([]);
  if(u.includes('/ventas')){
    if(u.includes('estado=eq.en_produccion'))return j([{id:40,items:[
      {categoria_pago_id:null,etapas:[{rama:'principal',orden:1,estado:'hecha',trabajador_id:'x'},{rama:'principal',orden:2,estado:'pendiente',trabajador_id:null}]},
      {categoria_pago_id:7,etapas:[{rama:'principal',orden:1,estado:'pendiente',trabajador_id:'x',para_el:SAB.pasado}]},
      {categoria_pago_id:7,etapas:[]}
    ]}]);
    return j([]);
  }
  return j([]);});}

async function entrar(b,user,rol,nombre){
  const ctx=await b.newContext({...devices['iPhone 13'],locale:'es-VE',timezoneId:'America/Caracas'});await mock(ctx,user,rol,nombre);
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
 ok('Arriba dice cuántos trabajos tiene y para qué sábado',(await t.textContent('.hoy-lead')).startsWith('3 trabajos para el sáb'));
 // Sin nada en proceso: "¿Con cuál empiezas?"
 ok('Sin nada en proceso sale grande "¿Con cuál empiezas?"',(await t.textContent('.hoy.elegir .el-tit'))==='¿Con cuál empiezas?' && !(await t.$('[data-terminar-t]')));
 ok('Salen todos: los que puede empezar con su círculo y el que espera en gris sin círculo',(await t.$$('.el-op')).length===3 && (await t.$$('.el-op .el-radio')).length===2 && (await t.textContent('.el-op.gris')).includes('Espera masilla y pintura') && !(await t.$('.el-op.gris[data-elegir]')));
 ok('Viene marcado el primero, con "Sigue", y un solo botón para empezarlo',(await t.getAttribute('.el-op.sel','data-elegir'))==='501' && (await t.textContent('.el-op.sel .el-sigue'))==='Sigue' && (await t.$$('.hoy [data-empezar]')).length===1 && (await t.textContent('.hoy [data-empezar]'))==='Empezar Puerta Lineal');
 ok('Sin fila "Después" (la lista ya los muestra) y con "Ordena el trabajo"',!(await t.$('.despues')) && (await t.textContent('.hoy [data-ordenar]'))==='Ordena el trabajo');
 ok('Una sola fila de pagos: "Pagos y vales · cobras $60 el sábado"',(await t.$$('#vistaTrabajo .pend-fila')).length===1 && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('Pagos y vales · cobras $60 el sábado'));
 ok('Ve la fila de avisos del teléfono como en el Inicio',!!(await t.$('#avisosAdmin .notif-fila')));
 await F(t,'t1-elegir');
 const img0=await t.$('.el-op[data-elegir="501"] .el-foto img');const hoy0=await t.$('.hoy.elegir');
 await t.click('.el-op[data-elegir="502"]');await t.waitForTimeout(150);
 ok('Al marcar otro no se vuelve a dibujar (las fotos no parpadean)',await img0.evaluate(x=>x.isConnected) && await hoy0.evaluate(x=>x.isConnected && getComputedStyle(x).opacity==='1'));
 ok('Tocar otro lo marca y cambia el botón',(await t.getAttribute('.el-op.sel','data-elegir'))==='502' && (await t.textContent('.hoy [data-empezar]'))==='Empezar Combo Imperial');
 await t.focus('.el-op.sel');await t.keyboard.press('ArrowUp');await t.waitForTimeout(150);
 ok('Con el teclado (flechas) también se marca otro',(await t.getAttribute('.el-op.sel','data-elegir'))==='501');
 await t.keyboard.press('ArrowDown');await t.waitForTimeout(150);
 await t.click('.el-op.gris');await t.waitForTimeout(150);
 ok('El que espera a otro no se puede marcar',(await t.getAttribute('.el-op.sel','data-elegir'))==='502');
 await t.click('.el-op.sel .el-ver');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 ok('"Ver todo" abre el detalle con "Empezar este trabajo"',(await t.textContent('#trabajoFoot [data-empezar="502"]'))==='Empezar este trabajo');
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);

 // Ordena el trabajo (tocar en orden)
 await t.click('.hoy [data-ordenar]');await t.waitForSelector('#sheetOrden.open');await t.waitForTimeout(300);
 ok('"Ordena el trabajo": dice qué hacer, 3 trabajos sin número y sin flechas',(await t.$$('#listaOrden .ord-f')).length===3 && (await t.textContent('#sheetOrden .field-hint')).includes('Toca los trabajos en el orden') && (await t.$$('#listaOrden .ord-f.on')).length===0 && !(await t.$('#listaOrden svg')));
 ok('Sin tocar ninguno no se puede guardar',await t.isDisabled('#btnGuardarOrden') && await t.isDisabled('#btnOrdenDeNuevo'));
 await t.click('#listaOrden [data-tocar="503"]');await t.click('#listaOrden [data-tocar="501"]');await t.waitForTimeout(100);
 ok('Tocar pone 1, 2… en el orden en que los toca',(await t.textContent('#listaOrden [data-tocar="503"] .ord-n'))==='1' && (await t.textContent('#listaOrden [data-tocar="501"] .ord-n'))==='2' && (await t.textContent('#listaOrden [data-tocar="502"] .ord-n'))==='');
 await t.click('#listaOrden [data-tocar="503"]');await t.waitForTimeout(100);
 ok('Tocar uno con número se lo quita y los demás se corren',(await t.textContent('#listaOrden [data-tocar="503"] .ord-n'))==='' && (await t.textContent('#listaOrden [data-tocar="501"] .ord-n'))==='1');
 await t.click('#btnOrdenDeNuevo');await t.waitForTimeout(100);
 ok('"Empezar de nuevo" borra los números',(await t.$$('#listaOrden .ord-f.on')).length===0);
 await t.click('#listaOrden [data-tocar="502"]');await t.waitForTimeout(100);
 await F(t,'t1b-ordenar');
 await t.click('#btnGuardarOrden');await t.waitForTimeout(700);
 const lo=llamadas.find(x=>x[0]==='ordenar');
 ok('Se guardó el orden en el servidor',lo && JSON.stringify(lo[1].p_ids)==='[502,501,503]',lo&&lo[1]);
 ok('Ahora "Sigue" es el Combo',!(await t.isVisible('#sheetOrden')) && (await t.getAttribute('.el-op.sel','data-elegir'))==='502' && (await t.textContent('.el-op[data-elegir="502"] .el-sigue'))==='Sigue');

 // Empezar: elige la puerta aunque sigue el Combo
 await t.click('.el-op[data-elegir="501"]');await t.waitForTimeout(150);await F(t,'t1d-empezar');
 await t.click('.hoy [data-empezar="501"]');await t.waitForTimeout(700);
 ok('Se llamó a empezar ese trabajo',llamadas.some(x=>x[0]==='empezar'&&x[1].eid===501));
 ok('Queda grande "Estás haciendo" con la hora y un solo botón',(await t.textContent('.hoy-etapa')).startsWith('Estás haciendo · desde las') && (await t.textContent('.hoy-nom'))==='Hierro · Puerta Lineal' && (await t.textContent('.hoy [data-terminar-t="501"]'))==='Ya lo terminé · tomar foto' && !(await t.$('.hoy [data-empezar]')));
 ok('Foto y especificaciones del que hace',!!(await t.$('.hoy-foto img')) && (await t.textContent('.hoy .spec-chips')).includes('2 × 1 m') && (await t.textContent('.hoy .spec-chip'))==='Color blanco');
 ok('Fila "Después" en su orden, numerada; el que espera en gris',(await t.$$('.despues .dp')).length===2 && (await t.textContent('.dp[data-detalle="502"] .dp-etapa'))==='1 · Ensamblar 2 ventanas' && (await t.textContent('.dp.gris')).includes('Espera masilla y pintura') && (await t.textContent('.dp[data-detalle="502"]')).includes('Para el sáb'));
 ok('"Ordena el trabajo" también arriba de "Después"',!!(await t.$('.despues-head [data-ordenar]')));
 // Margen a los lados al deslizar
 const bx=await t.evaluate(()=>{const r=document.querySelector('.despues');const f=r.querySelector('.dp').getBoundingClientRect();r.scrollLeft=r.scrollWidth;return new Promise(ok=>setTimeout(()=>{const l=[...r.querySelectorAll('.dp')].pop().getBoundingClientRect();ok({x:f.left,der:innerWidth-l.right});},400));});
 ok('La primera y la última de "Después" no quedan pegadas al borde',bx.x>=16 && bx.der>=16,bx);
 await t.evaluate(()=>{document.querySelector('.despues').scrollLeft=0;});
 await F(t,'t1c-haciendo');

 // Detalle del que hace: todas las especificaciones y el botón de terminar
 await t.click('.hoy-foto');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 const det=await t.textContent('#trabajoBody');
 ok('Detalle: foto grande, su parte, fecha tope, pedido y lo que gana',!!(await t.$('#trabajoBody .hero img')) && det.includes('Tu parte: Hierro') && det.includes('Para el sáb') && det.includes('N° 40') && det.includes('Ganas $25'));
 ok('Franja del color: "Va en color BLANCO"',(await t.textContent('.tj-color'))==='Va en color BLANCO');
 const tabla=await t.$$eval('.tj-specs > div',x=>x.map(d=>d.textContent));
 ok('Tabla con todas las especificaciones',['Medidas2 × 1 m','VidrioNegro','ManillónH','Abre a laDerecha','AperturaAfuera','Bloque15'].every(v=>tabla.includes(v)),tabla);
 ok('Abajo, el mismo botón para terminar',(await t.textContent('#trabajoFoot [data-terminar-t="501"]'))==='Ya lo terminé · tomar foto');
 await F(t,'t2-detalle');
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 // El Combo (en "Después"): no se puede empezar mientras hace otro
 await t.click('.dp[data-detalle="502"]');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 const dc=await t.textContent('#trabajoBody');
 ok('Si la foto es de otro color, lo dice sobre la foto',(await t.textContent('#trabajoBody .hoy-badge'))==='Foto en blanco · el combo va en NEGRO');
 ok('Un solo color para todo el combo',(await t.textContent('.tj-color'))==='Va en color NEGRO' && !(await t.textContent('#trabajoBody')).includes('Color de las ventanas'));
 { const x=trabajos.find(t=>t.id===502); x.especificaciones.ventanas_color='Blanco'; }
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);await t.evaluate(()=>window.Trabajo.refrescar());await t.waitForTimeout(400);
 await t.click('.dp[data-detalle="502"]');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 ok('Pedido viejo con ventanas de otro color: se sigue diciendo',(await t.textContent('.tj-color'))==='Las ventanas van en color BLANCO' && (await t.textContent('#trabajoBody')).includes('Color de las ventanasBlanco'));
 delete trabajos.find(t=>t.id===502).especificaciones.ventanas_color;
 ok('Dice que es 1 puerta + 2 ventanas + 2 protecciones, con medidas de las ventanas',dc.includes('1 puerta + 2 ventanas + 2 protecciones') && dc.includes('2 ventanas y 2 protecciones1.2 × 1 m c/u') && dc.includes('2 unidades'));
 ok('La nota de la venta',(await t.textContent('.tj-nota')).includes('seguro por dentro'));
 ok('Mientras hace otro: "Primero termina Hierro · Puerta Lineal", sin botones',(await t.textContent('#trabajoFoot')).includes('Primero termina Hierro · Puerta Lineal') && !(await t.$('#trabajoFoot button')));
 await F(t,'t2b-detalle-combo');
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 await t.click('.dp[data-detalle="503"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('El que espera a otro: se ve todo pero sin botón, dice qué espera',!(await t.$('#trabajoFoot button')) && (await t.textContent('#trabajoFoot')).includes('Espera masilla y pintura'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);

 // Terminar: la foto es obligatoria
 await t.click('.hoy [data-terminar-t="501"]');await t.waitForSelector('#sheetTerminarT.open');await t.waitForTimeout(300);
 ok('La hoja de terminar dice cuál es',(await t.textContent('#terminarTTitulo'))==='Terminar Hierro' && (await t.textContent('#terminarTSub')).includes('Puerta Lineal · N° 40'));
 ok('Sin foto no se puede terminar',await t.isDisabled('#btnTConfirmar') && (await t.textContent('#tFotoAyuda'))==='La foto es obligatoria para terminar.' && (await t.textContent('#btnTFoto')).includes('Toca para tomar la foto'));
 await F(t,'t3-terminar');
 await t.setInputFiles('#tFotoInput',__dirname+'/../foto-puerta.png');await t.waitForTimeout(500);
 ok('Con la foto: se ve la foto y el botón dice cuánto suma',!(await t.isDisabled('#btnTConfirmar')) && !!(await t.$('#btnTFoto img')) && (await t.textContent('#btnTConfirmar'))==='Terminar · suma $25');
 await F(t,'t3c-terminar-foto');
 fallaTerminar=true;
 await t.click('#btnTConfirmar');await t.waitForTimeout(900);
 ok('Si falla: lo dice, la hoja sigue abierta y conserva la foto',(await t.textContent('#toast')).includes('Sin conexión') && await t.isVisible('#sheetTerminarT') && !!(await t.$('#btnTFoto img')) && !(await t.isDisabled('#btnTConfirmar')));
 await t.click('#btnTConfirmar');await t.waitForTimeout(900);
 ok('Al reintentar no sube la foto otra vez (la grande y su chiquita, una vez)',llamadas.filter(x=>x[0]==='subir'&&!x[1].includes('/mini/')).length===1&&llamadas.filter(x=>x[0]==='subir'&&x[1].includes('/etapas-fotos/mini/')).length===1,llamadas.filter(x=>x[0]==='subir').map(x=>x[1].split('/object/')[1]));
 const lt=llamadas.filter(x=>x[0]==='terminar'&&x[1].eid===501).pop();
 ok('Subió la foto y la mandó al terminar',llamadas.some(x=>x[0]==='subir') && lt && lt[1].foto_url.includes('/etapas-fotos/'),lt&&lt[1]);
 ok('Le dice cuánto sumó',(await t.textContent('#toast')).includes('Sumaste $25'));
 ok('Al terminar vuelve "¿Con cuál sigues?" con el siguiente de su orden y $85 por cobrar',(await t.textContent('.el-tit'))==='¿Con cuál empiezas?' && (await t.getAttribute('.el-op.sel','data-elegir'))==='502' && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('$85'));

 // Con muchos trabajos: 4 y "Ver todos"; los de semanas pasadas se dicen así
 for(let i=0;i<5;i++) trabajos.push({id:600+i,nombre:'Detalles',especialidad:'acabados',rama:'principal',unidades:1,para_el:i===0?SAB.pasado:i===1?SAB.dosAtras:SAB.este,venta_id:50+i,interna:false,fecha_entrega:dia(9),notas:null,producto:'Puerta '+(i+1),tipo:'Puerta Multilock',foto:null,foto_de:null,cantidad:1,color:'Blanco',especificaciones:{color:'Blanco'},espera:null,monto:5});
 await t.reload();await t.waitForSelector('.hoy');await t.waitForTimeout(500);
 ok('Arriba: "2 son de semanas pasadas" (no "se pasó de su sábado")',(await t.textContent('.hoy-lead')).includes('2 son de semanas pasadas') && !(await t.textContent('#vistaTrabajo')).includes('se pasó'));
 ok('"¿Con cuál empiezas?" muestra 4 y "Ver todos (7)"',(await t.$$('.el-op')).length===4 && (await t.textContent('.el-pie [data-ver="trabajos"]'))==='Ver todos (7)');
 ok('En la lista dice "De la semana pasada" en rojo',(await t.textContent('.el-op[data-elegir="600"] .el-s.tarde')).includes('De la semana pasada'),await t.textContent('.el-op[data-elegir="600"]'));
 await F(t,'t4-muchos');
 await t.click('.el-pie [data-ver="trabajos"]');await t.waitForSelector('#sheetTrabajos.open');
 const lt7=await t.textContent('#listaTrabajos');
 ok('"Ver todos" abre la lista con los 7, con "De hace 2 semanas"',(await t.$$('#listaTrabajos .tr')).length===7 && lt7.includes('De la semana pasada') && lt7.includes('De hace 2 semanas') && (await t.$$('#listaTrabajos .tr.gris')).length===1);
 await t.click('#listaTrabajos [data-detalle="603"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('Desde la lista se abre el detalle con "Empezar este trabajo"',!!(await t.$('#trabajoFoot [data-empezar="603"]')));
 await F(t,'t3b-trabajos');
 await t.click('#trabajoFoot [data-empezar="603"]');await t.waitForTimeout(800);
 ok('Empezar desde el detalle cierra las hojas y queda "Estás haciendo"',!(await t.isVisible('#sheetTrabajos')) && (await t.textContent('.hoy-nom'))==='Detalles · Puerta 4');
 trabajos=trabajos.filter(x=>x.id<600||x.id===601);
 await t.reload();await t.waitForSelector('.hoy');await t.waitForTimeout(400);
 ok('Con uno solo atrasado dice de cuándo es: "1 es de hace 2 semanas"',(await t.textContent('.hoy-lead')).includes('1 es de hace 2 semanas'),await t.textContent('.hoy-lead'));
 trabajos=trabajos.filter(x=>x.id<600);
 await t.reload();await t.waitForSelector('.hoy');await t.waitForTimeout(400);

 // Mis pagos: por cobrar con las dos fotos
 await t.click('#vistaTrabajo [data-ver="pagos"]');await t.waitForSelector('#sheetPagos.open');await t.waitForTimeout(300);
 const pg=await t.textContent('#pagosBody');
 ok('Arriba: "Cobras el sáb X" y lo que cobra, sin cuadro de factura',(await t.textContent('.pg-cobra span')).startsWith('Cobras el sáb') && (await t.textContent('.pg-cobra b'))==='$85' && !(await t.$('.pg-cuenta')));
 ok('Por semana, con cuántos trabajos',pg.includes('Esta semana · 3 trabajos') && pg.includes('Semana pasada · 1 trabajo'));
 ok('Cada trabajo con las dos fotos (catálogo y la suya)',(await t.$$('#pagosBody [data-hecho="400"] .duo img')).length===2);
 ok('Vales en rojo que restan',(await t.textContent('#pagosBody .pg-mov.vale .pg-mov-m.rojo'))==='−$10');
 ok('Lo del domingo sale "Para la próxima semana" y no suma',pg.includes('Para la próxima semana') && pg.includes('Reja Domingo'));
 ok('Sin monto dice "Por definir" y avisa',pg.includes('Por definir') && pg.includes('1 trabajo todavía no tiene monto'));
 await F(t,'t5-pagos');
 await t.click('#pagosBody [data-hecho="400"]');await t.waitForSelector('#sheetHecho.open');await t.waitForTimeout(300);
 const hb=await t.textContent('#hechoBody');
 ok('Detalle de lo hecho: foto del catálogo y la suya, lado a lado',(await t.$$('#hechoBody .cmp .hero img')).length===2 && (await t.$$eval('#hechoBody .cmp-lb',x=>x.map(y=>y.textContent))).join('|')==='Catálogo|Tu foto');
 ok('Dice qué hizo, cuándo lo terminó, cuánto suma, especificaciones y la nota',(await t.textContent('#hechoTitulo'))==='Hierro · Puerta Colonial' && hb.includes('N° 38 · Terminado') && hb.includes('Te suma $30') && hb.includes('Medidas') && hb.includes('Cerradura de dos vueltas'));
 await F(t,'t5b-hecho');
 await t.click('#hechoBody .cmp .hero img >> nth=1');await t.waitForTimeout(400);
 ok('Tocar una foto la abre grande',await t.isVisible('.visor.open'));
 await t.click('.visor-x');await t.waitForTimeout(300);
 await t.click('#sheetHecho [data-cerrar="sheetHecho"]');await t.waitForTimeout(400);
 await t.click('#pagosBody [data-hecho="401"]');await t.waitForSelector('#sheetHecho.open');await t.waitForTimeout(200);
 ok('Si no tiene su foto dice "Sin foto" y "Monto por definir"',(await t.textContent('#hechoBody .cmp')).includes('Sin foto') && (await t.textContent('#hechoBody')).includes('Monto por definir'));
 await t.click('#sheetHecho [data-cerrar="sheetHecho"]');await t.waitForTimeout(400);

 // Historial: todas cerradas
 await t.click('[data-pg-tab="historial"]');await t.waitForTimeout(200);
 ok('Historial: una fila por semana pagada, todas cerradas',(await t.$$('.pg-sem')).length===2 && (await t.$$('.pg-sem[open]')).length===0 && (await t.$$('.pg-sem .pg-est.pagado')).length===2);
 ok('La semana va de lunes a sábado',/\d+ al \d+ \w+/.test(await t.textContent('.pg-sem .pg-sem-s')));
 await F(t,'t6-historial');
 await t.click('.pg-sem >> nth=0 >> summary');await t.waitForTimeout(250);
 const rec=await t.textContent('.pg-sem[open]');
 ok('Al abrirla: lo que hizo con sus dos fotos, el vale en rojo (dado en Bs) y cuánto le pagaron',rec.includes('Puerta Real') && rec.includes('N° 30') && (await t.$$('.pg-sem[open] .duo img')).length===2 && rec.includes('dado en Bs 400') && (await t.textContent('.pg-sem[open] .pg-mov.vale .pg-mov-m'))==='−$10' && (await t.textContent('.pg-sem[open] .pg-cobra'))==='Te pagaron · Ray$40');
 await F(t,'t6b-historial-abierto');
 await t.click('.pg-sem[open] [data-hecho="380"]');await t.waitForSelector('#sheetHecho.open');await t.waitForTimeout(200);
 ok('Del historial también se abre el mismo detalle',(await t.textContent('#hechoTitulo'))==='Hierro · Puerta Real' && (await t.$$('#hechoBody .cmp .hero img')).length===2);
 await t.click('#sheetHecho [data-cerrar="sheetHecho"]');await t.waitForTimeout(400);
 await t.click('[data-pg-tab="cobrar"]');await t.waitForTimeout(100);await t.click('[data-pg-tab="historial"]');await t.waitForTimeout(200);
 ok('Al volver a entrar, todas cerradas otra vez',(await t.$$('.pg-sem[open]')).length===0);

 // Vale
 await t.click('[data-pg-tab="cobrar"]');await t.waitForTimeout(200);
 await t.click('#btnAbrirVale');await t.waitForSelector('#sheetVale.open');await F(t,'t8-vale');
 await t.click('#btnPedirVale');await t.waitForTimeout(200);
 ok('Sin monto muestra el error debajo del campo',await t.isVisible('#campoValeMonto .field-error'));
 await t.fill('#valeMonto','15');await t.fill('#valeNota','medicinas');
 await t.click('#btnPedirVale');await t.waitForTimeout(700);
 const va=llamadas.find(x=>x[0]==='vale');
 ok('Se pidió el vale con monto y nota',va&&va[1].p_monto===15&&va[1].p_nota==='medicinas',va&&va[1]);
 ok('El vale sale "Por aprobar" sin restar y no deja pedir otro',(await t.textContent('#pagosBody')).includes('Por aprobar') && (await t.textContent('.pg-cobra b'))==='$85' && !(await t.$('#btnAbrirVale')));
 await t.click('#sheetPagos [data-cerrar="sheetPagos"]');await t.waitForTimeout(400);
 ok('En Inicio: la fila de pagos dice que hay un vale esperando',(await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('vale esperando'));

 // Aviso tocado
 await t.goto('http://127.0.0.1:8765/index.html?ver=pagos');await t.waitForSelector('#sheetPagos.open',{timeout:8000});
 ok('?ver=pagos abre "Mis pagos"',true);
 await t.goto('http://127.0.0.1:8765/ventas.html',{waitUntil:'commit'}).catch(()=>{});await t.waitForURL('**/index.html',{timeout:8000}).catch(()=>{});await t.waitForTimeout(1500);
 ok('Trabajador que escribe ventas.html vuelve a su Inicio',t.url().includes('index.html'));

 // Reglas nuevas: un trabajo incluye varias piezas (combo: puerta, su protección y las 2 protecciones)
 const incC='Puerta con protección + 2 protecciones de ventana';
 const t503=trabajos.find(x=>x.id===503);
 trabajos=[
   {id:701,nombre:'Hierro',especialidad:'herrero',rama:'principal',oficio:'hierro',incluye:incC,unidades:1,para_el:SAB.este,venta_id:60,interna:false,fecha_entrega:dia(8),notas:null,producto:'Combo Imperial',tipo:'Combo',foto:GIF,foto_de:'Negro',cantidad:1,color:'Negro',especificaciones:{color:'Negro',alto:2.1,ancho:1,ventanas_alto:1.2,ventanas_ancho:1,variante:'Con protección en puerta',aluminio:'Ecobel'},espera:null,monto:40,iniciada_en:new Date().toISOString()},
   {id:702,nombre:'Instalar en las protecciones',especialidad:'ventanero',rama:'ventana',oficio:'instalar',incluye:'2 ventanas en sus protecciones',unidades:1,para_el:SAB.este,venta_id:60,interna:false,fecha_entrega:dia(8),notas:null,producto:'Combo Imperial',tipo:'Combo',foto:GIF,foto_de:'Negro',cantidad:1,color:'Negro',especificaciones:{color:'Negro',alto:2.1,ancho:1,ventanas_alto:1.2,ventanas_ancho:1,variante:'Con protección en puerta',aluminio:'Ecobel'},espera:'Pintura',monto:0}
 ];
 await t.goto('http://127.0.0.1:8765/index.html');await t.waitForSelector('.hoy');await t.waitForTimeout(400);
 const pz=await t.$$eval('.hoy .pz > span:not(.pz-n)',x=>x.map(y=>y.textContent));
 ok('Hierro de un combo: una sola tarjeta con la puerta, su protección y las 2 protecciones',(await t.textContent('.hoy-nom'))==='Hierro · Combo Imperial' && pz.join('|')==='Puerta 2.1 × 1 m|Protección de puerta 2.1 × 1 m|Protecciones de ventana 1.2 × 1 m' && (await t.$$eval('.hoy .pz-n',x=>x.map(y=>y.textContent))).join()==='1,1,2',pz);
 ok('Instalar espera la pintura de las protecciones (en gris)',(await t.textContent('.dp.gris')).includes('Espera la pintura de las protecciones'));
 await F(t,'t7-combo-piezas');
 await t.click('.hoy-foto');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 ok('El detalle también dice lo que incluye y el aluminio',(await t.$$('#trabajoBody .pz > span:not(.pz-n)')).length===3 && (await t.textContent('#trabajoBody')).includes('AluminioEcobel'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 await t.click('.dp[data-detalle="702"]');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 ok('Instalar: "Este paso no se paga" y dice que espera la pintura de las protecciones',(await t.textContent('#trabajoBody')).includes('Este paso no se paga') && (await t.textContent('#trabajoFoot')).includes('Espera la pintura de las protecciones'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);

 // Todos esperan a otro
 trabajos=[t503];
 await t.goto('http://127.0.0.1:8765/index.html');await t.waitForSelector('.hoy');await t.waitForTimeout(300);
 ok('Si todos esperan a otro: lo dice y se ven en "Después"',(await t.textContent('.hoy')).includes('Tus trabajos esperan a otro') && (await t.$$('.despues .dp')).length===1);
 // Sin trabajos
 trabajos=[];
 await t.goto('http://127.0.0.1:8765/index.html');await t.waitForSelector('.hoy');
 ok('Sin trabajos: mensaje claro y sin fila "Después"',(await t.textContent('.hoy')).includes('No tienes trabajos asignados') && !(await t.$('.despues')));

 // ---------- Administrador ----------
 const a=await entrar(b,'u2','admin','Ray');a.on('pageerror',e=>err.push('admin:'+e.message));
 await a.waitForSelector('.pend-fila');await a.waitForTimeout(500);
 const av=await a.textContent('#avisosAdmin');
 ok('Admin ve "1 vale por aprobar" y lleva a la Nómina de Jesús',av.includes('1 vale por aprobar') && av.includes('Jesús') && !!(await a.$('a.pend-fila.verde[href="nomina.html?t=u5"]')));
 ok('Admin ve "1 trabajo sin asignar"',av.includes('1 trabajo sin asignar'));
 ok('Admin ve "1 trabajo pasó su sábado" en amarillo y lleva a Atrasados',(await a.textContent('.pend-fila.amarillo')).includes('1 trabajo pasó su sábado') && !!(await a.$('a.pend-fila.amarillo[href="produccion.html?filtro=atrasados"]')));
 ok('Admin ve el modelo vendido en un color sin foto, y lleva a editarlo',av.includes('1 modelo sin foto en un color') && av.includes('Combo Lineal en negro') && !!(await a.$('a.pend-fila[href="catalogo.html?editar=12"]')));
 ok('Admin ve "En fabricación: 1 producto sin categoría"',av.includes('En fabricación: 1 producto sin categoría'));
 ok('Admin ve "1 combo sin medidas de las ventanas" y lleva a editarlo',av.includes('1 combo sin medidas de las ventanas') && av.includes('Combo Viejo') && !!(await a.$('a.pend-fila[href="catalogo.html?editar=21"]')));
 ok('Admin ve "En catálogo: 3 modelos sin categoría"',av.includes('En catálogo: 3 modelos sin categoría'));
 ok('Los avisos llevan al lugar correcto',!!(await a.$('a.pend-fila[href="produccion.html?filtro=asignar"]')) && !!(await a.$('a.pend-fila[href="produccion.html?filtro=sincat"]')) && !!(await a.$('a.pend-fila[href="categorias-pago.html?asignar=1"]')));
 ok('Los pendientes van en una sola caja con su contador',(await a.$$('#avisosAdmin .pend')).length===1 && (await a.$$('.pend-fila')).length===7 && (await a.textContent('.pend-n'))==='7');
 ok('Ya no hay hoja de vales en el Inicio',!(await a.$('#sheetVales')) && !(await a.$('[data-abrir-vales]')));
 ok('El aviso de notificaciones va aparte',!!(await a.$('#avisosAdmin > .notif-fila')));
 ok('Admin sigue viendo sus módulos',await a.isVisible('#modulos') && await a.isVisible('#btnNuevaVenta'));
 ok('La cajita Producción dice cuántos hay sin asignar',(await a.textContent('#cuenta-produccion'))==='1 sin asignar',await a.textContent('#cuenta-produccion'));
 await F(a,'t6-admin');
 // Minimizar pendientes
 await a.click('[data-pend-toggle]');await a.waitForTimeout(300);
 ok('Al tocar "Pendientes" se esconden y queda el número con puntos de color',!(await a.isVisible('.pend-lista')) && (await a.textContent('.pend-n'))==='7' && (await a.$$('.pend.cerrado .pend-puntos i')).length===7 && (await a.textContent('.pend-accion'))==='Ver');
 await F(a,'t6b-admin-cerrado');
 await a.reload();await a.waitForSelector('.pend');await a.waitForTimeout(500);
 ok('El teléfono recuerda que los dejaste cerrados',!(await a.isVisible('.pend-lista')));
 await a.click('[data-pend-toggle]');await a.waitForTimeout(300);
 ok('Otro toque los vuelve a mostrar',await a.isVisible('.pend-lista') && (await a.textContent('.pend-accion'))==='Ocultar');
 // Un aviso viejo de vale (index.html?ver=vales) lleva a Nómina
 await a.goto('http://127.0.0.1:8765/index.html?ver=vales');await a.waitForURL('**/nomina.html',{timeout:8000}).catch(()=>{});
 ok('Un aviso viejo de vale abre Nómina',a.url().includes('nomina.html'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
