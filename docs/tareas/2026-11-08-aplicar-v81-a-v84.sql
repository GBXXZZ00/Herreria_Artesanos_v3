-- Autor: Gualfredo (Claude de Gualfredo)
-- Las 5 migraciones de la reestructura, en orden (v81, v81b, v82, v83, v84). Pegar completo en Supabase > SQL Editor > Run.
-- Todo va en una transacción: si algo falla, no queda nada a medias.
begin;

-- ===== 20261108120000_v81_gualfredo_ficha_modelo.sql =====
-- Autor: Gualfredo (Claude de Gualfredo)
-- v81 · Ficha del modelo (lote 1 de la reestructura de Costos): una sola lista de cortes como el Costeador.
-- Cada pieza dice qué es (Bastidor, Marco, Divisor, Travesaño, Ranura, Vitral u Otra) y si va vertical (V) u
-- horizontal (H): prepara el dibujo en 3D. Reglas: despunte (cm que se botan de cada barra nueva, una vez), empieza en 0.
-- _costeo NO cambia: el costo no depende de esto (Bitral sigue en $223,22 · $290,19 · $326,79 · $339,23).

alter table public.costeo_piezas add column if not exists que_es text
  check (que_es is null or que_es in ('Bastidor','Marco','Divisor','Travesaño','Ranura','Vitral','Otra'));
alter table public.costeo_piezas add column if not exists orientacion text check (orientacion is null or orientacion in ('V','H'));
alter table public.costeo_reglas add column if not exists despunte_cm numeric(5,2) not null default 0 check (despunte_cm >= 0 and despunte_cm <= 20);

-- Piezas viejas: lo que dice su nota sugiere qué es y cómo va (solo si la nota lo dice claro; si no, queda vacío)
update public.costeo_piezas set que_es = case
    when nota ilike 'bastidor%' then 'Bastidor' when nota ilike 'marco%' then 'Marco' when nota ilike 'divisor%' then 'Divisor'
    when nota ilike 'travesa%' then 'Travesaño' when nota ilike 'ranura%' then 'Ranura' when nota ilike 'vitral%' then 'Vitral' end
  where que_es is null;
update public.costeo_piezas set orientacion = case when nota ilike '%vertical%' or nota ilike '%largo%' then 'V' when nota ilike '%horizontal%' or nota ilike '%ancho%' then 'H' end
  where orientacion is null;

