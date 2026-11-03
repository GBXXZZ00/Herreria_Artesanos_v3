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
| `finanzas.html`, `assets/js/finanzas.js` | Nuevo. Finanzas: Dinero (pagos por confirmar, todo lo tuyo, lo que ganas, por ubicar, cuentas, te deben), Proveedores (ficha, transferencias, estado de cuenta, cambiar saldo con historial, editar con tipos e IVA), Gastos |
| `costos.html`, `assets/js/costos.js` | Nuevo. Costos: modelos con semáforo, ficha del costeo (piezas, barras, hojas, pintura, accesorios, extras, mano de obra), duplicar, en diseño, pasar al catálogo, materiales por proveedor, reglas |
| `assets/css/modulo.css` | Nuevo. Estilos de `deposito.html` sacados aparte para Finanzas y Costos |
| `assets/js/deposito-nuevo.js` | Nuevo. Depósito › Fabricación (barras, plan de corte, conteo) y Compras (foto o a mano, saldo del proveedor, "ya le transferí aparte") |
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
