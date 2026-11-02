# Migraciones de artesanos-v3

Aquí van las migraciones ya aplicadas en Supabase, un archivo por migración: `<version>_<nombre>.sql`, copiadas tal cual de `supabase_migrations.schema_migrations`.

## Cómo se llenan
El texto de las 88 migraciones pesa unos 550 KB. Pasarlo a mano por el chat no garantiza una copia literal, así que se baja con la acción **"Bajar migraciones y esquema"** (`.github/workflows/bajar-migraciones.yml`):

1. Una sola vez: en GitHub, Settings > Secrets and variables > Actions > New repository secret. Nombre `SUPABASE_DB_URL`. Valor: en Supabase, botón "Connect" > "Session pooler" (la cadena `postgresql://postgres.vmrxfpgotbmmjxzizsuq:[CLAVE]@...pooler.supabase.com:5432/postgres` con la clave de la base).
2. En GitHub, Actions > "Bajar migraciones y esquema" > Run workflow, eligiendo la rama.
3. La acción solo LEE la base. Escribe los `.sql` en esta carpeta y `supabase/esquema-actual.sql` (cómo está la base hoy, con los parches que no quedaron en migraciones) y hace commit en esa misma rama.

La clave queda guardada cifrada en GitHub: no se ve en el repo ni en los registros de la acción.

## Ojo
- Varias funciones se corrigieron después con `execute_sql` (parches con `pg_get_functiondef`). Esos cambios NO están en las migraciones. Para el estado real, mirar `supabase/esquema-actual.sql` o leer la función en la base.
- Desde ahora, todo cambio de base se hace como migración nueva con nombre `vNN_que_hace` y se describe en el PR (ver `CLAUDE.md`).

## Lista (88, en orden)
| Versión | Nombre |
|---|---|
| 20260927191836 | crear_tabla_catalogo |
| 20260927212645 | crear_sedes_y_disponibles |
| 20260927222100 | crear_respaldos_app_vieja |
| 20260927222706 | importar_catalogo_app_vieja |
| 20260927231220 | sedes_direccion_mapa |
| 20260928000503 | crear_perfiles |
| 20260928001159 | escritura_solo_con_sesion |
| 20260928004114 | ventas_base |
| 20260928020955 | crear_venta |
| 20260928021023 | telefono_normalizado |
| 20260928024808 | cedula_obligatoria_sin_direccion_comprobantes |
| 20260928030002 | ventas_acciones |
| 20260928031812 | ventas_sin_duplicados_estados |
| 20260928041058 | seguimiento_pasos_notificaciones |
| 20260928042700 | avisos_total_y_formato |
| 20260928043355 | confirmar_abonos |
| 20260928044936 | estados_en_orden |
| 20260928045846 | estados_sin_saltos |
| 20260928050905 | estados_desde_e_inmediata |
| 20260928125635 | traslado_separado |
| 20260928130155 | comprobante_obligatorio |
| 20260928131225 | mensajes_pago_en_vez_de_abono |
| 20260928141634 | avisos_tarea1_reformulados |
| 20260928184204 | agregar_rol_trabajador_y_especialidad |
| 20260928192118 | especialidad_trabajador_a_arreglo |
| 20260928195947 | crear_etapas_produccion |
| 20260928200010 | generar_etapas_solo_admin |
| 20260928200155 | permiso_avisar_usuario |
| 20260928200414 | bucket_fotos_etapas |
| 20260928204428 | limpiar_categoria_pago_id_vieja |
| 20260928204435 | crear_categorias_pago |
| 20260928204535 | categoria_pago_delete_set_null |
| 20260928220402 | produccion_completa_parte1_columnas_y_categoria |
| 20260928220433 | produccion_completa_parte2_etapas_trabajador |
| 20260928220506 | produccion_completa_parte3_vales_exhibicion_permisos |
| 20260928220643 | produccion_completa_parte4_permisos_ayudantes |
| 20260928222617 | produccion_completa_parte5_correcciones_revision |
| 20260928222631 | produccion_completa_parte6_paso_confiable |
| 20260928224334 | produccion_parte7_categoria_obligatoria_y_specs_exhibicion |
| 20260929000651 | produccion_automatica_al_confirmar_pago |
| 20260929001154 | vista_trabajador_pagos_por_semana |
| 20260929005448 | confirmar_abono_solo_por_confirmar |
| 20260929013659 | produccion_lectura_vendedora |
| 20260929020517 | nomina_semanal |
| 20260929022249 | nomina_correcciones_revision |
| 20260929024039 | asignar_todo_ya_te_toca_seguimiento |
| 20260929025941 | fotos_publicas_y_bloqueo_asignar |
| 20260929060416 | combo_tope_fotos_vales |
| 20260929060441 | seguimiento_foto_y_permisos |
| 20260929061058 | nomina_vale_pendiente_en_lista |
| 20260929061256 | respaldo_fotos_google |
| 20260929064947 | etapas_solo_por_funciones |
| 20260929133322 | trabajador_en_proceso_orden_foto |
| 20260929141045 | revision_trabajador_en_proceso |
| 20260929175445 | venta_items_fijos_del_modelo |
| 20260929181535 | item_fijos_respeta_guardados |
| 20260929182755 | reglas_produccion_por_oficio |
| 20260929182854 | espera_entre_lineas_y_datos_de_oficio |
| 20260929182943 | terminar_variable_sin_choque |
| 20260929225851 | cotizacion_venta_detalles |
| 20260929225858 | exhibicion_detalles_ok |
| 20260929232822 | completar_detalles_v2 |
| 20260929234204 | deposito |
| 20260929234218 | deposito_rara_semana |
| 20260929234249 | deposito_revisar_nota |
| 20260930000326 | deposito_revision_fixes |
| 20260930000337 | deposito_comprar_inactivo |
| 20260930015241 | atajos_avisos |
| 20260930015417 | usuario_especialidades |
| 20260930021116 | atajos_revision |
| 20260930041014 | avisos_y_permisos |
| 20260930042312 | asignar_avisos_sin_duplicar |
| 20260930043834 | deposito_compra_grande_y_pendientes |
| 20260930044214 | deposito_texto_anterior |
| 20260930045237 | entrega_json_anterior |
| 20260930045425 | ventana_solo_proteccion |
| 20260930141755 | fotos_sin_mini |
| 20260930153659 | avance_venta_por_producto |
| 20260930160155 | textos_en_fabricacion |
| 20261001025947 | categorias_por_producto_aluminio_detalles |
| 20261001030059 | categoria_guard_al_cambiar_tipo |
| 20261001032331 | categoria_propagar_y_madera |
| 20261001043312 | v67_unidades_y_masilla_pintura |
| 20261007015114 | v68a_ya_hecho |
| 20261007015343 | v68b_editar_venta_fabricacion |
| 20261007020335 | v69_pieza_corregida_actualiza_venta |
| 20261007021445 | v70_puertas_de_madera |
| 20261007023130 | v70b_categoria_de_madera |
