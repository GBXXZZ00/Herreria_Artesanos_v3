const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
const TOK='aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
const v1={id:1,cliente_id:3,estado:'en_produccion',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:50,subtotal:800,total:850,vence_en:dia(-5),fecha_entrega:dia(5),
 confirmada_en:new Date(Date.now()-3*864e5).toISOString(),produccion_en:new Date(Date.now()-1*864e5).toISOString(),lista_en:null,entregada_en:null,creado_en:new Date(Date.now()-5*864e5).toISOString(),actualizado_en:new Date().toISOString(),token_seguimiento:TOK,
 items:[{nombre:'Lineal',tipo:'Puerta Multilock',especificaciones:{color:'Blanco',alto:2,ancho:1,manillon:true,manillon_tipo:'H'},foto:GIF,precio_unitario:400,cantidad:2,orden:0}],
 abonos:[{fecha:new Date(Date.now()-3*864e5).toISOString(),monto:400,metodo:'Zelle',tipo:'abono',estado:'por_confirmar'}]};
const v2={id:2,cliente_id:3,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,subtotal:300,total:300,vence_en:dia(-5),fecha_entrega:dia(20),confirmada_en:new Date().toISOString(),creado_en:new Date().toISOString(),actualizado_en:new Date().toISOString(),token_seguimiento:'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',produccion_pedida_en:null,items:[{id:9,nombre:'Imperial',tipo:'Puerta Multilock',especificaciones:{},foto:GIF,precio_unitario:300,cantidad:1,orden:0}],abonos:[{id:1,monto:150,metodo:'Zelle',tipo:'abono',estado:'por_confirmar',registrado_por:'u3',fecha:new Date().toISOString()}]};
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const rpcs=[];
function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a,user]);
    if(name==='seguimiento_publico'){ if(a.t===TOK) return j(Object.assign({},v1,{cliente:{nombre:cli.nombre,cedula:'V12•••678',telefono:'•••4567'},sede:{nombre:'Cumbres de Maracaibo'}})); return j({error:'no_existe'}); }
    if(name==='confirmar_abono'){const ab=v2.abonos.find(x=>x.id===a.aid);ab.estado=a.llego?'confirmado':'rechazado';ab.nota_confirmacion=a.nota;ab.confirmado_por=user;return j({id:a.aid});}
    if(name==='pedir_produccion'){v2.produccion_pedida_en=new Date().toISOString();v2.produccion_pedida_por=user;return j({id:2});}
    return j({});}
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:rol==='admin'}); if(u.includes('select=id,nombre'))return j([{id:'u2',nombre:'Ray'},{id:'u3',nombre:'Yulimar'}]); return j([{usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,orden:1}]);}
  if(u.includes('/ventas')){ const full=v=>Object.assign({},v,{cliente:cli,sede:{id:1,nombre:'Cumbres'}}); const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full([v1,v2].find(x=>x.id===+m[1]))); let l=[v1,v2]; if(u.includes('produccion_pedida_en=not.is.null')) l=l.filter(x=>x.produccion_pedida_en&&x.estado==='confirmada'); return j(l.map(full)); }
  if(u.includes('/abonos'))return j(v2.abonos.filter(x=>x.estado==='por_confirmar').map(x=>Object.assign({venta_id:2},x)));
  if(u.includes('/catalogo'))return j([]);
  if(u.includes('/disponibles'))return j([]);
  return j([]);});}
