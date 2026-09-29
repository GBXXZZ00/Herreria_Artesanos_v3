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
- test21: Producción: vendedora solo mira (sin montos ni botones); lista, ficha por etapas, un solo botón "Asignar trabajadores" con "¿Para cuándo?" (este sábado o el próximo), sin "Marcar terminado" del admin, pasos atrasados, Combo en 3 bloques (puerta, 2 ventanas, 2 protecciones), foto en otro color, error del servidor y trabajador inactivo
- test22: Categorías de pago (solo admin) — crear, editar, eliminar, fijo o por m²
- test23: Catálogo — categoría de pago en el formulario del modelo
- test24: Categorías de pago — "Asignar a modelos": sin categoría primero, ver la de cada uno, no pisar sin confirmar; Catálogo sin "Elegir varios"
- test25: Producción: sin categoría no se asigna, quién lo hace a la derecha, fabricar para exhibición (tipo, modelo, especificaciones, categoría), cancelar orden, abrir desde aviso
- test26: Inicio del trabajador ("Ahora" con un solo botón, fila "Después" y "Ver todos", detalle con tabla de especificaciones, franja de color, foto en otro color y nota, fecha tope, una fila de pagos, por cobrar con vales en rojo, historial, vale) y pendientes del admin por color (vales a Nómina, atrasados, modelos sin foto en un color)
- test27: menú y perfil — sin señal no se esconde Producción ni se adivina el rol; reintentar
- test28: recorrido completo con varias personas (incluye Nómina: Ray paga y Jesús ve su recibo): Gualfredo crea el modelo, Yulimar lo vende, Ray confirma el pago (pasa solo a producción) y asigna todo de una vez, Jesús hace cada etapa desde "Ahora" con foto, cobra y pide vale, Ray lo aprueba en Nómina, el cliente ve su seguimiento con los pasos reales y las fotos del taller, y se entrega
- test29: Inicio de la vendedora: sus pendientes (pago no llegó, pedido listo, pago confirmado, cotización por vencer, pedido atrasado) solo de sus ventas
- test30: Nómina: quién la ve y quién paga (solo Ray), vale que pide el trabajador (solo Ray lo aprueba, ahí mismo), enlace nomina.html?t=ID, vale en bolívares, trabajos sin monto, lo del domingo para la próxima semana, montos que cambiaron, ficha de cada trabajo
