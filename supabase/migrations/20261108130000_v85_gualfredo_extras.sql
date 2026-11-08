-- Autor: Gualfredo (Claude de Gualfredo)
-- v85 · Extras de punta a punta (lote 7 de la reestructura de Costos).
-- Decisiones de Gualfredo (8 nov): Protección, Marco decorativo, Yeso, Vitrales, Farquilla, Ecobel, Detalles de ventana y
-- Ventana con protección son extras que el cliente pide, llevan cortes propios y cambian el pago del trabajador. El Manillón
-- es extra y cambia el pago, pero no lleva cortes. Los cortes van por modelo. Un extra sin costear se vende (monto a mano) y va
-- a producción, siempre con alerta. Si el Catálogo tiene la protección (o el marco) tildada, va incluida en el costo del modelo.
-- Las funciones de antes no se reescriben: se envuelven (la de antes queda con otro nombre y la nueva le suma los extras).

alter table public.costeo_extras add column if not exists piezas jsonb not null default '[]'::jsonb;
alter table public.costeo_extras add column if not exists ofrecer boolean not null default true;
alter table public.costeo_extras add column if not exists sin_cortes boolean not null default false;
alter table public.costeo_extras add column if not exists mano_obra numeric(10,2) check (mano_obra is null or mano_obra >= 0);
alter table public.cortes_planes add column if not exists extras_mano jsonb not null default '[]'::jsonb;

