// Nómina: quién la ve y quién paga, vales que piden (solo Ray aprueba, aquí mismo), vale en
// bolívares, trabajos sin monto, lo del domingo para la próxima semana, montos que cambiaron y
// el recibo de un trabajo (con la foto en otro color avisada).
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const LUIS_UUID='8f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const hace=(d)=>new Date(Date.now()-d*864e5).toISOString();
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const PERF={u1:{id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',confirma_abonos:false},u2:{id:'u2',usuario:'raymundo',nombre:'Ray',rol:'admin',confirma_abonos:true},u3:{id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',confirma_abonos:false},u5:{id:'u5',usuario:'jesus',nombre:'Jesús',rol:'trabajador',confirma_abonos:false}};
const item=(id,extra)=>Object.assign({id,etapa:'Ensamblar',producto:'Ventana Clásica',tipo:'Ventana',cantidad:1,venta_id:16,interna:false,cliente:'María González',sede:'Cumbres',fecha:hace(1),semana:'2026-09-28',monto:10,foto:GIF,foto_de:'Blanco',foto_trabajo:GIF,especificaciones:{color:'Blanco',alto:1,ancho:1.2},categoria:'Ventanas'},extra||{});
let fichaLuis={trabajador:{id:'t2',nombre:'Luis',especialidades:['ventanero']},semana:'2026-09-28',puede_pagar:true,
  trabajos:[item(71),item(72,{monto:null,producto:'Reja a medida',etapa:'Hierro',especificaciones:{color:'Negro'}})],proxima:[item(73,{producto:'Portón Real',etapa:'Hierro',monto:40})],vales:[],vales_proxima:[{id:44,monto:3,nota:'refresco',fecha:hace(0)}],vale_pendiente:null,pagos:[]};
let fichaPedro={trabajador:{id:'t3',nombre:'Pedro',especialidades:['masilla_pintura']},semana:'2026-09-28',puede_pagar:true,
  trabajos:[item(81,{etapa:'Masilla y pintura',monto:15,interna:true,cliente:null,sede:'Sede Cumbres'})],proxima:[],vales:[],vale_pendiente:{id:5,monto:8,nota:'pasaje',fecha:hace(0)},pagos:[]};
const lista=()=>({semana:'2026-09-28',puede_pagar:true,trabajadores:[
  {id:'t2',nombre:'Luis',especialidades:['ventanero'],trabajos:2,trabajos_monto:10,por_definir:1,vales_monto:0,neto:10,proxima:1,ultimo_pago:null},
  {id:'t3',nombre:'Pedro',especialidades:['masilla_pintura'],trabajos:1,trabajos_monto:15,por_definir:0,vales_monto:valesPedro,neto:15-valesPedro,proxima:0,vale_pendiente:fichaPedro.vale_pendiente?fichaPedro.vale_pendiente.monto:null,ultimo_pago:{monto:60,pagado_en:hace(2)}}]});
let valesPedro=0; const llamadas=[]; let cambio=false;

function mock(ctx,user){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const P=PERF[user];
  const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j(P); return j([{usuario:P.usuario,nombre:P.nombre,rol:P.rol,orden:1}]); }
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');llamadas.push([name,a,user]);
    if(name==='nomina_semana'){ if(P.rol!=='admin')return j({message:'Solo un administrador ve la nómina'},400); const l=lista();l.puede_pagar=!!P.confirma_abonos;return j(l); }
    if(name==='nomina_trabajador'){ if(!/^t\d$/.test(a.tid)&&a.tid!==LUIS_UUID)return j({message:'invalid input syntax for type uuid: "'+a.tid+'"'},400); const f=JSON.parse(JSON.stringify((a.tid==='t2'||a.tid===LUIS_UUID)?fichaLuis:fichaPedro));f.puede_pagar=!!P.confirma_abonos;
      if(a.tid==='t3'&&valesPedro)f.vales=[{id:9,monto:valesPedro,nota:'medicinas',fecha:hace(0),monto_bs:400,tasa:40}];return j(f); }
    if(name==='anotar_vale'){ valesPedro=a.p_monto;return j({id:9}); }
    if(name==='resolver_vale'){ if(!P.confirma_abonos)return j({message:'Solo Ray aprueba los vales'},400); fichaPedro.vale_pendiente=null; return j(null); }
    if(name==='pagar_trabajador'){ if(cambio)return j({message:'Los montos cambiaron mientras lo veías. Revisa de nuevo'},400); return j({id:1,monto:a.esperado}); }
    return j(null);}
  return j([]);});}
