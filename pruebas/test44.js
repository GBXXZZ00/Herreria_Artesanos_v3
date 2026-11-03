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
  ok('Modelos: el Bitral en fabricación, listo, cuesta $223.22',(await p.textContent('#cont')).includes('cuesta $223.22'));
  await p.click('[data-modelo="7"]');await p.waitForSelector('#sheetDet.open');await w();
  const t=await p.textContent('#detBody');
  ok('DATO DE CONTROL: costo $223.22 · con ganancia $290.19 · sugerido $326.79',t.includes('$223.22')&&t.includes('$290.19')&&t.includes('$326.79'),t.match(/\$[\d,.]+/g).slice(0,8));
  ok('Con cada proveedor: Colores y Torniplemaca lado a lado',t.includes('Con cada proveedor')&&t.includes('Torniplemaca'));
  await p.screenshot({path:'shots4/t44-1-ficha.png'});
  await p.click('#detBody [data-modo="tubo"]');await w();
  ok('DATO DE CONTROL: barra completa $339.23',(await p.textContent('#detBody')).includes('$339.23'));
  await p.click('#detBody [data-modo="metro"]');await w();
  await p.click('#detBody [data-prov="2"]');await w();
  ok('Precios de Torniplemaca: avisa lo que no vende',(await p.textContent('#detBody')).includes('no vende'));
  await p.click('#detBody [data-prov="1"]');await w();
  await p.click('#detBody [data-pieza="nueva"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#btnForm');await w(200);
  ok('Pieza sin medida marca el campo',await p.$eval('#c_fCm',x=>x.classList.contains('invalid')));
  await p.fill('#fCm','150');await p.fill('#fNota','Travesaño');await p.click('#btnForm');await w(800);
  const cg=ultimo(rpcs,'costeo_guardar');
  ok('Agregar pieza guarda el costeo completo',cg&&cg.p.catalogo_id===7&&cg.p.piezas.length===8&&cg.p.piezas[7][2]===150,cg&&cg.p.piezas.length);
  await p.evaluate(()=>{document.querySelectorAll('.sheet.open').forEach(s=>s.classList.remove('open'));document.querySelectorAll('.sheet-scrim').forEach(s=>s.classList.remove('open'));});
  // Ganancia
  await p.click('#tabs [data-tab="ganancia"]');await w();
  const g=await p.textContent('#cont');
  ok('Ganancia: $915 ÷ 25 puertas = $36.60 por puerta',g.includes('$915')&&g.includes('$36.60'));
  // Precios
  await p.click('#tabs [data-tab="materiales"]');await w();
  const pr=await p.textContent('#cont');
  ok('Precios por material: el más barato y la comparación (Torniplemaca $9.50, Colores $9.69)',pr.includes('2 proveedores')&&pr.includes('$9.50')&&pr.includes('$9.69')&&pr.includes('más caro'));
  await p.click('[data-vprecios="proveedor"]');await w();
  const pp=await p.textContent('#cont');
  ok('Precios por proveedor: lo que vende cada uno',pp.includes('Inversiones Torniplemaca')&&pp.includes('el más barato'));
  await p.click('[data-tab="modelos"]');await w();await p.click('[data-modelo="7"]');await p.waitForSelector('#sheetDet.open');await w();
  await p.click('#detBody [data-prov="barato"]');await w();
  ok('Costear con "El más barato"',(await p.textContent('#detBody')).includes('El más barato de cada material'));
  await p.evaluate(()=>{document.querySelectorAll('.sheet.open').forEach(s=>s.classList.toggle('open',false));document.querySelectorAll('.sheet-scrim').forEach(s=>s.classList.toggle('open',false));});
  // Semana
  await p.click('#tabs [data-tab="semana"]');await w(600);
  const s=await p.textContent('#cont');
  ok('Semana: 2 puertas de Jesus del sábado, la sin asignar aparte',s.includes('Jesus')&&s.includes('Puertas para cortar')&&s.includes('Sin asignar en Producción')&&s.includes('N° 1201'));
  ok('Usa primero el retazo de 120 cm del depósito',s.includes('Retazo de 120 cm del depósito'));
  ok('Dice qué comprar con IVA',s.includes('Qué comprar')&&s.includes('hay que comprarla'));
  await p.screenshot({path:'shots4/t44-2-semana.png',fullPage:false});
  await p.click('[data-aceptar]');await w(800);
  const ac=ultimo(rpcs,'corte_plan_guardar');
  ok('Aceptar plan guarda las barras con quién corta',ac&&ac.p.aceptado===true&&ac.p.barras.length>0&&ac.p.barras.every(x=>x.tid==='t1'),ac&&ac.p.barras.length);
  ok('Después de aceptar: "Jesus ya cortó"',!!(await p.$('[data-ya-corto="t1"]')));
  await p.click('[data-ya-corto="t1"]');await w(600);
  ok('Ya cortó llama a corte_ya_corto',JSON.stringify(ultimo(rpcs,'corte_ya_corto'))===JSON.stringify({p_sab:sab,tid:'t1'}));
  await p.click('[data-pdf-compra]');await w(2500);
  ok('Plan de compra en PDF',(await p.evaluate(()=>window.__share)||[''])[0].startsWith('Plan-de-compra-'));
  // ===== Herrero: hoja de corte en Mi trabajo =====
  const h=await pagina(b,'t1',err);
  await h.p.waitForSelector('.tj-corte',{timeout:8000}).catch(()=>{});
  const th=await h.p.textContent('#vistaTrabajo').catch(()=>'');
  ok('Mi trabajo: el herrero ve su hoja de corte con el retazo a guardar',th.includes('Tu hoja de corte')&&th.includes('Guarda el retazo de 112'));
  await h.p.screenshot({path:'shots4/t44-3-hoja-herrero.png'});
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
