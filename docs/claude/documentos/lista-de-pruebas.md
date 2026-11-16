# Lista de pruebas de Gualfredo (App Artesanos)

Lista de todo lo que hay que probar en el teléfono. Cada chat que haga cambios agrega aquí lo nuevo, en "Cambios recientes", y marca con ✅ lo que Gualfredo ya probó.

Antes de probar: cerrar la app por completo y volver a abrirla, para que cargue la versión nueva.


## Taller lote 7: vendedora y sello ENTREGADO (v85, 16 nov 2026, Claude de Gualfredo)
**Vendedora (Yulimar)**
- [ ] En el Taller ve solo Pedidos: Todos · En proceso · Listos. No ve montos, Asignar, Corte ni Nómina.
- [ ] En Listos: la entrega, WhatsApp, Venta y Marcar entregada. Al marcarla, sale del Taller.

**Nota del cliente**
- [ ] Una venta entregada: su PDF (en la venta y en el seguimiento) trae el sello verde ENTREGADO con la fecha de entrega, sin tapar números.
- [ ] Una venta que no está entregada: el PDF sale igual que siempre.

## Taller › Corte › Material, lote 6 (v84, 16 nov 2026, Claude de Gualfredo)
Antes: aplicar v89 a v96 con Gualfredo presente.

**Material (Ray o Gualfredo)**
- [ ] Corte › Material: la compra en camino en amarillo con ¿Llegó? y ⋯.
- [ ] La tabla Hay · Apartado · Libre · Falta cuadra con lo que hay en el taller. Lo que falta sale en rojo.
- [ ] Tocar la ✕ de un retazo que ya no está: sale del Depósito.
- [ ] Comprar: lo que falta viene marcado; lo que queda en 0 se puede sumar. Pedir compra.
- [ ] Sale el mensaje para el proveedor: cambiar Lo busco / Me lo traen y Hoy / Mañana, y Enviar por WhatsApp (abre el chat del proveedor con el texto).
- [ ] ⋯ de la compra: Cambiar la compra (cantidades o proveedor) y Cancelar la compra (pide el motivo).
- [ ] ¿Llegó? con Una parte: lo que no vino sigue en camino en amarillo en la misma compra.
- [ ] Contar barras: la diferencia se ve antes de guardar.
- [ ] + Retazo encontrado: sale en la tabla con su número.
- [ ] Proveedores: lo que se debe; tocar uno abre su ficha en Finanzas; + Proveedor con WhatsApp.
- [ ] Enviar un corte que pide compra: sale el mensaje para el proveedor.
- [ ] ⋯ Más del corte enviado: Reportar barra dañada (otra del taller o se compra). El Depósito baja 1.

**Depósito**
- [ ] Ya no hay pestaña Compras. Desde Finanzas, tocar una factura de un proveedor la abre.

## Taller › Corte, lote 5 (v83, 16 nov 2026, Claude de Gualfredo)
Antes: aplicar v89 a v94 con Gualfredo presente (sin ellas el Corte no envía).

**Corte (Ray o Gualfredo)**
- [ ] En el Taller sale la pestaña Corte. Este sábado o el próximo.
- [ ] Números de arriba, puertas sin asignar (Asignar puertas) y el aviso de material que falta.
- [ ] Abrir un herrero: una tarjeta por puerta con su lista; la repetida dice "Igual que N° …".
- [ ] "De dónde sale el material": TALLER, NUEVA o el retazo. Tocar una pieza y moverla a otra barra o retazo.
- [ ] Enviar a … y pedir N barras: el herrero lo ve en Mi trabajo y la compra queda pedida.
- [ ] Cambiar algo después de enviar: sale "Cambió · vuelve a enviar".
- [ ] ⋯ de una puerta: pasarla a otro herrero, al próximo sábado o quitarla del plan.
- [ ] Más: PDF, Sugerir de nuevo, Deshacer envío (si no empezó) y Corregir lo que cortó (cuando termina).
- [ ] Si el herrero ya empezó, su plan queda con candado.

**Herrero**
- [ ] En su Inicio, "Qué cortar · te lo mandó Ray …" con sus puertas y barras. Si no le llegó: "Ray todavía no te manda el corte de esta semana."

