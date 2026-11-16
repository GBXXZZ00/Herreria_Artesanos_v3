// Taller › Nómina (lote 3, maquetas T5 y T6) con los números de las maquetas: hoy jueves 19 nov 2026.
// Por pagar $210 (trabajos $220 · vales −$10) y $15 ya pagado; una fila por trabajador con ↩ y vale por
// revisar; el carpintero no le sale a Ray (sí a Gualfredo); drawer con casillas: pagar solo lo marcado
// (lo desmarcado queda), vale aprobado que se resta, hoja Pagar con la cuenta y Confirmar pago
// (pagar_lo_marcado); revisar un vale (Aprobar / No aprobar); historial; + Vale eligiendo a quién;
// nomina.html?t=ID redirige al Taller.
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const HOY = new Date(2026, 10, 19, 10, 30);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(HOY.getTime()/1000);
const ses=(sub)=>({access_token:b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig',token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user:{id:sub,aud:'authenticated',role:'authenticated'}});
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(d,h=15,m=0)=>new Date(2026,10,d,h,m).toISOString();
const H='http://127.0.0.1:8765/';

const TRAB=[
  {id:'tj',nombre:'Jesus',especialidades:['herrero']},
  {id:'tl',nombre:'Luis Paz',especialidades:['masilla_pintura']},
  {id:'tp',nombre:'Pedro',especialidades:['acabados']},
  {id:'to',nombre:'José',especialidades:['herrero']},
  {id:'tc',nombre:'Carpintero',especialidades:['carpintero']}
];
const item=(id,etapa,producto,venta_id,fecha,monto,extra)=>Object.assign({id,etapa,producto,tipo:'Puerta Multilock',cantidad:1,unidad:1,de:1,venta_id,interna:false,cliente:'Cliente',fecha,monto,foto:GIF,foto_trabajo:GIF,oficio:'hierro',pago_id:null,venta_item_id:id+100,categoria:'General',categoria_id:1,especificaciones:{}},extra||{});
let PAGADOS=new Set(), VALES_PAGADOS=new Set();
const TRABAJOS={
  tj:[item(1,'Hierro','Arco 3 vidrios',1185,dia(14),35),item(2,'Hierro','Bitral',1200,dia(19,9,40),30,{unidad:1,de:2}),item(3,'Hierro','Lineal',1198,dia(17),30),item(4,'Hierro','Taco',1195,dia(16),30)],
  tl:[item(5,'Masilla y pintura','Lineal',1198,dia(17),50,{oficio:'pintura'}),item(6,'Masilla y pintura','Taco',1195,dia(16),45,{oficio:'pintura'})],
  tp:[],to:[],tc:[item(7,'Estructura','Puerta de madera',1207,dia(17),60,{oficio:'madera',tipo:'Puerta de Madera'})]
};
const VALES={tj:[{id:31,monto:10,nota:null,fecha:dia(17,9,0)}],tl:[],tp:[],to:[],tc:[]};
let VALE_PEND={tl:{id:41,monto:20,nota:'Pasaje de la semana',fecha:dia(19,8,10)}};
const PAGOS={tj:[
  {id:91,pagado_en:dia(14,17,0),semana:'2026-11-09',monto:120,trabajos_monto:130,vales_monto:10,pagado_por:'Ray',trabajos:[item(81,'Hierro','Lineal ×2',1190,dia(12),60,{pago_id:91}),item(82,'Hierro','Taco Punto',1187,dia(11),35,{pago_id:91}),item(83,'Hierro','Escalera',1186,dia(10),35,{pago_id:91})],vales:[{id:30,monto:10,nota:null,fecha:dia(10)}]},
  {id:90,pagado_en:dia(7,17,0),semana:'2026-11-02',monto:95,trabajos_monto:95,vales_monto:0,pagado_por:'Ray',trabajos:[],vales:[]}]};
const MOVS=[{pago_id:91,por_ubicar:false,cuenta:{nombre:'Efectivo dólares'}},{pago_id:90,por_ubicar:false,cuenta:{nombre:'Zelle'}}];
const CUENTAS=[{id:1,nombre:'Efectivo dólares',tipo:'efectivo',moneda:'USD',orden:1},{id:2,nombre:'Zelle',tipo:'banco',moneda:'USD',orden:2},{id:3,nombre:'Banesco (bolívares)',tipo:'banco',moneda:'VES',orden:3}];
const libres=(tid)=>(TRABAJOS[tid]||[]).filter(x=>!PAGADOS.has(x.id));
const valesLibres=(tid)=>(VALES[tid]||[]).filter(x=>!VALES_PAGADOS.has(x.id));
const suma=l=>l.reduce((a,x)=>a+x.monto,0);
const semana=()=>({semana:'2026-11-16',puede_pagar:true,trabajadores:TRAB.map(t=>{const tr=libres(t.id),va=valesLibres(t.id);return {id:t.id,nombre:t.nombre,especialidades:t.especialidades,activo:true,trabajos:tr.length,trabajos_monto:suma(tr),por_definir:0,vales_monto:suma(va),neto:suma(tr)-suma(va),proxima:0,vale_pendiente:VALE_PEND[t.id]?VALE_PEND[t.id].monto:null,ultimo_pago:null};})});
const PAGOS_SEMANA=[{trabajador_id:'tp',monto:15,pagado_en:dia(18,16,0)}];
const llamadas=[];

function mock(ctx,user,perfil){return ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(x)});
  const body=()=>JSON.parse(req.postData()||'{}');
  if(u.includes('/auth/v1/token'))return j(ses(user));
  if(u.includes('/auth/v1/user'))return j({id:user});
  if(u.includes('/rpc/nomina_semana'))return j(semana());
  if(u.includes('/rpc/nomina_trabajador')){const tid=body().tid;const t=TRAB.find(x=>x.id===tid);
    const puede=(t.especialidades.includes('carpintero')?perfil.lleva_madera:perfil.confirma_abonos);
    return j({trabajador:t,semana:'2026-11-16',puede_pagar:!!puede,trabajos:libres(tid),proxima:[],vales:valesLibres(tid),vales_proxima:[],vale_pendiente:VALE_PEND[tid]||null,pagos:PAGOS[tid]||[]});}
  if(u.includes('/rpc/pagar_lo_marcado')){const b=body();llamadas.push(['pagar',b]);
    (b.p_etapas||[]).forEach(id=>PAGADOS.add(id));(b.p_vales||[]).forEach(id=>VALES_PAGADOS.add(id));
    PAGOS[b.tid]=[{id:99,pagado_en:HOY.toISOString(),semana:'2026-11-16',monto:b.esperado,trabajos_monto:0,vales_monto:0,pagado_por:'Ray',trabajos:[],vales:[]}].concat(PAGOS[b.tid]||[]);
    return j({id:99,monto:b.esperado});}
  if(u.includes('/rpc/nomina_salida')){llamadas.push(['nomina_salida',body()]);return j({id:501});}
  if(u.includes('/rpc/vale_salida')){llamadas.push(['vale_salida',body()]);return j({id:502});}
  if(u.includes('/rpc/movimiento_ubicar')){llamadas.push(['ubicar',body()]);return j({});}
  if(u.includes('/rpc/resolver_vale')){const b=body();llamadas.push(['resolver',b]);
    if(b.aprobar){VALES.tl.push({id:41,monto:20,nota:'Pasaje de la semana',fecha:dia(19,8,10)});}
    delete VALE_PEND.tl;return j(null);}
  if(u.includes('/rpc/anotar_vale')){const b=body();llamadas.push(['anotar',b]);VALES[b.tid].push({id:77,monto:b.p_monto,nota:b.p_nota,fecha:HOY.toISOString()});return j({id:77});}
  if(u.includes('/rpc/'))return j([]);
  if(u.includes('/rest/v1/etapas')){
    if(u.includes('iniciada_en=not.is.null')) return j(u.includes('trabajador_id=eq.tj')?[{id:201,nombre:'Hierro',iniciada_en:dia(19,10,15),item:{nombre:'Bitral 2 de 2',venta_id:1200}}]:[]);
    if(u.includes('terminada_en=lt.')) return j(PAGADOS.has(1)?[]:[{id:1,trabajador_id:'tj'}]);
    return j([]);
  }
  if(u.includes('/rest/v1/pagos_trabajador')){
    if(u.includes('pagado_en=gte.')) return j(PAGOS_SEMANA);
    return j([{id:91,trabajador_id:'tj',monto:120,pagado_en:dia(14,17,0),pagado_por:'u2'},{id:88,trabajador_id:'tc',monto:60,pagado_en:dia(14,16,0),pagado_por:'u1'}]);
  }
  if(u.includes('/rest/v1/movimientos')) return j(MOVS);
  if(u.includes('/rest/v1/cuentas')) return j(CUENTAS);
  if(u.includes('/rest/v1/vales')) return j(VALE_PEND.tl?[{id:41,trabajador_id:'tl',monto:20,nota:'Pasaje de la semana',estado:'pendiente',creado_en:dia(19,8,10)}]:[]);
  if(u.includes('/perfiles')){
    if(u.includes('rol=eq.trabajador')) return j(TRAB);
    if(u.includes('select=lleva_madera')) return j({lleva_madera:!!perfil.lleva_madera,linea:null});
    if(u.includes('id=in.')) return j(TRAB.concat([{id:'u1',nombre:'Gualfredo'},{id:'u2',nombre:'Ray'}]));
    if(u.includes('id=eq')) return j(perfil);
    return j([{usuario:perfil.usuario,nombre:perfil.nombre,rol:'admin',orden:1}]);
  }
  return j([]);});}

