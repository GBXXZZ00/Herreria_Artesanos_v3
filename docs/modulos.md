# Módulos y pantallas

Estado al 2 nov 2026 (v71). Cada pantalla es un `.html` en la raíz que carga sus `.js` de `assets/js/`. Todas cargan primero `supabase-client.js` (crea `window.db`) y `comun.js` (`window.AH`, piezas compartidas).

Roles: **admin** (Gualfredo y Ray), **vendedor** (Yulimar; línea hierro o madera), **trabajador**, **cliente** (sin sesión). Ray y Gualfredo tienen `confirma_abonos = true` desde v72 (en las reglas `_es_ray()` = quien confirma pagos: también paga la nómina y revisa entregas del Depósito). Gualfredo tiene `lleva_madera = true`.

Reglas generales de las pantallas en `CLAUDE.md`. Detalle de tablas y funciones en `docs/base-de-datos.md`.

## Piezas compartidas
| Archivo | Para qué |
|---|---|
| `supabase-client.js` | Crea `window.db`. Única parte donde está la URL y la clave publicable. |
| `comun.js` | `window.AH`: tipos de producto, especificaciones, formatos de dinero, hojas inferiores, toasts, `AH.imgMini`, `AH.subirFoto`, `AH.resumenSpecs`, `AH.PRODUCTOS_PAGO`, `AH.notaPago`. RPC `fotos_sin_mini`. |
| `sesion.js` | Entrar con usuario y PIN, sesión guardada, menú de abajo. Esconde Producción a quien no es admin ni vendedor. Lee `perfiles`. |
| `avisos.js` | Web Push: suscribir el teléfono (`push_suscripciones`). En iPhone solo con la app abierta desde el ícono. |
| `ayuda.js` + `assets/css/ayuda.css` + `assets/ayuda/` | Botón "Ayuda" en cada pantalla con su parte del manual según el rol. Tabla `PAGINAS`. |
| `img-compress.js` | Comprime fotos en el teléfono antes de subirlas. |
| `specs-producto.js` | Formulario de especificaciones y precio sugerido. Lo usan Nueva venta y "Fabricar para exhibición". RPC `catalogo_medidas_ventanas`. |
| `ventas-comun.js` | `window.AV`: estados, cálculos, cargar una venta, PDF con jsPDF y compartir. |
| `sw.js` | Service worker: caché de `/assets/` por `?v=` y notificaciones push. |

## Inicio (`index.html` + `mi-trabajo.js`)
- **Para qué:** pantalla principal. Admin y vendedora ven sus pendientes en colores (pagos por confirmar, sin asignar, atrasados, vales, cotizaciones por vencer, modelos sin foto o sin categoría, combos sin medidas, depósito) con atajo a cada cosa. El trabajador ve su propio inicio: "¿Con cuál empiezas?", "Estás haciendo", "Ordena el trabajo", "Pagos y vales".
- **Roles:** todos (cada uno ve lo suyo).
- **Datos:** tablas `abonos`, `catalogo`, `categorias_pago`, `deposito_entregas`, `disponibles`, `materiales`, `perfiles`, `venta_items`, `ventas`, `vales`. RPC `produccion_lectura`, `nomina_semana`, `aviso_prueba`; trabajador: `mis_trabajos`, `mis_pagos`, `empezar_etapa`, `ordenar_mis_trabajos`, `marcar_etapa_terminada`, `pedir_vale`.
- **Reglas:** el trabajador tiene un solo trabajo en proceso; termina con foto obligatoria (se valida en el servidor). En combos el detalle va en dos cuadros (La puerta / Las protecciones o Las ventanas), un solo trabajo y un pago.
- **Pendiente:** la lista del trabajador dice "2 Ventanas" en el aluminio de un combo; "Marco decorativo: No" sale siempre.

## Catálogo (`catalogo.html` + `catalogo.js`)
- **Para qué:** modelos por tipo (Puerta Multilock, Portón, Ventana, Combo, Puerta de Madera) con fotos por color, especificaciones base, precio base y categoría de pago. "Disponibles": piezas de entrega inmediata por sede.
- **Roles:** admin y vendedora crean y editan. La categoría de pago solo la ve el admin.
- **Datos:** `catalogo`, `disponibles`, `sedes`, `categorias_pago`. Fotos en el bucket `catalogo-fotos`.
- **Reglas:** cada modelo solo acepta categorías de su producto (`_catalogo_categoria_guard`). Ventana: la protección y "Lleva detalles" los define el modelo. Combo: medidas fijas y "Las ventanas llevan detalles". Corregir una pieza de entrega inmediata actualiza las ventas no entregadas (`pieza_corregida`, sin tocar el precio).
- **Pendiente:** modelos raros ("Uu", "Combo" id 43 como Puerta, "Puerta Proteccion" id 28 como Combo), combos sin medidas, puertas sin especificaciones. Una pieza agotada no se puede editar desde el catálogo.