## Taller › Nómina, lote 3 (v82, 16 nov 2026, Claude de Gualfredo)
Antes: cerrar y abrir la app. La migración v88 (`pagar_lo_marcado`) se aplica con Gualfredo presente: sin ella, Pagar dice que falta un cambio en la base.

**Nómina (Ray)**
- [ ] En el Taller, pestaña Nómina: Por pagar y Ya pagado esta semana; una fila por trabajador. El carpintero no te sale.
- [ ] Un trabajador con algo de la semana pasada dice "1 de la semana pasada"; el que pidió vale dice "Pidió vale · revisar".
- [ ] Abrir a uno: todo marcado. Desmarca un trabajo: el total y el botón "Pagar $… a …" cambian.
- [ ] Pagar: elige la cuenta y Confirmar pago. Le llega el aviso, sale en Finanzas y lo desmarcado sigue ahí con ↩.
- [ ] Historial: cada pago con su cuenta, quién pagó y sus trabajos.
- [ ] Vale que pidió: Revisar, Aprobar vale (pregunta de qué cuenta salió) o No aprobar.
- [ ] + Vale desde la lista: primero a quién, después el monto (en dólares o bolívares).
- [ ] Un aviso viejo de "Vale pedido" (nomina.html) abre su vale en el Taller.

**Gualfredo**
- [ ] Ve al carpintero y le paga. A los demás les paga Ray: sin casillas ni botón de pagar.

 (v81, 15 nov 2026, Claude de Gualfredo)
Antes: cerrar y abrir la app. La migración v87 (el aviso abre el trabajo) se aplica con Gualfredo presente; sin ella el aviso sigue abriendo el pedido.

**Resumen (Ray o Gualfredo)**
- [ ] Al entrar al Taller sale Resumen: "Hoy … · semana …".
- [ ] Avisos de arriba (entregas en 2 días, atrasados, listos): cada uno abre Pedidos con ese filtro.
- [ ] 1 Por asignar: cuántos pasos y en cuántos pedidos, con Asignar en cada pedido.
- [ ] 2 Lo asignado esta semana: "N de M hechos", la barra y la tabla por trabajador; lo de la semana pasada en rojo con ↩. Tocar un trabajador muestra sus trabajos con foto.
- [ ] ‹ muestra la semana pasada y "Volver a esta semana" regresa.
- [ ] 3 Por pagar: el total igual al de Nómina, con ↩ al que se le deben trabajos de antes y lo que ya pagaste esta semana.
- [ ] 4 Vales: Revisar lleva a la Nómina de ese trabajador.
- [ ] Atajos Plan de corte y + Fabricar para exhibición (ya no está el botón + flotante).

**Aviso y foto del trabajo**
- [ ] Cuando un trabajador termina, el aviso "Terminó …" abre ese trabajo: foto grande, Lo hizo, Se le paga, Sigue y Por pagar. Tocar la foto la amplía.
- [ ] En un pedido, tocar un paso hecho abre lo mismo.
- [ ] Inicio: "N trabajos sin asignar" ahora cuenta todos los pasos sin trabajador.

Antes: cerrar y abrir la app. La migración v86 (montos de cada paso) se aplica con Gualfredo presente; sin ella todo funciona, pero los pasos que faltan salen sin monto.

**Menú (Ray o Gualfredo)**
- [ ] Abajo sale Inicio · Ventas · Catálogo · Taller · Costeador. Costeador abre Costos. La vendedora no ve Costeador.
- [ ] En Ventas, arriba: Ventas · Cotizaciones. Pasar de una a otra y tocar Atrás: vuelve a Inicio.
- [ ] Inicio sigue teniendo Cotizaciones, Nómina, Depósito, Finanzas y Costeador.

