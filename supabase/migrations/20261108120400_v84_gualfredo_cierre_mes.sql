-- Autor: Gualfredo (Claude de Gualfredo)
-- v84 · Cierre del mes como lista de pasos y gastos fijos (lote 6 de la reestructura de Costos).
-- Pasos: 1 Cuentas (lo que dice el banco) · 2 Contar el Depósito · 3 Cuadrar cada proveedor · 4 Revisar y cerrar.
-- El primer cierre es el arranque: además se crean las cuentas y se pone el saldo inicial de cada proveedor.
-- Reusa saldo_cambiar (diferencias con motivo), conteo_guardar y el cierre de v80. Nada se borra.
-- No deja cerrar con compras en camino sin decidir. Al cerrar, los gastos fijos se reparten entre las puertas vendidas
-- en ese mes (las que usa Costos el mes siguiente); si no hubo ventas, 25.
-- Gastos fijos: se agrega "Flete" (puede ser 0) si no existe.

create table if not exists public.cierres_pasos (
  id bigint generated always as identity primary key,
  mes date not null check (extract(day from mes) = 1),
  paso text not null check (paso in ('cuenta','deposito','proveedor')),
  ref_id bigint,
  dato jsonb not null default '{}'::jsonb,
  hecho_por uuid references auth.users(id),
  hecho_en timestamptz not null default now()
);
create unique index if not exists cierres_pasos_uq on public.cierres_pasos (mes, paso, coalesce(ref_id, 0));
alter table public.cierres_pasos enable row level security;
drop policy if exists "pasos del cierre lee quien confirma pagos" on public.cierres_pasos;
create policy "pasos del cierre lee quien confirma pagos" on public.cierres_pasos for select using (_es_ray());

insert into public.gastos_fijos (categoria, monto, orden)
select 'Flete', 0, coalesce((select max(orden) from public.gastos_fijos), 0) + 1
where not exists (select 1 from public.gastos_fijos where lower(categoria) = 'flete');

-- Puertas vendidas en un mes (ventas confirmadas, sin cotizaciones, canceladas ni exhibición)
create or replace function public._puertas_vendidas(p_mes date)
 returns int language sql stable security definer set search_path to 'public'
as $$
  select coalesce(sum(vi.cantidad), 0)::int from venta_items vi join ventas v on v.id = vi.venta_id
  where v.estado not in ('cotizacion','cancelada') and not coalesce(v.interna, false)
    and v.confirmada_en >= date_trunc('month', p_mes) and v.confirmada_en < date_trunc('month', p_mes) + interval '1 month';
$$;

-- Lo que necesita la lista del cierre de un mes
create or replace function public.cierre_datos(p_mes date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare m date := date_trunc('month', p_mes)::date; fin date := (date_trunc('month', p_mes) + interval '1 month')::date;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'El cierre es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'mes', m,
    'cerrado', exists (select 1 from cierres_mes where mes = m),
    'primero', not exists (select 1 from cierres_mes),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'moneda', c.moneda, 'saldo', _saldo_cuenta(c.id),
        'hecho', (select jsonb_build_object('en', x.hecho_en, 'dato', x.dato) from cierres_pasos x where x.mes = m and x.paso = 'cuenta' and x.ref_id = c.id)) order by c.orden, c.id)
      from cuentas c where c.activa), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'saldo', _saldo_proveedor(p.id),
        'inicio', (select coalesce(round(sum(monto_proveedor), 2), 0) from movimientos where proveedor_id = p.id and anulado_en is null and fecha < m),
        'compras', (select coalesce(round(-sum(monto_proveedor), 2), 0) from movimientos where proveedor_id = p.id and anulado_en is null and tipo = 'compra' and fecha >= m and fecha < fin),
        'pagos', (select coalesce(round(sum(monto_proveedor), 2), 0) from movimientos where proveedor_id = p.id and anulado_en is null and tipo <> 'compra' and tipo <> 'ajuste' and fecha >= m and fecha < fin),
        'hecho', (select jsonb_build_object('en', x.hecho_en, 'dato', x.dato) from cierres_pasos x where x.mes = m and x.paso = 'proveedor' and x.ref_id = p.id)) order by p.principal desc, p.nombre)
      from proveedores p where p.activo), '[]'::jsonb),
    'deposito', jsonb_build_object('hecho', (select jsonb_build_object('en', x.hecho_en, 'dato', x.dato) from cierres_pasos x where x.mes = m and x.paso = 'deposito'),
      'fab', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'nombre', f.nombre, 'pres', f.presentacion, 'stock', f.stock,
          'retazos', (select count(*) from material_retazos r where r.material_id = f.id and r.usado_en is null)) order by f.orden, f.id) from materiales_fab f where f.activo), '[]'::jsonb)),
    'en_camino', (select count(distinct grupo) from compras_pedidas where estado = 'pedida'),
    'puertas', _puertas_vendidas(m)
  );
