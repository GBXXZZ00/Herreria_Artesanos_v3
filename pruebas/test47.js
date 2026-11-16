// test47 (reestructura lote 2, al día con el lote 8): el motor del plan de corte con dos Bitral, ahora desde
// Taller › Corte (el Costeador ya no tiene Plan de corte). Necesitas · hay · comprar en metros, vidrio como lista de
// piezas cortadas, lámina acomodada en la hoja, retazo R-12 del Depósito primero, y el drawer del herrero con TALLER,
// R-12 y NUEVA. Retazo encontrado, mover piezas y corregir se prueban en test53 y test54. (arnés de test44)
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
  const {p}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'taller.html?vista=corte');await p.waitForSelector('#vCorte .nm-row');await w(600);
  const R=await p.evaluate((s)=>{const C=window.CORTE;C.setSab(s);const P=C.planSemana(s);const m=P.compras.find(x=>String(x.f.id)==='1');const v=P.hj.find(x=>x.vidrio);
    return {cm:m&&Math.round(m.cm),stock:m&&m.f.stock,rets:m&&(m.f.retazos||[]).length,comprar:m&&m.comprar,vidrio:v&&v.piezas,lista:v?v.lista.map(l=>l.n+' de '+l.k):[],lam:P.hj.filter(x=>!x.vidrio).map(x=>(x.acom||[]).length),
      primera:(P.barras.find(x=>String(x.mid)==='1'&&x.tipo==='retazo')||{}).num,herreros:P.herreros.map(h=>h.nombre+':'+h.unidades.length),nComprar:P.nComprar};},sab);
  ok('Paso 1: Jesus corta 2 puertas del N° 1200',R.herreros.join()==='Jesus:2',R.herreros);
  ok('Tubo 1" x 3": necesitas 11,52 m · hay 1 barra + 1 retazo · comprar 1',R.cm===1152&&R.stock===1&&R.rets===1&&R.comprar===1,R);
  ok('Vidrio se compra cortado: 12 piezas (2 de 184 × 10 y 10 de 50 × 4)',R.vidrio===12&&R.lista.includes('2 de 184 × 10')&&R.lista.includes('10 de 50 × 4'),R.lista);
  ok('Lámina acomodada en la hoja',R.lam.length>0&&R.lam.every(n=>n>0),R.lam);
  ok('El retazo R-12 del Depósito se usa primero',R.primera===12,R.primera);
  ok('Dice cuántas barras y hojas comprar',R.nComprar>0,R.nComprar);
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(500);
  const t=await p.textContent('#ckBody');
  ok('Drawer de Jesus: de dónde sale el material con TALLER, R-12 y NUEVA',t.includes('TALLER')&&t.includes('R-12')&&t.includes('NUEVA'),t.slice(0,160));
  await p.screenshot({path:'shots4/t47-1-plan.png'});
  ok('Sin errores de JavaScript',!err.length,err);
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
