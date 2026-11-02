# Módulo Ventas: definición acordada (se construye por partes)

Estado: en definición. Cada parte se aprueba antes de construirla.

## Parte 1: Organización de la app (acordado y CONSTRUIDO 27-sep-2026)

### Acceso (construido)
- Al abrir la app: "¿Quién eres?" con los usuarios como botones grandes, luego PIN de 6 números en teclado propio.
- La sesión queda guardada en el teléfono; solo se pide de nuevo al tocar "Salir".
- Cada quien puede cambiar su PIN desde su inicial (arriba a la derecha) > Cambiar mi PIN (se escribe dos veces; no acepta 111111, 123456, etc.).
- Usuarios: Gualfredo (administrador), Ray (administrador), Yulimar (vendedor).
- Sin sesión nadie puede crear, editar ni borrar en la base de datos ni subir fotos. El catálogo público sigue abierto solo para ver.
- Sirve también para registrar quién hizo cada venta y cada abono.

### Pantalla de inicio de la app (construida)
- "Hola, {nombre}" y la fecha.
- Botón grande "Nueva venta" (desactivado hasta construir Ventas).
- Catálogo a lo ancho con cuántos modelos y disponibles hay.
- Cotizaciones, Ventas, Producción y Nómina (solo administradores) marcados "Pronto".
- Menú de abajo en cada módulo: Inicio · Cotizaciones · Ventas · Catálogo · Producción.

### Cotizaciones y Ventas
- Para el jefe y el vendedor son dos módulos distintos.
- Por dentro son el mismo registro: al registrar el primer abono, la cotización pasa sola a Ventas sin volver a escribir nada.

### Estados de una venta
Cotización → Confirmada → En producción → Lista → Entregada (y Cancelada en cualquier momento).
- Cotización: al guardar sin abono.
- Confirmada: automático al registrar el primer abono.
- En producción: automático cuando Producción la asigne (módulo Producción).
- Lista: automático cuando Producción marque todo hecho.
- Entregada / Cancelada: las marca un administrador.
- Caso especial: venta de pieza de Entrega inmediata pasa directo a Lista al confirmar.
- Los estados alimentarán el PDF de la factura y los mensajes automáticos al cliente (módulo Facturas y Seguimiento).

### Abono para confirmar
- Hace falta al menos un abono. La app sugiere 50%; si es menos, avisa "Abono menor al 50%" y deja seguir.
- El vendedor ve todas las ventas.

## Catálogo público (27-sep-2026)
- Se quitó "Ver todo el catálogo"; en su lugar, botón "¿Tienes alguna pregunta? Escríbenos por WhatsApp".

## Respuestas del 27-sep-2026 (noche)

### Parte 2: listas
- Cotización dura 20 días. Se avisa cuando le quedan pocos días.
- La cotización se puede cambiar cuando el cliente pregunta o quiere algo más (se guardan sus datos).
- (Pendiente que Gualfredo confirme el dibujo de las listas.)

### Parte 3: productos y precios
- Manillón: +$20. Marco decorativo: sin monto aparte, va incluido en el precio (solo se marca). Protección de puerta: monto variable, se escribe cada vez.
- Si el modelo del catálogo ya tiene especificaciones, se marcan solas en la venta; el vendedor puede cambiarlas.
- Trabajos fuera de catálogo: el cliente trae la foto; se agregan solo a esa venta, NO al catálogo.
- Descuentos: el vendedor los pone después de pedir permiso de palabra; la app no pide aprobación, solo guarda quién lo puso.
- Instalación o traslado: se cobra aparte, monto variable escrito a mano.

### Parte 4: cliente
- Obligatorio: nombre, teléfono y dirección de instalación. Cédula: opcional (cuando haga falta).
- Si el cliente ya existe (por teléfono), sus datos se llenan solos.

### Parte 5: cierre y abono
- Moneda: todo en dólares por ahora.
- Fecha de entrega: se pone al confirmar.
- Sede de la venta: se anota. Por defecto Yulimar y Ray = Cumbres; Gualfredo = Avenida Universidad ("Paraíso"). Se puede cambiar.

