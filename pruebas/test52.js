// test52 (Taller lote 7): sello ENTREGADO en el PDF de la venta (Parte B, maqueta C5) y la vendedora en el Taller
// (T7): Todos · En proceso · Listos, sin montos ni Asignar ni Nómina, y Marcar entregada desde Listos.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const DATOS=JSON.parse(fs.readFileSync(__dirname+'/datos-costos-bitral.json','utf8'));
DATOS.categorias=[{id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:30}}}];
DATOS.enFabricacion=[7];
DATOS.fab.forEach(f=>(f.retazos||[]).forEach(r=>{r.num=r.num||12;}));
const isoL=(d)=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const sab=(()=>{const d=new Date();d.setHours(12,0,0,0);const w=d.getDay();d.setDate(d.getDate()+(w===0?6:6-w));return isoL(d);})();
const PERF={u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true,lleva_madera:false},u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,confirma_abonos:false},
  t1:{id:'t1',usuario:'jesus',nombre:'Jesus',rol:'trabajador',activo:true,especialidades:['herrero']}};
const TRAB=[{id:'t1',nombre:'Jesus',especialidades:['herrero']},{id:'t2',nombre:'José',especialidades:['herrero']},{id:'t3',nombre:'Luis Paz',especialidades:['masilla_pintura']}];
function corte(){return {aluminio:0,planes:{},pasos:[
  {eid:900,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:1,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:901,venta:1200,interna:false,cliente:'Ana Rincón',entrega:sab,mid:7,nombre:'Modelo bitral',tipo:'Puerta Multilock',unidad:2,de:2,tid:'t1',herrero:'Jesus',para:sab,precio:320,cortado:false},
  {eid:902,venta:1201,interna:false,cliente:'Luis Paz',entrega:sab,mid:4,nombre:'Lineal Economico',tipo:'Puerta Multilock',unidad:1,de:1,tid:null,herrero:null,para:null,precio:200,cortado:false}]};}
const firmaB=(bs)=>JSON.stringify((bs||[]).map(b=>({mid:String(b.mid),tipo:b.tipo,rid:b.rid||null,piezas:(b.piezas||[]).map(p=>String(p.eid)+':'+Number(p.cm)).sort()})).map(x=>JSON.stringify(x)).sort());
const LISTAS=[{id:1300,estado:'lista',total:450,fecha_entrega:sab,lista_en:new Date().toISOString(),token_seguimiento:'tk',interna:false,cliente:{nombre:'Carla Pérez',telefono:'584141112233'},abonos:[{monto:300,tipo:'abono',estado:'confirmado'}],
  items:[{id:31,nombre:'Puerta Doble Reja',tipo:'Puerta Multilock',foto:null,cantidad:1,especificaciones:{},catalogo:null}]}];
const ENPROD=[{id:1301,fecha_entrega:sab,interna:false,cliente:{nombre:'Pedro Gil'},items:[{id:32,nombre:'Ventana Lineal',tipo:'Ventana',cantidad:1,especificaciones:{},foto:null,etapas:[
  {id:70,unidad:1,rama:null,nombre:'Hierro',orden:1,estado:'pendiente',oficio:'hierro',trabajador_id:'t1',para_el:sab,trabajador:{nombre:'Jesus'}},{id:71,unidad:1,rama:null,nombre:'Pintura',orden:2,estado:'pendiente',oficio:'pintura',trabajador_id:null}]}]}];
