// test41 (v72, nueva gestión): botones de PDF siempre a la vista en la ficha (iPhone y Android),
// PDF del cliente sin "por confirmar", teléfonos de cualquier país y "Espera que confirmen el pago".
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u3',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u3',aud:'authenticated',role:'authenticated',email:'yulimar@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:5,nombre:'John Smith',cedula:'P123456789',telefono:'13055551234'};
const sede={id:1,nombre:'Cumbres de Maracaibo'};
const it=(id,vid)=>({id,venta_id:vid,catalogo_id:4,pieza_id:null,a_medida:false,tipo:'Puerta Multilock',nombre:'Lineal',especificaciones:{color:'Blanco',alto:2,ancho:1,sentido:'Derecha',bloque:'15',vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro'},foto:GIF,precio_unitario:800,cantidad:1,orden:0});
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
function datos(){
  const ventas=[{id:1099,cliente_id:5,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:0,subtotal:800,total:800,notas:null,vence_en:dia(-5),fecha_entrega:dia(10),confirmada_en:new Date().toISOString(),cancelada_en:null,creado_en:new Date().toISOString(),actualizado_en:new Date(Date.now()-60000).toISOString(),
    items:[it(1,1099)],abonos:[{id:1,venta_id:1099,tipo:'abono',estado:'por_confirmar',monto:400,metodo:'Zelle',comprobante:'2026-11/x.jpg',fecha:new Date().toISOString(),registrado_por:'u3'}]}];
  ventas.forEach(v=>{v.token_seguimiento='aaaaaaaa-bbbb-4ccc-8ddd-000000001099';v.mensaje_en=null;v.pdf_en=null;v.produccion_pedida_en=null;v.cambios=[];});
  return ventas;
}
function ruta(ventas,rpcs){
  const full=v=>Object.assign({},v,{cliente:cli,sede});
  return async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/1'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);const v=ventas.find(x=>x.id===a.vid);
    if(name==='marcar_paso'){if(a.paso==='mensaje'){v.mensaje_en=new Date().toISOString();v.mensaje_estado=v.estado;v.mensaje_por='u3';}else{v.pdf_en=new Date().toISOString();v.pdf_por='u3';}return j({id:v.id});}
    return j({});}
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u3',usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',sede_id:1,confirma_abonos:false}); if(u.includes('select=id,nombre'))return j([{id:'u3',nombre:'Yulimar'},{id:'u2',nombre:'Ray'}]); return j([{usuario:'yulimar',nombre:'Yulimar',rol:'vendedor',orden:3}]);}
  if(u.includes('/ventas')){ const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full(ventas.find(x=>x.id===+m[1]))); return j(ventas.map(full)); }
  if(u.includes('/catalogo'))return j([]);
  if(u.includes('/disponibles'))return j([]);
  if(u.includes('/sedes'))return j([Object.assign({orden:1,activa:true},sede)]);
  if(u.includes('/clientes'))return j(null);
  return j([]);};
}
const iniciar=()=>{window.__share=null;window.__clip=null;window.__abre=null;
  navigator.canShare=(d)=>!!(d&&d.files);
  navigator.share=async(d)=>{window.__share={files:d.files.map(f=>[f.name,f.type,f.size]),text:d.text||null};};
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{window.__clip=t;}},configurable:true});
  window.open=(u)=>{window.__abre=u;return {};};};