-- Datos de Costos: reglas con despunte y piezas [material, cantidad, cm, nota, que_es, orientacion]
create or replace function public.costos_datos(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare prov bigint := _prov_costeo(pref);
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'prov', prov,
    'reglas', (select jsonb_build_object('iva', iva, 'ganancia', ganancia, 'puertasMes', puertas_mes, 'corte', corte_cm, 'despunte', despunte_cm,
               'gastosMes', (select coalesce(sum(monto), 0) from gastos_fijos where activo)) from costeo_reglas where id = 1),
    'gastosFijos', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'cat', g.categoria, 'monto', g.monto) order by g.orden, g.id) from gastos_fijos g where g.activo), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipos', to_jsonb(p.tipos), 'iva', p.cobra_iva, 'principal', p.principal) order by p.principal desc, p.id) from proveedores p where p.activo), '[]'::jsonb),
    'insumos', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'nombre', i.nombre, 'grupo', i.grupo, 'p', i.precio, 'r', i.rendimiento) order by i.orden, i.id) from costeo_insumos i where i.activo), '[]'::jsonb),
    'fab', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'codigo', m.codigo, 'nombre', m.nombre, 'tipo', m.tipo, 'pres', m.presentacion, 'largo', m.largo_cm,
        'hoja', case when m.presentacion = 'hoja' then jsonb_build_array(m.hoja_ancho_cm, m.hoja_alto_cm) end, 'fijo', m.precio_fijo, 'stock', m.stock, 'activo', m.activo,
        'retazos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'largo', r.largo_cm) order by r.largo_cm desc) from material_retazos r where r.material_id = m.id and r.usado_en is null and r.ancho_cm is null), '[]'::jsonb),
        'sobrantes', coalesce((select jsonb_agg(jsonb_build_array(r.largo_cm, r.ancho_cm)) from material_retazos r where r.material_id = m.id and r.usado_en is null and r.ancho_cm is not null), '[]'::jsonb),
        'precios', coalesce((select jsonb_object_agg(pp.proveedor_id::text, jsonb_build_object('p', pp.precio, 'esp', pp.espesor, 'desde', pp.desde)) from material_precios pp where pp.material_id = m.id and pp.vigente), '{}'::jsonb))
        order by m.orden, m.id) from materiales_fab m), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'producto', c.producto, 'tarifas', c.tarifas) order by c.id) from categorias_pago c where c.activo), '[]'::jsonb),
    'catalogo', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'precio_base', c.precio_base, 'categoria_pago_id', c.categoria_pago_id, 'especificaciones_base', c.especificaciones_base,
        'foto', (select v->>0 from jsonb_each(coalesce(c.fotos, '{}'::jsonb)) e(k, v) where jsonb_typeof(v) = 'array' limit 1)) order by c.tipo, c.precio_base, c.id) from catalogo c), '[]'::jsonb),
    'gastoReal', _gasto_real_por_puerta(),
    'enFabricacion', coalesce((select jsonb_agg(distinct vi.catalogo_id) from venta_items vi join ventas v on v.id = vi.venta_id
        where v.estado = 'en_produccion' and vi.catalogo_id is not null), '[]'::jsonb),
    'vendidos', coalesce((select jsonb_agg(distinct vi.catalogo_id) from venta_items vi join ventas v on v.id = vi.venta_id
        where v.estado not in ('cotizacion','cancelada') and vi.catalogo_id is not null), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', cm.id, 'catalogo_id', cm.catalogo_id, 'nombre', cm.nombre, 'tipo', cm.tipo, 'codigo', cm.codigo,
        'estado', cm.estado, 'categoria_pago_id', cm.categoria_pago_id, 'nota', cm.nota, 'actualizado_en', cm.actualizado_en,
        'piezas', coalesce((select jsonb_agg(jsonb_build_array(p.material_id, p.cantidad, p.largo_cm, coalesce(p.nota, ''), p.que_es, p.orientacion) order by p.orden, p.id) from costeo_piezas p where p.modelo_id = cm.id), '[]'::jsonb),
        'hojas', coalesce((select jsonb_agg(jsonb_build_array(h.material_id, h.cantidad, h.ancho_cm, h.alto_cm, coalesce(h.nota, '')) order by h.orden, h.id) from costeo_hojas h where h.modelo_id = cm.id), '[]'::jsonb),
        'rend', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.rendimiento) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo <> 'Accesorios' and mi.rendimiento is not null), '{}'::jsonb),
        'acc', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.cantidad) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo = 'Accesorios' and mi.cantidad is not null), '{}'::jsonb),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('n', e.nombre, 'v', e.costo)) from costeo_extras e where e.modelo_id = cm.id), '[]'::jsonb),
        'x', _costeo(cm.id, prov, 'metro')) order by cm.id) from costeo_modelos cm), '[]'::jsonb)
  );
end $$;

-- Guardar el costeo de un modelo. Piezas: [material_id, cantidad, cm, nota, que_es?, orientacion?] (las de 4 elementos siguen sirviendo)
create or replace function public.costeo_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare mid bigint := nullif(p->>'id','')::bigint; cid bigint := nullif(p->>'catalogo_id','')::bigint; est text := coalesce(nullif(p->>'estado',''), 'borrador');
  x jsonb; k text; i int := 0; cod text;
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
    if nullif(trim(x->>'n'),'') is null or coalesce((x->>'v')::numeric, -1) < 0 then raise exception 'Revisa los extras'; end if;
    insert into costeo_extras (modelo_id, nombre, costo, orden) values (mid, trim(x->>'n'), (x->>'v')::numeric, i);
  end loop;
  return jsonb_build_object('id', mid, 'x', _costeo(mid, null, 'metro'));
end $$;

-- Duplicar un costeo: copia también qué es y cómo va cada pieza
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
  insert into costeo_extras (modelo_id, nombre, costo, orden) select nid, nombre, costo, orden from costeo_extras where modelo_id = mid;
  return jsonb_build_object('id', nid);
end $$;