const err=[];
async function entrar(b,perfil,pin){
  const c=await b.newContext({...devices['iPhone 13']});await c.clock.setFixedTime(HOY);await mock(c,perfil.id,perfil);
  const p=await c.newPage();p.on('pageerror',e=>err.push(perfil.usuario+':'+e.message));p.on('dialog',d=>d.accept());
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of pin) await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(400);
  return p;
}
const RAY={id:'u2',usuario:'raymundo',nombre:'Ray',rol:'admin',activo:true,confirma_abonos:true,lleva_madera:false};
const GUA={id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',activo:true,confirma_abonos:false,lleva_madera:true};
const txt=async(p,s)=>((await p.innerText(s))||'').replace(/\s+/g,' ').trim();

(async()=>{ const b=await chromium.launch(); try{
 const a=await entrar(b,RAY,'222222');
 // Enlace viejo: nomina.html redirige a Taller › Nómina
 await a.goto(H+'nomina.html');await a.waitForSelector('.nm-row');await a.waitForTimeout(300);
 ok('nomina.html lleva a Taller › Nómina',a.url().includes('taller.html') && (await a.textContent('#tabsTaller .on'))==='Nómina' && (await a.textContent('#subtitulo'))==='Hoy jue 19 · semana 16 al 21 nov');
 ok('Por pagar $210 · trabajos $220 · vales −$10',(await txt(a,'.nm-big'))==='Por pagar $210 trabajos $220 · vales −$10');
 ok('Ya pagado esta semana $15',(await txt(a,'.nm-sm'))==='$15 Ya pagado esta semana');
 const filas=await a.$$eval('.nm-lista .nm-row',x=>x.map(r=>r.innerText.replace(/\s+/g,' ').trim()));
 ok('Jesus: Hierro · 4 trabajos · vale −$10, "1 de la semana pasada" y $115',filas[0]==='JE Jesus Hierro · 4 trabajos · vale −$10 1 de la semana pasada $115 ›',filas[0]);
 ok('Luis Paz: "Pidió vale $20 · revisar" y $95',filas[1]==='LP Luis Paz Masilla y pintura · 2 trabajos Pidió vale $20 · revisar $95 ›',filas[1]);
 ok('Pedro: "le pagaste $15 el mié" y al día; José: nada esta semana',filas[2]==='PE Pedro Detalles · le pagaste $15 el mié al día ›' && filas[3]==='JO José Hierro · nada esta semana al día ›',filas.slice(2));
 ok('A Ray no le sale el carpintero',filas.length===4 && !filas.some(f=>f.includes('Carpintero')));
 ok('Atajos + Vale · Categorías de pago · Historial',(await a.$$eval('#vNomina .tl-atajos > *',x=>x.map(y=>y.textContent))).join(' · ')==='+ Vale · Categorías de pago · Historial');
 ok('Nada se sale de la pantalla',await a.evaluate(()=>document.documentElement.scrollWidth<=390));
 await a.screenshot({path:'shots5/t51-nomina.png'});

 // Drawer de Jesus
 await a.click('.nm-row[data-trab="tj"]');await a.waitForSelector('#sheetTrab.open');await a.waitForTimeout(300);
 ok('Drawer: "Jesus" · "Hierro · por pagar $115" con Por pagar · Historial · Vales',(await a.textContent('#trabNombre'))==='Jesus' && (await txt(a,'#trabSub'))==='Hierro · por pagar $115' && (await a.$$eval('#trabTabs .chip',x=>x.map(y=>y.textContent))).join(' · ')==='Por pagar · Historial · Vales');
 const its=await a.$$eval('#trabBody .nm-it',x=>x.map(r=>r.innerText.replace(/\s+/g,' ').trim()));
 ok('El de la semana pasada con ↩: "Hierro · Arco 3 vidrios ↩ · sáb 14 · no se pagó · N° 1185 $35"',its[0]==='Hierro · Arco 3 vidrios ↩ sáb 14 · no se pagó · N° 1185 $35',its[0]);
 ok('Los de esta semana: "hoy 9:40 am · N° 1200", "mar · N° 1198", "lun · N° 1195"',its[1].includes('Bitral 1 de 2') && its[1].includes('hoy 9:40 am · N° 1200') && its[2].includes('mar · N° 1198') && its[3].includes('lun · N° 1195'),its.slice(1,4));
 ok('Vale del martes aprobado que se descuenta: −$10',its[4]==='vale Vale del martes aprobado · se descuenta −$10',its[4]);
 ok('Todo marcado al abrir (4 trabajos y el vale)',(await a.$$('#trabBody .nm-ck.on')).length===5);
 ok('Haciendo ahora: "Hierro · Bitral 2 de 2 · desde hoy 10:15 am · N° 1200"',(await txt(a,'#trabBody')).includes('Haciendo ahora (se suma cuando termine)') && (await txt(a,'#trabBody')).includes('Hierro · Bitral 2 de 2 desde hoy 10:15 am · N° 1200'));
 ok('Pie: "4 trabajos $125 · vale −$10 · $115,00" y "Pagar $115 a Jesus"',(await txt(a,'#trabFoot .nm-tot'))==='4 trabajos $125 · vale −$10 $115,00' && (await a.textContent('#btnPagar'))==='Pagar $115 a Jesus' && (await txt(a,'#trabFoot .nm-nota'))==='Lo que desmarques pasa a la semana siguiente con ↩.');
 await a.screenshot({path:'shots5/t51-drawer.png'});
 // Desmarcar el ↩
 await a.click('[data-ck-e="1"]');await a.waitForTimeout(150);
 ok('Desmarcar el de $35: "3 trabajos $90 · vale −$10 · $80,00" y "Pagar $80 a Jesus"',(await txt(a,'#trabFoot .nm-tot'))==='3 trabajos $90 · vale −$10 $80,00' && (await a.textContent('#btnPagar'))==='Pagar $80 a Jesus');
 // Hoja Pagar
 await a.click('#btnPagar');await a.waitForSelector('#sheetSalida.open');await a.waitForTimeout(300);
 ok('Hoja: "Pagar $80 a Jesus" · "3 trabajos $90 · vale −$10"',(await a.textContent('#salTitulo'))==='Pagar $80 a Jesus' && (await a.textContent('#salSub'))==='3 trabajos $90 · vale −$10');
 ok('¿De qué cuenta salió? Efectivo dólares · Zelle · Banesco (bolívares) y el monto $80,00',(await a.$$eval('#salBody .nm-cta b',x=>x.map(y=>y.textContent))).join(' · ')==='Efectivo dólares · Zelle · Banesco (bolívares)' && (await a.textContent('.nm-montofijo'))==='$80,00' && (await a.textContent('#btnSalida'))==='Confirmar pago');
 ok('   y la nota "Jesus recibe un aviso. Sale en Finanzas como nómina."',(await a.textContent('#salNota'))==='Jesus recibe un aviso. Sale en Finanzas como nómina.');
 await a.click('#btnSalida');await a.waitForTimeout(300);
 ok('Sin cuenta no paga',!llamadas.some(x=>x[0]==='pagar') && (await a.textContent('#toast')).includes('Elige de qué cuenta salió'));
 await a.click('#salBody [data-sal-cuenta="1"]');
 await a.screenshot({path:'shots5/t51-pagar.png'});
 await a.click('#btnSalida');await a.waitForTimeout(900);
 const pg=llamadas.find(x=>x[0]==='pagar');
 ok('Paga solo lo marcado: pagar_lo_marcado con 3 trabajos, el vale y $80',pg && pg[1].tid==='tj' && pg[1].esperado===80 && pg[1].p_etapas.slice().sort().join()==='2,3,4' && pg[1].p_vales.join()==='31',pg&&pg[1]);
 ok('   y anota la salida en Efectivo dólares',llamadas.some(x=>x[0]==='nomina_salida' && x[1].pid===99) && llamadas.some(x=>x[0]==='ubicar' && x[1].mid===501 && x[1].p.cuenta_id===1));
 ok('Después del pago abre el Historial con el pago nuevo',(await a.textContent('#trabTabs .chip.active'))==='Historial' && (await txt(a,'#trabBody .nm-rec')).includes('$80,00'));
 await a.click('#trabTabs [data-tab="pagar"]');await a.waitForTimeout(200);
 ok('Lo desmarcado queda por pagar con ↩ (Arco 3 vidrios $35)',(await a.$$('#trabBody [data-ck-e]')).length===1 && (await txt(a,'#trabBody')).includes('Arco 3 vidrios ↩') && (await txt(a,'#trabSub'))==='Hierro · por pagar $35');
 // Historial (T6)
 await a.click('#trabTabs [data-tab="historial"]');await a.waitForTimeout(400);
 const rec=await a.$$eval('#trabBody .nm-rec summary',x=>x.map(y=>y.innerText.replace(/\s+/g,' ').trim()));
 ok('Historial: "Sáb 14 nov · Efectivo dólares · pagó Ray · 3 trabajos · vale −$10 · $120,00"',rec.includes('Sáb 14 nov Efectivo dólares · pagó Ray · 3 trabajos · vale −$10 $120,00'),rec);
 ok('   "Sáb 7 nov · Zelle · pagó Ray" y "Los pagos hechos no se cambian."',rec.some(r=>r.startsWith('Sáb 7 nov Zelle · pagó Ray')) && (await txt(a,'#trabBody')).includes('Los pagos hechos no se cambian.'));
 await a.click('#sheetTrab [data-cerrar="sheetTrab"]');await a.waitForTimeout(300);

 // Revisar el vale de Luis Paz (T6)
 await a.click('.nm-row[data-trab="tl"]');await a.waitForSelector('#sheetTrab.open');await a.waitForTimeout(300);
 await a.click('#trabBody [data-revisar-vale]');await a.waitForSelector('#sheetValeRev.open');await a.waitForTimeout(200);
 ok('Vale: "Vale de Luis Paz" · "Lo pidió hoy 8:10 am"',(await a.textContent('#valeRevTitulo'))==='Vale de Luis Paz' && (await a.textContent('#valeRevSub'))==='Lo pidió hoy 8:10 am');
 ok('Pide $20,00 · Por pagarle hoy $95,00 · Motivo · quedarían $75',(await txt(a,'#valeRevBody'))==='Pide $20,00 Por pagarle hoy $95,00 Motivo Pasaje de la semana Si lo apruebas, se descuenta cuando le pagues: quedarían $75.',await txt(a,'#valeRevBody'));
 ok('Dos acciones: "Aprobar vale $20" y "No aprobar"',(await a.$$eval('#valeRevFoot button',x=>x.map(y=>y.textContent))).join(' · ')==='Aprobar vale $20 · No aprobar');
 await a.screenshot({path:'shots5/t51-vale.png'});
 await a.click('#valeRevFoot [data-resolver="si"]');await a.waitForTimeout(900);
 ok('Aprobar usa resolver_vale y pregunta de qué cuenta salió',llamadas.some(x=>x[0]==='resolver' && x[1].vid===41 && x[1].aprobar===true) && llamadas.some(x=>x[0]==='vale_salida' && x[1].vid===41) && !!(await a.$('#sheetSalida.open')) && (await a.textContent('#btnSalida'))==='Guardar');
 await a.click('#sheetSalida [data-cerrar="sheetSalida"]');await a.waitForTimeout(300);
 ok('El vale aprobado se resta: Luis Paz por pagar $75',(await txt(a,'#trabSub'))==='Masilla y pintura · por pagar $75');
 await a.click('#sheetTrab [data-cerrar="sheetTrab"]');await a.waitForTimeout(300);

 // + Vale desde la lista: primero a quién
 await a.click('[data-nm-vale]');await a.waitForSelector('#sheetVale.open');await a.waitForTimeout(200);
 ok('+ Vale pregunta a quién (sin el carpintero)',await a.isVisible('#campoValeQuien') && (await a.$$eval('#valeQuien .opt',x=>x.map(y=>y.textContent))).join()==='Jesus,Luis Paz,Pedro,José');
 await a.fill('#valeMonto','5');await a.click('#btnGuardarVale');await a.waitForTimeout(200);
 ok('Sin elegir a quién no lo guarda',!llamadas.some(x=>x[0]==='anotar') && await a.isVisible('#campoValeQuien.invalid'));
 await a.click('#valeQuien [data-vale-quien="tp"]');await a.click('#btnGuardarVale');await a.waitForTimeout(700);
 ok('Anota el vale de Pedro por $5',llamadas.some(x=>x[0]==='anotar' && x[1].tid==='tp' && x[1].p_monto===5));
 await a.click('#sheetSalida [data-cerrar="sheetSalida"]').catch(()=>{});await a.waitForTimeout(300);

 // Historial general
 await a.click('[data-nm-hist]');await a.waitForSelector('#sheetHist.open');await a.waitForTimeout(500);
 ok('Historial de todos: Jesus $120,00 pagó Ray (sin el pago del carpintero)',(await a.$$('#histBody .nm-row')).length===1 && (await txt(a,'#histBody .nm-row')).includes('Jesus Sáb 14 nov · pagó Ray $120,00'));
 await a.click('#sheetHist [data-cerrar="sheetHist"]');await a.waitForTimeout(300);

 // Desde el Resumen: "Ir a Nómina ›" y Revisar abren aquí mismo
 VALE_PEND.tl={id:41,monto:20,nota:'Pasaje de la semana',fecha:dia(19,8,10)};
 await a.goto(H+'taller.html');await a.waitForSelector('#rPorPagar');await a.waitForTimeout(300);
 await a.click('#rVales [data-que="vale"]');await a.waitForSelector('#sheetValeRev.open');await a.waitForTimeout(200);
 ok('Revisar del Resumen abre el vale en Nómina',(await a.textContent('#tabsTaller .on'))==='Nómina' && (await a.textContent('#valeRevTitulo'))==='Vale de Luis Paz');
 await a.click('#sheetValeRev [data-cerrar="sheetValeRev"]');await a.waitForTimeout(200);await a.click('#sheetTrab [data-cerrar="sheetTrab"]');await a.waitForTimeout(200);
 await a.click('#tabsTaller [data-vista="resumen"]');await a.waitForTimeout(200);
 ok('En el Resumen tampoco sale el carpintero',!(await txt(a,'#vResumen')).includes('Carpintero'));
 await a.click('#rPorPagar [data-ir-nomina]');await a.waitForTimeout(300);
 ok('"Ir a Nómina ›" cambia de pestaña',(await a.textContent('#tabsTaller .on'))==='Nómina' && await a.isVisible('#vNomina'));

 // Gualfredo: ve al carpintero; a los demás les paga Ray
 const g=await entrar(b,GUA,'111111');
 await g.goto(H+'taller.html?vista=nomina&t=tj');await g.waitForSelector('#sheetTrab.open');await g.waitForTimeout(300);
 ok('nomina con ?t=ID abre a ese trabajador',(await g.textContent('#trabNombre'))==='Jesus');
 ok('A Gualfredo no le toca pagarle a Jesus: "A Jesus le paga Ray." y sin casillas',(await txt(g,'#trabFoot'))==='A Jesus le paga Ray.' && !(await g.$('#trabBody .nm-ck')));
 await g.click('#sheetTrab [data-cerrar="sheetTrab"]');await g.waitForTimeout(300);
 ok('Gualfredo sí ve al carpintero',(await g.$$eval('.nm-lista .nm-row',x=>x.map(r=>r.textContent))).some(t=>t.includes('Carpintero')));

 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