**Taller › Pedidos**
- [ ] Filtros Todos · Por asignar · En proceso · Listos en una línea, con sus números.
- [ ] Cada pedido es una tarjeta con sus productos ("Bitral 1 de 2") y los pasos de colores: teal con ✓ hecho, borde teal haciendo, gris asignado, ámbar sin asignar, blanco esperando, rojo con ↩ si era para un sábado que ya pasó.
- [ ] La fecha de entrega sale ámbar si faltan 2 días o menos, roja si pasó, verde "Lista".
- [ ] Un pedido sin nada asignado tiene botón Asignar en la tarjeta: abre la hoja de la primera puerta.
- [ ] Abrir un pedido: atajos Venta, Seguimiento, ✂ Corte y Costeo; cada puerta con un solo Asignar; cada paso dice quién y cuándo, con su foto chiquita y el monto ("por pagar" o "pagado").
- [ ] Tocar un paso hecho: sale la foto en grande.
- [ ] Asignar: la hoja de siempre, con lo que se paga a la derecha de cada paso. Un paso ya empezado sale fijo ("ya empezó").
- [ ] Un paso de la semana pasada sale con ↩ y la caja roja "Sigue en la lista de ... para este sábado".
- [ ] Listos: debe el cliente, entrega, WhatsApp, Fotos, Venta y Marcar entregada.
- [ ] Un aviso viejo de "Terminó ..." (produccion.html) abre el pedido en el Taller.
- [ ] Pestaña Nómina lleva a la Nómina de siempre; desde ahí, Pedidos vuelve al Taller.

**Vendedora**
- [ ] Ve el Taller sin montos, sin Asignar, sin Nómina y sin el botón +.

## Reestructura de Costos, Depósito y Finanzas (v75 a v78, 8 nov 2026, Claude de Gualfredo)
Antes: aplicar las migraciones v81, v81b, v82, v83 y v84 (en ese orden) y cerrar y abrir la app.

**Costos › Modelos (Ray o Gualfredo)**
- [ ] La lista sale por grupos: Listos, Borrador y Faltan por costear. Los filtros (Todos, Puertas, Combos, Ventanas, Madera, En diseño) y el buscador funcionan.
- [ ] Abrir un modelo sin costear: sale "Del Catálogo" con lo que trae. Copiar del Bitral, Estructura estándar o En blanco.
- [ ] Ficha del Bitral en pantalla completa: el índice arriba lleva a cada parte; el precio queda siempre abajo. Tocar el precio: $223,22 · $290,19 · $326,79 · barra completa $339,23.
- [ ] Tocar una pieza: cambiar material con el buscador, qué es (Bastidor…) y Vertical u Horizontal. Guardar.
- [ ] Tocar Disco de corte 14": poner 6 solo para ese modelo; después "Usar el general".
- [ ] Usar $326,79 en el catálogo (o el precio que quieras).

**Costos › Precios**
- [ ] Filtros por tipo. "+ Material nuevo" aquí (ya no manda a Depósito). Reglas: IVA, ganancia, grosor del corte, despunte y puertas al mes.

**Finanzas**
- [ ] Gastos: tocar un gasto fijo para cambiarlo; "+ Gasto fijo". Aparece Flete en $0.
- [ ] Mes: "Ganancia por modelo" (antes en Costos) y su PDF.

**Costos › Plan de corte (con una venta en fabricación asignada a un herrero para el sábado)**
- [ ] 1 Pedidos del sábado · 2 Material en metros (necesitas · hay · comprar) · 3 Comprar lo que falta.
- [ ] Tocar un material: barras dibujadas, "No usar" un retazo, "+ Retazo que encontré", tocar una barra para mover una pieza. La lámina sale dibujada en la hoja y el vidrio como lista de piezas cortadas.
- [ ] Aceptar plan. El herrero ve su hoja en Mi trabajo con un color por puerta y retazos R-NN. Cuando termine TODOS sus pasos de Hierro del sábado, las barras bajan solas del Depósito. Si no, "Marcar a mano".
- [ ] Después de cortar: tocar el material y "Corregir corte" (barras de verdad, retazos usados y los que quedaron, motivo).

**Compras**
- [ ] Comprar lo que falta: Más barato o Todo en un proveedor, + Material, + Otro lugar, + Gasto (flete). Pedir compra.
- [ ] Queda en amarillo en el plan, en Depósito › Fabricación ("+N en camino") y en Finanzas › Dinero y en el proveedor ("salida por confirmar").
- [ ] Tocar "¿Llegó?": cambiar cantidad o precio, número de factura, foto, total del papel (dice si cuadra). Probar Lo debo, Pagué, Una parte y Saqué dinero (con vuelto; si no cuadra pide motivo). En la cuenta de bolívares pide la tasa.
- [ ] "No llegó" con motivo.

