# Plan: Finanzas, Proveedores, Compras y Costos

Autor: Ray (Claude de Ray), 2 nov 2026. Lo aprobaron Ray y Gualfredo después de ver la maqueta viva (`maqueta/` en la rama `ray/maqueta-finanzas-costos`). La maqueta es la guía de cómo se ve y se comporta cada pantalla; este documento dice cómo se hace de verdad.

## Un lugar para cada cosa
- **Producción = quién hace qué y para qué sábado.** Es el único lugar donde se asigna. Asignar el Hierro a un herrero para un sábado es lo que manda ese trabajo al plan de corte.
- **Costos = cuánto cuesta y cómo se corta:** Modelos (cortes y costo de cada modelo, estado Sin costear · Borrador · Listo, precio sugerido), Semana (plan de corte por sábado), Ganancia (gastos fijos, ¿alcanzamos este mes?, ganancia por producto y reglas) y Precios.
- **Depósito = lo que hay:** Consumibles (igual que hoy), Fabricación por tubo (barras enteras, retazos con su medida, hojas y sobrantes, "faltan X para el sábado" con enlace a Costos › Semana, conteo del sábado; sin pedidos) y Compras.
- **Finanzas = el dinero:** Dinero, Proveedores, Gastos y Mes (cierre completo y reporte mensual).
- **Mi trabajo (herrero):** su hoja de corte del sábado cuando Ray acepta el plan.
- **Catálogo:** costo y ganancia del modelo (solo admin) o "Sin costear · cargar costeo".

## Plan de corte semanal (decidido 3 nov 2026)
- **Sale de Producción:** entran los pasos de Hierro pendientes, con herrero, para ese sábado (`etapas.oficio = 'hierro'`, `trabajador_id`, `para_el`), de ventas en fabricación. Exhibición entra sin ganancia. Cada unidad ("1 de 2") cuenta por su sábado. Lo sin asignar sale aparte con atajo a Producción. Madera no entra. Aluminio: línea gris "llega pronto".
- **No es por modelo:** junta las piezas de todas las puertas, perfil por perfil, y las acomoda en retazos (primero) y barras del depósito; lo que no alcanza son barras a comprar. Un tubo lleva piezas de varias puertas. Cada barra va al herrero con más piezas en ella; las piezas del otro se le pasan.
- **Ray acepta o cambia:** tocar una barra para cambiar quién la corta o mover una pieza a otra barra. "Volver a la sugerencia". Si cambia lo asignado en Producción, la app sugiere de nuevo y avisa.
- **Al aceptar:** cada herrero ve su hoja de corte en Mi trabajo (y en PDF). Cuando Ray marca "ya cortó", bajan las barras, se gastan los retazos usados y se guardan los nuevos de 50 cm o más. La marca de cortado es por paso, guardada fuera de `etapas`.
- **¿Qué alcanzo con lo que hay?:** con N tubos, cuántas puertas salen en orden de entrega.
- **Modelo sin cortes:** no frena el trabajo. Sale con "Cargar cortes ahora" o "Cortar a mano" (hoja simple). Avisos en Inicio y en Costos › Modelos (los de fabricación primero).
- **Plan de compra y hoja de corte en PDF** con el diseño del PDF de la venta.

## Mes: cierre y reporte (decidido 3 nov 2026)
Finanzas › Mes, en dos columnas: lo que ganaste (vendido con costeo − costo − gastos), dinero que entró y salió, compras por proveedor, gastos fijos previsto y pagado, lo que dejó cada producto, saldos de cuentas y proveedores al cerrar. "Cerrar el mes" congela los números (después solo ajustes con motivo). Reporte mensual en PDF. Nómina y vales entran cuando se decida de qué cuenta salen.

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
6. **Confirmar pagos solo en Finanzas** (3 nov): "Pagos por confirmar": Ray dice si llegó y dónde quedó (una cuenta, un proveedor o "después") en un solo paso. El aviso de Inicio lleva ahí. En Ventas el pago sale "Por confirmar" con atajo "Confirmar en Finanzas" (solo Ray); la vendedora lo ve igual que hoy.
9. **Nómina y vales salen de una cuenta** (3 nov): Ray paga de lo que tiene, así que son gastos. Al pagar la nómina del sábado y al entregar un vale, la app pide de qué cuenta salió (un toque). El vale es un adelanto del pago de la semana: sale de la cuenta el día que se entrega y el sábado se paga solo la diferencia, así no se cuenta dos veces. En el cierre del mes salen como "Nómina" y "Vales (adelantos)".
7. **Datos de prueba y devoluciones viejas se borran** antes de empezar (lo hacen los socios).
8. **La vendedora no puede borrar ni cambiar pagos.**

