// Categorías de pago: solo admin, crear/editar/eliminar, tarifa fijo o por m² por especialidad.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

let categorias=[
  {id:1,nombre:'General',producto:'Puerta Multilock',tarifas:{hierro:{monto:25,modo:'fijo',prot_monto:5,prot_modo:'fijo'},masilla_pintura:{monto:30,modo:'fijo'}},activo:true},
  {id:2,nombre:'Ventana con protección',producto:'Ventana',tarifas:{masilla_pintura:{monto:10,modo:'m2'},armar:{monto:10,modo:'fijo'}},activo:true}
];
let catalogo=[
  {id:101,tipo:'Puerta Multilock',categoria_pago_id:1},{id:102,tipo:'Puerta Multilock',categoria_pago_id:1},{id:103,tipo:'Ventana',categoria_pago_id:2},
  {id:104,tipo:'Ventana',categoria_pago_id:null},{id:105,tipo:'Puerta Multilock',categoria_pago_id:null}
];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const method=req.method();const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:false}); return j([{usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,orden:1}]);}
  if(u.includes('/categorias_pago')){
    if(rol!=='admin') return j({message:'permission denied'},403);
    if(method==='GET') return j(categorias);
    if(method==='POST'){
      const body=JSON.parse(req.postData()||'{}');
      llamadas.push(['crear',body]);
      const nuevo={id:99,nombre:body.nombre,producto:body.producto,tarifas:body.tarifas,activo:true};
      categorias.push(nuevo);
      return j([nuevo],201);
    }
    if(method==='PATCH'){
      const body=JSON.parse(req.postData()||'{}');
      const id=Number(new URL(req.url()).searchParams.get('id').replace('eq.',''));
      llamadas.push(['editar',id,body]);
      const c=categorias.find(x=>x.id===id); if(c) Object.assign(c,body);
      return j([c]);
    }
    if(method==='DELETE'){
      const id=Number(new URL(req.url()).searchParams.get('id').replace('eq.',''));
      llamadas.push(['eliminar',id]);
      categorias=categorias.filter(x=>x.id!==id);
      catalogo.forEach(c=>{ if(c.categoria_pago_id===id) c.categoria_pago_id=null; });
      return j([]);
    }
  }
  if(u.includes('/catalogo')){
    if(method==='GET') return j(catalogo.map(c=>({id:c.id,nombre:'Modelo '+c.id,tipo:c.tipo,fotos:{},categoria_pago_id:c.categoria_pago_id})));
  }
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // Vendedora: no ve el módulo ni puede entrar directo
 const cy=await b.newContext({...devices['iPhone 13']});await mock(cy,'u3','vendedor');
 const y=await cy.newPage();y.on('pageerror',e=>err.push('vend:'+e.message));
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');
 await y.goto('http://127.0.0.1:8765/categorias-pago.html');await y.waitForURL('**/index.html');
 ok('Vendedora no puede entrar a categorias-pago.html directo',y.url().includes('index.html'));

 // Admin: entra desde Mi cuenta
 const ca=await b.newContext({...devices['iPhone 13']});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push('admin:'+e.message));a.on('dialog',d=>d.accept());
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');
 await a.click('#btnCuenta');await a.waitForSelector('#sheetCuenta.open');
 await a.click('#btnCategoriasPago');await a.waitForSelector('.c-card');
 ok('Lista muestra las 2 categorías existentes',(await a.$$('.c-card')).length===2);
 ok('Cada categoría dice de qué producto es y sus tarifas',(await a.textContent('.c-card')).includes('Puerta')&&(await a.textContent('.c-card')).includes('Hierro $25')&&(await a.textContent('.c-card')).includes('+$5 prot.')&&(await a.textContent('.c-card')).includes('Masilla y pintura $30'));
 ok('Aluminio dice que es por cada ventana',(await a.textContent('#lista')).includes('Aluminio $10 c/u'));
 ok('Se ve cuántos modelos usan cada una',(await a.textContent('#lista')).includes('Usada en 2 modelos') && (await a.textContent('#lista')).includes('Usada en 1 modelo'));
 await a.screenshot({path:'shots5/c1-lista.png',fullPage:true});

 // Nueva: primero el producto
 const filas=()=>a.$$eval('#filasTarifa .cat-fila:not(.prot)',x=>x.map(f=>f.dataset.k).join());
 const extras=()=>a.$$eval('#filasTarifa .cat-fila.prot',x=>x.map(f=>f.dataset.k).join());
 await a.click('#btnNuevo');await a.waitForSelector('#sheetFicha.open');
 ok('Sin producto no hay trabajos y lo pide',(await filas())===''&&(await a.textContent('#filasTarifa')).includes('Elige el producto'));
 await a.fill('#fNombre','Puertas');
 await a.click('#btnGuardar');await a.waitForTimeout(300);
 ok('No guarda sin producto y lo marca en rojo',!llamadas.some(x=>x[0]==='crear')&&await a.isVisible('#campoProducto .field-error'));
 await a.click('#optsProducto .opt[data-v="Ventana"]');
 ok('Ventana: Hierro, Masilla y pintura, Aluminio y Detalles, sin extra',(await filas())==='hierro,masilla_pintura,armar,detalles'&&(await extras())===''&&(await a.textContent('#filasTarifa')).includes('Aluminio')&&(await a.textContent('#filasTarifa')).includes('Por cada ventana'));
 await a.locator('.cat-fila[data-k="armar"] input').fill('12');
 await a.click('#optsProducto .opt[data-v="Combo"]');
 ok('Combo: 5 trabajos y el extra de la puerta',(await filas())==='hierro,masilla_pintura,detalles,armar,detalles_ventana'&&(await extras())==='hierro,masilla_pintura'&&(await a.textContent('#filasTarifa')).includes('Puerta y 2 protecciones'));
 ok('Lo escrito en Ventana no pasa al Combo',(await a.inputValue('.cat-fila[data-k="armar"] input'))==='');
 await a.click('#optsProducto .opt[data-v="Ventana"]');
 ok('Al volver a Ventana sigue lo que escribiste',(await a.inputValue('.cat-fila[data-k="armar"] input'))==='12');
 await a.click('#optsProducto .opt[data-v="Portón"]');
 ok('Portón: sin extra de protección',(await filas())==='hierro,masilla_pintura,detalles'&&(await extras())==='');
 await a.click('#optsProducto .opt[data-v="Puerta Multilock"]');
 ok('Puerta: Hierro, Masilla y pintura, Detalles y su extra aparte',(await filas())==='hierro,masilla_pintura,detalles'&&(await extras())==='hierro,masilla_pintura'&&(await a.textContent('.cat-extra')).includes('Extra si la puerta lleva protección')&&(await a.textContent('#filasTarifa')).includes('Se paga al terminar la pintura'));
 await a.locator('#filasTarifa > .cat-fila[data-k="hierro"] input').fill('20');
 await a.locator('.cat-extra .cat-fila[data-k="hierro"] input').fill('8');
 await a.locator('#filasTarifa > .cat-fila[data-k="masilla_pintura"] button[data-modo="m2"]').click();
 await a.locator('#filasTarifa > .cat-fila[data-k="masilla_pintura"] input').fill('4');
 await a.locator('.cat-extra .cat-fila[data-k="masilla_pintura"] button[data-modo="m2"]').click();
 await a.locator('.cat-extra .cat-fila[data-k="masilla_pintura"] input').fill('2');
 await a.locator('#filasTarifa > .cat-fila[data-k="detalles"] input').fill('');
 await a.screenshot({path:'shots5/c2-nueva.png',fullPage:true});
 // Extra sin el monto del trabajo
 await a.locator('#filasTarifa > .cat-fila[data-k="hierro"] input').fill('');
 await a.click('#btnGuardar');await a.waitForTimeout(400);
 ok('Extra sin el monto del trabajo: avisa y no guarda',!llamadas.some(x=>x[0]==='crear')&&(await a.textContent('#toast')).includes('por hierro')&&!!(await a.$('#filasTarifa > .cat-fila.invalid[data-k="hierro"]')));
 await a.locator('#filasTarifa > .cat-fila[data-k="hierro"] input').fill('20');
 await a.click('#btnGuardar');await a.waitForTimeout(500);
 const crea=llamadas.find(x=>x[0]==='crear');
 const tc=crea&&crea[1].tarifas;
 ok('Se crea con su producto y un solo monto de masilla y pintura',crea&&crea[1].producto==='Puerta Multilock'&&crea[1].nombre==='Puertas'&&tc.hierro.monto===20&&tc.hierro.prot_monto===8&&tc.masilla_pintura.monto===4&&tc.masilla_pintura.modo==='m2'&&tc.masilla_pintura.prot_monto===2&&tc.masilla_pintura.prot_modo==='m2'&&!tc.masilla&&!tc.pintura,crea&&crea[1]);
 ok('Lo de otros productos no se guarda (el aluminio escrito en Ventana)',tc&&!tc.armar&&!tc.detalles,tc);
 ok('Se cierra la hoja y aparece la nueva',(await a.$$('.c-card')).length===3&&(await a.textContent('#lista')).includes('+$8 prot.'));

 // Editar una que ya usan modelos: no se cambia el producto
 await a.click('.c-card >> text=General');await a.waitForSelector('#sheetFicha.open');
 ok('El botón eliminar aparece al editar',!(await a.$eval('#btnEliminar',x=>x.classList.contains('hidden'))));
 ok('En uso: los otros productos están bloqueados',await a.$eval('#optsProducto .opt[data-v="Ventana"]',x=>x.disabled)&&(await a.textContent('#hintProducto')).includes('quítasela'));
 await a.locator('#filasTarifa > .cat-fila[data-k="hierro"] input').fill('27');
 // Asignar: solo modelos de puerta
 await a.click('#btnAsignarModelos');await a.waitForSelector('#sheetModelos.open');
 await a.click('#chipsModelos [data-pestana="todos"]');
 const ids=await a.$$eval('#listaModelos .m-fila',x=>x.map(f=>f.dataset.mid).join());
 ok('Asignar a modelos muestra solo los de su producto',ids==='101,102,105',ids);
 await a.click('#sheetModelos [data-cerrar="sheetModelos"]');await a.waitForTimeout(400);
 await a.click('#btnGuardar');await a.waitForTimeout(500);
 const edita=llamadas.find(x=>x[0]==='editar');
 ok('Guarda el cambio con su producto',edita&&edita[2].tarifas.hierro.monto===27&&edita[2].tarifas.hierro.prot_monto===5&&edita[2].producto==='Puerta Multilock',edita&&edita[2]);
 ok('La lista muestra el monto actualizado',(await a.textContent('#lista')).includes('$27'));

 // Eliminar una categoría usada: avisa cuántos modelos se quedan sin categoría
 await a.click('.c-card >> text=Ventana con protección');await a.waitForSelector('#sheetFicha.open');
 await a.click('#btnEliminar');await a.waitForTimeout(500);
 const elimina=llamadas.find(x=>x[0]==='eliminar');
 ok('Se llamó a eliminar con el id correcto',elimina&&elimina[1]===2,elimina&&elimina[1]);
 ok('Ya no aparece en la lista',(await a.$$('.c-card')).length===2);
 await a.screenshot({path:'shots5/c3-final.png',fullPage:true});

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