**Cierre del mes (Finanzas › Mes, un mes que ya terminó)**
- [ ] La lista de 4 pasos; el primero dice que es el arranque. 1 Cuentas (lo que dice el banco), 2 Contar el Depósito, 3 Cuadrar cada proveedor (Torniplemaca en $1.674,50), 4 Revisar y cerrar.
- [ ] Con una compra en camino no deja cerrar.

## Finanzas, Depósito, Costos, Corte, Mes y Reportes (v73, 3 nov 2026, Claude de Ray)
Primero: Ray o Gualfredo agregan sus cuentas (Finanzas › Dinero › "+ Agregar cuenta") y ponen el saldo de cada una con "Cambiar saldo".
- [ ] Vendedora: no ve Finanzas ni Costos en Inicio; en Depósito solo ve Materiales y Entregas. Registra un pago como siempre; ya no puede cambiarlo ni borrarlo.
- [ ] Inicio (Ray o Gualfredo): cuadros Finanzas y Costos. "Pago por confirmar" lleva a Finanzas.
- [ ] Finanzas › Dinero: confirmar un pago y decir dónde quedó en un solo paso (cuenta, proveedor o "Después"). Con el 50 % pasa solo a fabricación.
- [ ] Ventas: tocar un pago "Por confirmar" lleva a Finanzas.
- [ ] "Pagos por ubicar": ubicar uno que quedó para "Después".
- [ ] Mover entre cuentas con comisión: salen $770 de Zelle y llegan $700 en efectivo; la diferencia sale como "Comisión y cambio".
- [ ] Cuenta en bolívares: pide Bs, tasa y de dónde es la tasa (BCV, Binance u otra).
- [ ] Proveedores: Torniplemaca dice "Le debes $1.674,50" (nota 00-2884). Ponle el saldo real con "Cambiar saldo" y un motivo; queda en el historial.
- [ ] "Le transferí" a un proveedor; el saldo cambia antes de guardar. Desde una cuenta: "Pagué a un proveedor" con "Todavía no sé" queda por ubicar.
- [ ] Estado de cuenta en PDF por fechas (esta semana, este mes, mes pasado, otras fechas).
- [ ] Gastos: registrar el alquiler; deja de salir "gasto del mes sin cargar".
- [ ] Nómina: al marcar pagado y al anotar o aprobar un vale, pregunta de qué cuenta salió. Si cierras, queda por ubicar en Finanzas.
- [ ] Depósito › Fabricación: subir las existencias con "Contar barras"; anotar un retazo; agregar un material.
- [ ] Depósito › Compras: abrir la nota 00-2884 y "Registrar el material". Cargar una compra con materiales y otra "Solo el total". "Ya le transferí aparte".
- [ ] Costos › Modelos: el Bitral da costo $223,22 y sugerido $326,79; "Barra completa" $339,23; "Con cada proveedor" muestra los dos precios.
- [ ] Costos: empezar un modelo con el bastidor estándar o copiando el Bitral; agregar piezas; "Usar este precio".
- [ ] Catálogo: en la ficha del Bitral sale "Costo (solo Ray o Gualfredo)".
- [ ] Nueva venta: modelo con extra de protección o marco en Costos trae el monto sugerido (se puede cambiar).
- [ ] Costos › Semana: asignar en Producción el Hierro de un Bitral para este sábado; sale el plan de corte. Aceptar plan. El herrero ve su hoja en Mi trabajo. "Ya cortó" baja las barras y guarda los retazos.
- [ ] Costos › Ganancia: gastos fijos $915 ÷ 25 = $36,60 por puerta. Cambiar las puertas al mes.
- [ ] Finanzas › Mes: números del mes pasado, "Cerrar el mes" y Reporte en PDF. Después del cierre, registrar algo con fecha de ese mes da error.
- [ ] Finanzas › Mes › Reportes: por proveedor y por cuenta, con fechas y PDF.
- [ ] (v74) Dinero: varios pagos por confirmar salen en una sola tarjeta; al tocarla, agrupados por venta; "Revisar uno tras otro" abre el siguiente solo.
- [ ] (v74) Secciones que se abren y se cierran en Dinero, ficha del proveedor, Mes, Precios y Semana.
- [ ] (v74) Costos › Precios: "Por material" y "Por proveedor". En la ficha del Bitral, "El más barato".
- [ ] (v74) Mes: flechas ‹ › y "ver todos los meses".
- [ ] (v74) Herrero: la hoja de corte se abre y se cierra y "Descargar PDF" funciona.
- [ ] (v74) Descargar los PDF: tu dinero hoy, gastos, lista de precios, ganancia por producto, existencias y compras del mes.

