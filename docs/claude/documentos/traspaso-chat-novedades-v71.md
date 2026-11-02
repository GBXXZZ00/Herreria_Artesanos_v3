# Novedades después del traspaso (leer junto con claude/traspaso-chat.md)

7 oct 2026. Último commit publicado: af8aa38 (?v=71). Esto corrige lo que dice el traspaso del 6 oct.

## Lo que cambió en v71
- **Ya NO hace falta la migración v68c** (`_item_quitar`, `_item_pasos_reiniciar`). Gualfredo decidió: en fabricación solo se edita y se agrega, nunca se elimina. En venta.js los productos que ya estaban (it.id) no traen el botón Quitar cuando la venta está en fabricación. Cambiar el tipo de un producto existente sigue fallando en el servidor con mensaje amable ("Agrega uno nuevo").
- **Detalle del trabajador en combos** (mi-trabajo.js `gemelos`): TODOS los trabajos del combo se ven en dos cuadros con el detalle completo de cada pieza. Hierro y Masilla y pintura: "La puerta" y "Las protecciones". Aluminio, Instalar y Detalles: "La puerta" y "Las ventanas" (la protección no lleva cuadro; sale la línea "Instalación: En su protección"). Ventana con protección sola: un cuadro "La ventana". Gualfredo NO quiere que se le oculte información al trabajador, la quiere separada por pieza.
- **"Papel ahumado", no "Vidrio"**: en el detalle del trabajador el color se rotula "Papel ahumado" (puerta: color_vidrio; ventanas: color_ahumado).

## Pendiente de decidir con Gualfredo
1. Dijo "en todo es color del papel ahumado, no color de vidrios". Solo se cambió en el detalle del trabajador. Falta confirmar si también en el resto: formulario de venta y catálogo ("Vidrio o farquilla"), chips del resumen ("Vidrio negro"), PDF y seguimiento.
2. Si a un producto ya en el taller le agregan protección o le suben la cantidad (cambia sus pasos): hoy el servidor lo rechaza. Falta que él diga si se bloquea en pantalla o se permite.
3. Detalles menores de la revisión: la lista del trabajador sigue diciendo "2 Ventanas" en el aluminio de un combo (el detalle muestra puerta y ventanas); pedidos viejos sin oficio pueden mostrar dos filas "Papel ahumado".

## Para probar (agregar a la lista de pruebas)
- [ ] Trabajador, combo N° 1064, Aluminio: dos cuadros, "La puerta" (medidas, abre, bloque, papel ahumado, manillón, cerradura, protección, marco) y "Las ventanas" (medidas, aluminio, papel ahumado con su color, bloque, "Instalación: En su protección").
- [ ] Hierro del mismo combo: "La puerta" y "Las protecciones".
- [ ] Editar una venta en fabricación: los productos que ya estaban no tienen Quitar; uno recién agregado sí.
