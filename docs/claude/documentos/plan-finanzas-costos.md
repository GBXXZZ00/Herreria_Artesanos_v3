# Plan: Finanzas, Proveedores, Compras y Costos

Autor: Ray (Claude de Ray), 2 nov 2026. Lo aprobaron Ray y Gualfredo después de ver la maqueta viva (`maqueta/` en la rama `ray/maqueta-finanzas-costos`). La maqueta es la guía de cómo se ve y se comporta cada pantalla; este documento dice cómo se hace de verdad.

## Lo que no se toca
- La lógica actual de Ventas, Producción, Nómina, trabajador, seguimiento y catálogo público. La vendedora trabaja igual que hoy.
- `confirmar_abono` sigue con la misma regla (al 50 % pasa solo a producción). Lo nuevo va en funciones aparte.
- Los costos nunca se guardan en el catálogo (es público).
- El estilo de la app: mismas clases, hojas, toasts, pestañas `.seg-d`, filtros `.fx`, opciones tocables, sin `<select>`.

## Decisiones
1. **Cuenta corriente con cada proveedor.** Transferir suma a favor; comprar resta. Se ve como "A tu favor", "Le debes" o "Al día". La compra no pregunta cómo se pagó.
2. **Una sola libreta de dinero** (`movimientos`). Cada renglón mueve una cuenta, un proveedor o los dos. Los saldos se calculan. Nada se borra: se anula con motivo.
3. **Saldos iniciales los llena Ray.** "Cambiar saldo" pide motivo y queda en el historial (renglón `ajuste`).
4. **Proveedores con tipos de material** (hierro, aluminio, vidrio, láminas, pintura, consumibles, accesorios, madera) y **cobra IVA sí o no**. Compras y precios solo muestran sus tipos. La compra trae Factura o Nota según el proveedor y se puede cambiar.
5. **IVA:** la deuda es lo que dice el papel; Costos recibe siempre el precio **sin IVA**. Material con "precio fijo para costear" (marco 10 a $12,28) sigue con el fijo.
6. **Confirmar pagos:** Finanzas tiene "Pagos por confirmar": Ray dice si llegó y dónde quedó (una cuenta, un proveedor o "después") en un solo paso. El aviso de Inicio lleva ahí. En Ventas se puede seguir confirmando; lo confirmado ahí queda "por ubicar" con su aviso.
7. **Datos de prueba y devoluciones viejas se borran** antes de empezar (lo hacen los socios).
8. **La vendedora no puede borrar ni cambiar pagos.**

