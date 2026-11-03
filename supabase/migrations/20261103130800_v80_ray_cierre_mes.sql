-- Autor: Ray (Claude de Ray)
-- v80 · Finanzas › Mes (lote 10 de Finanzas y Costos): cierre y reporte mensual. CON CUIDADO: dinero.
-- Lo que ganaste (vendido con costeo − costo − gastos), dinero que entró y salió (con nómina, vales y comisión),
-- compras por proveedor, gastos fijos previsto y pagado, lo que dejó cada producto y saldos al cerrar.
-- "Cerrar el mes" congela los números. Después, ese mes solo acepta ajustes con motivo.

create table if not exists public.cierres_mes (
  mes date primary key check (extract(day from mes) = 1),
  datos jsonb not null,
  cerrado_por uuid references auth.users(id),
  cerrado_en timestamptz not null default now()
);
alter table public.cierres_mes enable row level security;
create policy "cierres lee quien confirma pagos" on public.cierres_mes for select using (_es_ray());

-- Calcula los números de un mes (p_mes = primer día del mes)
create or replace function public._mes_calcular(p_mes date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare ini date := date_trunc('month', p_mes)::date; fin date := (date_trunc('month', p_mes) + interval '1 month')::date;
  entro jsonb; salio jsonb; compras jsonb; fijos jsonb; cuentas jsonb; provs jsonb; modelos jsonb;
  vendido numeric := 0; costo numeric := 0; sin_costo numeric := 0; n_sin int := 0; puertas int := 0; gastos numeric; ajustes int;
  r record; x jsonb; costos jsonb := '{}'::jsonb; pm jsonb := '{}'::jsonb; k text;
begin
  select coalesce(jsonb_agg(jsonb_build_array('Pagos de clientes · ' || metodo, total) order by metodo), '[]'::jsonb) into entro from (
    select coalesce(a.metodo, 'Otro') metodo, round(sum(case when a.tipo = 'devolucion' then -a.monto else a.monto end), 2) total
    from abonos a where a.estado <> 'rechazado' and (a.tipo = 'devolucion' or a.estado = 'confirmado') and a.fecha >= ini and a.fecha < fin group by 1) q;
  select coalesce(jsonb_agg(jsonb_build_array(n, -t) order by o, n), '[]'::jsonb) into salio from (
    select 1 o, 'Transferencias a ' || coalesce(p.nombre, 'proveedor por ubicar') n, round(sum(coalesce(m.monto_llego, m.monto_salio)), 2) t
      from movimientos m left join proveedores p on p.id = m.proveedor_id where m.tipo = 'transferencia' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin group by 2
    union all select 2, 'Gasto · ' || m.categoria, round(sum(coalesce(m.monto_llego, m.monto_salio)), 2)
      from movimientos m where m.tipo = 'gasto' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin group by 2
    union all select 3, 'Nómina', round(sum(m.monto_llego), 2) from movimientos m where m.tipo = 'nomina' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin having count(*) > 0
    union all select 4, 'Vales (adelantos)', round(sum(m.monto_llego), 2) from movimientos m where m.tipo = 'vale' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin having count(*) > 0
    union all select 5, 'Comisión y cambio', round(sum(m.comision), 2) from movimientos m where m.anulado_en is null and m.fecha >= ini and m.fecha < fin having abs(coalesce(sum(m.comision), 0)) > 0.005
  ) q where abs(t) > 0.005;
  select coalesce(jsonb_agg(jsonb_build_array(n, t) order by n), '[]'::jsonb) into compras from (
    select p.nombre n, round(sum(c.total), 2) t from compras c join proveedores p on p.id = c.proveedor_id
    where c.anulada_en is null and c.fecha >= ini and c.fecha < fin group by p.nombre) q;
  select coalesce(sum(coalesce(m.monto_llego, m.monto_salio)), 0) + coalesce((select sum(comision) from movimientos where anulado_en is null and fecha >= ini and fecha < fin), 0)
       + coalesce((select sum(monto_llego) from movimientos where tipo in ('nomina','vale') and anulado_en is null and fecha >= ini and fecha < fin), 0)
    into gastos from movimientos m where m.tipo = 'gasto' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin;
  select coalesce(jsonb_agg(jsonb_build_object('cat', g.categoria, 'prev', g.monto, 'pagado', coalesce((select round(sum(coalesce(m.monto_llego, m.monto_salio)), 2) from movimientos m
      where m.tipo = 'gasto' and m.anulado_en is null and lower(m.categoria) = lower(g.categoria) and m.fecha >= ini and m.fecha < fin), 0)) order by g.orden), '[]'::jsonb)
    into fijos from gastos_fijos g where g.activo;
  -- Lo vendido en el mes (ventas confirmadas en el mes, sin exhibición) con su costo de Costos
  for r in select cm.catalogo_id, cm.id from costeo_modelos cm where cm.catalogo_id is not null loop
    x := _costeo(r.id, null, 'metro');
    if (x->>'listo')::boolean then costos := costos || jsonb_build_object(r.catalogo_id::text, jsonb_build_object('costo', x->'costo', 'fijos', x->'fijos')); end if;
  end loop;
  for r in select vi.catalogo_id, vi.nombre, vi.cantidad, vi.precio_unitario from venta_items vi join ventas v on v.id = vi.venta_id
           where not coalesce(v.interna, false) and v.estado not in ('cotizacion','cancelada') and v.confirmada_en >= ini and v.confirmada_en < fin loop
    puertas := puertas + r.cantidad; vendido := vendido + r.precio_unitario * r.cantidad;
    x := costos -> (r.catalogo_id::text);
    if x is not null then
      costo := costo + (x->>'costo')::numeric * r.cantidad;
      k := r.nombre;
      pm := jsonb_set(pm, array[k], jsonb_build_object('n', coalesce((pm->k->>'n')::int, 0) + r.cantidad,
        'gana', coalesce((pm->k->>'gana')::numeric, 0) + (r.precio_unitario - (x->>'costo')::numeric - (x->>'fijos')::numeric) * r.cantidad));
    else sin_costo := sin_costo + r.precio_unitario * r.cantidad; n_sin := n_sin + r.cantidad; end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_array(key || ' × ' || (value->>'n'), round((value->>'gana')::numeric, 2)) order by (value->>'gana')::numeric desc), '[]'::jsonb) into modelos from jsonb_each(pm);
  select coalesce(jsonb_agg(jsonb_build_array(c.nombre, coalesce((select round(sum(monto_cuenta), 2) from movimientos where cuenta_id = c.id and anulado_en is null and fecha < fin), 0)) order by c.orden, c.id), '[]'::jsonb) into cuentas from cuentas c;
  select coalesce(jsonb_agg(jsonb_build_array(p.nombre, coalesce((select round(sum(monto_proveedor), 2) from movimientos where proveedor_id = p.id and anulado_en is null and fecha < fin), 0)) order by p.nombre), '[]'::jsonb) into provs from proveedores p;
  select count(*) into ajustes from movimientos where tipo = 'ajuste' and anulado_en is null and fecha >= ini and fecha < fin;
  return jsonb_build_object('mes', to_char(ini, 'YYYY-MM'), 'entro', entro, 'salio', salio, 'compras', compras,
    'vendido', round(vendido, 2), 'costo', round(costo, 2), 'sinCosto', round(sin_costo, 2), 'nSin', n_sin, 'puertas', puertas,
    'gastoTot', round(coalesce(gastos, 0), 2), 'fijosPrev', (select coalesce(sum(monto), 0) from gastos_fijos where activo), 'pagadoFijo', fijos,
    'porModelo', modelos, 'cuentas', cuentas, 'proveedores', provs, 'ajustes', ajustes);
