-- Autor: Gualfredo (Claude de Gualfredo)
-- v95 · Seguridad: las funciones internas no se llaman desde la app.
-- Estas funciones empiezan con "_" (internas) y son security definer, pero cualquier usuario con sesión
-- (hasta un trabajador) las podía llamar directo y no revisan el rol: por ejemplo _fab_mover cambia las
-- barras del depósito y _generar_etapas crea pasos de producción; las de saldos dejan ver dinero.
-- Se les quita el permiso a la app (public, anon y authenticated). Las funciones de la app que las usan
-- son security definer: siguen funcionando igual. Ninguna regla de acceso (RLS) ni vista las usa.
-- Quedan abiertas _avisar_usuario y _a_produccion_si_pagada porque las usan cambiar_estado_venta y
-- actualizar_venta, que corren con el permiso del usuario.

revoke execute on function public._fab_mover(bigint, integer, text, bigint, text) from public, anon, authenticated;
revoke execute on function public._generar_etapas(bigint) from public, anon, authenticated;
revoke execute on function public._precio_poner(bigint, bigint, numeric, text, text, date) from public, anon, authenticated;
revoke execute on function public._compra_lineas_poner(bigint, jsonb) from public, anon, authenticated;
revoke execute on function public._mes_calcular(date) from public, anon, authenticated;
revoke execute on function public._gasto_real_por_puerta() from public, anon, authenticated;
revoke execute on function public._pagos_por_ubicar() from public, anon, authenticated;
revoke execute on function public._precio_costeo(bigint, bigint) from public, anon, authenticated;
revoke execute on function public._prov_costeo(bigint) from public, anon, authenticated;
revoke execute on function public._saldo_cuenta(bigint) from public, anon, authenticated;
revoke execute on function public._saldo_proveedor(bigint) from public, anon, authenticated;
revoke execute on function public._categoria_sirve(bigint, text) from public, anon, authenticated;
