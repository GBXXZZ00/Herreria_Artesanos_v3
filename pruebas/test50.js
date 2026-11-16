// Taller con los números de las maquetas: hoy jueves 19 nov 2026, semana del 16 al 21.
// Lote 1 (T2, T3): Todos 6 · Por asignar 3 · En proceso 3 · Listos 1, tarjeta por pedido con sus pasos de
// colores, drawer del pedido con foto y monto, hoja de Asignar con lo que se paga, marca ↩, Listos con
// Marcar entregada, menú nuevo, Ventas · Cotizaciones y produccion.html que redirige.
// Lote 2 (T1, T4): Resumen (13 pasos en 3 pedidos, 6 de 9 hechos, $210 por pagar, vales), semanas ‹ ›,
// lo de la semana de un trabajador y el trabajo con su foto desde el aviso (taller.html?trabajo=ID).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const HOY = new Date(2026, 10, 19, 10, 30);   // jue 19 nov 2026, 10:30 am
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(HOY.getTime()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const hora=(h,m)=>new Date(2026,10,19,h,m).toISOString();
const dia=(d)=>new Date(2026,10,d,15,0).toISOString();

const trabajadores=[
  {id:'tj',nombre:'Jesus',especialidades:['herrero']},
  {id:'tl',nombre:'Luis Paz',especialidades:['masilla_pintura','acabados']},
  {id:'tp',nombre:'Pedro',especialidades:['acabados','ventanero']},
  {id:'tc',nombre:'Carpintero',especialidades:['carpintero']},
  {id:'to',nombre:'José',especialidades:['herrero']}
];
// Lo asignado para el sáb 21 (y lo de la semana pasada sin terminar): Jesus 4 (3 hechos), Luis Paz 4 (2 hechos, 1 ↩), Pedro 1 (1 hecho)
const it=(nombre,venta_id,interna)=>({id:900+venta_id%100,nombre,venta_id,venta:{id:venta_id,interna:!!interna,estado:'en_produccion'}});
let sid=8000;
const S_=(tid,estado,extra)=>Object.assign({id:++sid,nombre:'Hierro',estado,trabajador_id:tid,trabajador:{nombre:(trabajadores.find(t=>t.id===tid)||{}).nombre},para_el:'2026-11-21',iniciada_en:null,foto:estado==='hecha'?GIF:null,terminada_en:estado==='hecha'?dia(18):null,monto:estado==='hecha'?30:null,pago_id:null,item:it('Modelo bitral',1200)},extra||{});
const SEM=[S_('tj','hecha'),S_('tj','hecha'),S_('tj','hecha'),S_('tj','pendiente',{iniciada_en:hora(10,15)}),
  S_('tl','hecha',{nombre:'Masilla y pintura'}),S_('tl','hecha',{nombre:'Masilla y pintura'}),S_('tl','pendiente',{nombre:'Masilla y pintura'}),
  S_('tl','pendiente',{nombre:'Detalles',para_el:'2026-11-14',item:it('Lineal',1210,true)}),
  S_('tp','hecha',{nombre:'Detalles'})];
const SEM_PASADA=[S_('tj','hecha',{para_el:'2026-11-14'}),S_('tl','hecha',{para_el:'2026-11-14',nombre:'Masilla y pintura'})];
const NOMINA={semana:'2026-11-21',puede_pagar:true,trabajadores:[
  {id:'tj',nombre:'Jesus',trabajos:4,trabajos_monto:125,vales_monto:10,neto:115},
  {id:'tl',nombre:'Luis Paz',trabajos:2,trabajos_monto:95,vales_monto:0,neto:95},
  {id:'tp',nombre:'Pedro',trabajos:0,trabajos_monto:0,vales_monto:0,neto:0}]};
const VALES=[{id:1,trabajador_id:'tl',monto:20,nota:'Pasaje de la semana',estado:'pendiente',creado_en:hora(8,10)},{id:2,trabajador_id:'tj',monto:10,nota:null,estado:'aprobado',creado_en:dia(17)}];
const PAGOS=[{trabajador_id:'tp',monto:15,pagado_en:dia(18)}];
const VIEJOS=[{id:7001,trabajador_id:'tj'}];
// Un trabajo de un pedido que ya se entregó: se abre buscándolo en la base
const VIEJO={id:9001,nombre:'Detalles',rama:'principal',orden:3,unidad:1,estado:'hecha',trabajador_id:'tp',foto:GIF,terminada_en:dia(14),monto:15,pago_id:4,trabajador:{nombre:'Pedro'},
  item:{id:150,nombre:'Lineal',cantidad:1,venta_id:1150,venta:{id:1150,interna:false},etapas:[{id:9000,nombre:'Hierro',rama:'principal',orden:1,unidad:1,estado:'hecha',trabajador:{nombre:'Jesus'}},{id:9001,nombre:'Detalles',rama:'principal',orden:3,unidad:1,estado:'hecha',trabajador:{nombre:'Pedro'}}]}};
const nom=id=>({nombre:(trabajadores.find(t=>t.id===id)||{}).nombre||''});
let eid=5000;
const P=(nombre,esp,extra)=>Object.assign({id:++eid,unidad:1,rama:'principal',nombre,orden:0,especialidad:esp,oficio:null,estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null,iniciada_en:null,para_el:null,monto:null,pago_id:null},extra||{});
const hecho=(tid,cuando,monto,foto)=>({estado:'hecha',trabajador_id:tid,trabajador:nom(tid),terminada_en:cuando,monto,foto:foto===false?null:GIF});
const asig=(tid,para,extra)=>Object.assign({trabajador_id:tid,trabajador:nom(tid),para_el:para},extra||{});
const pasos=(unidad,l)=>l.map((e,i)=>Object.assign(e,{orden:i+1,unidad}));
const bitral=(u,a,b,c)=>pasos(u,[P('Hierro','herrero',a),P('Masilla y pintura','masilla_pintura',b),P('Detalles','acabados',c)]);
const pagado=(total)=>({total,abonos:[{monto:total,tipo:'abono',estado:'confirmado'}]});

let ventas=[
  Object.assign({id:1200,estado:'en_produccion',fecha_entrega:'2026-11-21',interna:false,token_seguimiento:'tok1200',cliente:{nombre:'Ana Rincón',telefono:'584141112233'},
    items:[{id:120,nombre:'Modelo bitral',tipo:'Puerta Multilock',cantidad:2,categoria_pago_id:1,catalogo:{id:7,fotos:{}},especificaciones:{},etapas:[
      ...bitral(1,hecho('tj',hora(9,40),30),asig('tl','2026-11-21'),{}),
      ...bitral(2,asig('tj','2026-11-21',{iniciada_en:hora(10,15)}),{},{})]}]},pagado(900)),
  Object.assign({id:1203,estado:'en_produccion',fecha_entrega:'2026-11-28',interna:false,cliente:{nombre:'Ana Rincón',telefono:'584141112233'},
    items:[{id:123,nombre:'Bitral',tipo:'Puerta Multilock',cantidad:2,categoria_pago_id:1,especificaciones:{},etapas:[...bitral(1,{},{},{}),...bitral(2,{},{},{})]}]},pagado(900)),
  Object.assign({id:1205,estado:'en_produccion',fecha_entrega:'2026-12-04',interna:false,cliente:{nombre:'Carlos Pérez',telefono:'584241112233'},
    items:[{id:125,nombre:'Combo #1',tipo:'Combo',cantidad:1,categoria_pago_id:1,especificaciones:{},etapas:pasos(1,[P('Hierro','herrero'),P('Masilla','masilla_pintura'),P('Aluminio','ventanero'),P('Detalles','acabados')])}]},pagado(700)),
  {id:1210,estado:'en_produccion',fecha_entrega:null,interna:true,sede:{nombre:'La Limpia'},cliente:null,total:0,abonos:[],
    items:[{id:130,nombre:'Lineal Económico',tipo:'Puerta Multilock',cantidad:1,categoria_pago_id:1,especificaciones:{},etapas:bitral(1,hecho('tj',dia(7),30),hecho('tl',dia(14),30),asig('tl','2026-11-14'))}]},
  Object.assign({id:1207,estado:'en_produccion',fecha_entrega:'2026-12-12',interna:false,cliente:{nombre:'María León',telefono:'584261112233'},
    items:[{id:127,nombre:'Puerta de madera',tipo:'Puerta de Madera',cantidad:1,categoria_pago_id:1,especificaciones:{},etapas:pasos(1,[
      P('Estructura','carpintero',Object.assign({oficio:'madera'},hecho('tc',dia(17),60,false))),
      P('Armado','carpintero',asig('tc','2026-11-21',{oficio:'madera',iniciada_en:hora(8,0)})),
      P('Pintura','carpintero',asig('tc','2026-11-28',{oficio:'madera'})),
      P('Ensamblado','carpintero',asig('tc','2026-11-28',{oficio:'madera'}))])}]},pagado(1200)),
  Object.assign({id:1198,estado:'lista',fecha_entrega:'2026-11-20',lista_en:dia(18),interna:false,token_seguimiento:'tok1198',cliente:{nombre:'José Marín',telefono:'584121112233'},
    items:[{id:118,nombre:'Lineal',tipo:'Puerta Multilock',cantidad:1,categoria_pago_id:1,especificaciones:{},etapas:bitral(1,hecho('tj',dia(16),30),Object.assign(hecho('tl',dia(17),30),{pago_id:9}),hecho('tl',dia(18),15))}]},pagado(450))
];
const MONTO={herrero:30,masilla_pintura:30,acabados:15,ventanero:20,carpintero:30};
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/montos_pasos')){
    if(rol!=='admin')return j({message:'No autorizado'},400);
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['montos_pasos',body]);
    const m={};for(const v of ventas) if(body.p_ventas.includes(v.id)) for(const it of v.items) for(const e of it.etapas) if(e.estado==='pendiente') m[e.id]=MONTO[e.especialidad];
    return j(m);
  }
  if(u.includes('/rpc/asignar_etapas')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['asignar_etapas',body]);
    body.p.forEach(c=>{ for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===c.eid){ e.trabajador_id=c.tid; e.trabajador=c.tid?nom(c.tid):null; e.para_el=c.tid?c.para:null; } });
    return j(body.p.length);
  }
  if(u.includes('/rpc/cambiar_estado_venta')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['cambiar_estado_venta',body]);
    const v=ventas.find(x=>x.id===body.vid); if(v) v.estado=body.nuevo;
    return j(null);
  }
  if(u.includes('/rpc/produccion_lectura')){
    return j(ventas.filter(v=>v.estado==='en_produccion').map(v=>({id:v.id,fecha_entrega:v.fecha_entrega,interna:v.interna,cliente:v.cliente?{nombre:v.cliente.nombre}:null,
      items:v.items.map(it=>({id:it.id,nombre:it.nombre,tipo:it.tipo,cantidad:it.cantidad,etapas:it.etapas.map(e=>{const x=Object.assign({},e);delete x.monto;delete x.pago_id;return x;})}))})));
  }
  if(u.includes('/rpc/nomina_semana')) return rol==='admin'?j(NOMINA):j({message:'Solo un administrador ve la nómina'},400);
  if(u.includes('/rpc/'))return j([]);
  if(u.includes('/rest/v1/etapas')){
    if(rol!=='admin') return j({message:'permiso'},403);
    llamadas.push(['etapas',u]);
    if(u.includes('id=eq.9001')) return j(VIEJO);
    if(u.includes('terminada_en=lt.')) return j(VIEJOS);
    if(u.includes('para_el=eq.2026-11-14')) return j(SEM_PASADA);
    if(u.includes('para_el')) return j(SEM);
    return j([]);
  }
  if(u.includes('/rest/v1/vales')) return j(VALES);
  if(u.includes('/rest/v1/pagos_trabajador')) return j(PAGOS);
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j(trabajadores.filter(t=>t.id!=='tc'));
    if(u.includes('select=lleva_madera')) return j({lleva_madera:false,linea:null});
    if(u.includes('id=eq')) return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:rol==='admin'});
    return j([{usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,orden:1}]);
  }
  if(u.includes('/categorias_pago')) return j([{id:1,nombre:'General',producto:'Puerta'}]);
  if(u.includes('/ventas')) return j(u.includes('/ventas?') && u.includes('estado=in.(en_produccion,lista)') ? ventas.filter(v=>v.estado==='en_produccion'||v.estado==='lista') : []);
  return j([]);});}

