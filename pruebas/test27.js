// Menú: si al abrir la app falla la lectura del perfil (mala señal), un administrador
// no pierde "Producción" (antes caía en "vendedor"). Se usa el último perfil guardado.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
let perfilFalla=false; let intentos=0;

(async()=>{ const b=await chromium.launch(); const err=[]; try{
 const ctx=await b.newContext({...devices['iPhone 13']});
 await ctx.route('**/*.supabase.co/**',async r=>{const u=decodeURIComponent(r.request().url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses('u2'));
  if(u.includes('/auth/v1/user'))return j({id:'u2'});
  if(u.includes('/perfiles')){
    if(u.includes('id=eq')){ if(perfilFalla){ intentos++; return j({message:'Fallo de red'},503); } return j({id:'u2',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'}); }
    return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);
  }
  return j([]);});
 const a=await ctx.newPage();a.on('pageerror',e=>err.push(e.message));
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('.quien-btn');await a.click('.quien-btn');
 for(const d of '222222') await a.click(`#pinTeclado [data-t="${d}"]`);
 await a.waitForSelector('#vInicio.entra');
 ok('Con señal: el admin ve Producción en el menú',!!(await a.$('a.nav-item[href="produccion.html"]')));

 // Sin señal al leer el perfil
 perfilFalla=true;
 await a.goto('http://127.0.0.1:8765/catalogo.html');await a.waitForTimeout(2500);
 ok('Sin señal: se reintenta leer el perfil',intentos>=2,intentos);
 ok('Sin señal: sigue viendo Producción (usa el perfil guardado)',!!(await a.$('a.nav-item[href="produccion.html"]')));
 await a.goto('http://127.0.0.1:8765/produccion.html');await a.waitForTimeout(2500);
 ok('Sin señal: puede entrar a Producción',a.url().includes('produccion.html'));

 // Al salir se borra el perfil guardado
 perfilFalla=false;
 await a.goto('http://127.0.0.1:8765/index.html');await a.waitForSelector('#vInicio.entra');
 await a.click('#btnCuenta');await a.waitForSelector('#sheetCuenta.open');await a.click('#btnSalir');await a.waitForTimeout(800);
 ok('Al salir se borra el perfil guardado del teléfono',await a.evaluate(()=>!Object.keys(localStorage).some(k=>k.startsWith('ah_cache_perfil_'))));


 // Primer ingreso sin señal (sin perfil guardado): no se adivina, se pide reintentar
 const c2=await b.newContext({...devices['iPhone 13']});
 let falla2=true;
 await c2.route('**/*.supabase.co/**',async r=>{const u=decodeURIComponent(r.request().url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses('u9'));
  if(u.includes('/auth/v1/user'))return j({id:'u9'});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return falla2?j({message:'Fallo'},503):j({id:'u9',usuario:'jesus',nombre:'Jesús',rol:'trabajador'}); return j([{usuario:'jesus',nombre:'Jesús',rol:'trabajador',orden:1}]); }
  if(u.includes('/rpc/mis_trabajos'))return j([]);
  if(u.includes('/rpc/mis_pagos'))return j({ganado:0,vales:0,movimientos:[]});
  return j([]);});
 const t=await c2.newPage();t.on('pageerror',e=>err.push('t:'+e.message));
 await t.goto('http://127.0.0.1:8765/index.html');await t.waitForSelector('.quien-btn');await t.click('.quien-btn');
 for(const d of '555555') await t.click(`#pinTeclado [data-t="${d}"]`);
 await t.waitForSelector('[data-reintentar-perfil]',{timeout:25000});
 ok('Sin perfil: pide reintentar y no muestra módulos ni menú',!(await t.isVisible('#modulos .ini-tile')) && !(await t.isVisible('#menuModulos')) && !(await t.isVisible('#btnNuevaVenta')));
 falla2=false;
 await t.click('[data-reintentar-perfil]');await t.waitForSelector('.hoy',{timeout:8000});
 ok('Reintentar con señal carga su Inicio de trabajador',!!(await t.$('.hoy')));
 // Mismo teléfono: entra Jesús, sale, entra Gualfredo sin recargar: el menú vuelve a tener Producción
 const c3=await b.newContext({...devices['iPhone 13']});
 let quien='jesus';
 await c3.route('**/*.supabase.co/**',async r=>{const u=decodeURIComponent(r.request().url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  const id=quien==='jesus'?'u9':'u1';
  if(u.includes('/auth/v1/token'))return j(ses(id));
  if(u.includes('/auth/v1/user'))return j({id});
  if(u.includes('/auth/v1/logout'))return j({});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(quien==='jesus'?{id:'u9',usuario:'jesus',nombre:'Jesús',rol:'trabajador'}:{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin'});
    return j([{usuario:'jesus',nombre:'Jesús',rol:'trabajador',orden:2},{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]); }
  if(u.includes('/rpc/mis_trabajos'))return j([]);
  if(u.includes('/rpc/mis_pagos'))return j({trabajos:[],vales:[],pagos:[]});
  return j([]);});
 const z=await c3.newPage();z.on('pageerror',e=>err.push('z:'+e.message));
 await z.goto('http://127.0.0.1:8765/index.html');await z.waitForSelector('.quien-btn');
 await z.click('.quien-btn >> text=Jesús');for(const d of '555555') await z.click(`#pinTeclado [data-t="${d}"]`);
 await z.waitForSelector('.hoy');
 await z.click('#btnCuenta');await z.waitForSelector('#sheetCuenta.open');await z.click('#btnSalir');await z.waitForTimeout(800);
 quien='gualfredo';
 await z.waitForSelector('.quien-btn');await z.click('.quien-btn >> text=Gualfredo');for(const d of '111111') await z.click(`#pinTeclado [data-t="${d}"]`);
 await z.waitForSelector('#vInicio.entra');await z.waitForTimeout(1200);
 ok('Después de Jesús, Gualfredo sí ve Producción en el menú de abajo (sin recargar)',!!(await z.$('a.nav-item[href="produccion.html"]')) && await z.isVisible('#menuModulos'));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