## Corrida única de Claude Code (como en Airtek)
Todos los lotes **seguidos en una sola corrida**, en este orden: 1, 2, 3, 4 (Dinero) · 5 (Depósito) · 6, 7 (Costos) · 9 (Corte) · 10 (Mes) · 10b (reportes por proveedor y por cuenta). Después, aparte: 8 (OCR), 11 (3D), aluminio, madera y reportes por proveedor y cuenta.
- Una rama `ray/finanzas-costos` desde `main`, **un commit por lote** (con su migración) y **un solo PR** al final.
- Ray da el OK al PR; se aplican las migraciones en orden y se une.

## Lotes (cada uno con su rama, PR, pruebas, capturas y OK de Ray)
| Lote | Qué | Migración |
|---|---|---|
| 1 | Seguridad de abonos: quitar a la vendedora cambiar o borrar abonos directo (RLS), `registrar_abono` y `cancelar_venta` como `security definer`, sin `ON DELETE CASCADE` de ventas a abonos. **Con cuidado: avisar en bitácora y PR.** | `v72_ray_seguridad_abonos` |
| 2 | Proveedores y Cuentas: tablas, RLS solo admin, funciones `proveedor_guardar`, `cuenta_guardar`. Finanzas › Proveedores (lista, ficha, editar con tipos e IVA) | `v73_ray_proveedores_cuentas` |
| 3 | Libreta: `movimientos` (con `monto_salio` y `monto_llego`; la diferencia es gasto "Comisión y cambio"; Bs con `tasa` y `tasa_origen`; `registrado_por`), `transferencia_guardar`, `traspaso_guardar`, pago de nómina y vales con cuenta, `saldo_cambiar`, `movimiento_anular`, `gasto_guardar`, `finanzas_resumen`, `proveedor_resumen`. Finanzas › Dinero con **reportes de dos columnas** (nombre y número con + o −): "Tu dinero hoy" y "Lo que ganas este mes"; cuentas y Gastos. Estado de cuenta en PDF de dos columnas (movimiento y monto con + o −) y saldo final, con el diseño del PDF de la venta | `v74_ray_libreta` |
| 4 | Pagos por confirmar y por ubicar: `abonos` con marca de ubicado; `pago_confirmar_y_ubicar` (llama a la regla de `confirmar_abono`) y `pago_ubicar`. Aviso de Inicio a Finanzas | `v75_ray_ubicar_pagos` |
| 5 | Depósito: materiales con clase (consumible o fabricación), tipo, presentación (barra con largo, hoja con medidas) y espesor; precios por proveedor con historial (`material_precios`). Pestañas Consumibles · Fabricación · Compras. Compras a mano con saldo del proveedor y "ya le transferí aparte" (`compra_guardar`). Conteo de barras | `v76_ray_deposito_fabricacion_compras` |
| 6 | Costos (pestañas Modelos · Corte · Precios · Reglas): `costeo_reglas`, `costeo_modelos` (del catálogo o en diseño), `costeo_piezas`, `costeo_hojas`, `costeo_insumos`, `costeo_extras`, `costeo_calcular`. Ficha con semáforo, barras, duplicar, pasar al catálogo. Precios = lista de precios sin IVA por proveedor (no es por pedido). Atajo "Costo" en Catálogo (solo admin). **Prueba obligatoria: Bitral = 223,22 · 290,19 · 326,79 · tubo completo 339,23** | `v77_ray_costos` |
| 7 | Extras en la venta: protección y marco decorativo toman el precio de Costos (se puede cambiar) | si hace falta |
| 8 | OCR de facturas: foto → propuesta llena para revisar (edge function). Antes, decidir con los socios qué servicio lee la foto y su costo | `v78_ray_ocr_compras` |
| 9 | **Costos › Semana** (ver "Plan de corte semanal"): junta las piezas de lo asignado en Producción al paso Hierro para ese sábado, usa primero los retazos del depósito, acomoda en el menor número de barras (más largas primero, con grosor del corte), dice barras a comprar y su costo con IVA, el ahorro de cortar todo junto, el costo y la ganancia de cada pedido, lámina y vidrio en m² y hojas. **Hoja de corte y plan de compra descargables en PDF**, con el mismo diseño del Resumen en PDF y del PDF de la venta (jsPDF, `ventas-comun.js`). Depósito › Fabricación solo muestra el stock y "faltan X barras" con enlace a Corte. Resumen en PDF con ganancia por pedido | `v79_ray_plan_corte` si hace falta |
| 10 | Finanzas › Mes: cierre, congelar el mes y reporte mensual en PDF (`cierres_mes`) | `v80_ray_cierre_mes` |
| 10b | Reportes por proveedor y por cuenta (decisión 18), con PDF | si hace falta, `v81_ray_reportes` |
| 11 | 3D: se prototipa primero en el proyecto de Ray | — |

## Reglas del costeo (no cambian)
IVA × 1,16 · perfiles por metro usado (precio de la barra ÷ largo) · barra completa solo para comparar · lámina y vidrio por m² de hoja · proveedor elegido y, si no vende ese material, otro con aviso · rendimiento del modelo o el general · fondo, esmalte y masilla sin general ("falta") · accesorios × cantidad · mano de obra de la categoría de pago (hierro + masilla y pintura + detalles) · costo × 1,30 + gastos fijos ($915 ÷ 25 = $36,60) · extras × 1,30 sin gastos fijos · grosor del corte · redondear solo al final.

