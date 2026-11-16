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
      if(name==='corte_plan_guardar'){C.planes[a.p_sab]=Object.assign({entregado:{},manual:{}},a.p);return j({sab:a.p_sab});}
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
  // ===== Vendedora =====
  const v=await pagina(b,'u3',err);
  await v.p.goto(H+'costos.html');await v.p.waitForTimeout(1200);
  ok('Vendedora: Costos solo para Ray o Gualfredo',(await v.p.textContent('#cont')).includes('solo para Ray o Gualfredo')&&!v.rpcs.some(r=>r[0]==='costos_datos'));
  // ===== Ray =====
  const {p,rpcs,C}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'costos.html');await p.waitForSelector('[data-modelo="7"]');await w();
  const l0=await p.textContent('#cont');
  ok('Modelos: el Bitral en fabricación, en Listos, sugerido $326.79',l0.includes('Listos')&&l0.includes('$326.79')&&l0.includes('en fabricación'));
  await p.click('[data-modelo="7"]');await p.waitForSelector('#sheetFicha.open');await w();
  const fp=await p.textContent('#fichaFoot');
  ok('Franja abajo: precio sugerido $326.79, "$6.79 abajo" y catálogo $320',fp.includes('$326.79')&&fp.includes('$6.79 abajo')&&fp.includes('catálogo $320'),fp);
  const ci=await p.textContent('#fiIdx');
  ok('Chips con subtotales: Cortes $39.69 · Vidrio $4.09 · Obra $65',ci.includes('Cortes $39.69')&&ci.includes('Vidrio $4.09')&&ci.includes('Obra $65'),ci);
  const filas=await p.$$eval('#fichaBody .pzf',x=>x.map(f=>[...f.querySelectorAll('input')].map(i=>i.value).join('|')));
  ok('Cortes escritos en la fila (cant × cm × nota)',filas.length===7&&filas.some(f=>f.startsWith('2|200'))&&filas.some(f=>f.startsWith('2|88')),filas);
  ok('Encabezado del perfil en metros, barras y sobra',/\d,\d\d m \/ \d barras? \/ sobra/.test(await p.textContent('#fichaBody .pf-s')));
  ok('Lo demás en acordeones cerrados',(await p.$$('#fichaBody .fi-acc')).length===6&&!(await p.$('#fichaBody .fi-acc.on')));
  await p.click('#fichaFoot [data-franja]');await w();
  const t=await p.textContent('#fichaFoot');
  ok('DATO DE CONTROL: costo $223.22 · con ganancia $290.19 · sugerido $326.79',t.includes('$223.22')&&t.includes('$290.19')&&t.includes('$326.79'),t.match(/\$[\d,.]+/g).slice(0,8));
  ok('Gastos fijos: $915 ÷ 25 puertas = $36.60 por puerta',t.includes('$915')&&t.includes('$36.60'));
  ok('La franja se abre en el mismo lugar con el botón Catálogo: $320 → $326.79',t.includes('Catálogo: $320 → $326.79')&&!(await p.$('#sheetForm.open')));
  await p.screenshot({path:'shots4/t44-1-ficha.png'});
  await p.click('#fichaFoot [data-fmodo="tubo"]');await w();
  ok('DATO DE CONTROL: barra completa $339.23',(await p.textContent('#fichaFoot')).includes('$339.23'));
  await p.click('#fichaFoot [data-fmodo="metro"]');await w();
  await p.click('#fichaFoot [data-fprov="2"]');await w();
  ok('Precios de Torniplemaca: avisa lo que no vende',(await p.textContent('#fichaFoot')).includes('no vende'));
  await p.click('#fichaFoot [data-fprov="1"]');await w();
  await p.click('#fichaFoot .fr-panel [data-franja]');await w();
  // Registrar una pieza (R2): + pieza, escribir cantidad y cm, la franja cambia al instante, 3D plegado, Guardar
  await p.click('#fichaBody [data-pz-mas="1"]');await w(300);
  ok('+ pieza agrega una fila vacía con el foco en la cantidad',await p.evaluate(()=>document.activeElement&&document.activeElement.dataset.pz==='7:n'));
  await p.fill('[data-pz="7:n"]','1');await p.fill('[data-pz="7:cm"]','150');await p.fill('[data-pz="7:nota"]','Travesaño de abajo');await w(200);
  const f2=await p.textContent('#fichaFoot');
  ok('Al escribir, el precio cambia al instante y sale Guardar cambios',!f2.includes('$326.79')&&!!(await p.$('[data-guardar-cortes]')),f2.slice(0,80));
  await p.click('[data-pz3d="7"]');await w(150);await p.click('[data-pzque="Travesaño"]');await w(150);await p.click('[data-pzori="H"]');await w(150);
  const v6=await p.inputValue('[data-pz="6:cm"]');
  await p.fill('[data-pz="6:cm"]','');await w(100);await p.click('[data-guardar-cortes]');await w(300);
  ok('Una fila sin medida no se guarda',!ultimo(rpcs,'costeo_guardar'));
  await p.fill('[data-pz="6:cm"]',v6);await w(100);
  await p.click('[data-guardar-cortes]');await w(800);
  const cg=ultimo(rpcs,'costeo_guardar');
  ok('Guardar manda el costeo completo con la pieza nueva, qué es y H',cg&&cg.p.catalogo_id===7&&cg.p.piezas.length===8&&cg.p.piezas[7][2]===150&&cg.p.piezas[7][3]==='Travesaño de abajo'&&cg.p.piezas[7][4]==='Travesaño'&&cg.p.piezas[7][5]==='H',cg&&cg.p.piezas[7]);
  await p.click('[data-salir-ficha]');await w(500);
  // Precios (C4): tabla material × proveedor, el más barato en verde, un solo Guardar
  await p.click('#tabs [data-tab="materiales"]');await w();
  const cab=await p.$$eval('#cont .pre thead th',x=>x.map(t=>t.textContent));
  ok('Precios: tabla Material · Colores y Ambiente · Torniplemaca',cab.join('|')==='Material|Colores y Ambiente|Torniplemaca',cab);
  ok('Tubo 1" x 2": Colores 9.69 y Torniplemaca 9.50, el más barato en verde',(await p.inputValue('[data-pre="f:2:1"]'))==='9.69'&&(await p.inputValue('[data-pre="f:2:2"]'))==='9.50'&&await p.$eval('[data-pre="f:2:2"]',x=>x.classList.contains('barato')));
  ok('Sin cambios no hay botón de guardar',await p.$eval('#prePie',x=>x.classList.contains('hidden')));
  await p.fill('[data-pre="f:2:1"]','9.40');await w(150);
  ok('Al escribir: Guardar precios (1 cambio) y el verde pasa a Colores',(await p.textContent('#prePie')).includes('Guardar precios (1 cambio)')&&await p.$eval('[data-pre="f:2:1"]',x=>x.classList.contains('barato')));
  await p.screenshot({path:'shots4/t44-2-precios.png'});
  await p.click('[data-guardar-precios]');await w(800);
  ok('Guardar precios: material_precio_guardar con el precio nuevo',JSON.stringify(ultimo(rpcs,'material_precio_guardar'))===JSON.stringify({p:{material_id:2,proveedor_id:1,precio:9.4,espesor:'0,90 mm'}}),ultimo(rpcs,'material_precio_guardar'));
  await p.click('#filtrosL [data-filp="Accesorios"]');await w();
  ok('Herrajes: un solo precio por herraje',(await p.$$eval('#cont .pre thead th',x=>x.length))===2&&(await p.$$('#cont [data-pre^="i:"]')).length>0);
  // El plan de corte y la hoja del herrero se prueban en Taller › Corte (test47 y test53)
  ok('El Costeador ya no tiene la pestaña Plan de corte',!(await p.$('#tabs [data-tab="semana"]')));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