-- Costo de un extra: sus cortes (por metro usado, con IVA) + mano de obra. Protección: la tarifa de protección de la categoría
-- de pago (prot_*); los demás: la mano de obra escrita en el extra. Sin cortes (manillón): el costo escrito.
create or replace function public._extra_costo(eid bigint, pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare e costeo_extras%rowtype; cm costeo_modelos%rowtype; rg costeo_reglas%rowtype; iva numeric; prov bigint := _prov_costeo(pref);
  tot numeric := 0; falta text[] := '{}'; lineas jsonb := '[]'::jsonb; r record; pr jsonb; v numeric; cat categorias_pago%rowtype; catid bigint;
  ea jsonb; t jsonb; k text; area numeric;
begin
  select * into e from costeo_extras where id = eid;
  if not found then return null; end if;
  select * into rg from costeo_reglas where id = 1; iva := 1 + rg.iva / 100;
  if e.sin_cortes then
    if coalesce(e.costo, 0) <= 0 then falta := falta || 'costo'::text; else tot := e.costo; lineas := lineas || jsonb_build_object('g', 'Material', 'n', e.nombre, 'v', e.costo); end if;
  elsif jsonb_array_length(e.piezas) = 0 then
    falta := falta || 'cortes'::text;
  else
    for r in select (x->>0)::bigint mid, sum((x->>1)::numeric * (x->>2)::numeric) cms from jsonb_array_elements(e.piezas) x group by 1 loop
      pr := _precio_costeo(r.mid, prov);
      if pr->>'p' is null then falta := falta || ('precio de ' || (select nombre from materiales_fab where id = r.mid)); continue; end if;
      v := r.cms / 100 * (pr->>'p')::numeric * iva / ((select largo_cm from materiales_fab where id = r.mid) / 100);
      lineas := lineas || jsonb_build_object('g', 'Hierro', 'n', (select nombre from materiales_fab where id = r.mid), 'v', round(v, 2));
      tot := tot + v;
    end loop;
  end if;
  -- Mano de obra
  if e.mano_obra is not null then
    tot := tot + e.mano_obra; lineas := lineas || jsonb_build_object('g', 'Mano de obra', 'n', 'Mano de obra del extra', 'v', e.mano_obra);
  elsif e.nombre ilike 'protecci%' then
    select * into cm from costeo_modelos where id = e.modelo_id;
    select c.categoria_pago_id, c.especificaciones_base into catid, ea from catalogo c where c.id = cm.catalogo_id;
    catid := coalesce(cm.categoria_pago_id, catid);
    select * into cat from categorias_pago where id = catid;
    if found then
      area := coalesce(nullif(ea->>'alto','')::numeric, 2) * coalesce(nullif(ea->>'ancho','')::numeric, 1);
      foreach k in array array['hierro','masilla_pintura'] loop
        t := cat.tarifas -> k;
        if t is null or coalesce(nullif(t->>'prot_monto','')::numeric, 0) = 0 then continue; end if;
        v := (t->>'prot_monto')::numeric * case when t->>'prot_modo' = 'm2' then area else 1 end;
        lineas := lineas || jsonb_build_object('g', 'Mano de obra', 'n', case k when 'hierro' then 'Hierro de la protección' else 'Masilla y pintura de la protección' end, 'v', v);
        tot := tot + v;
      end loop;
    end if;
  end if;
  return jsonb_build_object('costo', case when cardinality(falta) = 0 then round(tot, 2) end, 'listo', cardinality(falta) = 0,
    'venta', case when cardinality(falta) = 0 then round(tot * (1 + rg.ganancia / 100), 2) end, 'falta', to_jsonb(falta), 'lineas', lineas);
end $$;

-- El extra de un modelo por su clave (proteccion, marco_decorativo, manillon) o por su nombre
create or replace function public._extra_de(mid bigint, k text)
 returns bigint language sql stable security definer set search_path to 'public'
as $$
  select e.id from costeo_extras e where e.modelo_id = mid and e.nombre ilike case k when 'proteccion' then 'protecci%' when 'marco_decorativo' then 'marco%' when 'manillon' then 'manill%' else k end
  order by e.orden, e.id limit 1;
$$;

-- _costeo de antes queda como _costeo_base. El nuevo suma los extras que el Catálogo trae tildados (protección, marco decorativo).
-- El manillón no se suma aquí: ya va como herraje en la ficha del modelo.
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_costeo_base' and pronamespace = 'public'::regnamespace) then
    alter function public._costeo(bigint, bigint, text) rename to _costeo_base;
  end if;
end $$;
create or replace function public._costeo(mid bigint, pref bigint default null, modo text default 'metro')
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare x jsonb; ea jsonb; cm costeo_modelos%rowtype; rg costeo_reglas%rowtype; k text; eid bigint; c jsonb; inc numeric := 0; costo numeric;
  lineas jsonb; falta jsonb; extras jsonb;
begin
  x := _costeo_base(mid, pref, modo);
  if x is null then return null; end if;
  select * into cm from costeo_modelos where id = mid;
  select * into rg from costeo_reglas where id = 1;
  select especificaciones_base into ea from catalogo where id = cm.catalogo_id;
  lineas := coalesce(x->'lineas', '[]'::jsonb); falta := coalesce(x->'falta', '[]'::jsonb);
  foreach k in array array['proteccion','marco_decorativo'] loop
    if coalesce(ea->>k, '') <> 'true' then continue; end if;
    eid := _extra_de(mid, k);
    c := case when eid is null then null else _extra_costo(eid, pref) end;
    if c is null or not coalesce((c->>'listo')::boolean, false) then
      falta := falta || to_jsonb(case k when 'proteccion' then 'cortes de la protección' else 'cortes del marco decorativo' end);
    else
      inc := inc + (c->>'costo')::numeric;
      lineas := lineas || jsonb_build_object('g', 'Extras incluidos', 'n', case k when 'proteccion' then 'Protección' else 'Marco decorativo' end, 'det', 'viene en el modelo', 'v', (c->>'costo')::numeric);
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'n', e.nombre, 'ofrecer', e.ofrecer) || coalesce(_extra_costo(e.id, pref), '{}'::jsonb) - 'lineas' order by e.orden, e.id), '[]'::jsonb)
    into extras from costeo_extras e where e.modelo_id = mid;
  costo := (x->>'costo')::numeric + inc;
  x := x || jsonb_build_object('lineas', lineas, 'falta', falta, 'listo', jsonb_array_length(falta) = 0, 'extras', extras, 'incluidos', round(inc, 2),
    'costo', round(costo, 2), 'venta', round(costo * (1 + rg.ganancia / 100), 2), 'final', round(costo * (1 + rg.ganancia / 100) + (x->>'fijos')::numeric, 2));
  if x->>'hoy' is not null then
    x := x || jsonb_build_object('ganancia', round((x->>'hoy')::numeric - (x->>'fijos')::numeric - costo, 2),
      'pct', case when costo = 0 then null else round(((x->>'hoy')::numeric - (x->>'fijos')::numeric - costo) / costo * 100, 1) end);
  end if;
  return x;
end $$;

