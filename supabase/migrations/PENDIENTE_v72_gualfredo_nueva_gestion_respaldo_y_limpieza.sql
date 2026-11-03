-- Autor: Gualfredo (Claude de Gualfredo)
-- v72_gualfredo_nueva_gestion_respaldo_y_limpieza
-- PENDIENTE: NO está aplicada. Al aplicarla, renombrar este archivo a <version>_v72_gualfredo_nueva_gestion_respaldo_y_limpieza.sql
--
-- Qué hace (pedido por Gualfredo el 2 nov 2026: "mañana arranca una nueva gestión"):
-- 1. Copia COMPLETA a la tabla respaldos (origen 'gestion-hasta-2026-11-02') de ventas, productos, pagos,
--    cambios, pasos del taller, vales, pagos de nómina, entregas del depósito y notificaciones.
-- 2. Borra todo eso para que la app arranque vacía.
-- Se quedan: clientes, catálogo, piezas de entrega inmediata, usuarios, sedes, categorías de pago,
-- materiales (con su stock), compras del depósito, suscripciones push y las fotos en Storage.
-- La numeración de ventas NO se reinicia: la próxima venta sigue en 1099 (los clientes ya tienen PDF
-- y enlaces con los números 1047 a 1098; repetirlos los confundiría).
--
-- Los triggers de protección (etapa_protegida, vale_protegido, pago_protegido, bloquear_trabajador, avisos)
-- impedirían borrar o mandarían avisos: se apagan SOLO dentro de esta transacción con session_replication_role.

set local session_replication_role = replica;

-- 1. Respaldo
insert into respaldos (origen, hoja, cantidad, datos)
select 'gestion-hasta-2026-11-02', t.hoja, jsonb_array_length(t.datos), t.datos
from (
  select 'ventas' hoja,            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from ventas x), '[]'::jsonb) datos
  union all select 'venta_items',       coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from venta_items x), '[]'::jsonb)
  union all select 'abonos',            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from abonos x), '[]'::jsonb)
  union all select 'venta_cambios',     coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from venta_cambios x), '[]'::jsonb)
  union all select 'etapas',            coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from etapas x), '[]'::jsonb)
  union all select 'vales',             coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from vales x), '[]'::jsonb)
  union all select 'pagos_trabajador',  coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from pagos_trabajador x), '[]'::jsonb)
  union all select 'deposito_entregas', coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from deposito_entregas x), '[]'::jsonb)
  union all select 'notificaciones',    coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from notificaciones x), '[]'::jsonb)
) t;

-- 2. Limpieza (de los hijos a los padres)
delete from etapas;
delete from vales;
delete from pagos_trabajador;
delete from deposito_entregas;
delete from notificaciones;
delete from venta_cambios;
delete from abonos;
delete from venta_items;
delete from ventas;

-- 3. Verificación: si algo no cuadra, todo se deshace
do $$
declare r int;
begin
  select count(*) into r from respaldos where origen = 'gestion-hasta-2026-11-02';
  if r <> 9 then raise exception 'Respaldo incompleto: % hojas', r; end if;
  if exists (select 1 from ventas) or exists (select 1 from etapas) or exists (select 1 from vales)
     or exists (select 1 from pagos_trabajador) or exists (select 1 from abonos) then
    raise exception 'Quedaron datos sin borrar';
  end if;
end $$;