(async()=>{ const b=await chromium.launch(); try{
 const err=[];
 // Vendedora: pide a producción
 const cy=await b.newContext({...devices['iPhone 13']});await mock(cy,'u3','vendedor');
 const y=await cy.newPage();y.on('pageerror',e=>err.push(e.message));y.on('dialog',d=>d.accept());
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');await y.waitForTimeout(800);
 ok('Vendedora no ve avisos de admin',!(await y.textContent('#avisosAdmin')).includes('producción')&&!(await y.textContent('#avisosAdmin')).includes('por confirmar'));
 ok('Vendedora también puede activar avisos',!(await y.$eval('#btnNotif',x=>x.classList.contains('hidden'))));
 await y.goto('http://127.0.0.1:8765/ventas.html?abrir=2');await y.waitForSelector('#sheetFicha.open');await y.waitForTimeout(1500);
 ok('Abrir por enlace (notificación) abre la ficha',(await y.textContent('.f-num')).includes('N° 2'));
 ok('Vendedora ve "Pedir a producción" con explicación',(await y.textContent('#fichaBody [data-accion="pedir-produccion"]')).includes('Le llega un aviso al administrador'));
 ok('Vendedora no ve "Pasar a En producción"',!(await y.$('#fichaBody [data-estado="en_produccion"]')));
 await y.click('#fichaBody [data-accion="pedir-produccion"]');await y.waitForTimeout(1500);
 ok('Pedir a producción llama al servidor',rpcs.some(x=>x[0]==='pedir_produccion'&&x[1].vid===2));
 ok('Queda "Pedido a producción ✓"',(await y.textContent('#fichaBody .btn-guia.hecho')).includes('Pedido a producción'));
 ok('Enlace para ver el seguimiento en la ficha',(await y.getAttribute('#fichaBody a.btn-grid[target="_blank"]','href')).includes('seguimiento.html?t=aaaaaaaa-bbbb-4ccc-8ddd-000000000002'));
 await y.screenshot({path:'shots4/s1-pasos-vendedora.png'});
 // Admin: aviso en Inicio
 const ca=await b.newContext({...devices['iPhone 13']});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push(e.message));
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');await a.waitForTimeout(1200);
 const av=await a.textContent('#avisosAdmin');
 ok('Admin ve "1 pedido espera producción"',av.includes('1 pedido espera producción')&&av.includes('N° 2'),av);
 ok('Admin ve cómo activar avisos en el iPhone',av.includes('Abre la app desde su ícono'),av);
 ok('Ray ve "1 pago por confirmar"',av.includes('1 pago por confirmar'),av);
 await a.screenshot({path:'shots4/s2-inicio-admin.png'});
 // Ray confirma el abono
 await a.goto('http://127.0.0.1:8765/ventas.html?abrir=2');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(1500);
 ok('Ficha muestra "Por confirmar"',(await a.textContent('#fichaBody')).includes('Por confirmar'));
 await a.click('#fichaBody [data-confirmar="1"]');await a.waitForTimeout(600);
 ok('Hoja de confirmar abono',(await a.textContent('#accionTitulo'))==='Confirmar pago');
 await a.fill('#aNota','Llegó a Zelle de Ray');await a.screenshot({path:'shots4/s4-confirmar.png'});
 await a.click('#btnAccion');await a.waitForTimeout(1500);
 const ca1=rpcs.find(x=>x[0]==='confirmar_abono');ok('Confirma con su nota',ca1&&ca1[1].aid===1&&ca1[1].llego===true&&ca1[1].nota==='Llegó a Zelle de Ray',ca1&&ca1[1]);
 ok('Ficha muestra confirmado y la nota',(await a.textContent('#fichaBody')).includes('Confirmado')&&(await a.textContent('#fichaBody')).includes('Nota de Ray: Llegó a Zelle de Ray'));
 // Página pública
 const cc=await b.newContext({...devices['iPhone 13'],acceptDownloads:true});await mock(cc,'x','vendedor');
 const c=await cc.newPage();c.on('pageerror',e=>err.push('pub:'+e.message));
 await c.goto('http://127.0.0.1:8765/seguimiento.html?t='+TOK);await c.waitForSelector('.hola');
 ok('Público: saludo y número',(await c.textContent('.hola'))==='Hola, María'&&(await c.textContent('.num')).includes('Pedido N° 1'));
 ok('Público: estado En fabricación',(await c.textContent('.estado-grande')).includes('En fabricación'));
 ok('Público: línea de avance (2 hechos/actual)',(await c.$$('.l-paso.hecho')).length===1&&(await c.$$('.l-paso.actual')).length===1);
 ok('Público: abono en revisión',(await c.textContent('main')).includes('En revisión')&&(await c.textContent('main')).includes('Estamos revisando tu pago'));
 ok('Público: el paso actual pulsa',await c.$eval('.l-paso.actual .l-dot',x=>getComputedStyle(x,'::after').animationName)==='pulso');
 ok('Público: avance en cada producto',(await c.$$('.prod .prod-av')).length===1&&(await c.textContent('.prod-est'))==='En fabricación');
 ok('Público: pagos y resta',(await c.textContent('.barra-txt')).includes('Resta $450'));
 ok('Público: sin cédula completa',!(await c.content()).includes('V12345678'));
 await c.waitForSelector('#btnBajar:not([disabled])',{timeout:20000});
 const [dl]=await Promise.all([c.waitForEvent('download'),c.click('#btnBajar')]);await dl.saveAs('pub1.pdf');
 ok('Público: descarga su PDF',fs.statSync('pub1.pdf').size>5000&&dl.suggestedFilename()==='Pedido-1-Maria-Gonzalez.pdf',dl.suggestedFilename());
 ok('Público: botón WhatsApp al negocio',(await c.getAttribute('.btn-wa','href')).startsWith('https://wa.me/584220167079'));
 await c.screenshot({path:'shots4/s3-publico.png',fullPage:true});
 await c.goto('http://127.0.0.1:8765/seguimiento.html?t=aaaaaaaa-bbbb-4ccc-8ddd-999999999999');await c.waitForSelector('.aviso-fin');
 ok('Público: enlace inexistente',(await c.textContent('.aviso-fin h1')).includes('No encontramos'));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
