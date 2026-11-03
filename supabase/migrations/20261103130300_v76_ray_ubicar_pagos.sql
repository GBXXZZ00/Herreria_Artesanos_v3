-- Autor: Ray (Claude de Ray)
-- v76 · Pagos por confirmar y por ubicar (lote 4 de Finanzas y Costos). CON CUIDADO: dinero y permisos.
-- Confirmar un pago se hace en Finanzas y en el mismo paso se dice dónde quedó: una cuenta nuestra,
-- un proveedor (queda a nuestro favor) o "después" (queda por ubicar, con aviso en Inicio).
-- La regla de confirmar_abono no cambia (al 50 % pasa solo a producción): se llama tal cual.
-- Las devoluciones de ventas canceladas también se ubican: de qué cuenta salió el dinero.

alter table public.abonos add column if not exists ubicado_en timestamptz;
alter table public.abonos add column if not exists ubicado_por uuid references auth.users(id);
create unique index if not exists movimientos_abono_uq on public.movimientos (abono_id) where abono_id is not null and anulado_en is null;

-- Dónde quedó un pago ya confirmado (o de dónde salió una devolución). p: {cuenta_id | proveedor_id}
create or replace function public.pago_ubicar(aid bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare ab abonos%rowtype; cid bigint := nullif(p->>'cuenta_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint;
  sg int; mon text; nid bigint; ref text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo ubican pagos'; end if;
  select * into ab from abonos where id = aid for update;
  if not found then raise exception 'No existe ese pago'; end if;
  if ab.tipo = 'abono' and ab.estado <> 'confirmado' then raise exception 'Primero confirma el pago'; end if;
  if ab.estado = 'rechazado' then raise exception 'Ese pago no llegó'; end if;
  if ab.ubicado_en is not null then raise exception 'Ese pago ya está ubicado'; end if;
  if (cid is null) = (pid is null) then raise exception 'Elige una cuenta o un proveedor'; end if;
  sg := case when ab.tipo = 'devolucion' then -1 else 1 end;
  if pid is not null and sg < 0 then raise exception 'Una devolución sale de una cuenta'; end if;
  ref := case when sg < 0 then 'Devolución N° ' else 'Pago N° ' end || ab.venta_id;
  if cid is not null then
    perform _cuenta_activa(cid);
    select moneda into mon from cuentas where id = cid;
    insert into movimientos (tipo, cuenta_id, monto_cuenta, monto_llego, monto_bs, tasa, referencia, nota, abono_id, registrado_por)
    values ('ubicar', cid, sg * ab.monto, ab.monto, case when mon = 'VES' then ab.monto_bs end, case when mon = 'VES' then ab.tasa end,
            ref, case when sg < 0 then 'Salió de la cuenta' else 'Quedó en la cuenta' end, aid, auth.uid())
    returning id into nid;
  else
    if not exists (select 1 from proveedores where id = pid) then raise exception 'No existe ese proveedor'; end if;
    insert into movimientos (tipo, proveedor_id, monto_proveedor, monto_llego, referencia, nota, abono_id, registrado_por)
    values ('ubicar', pid, ab.monto, ab.monto, ref, 'Se transfirió directo al proveedor', aid, auth.uid())
    returning id into nid;
  end if;
  update abonos set ubicado_en = now(), ubicado_por = auth.uid() where id = aid;
  return jsonb_build_object('id', nid);
end $$;

-- Confirmar y ubicar en un solo paso. p: {cuenta_id?, proveedor_id?} (vacío = "después", queda por ubicar)
create or replace function public.pago_confirmar_y_ubicar(aid bigint, llego boolean, nota text, p jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo confirman los pagos'; end if;
  if not llego and nullif(trim(nota), '') is null then raise exception 'Escribe qué pasó'; end if;
  if llego and nullif(p->>'cuenta_id','') is not null and nullif(p->>'proveedor_id','') is not null then raise exception 'Elige una cuenta o un proveedor'; end if;
  r := confirmar_abono(aid, llego, nota);
  if llego and (nullif(p->>'cuenta_id','') is not null or nullif(p->>'proveedor_id','') is not null) then
    perform pago_ubicar(aid, p);
    r := r || jsonb_build_object('ubicado', true);
  end if;
  return r;
end $$;

-- Al anular el movimiento de un pago ubicado, el pago vuelve a "por ubicar".
create or replace function public.movimiento_anular(mid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare x movimientos%rowtype; mot text := nullif(trim(motivo),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo anulan movimientos'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  select * into x from movimientos where id = mid for update;
  if not found then raise exception 'No existe ese movimiento'; end if;
  if x.anulado_en is not null then raise exception 'Ese movimiento ya estaba anulado'; end if;
  update movimientos set anulado_en = now(), anulado_por = auth.uid(), anulado_motivo = mot
  where (id = mid or (x.grupo is not null and grupo = x.grupo)) and anulado_en is null;
  if x.abono_id is not null then update abonos set ubicado_en = null, ubicado_por = null where id = x.abono_id; end if;
  return jsonb_build_object('id', mid);
end $$;

-- Pagos por ubicar: confirmados sin ubicar y devoluciones sin decir de qué cuenta salieron.
create or replace function public._pagos_por_ubicar()
 returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'venta_id', a.venta_id, 'monto', a.monto, 'metodo', a.metodo, 'tipo', a.tipo,
      'monto_bs', a.monto_bs, 'tasa', a.tasa, 'confirmado_en', coalesce(a.confirmado_en, a.fecha), 'cliente', coalesce(c.nombre, 'Exhibición')) order by a.fecha), '[]'::jsonb)
  from abonos a join ventas v on v.id = a.venta_id left join clientes c on c.id = v.cliente_id
  where a.ubicado_en is null and ((a.tipo = 'abono' and a.estado = 'confirmado') or (a.tipo = 'devolucion' and a.estado <> 'rechazado'))
$$;

-- Avisos de Finanzas para Inicio (cuentas, sin montos de más). Solo quien confirma pagos.
create or replace function public.finanzas_avisos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null or not _es_ray() then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'por_confirmar', (select count(*) from abonos where estado = 'por_confirmar' and tipo = 'abono'),
    'por_ubicar', jsonb_array_length(_pagos_por_ubicar()) + (select count(*) from movimientos where por_ubicar and anulado_en is null),
    'debes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'saldo', _saldo_proveedor(p.id)))
       from proveedores p where p.activo and _saldo_proveedor(p.id) < -0.005), '[]'::jsonb),
    'gastos_sin_cargar', coalesce((select jsonb_agg(g.categoria order by g.orden) from gastos_fijos g
       where g.activo and g.monto > 0 and not exists (select 1 from movimientos m where m.tipo = 'gasto' and m.anulado_en is null
         and lower(m.categoria) = lower(g.categoria) and date_trunc('month', m.fecha) = date_trunc('month', _hoy_vzla()))), '[]'::jsonb)
  );
