# Lista de pruebas de Gualfredo (App Artesanos)

Lista de todo lo que hay que probar en el teléfono. Cada chat que haga cambios agrega aquí lo nuevo, en "Cambios recientes", y marca con ✅ lo que Gualfredo ya probó.

Antes de probar: cerrar la app por completo y volver a abrirla, para que cargue la versión nueva.

## 1. Vendedora (Yulimar)
- [ ] Inicio: pendientes de colores (pago no llegó, pedido listo, pago confirmado, cotización por vencer, atrasado). Al tocar cada uno lleva a su venta.
- [ ] Nueva venta: crear una cotización y convertirla en venta. Registrar un pago con comprobante.
- [ ] Ventas: la ficha dice "Espera que Ray confirme el pago". No puede cancelar ventas.
- [ ] Catálogo: puede crear y editar un modelo.
- [ ] Producción: solo mira, sin montos ni botones.
- [ ] Enviar el PDF y el enlace de seguimiento por WhatsApp.

## 2. Ray
- [ ] Inicio: "pago por confirmar" en rojo. Confirmar el pago hace que el pedido pase solo a fabricación.
- [ ] Producción: "Asignar trabajadores", elegir "Este sábado" o "Próximo sábado" y guardar.
- [ ] Nómina: aprobar el vale que pide un trabajador. Anotar un vale en bolívares. Marcar pagado. Ver el historial.
- [ ] Depósito: revisar una entrega (aprobar o cuestionar).

## 3. Trabajador
- [ ] Inicio: "¿Con cuál empiezas?", "Estás haciendo", la fila "Después" y "Ver todos".
- [ ] Abrir un trabajo: color, especificaciones, nota de la venta.
- [ ] "Ya lo terminé · tomar foto": termina con foto y dice cuánto sumó. Al siguiente le llega "Ya te toca".
- [ ] Pagos y vales: por cobrar, historial, pedir un vale.

## 4. Gualfredo (admin)
- [ ] Inicio: pendientes (sin asignar, trabajos atrasados, vales, modelos sin foto en un color, combos sin medidas, sin categoría).
- [ ] Nómina: ve todo; solo tiene el botón de pagar con el carpintero.

## 5. Cliente
- [ ] Enlace de seguimiento: los pasos con fecha y las fotos del taller, sin nombres ni montos.

## 6. Recorrido completo
- [ ] Yulimar vende y registra el pago; Ray confirma y asigna; cada trabajador termina su paso con foto; el pedido pasa solo a Lista; Yulimar avisa y marca Entregado; Ray paga en Nómina.

## Cambios recientes (agregar aquí lo nuevo de cada chat)
- 29 y 30 sep (v47 a v65), resumen: combos con ventanas y protecciones, asignar con fecha, inicio del trabajador, vales, Cotización o Venta con detalles para fabricar, Depósito (entregar, revisar, compra grande), atajos en avisos rojos, PDF en Android, Solo protección y monto del marco, fotos rápidas, ficha de la venta en fabricación, Ayuda dentro de la app y Manuales de uso.
- 30 sep (v66): **Categorías de pago por producto, Aluminio y detalles de ventana.**
  - [ ] Categorías de pago: una por producto; salen solo sus trabajos. Masilla y pintura es un solo monto. El extra de protección va en su recuadro.
  - [ ] "Asignar a modelos" muestra solo los modelos de ese producto. En Catálogo, cada modelo ofrece solo las categorías de su producto.
  - [ ] Ventanas con "Lleva detalles" y combos con "Las ventanas llevan detalles": sale el paso Detalles.
  - [ ] Usuarios: errores en rojo debajo del campo; "Jesús" entra como "jesus"; "Ventanero" ahora es "Aluminio".
- 1 oct (v67): **Cada unidad es un trabajo y Masilla y pintura en un solo paso.**
  - [ ] Venta con una puerta ×2: en Producción salen "1 de 2" y "2 de 2", cada una con su "Asignar trabajadores".
  - [ ] El trabajador ve 2 tarjetas, termina cada una con su foto y cada una suma lo suyo.
  - [ ] Masilla y pintura: un Empezar, una foto y el pago completo.
- 6 oct (v68): **Editar en fabricación y "Ya está hecho".**
  - [ ] Nueva venta, producto "A medida": marca "Ya está hecho, solo se entrega". Al confirmar el pago la venta queda Lista para entregar y no aparece en Producción. Yulimar también puede.
  - [ ] Abre una venta En fabricación y toca Editar: cambia el nombre o el teléfono del cliente y guarda.
  - [ ] En esa venta agrega un producto: te pregunta por la fecha de entrega. En Producción ese pedido dice "Producto nuevo por asignar" y el producto lleva la marca "Nuevo".
  - [ ] Un producto que ya tiene un paso terminado dice "Ya tiene pasos terminados: no se cambia" y no trae Editar ni Quitar.
  - [ ] En la ficha de la venta, "Cambios en el pedido" dice quién cambió qué. Si lo hizo Yulimar, te llega el aviso.
  - [ ] (Después de aprobar el cambio pendiente en la base) quitar un producto que todavía no tiene pasos terminados.
- 6 oct (v70): **Detalle del trabajador en dos cuadros, pieza corregida y madera.**
  - [ ] Trabajador con un Hierro o Masilla y pintura de un combo: al abrir el trabajo salen dos cuadros, "La puerta" y "Las protecciones", cada uno con sus medidas. Igual en una puerta con protección. Sigue siendo una sola foto y un solo pago.
  - [ ] Catálogo: corrige una pieza de entrega inmediata que ya está en una venta sin entregar (medidas, color o foto). La venta muestra lo corregido y el precio no cambia.
  - **Madera (primero haz esto):**
    - [ ] Usuarios: crea al carpintero (Trabajador, especialidad Carpintero). A la vendedora de madera ábrela y marca "Madera".
    - [ ] Categorías de pago: crea una con producto "Madera" y su monto por puerta. Asígnala a los modelos de madera.
  - [ ] Producción, pedido con puerta de madera: salen Estructura, Armado, Pintura y Ensamblado. Tú tienes "Asignar trabajadores"; Ray ve "Las puertas de madera las asigna Gualfredo".
  - [ ] En el paso que toca sale "Marcar terminado": pide la foto y sin foto no deja. Al terminar el Ensamblado el pedido queda Listo.
  - [ ] La vendedora de madera entra a Producción y también puede marcar los pasos de madera. La de hierro solo mira.
  - [ ] Nómina, carpintero: al terminar Estructura sale la mitad del monto; Armado y Pintura dicen "Va en el pago de la puerta"; al terminar Ensamblado sale el resto. El botón de pagarle lo tienes tú, no Ray.
  - [ ] Ayuda: en Producción, Ventas, Nueva venta, Categorías de pago y Usuarios ya explica todo esto con sus fotos.
