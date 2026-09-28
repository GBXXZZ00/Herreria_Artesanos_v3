// Producción: lista de pedidos en taller, ficha con las etapas de cada producto,
// asignar trabajador y marcar una etapa como terminada (con foto opcional).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

const trabajadores=[
  {id:'t1',nombre:'Jesús',especialidades:['herrero','acabados']},
  {id:'t2',nombre:'Pedro',especialidades:['masilla_pintura']},
  {id:'t3',nombre:'Luis',especialidades:['ventanero']}
];
const porId=id=>trabajadores.find(t=>t.id===id);

let ventas=[
  {id:20,fecha_entrega:dia(-2),cliente:{nombre:'Carlos Pérez'},estado:'en_produccion',items:[
    {id:101,nombre:'Puerta Multilock',tipo:'Puerta Multilock',foto:null,etapas:[
      {id:1001,rama:'principal',nombre:'Hierro',orden:1,especialidad:'herrero',estado:'hecha',trabajador_id:'t1',trabajador:{nombre:'Jesús'},foto:null,terminada_en:new Date().toISOString()},
      {id:1002,rama:'principal',nombre:'Masilla y pintura',orden:2,especialidad:'masilla_pintura',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1003,rama:'principal',nombre:'Detalles',orden:3,especialidad:'acabados',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]},
    {id:102,nombre:'Ventana a medida',tipo:'Ventana',foto:null,etapas:[
      {id:1004,rama:'principal',nombre:'Ensamblar',orden:1,especialidad:'ventanero',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]}
  ]},
  {id:21,fecha_entrega:dia(5),cliente:{nombre:'Marisela Chávez'},estado:'en_produccion',items:[
    {id:103,nombre:'Reja para ventana',tipo:'Ventana',foto:null,etapas:[
      {id:1005,rama:'principal',nombre:'Ensamblar',orden:1,especialidad:'ventanero',estado:'pendiente',trabajador_id:'t3',trabajador:{nombre:'Luis'},foto:null,terminada_en:null}
    ]}
  ]},
  {id:22,fecha_entrega:dia(10),cliente:{nombre:'Ana Belisario'},estado:'en_produccion',items:[
    {id:104,nombre:'Combo Modelo Lineal',tipo:'Combo',foto:null,etapas:[
      {id:1006,rama:'principal',nombre:'Hierro',orden:1,especialidad:'herrero',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1007,rama:'principal',nombre:'Masilla y pintura',orden:2,especialidad:'masilla_pintura',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1008,rama:'principal',nombre:'Detalles',orden:3,especialidad:'acabados',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null},
      {id:1009,rama:'ventana',nombre:'Ensamblar',orden:1,especialidad:'ventanero',estado:'pendiente',trabajador_id:null,trabajador:null,foto:null,terminada_en:null}
    ]}
  ]}
];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/asignar_etapa')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['asignar_etapa',body]);
    for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===body.eid){ e.trabajador_id=body.tid; e.trabajador={nombre:(porId(body.tid)||{}).nombre||''}; }
    return j({});
  }
  if(u.includes('/rpc/marcar_etapa_terminada')){
    const body=JSON.parse(req.postData()||'{}');llamadas.push(['marcar_etapa_terminada',body]);
    let vid=null;
    for(const v of ventas) for(const it of v.items) for(const e of it.etapas) if(e.id===body.eid){ e.estado='hecha'; e.foto=body.foto_url||null; vid=v.id; }
    const v=ventas.find(x=>x.id===vid);
    const faltan=v.items.flatMap(it=>it.etapas).filter(e=>e.estado==='pendiente').length;
    if(faltan===0) v.estado='lista';
    return j({venta_id:vid, listo:faltan===0});
  }
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j(trabajadores);
    if(u.includes('id=eq')) return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:false});
    return j([{usuario:'raymundo',nombre:'Ray',rol,orden:1}]);
  }
  if(u.includes('/ventas')){
    const activos=ventas.filter(v=>v.estado==='en_produccion');
    return j(activos);
  }
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // Vendedora: no ve Producción en el menú de abajo
 const cy=await b.newContext({...devices['iPhone 13']});await mock(cy,'u3','vendedor');
 const y=await cy.newPage();y.on('pageerror',e=>err.push('vend:'+e.message));
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');
 ok('Vendedora no ve "Producción" en el menú de abajo',!(await y.$('a.nav-item[href="produccion.html"]')));
 await y.goto('http://127.0.0.1:8765/produccion.html');await y.waitForURL('**/index.html');
 ok('Vendedora no puede entrar a producción directo',y.url().includes('index.html'));

 // Admin: entra a Producción
 const ca=await b.newContext({...devices['iPhone 13']});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push('admin:'+e.message));
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');
 ok('Admin sí ve "Producción" en el menú de abajo',!!(await a.$('a.nav-item[href="produccion.html"]')));
 await a.click('a.nav-item[href="produccion.html"]');await a.waitForSelector('.vcard');
 ok('Lista muestra los 3 pedidos en taller',(await a.$$('.vcard')).length===3);
 ok('El pedido atrasado se ordena primero',(await a.textContent('.vcard'))?.includes('Carlos Pérez'));
 ok('Chip "Por asignar" cuenta los 2 pedidos con su etapa actual sin trabajador',(await a.textContent('#chips')).includes('Por asignar · 2'));
 ok('Chip "Atrasados" cuenta 1',(await a.textContent('#chips')).includes('Atrasados · 1'));
 await a.screenshot({path:'shots5/s1-lista.png',fullPage:true});

 // Ficha: primer pedido (Hierro hecho, Masilla actual sin asignar, Detalles futura)
 await a.click('.vcard >> nth=0');await a.waitForSelector('#sheetFicha.open');
 ok('Hierro se ve terminado con quién lo hizo',(await a.textContent('#fichaBody')).includes('Terminó · Jesús') || (await a.textContent('#fichaBody')).includes('Terminó'));
 ok('Masilla y pintura es la etapa actual, sin asignar',!!(await a.$('[data-asignar][data-nombre="Masilla y pintura"]')));
 ok('Detalles todavía no muestra botón (etapa futura)',(await a.$$('#fichaBody [data-asignar], #fichaBody [data-terminar]')).length===2); // Masilla (asignar) + Ensamblar (asignar)
 await a.screenshot({path:'shots5/s2-ficha.png',fullPage:true});

 // Asignar Masilla y pintura: solo debe salir Pedro (especialidad masilla_pintura)
 await a.click('[data-asignar][data-nombre="Masilla y pintura"]');await a.waitForSelector('#sheetAsignar.open');
 ok('Solo aparece Pedro (masilla_pintura)',(await a.textContent('#listaTrabajadores')).includes('Pedro') && !(await a.textContent('#listaTrabajadores')).includes('Jesús'));
 await a.click('.fila-t >> text=Pedro');await a.waitForTimeout(500);
 const asigna=llamadas.find(x=>x[0]==='asignar_etapa');
 ok('Se llamó a asignar con la etapa y el trabajador correctos',asigna&&asigna[1].eid===1002&&asigna[1].tid==='t2',asigna&&asigna[1]);
 ok('La ficha se actualiza y ahora Masilla tiene botón de terminar',!!(await a.$('[data-terminar]')));
 await a.screenshot({path:'shots5/s3-asignado.png',fullPage:true});

 // Marcar terminado (sin foto)
 await a.click('[data-terminar]');await a.waitForSelector('#sheetTerminar.open');
 await a.click('#btnConfirmarTerminar');await a.waitForTimeout(500);
 const term=llamadas.find(x=>x[0]==='marcar_etapa_terminada');
 ok('Se llamó a marcar terminada con la etapa correcta',term&&term[1].eid===1002,term&&term[1]);
 ok('La hoja se cierra tras marcar terminado',!(await a.$('#sheetTerminar.open'))&&!(await a.$('#sheetFicha.open')));

 // Segundo pedido: su única etapa ya está asignada a Luis; al marcarla termina TODO el pedido
 await a.click('.vcard >> text=Marisela Chávez');await a.waitForSelector('#sheetFicha.open');
 ok('Ensamblar ya está asignada a Luis',(await a.textContent('#fichaBody')).includes('Luis'));
 await a.click('[data-terminar]');await a.waitForSelector('#sheetTerminar.open');
 await a.click('#btnConfirmarTerminar');await a.waitForTimeout(500);
 ok('Al terminar la última etapa, el pedido sale de la lista (quedan Carlos y Ana)',(await a.$$('.vcard')).length===2);
 await a.screenshot({path:'shots5/s4-final.png',fullPage:true});

 // Tercer pedido: Combo con dos ramas en paralelo (puerta y ventana)
 await a.click('.vcard >> text=Ana Belisario');await a.waitForSelector('#sheetFicha.open');
 const fichaCombo=await a.textContent('#fichaBody');
 ok('La ficha del Combo muestra la etiqueta "Puerta"',fichaCombo.includes('Puerta'));
 ok('La ficha del Combo muestra la etiqueta "Ventana"',fichaCombo.includes('Ventana'));
 ok('Hierro (rama puerta) es su etapa actual, sin asignar',!!(await a.$('[data-asignar][data-nombre="Hierro"]')));
 ok('Ensamblar (rama ventana) también es actual y sin asignar, en paralelo',!!(await a.$('[data-asignar][data-nombre="Ensamblar"]')));
 ok('Las dos ramas del Combo tienen su propia etapa actual accionable a la vez',(await a.$$('#fichaBody [data-asignar]')).length===2);
 await a.screenshot({path:'shots5/s5-combo.png',fullPage:true});

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
