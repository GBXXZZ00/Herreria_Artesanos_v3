# Finanzas y Resumen del taller en PDF (EN PAUSA)

Actualizado: 30 sep 2026, 16:15. App en v64 (commit d4941fb). Nada de esto está programado.
**En pausa por decisión de Gualfredo: está probando todo lo publicado hasta v64.** Retomar solo cuando él diga.

## 1. Resumen del taller en PDF: maqueta v6 (la vigente)

- Archivo del proyecto: **claude/maqueta-resumen-v6.html** (HTML plano, se ve en navegador; usa assets/img/logo.png como "logo.png"). La maqueta vieja del artefacto de diseño (W6sPtMbq5s3tyNkLdzVQ8L) quedó superada: NO usarla.
- Diseño: el MISMO del PDF de la venta (ventas-comun.js, jsPDF, Helvetica): logo arriba a la izquierda, título teal a la derecha, línea teal, bandas teal con título blanco, cuadros grises (#F7F6F4) con etiqueta gris y valor en negrita. Gualfredo pidió explícitamente "usa el diseño de la app".
- Botón que genera el PDF carta con cómo está todo en ese momento. Versión admin y versión vendedora (sin montos de trabajadores ni nómina, solo su sede: por confirmar).

### Hojas v6
1. **Resumen**, en 3 bandas: **Dinero** (mes actual contra el anterior): por cobrar partido en "listos, cobrar ya" y "en fabricación, al entregar"; vendido contra el mes anterior; pagos por confirmar (Ray); cobrado por forma de pago con columnas mes, mes anterior y cambio, más lo devuelto; ventas por sede y vendedor con columna del mes anterior; efectivo por sede (según la app, contado y diferencia a mano). **Taller** (esta semana lunes a sábado, por la nómina): pasos terminados de los del sábado, atrasados, sin asignar, nómina del sábado, productos terminados en el mes contra el anterior. **Lo que necesita tu decisión**: tabla Qué pasa / Cuáles / Lo resuelve (atrasados con paso y quién, sin asignar, pagos por confirmar, listos sin avisar, cotizaciones que vencen, depósito).
2. y 3. **Pedidos por entregar** (nombre propuesto): una franja compacta de conteos, leyenda de puntos, y un bloque con borde por pedido: franja de arriba (N°, cliente, teléfono, sede, entrega con chip atrasado / a tiempo / sin avisar / espera pago, total, abonó cómo y cuándo, resta) y debajo una fila chiquita por producto (×cant, nombre, especificaciones, paso actual con punto de color y quién). Atrasados primero, en rojo suave. Caben 10 pedidos por hoja.
4. **Quién tiene qué**: tabla de todos (terminó, haciendo, por hacer, atrasados, ganado, si termina, vales, le tocaría, total del taller y trabajos sin tarifa); debajo una tarjeta compacta por trabajador (haciendo, por hacer, terminado, con monto) y la de pasos sin asignar.
5. **Entregados y cotizaciones**: entregados en el mes (pedidos, productos y valor contra el mes anterior) con TODOS los productos de cada pedido, fecha, si fue a tiempo y total; cotizaciones vigentes (quién la hizo, vence, total) con cerradas en el mes; firmas.

### Lo que dijo Gualfredo (30 sep, tarde)
- Nunca se entrega un producto debiendo: se quitó "entregadas debiendo" y "¿se cobró todo?".
- Le encanta "cobrado en el mes" SIEMPRE que compare con el mes anterior. Le encanta "efectivo por sede".
- No entendía si el taller era mensual o semanal: ahora está rotulado "esta semana".
- "Para atender" no le servía: el resumen es para el admin; se cambió a "Lo que necesita tu decisión".
- Cambiar el nombre "Ventas sin entregar"; pedidos compactos, que se vea qué producto es de qué pedido, letras más chicas, hasta 10 pedidos. "Quién tiene qué" estaba horrible: compactar.
- "Entregados" = lo que se culminó; un cliente puede tener varios productos.

### Preguntas del PDF pendientes
1. Nombre: "Pedidos por entregar", "Pedidos en curso" o "Pedidos abiertos".
2. ¿"Lo que necesita tu decisión" es lo que esperaba?
3. Taller: ¿semana + productos del mes, o todo por mes?
4. ¿Juntar "Quién tiene qué" con "Entregados y cotizaciones" si caben?
5. Versión de Yulimar: ¿mismas hojas sin montos de trabajadores ni nómina y solo su sede?

### Datos que ya existen para programarlo
- ventas (estado, sede_id, vendedor_id, total, fecha_entrega, confirmada_en, entregada_en, lista_en, vence_en), abonos (monto, metodo Binance/Zelle/Bolívares/Efectivo, tipo abono/devolucion, estado, tasa, monto_bs, fecha).
- etapas (estado, trabajador_id, iniciada_en, para_el, monto), avance_venta(vid), nomina_semana / nomina_trabajador, vales, deposito_resumen.
- El efectivo "según la app" hoy solo sabe lo que ENTRÓ (efectivo confirmado menos devoluciones, por sede de la venta).
- PDF con jsPDF (assets/vendor/jspdf.js, se carga en ventas-comun.js): usar lo mismo.

## 2. Módulo de Finanzas: SE REPLANTEA DESDE CERO
- Se propuso un diseño de cuentas, movimientos, gastos, mover dinero y arqueo (maquetas iPhone) y Gualfredo dijo que **no lo entiende, que está mal pensado y que no sabe todavía qué necesita**.
- Próximo paso acordado: primero terminar el PDF. Después, pedirle que cuente con sus palabras **una semana normal del dinero** (dónde cae lo que pagan los clientes, quién lo tiene, qué se paga y con qué) y proponer algo simple a partir de eso. No volver a presentar el diseño anterior tal cual.
- Datos útiles: los vales pueden ser en bolívares (vales.monto_bs, tasa); pagos_trabajador (monto, pagado_por, semana); deposito_compras / deposito_facturas (costo). Sedes: Cumbres de Maracaibo y Avenida Universidad.
