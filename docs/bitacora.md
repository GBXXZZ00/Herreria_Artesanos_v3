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

## 2026-11-08 · Claude de Gualfredo (Code, 2)
- Qué hizo: la reestructura quedó publicada. Gualfredo unió el PR #7 desde GitHub y corrió `docs/tareas/2026-11-08-aplicar-v81-a-v84.sql` en el SQL Editor de Supabase ("Success"), porque el "Permitir" del conector no le llegaba (Supabase tenía una falla ese día). Revisado en la base: las 12 funciones nuevas, las 3 tablas, `que_es`/V-H, despunte, el trigger de Hierro, disco 14" en 6 (Bitral en 3), Flete en $0, y el Bitral en $223,22 · $290,19 · $326,79 · $339,23.
- Ojo: como se corrió en el SQL Editor, v81 a v84 **no salen** en la lista de migraciones de Supabase; los archivos están en `supabase/migrations`.
- Rama o PR: PR #7 unido; esta nota va en `gualfredo/bitacora-reestructura-publicada`.
- Está tocando: nada.
- Pendientes: probar en el teléfono la lista de `docs/claude/documentos/lista-de-pruebas.md` (sección Reestructura). Lote 7 (extras) cuando Ray llene la tabla.

## 2026-11-08 · Claude de Gualfredo (Code)
- Qué hizo: empieza los lotes de `docs/tareas/2026-11-08-gualfredo-reestructura-costos.md` en orden (lote 1 primero). Base revisada: v73 a v80 aplicadas, test44 en verde.
- Rama o PR: `gualfredo/reestructura-costos`.
- Está tocando: Costos, Depósito, Finanzas, Mi trabajo, Catálogo y venta (extras).
- Lote 1 (v75) listo: Costos con 3 pestañas (Modelos · Plan de corte · Precios). Lista = Catálogo por grupos (Listos / Borrador / Faltan por costear) con filtros y buscador; empezar copiando de otro modelo, estructura estándar o en blanco; ficha en pantalla completa con índice, cortes por material en metros con su barra, pintura y consumibles con "rinde N" (del modelo o general), herrajes, obra, extras y el precio siempre abajo (hoja Precio con "Usar en el catálogo"); hoja Pieza con buscador de material, qué es y V/H. Precios: filtros por tipo, + Material nuevo aquí, Reglas (IVA, ganancia, grosor, despunte, puertas al mes). Ganancia por modelo pasó a Finanzas › Mes; los gastos fijos se cambian solo en Finanzas › Gastos. Migraciones `v81_gualfredo_ficha_modelo` y `v81b_gualfredo_disco_rinde_6` (el Bitral conserva su disco en 3 para no mover el dato de control) sin aplicar y **sin probar contra la base**: el conector pidió confirmación y nadie respondió (Gualfredo dormido). test44, test45 y test46 en verde.
- Lote 2 (v76) listo: Plan de corte en 3 pasos (Pedidos del sábado · Material en metros con necesitas · hay · comprar · Comprar lo que falta). Tocar un material: barras dibujadas, usar o no usar cada retazo (R-12), + Retazo que encontré, mover pieza también a un retazo no elegido, volver a la sugerencia y, después de cortar, Corregir corte. Lámina acomodada en la hoja y dibujada; vidrio como lista de piezas cortadas. Mi trabajo: un color por puerta y retazos numerados, sin botón nuevo. Migración `v82_gualfredo_plan_corte`: retazos con número y estado, mínimo de retazo en un solo lugar, el servidor recalcula lo que sobra y rechaza retazos ya usados, las barras bajan solas al terminar el herrero todo su Hierro del sábado (si faltan barras queda un aviso), `corte_corregir` con `cortes_ajustes`. Probada en un Postgres local con las tablas de v77 a v79 (no en la base real). test44 y test47 en verde.
- Lotes 3, 4 y 5 (v77, juntos porque comparten la misma hoja) listos: "Comprar lo que falta" desde el plan con saldos arriba (tienes en cuentas, le debes), Comprar en Más barato (divide por proveedor) o Todo en un proveedor con los últimos precios, + Material, + Otro lugar, + Gasto (flete). Queda en amarillo en el Plan, el Depósito ("+4 en camino", no se resta ni se corta), el Proveedor y Finanzas › Dinero ("salida por confirmar"). "¿Llegó?": cantidades y precios de la factura, número, foto, total del papel que dice si cuadra, y cómo se paga en una sola hoja (Lo debo · Pagué · Una parte · Saqué dinero con vuelto que vuelve a la cuenta y motivo si falta o sobra; bolívares con la tasa que escriben). "No llegó" anula con motivo. Nuevo `assets/js/compra.js` (window.COMPRA) compartido. Migración `v83_gualfredo_compra_pedida` (tabla aparte `compras_pedidas`: lo pedido no toca Depósito, deuda, dinero ni el cierre hasta confirmar; al confirmar usa compra_guardar, gasto_guardar, transferencia_guardar y saldo_cambiar de siempre, todo en una transacción), probada en Postgres local con v74, v75 y v77. test48 nueva; test43 y test45 con lo en camino.
- Ojo: la pestaña Compras del Depósito sigue (historial y compra a mano); no la quité para no romper nada hoy.
- Lote 6 (v78) listo: Finanzas › Mes con el Cierre del mes como lista de 4 pasos (1 Cuentas con lo que dice el banco · 2 Contar el Depósito · 3 Cuadrar cada proveedor con saldo al empezar + compras − pagos y diferencia con motivo · 4 Revisar y cerrar). El primero es el arranque (crear cuentas desde ahí, saldo inicial de cada proveedor). No deja cerrar con compras en camino. Al cerrar, Costos reparte los gastos fijos entre las puertas vendidas ese mes (si no hubo, 25). Finanzas › Gastos ya editaba los gastos fijos (lote 1); se agrega "Flete" en 0. Migración `v84_gualfredo_cierre_mes` (`cierres_pasos`, `cierre_datos`, `cierre_paso` con saldo_cambiar y conteo_guardar, `mes_cerrar` con el bloqueo), probada en Postgres local. test45 ampliada.
- Lote 7 (extras) NO se hizo: Ray no ha llenado la tabla de extras (maqueta 2).
- Cierre de la noche: batería completa en verde (test14 a test27 y test28 a test48, todas TODO OK; test19 anota un error de JS que también sale en `main`, no es de este cambio). Revisión propia hecha (texto escapado, sin guion largo, sin `<select>`, RLS y permisos). PR #7 abierto. Al aplicar v81 el conector pidió "Permitir" y nadie respondió: **no se aplicó ninguna migración y el PR no se unió**. Falta: Gualfredo toca "Permitir" para v81, v81b, v82, v83 y v84 (en ese orden), después se une el PR #7 y sale en vivo con `?v=78`.
- Pendientes: aplicar migraciones y unir PR #7 con Gualfredo presente; lote 7 cuando Ray llene la tabla. Antes probar v81 con `begin … rollback` cuando Gualfredo pueda tocar "Permitir". Gualfredo autorizó publicar al final si toda la batería pasa.

