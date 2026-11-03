# Reglas para cualquier Claude que trabaje en este repo

App Artesanos: PWA de Herrería Artesanos (Maracaibo). Publicada en https://gbxxzz00.github.io/Herreria_Artesanos_v3/ desde `main`. Todo en español.

Trabajan dos Claude sobre la misma app:
- **Claude de Gualfredo**: operación de la app (ventas, producción, nómina, depósito, usuarios).
- **Claude de Ray**: costos, precios, diseño de modelos y finanzas.

Es una guía, no un muro: cualquiera puede tocar cualquier parte, siguiendo estas reglas.

## Antes de empezar
1. Lee `docs/bitacora.md` (qué hizo el otro y qué está tocando) y la entrada más nueva.
2. Lee `docs/claude/documentos/traspaso-chat.md` y `traspaso-chat-novedades-v71.md`: estado, reglas y pendientes.
3. Según lo que vayas a hacer: `docs/modulos.md` (pantallas) y `docs/base-de-datos.md` (tablas, RLS, funciones).
4. Explica la propuesta a tu socio (Ray o Gualfredo, el que te está hablando) en palabras simples y espera su OK antes de programar algo nuevo. Si aprobó un lote, hazlo completo. No hace falta el OK del otro socio.

## Tecnología (no se cambia)
- HTML, CSS nativo con variables en `:root` y JavaScript vainilla. **Prohibido** React, Next, Angular, Vue, Tailwind, Bootstrap o parecidos.
- Backend: Supabase, proyecto `vmrxfpgotbmmjxzizsuq` (artesanos-v3). No se usa Google Apps Script ni Sheets.
- Cliente en JS: `window.db` (lo crea `assets/js/supabase-client.js`). **Nunca** declares un global llamado `supabase`: rompe todo.
- Avisos: Web Push con `sw.js` y la edge function `notificar`.

## Ahorro de consumo
- Durante cada lote corre solo la prueba del módulo que tocaste. La batería completa una sola vez al final, en segundo plano y partida en dos mitades (`test14` a `test27` y `test28` en adelante), con un tiempo largo: toda junta pasa de 30 minutos. `test26` a veces falla por tiempo, también en `main`: anótalo, no lo arregles salvo que sea por tu cambio.
- El servidor de pruebas (`python3 -m http.server 8765`) se levanta una sola vez.
- Capturas solo en iPhone 13, solo de las pantallas nuevas o cambiadas, y solo al final.
- Revisión propia una sola vez al final, como si el código fuera de otro (permisos, RLS, texto escapado, errores de red). Sin agentes revisores salvo que el socio lo pida.
- No releas archivos completos ni la salida entera de las pruebas: busca el tramo (`grep`, `sed -n`) y muestra solo los fallos. No releas un archivo después de editarlo. `node --check` antes de dar algo por hecho.
- Prueba cada migración una vez contra la base real con `execute_sql` dentro de `begin ... rollback`: salen los errores de SQL temprano y no queda nada guardado.
- Para reglas que ya existen en una maqueta, parte de ella y pásalas a funciones de Supabase; no las deduzcas de cero.
- El ahorro viene de hacer menos repeticiones, no de bajar la calidad.

## Carpetas
| Dónde | Qué |
|---|---|
| raíz `*.html` | una pantalla por archivo |
| `assets/js/` | un `.js` por pantalla y los compartidos (`comun.js` = `window.AH`, `ventas-comun.js` = `window.AV`) |
| `assets/css/` | `base.css` (estilos y variables) y `ayuda.css` |
| `assets/ayuda/` | ayuda dentro de la app, por pantalla |
| `assets/vendor/` | librerías ya bajadas (supabase.js, jspdf). No se agregan librerías nuevas sin acordarlo. |
| `pruebas/` | pruebas automáticas (`testNN.js`) y el manual (`pruebas/manual/`) |
| `supabase/migrations/` | migraciones de la base |
| `docs/` | documentación compartida. `docs/claude/` = instrucciones, documentos y skills |

## Nombres
- Archivos, funciones, tablas, columnas y textos en español, sin acentos en los nombres técnicos (`venta_items`, `marcar_etapa_terminada`).
- Funciones internas de la base empiezan con `_` y no se exponen a la app.
- Clases CSS cortas con prefijo por módulo cuando choquen (`ay-` ayuda, `tj-` trabajador).

