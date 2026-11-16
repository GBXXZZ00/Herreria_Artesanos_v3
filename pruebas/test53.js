// test53 (Taller lote 5): Taller › Corte por herrero (K01 a K10, K19 a K21) con los datos del Bitral
// (pruebas/datos-costos-bitral.json, arnés de test47). Por herrero con sus números y estados, puertas sin asignar,
// drawer del herrero (una tarjeta por puerta, "Igual que", de dónde sale el material con TALLER / NUEVA),
// enviar (corte_enviar con el plan y la compra juntos), mover una pieza (vuelve a "Cambió · vuelve a enviar"),
// Más (deshacer envío), ⋯ de la puerta (pasarla a otro herrero), asignar puertas, candado si ya empezó,
// corregir lo que cortó, avisos, vacío, la vendedora no ve Corte, y el herrero ve "Qué cortar".
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const DATOS=JSON.parse(fs.readFileSync(__dirname+'/datos-costos-bitral.json','utf8'));
DATOS.categorias=[{id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:30}}}];
DATOS.enFabricacion=[7];
DATOS.fab.forEach(f=>(f.retazos||[]).forEach(r=>{r.num=r.num||12;}));
const isoL=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const sab=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));return isoL(d);})();
const PERF={u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true,lleva_madera:false},u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,confirma_abonos:false},
  t1:{id:'t1',usuario:'jesus',nombre:'Jesus',rol:'trabajador',activo:true,especialidades:['herrero']}};
const TRAB=[{id:'t1',nombre:'Jesus',especialidades:['herrero']},{id:'t2',nombre:'José',especialidades:['herrero']},{id:'t3',nombre:'Luis Paz',especialidades:['masilla_pintura']}];
function corte(){return {aluminio:0,planes:{},pasos:[
  {eid:900,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:1,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:901,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:2,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:902,venta:1201,interna:false,cliente:'Luis Paz',entrega:sab,mid:4,nombre:'Lineal Economico',tipo:'Puerta Multilock',unidad:1,de:1,tid:null,herrero:null,para:null,precio:200,cortado:false}]};}
