# Tarea: nueva gestión desde el 3 nov 2026

Pedido por Gualfredo el 2 nov 2026, 20:44. Lo ejecuta el **Claude de Ray** (Gualfredo se quedó sin tokens). Rama: `gualfredo/nueva-gestion` (los commits de Ray llevan su marca). Al terminar: un PR, pruebas en verde, bitácora y unir.

Hay que hacerlo **hoy en la noche o antes de que abran mañana**: desde mañana se crean pedidos y se asignan trabajos.

## 1. Guardar copia y limpiar (base de datos)
**Decidido por Gualfredo:** guardar copia y limpiar. Los clientes se quedan. Nómina y vales también se borran. La numeración "como quieras": sigue en 1099, no se reinicia (los clientes ya tienen PDF con 1047 a 1098).

Estado al 2 nov, 20:40: 56 ventas (1047 a 1098), 75 pagos (9 por confirmar) y 15 devoluciones por confirmar, 267 pasos del taller (27 asignados sin terminar), 2 vales, 4 pagos de nómina, 5 entregas del depósito y 191 avisos.

SQL listo y sin aplicar: `supabase/migrations/PENDIENTE_v72_gualfredo_nueva_gestion_respaldo_y_limpieza.sql`. Respalda todo en `respaldos` (origen `gestion-hasta-2026-11-02`), borra y verifica.

Pasos:
1. Revisa el SQL. Confirma que no hay otra tabla que apunte a `ventas` o `venta_items` (`select conrelid::regclass from pg_constraint where confrelid in ('ventas'::regclass,'venta_items'::regclass)`).
2. **Ensayo sin borrar nada**: corre el SQL con `execute_sql`, terminando con `raise exception 'ENSAYO OK'` para que todo se deshaga. Debe llegar hasta ese mensaje.
3. Muéstrale a Ray (o a Gualfredo) el resumen y pide el OK. El conector de Supabase va a pedir confirmación porque borra: si sale "cancelled", no se insiste.
4. Aplica con `apply_migration`, nombre `v72_gualfredo_nueva_gestion_respaldo_y_limpieza`, y renombra el archivo con su versión real.
5. Revisa después: ventas, etapas, vales, pagos, abonos y notificaciones en 0, y 9 hojas en `respaldos`.

Decidido: las 2 piezas de entrega inmediata en "vendido" se quedan como vendidas (ya se entregaron).

6. **Quitar el usuario vendedor "Prueba"** (decidido por Gualfredo): después de la limpieza, elimínalo desde Usuarios (edge function `gestionar_usuarios`). Si no deja, desactívalo (`perfiles.activo = false`).

## 2. Teléfonos internacionales (código)
Hoy el formulario solo acepta números de Venezuela. La base ya acepta cualquiera de 10 o más dígitos (`_cliente_guardar`).

- `assets/js/venta.js`, cerca de la línea 46, `normTel` y `telValido`: aceptar lo que se pega desde WhatsApp ("+1 (305) 555-1234", "+34 612 34 56 78", "+58 414-1234567", "0414 1234567", "00 1 305…"). Limpiar todo menos dígitos; quitar `00` del inicio; `0` + 10 dígitos o `4` + 9 dígitos = Venezuela (58…); si no, se guarda tal cual con su código de país. Válido: 58 + 10 dígitos, o cualquier otro de 11 a 15 dígitos.
- Mostrar el teléfono guardado: hoy se pinta como `'0' + quitar 58` (líneas 453 y 947 de venta.js). Si no empieza por 58, mostrarlo como `+<código> ...`.
- `assets/js/ventas-comun.js`: `telBuscar` y `telBonito` (línea ~289) y el teléfono del PDF (línea ~179) deben verse bien con números extranjeros. `wa.me/<dígitos>` ya sirve para cualquier país.
- `assets/js/lista-ventas.js` (línea ~296): igual en la ficha.
- Base: `normalizar_telefono` (quitar `00` del inicio). Si se cambia, migración `v72b_..._telefono_internacional`.
- Texto debajo del campo: "Pégalo de WhatsApp. Si es de otro país, con su código (+1, +34…)". El error, debajo del campo.
- Prueba nueva o en test15: pegar "+1 (305) 555-1234" guarda `13055551234` y el PDF y WhatsApp lo usan bien; "0414-123.45.67" sigue guardando `584141234567`.

## 3. Botones de PDF siempre a la vista (código)
Problema (Ray usa Samsung): después de enviar la nota, el botón "Enviar nota de pedido" desaparece y cambia por "Avisar por WhatsApp". En Android además se convierte en "2. Enviar el mensaje", y "Descargar" queda escondido en "Más opciones".

- **Antes de programar**: haz la maqueta (mockup) en tamaño iPhone de cómo queda la ficha de la venta (sección "Avisar al cliente" con los dos botones y el paso guiado debajo, en cotización, confirmada y después de enviada) y de la pantalla de venta lista. Muéstrala en el chat **como imagen** (captura PNG con Playwright, no enlace) y espera el OK.
- `assets/js/lista-ventas.js`, `avisarHtml` (línea ~494) y `pintarPie` (línea ~370): en la sección "Avisar al cliente" de la ficha, siempre dos botones fijos, uno al lado del otro: **"Enviar PDF"** (comparte con `AV.compartirPDF`) y **"Descargar PDF"** (`AV.descargarPDF`). No desaparecen en ningún estado salvo cancelada. Mientras se prepara el PDF dicen "Preparando…". Debajo sigue el paso guiado de hoy (mensaje, cliente avisado). En Android, el "2. Enviar el mensaje" sale como un botón aparte y no reemplaza a "Enviar PDF".
- Quitar el "PDF" repetido de "Más opciones" (regla: no dos botones con el mismo propósito).
- `assets/js/venta.js`, pantalla de venta lista (línea ~854), la hoja que sale al terminar una venta: **no quitar ningún botón** (Enviar PDF al cliente, Enviar mensaje con su seguimiento, Hacer otra venta, Volver a Inicio). Solo agregar "Descargar PDF" y que "Enviar PDF al cliente" no desaparezca nunca: en Android el "2. Enviar el mensaje" va como botón aparte, no reemplaza al de enviar.
- Ajustar test16 y test19 (o prueba nueva) para Android y iPhone: los dos botones siguen ahí después de enviar.
- Rehacer capturas del manual de Ventas (`cap-ventas.js`) y correr `python3 pruebas/manual/construir.py`.

## 4. Madera (no es código, lo hace Gualfredo en la app)
- Crear el usuario carpintero (Trabajador, especialidad Carpintero).
- Crear la categoría de pago de Madera con su monto por puerta.
- Asignarla a los 6 modelos de madera: Vinil Negra, Americana, Vinil Gris, Vinil Negro Mate, Vinil Beige y Vinil Negra Rayas.
- Si ya hay vendedora de madera, marcarla en Usuarios como "Madera".

## Cierre
- Subir `?v=` a 72 en todos los HTML (cambian js).
- Correr toda la suite de `pruebas/`.
- Agregar a `docs/claude/documentos/lista-de-pruebas.md`: teléfono extranjero pegado de WhatsApp; Enviar y Descargar PDF en Samsung después de enviar; la app vacía con los clientes de antes.
- Entrada en `docs/bitacora.md`.
