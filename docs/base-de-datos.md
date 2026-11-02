# Base de datos (Supabase `artesanos-v3`, proyecto `vmrxfpgotbmmjxzizsuq`)

Leído en solo lectura el 2 nov 2026. PostgreSQL 17. Todo está en el esquema `public`. RLS está activo en **todas** las tablas.

Idea general: la pantalla casi nunca escribe directo. Las reglas importantes (montos, estados, permisos) viven en funciones RPC `security definer` que revisan quién llama (`auth.uid()` y su rol en `perfiles`). Las tablas solo dejan leer a quien corresponde.

## Ayudantes de permisos
| Función | Devuelve verdadero si quien llama es... |
|---|---|
| `_es_admin()` | administrador activo |
| `_es_deposito()` | administrador o vendedor activo (el nombre es histórico: se usa para ventas, catálogo, clientes, etc.) |
| `_es_ray()` | quien confirma pagos (`perfiles.confirma_abonos`) |
| `_lleva_madera()` | quien lleva la madera (`perfiles.lleva_madera`, hoy Gualfredo) |
| `_puede_madera()` | quien lleva la madera o la vendedora de línea madera |
| `_puede_pagar_a(tid)` | quien puede pagarle a ese trabajador (al carpintero, quien lleva la madera; al resto, Ray) |

## Tablas

### Personas y lugares
- **`perfiles`**: un registro por usuario (mismo `id` que `auth.users`). `usuario`, `nombre`, `rol` (`admin` · `vendedor` · `trabajador`), `activo`, `sede_id`, `confirma_abonos`, `especialidades[]` (herrero, masilla_pintura, acabados, ventanero = "Aluminio", carpintero), `lleva_madera`, `linea` (`hierro` · `madera`). → `sedes`.
- **`sedes`**: Cumbres de Maracaibo y Avenida Universidad, con dirección y enlace al mapa.
- **`clientes`**: nombre, teléfono (normalizado), cédula (normalizada), dirección. → `creado_por`.
- **`push_suscripciones`**: teléfonos suscritos a avisos push de cada usuario.

### Catálogo
- **`catalogo`**: modelos. `tipo` (Puerta Multilock, Portón, Ventana, Combo, Puerta de Madera), `fotos` (jsonb por color), `especificaciones_base`, `precio_base`, `categoria_pago_id`, datos del catálogo público (`badge`, `caracteristicas`, `descripcion_publica`), `id_viejo` de la app anterior. → `categorias_pago`.
- **`disponibles`**: piezas físicas de entrega inmediata por sede (color, especificaciones, foto, cantidad, precio, estado). → `catalogo`, `sedes`.
- **`categorias_pago`**: cuánto se paga al taller. `producto` (un solo producto por categoría), `tarifas` (jsonb: claves hierro, masilla_pintura, detalles, armar, detalles_ventana, madera; cada una fijo o por m²; extras `prot_*`), `activo`.

### Ventas
- **`ventas`**: el número de la venta es el número del pedido (las reales desde 1047). `estado` (`cotizacion` · `confirmada` · `en_produccion` · `lista` · `entregada` · `cancelada`), `cliente_id`, `sede_id`, `vendedor_id`, montos (`subtotal`, `descuento`, `instalacion`, `traslado`, `total`), fechas de cada estado, `vence_en` (cotización), `fecha_entrega`, `token_seguimiento` (enlace público), `clave` (evita duplicados por reintento), `interna` (orden para exhibición), marcas de mensaje y PDF enviados. → `clientes`, `sedes`, `auth.users`.
- **`venta_items`**: productos de la venta. `catalogo_id` o `pieza_id` (entrega inmediata) o `a_medida`; `tipo`, `nombre`, `especificaciones`, `foto`, `precio_unitario`, `cantidad`, `categoria_pago_id`, `ya_hecho` (solo se entrega), `agregado_en` (agregado con la venta en fabricación). → `ventas`, `catalogo`, `disponibles`, `categorias_pago`.
- **`abonos`**: pagos y devoluciones en dólares. `tipo` (abono · devolucion), `metodo` (Binance, Zelle, Bolívares, Efectivo), `tasa` y `monto_bs` si fue en bolívares, `comprobante` (ruta en el bucket privado), `estado` (por_confirmar · confirmado · rechazado), quién registró y quién confirmó. → `ventas`.
- **`venta_cambios`**: historial de cambios a una venta en fabricación (quién, cuándo, lista de cambios). → `ventas`.

### Taller y nómina
- **`etapas`**: cada paso de fabricación de un producto. `venta_item_id`, `unidad` (1 de N), `rama` (principal, ventana…), `nombre`, `orden`, `oficio`, `especialidad`, `incluye` (qué piezas abarca), `despues_de[]` (espera a otra rama), `trabajador_id`, `para_el` (sábado), `orden_trabajador`, `iniciada_en`, `estado` (pendiente · hecha), `foto`, `terminada_por/en`, `monto` calculado, `pago_id` cuando se pagó. → `venta_items`, `perfiles`, `pagos_trabajador`.
- **`vales`**: adelantos al trabajador. `monto` en dólares (y `monto_bs`, `tasa` si fue en bolívares), `estado` (pedido, aprobado, rechazado…), quién lo anotó o resolvió, `pago_id` cuando se descontó. → `perfiles`, `pagos_trabajador`.
- **`pagos_trabajador`**: cada pago del sábado. `trabajos`, `vales`, `monto` neto, `semana`, quién pagó. → `perfiles`.

