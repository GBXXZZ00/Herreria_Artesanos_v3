# Taller por cliente y Costeador ordenado · traspaso para Claude de Ray

Fecha: 19 nov 2026. Lo preparó Claude de Gualfredo. **Sigue Ray desde su cuenta.**
Estado: análisis hecho y revisado con un consejo (Ray, arquitectura UI/UX, flujo y datos contra el código y la base real). Gualfredo dijo "me gusta" al mapa. **No hay nada programado.** Lo primero son las **maquetas**; después la tarea para Code.

## 0. Cómo seguir (en este orden)
1. Lee `CLAUDE.md`, la entrada más nueva de `docs/bitacora.md` y este documento completo.
2. Mira las referencias de `docs/tareas/maquetas-2026-11-19-taller/` (ver §8): sirven de punto de partida visual, pero **la lista por pedido y el asignar por paso quedaron reemplazados** por lo de §2 y §3.
3. Haz las maquetas del **Lote 1** (§7) en tamaño iPhone (390 × 844) y muéstralas en el chat como imágenes, cada una con un título arriba que diga qué muestra. Antes de mostrarlas, revísalas con un consejo (Ray, UI/UX, flujo y datos) y corrige.
4. Con el OK de Ray (y Gualfredo si quiere verlas), sigue con las maquetas del Lote 2 y 3, y después escribe la tarea para Code (`docs/tareas/2026-11-xx-ray-....md` + prompt), rama `ray/<tema>`.
5. Decisiones pendientes: §9. Pregúntalas, no las adivines.

## 1. Lo que pidieron, con sus palabras
- Gualfredo (18 nov): "El taller no es intuitivo. No sale lo de asignar, no sale para ver el pedido completo. En la Producción de antes se veía el pedido, lo que lleva, las especificaciones por producto y se conectaba con el pedido completo."
- Gualfredo (19 nov): "Quiero que la lista en Pedidos esté agrupada por el dueño de ese pedido y al darle me aparezcan los productos. Acá sí quiero el botón para ver los detalles de ventas, es decir su drawer en Ventas. Que me salga todo de ese cliente, que adentro sea más fácil asignar, todavía lo veo muy complicado."
- Gualfredo (19 nov) sobre el Costeador: "Perdió la esencia original. Necesito tener las opciones por modelo, ver lo que no he costeado. ¿En Catálogo o uno solo pero bien organizado, que me diga qué pestañas no tienen costo o qué producto no tiene? Quiero algo bien elaborado y fácil: ¿dónde registro los tubos y los materiales?" "En Taller hay cosas de costo. Que no nos volvamos algo feo."
- Ray es "simplista pero funcional": rechazó el costeador repartido en varios módulos, la misma acción empezando en varios lugares y las hojas encima de hojas. Acepta: todo junto, el dato clave a la vista, una acción por pantalla.

## 2. Regla de oro y mapa
**Un dato se cambia en un solo lugar; en los demás solo se ve o hay un atajo.** Hoy el precio de un tubo, los proveedores y las tarifas aparecen en 2 o 3 sitios: eso es lo que confunde.

- Menú: **Inicio · Ventas · Catálogo · Taller · Costeador** (la vendedora ve 4). Nombre "Costeador" o "Costos": pendiente (§9).
- **Catálogo:** lo que se vende (fotos, colores, medidas, precio, disponibles). Es de la vendedora. Admin ve un atajo "Costo ›" en la ficha del modelo.
- **Taller (lo que se hace):** Pedidos (por cliente, §3) · Corte (plan de corte; Material: hay/falta, comprar, ¿llegó?, retazos, contar) · Nómina (pagar, vales). Aquí no se cambian precios ni tarifas. Se quita "Proveedores con deuda" de Material (vive en Finanzas). Nómina deja un atajo "Tarifas ›".
- **Costeador (lo que se define):** Modelos · Materiales · Reglas (IVA, ganancia, proveedor principal y **tarifas de mano de obra** = las categorías de pago, que hoy están en `categorias-pago.html`).
- **Finanzas:** proveedores y deudas, gastos, mes. **Depósito:** entregar consumibles; sus compras por el mismo camino de la libreta (§6).

