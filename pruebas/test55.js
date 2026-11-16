// test55 (lote 8): Costeador › Modelos (C1). Pestañas Modelos · Precios, ?tab=semana lleva a Taller › Corte,
// filtros Todos · Puertas · Combos · Ventanas · Extras, grupos Listos · Borrador · Faltan por costear, fila con
// "$6.79 abajo", + Nuevo (modelo copiado del Bitral, con nombre y tipo; extra de un modelo), Elige el perfil
// (+ perfil en la ficha) y salir sin guardar. Arnés de test44 (pruebas/datos-costos-bitral.json).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const DATOS=JSON.parse(fs.readFileSync(__dirname+'/datos-costos-bitral.json','utf8'));
DATOS.categorias=[{id:3,nombre:'Puerta Estándar',producto:'Puerta Multilock',tarifas:{hierro:{modo:'fijo',monto:30},detalles:{modo:'fijo',monto:5},masilla_pintura:{modo:'fijo',monto:30}}}];
DATOS.enFabricacion=[7];
if(!DATOS.catalogo.some(c=>c.id===4))DATOS.catalogo.push({id:4,nombre:'Lineal Economico',tipo:'Puerta Multilock',precio_base:200,especificaciones_base:{alto:2,ancho:1},categoria_pago_id:3});
DATOS.modelos.forEach(m=>{if(m.catalogo_id===7&&!(m.extras||[]).length)m.extras=[{id:5,n:'Protección',v:0,piezas:[[3,2,200]],ofrecer:true,sin_cortes:false,mano:null}];});
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
      if(name==='costeo_guardar'){ if(!a.p.id&&a.p.catalogo_id==null){ DATOS.modelos.push({id:99,catalogo_id:null,nombre:a.p.nombre,tipo:a.p.tipo,codigo:'M-99',estado:'diseno',categoria_pago_id:a.p.categoria_pago_id||null,nota:null,piezas:a.p.piezas,hojas:a.p.hojas,rend:a.p.rend,acc:a.p.acc,extras:a.p.extras,x:null}); return j({id:99}); } return j({id:a.p.id||1}); }
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
  const {p,rpcs}=await pagina(b,'u2',err); const w=ms=>p.waitForTimeout(ms||400);
  // El plan de corte se fue al Taller
  await p.goto(H+'costos.html?tab=semana');await p.waitForURL(/taller\.html\?vista=corte/,{timeout:8000}).catch(()=>{});
  ok('?tab=semana lleva a Taller › Corte',p.url().includes('taller.html?vista=corte'),p.url());
  await p.goto(H+'costos.html');await p.waitForSelector('[data-modelo="7"]');await w();
  ok('Título Costeador y pestañas Modelos · Precios',(await p.textContent('.topbar-title'))==='Costeador'&&(await p.$$eval('#tabs [data-tab]',x=>x.map(y=>y.textContent))).join('|')==='Modelos|Precios');
  ok('Filtros: Todos · Puertas · Combos · Ventanas · Extras',(await p.$$eval('#filtrosL [data-filtro]',x=>x.map(y=>y.textContent))).join('|')==='Todos|Puertas|Combos|Ventanas|Extras');
  const grupos=await p.$$eval('#cont .grp-t span:first-child',x=>x.map(y=>y.textContent));
  ok('Grupos Listos y Faltan por costear',grupos.includes('Listos')&&grupos.includes('Faltan por costear'),grupos);
  const fila=(await p.textContent('[data-modelo="7"]')).replace(/\s+/g,' ');
  ok('El Bitral: $326.79 y "$6.79 abajo" en rojo',fila.includes('$326.79')&&fila.includes('$6.79 abajo')&&!!(await p.$('[data-modelo="7"] .mod-dif.rojo')),fila);
  ok('Un modelo sin costeo dice "sin cortes"',(await p.textContent('#cont')).includes('sin cortes'));
  ok('Buscador y + Nuevo arriba',!!(await p.$('#buscaModelo'))&&!!(await p.$('[data-nuevo-modelo]')));
  ok('Nada se sale de la pantalla',await p.evaluate(()=>document.documentElement.scrollWidth<=390));
  await p.screenshot({path:'shots4/t55-modelos.png'});
  // + Nuevo: modelo copiado del Bitral
  await p.click('[data-nuevo-modelo]');await p.waitForSelector('#sheetForm.open');await w();
  ok('+ Nuevo: ¿Qué es? Modelo · Extra, Nombre, Tipo y Empezar',(await p.textContent('#formTitulo'))==='Nuevo'&&!!(await p.$('[data-nv-que="extra"]'))&&!!(await p.$('#nvNom'))&&!!(await p.$('[data-nv-tipo="Portón"]'))&&!!(await p.$('[data-nv-modo="estandar"]')));
  await p.click('[data-nv-crear]');await w(200);
  ok('Sin nombre no se crea',await p.$eval('#c_nvNom',x=>x.classList.contains('invalid'))&&!ultimo(rpcs,'costeo_guardar'));
  await p.fill('#nvNom','Lineal 6 vidrios');await p.click('[data-nv-de="7"]');await w(150);
  ok('Copiar del Bitral queda marcado',await p.$eval('[data-nv-de="7"]',x=>x.classList.contains('on')));
  await p.screenshot({path:'shots4/t55-nuevo.png'});
  await p.click('[data-nv-crear]');await p.waitForSelector('#sheetFicha.open');await w(600);
  const cg=ultimo(rpcs,'costeo_guardar');
  ok('Crea el modelo en diseño con nombre, tipo y los cortes del Bitral',cg&&cg.p.id===null&&cg.p.catalogo_id===null&&cg.p.nombre==='Lineal 6 vidrios'&&cg.p.tipo==='Puerta Multilock'&&cg.p.piezas.length===7,cg&&cg.p.nombre);
  ok('Se abre su ficha, en diseño',(await p.textContent('#fichaTitulo'))==='Lineal 6 vidrios'&&(await p.textContent('#fichaHead')).includes('En diseño'));
  await p.screenshot({path:'shots4/t55-ficha.png'});
  ok('La franja dice Pasar al Catálogo',(await p.textContent('#fichaFoot')).includes('sin catálogo'));
  // + perfil: Elige el perfil
  await p.click('[data-pf-nuevo]');await p.waitForSelector('#sheetForm.open');await w();
  ok('Elige el perfil: buscador, filtros Tubos · Platinas · Marcos y precio',(await p.textContent('#formTitulo'))==='Elige el perfil'&&!!(await p.$('[data-fcat="Platinas"]'))&&(await p.textContent('#listaMat')).includes('$'));
  await p.screenshot({path:'shots4/t55-perfil.png'});
  await p.click('[data-fcat="Platinas"]');await w(150);
  const plat=await p.$eval('#listaMat [data-elige-perfil]',x=>x.dataset.eligePerfil);
  await p.click('#listaMat [data-elige-perfil]');await w(400);
  ok('El perfil nuevo sale con su primera fila y el foco en Cant.',!!(await p.$(`#fichaBody [data-pf="${plat}"]`))&&await p.evaluate(()=>document.activeElement&&/:n$/.test(document.activeElement.dataset.pz||'')));
  await p.fill(`#fichaBody [data-pf="${plat}"] [data-pz$=":cm"]`,'300');await w(150);
  ok('Hay cambios: sale Guardar cambios',!!(await p.$('[data-guardar-cortes]')));
  await p.click('[data-salir-ficha]');await w(500);
  ok('Salir sin guardar pregunta y cierra la ficha',!(await p.$('#sheetFicha.open')));
  // Extras
  await p.click('#filtrosL [data-filtro="Extras"]');await w();
  const ex=await p.textContent('#cont');
  ok('Filtro Extras: las fichas de extra de los modelos (Protección del Bitral)',ex.includes('Protección')&&ex.includes('del Modelo bitral')&&!!(await p.$('[data-extra-de="7"]')),ex.slice(0,120));
  await p.click('#filtrosL [data-filtro="Todos"]');await w();
  await p.click('[data-nuevo-modelo]');await p.waitForSelector('#sheetForm.open');await w();
  await p.click('[data-nv-que="extra"]');await w(150);
  await p.click('[data-nv-crear]');await w(200);
  ok('Extra sin modelo no se crea',await p.$eval('#c_nvMod',x=>x.classList.contains('invalid')));
  await p.click('[data-nv-mod="7"]');await w(150);await p.click('[data-nv-kind="Protección"]');await w(150);await p.click('[data-nv-crear]');await w(700);
  ok('Extra: abre la ficha del modelo con el formulario del extra',(await p.textContent('#fichaTitulo'))==='Modelo bitral'&&await p.$eval('#sheetForm',x=>x.classList.contains('open')));
  console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
}catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