## Catálogo público (`catalogo-publico.html`)
- **Para qué:** catálogo para clientes, sin sesión. Letra grande, botón de WhatsApp. Muestra "Por encargo" en lugar de Agotado.
- **Roles:** cualquiera.
- **Datos:** lectura pública de `catalogo`, `disponibles`, `sedes`.

## Nueva venta (`venta.html` + `venta.js`)
- **Para qué:** crear o editar una cotización o venta: cliente (cédula primero), productos del catálogo, de entrega inmediata o a medida, extras, descuento, instalación o traslado, sede, pago con comprobante.
- **Roles:** admin y vendedora.
- **Datos:** `clientes`, `catalogo`, `disponibles`, `sedes`; bucket `comprobantes`. RPC `crear_venta`, `actualizar_venta`, `editar_venta_fabricacion`, `avance_venta`, `marcar_paso`.
- **Reglas:** arriba Cotización o Venta. La cotización vale 20 días y no pide detalles de fabricación; la venta los exige (hacia dónde abre, bloque, vidrio, ahumado). Se sugiere 50% de pago; menos avisa pero deja seguir. Manillón +$20. Combo Ecobel +$80. "Solo protección" pide su monto. Marco decorativo que el modelo no trae pide monto. "Ya está hecho, solo se entrega" (a medida) no va al taller. En fabricación: se edita y se agrega, no se quita; producto con pasos terminados bloqueado; el total no puede quedar por debajo de lo pagado; si edita la vendedora, aviso al admin.
- **Pendiente:** dar "Listo" sin cambiar nada marca el producto como tocado.

## Cotizaciones y Ventas (`cotizaciones.html`, `ventas.html` + `lista-ventas.js`)
- **Para qué:** listas con filtros y la ficha de cada una: convertir en venta, registrar pagos, confirmar pagos, cambiar estado, cancelar con devolución, "Enviar PDF" y "Descargar PDF" siempre arriba en "Avisar al cliente", mensaje al cliente por WhatsApp con el enlace de seguimiento, avance de fabricación, "Cambios en el pedido".
- **Roles:** admin y vendedora. Confirmar pagos solo Ray. Cancelar solo admin.
- **Datos:** `ventas`, `venta_items`, `abonos`, `venta_cambios`; bucket `comprobantes`. RPC `convertir_en_venta`, `completar_detalles`, `registrar_abono`, `confirmar_abono`, `cambiar_estado_venta`, `cancelar_venta`, `marcar_paso`, `avance_venta`.
- **Reglas:** estados Cotización, Confirmada, En fabricación (`en_produccion`), Lista, Entregada, Cancelada. Al confirmar Ray el pago pasa sola a fabricación y se crean los pasos. Al terminar el último paso pasa sola a Lista. No se entrega debiendo.

## Producción (`produccion.html` + `produccion.js`)
- **Para qué:** pedidos en fabricación y órdenes para exhibición, por producto y por unidad ("1 de 2"), con sus pasos, quién los hace y para qué sábado. "Asignar trabajadores" (una fila por rol, este sábado o el próximo). "Fabricar para exhibición".
- **Roles:** admin asigna (Ray hierro y aluminio; la madera solo Gualfredo). Vendedora solo mira, sin montos. Gualfredo y la vendedora de madera marcan los pasos de madera con foto.
- **Datos:** `ventas`, `catalogo`, `categorias_pago`, `perfiles`, `sedes`. RPC `produccion_lectura`, `asignar_etapas`, `asignar_categoria_item`, `crear_orden_exhibicion`, `cancelar_orden_exhibicion`, `terminar_etapa_madera`.
- **Reglas:** sin categoría de pago no se asigna. Nadie escribe `etapas` directo, solo por funciones. Pasos por producto en `docs/claude/documentos/reglas-produccion.md`.

## Categorías de pago (`categorias-pago.html` + `categorias-pago.js`)
- **Para qué:** cuánto se le paga al taller por cada trabajo de un producto, fijo o por m², y a qué modelos se aplica.
- **Roles:** solo admin.
- **Datos:** `categorias_pago`, `catalogo`. RPC `asignar_categoria_modelos`.
- **Reglas:** una categoría es de un solo producto (Puerta, Portón, Ventana, Combo, Madera) y solo muestra sus trabajos. Masilla y pintura un solo monto. Aluminio por ventana. Extra de protección aparte. Madera un monto por puerta. Cambiar una tarifa recalcula los pasos no pagados (`categoria_recalcular`).
- **Pendiente:** bug sin reproducir "se queda marcado el último monto".

