const __L=require('./lib');const __fs=require('fs');const __OUT=__dirname+'/shots-usuarios/';__fs.mkdirSync(__OUT,{recursive:true});
const __MAP={"s0-mi-cuenta-cajitas":[[["#btnUsuarios","1"],["#btnCategoriasPago","2"]]],
 "s1-nuevo-trabajador":[[["#nRol","1"],["#nEspecialidad","2"]]],
 "s0b-lista":[[["#btnNuevo","1"]]],"s1b-ficha":[[["#fichaBody [data-accion=\"pin\"]","1"],["#fichaBody [data-accion=\"desactivar\"]","2"]]],"s2-ficha-propia":[],
 "s3-lista-final":[[[".u-card","1"]]],
 "__insertar":[["await a.click('#btnUsuarios');await a.waitForSelector('.u-card');","await F(a,'s0b-lista');"],
   ["await a.click('.u-card >> text=Pedro Pérez');await a.waitForSelector('#sheetFicha.open');","await F(a,'s1b-ficha');"]]}
;
async function F(pg,n){const m=__MAP[n];if(m===undefined)return;try{await pg.waitForTimeout(300);if(!m.length)return await pg.screenshot({path:__OUT+n+'.png'});await __L.foto(pg,__OUT,n,m[0],Object.assign({completa:true},m[1]||{}));}catch(e){console.log('marca',n,e.message.split('\n')[0]);await pg.screenshot({path:__OUT+n+'.png'});}}
// Módulo de Usuarios: solo lo ve un admin desde "Mi cuenta", crear/desactivar/resetear PIN/eliminar.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};

