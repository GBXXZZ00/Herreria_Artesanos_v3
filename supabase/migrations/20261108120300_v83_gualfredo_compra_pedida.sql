-- Autor: Gualfredo (Claude de Gualfredo)
-- v83 · Compra pedida (amarilla), "¿Llegó?" y pago en una sola hoja (lotes 3, 4 y 5 de la reestructura de Costos).
-- · Una compra pedida es un grupo con uno o varios lugares (un proveedor cada uno) y gastos (flete, transporte).
--   Vive en compras_pedidas: NO toca el Depósito, ni la deuda, ni el dinero, ni el cierre del mes hasta que se confirma.
-- · Confirma el admin (Ray o Gualfredo). Al confirmar, cada lugar se registra con compra_guardar de siempre (entra al
--   Depósito, queda la deuda y ese precio queda como el último de ese proveedor), los gastos con gasto_guardar y el pago
--   con transferencia_guardar. Todo en una sola transacción: o queda todo o nada.
-- · Pago: Lo debo · Pagué (de una cuenta) · Una parte · Saqué dinero (de qué cuenta y cuánto; la app resta lo gastado y
--   el vuelto vuelve a la cuenta; si falta o sobra, con motivo, queda como cambio de saldo). Bolívares: la tasa la
--   escriben ellos al comprar.
-- · "No llegó": se anula ese lugar con motivo. Nada se borra.

create table if not exists public.compras_pedidas (
  id bigint generated always as identity primary key,
  grupo bigint,
  tipo text not null default 'lugar' check (tipo in ('lugar','gasto')),
  proveedor_id bigint references public.proveedores(id),
  categoria text,
  lineas jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0 check (total >= 0),
  plan_sab date,
  nota text,
  estado text not null default 'pedida' check (estado in ('pedida','confirmada','anulada')),
  compra_id bigint references public.compras(id),
  pedida_por uuid references auth.users(id),
  pedida_en timestamptz not null default now(),
  cerrada_por uuid references auth.users(id),
  cerrada_en timestamptz,
  motivo text,
  constraint compras_pedidas_lugar check ((tipo = 'lugar' and proveedor_id is not null) or (tipo = 'gasto' and categoria is not null))
);
create index if not exists compras_pedidas_estado_idx on public.compras_pedidas (estado, grupo);
alter table public.compras_pedidas enable row level security;
drop policy if exists "compras pedidas lee el admin" on public.compras_pedidas;
create policy "compras pedidas lee el admin" on public.compras_pedidas for select using (_es_admin());

-- Líneas válidas de una compra: [{material_id | consumible_id | descripcion, cantidad, precio sin IVA}]
create or replace function public._compra_lineas_ok(lineas jsonb)
 returns void language plpgsql stable set search_path to 'public'
as $$
declare l jsonb;
begin
  if jsonb_typeof(coalesce(lineas, '[]'::jsonb)) <> 'array' then raise exception 'Las líneas de la compra no son válidas'; end if;
  for l in select * from jsonb_array_elements(coalesce(lineas, '[]'::jsonb)) loop
    if coalesce(nullif(l->>'cantidad','')::numeric, 0) <= 0 then raise exception 'Escribe la cantidad de cada material'; end if;
    if coalesce(nullif(l->>'precio','')::numeric, 0) < 0 then raise exception 'El precio no puede ser negativo'; end if;
    if nullif(l->>'material_id','') is null and nullif(l->>'consumible_id','') is null and nullif(trim(l->>'descripcion'),'') is null then raise exception 'Elige el material de cada línea'; end if;
    if nullif(l->>'material_id','') is not null and not exists (select 1 from materiales_fab where id = (l->>'material_id')::bigint) then raise exception 'No existe ese material'; end if;
  end loop;
end $$;

