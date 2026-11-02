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
4. Explica la propuesta a tu socio en palabras simples y espera su OK antes de programar algo nuevo. Si aprobó un lote, hazlo completo.

## Tecnología (no se cambia)
- HTML, CSS nativo con variables en `:root` y JavaScript vainilla. **Prohibido** React, Next, Angular, Vue, Tailwind, Bootstrap o parecidos.
- Backend: Supabase, proyecto `vmrxfpgotbmmjxzizsuq` (artesanos-v3). No se usa Google Apps Script ni Sheets.
- Cliente en JS: `window.db` (lo crea `assets/js/supabase-client.js`). **Nunca** declares un global llamado `supabase`: rompe todo.
- Avisos: Web Push con `sw.js` y la edge function `notificar`.

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
- Si cambia una pantalla, rehaz su captura del manual y corre `python3 pruebas/manual/construir.py`.
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

## Qué no se toca sin acordarlo entre los dos
- `assets/js/supabase-client.js`, `sw.js`, `sesion.js` y `manifest.json`.
- Las reglas de dinero y permisos de la base: confirmar pagos, nómina, vales, cancelar ventas, RLS.
- Las tablas `etapas`, `vales` y `pagos_trabajador` se escriben **solo** por sus funciones.
- Datos reales: nunca borrar ventas (se cancelan), clientes, pagos ni pagos de nómina.
- Nunca subas al repo claves secretas (service role, contraseñas de la base, PIN, claves VAPID) ni datos de clientes. La clave publicable de `supabase-client.js` sí es pública.

## Base de datos y migraciones
- RLS activo en toda tabla nueva. Las reglas importantes van en funciones `security definer` que revisan `auth.uid()` y el rol (`_es_admin()`, `_es_deposito()`, `_es_ray()`, `_lleva_madera()`, `_puede_madera()`), y con `revoke execute ... from anon` cuando no la usa el cliente sin sesión.
- Cada cambio de base es una migración nueva: archivo `supabase/migrations/<version>_vNN_que_hace.sql` **dentro del PR**. Se aplica a la base (con el conector de Supabase, `apply_migration`, mismo nombre) **solo después de que el PR esté aprobado** por los dos, justo antes de unirlo.
- Si una migración borra datos (`delete`, `drop`, `revoke`) el conector pide confirmación: si dice "cancelled", no se insiste ni se esquiva.
- Toda llamada a Supabase maneja el error y la falta de señal con un `.toast` claro.

## Ramas y Pull Requests
1. Nadie trabaja directo en `main`. Crea una rama desde `main` actualizado: `ray/<tema>` o `gualfredo/<tema>` (o `docs/<tema>`).
2. Anota en `docs/bitacora.md` qué vas a tocar, para no chocar.
3. Cambios pequeños. Corre las pruebas. Haz una revisión independiente del cambio y corrige lo encontrado.
4. Abre un PR hacia `main` con: qué cambia, por qué, pruebas corridas, migraciones incluidas y qué deben probar los socios en el teléfono.
5. El otro socio (o su Claude) lo revisa. Se une solo con el OK de los dos. Al unir, se publica solo en GitHub Pages.
6. Después de unir: aplica la migración si la hay y agrega la entrada en la bitácora.

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
