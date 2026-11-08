// test48 (reestructura lotes 3, 4 y 5): Comprar lo que falta desde el plan (Más barato divide por proveedor,
// Todo en un proveedor, + Gasto), compra pedida en amarillo (plan, "+1 en camino"), ¿Llegó? con factura, total del
// papel que cuadra, Saqué dinero con vuelto y motivo, y No llegó con motivo. (arnés de test44)
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
const CAMINO={grupos:[],proveedores:[{id:1,nombre:'Colores y Ambiente',tipos:['hierro','laminas'],iva:true,saldo:0},{id:2,nombre:'Inversiones Torniplemaca',tipos:['hierro','laminas'],iva:false,saldo:-1674.5},{id:3,nombre:'Sin factura (ferretería y otros)',tipos:['vidrio','consumibles'],iva:false,saldo:0}],
  cuentas:[{id:1,nombre:'Zelle de Ray',moneda:'USD',saldo:2450},{id:2,nombre:'Bolívares',moneda:'VES',saldo:100}],consumibles:[{id:1,nombre:'Electrodos (kg)'}],
  fab:DATOS.fab.map(f=>({id:f.id,nombre:f.nombre,tipo:f.tipo,pres:f.pres,stock:f.stock,precios:Object.fromEntries(Object.entries(f.precios||{}).map(([k,v])=>[k,v.p]))}))};
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
      if(name==='compras_en_camino')return j(CAMINO);
      if(name==='compra_pedir')return j({grupo:41,lugares:a.p.lugares.length});
      if(name==='compra_confirmar')return j({compras:1,gastado:50.16,vuelto:49,saldo_cuenta:2399});
      if(name==='compra_no_llego')return j({id:a.pid});
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
  let {p,rpcs}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'costos.html?tab=semana');await p.waitForSelector('[data-comprar]');await w();
  await p.click('[data-comprar]');await p.waitForSelector('#sheetCompra.open');await w();
  let t=await p.textContent('#compraBody');
  ok('Comprar lo que falta: saldos arriba (tienes en cuentas)',t.includes('Tienes en cuentas')&&t.includes('$2,550'),t.slice(0,120));
  ok('Más barato divide por proveedor: Colores y Torniplemaca',t.includes('Colores y Ambiente')&&t.includes('Torniplemaca'));
  ok('El vidrio va cortado y sin precio inventado (aviso)',t.includes('cortado')&&t.includes('sin precio'));
  await p.screenshot({path:'shots4/t48-1-pedir.png'});
  await p.click('#compraBody [data-cp-en="1"]');await w();
  t=await p.textContent('#compraBody');
  ok('Todo en Colores: un solo lugar',(await p.$$('#compraBody .cp-lugar')).length===1&&!t.includes('Torniplemaca · '));
  await p.click('#compraBody [data-cp-en="barato"]');await w();
  await p.click('#compraBody [data-cp-gasto]');await w();
  await p.fill('#cpGM','20');await p.click('[data-cp-gastook]');await w();
  ok('+ Gasto: Flete $20 en la compra',(await p.textContent('#compraBody')).includes('Flete'));
  await p.click('[data-cp-pedir]');await w(900);
  const cp=ultimo(rpcs,'compra_pedir');
  const col=cp&&cp.p.lugares.find(l=>l.proveedor_id===1), t3=col&&col.lineas.find(x=>x.material_id===1);
  ok('Pedir compra: lugares por proveedor, flete y el plan del sábado',cp&&cp.p.lugares.length>=2&&cp.p.plan_sab===sab&&JSON.stringify(cp.p.gastos)==='[{"categoria":"Flete","monto":20}]',cp&&cp.p.lugares.length);
  ok('Tubo 1" x 3" a Colores con el último precio $12.98',t3&&t3.cantidad===1&&t3.precio===12.98,t3);
  // En camino (amarillo)
  CAMINO.grupos=[{grupo:41,fecha:new Date().toISOString(),plan_sab:sab,total:35.06,lugares:[{id:41,proveedor_id:1,proveedor:'Colores y Ambiente',iva:true,total:15.06,lineas:[{material_id:1,cantidad:1,precio:12.98,n:'Tubo 1" x 3"',pres:'barra'}]}],gastos:[{id:42,categoria:'Flete',total:20}]}];
  await p.goto(H+'costos.html?tab=semana');await p.waitForSelector('[data-compra-llego="41"]');await w();
  ok('Plan: tarjeta amarilla "Compra pedida a Colores y Ambiente"',(await p.textContent('[data-compra-llego="41"]')).includes('Compra pedida a Colores y Ambiente'));
  const f1=await p.textContent('[data-cmat="1"]');
  ok('Plan: +1 en camino y ya no pide comprar ese tubo',f1.includes('+1 en camino')&&f1.trim().endsWith('0'),f1);
  // ¿Llegó?
  await p.click('[data-compra-llego="41"]');await p.waitForSelector('#sheetCompra.open');await w();
  ok('¿Llegó? con lo pedido en amarillo',(await p.textContent('#compraBody')).includes('por confirmar'));
  await p.fill('[data-k="l:0:0:cantidad"]','2');await p.fill('#cpNum0','A-77');await p.fill('#cpPapel0','30.11');await w();
  ok('Total del papel: cuadra con las líneas',(await p.textContent('#cpCuadra0')).includes('Cuadra'));
  await p.fill('#cpPapel0','31');await w();
  ok('Si no cuadra lo dice',(await p.textContent('#cpCuadra0')).includes('No cuadra'));
  await p.fill('#cpPapel0','30.11');
  await p.click('[data-cp-modo="saque"]');await w();await p.click('[data-cp-cuenta="1"]');await w();
  await p.fill('#cpSac','100');await w();
  ok('Saqué dinero: vuelto $49.89 que vuelve a Zelle',(await p.textContent('#cpVuelto')).includes('$49.89')&&(await p.textContent('#cpVuelto')).includes('Zelle'));
  await p.fill('#cpVR','49');await w();
  ok('Si el vuelto no cuadra lo dice',(await p.textContent('#cpVuelto')).includes('faltan $0.89'));
  await p.screenshot({path:'shots4/t48-2-llego.png'});
  await p.click('[data-cp-confirmar]');await w(500);
  ok('Sin motivo no confirma',!ultimo(rpcs,'compra_confirmar'));
  await p.fill('#cpMotV','Se perdió un billete');await p.click('[data-cp-confirmar]');await w(1000);
  const cc=ultimo(rpcs,'compra_confirmar');
  ok('Confirmar: factura, cantidad real, flete y pago con vuelto y motivo',cc&&cc.grupo_id===41&&cc.p.lugares[0].numero==='A-77'&&cc.p.lugares[0].total===30.11&&cc.p.lugares[0].lineas[0].cantidad===2&&cc.p.lugares[0].pedida_id===41
    &&JSON.stringify(cc.p.gastos)==='[{"categoria":"Flete","monto":20}]'&&cc.p.pago.modo==='saque'&&cc.p.pago.cuenta_id===1&&cc.p.pago.sacado===100&&cc.p.pago.vuelto===49&&cc.p.pago.motivo==='Se perdió un billete',cc);
  // No llegó
  await p.click('[data-compra-llego="41"]');await p.waitForSelector('#sheetCompra.open');await w();
  await p.click('[data-cp-nollego="0"]');await w();await p.click('[data-cp-anular="0"]');await w(400);
  ok('No llegó sin motivo no anula',!ultimo(rpcs,'compra_no_llego'));
  await p.fill('#cpMot0','El proveedor no tenía');await p.click('[data-cp-anular="0"]');await w(900);
  ok('No llegó con motivo',JSON.stringify(ultimo(rpcs,'compra_no_llego'))===JSON.stringify({pid:41,motivo:'El proveedor no tenía'}));
  // Bolívares: pagar con tasa escrita
  await p.click('[data-compra-llego="41"]');await p.waitForSelector('#sheetCompra.open');await w();
  await p.click('[data-cp-modo="pague"]');await w();await p.click('[data-cp-cuenta="2"]');await w();
  await p.click('[data-cp-confirmar]');await w(400);
  ok('En bolívares pide la tasa',ultimo(rpcs,'compra_confirmar')===cc);
  await p.fill('#cpTasa','40');await w();
  ok('Dice cuántos bolívares salen',(await p.textContent('#cpBs')).includes('Bs a 40'));
  await p.click('[data-cp-confirmar]');await w(900);
  const cb=ultimo(rpcs,'compra_confirmar');
  ok('Pagué desde bolívares con la tasa escrita',cb!==cc&&cb.p.pago.modo==='pague'&&cb.p.pago.cuenta_id===2&&cb.p.pago.tasa===40&&cb.p.pago.tasa_origen==='BCV',cb&&cb.p.pago);
  ok('Sin errores de JavaScript',err.length===0,err);
 }catch(e){ ok('CORTE: '+e.message.split('\n')[0],false); }
 await b.close(); res.forEach(r=>console.log(r)); console.log(fallas?('FALLAS: '+fallas):'TODO OK'); process.exit(fallas?1:0);
})();
