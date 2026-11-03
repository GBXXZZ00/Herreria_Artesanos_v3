# Prompt para Claude Code (Claude de Ray)

Autor: Ray (Claude de Ray), 3 nov 2026. Se pega tal cual en Claude Code, abierto en la carpeta del repo.

---

Eres el **Claude de Ray** trabajando en el repo `GBXXZZ00/Herreria_Artesanos_v3` (App Artesanos). Todo en español.

**Antes de empezar**
1. `git config user.name "Ray (Claude de Ray)"` y `git config user.email "ray@artesanos.app"`. Revisa que salga ese nombre.
2. Lee `CLAUDE.md` (manda en todo), `docs/bitacora.md`, `docs/modulos.md`, `docs/base-de-datos.md` y `docs/claude/documentos/plan-finanzas-costos.md`.
3. Trae la rama `ray/maqueta-finanzas-costos` y abre la maqueta (`maqueta/LEEME.md`). **La maqueta es la guía de cómo debe verse y comportarse cada pantalla.** Pero la maqueta no se copia tal cual: en la app todo se guarda en Supabase con funciones, no en el teléfono.

**Qué hacer: una sola corrida**
Ray aprobó todos los lotes de la tabla "Corrida única de Claude Code" del plan. Hazlos **seguidos, en ese orden, sin preguntar lo que el plan ya decide**. La maqueta manda sobre cualquier duda de diseño.
- Una rama `ray/finanzas-costos` desde `main` al día. En el primer commit trae de `ray/maqueta-finanzas-costos` solo `docs/claude/documentos/plan-finanzas-costos.md` y este prompt (`git checkout origin/ray/maqueta-finanzas-costos -- <archivo>`); la carpeta `maqueta/` **no** entra a `main`, se consulta desde la otra rama (`git show` o un `git worktree`). **Un commit por lote** con su migración `supabase/migrations/<version>_vNN_ray_que_hace.sql` (primera línea `-- Autor: Ray (Claude de Ray)`), RLS en toda tabla nueva, funciones `security definer` que revisan `auth.uid()` y el rol, `revoke execute ... from anon`.
- Primer commit (docs): agrega a `CLAUDE.md` la sección "Ahorro de consumo" de abajo y cambia la regla del manual por "El manual se deja en blanco por ahora". Avísalo en la bitácora.
- Lo nuevo lleva su prueba (`test41.js` en adelante) con datos falsos; no dupliques lo que ya está probado.
- **Un solo PR** `[Ray] Finanzas, Depósito, Costos, Corte, Mes y Reportes` al final, con el texto que pide `CLAUDE.md`, una sección corta por lote y lo que deben probar en el teléfono. Una sola subida de `?v=NN` en todos los HTML (hoy v71). Una entrada en `docs/bitacora.md` y en `docs/claude/documentos/lista-de-pruebas.md`.

**Ahorro de consumo (obligatorio, igual que en Airtek)**
- Durante cada lote corre SOLO las pruebas del módulo que tocaste. La batería completa UNA sola vez, al final de la corrida. Hoy `test21` se corta en un clic y `test26` falla a veces, igual en `main`: anótalo, no lo arregles salvo que sea por tu cambio.
- Capturas en iPhone 13 y computadora solo de las pantallas que cambiaron, y solo al final. **El manual no se toca.**
- La revisión propia se hace una vez, al final, como si el código fuera de otro (permisos, RLS, texto escapado, errores de red). Sin agentes revisores salvo que Ray lo pida.
- No releas archivos completos ni la salida entera de las pruebas: busca el tramo (`grep`) y muestra solo los fallos. `node --check` antes de dar algo por hecho.
- El costeo del Bitral se verifica al empezar el lote 6 y al terminar la corrida (ver "Dato de control").
- El ahorro viene de hacer menos repeticiones, no de bajar la calidad.
- Respuesta final corta (unas 15 líneas): qué quedó, qué debe probar Ray, qué falta, y una línea "Dónde seguir:" (aquí o en el chat del proyecto).

**Lo que no se toca**
- La lógica de Ventas, Producción, Nómina, trabajador, seguimiento y catálogo público. La vendedora trabaja igual.
- La regla de `confirmar_abono` (al 50 % pasa solo a producción). Confirmar pagos pasa a Finanzas (decisión 6 del plan); en Ventas queda el atajo.
- Nómina y vales: solo se agrega elegir la cuenta de donde salió (decisión 9 del plan); el cálculo de la nómina no cambia.
- Los costos nunca van en el catálogo (es público).
- Nada de librerías nuevas, ni React ni parecidos. Estilo y clases de la app; sin `<select>`; textos cortos y sin guion largo.
- No borres datos reales. No subas claves secretas.

**Lo que esperas de Ray**
- **No unas ni apliques migraciones sin su OK.** Al terminar, mándale el resumen corto con las capturas.
- Con su OK: aplica las migraciones en orden (conector de Supabase, `apply_migration`, mismo nombre), une el PR, corre las pruebas una vez y anota en la bitácora.
- Las preguntas de proveedores y saldos no frenan nada: Ray pone los saldos iniciales a mano en la app poco a poco. Si algo de verdad no está decidido, pregúntale y sigue con lo que no dependa de eso. Nunca inventes precios, saldos ni cortes.
- Si algo se daña después de unir: "Revert" del PR y aviso en la bitácora.

**Dato de control**
El costeo del Modelo bitral (catálogo id 7) debe dar: costo $223,22 · con ganancia $290,19 · precio sugerido $326,79 · por barra completa $339,23. Si no da, el lote 6 no está listo.
