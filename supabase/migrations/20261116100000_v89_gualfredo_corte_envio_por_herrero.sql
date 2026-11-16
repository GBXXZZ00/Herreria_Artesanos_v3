-- Autor: Gualfredo (Claude de Gualfredo)
-- v89 · Taller › Corte, base (lote 4, §3B.2 punto 1): envío del corte por herrero.
-- Hoy el plan de un sábado tiene una sola firma y un solo "aceptado": cambiar o cancelar una puerta
-- después de enviar baja barras que no tocaban. Ahora cada herrero tiene su propio envío en
-- cortes_planes.enviados = { tid: { firma, en, por, barras } }:
--   - firma: la de lo asignado a ese herrero ese sábado (sus pasos de Hierro), la calcula la base;
--   - barras: copia de lo que se le envió. Es lo que ve el herrero (mi_hoja_corte) y lo que se baja.
-- El candado compara solo las barras de cada herrero: si ya empezó el Hierro o ya cortó, su parte
-- del plan no se cambia; la de los demás sí. _corte_aplicar no baja barras si la firma de lo asignado
-- cambió después de enviar (el disparador deja el aviso en el plan).
-- Si un plan nunca se envió por herrero (enviados vacío), todo sigue como antes.

alter table public.cortes_planes add column if not exists enviados jsonb not null default '{}'::jsonb;

