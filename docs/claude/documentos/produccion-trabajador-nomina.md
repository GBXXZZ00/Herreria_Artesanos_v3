# Producción: vista del trabajador y Nómina (definición acordada, 28-sep-2026)

Estado: en definición. Se construye por partes, con OK antes de cada una.

## Corrección importante
El trabajador SÍ usa la app con su propio usuario y PIN (ya existe "Jesús", rol trabajador). Lo que faltaba era construirle su propia experiencia; hasta ahora Producción solo la ve y opera el admin.

## Inicio del trabajador (a construir)
Reemplaza el Inicio genérico para rol = trabajador. Dos pestañas/badges, como el Home actual:

### 1. Trabajos pendientes
- Lista todas las etapas que tiene asignadas (de todos los pedidos), sin precios de venta.
- El trabajador elige UNA para empezar ("selecciona el que va a comenzar a trabajar").
- Al elegir una, las demás se bloquean (quedan deshabilitadas) hasta que termine la que escogió. Una sola activa a la vez. Mantenerlo lo más simple posible.
- Él mismo marca "terminado" esa etapa (foto opcional), sin pasar por el admin. El admin sigue pudiendo asignar y también marcar terminado como respaldo.

### 2. Pagos
- Muestra lo que ya terminó y el monto acumulado por cobrar.
- El monto se calcula según el tipo de producto (puerta, ventana, etc.) y su categoría de pago ("el grupo") — mismo sistema de categorías de pago de la app vieja: cada categoría tiene una tarifa por especialidad (Herrero, Masilla y Pintura, Acabados, Ventanero), cada tarifa Fijo o Por m². Cada modelo del catálogo tiene asignada una categoría.
- Incluye opción de "Vale": el trabajador lo solicita (adelanto), un admin lo aprueba, y una vez aprobado aparece como descuento contra su acumulado.

## Piezas que hacen falta para esto
1. Módulo Categorías de pago (admin): crear/editar categorías con tarifa por especialidad, fijo o por m². Asignar categoría a cada modelo del catálogo.
2. Cálculo automático del monto al marcar una etapa terminada (según categoría del producto + especialidad de la etapa), acumulado a nombre del trabajador.
3. Pantalla "Mi trabajo" / Inicio del trabajador con las dos pestañas de arriba.
4. Bloqueo de una sola etapa activa por trabajador a la vez.
5. Flujo de Vale: solicitar, aprobar (admin), descontar del acumulado.

Nómina completa (pagos periódicos, cierre de semana) se deja para después; esto deja el acumulado listo para calcularla.
