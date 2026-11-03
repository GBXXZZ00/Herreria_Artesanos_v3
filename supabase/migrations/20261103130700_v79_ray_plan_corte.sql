-- Autor: Ray (Claude de Ray)
-- v79 · Plan de corte semanal (lote 9 de Finanzas y Costos): Costos › Semana.
-- Sale de Producción: los pasos de Hierro pendientes, con herrero y sábado, de ventas en fabricación.
-- La app sugiere cómo cortar (en el teléfono); Ray o Gualfredo lo aceptan o lo cambian y queda guardado aquí.
-- Al aceptar, cada herrero ve su hoja de corte en Mi trabajo. "Ya cortó": bajan las barras, se gastan los
-- retazos usados y se guardan los nuevos de 50 cm o más. La marca de cortado va aparte (no toca etapas).

create table if not exists public.cortes_planes (
  sab date primary key,
  firma text not null default '',
  barras jsonb not null default '[]'::jsonb,
  aceptado boolean not null default false,
  ajustado boolean not null default false,
  entregado jsonb not null default '{}'::jsonb,
  cerrado boolean not null default false,
  manual jsonb not null default '{}'::jsonb,
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now()
);
create table if not exists public.cortes_hechos (
  etapa_id bigint primary key references public.etapas(id),
  sab date not null,
  registrado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
alter table public.cortes_planes enable row level security;
alter table public.cortes_hechos enable row level security;
create policy "planes de corte lee quien confirma pagos" on public.cortes_planes for select using (_es_ray());
create policy "cortes hechos lee quien confirma pagos" on public.cortes_hechos for select using (_es_ray());

-- Lo que entra al plan: pasos de Hierro pendientes de ventas en fabricación (con o sin herrero)
create or replace function public.corte_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'El plan de corte es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'pasos', coalesce((select jsonb_agg(jsonb_build_object('eid', e.id, 'venta', v.id, 'interna', coalesce(v.interna, false),
        'cliente', case when coalesce(v.interna, false) then 'Exhibición' else coalesce(c.nombre, '') end, 'entrega', v.fecha_entrega,
        'mid', vi.catalogo_id, 'nombre', vi.nombre, 'tipo', vi.tipo, 'unidad', e.unidad,
        'de', (select count(distinct e2.unidad) from etapas e2 where e2.venta_item_id = vi.id and e2.oficio = 'hierro'),
        'tid', e.trabajador_id, 'herrero', pr.nombre, 'para', e.para_el, 'precio', vi.precio_unitario,
        'cortado', exists (select 1 from cortes_hechos h where h.etapa_id = e.id)) order by v.fecha_entrega nulls last, v.id, e.unidad)
      from etapas e join venta_items vi on vi.id = e.venta_item_id join ventas v on v.id = vi.venta_id
      left join clientes c on c.id = v.cliente_id left join perfiles pr on pr.id = e.trabajador_id
      where v.estado = 'en_produccion' and e.oficio = 'hierro' and e.estado = 'pendiente'), '[]'::jsonb),
    'aluminio', (select count(*) from etapas e join venta_items vi on vi.id = e.venta_item_id join ventas v on v.id = vi.venta_id
      where v.estado = 'en_produccion' and e.oficio = 'aluminio' and e.estado = 'pendiente'),
    'planes', coalesce((select jsonb_object_agg(p.sab::text, jsonb_build_object('firma', p.firma, 'barras', p.barras, 'aceptado', p.aceptado, 'ajustado', p.ajustado,
        'entregado', p.entregado, 'cerrado', p.cerrado, 'manual', p.manual)) from cortes_planes p where p.sab >= _hoy_vzla() - 14), '{}'::jsonb)
  );
end $$;