## 3. Taller por cliente (Lote 1)
- **Lista = clientes.** Tarjeta: nombre, "2 pedidos · 3 puertas · 1 ventana", lo más urgente (Atrasado / N sin asignar / En proceso / Listo), entrega más cercana con semáforo, miniaturas. Orden: atrasados, entrega más cercana, más por asignar. Nada alfabético. Exhibición como grupo fijo al final. Filtros Todos · Por asignar · En proceso · Listos filtran por productos (el cliente sale si tiene alguno que cumpla).
- **Un solo pedido → abre directo** (hoy los 12 pedidos en el taller son de 12 clientes distintos: no debe agregar un paso).
- **Hoja del cliente** (un solo nivel): arriba el cliente con WhatsApp; un bloque por pedido (N°, entrega, lo que debe, botón **Ver venta**); dentro, los productos con foto, especificaciones (`AH.resumenSpecs`), nota de la venta y sus pasos (acordeón, nunca hoja encima). Abajo fijo un solo **Asignar** (la vendedora no lo ve). Deuda: Total · Pagó · Debe y "de lo que pagó, $X está por confirmar" (`AV.pagado` ya incluye lo por confirmar; sumar `AV.porConfirmar`).
- **Ver venta** navega a `ventas.html?abrir=ID` (el drawer de Ventas está amarrado a `ventas.html`: `#sheetFicha`, `#fichaBody`; duplicarlo en el Taller sería la misma acción en dos lugares). Atrás vuelve a la hoja del cliente; en la ficha de Ventas, si viene del Taller, "‹ Volver al taller" en lugar de "Ver fabricación" (leer el parámetro antes de que `fichaPendiente()` limpie la dirección).
- Datos: agrupar por `cliente_id` (añadir al select de `taller.js` ~l.190; `produccion_lectura` no lo trae para la vendedora: cambio pequeño en esa función). Los avisos y enlaces viejos (`taller.html?abrir=N`, `?trabajo=`) abren la hoja del cliente en ese pedido.

## 4. Asignar por especialidad (Lote 2)
- No por paso ni por unidad: **una fila por especialidad pendiente del cliente** (Herrero · Masilla y pintura · Detalles · Aluminio; Madera solo para quien la lleva), con "3 puertas", el monto (solo admin) y chips de quienes tienen esa especialidad (si hay uno solo, viene marcado). Semana por pedido, ya puesta según la entrega ("Esta semana · 16 al 21 nov" / "Próxima semana · 23 al 28 nov"; nunca "sábado"). Caso normal: abrir cliente, Asignar, Luis Paz, Nicolas, Guardar = 4 o 5 toques.
- Agrupar por **especialidad**, no por oficio: el servidor exige `etapas.especialidad` ∈ `perfiles.especialidades`. Trabajadores reales hoy: **Luis Paz y Diogenes** (herrero), **Nicolas** (masilla y pintura), **Jesus** (aluminio y detalles). No hay carpintero. Armar e instalar caen en aluminio (`ventanero`). `porRol` de `taller.js` (~l.547) ya agrupa por especialidad: reusarlo.
- Excepciones: **Repartir** en la fila (despliega las unidades con su chip, ahí mismo). Empezado o hecho: gris con candado ("2 empezados · Luis Paz"), fuera del envío. Solo se envía lo que cambia (como `cambiosTodo`), para no mover pasos ↩ ni mandar "Cambió la fecha".
- `asignar_etapas(p)` acepta pasos de varios pedidos en una llamada (sin migración) pero es **todo o nada**: sacar antes madera (si no es Gualfredo) y productos sin categoría, con "Falta tarifa · Poner ›" en su fila. **48 de 49 modelos del catálogo no tienen categoría de pago** y hay productos en fabricación sin categoría (ventas 1099 madera, 1109, 1110, 1112).
- El servidor no protege un paso empezado (solo borra `iniciada_en`): lo cuida la pantalla.
- Avisos: uno por paso (6 unidades pueden ser ~20 avisos a una persona). Juntarlos necesita migración. Reasignar Hierro cambia la firma del corte ya enviado ("Cambió · vuelve a enviar").
- Al guardar: aviso chico "N° 1200 asignado completo" con **Siguiente ›** (próximo cliente por asignar), o "Guardado. A Ana Rincón le faltan pasos" con **Asignarlos ›**. Al asignar el último pendiente, anuncio grande "Todo el taller asignado" (una vez).

