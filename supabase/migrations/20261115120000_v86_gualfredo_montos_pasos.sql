-- Autor: Gualfredo (Claude de Gualfredo)
-- v86 · Taller › Pedidos (lote 1): lo que se le paga por cada paso que falta.
-- El monto de un paso solo se guarda cuando el trabajador lo termina. Para que el
-- administrador lo vea antes (en el drawer del pedido y en la hoja de Asignar), esta
-- función lo calcula con la misma regla de pago de siempre (_monto_etapa).
-- Solo lectura y solo administradores: la vendedora nunca ve montos.
-- Si todavía no está aplicada, la pantalla funciona igual, sin esos montos.

create or replace function public.montos_pasos(p_ventas bigint[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not _es_admin() then raise exception 'No autorizado'; end if;
  if p_ventas is null or cardinality(p_ventas) = 0 then return '{}'::jsonb; end if;
  if cardinality(p_ventas) > 500 then raise exception 'Demasiados pedidos a la vez'; end if;
  return coalesce((
    select jsonb_object_agg(e.id::text, _monto_etapa(e.id))
    from etapas e
    join venta_items vi on vi.id = e.venta_item_id
    where vi.venta_id = any(p_ventas)
      and e.estado = 'pendiente'
  ), '{}'::jsonb);
end $$;

revoke execute on function public.montos_pasos(bigint[]) from public, anon;
grant execute on function public.montos_pasos(bigint[]) to authenticated;
