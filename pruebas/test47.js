// test47 (reestructura lote 2): Plan de corte en 3 pasos con dos Bitral. Necesitas · hay · comprar en metros,
// vidrio como lista de piezas cortadas, lámina dibujada en la hoja, retazo usar / no usar, retazo encontrado,
// marcar a mano y Corregir corte (cuadra el Depósito). (arnés de test44)
// test44 (v73, lotes 6, 7 y 9): Costos. Bitral (catálogo id 7) con los datos reales de la Memoria central:
// costo $223,22 · con ganancia $290,19 · sugerido $326,79 · barra completa $339,23. Precio con cada proveedor,
// agregar una pieza, Ganancia (gastos fijos $915 ÷ 25 = $36,60), Precios por proveedor, plan de corte del sábado
// (retazo primero, barras a comprar, aceptar, ya cortó), hoja de corte en Mi trabajo, la vendedora no ve Costos.
// Datos: pruebas/datos-costos-bitral.json (salida de costos_datos() con las migraciones v78 y v78b).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const DATOS=JSON.parse(fs.readFileSync(__dirname+'/datos-costos-bitral.json','utf8'));
DATOS.categorias=[{id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:30},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:30}}}];
DATOS.enFabricacion=[7];
DATOS.fab.forEach(f=>(f.retazos||[]).forEach(r=>{r.num=r.num||12;}));
const isoL=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const sab=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));return isoL(d);})();
const PERF={u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true},u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,confirma_abonos:false},t1:{id:'t1',usuario:'jesus',nombre:'Jesus',rol:'trabajador',activo:true,especialidades:['herrero']}};
function corte(){return {aluminio:0,planes:{},pasos:[
  {eid:900,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:1,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:901,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:2,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:902,venta:1201,interna:false,cliente:'Luis Paz',entrega:sab,mid:4,nombre:'Lineal Economico',tipo:'Puerta Multilock',unidad:1,de:1,tid:null,herrero:null,para:null,precio:200,cortado:false}]};}