### Parte 6: después de vender
- Cancelar con abono: casos muy puntuales; cualquiera (también Yulimar) puede cancelar, y la app pide anotar la devolución (monto y método). Siempre se devuelve el dinero.
- En producción ya no se puede cambiar.
- PDF: reutilizar la plantilla de la app vieja (datos de la empresa, cliente, cédula, teléfono, fecha de emisión, número de pedido, fecha de entrega, tabla producto/descripción/precio/cantidad/subtotal, total, método de pago, abono, resta). Sin IVA. La cotización usa el mismo formato con título "Cotización" y sin abono/resta.

### Base de datos (creada 27-sep-2026)
- Tablas: clientes (teléfono único), ventas (número = número de pedido), venta_items, abonos (abono o devolución, en dólares; tasa y Bs si pagó en bolívares).
- Solo usuarios con PIN pueden ver o escribir estas tablas.
- perfiles.sede_id: sede por defecto de cada usuario.

## Cambios del 27-sep-2026 (noche, después de probar)
- Cliente: primero Cédula o RIF (obligatoria), luego teléfono y nombre. Sin dirección de instalación. Si la cédula o el teléfono ya existen, los datos se llenan solos.
- Un solo botón "Guardar" que pregunta: Cotización (vale 20 días) o Venta (con abono).
- Descuento e instalación/traslado: opcionales; se activan tocándolos y ahí aparece el monto.
- Combos: el formulario separa "Puerta" y "Ventanas"; el color de las ventanas sigue al de la puerta.
- Abono siempre en dólares (sin tasa ni bolívares). Comprobante opcional (foto), guardado en carpeta privada.
- Fecha de entrega: 20 días hábiles (sin sábados ni domingos) desde hoy, se puede cambiar.

## Construido el 27-sep-2026 (noche)
- Listas de Cotizaciones (Abiertas · Vencidas · Descartadas, las más nuevas primero, etiqueta "Vence en X días") y de Ventas (Activas · Por cobrar · Entregadas · Canceladas, la entrega más cercana primero, barra de pagado y etiqueta "Entrega en X días" / "Atrasada").
- Ficha: convertir en venta, registrar abonos con comprobante, cambiar estado (solo hacia adelante; un administrador puede devolverlo), editar (cotización o venta confirmada; no en producción), cancelar con devolución, PDF (compartir por WhatsApp o descargar) y resumen en texto.
- PDF con el contenido de la factura vieja, en dólares y sin IVA. Título "Cotización" o "Nota de pedido".
- Montos: 1.500 = mil quinientos; se muestran centavos cuando los hay. Reintentos por mala conexión no duplican ventas ni abonos.
- Pendiente de decidir: tarjetas con montos (vendido, por cobrar) arriba en Inicio o Ventas.

## Seguimiento, pasos y notificaciones (28-sep-2026)
- Cada venta/cotización tiene un enlace público de seguimiento (seguimiento.html?t=...). Muestra avance (Confirmado → En fabricación → Listo → Entregado con fechas), pagos, productos y botón para descargar su PDF actualizado. Se apaga 3 días después de entregado. No muestra la cédula completa.
- Ficha con tres pasos y ✓: ① Mensaje (abre el chat del cliente con el texto según el estado y el enlace de seguimiento), ② PDF (compartir), ③ Producción (el admin envía a producción; el vendedor "Pide a producción" y le llega aviso al admin). En cotizaciones el ③ es "Convertir en venta".
- Enviar a producción: solo administradores.
- Notificaciones al teléfono para administradores: venta nueva, abono, pedido a producción, venta cancelada. En iPhone hace falta abrir la app desde el ícono de la pantalla de inicio (iOS 16.4+) y tocar "Activar" en Inicio.
- Aviso dentro de la app para admins: "X pedidos esperan producción" en Inicio.

## Partes pendientes de construir
2. Listas · 3. Productos y precios · 4. Cliente · 5. Cierre y abono · 6. Ficha de la venta
- Pendiente técnico: reintentar traer los Pedidos de la app vieja (importar.html, requiere haber entrado con PIN).

## Datos ya definidos en otras conversaciones
- Tarifas de ventana por m²: Panorámica $90 sin protección / $190 con; Ecobel $120 / $220.
- Abonos cuentan sin aprobación; foto del comprobante solo como respaldo.
- Métodos de pago: Binance, Zelle, Bolívares (tasa Binance, se escribe la del día), Efectivo.
- Sedes: Cumbres de Maracaibo, Avenida Universidad.
- WhatsApp del negocio: +58 422 016 7079.
