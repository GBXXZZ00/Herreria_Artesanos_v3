# Contexto completo: Costos, Cortes y Finanzas (lo que pidió Ray)
Fecha: 07/11/2026 · Escrito por: Claude de Ray · Para: Claude de Gualfredo (y quien siga)

**Por qué existe este archivo:** la corrida única (PR #4, v73 a v80) ya está publicada, pero **a Ray no le funciona**:
1. **Está todo muy separado.** Para hacer una sola cosa (costear un modelo, planificar los cortes del sábado, comprar barras) hay que saltar entre 5 o 6 módulos.
2. **No están todos los tubos por modelo.** Revisado en la base el 07/11/2026: de los **49 productos del catálogo**, solo el **Modelo bitral (id 7)** está completo (7 piezas, "Listo"). **Combo #1 (id 112)** está en "Borrador" con solo el bastidor (2 piezas). Los otros **47 no tienen costeo ni piezas**, así que el plan de corte y el costo no sirven para ellos. **Cargar los cortes se hace después**; primero se ordena la idea y la pantalla.

Ray quiere algo **compacto y unificado**, como su prototipo (el Costeador). Este archivo junta todo para **planificar una reestructuración**. **No se programa nada sin el OK de Ray.**

---

## 1. La idea original (lo que Ray tenía en su prototipo)
El prototipo es el **Costeador Artesanos** (copia en `prototipo-costeador/costeador.html`, ábrelo en el navegador para verlo; los datos están en `modelo-vitral.json` y `precios.json`).

Era **una sola pantalla con 3 pestañas**, y todo se veía junto:
| Pestaña | Qué hacía |
|---|---|
| **Modelos** | Lista de modelos a la izquierda, editor en el medio y **precio siempre visible a la derecha**. En el editor: cortes por perfil (cantidad × medida en cm), **barras dibujadas** con sus piezas y el sobrante, lámina (en % de hoja 4×8), vidrio (m²), manillón, extras (protección, vitrales, yeso), mano de obra, rendimientos, fotos, notas. Selector de proveedor y "por metro / por tubo completo" ahí mismo. |
| **Plan de corte** | Pones cuántas puertas de cada modelo vas a hacer en la semana y la app junta todas las piezas por perfil en el menor número de barras: barras a comprar, retazos, láminas, vidrio, total con IVA, venta y costo del lote. |
| **Precios** | Todos los materiales con su precio sin IVA por proveedor. Si cambias un precio, todos los modelos se recalculan. |

**Lo que le gusta a Ray:** ver **mucha información en una sola pantalla**, números alineados, barras dibujadas, el precio siempre a la vista, y no tener que ir a otra parte para terminar algo.

---

## 2. Lo que quedó en la app hoy (después del PR #4)
| Para hacer esto… | …hoy hay que ir a |
|---|---|
| Costear un modelo | Costos › Modelos (ficha en hoja) |
| Ver precios de materiales | Costos › Precios (y también Finanzas › Proveedores › materiales) |
| Planificar cortes del sábado | Producción (asignar Hierro) → Costos › Semana |
| Ver qué barras hay | Depósito › Fabricación |
| Comprar lo que falta | Depósito › Compras |
| Pagar al proveedor | Finanzas › Proveedores |
| Hoja de corte del herrero | Mi trabajo |
| Ganancia y gastos fijos | Costos › Ganancia y Finanzas › Gastos / Mes |

Archivos: `costos.html` + `assets/js/costos.js` (4 pestañas: Modelos, Semana, Ganancia, Precios), `assets/js/costeo.js` (cálculo), `assets/js/corte.js` (plan de corte), `deposito.html` + `deposito-nuevo.js`, `finanzas.html` + `finanzas.js` + `finanzas-mes.js`, `mi-trabajo.js`.
Tablas: `costeo_reglas`, `costeo_insumos`, `costeo_modelos`, `costeo_piezas`, `costeo_hojas`, `costeo_modelo_insumos`, `costeo_extras` (v78), `materiales_fab` (v77), `cortes_planes`, `cortes_hechos` (v79), libreta `movimientos`, `proveedores`, `cuentas` (v74–v76), cierre del mes (v80).

**El cálculo está bien** (no se toca): Bitral $223,22 · $290,19 · $326,79 · barra completa $339,23.
**El problema es cómo está repartido**, no la fórmula.

---

## 3. Tubos por modelo: qué hay y qué falta
### 3.1 Único modelo con cortes: Modelo bitral (M-01, catálogo id 7)
| Perfil | Piezas | Metros | Barras de 6 m (5,10 m en marcos) | Sobra |
|---|---|---|---|---|
| Tubo 3" x 1" (bastidor) | 2 × 200 cm + 2 × 88 cm | 5,76 | 1 | 0,24 m |
| Tubo 2" x 1" | 1 × 194 cm (divisor vertical) | 1,94 | 1 | 4,06 m |
| Platina 1/2" x 2 mm | ranuras del frente, 600 cm en total | 6,00 | 1 | 0 |
| Tubo 1/2" x 1/2" 0,70 mm | ranuras de atrás 600 cm + vitral largo 390 cm | 9,90 | 2 | 2,10 m |
| Marco de puerta 10 (0,70 mm) | 500 cm | 5,00 | 1 | 0,10 m |
| Lámina pulida C/14 | 1 × 61,5 × 179 cm | 1,10 m² | · | · |
| Vidrio 5 mm | 1 × 184 × 10 cm + 5 × 50 × 4 cm | 0,28 m² | · | · |
Pendiente de Ray: desglosar la platina (6 m) y el tubo 1/2" (9,90 m) pieza por pieza.

### 3.2 Estado de cada producto del catálogo (base real, 07/11/2026)
| Estado | Productos |
|---|---|
| **Listo** (con piezas) | Modelo bitral (7) |
| **Borrador** (solo bastidor) | Combo #1 (112) |
| **Sin costear** (47) | Lineal Economico (4), Modelo Taco (12), Estrambótica Con Yeso (15), Taco Punto (18), Estrambotico 6 Vidrios (19), Media Luna 4 Vidrios (21), Arco 5 vidrios (24), Arco de cuadros (25), Arco 3 vidrios (26), Puerta Proteccion (28), 5 Lineas (29), Lineal Cuatro Vidrios (45), Villa con Bitral (52), Santorini (72), Combo #2 (83), Combo Modelo Lineal (93), Escalera (97), Bitralito (101), Cuadro (108), Luis (110), Media Luna 5 Vidrios (113), Lineal 5 Vidrios (118), Americana (122), Vinil Gris (123), Vinil Negra Rayas (126), Vinil Negra (128), Puerta Protección 2 (129), B con marco decorativo (130), 1 vidrio (131), K (132), B (133), Rayo (134), Arco grande (135), L1 (136), 4 vidrio (137), Media Luna (138), 3L con yeso (139), 3L con yeso y farquilla (140), Protección Rombo (141), Protección lineal (142), Protección Bitralito (143), Protección B (144), farquilla (145), Luis 1 bital (146), Vinil Negro Mate (147), Vinil Beige (148), Ventana modelo triángulo (149) |

Notas:
- Los "Vinil" y las 6 de madera van aparte (madera después). Las "Puerta Protección" pueden ser el extra Protección o un producto propio: **preguntar a Ray**.
- Todas las puertas llevan el **bastidor estándar**: tubo 3" x 1", 5,76 m (2 × 200 + 2 × 88 cm). Se puede poner solo al crear el modelo.
- Los dibujos del programa viejo de Ray (modelos viejos 1 a 9) **no están en la app**. Las fotos siguen guardadas en el Costeador de la cuenta de Ray (11 fotos: 2 del Vitral y 9 dibujos), pero no se pueden copiar al repo desde aquí. Cuando toque cargar cortes, Ray manda las fotos en el chat y dice a qué modelo del catálogo corresponde cada una.
- Forma vieja de anotar cada perfil: `metros usados / barras / sobrante` (ej.: Tubo 2x1 = 7,6 m / 2 / 4,4 m). En los modelos viejos el primer "Tubo 2x1" incluía el bastidor: a esos metros se les restan 5,76 m.
- Dudas de esos dibujos (sin resolver):
  - Viejo 1: qué lleva el medio círculo y su medida.
  - Viejo 4: piezas pequeñas a la izquierda del arco y franja vertical.
  - Viejo 5: el tubo 2x1 dice "11,04 m / 1,9 / 30 cm" y cuántos vidrios de 57 × 10 cm.
  - Viejo 7: pieza rayada dentro de la "U" (¿vidrio?) y su medida.
  - Viejo 8: si lleva marco.

**Regla:** nunca inventar cortes ni precios. Si falta un dato, se le pregunta a Ray.

---

## 4. Lo que Ray pide ahora (para planificar)
1. **Un solo lugar para el trabajo de taller**: modelo → cortes → precio → semana → barras → compra, sin saltar de módulo. Que se parezca al Costeador.
2. **Cargar los tubos de todos los modelos** de forma rápida (duplicar el Bitral o el bastidor estándar y cambiar solo lo distinto).
3. **Más compacto**: menos hojas que se abren una sobre otra, más datos por pantalla, el precio siempre visible.
4. Mantener las reglas de la app (colores, letra, botones, `CLAUDE.md`). Producción, trabajador, seguimiento y catálogo público no cambian.

### Idea para conversar (no está aprobada)
- **Costos = el taller de Ray**, con 3 pestañas como el prototipo: **Modelos · Semana · Precios**.
  - *Modelos*: lista + ficha + precio fijo abajo (teléfono) o a la derecha (computadora). Cortes con barras dibujadas en la misma ficha.
  - *Semana*: toma lo asignado en Producción, junta cortes, muestra barras que hay (del Depósito), qué falta comprar y **el botón para registrar la compra ahí mismo**.
  - *Precios*: materiales y proveedores juntos.
- **Ganancia** pasa a Finanzas (allí ya está el Mes y los gastos).
- **Depósito** queda solo para el conteo y las entregas.
- Antes de pantallas: una **maqueta como imagen** para que Ray la apruebe.

### Cómo integrarlo bien en la app (pasos para el Claude de Gualfredo)
1. **Medir el problema:** recorrer la app publicada (iPhone 13 y computadora) haciendo estas 4 tareas y anotar cuántas pantallas y toques lleva cada una:
   - Costear un modelo nuevo desde cero (duplicando el Bitral).
   - Cambiar el precio de un tubo y ver cómo cambia el precio del Bitral.
   - Armar el corte del sábado y saber qué barras comprar.
   - Registrar esa compra y ver cuánto se le debe al proveedor.
2. **Proponer un mapa nuevo** (qué pantalla queda, cuál se junta, cuál se va), comparando con el Costeador. Regla: **una tarea se termina en un solo lugar**.
3. **Reusar lo que ya existe.** Las tablas y funciones de v73 a v80 y la fórmula de `costeo.js` sirven: el cambio es de **pantallas y orden**, no de datos. Si hace falta tocar la base, se dice antes.
4. **Maqueta como imagen** en el chat (teléfono y computadora), con datos reales del Bitral.
5. **Esperar el OK de Ray** y hacerlo en un lote, siguiendo `CLAUDE.md` (rama `gualfredo/<tema>`, pruebas test44 y test45 como base, Bitral sigue dando 223,22 · 290,19 · 326,79 · 339,23).
6. Cargar los cortes de los otros modelos va **en una etapa aparte, después**.

---

## 5. Preguntas para Ray antes de empezar
1. ¿Está bien la idea del punto 4 o prefieres otra forma de juntar todo?
2. ¿La Ganancia la quieres en Costos o en Finanzas?
3. ¿Comprar las barras desde la Semana o seguir en Depósito?
4. Para después (cortes): ¿qué modelos van primero y cuál dibujo viejo es cada modelo del catálogo?

## 6. Dónde está todo
- Prototipo Costeador: `docs/claude/contexto-ray/prototipo-costeador/` (página, datos del Vitral y precios). El original con sus fotos está publicado en la cuenta de Ray: https://claude.ai/artifact/4ouDdt3wRnSQ1KoA21XWAv (privado, Ray lo comparte si hace falta). La página copiada guardaba datos en la base del artifact: abierta desde el repo se ve la pantalla pero sin datos.
- Maqueta v6 de Finanzas y Costos: rama `ray/maqueta-finanzas-costos`, carpeta `maqueta/`.
- Plan que se programó: `docs/claude/documentos/plan-finanzas-costos.md`.
- Reglas de costeo y precios: Memoria central (proyecto de Ray) · resumen en `docs/claude/documentos/` y en este archivo.
- Bitácora: `docs/bitacora.md`.