-- Precio de los extras para la venta (la vendedora solo ve el precio, nunca el costo). Solo los que están costeados y se ofrecen.
create or replace function public.extras_precios()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return '{}'::jsonb; end if;
  if not _es_deposito() then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(q.catalogo_id::text, q.x) from (
      select cm.catalogo_id, (select jsonb_object_agg(case when e.nombre ilike 'protecci%' then 'proteccion' when e.nombre ilike 'marco%' then 'marco_decorativo'
                                   when e.nombre ilike 'manill%' then 'manillon' else lower(e.nombre) end, round((_extra_costo(e.id)->>'venta')::numeric))
                              from costeo_extras e where e.modelo_id = cm.id and e.ofrecer and coalesce((_extra_costo(e.id)->>'listo')::boolean, false)) x
      from costeo_modelos cm where cm.catalogo_id is not null) q where q.x is not null), '{}'::jsonb);
end $$;

-- Extras vendidos (en fabricación) que todavía no tienen sus cortes: para Costos y para el aviso de Inicio
create or replace function public._extras_sin_costear()
 returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('catalogo_id', q.cid, 'nombre', q.nom, 'extra', q.ext, 'k', q.k, 'n', q.n) order by q.n desc, q.nom), '[]'::jsonb) from (
    select vi.catalogo_id cid, max(vi.nombre) nom, x.ext, x.k, count(*) n
    from venta_items vi join ventas v on v.id = vi.venta_id
    cross join (values ('Protección', 'proteccion'), ('Marco decorativo', 'marco_decorativo')) x(ext, k)
    where v.estado = 'en_produccion' and vi.catalogo_id is not null and coalesce(vi.especificaciones->>x.k, '') = 'true'
      and not exists (select 1 from costeo_modelos cm where cm.catalogo_id = vi.catalogo_id and _extra_de(cm.id, x.k) is not null
                      and coalesce((_extra_costo(_extra_de(cm.id, x.k))->>'listo')::boolean, false))
    group by vi.catalogo_id, x.ext, x.k) q;
$$;

-- Avisos de Inicio (los de v80) más los extras sin costear
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_finanzas_avisos_v80' and pronamespace = 'public'::regnamespace) then
    alter function public.finanzas_avisos() rename to _finanzas_avisos_v80;
  end if;
end $$;
create or replace function public.finanzas_avisos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null or not _es_ray() then return '{}'::jsonb; end if;
  return _finanzas_avisos_v80() || jsonb_build_object('extras_sin_costear', _extras_sin_costear());
end $$;

