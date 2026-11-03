# Maqueta viva: Finanzas, Proveedores, Compras y Costos

Autor: Ray (Claude de Ray), 2 nov 2026.

Es una **copia de la app con datos de ejemplo**. Sirve para ver y probar cómo quedan los módulos nuevos antes de programarlos de verdad. **No toca la base real** y **no se une a `main`**: vive solo en la rama `ray/maqueta-finanzas-costos`.

## Cómo abrirla
1. En la carpeta `maqueta/`: `python3 -m http.server 8790`
2. Abrir `http://localhost:8790/entrada.html` (entra como Ray, sin PIN).
3. "Volver a empezar" (franja amarilla) deja los datos de ejemplo como al principio.

En la dirección de la app publicada (`github.io`) no abre a propósito: guardaría una sesión falsa encima de la real.

## Cómo funciona
- `assets/js/falso.js` se carga antes de `supabase.js` y responde a todas las llamadas a Supabase con datos guardados en el teléfono (`localStorage`). Las reglas de dinero y el costeo viven ahí, en `window.MAQUETA`, como si fueran las funciones de la base.
- `index.html` se llama `inicio.html` en la maqueta (el enlace de Claude no deja usar `index.html`).

## Qué es nuevo y qué cambió
| Archivo | Qué |
|---|---|
| `finanzas.html`, `assets/js/finanzas.js` | Nuevo. Finanzas: Dinero (pagos por confirmar; reportes sencillos de dos columnas, nombre y número con + o −: tu dinero hoy y lo que ganas este mes; por ubicar, cuentas, te deben), Proveedores (ficha, transferencias, estado de cuenta, cambiar saldo con historial, editar con tipos e IVA), Gastos, **Mes** (cierre completo, cerrar el mes, reporte PDF) |
| `costos.html`, `assets/js/costos.js` | Nuevo. Costos en 4 pestañas: **Modelos** (estado Sin costear · Borrador · Listo, los de fabricación primero, ficha con cortes, hojas, pintura, accesorios, extras y mano de obra; empezar con el bastidor estándar, duplicar, pasar al catálogo), **Semana** (plan de corte por sábado desde lo asignado en Producción, por herrero, Ray acepta o cambia, "ya cortó", ¿qué alcanzo?, sin cortes = cargar o a mano, plan de compra y hoja de corte en PDF), **Ganancia** (gastos fijos, ¿alcanzamos este mes?, ganancia por producto, reglas) y **Precios** |
| `assets/js/pdf-reporte.js` | Nuevo. PDF de hoja de corte, plan de compra y cierre del mes con el diseño del PDF de la venta |
| `assets/js/produccion.js` | Cambiado. Enlace "Entra al plan de corte del sáb X" en la ficha del pedido |
| `assets/css/modulo.css` | Nuevo. Estilos de `deposito.html` sacados aparte para Finanzas y Costos |
| `assets/js/deposito-nuevo.js` | Nuevo. Depósito › Fabricación por tubo (barras, retazos con medida, hojas y sobrantes, faltan para el sábado, conteo; sin pedidos) y Compras (foto o a mano, saldo del proveedor, "ya le transferí aparte") |
| `deposito.html`, `assets/js/deposito.js` | Cambiado. Pestañas Consumibles · Fabricación · Compras; en computadora el detalle se abre al lado |
| `inicio.html` | Cambiado. Cuadros Finanzas y Costos; avisos nuevos; "pago por confirmar" lleva a Finanzas |
| `assets/js/catalogo.js` | Cambiado. Fila "Costo" en la ficha del modelo (solo admin) |
| `assets/js/specs-producto.js` | Cambiado. El monto de la protección y del marco decorativo sale de Costos |
| `assets/js/falso.js`, `entrada.html` | Solo de la maqueta. No pasan a la app |

Todo lo demás es la app tal cual (v71).

## Datos
- Precios de materiales y fórmula: Memoria central de Ray (el Bitral da $223,22 de costo y $326,79 sugerido).
- Ventas, clientes, saldos de cuentas y de proveedores: **ejemplo**. Ray llena los reales.
- Nota de Torniplemaca 00-2884 ($1.674,50) y precios de Colores y Ambiente: reales.

## Para programarlo de verdad
Ver `docs/claude/documentos/plan-finanzas-costos.md`: lotes, tablas, funciones y pruebas. La maqueta es la guía de cómo debe verse y comportarse cada pantalla.
