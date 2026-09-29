// Producción: lista de pedidos en taller, ficha con las etapas de cada producto, un solo botón
// "Asignar trabajadores" por producto (quién y para qué sábado), Combo con puerta, 2 ventanas y
// 2 protecciones, pasos atrasados. El administrador ya no marca terminado (lo hace el trabajador).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const trabajadores=[
  {id:'t1',nombre:'Jesús',especialidades:['herrero','acabados']},
  {id:'t2',nombre:'Pedro',especialidades:['masilla_pintura']},
  {id:'t3',nombre:'Luis',especialidades:['ventanero']}
];
const porId=id=>trabajadores.find(t=>t.id===id);
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const iso=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const SAB=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));const este=iso(d);d.setDate(d.getDate()+7);const prox=iso(d);d.setDate(d.getDate()-14);return {este,prox,pasado:iso(d)};})();

let ventas=[
  {id:20,fecha_entrega:dia(-2),cliente:{nombre:'Carlos Pérez'},estado:'en_produccion',items:[
    {id:101,nombre:'Puerta Multilock',tipo:'Puerta Multilock',foto:null,categoria_pago_id:1,etapas:[
      {id:1001,rama:'principal',nombre:'Hierro',orden:1,especialidad:'herrero',estado:'hecha',trabajador_id:'t1',trabajador:{nombre:'Jesús'},foto:null,terminada_en:new Date().toISOString()},
      {id:1002,rama:'principal',nombre:'Masilla y pintura',orden:2,especialidad:'masilla_pintura',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1003,rama:'principal',nombre:'Detalles',orden:3,especialidad:'acabados',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]},
    {id:102,nombre:'Ventana a medida',tipo:'Ventana',foto:null,categoria_pago_id:1,etapas:[
      {id:1004,rama:'principal',nombre:'Ensamblar',orden:1,especialidad:'ventanero',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]}
  ]},
  {id:21,fecha_entrega:dia(5),cliente:{nombre:'Marisela Chávez'},estado:'en_produccion',items:[
    {id:103,nombre:'Reja para ventana',tipo:'Ventana',foto:null,categoria_pago_id:1,etapas:[
      {id:1005,rama:'principal',nombre:'Ensamblar',orden:1,especialidad:'ventanero',estado:'pendiente',trabajador_id:'t3',trabajador:{nombre:'Luis'},foto:null,terminada_en:null,para_el:SAB.pasado}
    ]}
  ]},
  {id:22,fecha_entrega:dia(10),cliente:{nombre:'Ana Belisario'},estado:'en_produccion',items:[
    {id:104,nombre:'Combo Modelo Lineal',tipo:'Combo',foto:null,categoria_pago_id:1,especificaciones:{alto:2,ancho:1,color:'Negro',ventanas_alto:1.2,ventanas_ancho:1,ventanas_color:'Negro'},catalogo:{fotos:{Blanco:GIF}},etapas:[
      {id:1006,rama:'principal',nombre:'Hierro',orden:1,especialidad:'herrero',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1007,rama:'principal',nombre:'Masilla y pintura',orden:2,especialidad:'masilla_pintura',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1008,rama:'principal',nombre:'Detalles',orden:3,especialidad:'acabados',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1010,rama:'proteccion',nombre:'Hierro 2 protecciones',orden:1,especialidad:'herrero',estado:'pendiente',unidades:2,trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1011,rama:'proteccion',nombre:'Pintura 2 protecciones',orden:2,especialidad:'masilla_pintura',estado:'pendiente',unidades:2,trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1009,rama:'ventana',nombre:'Ensamblar 2 ventanas',orden:1,especialidad:'ventanero',estado:'pendiente',unidades:2,trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]}
  ]}
];
const llamadas=[];let fallarTodo=false;

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(/\/rpc\/asignar_etapa$/.test(u.split('?')[0])){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['asignar_etapa',body]);
    for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===body.eid){ e.trabajador_id=body.tid; e.trabajador={nombre:(porId(body.tid)||{}).nombre||''}; }
    return j({});
  }
  if(u.includes('/rpc/asignar_etapas')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['asignar_etapas',body]);
    if(fallarTodo)return j({message:'Esta etapa ya no se puede asignar'},400);
    body.p.forEach(c=>{ for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===c.eid){ e.trabajador_id=c.tid; e.trabajador=c.tid?{nombre:(porId(c.tid)||{}).nombre||''}:null; e.para_el=c.tid?(c.para||e.para_el||SAB.este):null; } });
    return j(body.p.length);
  }
  if(u.includes('/rpc/marcar_etapa_terminada')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['marcar_etapa_terminada',body]);
    let vid=null;
    for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===body.eid){ e.estado='hecha'; e.foto=body.foto_url||null; vid=v.id; }
    const v=ventas.find(x=>x.id===vid);
    const faltan=v.items.flatMap(it=>it.etapas).filter(e=>e.estado==='pendiente').length;
    if(faltan===0) v.estado='lista';
    return j({venta_id:vid, listo:faltan===0});
  }
  if(u.includes('/rpc/produccion_lectura')){
    if(rol!=='admin'&&rol!=='vendedor')return j({message:'No autorizado'},400);
    return j(ventas.filter(v=>v.estado==='en_produccion').map(v=>({id:v.id,fecha_entrega:v.fecha_entrega,interna:false,cliente:v.cliente,
      items:v.items.map(it=>({id:it.id,nombre:it.nombre,tipo:it.tipo,foto:it.foto,cantidad:1,etapas:it.etapas.map(e=>({id:e.id,rama:e.rama,nombre:e.nombre,orden:e.orden,estado:e.estado,trabajador_id:e.trabajador_id,para_el:e.para_el||null,terminada_en:e.terminada_en,trabajador:e.trabajador}))}))})));
  }
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j(trabajadores);
    if(u.includes('id=eq')) return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:false});
    return j([{usuario:'raymundo',nombre:'Ray',rol,orden:1}]);
  }
  if(u.includes('/categorias_pago')) return j([{id:1,nombre:'General'}]);
  if(u.includes('/ventas')){
    const activos=ventas.filter(v=>v.estado==='en_produccion');
    return j(activos);
  }
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // Vendedora: ve Producción solo para mirar (sin montos ni botones)
 const cy=await b.newContext({...devices['iPhone 13']});await mock(cy,'u3','vendedor');
 const y=await cy.newPage();y.on('pageerror',e=>err.push('vend:'+e.message));
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');await y.waitForTimeout(800);
 ok('Vendedora ve "Producción" en el menú de abajo',!!(await y.$('a.nav-item[href="produccion.html"]')));
 ok('Su cajita Producción dice cuántos hay en taller',(await y.textContent('#cuenta-produccion'))==='3 pedidos en taller',await y.textContent('#cuenta-produccion'));
 await y.click('a.nav-item[href="produccion.html"]');await y.waitForSelector('.vcard');
 ok('Vendedora ve los 3 pedidos en taller',(await y.$$('.vcard')).length===3);
 ok('Solo chips Todos y Atrasados, sin botón +',(await y.$$eval('#chips .chip',x=>x.map(c=>c.dataset.f))).join()==='todos,atrasados' && !(await y.isVisible('#btnNuevaOrden')));
 ok('Cada pedido dice en qué va',(await y.textContent('.vcard >> nth=0')).includes('En masilla y pintura'));
 await y.screenshot({path:'shots5/s0-vendedora-lista.png'});
 await y.click('.vcard >> nth=0');await y.waitForSelector('#sheetFicha.open');
 const fv=await y.textContent('#fichaBody');
 ok('Ficha: sin botones de asignar ni terminar, sin categoría de pago',!(await y.$('#fichaBody [data-asignar]')) && !(await y.$('#fichaBody [data-terminar]')) && !(await y.$('#fichaBody [data-cat-item]')) && !fv.includes('Pago:'));
 ok('Ficha: dice quién terminó (sin montos) y qué falta asignar',fv.includes('Terminó') && fv.includes('Jesús') && !fv.includes('$') && fv.includes('Por asignar'));
 await y.screenshot({path:'shots5/s0b-vendedora-ficha.png'});
 await y.click('#sheetFicha [data-cerrar="sheetFicha"]').catch(()=>{});

 // Admin: entra a Producción
 const ca=await b.newContext({...devices['iPhone 13']});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push('admin:'+e.message));
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');
 ok('Admin sí ve "Producción" en el menú de abajo',!!(await a.$('a.nav-item[href="produccion.html"]')));
 await a.click('a.nav-item[href="produccion.html"]');await a.waitForSelector('.vcard');
 ok('Lista muestra los 3 pedidos en taller',(await a.$$('.vcard')).length===3);
 ok('El pedido atrasado se ordena primero',(await a.textContent('.vcard'))?.includes('Carlos Pérez'));
 ok('Chip "Por asignar" cuenta los 2 pedidos con su etapa actual sin trabajador',(await a.textContent('#chips')).includes('Por asignar · 2'));
 await a.screenshot({path:'shots5/s1-lista.png',fullPage:true});

 ok('Chip "Atrasados" cuenta 2 (uno por fecha de entrega y otro con un paso que pasó su sábado)',(await a.textContent('#chips')).includes('Atrasados · 2'));
 ok('La tarjeta del pedido con el paso atrasado lo dice',(await a.textContent('.vcard >> text=Marisela Chávez')) !== null && (await a.$$eval('.vcard',x=>x.map(c=>c.textContent))).some(t=>t.includes('Marisela') && t.includes('1 paso atrasado')));

 // Ficha: primer pedido (Hierro hecho, Masilla actual sin asignar, Detalles futura)
 await a.click('.vcard >> nth=0');await a.waitForSelector('#sheetFicha.open');
 const f1=await a.textContent('#fichaBody');
 ok('Hierro se ve terminado con quién lo hizo',f1.includes('Terminó') && f1.includes('Jesús'));
 ok('Cada paso pendiente solo dice "Por asignar" (sin botones por paso)',(await a.$$('#fichaBody .e-por')).length===3 && !(await a.$('#fichaBody [data-asignar]')));
 ok('Detalles dice después de qué va',f1.includes('Después de masilla y pintura'));
 ok('El admin ya no tiene "Marcar terminado"',!(await a.$('#fichaBody [data-terminar]')) && !f1.includes('Marcar terminado') && !(await a.$('#sheetTerminar')));
 ok('Un solo botón "Asignar trabajadores" por producto',(await a.$$('#fichaBody [data-asignar-todo]')).length===2 && (await a.textContent('[data-asignar-todo="101"]'))==='Asignar trabajadores');
 await a.screenshot({path:'shots5/s2-ficha.png',fullPage:true});

 // Asignar trabajadores de la puerta: quién y para qué sábado
 await a.click('[data-asignar-todo="101"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(300);
 ok('Pregunta "¿Para cuándo?" con este sábado marcado y el próximo',(await a.textContent('#todoBody')).includes('¿Para cuándo?') && (await a.getAttribute('.seg-op.on','data-para'))===SAB.este && !!(await a.$(`.seg-op[data-para="${SAB.prox}"]`)));
 ok('En Masilla y pintura solo aparece Pedro',(await a.textContent('.at-paso[data-eid="1002"]')).includes('Pedro') && !(await a.textContent('.at-paso[data-eid="1002"]')).includes('Jesús'));
 await a.click('.at-op[data-eid="1002"][data-tid="t2"]');await a.click('.at-op[data-eid="1003"][data-tid="t1"]');
 await a.click(`.seg-op[data-para="${SAB.prox}"]`);
 ok('Dice cuántos cambios va a guardar',(await a.textContent('#btnGuardarTodo'))==='Guardar 2 cambios');
 await a.screenshot({path:'shots5/s3-asignar-cuando.png'});
 await a.click('#btnGuardarTodo');await a.waitForTimeout(700);
 let at=llamadas.filter(x=>x[0]==='asignar_etapas').pop();
 ok('Se guarda quién y para el próximo sábado',at && at[1].p.length===2 && at[1].p.every(c=>c.para===SAB.prox) && at[1].p.find(c=>c.eid===1002).tid==='t2',at&&at[1]);
 const f2=await a.textContent('#fichaBody');
 ok('La ficha muestra a Pedro y a Jesús con "Para el sáb ..."',f2.includes('Pedro') && (await a.$$('#fichaBody .e-tope')).length===2 && f2.includes('Para el sáb'));
 await a.screenshot({path:'shots5/s3-asignado.png',fullPage:true});
 // Cambiar solo la fecha: cuenta los ya asignados
 await a.click('[data-asignar-todo="101"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(300);
 ok('Al volver a abrir, arranca en el próximo sábado (el que tienen)',(await a.getAttribute('.seg-op.on','data-para'))===SAB.prox && await a.$eval('#btnGuardarTodo',x=>x.disabled));
 await a.click(`.seg-op[data-para="${SAB.este}"]`);
 ok('Cambiar solo la fecha cuenta los 2 asignados',(await a.textContent('#btnGuardarTodo'))==='Guardar 2 cambios');
 await a.click('#btnGuardarTodo');await a.waitForTimeout(700);
 at=llamadas.filter(x=>x[0]==='asignar_etapas').pop();
 ok('   y se guardan para este sábado',at && at[1].p.length===2 && at[1].p.every(c=>c.para===SAB.este && c.tid));
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]').catch(()=>{});await a.waitForTimeout(400);

 // Pedido con un paso que pasó su sábado
 await a.click('.vcard >> text=Marisela Chávez');await a.waitForSelector('#sheetFicha.open');
 ok('El paso atrasado dice "Se pasó del sáb ..." en rojo',!!(await a.$('#fichaBody .e-tope.tarde')) && (await a.textContent('#fichaBody')).includes('Se pasó del sáb'));
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]').catch(()=>{});await a.waitForTimeout(400);

 // Tercer pedido: Combo con puerta, 2 ventanas y 2 protecciones en paralelo
 await a.click('.vcard >> text=Ana Belisario');await a.waitForSelector('#sheetFicha.open');
 const fichaCombo=await a.textContent('#fichaBody');
 const titulos=await a.$$eval('#fichaBody .e-rama-tit',x=>x.map(t=>t.textContent));
 ok('El Combo se ve en 3 bloques con sus medidas',titulos.length===3 && titulos[0].startsWith('Puerta') && titulos[0].includes('2 × 1 m') && titulos[1].startsWith('2 ventanas') && titulos[1].includes('c/u') && titulos[2].startsWith('2 protecciones'),titulos);
 ok('Dice "1 puerta + 2 ventanas + 2 protecciones"',fichaCombo.includes('1 puerta + 2 ventanas + 2 protecciones'));
 ok('Las tres líneas tienen su paso actual a la vez',(await a.$$('#fichaBody .etapa.actual')).length===3);
 ok('Si el modelo no tiene foto en ese color, avisa: "Foto en blanco · la puerta va en NEGRO"',fichaCombo.includes('Foto en blanco · la puerta va en NEGRO'));
 await a.click('[data-asignar-todo="104"]');await a.waitForSelector('#sheetTodo.open');
 ok('La hoja lista los 6 pasos con quién puede hacer cada uno',(await a.$$('#todoBody .at-paso')).length===6 && (await a.textContent('.at-paso[data-eid="1011"]')).includes('Pedro') && !(await a.textContent('.at-paso[data-eid="1011"]')).includes('Luis'));
 ok('Sin cambios el botón está apagado',await a.$eval('#btnGuardarTodo',x=>x.disabled));
 for(const [eid,tid] of [[1006,'t1'],[1007,'t2'],[1008,'t1'],[1009,'t3'],[1010,'t1'],[1011,'t2']]) await a.click(`.at-op[data-eid="${eid}"][data-tid="${tid}"]`);
 ok('Dice cuántos cambios va a guardar',(await a.textContent('#btnGuardarTodo'))==='Guardar 6 cambios');
 await a.screenshot({path:'shots5/s6-asignar-todo.png'});
 await a.click('#btnGuardarTodo');await a.waitForTimeout(700);
 at=llamadas.filter(x=>x[0]==='asignar_etapas').pop();
 ok('Se guardan los 6 de una vez, para este sábado',at && at[1].p.length===6 && at[1].p.every(c=>c.para===SAB.este) && at[1].p.find(x=>x.eid===1009).tid==='t3',at&&at[1]);
 ok('La ficha muestra a cada uno en su paso',(await a.textContent('#fichaBody')).includes('Pedro') && (await a.textContent('#fichaBody')).includes('Luis') && !(await a.$('#sheetTodo.open')));
 await a.screenshot({path:'shots5/s7-todo-asignado.png',fullPage:true});
 await a.screenshot({path:'shots5/s5-combo.png',fullPage:true});
 // Si algo cambió mientras la hoja estaba abierta: avisa, cierra y vuelve a pintar con lo último
 for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===1008){ e.trabajador_id='t9'; e.trabajador={nombre:'Mario'}; }
 fallarTodo=true;
 await a.click('[data-asignar-todo="104"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(300);
 await a.click('.at-op[data-eid="1009"][data-tid=""]');await a.click('#btnGuardarTodo');await a.waitForTimeout(900);
 ok('Si el servidor dice que algo cambió: lo avisa y cierra la hoja',(await a.textContent('#toast')).includes('ya no se puede asignar') && !(await a.$('#sheetTodo.open')));
 fallarTodo=false;await a.waitForTimeout(400);
 await a.click('[data-asignar-todo="104"]');await a.waitForSelector('#sheetTodo.open');await a.waitForTimeout(300);
 ok('Un trabajador inactivo asignado sale marcado como "(inactivo)" para poder cambiarlo',((await a.textContent('.at-op.on[data-eid="1008"]'))||'').includes('Mario (inactivo)'));
 ok('   y sin cambios el botón sigue apagado',await a.$eval('#btnGuardarTodo',x=>x.disabled));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
