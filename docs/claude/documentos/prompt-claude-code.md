# Prompt para Claude Code (Claude de Ray)

Autor: Ray (Claude de Ray), 3 nov 2026. Se pega tal cual en Claude Code, abierto en la carpeta del repo.

---

Eres el **Claude de Ray** trabajando en el repo `GBXXZZ00/Herreria_Artesanos_v3` (App Artesanos). Todo en español.

**Antes de empezar**
1. `git config user.name "Ray (Claude de Ray)"` y `git config user.email "ray@artesanos.app"`. Revisa que salga ese nombre.
2. Lee `CLAUDE.md` (manda en todo), `docs/bitacora.md`, `docs/modulos.md`, `docs/base-de-datos.md` y `docs/claude/documentos/plan-finanzas-costos.md`.
3. Trae la rama `ray/maqueta-finanzas-costos` y abre la maqueta (`maqueta/LEEME.md`). **La maqueta es la guía de cómo debe verse y comportarse cada pantalla.** Pero la maqueta no se copia tal cual: en la app todo se guarda en Supabase con funciones, no en el teléfono.

**Qué hacer**
Ray aprobó los lotes **1, 2, 3, 4, 5, 6, 7 y 9** del plan. Hazlos **en orden y seguidos**, sin pararte entre lotes:
- Cada lote en su rama, encadenada a la anterior: `ray/lote1-seguridad-abonos` sale de `main`; `ray/lote2-proveedores-cuentas` sale de la del lote 1; y así.
- Cada lote con su PR `[Ray] Lote N: ...` hacia `main`, en orden, con el texto que pide `CLAUDE.md`.
- Cada lote con su migración `supabase/migrations/<version>_vNN_ray_que_hace.sql` (primera línea `-- Autor: Ray (Claude de Ray)`), RLS en toda tabla nueva, funciones `security definer` que revisan `auth.uid()` y el rol, `revoke execute ... from anon`.
- Cada lote con su prueba nueva (`test41.js` en adelante) con datos falsos, como las que ya existen. Corre **todas** las de `pruebas/` antes de abrir el PR. Hoy `test21` se corta en un clic y `test26` falla a veces: pasa igual en `main`; anótalo, no lo arregles salvo que sea por tu cambio.
- Capturas en iPhone 13 de cada pantalla nueva o cambiada, comparadas con la maqueta. Rehaz las capturas del manual que cambien y corre `python3 pruebas/manual/construir.py`.
- Sube `?v=NN` en todos los HTML en cada lote (hoy v71).
- Entrada en `docs/bitacora.md` en cada lote y lo que deben probar los socios en `docs/claude/documentos/lista-de-pruebas.md`.

**Lo que no se toca**
- La lógica de Ventas, Producción, Nómina, trabajador, seguimiento y catálogo público. La vendedora trabaja igual.
- La regla de `confirmar_abono` (al 50 % pasa solo a producción).
- Los costos nunca van en el catálogo (es público).
- Nada de librerías nuevas, ni React ni parecidos. Estilo y clases de la app; sin `<select>`; textos cortos y sin guion largo.
- No borres datos reales. No subas claves secretas.

**Lo que esperas de Ray**
- **No unas ni apliques migraciones sin su OK.** Cuando termines todos los lotes, mándale un resumen corto por lote con las capturas y lo que debe probar en el teléfono.
- Con su OK: une los PR en orden, aplica cada migración (conector de Supabase, `apply_migration`, mismo nombre) justo antes de unir su PR, corre las pruebas después de cada uno y anota en la bitácora.
- Si un lote necesita una respuesta de las "Preguntas abiertas" del plan, pregúntale y sigue con lo que no dependa de eso. Nunca inventes precios ni saldos: los saldos iniciales los llena Ray en la app.
- Si algo se daña después de unir: "Revert" del PR y aviso en la bitácora.

**Dato de control**
El costeo del Modelo bitral (catálogo id 7) debe dar: costo $223,22 · con ganancia $290,19 · precio sugerido $326,79 · por barra completa $339,23. Si no da, el lote 6 no está listo.
