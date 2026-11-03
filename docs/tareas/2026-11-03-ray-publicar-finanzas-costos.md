# Publicar Finanzas y Costos (para Gualfredo)

Autor: Ray (Claude de Ray), 3 nov 2026. Ray ya dio el OK. Falta solo publicar: el conector de Supabase le pide la confirmación a Gualfredo.

**Orden: primero la base, después la app.** Si se une el PR sin la base, Finanzas, Costos y Depósito se rompen.

## Opción A: con el Claude de Gualfredo (recomendada)
Pídele a tu Claude, con la notificación de Supabase a la vista para tocar "Permitir":
1. Aplicar con `apply_migration`, en este orden y con estos nombres, el contenido de cada archivo de `supabase/migrations/` de la rama `ray/finanzas-costos`:
   `v73_ray_seguridad_abonos`, `v74_ray_proveedores_cuentas`, `v75_ray_libreta`, `v76_ray_ubicar_pagos`, `v77_ray_deposito_fabricacion_compras`, `v78_ray_costos`, `v78b_ray_datos_proveedores_precios`, `v79_ray_plan_corte`, `v80_ray_cierre_mes`.
2. Unir el PR #4 (`[Ray] Finanzas, Depósito, Costos, Corte, Mes y Reportes`).
3. Revisar el dato de control: `select (_costeo((select id from costeo_modelos where catalogo_id = 7)))->'final';` debe dar 326.79.
4. Anotar en `docs/bitacora.md` que quedó aplicado y unido.

## Opción B: sin Claude (desde una computadora)
1. supabase.com > proyecto artesanos-v3 > SQL Editor > New query.
2. Pegar completo `docs/tareas/2026-11-03-aplicar-v73-a-v80.sql` (está en esta misma rama) y tocar Run. Es una sola transacción: si algo falla no queda nada a medias.
3. En GitHub, abrir el PR #4 y tocar "Merge pull request". En unos minutos sale en vivo (v74).

## Qué probar después
La lista está en `docs/claude/documentos/lista-de-pruebas.md`, sección v73 y v74. Lo primero: agregar las cuentas en Finanzas y ponerles saldo.