Semáforo (ganancia sobre el costo, con el precio del catálogo): verde 30 % o más · amarillo 15 a 30 % · rojo 0 a 15 % · negro pierde · gris faltan datos.

## Decisiones del 3 nov (cuentas y dinero)
10. **Lo que importa es a quién, no a qué cuenta.** Los proveedores se registran con sus datos de pago (Zelle, pago móvil, banco y titular), como dato. Al **confirmar un pago de cliente** se elige dónde llegó: una cuenta nuestra o **un proveedor** (se busca por nombre o por su Zelle); si es de un proveedor, suma a nuestro favor con él. Al **transferir** a un proveedor se elige a quién y de cuál cuenta nuestra salió; la cuenta destino queda solo como dato. Nuestras cuentas se crean libres (varios Zelle, efectivo por sede, Binance, banco, bolívares).
11. **Lo que sale de la cuenta puede ser mayor que lo que se paga.** Ejemplo: para pagar $700 de nómina se sacan $770 de Zelle y se reciben $700 en efectivo. Toda salida y todo "Mover entre cuentas" tiene dos montos: **salió de la cuenta** y **llegó o se pagó**. La diferencia queda sola como gasto "Comisión y cambio". Vale para nómina, vales, proveedores, gastos y cambios entre cuentas.
12. **Ray y Gualfredo registran pagos a proveedores.** Cada movimiento guarda quién lo hizo.
13. **Bolívares con varias tasas:** cada movimiento en Bs guarda su monto en Bs, su tasa y de dónde es la tasa (BCV, Binance u otra). No hay una tasa general.
14. **Saldos al día poco a poco:** Ray pone los saldos iniciales a mano cuando los recuerde ("Cambiar saldo" con motivo). Nada bloquea el trabajo mientras tanto.
15. **Gastos fijos por puerta:** se calcula con la lista de gastos fijos que Ray llena (puede agregar o cambiar) ÷ puertas al mes. Costos › Ganancia muestra además el **promedio real de los últimos 3 meses**: gastos fijos pagados en Finanzas ÷ puertas terminadas en Producción (Hierro terminado). Si el real se aleja, avisa "Tu gasto real por puerta es $X; usas $Y" y Ray decide si lo cambia (nunca cambia solo, para que los precios no salten). Hasta tener 3 meses de datos se usa lo que Ray puso.
16. **Datos de pago del proveedor son opcionales.** Basta decir "pagué por Binance a tal proveedor": se elige la cuenta nuestra y el proveedor.
17. **Pago sin proveedor = "en proceso".** Se puede registrar una salida (o un pago de cliente) sin decir a quién; queda "por ubicar" con aviso en Inicio y en Finanzas hasta que se le asigne el proveedor o la cuenta.
18. **Reportes por proveedor y por cuenta entran YA (lote 10b):** filtro por fechas (semana, mes, rango). Por proveedor: compras, pagos, saldo al inicio y al final, facturas y notas, en dos columnas y PDF. Por cuenta: entradas, salidas, comisiones y cambios, saldo corrido, y en PDF. Resumen de todos los proveedores y de todas las cuentas en una pantalla.
19. **Para después:** evaluar madera; facturas que mezclan hierro y madera.

## Atajos entre módulos
| Desde | Hacia | Para qué |
|---|---|---|
| Producción (ficha del pedido) | Costos › Semana del sábado | Ver el plan de corte donde entró |
| Costos › Semana (sin asignar) | Producción | Asignar herrero y sábado |
| Costos › Semana (sin cortes) | Costos › Modelos (ficha) y volver | Cargar los cortes |
| Costos › Semana (qué comprar) | Depósito › Compras | Cargar la compra |
| Depósito › Fabricación (faltan) | Costos › Semana | Ver cómo se corta y qué comprar |
| Depósito › Fabricación (material) | Costos › Precios | Precio por proveedor |
| Depósito › Compras (proveedor) | Finanzas › Proveedores (ficha) | Saldo y estado de cuenta |
| Catálogo (ficha) | Costos › Modelos (ficha) | Costo, ganancia o cargar costeo |
| Costos › Ganancia | Finanzas › Gastos | Gastos reales del mes |
| Ventas (pago por confirmar) | Finanzas › Dinero | Confirmar y ubicar |
| Nómina (pagar) | Finanzas | La salida queda en la cuenta elegida |
| Inicio (avisos) | Finanzas, Costos, Depósito | Cada aviso lleva a donde se resuelve |

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
4. Prueba nueva (`test41.js` en adelante) con datos falsos; correr todas las de `pruebas/` una vez antes del PR; capturas en iPhone 13 solo de las pantallas nuevas o cambiadas; **el manual no se toca por ahora** (se deja en blanco); subir `?v=NN` en todos los HTML.
5. PR `[Ray] ...`. Ray da el OK, se une, se aplica la migración y se anota en la bitácora.
