// Ayudas compartidas para las capturas del manual (simulan Supabase, no tocan la base)
const { chromium, devices } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs=require('fs');
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const now=Math.floor(Date.now()/1000);
const H='http://127.0.0.1:8765/';
const FOTO='data:image/png;base64,'+fs.readFileSync(__dirname+'/../foto-puerta.png').toString('base64');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
// rutas(u, req, j, head) devuelve una promesa si atiende la llamada, o undefined
async function contexto(b,rol,rutas){
 const uid=rol==='admin'?'u1':'u2', nombre=rol==='admin'?'Ray':'Yulimar';
 const user={id:uid,aud:'authenticated',role:'authenticated',email:uid+'@artesanos.app',user_metadata:{}};
 const jwt=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:uid,exp:now+3600,role:'authenticated',aud:'authenticated'})+'.sig';
 const ses={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'r1',user};
 const ctx=await b.newContext({...devices['iPhone 13'],locale:'es-VE',timezoneId:'America/Caracas'});
 await ctx.route('**/*.supabase.co/**',async r=>{const req=r.request();const u=decodeURIComponent(req.url());
  const j=(x,st=200,h={})=>r.fulfill({status:st,contentType:'application/json',headers:{'access-control-expose-headers':'content-range','access-control-allow-origin':'*','content-range':'0-0/1',...h},body:JSON.stringify(x)});
  const head=n=>r.fulfill({status:200,headers:{'content-range':'*/'+n,'access-control-expose-headers':'content-range','access-control-allow-origin':'*'},body:''});
  if(u.includes('/auth/v1/token'))return j(ses);
  if(u.includes('/auth/v1/user'))return j(user);
  if(rutas && !u.includes('id=eq.'+uid)){const x=rutas(u,req,j,head);if(x)return x;}
  if(u.includes('/perfiles')){ if(u.includes('id=eq'))return j({id:uid,usuario:nombre.toLowerCase(),nombre,rol,sede_id:1,confirma_abonos:rol==='admin'}); return j([{id:uid,usuario:nombre.toLowerCase(),nombre,rol,orden:1}]);}
  if(u.includes('/sedes'))return j([{id:1,nombre:'Cumbres de Maracaibo',orden:1,activa:true},{id:2,nombre:'Avenida Universidad',orden:2,activa:true}]);
  return j([]);});
 const p=await ctx.newPage();p.on('dialog',d=>d.accept());p.on('pageerror',e=>console.log('ERR',rol,e.message));
 await p.goto(H+'index.html');await p.waitForSelector('.quien-btn');await p.click('.quien-btn');
 for(const d of '111111') await p.click(`#pinTeclado [data-t="${d}"]`);
 await p.waitForSelector('#vInicio.entra');await p.waitForTimeout(900);
 return p;
}
// Marca en rojo los elementos (selector, número) y guarda la foto recortada alrededor
async function foto(p,out,nombre,marcas,opc={}){
 const el0=await p.$(marcas[0][0]); if(!el0) throw new Error('No encontré '+marcas[0][0]+' ('+nombre+')');
 if(!opc.sinScroll) await el0.evaluate(e=>e.scrollIntoView({block:'center'})); await p.waitForTimeout(350);
 const caja=await p.evaluate(ms=>{
  document.querySelectorAll('.__mk').forEach(x=>x.remove());
  let t=1e9,bt=-1e9;
  ms.forEach(([sel,n])=>{const e=document.querySelector(sel);if(!e)return;const r=e.getBoundingClientRect();
   const d=document.createElement('div');d.className='__mk';const pad=5;
   const L=Math.max(3,r.left-pad),R=Math.min(innerWidth-3,r.right+pad);
   d.style.cssText=`position:fixed;left:${L}px;top:${r.top-pad}px;width:${R-L}px;height:${r.height+pad*2}px;border:3px solid #B42318;border-radius:14px;box-shadow:0 0 0 4px rgba(180,35,24,.16);z-index:2147483647;pointer-events:none;box-sizing:border-box`;
   if(n){const i=document.createElement('span');i.textContent=n;const der=R>innerWidth-20;i.style.cssText=`position:absolute;top:-13px;${der?'right:4px':'right:-13px'};width:24px;height:24px;border-radius:50%;background:#B42318;color:#fff;font:800 13px -apple-system,sans-serif;display:flex;align-items:center;justify-content:center`;d.appendChild(i);}
   document.body.appendChild(d);t=Math.min(t,r.top-pad);bt=Math.max(bt,r.bottom+pad);});
  return {t,b:bt,h:innerHeight,w:innerWidth};},marcas);
 const alto=Math.min(opc.alto||330,caja.h); let y=Math.max(0,Math.round((caja.t+caja.b)/2-alto/2)); y=Math.min(y,caja.h-alto);
 if(opc.completa) await p.screenshot({path:out+nombre+'.png'});
 else await p.screenshot({path:out+nombre+'.png',clip:{x:0,y,width:caja.w,height:alto}});
 await p.evaluate(()=>document.querySelectorAll('.__mk').forEach(x=>x.remove()));
}
module.exports={chromium,contexto,foto,H,FOTO,PNG};
