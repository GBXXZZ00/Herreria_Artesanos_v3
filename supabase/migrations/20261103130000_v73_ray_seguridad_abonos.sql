-- Autor: Ray (Claude de Ray)
-- v73 · Seguridad de abonos (lote 1 de Finanzas y Costos). CON CUIDADO: reglas de dinero y permisos.
-- 1) La vendedora ya no cambia ni borra abonos directo: solo lee e inserta pagos nuevos por confirmar
--    (crear_venta y convertir_en_venta los insertan). Cambiar y anular va solo por funciones.
-- 2) registrar_abono y cancelar_venta pasan a security definer y revisan el rol.
-- 3) Borrar una venta ya no borra sus abonos (sin ON DELETE CASCADE): si tiene pagos, no se borra.

drop policy if exists "abonos admin y vendedora" on public.abonos;
create policy "abonos leer admin y vendedora" on public.abonos for select using (_es_deposito());
create policy "abonos nuevo por confirmar" on public.abonos for insert
  with check (_es_deposito() and tipo = 'abono' and estado = 'por_confirmar'
              and registrado_por = auth.uid() and confirmado_por is null);

alter table public.abonos drop constraint if exists abonos_venta_id_fkey;
alter table public.abonos add constraint abonos_venta_id_fkey
  foreign key (venta_id) references public.ventas(id) on delete restrict;

create or replace function public.registrar_abono(vid bigint, a jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cur ventas%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_deposito() then raise exception 'No tienes permiso para registrar pagos'; end if;
  select * into cur from ventas where id = vid for update;
  if nullif(a->>'clave','') is not null and exists (select 1 from abonos where clave = (a->>'clave')::uuid) then
    return jsonb_build_object('id', vid, 'pagado', pagado_venta(vid), 'repetida', true);
  end if;
  if not found or cur.estado in ('cotizacion','cancelada') then raise exception 'A esta venta no se le pueden registrar pagos'; end if;
  if coalesce((a->>'monto')::numeric, 0) <= 0 then raise exception 'Escribe el monto del pago'; end if;
  if pagado_venta(vid) + (a->>'monto')::numeric > cur.total then raise exception 'El pago es mayor que lo que resta por pagar'; end if;
  insert into abonos (clave, venta_id, monto, metodo, comprobante, registrado_por)
  values (nullif(a->>'clave','')::uuid, vid, (a->>'monto')::numeric, a->>'metodo', nullif(a->>'comprobante',''), auth.uid());
  update ventas set actualizado_en = now() where id = vid;
  return jsonb_build_object('id', vid, 'pagado', pagado_venta(vid));
end $function$;

create or replace function public.cancelar_venta(vid bigint, motivo text, metodo_devolucion text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cur ventas%rowtype; pag numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_deposito() then raise exception 'No tienes permiso para cancelar'; end if;
  select * into cur from ventas where id = vid for update;
  if not found or cur.estado in ('cancelada','entregada') then raise exception 'Esta venta no se puede cancelar'; end if;
  if cur.estado <> 'cotizacion' and not _es_admin() then raise exception 'Solo un administrador puede cancelar una venta'; end if;
  pag := pagado_venta(vid);
  if pag > 0 then
    if coalesce(metodo_devolucion,'') not in ('Binance','Zelle','Bolívares','Efectivo') then raise exception 'Elige cómo se devolvió el dinero'; end if;
    insert into abonos (venta_id, tipo, monto, metodo, nota, registrado_por) values (vid, 'devolucion', pag, metodo_devolucion, 'Devolución por cancelación', auth.uid());
  end if;
  if cur.estado <> 'cotizacion' then perform _stock_devolver(vid); end if;
  update ventas set estado = 'cancelada', cancelada_en = now(), cancelada_motivo = nullif(trim(motivo),''), actualizado_en = now() where id = vid;
  return jsonb_build_object('id', vid, 'devuelto', pag);
end $function$;

revoke execute on function public.registrar_abono(bigint, jsonb) from anon, public;
revoke execute on function public.cancelar_venta(bigint, text, text) from anon, public;
grant execute on function public.registrar_abono(bigint, jsonb) to authenticated;
grant execute on function public.cancelar_venta(bigint, text, text) to authenticated;
