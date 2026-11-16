# Plan para seguir: lotes 6 y 7 del Taller y cierre (16 nov 2026, Claude de Gualfredo)

Si la sesión se corta, una sesión nueva sigue desde aquí. Primero lee `docs/tareas/2026-11-15-PROMPT-para-code.md` (reglas), la sección 3B de `docs/tareas/2026-11-15-gualfredo-taller-y-costeador.md` (K09 a K18) y las maquetas en `docs/tareas/maquetas-2026-11-15-taller-costeador/fuente/corte-final.html` (pantallas K09, K11 a K18).

- Rama: `claude/lote-1-taller-costeador-t49naw` (repo Herreria_Artesanos_v3). Commits con `Hecho-por: Gualfredo`, git `Gualfredo (Claude de Gualfredo)` / `gualfredo@artesanos.app`.
- Gualfredo aprobó todo lo que falta ("Dale lo que falta"): lote 6, K09 barra dañada, migración de seguridad v95 y lote 7. **El Costeador (lote 8) NO se empieza** hasta que Gualfredo diga que Ray dio el OK.
- No usar `apply_migration`, no unir el PR, no publicar. Migraciones solo probadas con `begin … rollback`. Sin `drop`.
- `?v=` hoy en **v83**: el lote 6 sube a **v84**, el lote 7 a **v85** (en todos los HTML).
- Servidor de pruebas: `python3 -m http.server 8765` en la raíz; pruebas desde `pruebas/` con `NODE_PATH=$(npm root -g) node testNN.js`.

## Ya hecho (en la rama)
- Lotes 1 a 5 completos (ver `docs/bitacora.md`).
- `supabase/migrations/20261116110000_v95_gualfredo_cerrar_funciones_internas.sql`: quita a la app el permiso de 12 funciones internas (probado con rollback: quedan cerradas y `compras_en_camino`, `costos_datos`, `finanzas_avisos` siguen bien). `_avisar_usuario` y `_a_produccion_si_pagada` quedan abiertas (las usan `cambiar_estado_venta` y `actualizar_venta`, que no son security definer).
- `supabase/migrations/20261116110100_v96_gualfredo_barra_danada.sql`: `corte_barra_danada(p_sab, p_tid, p_mid, p_barra, p_compra)`. Probada con rollback (taller, sin otra barra, compra nueva, suma a la compra, material que no está). Motivo del movimiento: `'ajuste'` (la tabla solo acepta compra, corte, conteo, ajuste, anulada).
- `assets/js/compra.js`: `abrirMaterial(items, sugeridos)` (lo que falta marcado; "Se va a quedar en 0 · toca para sumarlo"), `alPedir(fn)` (avisa la compra pedida con `{grupo, lugares}`), ¿Llegó? con **Todo · Una parte · Nada** por lugar (Nada reemplaza el botón "No llegó"); con una parte manda `quedan` a `compra_confirmar` (v94) y avisa "Falta …: sigue en camino". `test48` ya usa `[data-cp-llega="0:nada"]`.

## Lote 6: ✅ hecho (v84, test54). Lo de abajo queda como registro
(La ayuda del Corte no se agregó: el manual se deja en blanco por ahora.)
1. ✅ **Depósito sin Compras**: en `deposito.html` quitar el botón `data-tab="compras"`, el `#pieCompra` y el CSS de tres pestañas (volver a dos). En `deposito.js` el `?tab=compras` pasa a `fab`; si viene `&compra=ID`, abrir la factura (exportar `abrirFactura` en `window.DepNuevo`, cargando antes con `asegurar`). Ajustar `test43` (hoy abre la pestaña Compras y `#btnFoto`): probar la factura por `?tab=compras&compra=1` y quitar lo de Cargar compra. El link `deposito.html?tab=compras` de `corte.js:452` cambia a `taller.html?vista=corte`.
2. **Taller › Corte con dos vistas** (`taller-corte.js`): arriba un segmento **Por herrero · Material**. Por herrero es lo de hoy. Material lo pinta un archivo nuevo `assets/js/taller-material.js` (`window.TallerMaterial`), cargado en `taller.html` después de `compra.js` (agregar `<script src="assets/js/compra.js?v=84">` antes de `taller-corte.js`). Al recargar el Corte, recargar también `COMPRA.cargar()`.
3. **Material (K11)** en `taller-material.js`:
   - Arriba, cada compra en camino (de `COMPRA.datos().grupos[].lugares[]`) con borde ámbar: "En camino · proveedor", "N barras · $total · para herrero", botón **¿Llegó?** (`data-compra-llego=grupo`, lo maneja `compra.js`) y **⋯** (K15).
   - Tabla con un solo encabezado: Material · Hay · Apartado · Libre · Falta. Materiales activos de tipo hierro y láminas de `COSTEO.datos().fab`. Usa = barras del plan de este sábado + el próximo (`CORTE.setSab(s); CORTE.planSemana(s)`: `P.compras[].barras`, y para hojas `P.hj[].acom.length`). Apartado = mín(usa, stock). Libre = stock − apartado. Falta = máx(0, usa − stock − `COMPRA.enCamino(mid)`). Debajo del nombre: calibre, "barras" u "hojas", "· N en camino", "· quedas en 0". Retazos como fichas grises con borde (R-n · largo) y ✕ → `retazo_quitar(rid, motivo)` con confirmación. Volver a llamar `CORTE.setSab(sab)` del Corte al terminar.
   - Fila **Proveedores** (K18): le debes en total y compras en camino; abre su hoja.
   - Abajo: un solo **Comprar** (→ `COMPRA.abrirMaterial(falta, quedanEn0)`), **+ Retazo encontrado** (K17) y **Contar barras** (K16).
