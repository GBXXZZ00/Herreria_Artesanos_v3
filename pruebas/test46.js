// test46 (v75, reestructura lote 1): Costos › Modelos y Precios. Lista por grupos (Listos / Borrador / Faltan),
// filtros y buscador, empezar copiando de otro modelo, ficha en una pantalla con índice y precio abajo, pieza con
// qué es y V/H, consumible del modelo (y volver al general), Usar en el catálogo, reglas con despunte, material nuevo.
// Dato de control: Bitral $223.22 · $290.19 · $326.79 · $339.23.
// (arnés de test44): Costos. Bitral (catálogo id 7) con los datos reales de la Memoria central:
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
DATOS.catalogo.push({id:4,nombre:'Lineal Economico',tipo:'Puerta Multilock',precio_base:200,categoria_pago_id:3,especificaciones_base:{alto:2,ancho:1,manillon:false,proteccion:false,marco_decorativo:false,vidrio_o_farquilla:'Vidrio',color_vidrio:'Azul'}},
  {id:30,nombre:'Combo #1',tipo:'Combo',precio_base:500,categoria_pago_id:null,especificaciones_base:{}});
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
      if(name==='costeo_guardar'){const q=a.p;let m=DATOS.modelos.find(x=>q.id?x.id===q.id:x.catalogo_id===q.catalogo_id);if(!m){m={id:100+DATOS.modelos.length,catalogo_id:q.catalogo_id,codigo:'M-0'+(DATOS.modelos.length+1)};DATOS.modelos.push(m);}
        Object.assign(m,{estado:q.estado,categoria_pago_id:q.categoria_pago_id,nota:q.nota,piezas:q.piezas,hojas:q.hojas,rend:q.rend,acc:q.acc,extras:q.extras});return j({id:m.id});}
      if(name==='costeo_pasar_catalogo')return j({catalogo_id:7});
      if(name==='costeo_reglas_guardar'){Object.assign(DATOS.reglas,{despunte:a.p.despunte_cm!=null?a.p.despunte_cm:DATOS.reglas.despunte});return j({ok:true});}
      if(name==='material_fab_guardar'){DATOS.fab.push({id:50,codigo:null,nombre:a.p.nombre,tipo:a.p.tipo,pres:a.p.presentacion,largo:a.p.largo_cm,hoja:null,fijo:null,stock:0,activo:true,retazos:[],sobrantes:[],precios:{}});return j({id:50});}
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
  await p.goto(H+'costos.html');await p.waitForSelector('[data-modelo="7"]');await w();
  const tabs=await p.textContent('#tabs');
  ok('Tres pestañas: Modelos · Plan de corte · Precios (sin Ganancia)',tabs.includes('Plan de corte')&&tabs.includes('Precios')&&!tabs.includes('Ganancia'));
  const l=await p.textContent('#cont');
  ok('Lista por grupos: Listos 1 y Faltan por costear 2',/Listos\s*1/.test(l)&&/Faltan por costear\s*2/.test(l),l.slice(0,200));
  ok('Subtítulo: 1 de 3 modelos listos',(await p.textContent('#subtitulo')).includes('1 de 3 modelos listos'));
  await p.click('[data-filtro="Combos"]');await w();
  ok('Filtro Combos: solo el Combo #1',(await p.textContent('#cont')).includes('Combo #1')&&!(await p.textContent('#cont')).includes('Modelo bitral'));
  await p.click('[data-filtro="Todos"]');await w();
  await p.fill('#buscaModelo','line');await w();
  const bl=await p.textContent('#modLista');
  ok('Buscador: "line" deja solo Lineal Economico',bl.includes('Lineal Economico')&&!bl.includes('Modelo bitral'));
  await p.screenshot({path:'shots4/t46-1-lista.png'});
  // Empezar copiando
  await p.click('[data-modelo="4"]');await p.waitForSelector('#sheetFicha.open');await w();
  const i0=await p.textContent('#fichaBody');
  ok('Sin costear: caja Del Catálogo con lo que trae',i0.includes('Del Catálogo')&&i0.includes('Sin protección')&&i0.includes('Vidrio Azul')&&i0.includes('Puerta Estándar'));
  ok('Tres formas de empezar; copiar del Bitral ya elegido',i0.includes('Copiar de otro modelo')&&i0.includes('Estructura estándar')&&i0.includes('En blanco')&&(await p.textContent('#fichaFoot')).includes('Copiar del Modelo bitral'));
  await p.screenshot({path:'shots4/t46-2-empezar.png'});
  await p.click('[data-empezar]');await w(900);
  const c1=ultimo(rpcs,'costeo_guardar');
  ok('Copiar: guarda el Lineal con los 7 cortes del Bitral',c1&&c1.p.catalogo_id===4&&c1.p.piezas.length===7&&c1.p.estado==='borrador',c1&&c1.p.piezas.length);
  ok('Después de copiar sale la ficha con índice',!!(await p.$('#fichaBody .fi-idx'))&&(await p.textContent('#fichaBody .fi-idx')).includes('Cortes'));
  await p.click('#sheetFicha [data-cerrar="sheetFicha"]');await w(500);
  // Ficha del Bitral en una pantalla
  await p.fill('#buscaModelo','');await w();
  await p.click('[data-modelo="7"]');await p.waitForSelector('#sheetFicha.open');await w();
  const f=await p.textContent('#fichaBody');
  ok('Ficha: cortes por material en metros con su barra dibujada',f.includes('Tubo 1" x 3"')&&f.includes('5,76 m')&&(await p.$$('#s-cortes .barra')).length>=4);
  ok('Ficha: pintura y consumibles a la vista con rinde N puertas',f.includes('Disco de corte 14"')&&f.includes('rinde 3 puertas · general'));
  ok('Ficha: herrajes, mano de obra y extras en la misma pantalla',!!(await p.$('#s-herr'))&&!!(await p.$('#s-obra'))&&!!(await p.$('#s-extras')));
  await p.screenshot({path:'shots4/t46-3-ficha.png'});
  // Pieza con qué es y V/H
  await p.click('#fichaBody [data-pieza="0"]');await p.waitForSelector('#sheetForm.open');await w();
  ok('Hoja Pieza: material con Cambiar (sin listas desplegables)',(await p.textContent('#formBody')).includes('Cambiar')&&!(await p.$('#formBody select')));
  await p.click('#formBody [data-f-pick="si"]');await w();await p.fill('#fBuscaMat','1" x 2');await w();
  ok('Buscador de material',(await p.textContent('#listaMat')).includes('Tubo 1" x 2"')&&!(await p.textContent('#listaMat')).includes('Platina'));
  await p.fill('#fBuscaMat','');await w();await p.click('#formBody [data-f-mat="1"]');await w();
  await p.click('#btnForm');await w(200);
  ok('Sin "qué es" no guarda y marca el campo',await p.$eval('#c_fQue',x=>x.classList.contains('invalid')));
  await p.click('#formBody [data-f-que="Bastidor"]');await w(150);await p.click('#formBody [data-f-ori="V"]');await w(150);
  await p.screenshot({path:'shots4/t46-4-pieza.png'});
  await p.click('#btnForm');await w(900);
  const c2=ultimo(rpcs,'costeo_guardar');
  ok('Pieza guardada con qué es y V en costeo_guardar',c2&&JSON.stringify(c2.p.piezas[0])===JSON.stringify([1,2,200,'Bastidor largo','Bastidor','V']),c2&&c2.p.piezas[0]);
  // Consumible del modelo
  await p.click('#fichaBody [data-rend="6"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.fill('#fRend','6');await p.click('#btnForm');await w(900);
  const c3=ultimo(rpcs,'costeo_guardar');
  ok('Disco 14" rinde 6 solo en este modelo',c3&&Number(c3.p.rend['6'])===6);
  ok('La ficha dice "de este modelo"',(await p.textContent('#fichaBody')).includes('rinde 6 puertas · de este modelo'));
  await p.click('#fichaBody [data-rend="6"]');await p.waitForSelector('#sheetForm.open');await w();
  ok('Volver al general',(await p.textContent('#formFoot')).includes('Usar el general'));
  await p.click('#btnBorrar');await w(900);
  ok('Usar el general quita el del modelo',!('6' in ultimo(rpcs,'costeo_guardar').p.rend));
  // Precio y Usar en el catálogo
  const ff=await p.textContent('#fichaFoot');
  ok('Precio abajo: $6.79 abajo del catálogo',ff.includes('$326.79')&&ff.includes('$6.79 abajo del catálogo'),ff);
  await p.click('[data-precio]');await p.waitForSelector('#sheetForm.open');await w();
  const t=await p.textContent('#formBody');
  ok('DATO DE CONTROL: $223.22 · $290.19 · $326.79 · barra completa $339.23',t.includes('$223.22')&&t.includes('$290.19')&&t.includes('$326.79')&&t.includes('$339.23'));
  ok('Hoy en catálogo $320: ganas $60.18 por puerta (27 %)',t.includes('$320')&&t.includes('$60.18')&&t.includes('27 %'));
  await p.screenshot({path:'shots4/t46-5-precio.png'});
  ok('Botón Usar $326.79 en el catálogo',(await p.textContent('#btnForm')).includes('Usar $326.79 en el catálogo'));
  await p.click('#btnForm');await w();
  ok('Pide el precio con el sugerido puesto',(await p.inputValue('#fPrecio'))==='326.79');
  await p.click('#btnForm');await w(900);
  ok('Usar en el catálogo llama a costeo_pasar_catalogo',JSON.stringify(ultimo(rpcs,'costeo_pasar_catalogo'))===JSON.stringify({mid:1,p_precio:326.79}),ultimo(rpcs,'costeo_pasar_catalogo'));
  await p.evaluate(()=>{document.querySelectorAll('.sheet.open').forEach(s=>s.classList.remove('open'));document.querySelectorAll('.sheet-scrim').forEach(s=>s.classList.remove('open'));});
  // Precios: filtros, consumibles, reglas, material nuevo
  await p.click('#tabs [data-tab="materiales"]');await w();
  await p.click('[data-filp="Consumibles"]');await w();
  ok('Precios › Consumibles con su rendimiento general',(await p.textContent('#cont')).includes('Rinde 3 puertas (general)'));
  await p.click('[data-reglas]');await p.waitForSelector('#sheetForm.open');await w();
  ok('Reglas: IVA, ganancia, grosor, despunte y puertas al mes; gastos fijos en Finanzas',!!(await p.$('#rDesp'))&&!!(await p.$('#rCorte'))&&!!(await p.$('#rPuertas'))&&(await p.textContent('#formBody')).includes('Finanzas › Gastos'));
  await p.screenshot({path:'shots4/t46-6-reglas.png'});
  await p.fill('#rDesp','1,5');await p.click('#btnForm');await w(900);
  ok('Guarda solo el despunte que cambió',JSON.stringify(ultimo(rpcs,'costeo_reglas_guardar'))===JSON.stringify({p:{despunte_cm:1.5}}),ultimo(rpcs,'costeo_reglas_guardar'));
  await p.click('[data-filp="hierro"]');await w();
  await p.click('[data-mat="nuevo"]');await p.waitForSelector('#sheetForm.open');await w();
  await p.fill('#mNom','Tubo 2" x 2"');await p.click('#btnForm');await w(900);
  const mf=ultimo(rpcs,'material_fab_guardar');
  ok('+ Material nuevo aquí (no en Depósito): barra de 600 cm',mf&&mf.p.nombre==='Tubo 2" x 2"'&&mf.p.tipo==='hierro'&&mf.p.presentacion==='barra'&&mf.p.largo_cm===600,mf);
  ok('Después pide sus precios',(await p.textContent('#formTitulo')).includes('Tubo 2" x 2"'));
  ok('Sin errores de JavaScript',err.length===0,err);
 }catch(e){ ok('CORTE: '+e.message,false); }
 await b.close(); res.forEach(r=>console.log(r)); console.log(fallas?('FALLAS: '+fallas):'TODO OK'); process.exit(fallas?1:0);
})();