-- Guardar el costeo (v81) con extras completos: {n, v, piezas, ofrecer, sin_cortes, mano}
create or replace function public.costeo_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare mid bigint := nullif(p->>'id','')::bigint; cid bigint := nullif(p->>'catalogo_id','')::bigint; est text := coalesce(nullif(p->>'estado',''), 'borrador');
  x jsonb; k text; i int := 0; cod text; pz jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian los costos'; end if;
  if est not in ('borrador','listo','diseno') then raise exception 'Estado no válido'; end if;
  if mid is null then
    if cid is not null and exists (select 1 from costeo_modelos where catalogo_id = cid) then select id into mid from costeo_modelos where catalogo_id = cid;
    else
      if cid is null and nullif(trim(p->>'nombre'),'') is null then raise exception 'Escribe el nombre del modelo'; end if;
      if cid is not null and not exists (select 1 from catalogo where id = cid) then raise exception 'No existe ese modelo del catálogo'; end if;
      cod := 'M-' || lpad(((select count(*) from costeo_modelos) + 1)::text, 2, '0');
      insert into costeo_modelos (catalogo_id, nombre, tipo, codigo, estado, actualizado_por)
      values (cid, case when cid is null then trim(p->>'nombre') end, case when cid is null then nullif(p->>'tipo','') end, cod, case when cid is null then 'diseno' else est end, auth.uid())
      returning id into mid;
    end if;
  end if;
  update costeo_modelos set estado = case when catalogo_id is null then 'diseno' else est end,
    categoria_pago_id = nullif(p->>'categoria_pago_id','')::bigint, nota = nullif(trim(p->>'nota'),''),
    nombre = case when catalogo_id is null then coalesce(nullif(trim(p->>'nombre'),''), nombre) else nombre end,
    tipo = case when catalogo_id is null then coalesce(nullif(p->>'tipo',''), tipo) else tipo end,
    actualizado_por = auth.uid(), actualizado_en = now()
  where id = mid;
  if not found then raise exception 'No existe ese costeo'; end if;
  delete from costeo_piezas where modelo_id = mid;
  for x in select * from jsonb_array_elements(coalesce(p->'piezas', '[]'::jsonb)) loop
    i := i + 1;
    if (x->>1)::int is null or (x->>1)::int <= 0 or (x->>2)::numeric is null or (x->>2)::numeric <= 0 then raise exception 'Revisa la cantidad y la medida de cada corte'; end if;
    if nullif(x->>4,'') is not null and x->>4 not in ('Bastidor','Marco','Divisor','Travesaño','Ranura','Vitral','Otra') then raise exception 'Revisa qué es cada pieza'; end if;
    if nullif(x->>5,'') is not null and x->>5 not in ('V','H') then raise exception 'Cada pieza va vertical (V) u horizontal (H)'; end if;
    if not exists (select 1 from materiales_fab where id = (x->>0)::bigint and presentacion = 'barra') then raise exception 'Elige un material en barra para cada corte'; end if;
    insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion)
    values (mid, (x->>0)::bigint, (x->>1)::int, (x->>2)::numeric, nullif(trim(x->>3),''), i, nullif(x->>4,''), nullif(x->>5,''));
  end loop;
  delete from costeo_hojas where modelo_id = mid;
  for x in select * from jsonb_array_elements(coalesce(p->'hojas', '[]'::jsonb)) loop
    i := i + 1;
    if (x->>1)::int is null or (x->>1)::int <= 0 or (x->>2)::numeric <= 0 or (x->>3)::numeric <= 0 then raise exception 'Revisa las medidas de cada lámina o vidrio'; end if;
    insert into costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden) values (mid, (x->>0)::bigint, (x->>1)::int, (x->>2)::numeric, (x->>3)::numeric, nullif(trim(x->>4),''), i);
  end loop;
  delete from costeo_modelo_insumos where modelo_id = mid;
  for k in select jsonb_object_keys(coalesce(p->'rend', '{}'::jsonb)) loop
    if nullif(p->'rend'->>k,'')::numeric > 0 then insert into costeo_modelo_insumos (modelo_id, insumo_id, rendimiento) values (mid, k::bigint, (p->'rend'->>k)::numeric); end if;
  end loop;
  for k in select jsonb_object_keys(coalesce(p->'acc', '{}'::jsonb)) loop
    if nullif(p->'acc'->>k,'')::numeric > 0 then
      insert into costeo_modelo_insumos (modelo_id, insumo_id, cantidad) values (mid, k::bigint, (p->'acc'->>k)::numeric)
      on conflict (modelo_id, insumo_id) do update set cantidad = excluded.cantidad;
    end if;
  end loop;
  delete from costeo_extras where modelo_id = mid;
  i := 0;
  for x in select * from jsonb_array_elements(coalesce(p->'extras', '[]'::jsonb)) loop
    i := i + 1;
    if nullif(trim(x->>'n'),'') is null or coalesce(nullif(x->>'v','')::numeric, 0) < 0 then raise exception 'Revisa los extras'; end if;
    if coalesce(nullif(x->>'mano','')::numeric, 0) < 0 then raise exception 'Revisa la mano de obra del extra'; end if;
    if jsonb_typeof(coalesce(x->'piezas', '[]'::jsonb)) <> 'array' then raise exception 'Revisa los cortes del extra'; end if;
    for pz in select * from jsonb_array_elements(coalesce(x->'piezas', '[]'::jsonb)) loop
      if (pz->>1)::int is null or (pz->>1)::int <= 0 or (pz->>2)::numeric is null or (pz->>2)::numeric <= 0 then raise exception 'Revisa la cantidad y la medida de los cortes de %', x->>'n'; end if;
      if not exists (select 1 from materiales_fab where id = (pz->>0)::bigint and presentacion = 'barra') then raise exception 'Elige un material en barra para los cortes de %', x->>'n'; end if;
    end loop;
    insert into costeo_extras (modelo_id, nombre, costo, orden, piezas, ofrecer, sin_cortes, mano_obra)
    values (mid, trim(x->>'n'), coalesce(nullif(x->>'v','')::numeric, 0), i, coalesce(x->'piezas', '[]'::jsonb), coalesce((x->>'ofrecer')::boolean, true),
            coalesce((x->>'sin_cortes')::boolean, false), nullif(x->>'mano','')::numeric);
  end loop;
  return jsonb_build_object('id', mid, 'x', _costeo(mid, null, 'metro'));
