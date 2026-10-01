# Pruebas de la app (Playwright, iPhone 13)

Simulan Supabase con datos falsos: no tocan la base real y los PIN son de mentira.

1. En la carpeta del repo: `python3 -m http.server 8765`
2. En otra terminal, desde `pruebas/`: `mkdir -p shots4 && node test14.js` (hasta test30)
3. Cada una termina con `TODO OK` o dice qué falló.

- test14: navegación (atrás, inicio, subpantallas)
- test15: nueva venta completa (cliente, catálogo, piezas, a medida, extras, pago)
- test16: listas de ventas y cotizaciones, ficha, PDF, convertir, pagos, estados (sin botón de producción; de producción no se devuelve)
- test17: vendedora vs admin, confirmar pago pasa solo a producción, solo admin cancela ventas, página pública de seguimiento
- test18: a medida con tipo, exhibición con pago completo, comprobante obligatorio, edición, lista desde copia local, service worker
- test19: mensaje único al cliente (cotización, nota de pedido, avisar por WhatsApp), chip "Por avisar"
- test20: módulo Usuarios (solo admin) — crear cuenta, especialidad de trabajador, restablecer PIN, desactivar, eliminar, protección de la propia cuenta
- test21: Producción: "Lo está haciendo ahora" en el paso que empezó el trabajador; vendedora solo mira (sin montos ni botones); lista, ficha por etapas, un solo botón "Asignar trabajadores" con "¿Para cuándo?" (este sábado o el próximo), sin "Marcar terminado" del admin, pasos atrasados, Combo en 3 bloques (puerta, 2 ventanas, 2 protecciones), foto en otro color, error del servidor y trabajador inactivo
- test22: Categorías de pago (solo admin) — crear, editar, eliminar, fijo o por m²
- test23: Catálogo — categoría de pago en el formulario del modelo
- test24: Categorías de pago — "Asignar a modelos": sin categoría primero, ver la de cada uno, no pisar sin confirmar; Catálogo sin "Elegir varios"
- test25: Producción: sin categoría no se asigna, quién lo hace a la derecha, fabricar para exhibición (tipo, modelo, especificaciones, categoría), cancelar orden, abrir desde aviso
- test26: Inicio del trabajador ("¿Con cuál empiezas?" con uno solo en proceso, marcar con toque o flechas, "Ordena el trabajo", "Estás haciendo" con un solo botón, terminar con foto obligatoria y reintento sin subirla otra vez, fila "Después" numerada y con margen a los lados, "de la semana pasada", detalle con tabla de especificaciones, franja de color, foto en otro color y nota), Mis pagos (cobras el sábado, cada trabajo con la foto del catálogo y la suya, detalle lado a lado, historial siempre cerrado, vale) y pendientes del admin por color
- test27: menú y perfil — sin señal no se esconde Producción ni se adivina el rol; reintentar
- test28: recorrido completo con varias personas (incluye Nómina: Ray paga y Jesús ve su recibo): Gualfredo crea el modelo, Yulimar lo vende, Ray confirma el pago (pasa solo a producción) y asigna todo de una vez, Jesús hace cada etapa desde "Ahora" con foto, cobra y pide vale, Ray lo aprueba en Nómina, el cliente ve su seguimiento con los pasos reales y las fotos del taller, y se entrega
- test29: Inicio de la vendedora: sus pendientes (pago no llegó, pedido listo, pago confirmado, cotización por vencer, pedido atrasado) solo de sus ventas
- (29 sep, reglas de producción) test15: combo con medidas fijas y aluminio (Ecobel +$80), ventana con la protección del modelo, sin combo a medida · test17: seguimiento con pasos nuevos · test18: lo ya vendido conserva sus datos · test21: combo y ventana con protección por oficio, espera entre líneas, asignar por rol · test22: tarifas por oficio con extra de protección · test23: el combo guarda las medidas de sus ventanas · test26: ordenar tocando en orden, sin parpadeo, piezas que incluye un trabajo, Instalar no se paga · test28: puerta con Hierro, Masilla, Pintura y Detalles
- test30: Nómina: quién la ve y quién paga (solo Ray), vale que pide el trabajador (solo Ray lo aprueba, ahí mismo), enlace nomina.html?t=ID, vale en bolívares, trabajos sin monto, lo del domingo para la próxima semana, montos que cambiaron, ficha de cada trabajo
- (29 sep, Cotización | Venta) test15: arriba Cotización o Venta, la cotización no pide detalles para fabricar, el aluminio de la ventana siempre se elige, en venta se marcan los productos sin detalles y "Continuar al pago" abre el primero · test16 y test31: al convertir primero se revisan y completan los detalles (hacia dónde abre, bloque, vidrio, ahumado), luego el pago; se guardan con completar_detalles antes de convertir · test18 y test28: venta con detalles · test25: exhibición de ventana pide el aluminio
- test32: Catálogo: una ventana de entrega inmediata no se guarda sin su aluminio
- test33: Depósito: materiales (por reponer, agotado), entregar en 2 pasos (material, luego a quién, con lo que hizo desde la última vez), entregas por semana y por trabajador, revisión de Ray (aprobar o cuestionar con nota) con los trabajos como en Nómina, la vendedora no ve costos ni compras, compra del administrador, pendientes en Inicio
- test34: atajos: combo sin medidas se arregla desde la venta, Nómina pone la categoría ahí mismo o lleva a la tarifa, categorías ?editar/?nueva, Usuarios edita especialidades
- test35: ventas: Solo protección (sin ventana) con su precio, monto del marco decorativo, a medida, y editar no pierde los montos
- test36: fotos chiquitas: listas con la chiquita, sin chiquita usa la grande, rota deja el ícono, subir guarda las 2 con caché de un año, el admin prepara las que faltan
- test33 (30 sep): entregas por lo que hizo con el anterior y sus pendientes, movimientos por semana, compra grande, solo el admin agrega materiales
- test37: Ayuda en la app: botón "Ayuda" con su palabra al lado de Actualizar, Cerrar o Mi cuenta (y flotante en fichas con X), solo lo de esa pantalla y según quién entró (admin, vendedora, quien confirma pagos, trabajador), formulario del catálogo con solo su tipo, atrás cierra solo la ayuda, sin internet con Reintentar, desde un formulario no se sale al manual, página "Manuales de uso" (ayuda.html) con los manuales de cada rol y estilos que no chocan con la app
- Manuales y ayuda: si cambia una pantalla, rehacer su captura (pruebas/manual/cap-*.js) y correr `python3 pruebas/manual/construir.py` desde la raíz del repo
- (30 sep, v66) test22: categoría de pago por producto (Puerta, Portón, Ventana, Combo), un renglón por trabajo, Masilla y pintura un solo monto, Aluminio por ventana, extra de protección en su recuadro (puerta y combo), no se mezcla lo escrito entre productos, producto bloqueado si ya la usan modelos · test24: "Asignar a modelos" solo con los de su producto · test17/test21: "Aluminio" en vez de "Armar"
- test38: el catálogo solo ofrece categorías del producto (y la quita al cambiar el tipo), "Lleva detalles" en ventana y "Las ventanas llevan detalles" en combo solo en el modelo, la masilla "se paga con la pintura", Usuarios: errores visibles debajo de cada campo y usuario sin acentos ni espacios (jesús pérez → jesusperez), especialidad Aluminio
