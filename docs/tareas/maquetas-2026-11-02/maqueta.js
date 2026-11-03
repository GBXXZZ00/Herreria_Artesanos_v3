const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:'u1',exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
const user={id:'u1',aud:'authenticated',role:'authenticated',email:'gualfredo@artesanos.app',user_metadata:{}};
const sesion={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
const GIF='data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const dia=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const cli={id:3,nombre:'María González',cedula:'V12345678',telefono:'584141234567'};
const sede={id:1,nombre:'Cumbres de Maracaibo'};
const it=(id,vid,nombre,precio,cant,extra)=>Object.assign({id,venta_id:vid,catalogo_id:4,pieza_id:null,a_medida:false,tipo:'Puerta Multilock',nombre,especificaciones:{color:'Blanco',alto:2,ancho:1,vidrio_o_farquilla:'Vidrio',color_vidrio:'Negro',manillon:true,manillon_tipo:'H',sentido:'Derecha',posicion:'Afuera',bloque:'15'},foto:GIF,precio_unitario:precio,cantidad:cant,orden:0},extra||{});
let ventas=[
 {id:1,cliente_id:3,estado:'confirmada',sede_id:1,vendedor_id:'u3',descuento:0,instalacion:50,subtotal:800,total:850,notas:'Pintar antes',vence_en:dia(-5),fecha_entrega:dia(3),confirmada_en:new Date().toISOString(),cancelada_en:null,cancelada_motivo:null,creado_en:new Date(Date.now()-25*864e5).toISOString(),actualizado_en:new Date().toISOString(),
  items:[it(1,1,'Lineal',300,2),it(2,1,'Reja para ventana',200,1,{a_medida:true,tipo:'A medida',catalogo_id:null,especificaciones:{descripcion:'Reja de 1.2 x 1'}})],abonos:[{id:1,venta_id:1,tipo:'abono',monto:400,metodo:'Zelle',comprobante:'2026-09/x.jpg',fecha:new Date().toISOString(),registrado_por:'u3'}]},
 {id:2,cliente_id:3,estado:'cotizacion',sede_id:1,vendedor_id:'u1',descuento:10,instalacion:0,subtotal:260,total:250,notas:null,vence_en:dia(12),fecha_entrega:null,confirmada_en:null,cancelada_en:null,creado_en:new Date(Date.now()-8*864e5).toISOString(),actualizado_en:new Date().toISOString(),
  items:[it(3,2,'Imperial',260,1)],abonos:[]},
 {id:3,cliente_id:3,estado:'cotizacion',sede_id:1,vendedor_id:'u1',descuento:0,instalacion:0,subtotal:100,total:100,vence_en:dia(-3),fecha_entrega:null,confirmada_en:null,creado_en:new Date(Date.now()-23*864e5).toISOString(),actualizado_en:new Date().toISOString(),items:[it(4,3,'Cuadro',100,1)],abonos:[]},
 {id:4,cliente_id:3,estado:'entregada',sede_id:2,vendedor_id:'u2',descuento:0,instalacion:0,subtotal:300,total:300,vence_en:dia(-30),fecha_entrega:dia(-2),confirmada_en:new Date().toISOString(),creado_en:new Date(Date.now()-40*864e5).toISOString(),actualizado_en:new Date().toISOString(),items:[it(5,4,'Lineal',300,1)],abonos:[{id:2,venta_id:4,tipo:'abono',monto:300,metodo:'Efectivo',fecha:new Date().toISOString(),registrado_por:'u2'}]}
];
ventas.forEach(v=>{v.token_seguimiento='aaaaaaaa-bbbb-4ccc-8ddd-00000000000'+v.id;v.mensaje_en=null;v.pdf_en=null;v.produccion_pedida_en=null;});
const full=v=>Object.assign({},v,{cliente:cli,sede:v.sede_id===2?{id:2,nombre:'Avenida Universidad'}:sede});
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
const pag=v=>v.abonos.reduce((a,x)=>a+(x.tipo==='devolucion'?-1:1)*x.monto,0);
const H='http://127.0.0.1:8765/';
const res=[];let fallas=0;const ok=(n,c,x)=>{res.push((c?'OK   ':'FALLA')+' '+n+(x!==undefined?'  → '+JSON.stringify(x):''));if(!c)fallas++;};
const rpcs=[];
(async()=>{ const b=await chromium.launch(); try{
 const ctx=await b.newContext({...devices['iPhone 13'],acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
 await ctx.route('https://wa.me/**',r=>r.fulfill({status:200,contentType:'text/html',body:'wa'}));const err=[];
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());const j=(x,st=200)=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify(x)});
  if(u.includes('/auth/v1/token'))return j(sesion);
  if(u.includes('/auth/v1/user'))return j(user);
  if(u.includes('/rpc/')){const name=u.split('/rpc/')[1].split('?')[0];const a=JSON.parse(req.postData()||'{}');rpcs.push([name,a]);
    const v=ventas.find(x=>x.id===a.vid);
    if(name==='convertir_en_venta'){v.estado='confirmada';v.fecha_entrega=a.a.fecha_entrega;v.confirmada_en=new Date().toISOString();v.abonos.push({id:9,tipo:'abono',monto:a.a.monto,metodo:a.a.metodo,fecha:new Date().toISOString(),registrado_por:'u1'});return j({id:v.id,estado:'confirmada'});}
    if(name==='registrar_abono'){if(pag(v)+a.a.monto>v.total)return j({message:'El abono es mayor que lo que resta por pagar'},400);v.abonos.push({id:10,tipo:'abono',monto:a.a.monto,metodo:a.a.metodo,fecha:new Date().toISOString(),registrado_por:'u1'});v.actualizado_en=new Date().toISOString();return j({id:v.id});}
    if(name==='cambiar_estado_venta'){v.estado=a.nuevo;v.actualizado_en=new Date().toISOString();return j({id:v.id});}
    if(name==='cancelar_venta'){const p=pag(v);if(p>0)v.abonos.push({id:11,tipo:'devolucion',monto:p,metodo:a.metodo_devolucion,fecha:new Date().toISOString()});v.estado='cancelada';v.cancelada_en=new Date().toISOString();v.cancelada_motivo=a.motivo;return j({id:v.id});}
    if(name==='avance_venta')return j({total:5,hechas:3,actuales:['Masilla y pintura'],items:{'1':{total:4,hechas:2,ahora:[{paso:'Masilla',quien:'Luis Paz',haciendo:true}]},'2':{total:2,hechas:0,ahora:[{paso:'Hierro',quien:null,haciendo:false}]}}});
    if(name==='marcar_paso'){if(a.paso==='mensaje'){v.mensaje_en=new Date().toISOString();v.mensaje_estado=v.estado;v.mensaje_por='u1';}else{v.pdf_en=new Date().toISOString();v.pdf_por='u1';}return j({id:v.id});}
    if(name==='pedir_produccion'){v.produccion_pedida_en=new Date().toISOString();v.produccion_pedida_por='u1';return j({id:v.id});}
    if(name==='seguimiento_publico'){const x=ventas.find(z=>z.token_seguimiento===a.t);if(!x)return j({error:'no_existe'});return j(Object.assign({},full(x),{cliente:{nombre:cli.nombre,cedula:'V12•••678',telefono:'•••4567'}}));}
    if(name==='editar_venta_fabricacion'){v.cambios=[{id:1,venta_id:v.id,por:'u3',creado_en:new Date().toISOString(),cambios:['Agregó: Reja ya hecha','Agregó: Escalera nueva','Total: $850.00 → $1050.00']}];v.items=a.p.items.map((x,i)=>Object.assign({venta_id:v.id,orden:i},x,{id:x.id||200+i}));return j({id:v.id,estado:'en_produccion',total:1050,cambios:[],nuevos:['Escalera nueva']});}
    if(name==='actualizar_venta'){v.items=a.p.items.map((x,i)=>Object.assign({id:100+i,venta_id:v.id,orden:i},x));v.subtotal=v.items.reduce((s,x)=>s+x.precio_unitario*x.cantidad,0);v.total=v.subtotal-(a.p.venta.descuento||0)+(a.p.venta.instalacion||0);v.actualizado_en=new Date().toISOString();return j({id:v.id,estado:v.estado,total:v.total});}
    return j({});}
  if(u.includes('/storage/v1/object/comprobantes'))return j({Key:'comprobantes/x.jpg'});
  if(u.includes('/storage/v1/object/sign/'))return j({signedURL:'/object/sign/comprobantes/x.jpg?token=1'});
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:'u1',usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',sede_id:2}); if(u.includes('select=id,nombre'))return j([{id:'u1',nombre:'Gualfredo'},{id:'u2',nombre:'Ray'},{id:'u3',nombre:'Yulimar'}]); return j([{usuario:'gualfredo',nombre:'Gualfredo',rol:'admin',orden:1}]);}
  if(u.includes('/ventas')){ const m=u.match(/[?&]id=eq\.(\d+)/); if(m) return j(full(ventas.find(x=>x.id===+m[1]))); let l=ventas; const e=u.match(/estado=eq\.(\w+)/); if(e) l=l.filter(x=>x.estado===e[1]); if(u.includes('produccion_pedida_en=not.is.null')) l=l.filter(x=>x.produccion_pedida_en); return j(l.map(full)); }
  if(u.includes('/catalogo'))return j([{id:4,nombre:'Lineal',tipo:'Puerta Multilock',fotos:{Blanco:GIF},especificaciones_base:{},precio_base:300}]);
  if(u.includes('/disponibles'))return j([]);
  if(u.includes('/sedes'))return j([sede,{id:2,nombre:'Avenida Universidad',orden:2,activa:true}]);
  if(u.includes('/clientes'))return j(null);
  return j([]);});
 await ctx.addInitScript(()=>{window.__share=null;window.__clip=null;
  navigator.canShare=(d)=>!!(d&&d.files);
  navigator.share=async(d)=>{window.__share={files:d.files.map(f=>[f.name,f.type,f.size]),text:d.text};};
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async(t)=>{window.__clip=t;}},configurable:true});});
 const p=await ctx.newPage();p.on('pageerror',e=>err.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/400/.test(m.text()))err.push('console:'+m.text())});
 let dialogos=[];p.on('dialog',d=>{dialogos.push(d.message());d.accept();});
 const w=ms=>p.waitForTimeout(ms||400);
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await w(900);
 const OUT=process.env.OUT;
 const CSS=`.av-pdf{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
 .av-pdf button{height:52px;border-radius:14px;font-weight:800;font-size:15.5px;display:flex;align-items:center;justify-content:center;gap:7px;white-space:nowrap}
 .av-pdf .av-env{background:#1FA855;color:#fff}
 .av-pdf .av-desc{background:var(--surface);color:var(--accent);border:1.5px solid var(--accent)}
 .av-pdf button[disabled]{opacity:.55}
 .av-pdf-ok{font-size:12.5px;color:var(--ink-soft);margin:7px 2px 2px}
 .av-pdf-ok b{color:var(--accent)}
 .maq-tag{position:fixed;left:10px;top:10px;z-index:999;background:var(--amber);color:#fff;font-weight:800;font-size:12px;padding:4px 9px;border-radius:999px}`;
 const WA='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>';
 const DL='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
 const par=(dis)=>`<div class="av-pdf"><button class="av-env" ${dis?'disabled':''}>${WA}${dis?'Preparando…':'Enviar PDF'}</button><button class="av-desc" ${dis?'disabled':''}>${DL}${dis?'Preparando…':'Descargar PDF'}</button></div>`;
 const guia=(t,s,cl)=>`<div class="btn-guia ${cl||'sec'}"><span class="bg-t">${t}</span><span class="bg-s">${s}</span></div>`;
 const ok2=(t)=>`<div class="av-pdf-ok"><b>✓</b> ${t}</div>`;
