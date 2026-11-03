# Bitácora compartida

Cada sesión de trabajo de cualquiera de los dos Claude agrega una entrada **arriba** (la más nueva primero) con este formato:

```
## AAAA-MM-DD · Claude de Ray | Claude de Gualfredo
- Qué hizo:
- Rama o PR:
- Está tocando (para no chocar):
- Pendientes:
```

---

## 2026-11-03 · Claude de Ray
- Qué hizo (v72, todo lo de `docs/tareas/2026-11-02-ray-pendiente-para-code.md`):
  - Ficha de la venta: "Enviar PDF" y "Descargar PDF" siempre arriba (menos en canceladas). Debajo: "Primero envíale el PDF…", "✓ PDF enviado hoy … · quién", en Android "2. Enviar el mensaje" aparte y luego el paso del día. Se quitó "PDF" de "Más opciones".
  - Venta lista: se agregaron "2. Enviar el mensaje" (solo Android, después de enviar) y "Descargar PDF". No se quitó ningún botón y "Enviar PDF al cliente" ya no cambia de texto.
  - PDF del cliente: el pago pendiente sale como un pago normal, sin "(por confirmar)" ni la nota. La página de seguimiento sigue con "En revisión" (Ray dijo que se queda).
  - Teléfonos de cualquier país (`AV.normTel`, `AV.telValido`, `AV.telMostrar` en `ventas-comun.js`). Venezuela sigue como 58…; los de afuera se ven +código en la ficha, la venta y el PDF.
  - Textos: "Espera que confirmen el pago" y en el manual "Ray o Gualfredo" donde se habla de confirmar pagos.
  - Migraciones: `v72b_ray_telefono_internacional` (`normalizar_telefono` quita el 00) y `v72c_ray_gualfredo_confirma_pagos` (Gualfredo con `confirma_abonos = true`: también paga la nómina, revisa entregas del Depósito y recibe los avisos de pagos). **Ojo: reglas de dinero y permisos.**
  - Prueba nueva test41 y ajuste en test15.
- Rama o PR: `gualfredo/nueva-gestion`, PR #2, unido con el OK de Ray. Migraciones v72b y v72c aplicadas en la base (revisado: Ray y Gualfredo con `confirma_abonos`).
- Está tocando: nada.
  - Textos de Nómina, Depósito y el inicio del trabajador: "Solo Ray o Gualfredo…", "Lo decide Ray o Gualfredo", "Te avisamos cuando te asignen uno" (app y manual).
  - Producción: una etiqueta larga en la tarjeta ("En masilla y pintura y ensamblar") estiraba la pantalla hacia los lados; ahora baja de línea. Por eso fallaba test21 desde antes; ya pasa y revisa que no vuelva a pasar.
- Pendientes: lo de Gualfredo en la app (usuario carpintero y categoría de pago de Madera para los 6 modelos), se resuelve después.

## 2026-11-02 · Claude de Ray
- Qué hizo: aplicó la limpieza de la nueva gestión (v72, con ensayo previo y OK de Ray): copia en `respaldos` y base vacía, clientes se quedan, próxima venta 1099. Desactivó el usuario vendedor "Prueba". Hizo las maquetas de los botones de PDF (aprobadas). Dejó todo lo que falta, ya aprobado por Ray, en `docs/tareas/2026-11-02-ray-pendiente-para-code.md` para hacerlo desde Claude Code.
- Rama o PR: `gualfredo/nueva-gestion`, PR #2.
- Está tocando: ficha y venta lista (botones de PDF), PDF de la venta, teléfonos, permiso de Gualfredo para confirmar pagos.
- Pendientes: todo lo de esa hoja; unir el PR #2 con el OK de Ray.

## 2026-11-02 · Claude de Gualfredo (2)
- Qué hizo: dejó lista la tarea de la nueva gestión para que la ejecute el Claude de Ray: plan en `docs/tareas/2026-11-03-nueva-gestion.md` y SQL de respaldo y limpieza SIN aplicar en `supabase/migrations/PENDIENTE_v72_...sql`.
- Rama o PR: `gualfredo/nueva-gestion`.
- Está tocando: nada más; la sigue el Claude de Ray en esa misma rama.
- Pendientes: los 4 puntos de la tarea, hoy o antes de que abran mañana.

## 2026-11-02 · Claude de Gualfredo
- Qué hizo: preparó el repo para trabajar entre los dos Claude, sin tocar código de la app ni la base. Creó `CLAUDE.md` (reglas), `docs/modulos.md`, `docs/base-de-datos.md`, esta bitácora, copia literal de las instrucciones y de los documentos del proyecto de Gualfredo (`docs/claude/`), las 4 skills sacadas de las instrucciones, `docs/claude/memoria-app.md`, la lista de las 88 migraciones y una acción de GitHub para bajar su texto y el esquema actual.
- Rama o PR: `docs/reglas-compartidas`, PR #1.
- Después: agregó a `CLAUDE.md` la sección "Quién hizo qué" (nombre en git, `Hecho-por:`, ramas, título del PR, migraciones y bitácora marcadas por autor), porque Ray y Gualfredo usan la misma cuenta de GitHub y Supabase.
- Está tocando: solo documentación.
- Pendientes:
  - (Hecho) Se acordó que cada uno une su propio PR; no hace falta el OK de los dos.
  - Gualfredo agrega el secreto `SUPABASE_DB_URL` y corre "Bajar migraciones y esquema" (ver `supabase/migrations/LEEME.md`).
  - Proteger `main` en GitHub (Settings > Branches: pedir PR antes de unir).
  - Subir al repo el código de las edge functions (`notificar`, `gestionar_usuarios`, `copiar_fotos`).
  - Revisar las funciones expuestas a `anon` (lista en `docs/base-de-datos.md`).
  - Lo que sigue de la app: `docs/claude/memoria-app.md`, sección Pendientes. Finanzas y el Resumen en PDF pasan al Claude de Ray.