async function pagina(b,uid,err,C){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});const rpcs=[];
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/0'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
      if(name==='costos_datos')return PERF[uid].confirma_abonos?j(DATOS):j({message:'Costos es solo para Ray o Gualfredo'},400);
      if(name==='corte_datos')return j(C);
      if(name==='corte_plan_guardar'){C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{},enviados:{}},C.planes[a.p_sab]||{},a.p);return j({sab:a.p_sab});}
      if(name==='corte_enviar'){const pl=C.planes[a.p_sab]=Object.assign({entregado:{},manual:{},nuevos:[],corregido:{},enviados:{}},C.planes[a.p_sab]||{},a.p_plan,{aceptado:true});
        pl.enviados[a.p_tid]={firma:'F',firma_hoy:'F',empezo:false,en:new Date().toISOString(),barras:a.p_plan.barras.filter(x=>x.tid===a.p_tid)};return j({sab:a.p_sab,tid:a.p_tid,compra:a.p_compra?{grupo:5}:null});}
      if(name==='corte_deshacer_envio'){delete C.planes[a.p_sab].enviados[a.p_tid];return j({});}
      if(name==='corte_corregir')return j({ok:true});
      if(name==='asignar_etapas')return j(a.p.length);
      if(name==='mis_trabajos')return j([{id:900,oficio:'hierro',estado:'pendiente',producto:'Modelo bitral',tipo:'Puerta Multilock'}]);
      if(name==='mis_pagos')return j({});
      if(name==='mi_hoja_corte')return j(C.hojaHerrero||[]);
      if(name==='produccion_lectura')return j(ENPROD);
      if(name==='cambiar_estado_venta')return j({id:a.vid,estado:a.nuevo});
      return j({});}
    if(u.includes('/rest/v1/ventas')&&u.includes('estado=eq.lista'))return j(LISTAS);
    if(u.includes('/perfiles')){ if(u.includes('rol=eq.trabajador'))return j(TRAB); if(u.includes('select=lleva_madera'))return j({lleva_madera:false,linea:null}); if(u.includes('id=eq'))return j(PERF[uid]); return j([{usuario:PERF[uid].usuario,nombre:PERF[uid].nombre,rol:PERF[uid].rol,orden:1}]);}
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>err.push(uid+': '+e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(500);
  return {p,rpcs};
}
const ultimo=(rpcs,n)=>{const x=rpcs.filter(r=>r[0]===n);return x.length?x[x.length-1][1]:null;};
const txt=async(p,s)=>((await p.innerText(s))||'').replace(/\s+/g,' ').trim();
const VENTA=(estado)=>({id:1300,estado,total:450,subtotal:450,descuento:0,instalacion:0,traslado:0,creado_en:'2026-11-02T14:00:00Z',confirmada_en:'2026-11-03T14:00:00Z',fecha_entrega:'2026-11-20',entregada_en:estado==='entregada'?'2026-11-20T15:00:00Z':null,
  cliente:{nombre:'Carla Pérez',cedula:'V12345678',telefono:'584141112233'},sede:{nombre:'Maracaibo'},notas:null,
  items:[{nombre:'Puerta Doble Reja',tipo:'Puerta Multilock',cantidad:1,precio_unitario:450,especificaciones:{},foto:null}],abonos:[{monto:300,tipo:'abono',estado:'confirmado',fecha:'2026-11-03',metodo:'Zelle'}]});
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  // 1) Sello ENTREGADO en el PDF
  const ctx=await b.newContext({...devices['iPhone 13']});
  await ctx.route('**/*.supabase.co/**',r=>r.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"message":"no"}'}));
  const q=await ctx.newPage();q.on('pageerror',e=>err.push('pdf: '+e.message));
  await q.goto(H+'seguimiento.html?t=x');await q.waitForFunction(()=>window.AV&&window.AV.crearPDF);
  const pdf=async(estado)=>q.evaluate(async(v)=>{const bl=await window.AV.crearPDF(v);const t=await bl.text();const u8=new Uint8Array(await bl.arrayBuffer());let s='';for(let i=0;i<u8.length;i+=0x8000)s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return {t,b64:btoa(s)};},VENTA(estado));
  const e1=await pdf('entregada'), e2=await pdf('lista');
  ok('PDF de una venta entregada trae ENTREGADO y la fecha 20 NOV 2026',e1.t.includes('(ENTREGADO)')&&e1.t.includes('(20 NOV 2026)'));
  ok('PDF de una venta no entregada sale como siempre (sin sello)',!e2.t.includes('ENTREGADO'));
  fs.mkdirSync(__dirname+'/shots7',{recursive:true});fs.writeFileSync(__dirname+'/shots7/t52-entregada.pdf',Buffer.from(e1.b64,'base64'));
  await ctx.close();

  // 2) La vendedora en el Taller (T7)
  const C=corte();
  const {p,rpcs}=await pagina(b,'u3',err,C); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'taller.html');await p.waitForSelector('.tl-card');await w();
  ok('Vendedora: solo Pedidos (sin pestañas Resumen, Corte ni Nómina)',await p.$eval('#tabsTaller',x=>getComputedStyle(x).display==='none'));
  ok('Filtros: Todos · En proceso · Listos',(await txt(p,'.tl-chips')).replace(/\d+/g,'').replace(/\s+/g,' ').trim()==='Todos En proceso Listos',await txt(p,'.tl-chips'));
  const todo=await txt(p,'#lista');
  ok('Ve el pedido en proceso y el listo, sin montos ni Asignar',todo.includes('1301')&&todo.includes('1300')&&!/\$\d/.test(todo)&&!(await p.$('[data-asignar-pedido]')),todo.slice(0,300));
  await p.click('.tl-chips [data-f="listos"], .tl-chips [data-filtro="listos"]');await w();
  const li=await txt(p,'#lista');
  ok('Listos: Carla Pérez con Entrega, WhatsApp y Venta, sin "Debe el cliente"',li.includes('Carla Pérez')&&li.includes('Entrega')&&li.includes('WhatsApp')&&!li.includes('Debe el cliente')&&!/\$\d/.test(li),li);
  await p.screenshot({path:'shots7/t52-vendedora-listos.png'});
  await p.click('[data-entregar="1300"]');await w(800);
  ok('Marcar entregada: cambiar_estado_venta a entregada',JSON.stringify(ultimo(rpcs,'cambiar_estado_venta'))===JSON.stringify({vid:1300,nuevo:'entregada',desde:'lista'}));
  ok('Nada se sale de la pantalla',await p.evaluate(()=>document.documentElement.scrollWidth<=390));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
