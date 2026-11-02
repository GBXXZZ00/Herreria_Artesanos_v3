# Traspaso: cómo seguimos la App Artesanos (leer antes de hacer nada)

Actualizado: 6 oct 2026. Último commit publicado: 5aa5a65 (versión de archivos ?v=70). Anteriores: v68 (edición en fabricación y "ya está hecho"), 8b023e5 (v67), ae50240 (v66). El estado visible `en_produccion` se llama "En fabricación"; el módulo sigue siendo "Producción". Las reglas de producción acordadas están en "claude/reglas-produccion.md".

## LO SIGUIENTE (leer primero)
1. **Falta una aprobación de Gualfredo en Supabase** (el conector pide confirmar porque la función borra filas; se canceló 5 veces porque él no estaba mirando). Sin ella, en una venta en fabricación NO se puede quitar un producto ni cambiarle la estructura (sí agregar, editar cliente y cambiar datos simples). Con él presente, aplicar la migración `v68c_quitar_producto_de_venta`:
```sql
create or replace function public._item_pasos_reiniciar(iid bigint) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if exists (select 1 from etapas where venta_item_id = iid and estado = 'hecha') then raise exception 'Este producto ya tiene pasos terminados'; end if;
  delete from etapas where venta_item_id = iid;
end $function$;
create or replace function public._item_quitar(iid bigint) returns void language plpgsql security definer set search_path to 'public' as $function$
begin perform _item_pasos_reiniciar(iid); delete from venta_items where id = iid; end $function$;
revoke execute on function public._item_pasos_reiniciar(bigint) from public, anon, authenticated;
revoke execute on function public._item_quitar(bigint) from public, anon, authenticated;
```
   `editar_venta_fabricacion` ya las llama. Después probar con rollback: quitar un producto sin pasos hechos y cambiarle el tipo.
2. Gualfredo debe: crear el usuario del carpintero (Trabajador, especialidad Carpintero), crear la categoría de pago "Madera" y asignarla a los modelos de madera, y marcar a la vendedora de madera en Usuarios.
3. Finanzas y el Resumen del taller en PDF siguen en pausa: todo en **claude/finanzas-y-resumen-pdf.md** (maqueta vigente: claude/maqueta-resumen-v6.html).

## Lote 6 oct (v68 a v70)
- **"Ya está hecho, solo se entrega"** (a medida): `venta_items.ya_hecho`. No crea pasos; cuenta como entrega inmediata (todas las funciones usan `pieza_id is null and not ya_hecho`). Admin y vendedora.
- **Editar venta en fabricación**: rpc `editar_venta_fabricacion(vid, p)` (items con `id`, `tocado`, `ya_hecho`; devuelve {id, estado, total, cambios, nuevos}). Admin y vendedora (si es vendedora, aviso al admin). Un producto con pasos terminados queda bloqueado (venta.js `it.bloqueado`, con `avance_venta`). Agregar siempre se puede: pregunta por la fecha de entrega, `venta_items.agregado_en`, aviso y marca "Producto nuevo por asignar" en Producción. Historial en `venta_cambios` (acordeón "Cambios en el pedido" en la ficha). Si el total queda menor a lo pagado no deja guardar. Bypass del guard con `app.edicion_fab`.
- **Detalle del trabajador en dos cuadros** (mi-trabajo.js `gemelos`, `gemelosHtml`; estilos `.tj-gem*` en index.html): combo (La puerta / Las protecciones), puerta con protección (La puerta / La protección), combo detalles con ventanas (La puerta / Las ventanas). Un solo trabajo, una foto, un pago. El trabajo ya terminado sigue con el detalle viejo.
- **Pieza de entrega inmediata corregida**: trigger `pieza_corregida` en `disponibles` → `_pieza_corregida()` actualiza especificaciones, color y foto en las ventas no entregadas ni canceladas (no toca precio). Limitación: una pieza agotada ya no sale en el catálogo para editarla.
- **Madera** (migración v70): pasos Estructura, Armado, Pintura, Ensamblado (especialidad carpintero, oficio 'madera'). `perfiles.lleva_madera` (true para Gualfredo) y `perfiles.linea` ('hierro'|'madera', rpc `usuario_linea(uid, p_linea)`). `_lleva_madera()` asigna (Ray ve, no asigna); `_puede_madera()` = quien la lleva o vendedora de madera: marca cada paso con `terminar_etapa_madera(eid, foto_url)` (foto obligatoria en etapas-fotos subida por quien llama; al terminar el último pasa a Lista). Pago: tarifa `madera` fija por puerta, mitad al terminar Estructura y el resto al terminar Ensamblado (pasos del medio 0: "Va en el pago de la puerta", `AH.notaPago(oficio, monto)`). `_puede_pagar_a(tid)`: al carpintero le paga quien lleva la madera; al resto Ray. Categoría de pago con producto 'Puerta de Madera' ("Madera" en pantalla, un solo renglón sin m²); la madera YA NO usa categorías de Puerta. Frontend: produccion.js (`llevaMadera`, `puedeMadera`, hoja `sheetMadera`), usuarios.js (`optsLinea`), categorias-pago.js.
- Pendiente menor de la revisión: abrir un producto y dar "Listo" sin cambiar nada lo marca `tocado`; "Marco decorativo: No" sale siempre en el detalle del trabajador.

