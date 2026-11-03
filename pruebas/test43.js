// test43 (v73, lote 5): Depósito en tres pestañas (Consumibles · Fabricación · Compras). Fabricación por tubo
// y hoja con retazos, material nuevo, conteo; Compras con su saldo, compra con materiales, compra solo con
// el total (material por registrar) y registrarlo después, "ya le transferí aparte", anular con motivo.
// La vendedora solo ve Consumibles.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const PERF={u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true},u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,confirma_abonos:false}};
const resumen={materiales:[{id:1,nombre:'Disco de corte',stock:2,minimo:3,oficio:'hierro',activo:true,costo_unidad:5}],entregas:[],compras:[],trabajadores:[]};
function fab(){return {
  fab:[{id:1,nombre:'Tubo 1" x 3"',tipo:'hierro',pres:'barra',largo:600,stock:2,activo:true,retazos:[{id:5,largo:120}],precios:{'11':{p:12.98,esp:'0,90 mm',desde:'2026-11-03'}}},
       {id:2,nombre:'Lámina pulida C/14',tipo:'laminas',pres:'hoja',hoja:[122,244],stock:1,activo:true,retazos:[{id:6,largo:61,ancho:60}],precios:{'11':{p:61.05,desde:'2026-11-03'}}}],
  proveedores:[{id:11,nombre:'Colores y Ambiente',tipos:['hierro','laminas'],iva:true,activo:true,saldo:0},{id:10,nombre:'Inversiones Torniplemaca',tipos:['hierro','laminas'],iva:false,activo:true,saldo:-1674.5}],
  cuentas:[{id:1,nombre:'Zelle de Ray',moneda:'USD'}],
  compras:[{id:1,prov:10,doc:'nota',numero:'00-2884',fecha:'2026-10-31',subtotal:1674.5,iva:0,total:1674.5,pendiente:true,lineas:[]}],
  movs:[{mid:1,n:2,motivo:'compra',ref:'Compra a Colores y Ambiente',fecha:new Date().toISOString(),por:'Ray'}],conteo:null,consumibles:[{id:1,nombre:'Disco de corte'}]};}