-- Pedir compra. p: {plan_sab?, nota?, lugares:[{proveedor_id, lineas}], gastos:[{categoria, monto}]}
-- El total de cada lugar es estimado con los últimos precios (con IVA si el proveedor lo cobra).
create or replace function public.compra_pedir(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare lg jsonb; g bigint; nid bigint; tot numeric; iva boolean; n int := 0;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador pide compras'; end if;
  if jsonb_array_length(coalesce(p->'lugares', '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un lugar con material'; end if;
  for lg in select * from jsonb_array_elements(p->'lugares') loop
    select cobra_iva into iva from proveedores where id = nullif(lg->>'proveedor_id','')::bigint and activo;
    if not found then raise exception 'Elige el proveedor de cada lugar'; end if;
    if jsonb_array_length(coalesce(lg->'lineas', '[]'::jsonb)) = 0 then raise exception 'Cada lugar necesita al menos un material'; end if;
    perform _compra_lineas_ok(lg->'lineas');
    select round(sum((l->>'cantidad')::numeric * coalesce(nullif(l->>'precio','')::numeric, 0)) * case when iva then 1.16 else 1 end, 2) into tot from jsonb_array_elements(lg->'lineas') l;
    insert into compras_pedidas (grupo, tipo, proveedor_id, lineas, total, plan_sab, nota, pedida_por)
    values (g, 'lugar', (lg->>'proveedor_id')::bigint, lg->'lineas', coalesce(tot, 0), nullif(p->>'plan_sab','')::date, nullif(trim(p->>'nota'),''), auth.uid()) returning id into nid;
    if g is null then g := nid; update compras_pedidas set grupo = g where id = nid; end if;
    n := n + 1;
  end loop;
  for lg in select * from jsonb_array_elements(coalesce(p->'gastos', '[]'::jsonb)) loop
    if nullif(trim(lg->>'categoria'),'') is null then raise exception 'Escribe qué gasto es'; end if;
    if coalesce(nullif(lg->>'monto','')::numeric, -1) < 0 then raise exception 'Revisa el monto del gasto'; end if;
    insert into compras_pedidas (grupo, tipo, categoria, total, plan_sab, pedida_por) values (g, 'gasto', trim(lg->>'categoria'), round((lg->>'monto')::numeric, 2), nullif(p->>'plan_sab','')::date, auth.uid());
  end loop;
  return jsonb_build_object('grupo', g, 'lugares', n);
end $$;

-- "No llegó": se anula ese lugar (o el grupo entero si no se dice cuál) con motivo
create or replace function public.compra_no_llego(pid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare r compras_pedidas%rowtype; mot text := nullif(trim(motivo),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador confirma compras'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  select * into r from compras_pedidas where id = pid for update;
  if not found or r.estado <> 'pedida' then raise exception 'Esa compra ya no está en camino'; end if;
  update compras_pedidas set estado = 'anulada', motivo = mot, cerrada_por = auth.uid(), cerrada_en = now() where id = pid;
  -- Si en el grupo no queda ningún lugar en camino, sus gastos también se anulan
  if not exists (select 1 from compras_pedidas where grupo = r.grupo and tipo = 'lugar' and estado = 'pedida') then
    update compras_pedidas set estado = 'anulada', motivo = 'No llegó la compra: ' || mot, cerrada_por = auth.uid(), cerrada_en = now() where grupo = r.grupo and tipo = 'gasto' and estado = 'pedida';
  end if;
  return jsonb_build_object('id', pid);
end $$;

-- Confirmar lo que llegó (con la factura en la mano) y cómo se pagó.
-- p: {lugares:[{pedida_id?, proveedor_id, documento?, numero?, foto?, total? (del papel), lineas}],
--     gastos:[{categoria, monto}],
--     pago:{modo:'debo'|'pague'|'parte'|'saque', cuenta_id?, monto? (una parte), sacado?, vuelto?, motivo?, tasa?, tasa_origen?, referencia?}}
-- En bolívares: cada salida lleva sus Bs (monto × tasa) y la tasa escrita.
create or replace function public.compra_confirmar(grupo_id bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare lg jsonb; ga jsonb; pg jsonb := coalesce(p->'pago', '{}'::jsonb); modo text := coalesce(nullif(p->'pago'->>'modo',''), 'debo');
  cid bigint := nullif(p->'pago'->>'cuenta_id','')::bigint; mon text; tasa numeric := nullif(p->'pago'->>'tasa','')::numeric; org text := nullif(p->'pago'->>'tasa_origen','');
  r jsonb; pr compras_pedidas%rowtype; lugares jsonb := '[]'::jsonb; x jsonb; resto numeric; paga numeric; gastado numeric := 0; esperado numeric; real_v numeric;
  sacado numeric := nullif(p->'pago'->>'sacado','')::numeric; mot text := nullif(trim(p->'pago'->>'motivo'),''); doc text; iva boolean;
  n int := 0;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador confirma compras'; end if;
  if modo not in ('debo','pague','parte','saque') then raise exception 'Elige cómo se paga'; end if;
  if jsonb_array_length(coalesce(p->'lugares', '[]'::jsonb)) = 0 then raise exception 'No hay nada que confirmar'; end if;
  if modo <> 'debo' or jsonb_array_length(coalesce(p->'gastos', '[]'::jsonb)) > 0 then
    if cid is null then raise exception 'Elige de qué cuenta salió el dinero'; end if;
    perform _cuenta_activa(cid);
    select moneda into mon from cuentas where id = cid;
    if mon = 'VES' and (tasa is null or tasa <= 0) then raise exception 'Escribe la tasa del día (Bs por dólar)'; end if;
  end if;
  -- 1) Cada lugar: la compra de siempre
  for lg in select * from jsonb_array_elements(p->'lugares') loop
    if nullif(lg->>'pedida_id','') is not null then
      select * into pr from compras_pedidas where id = (lg->>'pedida_id')::bigint for update;
      if not found or pr.grupo is distinct from grupo_id or pr.estado <> 'pedida' or pr.tipo <> 'lugar' then raise exception 'Uno de los lugares ya no está en camino'; end if;
    end if;
    if jsonb_array_length(coalesce(lg->'lineas', '[]'::jsonb)) = 0 then raise exception 'Cada lugar necesita al menos un material'; end if;
    select cobra_iva into iva from proveedores where id = nullif(lg->>'proveedor_id','')::bigint;
    doc := coalesce(nullif(lg->>'documento',''), case when iva then 'factura' else 'nota' end);
    r := compra_guardar(jsonb_build_object('proveedor_id', lg->'proveedor_id', 'documento', doc, 'numero', lg->'numero', 'foto', lg->'foto',
           'total', lg->'total', 'lineas', lg->'lineas', 'nota', case when grupo_id is not null then 'Compra pedida' end));
    if nullif(lg->>'pedida_id','') is not null then
      update compras_pedidas set estado = 'confirmada', compra_id = (r->>'id')::bigint, cerrada_por = auth.uid(), cerrada_en = now() where id = (lg->>'pedida_id')::bigint;
    end if;
    lugares := lugares || jsonb_build_array(jsonb_build_object('compra_id', r->'id', 'proveedor_id', lg->'proveedor_id', 'total', r->'total'));
    n := n + 1;
  end loop;
  -- Los gastos que se habían previsto en el grupo quedan cerrados: los reales vienen en p.gastos
  if grupo_id is not null then
    update compras_pedidas set estado = 'confirmada', cerrada_por = auth.uid(), cerrada_en = now() where grupo = grupo_id and tipo = 'gasto' and estado = 'pedida';
  end if;
  -- 2) Gastos (flete, transporte): gasto real del mes, salen de la cuenta
  for ga in select * from jsonb_array_elements(coalesce(p->'gastos', '[]'::jsonb)) loop
    if coalesce(nullif(ga->>'monto','')::numeric, 0) <= 0 then continue; end if;
    perform gasto_guardar(jsonb_build_object('cuenta_id', cid, 'categoria', coalesce(nullif(trim(ga->>'categoria'),''), 'Flete'), 'monto_salio', round((ga->>'monto')::numeric, 2),
      'monto_bs', case when mon = 'VES' then round((ga->>'monto')::numeric * tasa, 2) end, 'tasa', case when mon = 'VES' then tasa end, 'tasa_origen', org, 'referencia', 'Compra pedida'));
    gastado := gastado + round((ga->>'monto')::numeric, 2);
  end loop;
  -- 3) Pago a cada lugar
  if modo in ('pague','saque','parte') then
    resto := case when modo = 'parte' then nullif(pg->>'monto','')::numeric else null end;
    if modo = 'parte' and (resto is null or resto <= 0) then raise exception 'Escribe cuánto pagaste'; end if;
    for x in select * from jsonb_array_elements(lugares) loop
      paga := (x->>'total')::numeric;
      if resto is not null then paga := least(paga, resto); resto := resto - paga; end if;
      if paga > 0 then
        perform transferencia_guardar(jsonb_build_object('cuenta_id', cid, 'proveedor_id', x->'proveedor_id', 'monto_salio', paga, 'monto_llego', paga,
          'monto_bs', case when mon = 'VES' then round(paga * tasa, 2) end, 'tasa', case when mon = 'VES' then tasa end, 'tasa_origen', org,
          'referencia', coalesce(nullif(trim(pg->>'referencia'),''), 'Compra ' || (x->>'compra_id')), 'nota', 'Pago de la compra'));
        gastado := gastado + paga;
      end if;
    end loop;
    if modo = 'parte' and resto > 0.005 then raise exception 'Pagaste más de lo que costó la compra'; end if;
  end if;
  -- 4) Saqué dinero: el vuelto vuelve a la cuenta. Si el vuelto real no cuadra, queda la diferencia con motivo.
  if modo = 'saque' then
    if sacado is null or sacado <= 0 then raise exception 'Escribe cuánto dinero sacaste'; end if;
    esperado := round(sacado - gastado, 2);
    if esperado < -0.005 then raise exception 'Gastaste más de lo que sacaste. Revisa lo que sacaste'; end if;
    real_v := coalesce(nullif(pg->>'vuelto','')::numeric, esperado);
    if real_v < 0 then raise exception 'Revisa el vuelto'; end if;
    if abs(real_v - esperado) > 0.005 then
      if mot is null then raise exception 'El vuelto no cuadra: escribe el motivo'; end if;
      perform saldo_cambiar(jsonb_build_object('cuenta_id', cid, 'nuevo', _saldo_cuenta(cid) + (real_v - esperado),
        'motivo', 'Vuelto de la compra: ' || case when real_v < esperado then 'faltaron ' else 'sobraron ' end || to_char(abs(real_v - esperado), 'FM999990.00') || ' · ' || mot));
    end if;
  end if;
  return jsonb_build_object('compras', n, 'gastado', gastado, 'vuelto', case when modo = 'saque' then real_v end, 'saldo_cuenta', case when cid is not null then _saldo_cuenta(cid) end);
end $$;

-- Lo que está en camino (amarillo) para Costos, Depósito y Finanzas, con los saldos para decidir cómo pagar
create or replace function public.compras_en_camino()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador ve las compras'; end if;
  return jsonb_build_object(
    'grupos', coalesce((select jsonb_agg(jsonb_build_object('grupo', g.grupo, 'fecha', g.fecha, 'plan_sab', g.plan_sab,
        'lugares', (select jsonb_agg(jsonb_build_object('id', c.id, 'proveedor_id', c.proveedor_id, 'proveedor', pv.nombre, 'iva', pv.cobra_iva, 'total', c.total,
             'lineas', (select coalesce(jsonb_agg(l || jsonb_build_object('n', coalesce(mf.nombre, mc.nombre, l->>'descripcion'), 'pres', mf.presentacion)), '[]'::jsonb)
                        from jsonb_array_elements(c.lineas) l left join materiales_fab mf on mf.id = nullif(l->>'material_id','')::bigint
                        left join materiales mc on mc.id = nullif(l->>'consumible_id','')::bigint)) order by c.id)
           from compras_pedidas c join proveedores pv on pv.id = c.proveedor_id where c.grupo = g.grupo and c.tipo = 'lugar' and c.estado = 'pedida'),
        'gastos', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'categoria', c.categoria, 'total', c.total) order by c.id)
           from compras_pedidas c where c.grupo = g.grupo and c.tipo = 'gasto' and c.estado = 'pedida'), '[]'::jsonb),
        'total', (select round(sum(total), 2) from compras_pedidas c where c.grupo = g.grupo and c.estado = 'pedida')) order by g.fecha desc)
      from (select grupo, min(pedida_en) fecha, max(plan_sab) plan_sab from compras_pedidas where estado = 'pedida' and tipo = 'lugar' group by grupo) g), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipos', to_jsonb(p.tipos), 'iva', p.cobra_iva, 'saldo', _saldo_proveedor(p.id)) order by p.principal desc, p.nombre)
      from proveedores p where p.activo), '[]'::jsonb),
    'cuentas', case when _es_ray() then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'moneda', c.moneda, 'saldo', _saldo_cuenta(c.id)) order by c.orden, c.id)
      from cuentas c where c.activa), '[]'::jsonb) else '[]'::jsonb end,
    'consumibles', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre) order by lower(m.nombre)) from materiales m where m.activo), '[]'::jsonb),
    'fab', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'tipo', m.tipo, 'pres', m.presentacion, 'stock', m.stock,
        'precios', coalesce((select jsonb_object_agg(pp.proveedor_id::text, pp.precio) from material_precios pp where pp.material_id = m.id and pp.vigente), '{}'::jsonb))
        order by m.orden, m.id) from materiales_fab m where m.activo), '[]'::jsonb)
  );
end $$;

revoke execute on function public._compra_lineas_ok(jsonb) from anon, public, authenticated;
revoke execute on function public.compra_pedir(jsonb) from anon, public;
revoke execute on function public.compra_no_llego(bigint, text) from anon, public;
revoke execute on function public.compra_confirmar(bigint, jsonb) from anon, public;
revoke execute on function public.compras_en_camino() from anon, public;
grant execute on function public.compra_pedir(jsonb), public.compra_no_llego(bigint, text), public.compra_confirmar(bigint, jsonb), public.compras_en_camino() to authenticated;
