// Inicio de la vendedora: sus pendientes (solo de SUS ventas), cada uno con su color y
// a dónde lleva. Y que no ve los pendientes del administrador.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const hace=(h)=>new Date(Date.now()-h*3600e3).toISOString();
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

// Ventas de Yulimar (u3)
const ventas=[
  // Pago no llegó (y no registró otro después)
  {id:31,estado:'confirmada',vence_en:null,fecha_entrega:dia(10),mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Luis Rojas'},abonos:[{tipo:'abono',estado:'rechazado',fecha:hace(30),confirmado_en:hace(20)}]},
  // Pago no llegó PERO ya registró otro: no sale en rojo
  {id:32,estado:'confirmada',vence_en:null,fecha_entrega:dia(10),mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Ana Paz'},abonos:[{tipo:'abono',estado:'rechazado',fecha:hace(30),confirmado_en:hace(20)},{tipo:'abono',estado:'por_confirmar',fecha:hace(5),confirmado_en:null}]},
  // Pedido listo sin avisar
  {id:33,estado:'lista',vence_en:null,fecha_entrega:dia(2),mensaje_en:hace(48),mensaje_estado:'en_produccion',cliente:{nombre:'María Soto'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(100),confirmado_en:hace(90)}]},
  // Pedido listo ya avisado: no sale
  {id:34,estado:'lista',vence_en:null,fecha_entrega:dia(2),mensaje_en:hace(1),mensaje_estado:'lista',cliente:{nombre:'Pedro Gil'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(100),confirmado_en:hace(90)}]},
  // Pago confirmado después del último mensaje: enviar seguimiento
  {id:35,estado:'en_produccion',vence_en:null,fecha_entrega:dia(8),mensaje_en:hace(50),mensaje_estado:'en_produccion',cliente:{nombre:'Rosa Díaz'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(10),confirmado_en:hace(3)}]},
  // Otro igual (sin mensaje nunca)
  {id:36,estado:'en_produccion',vence_en:null,fecha_entrega:dia(9),mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Juan Mora'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(10),confirmado_en:hace(3)}]},
  // Le avisó después de confirmarse el pago (con la venta aún en Confirmada) y luego pasó a producción: no sale
  {id:41,estado:'en_produccion',vence_en:null,fecha_entrega:dia(5),mensaje_en:hace(2),mensaje_estado:'confirmada',cliente:{nombre:'Iris Luna'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(9),confirmado_en:hace(5)}]},
  // Cotización que vence en 2 días / otra que vence en 10 (no sale) / otra vencida (no sale)
  {id:37,estado:'cotizacion',vence_en:dia(2),fecha_entrega:null,mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Elena Ruiz'},abonos:[]},
  {id:38,estado:'cotizacion',vence_en:dia(10),fecha_entrega:null,mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Tito Vera'},abonos:[]},
  {id:39,estado:'cotizacion',vence_en:dia(-1),fecha_entrega:null,mensaje_en:null,mensaje_estado:null,cliente:{nombre:'Olga Paz'},abonos:[]},
  // Pedido atrasado en producción (avisado ya, para que solo cuente como atrasado)
  {id:40,estado:'en_produccion',vence_en:null,fecha_entrega:dia(-3),mensaje_en:hace(1),mensaje_estado:'en_produccion',cliente:{nombre:'Hugo León'},abonos:[{tipo:'abono',estado:'confirmado',fecha:hace(200),confirmado_en:hace(190)}]}
];
let urlVentas='';

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const m=req.method();
  const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses('u3'));
  if(u.includes('/auth/v1/user'))return j({id:'u3'});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1,confirma_abonos:false}); return j([{usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',orden:1}]); }
  if(u.includes('/rpc/produccion_lectura'))return j([{id:40,items:[]},{id:35,items:[]},{id:36,items:[]}]);
  if(u.includes('/abonos'))return j([{id:1,venta_id:99,monto:50,metodo:'Zelle'}]); // no debe usarse (no confirma pagos)
  if(u.includes('/ventas')){
    if(u.includes('vendedor_id=eq.u3')){urlVentas=u;return j(ventas);}
    return j([]);
  }
  if(m==='HEAD')return r.fulfill({status:200,headers:{'content-range':'*/0','access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  return j([]);});
 const y=await ctx.newPage();y.on('pageerror',e=>err.push(e.message));
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');await y.waitForSelector('.pend-fila');await y.waitForTimeout(500);
 const txt=async(sel)=>((await y.textContent(sel))||'').replace(/\s+/g,' ');
 ok('Solo pide SUS ventas (vendedor_id = ella)',urlVentas.includes('vendedor_id=eq.u3'));
 ok('Rojo: "1 pago no llegó · Luis Rojas" (el que ya tiene otro pago no sale)',(await txt('.pend-fila.rojo')).includes('1 pago no llegó · Luis Rojas'));
 ok('   lleva a esa venta',(await y.getAttribute('.pend-fila.rojo','href'))==='ventas.html?abrir=31');
 ok('Verde: "1 pedido listo: avísale · María Soto" (el ya avisado no sale)',(await txt('.pend-fila.verde')).includes('1 pedido listo: avísale · María Soto'));
 ok('Azul: "2 pagos confirmados: avísales" y lleva a Por avisar',(await txt('.pend-fila.azul')).includes('2 pagos confirmados: avísales') && (await y.getAttribute('.pend-fila.azul','href'))==='ventas.html?filtro=avisar');
 ok('Amarillo: "1 cotización por vencer · Elena Ruiz" (ni la vencida ni la lejana)',(await txt('.pend-fila.amarillo')).includes('1 cotización por vencer · Elena Ruiz') && (await y.getAttribute('.pend-fila.amarillo','href'))==='cotizaciones.html?abrir=37');
 ok('Naranja: "1 pedido atrasado · Hugo León"',(await txt('.pend-fila.naranja')).includes('1 pedido atrasado · Hugo León'));
 ok('5 pendientes en total, contador 5',(await y.$$('.pend-fila')).length===5 && (await txt('.pend-n'))==='5');
 ok('No ve pendientes del administrador (pagos por confirmar, vales, sin asignar)',!(await txt('#avisosAdmin')).includes('por confirmar') && !(await txt('#avisosAdmin')).includes('vale') && !(await txt('#avisosAdmin')).includes('sin asignar'));
 ok('La cajita Producción dice "3 pedidos en taller"',(await txt('#cuenta-produccion'))==='3 pedidos en taller');
 await y.screenshot({path:'shots5/y1-vendedora-inicio.png',fullPage:true});
 // Sin nada pendiente: no sale la caja
 ventas.length=0;
 await y.reload();await y.waitForSelector('#vInicio.entra');await y.waitForTimeout(1200);
 ok('Sin pendientes no sale la caja',!(await y.$('.pend')));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