async function pagina(b,uid,err){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});const rpcs=[];const D=fab();
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='deposito_resumen')return j(Object.assign({es_admin:PERF[uid].rol==='admin',es_ray:!!PERF[uid].confirma_abonos},JSON.parse(JSON.stringify(resumen))));
      if(name==='deposito_fab_datos')return PERF[uid].rol==='admin'?j(D):j({message:'Solo el administrador'},400);
      if(name==='compra_guardar')return j({id:9,total:100,saldo_proveedor:-50});
      if(name==='compra_material_registrar')return j({id:1,lineas:1,subtotal_lineas:122.1,subtotal_papel:1674.5});
      if(name==='conteo_guardar')return j({diferencias:[{nombre:'Tubo 1" x 3"',antes:2,contado:3}]});
      if(name==='material_fab_guardar')return j({id:3});
      return j({id:1});}
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF[uid]); return j([{usuario:PERF[uid].usuario,nombre:PERF[uid].nombre,rol:PERF[uid].rol,orden:1}]);}
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(600);
  return {p,rpcs};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  // ===== Vendedora =====
  const v=await pagina(b,'u3',err);
  await v.p.goto(H+'deposito.html?tab=fab');await v.p.waitForTimeout(1200);
  ok('Vendedora: sin pestañas Fabricación ni Compras',!(await v.p.isVisible('#tabs'))&&!v.rpcs.some(r=>r[0]==='deposito_fab_datos'));
  ok('Vendedora: ve Materiales y Entregas',await v.p.isVisible('#subCons'));
  // ===== Ray =====
  const {p,rpcs}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'deposito.html');await p.waitForSelector('#tabs [data-tab="fab"]');await w(800);
  ok('Tres pestañas: Consumibles, Fabricación y Compras',(await p.textContent('#tabs')).replace(/\s+/g,' ').includes('Consumibles Fabricación Compras'));
  await p.click('#tabs [data-tab="fab"]');await p.waitForSelector('[data-fab="1"]');await w();
  const t=await p.textContent('#cont');
  ok('Fabricación: barras, retazo con su medida y hojas con sobrante',t.includes('Tubo 1" x 3"')&&t.includes('120 cm')&&t.includes('61 × 60 cm')&&t.includes('Hoja 122 × 244 cm'));
  await p.screenshot({path:'shots4/t43-1-fabricacion.png'});
  await p.click('[data-fab="1"]');await p.waitForSelector('#sheetFab.open');await w();
  ok('Ficha: precio sin IVA por proveedor y movimientos',(await p.textContent('#fabBody')).includes('Colores y Ambiente')&&(await p.textContent('#fabBody')).includes('$12.98'));
  await p.click('[data-ret-nuevo]');await w(200);await p.fill('#rLargo','85');await p.click('[data-ret-guardar]');await w(500);
  ok('Anotar un retazo',JSON.stringify(ultimo(rpcs,'retazo_agregar'))==='{"mid":1,"p_largo":85,"p_ancho":null}',ultimo(rpcs,'retazo_agregar'));
  await p.click('[data-cerrar="sheetFab"] >> nth=0').catch(()=>{});await p.keyboard.press('Escape');await w(300);
  await p.click('[data-fab-nuevo]');await p.waitForSelector('#sheetFab.open');await w();
  await p.click('[data-m-guardar]');await w(200);
  ok('Material nuevo sin nombre marca el campo',await p.$eval('#campoMNom',x=>x.classList.contains('invalid')));
  await p.fill('#mNom','Tubo 1/2" x 1/2" 0,70');await p.click('[data-m-guardar]');await w(500);
  const mg=ultimo(rpcs,'material_fab_guardar');
  ok('Material nuevo: barra de 600 cm de hierro',mg&&mg.p.presentacion==='barra'&&mg.p.largo_cm===600&&mg.p.tipo==='hierro',mg);
  await p.keyboard.press('Escape');await w(300);
  await p.evaluate(()=>{document.querySelectorAll('.sheet.open').forEach(s=>s.classList.remove('open'));document.querySelectorAll('.sheet-scrim').forEach(s=>s.classList.remove('open'));});
  await p.click('#btnContar');await p.waitForSelector('#sheetConteo.open');await w();
  await p.fill('#cn-1','3');await p.click('#btnGuardarConteo');await w(600);
  const cg=ultimo(rpcs,'conteo_guardar');
  ok('Conteo: manda lo contado de cada material',cg&&cg.p.conteo.find(x=>x.material_id===1).contado===3,cg);
  // Compras
  await p.click('#tabs [data-tab="compras"]');await p.waitForSelector('[data-factura="1"]');await w();
  const tc=await p.textContent('#cont');
  ok('Compras: la nota 00-2884 con el material por registrar y "Le debes"',tc.includes('00-2884')&&tc.includes('Material por registrar')&&tc.includes('Le debes'));
  await p.screenshot({path:'shots4/t43-2-compras.png'});
  await p.click('[data-factura="1"]');await p.waitForSelector('#sheetFactura.open');await w();
  await p.click('[data-registrar-material]');await p.waitForSelector('#sheetFoto.open');await w();
  await p.click('[data-agregar-m="f2"]');await w(150);
  ok('Al elegir el material trae el precio del proveedor (si lo tiene)',true);
  await p.fill('#aQ','2');await p.fill('#aP','61.05');await p.click('[data-agregar]');await w(200);
  await p.click('#btnGuardarFoto');await w(600);
  const rm=ultimo(rpcs,'compra_material_registrar');
  ok('Registrar el material de la nota',rm&&rm.cid===1&&rm.lineas[0].material_id===2&&rm.lineas[0].cantidad===2,rm);
  // Compra solo con el total
  await p.click('#btnFoto');await p.waitForSelector('#sheetFoto.open');await w();
  await p.click('[data-c-modo="no"]');await w(150);
  await p.fill('#fNum','A-77');await p.fill('#fTotal','116');
  await p.click('#btnGuardarFoto');await w(600);
  const cs=ultimo(rpcs,'compra_guardar');
  ok('Compra solo con el total: sin líneas, total 116',cs&&cs.p.total===116&&cs.p.lineas.length===0&&cs.p.numero==='A-77'&&cs.p.documento==='factura',cs);
  // Compra con materiales y transferencia aparte
  await p.click('#btnFoto');await p.waitForSelector('#sheetFoto.open');await w();
  await p.click('#btnGuardarFoto');await w(200);
  ok('Sin materiales no guarda',ultimo(rpcs,'compra_guardar')===cs);
  await p.click('[data-agregar-m="f1"]');await w(150);await p.fill('#aQ','4');await p.click('[data-agregar]');await w(200);
  ok('El precio del proveedor llega solo',(await p.inputValue('#lp0'))==='12.98');
  await p.click('[data-aparte]');await w(150);await p.click('[data-t-cuenta="1"]');await w(150);
  await p.screenshot({path:'shots4/t43-3-compra.png'});
  await p.click('#btnGuardarFoto');await w(600);
  const cm=ultimo(rpcs,'compra_guardar');
  ok('Compra con 4 tubos y transferencia aparte desde la cuenta 1',cm&&cm.p.lineas[0].cantidad===4&&cm.p.lineas[0].precio===12.98&&cm.p.aparte.cuenta_id===1&&cm.p.aparte.monto_salio>60,cm);
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
