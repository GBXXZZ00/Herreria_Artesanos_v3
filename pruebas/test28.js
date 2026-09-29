// Recorrido completo, de punta a punta, con varias personas a la vez y una base simulada
// que recuerda todo (lo que hace uno lo ve el otro):
// Gualfredo crea el modelo → Yulimar lo vende con pago → Ray confirma el pago (pasa solo a
// producción) → Ray asigna cada etapa → Jesús la ve con foto y la termina → el pedido queda
// Listo → Jesús ve lo que ganó, pide un vale y Ray lo aprueba → el cliente ve su seguimiento
// → Yulimar lo entrega.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const FOTO=fs.readFileSync(__dirname+'/foto-puerta.png');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

// ---------------- Base simulada ----------------
const PERFILES={
  u1:{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',sede_id:1,confirma_abonos:false,activo:true,orden:1},
  u2:{id:'u2',usuario:'raymundo',nombre:'Ray',rol:'admin',sede_id:1,confirma_abonos:true,activo:true,orden:2},
  u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1,confirma_abonos:false,activo:true,orden:3},
  u5:{id:'u5',usuario:'jesus',nombre:'Jesús',rol:'trabajador',sede_id:1,confirma_abonos:false,activo:true,orden:5,especialidades:['herrero','masilla_pintura','acabados']}
};
const DB={
  categorias:[{id:1,nombre:'Puertas',tarifas:{herrero:{monto:20,modo:'fijo'},masilla_pintura:{monto:15,modo:'fijo'},acabados:{monto:5,modo:'fijo'}},activo:true}],
  modelos:[], ventas:[], clientes:[], abonos:[], etapas:[], vales:[], notifs:[], sec:{m:40,v:14,a:30,e:900,i:300,vale:1}
};
const TOKEN='aaaaaaaa-bbbb-4ccc-8ddd-0000000000e2';
const iso=()=>new Date().toISOString();
const itemsDe=vid=>DB.ventas.find(v=>v.id===vid).items;
const etapasDeItem=iid=>DB.etapas.filter(e=>e.venta_item_id===iid).sort((a,b)=>a.orden-b.orden);
const montoDe=(it,esp)=>{const c=DB.categorias.find(x=>x.id===it.categoria_pago_id);const t=c&&c.tarifas[esp];return t?t.monto*it.cantidad:null;};
function ventaCompleta(v){
  return Object.assign({},v,{
    cliente:DB.clientes.find(c=>c.id===v.cliente_id)||null, sede:{id:1,nombre:'Cumbres de Maracaibo'},
    abonos:DB.abonos.filter(a=>a.venta_id===v.id),
    items:v.items.map(it=>Object.assign({},it,{etapas:etapasDeItem(it.id).map(e=>Object.assign({},e,{trabajador:e.trabajador_id?{nombre:PERFILES[e.trabajador_id].nombre}:null}))}))
  });
}
const llamadas=[];