### Depósito
- **`materiales`**: materiales por unidad con `stock`, `minimo`, `oficio`, `activo`.
- **`deposito_entregas`**: una unidad entregada a un trabajador, con `estado` de revisión de Ray, marca `rara` si se ve fuera de lo normal y nota de revisión. → `materiales`, `perfiles`.
- **`deposito_compras`** y **`deposito_facturas`**: compras de material (una factura puede tener varias compras) con su costo. → `materiales`, `perfiles`.

### Avisos y respaldo
- **`notificaciones`**: avisos para una persona (`para`) o un rol (`para_rol`), con título, texto, enlace y venta. Al insertarse, el trigger `notificacion_enviar` llama a la edge function `notificar` (Web Push).
- **`respaldos`**: copia en jsonb de los datos de la app vieja. **`_respaldo_fotos_google`**: respaldo de las rutas viejas de fotos en Google Drive.

## Reglas RLS en palabras sencillas
| Tabla | Quién lee | Quién escribe directo |
|---|---|---|
| `catalogo`, `disponibles`, `sedes` | Todo el mundo, sin sesión (catálogo público) | Catálogo y disponibles: admin y vendedora. Sedes: admin. |
| `perfiles` | Todo el mundo (la pantalla de "¿Quién eres?" los necesita) | Nadie: solo funciones y la edge function `gestionar_usuarios`. |
| `ventas`, `venta_items`, `abonos`, `clientes` | Admin y vendedora | Admin y vendedora, pero las reglas fuertes van por RPC y triggers. El trabajador está bloqueado aunque tuviera permiso (`_bloquear_trabajador`). |
| `venta_cambios` | Admin y vendedora | Nadie: lo escribe `editar_venta_fabricacion`. |
| `categorias_pago` | Admin | Admin |
| `etapas` | Admin | Nadie: solo funciones (`asignar_etapa(s)`, `empezar_etapa`, `ordenar_mis_trabajos`, `marcar_etapa_terminada`, `terminar_etapa_madera`). El trabajador y la vendedora leen por RPC. |
| `vales`, `pagos_trabajador` | El propio trabajador o un admin | Nadie: solo funciones de nómina. |
| `materiales`, `deposito_entregas` | Admin y vendedora | Nadie: solo funciones del depósito. |
| `deposito_compras`, `deposito_facturas` | Admin | Nadie: solo funciones. |
| `notificaciones` | La persona o el rol al que va dirigida | Nadie: solo funciones. |
| `push_suscripciones` | Cada uno las suyas | Cada uno las suyas |
| `respaldos` | Nadie desde la app | Cualquiera con sesión puede insertar (para importar). |

## Funciones RPC que usa la app
**Ventas:** `crear_venta(p)`, `actualizar_venta(vid, p)`, `convertir_en_venta(vid, a)`, `completar_detalles(vid, items)`, `editar_venta_fabricacion(vid, p)`, `registrar_abono(vid, a)`, `confirmar_abono(aid, llego, nota)` (solo Ray; si queda pagada pasa a fabricación), `cambiar_estado_venta(vid, nuevo, desde)`, `cancelar_venta(vid, motivo, metodo_devolucion)` (solo admin), `marcar_paso(vid, paso)`, `avance_venta(vid)`, `pagado_venta(vid)`, `seguimiento_publico(t)` (sin sesión).

**Producción:** `produccion_lectura()`, `asignar_etapa(eid, tid, p_para)`, `asignar_etapas(p)`, `asignar_categoria_item(iid, cid)`, `crear_orden_exhibicion(p)`, `cancelar_orden_exhibicion(vid)`, `terminar_etapa_madera(eid, foto_url)`.

**Trabajador:** `mis_trabajos()`, `mis_pagos()`, `empezar_etapa(eid)`, `ordenar_mis_trabajos(p_ids)`, `marcar_etapa_terminada(eid, foto_url)`, `pedir_vale(p_monto, p_nota)`.

**Nómina:** `nomina_semana()`, `nomina_trabajador(tid)`, `pagar_trabajador(tid, esperado)`, `anotar_vale(...)`, `resolver_vale(vid, aprobar)`.

**Catálogo y categorías:** `asignar_categoria_modelos(ids, cid)`, `catalogo_medidas_ventanas(mid, alto, ancho)`, `fotos_sin_mini()`.

**Depósito:** `deposito_resumen(semanas)`, `deposito_entregar(mid, tid, nota, clave)`, `deposito_revisar(eid, aprobar, nota)` (solo Ray), `deposito_comprar(...)`, `deposito_comprar_varios(...)`, `deposito_material_guardar(p)`, `deposito_pedir_reponer(mid)`, `deposito_trabajos(eid)`.

