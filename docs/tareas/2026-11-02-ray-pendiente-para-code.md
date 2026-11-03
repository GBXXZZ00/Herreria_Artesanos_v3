# Para Claude Code: lo que falta de la nueva gestión

Planificado por Ray con su Claude (chat) el 2 nov 2026, 21:20. **Ray ya aprobó todo lo de esta hoja: no hace falta pedir OK de nuevo**, solo el OK final antes de unir.
Rama: `gualfredo/nueva-gestion` (PR #2). Commits con la marca de Ray (ver `CLAUDE.md`, "Quién hizo qué").
Tarea original con el detalle técnico: `docs/tareas/2026-11-03-nueva-gestion.md`.

## Ya hecho (no repetir)
- **Limpieza de la base aplicada** (v72, versión `20261103010247`). Copia en `respaldos`, origen `gestion-hasta-2026-11-02` (9 hojas: 51 ventas, 83 productos, 75 pagos, 2 cambios, 267 pasos, 2 vales, 4 pagos de nómina, 5 entregas, 191 avisos). Todo eso quedó en 0. Clientes (40) se quedan. La próxima venta es la 1099.
- **Usuario vendedor "Prueba" desactivado** (`perfiles.activo = false`). No se borró porque `gestionar_usuarios` necesita la sesión de un admin; si se quiere borrar del todo, desde Usuarios en la app.
- **Maquetas aprobadas por Ray**: `docs/tareas/maquetas-2026-11-02/` (m1 a m5). El script que las genera está al lado (`maqueta.js`): sirve de guía para el CSS (`.av-pdf`, `.av-env`, `.av-desc`, `.av-pdf-ok`).

## Por hacer, en este orden

### 1. Botones de PDF siempre a la vista (aprobado tal como las maquetas)
Ficha de la venta, `assets/js/lista-ventas.js` (`avisarHtml`, `pintarPie`, acción `descargar`):
- Sección "Avisar al cliente": arriba, siempre, dos botones lado a lado: **Enviar PDF** (verde WhatsApp, como `.btn-wa`) y **Descargar PDF** (borde teal). En todos los estados menos cancelada. Mientras se prepara el PDF, los dos dicen "Preparando…" y están desactivados.
- Debajo, según el caso:
  - Venta sin PDF enviado: nota "Primero envíale el PDF: lleva su enlace de seguimiento." (m1)
  - PDF enviado: línea "✓ PDF enviado hoy 9:42 · Ray" (o "Cotización enviada…") (m2, m3, m4).
  - Android recién enviado: botón aparte **2. Enviar el mensaje** (m2). No reemplaza a "Enviar PDF".
  - Luego el paso guiado de hoy: "Avisar por WhatsApp" o "Cliente avisado ✓" (m3, m4).
- Quitar el botón "PDF" de "Más opciones" y su palabra en el subtítulo ("Editar, seguimiento, cancelar").

Hoja de venta lista, `assets/js/venta.js` (`mostrarListo`):
- **No quitar ningún botón.** Orden (m5): Enviar PDF al cliente · (solo Android, después de enviar) 2. Enviar el mensaje · Descargar PDF · Enviar mensaje con su seguimiento · Hacer otra venta · Volver a Inicio.
- "Enviar PDF al cliente" nunca cambia de texto ni desaparece.

### 2. PDF del cliente sin "por confirmar" (nuevo, pedido por Ray)
`assets/js/ventas-comun.js`, `crearPDF` (líneas ~241 y ~251):
- El pago pendiente sale como un pago normal: quitar el " (por confirmar)" del renglón.
- Quitar la nota "Hay un pago pendiente por confirmar…".
- Motivo: al cliente le incomoda. Dentro de la app (ficha) se sigue viendo "Por confirmar".
- Revisar si la página de seguimiento del cliente (`seguimiento.html`) también dice "por confirmar" y avisarle a Ray (no cambiarla sin preguntar).

### 3. Teléfonos de cualquier país (aprobado)
Tal como la sección 2 de la tarea original: pegar desde WhatsApp con cualquier código (+1, +34, +57, +58…). Venezuela se sigue guardando como `58…`. Los extranjeros se muestran `+<código> …` en ficha, venta y PDF. Texto debajo del campo: "Pégalo de WhatsApp. Si es de otro país, con su código (+1, +34…)".

### 4. Gualfredo confirma pagos (decidido por Ray: opción A)
- Darle a Gualfredo el mismo permiso que Ray: `perfiles.confirma_abonos = true` para el perfil de nombre "Gualfredo" (rol admin).
- Ray sabe que ese permiso también da: pagar la nómina, revisar entregas del Depósito y recibir el aviso de cada pago por confirmar. Está de acuerdo.
- Es un cambio de datos, no de reglas: hacerlo con una migración corta `vNN_ray_gualfredo_confirma_pagos` (update de una fila) para que quede registrado.
- Revisar que en la app no haya textos que digan "Espera que Ray confirme el pago" cuando quien confirma puede ser cualquiera de los dos (`lista-ventas.js`, `estadoBloque`). Si los hay, cambiar a "Espera que confirmen el pago".

### 5. Cierre
- Subir `?v=` a 72 en todos los HTML.
- Correr **todas** las pruebas de `pruebas/` (deben terminar en `TODO OK`). Ajustar test16 y test19 (botones de PDF después de enviar, en Android e iPhone) y agregar las de teléfonos y del PDF sin "por confirmar".
- Rehacer capturas del manual de Ventas y correr `python3 pruebas/manual/construir.py`.
- `docs/claude/documentos/lista-de-pruebas.md`: teléfono extranjero pegado de WhatsApp; Enviar y Descargar PDF en Samsung después de enviar; PDF sin "por confirmar"; Gualfredo confirma un pago; la app vacía con los clientes de antes.
- Entrada en `docs/bitacora.md` como "Claude de Ray".
- Mostrarle a Ray el resumen y, con su OK, unir el PR #2.

## Pendiente que no es código (lo hace Gualfredo en la app)
Usuario carpintero, categoría de pago de Madera y asignarla a los 6 modelos de madera (sección 4 de la tarea original).
