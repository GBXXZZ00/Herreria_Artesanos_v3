# Construye la ayuda de la app desde los manuales (pruebas/manual/fuente):
#  - assets/ayuda/<modulo>.html: una <section data-b="id"> por parte del manual
#  - assets/ayuda/img/*.jpg: capturas livianas (500 px de ancho)
# Uso (desde la raíz del repo): python3 pruebas/manual/construir.py
import os,re,unicodedata
from bs4 import BeautifulSoup, NavigableString
from PIL import Image
AQUI=os.path.dirname(os.path.abspath(__file__))
REPO=os.path.abspath(os.path.join(AQUI,'..','..'))
DEST=os.path.join(REPO,'assets','ayuda'); IMG=os.path.join(DEST,'img')
os.makedirs(IMG,exist_ok=True)
FUENTES={'catalogo':'ayuda-catalogo.html','venta':'_cuerpo-venta.html','cotizaciones':'_c-cotizaciones.html','ventas':'_c-ventas.html',
 'inicio':'_c-inicio.html','produccion':'_c-produccion.html','nomina':'_c-nomina.html','deposito':'_c-deposito.html','admin':'_c-admin.html','taller':'_c-taller.html'}
def slug(t):
    t=unicodedata.normalize('NFD',t).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',t).strip('-')
usadas=set()
def imagen(src):
    base=os.path.join(AQUI,src)
    nom=re.sub(r'^shots-?','',src.replace('/','-')).replace('.png','.jpg').lstrip('-')
    dst=os.path.join(IMG,nom)
    im=Image.open(base).convert('RGB')
    if im.width>500: im=im.resize((500,round(im.height*500/im.width)),Image.LANCZOS)
    im.save(dst,quality=72,optimize=True,progressive=True)
    usadas.add(nom)
    return 'img/'+nom
def bloques(nodo,clase_rol):
    # Devuelve [(id,titulo,[nodos],rol)] partiendo por cada h2; los contenedores con h2 se abren
    out=[]; actual=None; pendiente=[]
    for h in list(nodo.children):
        if isinstance(h,NavigableString):
            if actual and h.strip(): actual[2].append(h)
            continue
        cls=h.get('class') or []
        if h.name=='div' and h.find('h2') and 'tipo' not in cls:
            rol=next((c for c in cls if c in ('solo-admin','solo-vend')),clase_rol)
            if actual: out.append(actual); actual=None
            out+=bloques(h,rol); continue
        if 'tag-admin' in cls: pendiente.append(h); continue
        if h.name=='h2':
            if actual: out.append(actual)
            t=h.get_text(strip=True); actual=[slug(t)+('' if not clase_rol else '-'+clase_rol.split('-')[1]),t,pendiente+[h],clase_rol]; pendiente=[]
            continue
        if actual is None: actual=[('extra-'+out[-1][0]) if out else 'intro','',[],clase_rol]
        actual[2].append(h)
    if actual: out.append(actual)
    return out
total=0
for mod,f in FUENTES.items():
    s=BeautifulSoup(open(os.path.join(AQUI,'fuente',f)).read(),'html.parser')
    for sc in s.find_all('script'): sc.decompose()
    for r in s.select('.rol'): r.decompose()
    for img in s.find_all('img'):
        if img.get('src','').startswith('shots'): img['src']=imagen(img['src']); img['loading']='lazy'; img['decoding']='async'
    raiz=s.find('div',class_='pag') or s
    top=raiz.find('div',class_='top')
    if top: top.decompose()
    for p in raiz.find_all('div',class_='pie'): p.decompose()
    bl=bloques(raiz,'')
    partes=[]
    for bid,tit,nodos,rol in bl:
        # "Según el tipo/producto": además, un bloque por cada tipo
        html=''.join(str(n) for n in nodos)
        cls=f' class="{rol}"' if rol else ''
        partes.append(f'<section data-b="{bid}" data-t="{tit}"{cls}>{html}</section>')
        for n in nodos:
            if getattr(n,'name',None)=='div' and 'tipo' in (n.get('class') or []):
                cab=n.find('div',class_='tipo-h'); b=cab.find('b') if cab else None
                if not b: continue
                nombre=b.get_text(strip=True)
                partes.append(f'<section data-b="tipo-{slug(nombre)}" data-t="{nombre}" data-solo="1"{cls}>{n}</section>')
    out='\n'.join(partes)
    # Las clases del manual llevan "ay-" para no chocar con las de la app (ej. .hero del catálogo)
    out=re.sub(r'class="([^"]*)"',lambda m:'class="'+' '.join(c if c in ('solo-admin','solo-vend','solo-ray') else 'ay-'+c for c in m.group(1).split())+'"',out)
    open(os.path.join(DEST,mod+'.html'),'w').write('<!-- Generado por pruebas/manual/construir.py: no editar a mano -->\n'+out+'\n')
    total+=len(out)
    print(mod,[p.split('"')[1] for p in partes])
for f in os.listdir(IMG):
    if f not in usadas: os.remove(os.path.join(IMG,f))
peso=sum(os.path.getsize(os.path.join(IMG,f)) for f in os.listdir(IMG))
print('imágenes',len(usadas),'peso total %.0f KB'%(peso/1024),'· textos %.0f KB'%(total/1024))
