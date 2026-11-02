# Memoria de la app (lo que se sabe de conversaciones anteriores)

Resumen escrito por el Claude de Gualfredo el 2 nov 2026, a partir de su memoria y de los documentos del proyecto. Si algo choca con `docs/claude/documentos/traspaso-chat.md` o con `traspaso-chat-novedades-v71.md`, mandan esos dos (son más precisos y más nuevos en lo técnico). Si choca con el código o la base, manda el código y la base.

## Historia corta
- La app vieja era AppSheet y luego una PWA con Google Apps Script + Google Sheets (repo GBXXZZ00/Artesanos-App). Era lenta y "mucha gestión y nada práctico".
- 27 sep 2026: se decidió rehacer todo desde cero en este repo (público, GitHub Pages) con Supabase. Se reusa la lógica del negocio (precios, pasos de producción, cálculo de nómina); todas las pantallas se rediseñan.
- Orden de construcción: Catálogo, Ventas, Notas/PDF, Producción, Seguimiento del cliente, Nómina. Cada módulo se construye y prueba antes del siguiente.
- 30 sep 2026: se borraron los datos de prueba (se quedaron catálogo, usuarios y sedes). Las ventas reales empiezan en el N° 1047.
- Última versión publicada: v71 (commit af8aa38, 7 oct 2026).

## El negocio
- Herrería Artesanos, Maracaibo. Dos sedes: Cumbres de Maracaibo y Avenida Universidad (Gualfredo la llama "Paraíso").
- Productos: Puerta Multilock, Portón, Ventana, Combo y Puerta de Madera. Combo = 1 puerta + 2 ventanas de aluminio + 2 protecciones de hierro.
- Aluminio de ventana: Panorámica (normal) o Ecobel (se cobra aparte; en combo +$80). Se elige en la venta, no en el modelo.
- Formas de pago: Binance, Zelle, Bolívares (a tasa Binance, no BCV) y Efectivo. Todo se lleva en dólares.
- El cliente paga 50% al inicio y 50% al entregar. Nunca se entrega debiendo.
- Los clientes siempre escriben primero por WhatsApp.
- Un producto va todo de un solo color (blanco o negro), incluidas las ventanas de un combo.

## Personas y roles
- Gualfredo: administrador. Lleva la madera (asigna, marca pasos y paga al carpintero).
- Ray: administrador y socio. Confirma pagos, asigna producción (hierro y aluminio), paga la nómina, aprueba vales y revisa entregas del depósito.
- Yulimar: vendedora y casi encargada de la tienda. Ve todas las ventas, crea modelos, cotiza, vende y registra pagos. No confirma pagos, no cancela, no asigna, no ve montos del taller.
- Viene otra vendedora: hay vendedora de hierro y de madera (`perfiles.linea`). Solo la de madera marca pasos de madera.
- Trabajadores (Jesús, Luis Paz y otros): entran con su usuario y PIN, ven solo lo suyo, hacen un trabajo a la vez y lo terminan con foto obligatoria.
- Carpintero: no tiene teléfono. Sus pasos los marca Gualfredo o la vendedora de madera, con foto.

## Reglas de producción y nómina
- Se paga a destajo por paso terminado. No hay "líder": solo los administradores asignan.
- Pasos: puertas y portones Hierro, Masilla y pintura, Detalles. Ventanas Aluminio, Instalar y Detalles si el modelo los lleva. Madera Estructura, Armado, Pintura, Ensamblado. Detalle completo en `documentos/reglas-produccion.md`.
- Masilla y pintura es un solo paso, una persona, una foto y un pago.
- Cantidad ×N en una venta = N trabajos aparte en producción.
- Instalar no se paga. La protección no lleva Detalles. Para instalar hace falta la protección lista y la ventana armada.
- Semana de trabajo: lunes a sábado. Se paga el sábado todo lo terminado hasta ese día; lo que no se terminó pasa a la otra semana. Los vales se piden antes del sábado y se descuentan ese sábado. Pueden darse en bolívares, pero la cuenta va en dólares.
- Madera: un monto por puerta. 50% al terminar Estructura, el resto al terminar Ensamblado.
- Cuando Ray confirma el pago, la venta pasa sola a fabricación. Cuando se termina el último paso, pasa sola a Lista. Una venta en fabricación no vuelve atrás. Solo un administrador cancela.
- Editar una venta en fabricación: se edita y se agrega, nunca se quita un producto. Un producto con pasos terminados no se cambia. Si se agrega algo, pide fecha y avisa "Producto nuevo por asignar".
- Las ventas nunca se borran: se cancelan. Los modelos del catálogo y las piezas de exhibición sí se pueden borrar con confirmación.

## Gustos de diseño y de trabajo
- Gualfredo trabaja desde el celular. Las maquetas y los PDF se muestran en el chat como imagen, no como enlace.
- Fondo blanco, acento teal del logo, solo modo claro. Menos texto y más fotos. Formularios por pasos, con los campos que dependen del tipo apareciendo debajo.
- Sin guion largo. Sin `<select>` nativos. Nunca dos botones con el mismo propósito.
- Antes de programar algo nuevo se explica la propuesta en palabras simples y se espera su OK ("dale pueees").
- Lotes pequeños. Los bugs vuelven cuando el lote es grande y no se prueba lo que ya funcionaba. Se prueba con recorridos completos de punta a punta, no por pantalla suelta.
- Formato de reporte de bugs: escenario, qué se hizo, qué se esperaba, qué pasó. ❌ roto, ⚠️ sospechoso, 💰 monto.
- Los PDF siguen el diseño del PDF de la venta (logo, título teal, bandas teal).

## Pendientes conocidos (al 7 oct 2026)
1. Gualfredo debe crear el usuario del carpintero, la categoría de pago "Madera" y marcar a la vendedora de madera.
2. Gualfredo debe probar v66 a v71 (`documentos/lista-de-pruebas.md`).
3. Llenar categorías de pago, medidas de ventanas de los combos y materiales del depósito; crear trabajadores de Hierro y de Masilla y pintura.
4. Decidir: "papel ahumado" en vez de "vidrio" en todas las pantallas; qué hacer si a un producto en el taller le agregan protección o cantidad; resumen de la mañana; dominio propio; reglas del depósito.
5. Revisar funciones expuestas a `anon` o `authenticated` que no deberían (ver `docs/base-de-datos.md`, sección Pendientes).
6. Bug sin reproducir en Categorías de pago ("se queda marcado el último monto"). Usuarios carga lento.
7. Resumen del taller en PDF (maqueta v6) y módulo de Finanzas, que se replantea desde cero. Esto pasa a manos de Ray (ver `documentos/finanzas-y-resumen-pdf.md`).

## Ideas guardadas para más adelante
- Etiqueta imprimible por producto con sus medidas, color y extras para el taller.
- Catálogo público con estilo de app de menú (tarjetas con foto grande, precio grande, chips de categoría).
- Postular la app al programa Claude for Startups como producto para otras herrerías.