## 2026-11-08 · Claude de Gualfredo
- Qué hizo: con Gualfredo (y lo que dijo Ray) definió la reestructura de Costos, Depósito y Finanzas a partir del contexto de Ray (PR #6, rama `ray/contexto-reestructuracion`): midió las 4 tareas en iPhone 13, armó maquetas y una presentación para Ray, y dejó la tarea completa para Code en `docs/tareas/2026-11-08-gualfredo-reestructura-costos.md` con sus maquetas en `docs/tareas/maquetas-2026-11-08-reestructura/`.
- Rama o PR: `gualfredo/reestructura-costos` (solo documentos por ahora).
- Está tocando: Costos, Depósito, Finanzas, Mi trabajo y, en el lote 7, Catálogo y venta (extras). Ray: si vas a tocar algo de esto, avisa en la bitácora.
- Pendientes: Code programa los lotes 1 a 6 (7 si Ray llena la tabla de extras) sin aplicar migraciones ni unir. Ray: OK a la presentación, grosor del corte, despunte, rendimientos y tabla de extras.

## 2026-11-03 · Claude de Gualfredo (2)
- Qué hizo: publicó Finanzas y Costos siguiendo `docs/tareas/2026-11-03-ray-publicar-finanzas-costos.md` (con el OK de Ray).
  - Aplicó en la base, en orden y con `apply_migration`: v73, v74, v75, v76, v77, v78, v78b, v79 y v80 (Gualfredo tocó Permitir). Las primeras 3 veces se venció la confirmación del conector sin cambiar nada; a la cuarta pasó.
  - Dato de control revisado en la base real: Bitral $223,22 · $326,79 · barra completa $339,23. `registrar_abono` ya es `security definer`.
  - Unió el PR #4. Sale en vivo con `?v=74`.
  - Torniplemaca queda en "Le debes $1.674,50" por la nota 00-2884 (cargada en v78b). Gualfredo dijo dejarlo así: Ray lo corrige en Finanzas (cuadrar, cambiar saldo o anular la compra con motivo).
- Rama o PR: PR #4 unido; esta nota va en `gualfredo/bitacora-finanzas-publicado`.
- Está tocando: nada.
- Pendientes: los socios prueban en el teléfono la lista de `docs/claude/documentos/lista-de-pruebas.md` (sección v73 y v74). Lo primero: crear las cuentas en Finanzas y ponerles saldo.

## 2026-11-03 · Claude de Ray (4)
- Ray dio el OK para publicar. Las migraciones no se pudieron aplicar desde el Claude de Ray: el conector de Supabase pide la confirmación a Gualfredo y se venció el tiempo (2 veces, no se cambió nada en la base).
- **Para Gualfredo:** seguir `docs/tareas/2026-11-03-ray-publicar-finanzas-costos.md` (aplicar v73 a v80 y unir el PR #4). Hay un archivo con todo junto para el SQL Editor: `docs/tareas/2026-11-03-aplicar-v73-a-v80.sql`.
- Está tocando: nada más.

## 2026-11-03 · Claude de Ray (3)
- Qué hizo (pedido de Ray después de ver el PR, `?v=74`, misma rama y mismo PR):
  - Finanzas › Dinero: los pagos por confirmar van en **una sola tarjeta**; al tocarla salen en una hoja **agrupados por venta** y se confirman **uno tras otro** (al confirmar se abre solo el siguiente). Pagos por ubicar, Cuentas y Te deben son secciones que se abren y se cierran. Ficha del proveedor y de la cuenta también.
  - Costos › Precios: **Por material** (el más barato arriba y al abrir la comparación con cuánto más caro sale cada uno) o **Por proveedor** (lo que vende cada uno). En la ficha del modelo se puede costear con **"El más barato"** de cada material.
  - Finanzas › Mes: selector **‹ mes ›** con "ver todos los meses" (por año), tarjetas de resumen (ganancia, entró, salió, compras) y secciones plegables. Ya no se acumulan botones de meses.
  - Hoja de corte: en Mi trabajo es una tarjeta que se abre y se cierra con **"Descargar PDF"**; en Costos › Semana cada herrero es plegable con su PDF.
  - PDF en todos los informes: tu dinero hoy, gastos del mes, estado de cuenta, cierre del mes, reportes, lista de precios, ganancia por producto, existencias, compras del mes, plan de compra y hoja de corte.
- Sin migraciones nuevas. Las de v73 a v80 siguen sin aplicar.
- Pendientes: OK de Ray para aplicar migraciones y unir el PR.

## 2026-11-03 · Claude de Ray (2)
- Qué hizo: corrida única de Finanzas y Costos (lotes 1, 2, 3, 4, 5, 6, 7, 9, 10 y 10b del plan `docs/claude/documentos/plan-finanzas-costos.md`), `?v=73`.
  - **`CLAUDE.md` cambió** (sección "Ahorro de consumo" y "El manual se deja en blanco por ahora"). Lo usa también Gualfredo.
  - **Con cuidado (dinero y permisos):** v73 la vendedora ya no cambia ni borra pagos (RLS), `registrar_abono` y `cancelar_venta` pasan a `security definer`, borrar una venta no borra sus pagos. v75 libreta de dinero, nómina y vales con cuenta. v76 confirmar pagos ahora es en Finanzas (en Ventas queda el atajo "Confirmar en Finanzas"; la regla de `confirmar_abono` no cambió).
  - Todo lo que el plan decía "solo Ray" lo hacen Ray y Gualfredo (`_es_ray()` = quien confirma pagos). La vendedora no ve dinero ni costos.
  - El material de fabricación va en una tabla nueva `materiales_fab`, aparte de los consumibles, para no tocar entregas ni revisión del Depósito.
  - Datos reales cargados en v78b: proveedores, precios de Colores y Ambiente y Torniplemaca, insumos, gastos fijos $915, costeo del Bitral y la nota 00-2884 de Torniplemaca (Le debes $1.674,50, material por registrar). No se cargaron saldos ni existencias.
  - Dato de control: Bitral = $223,22 · $290,19 · $326,79 · barra completa $339,23 (base local con el mismo esquema y prueba test44).
- Rama o PR: `ray/finanzas-costos`, un PR sin unir. Migraciones v73 a v80 (y v78b) **sin aplicar**: esperan el OK de Ray.
- Pruebas: test14 a test45 en verde. Nuevas: test42 (Finanzas), test43 (Depósito), test44 (Costos y corte), test45 (Mes y reportes). Ajustadas por el cambio de confirmar en Finanzas: test17, test19, test28, test33.
- Está tocando: Finanzas, Costos, Depósito, Nómina (cuenta de pago), Inicio (avisos), Ventas (atajo), Catálogo (fila Costo), venta (extras), Mi trabajo (hoja de corte), Producción (enlace al plan).
- Pendientes: OK de Ray para aplicar migraciones y unir. Después: lote 8 (leer facturas con foto), 11 (3D), aluminio y madera en Costos. El Bitral no tiene categoría de pago en el Catálogo (Costos usa Puerta Estándar como la maqueta).

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
