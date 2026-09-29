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
    if(name==='confirmar_abono'){const ab=v2.abonos.find(x=>x.id===a.aid);ab.estado=a.llego?'confirmado':'rechazado';ab.nota_confirmacion=a.nota;ab.confirmado_por=user;if(a.llego)v2.estado='en_produccion';return j({id:a.aid,estado:'confirmado',produccion:!!a.llego});}
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
 ok('Ya no existe "Pedir a producción": explica que pasa solo al confirmar el pago',!(await y.$('[data-accion="pedir-produccion"]')) && (await y.textContent('#fichaBody .btn-guia.espera')).includes('Espera que Ray confirme el pago') && (await y.textContent('#fichaBody .btn-guia.espera')).includes('pasa solo a producción'));
 ok('Nadie ve "Pasar a En producción"',!(await y.$('#fichaBody [data-estado="en_produccion"]')));
 ok('La vendedora no puede cancelar una venta',!(await y.$('#fichaBody [data-accion="cancelar"]')) && (await y.textContent('#fichaBody')).includes('Editar, PDF y seguimiento'));
 ok('Enlace para ver el seguimiento en la ficha',(await y.getAttribute('#fichaBody a.btn-grid[target="_blank"]','href')).includes('seguimiento.html?t=aaaaaaaa-bbbb-4ccc-8ddd-000000000002'));
 await y.screenshot({path:'shots4/s1-pasos-vendedora.png'});
 // Admin: aviso en Inicio
 const ca=await b.newContext({...devices['iPhone 13']});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push(e.message));
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');await a.waitForTimeout(1200);
 const av=await a.textContent('#avisosAdmin');
 ok('Ya no hay pendiente "espera producción"',!av.includes('espera producción'),av);
 ok('Admin ve cómo activar avisos en el iPhone',av.includes('Avisos: cómo activarlos'),av);
 ok('Ray ve "1 pago por confirmar"',av.includes('1 pago por confirmar'),av);
 await a.screenshot({path:'shots4/s2-inicio-admin.png'});
 // Ray confirma el abono
 await a.goto('http://127.0.0.1:8765/ventas.html?abrir=2');await a.waitForSelector('#sheetFicha.open');await a.waitForTimeout(1500);
 ok('Ficha muestra "Por confirmar"',(await a.textContent('#fichaBody')).includes('Por confirmar'));
 ok('A Ray le dice que falta que confirme el pago',(await a.textContent('#fichaBody .btn-guia.espera')).includes('Falta que confirmes el pago'));
 ok('El admin sí puede cancelar la venta',!!(await a.$('#fichaBody [data-accion="cancelar"]')));
 await a.click('#fichaBody [data-confirmar="1"]');await a.waitForTimeout(600);
 ok('Hoja de confirmar abono',(await a.textContent('#accionTitulo'))==='Confirmar pago');
 await a.fill('#aNota','Llegó a Zelle de Ray');await a.screenshot({path:'shots4/s4-confirmar.png'});
 await a.click('#btnAccion');
 const tst=await a.waitForSelector('#toast.show',{timeout:4000}).then(e=>e.textContent()).catch(()=>'');
 ok('Al confirmar avisa que pasó a producción',/pasó a producción/i.test(tst),tst);
 await a.waitForTimeout(1300);
 const ca1=rpcs.find(x=>x[0]==='confirmar_abono');ok('Confirma con su nota',ca1&&ca1[1].aid===1&&ca1[1].llego===true&&ca1[1].nota==='Llegó a Zelle de Ray',ca1&&ca1[1]);
 ok('Ficha muestra confirmado y la nota',(await a.textContent('#fichaBody')).includes('Confirmado')&&(await a.textContent('#fichaBody')).includes('Nota de Ray: Llegó a Zelle de Ray'));
 ok('Ahora está En producción y no se puede devolver a Confirmada',!(await a.$('#fichaBody [data-retro]')) && !(await a.$('#fichaBody .btn-guia.espera')));
 await a.screenshot({path:'shots4/s5-en-produccion.png'});
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
 // Reglas nuevas: combo con "Puerta y protecciones" y "Ventanas: armar / instalar", e Instalar que espera la pintura
 const Pp=(nombre,rama,orden,oficio,estado,espera)=>({nombre,rama,orden,oficio,estado,espera:!!espera,terminada_en:estado==='hecha'?new Date().toISOString():null,trabajando:false,foto:null});
 v1.items=[{nombre:'Combo Imperial',tipo:'Combo',especificaciones:{color:'Negro'},foto:null,precio_unitario:800,cantidad:1,a_medida:false,pieza_id:null,orden:0,pasos:[
   Pp('Hierro','principal',1,'hierro','hecha'),Pp('Masilla','principal',2,'masilla','pendiente'),Pp('Pintura','principal',3,'pintura','pendiente',1),Pp('Detalles','principal',4,'detalles','pendiente',1),
   Pp('Armar 2 ventanas','ventana',1,'armar','hecha'),Pp('Instalar en las protecciones','ventana',2,'instalar','pendiente',1)]}];
 await c.goto('http://127.0.0.1:8765/seguimiento.html?t='+TOK);await c.waitForSelector('.pt');await c.waitForTimeout(300);
 const pn=await c.$$eval('.pt-t',x=>x.map(y=>y.textContent));
 ok('Público (reglas nuevas): pasos del combo con nombres para el cliente',pn.join('|')==='Hierro|Masilla|Pintura|Detalles|Ventanas: armar|Ventanas: instalar en las protecciones',pn);
 ok('Público: va en masilla (instalar espera la pintura, no sale como actual)',(await c.textContent('.estado-grande')).includes('va en masilla') && (await c.$$('.pt-p.actual')).length===1);
 await c.screenshot({path:'shots4/s3b-publico-combo.png',fullPage:true});
 await c.goto('http://127.0.0.1:8765/seguimiento.html?t=aaaaaaaa-bbbb-4ccc-8ddd-999999999999');await c.waitForSelector('.aviso-fin');
 ok('Público: enlace inexistente',(await c.textContent('.aviso-fin h1')).includes('No encontramos'));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
