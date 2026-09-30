// Depósito: materiales, entregar en 2 pasos, entregas por semana, revisión de Ray, compras y pendientes en Inicio
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const H='http://127.0.0.1:8765/';
const PERF={
  u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',activo:true,confirma_abonos:false},
  u2:{id:'u2',usuario:'ray',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true},
  t1:{id:'t1',usuario:'pedro',nombre:'Pedro',rol:'trabajador',activo:true}
};
const lunes=(d)=>{const t=new Date(d);t.setHours(0,0,0,0);t.setDate(t.getDate()+1);t.setDate(t.getDate()-((t.getDay()+6)%7));return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');};
const hace=(dias)=>new Date(Date.now()-dias*864e5).toISOString();
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
function base(){return {
  materiales:[{id:1,nombre:'Disco de corte',stock:2,minimo:3,oficio:'hierro',activo:true,costo_unidad:5},{id:2,nombre:'Sierra',stock:0,minimo:1,oficio:null,activo:true,costo_unidad:null},{id:3,nombre:'Pintura negra',stock:10,minimo:2,oficio:'pintura',activo:true,costo_unidad:12}],
  entregas:[
    {id:2,material_id:1,trabajador_id:'t1',trabajador:'Pedro',entregado_por:'Yulimar',fecha:hace(0),semana:lunes(Date.now()),nota:'Se le partió',estado:'por_revisar',rara:true,rara_motivo:'Con la anterior hizo 2 trabajos; lo normal para él es 8',revisado_por:null,revisado_en:null,revision_nota:null,trabajos:1,abierta:true},
    {id:1,material_id:1,trabajador_id:'t1',trabajador:'Pedro',entregado_por:'Yulimar',fecha:hace(14),semana:lunes(Date.now()-14*864e5),nota:null,estado:'aprobada',rara:false,rara_motivo:null,revisado_por:'Ray',revisado_en:hace(13),revision_nota:null,trabajos:8,abierta:false}],
  compras:[{id:1,material_id:1,cantidad:10,costo:50,nota:'Ferretería',fecha:hace(20),por:'Ray'}],
  trabajadores:[{id:'t1',nombre:'Pedro',especialidades:['herrero'],pendientes:[{oficio:'hierro',especialidad:'herrero',n:3},{oficio:'pintura',especialidad:'masilla_pintura',n:2}]},{id:'t2',nombre:'Luis',especialidades:['masilla_pintura']}]};}
const trabajos=[{id:501,etapa:'Hierro',producto:'Lineal',tipo:'Puerta Multilock',cantidad:1,venta_id:12,interna:false,cliente:'María González',sede:'Cumbres',fecha:hace(0),foto:GIF,foto_de:'Negro',foto_trabajo:GIF,especificaciones:{color:'Negro',alto:2,ancho:1},categoria:'Puertas',monto:40,oficio:'hierro'},
 {id:502,etapa:'Hierro',producto:'Imperial',tipo:'Puerta Multilock',cantidad:1,venta_id:0,interna:true,cliente:null,sede:'Cumbres',fecha:hace(1),foto:GIF,foto_de:'Blanco',foto_trabajo:null,especificaciones:{},categoria:null,monto:40,oficio:'hierro'}];

async function pagina(b,uid){
  const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
  const user={id:uid,aud:'authenticated',role:'authenticated',email:PERF[uid].usuario+'@artesanos.app',user_metadata:{}};
  const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
  const ctx=await b.newContext({...devices['iPhone 13']});
  const st={rpcs:[],datos:base(),err:[]};
  const admin=PERF[uid].rol==='admin', ray=!!PERF[uid].confirma_abonos;
  await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
    if(u.includes('/auth/v1/token'))return j(sesion);
    if(u.includes('/auth/v1/user'))return j(user);
    if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');st.rpcs.push([name,a]);
      const d=st.datos;
      if(name==='deposito_resumen'){const x=JSON.parse(JSON.stringify(d));if(!admin){x.compras=[];x.materiales.forEach(m=>m.costo_unidad=null);}x.es_admin=admin;x.es_ray=ray;return j(x);}
      if(name==='deposito_trabajos')return j(a.eid===2||a.eid===1?trabajos.map(t=>{const c=Object.assign({},t);if(!admin)delete c.monto;return c;}):[]);
      if(name==='deposito_entregar'){const m=d.materiales.find(x=>x.id===a.mid);m.stock--;const t=d.trabajadores.find(x=>x.id===a.tid);d.entregas.unshift({id:3,material_id:a.mid,trabajador_id:a.tid,trabajador:t.nombre,entregado_por:PERF[uid].nombre,fecha:new Date().toISOString(),semana:lunes(Date.now()),nota:a.nota,estado:'por_revisar',rara:false,trabajos:0,abierta:true});return j({id:3,stock:m.stock,rara:false});}
      if(name==='deposito_revisar'){const e=d.entregas.find(x=>x.id===a.eid);e.estado=a.aprobar?'aprobada':'cuestionada';e.revisado_por='Ray';e.revisado_en=new Date().toISOString();e.revision_nota=a.nota;return j({id:a.eid});}
      if(name==='deposito_material_guardar'){if(a.p.id){Object.assign(d.materiales.find(x=>x.id===a.p.id),a.p);}else d.materiales.push(Object.assign({id:9,stock:0,activo:true},a.p));return j({id:a.p.id||9});}
      if(name==='deposito_comprar_varios'){a.items.forEach(x=>{d.materiales.find(m=>m.id===x.mid).stock+=x.cantidad;});return j({factura:1,materiales:a.items.length});}
      if(name==='deposito_comprar'){const m=d.materiales.find(x=>x.id===a.mid);m.stock+=a.cantidad;d.compras.unshift({id:2,material_id:a.mid,cantidad:a.cantidad,costo:a.costo,nota:a.nota,fecha:new Date().toISOString(),por:'Ray'});return j({id:a.mid,stock:m.stock});}
      if(name==='nomina_semana')return j({trabajadores:[]});
      return j([]);}
    if(u.includes('/deposito_entregas'))return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'*/'+st.datos.entregas.filter(e=>e.estado==='por_revisar').length},body:''});
    if(u.includes('/materiales'))return j(st.datos.materiales.filter(m=>m.activo).map(m=>({id:m.id,nombre:m.nombre,stock:m.stock,minimo:m.minimo})));
    if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(PERF[uid]); return j([PERF.u2,PERF.u3].map(p=>({usuario:p.usuario,nombre:p.nombre,rol:p.rol,orden:1})));}
    if(u.includes('/abonos'))return j([]);
    return j([]);});
  const p=await ctx.newPage();p.on('pageerror',e=>st.err.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');
  await p.click(`.quien-btn:has-text("${PERF[uid].nombre}")`).catch(async()=>{await p.click('.quien-btn');});
  for(const d of '123456') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(900);
  return {p,st};
}

