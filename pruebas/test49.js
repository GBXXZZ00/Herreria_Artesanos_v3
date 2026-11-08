// test49 (reestructura lote 7): Extras de punta a punta. Costos: extra con sus cortes (+ Pieza, Copiar de otro
// modelo), mano de obra de la protección por categoría, manillón sin cortes, oculto, grupo "Extras vendidos sin
// costear" y protección incluida si el Catálogo la trae tildada. Plan de corte: los cortes del extra entran al plan;
// el extra sin cortes sale con aviso y "Cortar a mano". Inicio: aviso. Mi trabajo: "córtalo como siempre".
// Venta: el manillón toma el precio de Costos. (arnés de test47)
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const DATOS=JSON.parse(fs.readFileSync(__dirname+'/datos-costos-bitral.json','utf8'));
DATOS.categorias=[{id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:30,prot_modo:'fijo',prot_monto:25},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:30,prot_modo:'fijo',prot_monto:25}}}];
DATOS.enFabricacion=[7];
const bit=DATOS.catalogo[0];
DATOS.catalogo.push(Object.assign({},bit,{id:8,nombre:'Modelo lineal',especificaciones_base:{}}));
const m1=DATOS.modelos[0];
m1.extras=[{id:11,n:'Marco decorativo',v:0,piezas:[],ofrecer:true,sin_cortes:false,mano:null}];
DATOS.modelos.push(Object.assign({},m1,{id:2,catalogo_id:8,codigo:'M-02',extras:[{id:21,n:'Protección',v:0,piezas:[[3,4,200],[3,2,100]],ofrecer:true,sin_cortes:false,mano:null}]}));
DATOS.extrasPendientes=[{catalogo_id:7,nombre:'Modelo bitral',extra:'Marco decorativo',k:'marco_decorativo',n:2}];
const isoL=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const sab=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));return isoL(d);})();
const PERF={u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true},t1:{id:'t1',usuario:'jesus',nombre:'Jesus',rol:'trabajador',activo:true,especialidades:['herrero']}};
function corte(){return {aluminio:0,planes:{},pasos:[
  {eid:900,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:1,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false,esp:{proteccion:true}},
  {eid:901,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:2,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false,esp:{marco_decorativo:true}}]};}
