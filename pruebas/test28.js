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
  categorias:[{id:1,nombre:'Puertas',tarifas:{hierro:{monto:20,modo:'fijo'},masilla:{monto:7,modo:'fijo'},pintura:{monto:8,modo:'fijo'},detalles:{monto:5,modo:'fijo'}},activo:true}],
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
DB.pagos=[];
const semanaDe=(x)=>{const d=new Date(x);d.setHours(12);d.setDate(d.getDate()+1);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
function itemNom(e){const it=DB.ventas.flatMap(v=>v.items).find(x=>x.id===e.venta_item_id);const v=DB.ventas.find(x=>x.id===it.venta_id);const mo=DB.modelos.find(z=>z.id===it.catalogo_id);
  return {id:e.id,etapa:e.nombre,producto:it.nombre,tipo:it.tipo,cantidad:it.cantidad,venta_id:v.id,interna:false,cliente:(DB.clientes.find(c=>c.id===v.cliente_id)||{}).nombre,sede:'Cumbres de Maracaibo',
    fecha:e.terminada_en,semana:semanaDe(e.terminada_en),monto:e.monto,foto:mo?Object.values(mo.fotos)[0]:null,foto_trabajo:e.foto,especificaciones:it.especificaciones,categoria:'Puertas'};}
const valeNom=(x)=>({id:x.id,monto:x.monto,nota:x.nota,fecha:x.creado_en,monto_bs:null,tasa:null,semana:semanaDe(x.creado_en)});
const recibo=(q)=>Object.assign({},q,{pagado_por:PERFILES[q.pagado_por].nombre,trabajos:DB.etapas.filter(e=>e.pago_id===q.id).map(itemNom),vales:DB.vales.filter(x=>x.pago_id===q.id).map(valeNom)});

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
        // Reglas nuevas: una puerta pasa por Hierro, Masilla, Pintura y Detalles
        v.items.forEach(it=>['Hierro:herrero:hierro','Masilla:masilla_pintura:masilla','Pintura:masilla_pintura:pintura','Detalles:acabados:detalles'].forEach((s,k)=>{const [nombre,esp,oficio]=s.split(':');
          DB.etapas.push({id:++DB.sec.e,venta_item_id:it.id,rama:'principal',nombre,orden:k+1,especialidad:esp,oficio,incluye:null,despues_de:null,estado:'pendiente',trabajador_id:null,foto:null,terminada_en:null,iniciada_en:null,monto:null});}));
      }
      return j({id:a.aid,estado:ab.estado,produccion:prod});
    }
    if(name==='cambiar_estado_venta'){
      const v=DB.ventas.find(x=>x.id===a.vid);
      if(a.nuevo==='en_produccion')return j({message:'El pedido pasa solo a producción cuando Ray confirma el pago'},400);
      v.estado=a.nuevo;v[a.nuevo+'_en']=iso();return j({id:v.id,estado:v.estado});
    }
    if(name==='cancelar_venta')return j({message:'Solo un administrador puede cancelar una venta'},400);
    if(name==='asignar_etapas'){
      a.p.forEach(c=>{const e=DB.etapas.find(x=>x.id===c.eid);const libre=!etapasDeItem(e.venta_item_id).some(x=>x.rama===e.rama&&x.orden<e.orden&&x.estado==='pendiente');
        if(c.tid&&c.tid!==e.trabajador_id&&libre)DB.notifs.push({para:c.tid,titulo:'Nuevo trabajo'});e.trabajador_id=c.tid;e.para_el=c.tid?c.para:null;});
      return j(a.p.length);}
    if(name==='mis_trabajos'){
      const out=[];
      DB.ventas.filter(v=>v.estado==='en_produccion').forEach(v=>v.items.forEach(it=>etapasDeItem(it.id).forEach(e=>{
        if(e.trabajador_id!==user||e.estado!=='pendiente')return;
        const antes=etapasDeItem(it.id).find(x=>x.orden<e.orden&&x.estado==='pendiente');
        const mo=DB.modelos.find(z=>z.id===it.catalogo_id);
        out.push({id:e.id,nombre:e.nombre,especialidad:e.especialidad,rama:e.rama,unidades:1,para_el:e.para_el||null,notas:v.notas||null,foto_de:it.especificaciones.color,venta_id:v.id,interna:false,fecha_entrega:v.fecha_entrega,
          producto:it.nombre,tipo:it.tipo,cantidad:it.cantidad,foto:it.foto||(mo&&(mo.fotos[it.especificaciones.color]||Object.values(mo.fotos)[0]))||null,
          color:it.especificaciones.color,especificaciones:it.especificaciones,espera:antes?antes.nombre:null,oficio:e.oficio,incluye:e.incluye,monto:montoDe(it,e.oficio||e.especialidad),iniciada_en:e.iniciada_en||null});
      })));
      return j(out.sort((x,y)=>(x.iniciada_en?0:1)-(y.iniciada_en?0:1)||(x.espera?1:0)-(y.espera?1:0)||x.id-y.id));
    }
    if(name==='empezar_etapa'){
      if(DB.etapas.some(e=>e.trabajador_id===user&&e.iniciada_en&&e.estado==='pendiente'))return j({message:'Primero termina el trabajo que ya empezaste'},400);
      DB.etapas.find(x=>x.id===a.eid).iniciada_en=iso();return j(null);
    }
    if(name==='pausar_etapa'){DB.etapas.find(x=>x.id===a.eid).iniciada_en=null;return j(null);}
    if(name==='marcar_etapa_terminada'){
      const e=DB.etapas.find(x=>x.id===a.eid);const it=DB.ventas.flatMap(v=>v.items).find(x=>x.id===e.venta_item_id);
      if(etapasDeItem(it.id).some(x=>x.orden<e.orden&&x.estado==='pendiente'))return j({message:'Primero hay que terminar la etapa anterior'},400);
      if(!e.iniciada_en)return j({message:'Primero empieza este trabajo en tu inicio'},400);
      if(!a.foto_url)return j({message:'Toma la foto del trabajo terminado para poder terminarlo'},400);
      e.estado='hecha';e.foto=a.foto_url||null;e.terminada_en=iso();e.iniciada_en=null;e.monto=montoDe(it,e.oficio||e.especialidad);
      const v=DB.ventas.find(x=>x.id===it.venta_id);
      const faltan=DB.etapas.filter(x=>itemsDe(v.id).some(i=>i.id===x.venta_item_id)&&x.estado==='pendiente').length;
      if(!faltan){v.estado='lista';v.lista_en=iso();}
      return j({venta_id:v.id,listo:!faltan,interna:false,monto:e.monto});
    }
    if(name==='mis_pagos'){
      const tr=DB.etapas.filter(e=>e.trabajador_id===user&&e.estado==='hecha'&&!e.pago_id).map(e=>itemNom(e));
      const va=DB.vales.filter(x=>x.trabajador_id===user&&x.estado==='aprobado'&&!x.pago_id).map(valeNom);
      const vp=DB.vales.find(x=>x.trabajador_id===user&&x.estado==='pendiente');
      return j({semana_actual:semanaDe(iso()),trabajos:tr,vales:va,vale_pendiente:vp?valeNom(vp):null,pagos:DB.pagos.filter(q=>q.trabajador_id===user).map(recibo).reverse()});
    }
    if(name==='nomina_semana'){
      if(P.rol!=='admin')return j({message:'Solo un administrador ve la nómina'},400);
      return j({semana:semanaDe(iso()),puede_pagar:!!P.confirma_abonos,trabajadores:[PERFILES.u5].map(t=>{
        const tr=DB.etapas.filter(e=>e.trabajador_id===t.id&&e.estado==='hecha'&&!e.pago_id), va=DB.vales.filter(x=>x.trabajador_id===t.id&&x.estado==='aprobado'&&!x.pago_id);
        const tm=tr.reduce((a,e)=>a+e.monto,0), vm=va.reduce((a,x)=>a+x.monto,0); const u=DB.pagos.filter(q=>q.trabajador_id===t.id).slice(-1)[0];
        return {id:t.id,nombre:t.nombre,especialidades:t.especialidades,trabajos:tr.length,trabajos_monto:tm,vales_monto:vm,neto:tm-vm,por_definir:0,proxima:0,ultimo_pago:u?{monto:u.monto,pagado_en:u.pagado_en}:null};})});
    }
    if(name==='nomina_trabajador'){
      if(P.rol!=='admin')return j({message:'Solo un administrador ve la nómina'},400);
      const t=PERFILES[a.tid];
      return j({trabajador:{id:t.id,nombre:t.nombre,especialidades:t.especialidades},semana:semanaDe(iso()),puede_pagar:!!P.confirma_abonos,
        trabajos:DB.etapas.filter(e=>e.trabajador_id===t.id&&e.estado==='hecha'&&!e.pago_id).map(itemNom),proxima:[],
        vales:DB.vales.filter(x=>x.trabajador_id===t.id&&x.estado==='aprobado'&&!x.pago_id).map(valeNom),vale_pendiente:(v=>v?valeNom(v):null)(DB.vales.find(x=>x.trabajador_id===t.id&&x.estado==='pendiente')),
        pagos:DB.pagos.filter(q=>q.trabajador_id===t.id).map(recibo).reverse()});
    }
    if(name==='pagar_trabajador'){
      if(!P.confirma_abonos)return j({message:'Solo Ray marca los pagos de nómina'},400);
      const tr=DB.etapas.filter(e=>e.trabajador_id===a.tid&&e.estado==='hecha'&&!e.pago_id), va=DB.vales.filter(x=>x.trabajador_id===a.tid&&x.estado==='aprobado'&&!x.pago_id);
      const tm=tr.reduce((q,e)=>q+e.monto,0), vm=va.reduce((q,x)=>q+x.monto,0);
      if(tm-vm!==a.esperado)return j({message:'Los montos cambiaron mientras lo veías. Revisa de nuevo'},400);
      const pid=DB.pagos.length+1;DB.pagos.push({id:pid,trabajador_id:a.tid,monto:tm-vm,trabajos_monto:tm,vales_monto:vm,pagado_en:iso(),semana:semanaDe(iso()),pagado_por:user});
      tr.forEach(e=>e.pago_id=pid);va.forEach(x=>x.pago_id=pid);DB.notifs.push({para:a.tid,titulo:'Te pagaron $'+(tm-vm)});
      return j({id:pid,monto:tm-vm});
    }
    if(name==='pedir_vale'){DB.vales.push({id:++DB.sec.vale,trabajador_id:user,monto:a.p_monto,nota:a.p_nota,estado:'pendiente',creado_en:iso()});return j({id:DB.sec.vale});}
    if(name==='resolver_vale'){if(!P.confirma_abonos)return j({message:'Solo Ray aprueba los vales'},400);const x=DB.vales.find(z=>z.id===a.vid);x.estado=a.aprobar?'aprobado':'rechazado';return j(null);}
    if(name==='seguimiento_publico'){
      const v=DB.ventas.find(x=>x.token_seguimiento===a.t);if(!v)return j({error:'no_existe'});
      const f=ventaCompleta(v);f.cliente={nombre:f.cliente.nombre,cedula:'V99•••766',telefono:'•••8877'};delete f.token_seguimiento;
      f.items=f.items.map(it=>{const x=Object.assign({},it,{pasos:it.etapas.map(e=>({nombre:e.nombre,rama:e.rama,orden:e.orden,estado:e.estado,terminada_en:e.terminada_en,trabajando:!!e.iniciada_en,foto:e.foto}))});delete x.etapas;return x;});
      return j(f);
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
 ok('   La venta ahora está En producción, con 4 pasos creados (Hierro, Masilla, Pintura, Detalles)',v.estado==='en_produccion'&&DB.etapas.length===4);
 ok('   En la ficha ya no se puede devolver a Confirmada',!(await r.$('#fichaBody [data-retro]')));
 await r.screenshot({path:'shots5/e9-en-produccion.png'});

 // ===== 4) Ray asigna Hierro a Jesús desde el pendiente de Inicio =====
 await r.goto(H+'index.html');await r.waitForSelector('.pend-fila');await r.waitForTimeout(800);
 ok('4. Inicio de Ray: "1 trabajo sin asignar" (naranja) y ya no hay pago por confirmar',(await texto(r,'.pend-fila.naranja')).includes('1 trabajo sin asignar')&&!(await r.$('.pend-fila.rojo')));
 await r.click('.pend-fila.naranja');await r.waitForURL('**/produccion.html**');await r.waitForSelector('.vcard');
 ok('   Producción muestra el pedido de Carla por asignar',(await texto(r,'#lista')).includes('Carla Prueba'));
 await r.screenshot({path:'shots5/e10-produccion.png'});
 await r.goto(H+'produccion.html?abrir='+v.id);await r.waitForSelector('#sheetFicha.open');await r.waitForTimeout(800);
 ok('   En la ficha hay un solo botón "Asignar trabajadores" y ningún "Marcar terminado"',(await r.$$('#fichaBody [data-asignar-todo]')).length===1 && !(await r.$('#fichaBody [data-terminar]')));
 await r.click('#fichaBody [data-asignar-todo]');await r.waitForSelector('#sheetTodo.open');await r.waitForTimeout(300);
 ok('   La hoja junta Masilla y pintura en una sola fila (la misma persona)',(await r.$$eval('#todoBody .at-nom',x=>x.map(y=>y.textContent.trim()))).join('|')==='Hierro|Masilla y pintura|Detalles');
 for(const b of await r.$$('#todoBody .at-op[data-tid="u5"]')) await b.click();
 await r.click('#btnGuardarTodo');await r.waitForTimeout(900);
 ok('   Asigna los 4 pasos a Jesús de una vez, para este sábado; solo le llega el aviso del primero',DB.etapas.every(e=>e.trabajador_id==='u5'&&e.para_el)&&DB.notifs.length===1,DB.notifs);
 await r.screenshot({path:'shots5/e11-asignado.png'});

 // ===== 5) Jesús hace cada etapa: la elige en "¿Con cuál empiezas?", la ve en "Estás haciendo" y la termina con foto =====
 const jz=await entrar(b,'u5','555555');pags.push(jz);
 const etapas=['Hierro','Masilla','Pintura','Detalles'];
 for(let k=0;k<etapas.length;k++){
   await jz.goto(H+'index.html');await jz.waitForSelector('.hoy');await jz.waitForTimeout(500);
   const el=await texto(jz,'.hoy');
   ok(`5.${k+1} Jesús ve "¿Con cuál empiezas?" con ${etapas[k]} marcado ("Sigue")`,el.includes('¿Con cuál empiezas?')&&(await texto(jz,'.el-op.sel .el-etapa'))===etapas[k]+'Sigue',el);
   if(k===0) ok('    Los otros tres pasos salen en gris (esperan a otro paso)',(await jz.$$('.el-op.gris')).length===3);
   await jz.click('.hoy [data-empezar]');await jz.waitForSelector('.hoy-etapa.haciendo');await jz.waitForTimeout(300);
   const hoy=await texto(jz,'.hoy');
   ok(`    Lo empieza: "Estás haciendo · ${etapas[k]}" con la foto, el modelo, el color y su sábado`,hoy.includes('Estás haciendo')&&hoy.includes(etapas[k]+' · Imperial E2E')&&hoy.includes('Color negro')&&hoy.includes('Para el sáb')&&!!(await jz.$('.hoy-foto img')),hoy);
   if(k===0){
     ok('    Ve lo que viene después (en gris, espera a otro paso)',(await jz.$$('.despues .dp.gris')).length===3);
     // Ray ve en Producción que Jesús lo está haciendo
     await r.goto(H+'produccion.html');await r.waitForSelector('.vcard');await r.click('.vcard');await r.waitForSelector('#sheetFicha.open');await r.waitForTimeout(300);
     ok('    En Producción, Ray ve "Lo está haciendo ahora" en el Hierro',(await r.$$('#fichaBody .e-ahora')).length===1);
     await jz.screenshot({path:'shots5/e12-jesus-hoy.png'});
     await jz.click('.hoy-foto');await jz.waitForSelector('#sheetTrabajo.open');await jz.waitForTimeout(400);
     const dj=await texto(jz,'#trabajoBody');
     ok('    El detalle muestra foto grande, la franja del color, todas las especificaciones y cuánto gana ($20)',!!(await jz.$('#trabajoBody .hero img'))&&(await texto(jz,'.tj-color'))==='Va en color NEGRO'&&dj.includes('ManillónH')&&dj.includes('Ganas $20'));
     await jz.screenshot({path:'shots5/e13-jesus-detalle.png'});
     await jz.click('#sheetTrabajo [data-cerrar="sheetTrabajo"]');await jz.waitForTimeout(400);
   }
   await jz.click('.hoy [data-terminar-t]');await jz.waitForSelector('#sheetTerminarT.open');
   if(k===0){ await jz.screenshot({path:'shots5/e14-jesus-terminar.png'}); ok('    Sin foto no deja terminar',await jz.isDisabled('#btnTConfirmar')); }
   await jz.setInputFiles('#tFotoInput',{name:'f.png',mimeType:'image/png',buffer:FOTO});await jz.waitForTimeout(800);
   await jz.click('#btnTConfirmar');
   const tt=await jz.waitForFunction(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('show')&&/Sumaste|terminado/.test(t.textContent)&&t.textContent;},null,{timeout:6000}).then(h=>h.jsonValue()).catch(()=>jz.textContent('#toast'));
   ok(`    Termina con foto y le dice cuánto sumó`,/Sumaste \$(20|7|8|5)/.test(tt),tt);
   await jz.waitForTimeout(900);
   if(k===0){
     // El cliente ve el avance real en su seguimiento
     const c0x=await b.newContext({...devices['iPhone 13']});await mock(c0x,'x');const c0=await c0x.newPage();c0._err=[];c0.on('pageerror',e=>c0._err.push('cliente0: '+e.message));pags.push(c0);
     await c0.goto(H+'seguimiento.html?t='+TOKEN);await c0.waitForSelector('.pt');
     ok('    El cliente ve "Tu Imperial E2E va en masilla"',(await texto(c0,'.estado-grande')).includes('Tu Imperial E2E va en masilla'),await texto(c0,'.estado-grande'));
     ok('    Y en su producto: Hierro terminado con la foto del trabajador, Masilla es el siguiente',(await texto(c0,'.pt-p.hecho')).includes('Hierro')&&(await texto(c0,'.pt-p.hecho')).includes('Terminado el')&&!!(await c0.$('.pt-p.hecho .pt-foto img'))&&(await texto(c0,'.pt-p.actual')).includes('Masilla'));
     ok('    Sin nombres de trabajadores',!(await texto(c0,'main')).includes('Jesús'));
     await c0.waitForTimeout(800);await c0.screenshot({path:'shots5/e14b-seguimiento-avance.png',fullPage:true});
     await c0.click('.pt-foto');await c0.waitForTimeout(500);
     ok('    Tocar la foto la abre grande',await c0.$eval('.visor',x=>x.classList.contains('open')).catch(()=>false));
   }
 }
 ok('6. Al terminar la última etapa el pedido queda Listo solo',v.estado==='lista');
 ok('   Las fotos del trabajador quedan guardadas en cada etapa',DB.etapas.every(e=>!!e.foto));
 ok('   Jesús ya no tiene trabajos: mensaje claro',(await texto(jz,'.hoy')).includes('No tienes trabajos asignados'));

 // ===== 6) Pagos del trabajador y vale =====
 await jz.click('#vistaTrabajo [data-ver="pagos"]');await jz.waitForSelector('#sheetPagos.open');
 ok('7. Mis pagos: 4 trabajos esta semana, cada uno con sus dos fotos, y "Cobras el sáb ... $40"',(await jz.$$('#pagosBody [data-hecho]')).length===4&&(await jz.$$('#pagosBody [data-hecho] .duo img')).length===8&&(await texto(jz,'.pg-cobra b'))==='$40');
 await jz.click('#pagosBody [data-hecho] >> nth=0');await jz.waitForSelector('#sheetHecho.open');await jz.waitForTimeout(300);
 ok('   Al tocar uno: la foto del catálogo al lado de la suya',(await jz.$$('#hechoBody .cmp .hero img')).length===2);
 await jz.click('#sheetHecho [data-cerrar="sheetHecho"]');await jz.waitForTimeout(400);
 await jz.screenshot({path:'shots5/e15-jesus-pagos.png',fullPage:true});
 await jz.click('#btnAbrirVale');await jz.waitForSelector('#sheetVale.open');await jz.fill('#valeMonto','10');await jz.fill('#valeNota','pasaje');
 await jz.click('#btnPedirVale');await jz.waitForTimeout(900);
 await r.goto(H+'index.html');await r.waitForSelector('.pend-fila.verde');await r.waitForTimeout(500);
 ok('   Ray ve "1 vale por aprobar · Jesús $10" (verde)',(await texto(r,'.pend-fila.verde')).includes('1 vale por aprobar')&&(await texto(r,'.pend-fila.verde')).includes('Jesús $10'));
 await r.click('.pend-fila.verde');await r.waitForURL('**/nomina.html?t=u5');await r.waitForSelector('#sheetTrab.open');await r.waitForTimeout(400);
 ok('   Lo lleva a la Nómina de Jesús con el vale arriba para aprobar',(await texto(r,'.vp')).includes('Pide un vale')&&(await texto(r,'.vp')).includes('$10'));
 await r.screenshot({path:'shots5/e15b-ray-vale.png'});
 await r.click('.vp [data-resolver="si"]');await r.waitForTimeout(900);
 ok('   Al aprobar se quita de arriba y ya descuenta',!(await r.$('.vp'))&&(await texto(r,'#trabBody')).includes('−$10'));
 await jz.goto(H+'index.html?ver=pagos');await jz.waitForSelector('#sheetPagos.open');await jz.waitForTimeout(500);
 ok('   El vale aprobado sale en rojo y resta: te toca cobrar $30',(await texto(jz,'.pg-mov.vale .pg-mov-m'))==='−$10'&&(await texto(jz,'.pg-cobra b'))==='$30');
 await jz.screenshot({path:'shots5/e16-jesus-vale.png',fullPage:true});

 // ===== Nómina: Ray paga la semana de Jesús =====
 await r.goto(H+'index.html');await r.waitForSelector('#cuenta-nomina .num');
 ok('7b. Inicio de Ray: Nómina dice "$30 por pagar"',(await texto(r,'#cuenta-nomina'))==='$30 por pagar',await texto(r,'#cuenta-nomina'));
 await r.click('a.ini-tile[href="nomina.html"]');await r.waitForSelector('.n-card');
 ok('   En Nómina, Jesús: 4 trabajos, vale −$10, $30 por pagar',(await texto(r,'.n-card')).includes('4 trabajos · vales −$10')&&(await texto(r,'.n-card .n-monto b'))==='$30');
 await r.screenshot({path:'shots5/e16b-nomina.png'});
 await r.click('.n-card');await r.waitForSelector('#sheetTrab.open');
 ok('   Cada trabajo dice de qué cliente y pedido es',(await texto(r,'#trabBody')).includes('Carla Prueba · N° '+v.id));
 await r.waitForTimeout(500);
 ok('   Los dos botones de abajo se ven completos',await r.evaluate(()=>{const b=document.getElementById('btnAnotarVale').getBoundingClientRect();return b.bottom<=window.innerHeight&&b.height>40;}));
 await r.screenshot({path:'shots5/e16c-nomina-jesus.png'});
 await r.click('#trabBody [data-item]');await r.waitForSelector('#sheetItem.open');await r.waitForTimeout(300);
 ok('   Al tocarlo: cliente, pedido, pago, foto que subió y enlace a la venta',(await texto(r,'#itemBody')).includes('Carla Prueba')&&(await texto(r,'#itemBody')).includes('Pago por esta parte')&&!!(await r.$('#itemBody [data-ver-foto]'))&&(await r.getAttribute('#itemBody .d-link','href'))==='ventas.html?abrir='+v.id);
 await r.screenshot({path:'shots5/e16d-nomina-trabajo.png'});
 await r.click('#sheetItem [data-cerrar="sheetItem"]');await r.waitForTimeout(400);
 ok('   Ray ve "Marcar pagado $30"',(await texto(r,'#btnPagar'))==='Marcar pagado $30');
 await r.click('#btnPagar');await r.waitForTimeout(1500);
 ok('   Al pagar: queda el recibo en su historial y le llega el aviso',DB.pagos.length===1&&DB.pagos[0].monto===30&&DB.notifs.some(n=>n.titulo==='Te pagaron $30')&&(await r.$$('#trabBody .rec')).length===1);
 ok('   Y ya no le debe nada',(await texto(r,'.n-card .n-monto b'))==='$0' && (await texto(r,'.n-card .n-ult')).includes('$30'));
 await r.screenshot({path:'shots5/e16e-nomina-pagado.png'});
 await jz.goto(H+'index.html?ver=historial');await jz.waitForSelector('#sheetPagos.open');await jz.waitForTimeout(400);
 ok('   Jesús ve la semana pagada, cerrada',(await jz.$$('.pg-sem')).length===1&&(await jz.$$('.pg-sem[open]')).length===0);
 await jz.click('.pg-sem summary');await jz.waitForTimeout(300);
 ok('   Al abrirla: sus 4 trabajos con fotos y "Te pagaron · Ray $30"',(await jz.$$('.pg-sem[open] [data-hecho]')).length===4&&(await texto(jz,'.pg-sem[open] .pg-cobra'))==='Te pagaron · Ray$30');
 await jz.screenshot({path:'shots5/e16f-jesus-recibo.png',fullPage:true});

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
