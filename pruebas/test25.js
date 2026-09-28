// Producción: categoría de pago por producto, fabricar para exhibición (+),
// cancelar una orden interna, abrir un pedido desde un aviso y filtro "Sin categoría".
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
    {id:303,nombre:'Puerta de exhibición vendida',tipo:'Puerta Multilock',foto:null,cantidad:1,categoria_pago_id:7,etapas:[]}
  ]},
  {id:31,fecha_entrega:null,interna:true,cliente:null,estado:'en_produccion',items:[
    {id:311,nombre:'Imperial',tipo:'Puerta Multilock',foto:GIF,cantidad:1,categoria_pago_id:7,etapas:[et(3101,'Hierro',1,'herrero')]}
  ]}
];
const categorias=[{id:7,nombre:'General'},{id:8,nombre:'Ventanas'}];
const modelos=[
  {id:1,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF,Negro:GIF},precio_base:480,categoria_pago_id:7},
  {id:2,nombre:'Ventana Simple',tipo:'Ventana',fotos:{Blanco:GIF},precio_base:90,categoria_pago_id:null}
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
  if(u.includes('/rpc/crear_orden_exhibicion')){
    const bd=body();llamadas.push(['crear_orden',bd]);
    const m=modelos.find(x=>x.id===bd.p.catalogo_id);
    ventas.push({id:32,fecha_entrega:null,interna:true,cliente:null,estado:'en_produccion',items:[{id:321,nombre:m.nombre,tipo:m.tipo,foto:GIF,cantidad:bd.p.cantidad,categoria_pago_id:m.categoria_pago_id,etapas:[et(3201,'Ensamblar',1,'ventanero')]}]});
    return j({id:32});
  }
  if(u.includes('/rpc/cancelar_orden_exhibicion')){
    const bd=body();llamadas.push(['cancelar',bd]);
    const v=ventas.find(x=>x.id===bd.vid);if(v)v.estado='cancelada';
    return j(null);
  }
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j([{id:'t1',nombre:'Jesús',especialidades:['herrero','masilla_pintura','acabados']}]);
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
 ok('Botón + visible',await a.isVisible('#btnNuevaOrden'));
 await a.screenshot({path:'shots5/p1-lista.png'});

 // Ficha del pedido
 await a.click('.vcard[data-id="30"]');await a.waitForSelector('#sheetFicha.open');
 const ficha=await a.textContent('#fichaBody');
 ok('El producto con categoría la muestra',ficha.includes('Pago: General'));
 ok('El producto a medida pide categoría',ficha.includes('Sin categoría · toca para asignar'));
 ok('La pieza sin etapas (ya hecha) no aparece',!ficha.includes('Puerta de exhibición vendida'));
 ok('La etapa terminada muestra lo que ganó',ficha.includes('Terminó · Jesús') && ficha.includes('$25'));
 ok('La etapa en curso dice "trabajando"',ficha.includes('trabajando'));
 ok('La cantidad aparece junto al nombre',ficha.includes('Reja a medida ×2'));
 await a.screenshot({path:'shots5/p2-ficha.png'});

 await a.click('[data-cat-item="302"]');await a.waitForSelector('#sheetCatItem.open');
 ok('Ofrece las categorías',(await a.$$('#listaCatItem .fila-cat')).length===2);
 await a.screenshot({path:'shots5/p3-categoria.png'});
 await a.click('#listaCatItem [data-cid="8"]');await a.waitForTimeout(700);
 const ci=llamadas.find(x=>x[0]==='cat_item');
 ok('Se guardó la categoría del producto',ci&&ci[1].iid===302&&ci[1].cid===8,ci&&ci[1]);
 ok('La ficha se refresca con la categoría nueva',(await a.textContent('#fichaBody')).includes('Pago: Ventanas'));
 ok('El chip "Sin categoría" desaparece',!(await a.textContent('#chips')).includes('Sin categoría'));
 await a.click('#sheetFicha [data-cerrar="sheetFicha"]');await a.waitForTimeout(400);

 // Fabricar para exhibición
 await a.click('#btnNuevaOrden');await a.waitForSelector('#sheetOrden.open');
 await a.click('#btnCrearOrden');await a.waitForTimeout(200);
 ok('Sin modelo ni sede muestra los errores',await a.isVisible('#eModelo') && await a.isVisible('#eSede'));
 await a.click('#btnModelo');await a.waitForSelector('#sheetModelos.open');
 ok('Lista de modelos para elegir',(await a.$$('#listaModelos .fila-mod')).length===2);
 await a.fill('#buscaModelo','vent');await a.waitForTimeout(150);
 ok('El buscador filtra',(await a.$$('#listaModelos .fila-mod')).length===1);
 await a.fill('#buscaModelo','');await a.waitForTimeout(150);
 await a.click('#listaModelos [data-mid="1"]');await a.waitForTimeout(400);
 ok('Elegido: muestra el modelo y pone su precio',(await a.textContent('#modeloNombre'))==='Lineal' && (await a.inputValue('#fPrecio'))==='480');
 ok('Modelo con dos colores muestra la elección de color',await a.isVisible('#campoColor'));
 ok('Modelo con categoría no muestra el aviso',!(await a.isVisible('#hintSinCat')));
 await a.click('#optsColor [data-color="Negro"]');
 await a.click('#optsSede [data-sede="2"]');
 await a.click('#sheetOrden [data-cant="1"]');await a.click('#sheetOrden [data-cant="1"]');
 ok('Cantidad sube a 3',(await a.textContent('#cantValor'))==='3');
 await a.screenshot({path:'shots5/p4-orden.png'});
 await a.click('#btnCrearOrden');await a.waitForTimeout(900);
 const co=llamadas.find(x=>x[0]==='crear_orden');
 ok('Se mandó a fabricar con modelo, color, sede, cantidad y precio',co&&co[1].p.catalogo_id===1&&co[1].p.color==='Negro'&&co[1].p.sede_id===2&&co[1].p.cantidad===3&&co[1].p.precio===480,co&&co[1]);
 ok('Se abre la ficha de la orden nueva',!!(await a.$('#sheetFicha.open')) && (await a.textContent('#fichaBody')).includes('Para exhibición'));
 ok('La orden interna tiene "Cancelar esta orden"',!!(await a.$('[data-cancelar-orden="32"]')));
 await a.screenshot({path:'shots5/p5-orden-ficha.png'});
 await a.click('[data-cancelar-orden="32"]');await a.waitForTimeout(800);
 const ca=llamadas.find(x=>x[0]==='cancelar');
 ok('Pregunta antes de cancelar y llama al servidor',a._dlg===1&&ca&&ca[1].vid===32,ca&&ca[1]);
 ok('La orden cancelada sale de la lista',(await a.$$('.vcard')).length===2);

 // Abrir desde un aviso y con filtro
 await a.goto('http://127.0.0.1:8765/produccion.html?abrir=31');await a.waitForSelector('#sheetFicha.open');
 ok('?abrir=31 abre la ficha de esa orden',(await a.textContent('#fichaBody')).includes('Imperial'));
 await a.goto('http://127.0.0.1:8765/produccion.html?filtro=asignar');await a.waitForSelector('.vcard');
 ok('?filtro=asignar deja activo "Por asignar"',(await a.textContent('.chip.active')).includes('Por asignar'));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