4. **Mensaje al proveedor (K13)**: hoja nueva. Se abre con `COMPRA.alPedir` y después de `corte_enviar` cuando devuelve `compra.grupo`. Opciones Lo busco / Me lo traen y Hoy / Mañana; mensaje editable; texto: "Buenos días, le escribe {primer nombre} de Herrería Artesanos. Para {hoy|mañana} necesito:\n• 1 tubo 3" x 1" calibre 0,90 (barra de 6 m)\n¿Me confirma precio y si lo tiene? {Lo paso buscando|¿Me lo puede mandar?} {en la mañana}. Gracias." Calibre: `fab.precios[prov].esp` sin " mm". Total estimado, WhatsApp del proveedor (`telefono` de `compras_en_camino`, v93), **Enviar por WhatsApp** (`https://wa.me/{tel}?text=`; sin teléfono, `https://wa.me/?text=`), Copiar mensaje, Ver la compra.
5. **Compra en camino ⋯ (K15)**: ¿Llegó? › · Cambiar la compra (cantidades y proveedor → `compra_pedida_cambiar(pid, {lineas, proveedor_id})`) · Volver a mandar el mensaje · Cancelar la compra (motivo → `compra_no_llego(pid, motivo)`). Nota: "Si la cancelas, lo que faltaba vuelve a salir en rojo en Material y en el corte de …".
6. **Contar barras (K16)**: por material "la app dice N" con − n +; resumen de diferencias; **Guardar conteo** → `conteo_guardar({conteo:[{material_id, contado}]})`.
7. **Retazo encontrado (K17)**: material (opciones tocables), largo en cm, aviso si es menor que `minRet` del material; **Guardar retazo** → `retazo_agregar(mid, p_largo, null)`. Texto "¿Un retazo ya no está? En Material toca la ✕ al lado del retazo."
8. **Proveedores (K18)**: le debes en total, en camino; cada uno con su saldo → `finanzas.html?prov=ID`; **+ Proveedor** (nombre, WhatsApp, qué vende) → `proveedor_guardar({nombre, telefono, tipos})`. Nota: "Toca uno para ver su estado de cuenta, pagarle o sacar el PDF. Sus precios se cambian en Costeador › Precios."
9. **Barra dañada (K09)** en `taller-corte.js`: en Más, "Reportar barra dañada" (solo si ya se envió). Hoja: ¿Qué material? (los de tipo barra de `enviados[tid].barras`), ¿Cuál barra? (Barra n · la del taller / la nueva, con sus piezas), ¿Con qué la reemplaza? Otra del taller (si el stock deja otra) / Se compra; nota de lo que pasa; **Reportar y reemplazar** → `corte_barra_danada`.
10. Hojas nuevas en `taller.html` (mismo patrón `sheet` + `sheet-scrim`, prefijo CSS `mt-`), ayuda en `assets/js/ayuda.js` para las hojas nuevas.
11. **Prueba nueva `pruebas/test54.js`** (con el arnés de `test53`): Material (tabla, retazo ✕, en camino), Comprar marcado y sugerido + mensaje, ¿Llegó? una parte manda `quedan`, ⋯ cambiar y cancelar, contar, retazo, proveedores, barra dañada, Depósito sin Compras. Correr también test42, test43, test48, test53, test44 (Bitral).
12. Subir `?v=84`, bitácora, `docs/modulos.md`, `docs/base-de-datos.md` (v95, v96), `docs/claude/documentos/lista-de-pruebas.md`, `pruebas/LEEME.md`, `supabase/migrations/LEEME.md`. Capturas iPhone 13 de las pantallas nuevas. Commit y push.

## Lote 7
- Vendedora en el Taller (maqueta T7): solo Pedidos (Todos · En proceso · Listos), sin montos ni Nómina ni Corte, puede Marcar entregada.
- Estados en todo el Taller: esqueletos al cargar, vacíos que dicen qué hacer, errores con `.toast` claro.
- Sello **ENTREGADO** en el PDF de la venta (§4, `ventas-comun.js`, jsPDF) cuando la venta está entregada (maqueta C5).
- `pruebas/test52.js` (sello y vendedora). `?v=85`, bitácora, lista de pruebas, capturas, commit y push.

## Cierre
1. Batería completa en dos mitades en segundo plano (test14 a test27 y test28 en adelante). `test26` puede fallar por tiempo: anotarlo.
2. Revisión propia (permisos, RLS, texto escapado, errores de red).
3. PR hacia `main` **sin unir**, título `[Gualfredo] Taller: Pedidos, Resumen, Nómina y Corte`, texto con "Hecho por: Gualfredo (Claude de Gualfredo)", lo que cambia, pruebas, migraciones v86 a v96 por aplicar (en orden y con Gualfredo presente) y qué probar en el teléfono.
4. Respuesta corta a Gualfredo: qué quedó, qué probar, que falta aplicar v86 a v96 y que el Costeador espera el OK de Ray.
