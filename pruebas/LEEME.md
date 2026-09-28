# Pruebas de la app (Playwright, iPhone 13)

Simulan Supabase con datos falsos: no tocan la base real y los PIN son de mentira.

1. En la carpeta del repo: `python3 -m http.server 8765`
2. En otra terminal, desde `pruebas/`: `mkdir -p shots4 && node test14.js` (y 15, 16, 17, 18, 19, 20)
3. Cada una termina con `TODO OK` o dice qué falló.

- test14: navegación (atrás, inicio, subpantallas)
- test15: nueva venta completa (cliente, catálogo, piezas, a medida, extras, pago)
- test16: listas de ventas y cotizaciones, ficha, PDF, convertir, pagos, estados
- test17: vendedora vs admin, confirmar pagos, página pública de seguimiento
- test18: a medida con tipo, exhibición con pago completo, comprobante obligatorio, edición, lista desde copia local, service worker
- test19: mensaje único al cliente (cotización, nota de pedido, avisar por WhatsApp), chip "Por avisar"
- test20: módulo Usuarios (solo admin) — crear cuenta, especialidad de trabajador, restablecer PIN, desactivar, eliminar, protección de la propia cuenta
- test21: Producción — lista, ficha por etapas, asignar trabajador, marcar terminado, Combo en paralelo
- test22: Categorías de pago (solo admin) — crear, editar, eliminar, fijo o por m²
- test23: Catálogo — categoría de pago en el formulario del modelo
- test24: Catálogo — elegir varios modelos y darles la misma categoría de pago
- test25: Producción — sin categoría no se asigna, "Asignar" a la derecha, fabricar para exhibición (tipo, modelo, especificaciones, categoría), cancelar orden, abrir desde aviso
- test26: Inicio del trabajador (empezar uno a la vez, terminar, pagos, vale) y avisos del admin (vales, sin asignar, sin categoría)