const T0=Date.now();console.log('login',Date.now()-T0);
 async function ficha(id,avisar,tag,file){console.log('ficha',id,file,Date.now()-T0);
   await p.goto(H+(id===2?'cotizaciones.html':'ventas.html'));await p.waitForSelector('.vcard');await w(500);
   await p.click(`.vcard[data-id="${id}"]`);await w(1800);
   await p.evaluate(({css,av,tag})=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);
     const f=()=>{const c=document.querySelector('#fichaBody .avisar-wrap');if(c&&!c.dataset.m){c.innerHTML=av;c.dataset.m=1;}};f();
     new MutationObserver(()=>{const c=document.querySelector('#fichaBody .avisar-wrap');if(c&&!c.querySelector('.av-pdf'))c.innerHTML=av;}).observe(document.getElementById('fichaBody'),{childList:true,subtree:true});
     document.querySelectorAll('#fichaBody [data-accion="descargar"]').forEach(b=>b.remove());
     const m=document.querySelector('details[data-sec="mas"] .ac-s');if(m)m.textContent=m.textContent.replace('Editar, PDF, seguimiento','Editar, seguimiento').replace('Editar, PDF y seguimiento','Editar y seguimiento');
     const t=document.createElement('div');t.className='maq-tag';t.textContent=tag;document.body.appendChild(t);
     const fb=document.getElementById('fichaBody');const a=document.querySelector('#fichaBody .avisar-wrap');if(a) fb.scrollTop=Math.max(0,a.offsetTop-260);
   },{css:CSS,av:avisar,tag});
   await w(300);console.log('shot',Date.now()-T0);await p.screenshot({path:OUT+'/'+file});console.log('ok',file);
 }
 // 1. Venta confirmada, PDF sin enviar
 await ficha(1, par(false)+`<div class="f-nota" style="margin-top:8px">Primero envíale el PDF: lleva su enlace de seguimiento.</div>`, 'MAQUETA 1 · Confirmada, sin enviar','m1-confirmada.png');
 // 2. Samsung justo después de enviar el PDF
 await ficha(1, par(false)+ok2('PDF enviado hoy 9:42 · Ray')+guia('2. Enviar el mensaje','Le manda el texto con su enlace de seguimiento',''), 'MAQUETA 2 · Samsung, recién enviado','m2-samsung.png');
 // 3. Ya enviada, luego toca avisar lo nuevo
 await ficha(1, par(false)+ok2('PDF enviado hoy 9:42 · Ray')+guia('Avisar por WhatsApp','Le cuenta lo nuevo de su pedido'), 'MAQUETA 3 · Ya enviada','m3-enviada.png');
 // 4. Cotización enviada
 await ficha(2, par(false)+ok2('Cotización enviada hoy 9:30 · Ray')+guia('Cliente avisado ✓','Cotización enviada hoy 9:30','hecho'), 'MAQUETA 4 · Cotización enviada','m4-cotizacion.png');
 // 5. Venta lista (hoja al terminar la venta)
 await p.goto(H+'venta.html');await w(1500);
 await p.evaluate(({css,WA,DL})=>{const s=document.createElement('style');s.textContent=css+`.listo-btns .fila2{display:grid;grid-template-columns:1fr;gap:10px}`;document.head.appendChild(s);
   const pie=document.getElementById('pie');if(pie)pie.classList.add('hidden');
   document.getElementById('pagina').innerHTML=`<div class="listo"><div class="listo-ico"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div><h1>Venta confirmada</h1><p>N° 1099 · María González</p></div>
   <div class="resumen listo-datos"><div class="res-fila"><span>Productos</span><b>2</b></div><div class="res-fila"><span>Pago (Zelle)</span><b>$400.00</b></div><div class="res-fila"><span>Resta por pagar</span><b>$450.00</b></div><div class="res-fila"><span>Entrega</span><b>jueves 12 de noviembre</b></div><div class="res-total"><span>Total</span><b>$850.00</b></div></div>
   <div class="listo-btns">
    <button class="btn-wa" type="button">${WA}Enviar PDF al cliente</button>
    <div class="btn-guia" style="margin-top:0"><span class="bg-t">2. Enviar el mensaje</span><span class="bg-s">Solo en Samsung, después de enviar el PDF</span></div>
    <button class="btn-secondary" type="button" style="height:54px;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--accent)">${DL}Descargar PDF</button>
    <button class="btn-secondary" type="button" style="height:54px">Enviar mensaje con su seguimiento</button>
    <button class="btn-secondary" type="button" style="height:54px">Hacer otra venta</button>
    <button class="link-simple" type="button">Volver a Inicio</button></div>`;
   const t=document.createElement('div');t.className='maq-tag';t.textContent='MAQUETA 5 · Venta lista';document.body.appendChild(t);window.scrollTo(0,0);
 },{css:CSS,WA,DL});
 await w(400);await p.screenshot({path:OUT+'/m5-venta-lista.png',fullPage:true});
 console.log('listo',JSON.stringify(err));
 }catch(x){console.log('CORTE:',x.message.split('\n')[0]);} await b.close();})();
