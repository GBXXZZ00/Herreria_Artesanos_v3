// Categorías de pago: solo admin, crear/editar/eliminar, tarifa fijo o por m² por especialidad.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

let categorias=[
  {id:1,nombre:'General',tarifas:{herrero:{monto:25,modo:'fijo'},masilla_pintura:{monto:30,modo:'fijo'}},activo:true},
  {id:2,nombre:'Ventana con protección',tarifas:{masilla_pintura:{monto:10,modo:'m2'},ventanero:{monto:10,modo:'fijo'}},activo:true}
];
let catalogo=[
  {id:101,categoria_pago_id:1},{id:102,categoria_pago_id:1},{id:103,categoria_pago_id:2}
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
      const nuevo={id:99,nombre:body.nombre,tarifas:body.tarifas,activo:true};
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
    if(method==='GET') return j(catalogo.map(c=>({id:c.id,nombre:'Modelo '+c.id,tipo:'Puerta Multilock',fotos:{},categoria_pago_id:c.categoria_pago_id})));
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
 ok('Se ven las tarifas de "General"',(await a.textContent('.c-card')).includes('Herrero') && (await a.textContent('.c-card')).includes('$25'));
 ok('Se ve cuántos modelos usan cada una',(await a.textContent('#lista')).includes('Usada en 2 modelos') && (await a.textContent('#lista')).includes('Usada en 1 modelo'));
 await a.screenshot({path:'shots5/c1-lista.png',fullPage:true});

 // Crear una nueva categoría
 await a.click('#btnNuevo');await a.waitForSelector('#sheetFicha.open');
 await a.fill('#fNombre','Protección de puerta');
 const filaHerrero=a.locator('.cat-fila[data-esp="herrero"]');
 await filaHerrero.locator('input').fill('20');
 const filaVentanero=a.locator('.cat-fila[data-esp="ventanero"]');
 await filaVentanero.locator('button[data-modo="m2"]').click();
 await filaVentanero.locator('input').fill('8');
 await a.screenshot({path:'shots5/c2-nueva.png',fullPage:true});
 await a.click('#btnGuardar');await a.waitForTimeout(500);
 const crea=llamadas.find(x=>x[0]==='crear');
 ok('Se llamó a crear con nombre y tarifas correctas',crea&&crea[1].nombre==='Protección de puerta'&&crea[1].tarifas.herrero.monto===20&&crea[1].tarifas.herrero.modo==='fijo'&&crea[1].tarifas.ventanero.monto===8&&crea[1].tarifas.ventanero.modo==='m2',crea&&crea[1]);
 ok('Las especialidades sin monto no se guardan',crea && !crea[1].tarifas.masilla_pintura && !crea[1].tarifas.acabados,crea&&crea[1].tarifas);
 ok('Se cierra la hoja y aparece la nueva categoría',(await a.$$('.c-card')).length===3);

 // Editar: cambiar un monto
 await a.click('.c-card >> text=General');await a.waitForSelector('#sheetFicha.open');
 ok('El botón eliminar aparece al editar (no al crear)',!(await a.$eval('#btnEliminar',x=>x.classList.contains('hidden'))));
 const filaHerrero2=a.locator('.cat-fila[data-esp="herrero"]');
 await filaHerrero2.locator('input').fill('27');
 await a.click('#btnGuardar');await a.waitForTimeout(500);
 const edita=llamadas.find(x=>x[0]==='editar');
 ok('Se llamó a editar con el monto nuevo',edita&&edita[2].tarifas.herrero.monto===27,edita&&edita[2]);
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