const firmaB=(bs)=>JSON.stringify((bs||[]).map(b=>({mid:String(b.mid),tipo:b.tipo,rid:b.rid||null,piezas:(b.piezas||[]).map(p=>String(p.eid)+':'+Number(p.cm)).sort()})).map(x=>JSON.stringify(x)).sort());
async function pagina(b,uid,err,C){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});const rpcs=[];
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='costos_datos')return PERF[uid].confirma_abonos?j(DATOS):j({message:'Costos es solo para Ray o Gualfredo'},400);
      if(name==='corte_datos')return j(C);
      if(name==='corte_plan_guardar'){C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{},enviados:{}},C.planes[a.p_sab]||{},a.p);return j({sab:a.p_sab});}
      if(name==='corte_enviar'){const pl=C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{},enviados:{}},C.planes[a.p_sab]||{},a.p_plan,{aceptado:true});
        pl.enviados[a.p_tid]={firma:'F',firma_hoy:'F',empezo:false,en:new Date().toISOString(),barras:a.p_plan.barras.filter(x=>x.tid===a.p_tid)};return j({sab:a.p_sab,tid:a.p_tid,compra:a.p_compra?{grupo:5}:null});}
      if(name==='corte_deshacer_envio'){delete C.planes[a.p_sab].enviados[a.p_tid];return j({});}
      if(name==='corte_corregir')return j({ok:true});
      if(name==='asignar_etapas')return j(a.p.length);
      if(name==='mis_trabajos')return j([{id:900,oficio:'hierro',estado:'pendiente',producto:'Modelo bitral',tipo:'Puerta Multilock'}]);
      if(name==='mis_pagos')return j({});
      if(name==='mi_hoja_corte')return j(C.hojaHerrero||[]);
      return j({});}
    if(u.includes('/perfiles')){ if(u.includes('rol=eq.trabajador'))return j(TRAB); if(u.includes('select=lleva_madera'))return j({lleva_madera:false,linea:null}); if(u.includes('id=eq'))return j(PERF[uid]); return j([{usuario:PERF[uid].usuario,nombre:PERF[uid].nombre,rol:PERF[uid].rol,orden:1}]);}
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(uid+': '+e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(500);
  return {p,rpcs};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
const txt=async(p,s)=>((await p.innerText(s))||'').replace(/\s+/g,' ').trim();
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  const C=corte();
  const {p,rpcs}=await pagina(b,'u2',err,C); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'taller.html?vista=corte');await p.waitForSelector('#vCorte .nm-row');await w();
  ok('Ray ve la pestaña Corte entre Pedidos y Nómina',(await p.$$eval('#tabsTaller > *:not(.hidden)',x=>x.map(y=>y.textContent))).join(' · ')==='Resumen · Pedidos · Corte · Nómina' && (await p.textContent('#tabsTaller .on'))==='Corte');
  ok('Números: 2 puertas por cortar · 0 enviados · 1 sin enviar',(await txt(p,'.ck-nums'))==='2 Puertas por cortar 0 Enviados 1 Sin enviar',await txt(p,'.ck-nums'));
  ok('Tarjeta "1 puerta sin asignar · entregan esta semana o la próxima" con Asignar',(await txt(p,'.ck-sinasig')).startsWith('1 puerta sin asignar entregan esta semana o la próxima'));
  const fila=await txt(p,'#vCorte .nm-row');
  ok('Fila de Jesus: 2 puertas, N° 1200, "Sin enviar" y Abrir',fila.includes('Jesus · 2 puertas') && fila.includes('N° 1200') && fila.includes('Sin enviar') && fila.includes('Abrir ›'),fila);
  ok('Nada se sale de la pantalla',await p.evaluate(()=>document.documentElement.scrollWidth<=390));
  await p.screenshot({path:'shots5/t53-por-herrero.png'});

  // Drawer de Jesus (K02)
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(500);
  ok('"Corte de Jesus" · "Hierro para el sáb … · 2 puertas" · "Sin enviar · revisa y envía"',(await p.textContent('#ckTitulo'))==='Corte de Jesus' && (await p.textContent('#ckSub')).endsWith('· 2 puertas') && (await txt(p,'.ck-estado')).includes('Sin enviar · revisa y envía'));
  const cards=await p.$$eval('#ckBody .ck-puerta',x=>x.map(c=>c.innerText.replace(/\s+/g,' ')));
  ok('Una tarjeta por puerta; la segunda "Igual que" la primera',cards.length===2 && cards[0].includes('le toca primero') && cards[1].includes('Igual que N° 1200 (1 de 2)'),cards);
  ok('La lista va en palabras ("2 de 200 · 2 de 88" o parecido)',/\d+ de \d+/.test(cards[0]));
  ok('Cada tarjeta dice el material: hay todo o lo que falta',cards.every(c=>c.includes('Material: hay todo ✓') || c.includes('se pide al enviar')));
  ok('De dónde sale el material, con TALLER, NUEVA o retazo',!!(await p.$('#ckBody .ck-tag')) && (await p.$$('#ckBody .ck-pz')).length>0);
  const btn=await p.textContent('[data-ck-enviar]');
  ok('Un solo botón "Enviar a Jesus" (y pedir las barras que faltan)',/^Enviar a Jesus( y pedir \d+ barras?)?$/.test(btn),btn);
  await p.screenshot({path:'shots5/t53-corte-jesus.png',fullPage:true});
  await p.click('[data-ck-enviar]');await w(900);
  const env=ultimo(rpcs,'corte_enviar');
  ok('Enviar usa corte_enviar con el sábado, Jesus y el plan (y la compra si falta)',env && env.p_sab===sab && env.p_tid==='t1' && env.p_plan.barras.length>0 && (btn.includes('pedir') ? !!env.p_compra : env.p_compra===null),env&&{tid:env.p_tid,compra:!!env.p_compra});
  ok('Queda "Enviado" con su línea de tiempo',(await txt(p,'.ck-estado')).startsWith('● Enviado') && (await txt(p,'.ck-tiempo')).includes('Enviado a Jesus') && !(await p.$('[data-ck-enviar]')));
  // Mover una pieza (K04): cambia el plan y pide volver a enviar
  await p.click('#ckBody .ck-pz');await p.waitForSelector('#sheetCkPieza.open');await w(300);
  ok('Pieza: "¿De dónde sale?" con la barra donde está y otras opciones',(await p.textContent('#ckPzTitulo')).startsWith('Pieza de ') && (await p.$$('#ckPzBody .nm-cta')).length>=2);
  await p.screenshot({path:'shots5/t53-pieza.png'});
  const otra=await p.$('#ckPzBody .nm-cta:not(.on):not([disabled])');
  if(otra){ await otra.click(); await p.click('#btnCkPieza'); await w(900); }
  const g=ultimo(rpcs,'corte_plan_guardar');
  ok('Mover la pieza guarda el plan ajustado a mano',otra && g && g.p.ajustado===true);
  // tras guardar, el plan de Jesus ya no es igual a lo enviado
  C.planes[sab].enviados.t1.barras=JSON.parse(JSON.stringify(C.planes[sab].enviados.t1.barras));
  await p.evaluate(()=>document.getElementById('btnActualizar').click());await w(1200);
  const est=await txt(p,'#vCorte .nm-row');
  ok('Ahora Jesus sale "Cambió · vuelve a enviar"',firmaB(C.planes[sab].enviados.t1.barras)!==firmaB(C.planes[sab].barras.filter(x=>x.tid==='t1')) ? est.includes('Cambió · vuelve a enviar') : true,est);
  // Más (K03): deshacer envío
  if(!(await p.$('#sheetCorte.open'))){ await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open'); }
  await w(300);await p.click('[data-ck-masmenu]');await p.waitForSelector('#sheetCkMas.open');await w(200);
  ok('Más: Ver en PDF · Sugerir de nuevo · Deshacer envío · Corregir lo que cortó · Reportar barra dañada',(await p.$$eval('#ckMasBody .ck-mrow b',x=>x.map(y=>y.textContent))).join(' · ')==='Ver en PDF · Sugerir de nuevo · Deshacer envío · Corregir lo que cortó · Reportar barra dañada');
  await p.screenshot({path:'shots5/t53-mas.png'});
  await p.click('[data-ck-m="deshacer"]');await w(900);
  ok('Deshacer envío llama a corte_deshacer_envio',!!ultimo(rpcs,'corte_deshacer_envio') && ultimo(rpcs,'corte_deshacer_envio').p_tid==='t1');
  // ⋯ de la puerta (K05)
  await p.click('#ckBody [data-ck-puerta]');await p.waitForSelector('#sheetCkPuerta.open');await w(200);
  ok('⋯ de la puerta: pasar a otro herrero, al próximo sábado o quitar del plan',(await p.$$('#ckPuBody .nm-cta')).length===3 && (await p.textContent('#btnCkPuerta'))==='Elige a quién');
  await p.click('#ckPuBody [data-ck-h="t2"]');
  ok('   elegir a José dice "Pasar a José"',(await p.textContent('#btnCkPuerta'))==='Pasar a José');
  await p.screenshot({path:'shots5/t53-puerta.png'});
  await p.click('#btnCkPuerta');await w(900);
  const as=ultimo(rpcs,'asignar_etapas');
  ok('   y usa asignar_etapas con José para el mismo sábado',as && as.p[0].tid==='t2' && as.p[0].para===sab);
  await p.click('#sheetCorte [data-cerrar="sheetCorte"]').catch(()=>{});await w(300);
  // Asignar puertas (K06)
  await p.click('[data-ck-asignar]');await p.waitForSelector('#sheetCkAsignar.open');await w(200);
  ok('Asignar puertas: "Sin asignar 1" y la puerta N° 1201',(await txt(p,'#ckAsBody')).includes('Sin asignar 1') && (await txt(p,'#ckAsBody')).includes('N° 1201'));
  await p.click('#ckAsBody [data-ck-as="902"][data-tid="t1"]');
  ok('   "Asignar 1 puerta"',(await p.textContent('#btnCkAsignar'))==='Asignar 1 puerta');
  await p.screenshot({path:'shots5/t53-asignar.png'});
  await p.click('#btnCkAsignar');await w(900);
  const as2=ultimo(rpcs,'asignar_etapas');
  ok('   asigna con asignar_etapas a Jesus para este sábado',as2 && as2.p.length===1 && as2.p[0].eid===902 && as2.p[0].tid==='t1' && as2.p[0].para===sab);
  // Candado (K08) y corregir (K10)
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(300);
  await p.click('[data-ck-enviar]');await w(900);
  C.planes[sab].enviados.t1.empezo=true;
  await p.click('#sheetCorte [data-cerrar="sheetCorte"]').catch(()=>{});await p.evaluate(()=>document.getElementById('btnActualizar').click());await w(1200);
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(300);
  ok('Si ya empezó: candado, sin ⋯ ni piezas tocables, y Corregir espera a que termine',(await txt(p,'.ck-estado')).includes('ya empezó a cortar') && !(await p.$('#ckBody [data-ck-puerta]')) && !(await p.$('#ckBody [data-ck-pz]')) && await p.$eval('[data-ck-corregir]',x=>x.disabled) && (await txt(p,'#ckFoot')).includes('Se activa cuando Jesus termina el Hierro'));
  await p.screenshot({path:'shots5/t53-candado.png'});
  C.planes[sab].entregado={t1:true};
  await p.click('#sheetCorte [data-cerrar="sheetCorte"]').catch(()=>{});await p.evaluate(()=>document.getElementById('btnActualizar').click());await w(1200);
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(300);
  await p.click('[data-ck-corregir]');await p.waitForSelector('#sheetCkCorregir.open');await w(200);
  await p.click('#ckCoBody [data-ck-mas2="0"]');await p.click('#btnCkCorregir');await w(200);
  ok('Corregir pide el motivo',await p.isVisible('#campoCkMotivo.invalid'));
  await p.fill('#ckMotivo','Se dañó una barra');await p.click('#btnCkCorregir');await w(900);
  const co=ultimo(rpcs,'corte_corregir');
  ok('   y usa corte_corregir con una barra más y el motivo',co && co.p.motivo==='Se dañó una barra' && co.p.barras>=1);
  await p.screenshot({path:'shots5/t53-corregir.png'});
  // Avisos (K19): una puerta que salió del plan después de enviar
  await p.click('#sheetCorte [data-cerrar="sheetCorte"]').catch(()=>{});await w(300);
  C.planes[sab].entregado={};C.planes[sab].enviados.t1.empezo=false;C.planes[sab].enviados.t1.barras.push({mid:1,tipo:'barra',piezas:[{eid:905,cm:100,etq:'N° 1203',tid:'t1'}],tid:'t1'});
  await p.evaluate(()=>document.getElementById('btnActualizar').click());await w(1200);
  ok('Aviso: "N° 1203 salió del plan de Jesus" con Volver a enviar',(await txt(p,'#vCorte')).includes('N° 1203 salió del plan de Jesus') && !!(await p.$('.ck-aviso [data-ck-abrir="t1"]')));
  await p.click('#tabsTaller [data-vista="resumen"]');await w(600);
  ok('   y también sale en el Resumen',(await txt(p,'.tl-alrt')).includes('Corte:'));
  // Vacío
  C.pasos=[];C.planes={};
  await p.click('#tabsTaller [data-vista="corte"]');await w(1200);
  ok('Vacío: "Nadie tiene Hierro asignado" con Ir a Pedidos',(await txt(p,'#vCorte')).includes('Nadie tiene Hierro asignado') && !!(await p.$('[data-ck-pedidos]')));

  // Vendedora: no ve Corte
  const V=await pagina(b,'u3',err,corte());
  await V.p.goto(H+'taller.html');await V.p.waitForTimeout(1500);
  ok('La vendedora no ve la pestaña Corte',!(await V.p.isVisible('#tabCorte')));

  // Herrero (K21): Qué cortar con lo que se le envió
  const C2=corte();C2.hojaHerrero=[{sab,cortado:false,enviado_en:new Date().toISOString(),barras:[{mid:1,material:'Tubo 3" x 1"',tipo:'barra',n:1,comprar:false,largo:600,libre:0,minimo:50,piezas:[{cm:200,etq:'N° 1200 (1 de 2)',color:'#17555C'},{cm:200,etq:'N° 1200 (2 de 2)',color:'#B7791F'}]},{mid:1,material:'Tubo 3" x 1"',tipo:'barra',n:2,comprar:true,largo:600,libre:48,minimo:30,piezas:[{cm:200,etq:'N° 1200 (1 de 2)',color:'#17555C'}]}],pasar:[],manual:[],extras_mano:[]}];
  const T=await pagina(b,'t1',err,C2);await T.p.waitForTimeout(800);
  const qc=await txt(T.p,'.tj-corte');
  ok('El herrero ve "Qué cortar · te lo mandó Ray hoy …" con sus 2 puertas',qc.includes('Qué cortar · te lo mandó Ray hoy') && qc.includes('2 puertas'));
  ok('   sus barras con TALLER y NUEVA y "guarda el retazo"',(await T.p.$$('.tj-tag.taller')).length===1 && (await T.p.$$('.tj-tag.nueva')).length===1 && qc.includes('guarda el retazo de'));
  await T.p.screenshot({path:'shots5/t53-que-cortar.png',fullPage:true});
  C2.hojaHerrero=[];await T.p.reload();await T.p.waitForSelector('#vInicio.entra').catch(()=>{});await T.p.waitForTimeout(1200);
  ok('Sin corte enviado: "Ray todavía no te manda el corte de esta semana."',(await txt(T.p,'body')).includes('Ray todavía no te manda el corte de esta semana.'));

  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?'HAY FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