async function entrar(b,user,rol,pin){
  const c=await b.newContext({...devices['iPhone 13']});await c.clock.setFixedTime(HOY);await mock(c,user,rol);
  const p=await c.newPage();p.on('pageerror',e=>err.push(rol+':'+e.message));
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of pin) await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(500);
  return p;
}
const err=[];
(async()=>{ const b=await chromium.launch(); try{
 const a=await entrar(b,'u2','admin','222222');
 // Menú nuevo
 const menu=await a.$$eval('#menuModulos .nav-item span',x=>x.map(s=>s.textContent));
 ok('Menú de abajo: Inicio · Ventas · Catálogo · Taller · Costeador',menu.join(' · ')==='Inicio · Ventas · Catálogo · Taller · Costeador',menu);
 ok('Inicio sigue teniendo Cotizaciones a mano',!!(await a.$('#modulos a[href="cotizaciones.html"]')));

 // ===== Lote 2: Resumen (T1) =====
 await a.goto('http://127.0.0.1:8765/taller.html');await a.waitForSelector('#rAsignado');await a.waitForTimeout(300);
 ok('Abre en Resumen: "Hoy jue 19 · semana 16 al 21 nov"',(await a.textContent('#tabsTaller .on'))==='Resumen' && (await a.textContent('#subtitulo'))==='Hoy jue 19 · semana 16 al 21 nov',await a.textContent('#subtitulo'));
 ok('Avisos: "1 entrega en 2 días ›" y "1 listo para entregar ›" (nada atrasado)',(await a.$$eval('.tl-alrt button',x=>x.map(b=>b.textContent))).join('|')==='1 entrega en 2 días ›|1 listo para entregar ›');
 const pa=await a.textContent('#rPorAsignar');
 ok('1 · Por asignar: "13 pasos en 3 pedidos"',(await a.textContent('#rPorAsignar .tl-big')).replace(/\s+/g,' ').trim()==='13 pasos en 3 pedidos');
 ok('   una fila por pedido con su botón Asignar',(await a.$$eval('#rPorAsignar .tl-row b',x=>x.map(y=>y.textContent))).join('|')==='N° 1200 · Modelo bitral ×2|N° 1203 · Bitral ×2|N° 1205 · Combo #1' && (await a.$$('#rPorAsignar [data-asignar-pedido]')).length===3 && pa.includes('6 pasos · entrega sáb 28 nov'));
 ok('2 · Lo asignado esta semana: "6 de 9 hechos"',(await a.textContent('#rAsignado .tl-big'))==='6 de 9 hechos');
 ok('   leyenda: 6 hechos · 1 haciendo · 1 sin empezar · 1 de la semana pasada',(await a.textContent('#rAsignado .tl-leg'))==='6 hechos1 haciendo1 sin empezar1 de la semana pasada');
 const filasA=await a.$$eval('#rAsignado tbody tr',x=>x.map(r=>[...r.cells].map(c=>c.textContent.trim()).join('·')));
 ok('   tabla: Jesus 4/3/1 · Luis Paz 4/2/2 (1 ↩) · Pedro 1/1/0 · José 0',filasA.join('|')==='Jesus Hierro·4·3·1|Luis Paz Masilla·4·2·2 (1 ↩)|Pedro Detalles·1·1·0|José Hierro·0····',filasA);
 ok('   línea roja: "↩ Detalles del Lineal (exhibición): era para el sáb 14 · Luis Paz"',(await a.textContent('#rAsignado .tl-arr'))==='↩ Detalles del Lineal (exhibición): era para el sáb 14 · Luis Paz');
 ok('3 · Por pagar: "$210 trabajos $220 menos vales $10"',(await a.textContent('#rPorPagar .tl-big')).replace(/\s+/g,' ').trim()==='$210 trabajos $220 menos vales $10');
 const filasP=await a.$$eval('#rPorPagar tbody tr',x=>x.map(r=>[...r.cells].map(c=>c.textContent.trim()).join('·')));
 ok('   Jesus 1 ↩ · 4 · $125 · −$10 · $115; Luis Paz 2 · $95 · $95; Total $220 −$10 $210',filasP.join('|')==='Jesus1 ↩·4 · $125·−$10·$115|Luis Paz·2 · $95···$95|Total·$220·−$10·$210',filasP);
 ok('   "Ya pagaste $15 esta semana (Pedro). Lo que no pagues pasa a la semana siguiente con ↩."',(await a.textContent('#rPorPagar .tl-nota'))==='Ya pagaste $15 esta semana (Pedro). Lo que no pagues pasa a la semana siguiente con ↩.');
 const rv=await a.textContent('#rVales');
 ok('4 · Vales: "Luis Paz pidió $20 · Pasaje de la semana · hoy 8:10 am" con Revisar, y "Jesus · $10 aprobado · se descuenta al pagarle"',rv.includes('Luis Paz pidió $20') && rv.includes('Pasaje de la semana · hoy 8:10 am') && (await a.getAttribute('#rVales .tl-btn-sm','data-nomina-t'))==='tl' && rv.includes('Jesus · $10 aprobado') && rv.includes('mar 17 · se descuenta al pagarle'));
 ok('Atajos: "✂ Plan de corte sáb 21" y "+ Fabricar para exhibición"',(await a.$$eval('#vResumen .tl-atajos > *',x=>x.map(y=>y.textContent))).join('|')==='✂ Plan de corte sáb 21|+ Fabricar para exhibición' && (await a.getAttribute('#vResumen .tl-atajos a','href'))==='costos.html?tab=semana&para=2026-11-21');
 ok('Nada se sale de la pantalla en Resumen',await a.evaluate(()=>document.documentElement.scrollWidth<=390));
 await a.screenshot({path:'shots5/t50-resumen.png',fullPage:true});
 // Tocar un trabajador: sus trabajos de la semana con foto
 await a.click('#rAsignado tr[data-trab="tl"]');await a.waitForSelector('#sheetTrabSem.open');await a.waitForTimeout(300);
 ok('Luis Paz: sus 4 trabajos de la semana, el de la semana pasada con ↩',(await a.textContent('#trabSemTitulo'))==='Luis Paz' && (await a.$$('#trabSemBody .tl-paso')).length===4 && (await a.$$('#trabSemBody .tl-paso.r')).length===1 && (await a.$$('#trabSemBody .tl-mini img')).length===2);
 await a.screenshot({path:'shots5/t50-trabajador-semana.png'});
 await a.click('#sheetTrabSem [data-cerrar="sheetTrabSem"]');await a.waitForTimeout(300);
 // Semana pasada con ‹
 await a.click('#vResumen [data-sem="-1"]');await a.waitForTimeout(600);
 ok('‹ muestra la semana del 9 al 14 nov con lo asignado ese sábado (2 de 2) y "Volver a esta semana"',(await a.textContent('.tl-semnav span'))==='Semana · 9 al 14 nov' && (await a.textContent('#rAsignado .tl-big'))==='2 de 2 hechos' && !(await a.$('#rPorPagar')) && !!(await a.$('[data-sem="0"]')));
 await a.click('[data-sem="0"]');await a.waitForTimeout(600);
 ok('   y vuelve a esta semana',(await a.textContent('#rAsignado .tl-big'))==='6 de 9 hechos');
 // Asignar desde el Resumen abre la hoja de la primera unidad con pasos libres
 await a.click('#rPorAsignar [data-asignar-pedido="1203"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(200);
 ok('Asignar del Resumen abre "Asignar: Bitral (1 de 2)"',(await a.textContent('#todoTitulo'))==='Asignar: Bitral (1 de 2)');
 await a.click('#sheetTodo [data-cerrar="sheetTodo"]');await a.waitForTimeout(300);
 // Aviso → Pedidos con su filtro
 await a.click('.tl-alrt [data-ir-filtro="pronto"]');await a.waitForTimeout(300);
 ok('"1 entrega en 2 días ›" abre Pedidos con ese filtro (solo N° 1200)',(await a.textContent('#tabsTaller .on'))==='Pedidos' && (await a.$$eval('.tl-card',x=>x.map(c=>c.dataset.id))).join()==='1200' && (await a.textContent('#chips .chip.active')).startsWith('Entregan en 2 días'));
 await a.click('#tabsTaller [data-vista="resumen"]');await a.waitForTimeout(300);

 // ===== Lote 2: el aviso "Terminó Hierro" abre el trabajo con su foto (T4) =====
 await a.goto('http://127.0.0.1:8765/taller.html?trabajo=5001');await a.waitForSelector('#sheetTrabajo.open');await a.waitForTimeout(500);
 ok('Aviso: "Hierro terminado" · "Modelo bitral · 1 de 2 · N° 1200"',(await a.textContent('#trabajoTitulo'))==='Hierro terminado' && (await a.textContent('#trabajoSub'))==='Modelo bitral · 1 de 2 · N° 1200');
 ok('   foto grande: "Foto de Jesus · hoy 9:40 am · toca para ampliar"',(await a.textContent('#trabajoBody .tl-hero .tag'))==='Foto de Jesus · hoy 9:40 am · toca para ampliar');
 const kv=await a.$$eval('#trabajoBody .tl-kv2 > div',x=>x.map(d=>d.querySelector('span').textContent+': '+d.querySelector('b').textContent));
 ok('   Lo hizo Jesus · Se le paga $30 · Sigue Masilla · Luis Paz · Por pagar a Jesus $115',kv.join('|')==='Lo hizo: Jesus|Se le paga por esto: $30|Sigue: Masilla · Luis Paz|Por pagar a Jesus: $115',kv);
 ok('   atajos "Ver pedido N° 1200" y "Nómina de Jesus" y la nota',(await a.$$eval('#trabajoBody .tl-atajos > *',x=>x.map(y=>y.textContent))).join('|')==='Ver pedido N° 1200|Nómina de Jesus' && (await a.textContent('#trabajoBody .tl-nota'))==='Ya se sumó a lo que le debes a Jesus. Lo pagas cuando quieras desde Nómina.');
 ok('   sin botones de revisar ni de pagar este trabajo',!(await a.textContent('#trabajoBody')).includes('Bien hecho') && !(await a.textContent('#trabajoBody')).includes('Pagar este'));
 ok('   se quita ?trabajo de la dirección',!a.url().includes('trabajo='));
 await a.screenshot({path:'shots5/t50-trabajo.png'});
 await a.click('#trabajoBody .tl-hero');await a.waitForTimeout(400);
 ok('Tocar la foto la amplía',!!(await a.$('.visor.open')));
 await a.click('.visor-x');await a.waitForTimeout(300);
 await a.click('#trabajoBody [data-ver-pedido="1200"]');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(300);
 ok('"Ver pedido N° 1200" abre el pedido',(await a.textContent('#fichaBody .tl-dt'))==='N° 1200 · Ana Rincón' && !(await a.$('#sheetTrabajo.open')));
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(300);
 // Un trabajo de un pedido ya entregado se busca en la base
 await a.goto('http://127.0.0.1:8765/taller.html?trabajo=9001');await a.waitForSelector('#sheetTrabajo.open');await a.waitForTimeout(400);
 ok('Trabajo de un pedido ya entregado: "Detalles terminado · Lineal · N° 1150", ya pagado',(await a.textContent('#trabajoTitulo'))==='Detalles terminado' && (await a.textContent('#trabajoSub'))==='Lineal · N° 1150' && (await a.textContent('#trabajoBody .tl-nota'))==='Este trabajo ya se le pagó.' && (await a.textContent('#trabajoBody')).includes('Nada: era el último paso'));
 await a.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await a.waitForTimeout(300);

 // Enlace viejo de un aviso: produccion.html?abrir=1200 abre ese pedido en el Taller
 await a.goto('http://127.0.0.1:8765/produccion.html?abrir=1200');await a.waitForSelector('#sheetFicha.open');
 ok('produccion.html?abrir=N lleva al Taller con ese pedido abierto',a.url().includes('taller.html') && (await a.textContent('#fichaBody .tl-dt'))==='N° 1200 · Ana Rincón');
 ok('   y se quita ?abrir de la dirección',!a.url().includes('abrir='));
 const f=await a.textContent('#fichaBody');
 ok('Drawer: "Entrega sáb 21 nov · en 2 días · pagado completo"',(await a.textContent('#fichaBody .tl-ds'))==='Entrega sáb 21 nov · en 2 días · pagado completo',await a.textContent('#fichaBody .tl-ds'));
 ok('Atajos Venta · Seguimiento · ✂ Corte · Costeo',(await a.$$eval('#fichaBody .tl-ats a',x=>x.map(y=>y.textContent))).join(' · ')==='Venta · Seguimiento · ✂ Corte · Costeo');
 ok('   Costeo abre el modelo en el Costeador',(await a.getAttribute('#fichaBody .tl-ats a:has-text("Costeo")','href'))==='costos.html?modelo=7');
 ok('Una sección por unidad: "Modelo bitral · 1 de 2" y "· 2 de 2", cada una con un solo Asignar',(await a.$$eval('#fichaBody .tl-uh-t b',x=>x.map(y=>y.textContent))).join('|')==='Modelo bitral · 1 de 2|Modelo bitral · 2 de 2' && (await a.$$('#fichaBody [data-asignar-todo]')).length===2);
 ok('Hierro: "Jesus · terminó hoy 9:40 am", con su foto y "$30 por pagar"',f.includes('Jesus · terminó hoy 9:40 am') && !!(await a.$('#fichaBody .tl-paso.h .tl-mini img')) && (await a.textContent('#fichaBody .tl-paso.h .tl-monto')).replace(/\s/g,'').startsWith('$30') && (await a.textContent('#fichaBody .tl-paso.h .tl-monto small'))==='por pagar');
 ok('Masilla y pintura: "Luis Paz · ya puede empezar"',f.includes('Luis Paz · ya puede empezar'));
 ok('Unidad 2: "Jesus · haciéndolo desde 10:15 am"',f.includes('Jesus · haciéndolo desde 10:15 am'));
 ok('Los que faltan: "sin asignar" en ámbar (3 pasos)',(await a.$$('#fichaBody .tl-paso.s')).length===3);
 ok('Toca un paso hecho para ver su foto en grande',f.includes('Toca un paso hecho para ver su foto en grande.'));
 await a.screenshot({path:'shots5/t50-drawer-1200.png'});
 await a.click('#fichaBody .tl-paso.h');await a.waitForTimeout(400);
 ok('Tocar el paso hecho abre el trabajo con su foto',!!(await a.$('#sheetTrabajo.open')) && (await a.textContent('#trabajoTitulo'))==='Hierro terminado');
 await a.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await a.waitForTimeout(400);

 // Hoja de asignar de siempre, con lo que se paga a la derecha
 if(!(await a.$('#sheetFicha.open'))){ await a.click('.tl-card[data-id="1200"]');await a.waitForSelector('#sheetFicha.open'); }
 await a.click('[data-asignar-todo="120-2"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(300);
 ok('Título "Asignar: Modelo bitral (2 de 2)" y "N° 1200 · Ana Rincón"',(await a.textContent('#todoTitulo'))==='Asignar: Modelo bitral (2 de 2)' && (await a.textContent('#todoSub'))==='N° 1200 · Ana Rincón');
 ok('¿Para cuándo? Este sáb 21 nov · Próximo sáb 28 nov',(await a.$$eval('#segPara .seg-op',x=>x.map(y=>y.textContent))).join(' · ')==='Este sáb 21 nov · Próximo sáb 28 nov');
 const montos=await a.$$eval('#todoBody .at-monto',x=>x.map(y=>y.textContent.replace(/,00/g,'')));
 ok('Hierro "$30 · ya empezó", Masilla y pintura "$30", Detalles "$15"',montos.join('|')==='$30 · ya empezó|$30|$15',montos);
 ok('El Hierro que ya empezó sale fijo con Jesus',(await a.textContent('#todoBody .at-op.fijo')).includes('Jesus') && (await a.$$('#todoBody .at-paso >> nth=0 >> button.at-op')).length===0);
 await a.click('#todoBody .at-paso >> nth=1 >> .at-op[data-tid="tl"]');
 await a.click('#todoBody .at-paso >> nth=2 >> .at-op[data-tid="tp"]');
 ok('"Guardar 2 cambios"',(await a.textContent('#btnGuardarTodo'))==='Guardar 2 cambios');
 await a.screenshot({path:'shots5/t50-asignar.png'});
 await a.click('#btnGuardarTodo');await a.waitForTimeout(800);
 const at=llamadas.filter(x=>x[0]==='asignar_etapas').pop();
 ok('Usa asignar_etapas con los 2 pasos para este sábado',at && at[1].p.length===2 && at[1].p.every(c=>c.para==='2026-11-21') && at[1].p.map(c=>c.tid).sort().join()==='tl,tp',at&&at[1]);
 ok('El drawer queda abierto y se actualiza',(await a.textContent('#fichaBody')).includes('Pedro · después de hierro') && (await a.textContent('#fichaBody')).includes('Luis Paz · después de hierro'));
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(400);
 // Se deshace para seguir con los números de las maquetas
 for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(it.id===120 && e.unidad===2 && e.orden>1){ e.trabajador_id=null; e.trabajador=null; e.para_el=null; }
 await a.click('#btnActualizar');await a.waitForTimeout(700);

 // Pedidos (T2)
 ok('Título "Taller" y "6 pedidos en el taller"',(await a.textContent('.topbar-title'))==='Taller' && (await a.textContent('#subtitulo'))==='6 pedidos en el taller');
 ok('Pestañas Resumen · Pedidos · Nómina',(await a.$$eval('#tabsTaller > *',x=>x.map(y=>y.textContent))).join(' · ')==='Resumen · Pedidos · Nómina');
 const chips=await a.$$eval('#chips .chip',x=>x.map(y=>y.textContent));
 ok('Filtros en una línea: Todos 6 · Por asignar 3 · En proceso 3 · Listos 1',chips.join(' · ')==='Todos 6 · Por asignar 3 · En proceso 3 · Listos 1',chips);
 ok('Los filtros no saltan a otra línea',await a.$$eval('#chips .chip',x=>new Set(x.map(c=>Math.round(c.getBoundingClientRect().top))).size===1));
 ok('Una tarjeta por pedido u orden (6)',(await a.$$('.tl-card')).length===6);
 const c1200=await a.textContent('.tl-card[data-id="1200"]');
 ok('N° 1200: "sáb 21 · en 2 días" en ámbar',(await a.textContent('.tl-card[data-id="1200"] .tl-pill.am'))==='sáb 21 · en 2 días');
 const f1200=await a.$$eval('.tl-card[data-id="1200"] .tl-f',x=>x.map(y=>y.className.split(' ')[1]+':'+y.textContent));
 ok('Bitral 1 de 2: Hierro ✓ · Masilla · Luis · Detalles; 2 de 2: Hierro · Jesus haciendo, Masilla y Detalles sin asignar',
   f1200.join('|')==='h:Hierro ✓|a:Masilla · Luis|s:Detalles|p:Hierro · Jesus|s:Masilla|s:Detalles',f1200);
 ok('Pie: "Foto nueva de Jesus hoy · 3 pasos por asignar" y Abrir',c1200.includes('Foto nueva de Jesus hoy · 3 pasos por asignar') && c1200.includes('Abrir ›'));
 ok('N° 1203: "6 pasos por asignar" con botón Asignar',(await a.textContent('.tl-card[data-id="1203"] .tl-pie'))==='6 pasos por asignarAsignar');
 ok('N° 1203 en gris "sáb 28 nov"; N° 1205 "vie 4 dic"',(await a.textContent('.tl-card[data-id="1203"] .tl-pill'))==='sáb 28 nov' && (await a.textContent('.tl-card[data-id="1205"] .tl-pill'))==='vie 4 dic');
 const cEx=await a.textContent('.tl-card[data-id="1210"]');
 ok('Exhibición · La Limpia, sin fecha, "Detalles · Luis ↩" en rojo',cEx.includes('Exhibición · La Limpia') && cEx.includes('sin fecha') && (await a.textContent('.tl-card[data-id="1210"] .tl-f.r'))==='Detalles · Luis ↩');
 ok('   y pie "↩ Era para el sáb 14 y no se terminó"',(await a.textContent('.tl-card[data-id="1210"] .tl-pie .rojo'))==='↩ Era para el sáb 14 y no se terminó');
 const f1207=await a.$$eval('.tl-card[data-id="1207"] .tl-f',x=>x.map(y=>y.className.split(' ')[1]));
 ok('Madera: Estructura hecha, Armado haciendo, Pintura y Ensamblado esperando',f1207.join()==='h,p,w,w',f1207);
 ok('   "Madera · la lleva Gualfredo"',(await a.textContent('.tl-card[data-id="1207"] .tl-pie')).includes('Madera · la lleva Gualfredo'));
 ok('N° 1198 al final: "Lista" en verde y "Lista desde ayer · avisar al cliente"',(await a.getAttribute('.tl-card >> nth=5','data-id'))==='1198' && (await a.textContent('.tl-card[data-id="1198"] .tl-pill.ok'))==='Lista' && (await a.textContent('.tl-card[data-id="1198"]')).includes('Lista desde ayer · avisar al cliente'));
 ok('Nada se sale de la pantalla',await a.evaluate(()=>document.documentElement.scrollWidth<=390));
 await a.screenshot({path:'shots5/t50-pedidos.png',fullPage:true});

 // Asignar desde la tarjeta abre la hoja de la primera unidad con pasos libres
 await a.click('.tl-card[data-id="1203"] [data-asignar-pedido]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(200);
 ok('Asignar de la tarjeta abre "Asignar: Bitral (1 de 2)"',(await a.textContent('#todoTitulo'))==='Asignar: Bitral (1 de 2)');
 await a.click('#sheetTodo [data-cerrar="sheetTodo"]');await a.waitForTimeout(300);

 // En proceso
 await a.click('#chips [data-f="proceso"]');await a.waitForTimeout(200);
 ok('En proceso: 1200, 1207 y la exhibición, subtítulo "Pedidos en proceso"',(await a.$$eval('.tl-card',x=>x.map(c=>c.dataset.id))).join()==='1200,1207,1210' && (await a.textContent('#subtitulo'))==='Pedidos en proceso');
 await a.screenshot({path:'shots5/t50-en-proceso.png'});
 // Lo de la semana pasada (T3, tercera)
 await a.click('.tl-card[data-id="1210"]');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(200);
 const fe=await a.textContent('#fichaBody');
 ok('Drawer de exhibición: "Exhibición · La Limpia" y "Lineal Económico · orden para exhibir"',(await a.textContent('#fichaBody .tl-dt'))==='Exhibición · La Limpia' && (await a.textContent('#fichaBody .tl-ds'))==='Lineal Económico · orden para exhibir');
 ok('"Luis Paz · era para el sáb 14 · no lo terminó" con ↩',fe.includes('Luis Paz · era para el sáb 14 · no lo terminó') && !!(await a.$('#fichaBody .tl-dot.r svg')));
 ok('Caja roja: "Sigue en la lista de Luis para este sábado. Con Asignar se lo das a otro."',(await a.textContent('#fichaBody .tl-carry'))==='Sigue en la lista de Luis para este sábado. Con Asignar se lo das a otro.');
 ok('Nota: semanas distintas es normal',fe.includes('Que el Hierro y la Masilla caigan en semanas distintas es normal: eso no se marca.'));
 ok('Pasos hechos de semanas anteriores: "Jesus · terminó el sáb 7 nov"',fe.includes('Jesus · terminó el sáb 7 nov'));
 await a.screenshot({path:'shots5/t50-semana-pasada.png'});
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(400);

 // Listos para entregar (T2, tercera)
 await a.click('#chips [data-f="listos"]');await a.waitForTimeout(200);
 ok('Listos: solo N° 1198 · José Marín, "Lista desde ayer", subtítulo "Listos para entregar"',(await a.$$('.tl-card')).length===1 && (await a.textContent('.tl-card .tl-pill.ok'))==='Lista desde ayer' && (await a.textContent('#subtitulo'))==='Listos para entregar');
 ok('Debe el cliente "$0 · pagado" y Entrega "vie 20 nov"',(await a.textContent('.tl-kv')).replace(/\s+/g,' ')==='Debe el cliente$0 · pagado Entregavie 20 nov',await a.textContent('.tl-kv'));
 ok('Atajos WhatsApp · Fotos · Venta',(await a.$$eval('.tl-card .tl-ats > *',x=>x.map(y=>y.textContent))).join(' · ')==='WhatsApp · Fotos · Venta' && (await a.getAttribute('.tl-ats a:has-text("WhatsApp")','href')).startsWith('https://wa.me/584121112233'));
 ok('Nota: "sin importar en qué semana se asignaron"',(await a.textContent('.tl-nota')).includes('sin importar en qué semana se asignaron'));
 await a.screenshot({path:'shots5/t50-listos.png'});
 a.once('dialog',d=>d.accept());
 await a.click('[data-entregar="1198"]');await a.waitForTimeout(800);
 const ce=llamadas.filter(x=>x[0]==='cambiar_estado_venta').pop();
 ok('Marcar entregada usa cambiar_estado_venta (lista → entregada)',ce && ce[1].vid===1198 && ce[1].nuevo==='entregada' && ce[1].desde==='lista',ce&&ce[1]);
 ok('Ya no sale en Listos: "Nada listo todavía"',(await a.textContent('#lista')).includes('Nada listo todavía'));

 // Por asignar vacío y Ver lo asignado
 for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.estado==='pendiente' && !e.trabajador_id){ e.trabajador_id='tp'; e.trabajador=nom('tp'); e.para_el='2026-11-28'; }
 await a.click('#btnActualizar');await a.waitForTimeout(700);
 await a.click('#chips [data-f="asignar"]');await a.waitForTimeout(200);
 ok('Vacío: "Nada por asignar · Todo lo que entró ya tiene quién lo haga" con "Ver lo asignado"',(await a.textContent('#lista')).includes('Nada por asignar') && (await a.textContent('#lista')).includes('Todo lo que entró ya tiene quién lo haga.') && !!(await a.$('[data-ir="proceso"]')));
 await a.click('[data-ir="proceso"]');await a.waitForTimeout(200);
 ok('   y "Ver lo asignado" lleva a En proceso',(await a.getAttribute('#chips .chip.active','data-f'))==='proceso');

 // Pestaña Nómina y vuelta a Pedidos sin apilar
 await a.click('#tabsTaller [data-vista="nomina"]');await a.waitForSelector('.nm-row');await a.waitForTimeout(400);
 ok('La pestaña Nómina se abre dentro del Taller y el menú marca Taller',(await a.textContent('#tabsTaller .on'))==='Nómina' && await a.isVisible('#vNomina') && (await a.textContent('#menuModulos .nav-item.active span'))==='Taller');

 // Ventas · Cotizaciones
 await a.goto('http://127.0.0.1:8765/ventas.html');await a.waitForTimeout(500);
 ok('Ventas tiene la etiqueta Ventas · Cotizaciones',(await a.$$eval('.tabs-mod a',x=>x.map(y=>y.textContent))).join(' · ')==='Ventas · Cotizaciones' && (await a.textContent('.tabs-mod .on'))==='Ventas');
 await a.click('.tabs-mod a[href="cotizaciones.html"]');await a.waitForURL('**/cotizaciones.html');await a.waitForTimeout(400);
 ok('Cotizaciones abre con el menú marcando Ventas',(await a.textContent('.tabs-mod .on'))==='Cotizaciones' && (await a.textContent('#menuModulos .nav-item.active span'))==='Ventas');
 await a.screenshot({path:'shots5/t50-cotizaciones.png'});
 await a.click('#menuModulos a.nav-item[href="ventas.html"]');await a.waitForURL('**/ventas.html');
 ok('Tocar Ventas en el menú desde Cotizaciones va a Ventas',a.url().endsWith('ventas.html'));

 // Vendedora: Taller sin montos, sin Asignar, sin Nómina ni Costeador
 const y=await entrar(b,'u3','vendedor','333333');
 const mv=await y.$$eval('#menuModulos .nav-item span',x=>x.map(s=>s.textContent));
 ok('Vendedora: Inicio · Ventas · Catálogo · Taller',mv.join(' · ')==='Inicio · Ventas · Catálogo · Taller',mv);
 await y.goto('http://127.0.0.1:8765/taller.html');await y.waitForSelector('.tl-card');
 ok('Vendedora: abre en Pedidos, sin Resumen, sin nómina ni etapas leídas',await y.isHidden('#vResumen') && !llamadas.some(x=>x[0]==='etapas' && x[2]==='v'));
 ok('Vendedora: sin pestañas, sin botón Asignar y sin montos',!(await y.isVisible('#tabsTaller')) && !(await y.$('[data-asignar-pedido]')) && !(await y.textContent('#lista')).includes('$'));
 await y.click('.tl-card >> nth=0');await y.waitForSelector('#sheetFicha.open');
 ok('Vendedora: drawer sin Asignar, sin montos y sin Corte ni Costeo',!(await y.$('#fichaBody [data-asignar-todo]')) && !(await y.textContent('#fichaBody')).includes('$') && !(await y.textContent('#fichaBody')).includes('Costeo'));
 ok('Montos: la vendedora nunca los pide',!llamadas.some(x=>x[0]==='montos_pasos' && x[2]==='vendedor'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