-- Reglas del costeo. p: {ganancia?, puertas_mes?, corte_cm?, despunte_cm?, iva?}
create or replace function public.costeo_reglas_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian las reglas'; end if;
  if coalesce(nullif(p->>'ganancia','')::numeric, 30) < 0 or coalesce(nullif(p->>'ganancia','')::numeric, 30) > 300 then raise exception 'Revisa la ganancia'; end if;
  if coalesce(nullif(p->>'puertas_mes','')::int, 25) <= 0 then raise exception 'Las puertas al mes deben ser más de 0'; end if;
  if coalesce(nullif(p->>'corte_cm','')::numeric, 0) < 0 or coalesce(nullif(p->>'corte_cm','')::numeric, 0) > 2 then raise exception 'El grosor del corte va de 0 a 2 cm'; end if;
  if coalesce(nullif(p->>'despunte_cm','')::numeric, 0) < 0 or coalesce(nullif(p->>'despunte_cm','')::numeric, 0) > 20 then raise exception 'El despunte va de 0 a 20 cm'; end if;
  if coalesce(nullif(p->>'iva','')::numeric, 16) < 0 or coalesce(nullif(p->>'iva','')::numeric, 16) > 50 then raise exception 'Revisa el IVA'; end if;
  update costeo_reglas set ganancia = coalesce(nullif(p->>'ganancia','')::numeric, ganancia), puertas_mes = coalesce(nullif(p->>'puertas_mes','')::int, puertas_mes),
    corte_cm = coalesce(nullif(p->>'corte_cm','')::numeric, corte_cm), despunte_cm = coalesce(nullif(p->>'despunte_cm','')::numeric, despunte_cm), iva = coalesce(nullif(p->>'iva','')::numeric, iva), actualizado_en = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;

-- ===== 20261108120100_v81b_gualfredo_disco_rinde_6.sql =====
-- Autor: Gualfredo (Claude de Gualfredo)
-- v81b · Dato de Ray: el disco de corte 14" rinde 6 puertas por disco como general (estaba en 3).
-- El Bitral es el dato de control ($223,22 · $290,19 · $326,79 · $339,23, costeado con el disco en 3): se le deja
-- su propio rendimiento en 3 para que no cambie. Si Ray quiere el 6 también en el Bitral, lo cambia en su ficha.
insert into public.costeo_modelo_insumos (modelo_id, insumo_id, rendimiento)
select m.id, i.id, i.rendimiento from public.costeo_modelos m, public.costeo_insumos i
where m.catalogo_id = 7 and i.codigo = 'd14' and i.rendimiento is not null
on conflict (modelo_id, insumo_id) do update set rendimiento = coalesce(public.costeo_modelo_insumos.rendimiento, excluded.rendimiento);
update public.costeo_insumos set rendimiento = 6 where codigo = 'd14';

-- ===== 20261108120200_v82_gualfredo_plan_corte.sql =====
-- Autor: Gualfredo (Claude de Gualfredo)
-- v82 · Plan de corte en 3 pasos (lote 2 de la reestructura de Costos).
-- · Retazos con número visible (R-12) y estado (vivo, usado, no_sirve). Nada se borra.
-- · Retazo mínimo en un solo lugar (_retazo_minimo): la pieza más corta de ese material en cualquier modelo más el
--   grosor del corte; si el material no tiene piezas, 50 cm.
-- · El servidor recalcula lo que sobra de cada barra o retazo (no confía en el teléfono), con grosor del corte y
--   despunte, y da error si un retazo del plan ya se usó.
-- · Las barras bajan solas cuando el herrero termina TODOS sus pasos de Hierro de ese sábado (sin botón nuevo para él).
--   Ray o Gualfredo lo pueden marcar a mano. Si algo falla (faltan barras), queda un aviso en el plan.
-- · "Corregir corte": lo que de verdad se cortó y los retazos que de verdad quedaron; la base hace la diferencia y la
--   guarda en cortes_ajustes con motivo.

-- ---------- Retazos: número visible y estado ----------
create sequence if not exists public.material_retazos_numero_seq;
alter table public.material_retazos add column if not exists numero int;
alter table public.material_retazos alter column numero set default nextval('public.material_retazos_numero_seq');
alter table public.material_retazos add column if not exists estado text not null default 'vivo';
alter table public.material_retazos add column if not exists plan_sab date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'material_retazos_estado_ck') then
    alter table public.material_retazos add constraint material_retazos_estado_ck check (estado in ('vivo','usado','no_sirve'));
  end if;
end $$;
update public.material_retazos set numero = nextval('public.material_retazos_numero_seq') where numero is null;
update public.material_retazos set estado = 'usado' where usado_en is not null and estado = 'vivo';
create unique index if not exists material_retazos_numero_uq on public.material_retazos (numero);