end $$;

-- Números de un mes: los congelados si está cerrado, si no los de hoy
create or replace function public.mes_datos(p_mes date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare c cierres_mes%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Finanzas es solo para Ray o Gualfredo'; end if;
  select * into c from cierres_mes where mes = date_trunc('month', p_mes)::date;
  if found then return jsonb_build_object('cerrado', true, 'fecha', (c.cerrado_en at time zone 'America/Caracas')::date, 'por', (select nombre from perfiles where id = c.cerrado_por), 'datos', c.datos); end if;
  return jsonb_build_object('cerrado', false, 'datos', _mes_calcular(p_mes));
end $$;

-- Cerrar el mes: solo meses terminados; congela los números
create or replace function public.mes_cerrar(p_mes date)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare m date := date_trunc('month', p_mes)::date;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cierran el mes'; end if;
  if m >= date_trunc('month', _hoy_vzla())::date then raise exception 'El mes se cierra a partir del día 1 del mes siguiente'; end if;
  if exists (select 1 from cierres_mes where mes = m) then raise exception 'Ese mes ya está cerrado'; end if;
  insert into cierres_mes (mes, datos, cerrado_por) values (m, _mes_calcular(m), auth.uid());
  return jsonb_build_object('mes', m);
end $$;

-- Mes cerrado: solo se aceptan ajustes con motivo (no se registra ni se anula nada más con fecha de ese mes)
create or replace function public._mes_cerrado_guard()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare f date := case when tg_op = 'UPDATE' then old.fecha else new.fecha end;
begin
  if new.tipo = 'ajuste' then return new; end if;
  if exists (select 1 from cierres_mes where mes = date_trunc('month', f)::date)
     or (tg_op = 'UPDATE' and exists (select 1 from cierres_mes where mes = date_trunc('month', new.fecha)::date)) then
    raise exception 'Ese mes ya está cerrado. Corrígelo con "Cambiar saldo" y un motivo';
  end if;
  return new;
end $$;
drop trigger if exists movimientos_mes_cerrado on public.movimientos;
create trigger movimientos_mes_cerrado before insert or update on public.movimientos for each row execute function public._mes_cerrado_guard();

-- Avisos de Inicio, versión completa: Finanzas, Costos, plan de corte y mes por cerrar
create or replace function public.finanzas_avisos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare psab date; mant date := (date_trunc('month', _hoy_vzla()) - interval '1 month')::date; n int;
begin
  if auth.uid() is null or not _es_ray() then return '{}'::jsonb; end if;
  psab := _hoy_vzla() + ((6 - extract(dow from _hoy_vzla())::int + 7) % 7);
  select count(*) into n from etapas e join venta_items vi on vi.id = e.venta_item_id join ventas v on v.id = vi.venta_id
  where v.estado = 'en_produccion' and e.oficio = 'hierro' and e.estado = 'pendiente' and e.trabajador_id is not null and e.para_el = psab
    and exists (select 1 from costeo_modelos cm join costeo_piezas p on p.modelo_id = cm.id where cm.catalogo_id = vi.catalogo_id)
    and not exists (select 1 from cortes_hechos h where h.etapa_id = e.id);
  return jsonb_build_object(
    'por_confirmar', (select count(*) from abonos where estado = 'por_confirmar' and tipo = 'abono'),
    'por_ubicar', jsonb_array_length(_pagos_por_ubicar()) + (select count(*) from movimientos where por_ubicar and anulado_en is null),
    'debes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'saldo', _saldo_proveedor(p.id)))
       from proveedores p where p.activo and _saldo_proveedor(p.id) < -0.005), '[]'::jsonb),
    'gastos_sin_cargar', coalesce((select jsonb_agg(g.categoria order by g.orden) from gastos_fijos g
       where g.activo and g.monto > 0 and not exists (select 1 from movimientos m where m.tipo = 'gasto' and m.anulado_en is null
         and lower(m.categoria) = lower(g.categoria) and date_trunc('month', m.fecha) = date_trunc('month', _hoy_vzla()))), '[]'::jsonb),
    'costeados', jsonb_build_object('listos', (select count(*) from costeo_modelos where catalogo_id is not null and estado = 'listo'), 'total', (select count(*) from catalogo)),
    'sin_costear', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)) from catalogo c
       where c.id in (select vi.catalogo_id from venta_items vi join ventas v on v.id = vi.venta_id where v.estado not in ('cotizacion','cancelada') and not coalesce(v.interna, false))
         and not exists (select 1 from costeo_modelos cm where cm.catalogo_id = c.id and cm.estado = 'listo')), '[]'::jsonb),
    'sin_cortes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)) from catalogo c
       where c.id in (select vi.catalogo_id from venta_items vi join ventas v on v.id = vi.venta_id where v.estado = 'en_produccion')
         and c.tipo in ('Puerta Multilock','Portón','Combo')
         and not exists (select 1 from costeo_modelos cm join costeo_piezas p on p.modelo_id = cm.id where cm.catalogo_id = c.id)), '[]'::jsonb),
    'plan_por_aceptar', case when n > 0 and not exists (select 1 from cortes_planes cp where cp.sab = psab and (aceptado or cerrado))
       then jsonb_build_object('sab', psab, 'n', n) end,
    'mes_sin_cerrar', case when not exists (select 1 from cierres_mes where mes = mant) and exists (select 1 from movimientos where fecha >= mant and fecha < mant + interval '1 month')
       then jsonb_build_object('mes', to_char(mant, 'YYYY-MM'), 'nombre', (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[extract(month from mant)::int]) end
  );
end $$;

revoke execute on function public._mes_calcular(date) from anon, public;
revoke execute on function public._mes_cerrado_guard() from anon, public;
revoke execute on function public.mes_datos(date) from anon, public;
revoke execute on function public.mes_cerrar(date) from anon, public;
grant execute on function public.mes_datos(date), public.mes_cerrar(date) to authenticated;