(async()=>{ const b=await chromium.launch(); try{
 // ===== Yulimar (vendedora) =====
 const {p,st}=await pagina(b,'u3');const w=ms=>p.waitForTimeout(ms||400);
 ok('Inicio: la vendedora ve el módulo Depósito con lo que hay por reponer',(await p.textContent('#cuenta-deposito')).includes('2 por reponer'),await p.textContent('#cuenta-deposito'));
 ok('Inicio: pendiente "materiales por reponer" (no ve las de revisar: eso es de Ray)',(await p.textContent('#avisosAdmin')).includes('2 materiales por reponer')&&!(await p.textContent('#avisosAdmin')).includes('por revisar'));
 await p.click('a.ini-tile[href="deposito.html"]');await p.waitForURL('**/deposito.html');await p.waitForSelector('.mat');await w(500);
 ok('Subtítulo con lo pendiente',(await p.textContent('#subtitulo'))==='2 por reponer · 1 entrega por revisar',await p.textContent('#subtitulo'));
 ok('Resumen: por reponer y unidades',(await p.textContent('.res')).replace(/\s+/g,' ').includes('Materiales por reponer2')&&(await p.textContent('.res')).replace(/\s+/g,' ').includes('Unidades en depósito12'),(await p.textContent('.res')).replace(/\s+/g,' '));
 const fil=await p.$$eval('.mat',x=>x.map(y=>y.textContent.replace(/\s+/g,' ').trim()));
 ok('Materiales: faltan / agotado en rojo',fil[0].includes('Disco de corte')&&fil[0].includes('Faltan 1')&&fil[1].includes('Agotado'),fil);
 await p.screenshot({path:'shots5/d1-materiales.png'});
 // Ficha del material: sin costos ni compras para la vendedora
 await p.click('.mat[data-mat="1"]');await w(500);
 const mb=await p.textContent('#matBody');
 ok('Ficha: en depósito, mínimo y faltan',mb.includes('En depósito2')&&mb.includes('Faltan1'),mb.slice(0,80));
 ok('Rinde por trabajador: Pedro 8 c/u',mb.includes('Pedro')&&mb.includes('8 c/u')&&mb.includes('tiene uno desde el'));
 ok('Movimientos por semana: esta abierta, las demás cerradas',(await p.$$eval('#matBody details.sem',x=>x.map(d=>d.open))).join()==='true,false',await p.$$eval('#matBody details.sem',x=>x.map(d=>d.querySelector('summary').textContent.replace(/\s+/g,' ').trim())));
 ok('La vendedora no ve costos ni compras, ni "Registrar compra"',!mb.includes('Compra')&&!mb.includes('$')&&!(await p.$('[data-comprar]'))&&!(await p.$('[data-editar-mat]'))&&!!(await p.$('[data-reponer]')));
 await p.screenshot({path:'shots5/d2-ficha-material.png'});
 await p.click('#sheetMat [data-cerrar="sheetMat"]');await w(500);
 // Entregar: paso 1 materiales
 await p.click('#btnEntregar');await w(500);
 ok('Entregar: primero el material; el agotado no se entrega y ofrece avisar',!(await p.$('[data-elegir-mat="2"]'))&&(await p.textContent('[data-agotado="2"]')).includes('Avisar para comprar')&&(await p.textContent('#entregarTitulo'))==='¿Qué vas a entregar?'&&(await p.textContent('[data-elegir-mat="1"]')).includes('por reponer'));
 await p.screenshot({path:'shots5/d3-entregar-1.png'});
 await p.click('[data-agotado="2"]');await w(600);
 ok('La vendedora avisa que hay que comprar la sierra',st.rpcs.some(x=>x[0]==='deposito_pedir_reponer'&&x[1].mid===2)&&(await p.textContent('#toast')).includes('hay que comprar Sierra'));
 await p.click('[data-elegir-mat="1"]');await w(300);
 ok('Paso 2: a quién, con lo que hizo desde la última vez',(await p.textContent('#entregarTitulo'))==='¿A quién se lo das?'&&(await p.textContent('[data-elegir-trab="t1"]')).includes('hizo 1 trabajo · tiene 3 pendientes')&&(await p.textContent('[data-elegir-trab="t2"]')).includes('No ha recibido este material'));
 ok('Va 1 unidad',(await p.textContent('.elegido')).includes('Va 1 unidad · quedan 2'));
 await p.click('#btnConfirmarEntrega');await w(300);
 ok('Sin trabajador no entrega',await p.$eval('#campoTrab',x=>x.classList.contains('invalid'))&&!st.rpcs.some(x=>x[0]==='deposito_entregar'));
 await p.click('[data-elegir-trab="t2"]');await p.fill('#entNota','Para el portón');
 await p.screenshot({path:'shots5/d4-entregar-2.png'});
 await p.click('#btnConfirmarEntrega');await w(1000);
 const en=st.rpcs.find(x=>x[0]==='deposito_entregar');
 ok('Entrega: manda material, trabajador, nota y clave',en&&en[1].mid===1&&en[1].tid==='t2'&&en[1].nota==='Para el portón'&&/^[0-9a-f-]{36}$/.test(en[1].clave),en&&en[1]);
 ok('Se cierra, avisa y baja el stock',!(await p.isVisible('#sheetEntregar'))&&(await p.textContent('#toast')).includes('Queda por revisar')&&(await p.textContent('.mat[data-mat="1"] .mat-n b'))==='1');
 // Entregas
 await p.click('[data-tab="entregas"]');await w(400);
 const sems=await p.$$eval('#cont .sem',x=>x.map(s=>[s.open,s.querySelector('.sem-t').textContent]));
 ok('Entregas por semana: esta abierta, las viejas cerradas',sems.length===2&&sems[0][0]===true&&sems[0][1]==='Esta semana'&&sems[1][0]===false,sems);
 ok('Mostrar: Todas, Por revisar con número y por trabajador',(await p.$$eval('#filtros .fx',x=>x.map(c=>c.textContent))).join('|')==='Todas|Por revisar · 2|Luis|Pedro',await p.$$eval('#filtros .fx',x=>x.map(c=>c.textContent)));
 ok('Marca la rara y el estado',(await p.textContent('[data-entrega="2"]')).includes('Rara')&&(await p.textContent('[data-entrega="2"]')).includes('Por revisar'));
 await p.screenshot({path:'shots5/d5-entregas.png'});
 await p.click('#filtros [data-filtro="t1"]');await w(300);
 ok('Por trabajador: lo que recibió y cuánto le rinde',(await p.textContent('.trab-res')).includes('Disco de corte · 2 recibidos')&&(await p.textContent('.trab-res')).includes('8 trabajos c/u'));
 await p.click('#filtros [data-filtro="revisar"]');await w(300);
 ok('Por revisar: solo las pendientes',(await p.$$('.ent')).length===2);
 ok('En la lista: lo que hizo con el anterior',(await p.textContent('[data-entrega="2"]')).includes('con el anterior hizo 8 trabajos'),await p.textContent('[data-entrega="2"]'));
 // Revisión: la vendedora ve los trabajos pero no puede aprobar
 await p.click('[data-entrega="2"]');await w(900);
 ok('Entrega: datos, rara y nota',(await p.textContent('#entregaBody')).includes('Se ve rara')&&(await p.textContent('#entregaBody')).includes('Se le partió')&&(await p.textContent('#entregaTitulo'))==='Disco de corte a Pedro');
ok('Entrega: arriba lo que hizo con el anterior, su promedio no (solo 1 cerrada) y sus pendientes',(await p.textContent('#entregaBody .d-datos')).replace(/\s+/g,'').includes('Conelanterior8trabajos')&&(await p.textContent('#entregaBody')).includes('Tiene 3 trabajos pendientes de Hierro'));
 ok('Lista del anterior como en Nómina: foto, paso, producto, cliente y N°',(await p.$$('#entregaBody [data-lista="anterior"]')).length===2&&(await p.textContent('[data-lista="anterior"][data-trabajo="0"]')).includes('Hierro · Lineal')&&(await p.textContent('[data-lista="anterior"][data-trabajo="0"]')).includes('María González · N° 12')&&(await p.textContent('#entregaBody')).includes('Lo que hizo con el disco de corte anterior'));
 ok('Ya no muestra lo que lleva con la nueva',!(await p.$('#entregaBody [data-lista="esta"]')));
 ok('Solo Ray aprueba',(await p.textContent('#entregaFoot')).includes('Solo Ray')&&!(await p.$('[data-rev]')));
 await p.screenshot({path:'shots5/d6-revision-vendedora.png'});
 await p.click('[data-trabajo="0"]');await w(500);
 ok('Detalle del trabajo sin el pago (vendedora)',await p.isVisible('#sheetItem')&&(await p.textContent('#itemBody')).includes('Ver la venta N° 12')&&!(await p.textContent('#itemBody')).includes('Pago por esta parte'));
 await p.click('#sheetItem [data-cerrar="sheetItem"]');await w(400);await p.click('#sheetEntrega [data-cerrar="sheetEntrega"]');await w(400);
 await p.click('[data-tab="materiales"]');await w(300);
 ok('La vendedora no agrega materiales',!(await p.$('[data-nuevo-mat]')));
 ok('Errores JS (vendedora)',!st.err.length,st.err);
 await p.context().close();

 // ===== Ray: revisa y registra compras =====
 const R=await pagina(b,'u2');const r=R.p;const wr=ms=>r.waitForTimeout(ms||400);
 ok('Inicio de Ray: "1 entrega por revisar"',(await r.textContent('#avisosAdmin')).includes('1 entrega por revisar'),await r.textContent('#avisosAdmin'));
 await r.goto(H+'deposito.html?entrega=2');await r.waitForSelector('#sheetEntrega.open');await wr(900);
 ok('El aviso abre esa entrega',(await r.textContent('#entregaTitulo'))==='Disco de corte a Pedro'&&!!(await r.$('[data-rev="aprobar"]'))&&!!(await r.$('[data-rev="cuestionar"]')));
 await r.click('[data-rev="cuestionar"]');await wr(300);
 await r.click('[data-rev="enviar"]');await wr(300);
 ok('Cuestionar pide qué pasó',await r.$eval('#campoCuestion',x=>x.classList.contains('invalid'))&&!R.st.rpcs.some(x=>x[0]==='deposito_revisar'));
 await r.fill('#revNota','Pidió muy seguido');
 await r.screenshot({path:'shots5/d8-cuestionar.png'});
 await r.click('[data-rev="enviar"]');await wr(900);
 const rv=R.st.rpcs.find(x=>x[0]==='deposito_revisar');
 ok('Cuestiona con la nota',rv&&rv[1].eid===2&&rv[1].aprobar===false&&rv[1].nota==='Pidió muy seguido',rv&&rv[1]);
 ok('Queda cuestionada y se puede aprobar después',(await r.textContent('#entregaBody')).includes('Cuestionada por Ray')&&!!(await r.$('[data-rev="aprobar"]'))&&!(await r.$('[data-rev="cuestionar"]')));
 await r.click('[data-trabajo="0"]');await wr(500);
 ok('Ray sí ve el pago del trabajo',(await r.textContent('#itemBody')).includes('Pago por esta parte'));
 await r.click('#sheetItem [data-cerrar="sheetItem"]');await wr(400);await r.click('#sheetEntrega [data-cerrar="sheetEntrega"]');await wr(400);
 await r.click('[data-tab="materiales"]');await wr(300);
 await r.click('.mat[data-mat="1"]');await wr(500);
 ok('Admin ve costo y compras',(await r.textContent('#matBody')).includes('Última compra: $5')&&(await r.textContent('#matBody')).includes('Compra · Ferretería'));
 await r.click('[data-comprar]');await wr(400);
 await r.fill('#compraCant','0');await r.click('#btnGuardarCompra');await wr(300);
 ok('Compra: cantidad entera mayor a 0',await r.$eval('#campoCompraCant',x=>x.classList.contains('invalid')));
 await r.fill('#compraCant','6');await r.fill('#compraCosto','30');await r.fill('#compraNota','Ferretería Zulia');
 await r.screenshot({path:'shots5/d9-compra.png'});
 await r.click('#btnGuardarCompra');await wr(900);
 const cp=R.st.rpcs.find(x=>x[0]==='deposito_comprar');
 ok('Guarda la compra y sube el stock',cp&&cp[1].mid===1&&cp[1].cantidad===6&&cp[1].costo===30&&(await r.textContent('#matBody')).includes('En depósito8'),cp&&cp[1]);
 // Compra grande
 await r.click('#sheetMat [data-cerrar="sheetMat"]');await wr(500);
 await r.click('[data-compra-grande]');await wr(500);
 await r.click('#btnGuardarCg');await wr(300);
 ok('Compra grande: pide al menos una cantidad',await r.$eval('#campoCg',x=>x.classList.contains('invalid')));
 await r.fill('#cg1','10');await r.fill('#cg3','4');await r.fill('#cgCosto','95,50');await r.fill('#cgNota','Factura 12');
 await r.screenshot({path:'shots5/d10-compra-grande.png'});
 await r.click('#btnGuardarCg');await wr(900);
 const cg=R.st.rpcs.find(x=>x[0]==='deposito_comprar_varios');
 ok('Compra grande: guarda varios materiales con el costo total',cg&&JSON.stringify(cg[1].items)==='[{"mid":1,"cantidad":10},{"mid":3,"cantidad":4}]'&&cg[1].costo_total===95.5&&cg[1].nota==='Factura 12',cg&&cg[1]);
 await r.click('.mat[data-mat="1"]');await wr(500);

 // Nuevo material (solo admin)
 await r.click('#sheetMat [data-cerrar="sheetMat"]');await wr(500);
 await r.click('[data-nuevo-mat]');await wr(400);
 await r.fill('#mfMin','1.5');await r.click('#btnGuardarMat');await wr(300);
 ok('Material: pide nombre y mínimo entero',await r.$eval('#campoMatNombre',x=>x.classList.contains('invalid'))&&await r.$eval('#campoMatMin',x=>x.classList.contains('invalid')));
 await r.fill('#mfNombre','Masilla');await r.fill('#mfMin','4');await r.click('#matFormBody [data-oficio="masilla"]');
 await r.screenshot({path:'shots5/d7-nuevo-material.png'});
 await r.click('#btnGuardarMat');await wr(900);
 const mg=R.st.rpcs.find(x=>x[0]==='deposito_material_guardar');
 ok('Guarda el material con su oficio',mg&&mg[1].p.nombre==='Masilla'&&mg[1].p.minimo===4&&mg[1].p.oficio==='masilla'&&mg[1].p.id===null,mg&&mg[1]);
 ok('Errores JS (Ray)',!R.st.err.length,R.st.err);
 console.log(res.join('\n'));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
