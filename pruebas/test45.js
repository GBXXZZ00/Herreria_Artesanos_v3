// test45 (v73, lotes 10 y 10b): Finanzas › Mes (cierre con números de la base, cerrar el mes, PDF) y Reportes por proveedor y por cuenta con fechas y PDF.
// Usa el mismo arnés de test42.
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
      if(name==='mes_datos') return j({cerrado:false,datos:{mes:'2026-10',entro:[['Pagos de clientes · Zelle',400]],salio:[['Gasto · Alquiler',-800],['Nómina',-80],['Comisión y cambio',-70]],compras:[['Inversiones Torniplemaca',1674.5]],vendido:320,costo:223.22,sinCosto:0,nSin:0,puertas:1,gastoTot:950,fijosPrev:915,pagadoFijo:[{cat:'Alquiler',prev:800,pagado:800},{cat:'Internet',prev:30,pagado:0}],porModelo:[['Modelo bitral × 1',60.18]],cuentas:[['Zelle de Ray',2450]],proveedores:[['Inversiones Torniplemaca',-1674.5]],ajustes:1}});
      if(name==='mes_cerrar') return j({mes:a.p_mes});
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
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('dialog',d=>d.accept());
  await entrar(p);
  return {p,rpcs,ctx};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  const {p,rpcs}=await abrir(b,'ray',err); const w=ms=>p.waitForTimeout(ms||400);
  const ant=(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})();
  await p.goto(H+'finanzas.html?tab=mes&mes='+ant);await p.waitForSelector('[data-pdf-mes]');await w();
  const t=await p.textContent('#cont');
  ok('Mes: lo que ganaste, entró y salió con nómina y comisión, compras, gastos fijos, productos, saldos',t.includes('Lo que ganaste')&&t.includes('Nómina')&&t.includes('Comisión y cambio')&&t.includes('Compras a proveedores')&&t.includes('Gastos fijos: previsto y pagado')&&t.includes('Modelo bitral × 1')&&t.includes('Así quedaron los proveedores'));
  ok('Ganancia del mes: 320 − 223,22 − 950',t.includes('Pérdida del mes')&&t.includes('$853.22'));
  await p.screenshot({path:'shots4/t45-1-mes.png'});
  await p.click('[data-cerrar-mes]');await w(800);
  ok('Cerrar el mes llama a mes_cerrar con el primer día',JSON.stringify(ultimo(rpcs,'mes_cerrar'))===JSON.stringify({p_mes:ant+'-01'}));
  await p.click('[data-pdf-mes]');await w(2500);
  ok('Reporte del mes en PDF',((await p.evaluate(()=>window.__share))||[''])[0]==='Cierre-'+ant+'.pdf');
  // Reportes
  await p.click('[data-fm-vista="reportes"]');await w();
  let r=await p.textContent('#cont');
  ok('Reportes por proveedor: saldo al inicio, pagos, compras y saldo al final',r.includes('Inversiones Torniplemaca')&&r.includes('al inicio')&&r.includes('compras'));
  await p.click('[data-fr-rango="rango"]');await w(200);
  await p.fill('#frDesde','2026-10-30');await p.dispatchEvent('#frDesde','change');await w(200);
  await p.click('[data-fr-ver="10"]');await w(300);
  r=await p.textContent('#cont');
  ok('Detalle del proveedor con fechas: la nota 00-2884 del 31/10/2026 y saldo final',r.includes('31/10/2026')&&r.includes('Nota 00-2884')&&r.includes('Saldo al'));
  await p.screenshot({path:'shots4/t45-2-reporte.png'});
  await p.click('[data-fr-pdf="10"]');await w(2500);
  ok('PDF del proveedor',((await p.evaluate(()=>window.__share))||[''])[0].startsWith('Reporte-Inversiones-Torniplemaca'));
  await p.click('[data-fr-de="cuenta"]');await w();
  r=await p.textContent('#cont');
  ok('Reportes por cuenta: entró, salió y comisión',r.includes('Zelle de Ray')&&r.includes('entró')&&r.includes('salió'));
  await p.click('[data-fr-pdf-todos]');await w(2500);
  ok('PDF del resumen de cuentas',((await p.evaluate(()=>window.__share))||[''])[0]==='Reporte-cuentas.pdf');
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