## 5. Costeador ordenado (Lote 3)
- **Corrección importante:** hoy `costos_datos` ya trae los 49 modelos y `costos.js` arma "Faltan por costear" con los 43 sin ficha, pero **sin decir qué les falta**, y la madera está oculta (`sinMadera`). Solo 1 modelo está listo.
- **Modelos:** arriba "1 de 49 listo" con barra; pestañas por tipo con cuántos faltan (Multilock 36 · Madera 6 · Combo 3 · Ventana 1); grupos **Sin empezar / A medias ("le falta: vidrio, pintura") / Listos**, dentro de cada grupo primero lo que más se vende; filtro "Le falta" puesto mientras haya pendientes; "Empezar copiando de…" (hay 37 Multilock parecidos). En Inicio del admin: "N modelos sin costo ›". Un modelo nuevo del Catálogo aparece solo como "Sin empezar" (no se crea dos veces).
- **Lo esencial del costeador original de Ray** (`maquetas-2026-11-08-reestructura/12-costeador-ray.png`): todos los modelos con estado Borrador/Listo, código, **dificultad Simple/Complicado a la vista** (es la mano de obra), medida base, proveedor principal claro, barras dibujadas con la sobra. Recuperarlo.
- **Ficha del modelo:** lista de revisión arriba (Cortes · Lámina · Vidrio · Pintura y consumibles · Herrajes · Mano de obra · Precio) según el tipo (la madera no lleva tubos; la ventana lleva aluminio); tocar un punto vacío baja a su sección; precio fijo abajo con "$X abajo / arriba del catálogo".
- **Una sola fuente para la tarifa:** hoy hay dos (`costeo_modelos.categoria_pago_id` y la del catálogo; el Bitral usa la 3 en el costeo y ninguna en el catálogo, y al venderse el taller no puede asignarlo). Debe leerse y escribirse la del catálogo. Esto arregla de paso los 48 modelos sin categoría.
- `_costeo_base` hoy **no detecta** faltantes de vidrio (aunque el modelo tenga `vidrio_o_farquilla`), lámina ni herrajes; Fondo, Esmalte y Masilla sin rendimiento general marcan faltante en todo modelo nuevo; la mano de obra de Combo y Ventana no suma armar ni detalles de ventana, y la madera no suma nada. Corregirlo en `_costeo_base` (no solo en `costeo.js`) para que Costeador, Catálogo y Finanzas digan lo mismo. La fórmula está dos veces (SQL `_costeo` y `costeo.js`): mantenerlas iguales (test44: Bitral 223,22 · 290,19 · 326,79 · 339,23).
- **Materiales: una sola lista** por pestañas (Tubos, Láminas, Vidrio, Pintura, Herrajes, Consumibles). Cada material: cómo viene (barra 6 m, hoja 1,22 × 2,44, galón con rendimiento, unidad), precio por proveedor (sin IVA, con IVA al lado), mínimo y existencias. **"+ Material" por pasos**: ¿qué es? → ¿cómo viene? → ¿cuánto cuesta?; el nombre se arma con las medidas; avisa si ya existe uno parecido. Desde el selector de la ficha: "No está · Registrar" con los mismos pasos, sin salir de la ficha, y vuelve con el material elegido. La vendedora nunca ve precios (lo cuida la base, no solo la pantalla).
- **Reglas:** IVA, ganancia, gastos fijos (o atajo a Finanzas), proveedor principal y tarifas de mano de obra.

## 6. Lo que encontró el consejo en la base y el código (hechos, 19 nov)
- **3 listas de materiales:**