## Pago por producto (30 sep, v66)
- `categorias_pago.producto` ('Puerta Multilock','Portón','Ventana','Combo','Puerta de Madera'). `_categoria_sirve(cid, tipo)` se valida en `_catalogo_categoria_guard`, `_item_categoria`, `asignar_categoria_modelos`, `_catalogo_categoria_propagar` y `_categoria_producto_guard`. JS: `AH.PRODUCTOS_PAGO`, `AH.nombreProducto`, `AH.categoriaSirve`, `AH.notaPago`.
- Tarifas (claves): hierro, masilla_pintura, detalles, armar (= Aluminio, por ventana), detalles_ventana (combo), madera; extra de protección en hierro.prot_* y masilla_pintura.prot_* (puerta y combo). `_monto_etapa`: instalar = 0; combo armar = 2 × tarifa; combo detalles = puerta + 2 × detalles_ventana si `ventanas_detalles`.
- Catálogo: extras `soloModelo`: Ventana `lleva_detalles`, Combo `ventanas_detalles`; `_item_fijos` los copia al producto vendido. La especialidad 'ventanero' se muestra "Aluminio".

## Unidades y Masilla y pintura (1 oct, v67)
- `etapas.unidad`: una venta con cantidad N crea N juegos de pasos. `_etapa_espera` y "Ya te toca" solo miran la misma unidad. `_monto_etapa` no multiplica por la cantidad. produccion.js arma un bloque por unidad (clave "item-unidad"). seguimiento_publico junta las unidades.
- Masilla y pintura: un solo paso (oficio y especialidad 'masilla_pintura'). Orden: Hierro 1, Masilla y pintura 2, Detalles 3.

