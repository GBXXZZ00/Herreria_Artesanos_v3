# Pruebas de la app (Playwright, iPhone 13)

Simulan Supabase con datos falsos: no tocan la base real y los PIN son de mentira.

1. En la carpeta del repo: `python3 -m http.server 8765`
2. En otra terminal, desde `pruebas/`: `mkdir -p shots4 && node test14.js` (y 15, 16, 17, 18)
3. Cada una termina con `TODO OK` o dice qué falló.

- test14: navegación (atrás, inicio, subpantallas)
- test15: nueva venta completa (cliente, catálogo, piezas, a medida, extras, pago)
- test16: listas de ventas y cotizaciones, ficha, PDF, convertir, pagos, estados
- test17: vendedora vs admin, confirmar pagos, página pública de seguimiento
- test18: a medida con tipo, exhibición con pago completo, comprobante obligatorio, edición, lista desde copia local, service worker
