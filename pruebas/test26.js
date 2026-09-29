// Inicio del trabajador: "Ahora" con un solo botón para terminar, fila "Después" que se desliza,
// detalle con todas las especificaciones, fecha tope, una fila de pagos y vales. Y los pendientes
// del administrador (vales que llevan a Nómina, trabajos sin asignar o atrasados, fotos que faltan).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const hace=(n)=>{const d=new Date();d.setDate(d.getDate()-n);d.setHours(12);return d.toISOString();};
// Semana de lunes a sábado: el domingo cuenta para la semana siguiente (igual que el servidor)
const semanaDe=(iso)=>{const d=new Date(iso);d.setHours(12);d.setDate(d.getDate()+1);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const iso=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const SAB=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));const este=iso(d);d.setDate(d.getDate()-7);return {este,pasado:iso(d)};})();
let trabajos=[
  {id:501,nombre:'Hierro',especialidad:'herrero',rama:'principal',unidades:1,para_el:SAB.este,venta_id:40,interna:false,fecha_entrega:dia(3),notas:null,producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,foto_de:'Blanco',cantidad:1,color:'Blanco',especificaciones:{color:'Blanco',alto:2,ancho:1,manillon:true,manillon_tipo:'H',sentido:'Derecha',posicion:'Afuera',bloque:'15',vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'},espera:null,monto:25},
  {id:502,nombre:'Ensamblar 2 ventanas',especialidad:'ventanero',rama:'ventana',unidades:2,para_el:SAB.este,venta_id:41,interna:false,fecha_entrega:dia(6),notas:'El cliente quiere las ventanas con seguro por dentro',producto:'Combo Imperial',tipo:'Combo',foto:GIF,foto_de:'Blanco',cantidad:2,color:'Negro',especificaciones:{color:'Negro',alto:2,ancho:1,ventanas_alto:1.2,ventanas_ancho:1,ventanas_color:'Negro',variante:'Sin protección en puerta'},espera:null,monto:null},
  {id:503,nombre:'Detalles',especialidad:'acabados',rama:'principal',unidades:1,para_el:SAB.este,venta_id:40,interna:false,fecha_entrega:dia(3),notas:null,producto:'Puerta Lineal',tipo:'Puerta Multilock',foto:GIF,foto_de:'Blanco',cantidad:1,color:'Blanco',especificaciones:{color:'Blanco'},espera:'Masilla y pintura',monto:5}
];
let pagos={
  trabajos:[
    {id:400,etapa:'Hierro',producto:'Puerta Colonial',tipo:'Puerta Multilock',venta_id:38,interna:false,fecha:hace(0),semana:semanaDe(hace(0)),monto:30},
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
     trabajos:[{id:380,etapa:'Hierro',producto:'Puerta Real',venta_id:30,interna:false,fecha:hace(10),monto:50}],vales:[{id:3,monto:10,nota:'comida',fecha:hace(11),monto_bs:400,tasa:40}]},
    {id:1,pagado_en:hace(9),semana:semanaDe(hace(16)),monto:25,trabajos_monto:25,vales_monto:0,pagado_por:'Ray',
     trabajos:[{id:370,etapa:'Detalles',producto:'Ventana Real',venta_id:28,interna:false,fecha:hace(16),monto:25}],vales:[]}
]
};
let vales=[{id:9,monto:20,nota:'pasaje',creado_en:new Date().toISOString(),trabajador_id:'u5',trabajador:{nombre:'Jesús'}}];
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
  if(u.includes('/catalogo'))return m==='HEAD'?head(u.includes('categoria_pago_id=is.null')?3:37):j([]);
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
 ok('Arriba dice cuántos trabajos tiene y para qué sábado',(await t.textContent('.hoy-lead')).startsWith('3 trabajos para el sáb'));
 ok('Tarjeta "Ahora": el que le toca, con foto, nombre y especificaciones',(await t.textContent('.hoy-etapa'))==='Ahora: Hierro' && (await t.textContent('.hoy-nom'))==='Puerta Lineal' && !!(await t.$('.hoy-foto img')) && (await t.textContent('.hoy .spec-chips')).includes('2 × 1 m') && (await t.textContent('.hoy .spec-chip'))==='Color blanco');
 ok('Un solo botón: "Ya lo terminé · tomar foto" (sin Empezar ni Dejar para después)',(await t.textContent('.hoy [data-terminar-t="501"]'))==='Ya lo terminé · tomar foto' && !(await t.$('[data-empezar]')) && !(await t.$('[data-pausar]')));
 ok('Fila "Después" con los demás; el que espera a otro en gris',(await t.$$('.despues .dp')).length===2 && (await t.textContent('.dp.gris')).includes('Espera masilla y pintura') && (await t.textContent('.dp[data-detalle="502"]')).includes('Para el sáb'));
 ok('Una sola fila de pagos: "Pagos y vales · cobras $60 el sábado"',(await t.$$('#vistaTrabajo .pend-fila')).length===1 && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('Pagos y vales · cobras $60 el sábado'));
 ok('Ve la fila de avisos del teléfono como en el Inicio',!!(await t.$('#avisosAdmin .notif-fila')));
 await t.screenshot({path:'shots5/t1-inicio.png',fullPage:true});

 // Foto → detalle con TODAS las especificaciones en tabla y la franja del color
 await t.click('.hoy-foto');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 const det=await t.textContent('#trabajoBody');
 ok('Detalle: foto grande, su parte, fecha tope, pedido y lo que gana',!!(await t.$('#trabajoBody .hero img')) && det.includes('Tu parte: Hierro') && det.includes('Para el sáb') && det.includes('N° 40') && det.includes('Ganas $25'));
 ok('Franja del color: "Va en color BLANCO"',(await t.textContent('.tj-color'))==='Va en color BLANCO');
 const tabla=await t.$$eval('.tj-specs > div',x=>x.map(d=>d.textContent));
 ok('Tabla con todas las especificaciones',['Medidas2 × 1 m','VidrioNegro','ManillónH','Abre a laDerecha','AperturaAfuera','Bloque15'].every(v=>tabla.includes(v)),tabla);
 ok('Abajo, el mismo botón para terminar',(await t.textContent('#trabajoFoot [data-terminar-t="501"]'))==='Ya lo terminé · tomar foto');
 await t.screenshot({path:'shots5/t2-detalle.png'});
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 // El Combo: foto en otro color, las ventanas en su color, las medidas de las ventanas y la nota
 await t.click('.dp[data-detalle="502"]');await t.waitForSelector('#sheetTrabajo.open');await t.waitForTimeout(300);
 const dc=await t.textContent('#trabajoBody');
 ok('Si la foto es de otro color, lo dice sobre la foto',(await t.textContent('#trabajoBody .hoy-badge'))==='Foto en blanco · las ventanas van en NEGRO');
 ok('Las ventanas van en su color',(await t.textContent('.tj-color'))==='Las ventanas van en color NEGRO');
 ok('Dice que es 1 puerta + 2 ventanas + 2 protecciones, con medidas de las ventanas',dc.includes('1 puerta + 2 ventanas + 2 protecciones') && dc.includes('2 ventanas y 2 protecciones1.2 × 1 m c/u') && dc.includes('2 unidades'));
 ok('La nota de la venta',(await t.textContent('.tj-nota')).includes('seguro por dentro'));
 await t.screenshot({path:'shots5/t2b-detalle-combo.png',fullPage:true});
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);
 await t.click('.dp[data-detalle="503"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('El que espera a otro: se ve todo pero sin botón, dice qué espera',!(await t.$('#trabajoFoot [data-terminar-t]')) && (await t.textContent('#trabajoFoot')).includes('Espera que terminen Masilla y pintura'));
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(400);

 // Terminar desde "Ahora"
 await t.click('.hoy [data-terminar-t="501"]');await t.waitForSelector('#sheetTerminarT.open');
 ok('La hoja de terminar dice cuál es',(await t.textContent('#terminarTSub')).includes('Hierro · Puerta Lineal · N° 40'));
 await t.screenshot({path:'shots5/t3-terminar.png'});
 await t.click('#btnTConfirmar');await t.waitForTimeout(700);
 ok('Se llamó a marcar terminado',llamadas.some(x=>x[0]==='terminar'&&x[1].eid===501));
 ok('Le dice cuánto sumó',(await t.textContent('#toast')).includes('Sumaste $25'));
 ok('Inicio se actualiza: ahora el Combo y $85 por cobrar',(await t.textContent('.hoy-etapa'))==='Ahora: Ensamblar 2 ventanas' && (await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('$85') && (await t.textContent('.hoy .hoy-badge'))==='Foto en blanco · las ventanas van en NEGRO');

 // Con muchos trabajos: la fila muestra 4 y "Ver todos"; uno atrasado se dice arriba
 for(let i=0;i<5;i++) trabajos.push({id:600+i,nombre:'Detalles',especialidad:'acabados',rama:'principal',unidades:1,para_el:i===0?SAB.pasado:SAB.este,venta_id:50+i,interna:false,fecha_entrega:dia(9),notas:null,producto:'Puerta '+(i+1),tipo:'Puerta Multilock',foto:null,foto_de:null,cantidad:1,color:'Blanco',especificaciones:{color:'Blanco'},espera:null,monto:5});
 await t.reload();await t.waitForSelector('.hoy');await t.waitForTimeout(500);
 ok('Arriba avisa del que se pasó de su sábado',(await t.textContent('.hoy-lead')).includes('1 se pasó de su sábado'));
 ok('La fila "Después" muestra 4 y "Ver todos (7)"',(await t.$$('.despues .dp:not(.dp-mas)')).length===4 && (await t.textContent('.dp-mas')).includes('(7)'));
 await t.screenshot({path:'shots5/t4-muchos.png',fullPage:true});
 await t.click('.dp-mas');await t.waitForSelector('#sheetTrabajos.open');
 ok('"Ver todos" abre la lista con los 7',(await t.$$('#listaTrabajos .tr')).length===7 && (await t.textContent('#listaTrabajos')).includes('Se pasó del sáb') && (await t.$$('#listaTrabajos .tr.gris')).length===1);
 await t.click('#listaTrabajos [data-detalle="603"]');await t.waitForSelector('#sheetTrabajo.open');
 ok('Desde la lista se abre el detalle con su botón',!!(await t.$('#trabajoFoot [data-terminar-t="603"]')));
 await t.screenshot({path:'shots5/t3b-trabajos.png'});
 await t.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await t.waitForTimeout(300);
 await t.click('#sheetTrabajos [data-cerrar="sheetTrabajos"]');await t.waitForTimeout(400);
 trabajos=trabajos.filter(x=>x.id<600);
 await t.reload();await t.waitForSelector('.hoy');await t.waitForTimeout(400);

 // Mis pagos: por cobrar
 await t.click('#vistaTrabajo [data-ver="pagos"]');await t.waitForSelector('#sheetPagos.open');
 const pg=await t.textContent('#pagosBody');
 ok('Por cobrar: esta semana y semana pasada',pg.includes('Esta semana') && pg.includes('Semana pasada'));
 ok('Vales en rojo que restan',(await t.textContent('#pagosBody .pg-mov.vale .pg-mov-m.rojo'))==='−$10');
 ok('Suma abajo: trabajos, vales y "Te toca cobrar"',(await t.textContent('.pg-cuenta')).includes('Trabajos$95') && (await t.textContent('.pg-cuenta')).includes('−$10') && (await t.textContent('.pg-cuenta-total b'))==='$85');
 ok('Lo del domingo sale "Para la próxima semana" y no suma',pg.includes('Para la próxima semana') && pg.includes('Reja Domingo'));
 ok('Sin monto dice "Por definir" y avisa',pg.includes('Por definir') && pg.includes('1 trabajo todavía no tiene monto'));
 await t.screenshot({path:'shots5/t5-pagos.png',fullPage:true});

 // Historial
 await t.click('[data-pg-tab="historial"]');await t.waitForTimeout(200);
 const hi=await t.textContent('#pagosBody');
 ok('Historial: un recibo por cada pago de Ray',(await t.$$('.pg-sem')).length===2 && (await t.$$('.pg-sem .pg-est.pagado')).length===2);
 const rec=await t.textContent('.pg-sem[open]');
 ok('El último recibo abierto: qué hizo, el vale en rojo (dado en Bs), cuánto le pagaron y quién',rec.includes('Puerta Real') && rec.includes('N° 30') && rec.includes('dado en Bs 400') && (await t.textContent('.pg-sem[open] .pg-mov.vale .pg-mov-m'))==='−$10' && (await t.textContent('.pg-sem[open] .pg-cuenta-total b'))==='$40' && rec.includes('Pagado por Ray'));
 ok('La semana del recibo va de lunes a sábado',/\d+ al \d+ \w+/.test(await t.textContent('.pg-sem[open] .pg-sem-s')));
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
 ok('En Inicio: la fila de pagos dice que hay un vale esperando',(await t.textContent('#vistaTrabajo .pend-fila.verde')).includes('vale esperando'));

 // Aviso tocado
 await t.goto('http://127.0.0.1:8765/index.html?ver=pagos');await t.waitForSelector('#sheetPagos.open',{timeout:8000});
 ok('?ver=pagos abre "Mis pagos"',true);
 await t.goto('http://127.0.0.1:8765/ventas.html',{waitUntil:'commit'}).catch(()=>{});await t.waitForURL('**/index.html',{timeout:8000}).catch(()=>{});await t.waitForTimeout(1500);
 ok('Trabajador que escribe ventas.html vuelve a su Inicio',t.url().includes('index.html'));

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
 ok('Admin ve "En producción: 1 producto sin categoría"',av.includes('En producción: 1 producto sin categoría'));
 ok('Admin ve "En catálogo: 3 modelos sin categoría"',av.includes('En catálogo: 3 modelos sin categoría'));
 ok('Los avisos llevan al lugar correcto',!!(await a.$('a.pend-fila[href="produccion.html?filtro=asignar"]')) && !!(await a.$('a.pend-fila[href="produccion.html?filtro=sincat"]')) && !!(await a.$('a.pend-fila[href="categorias-pago.html"]')));
 ok('Los pendientes van en una sola caja con su contador',(await a.$$('#avisosAdmin .pend')).length===1 && (await a.$$('.pend-fila')).length===6 && (await a.textContent('.pend-n'))==='6');
 ok('Ya no hay hoja de vales en el Inicio',!(await a.$('#sheetVales')) && !(await a.$('[data-abrir-vales]')));
 ok('El aviso de notificaciones va aparte',!!(await a.$('#avisosAdmin > .notif-fila')));
 ok('Admin sigue viendo sus módulos',await a.isVisible('#modulos') && await a.isVisible('#btnNuevaVenta'));
 ok('La cajita Producción dice cuántos hay sin asignar',(await a.textContent('#cuenta-produccion'))==='1 sin asignar',await a.textContent('#cuenta-produccion'));
 await a.screenshot({path:'shots5/t6-admin.png',fullPage:true});
 // Minimizar pendientes
 await a.click('[data-pend-toggle]');await a.waitForTimeout(300);
 ok('Al tocar "Pendientes" se esconden y queda el número con puntos de color',!(await a.isVisible('.pend-lista')) && (await a.textContent('.pend-n'))==='6' && (await a.$$('.pend.cerrado .pend-puntos i')).length===6 && (await a.textContent('.pend-accion'))==='Ver');
 await a.screenshot({path:'shots5/t6b-admin-cerrado.png'});
 await a.reload();await a.waitForSelector('.pend');await a.waitForTimeout(500);
 ok('El teléfono recuerda que los dejaste cerrados',!(await a.isVisible('.pend-lista')));
 await a.click('[data-pend-toggle]');await a.waitForTimeout(300);
 ok('Otro toque los vuelve a mostrar',await a.isVisible('.pend-lista') && (await a.textContent('.pend-accion'))==='Ocultar');
 // Un aviso viejo de vale (index.html?ver=vales) lleva a Nómina
 await a.goto('http://127.0.0.1:8765/index.html?ver=vales');await a.waitForURL('**/nomina.html',{timeout:8000}).catch(()=>{});
 ok('Un aviso viejo de vale abre Nómina',a.url().includes('nomina.html'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