## Stack real (manda sobre cualquier instrucción vieja)
- Frontend: HTML + CSS + JS vainilla, PWA en GitHub Pages: https://gbxxzz00.github.io/Herreria_Artesanos_v3/ (repo GBXXZZ00/Herreria_Artesanos_v3, rama main). Para hacer push hay que agregar el repo a la sesión (add_repo con acceso push).
- Backend: **Supabase** (NO Apps Script, NO Google Sheets). Proyecto `vmrxfpgotbmmjxzizsuq`. Cliente en JS = `window.db`. Cambios de BD con el conector de Supabase. **El conector pide confirmación a Gualfredo para lo destructivo (delete, drop, revoke): si devuelve "cancelled" no insistir ni esquivarlo; evitar drop con bloques DO "if not exists" y dejar lo que borre para cuando él esté presente.** Para parchear funciones: DO + pg_get_functiondef + replace + execute.
- Seguridad BD: RLS activo. Reglas importantes en RPCs (security definer con chequeo de auth.uid() y rol). Ayudantes `_es_admin()`, `_es_deposito()` (admin o vendedor activo), `_es_ray()` (confirma_abonos), `_lleva_madera()`, `_puede_madera()`. Un trabajador no puede escribir en ventas/venta_items/clientes/abonos/catalogo/disponibles (trigger `_bloquear_trabajador`, salvo `app.paso_confiable`).
- **Etapas: nadie las escribe directo**. Solo por `asignar_etapa(s)`, `empezar_etapa`, `ordenar_mis_trabajos`, `marcar_etapa_terminada` y `terminar_etapa_madera`.
- Protecciones de nómina (triggers): `etapa_protegida`, `vale_protegido`, `pago_protegido`.
- Notificaciones: Web Push. Edge function `notificar`. `sw.js` guarda en caché /assets/ con ?v= (SIEMPRE subir ?v= al cambiar css/js).
- Storage: `catalogo-fotos` y `etapas-fotos` públicos. `comprobantes` privado.
- **Fotos chiquitas (v61)**: en listas usar SIEMPRE `AH.imgMini(url, alt, tipo)`; subir SIEMPRE con `AH.subirFoto(bucket, path, blob)` (necesita img-compress.js en la página).
- Especificaciones de producto: motor en `assets/js/specs-producto.js`. `AH.resumenSpecs` para chips. Trigger `item_fijos` y `_item_categoria` al insertar un venta_item; lo ya guardado se conserva (`app.items_previos`).

## Cómo trabaja Gualfredo (obligatorio)
1. Antes de ejecutar algo nuevo: explicar la propuesta en palabras simples (con maqueta en imagen si es pantalla nueva) y esperar su OK. Si ya aprobó un lote, ejecutarlo completo sin volver a preguntar.
2. Cambios pequeños y cuidadosos. Cero bugs. Le gusta el flujo completo de punta a punta.
3. Todo en español, textos cortos y sencillos. Estética simple, fondo claro, acento teal. Sin guion largo. Nada de `<select>` nativos. No dos botones con el mismo propósito.
4. **Modo "equilibrado" (acordado el 6 oct para ahorrar)**: todas las pruebas automáticas, pruebas nuevas para lo nuevo, prueba en la base real con rollback (raise al final y luego setval de secuencias), UNA revisión independiente al final del lote o corrida, capturas iPhone solo de pantallas nuevas, y mensajes cortos que expliquen lo necesario.
5. Al terminar: corregir lo de la revisión, subir `?v=N`, commit + push a main, actualizar la ayuda (captura + construir.py) y agregar a "claude/lista-de-pruebas.md" lo que él debe probar.
6. Respuestas finales cortas: qué quedó, qué debe probar él, qué queda pendiente.
7. **Maquetas: EN EL CHAT como imágenes**, no como enlace: él está en el celular.

## Cómo probar
- `python3 -m http.server 8765` en el repo (arrancarlo con `setsid nohup ... &`) y, DESDE `pruebas/`, `NODE_PATH=$(npm root -g) node testNN.js` (test14 a test40, Playwright, iPhone 13, Supabase simulado; capturas en pruebas/shots4, 5 y 6, ignoradas). Lista en `pruebas/LEEME.md`. La suite completa tarda unos 12 min: correrla en dos tandas en primer plano. No usar `pkill` en el mismo comando que otra cosa (mata el shell).
- test16 ventas y edición en fabricación, test21 Producción, test22 categorías, test26 trabajador (incluye los dos cuadros), test28 recorrido completo, test30 Nómina, test33 Depósito, test37 Ayuda, test38 categorías por producto, test39 unidades, test40 madera.
- Usuarios: Gualfredo (admin, lleva la madera), Ray (admin, confirma pagos, paga nómina, aprueba vales y entregas), Yulimar (vendedora), Jesus y Luis Paz (trabajadores).

