// test42 (v73, Finanzas lotes 1 a 4): Finanzas solo para quien confirma pagos (Ray o Gualfredo),
// tu dinero hoy en dos columnas, cuentas nuevas, pagos por confirmar y ubicar en un paso, transferencia
// con comisión, bolívares con tasa y origen, salida sin proveedor "por ubicar", cambiar saldo con motivo,
// anular con motivo, estado de cuenta por fechas, Inicio con el cuadro Finanzas y sus avisos,
// Ventas manda a Finanzas para confirmar, Nómina pregunta de qué cuenta salió el pago.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const hoy=new Date().toISOString().slice(0,10);
const PERF={ray:{id:'u1',usuario:'ray',nombre:'Ray',rol:'admin',confirma_abonos:true},yuli:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',confirma_abonos:false}};
function datos(){
  return { hoy,
    cuentas:[{id:1,nombre:'Zelle de Ray',tipo:'Zelle',moneda:'USD',orden:1,activa:true},{id:2,nombre:'Bolívares',tipo:'Bolívares',moneda:'VES',orden:2,activa:true}],
    proveedores:[{id:10,nombre:'Inversiones Torniplemaca',rif:'J-40218850-1',tipos:['hierro','laminas'],iva:false,activo:true},{id:11,nombre:'Colores y Ambiente',tipos:['hierro'],iva:true,activo:true}],
    movs:[{id:1,fecha:'2026-10-29',tipo:'ajuste',cuenta:1,prov:null,ec:3250,ep:0,ref:'Ajuste de saldo',nota:'Saldo inicial',por:'Ray'},
      {id:2,fecha:'2026-10-31',tipo:'compra',cuenta:null,prov:10,ec:0,ep:-1674.5,ref:'Nota 00-2884',compra:1,por:'Gualfredo'},
      {id:3,fecha:hoy,tipo:'gasto',cuenta:1,prov:null,ec:-800,ep:0,salio:800,llego:800,comision:0,cat:'Alquiler',ref:'Alquiler',por:'Ray'},
      {id:4,fecha:hoy,tipo:'nomina',cuenta:null,prov:null,ec:0,ep:0,salio:80,llego:80,comision:0,ref:'Nómina · Jesus',por_ubicar:true,pago:5,por:'Ray'}],
    gastosFijos:[{id:1,cat:'Alquiler',monto:800},{id:2,cat:'Internet',monto:30}],
    porConfirmar:[{id:7,venta_id:1100,monto:400,metodo:'Zelle',comprobante:'2026-11/x.jpg',cliente:'Ana Rincón',total:800,estadoVenta:'confirmada',pagado:0,registro:'Yulimar'}],
    porUbicar:[{id:6,venta_id:1099,monto:240,metodo:'Zelle',tipo:'abono',confirmado_en:hoy,cliente:'Luis Paz'}],
    porCobrar:[{id:1100,cliente:'Ana Rincón',estado:'confirmada',total:800,pagado:400,resta:400}] };
}
function ruta(quien,rpcs,D){
  const P=PERF[quien];
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:P.id,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:P.id,aud:'authenticated',role:'authenticated',email:P.usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  return async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/storage/v1/object/sign'))return j({signedURL:'/object/sign/comprobantes/x.jpg?token=t'});
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='finanzas_datos'){ if(quien!=='ray') return j({message:'Finanzas es solo para Ray o Gualfredo'},400); return j(D); }
      if(name==='finanzas_avisos') return j(quien==='ray'?{por_confirmar:1,por_ubicar:2,debes:[{id:10,nombre:'Inversiones Torniplemaca',saldo:-1674.5}],gastos_sin_cargar:['Internet']}:{});
      if(name==='transferencia_guardar') return j({id:50,saldo_proveedor:a.p.proveedor_id?-1674.5+(a.p.monto_llego||a.p.monto_salio):null});
      if(name==='saldo_cambiar') return j({id:51,diferencia:10});
      if(name==='pago_confirmar_y_ubicar') return j({id:7,estado:'confirmado',produccion:true,ubicado:true});
      if(name==='nomina_semana') return j({trabajadores:[{id:'t1',nombre:'Jesus',trabajos:1,monto:80,vales:0,neto:80}]});
      return j({id:60});}
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(P); return j([{usuario:P.usuario,nombre:P.nombre,rol:P.rol,orden:1}]); }
    if(u.includes('/cuentas'))return j(D.cuentas);
    return j([]);};
}
async function entrar(p){
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(500);
}
async function abrir(b,quien,err){
  const rpcs=[],D=datos();
  const ctx=await b.newContext({...devices['iPhone 13']});
  await ctx.route('**/*.supabase.co/**',ruta(quien,rpcs,D));
  await ctx.addInitScript(()=>{window.__share=null;navigator.canShare=()=>true;navigator.share=async(d)=>{window.__share=d.files.map(f=>f.name);};window.open=(u)=>{window.__abre=u;return {};};});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));
  await entrar(p);
  return {p,rpcs,ctx};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  // ---------- Ray ----------
  const {p,rpcs}=await abrir(b,'ray',err); const w=ms=>p.waitForTimeout(ms||400);
  await p.waitForSelector('#cuenta-finanzas');await w(800);
  ok('Inicio: cuadro Finanzas y Costos para quien confirma pagos',!!(await p.$('a.ini-tile[href="finanzas.html"]'))&&!!(await p.$('a.ini-tile[href="costos.html"]')));
  const pendTxt=await p.textContent('#avisosAdmin');
  ok('Inicio: avisos de pagos por ubicar, le debes a un proveedor y gasto sin cargar',pendTxt.includes('2 pagos por ubicar')&&pendTxt.includes('Le debes a Torniplemaca')&&pendTxt.includes('1 gasto del mes sin cargar'),pendTxt.slice(0,300));
  await p.goto(H+'finanzas.html');await p.waitForSelector('.rep');await w();
  const txt=await p.textContent('#cont');
  ok('Dinero: los pagos por confirmar van en una sola tarjeta arriba',txt.includes('1 pago por confirmar')&&(await p.$$('#cont [data-lista-confirmar]')).length===1&&!(await p.$('#cont [data-confirmar]')));
  ok('Tu dinero hoy en dos columnas: cuentas 2.450, por ubicar 240 − 80, debes 1.674,50',txt.includes('Tu dinero hoy')&&txt.includes('En tus cuentas')&&txt.includes('Le debes a proveedores'));
  ok('Pagos por ubicar: el pago del cliente y la nómina sin cuenta',txt.includes('Pagos por ubicar · 2')&&txt.includes('Nómina · Jesus'));
  await p.screenshot({path:'shots4/t42-1-dinero.png'});
  // Confirmar y ubicar en un paso
  await p.click('[data-lista-confirmar]');await p.waitForSelector('#sheetDet.open');await w();
  ok('La lista agrupa los pagos por venta',(await p.textContent('#detBody')).includes('N° 1100 · Ana Rincón'));
  await p.click('#detBody [data-confirmar="7"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#formBody [data-f-llego="si"]');await w(200);
  ok('Confirmar: dice que con este pago pasa a fabricación',(await p.textContent('#formBody')).includes('pasa solo a fabricación'));
  await p.click('#btnForm');await w(200);
  ok('Sin decir dónde quedó no guarda',!ultimo(rpcs,'pago_confirmar_y_ubicar'));
  await p.click('#formBody [data-f-destino="cuenta"]');await w(200);
  await p.click('#formBody [data-f-cuenta="1"]');await w(200);
  await p.screenshot({path:'shots4/t42-2-confirmar.png'});
  await p.click('#btnForm');await w(700);
  const cf=ultimo(rpcs,'pago_confirmar_y_ubicar');
  ok('Confirma y ubica en un solo paso (cuenta 1)',cf&&cf.aid===7&&cf.llego===true&&cf.p.cuenta_id===1,cf);
  // Confirmar en fila: si quedan pagos, se abre solo el siguiente
  ok('Después de confirmar abre solo el siguiente pago',await p.isVisible('#sheetForm.open'));
  // No llegó: pide motivo
  await p.click('#formBody [data-f-llego="no"]');await w(200);await p.click('#btnForm');await w(200);
  ok('No llegó sin motivo marca el campo',await p.$eval('#campoMotivo',x=>x.classList.contains('invalid')));
  await p.fill('#fMotivo','No aparece en Zelle');await p.click('#btnForm');await w(600);
  const nl=ultimo(rpcs,'pago_confirmar_y_ubicar');
  ok('No llegó manda el motivo',nl.llego===false&&nl.nota==='No aparece en Zelle',nl);
  // Ubicar la nómina sin cuenta
  await p.evaluate(()=>{document.querySelectorAll('.sheet.open').forEach(s=>s.classList.toggle('open',false));document.querySelectorAll('.sheet-scrim').forEach(s=>s.classList.toggle('open',false));});
  await p.click('details[data-acc="ubicar"] summary');await w(200);
  await p.click('[data-ubicar-mov="4"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#formBody [data-f-cuenta="1"]');await w(200);await p.click('#btnForm');await w(600);
  const um=ultimo(rpcs,'movimiento_ubicar');
  ok('Salida por ubicar: se elige la cuenta',um&&um.mid===4&&um.p.cuenta_id===1,um);
  // Cuenta nueva
  if(!(await p.isVisible('[data-nueva-cuenta]'))){ await p.click('details[data-acc="cuentas"] summary');await w(200); }
  await p.click('[data-nueva-cuenta]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#btnForm');await w(200);
  ok('Cuenta sin nombre marca el campo',await p.$eval('#campoNom',x=>x.classList.contains('invalid')));
  await p.fill('#fNom','Efectivo Cumbres');await p.click('#formBody [data-f-tipocta="Efectivo"]');await w(200);await p.click('#btnForm');await w(600);
  const cn=ultimo(rpcs,'cuenta_guardar');
  ok('Agregar cuenta con su tipo',cn&&cn.p.nombre==='Efectivo Cumbres'&&cn.p.tipo==='Efectivo',cn);
  // Mover entre cuentas con comisión
  if(!(await p.isVisible('#cont [data-traspaso]'))){ await p.click('details[data-acc="cuentas"] summary');await w(200); }
  await p.click('#cont [data-traspaso]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#formBody [data-f-de="1"]');await w(150);await p.click('#formBody [data-f-a="2"]');await w(150);
  await p.fill('#fMonto','770');await p.click('#formBody [data-f-menos]');await w(150);await p.fill('#fLlego','700');
  await p.click('#btnForm');await w(600);
  const tp=ultimo(rpcs,'traspaso_guardar');
  ok('Mover entre cuentas: salió 770, llegó 700 (comisión)',tp&&tp.p.monto_salio===770&&tp.p.monto_llego===700,tp);
  // Proveedor: ficha, transferencia en bolívares
  await p.click('#tabs [data-tab="prov"]');await w();
  ok('Proveedores: le debes primero',(await p.textContent('#cont')).includes('Les debes'));
  await p.click('#cont [data-prov="10"]');await p.waitForSelector('#sheetDet.open');await w();
  const ft=await p.textContent('#detBody');
  ok('Ficha del proveedor: le debes, RIF, compra con su fecha',ft.includes('Le debes')&&ft.includes('J-40218850-1')&&ft.includes('Nota 00-2884')&&ft.includes('31/10/2026'));
  await p.screenshot({path:'shots4/t42-3-proveedor.png'});
  await p.click('#detFoot [data-transferir="10"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('#formBody [data-f-cuenta="2"]');await w(200);
  ok('Cuenta en bolívares pide Bs, tasa y de dónde es la tasa',!!(await p.$('#fBs'))&&!!(await p.$('#fTasa'))&&(await p.textContent('#formBody')).includes('¿De dónde es la tasa?'));
  await p.fill('#fBs','36000');await p.fill('#fTasa','36');await p.click('#formBody [data-f-origen="BCV"]');await w(150);
  ok('El saldo del proveedor se ve antes de guardar',(await p.textContent('#cajaSaldo')).includes('después de esta transferencia'));
  await p.click('#btnForm');await w(600);
  const tr=ultimo(rpcs,'transferencia_guardar');
  ok('Transferencia en Bs con tasa BCV',tr&&tr.p.proveedor_id===10&&tr.p.monto_bs===36000&&tr.p.tasa===36&&tr.p.tasa_origen==='BCV',tr);
  // Cambiar saldo con motivo
  await p.click('#detBody [data-ajustar-prov="10"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.fill('#fNuevo','100');await p.click('#formBody [data-f-signo="favor"]');await w(150);await p.click('#btnForm');await w(200);
  ok('Cambiar saldo sin motivo no guarda',!ultimo(rpcs,'saldo_cambiar'));
  await p.fill('#fMotivo','Cuadre con el proveedor');await p.click('#btnForm');await w(600);
  const sc=ultimo(rpcs,'saldo_cambiar');
  ok('Cambiar saldo: a tu favor 100 con motivo',sc&&sc.p.proveedor_id===10&&sc.p.nuevo===100&&sc.p.motivo==='Cuadre con el proveedor',sc);
  // Estado de cuenta por fechas
  await p.click('#detFoot [data-pdf="10"]');await p.waitForSelector('#sheetPdf.open');await w();
  await p.click('#pdfBody [data-pdf-rango="mes"]');await w(150);
  await p.click('#btnCompartirPdf');await w(2500);
  const sh=await p.evaluate(()=>window.__share);
  ok('Estado de cuenta en PDF',sh&&sh[0].startsWith('Estado-de-cuenta-'),sh);
  await p.keyboard.press('Escape');
  // Ventas: el pago por confirmar lleva a Finanzas
  await p.goto(H+'ventas.html?abrir=1100&confirmar=7').catch(()=>{});await w(2500);
  ok('Ventas con ?confirmar lleva a Finanzas',p.url().includes('finanzas.html'),p.url());
  // ---------- Vendedora ----------
  const v=await abrir(b,'yuli',err);
  await v.p.waitForSelector('#modulos .ini-tile');await v.p.waitForTimeout(600);
  ok('Vendedora: sin cuadro Finanzas ni Costos',!(await v.p.$('a.ini-tile[href="finanzas.html"]'))&&!(await v.p.$('a.ini-tile[href="costos.html"]')));
  await v.p.goto(H+'finanzas.html');await v.p.waitForTimeout(1200);
  ok('Vendedora en finanzas.html: no ve nada de dinero',(await v.p.textContent('#cont')).includes('solo para Ray o Gualfredo')&&!v.rpcs.some(r=>r[0]==='finanzas_datos'));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