-- El estado sigue a usado_en (así las funciones de antes siguen sirviendo)
create or replace function public._retazo_estado()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  new.estado := case when new.usado_en is null then 'vivo' when new.estado = 'no_sirve' then 'no_sirve' else 'usado' end;
  return new;
end $$;
drop trigger if exists retazo_estado on public.material_retazos;
create trigger retazo_estado before insert or update on public.material_retazos for each row execute function public._retazo_estado();

-- Retazo mínimo de un material (un solo lugar)
create or replace function public._retazo_minimo(mid bigint)
 returns numeric language sql stable security definer set search_path to 'public'
as $$
  select coalesce((select min(p.largo_cm) from costeo_piezas p where p.material_id = mid) + coalesce((select corte_cm from costeo_reglas where id = 1), 0), 50);
$$;

-- ---------- Planes: retazos que no se usan, aviso y correcciones ----------
alter table public.cortes_planes add column if not exists no_usar jsonb not null default '[]'::jsonb;
alter table public.cortes_planes add column if not exists aviso text;
alter table public.cortes_planes add column if not exists corregido jsonb not null default '{}'::jsonb;

create table if not exists public.cortes_ajustes (
  id bigint generated always as identity primary key,
  sab date not null,
  material_id bigint not null references public.materiales_fab(id),
  antes jsonb not null,
  despues jsonb not null,
  motivo text not null,
  quien uuid references auth.users(id),
  cuando timestamptz not null default now()
);
alter table public.cortes_ajustes enable row level security;
drop policy if exists "ajustes de corte lee quien confirma pagos" on public.cortes_ajustes;
create policy "ajustes de corte lee quien confirma pagos" on public.cortes_ajustes for select using (_es_ray());

-- Lo que sobra de una barra o retazo del plan, calculado aquí: largo real − piezas − grosor del corte por pieza
-- − despunte (solo en barras enteras). Devuelve la barra limpia con largo y libre del servidor.
create or replace function public._corte_barra(b jsonb)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare mid bigint := nullif(b->>'mid','')::bigint; f materiales_fab%rowtype; r material_retazos%rowtype; largo numeric; usa numeric; n int;
  corte numeric; desp numeric;