| Lista | Qué tiene | La usan |
|---|---|---|
| `materiales_fab` | 11 (hierro, láminas, vidrio); stock todo en 0 | Costeador, Corte, Material, Depósito › Fabricación, compra. Dependen: `costeo_piezas`, `costeo_hojas`, `material_precios`, `material_retazos`, `material_movs`, `compra_lineas.material_id`, `cortes_ajustes` |
| `costeo_insumos` | 16 (Pintura y masilla, Accesorios, Consumibles), precio y rendimiento, sin stock ni proveedor | Precios del Costeador, `_costeo_base`, `costeo_modelo_insumos` |
| `materiales` | 18 del Depósito con stock real (la vendedora la ve) | `deposito_entregas`, `deposito_compras`, `compra_lineas.consumible_id` |

- Repetidos con nombres distintos (emparejar a mano con Ray y Gualfredo): Lija80/Lija 80, Tinner/Thinner, Disco flax/flap, Soldadura/Electrodos (kg), Bisagras/Bisagra, Cerradura/Cerradura multilock, Manillon Mediano/Manillón inox 30 cm, Fondo/Fondo anticorrosivo, Masilla, discos 14" y 7". Los ids 1 a 18 se repiten entre tablas.
- **No fusionar tablas ahora** (rompe ~10 tablas, permisos, `deposito_*`, `_costeo_base`, `costeo.js`, `compra.js`, `deposito-nuevo.js`). Camino seguro: 1) enlace que solo agrega `costeo_insumos.material_id → materiales` + emparejamiento; 2) una función de lectura unificada `security definer` para la pestaña Materiales que solo muestra precios a Ray y Gualfredo; 3) que comprar un consumible enlazado actualice su precio. Respaldo antes, prueba con `begin … rollback`, comparar el precio sugerido de los modelos costeados antes y después, con Gualfredo presente.
- **Dos caminos de compra de consumibles:** Depósito › Registrar compra (`deposito_comprar` → `deposito_compras`: sin proveedor, no llega a Finanzas ni actualiza precio; tiene los 19 datos reales, el último del 3 oct) y la compra de Taller › Material (`compra_lineas`, pasa por la libreta; 0 filas). Dejar uno solo.
- **La vendedora puede borrar un modelo del catálogo** (`catalogo.js` ~l.472) y se borra en cascada su costeo (piezas, hojas, extras) sin aviso; también puede cambiar medidas o `precio_base` y eso mueve el costo. Necesita migración (no dejar borrar si tiene costeo, o desactivar en vez de borrar).
- Stock de `materiales_fab` en 0: Corte › Material marca Falta en todo hasta contar barras.
- Finanzas › Mes usa el costo de hoy (solo los extras se guardan en `venta_item_costos`), solo cuenta modelos listos y cuenta todo producto como una puerta.
- Posible fallo sin probar en teléfono: `deposito.html` tiene su propio `#sheetCompra` y `compra.js` (~l.46) no crea el suyo si ese id existe: "¿Llegó?" desde Depósito › Fabricación abriría la hoja equivocada.

## 7. Orden de los lotes (de menor a mayor riesgo)
1. **Taller por cliente** + hoja del cliente + Ver venta (solo pantallas). Maquetas: lista (Todos, Por asignar, En proceso, Listos), tarjeta con varios pedidos, cliente con un solo pedido, hoja del cliente con scroll, Ver venta y la vuelta, vista de la vendedora, carga, vacío y error.
2. **Asignar por especialidad** (función existente). Maquetas: caso normal, Repartir, con empezados, con "Falta tarifa", semanas distintas por pedido, avisos al guardar.
3. **Costeador** con los 49, lista de revisión y una sola tarifa. Maquetas: Modelos con avance y pestañas, ficha con la lista de revisión, "Empezar copiando de…", Materiales, "+ Material" por pasos, registrar desde la ficha, Reglas con tarifas.
4. Tarifas a Costeador › Reglas; proveedores solo en Finanzas; un solo camino de compra.
5. Materiales en una lista (al final; migración con Gualfredo presente).
Cada lote con su prueba, capturas iPhone y la ayuda de la pantalla al día. Probar primero en el teléfono de Ray.