## Versiones (`?v=NN`)
- Todo `css` y `js` se carga con `?v=NN` en cada HTML. Hoy va en **v71**.
- Si cambias cualquier `css` o `js`, sube el número en **todos** los HTML (si no, los teléfonos siguen con la versión vieja guardada por `sw.js`).
- Cada lote sube un número. Si los dos trabajan a la vez, el que une su PR de segundo hace rebase y toma el número siguiente.

## Pruebas (obligatorias)
- Antes de abrir un PR corre las pruebas de `pruebas/` (ver `pruebas/LEEME.md`):
  `python3 -m http.server 8765` en la raíz y, desde `pruebas/`, `NODE_PATH=$(npm root -g) node testNN.js`. Cada una termina en `TODO OK`.
- Lo nuevo lleva su prueba nueva (`test41.js` en adelante) o se agrega a la que ya existe.
- Mira capturas en tamaño iPhone (las pruebas usan iPhone 13) de cada pantalla nueva o cambiada.
- El manual se deja en blanco por ahora (no se rehacen capturas del manual ni se corre `construir.py`).
- Si pruebas en la base real: dentro de una transacción con rollback, o borra los datos de prueba y resetea las secuencias.
- Agrega a `docs/claude/documentos/lista-de-pruebas.md` lo que los socios deben probar en el teléfono.

## Estilo de textos
- Cortos, claros, en el idioma del taller. Cada pantalla y cada aviso dicen qué hacer después.
- **Sin guion largo (`—`)** en ningún texto.
- Títulos de máximo 2 líneas. El `label` va arriba del campo, nunca el placeholder como etiqueta. Errores debajo del campo.
- Botones de una sola línea. Nunca dos botones con el mismo propósito en la misma vista.
- Nada de `<select>` nativos: se usan opciones tocables.
- Detalle en las skills de `docs/claude/skills/`.

## Colores y diseño
- Fondo blanco, acento teal del logo, solo modo claro, pensado primero para iPhone.
- Variables de `assets/css/base.css`: `--accent #17555C`, `--ink #1C1A17`, `--ink-soft #6E6A64`, `--surface-2 #F7F6F4`, `--line #E9E7E3`, `--danger #B42318`, `--amber #B7791F`, `--ease-out cubic-bezier(0.23, 1, 0.32, 1)`. Usa las variables, no colores sueltos.
- Sin morados, sin gradientes de adorno, sin sombras negras puras. Anima solo `transform` y `opacity`, menos de 300 ms. `:active` con `scale(0.97)`.
- Los PDF usan el diseño del PDF de la venta (`ventas-comun.js`, jsPDF).

## Con cuidado (avísalo en la bitácora y en el PR)
No hace falta pedir permiso al otro socio, pero estas partes afectan a todos: dilo claro en la bitácora y en el PR.
- `assets/js/supabase-client.js`, `sw.js`, `sesion.js` y `manifest.json`.
- Las reglas de dinero y permisos de la base: confirmar pagos, nómina, vales, cancelar ventas, RLS.
- Las tablas `etapas`, `vales` y `pagos_trabajador` se escriben **solo** por sus funciones.
- Datos reales: nunca borrar ventas (se cancelan), clientes, pagos ni pagos de nómina.
- Nunca subas al repo claves secretas (service role, contraseñas de la base, PIN, claves VAPID) ni datos de clientes. La clave publicable de `supabase-client.js` sí es pública.

## Base de datos y migraciones
- RLS activo en toda tabla nueva. Las reglas importantes van en funciones `security definer` que revisan `auth.uid()` y el rol (`_es_admin()`, `_es_deposito()`, `_es_ray()`, `_lleva_madera()`, `_puede_madera()`), y con `revoke execute ... from anon` cuando no la usa el cliente sin sesión.
- Cada cambio de base es una migración nueva: archivo `supabase/migrations/<version>_vNN_<autor>_que_hace.sql` (empieza con `-- Autor: ...`) **dentro del PR**. Se aplica a la base (con el conector de Supabase, `apply_migration`, mismo nombre) cuando tu socio dio el OK, justo antes de unir el PR. Nunca antes de que pasen las pruebas.
- Si una migración borra datos (`delete`, `drop`, `revoke`) el conector pide confirmación: si dice "cancelled", no se insiste ni se esquiva.
- Toda llamada a Supabase maneja el error y la falta de señal con un `.toast` claro.

