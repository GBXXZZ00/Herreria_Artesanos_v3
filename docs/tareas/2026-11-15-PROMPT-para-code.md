# Prompt para Claude Code · Taller, Corte y sello ENTREGADO

Copia y pega esto en una sesión nueva de Claude Code con el repo GBXXZZ00/Herreria_Artesanos_v3.

---

Eres el desarrollador de la App Artesanos (PWA de Herrería Artesanos: HTML, CSS y JS vainilla con Supabase, proyecto vmrxfpgotbmmjxzizsuq). Todo en español.

**Antes de tocar nada:**
1. Lee `CLAUDE.md` y la entrada más nueva de `docs/bitacora.md`.
2. Trae la rama `gualfredo/taller-costeador` (PR #10, solo documentos) y crea tu rama de trabajo desde ella: `git fetch origin gualfredo/taller-costeador && git checkout -b gualfredo/taller-lote1 origin/gualfredo/taller-costeador`.
3. Lee COMPLETA la tarea `docs/tareas/2026-11-15-gualfredo-taller-y-costeador.md`. Manda sobre cualquier idea tuya.
4. Mira las maquetas en `docs/tareas/maquetas-2026-11-15-taller-costeador/` en este orden: T1 a T7 (Taller), Final-1 a Final-6 (Corte) y C5 (sello). La fuente HTML de cada pantalla está en `fuente/`. El lienzo con las 57 pantallas es https://claude.ai/artifact/4ttqw6JFSAbUi1YZCSbHZr. Los números de las maquetas cuadran entre sí: úsalos para las pruebas.
5. Escribe tu entrada en la bitácora: qué vas a tocar y en qué rama.

**Qué programar (en este orden, un lote por vez):**
1. Menú nuevo y Taller › Pedidos con sus drawers, la hoja de asignar de siempre y la marca ↩ (§2, §3.3 a §3.6).
2. Taller › Resumen y la foto del trabajo, más la migración del enlace del aviso (§3.2, §3.7).
3. Taller › Nómina: pagar lo marcado cuando quiera, vales e historial, sin el carpintero para Ray. Lleva la migración de `pagar_trabajador` con listas (§3.8 a §3.10).
4. Corte, base: las migraciones 🔴 de §3B.2.
5. Corte, pantallas: Por herrero, drawer del herrero, asignar, ⋯ de la puerta, Más, avisos, estados y Qué cortar (K01 a K10, K19 a K21).
6. Corte, material y compras: Material, Comprar, mensaje de WhatsApp al proveedor, ¿Llegó? con una parte, compra en camino, contar y retazos, Proveedores (K11 a K18). Quitar Depósito › Compras.
7. Vendedora, estados del Taller y sello ENTREGADO en el PDF (§3.11, §4).
8. ⏸ Costeador (Modelos · Precios, §5): **NO lo empieces** hasta que Gualfredo diga que Ray dio el OK.

**Reglas que no se negocian:**
- Stack: HTML, CSS con variables en `:root` y JS vainilla. Sin frameworks. En JS el cliente es `window.db`.
- Diseño igual a las maquetas (salvo los retazos, que en las maquetas salen morados: van en gris con borde, ver §3B.1):
  - fondo claro y acento teal;
  - sin guion largo;
  - label arriba del campo;
  - botones de una sola línea;
  - nunca dos botones con el mismo propósito en la misma vista;
  - nada de `<select>` nativo;
  - drawers para formularios;
  - esqueletos mientras carga, estados vacíos y toasts de error claros;
  - `transform: scale(.97)` en `:active` y `--ease-out`;
  - fotos con `AH.imgMini` y subidas con `AH.subirFoto`.
- Seguridad:
  - RLS activo;
  - las reglas de montos, estados y permisos van en el servidor (RPC security definer con chequeo de rol);
  - `data-attributes` y delegación de eventos en vez de `onclick` armado con strings;
  - escapar todo texto del usuario.
- **El cálculo del costeo no se toca.** Control del Bitral: $223,22 · $290,19 · $326,79 · $339,23 (test44).
- **Base de datos:** cada cambio es una migración en `supabase/migrations/`, probada contra la base real **solo dentro de `begin … rollback`**.
  - **No uses `apply_migration`**, no unas el PR y no publiques: eso se hace con Gualfredo presente.
  - Si algo necesita tocar la base y no está en la tarea, avisa antes de hacerlo.
- Si una regla de la tarea choca con lo que encuentras en el código o en la base, para y pregunta. No inventes.

**Al terminar cada lote:**
- Corre la prueba de ese lote y agrega pruebas nuevas (test50 Taller, test51 Nómina, test52 sello, y las del Corte).
- `node --check`.
- Capturas en tamaño iPhone 13, comparadas con las maquetas.
- Sube `?v=` (hoy v79; usa uno nuevo por lote).
- Escribe la entrada en la bitácora.
- Haz commit y push en tu rama.
- Al final de todo: la batería completa de pruebas en dos mitades, una revisión propia, el PR (sin unir) y lo que Gualfredo y Ray deben probar en `docs/claude/documentos/lista-de-pruebas.md`.

**Tus respuestas a Gualfredo:** cortas, en palabras simples. Qué quedó, qué debe probar él, qué migraciones esperan su presencia y qué falta.
