# Tarea para Code: reestructura de Costos, Depósito y Finanzas (7 lotes)

Fecha: 8 nov 2026 · Pedida por: Gualfredo · Escrita por: Claude de Gualfredo (en el chat, con Gualfredo y lo que dijo Ray)
Rama: `gualfredo/reestructura-costos` (sale de `main`). Maquetas: `docs/tareas/maquetas-2026-11-08-reestructura/`.

**Lee primero:** `CLAUDE.md`, la entrada más nueva de `docs/bitacora.md`, este archivo completo y las maquetas en orden (0 a 12). El contexto de Ray está en la rama `ray/contexto-reestructuracion` (PR #6): `docs/claude/contexto-ray/LEEME.md` y el prototipo `prototipo-costeador/costeador.html`.

---

## 0. Permisos que ya dio Gualfredo (no los vuelvas a pedir)
- ✅ Hacer commits y push en `gualfredo/reestructura-costos`. Nunca en `main`.
- ✅ Abrir el PR `[Gualfredo] Reestructura de Costos, Depósito y Finanzas` **sin unirlo**.
- ✅ Probar cada migración contra la base real con `execute_sql` **dentro de `begin … rollback`** (no queda nada guardado).
- ✅ Programar una tarea que retome el trabajo si se acaban los tokens (scheduled task que lea este archivo y la bitácora y siga desde el último lote terminado).
- ❌ **No** aplicar migraciones a la base real (`apply_migration`), **no** unir el PR, **no** publicar. Eso se hace con Gualfredo presente.
- ✅ **Cambio del 8 nov (Gualfredo, en el chat con Code):** al terminar **todos** los lotes y **solo si toda la batería pasa**, Code aplica las migraciones en orden con `apply_migration`, une el PR y publica, para que Gualfredo pruebe en el teléfono al día siguiente. Lo que quede a medias o con pruebas en rojo no se publica. En las decisiones abiertas Code toma la opción recomendada y la anota en el mensaje final.
- ✅ **Decisiones que Code toma solo (Gualfredo: "hazlo tú para que sigas sin mí"):** sin más preguntas en la noche. Lote 7 queda para después (Ray no ha llenado la tabla de extras). Grosor del corte y despunte en 0. Si un lote no queda perfecto, se publica solo lo terminado y probado; lo demás queda en la rama. Si al aplicar una migración el conector pide "Permitir" y se vence, Code no la esquiva: deja todo listo y la tarea programada reintenta; si a la mañana sigue sin aplicarse, no se une el PR (el código nuevo necesita la base nueva).
- Todo lo demás de `CLAUDE.md` sigue: marca de autor en commits, pruebas, `?v=` (hoy **v74**; este trabajo usa **v75** en adelante, un número por lote), bitácora al empezar y al terminar.

## 1. El problema (medido el 7 nov en iPhone 13 con Supabase simulado)
| Tarea | Hoy | Meta |
|---|---|---|
| Costear un modelo copiando el Bitral | 8 toques · 4 hojas | ~4 toques · 1 pantalla |
| Cambiar el precio de un tubo y ver el Bitral | 7 toques · 4 pantallas | ~3 toques |
| Armar el corte del sábado | 2 toques, pero 2 pantallas de alto y depende de Producción | 3 pasos claros |
| Registrar la compra y ver la deuda | 11 toques · 5 pantallas · 3 módulos | ~3 toques · 1 hoja |

**Idea:** el Costeador de Ray dentro de la app. Misma forma de trabajar (cortes escritos en la fila, barras dibujadas, precio siempre a la vista), con los colores de la app, las tablas de Supabase y **una sola fórmula** (`assets/js/costeo.js` = función `_costeo` de la base).

**Dato de control (no se puede romper nunca):** Bitral (catálogo id 7) = costo **$223.22** · con ganancia **$290.19** · sugerido **$326.79** · barra completa **$339.23**. Lo verifica `pruebas/test44.js`.

**Solo teléfono** por ahora (iPhone 13). La computadora puede quedar como hoy.

## 2. Qué hace cada módulo al final
| Módulo | Trabajo | Cambia |
|---|---|---|
| **Costos** | Cuánto cuesta cada modelo, qué cortar, qué comprar. Pestañas **Modelos · Plan de corte · Precios**. | Pierde la pestaña Ganancia. Gana compras. |
| **Depósito** | Qué hay: barras, hojas, retazos, consumibles; entregas a trabajadores (gasto real de consumibles); conteo. | Pierde la pestaña Compras. Muestra lo que está "en camino" en amarillo. |
| **Finanzas** | El dinero: confirmar pagos (**igual que hoy**), cuentas, proveedores y deudas, gastos (los gastos fijos viven **solo aquí**), Mes y **Cierre del mes**. | Recibe la Ganancia, el historial de compras y el cierre como lista de pasos. |
| **Catálogo y Ventas** | Los extras creados en Costos se ofrecen para vender (lote 7). | La vendedora no ve costos. |
| **Mi trabajo** | Hoja de corte del herrero. | Sin botón nuevo para el herrero. |
| No cambian | Producción, nómina, seguimiento, catálogo público, confirmar pagos. | |

Flujo: Venta → Producción → **Plan de corte** → **Compra pedida (amarilla)** → **¿Llegó?** → **Depósito** → hoja del herrero → al terminar Hierro, barras y retazos al Depósito → **Finanzas** (deuda o pago real, cierre del mes).

## 3. Decisiones tomadas (mandan sobre cualquier maqueta vieja)
1. **Ficha del modelo: una sola lista de cortes**, como el Costeador (sin "Estructura" ni "Diseño"). Cada pieza: cantidad × cm × **qué es** (lista: Bastidor, Marco, Divisor, Travesaño, Ranura, Vitral, Otra) × **va** (vertical V / horizontal H). "Qué es" y "va" preparan el 3D; posición exacta, cara y corte de puntas **no** se piden ahora.
2. Las piezas se escriben en **cm** (como el Costeador). Totales, plan de corte y retazos se muestran en **metros** (ej. 11,52 m; retazo 1,20 m).
3. **Consumibles** (fondo, esmalte, masilla, thinner, discos, lijas, electrodos): cada uno tiene un **rendimiento general** en su ficha (Costos › Precios) y **cada modelo puede cambiarlo**; si el modelo no dice nada, usa el general. Ya existe (`costeo_insumos.rendimiento` y `costeo_modelo_insumos.rendimiento`): se hace visible y fácil. Ray: **disco de corte 14" = 6 puertas por disco** como general (hoy está en 3).
4. **Grosor del corte** (ya existe `costeo_reglas.corte_cm`, hoy 0) y **despunte** (nuevo) van en Reglas, empiezan en 0 y Ray los pone.
5. **Vidrio** se compra **cortado a la medida**: en el plan y la compra sale como lista de piezas (ej. 1 de 184 × 10 y 5 de 50 × 4 por puerta). El costo del modelo no cambia.
6. **Retazos son opciones**, nunca obligatorios. Nunca se unen dos retazos para una pieza (ya es así). Un retazo vale la pena si mide al menos la pieza más corta de ese material en **cualquier** modelo (más el grosor del corte); mientras un material no tenga piezas en ningún modelo, el mínimo es **50 cm** (hoy está escrito a mano en 5 sitios: que salga de uno solo). Cada retazo dice "Sirve para: <modelo> (<medida>)", sacado de las fichas, nunca inventado.
7. **Ray puede rectificar los cortes** antes de cortar (mover pieza, cambiar barra o retazo, quitar un retazo, agregar un retazo encontrado, volver a la sugerencia) y después de cortar ("Corregir corte": lo que de verdad se cortó y los retazos que de verdad quedaron; la base hace la diferencia con motivo; nada se borra).
8. **Sin "Ya corté" para el herrero.** Las barras bajan cuando el herrero termina **todos** sus pasos de Hierro de ese sábado (las barras se comparten entre puertas). Ray puede marcarlo a mano y corregir después.
9. **Compra pedida = amarilla** hasta que llega y se confirma. Se ve en Plan de corte (tarjeta arriba), Depósito ("en camino", no se puede cortar ni entregar), Proveedor y Finanzas › Dinero ("salida por confirmar", no se resta todavía).
10. **Confirma la compra el admin** (Ray o Gualfredo, `_es_admin()`), la vendedora no. Al confirmar: entra al Depósito, la deuda o la salida de dinero quedan reales y ese precio queda como **último precio** de ese proveedor (lo usa Costos).
11. **Comprar en:** Más barato (divide por proveedor) · Todo en <proveedor>. Siempre con los últimos precios pagados. Cantidad y precio se cambian por lo que diga la factura.
12. **Una compra puede tener varios lugares**: + Material (cualquiera, no solo lo del plan) · + Otro lugar · + Gasto (flete, transporte). **Factura combinada:** cada línea va a su lugar (Depósito hierro, lámina, pintura, consumibles, o gasto del mes). Se escribe el total del papel para cuadrar.
13. **Pago de la compra (una sola hoja):** Pagué (de una cuenta) · Lo debo · Una parte · **Saqué dinero** (de qué cuenta y cuánto; la app resta lo gastado en todos los lugares y dice el vuelto, que vuelve a la cuenta; si falta o sobra, con motivo). **Bolívares: la tasa la escriben ellos** al comprar (como ya hace Finanzas). **Ferretería sin factura:** proveedor genérico, foto opcional.
14. **Flete:** se agrega como gasto fijo (puede ser 0; ya existe "Transporte $20"). Los gastos fijos se reparten entre las **puertas vendidas el mes anterior** (si no hay datos, `puertas_mes` = 25). El flete pagado en compras es gasto real del mes y el cierre lo compara.
15. **Gastos fijos solo en Finanzas › Gastos.** Costos los lee.
16. **Cierre del mes** (en Finanzas › Mes, reemplaza la "puesta en marcha"): lista de pasos 1 Cuentas (saldo del banco) · 2 Contar el Depósito · 3 Cuadrar cada proveedor · 4 Revisar y cerrar. **El primer cierre es el arranque**: además crea las cuentas (las de Ray incluidas) y el saldo inicial de cada proveedor (Torniplemaca ya está en $1,674.50). No deja cerrar con compras "en camino" sin decidir. Diferencias con motivo, nada se borra. Reusar `conteo_guardar`, `saldo_cambiar` y el cierre de v80.
17. **Extras** (lote 7): pantalla propia por extra con sus cortes (por modelo), "se ofrece en catálogo y venta" u oculto, mano de obra con la tarifa de protección (`prot_*`) que ya existe, costo fijo al vender, **solo ganancia, sin gastos fijos** (como hoy). Del Costeador: **Protección** = reja con su propia estructura, siempre 1 cerradura y 3 bisagras; **Vitrales** = se escriben los cortes de UN vitral y la cantidad multiplica (normal 2); **Yeso (sobremarco)**. Si un extra no está costeado, la vendedora escribe el monto como hoy.
18. **Nunca inventar cortes ni precios.** Si falta un dato: valor editable en 0 o vacío y aviso claro.

## 4. Lotes (uno por commit o grupo de commits; al final de cada uno: su prueba, `node --check`, bitácora)

### Lote 1 · Costos › Modelos y Precios (maquetas 1 y 3)
- Lista = los productos del Catálogo en grupos **Listos / Borrador / Faltan por costear** (en fabricación primero), filtros en una línea con scroll (Todos, Puertas, Combos, Ventanas, Madera, En diseño). Buscador.
- Modelo sin costear: caja "Del Catálogo" (tipo, medida, precio, categoría de pago, lo que trae) + **Copiar de otro modelo** (elegir cuál) · **Estructura estándar** (ya existe `data-bastidor`) · **En blanco**.
- Ficha en **pantalla propia** (no hoja encima de hoja): índice pegajoso con subtotales (Cortes · Lámina · Consumibles · Herrajes · Obra · Extras); cortes agrupados por material con barra dibujada, metros, barras y costo; lámina y vidrio; **pintura y consumibles a la vista** con "rinde N puertas" (toca para cambiar el del modelo; dice si usa el general); herrajes; mano de obra de la categoría de pago; extras (por ahora los de `costeo_extras`); **precio en una línea abajo** (sugerido, costo, "$X abajo del catálogo") que abre la hoja Precio (proveedor, metro o barra completa, desglose, con cada proveedor, **Usar en el catálogo**).
- Hoja Pieza: material con buscador (sin `<select>`), cantidad, medida (cm), qué es, va. Quitar y Guardar.
- Costos › Precios: por material / por proveedor; filtros por tipo; **+ Material nuevo** aquí (hoy manda a Depósito; usar `material_fab_guardar`); ficha del consumible con rendimiento general; **Reglas**: IVA, ganancia, grosor del corte, despunte, puertas al mes (respaldo).
- Ganancia sale de Costos y pasa a Finanzas › Mes (ganancia por modelo). Gastos fijos solo en Finanzas › Gastos.
- **Base (migración `v81_gualfredo_ficha_modelo`, sin aplicar):** `costeo_piezas` + `que_es text`, `orientacion text check (orientacion in ('V','H'))`; `costeo_reglas` + `despunte_cm numeric(5,2) default 0`; `costeo_guardar` acepta piezas `[material, cantidad, cm, nota, que_es, orientacion]` (las de 4 elementos siguen sirviendo); `costos_datos` las devuelve; `costeo_duplicar` las copia; `costeo_reglas_guardar` acepta `despunte_cm`. `_costeo` **no cambia** (el costo no depende de esto).
- **Dato aparte (`v81b`, también sin aplicar, avisar en el PR):** disco de corte 14" rendimiento general = 6.
- **Prueba:** `test44` sigue en verde (ajustar selectores si cambian) + nueva `test46` (lista por grupos, empezar copiando, ficha en una pantalla, pieza con qué es y V/H guardada en `costeo_guardar`, consumible del modelo, Usar en el catálogo, Bitral = 223.22 · 290.19 · 326.79 · 339.23).

### Lote 2 · Plan de corte (maqueta 4)
- 3 pasos: **1 Pedidos del sábado** (de Producción, lo asignado a Hierro; si un modelo no tiene cortes, aviso con "Cargar cortes" y "Cortar a mano" que ya existen) · **2 Material** en metros: necesitas · hay (barras y retazos) · comprar · **3 Comprar lo que falta**. "+ Exhibición o simular" pequeño abajo.
- Tocar un material: sus barras dibujadas; mover pieza (también a un retazo no elegido); usar / no usar cada retazo; "+ Retazo que encontré"; volver a la sugerencia. Preferir el retazo que deja menos desperdicio.
- Grosor del corte y despunte aplicados. Retazo mínimo por material (decisión 6) y "Sirve para".
- Lámina acomodada en la hoja (guillotina simple) dibujada como las barras. Vidrio como lista de piezas a pedir.
- Barras bajan al terminar el herrero todos sus pasos de Hierro del sábado (decisión 8); Ray puede marcarlo; **Corregir corte** después.
- Mi trabajo: hoja con un color por puerta y retazos numerados ("R-12 · 1,20 m"); sin botón nuevo.
- **Seguridad:** el servidor recalcula lo que sobra de cada barra (no confía en el `libre` del teléfono) y da error si un retazo del plan ya se usó. La firma del plan incluye la versión de las piezas.
- **Base (`v82`):** `material_retazos` + `estado` ('vivo','usado','no_sirve') y número visible; tabla `cortes_ajustes` (antes, después, quién, cuándo, motivo); disparador o función al terminar Hierro; mínimo de retazo en un solo lugar.
- **Prueba:** test nueva con dos Bitral: necesitas · hay · comprar en metros, retazo usar/no usar, corregir corte cuadra el stock.

### Lote 3 · Compra pedida (amarilla) y "¿Llegó?" (maqueta 9)
- Desde "Comprar lo que falta": hoja con **saldos** arriba (tienes en cuentas · le debes a este proveedor), Comprar en, materiales con últimos precios, total, **Pedir compra**.
- Estado amarillo en Plan, Depósito ("+4 en camino"), Proveedor, Dinero. "¿Llegó?": cantidades y precios reales, número, foto, cómo se paga (lote 4), **Confirmar** / **No llegó** (anular con motivo). Confirma el admin.
- Al confirmar: stock sube, deuda o salida real, último precio por proveedor.
- **Base (`v83`):** estado de la compra (pedida, confirmada, anulada) sobre las tablas de v77 (`deposito_compras`/compras de fabricación: revisa cuál usa `compra_guardar`); que el Depósito y Finanzas lean "en camino".
- **Prueba:** pedir → amarillo en los 4 sitios → confirmar → stock, deuda y precio.

### Lote 4 · Pago de la compra (maquetas 9 y 10, F)
- Una sola hoja: Pagué · Lo debo · Una parte · Saqué dinero (cuenta, monto, vuelto). Bs con tasa escrita. Ferretería genérica sin factura.
- **Prueba:** saldos de cuentas cuadran en $ y en Bs; vuelto vuelve a la cuenta.

### Lote 5 · Varios lugares y factura combinada (maqueta 10, E y G)
- + Material · + Otro lugar · + Gasto; cada lugar se confirma con su factura; cada línea va a su destino; total del papel cuadra.
- **Prueba:** una compra con Colores, Ferretería y flete; cada línea en su lugar.

### Lote 6 · Cierre del mes y gastos fijos (maquetas 6 y 7)
- Finanzas › Gastos: gastos fijos (con Flete, puede ser 0). Reparto por puertas vendidas el mes anterior, respaldo 25.
- Finanzas › Mes: ganancia por modelo (viene de Costos) y botón **Cierre del mes** con la lista de 4 pasos; primer cierre = arranque.
- **Prueba:** arranque con cuentas, conteo y Torniplemaca en $1,674.50; cuadrar un proveedor con motivo; no deja cerrar con compras en camino.

### Lote 7 · Extras de punta a punta (maqueta 2)
- Pantalla del extra, Catálogo (extras que el cliente puede pedir, "de Costos"), venta (marca con un toque; costeado = precio solo; no costeado = monto escrito como hoy), cortes del extra al plan.
- **Antes de programarlo:** Ray debe llenar la tabla de extras (maqueta 2). Si no la ha llenado, deja el lote 7 para después y dilo en el PR.

## 5. Fuera de esta tarea (no lo hagas)
Madera y su dinero · consumibles "por corte" y "por m²" · avisos de precio · "debía y salió" · 3D · cotizar a la medida · cargar los cortes de los 47 modelos · computadora.

## 6. Cómo trabajar esta noche
1. `git config user.name "Gualfredo (Claude de Gualfredo)"` y correo `gualfredo@artesanos.app`. Commits con `Hecho-por: Gualfredo`.
2. Bitácora: entrada "Está tocando: Costos, Depósito, Finanzas, Mi trabajo, Catálogo y venta (extras)".
3. Lote por lote en orden. Si un lote se complica, termínalo bien antes de seguir; es mejor 3 lotes perfectos que 7 a medias.
4. Cada migración: archivo en `supabase/migrations/`, prueba con `begin … rollback`, **sin** `apply_migration`.
5. Al final: batería completa en dos mitades (test14 a test27 y test28 en adelante), revisión propia (permisos, RLS, texto escapado, errores de red, sin guion largo, sin `<select>`), capturas iPhone de las pantallas nuevas, `docs/claude/documentos/lista-de-pruebas.md`, PR sin unir.
6. Mensaje final a Gualfredo, corto: qué lotes quedaron, qué migraciones esperan su OK (en orden), qué debe probar en el teléfono, qué falta.

## 7. Preguntas que siguen abiertas (no frenan los lotes 1 a 6)
- Ray: valores de grosor del corte y despunte; rendimientos reales de cada consumible; tabla de extras (lote 7); si "Puerta Protección" es extra o producto.
- Ray: OK general a la presentación (`maquetas-2026-11-08-reestructura/propuesta-ray.html`).
