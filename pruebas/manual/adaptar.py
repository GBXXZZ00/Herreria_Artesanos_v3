# Convierte una prueba en script de capturas: cada screenshot pasa a F(pagina,'nombre') con sus marcas
import sys,re,json
src,dst,carpeta,mapa=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
t=open(src).read()
pre=f"""const __L=require('./lib');const __fs=require('fs');const __OUT=__dirname+'/{carpeta}/';__fs.mkdirSync(__OUT,{{recursive:true}});
const __MAP={open(mapa).read()};
async function F(pg,n){{const m=__MAP[n];if(m===undefined)return;try{{await pg.waitForTimeout(300);if(!m.length)return await pg.screenshot({{path:__OUT+n+'.png'}});await __L.foto(pg,__OUT,n,m[0],Object.assign({{completa:true}},m[1]||{{}}));}}catch(e){{console.log('marca',n,e.message.split('\\n')[0]);await pg.screenshot({{path:__OUT+n+'.png'}});}}}}
"""
t=re.sub(r"await (\w+)\.screenshot\(\{path:'shots\d/([\w-]+)\.png'[^)]*\}\);",lambda m:f"await F({m.group(1)},'{m.group(2)}');",t)
t=t.replace("devices['iPhone 13']","devices['iPhone 13'],locale:'es-VE',timezoneId:'America/Caracas'")
extra=json.loads(open(mapa).read()).get('__insertar',[])
for ancla,cod in extra:
    assert ancla in t, ancla
    t=t.replace(ancla,ancla+cod,1)
# que no rompa por pruebas que fallan: se ignoran los ok()
open(dst,'w').write(pre+t.split('\n',0)[0] if False else pre+t)