async function pagina(b,uid,err){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});const rpcs=[];const C=corte();
  await ctx.addInitScript(()=>{window.__share=null;navigator.canShare=()=>true;navigator.share=async(d)=>{window.__share=d.files.map(f=>f.name);};});
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='costos_datos')return PERF[uid].confirma_abonos?j(DATOS):j({message:'Costos es solo para Ray o Gualfredo'},400);
      if(name==='corte_datos')return j(C);
      if(name==='corte_plan_guardar'){C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{}},a.p);return j({sab:a.p_sab});}
      if(name==='retazo_agregar'){DATOS.fab.find(f=>f.id===a.mid).retazos.push({id:88,largo:a.p_largo,num:20});return j({id:88});}
      if(name==='corte_corregir')return j({ok:true});
      if(name==='corte_ya_corto'){Object.assign(C.planes[a.p_sab],{entregado:{[a.tid]:true},cerrado:true,nuevos:[{id:77,mid:1,cm:136,num:13}]});return j({cerrado:true});}
      if(name==='costeo_guardar')return j({id:1});
      if(name==='mis_trabajos')return j([]);
      if(name==='mis_pagos')return j({});
      if(name==='mi_hoja_corte')return j([{sab,cortado:false,barras:[{mid:1,material:'Tubo 1" x 3"',tipo:'barra',n:1,largo:600,libre:112,piezas:[{cm:200,etq:'N° 1200 (1 de 2)'},{cm:200,etq:'N° 1200 (2 de 2)'},{cm:88,etq:'N° 1200 (1 de 2)'}]}],pasar:[],manual:[]}]);
      return j({});}
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF[uid]); return j([{usuario:PERF[uid].usuario,nombre:PERF[uid].nombre,rol:PERF[uid].rol,orden:1}]);}
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(600);
  return {p,rpcs,C};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  const {p,rpcs,C}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'costos.html?tab=semana');await p.waitForSelector('[data-cmat="1"]');await w();
  const s=await p.textContent('#cont');
  ok('Paso 1: N° 1200 · Modelo bitral × 2, corta Jesus, 2 puertas',s.includes('N° 1200 · Modelo bitral × 2')&&s.includes('corta Jesus')&&s.includes('2 puertas'));
  const fila=await p.textContent('[data-cmat="1"]');
  ok('Paso 2: Tubo 1" x 3" necesitas 11,52 m · hay 1 barra + 1 retazo · comprar 1',fila.includes('11,52 m')&&fila.includes('1 barra + 1 retazo')&&fila.trim().endsWith('1'),fila);
  ok('Vidrio se compra cortado: 12 piezas',(await p.textContent('[data-cmat="11"]')).includes('12 piezas')&&(await p.textContent('[data-cmat="11"]')).includes('cortado'));
  ok('Paso 3 dice cuántas barras y hojas comprar',/Comprar lo que falta\s*\d+ barras/.test(s));
  await p.screenshot({path:'shots4/t47-1-plan.png'});
  // Material: barras dibujadas y retazos
  await p.click('[data-cmat="1"]');await p.waitForSelector('#sheetForm.open');await w();
  let fm=await p.textContent('#formBody');
  ok('Barras dibujadas: retazo R-12 del Depósito usado primero',fm.includes('Retazo R-12 · 1,20 m')&&fm.includes('se usa en el plan')&&(await p.$$('#formBody .barra-btn')).length===3);
  await p.screenshot({path:'shots4/t47-2-material.png'});
  await p.click('#formBody [data-f-ret="5"]');await w(900);
  const g1=ultimo(rpcs,'corte_plan_guardar');
  ok('No usar R-12: se guarda sin ese retazo y con no_usar',g1&&JSON.stringify(g1.p.no_usar)==='[5]'&&!g1.p.barras.some(x=>x.tipo==='retazo')&&g1.p.ajustado===true,g1&&g1.p.no_usar);
  fm=await p.textContent('#formBody');
  ok('La hoja sigue abierta y dice "no se usa"',fm.includes('no se usa'));
  await p.click('#formBody [data-f-ret="5"]');await w(900);
  ok('Usar de nuevo R-12',JSON.stringify(ultimo(rpcs,'corte_plan_guardar').p.no_usar)==='[]'&&ultimo(rpcs,'corte_plan_guardar').p.barras.some(x=>x.tipo==='retazo'&&x.rid===5));
  await p.click('#formBody [data-f-nuevoret]');await w();
  await p.fill('#fRetCm','5');await p.click('#btnForm');await w(300);
  ok('Retazo encontrado: medida mala marca el campo',await p.$eval('#c_fRetCm',x=>x.classList.contains('invalid')));
  await p.fill('#fRetCm','150');await p.click('#btnForm');await w(1200);
  ok('+ Retazo que encontré lo guarda en el Depósito',JSON.stringify(ultimo(rpcs,'retazo_agregar'))===JSON.stringify({mid:1,p_largo:150,p_ancho:null}));
  // Tocar una barra
  await p.click('#formBody .barra-btn');await w();
  ok('Tocar una barra: quién la corta y mover piezas',(await p.textContent('#formBody')).includes('¿Quién la corta?'));
  await p.click('#sheetForm [data-cerrar="sheetForm"]');await w(500);
  // Lámina dibujada en la hoja, vidrio como lista
  await p.click('[data-cmat="9"]');await p.waitForSelector('#sheetForm.open');await w();
  ok('Lámina acomodada en la hoja y dibujada',(await p.$$('#formBody .pc-hoja span')).length===2);
  await p.click('#sheetForm [data-cerrar="sheetForm"]');await w(500);
  await p.click('[data-cmat="11"]');await p.waitForSelector('#sheetForm.open');await w();
  const fv=await p.textContent('#formBody');
  ok('Vidrio: lista de piezas (2 de 184 × 10 y 10 de 50 × 4)',fv.includes('184 × 10 cm')&&fv.includes('2 piezas')&&fv.includes('50 × 4 cm')&&fv.includes('10 piezas'));
  await p.click('#sheetForm [data-cerrar="sheetForm"]');await w(500);
  // Aceptar y marcar a mano; después corregir
  await p.click('[data-aceptar]');await w(900);
  await p.click('[data-ya-corto="t1"]');await w(1000);
  ok('Marcar a mano llama a corte_ya_corto',!!ultimo(rpcs,'corte_ya_corto'));
  ok('Plan cerrado: dice que las barras bajaron',(await p.textContent('#cont')).includes('Cortes de este sábado hechos'));
  await p.click('[data-cmat="1"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#formBody [data-f-corregir]');await w();
  ok('Corregir corte: trae lo del plan (barras y el retazo R-13 que quedó)',(await p.inputValue('#fCB'))==='2'&&(await p.inputValue('#fQ_0'))==='136',[await p.inputValue('#fCB'),await p.inputValue('#fQ_0')]);
  await p.click('#btnForm');await w(300);
  ok('Sin motivo no guarda',await p.$eval('#c_fMot',x=>x.classList.contains('invalid')));
  await p.fill('#fCB','3');await p.click('#formBody [data-f-masq]');await w();await p.fill('#fQ_1','90');
  await p.click('#formBody [data-f-usado="5"]');await w();
  await p.fill('#fMot','Se dañó una barra');await p.screenshot({path:'shots4/t47-3-corregir.png'});
  await p.click('#btnForm');await w(900);
  ok('Corregir corte manda lo de verdad con motivo (R-12 no se usó; el R-20 nuevo sí)',JSON.stringify(ultimo(rpcs,'corte_corregir'))===JSON.stringify({p_sab:sab,p:{material_id:1,barras:3,usados:[88],quedaron:[136,90],motivo:'Se dañó una barra'}}),ultimo(rpcs,'corte_corregir'));
  ok('Sin errores de JavaScript',err.length===0,err);
 }catch(e){ ok('CORTE: '+e.message.split('\n')[0],false); }
 await b.close(); res.forEach(r=>console.log(r)); console.log(fallas?('FALLAS: '+fallas):'TODO OK'); process.exit(fallas?1:0);
})();