## 8. Ya decidido antes (sigue valiendo) y referencias
Referencias en `docs/tareas/maquetas-2026-11-19-taller/png/` (fuente HTML en `fuente/`; abrir a 390 px):
- **s1 a s9** (taller-simple.html): lista por pedido y asignar por paso **reemplazados** por §3 y §4. Siguen valiendo: deuda en la ficha, nota de la venta, especificaciones con chips, pasos en línea de tiempo con foto, filtros sin repetir, atrasado con **Reasignar**, Listos con aviso si debe, estados, vista de la vendedora (ve la deuda: ella cobra; no ve tarifas ni pagos a trabajadores).
- **a1 a a8** (anuncios.html), **OK de Gualfredo**: aviso chico arriba (se va en ~3 s, nunca tapa una hoja) al guardar una asignación; anuncio grande estilo "Venta confirmada" (`mostrarListo` de `venta.js`) con un solo botón de lo que sigue: todo el taller asignado, pago confirmado → Asignar ahora, nómina pagada → Pagar al siguiente, pedido entregado → Mandarle la nota con el sello; al trabajador "¡Hierro terminado! $30 sumado a tu semana". Para que no moleste: nada en cambios chicos, filtros o fotos; si se repite la acción, el grande una vez y después el chico; nunca dos por acción.
- **t1 a t7** (trabajo.html), a Gualfredo le gustó la idea: la ficha del trabajo terminado (`pintarTrabajo`) con una caja "Lo que sigue": si el siguiente paso no tiene a nadie, chips y "Dársela a …"; si ya tiene, solo informa; si era el último, "quedó listo · debe $X" + Avisar al cliente; si al pedido le faltan pasos, "Asignarlos ›". Opcional (decide Gualfredo): "Escribirle a Jesus por WhatsApp". Sigue sin "Bien hecho / Rehacer" y sin "Pagar este trabajo".
- **Todos los avisos con su botón** (propuesto): Nuevo pago → comprobante con Confirmar / No llegó; Producto nuevo → asignar ese pedido; Vale → Aprobar / No aprobar; Hay que comprar → Material; vendedora: Pago confirmado → Enviar seguimiento, Pago no llegó → Escribirle, Pedido listo → Avisar al cliente; trabajador: Nuevo trabajo / Ya te toca → Empezar este. Los avisos de `asignar_etapa` todavía dicen "Para el sábado DD/MM" y "Ahora es para el sábado": cambiar a "esta semana".
- **Si nadie toca un aviso:** no se repite; queda en Inicio ("Pendiente hoy", cada fila abre donde se resuelve) y en un número rojo sobre Taller; un solo recordatorio en la mañana (hora pendiente), solo si hay pendientes, lo urgente primero. Necesita `pg_cron` (disponible, no instalado): migración con Gualfredo presente.
- Lienzo con todo lo del 18 y 19 nov (solo en la cuenta de Gualfredo, puede compartirlo): https://claude.ai/artifact/Vj6g9JiXiHk2cJgQ51hZaA

## 9. Pendiente de decidir (preguntar, no adivinar)
1. ¿"Costeador" o "Costos"?
2. ¿La vendedora ve la deuda del cliente en el Taller? (propuesto: sí)
3. Semana por defecto al asignar: ¿Esta semana o la de la entrega? (propuesto: según la entrega)
4. Opcional "Escribirle al trabajador por WhatsApp" en la ficha del trabajo.
5. Hora del recordatorio de la mañana (propuesto 7:30).
6. Captura de "lo nuevo de Aliados" en la app de Airtek (referencia de estilo de los anuncios; no está en GitHub).
7. Si el mensaje de WhatsApp al proveedor lo firma Ray o "Herrería Artesanos".

## 10. Reglas que no se olvidan
Explicar en simple y esperar el OK; maquetas como imágenes en el chat (celular), con título. Nada de "sábado" en pantallas ni avisos. Sin morado, sin guion largo, sin `<select>` nativo, nunca dos botones con el mismo propósito, nunca hojas encima de hojas. Nunca `apply_migration` sin Gualfredo presente; pruebas en la base real solo con `begin … rollback`; sin `drop`. No borrar ventas, clientes, pagos ni pagos de nómina.