## Lotes (cada uno con su rama, PR, pruebas, capturas y OK de Ray)
| Lote | Qué | Migración |
|---|---|---|
| 1 | Seguridad de abonos: quitar a la vendedora cambiar o borrar abonos directo (RLS), `registrar_abono` y `cancelar_venta` como `security definer`, sin `ON DELETE CASCADE` de ventas a abonos. **Con cuidado: avisar en bitácora y PR.** | `v72_ray_seguridad_abonos` |
| 2 | Proveedores y Cuentas: tablas, RLS solo admin, funciones `proveedor_guardar`, `cuenta_guardar`. Finanzas › Proveedores (lista, ficha, editar con tipos e IVA) | `v73_ray_proveedores_cuentas` |
| 3 | Libreta: `movimientos`, `transferencia_guardar`, `traspaso_guardar`, `saldo_cambiar`, `movimiento_anular`, `gasto_guardar`, `finanzas_resumen`, `proveedor_resumen`. Finanzas › Dinero con **reportes de dos columnas** (nombre y número con + o −): "Tu dinero hoy" y "Lo que ganas este mes"; cuentas y Gastos. Estado de cuenta en PDF de dos columnas (movimiento y monto con + o −) y saldo final, con el diseño del PDF de la venta | `v74_ray_libreta` |
| 4 | Pagos por confirmar y por ubicar: `abonos` con marca de ubicado; `pago_confirmar_y_ubicar` (llama a la regla de `confirmar_abono`) y `pago_ubicar`. Aviso de Inicio a Finanzas | `v75_ray_ubicar_pagos` |
| 5 | Depósito: materiales con clase (consumible o fabricación), tipo, presentación (barra con largo, hoja con medidas) y espesor; precios por proveedor con historial (`material_precios`). Pestañas Consumibles · Fabricación · Compras. Compras a mano con saldo del proveedor y "ya le transferí aparte" (`compra_guardar`). Conteo de barras | `v76_ray_deposito_fabricacion_compras` |
| 6 | Costos (pestañas Modelos · Corte · Precios · Reglas): `costeo_reglas`, `costeo_modelos` (del catálogo o en diseño), `costeo_piezas`, `costeo_hojas`, `costeo_insumos`, `costeo_extras`, `costeo_calcular`. Ficha con semáforo, barras, duplicar, pasar al catálogo. Precios = lista de precios sin IVA por proveedor (no es por pedido). Atajo "Costo" en Catálogo (solo admin). **Prueba obligatoria: Bitral = 223,22 · 290,19 · 326,79 · tubo completo 339,23** | `v77_ray_costos` |
| 7 | Extras en la venta: protección y marco decorativo toman el precio de Costos (se puede cambiar) | si hace falta |
| 8 | OCR de facturas: foto → propuesta llena para revisar (edge function). Antes, decidir con los socios qué servicio lee la foto y su costo | `v78_ray_ocr_compras` |
| 9 | **Costos › Corte** (como el Costeador de Ray): junta las piezas de los pedidos en fabricación (y modelos que Ray agregue para probar), usa primero los retazos del depósito, acomoda en el menor número de barras (más largas primero, con grosor del corte), dice barras a comprar y su costo con IVA, el ahorro de cortar todo junto, el costo y la ganancia de cada pedido, lámina y vidrio en m² y hojas, y la **hoja de corte** en PDF para el herrero. Fabricación del Depósito muestra lo mismo para el stock. Resumen en PDF con ganancia por pedido | `v79_ray_plan_corte` si hace falta |
| 10 | 3D: se prototipa primero en el proyecto de Ray | — |

## Reglas del costeo (no cambian)
IVA × 1,16 · perfiles por metro usado (precio de la barra ÷ largo) · barra completa solo para comparar · lámina y vidrio por m² de hoja · proveedor elegido y, si no vende ese material, otro con aviso · rendimiento del modelo o el general · fondo, esmalte y masilla sin general ("falta") · accesorios × cantidad · mano de obra de la categoría de pago (hierro + masilla y pintura + detalles) · costo × 1,30 + gastos fijos ($915 ÷ 25 = $36,60) · extras × 1,30 sin gastos fijos · grosor del corte · redondear solo al final.

Semáforo (ganancia sobre el costo, con el precio del catálogo): verde 30 % o más · amarillo 15 a 30 % · rojo 0 a 15 % · negro pierde · gris faltan datos.

## Avisos en Inicio (solo admin)
Pagos por confirmar (Ray, a Finanzas) · pagos por ubicar (Ray) · le debes a un proveedor · faltan barras para esta semana · modelo vendido sin costear · gastos del mes sin cargar.

## Preguntas abiertas (antes del lote 3)
1. ¿Cuántos Zelle hay y de quién es cada uno?
2. Torniplemaca, nota 00-2884 $1.674,50: ¿ya se pagó?
3. ¿Saldo de hoy con Colores y Ambiente?
4. ¿Quién registra transferencias a proveedores: solo Ray o también Gualfredo?
5. ¿Los proveedores reciben Bs a tasa Binance?
6. La nómina y los vales salen de una cuenta (casi siempre efectivo). ¿Nómina pide la cuenta al pagar (zona de Gualfredo) o Ray la descuenta con un gasto?

## Cómo trabaja cada lote
1. Leer `CLAUDE.md`, `docs/bitacora.md`, este plan y la pantalla en `maqueta/`.
2. Rama `ray/<tema>` desde `main` al día. Anotar en la bitácora qué se toca.
3. Migración en el PR (`-- Autor: Ray (Claude de Ray)`), RLS en toda tabla nueva, funciones `security definer` que revisan `auth.uid()` y el rol, `revoke execute ... from anon`.
4. Prueba nueva (`test41.js` en adelante) con datos falsos; correr todas las de `pruebas/`; capturas en iPhone 13; manual si cambia una pantalla; subir `?v=NN` en todos los HTML.
5. PR `[Ray] ...`. Ray da el OK, se une, se aplica la migración y se anota en la bitácora.
