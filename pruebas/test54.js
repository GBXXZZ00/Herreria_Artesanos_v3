// test54 (Taller lote 6): Taller › Corte › Material (K11 a K18) y barra dañada (K09), con el arnés de test53.
// Material (en camino, tabla Hay · Apartado · Libre · Falta, retazos con ✕, Proveedores), Comprar con lo que falta
// marcado y el mensaje al proveedor (Lo busco / Me lo traen, Hoy / Mañana, wa.me), compra en camino ⋯ (cambiar y
// cancelar), ¿Llegó? con una parte (lo que no vino sigue en camino: quedan), contar barras, retazo encontrado,
// proveedor nuevo y barra dañada (corte_barra_danada).
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
const CAM={grupos:[{grupo:5,fecha:new Date().toISOString(),plan_sab:null,lugares:[{id:41,tid:'t1',herrero:'Jesus',proveedor_id:1,proveedor:'Colores y Ambiente',iva:true,total:21.23,
    lineas:[{material_id:1,cantidad:1,precio:12.98,n:'Tubo 1" x 3"',pres:'barra'},{material_id:4,cantidad:2,precio:2.66,n:'Tubo 1/2" x 1/2" 0,70',pres:'barra'}]}],gastos:[],total:21.23}],
  proveedores:[{id:1,nombre:'Colores y Ambiente',tipos:['hierro'],iva:true,telefono:'584141234567',saldo:0},{id:2,nombre:'Torniplemaca',tipos:['hierro'],iva:false,telefono:null,saldo:-1674.5}],
  cuentas:[{id:1,nombre:'Zelle',moneda:'USD',saldo:2450}],consumibles:[],
  fab:DATOS.fab.map(f=>({id:f.id,nombre:f.nombre,tipo:f.tipo,pres:f.pres,stock:f.stock,precios:Object.fromEntries(Object.entries(f.precios||{}).map(([k,v])=>[k,v.p]))}))};
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
      if(name==='compras_en_camino')return j(CAM);
      if(name==='compra_pedir')return j({grupo:5,lugares:1});
      if(name==='conteo_guardar')return j({diferencias:[{material_id:1}]});
      if(name==='corte_barra_danada')return j({material:'Tubo',reemplazo:a.p_compra?'compra':'taller',compra:null});
      return j({});}
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
(async()=>{ const b=await chromium.launch(); const err=[]; try{
  const C=corte();
  const {p,rpcs}=await pagina(b,'u2',err,C); const w=ms=>p.waitForTimeout(ms||400);
  await p.goto(H+'taller.html?vista=corte');await p.waitForSelector('#vCorte .nm-row');await w();
  ok('Corte tiene Por herrero · Material',(await txt(p,'.ck-vista'))==='Por herrero Material');
  await p.click('[data-ck-vista="material"]');await p.waitForSelector('#vCorte .mt-tabla');await w();
  const cam=await txt(p,'.mt-camino');
  ok('En camino: Colores y Ambiente · 3 barras · $21,23 · para Jesus, con ¿Llegó? y ⋯',cam.includes('En camino · Colores y Ambiente')&&cam.includes('3 barras')&&cam.includes('para Jesus')&&cam.includes('¿Llegó?')&&!!(await p.$('[data-mt-cm="41"]')),cam);
  ok('Un solo encabezado: Material · Hay · Apartado · Libre · Falta',(await txt(p,'.mt-cab'))==='Material Hay Apartado Libre Falta');
  const F=await p.evaluate(()=>window.TallerMaterial.filas().map(r=>({id:r.f.id,hay:r.hay,ap:r.apartado,li:r.libre,fa:r.falta,usa:r.usa,cam:r.camino})));
  ok('Cuentas: libre = hay − apartado y nada negativo',F.every(r=>r.li===r.hay-r.ap&&r.li>=0&&r.fa>=0),F);
  ok('Hay algo que falta (en rojo) para el corte de Jesus',F.some(r=>r.fa>0)&&!!(await p.$('.mt-fila .mt-rojo')));
  ok('El tubo 1/2" cuenta 2 en camino',F.find(r=>r.id===4).cam===2&&(await txt(p,'.mt-tabla')).includes('2 en camino'));
  ok('Retazo como ficha gris con número y ✕',(await txt(p,'.mt-ret')).startsWith('R-12 · 1,2 m')&&!!(await p.$('[data-mt-retq="5"]')));
  const pvr=await txt(p,'.mt-provs');ok('Proveedores: le debes $1,674.50 · 1 compra en camino',pvr.includes('$1,674.50')&&pvr.includes('1 compra en camino'),pvr);
  ok('Abajo un solo Comprar, + Retazo encontrado y Contar barras',(await p.$$('[data-mt-comprar]')).length===1&&!!(await p.$('[data-mt-retazo]'))&&!!(await p.$('[data-mt-contar]')));
  ok('Nada se sale de la pantalla',await p.evaluate(()=>document.documentElement.scrollWidth<=390));
  await p.screenshot({path:'shots6/t54-material.png',fullPage:true});

  // Comprar (K12) y mensaje (K13)
  await p.click('[data-mt-comprar]');await p.waitForSelector('#sheetCompra.open');await w();
  ok('Comprar: lo que falta viene marcado',(await p.textContent('#compraTitulo'))==='Comprar'&&(await txt(p,'#compraBody')).includes('Ya viene marcado lo que falta'));
  await p.screenshot({path:'shots6/t54-comprar.png'});
  await p.click('[data-cp-pedir]');await p.waitForSelector('#sheetMt.open');await w(500);
  const cp=ultimo(rpcs,'compra_pedir');
  ok('Pedir compra con lo que falta',cp&&cp.p.lugares.length>0&&cp.p.lugares[0].lineas.every(l=>l.material_id&&l.cantidad>0),cp);
  ok('Después de pedir sale el mensaje para el proveedor',(await p.textContent('#mtTitulo'))==='Mensaje para el proveedor');
  let msg=await p.inputValue('#mtMsg');
  ok('Mensaje: saludo, para mañana, la barra con calibre y largo, y "Lo paso buscando en la mañana."',msg.startsWith('Buenos días, le escribe Ray de Herrería Artesanos. Para mañana necesito:')&&msg.includes('• 1 tubo 1" x 3" calibre 0,90 (barra de 6 m)')&&msg.includes('• 2 tubos 1/2" x 1/2" 0,70 (barra de 6 m)')&&msg.endsWith('Lo paso buscando en la mañana. Gracias.'),msg);
  await p.click('[data-mt-como="traen"]');await w(150);await p.click('[data-mt-cuando="hoy"]');await w(150);
  msg=await p.inputValue('#mtMsg');
  ok('Me lo traen y Hoy cambian el mensaje',msg.includes('Para hoy necesito')&&msg.endsWith('¿Me lo puede mandar? Gracias.'),msg);
  ok('WhatsApp del proveedor (0414-123-4567) y enlace wa.me con el texto',(await txt(p,'#mtBody')).includes('0414-123-4567')&&(await p.getAttribute('#mtWa','href')).startsWith('https://wa.me/584141234567?text=Buenos'));
  await p.screenshot({path:'shots6/t54-mensaje.png'});
  await p.click('#sheetMt [data-cerrar="sheetMt"]');await w();

  // Compra en camino ⋯ (K15): cambiar y cancelar
  await p.click('[data-mt-cm="41"]');await p.waitForSelector('#sheetMt.open');await w();
  ok('⋯: ¿Llegó? · Cambiar la compra · Volver a mandar el mensaje · Cancelar la compra',(await p.$$eval('#mtBody .ck-mrow b',x=>x.map(y=>y.textContent))).join(' · ')==='¿Llegó? · Cambiar la compra · Volver a mandar el mensaje · Cancelar la compra');
  await p.click('[data-mt-cmo="cambiar"]');await w();
  await p.click('[data-mt-lmas="0"]');await w(100);await p.click('[data-mt-cprov="2"]');await w(100);await p.click('[data-mt-cguardar]');await w(600);
  const pc=ultimo(rpcs,'compra_pedida_cambiar');
  ok('Cambiar la compra: 2 tubos y otro proveedor',pc&&pc.pid===41&&pc.p.proveedor_id===2&&pc.p.lineas[0].cantidad===2&&pc.p.lineas.length===2,pc);
  await p.click('[data-mt-cm="41"]');await p.waitForSelector('#sheetMt.open');await w();
  await p.click('[data-mt-cmo="cancelar"]');await w();await p.click('[data-mt-cancelar]');await w(200);
  ok('Cancelar sin motivo marca el campo',await p.$eval('#campoMtMot',x=>x.classList.contains('invalid'))&&!ultimo(rpcs,'compra_no_llego'));
  await p.fill('#mtMot','Ya no hace falta');await p.click('[data-mt-cancelar]');await w(600);
  ok('Cancelar la compra con motivo',JSON.stringify(ultimo(rpcs,'compra_no_llego'))===JSON.stringify({pid:41,motivo:'Ya no hace falta'}));

  // ¿Llegó? con una parte (K14)
  await p.click('#vCorte [data-compra-llego="5"]');await p.waitForSelector('#sheetCompra.open');await w();
  ok('¿Llegó todo? Todo · Una parte · Nada',(await txt(p,'#compraBody .fi-opc')).startsWith('Todo Una parte Nada'));
  await p.click('[data-cp-llega="0:parte"]');await w(150);
  await p.fill('[data-k="l:0:1:cantidad"]','1');await w(150);
  await p.click('[data-cp-llega="0:parte"]');await w(150);
  ok('Una parte: "Falta 1 tubo …: sigue en camino"',(await txt(p,'#compraBody')).includes('sigue en camino, en amarillo, en la misma compra'));
  await p.screenshot({path:'shots6/t54-llego.png'});
  await p.click('[data-cp-confirmar]');await w(700);
  const cc=ultimo(rpcs,'compra_confirmar');
  ok('Confirmar lo que llegó: 1 tubo 1/2" llegó y 1 sigue en camino (quedan)',cc&&cc.p.lugares[0].lineas[1].cantidad===1&&cc.p.lugares[0].quedan&&cc.p.lugares[0].quedan.length===1&&cc.p.lugares[0].quedan[0].material_id===4&&cc.p.lugares[0].quedan[0].cantidad===1,cc&&cc.p.lugares[0]);

  // Contar barras (K16)
  await p.click('[data-mt-contar]');await p.waitForSelector('#sheetMt.open');await w();
  await p.click('[data-mt-cmenos="0"]');await w(100);
  ok('Contar: dice la diferencia',(await txt(p,'#mtBody')).includes('1 diferencia: tubo 1" x 3" baja de 1 a 0'));
  await p.screenshot({path:'shots6/t54-contar.png'});
  await p.click('[data-mt-conteo]');await w(700);
  const cg=ultimo(rpcs,'conteo_guardar');
  ok('Guardar conteo manda lo contado',cg&&cg.p.conteo.find(x=>x.material_id===1).contado===0,cg&&cg.p.conteo[0]);

  // Retazo encontrado (K17) y quitar
  await p.click('[data-mt-retazo]');await p.waitForSelector('#sheetMt.open');await w();
  await p.fill('#mtLargo','5');await p.click('[data-mt-rguardar]');await w(200);
  ok('Retazo muy corto no se guarda',await p.$eval('#campoMtLargo',x=>x.classList.contains('invalid'))&&!ultimo(rpcs,'retazo_agregar'));
  await p.fill('#mtLargo','95');await p.click('[data-mt-rguardar]');await w(700);
  ok('Guardar retazo de 95 cm',JSON.stringify(ultimo(rpcs,'retazo_agregar'))===JSON.stringify({mid:1,p_largo:95,p_ancho:null}));
  await p.waitForSelector('[data-mt-retq="5"]');await p.click('[data-mt-retq="5"]');await w(700);
  ok('✕ del retazo: retazo_quitar',(ultimo(rpcs,'retazo_quitar')||{}).rid===5);

  // Proveedores (K18)
  await p.click('[data-mt-provs]');await p.waitForSelector('#sheetMt.open');await w();
  const pv=await txt(p,'#mtBody');
  ok('Proveedores: le debes en total y cada uno lleva a su ficha',pv.includes('Le debes en total')&&pv.includes('Torniplemaca')&&!!(await p.$('#mtBody a[href="finanzas.html?prov=2"]')));
  await p.screenshot({path:'shots6/t54-proveedores.png'});
  await p.click('[data-mt-pnuevo]');await w();await p.click('[data-mt-pguardar]');await w(200);
  ok('Proveedor sin nombre marca el campo',await p.$eval('#campoMtPNom',x=>x.classList.contains('invalid')));
  await p.fill('#mtPNom','Ferretería El Tubo');await p.fill('#mtPTel','0414-555-1234');await p.click('[data-mt-pguardar]');await w(700);
  const pg=ultimo(rpcs,'proveedor_guardar');
  ok('+ Proveedor: nombre, WhatsApp y qué vende',pg&&pg.p.nombre==='Ferretería El Tubo'&&pg.p.telefono==='0414-555-1234'&&pg.p.tipos.join()==='hierro'&&pg.p.cobra_iva===false,pg);
  await p.click('#sheetMt [data-cerrar="sheetMt"]');await w();

  // Barra dañada (K09): enviar a Jesus (sale el mensaje de la compra) y reportar
  await p.click('[data-ck-vista="herrero"]');await w();
  await p.click('#vCorte [data-ck-abrir="t1"]');await p.waitForSelector('#sheetCorte.open');await w(500);
  await p.click('[data-ck-enviar]');await w(1200);
  ok('Enviar y pedir: sale el mensaje para el proveedor',await p.$eval('#sheetMt',x=>x.classList.contains('open'))&&(await p.textContent('#mtTitulo'))==='Mensaje para el proveedor');
  await p.click('#sheetMt [data-cerrar="sheetMt"]');await w();
  await p.click('[data-ck-masmenu]');await p.waitForSelector('#sheetCkMas.open');await w();
  await p.click('[data-ck-m="danada"]');await p.waitForSelector('#sheetMt.open');await w();
  const bd=await txt(p,'#mtBody');
  ok('Barra dañada: material, cuál barra y con qué se reemplaza',(await p.textContent('#mtTitulo'))==='Barra dañada'&&bd.includes('¿Qué material?')&&bd.includes('¿Cuál barra?')&&bd.includes('¿Con qué la reemplaza?')&&!!(await p.$('.mt-barra.on')),bd.slice(0,200));
  await p.screenshot({path:'shots6/t54-danada.png'});
  await p.click('[data-mt-dguardar]');await w(800);
  const dn=ultimo(rpcs,'corte_barra_danada');
  ok('Reportar y reemplazar: corte_barra_danada de Jesus',dn&&dn.p_tid==='t1'&&dn.p_sab===sab&&dn.p_mid>0&&typeof dn.p_compra==='boolean',dn);
  ok('Nada se sale de la pantalla al final',await p.evaluate(()=>document.documentElement.scrollWidth<=390));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