## Quién hizo qué (obligatorio)
Los dos usan la misma cuenta de GitHub y de Supabase. Por eso cada cambio lleva la marca de quién lo hizo **dentro** del cambio:

| Dónde | Ray | Gualfredo |
|---|---|---|
| Nombre en git (al empezar cada sesión, dentro del repo) | `git config user.name "Ray (Claude de Ray)"` | `git config user.name "Gualfredo (Claude de Gualfredo)"` |
| Correo en git | `git config user.email "ray@artesanos.app"` | `git config user.email "gualfredo@artesanos.app"` |
| Última línea del mensaje de cada commit | `Hecho-por: Ray` | `Hecho-por: Gualfredo` |
| Rama | `ray/<tema>` | `gualfredo/<tema>` |
| Título del PR | `[Ray] ...` | `[Gualfredo] ...` |
| Texto del PR | `Hecho por: Ray (Claude de Ray)` | `Hecho por: Gualfredo (Claude de Gualfredo)` |
| Nombre de la migración | `vNN_ray_que_hace` | `vNN_gualfredo_que_hace` |
| Primera línea del archivo de migración | `-- Autor: Ray (Claude de Ray)` | `-- Autor: Gualfredo (Claude de Gualfredo)` |
| Bitácora | `## AAAA-MM-DD · Claude de Ray` | `## AAAA-MM-DD · Claude de Gualfredo` |

- Antes del primer commit revisa con `git config user.name` que salga tu nombre. Si sale otro, corrígelo antes de seguir.
- Si un socio pide que el otro Claude toque algo suyo, el commit lleva la marca de quien lo hizo, no la de quien lo pidió.
- Para ver quién hizo qué: `git log --format='%h %an %s'`, la lista de PR en GitHub, la lista de migraciones en Supabase y la bitácora.
- Los cambios hechos antes del 2 nov 2026 son todos de Gualfredo (Claude de Gualfredo).

## Ramas y Pull Requests
1. Nadie trabaja directo en `main`. Crea una rama desde `main` actualizado: `ray/<tema>` o `gualfredo/<tema>`.
2. Anota en `docs/bitacora.md` qué vas a tocar, para no chocar.
3. Cambios pequeños. Corre las pruebas. Haz una revisión independiente del cambio y corrige lo encontrado.
4. Abre un PR hacia `main` con título `[Ray]` o `[Gualfredo]` y: quién lo hizo, qué cambia, por qué, pruebas corridas, migraciones incluidas y qué deben probar los socios en el teléfono.
5. **Cada uno une su propio PR** cuando las pruebas pasan y su socio dio el OK del trabajo. No hace falta esperar ni pedir permiso al otro. Al unir, se publica solo en GitHub Pages.
6. Después de unir: aplica la migración si la hay y agrega la entrada en la bitácora.
7. Si algo publicado se daña, se deshace el PR con "Revert" en GitHub y se avisa en la bitácora.

## Corregir lo del otro
- Cualquiera puede corregir o mejorar lo que hizo el otro: en su propia rama, con su marca, y avisando en la bitácora qué corrigió y por qué.
- Antes de tocar algo que el otro tiene en curso (mira "Está tocando" en la bitácora), trae su rama o espera a que la una, para no pisarse.

## Documentos
- `docs/bitacora.md`: cuaderno compartido de sesiones.
- `docs/modulos.md` y `docs/base-de-datos.md`: cómo está hecha la app.
- `docs/claude/instrucciones-proyecto.md`: instrucciones del proyecto de Claude de Gualfredo (copia literal).
- `docs/claude/skills/`: code-review-excellence, design-engineering, anti-slop-taste, ui-ux-designer.
- `docs/claude/documentos/`: documentos del proyecto (traspaso, reglas de producción, pruebas, finanzas). Ver su `LEEME.md`.
- `docs/claude/memoria-app.md`: decisiones y gustos acordados en conversaciones anteriores.
- `supabase/migrations/LEEME.md`: migraciones y cómo bajarlas.

## Respuestas a los socios
Cortas: qué quedó, qué deben probar ellos y qué queda pendiente. Las maquetas van en el chat como imagen (trabajan desde el celular).