end $$;

-- Marcar un paso del cierre. Si lo real no coincide con la app, la diferencia queda con motivo (saldo_cambiar / conteo_guardar).
-- paso 'cuenta': p {saldo (lo que dice el banco), motivo?} · 'proveedor': p {debo (lo que dice que le debes; a favor en negativo), motivo?}
-- 'deposito': p {conteo:[{material_id, contado}]}
create or replace function public.cierre_paso(p_mes date, p_paso text, p_ref bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare m date := date_trunc('month', p_mes)::date; real numeric; app numeric; mot text := nullif(trim(p->>'motivo'),''); r jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'El cierre es solo para Ray o Gualfredo'; end if;
  if exists (select 1 from cierres_mes where mes = m) then raise exception 'Ese mes ya está cerrado'; end if;
  if p_paso = 'cuenta' then
    if not exists (select 1 from cuentas where id = p_ref) then raise exception 'No existe esa cuenta'; end if;
    real := nullif(p->>'saldo','')::numeric; if real is null then raise exception 'Escribe lo que dice el banco'; end if;
    app := _saldo_cuenta(p_ref);
    if abs(real - app) > 0.005 then
      if mot is null then raise exception 'No cuadra: escribe el motivo'; end if;
      r := saldo_cambiar(jsonb_build_object('cuenta_id', p_ref, 'nuevo', real, 'motivo', 'Cierre de ' || to_char(m, 'MM/YYYY') || ': ' || mot));
    end if;
    r := jsonb_build_object('app', app, 'real', real);
  elsif p_paso = 'proveedor' then
    if not exists (select 1 from proveedores where id = p_ref) then raise exception 'No existe ese proveedor'; end if;
    real := nullif(p->>'debo','')::numeric; if real is null then raise exception 'Escribe lo que dice el proveedor'; end if;
    app := _saldo_proveedor(p_ref);
    if abs(-real - app) > 0.005 then
      if mot is null then raise exception 'No cuadra: escribe el motivo'; end if;
      perform saldo_cambiar(jsonb_build_object('proveedor_id', p_ref, 'nuevo', -real, 'motivo', 'Cierre de ' || to_char(m, 'MM/YYYY') || ': ' || mot));
    end if;
    r := jsonb_build_object('app', app, 'real', -real);
  elsif p_paso = 'deposito' then
    r := conteo_guardar(jsonb_build_object('conteo', coalesce(p->'conteo', '[]'::jsonb)));
    p_ref := null;
  else raise exception 'Paso no válido'; end if;
  insert into cierres_pasos (mes, paso, ref_id, dato, hecho_por) values (m, p_paso, p_ref, r || jsonb_build_object('motivo', mot), auth.uid())
  on conflict (mes, paso, coalesce(ref_id, 0)) do update set dato = excluded.dato, hecho_por = excluded.hecho_por, hecho_en = now();
  return r;
end $$;

-- Cerrar el mes (igual que v80) sin compras en camino; deja las puertas vendidas como reparto de gastos fijos
create or replace function public.mes_cerrar(p_mes date)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare m date := date_trunc('month', p_mes)::date; n int;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cierran el mes'; end if;
  if m >= date_trunc('month', _hoy_vzla())::date then raise exception 'El mes se cierra a partir del día 1 del mes siguiente'; end if;
  if exists (select 1 from cierres_mes where mes = m) then raise exception 'Ese mes ya está cerrado'; end if;
  if exists (select 1 from compras_pedidas where estado = 'pedida') then raise exception 'Hay compras en camino sin decidir. Confírmalas o márcalas como que no llegaron'; end if;
  insert into cierres_mes (mes, datos, cerrado_por) values (m, _mes_calcular(m), auth.uid());
  n := _puertas_vendidas(m);
  update costeo_reglas set puertas_mes = case when n > 0 then n else 25 end, actualizado_en = now() where id = 1;
  return jsonb_build_object('mes', m, 'puertas', case when n > 0 then n else 25 end);
end $$;

revoke execute on function public._puertas_vendidas(date) from anon, public, authenticated;
revoke execute on function public.cierre_datos(date) from anon, public;
revoke execute on function public.cierre_paso(date, text, bigint, jsonb) from anon, public;
grant execute on function public.cierre_datos(date), public.cierre_paso(date, text, bigint, jsonb) to authenticated;