async function pagina(b,uid,err){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});const rpcs=[];const C=corte();
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='costos_datos')return j(DATOS);
      if(name==='corte_datos')return j(C);
      if(name==='corte_plan_guardar'){C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{},extras_mano:(C.planes[a.p_sab]||{}).extras_mano||[]},a.p);return j({sab:a.p_sab});}
      if(name==='costeo_guardar')return j({id:a.p.id||1});
      if(name==='finanzas_avisos')return j({extras_sin_costear:DATOS.extrasPendientes});
      if(name==='extras_precios')return j({'7':{manillon:16,proteccion:81}});
      if(name==='mis_trabajos')return j([]);
      if(name==='mis_pagos')return j({});
      if(name==='mi_hoja_corte')return j([{sab,cortado:false,barras:[{mid:3,material:'Tubo 1" x 1"',tipo:'barra',n:1,largo:600,libre:300,piezas:[{cm:150,etq:'N° 1200 (1 de 2)'},{cm:150,etq:'N° 1200 (1 de 2)'}]}],pasar:[],manual:[],extras_mano:[{eid:901,k:'marco_decorativo',extra:'Marco decorativo',etq:'N° 1200 (2 de 2) · Modelo bitral',tid:'t1'}]}]);
      return j({});}
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF[uid]); return j([{usuario:PERF[uid].usuario,nombre:PERF[uid].nombre,rol:PERF[uid].rol,orden:1}]);}
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(900);
  return {p,rpcs,C};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  const {p,rpcs,C}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  // ===== Inicio
  ok('Inicio: aviso de extras vendidos sin costear',(await p.textContent('body')).includes('Hay 2 extras vendidos sin costear'));
  // ===== Costos: grupo y formulario
  await p.goto(H+'costos.html');await p.waitForSelector('[data-extra-pend="7"]');await w();
  let s=await p.textContent('#cont');
  ok('Costos: grupo Extras vendidos sin costear',s.includes('Extras vendidos sin costear')&&s.includes('Marco decorativo del Modelo bitral')&&s.includes('vendido en 2 puertas'));
  await p.screenshot({path:'shots4/t49-1-pendientes.png'});
  await p.click('[data-extra-pend="7"]');await p.waitForSelector('#sheetForm.open');await w();
  s=await p.textContent('#formBody');
  ok('Cargar cortes abre el marco decorativo del Bitral sin cortes',s.includes('Sin cortes todavía')&&s.includes('Falta')&&s.includes('cortes'));
  ok('La ficha avisa que se vendieron sin cortes',(await p.textContent('#fichaBody')).includes('Se vendieron 2 con marco decorativo'));
  await p.click('#sheetForm [data-cerrar="sheetForm"]');await w(500);
  // Protección nueva: copiar de otro modelo, + pieza, mano de la categoría
  await p.click('#fichaBody [data-extra="nuevo"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('[data-f-kind="Protección"]');await w();
  ok('Protección: mano de obra de la categoría ($25 + $25)',(await p.textContent('#cajaExtra')).includes('Hierro de la protección $25')&&(await p.textContent('#cajaExtra')).includes('Masilla y pintura de la protección $25'),await p.textContent('#cajaExtra'));
  await p.click('[data-fx-sub="copiar"]');await w();
  ok('Copiar de otro modelo: sale el Modelo lineal',(await p.textContent('#formBody')).includes('Modelo lineal'));
  await p.click('[data-fx-de="8"]');await w();
  ok('Cortes copiados (2 filas)',(await p.$$('#formBody .pzr')).length===2);
  const cj=await p.textContent('#cajaExtra');
  const esp=await p.evaluate(()=>{const D=COSTEO.datos();return COSTEO.costearExtra(D.costeo[7],D.catalogo[0],{n:'Protección',piezas:[[3,4,200],[3,2,100]],sin_cortes:false,mano:null},D.prov);});
  ok('Costo de la protección: cortes por metro + $50 de mano de obra',esp.listo&&Math.abs(esp.costo-(esp.lineas[0].v+50))<0.02&&cj.includes('Cuesta $'+esp.costo.toFixed(2)),[esp.costo,cj]);
  await p.click('[data-fx-pz="nueva"]');await w();
  await p.fill('#fCant','2');await p.fill('#fCm','50');await p.click('#btnForm');await w();
  ok('+ Pieza agrega el corte al extra',(await p.$$('#formBody .pzr')).length===3);
  await p.screenshot({path:'shots4/t49-3-extra.png'});
  await p.click('#btnForm');await w(900);
  let g=ultimo(rpcs,'costeo_guardar');
  const pr=g&&g.p.extras.find(e=>e.n==='Protección');
  ok('Guardar: la protección va con sus cortes, ofrecida y mano de la categoría',pr&&JSON.stringify(pr.piezas)==='[[3,4,200],[3,2,100],[3,2,50]]'&&pr.ofrecer===true&&pr.mano===null&&pr.sin_cortes===false&&g.p.extras.length===2,g&&g.p.extras);
  // Manillón: sin cortes, solo su costo, oculto
  await p.click('#fichaBody [data-extra="nuevo"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('[data-f-kind="Manillón"]');await w();
  ok('Manillón: sin cortes, pide cuánto cuesta',!!(await p.$('#fV'))&&!(await p.$('[data-fx-pz]')));
  await p.click('[data-fx-ofr="no"]');await w();
  await p.click('#btnForm');await w(300);
  ok('Manillón sin costo no se guarda',await p.$eval('#c_fV',x=>x.classList.contains('invalid')));
  await p.fill('#fV','12');await p.click('#btnForm');await w(900);
  g=ultimo(rpcs,'costeo_guardar');const mn=g.p.extras.find(e=>e.n==='Manillón');
  ok('Guardar manillón oculto con su costo',mn&&mn.v===12&&mn.sin_cortes===true&&mn.ofrecer===false&&mn.piezas.length===0,mn);
  // Otro extra con mano de obra propia
  await p.click('#fichaBody [data-extra="nuevo"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('[data-f-kind="Yeso"]');await w();
  await p.fill('#fMano','x');await p.click('#btnForm');await w(300);
  ok('Mano de obra mal escrita se marca',await p.$eval('#c_fMano',x=>x.classList.contains('invalid')));
  await p.click('#sheetForm [data-cerrar="sheetForm"]');await w(500);
  // Protección incluida si el Catálogo la trae tildada
  const inc=await p.evaluate(()=>{const D=COSTEO.datos(),c=D.catalogo.find(x=>x.id===7),a=COSTEO.costear(7).costo;c.especificaciones_base=Object.assign({},c.especificaciones_base,{proteccion:true});
    const x1=COSTEO.costear(7);D.costeo[7].extras.push({n:'Protección',v:0,piezas:[[3,4,200]],ofrecer:true,sin_cortes:false,mano:null});const x2=COSTEO.costear(7);
    D.costeo[7].extras.pop();c.especificaciones_base=Object.assign({},c.especificaciones_base);delete c.especificaciones_base.proteccion;
    return {a,f1:x1.falta,c2:x2.costo,l:x2.lineas.filter(l=>l.g==='Extras incluidos'),ex:x2.extras.find(e=>e.n==='Protección').costo};});
  ok('Catálogo con protección tildada y sin cortes: falta cortes de la protección',inc.f1.includes('cortes de la protección'),inc.f1);
  ok('Con sus cortes: va incluida en el costo del modelo',inc.l.length===1&&Math.abs(inc.c2-(inc.a+inc.ex))<0.02,inc);
  // ===== Plan de corte: Bitral con protección (con cortes) y marco decorativo (sin cortes)
  m1.extras=[{id:11,n:'Marco decorativo',v:0,piezas:[],ofrecer:true,sin_cortes:false,mano:null},{id:12,n:'Protección',v:0,piezas:[[3,2,150]],ofrecer:true,sin_cortes:false,mano:null}];
  m1.actualizado_en='2026-11-08T10:00:00';
  await p.goto(H+'costos.html?tab=semana');await p.waitForSelector('[data-cmat="1"]');await w();
  s=await p.textContent('#cont');
  ok('Plan: los cortes de la protección entran (Tubo 1" x 1")',!!(await p.$('[data-cmat="3"]')));
  const P=await p.evaluate(()=>{const P=CORTE.planSemana(CORTE.sab);return {ext:P.asign.map(u=>u.ext.map(e=>e.n)),falta:P.asign.map(u=>u.extFalta.map(x=>x.k)),f:P.firma};});
  ok('Solo la unidad que pidió protección la lleva',JSON.stringify(P.ext)==='[["Protección"],[]]'&&JSON.stringify(P.falta)==='[[],["marco_decorativo"]]'&&P.f.includes('+proteccion'),P);
  ok('Aviso: Marco decorativo del N° 1200 (2 de 2) sin cortes',s.includes('Marco decorativo del N° 1200 (2 de 2) sin cortes: no entra al plan.'));
  ok('Cargar cortes va al extra del modelo',!!(await p.$('a[href*="modelo=7&extra=marco_decorativo&volver=semana"]')));
  await p.screenshot({path:'shots4/t49-2-plan.png'});
  await p.click('[data-extra-mano="901"]');await w(900);
  g=ultimo(rpcs,'corte_plan_guardar');
  ok('Cortar a mano guarda el extra para la hoja de Jesus',g&&JSON.stringify(g.p.extras_mano)===JSON.stringify([{eid:901,k:'marco_decorativo',extra:'Marco decorativo',etq:'N° 1200 (2 de 2) · Modelo bitral',tid:'t1'}]),g&&g.p.extras_mano);
  s=await p.textContent('#cont');
  ok('Después: Jesus lo corta a mano esta semana',s.includes('Jesus lo corta a mano esta semana')&&!(await p.$('[data-extra-mano="901"]')));
  await p.click('[data-hoja-h="t1"]');await p.waitForSelector('#sheetDet.open');await w();
  ok('Hoja del herrero: Marco decorativo, córtalo como siempre',(await p.textContent('#detBody')).includes('Marco decorativo: no tiene plan. Córtalo como siempre.'));
  // ===== Venta: el manillón toma el precio de Costos
  await p.goto(H+'venta.html');await w(1500);
  const mp=await p.evaluate(()=>{try{return SpecsProducto.calcular({tipo:'Puerta Multilock',estado:{manillon:'Recto'}},{id:7,precio_base:320,especificaciones_base:{}}).texto;}catch(e){return 'ERR '+e.message;}});
  ok('Venta: manillón con el precio de Costos ($16)',mp.includes('manillón $16'),mp);
  // ===== Herrero: Mi trabajo
  const h=await pagina(b,'t1',err);
  await h.p.waitForSelector('.tj-corte',{timeout:8000}).catch(()=>{});
  const th=await h.p.textContent('#vistaTrabajo').catch(()=>'');
  ok('Mi trabajo: el extra sin plan sale como "córtalo como siempre"',th.includes('N° 1200 (2 de 2) · Modelo bitral')&&th.includes('Marco decorativo: no tiene plan. Córtalo como siempre.'));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