begin
  select * into f from materiales_fab where id = mid;
  if not found or f.presentacion <> 'barra' then raise exception 'El plan tiene un material que no es de barra'; end if;
  select coalesce(corte_cm, 0), coalesce(despunte_cm, 0) into corte, desp from costeo_reglas where id = 1;
  if b->>'tipo' = 'retazo' then
    select * into r from material_retazos where id = nullif(b->>'rid','')::bigint;
    if not found or r.material_id <> mid or r.ancho_cm is not null then raise exception 'Un retazo del plan no existe'; end if;
    largo := r.largo_cm;
  elsif b->>'tipo' = 'barra' then largo := f.largo_cm;
  else raise exception 'El plan no es válido'; end if;
  if jsonb_typeof(coalesce(b->'piezas', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  select coalesce(sum((pz->>'cm')::numeric), 0), count(*) into usa, n from jsonb_array_elements(coalesce(b->'piezas', '[]'::jsonb)) pz;
  if exists (select 1 from jsonb_array_elements(coalesce(b->'piezas', '[]'::jsonb)) pz where coalesce((pz->>'cm')::numeric, 0) <= 0) then raise exception 'Una pieza del plan no tiene medida'; end if;
  usa := usa + corte * n + case when b->>'tipo' = 'barra' then desp else 0 end;
  if usa > largo + 0.05 then raise exception 'Las piezas no caben en % de %', case when b->>'tipo' = 'retazo' then 'el retazo R-' || r.numero else 'una barra' end, f.nombre; end if;
  return b || jsonb_build_object('largo', largo, 'libre', round(greatest(0, largo - usa), 1), 'num', r.numero);
end $$;

-- Guardar el plan (sugerencia ajustada o aceptada). p: {firma, barras, aceptado, ajustado, manual?, no_usar?}
-- El servidor revisa que cada pieza quepa, que cada retazo esté vivo y no se repita, y pone lo que sobra.
create or replace function public.corte_plan_guardar(p_sab date, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare ant cortes_planes%rowtype; hay boolean; b jsonb; bs jsonb := '[]'::jsonb; rids bigint[] := '{}'; rid bigint;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el plan de corte'; end if;
  if p_sab is null then raise exception 'Elige el sábado'; end if;
  if jsonb_typeof(coalesce(p->'barras', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  select * into ant from cortes_planes where sab = p_sab for update;
  hay := found;
  if hay and ant.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  if hay and exists (select 1 from jsonb_each_text(ant.entregado) x where x.value = 'true') and ant.firma <> coalesce(p->>'firma','') then
    raise exception 'Ya hay herreros que cortaron con el plan anterior'; end if;
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
  insert into cortes_planes (sab, firma, barras, aceptado, ajustado, manual, no_usar, entregado, actualizado_por, actualizado_en)
  values (p_sab, coalesce(p->>'firma',''), bs, coalesce((p->>'aceptado')::boolean, false), coalesce((p->>'ajustado')::boolean, false),
          coalesce(p->'manual', ant.manual, '{}'::jsonb), coalesce(p->'no_usar', ant.no_usar, '[]'::jsonb),
          case when hay and ant.firma = coalesce(p->>'firma','') then ant.entregado else '{}'::jsonb end, auth.uid(), now())
  on conflict (sab) do update set firma = excluded.firma, barras = excluded.barras, aceptado = excluded.aceptado, ajustado = excluded.ajustado,
    manual = excluded.manual, no_usar = excluded.no_usar, entregado = excluded.entregado, aviso = null, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
  return jsonb_build_object('sab', p_sab);
end $$;

-- Volver a la sugerencia: también vuelven a contar todos los retazos
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
  update cortes_planes set firma = '', barras = '[]'::jsonb, aceptado = false, ajustado = false, no_usar = '[]'::jsonb, aviso = null,
    actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab;
  return jsonb_build_object('ok', true);
end $$;

-- Aplica los cortes de un herrero: bajan sus barras, se gastan sus retazos y se guardan los nuevos que sirven.
-- Lo que sobra se recalcula aquí. Cuando todos cortaron, el plan se cierra y cada paso queda marcado como cortado.
create or replace function public._corte_aplicar(p_sab date, tid uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare pl cortes_planes%rowtype; b jsonb; nom text; mid bigint; falta text := ''; r record; todos boolean; libre numeric;
begin
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found or not pl.aceptado then raise exception 'Primero acepta el plan de corte'; end if;
  if pl.cerrado then raise exception 'Los cortes de ese sábado ya se hicieron'; end if;
  if coalesce((pl.entregado->>tid::text)::boolean, false) then raise exception 'Ese herrero ya estaba marcado'; end if;
  select nombre into nom from perfiles where id = tid;
  for r in select (x->>'mid')::bigint m, count(*) n from jsonb_array_elements(pl.barras) x where x->>'tid' = tid::text and x->>'tipo' = 'barra' group by 1 loop
    if (select stock from materiales_fab where id = r.m) < r.n then
      falta := falta || case when falta = '' then '' else ', ' end || (select nombre from materiales_fab where id = r.m); end if;
  end loop;
  if falta <> '' then raise exception 'Faltan barras de % en el depósito. Confirma la compra y vuelve a marcar', falta; end if;
  for b in select * from jsonb_array_elements(pl.barras) loop
    if b->>'tid' <> tid::text then continue; end if;
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

-- Ray o Gualfredo lo marcan a mano (por si el herrero no terminó en la app)
create or replace function public.corte_ya_corto(p_sab date, tid uuid)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo marcan los cortes'; end if;
  return _corte_aplicar(p_sab, tid);
end $$;

-- Al terminar el herrero TODOS sus pasos de Hierro de ese sábado, bajan sus barras solas.
-- Nunca frena al herrero: si algo falla (faltan barras), queda el aviso en el plan para Ray.
create or replace function public._corte_al_terminar_hierro()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare pl cortes_planes%rowtype;
begin
  if new.oficio is distinct from 'hierro' or new.estado <> 'hecha' or old.estado = 'hecha' or new.para_el is null or new.trabajador_id is null then return new; end if;
  select * into pl from cortes_planes where sab = new.para_el;
  if not found or not pl.aceptado or pl.cerrado or coalesce((pl.entregado->>new.trabajador_id::text)::boolean, false) then return new; end if;
  if not exists (select 1 from jsonb_array_elements(pl.barras) x where x->>'tid' = new.trabajador_id::text) then return new; end if;
  if exists (select 1 from etapas e where e.trabajador_id = new.trabajador_id and e.para_el = new.para_el and e.oficio = 'hierro' and e.estado <> 'hecha' and e.id <> new.id) then return new; end if;
  begin
    perform _corte_aplicar(new.para_el, new.trabajador_id);
  exception when others then
    update cortes_planes set aviso = 'No se pudieron bajar las barras de ' || coalesce((select nombre from perfiles where id = new.trabajador_id), 'un herrero') || ': ' || sqlerrm
    where sab = new.para_el;
  end;
  return new;
end $$;
drop trigger if exists corte_al_terminar_hierro on public.etapas;
create trigger corte_al_terminar_hierro after update of estado on public.etapas for each row execute function public._corte_al_terminar_hierro();

-- Corregir corte: lo que de verdad se cortó de un material. p: {material_id, barras, usados:[rid], quedaron:[cm], motivo}
-- La base hace la diferencia con lo que ya se descontó (barras, retazos usados y retazos nuevos) y deja el registro.
create or replace function public.corte_corregir(p_sab date, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare pl cortes_planes%rowtype; mid bigint := nullif(p->>'material_id','')::bigint; mot text := nullif(trim(p->>'motivo'),'');
  nb int := nullif(p->>'barras','')::int; usados bigint[]; quedaron numeric[]; ant_b int; ant_u bigint[]; ant_q numeric[];
  rid bigint; cm numeric; keep bigint[] := '{}'; x record;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo corrigen los cortes'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  if nb is null or nb < 0 or nb > 99 then raise exception 'Escribe cuántas barras enteras se cortaron'; end if;
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found or not exists (select 1 from jsonb_each_text(pl.entregado) e where e.value = 'true') then raise exception 'Ese sábado todavía no se ha cortado'; end if;
  if not exists (select 1 from materiales_fab where id = mid and presentacion = 'barra') then raise exception 'Elige el material'; end if;
  select coalesce(array_agg(v::bigint), '{}') into usados from jsonb_array_elements_text(coalesce(p->'usados', '[]'::jsonb)) v;
  select coalesce(array_agg(v::numeric), '{}') into quedaron from jsonb_array_elements_text(coalesce(p->'quedaron', '[]'::jsonb)) v;
  if exists (select 1 from unnest(quedaron) q where q <= 0 or q > 1000) then raise exception 'Revisa la medida de los retazos que quedaron'; end if;
  if exists (select 1 from unnest(usados) u where not exists (select 1 from material_retazos r where r.id = u and r.material_id = mid and r.ancho_cm is null)) then raise exception 'Un retazo no es de ese material'; end if;
  -- Lo que ya está descontado: la última corrección o lo del plan de los herreros que ya cortaron
  if pl.corregido ? mid::text then
    ant_b := (pl.corregido->mid::text->>'barras')::int;
    select coalesce(array_agg(v::bigint), '{}') into ant_u from jsonb_array_elements_text(pl.corregido->mid::text->'usados') v;
  else
    select count(*) filter (where x2->>'tipo' = 'barra'), coalesce(array_agg((x2->>'rid')::bigint) filter (where x2->>'tipo' = 'retazo'), '{}')
    into ant_b, ant_u from jsonb_array_elements(pl.barras) x2
    where (x2->>'mid')::bigint = mid and coalesce((pl.entregado->>(x2->>'tid'))::boolean, false);
  end if;
  select coalesce(array_agg(largo_cm order by id), '{}') into ant_q from material_retazos where material_id = mid and plan_sab = p_sab and estado <> 'no_sirve';
  -- Barras enteras: la diferencia sube o baja el depósito
  if nb - ant_b > (select stock from materiales_fab where id = mid) then raise exception 'No hay suficientes barras en el depósito para esa corrección. Confirma la compra primero'; end if;
  perform _fab_mover(mid, ant_b - nb, 'ajuste', null, 'Corrección del corte del ' || to_char(p_sab, 'DD/MM') || ': ' || mot);
  -- Retazos del depósito: los que no se usaron vuelven; los que sí se usaron se gastan
  update material_retazos set usado_en = null, usado_por = null, usado_motivo = null where id = any(ant_u) and not (id = any(usados)) and estado = 'usado';
  for rid in select unnest(usados) loop
    if not (rid = any(ant_u)) then
      update material_retazos set usado_en = now(), usado_por = auth.uid(), usado_motivo = 'Corrección del corte del ' || to_char(p_sab, 'DD/MM') where id = rid and usado_en is null;
      if not found then raise exception 'El retazo R-% ya no está', (select numero from material_retazos where id = rid); end if;
    end if;
  end loop;
  -- Retazos que quedaron: se conservan los que coinciden; los demás "no sirven" (no se borran) y se agregan los nuevos
  foreach cm in array quedaron loop
    select id into rid from material_retazos where material_id = mid and plan_sab = p_sab and estado = 'vivo' and largo_cm = round(cm, 1) and not (id = any(keep)) order by id limit 1;
    if found then keep := keep || rid;
    else
      insert into material_retazos (material_id, largo_cm, origen, creado_por, plan_sab) values (mid, round(cm, 1), 'Corrección del corte del ' || to_char(p_sab, 'DD/MM'), auth.uid(), p_sab)
      returning id into rid;
      keep := keep || rid;
    end if;
  end loop;
  for x in select id from material_retazos where material_id = mid and plan_sab = p_sab and estado = 'vivo' and not (id = any(keep)) loop
    update material_retazos set estado = 'no_sirve', usado_en = now(), usado_por = auth.uid(), usado_motivo = 'Corrección del corte: ' || mot where id = x.id;
  end loop;
  insert into cortes_ajustes (sab, material_id, antes, despues, motivo, quien)
  values (p_sab, mid, jsonb_build_object('barras', ant_b, 'usados', to_jsonb(ant_u), 'quedaron', to_jsonb(ant_q)),
          jsonb_build_object('barras', nb, 'usados', to_jsonb(usados), 'quedaron', to_jsonb(quedaron)), mot, auth.uid());
  update cortes_planes set corregido = corregido || jsonb_build_object(mid::text, jsonb_build_object('barras', nb, 'usados', to_jsonb(usados))),
    actualizado_por = auth.uid(), actualizado_en = now() where sab = p_sab;
  return jsonb_build_object('ok', true, 'barras', ant_b - nb);
end $$;

-- Datos de Costos (igual que v81) con el número de cada retazo y el mínimo que sirve de cada material
create or replace function public.costos_datos(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare prov bigint := _prov_costeo(pref);
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'prov', prov,
    'reglas', (select jsonb_build_object('iva', iva, 'ganancia', ganancia, 'puertasMes', puertas_mes, 'corte', corte_cm, 'despunte', despunte_cm,
               'gastosMes', (select coalesce(sum(monto), 0) from gastos_fijos where activo)) from costeo_reglas where id = 1),
    'gastosFijos', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'cat', g.categoria, 'monto', g.monto) order by g.orden, g.id) from gastos_fijos g where g.activo), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipos', to_jsonb(p.tipos), 'iva', p.cobra_iva, 'principal', p.principal) order by p.principal desc, p.id) from proveedores p where p.activo), '[]'::jsonb),
    'insumos', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'nombre', i.nombre, 'grupo', i.grupo, 'p', i.precio, 'r', i.rendimiento) order by i.orden, i.id) from costeo_insumos i where i.activo), '[]'::jsonb),
    'fab', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'codigo', m.codigo, 'nombre', m.nombre, 'tipo', m.tipo, 'pres', m.presentacion, 'largo', m.largo_cm,
        'hoja', case when m.presentacion = 'hoja' then jsonb_build_array(m.hoja_ancho_cm, m.hoja_alto_cm) end, 'fijo', m.precio_fijo, 'stock', m.stock, 'activo', m.activo,
        'minRet', case when m.presentacion = 'barra' then _retazo_minimo(m.id) end,
        'retazos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'largo', r.largo_cm, 'num', r.numero) order by r.largo_cm desc) from material_retazos r where r.material_id = m.id and r.usado_en is null and r.ancho_cm is null), '[]'::jsonb),
        'sobrantes', coalesce((select jsonb_agg(jsonb_build_array(r.largo_cm, r.ancho_cm)) from material_retazos r where r.material_id = m.id and r.usado_en is null and r.ancho_cm is not null), '[]'::jsonb),
        'precios', coalesce((select jsonb_object_agg(pp.proveedor_id::text, jsonb_build_object('p', pp.precio, 'esp', pp.espesor, 'desde', pp.desde)) from material_precios pp where pp.material_id = m.id and pp.vigente), '{}'::jsonb))
        order by m.orden, m.id) from materiales_fab m), '[]'::jsonb),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'producto', c.producto, 'tarifas', c.tarifas) order by c.id) from categorias_pago c where c.activo), '[]'::jsonb),
    'catalogo', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'precio_base', c.precio_base, 'categoria_pago_id', c.categoria_pago_id, 'especificaciones_base', c.especificaciones_base,
        'foto', (select v->>0 from jsonb_each(coalesce(c.fotos, '{}'::jsonb)) e(k, v) where jsonb_typeof(v) = 'array' limit 1)) order by c.tipo, c.precio_base, c.id) from catalogo c), '[]'::jsonb),
    'gastoReal', _gasto_real_por_puerta(),
    'enFabricacion', coalesce((select jsonb_agg(distinct vi.catalogo_id) from venta_items vi join ventas v on v.id = vi.venta_id
        where v.estado = 'en_produccion' and vi.catalogo_id is not null), '[]'::jsonb),
    'vendidos', coalesce((select jsonb_agg(distinct vi.catalogo_id) from venta_items vi join ventas v on v.id = vi.venta_id
        where v.estado not in ('cotizacion','cancelada') and vi.catalogo_id is not null), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', cm.id, 'catalogo_id', cm.catalogo_id, 'nombre', cm.nombre, 'tipo', cm.tipo, 'codigo', cm.codigo,
        'estado', cm.estado, 'categoria_pago_id', cm.categoria_pago_id, 'nota', cm.nota, 'actualizado_en', cm.actualizado_en,
        'piezas', coalesce((select jsonb_agg(jsonb_build_array(p.material_id, p.cantidad, p.largo_cm, coalesce(p.nota, ''), p.que_es, p.orientacion) order by p.orden, p.id) from costeo_piezas p where p.modelo_id = cm.id), '[]'::jsonb),
        'hojas', coalesce((select jsonb_agg(jsonb_build_array(h.material_id, h.cantidad, h.ancho_cm, h.alto_cm, coalesce(h.nota, '')) order by h.orden, h.id) from costeo_hojas h where h.modelo_id = cm.id), '[]'::jsonb),
        'rend', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.rendimiento) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo <> 'Accesorios' and mi.rendimiento is not null), '{}'::jsonb),
        'acc', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.cantidad) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo = 'Accesorios' and mi.cantidad is not null), '{}'::jsonb),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('n', e.nombre, 'v', e.costo)) from costeo_extras e where e.modelo_id = cm.id), '[]'::jsonb),
        'x', _costeo(cm.id, prov, 'metro')) order by cm.id) from costeo_modelos cm), '[]'::jsonb)
  );