async function entrar(p){
  await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
  for(const d of '333333') await p.click(`#pinTeclado [data-t="${d}"]`);
  await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(500);
}
(async()=>{ const b=await chromium.launch(); const err=[]; try{
 // ---------------- iPhone ----------------
 const ventas=datos(), rpcs=[];
 const ctx=await b.newContext({...devices['iPhone 13'],acceptDownloads:true});
 await ctx.route('**/*.supabase.co/**',ruta(ventas,rpcs));
 await ctx.addInitScript(iniciar);
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));
 const w=ms=>p.waitForTimeout(ms||400);
 await entrar(p);
 await p.goto(H+'ventas.html?abrir=1099');await p.waitForSelector('#sheetFicha.open');
 await p.waitForSelector('#fichaBody .av-pdf [data-accion="pdf"]:not([disabled])',{timeout:20000});
 ok('Teléfono extranjero en la ficha: +1 305 555 1234',(await p.textContent('#fichaBody .f-sub')).includes('+1 305 555 1234'),await p.textContent('#fichaBody .f-sub'));
 ok('Escribirle va a wa.me con su código',await p.$eval('#fichaBody .f-contacto a',x=>x.getAttribute('href'))==='https://wa.me/13055551234');
 ok('Arriba: Enviar PDF y Descargar PDF lado a lado',(await p.textContent('#fichaBody .av-pdf .av-env')).trim()==='Enviar PDF'&&(await p.textContent('#fichaBody .av-pdf .av-desc')).trim()==='Descargar PDF');
 ok('Sin enviar: "Primero envíale el PDF…"',(await p.textContent('#fichaBody .avisar-wrap')).includes('Primero envíale el PDF: lleva su enlace de seguimiento.'));
 ok('Sin enviar: no hay otro paso guiado',!(await p.$('#fichaBody .avisar-wrap .btn-guia')));
 ok('Más opciones sin botón PDF',!(await p.$('#fichaBody .grid-acciones [data-accion="descargar"]'))&&!(await p.textContent('details[data-sec="mas"], #fichaBody')).includes('Editar, PDF'));
 ok('Vendedora: "Espera que confirmen el pago" (sin nombre)',(await p.textContent('#fichaBody')).includes('Espera que confirmen el pago')&&!(await p.textContent('#fichaBody')).includes('Ray confirme'));
 ok('En la ficha el pago sigue "Por confirmar"',(await p.textContent('#fichaBody')).includes('Por confirmar'));
 await p.evaluate(()=>{const a=document.querySelector('#fichaBody .avisar-wrap');document.getElementById('fichaBody').scrollTop=Math.max(0,a.offsetTop-260);});await w(200);
 await p.screenshot({path:'shots4/t41-1-sin-enviar.png'});
 // Descargar: el PDF no dice "por confirmar" y lleva el teléfono con su código
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:15000}),p.click('#fichaBody [data-accion="descargar"]')]);
 await dl.saveAs('shots4/t41.pdf');const pdf=fs.readFileSync('shots4/t41.pdf','latin1');
 ok('PDF descargado',pdf.length>5000&&dl.suggestedFilename()==='Pedido-1099-John-Smith.pdf',dl.suggestedFilename());
 ok('PDF: el pago sale normal, sin "(por confirmar)"',pdf.includes('Zelle')&&!/por confirmar/i.test(pdf));
 ok('PDF: sin la nota de pago pendiente',!/pendiente/i.test(pdf));
 ok('PDF: teléfono +1 305 555 1234',pdf.includes('+1 305 555 1234'));
 ok('Descargar no marca el PDF como enviado',!rpcs.some(x=>x[0]==='marcar_paso'));
 // Enviar
 await p.click('#fichaBody [data-accion="pdf"]');await w(800);
 const sh=await p.evaluate(()=>window.__share);
 ok('iPhone: comparte PDF con mensaje',sh&&sh.files[0][1]==='application/pdf'&&sh.text&&sh.text.includes('Hola John'));
 ok('Copia el teléfono con su código para buscarlo',await p.evaluate(()=>window.__clip)==='+13055551234',await p.evaluate(()=>window.__clip));
 const txt=await p.textContent('#fichaBody .avisar-wrap');
 ok('Después de enviar: los dos botones siguen',!!(await p.$('#fichaBody .av-pdf [data-accion="pdf"]'))&&!!(await p.$('#fichaBody .av-pdf [data-accion="descargar"]')));
 ok('Después de enviar: "✓ PDF enviado hoy … · Yulimar"',/✓ PDF enviado hoy \d/.test(txt)&&txt.includes('Yulimar'),txt);
 ok('Después de enviar: paso guiado "Avisar por WhatsApp"',!!(await p.$('#fichaBody .avisar-wrap .btn-guia[data-accion="mensaje"]')));
 ok('iPhone: no sale "2. Enviar el mensaje"',!txt.includes('2. Enviar el mensaje'));
 await p.screenshot({path:'shots4/t41-2-enviada.png'});
 // Funciones de teléfono (venta.html las usa al guardar)
 await p.goto(H+'venta.html');await w(1200);
 const T=await p.evaluate(()=>['+1 (305) 555-1234','+34 612 34 56 78','+58 414-1234567','0414-123.45.67','00 1 305 555 1234','+57 300 1234567','0414 12345','58414'].map(t=>[AV.normTel(t),AV.telValido(t),AV.telMostrar(AV.normTel(t))]));
 ok('+1 (305) 555-1234 → 13055551234',T[0][0]==='13055551234'&&T[0][1]&&T[0][2]==='+1 305 555 1234',T[0]);
 ok('+34 612 34 56 78 → 34612345678',T[1][0]==='34612345678'&&T[1][1]&&T[1][2]==='+34 612 345 678',T[1]);
 ok('+58 414-1234567 → 584141234567 y se muestra 0414 123 4567',T[2][0]==='584141234567'&&T[2][1]&&T[2][2]==='0414 123 4567',T[2]);
 ok('0414-123.45.67 sigue guardando 584141234567',T[3][0]==='584141234567'&&T[3][1],T[3]);
 ok('00 1 305… quita el 00',T[4][0]==='13055551234'&&T[4][1],T[4]);
 ok('+57 Colombia válido',T[5][0]==='573001234567'&&T[5][1],T[5]);
 ok('Cortos no valen',!T[6][1]&&!T[7][1]);
 ok('Texto debajo del campo',(await p.textContent('#campoTel .field-hint'))==='Pégalo de WhatsApp. Si es de otro país, con su código (+1, +34…)');
 await p.fill('#cTel','+1 (305) 555-1234');await p.click('#btnGuardar');await w(300);
 ok('Teléfono extranjero pegado no marca error',!(await p.$eval('#campoTel',x=>x.classList.contains('invalid'))));
 await p.fill('#cTel','0414 12');await p.click('#btnGuardar');await w(300);
 ok('Teléfono corto marca error debajo del campo y esconde la ayuda',await p.$eval('#campoTel',x=>x.classList.contains('invalid'))&&!(await p.isVisible('#campoTel .field-hint'))&&await p.isVisible('#campoTel .field-error'));
 await p.screenshot({path:'shots4/t41-3-telefono.png'});
 // ---------------- Android ----------------
 const ventasA=datos(), rpcsA=[];
 const ctxA=await b.newContext({...devices['Pixel 7']});
 await ctxA.route('**/*.supabase.co/**',ruta(ventasA,rpcsA));
 await ctxA.addInitScript(iniciar);
 const a=await ctxA.newPage();a.on('pageerror',e=>err.push(e.message));
 await entrar(a);
 await a.goto(H+'ventas.html?abrir=1099');await a.waitForSelector('#sheetFicha.open');
 await a.waitForSelector('#fichaBody [data-accion="pdf"]:not([disabled])',{timeout:20000});
 await a.click('#fichaBody [data-accion="pdf"]');await a.waitForTimeout(900);
 const shA=await a.evaluate(()=>window.__share);
 ok('Android: comparte solo el PDF',shA&&shA.files.length===1&&shA.text===null,shA);
 const txA=await a.textContent('#fichaBody .avisar-wrap');
 ok('Android: Enviar PDF y Descargar PDF siguen a la vista',(await a.textContent('#fichaBody .av-env')).includes('Enviar PDF')&&(await a.textContent('#fichaBody .av-desc')).includes('Descargar PDF'));
 ok('Android: botón aparte "2. Enviar el mensaje"',!!(await a.$('#fichaBody .avisar-wrap .btn-guia[data-accion="pdf2"]'))&&txA.includes('PDF enviado'));
 ok('Android: mientras tanto no sale "Avisar por WhatsApp"',!(await a.$('#fichaBody [data-accion="mensaje"]')));
 await a.screenshot({path:'shots4/t41-4-android.png'});
 await a.click('#fichaBody [data-accion="pdf2"]');await a.waitForTimeout(500);
 const ab=await a.evaluate(()=>window.__abre);
 ok('Paso 2: abre WhatsApp del cliente extranjero con el mensaje',ab&&ab.startsWith('https://wa.me/13055551234?text=')&&decodeURIComponent(ab).includes('N° 1099'),ab);
 ok('Después del paso 2 vuelve el paso guiado',!!(await a.$('#fichaBody [data-accion="mensaje"]'))&&!(await a.$('#fichaBody [data-accion="pdf2"]')));
 console.log(res.join('\n'));console.log('Errores JS:',JSON.stringify(err));console.log(fallas||err.length?fallas+' FALLAS':'TODO OK');
 }catch(x){console.log(res.join('\n'));console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