-- Guardar el plan (sugerencia ajustada o aceptada). p: {firma, barras, aceptado, ajustado, manual?}
create or replace function public.corte_plan_guardar(p_sab date, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare ant cortes_planes%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  if p_sab is null then raise exception 'Elige el sábado'; end if;
  if jsonb_typeof(coalesce(p->'barras', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  select * into ant from cortes_planes where sab = p_sab for update;
  if found and ant.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  if found and exists (select 1 from jsonb_each_text(ant.entregado) x where x.value = 'true') and ant.firma <> coalesce(p->>'firma','') then
    raise exception 'Ya hay herreros que cortaron con el plan anterior'; end if;
  insert into cortes_planes (sab, firma, barras, aceptado, ajustado, manual, entregado, actualizado_por, actualizado_en)
  values (p_sab, coalesce(p->>'firma',''), coalesce(p->'barras','[]'::jsonb), coalesce((p->>'aceptado')::boolean, false), coalesce((p->>'ajustado')::boolean, false),
          coalesce(p->'manual', ant.manual, '{}'::jsonb), case when found and ant.firma = coalesce(p->>'firma','') then ant.entregado else '{}'::jsonb end, auth.uid(), now())
  on conflict (sab) do update set firma = excluded.firma, barras = excluded.barras, aceptado = excluded.aceptado, ajustado = excluded.ajustado,
    manual = excluded.manual, entregado = excluded.entregado, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
  return jsonb_build_object('sab', p_sab);
end $$;

-- Marcar un paso "a mano" (modelo sin cortes) para ese sábado
create or replace function public.corte_manual(p_sab date, eid bigint)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  insert into cortes_planes (sab, manual, actualizado_por) values (p_sab, jsonb_build_object(eid::text, true), auth.uid())
  on conflict (sab) do update set manual = cortes_planes.manual || jsonb_build_object(eid::text, true), actualizado_por = auth.uid(), actualizado_en = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.corte_plan_reiniciar(p_sab date)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare ant cortes_planes%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  select * into ant from cortes_planes where sab = p_sab for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if ant.cerrado or exists (select 1 from jsonb_each_text(ant.entregado) x where x.value = 'true') then raise exception 'Ya hay herreros que cortaron con este plan'; end if;
  update cortes_planes set firma = '', barras = '[]'::jsonb, aceptado = false, ajustado = false, actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab;
  return jsonb_build_object('ok', true);
end $$;

-- Un herrero ya cortó: bajan sus barras, se gastan sus retazos y se guardan los nuevos de 50 cm o más.
-- Cuando todos cortaron, el plan se cierra y cada paso queda marcado como cortado.
create or replace function public.corte_ya_corto(p_sab date, tid uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare pl cortes_planes%rowtype; b jsonb; nom text; mid bigint; falta text := ''; r record; todos boolean;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo marcan los cortes'; end if;
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found or not pl.aceptado then raise exception 'Primero acepta el plan de corte'; end if;
  if pl.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  if coalesce((pl.entregado->>tid::text)::boolean, false) then raise exception 'Ese herrero ya estaba marcado'; end if;
  select nombre into nom from perfiles where id = tid;
  -- ¿Hay barras suficientes en el depósito?
  for r in select (x->>'mid')::bigint m, count(*) n from jsonb_array_elements(pl.barras) x where x->>'tid' = tid::text and x->>'tipo' = 'barra' group by 1 loop
    if (select stock from materiales_fab where id = r.m) < r.n then
      falta := falta || case when falta = '' then '' else ', ' end || (select nombre from materiales_fab where id = r.m); end if;
  end loop;
  if falta <> '' then raise exception 'Faltan barras de % en el depósito. Carga la compra en Depósito y vuelve a marcar', falta; end if;
  for b in select * from jsonb_array_elements(pl.barras) loop
    if b->>'tid' <> tid::text then continue; end if;
    mid := (b->>'mid')::bigint;
    if b->>'tipo' = 'barra' then
      perform _fab_mover(mid, -1, 'corte', null, 'Cortado por ' || coalesce(nom, 'el herrero') || ' · plan del ' || to_char(p_sab, 'DD/MM'));
    elsif nullif(b->>'rid','') is not null then
      update material_retazos set usado_en = now(), usado_por = auth.uid(), usado_motivo = 'Plan de corte del ' || to_char(p_sab, 'DD/MM')
      where id = (b->>'rid')::bigint and usado_en is null;
    end if;
    if coalesce((b->>'libre')::numeric, 0) >= 50 then
      insert into material_retazos (material_id, largo_cm, origen, creado_por) values (mid, round((b->>'libre')::numeric, 1), 'Corte del ' || to_char(p_sab, 'DD/MM'), auth.uid());
    end if;
  end loop;
  update cortes_planes set entregado = entregado || jsonb_build_object(tid::text, true), actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab
  returning * into pl;
  select bool_and(coalesce((pl.entregado->>t)::boolean, false)) into todos from (select distinct x->>'tid' t from jsonb_array_elements(pl.barras) x) q;
  if todos then
    update cortes_planes set cerrado = true where sab = p_sab;
    insert into cortes_hechos (etapa_id, sab, registrado_por)
    select distinct (pz->>'eid')::bigint, p_sab, auth.uid() from jsonb_array_elements(pl.barras) x, jsonb_array_elements(x->'piezas') pz
    where exists (select 1 from etapas where id = (pz->>'eid')::bigint)
    on conflict do nothing;
  end if;
  return jsonb_build_object('cerrado', coalesce(todos, false));
end $$;

-- Hoja de corte del herrero (Mi trabajo): solo sus barras de los planes aceptados y sin cerrar
create or replace function public.mi_hoja_corte()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('sab', p.sab, 'cortado', coalesce((p.entregado->>auth.uid()::text)::boolean, false),
      'barras', (select jsonb_agg(x || jsonb_build_object('material', m.nombre)) from jsonb_array_elements(p.barras) x left join materiales_fab m on m.id = (x->>'mid')::bigint
                 where x->>'tid' = auth.uid()::text),
      'pasar', (select jsonb_agg(pz || jsonb_build_object('a', pr.nombre)) from jsonb_array_elements(p.barras) x, jsonb_array_elements(x->'piezas') pz
                left join perfiles pr on pr.id::text = pz->>'tid' where x->>'tid' = auth.uid()::text and pz->>'tid' <> auth.uid()::text),
      'manual', (select jsonb_agg(jsonb_build_object('nombre', vi.nombre, 'venta', v.id)) from jsonb_each_text(p.manual) mm
                 join etapas e on e.id = mm.key::bigint join venta_items vi on vi.id = e.venta_item_id join ventas v on v.id = vi.venta_id
                 where e.trabajador_id = auth.uid() and e.estado = 'pendiente'))
      order by p.sab)
    from cortes_planes p where p.aceptado and not p.cerrado
      and (exists (select 1 from jsonb_array_elements(p.barras) x where x->>'tid' = auth.uid()::text)
           or exists (select 1 from jsonb_each_text(p.manual) mm join etapas e on e.id = mm.key::bigint where e.trabajador_id = auth.uid()))), '[]'::jsonb);
end $$;

revoke execute on function public.corte_datos() from anon, public;
revoke execute on function public.corte_plan_guardar(date, jsonb) from anon, public;
revoke execute on function public.corte_manual(date, bigint) from anon, public;
revoke execute on function public.corte_plan_reiniciar(date) from anon, public;
revoke execute on function public.corte_ya_corto(date, uuid) from anon, public;
revoke execute on function public.mi_hoja_corte() from anon, public;
grant execute on function public.corte_datos(), public.corte_plan_guardar(date, jsonb), public.corte_manual(date, bigint), public.corte_plan_reiniciar(date),
  public.corte_ya_corto(date, uuid), public.mi_hoja_corte() to authenticated;