async function entrar(b,user,pin){const ctx=await b.newContext({...devices['iPhone 13']});await mock(ctx,user);const p=await ctx.newPage();p._e=[];p.on('pageerror',e=>p._e.push(e.message));p.on('dialog',d=>d.accept());
  await p.goto('http://127.0.0.1:8765/index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');for(const d of pin)await p.click(`#pinTeclado [data-t="${d}"]`);await p.waitForSelector('#vInicio.entra');return p;}
const txt=async(p,s)=>((await p.textContent(s))||'').replace(/\s+/g,' ');

(async()=>{ const b=await chromium.launch(); const pags=[]; try{
 // Vendedora y trabajador no entran
 const y=await entrar(b,'u3','333333');pags.push(y);
 ok('La vendedora no ve Nómina en su Inicio',!(await y.$('a.ini-tile[href="nomina.html"]')));
 await y.goto('http://127.0.0.1:8765/nomina.html');await y.waitForURL('**/index.html',{timeout:8000});
 ok('La vendedora no puede entrar a nomina.html',y.url().includes('index.html'));
 const t=await entrar(b,'u5','555555');pags.push(t);
 await t.goto('http://127.0.0.1:8765/nomina.html',{waitUntil:'commit'}).catch(()=>{});await t.waitForURL('**/index.html',{timeout:8000}).catch(()=>{});await t.waitForTimeout(800);
 ok('El trabajador tampoco',t.url().includes('index.html'));

 // Gualfredo: ve todo pero no paga
 const g=await entrar(b,'u1','111111');pags.push(g);
 await g.waitForSelector('a.ini-tile[href="nomina.html"]');
 await g.click('a.ini-tile[href="nomina.html"]');await g.waitForSelector('.n-card');
 ok('Gualfredo ve la lista con cada trabajador y su último pago',(await g.$$('.n-card')).length===2 && (await txt(g,'.n-card >> nth=1')).includes('$60'));
 await g.click('.n-card >> nth=0');await g.waitForSelector('#sheetTrab.open');
 ok('Gualfredo no tiene botón de pagar ni de anotar vale',!(await g.$('#btnPagar')) && !(await g.$('#btnAnotarVale')) && (await txt(g,'#trabFoot')).includes('Solo Ray'));
 await g.click('#sheetTrab [data-cerrar="sheetTrab"]');await g.waitForTimeout(400);
 await g.click('.n-card >> nth=1');await g.waitForSelector('#sheetTrab.open');await g.waitForTimeout(300);
 ok('Gualfredo ve el vale que pidió Pedro pero sin botones: "Ray lo decide"',!!(await g.$('.vp')) && !(await g.$('.vp [data-resolver]')) && (await txt(g,'.vp')).includes('Ray lo decide'));

 // Ray
 const r=await entrar(b,'u2','222222');pags.push(r);
 await r.click('a.ini-tile[href="nomina.html"]');await r.waitForSelector('.n-card');
 await r.screenshot({path:'shots5/n1-lista.png'});
 await r.click('.n-card >> nth=0');await r.waitForSelector('#sheetTrab.open');await r.waitForTimeout(400);
 const fl=await txt(r,'#trabBody');
 ok('Trabajo sin monto: dice "Por definir" y avisa qué hacer',fl.includes('Por definir') && fl.includes('Dale categoría de pago'));
 ok('Con un trabajo sin monto no deja pagar',await r.$eval('#btnPagar',x=>x.disabled) && (await txt(r,'#btnPagar'))==='Falta el monto de un trabajo' && (await txt(r,'.n-card >> nth=0')).includes('1 sin monto'));
 ok('Lo terminado el domingo sale aparte, para la próxima semana',fl.includes('Para la próxima semana') && fl.includes('Portón Real') && fl.includes('refresco'));
 await r.screenshot({path:'shots5/n2-luis.png'});
 await r.click('#trabBody [data-item="71"]');await r.waitForSelector('#sheetItem.open');await r.waitForTimeout(300);
 const it=await txt(r,'#itemBody');
 ok('Ficha del trabajo: cliente, pedido, pago, categoría y especificaciones',it.includes('María González') && it.includes('N° 16') && it.includes('$10') && it.includes('Ventanas') && it.includes('1 × 1.2 m'));
 ok('   la foto es de su color: sin aviso',!(await r.$('#itemBody .foto-otra')));
 await r.click('#sheetItem [data-cerrar="sheetItem"]');await r.waitForTimeout(400);
 await r.click('#trabBody [data-item="72"]');await r.waitForSelector('#sheetItem.open');await r.waitForTimeout(300);
 ok('Si la foto es de otro color lo dice sobre la foto',(await txt(r,'#itemBody .foto-otra'))==='Foto en blanco · el tuyo va en NEGRO');
 await r.click('#sheetItem [data-cerrar="sheetItem"]');await r.waitForTimeout(400);
 await r.click('#sheetTrab [data-cerrar="sheetTrab"]');await r.waitForTimeout(400);

 // Pedro: exhibición, vale pendiente, anotar vale en Bs
 await r.click('.n-card >> nth=1');await r.waitForSelector('#sheetTrab.open');await r.waitForTimeout(300);
 const fp=await txt(r,'#trabBody');
 ok('Un trabajo para exhibición dice "Exhibición" y la sede',fp.includes('Exhibición · Sede Cumbres'));
 ok('La lista dice que Pedro pide un vale',(await txt(r,'.n-card >> nth=1')).includes('pide vale $8'));
 ok('El vale que pidió sale arriba con Aprobar y Rechazar, y todavía no descuenta',(await txt(r,'.vp')).includes('Pide un vale · pasaje') && (await txt(r,'.vp')).includes('$8') && !!(await r.$('.vp [data-resolver="si"]')) && !!(await r.$('.vp [data-resolver="no"]')) && (await txt(r,'.ct b'))==='$15');
 await r.screenshot({path:'shots5/n3b-vale-pedido.png'});
 await r.click('.vp [data-resolver="si"]');await r.waitForTimeout(900);
 const rs=llamadas.find(x=>x[0]==='resolver_vale');
 ok('Aprobar llama al servidor con el vale y se quita de arriba',rs && rs[1].vid===5 && rs[1].aprobar===true && rs[2]==='u2' && !(await r.$('.vp')),rs&&rs[1]);
 await r.click('#btnAnotarVale');await r.waitForSelector('#sheetVale.open');
 await r.click('#btnGuardarVale');await r.waitForTimeout(200);
 ok('Sin monto: error debajo del campo',await r.isVisible('#campoValeMonto .field-error'));
 await r.click('#btnValeBs');await r.fill('#valeBs','400');await r.fill('#valeTasa','40');await r.waitForTimeout(100);
 ok('En bolívares: 400 Bs a 40 calcula $10 solo',(await r.inputValue('#valeMonto'))==='10');
 await r.fill('#valeNota','medicinas');await r.screenshot({path:'shots5/n3-vale.png'});
 await r.click('#btnGuardarVale');await r.waitForTimeout(900);
 const av=llamadas.find(x=>x[0]==='anotar_vale');
 ok('Se anota con dólares, Bs y tasa',av && av[1].tid==='t3' && av[1].p_monto===10 && av[1].p_bs===400 && av[1].p_tasa===40 && av[1].p_nota==='medicinas',av&&av[1]);
 ok('El vale sale en rojo con sus bolívares y el total baja a $5',(await txt(r,'#trabBody')).includes('dado en Bs 400 (a 40)') && (await txt(r,'.ct b'))==='$5' && (await txt(r,'#btnPagar'))==='Marcar pagado $5');
 await r.screenshot({path:'shots5/n4-pedro.png'});
 // Montos cambiaron
 cambio=true;
 await r.click('#btnPagar');await r.waitForTimeout(900);
 ok('Si algo cambió mientras lo veía, avisa y no paga',(await txt(r,'#toast')).includes('Los montos cambiaron'));
 cambio=false;
 await r.click('#btnPagar');await r.waitForTimeout(900);
 const pg=llamadas.filter(x=>x[0]==='pagar_trabajador').pop();
 ok('Paga con el monto que vio',pg && pg[1].tid==='t3' && pg[1].esperado===5,pg&&pg[1]);
 // El aviso "Vale pedido" abre nomina.html?t=ID directo en ese trabajador
 await r.goto('http://127.0.0.1:8765/nomina.html?t='+LUIS_UUID);await r.waitForSelector('#sheetTrab.open',{timeout:8000}).catch(()=>{});
 ok('nomina.html?t=ID abre la ficha de ese trabajador',!!(await r.$('#sheetTrab.open')) && (await txt(r,'#trabNombre'))==='Luis');
 await r.goto('http://127.0.0.1:8765/nomina.html?t=no-existe');await r.waitForTimeout(1200);
 ok('Un enlace mal copiado dice "No se encontró ese trabajador"',(await txt(r,'#toast')).includes('No se encontró ese trabajador'));
 const errs=pags.flatMap(p=>p._e);
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(errs));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(pags.flatMap(p=>p._e||[])));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