## 1. Vendedora (Yulimar)
- [ ] Inicio: pendientes de colores (pago no llegó, pedido listo, pago confirmado, cotización por vencer, atrasado). Al tocar cada uno lleva a su venta.
- [ ] Nueva venta: crear una cotización y convertirla en venta. Registrar un pago con comprobante.
- [ ] Ventas: la ficha dice "Espera que confirmen el pago". No puede cancelar ventas.
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
- 3 nov (v72, Claude de Ray): **Nueva gestión: botones de PDF, PDF sin "por confirmar", teléfonos de otros países, Gualfredo confirma pagos.**
  - [ ] La app abre vacía (sin ventas ni pagos), pero al escribir la cédula o el teléfono de un cliente de antes se llena solo. La primera venta es la N° 1099.
  - [ ] Ficha de una venta: arriba siempre "Enviar PDF" (verde) y "Descargar PDF". Sin enviar dice "Primero envíale el PDF". Después dice "✓ PDF enviado hoy … · quién".
  - [ ] En el Samsung: después de "Enviar PDF" siguen los dos botones y sale aparte "2. Enviar el mensaje". "Descargar PDF" también funciona ahí.
  - [ ] Al terminar una venta: Enviar PDF al cliente, (Samsung) 2. Enviar el mensaje, Descargar PDF, Enviar mensaje con su seguimiento, Hacer otra venta.
  - [ ] PDF con un pago sin confirmar: el pago sale normal, sin "(por confirmar)" ni la nota de pago pendiente. En la ficha sí dice "Por confirmar". La página de seguimiento sigue diciendo "En revisión".
  - [ ] Teléfono de otro país pegado de WhatsApp (por ejemplo +1 305 555 1234): se guarda, se ve "+1 …" en la ficha y en el PDF, y "Escribirle" abre su chat. Uno de Venezuela sigue igual (0414…).
  - [ ] Gualfredo confirma un pago y el pedido pasa solo a fabricación. A Gualfredo le llega el aviso de cada pago por confirmar.
  - [ ] Gualfredo también puede pagar la nómina, aprobar vales y revisar entregas del Depósito.
  - [ ] Producción en el teléfono: una tarjeta con varios pasos a la vez no corre la pantalla hacia los lados.
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
- 8 nov (v79, lote 7): **Extras de punta a punta.**
  - [ ] Costos › un modelo › Extras › + Extra › Protección: "+ Pieza" o "Copiar de otro modelo". Sale cuánto cuesta (cortes + $25 hierro + $25 masilla de la categoría) y cuánto se cobra.
  - [ ] Manillón: no pide cortes, solo cuánto cuesta. Prueba "Oculto": la vendedora no ve su precio.
  - [ ] Catálogo: un modelo con Protección tildada. En Costos su costo suma la protección (o dice "falta cortes de la protección").
  - [ ] Nueva venta: puerta con protección de un modelo costeado: el monto sale solo ("Sale de Costos"). Sin costear: dice "Sin costear en Costos: escribe el monto" y deja vender.
  - [ ] Esa venta en fabricación: Inicio dice "Hay N extras vendidos sin costear"; Costos › Modelos tiene el grupo "Extras vendidos sin costear" con "Cargar cortes".
  - [ ] Plan de corte: la protección con cortes entra al plan. Sin cortes sale "Protección del N° ... sin cortes" con Cargar cortes y Cortar a mano; el herrero ve en Mi trabajo "córtalo como siempre".