## Ayuda en la app y manuales
- Botón "Ayuda" por pantalla: assets/js/ayuda.js (tabla PAGINAS), assets/css/ayuda.css (prefijo "ay-"), contenido en assets/ayuda/<mod>.html e imágenes en assets/ayuda/img.
- **Regla: si cambia una pantalla, rehacer su captura y correr `python3 pruebas/manual/construir.py` desde la raíz; si cambian ids de hojas/botones, actualizar PAGINAS.** Fuentes en pruebas/manual/fuente. Capturas: desde pruebas/manual, `node cap-X.js` (catalogo, venta, ventas, prod, deposito, nomina, usuarios, categorias, taller). categorias y taller se regeneran antes con `python3 manual/adaptar.py test22.js manual/cap-categorias.js shots-categorias manual/map-categorias.json` (taller: test26, y luego cambiar en cap-taller.js la ruta de la foto a `__dirname+'/../foto-puerta.png'`). Las capturas nuevas del 6 oct (madera, dos cuadros, editar en fabricación, ya está hecho, línea de vendedora) se copiaron de pruebas/shots6 a las carpetas shots-* del manual.
- Los manuales del proyecto (claude/manual/*.html) son la versión del 30 sep, sin lo del 6 oct; la versión al día es la ayuda dentro de la app.

## Base y datos
- Base limpia desde el 30 sep; la primera venta real es la N° 1047. Respaldo en la tabla `respaldos`.
- Cosas raras del catálogo para avisarle a Gualfredo: modelo "Uu" (ventana, parece de prueba); "Combo" (id 43) registrado como Puerta Multilock; "Puerta Proteccion" (id 28) registrada como Combo; combos sin medidas de ventanas; varias puertas sin especificaciones.

## Reglas de flujo que siguen vigentes
- Venta "Confirmada" con pago "por confirmar". Cuando Ray confirma el pago pasa sola a fabricación y se crean sus pasos. Al terminar el último pasa sola a Lista. Solo un admin cancela.
- Cotización | Venta (v52): la cotización no pide detalles para fabricar; la venta los exige (`AH.faltanDetalles`, `_detalles_faltan`, `_venta_detalles_ok`, `completar_detalles`). El aluminio de la ventana siempre se elige.
- Depósito (v53 a v60): tablas materiales, deposito_compras, deposito_entregas, deposito_facturas; todo por RPC (`deposito_resumen`, `deposito_entregar`, `deposito_revisar` solo Ray, `deposito_comprar(_varios)` solo admin). Solo admin agrega materiales.
- Ventas (v60): Ventana con protección: Panorámica / Ecobel / "Solo protección" (pide `monto_proteccion_sola`). Marco decorativo que el modelo no trae pide `monto_marco`.
- Producción por oficio (v51): `etapas.oficio`, `incluye`, `despues_de`; `_etapa_espera(eid)`. Combo en 3 bloques. Asignar: una fila por rol.
- Trabajador (v48): uno solo en proceso (`iniciada_en`), foto obligatoria validada en el servidor.
- Vendedora: ve todas las ventas, crea y edita modelos, cotiza, vende, edita (también en fabricación, con aviso al admin), registra pagos, marca Entregada, entrega materiales. NO confirma pagos, NO cancela, NO asigna, NO ve montos ni nómina. La de madera además marca los pasos de madera.

## Pendiente
1. Aprobar la migración v68c (arriba) y los 3 pasos de Gualfredo para madera.
2. Gualfredo prueba v66 a v70 (lista de pruebas).
3. Llenar categorías de pago, medidas de ventanas de los combos, materiales del depósito y su compra inicial; crear trabajadores de Hierro y Masilla y pintura.
4. Depósito, por decidir: si una entrega espera que Ray apruebe; si Ray aprueba las suyas; cómo cuenta un producto ×5.
5. Por decidir: resumen de la mañana, dominio propio. Revisar helpers expuestos (`_avisar_usuario`, `_generar_etapas`, `_a_produccion_si_pagada`).
6. Bug sin reproducir: Categorías de pago "se queda marcado el último monto". Usuarios carga lento.
7. Después: Resumen del taller en PDF (maqueta v6) y Finanzas (replantear desde cero con él).