end $$;

-- finanzas_datos con los pagos por ubicar
create or replace function public.finanzas_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Finanzas es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'hoy', _hoy_vzla(),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'moneda', c.moneda, 'orden', c.orden,
        'activa', c.activa, 'nota', c.nota) order by c.orden, c.id) from cuentas c), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rif', p.rif, 'telefono', p.telefono, 'tipos', to_jsonb(p.tipos),
        'iva', p.cobra_iva, 'principal', p.principal, 'datos_pago', p.datos_pago, 'nota', p.nota, 'activo', p.activo,
        'cuadre', case when p.cuadre_fecha is null then null else jsonb_build_object('fecha', p.cuadre_fecha, 'saldo', p.cuadre_saldo) end) order by p.nombre) from proveedores p), '[]'::jsonb),
    'movs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'cuenta', m.cuenta_id, 'prov', m.proveedor_id,
        'ec', m.monto_cuenta, 'ep', m.monto_proveedor, 'salio', m.monto_salio, 'llego', m.monto_llego, 'comision', m.comision,
        'bs', m.monto_bs, 'tasa', m.tasa, 'tasa_origen', m.tasa_origen, 'cat', m.categoria, 'ref', m.referencia, 'nota', m.nota, 'comp', m.comprobante, 'grupo', m.grupo,
        'abono', m.abono_id, 'pago', m.pago_id, 'vale', m.vale_id, 'compra', m.compra_id, 'por_ubicar', m.por_ubicar,
        'por', coalesce(pr.nombre, ''), 'creado_en', m.creado_en,
        'anulado', case when m.anulado_en is null then null else jsonb_build_object('fecha', (m.anulado_en at time zone 'America/Caracas')::date,
           'motivo', m.anulado_motivo, 'por', coalesce(pa.nombre, '')) end) order by m.fecha, m.id)
      from movimientos m left join perfiles pr on pr.id = m.registrado_por left join perfiles pa on pa.id = m.anulado_por), '[]'::jsonb),
    'gastosFijos', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'cat', g.categoria, 'monto', g.monto) order by g.orden, g.id)
      from gastos_fijos g where g.activo), '[]'::jsonb),
    'porConfirmar', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'venta_id', a.venta_id, 'monto', a.monto, 'metodo', a.metodo,
        'comprobante', a.comprobante, 'fecha', a.fecha, 'cliente', coalesce(c.nombre, 'Exhibición'), 'total', v.total, 'estadoVenta', v.estado,
        'pagado', pagado_venta(v.id) - a.monto, 'registro', coalesce(pr.nombre, '')) order by a.fecha)
      from abonos a join ventas v on v.id = a.venta_id left join clientes c on c.id = v.cliente_id left join perfiles pr on pr.id = a.registrado_por
      where a.estado = 'por_confirmar' and a.tipo = 'abono'), '[]'::jsonb),
    'porUbicar', _pagos_por_ubicar(),
    'porCobrar', coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
        select jsonb_build_object('id', v.id, 'cliente', coalesce(c.nombre, 'Exhibición'), 'estado', v.estado, 'total', v.total,
          'pagado', pagado_venta(v.id), 'resta', round(v.total - pagado_venta(v.id), 2)) x
        from ventas v left join clientes c on c.id = v.cliente_id
        where v.estado in ('confirmada','en_produccion','lista') and not coalesce(v.interna, false) and v.total - pagado_venta(v.id) > 0.005) q), '[]'::jsonb)
  );
end $$;

revoke execute on function public.pago_ubicar(bigint, jsonb) from anon, public;
revoke execute on function public.pago_confirmar_y_ubicar(bigint, boolean, text, jsonb) from anon, public;
revoke execute on function public._pagos_por_ubicar() from anon, public;
revoke execute on function public.finanzas_avisos() from anon, public;
grant execute on function public.pago_ubicar(bigint, jsonb), public.pago_confirmar_y_ubicar(bigint, boolean, text, jsonb), public.finanzas_avisos() to authenticated;