end $$;

-- Duplicar: copia también los extras completos
create or replace function public.costeo_duplicar(mid bigint)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare o costeo_modelos%rowtype; nid bigint; nom text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian los costos'; end if;
  select * into o from costeo_modelos where id = mid;
  if not found then raise exception 'No existe ese costeo'; end if;
  select coalesce(o.nombre, c.nombre) into nom from catalogo c where c.id = o.catalogo_id;
  insert into costeo_modelos (nombre, tipo, codigo, estado, categoria_pago_id, nota, actualizado_por)
  values (coalesce(nom, o.nombre) || ' (copia)', coalesce(o.tipo, (select tipo from catalogo where id = o.catalogo_id)),
          'M-' || lpad(((select count(*) from costeo_modelos) + 1)::text, 2, '0'), 'diseno',
          coalesce(o.categoria_pago_id, (select categoria_pago_id from catalogo where id = o.catalogo_id)), o.nota, auth.uid())
  returning id into nid;
  insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion) select nid, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion from costeo_piezas where modelo_id = mid;
  insert into costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden) select nid, material_id, cantidad, ancho_cm, alto_cm, nota, orden from costeo_hojas where modelo_id = mid;
  insert into costeo_modelo_insumos (modelo_id, insumo_id, rendimiento, cantidad) select nid, insumo_id, rendimiento, cantidad from costeo_modelo_insumos where modelo_id = mid;
  insert into costeo_extras (modelo_id, nombre, costo, orden, piezas, ofrecer, sin_cortes, mano_obra)
  select nid, nombre, costo, orden, piezas, ofrecer, sin_cortes, mano_obra from costeo_extras where modelo_id = mid;
  return jsonb_build_object('id', nid);
end $$;

-- Datos de Costos (v82) con los extras completos de cada modelo y los extras vendidos sin costear
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_costos_datos_v82' and pronamespace = 'public'::regnamespace) then
    alter function public.costos_datos(bigint) rename to _costos_datos_v82;
  end if;
end $$;
create or replace function public.costos_datos(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare d jsonb;
begin
  d := _costos_datos_v82(pref);
  return d || jsonb_build_object(
    'modelos', coalesce((select jsonb_agg(m || jsonb_build_object('extras', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'n', e.nombre, 'v', e.costo, 'piezas', e.piezas,
          'ofrecer', e.ofrecer, 'sin_cortes', e.sin_cortes, 'mano', e.mano_obra) order by e.orden, e.id) from costeo_extras e where e.modelo_id = (m->>'id')::bigint), '[]'::jsonb)))
      from jsonb_array_elements(d->'modelos') m), '[]'::jsonb),
    'extrasPendientes', _extras_sin_costear());
end $$;

-- Plan de corte: cada paso trae lo que se vendió (para saber si lleva protección o marco); los extras sin cortes van a mano
do $$ begin
  if not exists (select 1 from pg_proc where proname = '_corte_datos_v82' and pronamespace = 'public'::regnamespace) then
    alter function public.corte_datos() rename to _corte_datos_v82;
  end if;
  if not exists (select 1 from pg_proc where proname = '_corte_plan_guardar_v82' and pronamespace = 'public'::regnamespace) then
    alter function public.corte_plan_guardar(date, jsonb) rename to _corte_plan_guardar_v82;
  end if;
  if not exists (select 1 from pg_proc where proname = '_mi_hoja_corte_v82' and pronamespace = 'public'::regnamespace) then
    alter function public.mi_hoja_corte() rename to _mi_hoja_corte_v82;
  end if;
end $$;
create or replace function public.corte_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare d jsonb;
begin
  d := _corte_datos_v82();
  return d || jsonb_build_object(
    'pasos', coalesce((select jsonb_agg(p || jsonb_build_object('esp', (select vi.especificaciones from etapas e join venta_items vi on vi.id = e.venta_item_id where e.id = (p->>'eid')::bigint)))
      from jsonb_array_elements(d->'pasos') p), '[]'::jsonb),
    'planes', coalesce((select jsonb_object_agg(k, v || jsonb_build_object('extras_mano', coalesce((select cp.extras_mano from cortes_planes cp where cp.sab = k::date), '[]'::jsonb)))
      from jsonb_each(d->'planes') x(k, v)), '{}'::jsonb));
