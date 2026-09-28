// Producción: categoría de pago por producto (sin ella no se asigna), "Asignar" a la derecha,
// fabricar para exhibición como en Nueva venta (tipo, modelo, especificaciones, categoría),
// cancelar una orden interna, abrir un pedido desde un aviso y filtros por URL.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const et=(id,nombre,orden,esp,extra)=>Object.assign({id,rama:'principal',nombre,orden,especialidad:esp,estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null,iniciada_en:null,monto:null},extra||{});
let ventas=[
  {id:30,fecha_entrega:dia(4),interna:false,cliente:{nombre:'Carlos Pérez'},estado:'en_produccion',items:[
    {id:301,nombre:'Puerta Lineal',tipo:'Puerta Multilock',foto:null,cantidad:1,categoria_pago_id:7,etapas:[
      et(3001,'Hierro',1,'herrero',{estado:'hecha',trabajador_id:'t1',trabajador:{nombre:'Jesús'},monto:25}),
      et(3002,'Masilla y pintura',2,'masilla_pintura',{trabajador_id:'t1',trabajador:{nombre:'Jesús'},iniciada_en:new Date().toISOString()}),
      et(3003,'Detalles',3,'acabados')]},
    {id:302,nombre:'Reja a medida',tipo:'Ventana',foto:null,cantidad:2,categoria_pago_id:null,etapas:[et(3004,'Ensamblar',1,'ventanero')]},
    {id:304,nombre:'Ventana vieja',tipo:'Ventana',foto:null,cantidad:1,categoria_pago_id:null,etapas:[et(3005,'Ensamblar',1,'ventanero',{trabajador_id:'t1',trabajador:{nombre:'Jesús'}})]},
    {id:303,nombre:'Puerta de exhibición vendida',tipo:'Puerta Multilock',foto:null,cantidad:1,categoria_pago_id:7,etapas:[]}
  ]},
  {id:31,fecha_entrega:null,interna:true,cliente:null,estado:'en_produccion',items:[
    {id:311,nombre:'Imperial',tipo:'Puerta Multilock',foto:GIF,cantidad:1,categoria_pago_id:7,etapas:[et(3101,'Hierro',1,'herrero')]}
  ]}
];
const categorias=[{id:7,nombre:'General'},{id:8,nombre:'Ventanas'}];
const modelos=[
  {id:1,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF,Negro:GIF},precio_base:480,especificaciones_base:{alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:false,marco_decorativo:false,proteccion:false},categoria_pago_id:null},
  {id:2,nombre:'Imperial',tipo:'Puerta Multilock',fotos:{Blanco:GIF},precio_base:300,especificaciones_base:{},categoria_pago_id:7},
  {id:3,nombre:'Ventana Simple',tipo:'Ventana',fotos:{Blanco:GIF},precio_base:90,especificaciones_base:{},categoria_pago_id:8}
];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  const body=()=>JSON.parse(req.postData()||'{}');
  if(u.includes('/rpc/asignar_categoria_item')){
    const bd=body();llamadas.push(['cat_item',bd]);
    ventas.forEach(v=>v.items.forEach(it=>{if(it.id===bd.iid)it.categoria_pago_id=bd.cid;}));
    return j(null);
  }
  if(u.includes('/rpc/asignar_etapa')){const bd=body();llamadas.push(['asignar',bd]);
    ventas.forEach(v=>v.items.forEach(it=>it.etapas.forEach(e=>{if(e.id===bd.eid){e.trabajador_id=bd.tid;e.trabajador={nombre:'Jesús'};}})));return j(null);}
  if(u.includes('/rpc/crear_orden_exhibicion')){
    const bd=body();llamadas.push(['crear_orden',bd]);
    const m=modelos.find(x=>x.id===bd.p.catalogo_id);
    ventas.push({id:32,fecha_entrega:null,interna:true,cliente:null,estado:'en_produccion',items:[{id:321,nombre:m.nombre,tipo:m.tipo,foto:GIF,cantidad:bd.p.cantidad,categoria_pago_id:m.categoria_pago_id||bd.p.categoria_pago_id,etapas:[et(3201,'Hierro',1,'herrero')]}]});
    return j({id:32});
  }
  if(u.includes('/rpc/cancelar_orden_exhibicion')){
    const bd=body();llamadas.push(['cancelar',bd]);
    const v=ventas.find(x=>x.id===bd.vid);if(v)v.estado='cancelada';
    return j(null);
  }
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j([{id:'t1',nombre:'Jesús',especialidades:['herrero','masilla_pintura','acabados','ventanero']}]);
    if(u.includes('id=eq')) return j({id:user,usuario:'ray',nombre:'Ray',rol,sede_id:1,confirma_abonos:false});
    return j([{usuario:'ray',nombre:'Ray',rol,orden:1}]);
  }
  if(u.includes('/categorias_pago'))return j(categorias);
  if(u.includes('/catalogo'))return j(modelos);
  if(u.includes('/sedes'))return j([{id:1,nombre:'Sede Cumbres'},{id:2,nombre:'Sede Norte'}]);
  if(u.includes('/ventas'))return j(ventas.filter(v=>v.estado==='en_produccion'));
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,'u2','admin');
 const a=await ctx.newPage();a.on('pageerror',e=>err.push(e.message));a.on('dialog',d=>{a._dlg=(a._dlg||0)+1;d.accept();});
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');

 await a.goto('http://127.0.0.1:8765/produccion.html');await a.waitForSelector('.vcard');
 ok('Se ven el pedido y la orden para exhibición',(await a.$$('.vcard')).length===2);
 ok('La orden interna dice "Para exhibición"',(await a.textContent('#lista')).includes('Para exhibición'));
 ok('El subtítulo cuenta las órdenes para exhibición',(await a.textContent('#subtitulo')).includes('1 para exhibición'));
 ok('Chip "Sin categoría · 1"',(await a.textContent('#chips')).includes('Sin categoría · 1'));
 await a.screenshot({path:'shots5/p1-lista.png'});

 // Ficha del pedido
 await a.click('.vcard[data-id="30"]');await a.waitForSelector('#sheetFicha.open');
 const ficha=await a.textContent('#fichaBody');
 ok('El producto con categoría la muestra',ficha.includes('Pago: General'));
 ok('El producto sin categoría avisa que primero hay que darla',ficha.includes('Primero dale una categoría de pago'));
 ok('La pieza sin etapas (ya hecha) no aparece',!ficha.includes('Puerta de exhibición vendida'));
 ok('La etapa terminada muestra lo que ganó',ficha.includes('Terminó · Jesús') && ficha.includes('$25'));
 ok('La etapa en curso dice "Trabajando en esto"',ficha.includes('Trabajando en esto'));
 ok('Sin categoría, "Asignar" está gris y no es un botón',!!(await a.$('span.e-asignar.off')) && !(await a.$('[data-asignar="3004"]')));
 ok('Una etapa ya asignada sin categoría conserva al trabajador y "Marcar terminado"',!!(await a.$('.e-chip[data-asignar="3005"]')) && !!(await a.$('[data-terminar="3005"]')));
 const mismaLinea=await a.$eval('.etapa.actual .e-linea',x=>{const n=x.querySelector('.e-nom').getBoundingClientRect(),b=x.lastElementChild.getBoundingClientRect();return Math.abs(n.top+n.height/2-(b.top+b.height/2))<8 && b.left>n.left;});
 ok('El botón de la derecha queda en la misma línea que la etapa',mismaLinea);
 await a.screenshot({path:'shots5/p2-ficha.png'});

 // El botón gris lleva a elegir la categoría
 await a.click('.cat-falta[data-cat-item="302"]');await a.waitForSelector('#sheetCatItem.open');
 ok('Ofrece las categorías',(await a.$$('#listaCatItem .fila-cat')).length===2);
 await a.click('#listaCatItem [data-cid="8"]');await a.waitForTimeout(700);
 const ci=llamadas.find(x=>x[0]==='cat_item');
 ok('Se guardó la categoría del producto',ci&&ci[1].iid===302&&ci[1].cid===8,ci&&ci[1]);
 ok('Ahora se puede asignar Ensamblar',!!(await a.$('.e-asignar[data-asignar="3004"]')) && !(await a.$('.cat-falta[data-cat-item="302"]')));
 await a.click('[data-asignar="3004"]');await a.waitForSelector('#sheetAsignar.open');
 await a.click('.fila-t');await a.waitForTimeout(700);
 ok('Asignar funciona y el trabajador queda a la derecha',llamadas.some(x=>x[0]==='asignar'&&x[1].eid===3004) && (await a.textContent('.e-chip[data-asignar="3004"]')).includes('Jesús'));
 await a.screenshot({path:'shots5/p3-asignado.png'});
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(400);

 // Fabricar para exhibición: tipo, modelo, especificaciones
 await a.click('#btnNuevaOrden');await a.waitForSelector('#sheetOrden.open');
 ok('Primero pregunta qué vas a fabricar (solo tipos con modelos)',(await a.$$('#ordenBody [data-g="__otipo"]')).length===2 && !(await a.$('#btnModelo')));
 await a.click('#btnCrearOrden');await a.waitForTimeout(200);
 ok('Sin tipo muestra el error',await a.isVisible('#eOTipo'));
 await a.click('#ordenBody [data-g="__otipo"][data-v="Puerta Multilock"]');
 ok('Con tipo aparece el modelo',!!(await a.$('#btnModelo')));
 await a.click('#btnModelo');await a.waitForSelector('#sheetModelos.open');
 ok('La lista de modelos es solo de ese tipo',(await a.$$('#listaModelos .fila-mod')).length===2 && (await a.textContent('#modelosTitulo'))==='Puerta Multilock');
 ok('Avisa cuál no tiene categoría',(await a.textContent('#listaModelos')).includes('sin categoría de pago'));
 await a.click('#listaModelos [data-mid="1"]');await a.waitForTimeout(400);
 const cuerpo=await a.textContent('#ordenBody');
 ok('Salen las especificaciones del modelo (como en Ventas)',cuerpo.includes('Medidas') && cuerpo.includes('Color') && cuerpo.includes('Extras'));
 ok('Las medidas vienen del modelo',(await a.inputValue('[data-mkey="alto"]'))==='2' && (await a.inputValue('[data-mkey="ancho"]'))==='1');
 ok('Pide la categoría porque el modelo no tiene',!!(await a.$('#campoOCat')));
 ok('Precio sugerido del modelo',(await a.inputValue('#fPrecio'))==='480' && (await a.textContent('#desglose')).includes('Modelo $480'));
 await a.click('#ordenBody [data-g="manillon"][data-v="H"]');await a.waitForTimeout(150);
 ok('Marcar manillón suma $20 al sugerido',(await a.inputValue('#fPrecio'))==='500');
 await a.click('#ordenBody [data-g="__color"][data-v="Negro"]');
 await a.fill('[data-mkey="alto"]','2.1');
 await a.click('#ordenBody [data-g="__osede"][data-v="2"]');
 await a.click('#ordenBody [data-cant="1"]');
 await a.screenshot({path:'shots5/p4-orden.png',fullPage:true});
 await a.click('#btnCrearOrden');await a.waitForTimeout(300);
 ok('Sin categoría no deja mandar a fabricar',!llamadas.some(x=>x[0]==='crear_orden') && await a.isVisible('#eOCat'));
 await a.click('#ordenBody [data-g="__ocat"][data-v="7"]');
 await a.evaluate(()=>{const b=document.getElementById('btnCrearOrden');b.click();document.querySelector('#ordenBody [data-g="__osede"][data-v="2"]').click();b.click();});await a.waitForTimeout(900);
 ok('Tocar dos veces rápido manda una sola orden',llamadas.filter(x=>x[0]==='crear_orden').length===1);
 const co=llamadas.find(x=>x[0]==='crear_orden');
 const p=co&&co[1].p;
 ok('Se manda con modelo, sede, cantidad, precio y categoría',p&&p.catalogo_id===1&&p.sede_id===2&&p.cantidad===2&&p.precio===500&&p.categoria_pago_id===7,p);
 ok('Y con las especificaciones elegidas',p&&p.especificaciones.color==='Negro'&&String(p.especificaciones.alto)==='2.1'&&p.especificaciones.manillon===true&&p.especificaciones.manillon_tipo==="H",p&&p.especificaciones);
 ok('Se abre la ficha de la orden nueva',!!(await a.$('#sheetFicha.open')) && (await a.textContent('#fichaBody')).includes('Para exhibición'));
 await a.screenshot({path:'shots5/p5-orden-ficha.png'});
 await a.click('[data-cancelar-orden="32"]');await a.waitForTimeout(800);
 const ca=llamadas.find(x=>x[0]==='cancelar');
 ok('Pregunta antes de cancelar y llama al servidor',a._dlg===1&&ca&&ca[1].vid===32,ca&&ca[1]);
 ok('La orden cancelada sale de la lista',(await a.$$('.vcard')).length===2);

 // Cambiar de tipo borra el modelo elegido
 await a.click('#btnNuevaOrden');await a.waitForSelector('#sheetOrden.open');
 await a.click('#ordenBody [data-g="__otipo"][data-v="Ventana"]');
 await a.click('#btnModelo');await a.waitForSelector('#sheetModelos.open');
 await a.click('#listaModelos [data-mid="3"]');await a.waitForTimeout(400);
 ok('Modelo con categoría no la pide',!(await a.$('#campoOCat')));
 await a.fill('[data-mkey="alto"]','1.5');await a.fill('[data-mkey="ancho"]','2');await a.waitForTimeout(150);
 ok('Ventana: precio sugerido por m²',(await a.inputValue('#fPrecio'))==='270',await a.inputValue('#fPrecio'));
 await a.click('#ordenBody [data-g="__otipo"][data-v="Puerta Multilock"]');
 ok('Cambiar el tipo borra el modelo',!(await a.$('[data-mkey="alto"]')) && (await a.textContent('#btnModelo')).includes('Elige un modelo'));
 await a.click('#sheetOrden [data-cerrar="sheetOrden"]');await a.waitForTimeout(400);

 // Abrir desde un aviso y con filtro
 await a.goto('http://127.0.0.1:8765/produccion.html?abrir=31');await a.waitForSelector('#sheetFicha.open');
 ok('?abrir=31 abre la ficha de esa orden',(await a.textContent('#fichaBody')).includes('Imperial'));
 await a.goto('http://127.0.0.1:8765/produccion.html?filtro=asignar');await a.waitForSelector('.vcard');
 ok('?filtro=asignar deja activo "Por asignar"',(await a.textContent('.chip.active')).includes('Por asignar'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