-- Firma de lo asignado a un herrero en un sábado: sus pasos de Hierro de pedidos no cancelados
create or replace function public._corte_firma_tid(p_sab date, tid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(coalesce(string_agg(e.id::text, ',' order by e.id), ''))
  from etapas e
  join venta_items vi on vi.id = e.venta_item_id
  join ventas v on v.id = vi.venta_id
  where e.trabajador_id = tid and e.para_el = p_sab and e.oficio = 'hierro' and v.estado <> 'cancelada'
$$;

-- ¿Ya empezó (o terminó) algún Hierro de ese sábado?
create or replace function public._corte_empezo(p_sab date, tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from etapas e where e.trabajador_id = tid and e.para_el = p_sab and e.oficio = 'hierro'
                 and (e.iniciada_en is not null or e.estado = 'hecha'))
$$;

revoke execute on function public._corte_firma_tid(date, uuid) from public, anon, authenticated;
revoke execute on function public._corte_empezo(date, uuid) from public, anon, authenticated;

-- Las barras de un herrero dentro de un arreglo de barras, en un orden fijo (para comparar)
create or replace function public._corte_barras_de(bs jsonb, tid text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) from jsonb_array_elements(coalesce(bs, '[]'::jsonb)) x where x->>'tid' = tid
$$;
revoke execute on function public._corte_barras_de(jsonb, text) from public, anon, authenticated;

-- Guardar el plan: el candado es por herrero (antes era una sola firma para todos)
create or replace function public._corte_plan_guardar_v82(p_sab date, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ant cortes_planes%rowtype; hay boolean; b jsonb; bs jsonb := '[]'::jsonb; rids bigint[] := '{}'; rid bigint; t text; nom text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  if p_sab is null then raise exception 'Elige el sábado'; end if;
  if jsonb_typeof(coalesce(p->'barras', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  select * into ant from cortes_planes where sab = p_sab for update;
  hay := found;
  if hay and ant.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  for b in select * from jsonb_array_elements(coalesce(p->'barras', '[]'::jsonb)) loop
    if b->>'tipo' = 'retazo' then
      rid := nullif(b->>'rid','')::bigint;
      if rid = any(rids) then raise exception 'Un retazo está dos veces en el plan'; end if;
      rids := rids || rid;
      if exists (select 1 from material_retazos where id = rid and usado_en is not null)
         and not (hay and coalesce((ant.entregado->>(b->>'tid'))::boolean, false)) then
        raise exception 'El retazo R-% ya se usó. Vuelve a la sugerencia', (select numero from material_retazos where id = rid); end if;
    end if;
    bs := bs || jsonb_build_array(_corte_barra(b));
  end loop;
  -- Candado por herrero: si ya cortó o ya empezó el Hierro, su parte no cambia
  if hay then
    for t in select distinct x->>'tid' from jsonb_array_elements(ant.barras || bs) x where x->>'tid' is not null loop
      if (coalesce((ant.entregado->>t)::boolean, false) or _corte_empezo(p_sab, t::uuid))
         and _corte_barras_de(ant.barras, t) <> _corte_barras_de(bs, t) then
        select nombre into nom from perfiles where id = t::uuid;
        raise exception '% ya empezó a cortar: su parte del plan no se cambia. Cuando termine, usa Corregir lo que cortó', coalesce(nom, 'Un herrero');
      end if;
    end loop;
  end if;
  insert into cortes_planes (sab, firma, barras, aceptado, ajustado, manual, no_usar, entregado, actualizado_por, actualizado_en)
  values (p_sab, coalesce(p->>'firma',''), bs, coalesce((p->>'aceptado')::boolean, false), coalesce((p->>'ajustado')::boolean, false),
          coalesce(p->'manual', ant.manual, '{}'::jsonb), coalesce(p->'no_usar', ant.no_usar, '[]'::jsonb),
          case when hay then ant.entregado else '{}'::jsonb end, auth.uid(), now())
  on conflict (sab) do update set firma = excluded.firma, barras = excluded.barras,
    aceptado = excluded.aceptado, ajustado = excluded.ajustado,
    manual = excluded.manual, no_usar = excluded.no_usar, entregado = excluded.entregado, aviso = null,
    actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
  return jsonb_build_object('sab', p_sab);
end $$;

-- Bajar las barras de un herrero cuando termina su Hierro: usa lo que se le envió
create or replace function public._corte_aplicar(p_sab date, tid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pl cortes_planes%rowtype; env jsonb; bs jsonb; b jsonb; nom text; mid bigint; falta text := ''; r record; todos boolean; libre numeric;
begin
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found then raise exception 'No hay plan de corte para ese sábado'; end if;
  if pl.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  if coalesce((pl.entregado->>tid::text)::boolean, false) then raise exception 'Ese herrero ya estaba marcado'; end if;
  select nombre into nom from perfiles where id = tid;
  env := pl.enviados -> tid::text;
  if env is not null then
    -- Si lo asignado cambió después de enviar, no se bajan barras que no tocaban
    if env->>'firma' is distinct from _corte_firma_tid(p_sab, tid) then
      raise exception 'Cambió lo asignado a % después de enviarle el corte. Revisa el plan y corrige lo que cortó', coalesce(nom, 'el herrero');
    end if;
    bs := coalesce(env->'barras', '[]'::jsonb);
  elsif pl.aceptado and pl.enviados = '{}'::jsonb then
    bs := _corte_barras_de(pl.barras, tid::text);   -- plan de antes, sin envío por herrero
  else
    raise exception 'Primero envíale el corte a %', coalesce(nom, 'el herrero');
  end if;
  for r in select (x->>'mid')::bigint m, count(*) n from jsonb_array_elements(bs) x where x->>'tipo' = 'barra' group by 1 loop
    if (select stock from materiales_fab where id = r.m) < r.n then
      falta := falta || case when falta = '' then '' else ', ' end || (select nombre from materiales_fab where id = r.m); end if;
  end loop;
  if falta <> '' then raise exception 'Faltan barras de % en el depósito. Confirma la compra y vuelve a marcar', falta; end if;
  for b in select * from jsonb_array_elements(bs) loop
    mid := (b->>'mid')::bigint;
    libre := (_corte_barra(b))->>'libre';
    if b->>'tipo' = 'barra' then
      perform _fab_mover(mid, -1, 'corte', null, 'Cortado por ' || coalesce(nom, 'el herrero') || ' · plan del ' || to_char(p_sab, 'DD/MM'));
    else
      update material_retazos set usado_en = now(), usado_por = auth.uid(), usado_motivo = 'Plan de corte del ' || to_char(p_sab, 'DD/MM')
      where id = (b->>'rid')::bigint and usado_en is null;
      if not found then raise exception 'El retazo R-% ya se usó', (select numero from material_retazos where id = (b->>'rid')::bigint); end if;
    end if;
    if libre >= _retazo_minimo(mid) then
      insert into material_retazos (material_id, largo_cm, origen, creado_por, plan_sab) values (mid, round(libre, 1), 'Corte del ' || to_char(p_sab, 'DD/MM'), auth.uid(), p_sab);
    end if;
  end loop;
  update cortes_planes set entregado = entregado || jsonb_build_object(tid::text, true), aviso = null, actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab
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

-- Al terminar el último Hierro de un herrero: bajar sus barras si se le envió el corte
create or replace function public._corte_al_terminar_hierro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare pl cortes_planes%rowtype;
begin
  if new.oficio is distinct from 'hierro' or new.estado <> 'hecha' or old.estado = 'hecha' or new.para_el is null or new.trabajador_id is null then return new; end if;
  select * into pl from cortes_planes where sab = new.para_el;
  if not found or pl.cerrado or coalesce((pl.entregado->>new.trabajador_id::text)::boolean, false) then return new; end if;
  if not (pl.enviados ? new.trabajador_id::text
          or (pl.aceptado and pl.enviados = '{}'::jsonb and exists (select 1 from jsonb_array_elements(pl.barras) x where x->>'tid' = new.trabajador_id::text))) then
    return new;
  end if;
  if exists (select 1 from etapas e where e.trabajador_id = new.trabajador_id and e.para_el = new.para_el and e.oficio = 'hierro' and e.estado <> 'hecha' and e.id <> new.id) then return new; end if;
  begin
    perform _corte_aplicar(new.para_el, new.trabajador_id);
  exception when others then
    update cortes_planes set aviso = 'No se pudieron bajar las barras de ' || coalesce((select nombre from perfiles where id = new.trabajador_id), 'un herrero') || ': ' || sqlerrm
    where sab = new.para_el;
  end;
  return new;
end $$;

-- Deshacer el envío a un herrero (solo si no empezó)
create or replace function public.corte_deshacer_envio(p_sab date, p_tid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pl cortes_planes%rowtype; nom text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found or not (pl.enviados ? p_tid::text) then raise exception 'A ese herrero no se le ha enviado el corte'; end if;
  select nombre into nom from perfiles where id = p_tid;
  if coalesce((pl.entregado->>p_tid::text)::boolean, false) or _corte_empezo(p_sab, p_tid) then
    raise exception '% ya empezó a cortar: el envío no se deshace', coalesce(nom, 'El herrero'); end if;
  update cortes_planes set enviados = enviados - p_tid::text, actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab;
  return jsonb_build_object('sab', p_sab, 'tid', p_tid);
end $$;
revoke execute on function public.corte_deshacer_envio(date, uuid) from public, anon;
grant execute on function public.corte_deshacer_envio(date, uuid) to authenticated;

-- La hoja del herrero: ve lo último que se le envió, no lo que Ray está cambiando
create or replace function public.mi_hoja_corte()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare yo text := auth.uid()::text;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('sab', q.sab, 'cortado', coalesce((q.entregado->>yo)::boolean, false),
      'enviado_en', q.enviado_en,
      'barras', (select jsonb_agg(x || jsonb_build_object('material', m.nombre, 'minimo', _retazo_minimo(m.id),
                   'num', (select r.numero from material_retazos r where r.id = nullif(x->>'rid','')::bigint)))
                 from jsonb_array_elements(q.bs) x left join materiales_fab m on m.id = (x->>'mid')::bigint),
      'pasar', (select jsonb_agg(pz || jsonb_build_object('a', pr.nombre)) from jsonb_array_elements(q.bs) x, jsonb_array_elements(x->'piezas') pz
                left join perfiles pr on pr.id::text = pz->>'tid' where pz->>'tid' <> yo),
      'manual', (select jsonb_agg(jsonb_build_object('nombre', vi.nombre, 'venta', v.id)) from jsonb_each_text(q.manual) mm
                 join etapas e on e.id = mm.key::bigint join venta_items vi on vi.id = e.venta_item_id join ventas v on v.id = vi.venta_id
                 where e.trabajador_id = auth.uid() and e.estado = 'pendiente'),
      'extras_mano', coalesce((select jsonb_agg(x) from jsonb_array_elements(q.extras_mano) x where x->>'tid' = yo), '[]'::jsonb))
      order by q.sab)
    from (select p.sab, p.entregado, p.manual, p.extras_mano,
            case when p.enviados ? yo then coalesce(p.enviados->yo->'barras', '[]'::jsonb)
                 when p.aceptado and p.enviados = '{}'::jsonb then _corte_barras_de(p.barras, yo)
                 else '[]'::jsonb end bs,
            p.enviados->yo->>'en' enviado_en
          from cortes_planes p where not p.cerrado) q
    where jsonb_array_length(q.bs) > 0
       or exists (select 1 from jsonb_each_text(q.manual) mm join etapas e on e.id = mm.key::bigint where e.trabajador_id = auth.uid())), '[]'::jsonb);
end $$;

-- Lo que lee la pantalla del Corte: cada plan con sus envíos, quién ya empezó y la firma de hoy
create or replace function public.corte_datos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d jsonb;
begin
  d := _corte_datos_v82();
  return d || jsonb_build_object(
    'pasos', coalesce((select jsonb_agg(p || jsonb_build_object('esp', (select vi.especificaciones from etapas e join venta_items vi on vi.id = e.venta_item_id where e.id = (p->>'eid')::bigint)))
      from jsonb_array_elements(d->'pasos') p), '[]'::jsonb),
    'planes', coalesce((select jsonb_object_agg(k, v || jsonb_build_object(
        'extras_mano', coalesce(cp.extras_mano, '[]'::jsonb),
        'enviados', coalesce((select jsonb_object_agg(t, e || jsonb_build_object('firma_hoy', _corte_firma_tid(k::date, t::uuid), 'empezo', _corte_empezo(k::date, t::uuid)))
                              from jsonb_each(cp.enviados) en(t, e)), '{}'::jsonb)))
      from jsonb_each(d->'planes') x(k, v) left join cortes_planes cp on cp.sab = k::date), '{}'::jsonb));
end $$;

-- Sugerir de nuevo: no si alguien ya cortó o ya empezó a cortar con lo que se le envió
create or replace function public.corte_plan_reiniciar(p_sab date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare ant cortes_planes%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  select * into ant from cortes_planes where sab = p_sab for update;
  if not found then return jsonb_build_object('ok', true); end if;
  if ant.cerrado or exists (select 1 from jsonb_each_text(ant.entregado) x where x.value = 'true') then raise exception 'Ya hay herreros que cortaron con este plan'; end if;
  if exists (select 1 from jsonb_object_keys(ant.enviados) t where _corte_empezo(p_sab, t::uuid)) then
    raise exception 'Ya hay un herrero cortando con lo que se le envió: el plan no se rehace'; end if;
  update cortes_planes set firma = '', barras = '[]'::jsonb, aceptado = false, ajustado = false, no_usar = '[]'::jsonb, aviso = null,
    actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab;
  return jsonb_build_object('ok', true);
end $$;