end $$;
create or replace function public.corte_plan_guardar(p_sab date, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare r jsonb;
begin
  r := _corte_plan_guardar_v82(p_sab, p);
  if jsonb_typeof(coalesce(p->'extras_mano', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  update cortes_planes set extras_mano = coalesce(p->'extras_mano', '[]'::jsonb) where sab = p_sab;
  return r;
end $$;
create or replace function public.mi_hoja_corte()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare d jsonb;
begin
  d := _mi_hoja_corte_v82();
  if auth.uid() is null then return d; end if;
  return coalesce((select jsonb_agg(h || jsonb_build_object('extras_mano', coalesce((select jsonb_agg(x) from cortes_planes cp, jsonb_array_elements(cp.extras_mano) x
      where cp.sab = (h->>'sab')::date and x->>'tid' = auth.uid()::text), '[]'::jsonb))) from jsonb_array_elements(d) h), '[]'::jsonb);
end $$;

-- El costo de los extras queda fijo al vender (para los reportes): en una tabla aparte que solo leen Ray y Gualfredo
create table if not exists public.venta_item_costos (
  item_id bigint primary key references public.venta_items(id) on delete cascade,
  extras jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);
alter table public.venta_item_costos enable row level security;
drop policy if exists "costo al vender lee quien confirma pagos" on public.venta_item_costos;
create policy "costo al vender lee quien confirma pagos" on public.venta_item_costos for select using (_es_ray());
create or replace function public._item_costo_extras()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare o jsonb := '{}'::jsonb; k text; mid bigint; eid bigint; c jsonb;
begin
  if new.catalogo_id is null or new.especificaciones is null then return new; end if;
  begin
    select id into mid from costeo_modelos where catalogo_id = new.catalogo_id;
    if mid is null then return new; end if;
    foreach k in array array['proteccion','marco_decorativo'] loop
      if coalesce(new.especificaciones->>k, '') <> 'true' then continue; end if;
      eid := _extra_de(mid, k); if eid is null then continue; end if;
      c := _extra_costo(eid);
      if coalesce((c->>'listo')::boolean, false) then o := o || jsonb_build_object(k, (c->>'costo')::numeric); end if;
    end loop;
    if o <> '{}'::jsonb then insert into venta_item_costos (item_id, extras) values (new.id, o) on conflict (item_id) do nothing; end if;
  exception when others then null;   -- nunca frena una venta
  end;
  return new;
end $$;
drop trigger if exists item_costo_extras on public.venta_items;
create trigger item_costo_extras after insert on public.venta_items for each row execute function public._item_costo_extras();

revoke execute on function public._extra_costo(bigint, bigint) from anon, public, authenticated;
revoke execute on function public._extra_de(bigint, text) from anon, public, authenticated;
revoke execute on function public._costeo_base(bigint, bigint, text) from anon, public, authenticated;
revoke execute on function public._extras_sin_costear() from anon, public, authenticated;
revoke execute on function public._finanzas_avisos_v80() from anon, public, authenticated;
revoke execute on function public._costos_datos_v82(bigint) from anon, public, authenticated;
revoke execute on function public._corte_datos_v82() from anon, public, authenticated;
revoke execute on function public._corte_plan_guardar_v82(date, jsonb) from anon, public, authenticated;
revoke execute on function public._mi_hoja_corte_v82() from anon, public, authenticated;
revoke execute on function public._item_costo_extras() from anon, public, authenticated;
revoke execute on function public.costos_datos(bigint) from anon, public;
revoke execute on function public.corte_datos() from anon, public;
revoke execute on function public.corte_plan_guardar(date, jsonb) from anon, public;
revoke execute on function public.mi_hoja_corte() from anon, public;
revoke execute on function public.finanzas_avisos() from anon, public;
grant execute on function public.costos_datos(bigint), public.corte_datos(), public.corte_plan_guardar(date, jsonb), public.mi_hoja_corte(), public.finanzas_avisos() to authenticated;