**Usuarios:** `usuario_especialidades(uid, esp)`, `usuario_linea(uid, p_linea)`.

**Otras:** `aviso_prueba()`, `normalizar_telefono(t)`, `normalizar_cedula(t)`.

Funciones internas importantes (empiezan con `_`): `_etapas_crear` / `_insertar_etapas_item` (crean los pasos según el producto), `_monto_etapa` / `_calcular_monto` / `_tarifa` (cuánto vale cada paso), `_etapa_espera` (si un paso espera a otro), `_a_produccion_si_pagada`, `_exhibicion_terminar`, `_stock_tomar` / `_stock_devolver` (piezas de entrega inmediata), `_avisar*` (crean notificaciones), `_semana_de`, `_sabado_actual`, `_corte_nomina`.

## Triggers
| Tabla | Trigger | Qué hace |
|---|---|---|
| `ventas`, `venta_items`, `abonos`, `clientes`, `catalogo`, `disponibles` | `bloquear_trabajador` | Un trabajador no puede escribir aquí (salvo `app.paso_confiable`). |
| `ventas` | `ventas_fechas_estado` | Pone la fecha de cada cambio de estado. |
| `ventas` | `venta_cancelada_avisar` | Avisa al taller si se cancela. |
| `ventas` | `venta_suelta_etapas` | Libera los pasos de una venta cancelada. |
| `venta_items` | `item_fijos` | Copia del modelo lo que es fijo (protección, detalles, medidas del combo). Respeta lo ya guardado. |
| `venta_items` | `item_categoria` | Pone la categoría de pago del modelo y valida que sirva para el producto. |
| `venta_items` | `item_en_produccion_guard` | No deja cambiar productos de una venta en fabricación salvo por `editar_venta_fabricacion` (`app.edicion_fab`). |
| `abonos` | `abono_exige_comprobante` | Un pago necesita comprobante. |
| `abonos` | `abono_avisar` | Avisa a Ray que hay un pago por confirmar. |
| `catalogo` | `catalogo_categoria_guard` / `catalogo_categoria_propagar` | La categoría debe ser del producto; al cambiarla se pasa a los productos no pagados. |
| `categorias_pago` | `categoria_producto_guard` / `categoria_recalcular` | No cambiar el producto si ya la usan modelos; al cambiar tarifas recalcula montos no pagados. |
| `disponibles` | `pieza_corregida` | Corregir una pieza actualiza las ventas no entregadas (sin tocar el precio). |
| `etapas` | `etapa_protegida` | No se toca un paso ya pagado. |
| `vales` | `vale_protegido` | No se toca un vale ya descontado. |
| `pagos_trabajador` | `pago_protegido` | Un pago hecho no se cambia. |
| `notificaciones` | `notificacion_enviar` | Llama a la edge function `notificar`. |

## Storage (buckets)
| Bucket | Público | Qué guarda |
|---|---|---|
| `catalogo-fotos` | Sí | Fotos de modelos y piezas. Sube cualquiera con sesión. |
| `etapas-fotos` | Sí | Fotos del trabajo terminado (las ve el cliente en su seguimiento). Sube cualquiera con sesión. |
| `comprobantes` | No | Comprobantes de pago. Se ven con enlace firmado. |

Subir siempre con `AH.subirFoto(bucket, path, blob)` (comprime y guarda la versión chiquita). Mostrar en listas con `AH.imgMini(...)`.

## Edge functions
| Función | Para qué |
|---|---|
| `notificar` | Envía el Web Push de cada notificación. |
| `gestionar_usuarios` | Crea, cambia PIN y borra usuarios de Supabase Auth (solo admin). |
| `copiar_fotos` | Herramienta de una vez para traer las fotos de la app vieja. |

El código de las edge functions todavía no está en el repo.

## Migraciones
Las 88 migraciones aplicadas están listadas en `supabase/migrations/LEEME.md`. Ojo: varias funciones se corrigieron después con `execute_sql` (parches con `pg_get_functiondef`), así que **las migraciones no son el estado exacto de hoy**. Para saber cómo está una función, leerla en la base (`select pg_get_functiondef('public.nombre'::regproc)`).

## Pendientes de revisar (seguridad)
- Estas funciones se pueden llamar sin sesión (`anon`). Revisar que cada una rechace si no hay usuario: `editar_venta_fabricacion`, `terminar_etapa_madera`, `usuario_linea`, `_puede_pagar_a`, `_puede_madera`, `_lleva_madera`, `_categoria_sirve`, `_item_firma`, `pagado_venta`. Lo más limpio sería quitarles `execute` a `anon`.
- Ayudantes internos que puede llamar cualquiera con sesión y no deberían: `_avisar_usuario`, `_generar_etapas`, `_a_produccion_si_pagada`, `_stock_tomar`, `_stock_devolver`, `_cliente_guardar`, `_items_insertar`.
- El bucket `comprobantes` deja leer a cualquiera con sesión, también a un trabajador.
- Cualquiera con sesión puede subir a `catalogo-fotos` y `etapas-fotos` (también un trabajador al catálogo).

Nada de esto se ha cambiado: queda para un PR aparte, con el OK de los dos.