## Nómina (`nomina.html` + `nomina.js`)
- **Para qué:** lo que se le debe a cada trabajador esta semana (lunes a sábado, se paga el sábado), sus vales y su historial. Enlace directo `nomina.html?t=ID`.
- **Roles:** admin ve. Solo Ray paga, aprueba vales y anota vales; al carpintero le paga quien lleva la madera (`_puede_pagar_a`).
- **Datos:** `categorias_pago`. RPC `nomina_semana`, `nomina_trabajador`, `pagar_trabajador`, `anotar_vale`, `resolver_vale`, `asignar_categoria_item`.
- **Reglas:** un trabajo sin monto sale "Por definir". Lo del domingo pasa a la semana siguiente. Vales pueden ser en bolívares (se guarda tasa). Los pagos y vales hechos no se tocan (triggers `pago_protegido`, `vale_protegido`, `etapa_protegida`).

## Depósito (`deposito.html` + `deposito.js`)
- **Para qué:** materiales por unidad (discos, sierras, pintura), entregas a trabajadores, compras y revisión de Ray.
- **Roles:** admin y vendedora entregan. Solo admin agrega materiales y compra. Solo Ray revisa (aprueba o cuestiona). La vendedora no ve costos.
- **Datos:** todo por RPC: `deposito_resumen`, `deposito_entregar`, `deposito_revisar`, `deposito_comprar`, `deposito_comprar_varios`, `deposito_material_guardar`, `deposito_pedir_reponer`, `deposito_trabajos`.
- **Pendiente por decidir:** si una entrega espera que Ray apruebe; si Ray aprueba las suyas; cómo cuenta un producto ×5.

## Usuarios (`usuarios.html` + `usuarios.js`)
- **Para qué:** crear cuentas (admin, vendedor, trabajador), especialidades, línea de la vendedora, restablecer PIN, desactivar, eliminar.
- **Roles:** solo admin.
- **Datos:** `perfiles`. RPC `usuario_especialidades`, `usuario_linea`. Edge function `gestionar_usuarios` (crea y borra usuarios de Auth).
- **Reglas:** el usuario se escribe sin acentos ni espacios. Errores debajo de cada campo. Nadie se borra a sí mismo.
- **Pendiente:** carga lento.

## Seguimiento del cliente (`seguimiento.html`)
- **Para qué:** página pública del pedido (`seguimiento.html?t=token`): pasos con fecha, fotos del taller, pagos, productos y PDF. Sin nombres de trabajadores ni montos del taller, cédula tapada. Se apaga 3 días después de entregado.
- **Roles:** cliente (sin sesión).
- **Datos:** RPC `seguimiento_publico(t)`.

## Manuales (`ayuda.html`)
- **Para qué:** página "Manuales de uso" con el manual de cada rol.
- **Fuentes:** `pruebas/manual/fuente/`, capturas con `pruebas/manual/cap-*.js`, se arma con `python3 pruebas/manual/construir.py`.

## Importar (`importar.html`)
- **Para qué:** herramienta de una vez para traer datos de la app vieja a la tabla `respaldos`. No es parte del uso diario.

## Finanzas (`finanzas.html` + `finanzas.js` + `finanzas-mes.js`)
- **Para qué:** Dinero (pagos por confirmar y por ubicar, tu dinero hoy, lo que ganas este mes, cuentas, te deben), Proveedores (cuenta corriente, ficha, le transferí, cambiar saldo, estado de cuenta en PDF), Gastos (fijos previsto y pagado, nómina, vales, comisión) y Mes (cierre y reportes por proveedor y por cuenta con PDF).
- **Roles:** solo quien confirma pagos (Ray y Gualfredo).
- **Datos:** RPC `finanzas_datos` y las funciones de la libreta (ver `base-de-datos.md`). PDF con `pdf-reporte.js` (mismo diseño del PDF de la venta).

## Costos (`costos.html` + `costos.js` + `costeo.js` + `corte.js`)
- **Para qué:** Modelos (costeo con semáforo, precio con cada proveedor, barra completa, duplicar, pasar al catálogo), Semana (plan de corte del sábado desde Producción, hoja de corte y plan de compra en PDF), Ganancia (gastos fijos, ¿alcanzamos?, ganancia por producto, reglas) y Precios (sin IVA por proveedor).
- **Roles:** solo Ray y Gualfredo. El herrero ve su hoja de corte en Mi trabajo.
- **Reglas:** `costeo.js` calcula igual que `_costeo` de la base para que la ficha responda al instante; el número que vale es el de la base.

## Depósito (cambios v73)
- Pestañas Consumibles (Materiales y Entregas, como antes) · Fabricación (barras, hojas, retazos, conteo, faltan para el sábado) · Compras (facturas y notas, solo el total, registrar el material, ya le transferí aparte). Fabricación y Compras solo el administrador (`deposito-nuevo.js`).

## Lo que todavía no existe
- Resumen del taller en PDF (maqueta en `docs/claude/documentos/maqueta-resumen-v6.html`).
- Lectura de facturas con foto (lote 8), 3D (lote 11), aluminio y madera en Costos.
