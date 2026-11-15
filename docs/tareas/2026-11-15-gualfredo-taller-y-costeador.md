# Tarea para Code: módulo Taller, sello ENTREGADO y Costeador unificado

Fecha: 15 nov 2026 · Pedida por: Gualfredo · Escrita por: Claude de Gualfredo (en el chat con Gualfredo, con un consejo de 3 revisores)
Rama sugerida: `gualfredo/taller-costeador` (sale de `main`). Maquetas: `docs/tareas/maquetas-2026-11-15-taller-costeador/` (PNG en tamaño iPhone 13 y su fuente HTML en `fuente/`): T1 a T7 Taller; C1 a C5 Costeador y nota; R1 a R4 Costeador completo para Ray (ficha entera, registrar pieza, Sábado entero y mapa).

**Todas las pantallas juntas (lienzo de diseño):** https://claude.ai/artifact/4ttqw6JFSAbUi1YZCSbHZr (páginas Inicio, Taller y Costeador; 43 pantallas y drawers).

**Lee primero:** `CLAUDE.md`, la entrada más nueva de `docs/bitacora.md`, este archivo completo y las maquetas en orden (T1 a T7, después C1 a C5). Para el Costeador lee también `docs/claude/contexto-ray/LEEME.md` y el prototipo `docs/claude/contexto-ray/prototipo-costeador/costeador.html` (rama `ray/contexto-reestructuracion`, PR #6), y `docs/tareas/2026-11-08-gualfredo-reestructura-costos.md` (lo que ya se programó).

---

## 0. Estado de aprobación y permisos

| Parte | Estado |
|---|---|
| **A. Taller** (Producción + Nómina) | ✅ **Aprobado por Gualfredo** el 15 nov. |
| **B. Sello ENTREGADO en la nota del cliente** | ✅ **Aprobado por Gualfredo** el 15 nov. |
| **C. Costeador** | 🟡 **Propuesta.** Gualfredo pidió dejarla escrita con todo el detalle. **Falta el OK de Gualfredo y de Ray a las maquetas C1 a C5 antes de programarla.** |

- ✅ Commits y push en la rama de trabajo. PR sin unir.
- ✅ Probar migraciones contra la base real **solo** dentro de `begin … rollback`.
- ❌ No aplicar migraciones (`apply_migration`), no unir el PR, no publicar. Eso se hace con Gualfredo presente (el conector de Supabase le pide "Permitir").
- Si algo necesita tocar la base y no está escrito aquí, **dilo antes** de hacerlo.
- Todo lo demás de `CLAUDE.md` sigue: `?v=` (hoy **v79**, este trabajo usa v80 en adelante, un número por lote), bitácora al empezar y al terminar, pruebas, revisión propia una vez al final.

---

## 1. Por qué se hace

- **Taller:** a Ray le llega el aviso de "Terminó Hierro" y lo manda a Producción, pero ahí **no está la foto ni el monto**. La foto solo sale en Nómina, escondida dentro de la ficha del trabajador. Ray quiere un solo lugar donde vea lo **por asignar**, lo **asignado en la semana** y lo que se **hizo** (con foto), lo que **debe pagar** y los **vales**. Agrupado **por pedido**, con **atajos** que lleven a todo.
- **Costeador:** Ray probó la reestructura de Costos (8 nov, v79) y no le sirve: sigue repartida en Costos, Depósito y Finanzas, y los cortes no se entienden. El consejo lo confirmó (ver §6): Costos ni siquiera está en el menú de abajo, comprar se empieza en 3 lugares, la deuda se ve en 3 lugares y hay hojas encima de hojas. Ray quiere su Costeador: todo junto, precio siempre a la vista, barras dibujadas.

**El cálculo no se toca.** Dato de control: Bitral (catálogo id 7) = **$223,22 · $290,19 · $326,79 · $339,23** (lo verifica `pruebas/test44.js`).

---

## 2. Menú de abajo (nuevo)

`Inicio · Ventas · Catálogo · Taller · Costeador`

- **Taller** reemplaza a Producción y a Nómina (`taller.html`; `produccion.html` y `nomina.html` redirigen a `taller.html` con la pestaña que corresponda, así no se rompen enlaces viejos ni avisos ya enviados; `nomina.html?t=ID` abre el drawer de ese trabajador).
- **Costeador** reemplaza a Costos (`costos.html` puede seguir siendo el archivo, con el nombre "Costeador" en pantalla). Solo Ray y Gualfredo lo ven.
- **Vendedora:** `Inicio · Ventas · Catálogo · Taller` (sin Costeador). En el Taller ve solo Pedidos, sin montos (maqueta T7).
- **Trabajador:** igual que hoy (Mi trabajo).
- 🟡 **Confirmar con Gualfredo:** hoy el menú tiene "Cotizaciones". La propuesta es meterla dentro de Ventas (filtro o pestaña). Si dice que no, el menú queda de 6.
- Depósito y Finanzas siguen existiendo; se entra desde Inicio y desde los atajos.

---

## 3. PARTE A · Módulo Taller ✅ (maquetas T1 a T7)

Datos de las maquetas: hoy = **jueves 19 nov**, semana lun 16 a sáb 21. Los números cuadran entre todas las pantallas; úsalos para las pruebas nuevas.

### 3.1 Pestañas
**Resumen · Pedidos · Nómina** (vendedora: solo Pedidos). Arriba, título "Taller", subtítulo "Hoy jue 19 · semana 16 al 21 nov" y flechas ‹ › para ver otras semanas.

### 3.2 Resumen (T1)
En bloques numerados, de arriba hacia abajo:
- **Avisos arriba:** "N entregas en 2 días ›" (ámbar), "N atrasado" (rojo, solo si pasó la fecha de entrega) y "N listo para entregar ›" (verde). Cada uno abre Pedidos con ese filtro.
1. **Por asignar:** total de pasos sin trabajador ("13 pasos en 3 pedidos"). Una fila por pedido: "N° 1203 · Bitral ×2 · 6 pasos · sáb 28 nov" y botón **Asignar** (abre la hoja de asignar de la primera unidad con pasos libres).
   - Criterio único en todo el módulo: **cuenta todos los pasos sin trabajador** de pedidos en fabricación y órdenes de exhibición.
2. **Lo asignado esta semana:** "6 de 9 hechos", barra de avance (hechos · haciendo · sin empezar · de la semana pasada) y tabla por trabajador: Asignado · Hecho · Falta. Tocar un trabajador abre su drawer (3.6) con sus trabajos y fotos.
   - "Asignado esta semana" = pasos con `para_el` = sábado de la semana vista, **más** los que tienen `para_el` de un sábado anterior y no están hechos (esos llevan la marca ↩).
   - Línea roja "↩ Detalles del Lineal (exhibición): era para el sáb 14 · Luis Paz" por cada paso arrastrado.
3. **Por pagar:** total neto ("$210 · trabajos $220 menos vales $10") y tabla por trabajador: Trabajos · Vales · A pagar · Total. Si un trabajador tiene trabajos no pagados de semanas anteriores, etiqueta roja "1 ↩". Debajo: "Ya pagaste $15 esta semana (Pedro). Lo que no pagues pasa a la semana siguiente con ↩."
4. **Vales:** pedidos por revisar (botón **Revisar** → drawer de vale, T6) y aprobados que se van a descontar.
- Atajos al final: **✂ Plan de corte sáb 21** (Costeador › Sábado) y **+ Fabricar para exhibición** (hoja que ya existe).

### 3.3 Pedidos (T2)
- Filtros en **una sola línea**: `Todos 6 · Por asignar 3 · En proceso 3 · Listos 1`. "Listos" = **Listos para entregar**: el pedido sale ahí cuando **todos** sus pasos están hechos (estado Lista), sin importar la semana en que se asignaron. Un pedido listo **no es lo mismo** que lo asignado en la semana.
- **Una tarjeta por pedido** (o por orden de exhibición). Arriba: "N° 1200 · Ana Rincón" y la fecha de entrega en una píldora (ámbar si faltan 2 días o menos, roja si pasó, verde "Lista"). Debajo, cada producto y unidad ("Bitral 1 de 2") con sus pasos como fichitas en una línea:
  - teal lleno con ✓ = hecho
  - borde teal = haciendo (en proceso)
  - gris = asignado, sin empezar
  - ámbar = sin asignar
  - blanco gris claro = todavía espera el paso anterior
  - **rojo con ↩ = asignado para un sábado que ya pasó y no se terminó**
  - Que el Hierro se haga una semana y la Masilla la siguiente es **normal: no se marca**. Solo se marca el **mismo paso** que no se terminó a tiempo.
- Pie de la tarjeta: lo que pide atención ("Foto nueva de Jesus hoy · 3 pasos por asignar", "↩ Era para el sáb 14 y no se terminó") y **Abrir ›** o **Asignar**.
- La madera sale con sus pasos (Estructura, Armado, Pintura, Ensamblado) y "Madera · la lleva Gualfredo". Las reglas de madera no cambian.
- Tarjeta de pedido **listo** (T2, tercera): debe el cliente / entrega, atajos **WhatsApp · Fotos · Venta** y botón **Marcar entregada** (usa lo que ya existe en Ventas; vendedora y admin).

### 3.4 Drawer del pedido (T3, primera)
- Título "N° 1200 · Ana Rincón", subtítulo "Entrega sáb 21 nov · en 2 días · pagado completo", cerrar con ✕ (sin botón "Cerrar" aparte).
- Atajos: **Venta · Seguimiento · ✂ Corte · Costeo** (Costeo abre la ficha de ese modelo en el Costeador; solo Ray y Gualfredo).
- Por cada producto y unidad: encabezado "Modelo bitral · 1 de 2" con **un solo botón Asignar** (abre 3.5), y sus pasos: número o ✓, nombre, quién y cuándo ("Jesus · terminó hoy 9:40 am", "Luis Paz · ya puede empezar", "sin asignar" en ámbar), **miniatura de la foto** (`AH.imgMini`) y monto con "por pagar" o "pagado" (sin montos para la vendedora).
- Tocar un paso hecho abre la foto (3.7).

### 3.5 Asignar (T3, segunda) · **la hoja que ya existe**
Gualfredo pidió usar la hoja de asignar de Producción tal cual (captura de hoy en `hoy-hoja-asignar.png`, `#sheetTodo` en `produccion.js`):
- "Asignar: Modelo bitral (2 de 2)", texto "Elige quién hace cada paso. A cada uno le llega el aviso cuando le toque."
- **¿Para cuándo?** Este sáb 21 nov · Próximo sáb 28 nov.
- Cada paso con sus trabajadores como opciones tocables (con su inicial) y **Sin asignar**. Un paso ya empezado sale fijo ("ya empezó").
- **Único cambio:** a la derecha del nombre del paso, lo que se le paga ("$30"). Sin categoría de pago no se asigna (regla de hoy).
- Botón **Guardar N cambios**. Usa `asignar_etapas` como hoy. Combos con sus bloques de ventanas y protecciones, igual que hoy.

### 3.6 Lo de la semana pasada (T3, tercera)
- El paso arrastrado sale con ↩ rojo y "Luis Paz · era para el sáb 14 · no lo terminó".
- Caja roja: "Sigue en la lista de Luis para este sábado. Con Asignar se lo das a otro."
- Nota: "Que el Hierro y la Masilla caigan en semanas distintas es normal: eso no se marca."
- Regla: un paso con `para_el` < sábado actual y estado ≠ 'hecha' es "de la semana pasada". **No se mueve solo**; sigue con el mismo trabajador hasta que alguien lo cambie. No hace falta columna nueva (`etapas.para_el` ya existe).

### 3.7 Aviso y foto del trabajo (T4)
- El aviso al admin cuando un trabajador termina ("Terminó Hierro · foto lista", "Jesus · Modelo bitral 1 de 2 · N° 1200. Toca para ver la foto.") debe abrir **directo ese trabajo**: `taller.html?trabajo=<etapa_id>`.
  - Hoy `marcar_etapa_terminada` y `terminar_etapa_madera` avisan con `'produccion.html?abrir=' || vid`. Cambiarlo es parchear esas funciones (DO + `pg_get_functiondef` + replace), así que es una **migración pequeña**: va probada con rollback y sin aplicar.
- Drawer: **foto grande** (toca para ampliar, `heroZoom` que ya existe), "Lo hizo", "Se le paga por esto", "Sigue" (siguiente paso y quién) y "Por pagar a Jesus" (neto de ese trabajador). Atajos **Ver pedido N° 1200 · Nómina de Jesus**. Nota: "Ya se sumó a lo que le debes a Jesus. Lo pagas cuando quieras desde Nómina."
- **Sin** botones "Bien hecho / Rehacer" y **sin** "Pagar este trabajo": Gualfredo decidió que Ray solo ve la foto.

### 3.8 Nómina (T5)
- Arriba: **Por pagar $210** (trabajos $220 · vales −$10) y **Ya pagado esta semana $15**.
- Una fila por trabajador: nombre, especialidad, "4 trabajos · vale −$10", etiqueta roja "1 de la semana pasada" si arrastra trabajos sin pagar, "Pidió vale $20 · revisar" si tiene un vale pendiente, y a la derecha lo que se le paga o "al día".
- **Quitar al carpintero** de la nómina de Ray: no se muestra a quien no le paga (`_puede_pagar_a`). A Gualfredo sí le sale.
- Atajos: **+ Vale · Categorías de pago · Historial**.

### 3.9 Drawer del trabajador y pagar (T5)
- Pestañas **Por pagar · Historial · Vales**.
- **Por pagar:** cada trabajo terminado sin pagar con casilla, miniatura de la foto, pedido con enlace y monto. Los de semanas anteriores llevan ↩ y "sáb 14 · no se pagó". Los vales aprobados también con casilla (se restan). Abajo, "Haciendo ahora (se suma cuando termine)".
- Pie: "4 trabajos $125 · vale −$10 · $115,00" y **Pagar $115 a Jesus**. Nota: "Lo que desmarques pasa a la semana siguiente con ↩."
- **Ray paga cuando quiera**, no solo el sábado (decisión de Gualfredo). Lo que no paga queda para después, marcado ↩.
- Hoja **Pagar**: "¿De qué cuenta salió?" (la hoja `#sheetSalida` / "¿De qué cuenta salió?" que ya existe en `nomina.html`), monto y **Confirmar pago**. Aviso al trabajador como hoy.
- ⚠️ **Necesita migración:** hoy `pagar_trabajador(tid, esperado)` paga **todo** lo pendiente antes del corte (`_corte_nomina()`), sin elegir. Para pagar solo lo marcado hace falta una versión que reciba las listas: por ejemplo `pagar_trabajador(tid uuid, esperado numeric, p_etapas bigint[] default null, p_vales bigint[] default null)`. Si las listas vienen en `null` hace lo de hoy; si vienen, paga solo esas, con las mismas validaciones (dueño del pago, `for update`, sin montos nulos, neto ≥ 0, `esperado` igual al neto). Revisa también si el corte debe dejar pagar lo terminado hasta **hoy** (Ray paga cualquier día). Las protecciones `pago_protegido`, `vale_protegido` y `etapa_protegida` no cambian. Se prueba con rollback y no se aplica.

### 3.10 Vale e historial (T6)
- **Vale:** "Vale de Luis Paz · Lo pidió hoy 8:10 am", Pide $20 · Por pagarle hoy $95, motivo, "Si lo apruebas, se descuenta cuando le pagues: quedarían $75", **Aprobar vale $20** y **No aprobar** (son dos acciones distintas). Usa `resolver_vale`. Anotar un vale usa `anotar_vale` (bolívares con tasa, como hoy).
- **Historial:** un cuadro por pago (fecha, total, cuenta, quién pagó, cuántos trabajos y vales); el más nuevo abierto con sus trabajos y fotos. "Los pagos hechos no se cambian."

### 3.11 Vendedora y estados (T7)
- **Vendedora:** solo Pedidos (Todos · En proceso · Listos), sin montos, sin Asignar y sin Nómina. Ve fotos y pasos. Puede **Marcar entregada**. La vendedora de madera además marca los pasos de madera, como hoy.
- **Estados:**
  - Esqueletos mientras carga (nada de spinners).
  - Vacío con mensaje y qué hacer: "Nada por asignar · Todo lo que entró ya tiene quién lo haga" y "Ver lo asignado".
  - Error con toast claro: "No se pudo guardar. Revisa la conexión y toca Guardar otra vez." Al pagar o asignar no se guarda nada a medias (todo en una transacción, como hoy).

### 3.12 Lo que se reusa (no rehacer)
`produccion_lectura`, `asignar_etapas`, `asignar_categoria_item`, `crear_orden_exhibicion`, `cancelar_orden_exhibicion`, `terminar_etapa_madera`, `nomina_semana`, `nomina_trabajador`, `pagar_trabajador` (con el cambio de 3.9), `anotar_vale`, `resolver_vale`, `AH.imgMini`, `AH.notaPago`, `heroZoom`, las hojas de Producción y Nómina. Mi trabajo y Seguimiento no cambian.

---

## 4. PARTE B · Sello ENTREGADO en la nota del cliente ✅ (maqueta C5)

- En el PDF de la venta (`crearPDF` en `assets/js/ventas-comun.js`), cuando la venta está en estado `entregada`, poner un **sello grande verde** que diga **ENTREGADO**, girado unos −12°, con la fecha de entrega (`ventas.entregada_en`) debajo ("20 NOV 2026").
  - Si la app ya guarda quién marcó la entrega, ponerlo también ("· RAY"). **Si no lo guarda, solo la fecha:** no agregues columna sin avisar.
- El sello va en un espacio en blanco, sin tapar números ni totales, y se ve igual al compartir por WhatsApp o descargar.
- Antes de entregada, la nota sale exactamente como hoy.
- Verde de la app (`--ok` / #1F7A4D). Mismo diseño del PDF de siempre.
- Prueba: generar el PDF de una venta entregada y otra no entregada; solo la primera trae el texto "ENTREGADO".

---

## 5. PARTE C · Costeador 🟡 propuesta (maquetas C1 a C4) · falta OK de Gualfredo y Ray

Idea: **el Costeador de Ray dentro de la app**, en un solo módulo, con los datos de Supabase y la misma fórmula. Depósito y Finanzas reciben la información por detrás. **Debería ser solo cambio de pantallas** (ver 5.7). Si en algún punto hace falta tocar la base, se avisa antes.

### 5.1 Pestañas
**Modelos · Sábado · Compras · Precios**. Solo teléfono por ahora; en computadora, más adelante, la franja del precio iría a la derecha como en el prototipo.

### 5.2 Modelos (C1)
- Arriba, un buscador y el botón **+ Nuevo**.
- Filtros: **Todos · Puertas · Combos · Ventanas · Extras**. La madera queda fuera por ahora.
- Grupos: **Listos · Borrador · Faltan por costear** (lo que está en fabricación va primero).
- Cada fila muestra el precio sugerido y cómo está contra el catálogo ("$6,79 abajo" en rojo, "gana 31 %" en verde) o "sin cortes" en ámbar.
- **Extras** tiene su propio filtro: ahí están las fichas de extra que ya existen, y no solo cuando aparece un extra vendido sin costear.
- **+ Nuevo** (C1, segunda pantalla):
  - ¿Qué es? Modelo / Extra.
  - Nombre.
  - Tipo, con opciones tocables.
  - Cómo empezar: **Copiar de otro modelo** (`costeo_duplicar`), **Estructura estándar** (bastidor 3"x1": 2 × 200 y 2 × 88) o **En blanco**.
  - El modelo se crea también en el Catálogo, oculto hasta que tenga foto (ver 5.8).
- **Modelo sin cortes** (C1, tercera pantalla): muestra "Catálogo $200 · todavía no tiene cortes" y los tres botones para empezar.

### 5.3 Ficha del modelo (C2), sin hojas encima de hojas
- **Pantalla propia** (no una hoja encima de la lista).
- Arriba: nombre, código, medida y categoría de pago.
- Debajo, chips con los subtotales (**Cortes · Lámina · Vidrio · Obra**): al tocar uno, la ficha baja hasta esa parte.
- **Cortes escritos en la fila**, como en el prototipo de Ray: `cantidad × cm × nota`, con teclado numérico.
  - Encabezado por perfil: "5,76 m / 1 barra / sobra 0,24 m" y su costo.
  - Debajo, la barra dibujada con las medidas adentro y el sobrante en beige. Máximo 3 barras por perfil; si hay más, "+N barras".
  - **+ pieza** y **+ perfil**.
  - "Qué es" y V/H (v81) se pliegan en un acordeón "Para 3D" dentro de la fila: no se pierden, pero no estorban.
- **Elegir perfil** (C2, tercera pantalla): drawer con buscador, filtros por tipo, precio de cada uno y "+ Material nuevo". Nada de `<select>`.
- El resto va en **acordeones cerrados** con su subtotal o resumen a la derecha: Lámina y vidrio · Pintura y consumibles (rinde N, del modelo o el general) · Herrajes y manillón · Mano de obra · Extras · Fotos y notas.
- **Franja del precio fija abajo** (C2):
  - **Cerrada:** "Precio sugerido $326,79", "$6,79 abajo" y "catálogo $320".
  - **Al tocarla se abre en el mismo lugar** (no es otra hoja):
    - Precios de: Colores y A. / Torniplemaca / Más barato.
    - Por metro usado / Barra completa.
    - Desglose: 1 Costo $223,22 · 2 Con ganancia (+30 %) $290,19 · 3 + Gastos fijos ($915 ÷ 25) $36,60 · Precio sugerido $326,79.
    - Debajo: "con barra completa: $339,23 · hoy en catálogo $320, ganas 27 %".
    - Botón **Catálogo: $320 → $326,79** (`costeo_pasar_catalogo`, con confirmación).
  - Esto reemplaza la hoja "Precio" de hoy.
- Guardado: se guarda solo al salir de cada campo, o con un botón **Guardar** fijo cuando hay cambios. Usa `costeo_guardar` como hoy. Nunca dos botones con el mismo propósito.

### 5.3b Ficha completa y cómo se registra una pieza (R1, R2) · lo que pidió Ray
- **R1** es la ficha del Bitral **completa y abierta**, con los datos reales de su Costeador:
  - Los **5 perfiles**: tubo 3"x1" (2 × 200 y 2 × 88), tubo 2"x1" (1 × 194), platina 1/2" (1 × 600), tubo 1/2" 0,70 (1 × 600 y 1 × 390) y marco 10 (1 × 500).
  - Lámina 1 × 61,5 × 179, vidrio 1 × 184 × 10 y 5 × 50 × 4.
  - Pintura, consumibles, herrajes, mano de obra, extras, fotos y notas.
  - El total por parte: cortes $39,69 · lámina $26,19 · vidrio $4,09 · pintura $29,77 · consumibles $14,40 · herrajes $44,08 · obra $65,00 = **$223,22**.
  - El aviso amarillo de lo que Ray dejó pendiente (desglosar la platina y el tubo 1/2" pieza por pieza).
  - **En la app las secciones de abajo salen cerradas**; R1 las muestra abiertas para revisar que no falta nada.
- **R2**, registrar una pieza, igual que en el Costeador:
  1. **+ pieza** agrega una fila vacía con el foco en Cant. y el teclado numérico.
  2. Al escribir cantidad y cm, la barra se redibuja sola (lo nuevo en ámbar un momento) y la franja del precio cambia al instante con `costeo.js`. ✕ al final de la fila quita la pieza.
  3. **+ perfil** abre el drawer de materiales (buscador, filtros, precio).
  4. El perfil nuevo sale abajo con su primera fila; "Para 3D" queda plegado.
  - Se guarda con `costeo_guardar`, y el número que vale es el de la base.
- **R4** es el mapa de qué se hace en cada pestaña y qué se queda en Taller, Finanzas, Depósito y Mi trabajo.

### 5.4 Sábado (C3, completo en R3) · el plan de corte "como en el Costeador de Ray"
- Encabezado "Plan del sáb 21 nov" con un atajo **Ir al Taller ›**.
- **Asignado en el Taller:** una fila por modelo con los pedidos y el herrero ("N° 1200 · N° 1203 · Hierro de Jesus") y botones **− N +**.
  - ⚠️ Lo que Ray suma o resta a mano es **simulación**: cambia los números en pantalla pero **no** el plan real. Para fabricar de verdad se usa "+ Fabricar para exhibición" (`crear_orden_exhibicion`). Que se note: "simulando +1" en gris.
  - Un modelo sin cortes sale con "sin cortes · cortar a mano" en ámbar ("Cargar cortes" y "Cortar a mano" ya existen).
- **4 cuadros** como en el prototipo: Barras a comprar (con IVA) · Lámina (m² y cuántas de 4×8) · Vidrio cortado · Venta y costo del lote.
- Por perfil: "usa 11,52 m"; una línea **Necesitas · Hay · Comprar** (lo que "hay" sale del Depósito, solo barras completas); las barras dibujadas ("Barra 1 · del Depósito", "Barra 2 · comprar") y **"Retazos que quedan: 48 cm"**, solo para leer.
- Abajo, fijo: "10 barras · lámina · vidrio · $72,21 + lámina", el botón **Comprar lo que falta** y dos enlaces: **Hoja de corte en PDF** y **Ajustar ›**.
- **Ajustar** (casi nunca se usa) guarda lo que hoy existe y no se quiere perder: mover pieza, usar o no usar un retazo, "+ Retazo que encontré", volver a la sugerencia y **Corregir corte**.
- ⚠️ **No romper la base:**
  - El disparador `corte_al_terminar_hierro` solo baja las barras si el plan está **aceptado** y cada barra tiene su herrero. Antes de cortar (o al tocar "Comprar lo que falta" o "Hoja de corte"), la pantalla tiene que seguir llamando a `corte_plan_guardar(p_sab, p)` con el plan aceptado, aunque Ray no vea "aceptar".
  - Revisar que un Hierro **ya empezado** no desaparezca del plan antes de aceptarlo (`corte_datos` solo cuenta los pendientes).
- Retazos "como en el Costeador": el plan sugerido de Ray **no** usa retazos (siempre barras nuevas, y dice qué sobra). Si la sugerencia de hoy (que sí usa retazos del Depósito) da menos barras, ofrecerlo como **una sola línea** debajo del perfil ("Hay un retazo R-12 de 1,20 m que sirve · Usar"). 🟡 **Confirmar con Gualfredo y Ray.**

### 5.5 Compras (C3, segunda pantalla, y C4) · "como hoy", pero en un solo lugar
- **Comprar lo que falta** abre la hoja que ya existe (`compra.js`, `#sheetCompra`):
  - saldos arriba;
  - Comprar en: Más barato / un proveedor;
  - un cuadro por proveedor con sus líneas;
  - "+ Material · + Otro lugar · + Gasto (flete)";
  - Total con IVA y **Pedir compra · $72,21**. Queda en amarillo hasta que llegue.
- Pestaña **Compras**:
  - La compra **en camino** en amarillo con su botón **¿Llegó?**.
  - **Le debes**, una fila por proveedor con su saldo (`_saldo_proveedor`); al tocarla se abre su ficha y estado de cuenta en PDF.
  - Compras del mes.
  - Atajos **+ Compra suelta · Estado de cuenta PDF · Finanzas ›**.
  - Nota: "Cuentas, gastos fijos y el cierre del mes siguen en Finanzas."
- **¿Llegó?** (C4, segunda pantalla):
  - lo que vino, con cantidades y precios que se pueden cambiar;
  - N° de factura y foto;
  - ¿Cómo se paga? Pagué · Lo debo · Una parte · Saqué dinero (con vuelto);
  - de qué cuenta;
  - **Confirmar · $72,21** y "No llegó".
  - Es la misma hoja y las mismas funciones de hoy (`compra_confirmar`, `compra_no_llego`, `compra_anular`).

### 5.6 Precios (C4, tercera pantalla)
- Tabla como la del prototipo: material hacia abajo, una columna por proveedor y el precio sin IVA en un campo que se escribe ahí mismo. El más barato sale en verde. Filtros: Perfiles · Láminas · Vidrio · Pintura · Herrajes.
- Abajo: **Guardar precios (N cambios)** y una nota: "Al guardar se recalculan todos los modelos".
- Atajos: **+ Material · + Proveedor · Reglas**. Reglas lleva IVA, ganancia, puertas al mes, grosor del corte y despunte, y es la hoja que ya existe.
- Si hay 4 proveedores o más, la tabla se mueve de lado con la primera columna fija.
- Usa `material_precio_guardar`, `material_fab_guardar`, `costeo_insumo_guardar` y `costeo_reglas_guardar`.

### 5.7 Qué se queda, qué se va y qué se esconde
| Pantalla de hoy | Qué pasa |
|---|---|
| Costos › Modelos, Plan de corte, Precios | Pasan a Costeador › Modelos, Sábado, Precios (rehechos como arriba) |
| Hoja "Precio" encima de la ficha | Se va: la reemplaza la franja del precio |
| Hoja "Pieza" encima de la ficha | Se va: las piezas se escriben en la fila. Elegir perfil queda como drawer (C2) |
| Depósito › Compras | **Se quita**: comprar y "¿Llegó?" quedan solo en el Costeador. Hoy hay "Cargar compra" en Depósito y "Pedir compra" en Costos, dos botones para lo mismo |
| Depósito › Fabricación (barras, retazos, conteo) | Se esconde para Ray: el "hay" sale en Sábado. El **conteo** queda en el paso 2 del cierre del mes (Finanzas) y en Depósito para quien lo haga |
| Depósito › Consumibles y entregas a trabajadores | **Se queda** (lo usan la vendedora y los admin) |
| Finanzas › Proveedores › materiales y precios | Se quita la parte de precios (vive en Costeador › Precios). La ficha del proveedor y su estado de cuenta se quedan |
| Finanzas › Dinero, confirmar pagos, Gastos (gastos fijos solo aquí), Mes y cierre | **Se quedan** |
| Mi trabajo › hoja de corte del herrero | Se queda igual |

### 5.8 "¿Puede agregar costos a los productos desde el Costeador?" Sí
- **Precio:** el botón **Catálogo: $320 → $326,79** está en la franja del precio (C2). Usa `costeo_pasar_catalogo`.
- **Producto nuevo:** `costeo_pasar_catalogo` **ya crea el producto en el Catálogo** cuando el modelo está "en diseño", pero lo crea con medida fija 2×1, sin categoría de pago y sin foto.
  - En **+ Nuevo** se piden el tipo y la medida.
  - Al crearlo sale un aviso: "Falta foto y categoría de pago en el Catálogo ›", que lleva al Catálogo.
  - El producto queda **oculto** al cliente y a la vendedora hasta que tenga foto.
  - Revisa si pasar la medida y el tipo pide tocar la función. **Si lo pide, avísalo antes.**
- **Extras:** la ficha del extra (lote 7) con "Se ofrece / Oculto", ahora visible desde el filtro **Extras**. Ray todavía debe llenar su tabla de extras.

### 5.9 Funciones que ya sirven (el consejo las revisó en la base)
- **Costeo:** `_costeo`, `costos_datos`, `costeo_calcular`, `costeo_resumen`, `costeo_guardar` (ya trae qué es y V/H), `costeo_duplicar`, `costeo_reglas_guardar`, `costeo_insumo_guardar`, `material_precio_guardar`, `material_fab_guardar`, `costeo_pasar_catalogo`.
- **Corte:** `corte_datos`, `corte_plan_guardar`, `corte_plan_reiniciar`, `corte_manual`, `corte_corregir`, `retazo_agregar`, `retazo_quitar`, `_retazo_minimo`, disparador `corte_al_terminar_hierro`.
- **Compras:** `compra_pedir`, `compras_en_camino`, `compra_confirmar`, `compra_no_llego`, `compra_anular`, `_saldo_proveedor`.
- **Finanzas:** `finanzas_datos`, `cierre_datos`, `cierre_paso`, `mes_cerrar`.
- **Extras:** `_extra_costo`, `extras_precios`.

### 5.10 Riesgos
- **Bitral:** correr test44 en cada lote.
- **Permisos:** hoy Costos usa `_es_ray()` (quien confirma pagos) y las compras usan `_es_admin()`. Hoy son las mismas dos personas, pero anótalo en el PR; no lo cambies sin avisar.
- **Vendedora:** no ve el Costeador ni costos; solo `extras_precios`.
- **Madera:** fuera del Costeador por ahora (se filtra).

---

## 6. Lo que dijo el consejo (15 nov, 3 revisores independientes)

**Sobre el Taller.** Le dieron 8, 7 y 6 de 10 antes de corregir. Se corrigió:
- fechas que no cuadraban;
- "Pagado esta semana" que no cuadraba;
- conteos con criterios distintos;
- botones repetidos ("Cerrar" junto a la ✕, tres "Asignar");
- filtros que no cabían en una línea;
- faltaban la vendedora y los estados de carga, vacío y error.

Gualfredo decidió no agregar revisión de foto, que Ray pueda pagar cuando quiera y quitar al carpintero de la nómina de Ray.

**Sobre el Costeador** (Ray, UI/UX, y flujo y datos):
- Lo que lo hace sentir "lejos y separado":
  - Costos no está en el menú de abajo.
  - Comprar se empieza en 3 lugares (Costos, Depósito › Compras, Finanzas) y la deuda se ve en otros 3.
  - Hay hojas encima de hojas: Ficha › Pieza › material, Precio en otra hoja, Plan › "cómo se corta" › Corregir.
  - Lo que Ray más quiere (barras dibujadas y precio a la vista) quedó dentro de hojas.
- No hay que perder:
  - Copiar de otro modelo.
  - Los chips de subtotales.
  - El precio siempre visible.
  - El color por puerta en la hoja del herrero.
  - La tabla necesitas · hay · comprar.
  - Los retazos numerados.
  - El aviso "sin cortes" con "Cargar cortes".
  - "Más barato".
  - El amarillo de "en camino".
  - "Saqué dinero" con el vuelto.
  - "Usar en el catálogo".
- Sobra o va escondido:
  - Mover piezas y elegir retazos (pasan a Ajustar).
  - "Qué es" y V/H (pasan a "Para 3D").
  - Corregir corte y despunte (pasan a Ajustar y Reglas).
  - Las hojas encima de hojas.
  - Depósito › Compras.
  - El aviso "Ahora usa el general".
- Densidad: acordeones cerrados con su subtotal, máximo 3 barras por perfil, nada de saldos de cuentas ni cierre del mes dentro del Costeador, botones de 44 px o más.
- La conclusión del revisor de flujo y datos: **todo puede hacerse sin migración**, salvo los dos puntos marcados abajo.

---

## 7. Lotes (en orden)

1. **Menú y Taller › Pedidos y drawers** (T2, T3): `taller.html` con las pestañas, Pedidos agrupado por pedido, drawer del pedido, hoja de asignar de hoy, marca ↩ y redirecciones desde `produccion.html` y `nomina.html`.
2. **Taller › Resumen** (T1) y **foto del trabajo** (T4), con el cambio del enlace del aviso.
   - Migración `vNN_gualfredo_aviso_trabajo`: parchear `marcar_etapa_terminada` y `terminar_etapa_madera` para que el aviso al admin vaya a `taller.html?trabajo=<eid>`. Probada con rollback, sin aplicar.
3. **Taller › Nómina** (T5, T6): drawer del trabajador con casillas, pagar cuando sea, vales e historial, sin el carpintero para Ray.
   - Migración `vNN_gualfredo_pagar_elegido`: `pagar_trabajador` con listas de trabajos y vales (ver 3.9). Probada con rollback, sin aplicar.
4. **Vendedora y estados** (T7) y **sello ENTREGADO** (Parte B).
5. ⏸ **Costeador** (Parte C), solo con el OK de Gualfredo y Ray, en este orden:
   - 5a: Modelos, ficha y franja del precio.
   - 5b: Precios.
   - 5c: Sábado con Ajustar escondido.
   - 5d: Compras en el Costeador y quitar Depósito › Compras.
   - 5e: Limpieza de Finanzas y Depósito.
   - 5f: Extras, cuando Ray llene su tabla.

Al final de cada lote: su prueba, `node --check`, `?v=` nuevo y bitácora.

## 8. Pruebas
- **Nuevas:**
  - `test50` Taller: Resumen con los números de las maquetas (13 por asignar, 6 de 9 hechos, $210 por pagar), Pedidos con los 4 filtros, drawer del pedido, asignar con la hoja de hoy, marca ↩, foto desde `?trabajo=`, vendedora sin montos.
  - `test51` Nómina: pagar solo lo marcado, lo no marcado queda con ↩, vale aprobado se resta, carpintero oculto para Ray.
  - `test52` PDF con el sello ENTREGADO.
  - Las del Costeador cuando se haga.
- **Siguen en verde:** test21 (Producción, ajustar rutas), test26 (trabajador), test28 (recorrido completo), test30 (Nómina), test44 (Bitral) y la batería completa al final, en dos mitades.
- Capturas iPhone 13 de las pantallas nuevas y comparar con las maquetas.
- Agregar a `docs/claude/documentos/lista-de-pruebas.md` lo que Gualfredo y Ray deben probar en el teléfono.

## 9. Preguntas abiertas
- Gualfredo: ¿Cotizaciones entra en Ventas? (§2)
- Gualfredo y Ray: OK a las maquetas del Costeador C1 a C4 y R1 a R4.
- Gualfredo y Ray: ¿el Sábado sugiere usar retazos del Depósito en una línea o no los usa nunca? (§5.4)
- Ray: tabla de extras (lote 7) y si "Puerta Protección" es extra o producto.
- ¿El sello lleva quién entregó? Solo si la app ya lo guarda (§4).