end $$;

-- Lo que entra al plan (igual que v79) y cada plan con aviso, retazos que no se usan, correcciones y retazos que quedaron
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
        'entregado', p.entregado, 'cerrado', p.cerrado, 'manual', p.manual, 'no_usar', p.no_usar, 'aviso', p.aviso, 'corregido', p.corregido,
        'nuevos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'mid', r.material_id, 'cm', r.largo_cm, 'num', r.numero) order by r.id)
                            from material_retazos r where r.plan_sab = p.sab and r.estado <> 'no_sirve'), '[]'::jsonb)))
      from cortes_planes p where p.sab >= _hoy_vzla() - 14), '{}'::jsonb)
  );
end $$;

-- Hoja de corte del herrero (Mi trabajo): sus barras con el número de cada retazo y el mínimo que se guarda
create or replace function public.mi_hoja_corte()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('sab', p.sab, 'cortado', coalesce((p.entregado->>auth.uid()::text)::boolean, false),
      'barras', (select jsonb_agg(x || jsonb_build_object('material', m.nombre, 'minimo', _retazo_minimo(m.id),
                   'num', (select r.numero from material_retazos r where r.id = nullif(x->>'rid','')::bigint)))
                 from jsonb_array_elements(p.barras) x left join materiales_fab m on m.id = (x->>'mid')::bigint
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

revoke execute on function public._retazo_minimo(bigint) from anon, public, authenticated;
revoke execute on function public._corte_barra(jsonb) from anon, public, authenticated;
revoke execute on function public._corte_aplicar(date, uuid) from anon, public, authenticated;
revoke execute on function public._corte_al_terminar_hierro() from anon, public, authenticated;
revoke execute on function public._retazo_estado() from anon, public, authenticated;
revoke execute on function public.corte_corregir(date, jsonb) from anon, public;
grant execute on function public.corte_corregir(date, jsonb) to authenticated;

-- ===== 20261108120300_v83_gualfredo_compra_pedida.sql =====
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

-- ===== 20261108120400_v84_gualfredo_cierre_mes.sql =====
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

commit;