function mock(ctx,user){return ctx.route('**/*.supabase.co/**',async r=>{
  const req=r.request();const u=decodeURIComponent(req.url());const m=req.method();
  const uno=(req.headers()['accept']||'').includes('vnd.pgrst.object');
  const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-0/*',...h},body:JSON.stringify(x)});
  const head=n=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  const body=()=>{try{return JSON.parse(req.postData()||'{}');}catch(e){return {};}};
  const P=PERFILES[user];
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/storage/v1/object/public/'))return r.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:FOTO});
  if(u.includes('/storage/v1/object/sign/'))return j({signedURL:'/object/public/comprobantes/x.png'});
  if(u.includes('/storage/v1/object/'))return j({Key:'x'});
  if(u.includes('/rpc/')){
    const name=u.split('/rpc/')[1].split('?')[0];const a=body();llamadas.push([name,a,user]);
    if(name==='crear_venta'){
      const p=a.p;let cli=DB.clientes.find(c=>c.cedula===p.cliente.cedula);
      if(!cli){cli={id:DB.clientes.length+3,nombre:p.cliente.nombre,cedula:p.cliente.cedula,telefono:p.cliente.telefono};DB.clientes.push(cli);}
      const vid=++DB.sec.v;
      const items=p.items.map((x,i)=>{const mo=DB.modelos.find(z=>z.id===x.catalogo_id);return Object.assign({id:++DB.sec.i,venta_id:vid,orden:i,pieza_id:null,a_medida:false,foto:null},x,{categoria_pago_id:mo?mo.categoria_pago_id:null});});
      const total=items.reduce((s,x)=>s+x.precio_unitario*x.cantidad,0);
      const conf=!!p.venta.confirmar;
      DB.ventas.push({id:vid,cliente_id:cli.id,estado:conf?'confirmada':'cotizacion',interna:false,sede_id:1,vendedor_id:user,descuento:0,instalacion:0,traslado:0,subtotal:total,total,
        fecha_entrega:p.venta.fecha_entrega||null,confirmada_en:conf?iso():null,creado_en:iso(),actualizado_en:iso(),vence_en:null,token_seguimiento:TOKEN,items});
      if(conf) DB.abonos.push({id:++DB.sec.a,venta_id:vid,tipo:'abono',monto:p.abono.monto,metodo:p.abono.metodo,comprobante:p.abono.comprobante,estado:'por_confirmar',registrado_por:user,fecha:iso()});
      return j({id:vid,estado:conf?'confirmada':'cotizacion',total,cliente_id:cli.id});
    }
    if(name==='confirmar_abono'){
      if(!P.confirma_abonos)return j({message:'Solo Ray confirma los pagos'},400);
      const ab=DB.abonos.find(x=>x.id===a.aid);if(ab.estado!=='por_confirmar')return j({message:'Este pago ya fue revisado'},400);
      ab.estado=a.llego?'confirmado':'rechazado';ab.confirmado_por=user;ab.confirmado_en=iso();ab.nota_confirmacion=a.nota;
      const v=DB.ventas.find(x=>x.id===ab.venta_id);let prod=false;
      if(a.llego&&v.estado==='confirmada'){
        v.estado='en_produccion';v.produccion_en=iso();prod=true;
        v.items.forEach(it=>['Hierro:herrero','Masilla y pintura:masilla_pintura','Detalles:acabados'].forEach((s,k)=>{const [nombre,esp]=s.split(':');
          DB.etapas.push({id:++DB.sec.e,venta_item_id:it.id,rama:'principal',nombre,orden:k+1,especialidad:esp,estado:'pendiente',trabajador_id:null,foto:null,terminada_en:null,iniciada_en:null,monto:null});}));
      }
      return j({id:a.aid,estado:ab.estado,produccion:prod});
    }
    if(name==='cambiar_estado_venta'){
      const v=DB.ventas.find(x=>x.id===a.vid);
      if(a.nuevo==='en_produccion')return j({message:'El pedido pasa solo a producción cuando Ray confirma el pago'},400);
      v.estado=a.nuevo;v[a.nuevo+'_en']=iso();return j({id:v.id,estado:v.estado});
    }
    if(name==='cancelar_venta')return j({message:'Solo un administrador puede cancelar una venta'},400);
    if(name==='asignar_etapa'){const e=DB.etapas.find(x=>x.id===a.eid);e.trabajador_id=a.tid;DB.notifs.push({para:a.tid,titulo:'Nuevo trabajo'});return j(null);}
    if(name==='mis_trabajos'){
      const out=[];
      DB.ventas.filter(v=>v.estado==='en_produccion').forEach(v=>v.items.forEach(it=>etapasDeItem(it.id).forEach(e=>{
        if(e.trabajador_id!==user||e.estado!=='pendiente')return;
        const antes=etapasDeItem(it.id).find(x=>x.orden<e.orden&&x.estado==='pendiente');
        const mo=DB.modelos.find(z=>z.id===it.catalogo_id);
        out.push({id:e.id,nombre:e.nombre,especialidad:e.especialidad,rama:e.rama,iniciada_en:e.iniciada_en,venta_id:v.id,interna:false,fecha_entrega:v.fecha_entrega,
          producto:it.nombre,tipo:it.tipo,cantidad:it.cantidad,foto:it.foto||(mo&&(mo.fotos[it.especificaciones.color]||Object.values(mo.fotos)[0]))||null,
          color:it.especificaciones.color,especificaciones:it.especificaciones,espera:antes?antes.nombre:null,monto:montoDe(it,e.especialidad)});
      })));
      return j(out.sort((x,y)=>(x.iniciada_en?0:1)-(y.iniciada_en?0:1)));
    }
    if(name==='empezar_etapa'){
      if(DB.etapas.some(e=>e.trabajador_id===user&&e.iniciada_en&&e.estado==='pendiente'))return j({message:'Primero termina el trabajo que ya empezaste'},400);
      DB.etapas.find(x=>x.id===a.eid).iniciada_en=iso();return j(null);
    }
    if(name==='pausar_etapa'){DB.etapas.find(x=>x.id===a.eid).iniciada_en=null;return j(null);}
    if(name==='marcar_etapa_terminada'){
      const e=DB.etapas.find(x=>x.id===a.eid);const it=DB.ventas.flatMap(v=>v.items).find(x=>x.id===e.venta_item_id);
      if(etapasDeItem(it.id).some(x=>x.orden<e.orden&&x.estado==='pendiente'))return j({message:'Primero hay que terminar la etapa anterior'},400);
      e.estado='hecha';e.foto=a.foto_url||null;e.terminada_en=iso();e.iniciada_en=null;e.monto=montoDe(it,e.especialidad);
      const v=DB.ventas.find(x=>x.id===it.venta_id);
      const faltan=DB.etapas.filter(x=>itemsDe(v.id).some(i=>i.id===x.venta_item_id)&&x.estado==='pendiente').length;
      if(!faltan){v.estado='lista';v.lista_en=iso();}
      return j({venta_id:v.id,listo:!faltan,interna:false,monto:e.monto});
    }
    if(name==='mis_pagos'){
      const tr=DB.etapas.filter(e=>e.trabajador_id===user&&e.estado==='hecha').map(e=>{const it=DB.ventas.flatMap(v=>v.items).find(x=>x.id===e.venta_item_id);return {id:e.id,etapa:e.nombre,producto:it.nombre,tipo:it.tipo,ref:'N° '+it.venta_id,fecha:e.terminada_en,monto:e.monto};});
      const va=DB.vales.filter(x=>x.trabajador_id===user&&x.estado==='aprobado').map(x=>({id:x.id,monto:x.monto,nota:x.nota,fecha:x.creado_en}));
      const vp=DB.vales.find(x=>x.trabajador_id===user&&x.estado==='pendiente');
      const lunes=(()=>{const d=new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
      return j({trabajos:tr,vales:va,vale_pendiente:vp?{id:vp.id,monto:vp.monto,fecha:vp.creado_en}:null,
        semanas:tr.length?[{semana:lunes,trabajos:tr.map(x=>Object.assign({},x,{pagado:false})),vales:va.map(x=>Object.assign({},x,{pagado:false})),pagado_en:null}]:[]});
    }
    if(name==='pedir_vale'){DB.vales.push({id:++DB.sec.vale,trabajador_id:user,monto:a.p_monto,nota:a.p_nota,estado:'pendiente',creado_en:iso()});return j({id:DB.sec.vale});}
    if(name==='resolver_vale'){const x=DB.vales.find(z=>z.id===a.vid);x.estado=a.aprobar?'aprobado':'rechazado';return j(null);}
    if(name==='seguimiento_publico'){
      const v=DB.ventas.find(x=>x.token_seguimiento===a.t);if(!v)return j({error:'no_existe'});
      const f=ventaCompleta(v);f.cliente={nombre:f.cliente.nombre,cedula:'V99•••766',telefono:'•••8877'};delete f.token_seguimiento;return j(f);
    }
    return j(null);
  }
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador'))return j([PERFILES.u5]);
    if(u.includes('id=eq'))return j(P);
    if(u.includes('select=id,nombre'))return j(Object.values(PERFILES).map(x=>({id:x.id,nombre:x.nombre})));
    return j([{usuario:P.usuario,nombre:P.nombre,rol:P.rol,orden:1}]);
  }
  if(u.includes('/categorias_pago'))return m==='HEAD'?head(DB.categorias.length):j(DB.categorias);
  if(u.includes('/catalogo')){
    if(m==='HEAD')return head(u.includes('categoria_pago_id=is.null')?DB.modelos.filter(x=>!x.categoria_pago_id).length:DB.modelos.length);
    if(m==='POST'){const bd=body();const mo=Object.assign({id:++DB.sec.m,especificaciones_base:{},caracteristicas:[]},bd);DB.modelos.push(mo);llamadas.push(['crear_modelo',bd,user]);return j(uno?mo:[mo],201);}
    return j(DB.modelos);
  }
  if(u.includes('/disponibles'))return j([]);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true}]);
  if(u.includes('/clientes'))return j(null);
  if(u.includes('/abonos'))return j(DB.abonos.filter(x=>x.estado==='por_confirmar'&&x.tipo==='abono'));
  if(u.includes('/vales'))return j(DB.vales.filter(x=>x.estado==='pendiente').map(x=>Object.assign({},x,{trabajador:{nombre:PERFILES[x.trabajador_id].nombre}})));
  if(u.includes('/ventas')){
    let l=DB.ventas.slice();
    const id=u.match(/[?&]id=eq\.(\d+)/);if(id)l=l.filter(v=>v.id===+id[1]);
    const e=u.match(/[?&]estado=eq\.(\w+)/);if(e)l=l.filter(v=>v.estado===e[1]);
    const ein=u.match(/[?&]estado=in\.\(([^)]*)\)/);if(ein){const s=ein[1].split(',');l=l.filter(v=>s.includes(v.estado));}
    const out=l.map(ventaCompleta);
    return j(uno?(out[0]||null):out);
  }
  return j([]);
});}

async function entrar(b,user,pin){
  const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,user);
  const p=await ctx.newPage();p._err=[];p.on('pageerror',e=>p._err.push(user+': '+e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of pin) await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(600);
  return p;
}
const texto=async(p,sel)=>((await p.textContent(sel))||'').replace(/\s+/g,' ');

(async()=>{ const b=await chromium.launch(); let pags=[]; try{
 // ===== 1) Gualfredo crea el modelo en el catálogo =====
 const g=await entrar(b,'u1','111111');pags.push(g);
 await g.click('a.ini-tile[href="catalogo.html"]');await g.waitForURL('**/catalogo.html');await g.waitForTimeout(800);
 await g.click('#btnNuevo');await g.waitForTimeout(400);await g.click('#tipoGrid [data-elegir="Puerta Multilock"]');await g.waitForTimeout(600);
 await g.fill('#fNombre','Imperial E2E');await g.fill('#fPrecio','300');
 await g.setInputFiles('input[data-foto="Negro"]',{name:'p.png',mimeType:'image/png',buffer:FOTO});await g.waitForTimeout(700);
 await g.click('#btnCategoria');await g.waitForSelector('#sheetCategoria.open');await g.click('#listaCategorias [data-cat="1"]');await g.waitForTimeout(300);
 await g.screenshot({path:'shots5/e1-modelo-form.png'});
 await g.click('#btnGuardar');await g.waitForTimeout(1500);
 const cm=llamadas.find(x=>x[0]==='crear_modelo');
 ok('1. Gualfredo crea el modelo con precio, foto y categoría de pago',cm&&cm[1].nombre==='Imperial E2E'&&cm[1].precio_base===300&&cm[1].categoria_pago_id===1&&!!(cm[1].fotos||{}).Negro,cm&&cm[1]);
 ok('   El modelo aparece en el catálogo',(await texto(g,'#grid')).includes('Imperial E2E'));
 await g.screenshot({path:'shots5/e2-catalogo.png'});
 const mid=DB.modelos[0].id;

 // ===== 2) Yulimar lo vende con pago =====
 const y=await entrar(b,'u3','333333');pags.push(y);
 await y.click('#btnNuevaVenta');await y.waitForURL('**/venta.html');await y.waitForTimeout(900);
 await y.fill('#cCedula','99.887.766');await y.waitForTimeout(700);await y.fill('#cNombre','Carla Prueba');await y.fill('#cTel','04149998877');
 await y.click('#btnAgregar');await y.waitForTimeout(400);await y.click('[data-origen="catalogo"]');await y.waitForTimeout(400);
 await y.click(`[data-modelo="${mid}"]`);await y.waitForTimeout(500);
 ok('2. En la venta el modelo trae su precio del catálogo',(await y.inputValue('#pPrecio'))==='300',await y.inputValue('#pPrecio'));
 await y.click('.opt[data-g="__color"][data-v="Negro"]');await y.waitForTimeout(200);
 await y.click('.opt[data-g="manillon"][data-v="H"]');await y.waitForTimeout(200);
 await y.screenshot({path:'shots5/e3-venta-producto.png'});
 await y.click('#btnProdListo');await y.waitForTimeout(500);
 ok('   El producto queda en la venta con su total',(await y.$$('#items .item')).length===1&&(await texto(y,'#pieTotal'))==='$320',await texto(y,'#pieTotal'));
 await y.click('#btnGuardar');await y.waitForTimeout(500);await y.click('#optVenta');await y.waitForTimeout(600);
 await y.click('[data-metodo="Zelle"]');
 await y.setInputFiles('#aComprobante',{name:'c.png',mimeType:'image/png',buffer:PNG});await y.waitForTimeout(700);
 await y.screenshot({path:'shots5/e4-venta-pago.png'});
 await y.click('#btnConfListo');await y.waitForSelector('.listo',{timeout:10000});await y.waitForTimeout(400);
 const cv=llamadas.find(x=>x[0]==='crear_venta');
 const v=DB.ventas[0];
 ok('   Se guarda la venta Confirmada con su pago por confirmar',cv&&v&&v.estado==='confirmada'&&DB.abonos.length===1&&DB.abonos[0].estado==='por_confirmar'&&v.items[0].especificaciones.color==='Negro');
 ok('   El producto copia la categoría de pago de su modelo',v.items[0].categoria_pago_id===1);
 await y.screenshot({path:'shots5/e5-venta-lista.png'});
 await y.goto(H+'ventas.html?abrir='+v.id);await y.waitForSelector('#sheetFicha.open');await y.waitForTimeout(1200);
 ok('   Yulimar ve "Espera que Ray confirme el pago" y ningún botón de producción',(await texto(y,'#fichaBody .btn-guia.espera')).includes('Espera que Ray confirme el pago')&&!(await y.$('[data-estado="en_produccion"]'))&&!(await y.$('[data-accion="pedir-produccion"]')));
 ok('   Yulimar no puede cancelar la venta',!(await y.$('#fichaBody [data-accion="cancelar"]')));
 await y.screenshot({path:'shots5/e6-ficha-espera.png'});

 // ===== 3) Ray confirma el pago: pasa solo a producción =====
 const r=await entrar(b,'u2','222222');pags.push(r);
 ok('3. Ray ve en Inicio "1 pago por confirmar" en rojo',(await texto(r,'.pend-fila.rojo')).includes('1 pago por confirmar'));
 await r.screenshot({path:'shots5/e7-ray-inicio.png'});
 await r.click('.pend-fila.rojo');await r.waitForSelector('#sheetFicha.open');await r.waitForTimeout(1200);
 ok('   Al tocarlo abre esa venta y le dice "Falta que confirmes el pago"',(await texto(r,'#fichaBody .btn-guia.espera')).includes('Falta que confirmes el pago'));
 await r.click('#fichaBody [data-confirmar]');await r.waitForSelector('#sheetAccion.open');
 await r.screenshot({path:'shots5/e8-confirmar.png'});
 await r.click('#btnAccion');
 const t1=await r.waitForSelector('#toast.show',{timeout:5000}).then(e=>e.textContent()).catch(()=>'');
 ok('   Al confirmar dice que pasó a producción',/pasó a producción/i.test(t1),t1);
 await r.waitForTimeout(1300);
 ok('   La venta ahora está En producción, con 3 etapas creadas',v.estado==='en_produccion'&&DB.etapas.length===3);
 ok('   En la ficha ya no se puede devolver a Confirmada',!(await r.$('#fichaBody [data-retro]')));
 await r.screenshot({path:'shots5/e9-en-produccion.png'});

 // ===== 4) Ray asigna Hierro a Jesús desde el pendiente de Inicio =====
 await r.goto(H+'index.html');await r.waitForSelector('.pend-fila');await r.waitForTimeout(800);
 ok('4. Inicio de Ray: "1 trabajo sin asignar" (naranja) y ya no hay pago por confirmar',(await texto(r,'.pend-fila.naranja')).includes('1 trabajo sin asignar')&&!(await r.$('.pend-fila.rojo')));
 async function asignar(nombre){
   await r.goto(H+'produccion.html?abrir='+v.id);await r.waitForSelector('#sheetFicha.open');await r.waitForTimeout(800);
   await r.click(`[data-asignar][data-nombre="${nombre}"]`);await r.waitForSelector('#sheetAsignar.open');
   await r.click('.fila-t >> text=Jesús');await r.waitForTimeout(700);
 }
 await r.click('.pend-fila.naranja');await r.waitForURL('**/produccion.html**');await r.waitForSelector('.vcard');
 ok('   Producción muestra el pedido de Carla por asignar',(await texto(r,'#lista')).includes('Carla Prueba'));
 await r.screenshot({path:'shots5/e10-produccion.png'});
 await asignar('Hierro');
 ok('   Hierro queda asignado a Jesús y le llega el aviso',DB.etapas[0].trabajador_id==='u5'&&DB.notifs.length===1);
 await r.screenshot({path:'shots5/e11-asignado.png'});

 // ===== 5) Jesús hace cada etapa (Ray asigna la siguiente cuando termina la anterior) =====
 const jz=await entrar(b,'u5','555555');pags.push(jz);
 const etapas=['Hierro','Masilla y pintura','Detalles'];
 for(let k=0;k<etapas.length;k++){
   if(k>0){await asignar(etapas[k]);}
   await jz.goto(H+'index.html');await jz.waitForSelector('.hoy');await jz.waitForTimeout(500);
   const hoy=await texto(jz,'.hoy');
   ok(`5.${k+1} Jesús ve "Te toca: ${etapas[k]}" con la foto, el modelo y el color`,hoy.includes('Te toca: '+etapas[k])&&hoy.includes('Imperial E2E')&&hoy.includes('Color negro')&&!!(await jz.$('.hoy-foto img')),hoy);
   if(k===0){
     await jz.screenshot({path:'shots5/e12-jesus-hoy.png'});
     await jz.click('.hoy-foto');await jz.waitForSelector('#sheetTrabajo.open');await jz.waitForTimeout(400);
     ok('    El detalle muestra foto grande, "Manillón H" y cuánto gana ($20)',!!(await jz.$('#trabajoBody .hero img'))&&(await texto(jz,'#trabajoBody')).includes('Manillón H')&&(await texto(jz,'#trabajoBody')).includes('Ganas $20'));
     await jz.screenshot({path:'shots5/e13-jesus-detalle.png'});
     await jz.click('#trabajoFoot [data-empezar]');await jz.waitForTimeout(900);
   } else {
     await jz.click('.hoy [data-empezar]');await jz.waitForTimeout(900);
   }
   ok(`    Empieza y dice "Hoy estás haciendo"`,(await texto(jz,'.hoy-tit'))==='Hoy estás haciendo');
   if(k===0) await jz.screenshot({path:'shots5/e14-jesus-en-curso.png'});
   await jz.click('.hoy [data-terminar-t]');await jz.waitForSelector('#sheetTerminarT.open');
   await jz.setInputFiles('#tFotoInput',{name:'f.png',mimeType:'image/png',buffer:FOTO});await jz.waitForTimeout(800);
   await jz.click('#btnTConfirmar');
   const tt=await jz.waitForFunction(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('show')&&/Sumaste|terminado/.test(t.textContent)&&t.textContent;},null,{timeout:6000}).then(h=>h.jsonValue()).catch(()=>jz.textContent('#toast'));
   ok(`    Termina con foto y le dice cuánto sumó`,/Sumaste \$(20|15|5)/.test(tt),tt);
   await jz.waitForTimeout(900);
 }
 ok('6. Al terminar la última etapa el pedido queda Listo solo',v.estado==='lista');
 ok('   Las fotos del trabajador quedan guardadas en cada etapa',DB.etapas.every(e=>!!e.foto));
 ok('   Jesús ya no tiene trabajos: mensaje claro',(await texto(jz,'.hoy')).includes('No tienes trabajos asignados'));

 // ===== 6) Pagos del trabajador y vale =====
 await jz.click('#vistaTrabajo [data-ver="pagos"]');await jz.waitForSelector('#sheetPagos.open');
 ok('7. Mis pagos: 3 trabajos esta semana y "Te toca cobrar $40"',(await jz.$$('#pagosBody .pg-mov')).length===3&&(await texto(jz,'.pg-cuenta-total b'))==='$40');
 await jz.screenshot({path:'shots5/e15-jesus-pagos.png',fullPage:true});
 await jz.click('#btnAbrirVale');await jz.waitForSelector('#sheetVale.open');await jz.fill('#valeMonto','10');await jz.fill('#valeNota','pasaje');
 await jz.click('#btnPedirVale');await jz.waitForTimeout(900);
 await r.goto(H+'index.html');await r.waitForSelector('.pend-fila.verde');await r.waitForTimeout(500);
 ok('   Ray ve "1 vale por aprobar · Jesús $10" (verde)',(await texto(r,'.pend-fila.verde')).includes('1 vale por aprobar')&&(await texto(r,'.pend-fila.verde')).includes('Jesús $10'));
 await r.click('.pend-fila.verde');await r.waitForSelector('#sheetVales.open');await r.click('[data-resolver="si"]');await r.waitForTimeout(900);
 await jz.goto(H+'index.html?ver=pagos');await jz.waitForSelector('#sheetPagos.open');await jz.waitForTimeout(500);
 ok('   El vale aprobado sale en rojo y resta: te toca cobrar $30',(await texto(jz,'.pg-mov.vale .pg-mov-m'))==='−$10'&&(await texto(jz,'.pg-cuenta-total b'))==='$30');
 await jz.screenshot({path:'shots5/e16-jesus-vale.png',fullPage:true});

 // ===== 7) El cliente ve su seguimiento =====
 const cc=await b.newContext({...devices['iPhone 13']});await mock(cc,'x');
 const c=await cc.newPage();c._err=[];c.on('pageerror',e=>c._err.push('cliente: '+e.message));pags.push(c);
 await c.goto(H+'seguimiento.html?t='+TOKEN);await c.waitForSelector('.hola');
 ok('8. El cliente ve su pedido listo',(await texto(c,'.hola'))==='Hola, Carla'&&/list[oa]/i.test(await texto(c,'.estado-grande')),await texto(c,'.estado-grande'));
 await c.screenshot({path:'shots5/e17-seguimiento.png',fullPage:true});

 // ===== 8) Yulimar lo entrega =====
 await y.goto(H+'ventas.html?abrir='+v.id);await y.waitForSelector('#sheetFicha.open');await y.waitForTimeout(1200);
 ok('9. Yulimar ve el pedido Listo y "Marcar como Entregada"',(await texto(y,'#fichaBody .btn-guia[data-estado="entregada"]')).includes('Marcar como Entregada'));
 await y.click('#fichaBody .btn-guia[data-estado="entregada"]');await y.waitForTimeout(1200);
 ok('   Queda Entregada',v.estado==='entregada');
 await y.screenshot({path:'shots5/e18-entregada.png'});

 const errs=pags.flatMap(p=>p._err);
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(errs));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(pags.flatMap(p=>p._err||[])));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