let usuarios=[
  {id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',especialidades:[],activo:true,orden:1},
  {id:'u2',usuario:'raymundo',nombre:'Ray',rol:'admin',especialidades:[],activo:true,orden:2},
  {id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',especialidades:[],activo:true,orden:3}
];
const llamadas=[];

function mock(ctx,user,rol){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/functions/v1/gestionar_usuarios')){
    const body=JSON.parse(req.postData()||'{}');
    llamadas.push([body.accion, body.payload, user]);
    const quien=usuarios.find(x=>x.id===user);
    if(!quien||quien.rol!=='admin') return j({error:'No autorizado'},403);
    if(body.accion==='listar') return j({usuarios});
    if(body.accion==='crear'){
      const p=body.payload;
      if(usuarios.some(x=>x.usuario===p.usuario)) return j({error:'Ya existe un usuario con ese nombre de acceso'},400);
      const nuevo={id:'nuevo1',usuario:p.usuario,nombre:p.nombre,rol:p.rol,especialidades:Array.isArray(p.especialidades)?p.especialidades:[],activo:true,orden:usuarios.length+1};
      usuarios.push(nuevo);
      return j({id:nuevo.id});
    }
    if(body.accion==='activar'||body.accion==='desactivar'){
      const x=usuarios.find(a=>a.id===body.payload.id); if(x) x.activo=body.accion==='activar';
      return j({ok:true});
    }
    if(body.accion==='resetPin') return j({ok:true});
    if(body.accion==='eliminar'){ usuarios=usuarios.filter(x=>x.id!==body.payload.id); return j({ok:true}); }
    return j({error:'Acción no reconocida'},400);
  }
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:user,usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,sede_id:1,confirma_abonos:false}); return j([{usuario:rol==='admin'?'raymundo':'yulimar',nombre:rol==='admin'?'Ray':'Yulimar',rol,orden:1}]);}
  return j([]);});}

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // Vendedora: no ve "Usuarios"
 const cy=await b.newContext({...devices['iPhone 13'],locale:'es-VE',timezoneId:'America/Caracas'});await mock(cy,'u3','vendedor');
 const y=await cy.newPage();y.on('pageerror',e=>err.push('vend:'+e.message));
 await y.goto('http://127.0.0.1:8765/index.html');await y.waitForSelector('.quien-btn');await y.click('.quien-btn');
 for(const d of '333333') await y.click(`#pinTeclado [data-t="${d}"]`);
 await y.waitForSelector('#vInicio.entra');
 await y.click('#btnCuenta');await y.waitForSelector('#sheetCuenta.open');
 ok('Vendedora no ve el grupo de Administración en Mi cuenta',await y.$eval('#grupoModulosAdmin',x=>x.classList.contains('hidden')));
 // Entrando directo por la URL la manda de vuelta a Inicio
 await y.goto('http://127.0.0.1:8765/usuarios.html');await y.waitForURL('**/index.html');
 ok('Vendedora no puede entrar a usuarios.html directo',y.url().includes('index.html'));

 // Admin: sí ve "Usuarios" y entra al módulo
 const ca=await b.newContext({...devices['iPhone 13'],locale:'es-VE',timezoneId:'America/Caracas'});await mock(ca,'u2','admin');
 const a=await ca.newPage();a.on('pageerror',e=>err.push('admin:'+e.message));a.on('dialog',d=>d.accept());
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');
 await a.click('#btnCuenta');await a.waitForSelector('#sheetCuenta.open');
 ok('Admin sí ve el grupo de Administración con "Usuarios"',!(await a.$eval('#grupoModulosAdmin',x=>x.classList.contains('hidden'))));
 ok('Y también "Categorías de pago" junto a Usuarios',!!(await a.$('#btnCategoriasPago')));
 ok('Mi cuenta muestra la cuadrícula de cajitas con 4 opciones',(await a.$$('#sheetCuenta .cuenta-box')).length===4);
 ok('Las cajitas son Cambiar PIN, Notificaciones, Aviso de prueba y Salir',await a.$('#btnCambiarPin.cuenta-box')&&await a.$('#btnNotif.cuenta-box')&&await a.$('#btnPrueba.cuenta-box')&&await a.$('#btnSalir.cuenta-box'));
 await F(a,'s0-mi-cuenta-cajitas');
 await a.click('#btnUsuarios');await a.waitForSelector('.u-card');await F(a,'s0b-lista');
 ok('Lista muestra los 3 usuarios existentes',(await a.$$('.u-card')).length===3);
 ok('Se ve el rol/especialidad de cada uno',(await a.textContent('#lista')).includes('Vendedor'));

 // Crear un trabajador
 await a.click('#btnNuevo');await a.waitForSelector('#sheetNuevo.open');
 await a.fill('#nNombre','Pedro Pérez');
 await a.fill('#nUsuario','pedro');
 await a.fill('#nPin','654321');
 await a.click('#nRol [data-v="trabajador"]');
 ok('Al elegir trabajador aparece la especialidad',!(await a.$eval('#fEspecialidad',x=>x.classList.contains('hidden'))));
 await a.click('#nEspecialidad [data-v="herrero"]');
 await a.click('#nEspecialidad [data-v="ventanero"]');
 await F(a,'s1-nuevo-trabajador');
 await a.click('#btnCrear');await a.waitForTimeout(600);
 const crea=llamadas.find(x=>x[0]==='crear');
 ok('Se llamó a crear con los datos correctos (varias especialidades)',crea&&crea[1].nombre==='Pedro Pérez'&&crea[1].usuario==='pedro'&&crea[1].rol==='trabajador'&&crea[1].especialidades.includes('herrero')&&crea[1].especialidades.includes('ventanero')&&crea[1].especialidades.length===2,crea&&crea[1]);
 await a.waitForTimeout(500);
 ok('Se cierra la hoja y aparece el nuevo usuario',(await a.$$('.u-card')).length===4);
 ok('Muestra las especialidades del nuevo trabajador',(await a.textContent('#lista')).includes('Herrero')&&(await a.textContent('#lista')).includes('Aluminio'));

 // Restablecer PIN del nuevo trabajador
 await a.click('.u-card >> text=Pedro Pérez');await a.waitForSelector('#sheetFicha.open');await F(a,'s1b-ficha');
 await a.click('#fichaBody [data-accion="pin"]');await a.waitForSelector('#sheetPin2.open');
 await a.fill('#rPin','111111');
 await a.click('#btnGuardarPin');await a.waitForTimeout(500);
 const reset=llamadas.find(x=>x[0]==='resetPin');
 ok('Restablecer PIN llama con el usuario y el pin nuevo',reset&&reset[1].pin==='111111',reset&&reset[1]);

 // Desactivar
 await a.click('.u-card >> text=Pedro Pérez');await a.waitForSelector('#sheetFicha.open');
 await a.click('#fichaBody [data-accion="desactivar"]');await a.waitForTimeout(500);
 ok('Se desactivó (queda marcado Inactivo en la lista)',(await a.textContent('#lista')).includes('Inactivo'));

 // Mi propia cuenta no se puede desactivar ni eliminar
 await a.click('.u-card >> text=Ray');await a.waitForSelector('#sheetFicha.open');
 ok('Mi propia cuenta no tiene botón de desactivar ni eliminar',!(await a.$('#fichaBody [data-accion="desactivar"]'))&&!(await a.$('#fichaBody [data-accion="eliminar"]')));
 await F(a,'s2-ficha-propia');

 // Eliminar a Pedro
 await a.click('#scrimFicha');await a.waitForTimeout(400);
 await a.click('.u-card >> text=Pedro Pérez');await a.waitForSelector('#sheetFicha.open');
 await a.click('#fichaBody [data-accion="eliminar"]');await a.waitForTimeout(500);
 const elim=llamadas.find(x=>x[0]==='eliminar');
 ok('Eliminar llama al servidor con el id correcto',elim&&elim[1].id==='nuevo1',elim&&elim[1]);
 ok('Ya no aparece en la lista',(await a.$$('.u-card')).length===3);
 await F(a,'s3-lista-final');

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
