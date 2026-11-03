-- Autor: Ray (Claude de Ray)
-- v78 · Costos (lotes 6 y 7 de Finanzas y Costos): costeo de cada modelo con la fórmula del Costeador de Ray.
-- Reglas: IVA × 1,16 · perfiles por metro usado (precio de la barra ÷ largo) · "barra completa" solo para comparar ·
-- lámina y vidrio por m² de hoja · proveedor elegido y, si no vende ese material, otro con aviso · rendimiento del
-- modelo o el general · fondo, esmalte y masilla sin general = "falta" · accesorios × cantidad · mano de obra de la
-- categoría de pago (hierro + masilla y pintura + detalles) · costo × 1,30 + gastos fijos ÷ puertas al mes ·
-- extras × 1,30 sin gastos fijos · grosor del corte · se redondea solo al final.
-- Los costos nunca se guardan en el catálogo (es público). Solo los ve quien confirma pagos (Ray o Gualfredo).

create table if not exists public.costeo_reglas (
  id int primary key default 1 check (id = 1),
  iva numeric(5,2) not null default 16,
  ganancia numeric(5,2) not null default 30,
  puertas_mes int not null default 25 check (puertas_mes > 0),
  corte_cm numeric(5,2) not null default 0,
  actualizado_en timestamptz not null default now()
);
insert into public.costeo_reglas (id) values (1) on conflict do nothing;

create table if not exists public.costeo_insumos (
  id bigint generated always as identity primary key,
  codigo text unique,
  nombre text not null,
  grupo text not null check (grupo in ('Pintura y masilla','Consumibles','Accesorios')),
  precio numeric(12,2) not null default 0 check (precio >= 0),
  rendimiento numeric(8,3) check (rendimiento is null or rendimiento > 0),
  orden int not null default 0,
  activo boolean not null default true
);

create table if not exists public.costeo_modelos (
  id bigint generated always as identity primary key,
  catalogo_id bigint unique references public.catalogo(id),
  nombre text,
  tipo text,
  codigo text,
  estado text not null default 'borrador' check (estado in ('borrador','listo','diseno')),
  categoria_pago_id bigint references public.categorias_pago(id),
  nota text,
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  constraint costeo_modelos_diseno check (catalogo_id is not null or nombre is not null)
);
create table if not exists public.costeo_piezas (
  id bigint generated always as identity primary key,
  modelo_id bigint not null references public.costeo_modelos(id) on delete cascade,
  material_id bigint not null references public.materiales_fab(id),
  cantidad int not null check (cantidad > 0),
  largo_cm numeric(8,1) not null check (largo_cm > 0),
  nota text,
  orden int not null default 0
);
create table if not exists public.costeo_hojas (
  id bigint generated always as identity primary key,
  modelo_id bigint not null references public.costeo_modelos(id) on delete cascade,
  material_id bigint not null references public.materiales_fab(id),
  cantidad int not null check (cantidad > 0),
  ancho_cm numeric(8,1) not null check (ancho_cm > 0),
  alto_cm numeric(8,1) not null check (alto_cm > 0),
  nota text,
  orden int not null default 0
);
-- Rendimiento del modelo (puertas por unidad) o cantidad (accesorios) de cada insumo
create table if not exists public.costeo_modelo_insumos (
  modelo_id bigint not null references public.costeo_modelos(id) on delete cascade,
  insumo_id bigint not null references public.costeo_insumos(id),
  rendimiento numeric(8,3) check (rendimiento is null or rendimiento > 0),
  cantidad numeric(8,2) check (cantidad is null or cantidad > 0),
  primary key (modelo_id, insumo_id)
);
create table if not exists public.costeo_extras (
  id bigint generated always as identity primary key,
  modelo_id bigint not null references public.costeo_modelos(id) on delete cascade,
  nombre text not null,
  costo numeric(12,2) not null check (costo >= 0),
  orden int not null default 0
);

alter table public.costeo_reglas enable row level security;
alter table public.costeo_insumos enable row level security;
alter table public.costeo_modelos enable row level security;
alter table public.costeo_piezas enable row level security;
alter table public.costeo_hojas enable row level security;
alter table public.costeo_modelo_insumos enable row level security;
alter table public.costeo_extras enable row level security;
create policy "reglas costeo lee quien confirma pagos" on public.costeo_reglas for select using (_es_ray());
create policy "insumos costeo lee quien confirma pagos" on public.costeo_insumos for select using (_es_ray());
create policy "modelos costeo lee quien confirma pagos" on public.costeo_modelos for select using (_es_ray());
create policy "piezas costeo lee quien confirma pagos" on public.costeo_piezas for select using (_es_ray());
create policy "hojas costeo lee quien confirma pagos" on public.costeo_hojas for select using (_es_ray());
create policy "insumos modelo lee quien confirma pagos" on public.costeo_modelo_insumos for select using (_es_ray());
create policy "extras costeo lee quien confirma pagos" on public.costeo_extras for select using (_es_ray());

-- ---------- Cálculo ----------

-- Acomoda piezas en barras (más largas primero, primera barra donde quepa, con grosor del corte).
-- Devuelve [{piezas:[cm...], libre}] ; una pieza más larga que la barra va sola.
create or replace function public._empacar(cms numeric[], largo numeric, corte numeric)
 returns jsonb language plpgsql immutable set search_path to 'public'
as $$
declare x numeric; libres numeric[] := '{}'; piezas jsonb := '[]'::jsonb; i int; puesto boolean;
begin
  for x in select v from unnest(cms) v order by v desc loop
    puesto := false;
    if x > largo then
      libres := libres || 0::numeric; piezas := piezas || jsonb_build_array(jsonb_build_array(x)); continue;
    end if;
    for i in 1 .. coalesce(array_length(libres, 1), 0) loop
      if libres[i] + 1e-9 >= x then
        libres[i] := greatest(0, libres[i] - x - coalesce(corte, 0));
        piezas := jsonb_set(piezas, array[(i - 1)::text], (piezas -> (i - 1)) || to_jsonb(x));
        puesto := true; exit;
      end if;
    end loop;
    if not puesto then
      libres := libres || greatest(0, largo - x - coalesce(corte, 0));
      piezas := piezas || jsonb_build_array(jsonb_build_array(x));
    end if;
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object('piezas', piezas -> (g.n - 1), 'libre', libres[g.n]) order by g.n)
    from generate_series(1, coalesce(array_length(libres, 1), 0)) g(n)), '[]'::jsonb);
end $$;

-- Proveedor por defecto para costear: el principal (o el primero)
create or replace function public._prov_costeo(pref bigint) returns bigint language sql stable security definer set search_path to 'public'
as $$ select coalesce(pref, (select id from proveedores where activo order by principal desc, id limit 1)) $$;

-- Precio sin IVA de un material para costear: el del proveedor elegido; si no lo vende, el de otro (con aviso).
-- El precio fijo para costear manda cuando el precio sale del proveedor principal.
create or replace function public._precio_costeo(mid bigint, pref bigint)
 returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce((
    select jsonb_build_object('p', case when pv.principal and m.precio_fijo is not null then m.precio_fijo else mp.precio end,
                              'de', mp.proveedor_id, 'de_nombre', pv.nombre, 'fijo', pv.principal and m.precio_fijo is not null)
    from material_precios mp join proveedores pv on pv.id = mp.proveedor_id join materiales_fab m on m.id = mp.material_id
    where mp.material_id = mid and mp.vigente
    order by (mp.proveedor_id = pref) desc, pv.principal desc, pv.id limit 1),
    jsonb_build_object('p', null, 'de', null))
$$;

-- Costeo de un modelo de Costos. modo: 'metro' (lo que se usa) o 'tubo' (barra completa, solo para comparar).
create or replace function public._costeo(mid bigint, pref bigint default null, modo text default 'metro')
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare cm costeo_modelos%rowtype; rg costeo_reglas%rowtype; iva numeric; prov bigint := _prov_costeo(pref); pnom text;
  lineas jsonb := '[]'::jsonb; grupos jsonb := '[]'::jsonb; avisos text[] := '{}'; falta text[] := '{}';
  r record; pr jsonb; barra numeric; porm numeric; bars jsonb; v numeric; m2 numeric; hm2 numeric; rend numeric;
  costo numeric := 0; venta numeric; fijos numeric; gastos numeric; hoy numeric; cat categorias_pago%rowtype; catid bigint;
  ea jsonb; alto numeric; ancho numeric; k text; nk text; t jsonb; mo numeric; extras jsonb; mnombre text; mtipo text;
begin
  select * into cm from costeo_modelos where id = mid;
  if not found then return null; end if;
  select * into rg from costeo_reglas where id = 1;
  iva := 1 + rg.iva / 100;
  select nombre into pnom from proveedores where id = prov;
  -- Hierro: por material, piezas en cm
  for r in select f.id material_id, f.nombre, f.largo_cm,
             (select array_agg(p2.largo_cm) from costeo_piezas p2, generate_series(1, p2.cantidad) where p2.modelo_id = mid and p2.material_id = f.id) cms
           from materiales_fab f where f.id in (select material_id from costeo_piezas where modelo_id = mid) order by f.orden, f.id loop
    pr := _precio_costeo(r.material_id, prov);
    if pr->>'p' is null then falta := falta || ('precio de ' || r.nombre); continue; end if;
    if (pr->>'de')::bigint <> prov then avisos := avisos || (coalesce(pnom, 'Ese proveedor') || ' no vende ' || r.nombre || ': se usó el precio de ' || (pr->>'de_nombre')); end if;
    barra := (pr->>'p')::numeric * iva; porm := barra / (r.largo_cm / 100);
    bars := _empacar(r.cms, r.largo_cm, rg.corte_cm);
    v := case when modo = 'tubo' then jsonb_array_length(bars) * barra else (select sum(x) from unnest(r.cms) x) / 100 * porm end;
    lineas := lineas || jsonb_build_object('g', 'Hierro', 'n', r.nombre, 'det', case when modo = 'tubo' then jsonb_array_length(bars) || case when jsonb_array_length(bars) = 1 then ' barra' else ' barras' end
               else replace(to_char((select sum(x) from unnest(r.cms) x) / 100, 'FM9990.00'), '.', ',') || ' m' end, 'v', v);
    grupos := grupos || jsonb_build_object('id', r.material_id, 'nombre', r.nombre, 'cm', (select sum(x) from unnest(r.cms) x), 'largo', r.largo_cm,
               'barras', bars, 'v', v, 'porM', porm, 'fijo', (pr->>'fijo')::boolean);
    costo := costo + v;
  end loop;
  -- Lámina y vidrio por m² de hoja
  for r in select h.*, f.nombre, f.tipo, f.hoja_ancho_cm, f.hoja_alto_cm from costeo_hojas h join materiales_fab f on f.id = h.material_id where h.modelo_id = mid order by h.orden, h.id loop
    pr := _precio_costeo(r.material_id, prov);
    if pr->>'p' is null then falta := falta || ('precio de ' || r.nombre); continue; end if;
    if (pr->>'de')::bigint <> prov and not exists (select 1 from proveedores where id = (pr->>'de')::bigint and not principal and nombre ilike 'Sin factura%') then
      avisos := avisos || (coalesce(pnom, 'Ese proveedor') || ' no vende ' || r.nombre || ': se usó el precio de ' || (pr->>'de_nombre')); end if;
    m2 := r.cantidad * r.ancho_cm * r.alto_cm / 10000; hm2 := r.hoja_ancho_cm * r.hoja_alto_cm / 10000;
    v := m2 * (pr->>'p')::numeric * iva / hm2;
    lineas := lineas || jsonb_build_object('g', case when r.tipo = 'vidrio' then 'Vidrio' else 'Lámina' end, 'n', r.nombre,
      'det', replace(to_char(m2, 'FM9990.999'), '.', ',') || ' m² (' || round(m2 / hm2 * 100) || ' % de la hoja)' || coalesce(' · ' || r.nota, ''), 'v', v);
    costo := costo + v;
  end loop;
  -- Pintura, masilla y consumibles: precio ÷ rendimiento (del modelo o el general)
  for r in select i.*, mi.rendimiento r_mod from costeo_insumos i left join costeo_modelo_insumos mi on mi.insumo_id = i.id and mi.modelo_id = mid
           where i.activo and i.grupo <> 'Accesorios' order by i.orden, i.id loop
    rend := coalesce(r.r_mod, r.rendimiento);
    if rend is null then if r.grupo = 'Pintura y masilla' then falta := falta || r.nombre::text; end if; continue; end if;
    v := r.precio * iva / rend;
    lineas := lineas || jsonb_build_object('g', r.grupo, 'n', r.nombre, 'det', case when rend >= 1 then '1 rinde ' || trim(to_char(rend, 'FM9990.##'), '.') || case when rend = 1 then ' puerta' else ' puertas' end
               else round(1 / rend) || ' por puerta' end, 'v', v);
    costo := costo + v;
  end loop;
  -- Accesorios × cantidad
  for r in select i.*, mi.cantidad from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = mid and i.grupo = 'Accesorios' and mi.cantidad > 0 order by i.orden, i.id loop
    v := r.cantidad * r.precio * iva;
    lineas := lineas || jsonb_build_object('g', 'Accesorios', 'n', r.nombre, 'det', trim(to_char(r.cantidad, 'FM9990.##'), '.') || ' × $' || to_char(round(r.precio * iva, 2), 'FM9990.00'), 'v', v);
    costo := costo + v;
  end loop;
  -- Mano de obra: categoría de pago del costeo o la del catálogo
  select c.nombre, c.tipo, c.precio_base, c.especificaciones_base, c.categoria_pago_id into mnombre, mtipo, hoy, ea, catid from catalogo c where c.id = cm.catalogo_id;
  catid := coalesce(cm.categoria_pago_id, catid);
  select * into cat from categorias_pago where id = catid;
  if found then
    alto := coalesce(nullif(ea->>'alto','')::numeric, 2); ancho := coalesce(nullif(ea->>'ancho','')::numeric, 1);
    foreach k in array array['hierro','masilla_pintura','detalles'] loop
      t := cat.tarifas -> k;
      if t is null or coalesce((t->>'monto')::numeric, 0) = 0 then continue; end if;
      mo := (t->>'monto')::numeric * case when t->>'modo' = 'm2' then alto * ancho else 1 end;
      nk := case k when 'hierro' then 'Hierro' when 'masilla_pintura' then 'Masilla y pintura' else 'Detalles' end;
      lineas := lineas || jsonb_build_object('g', 'Mano de obra', 'n', nk, 'det', cat.nombre, 'v', mo);
      costo := costo + mo;
    end loop;
  else
    falta := falta || 'categoría de pago'::text;
  end if;
  if not exists (select 1 from costeo_piezas where modelo_id = mid) and not exists (select 1 from costeo_hojas where modelo_id = mid) then
    falta := falta || 'cortes'::text; end if;
  select coalesce(sum(monto), 0) into gastos from gastos_fijos where activo;
  fijos := gastos / rg.puertas_mes;
  venta := costo * (1 + rg.ganancia / 100);
  hoy := case when cm.catalogo_id is null then null else coalesce(hoy, 0) end;
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'n', e.nombre, 'costo', e.costo, 'venta', round(e.costo * (1 + rg.ganancia / 100), 2)) order by e.orden, e.id), '[]'::jsonb)
    into extras from costeo_extras e where e.modelo_id = mid;
  return jsonb_build_object('modelo', mid, 'catalogo_id', cm.catalogo_id, 'nombre', coalesce(mnombre, cm.nombre), 'tipo', coalesce(mtipo, cm.tipo),
    'codigo', cm.codigo, 'estado', cm.estado, 'prov', prov, 'prov_nombre', pnom, 'modo', modo,
    'lineas', (select jsonb_agg(l || jsonb_build_object('v', round((l->>'v')::numeric, 2))) from jsonb_array_elements(lineas) l),
    'grupos', grupos, 'avisos', to_jsonb(avisos), 'falta', to_jsonb(falta), 'listo', cardinality(falta) = 0,
    'costo', round(costo, 2), 'venta', round(venta, 2), 'fijos', round(fijos, 2), 'final', round(venta + fijos, 2),
    'hoy', hoy, 'ganancia', case when hoy is null then null else round(hoy - fijos - costo, 2) end,
    'pct', case when hoy is null or costo = 0 then null else round((hoy - fijos - costo) / costo * 100, 1) end,
    'categoria', case when cat.id is null then null else jsonb_build_object('id', cat.id, 'nombre', cat.nombre) end, 'extras', extras);
end $$;

-- Lo que llama la app: costeo de un modelo de Costos (o de un modelo del catálogo)
create or replace function public.costeo_calcular(mid bigint, pref bigint default null, modo text default 'metro')
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  if modo not in ('metro','tubo') then raise exception 'Modo no válido'; end if;
  return _costeo(mid, pref, modo);
end $$;

-- Resumen de costo por modelo del catálogo (para Finanzas, Catálogo y el cierre del mes)
create or replace function public.costeo_resumen(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  return coalesce((select jsonb_object_agg(x->>'catalogo_id', jsonb_build_object('modelo', x->'modelo', 'costo', x->'costo', 'final', x->'final', 'fijos', x->'fijos',
      'pct', x->'pct', 'listo', (x->>'listo')::boolean and (x->>'estado') = 'listo', 'estado', x->'estado', 'falta', x->'falta'))
    from (select _costeo(cm.id, pref, 'metro') x from costeo_modelos cm where cm.catalogo_id is not null) q), '{}'::jsonb);
end $$;

-- Gasto fijo real por puerta (decisión 15): gastos fijos pagados en Finanzas ÷ puertas con el Hierro terminado,
-- de los últimos 3 meses completos. Si algún mes no tiene gastos cargados, todavía no hay datos (null).
create or replace function public._gasto_real_por_puerta()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare ini date := (date_trunc('month', _hoy_vzla()) - interval '3 months')::date; fin date := date_trunc('month', _hoy_vzla())::date;
  g numeric; n int; meses int;
begin
  select count(distinct date_trunc('month', m.fecha)) into meses from movimientos m
  where m.tipo = 'gasto' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin
    and lower(m.categoria) in (select lower(categoria) from gastos_fijos);
  if meses < 3 then return null; end if;
  select coalesce(sum(coalesce(m.monto_llego, m.monto_salio)), 0) into g from movimientos m
  where m.tipo = 'gasto' and m.anulado_en is null and m.fecha >= ini and m.fecha < fin and lower(m.categoria) in (select lower(categoria) from gastos_fijos);
  select count(*) into n from etapas e where e.oficio = 'hierro' and e.estado = 'hecha' and e.terminada_en >= ini and e.terminada_en < fin;
  if n = 0 then return null; end if;
  return jsonb_build_object('gastos', round(g, 2), 'puertas', n, 'porPuerta', round(g / n, 2), 'desde', ini, 'hasta', fin - 1);
end $$;

-- Todo lo de la pantalla Costos en una lectura
create or replace function public.costos_datos(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare prov bigint := _prov_costeo(pref);
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'prov', prov,
    'reglas', (select jsonb_build_object('iva', iva, 'ganancia', ganancia, 'puertasMes', puertas_mes, 'corte', corte_cm,
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
        'piezas', coalesce((select jsonb_agg(jsonb_build_array(p.material_id, p.cantidad, p.largo_cm, coalesce(p.nota, '')) order by p.orden, p.id) from costeo_piezas p where p.modelo_id = cm.id), '[]'::jsonb),
        'hojas', coalesce((select jsonb_agg(jsonb_build_array(h.material_id, h.cantidad, h.ancho_cm, h.alto_cm, coalesce(h.nota, '')) order by h.orden, h.id) from costeo_hojas h where h.modelo_id = cm.id), '[]'::jsonb),
        'rend', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.rendimiento) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo <> 'Accesorios' and mi.rendimiento is not null), '{}'::jsonb),
        'acc', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.cantidad) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo = 'Accesorios' and mi.cantidad is not null), '{}'::jsonb),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('n', e.nombre, 'v', e.costo)) from costeo_extras e where e.modelo_id = cm.id), '[]'::jsonb),
        'x', _costeo(cm.id, prov, 'metro')) order by cm.id) from costeo_modelos cm), '[]'::jsonb)
  );
end $$;

-- Guardar el costeo de un modelo (reemplaza cortes, hojas, insumos y extras).
-- p: {id?, catalogo_id?, nombre?, tipo?, estado, categoria_pago_id?, nota?, piezas:[[material_id, cantidad, cm, nota]], hojas:[[material_id, cantidad, ancho, alto, nota]],
--     rend:{insumo_id: rendimiento}, acc:{insumo_id: cantidad}, extras:[{n, v}]}
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
    insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden) values (mid, (x->>0)::bigint, (x->>1)::int, (x->>2)::numeric, nullif(trim(x->>3),''), i);
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

-- Duplicar un costeo: queda "en diseño" hasta pasarlo al catálogo
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
  insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden) select nid, material_id, cantidad, largo_cm, nota, orden from costeo_piezas where modelo_id = mid;
  insert into costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden) select nid, material_id, cantidad, ancho_cm, alto_cm, nota, orden from costeo_hojas where modelo_id = mid;
  insert into costeo_modelo_insumos (modelo_id, insumo_id, rendimiento, cantidad) select nid, insumo_id, rendimiento, cantidad from costeo_modelo_insumos where modelo_id = mid;
  insert into costeo_extras (modelo_id, nombre, costo, orden) select nid, nombre, costo, orden from costeo_extras where modelo_id = mid;
  return jsonb_build_object('id', nid);
end $$;

-- Pasar al catálogo: un modelo en diseño se crea en el catálogo con su precio; uno del catálogo cambia su precio.
create or replace function public.costeo_pasar_catalogo(mid bigint, p_precio numeric)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare o costeo_modelos%rowtype; cid bigint;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian precios'; end if;
  if p_precio is null or p_precio <= 0 or p_precio > 100000 then raise exception 'Escribe el precio'; end if;
  select * into o from costeo_modelos where id = mid for update;
  if not found then raise exception 'No existe ese costeo'; end if;
  if o.catalogo_id is null then
    insert into catalogo (nombre, tipo, precio_base, especificaciones_base, badge)
    values (o.nombre, coalesce(o.tipo, 'Puerta Multilock'), round(p_precio, 2), '{"alto":2,"ancho":1}'::jsonb, 'Nuevo')
    returning id into cid;
    update costeo_modelos set catalogo_id = cid, nombre = null, tipo = null, estado = 'listo', actualizado_por = auth.uid(), actualizado_en = now() where id = mid;
  else
    cid := o.catalogo_id;
    update catalogo set precio_base = round(p_precio, 2) where id = cid;
    update costeo_modelos set estado = 'listo', actualizado_por = auth.uid(), actualizado_en = now() where id = mid;
  end if;
  return jsonb_build_object('catalogo_id', cid);
end $$;

-- Reglas del costeo. p: {ganancia?, puertas_mes?, corte_cm?, iva?}
create or replace function public.costeo_reglas_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian las reglas'; end if;
  if coalesce(nullif(p->>'ganancia','')::numeric, 30) < 0 or coalesce(nullif(p->>'ganancia','')::numeric, 30) > 300 then raise exception 'Revisa la ganancia'; end if;
  if coalesce(nullif(p->>'puertas_mes','')::int, 25) <= 0 then raise exception 'Las puertas al mes deben ser más de 0'; end if;
  if coalesce(nullif(p->>'corte_cm','')::numeric, 0) < 0 or coalesce(nullif(p->>'corte_cm','')::numeric, 0) > 2 then raise exception 'El grosor del corte va de 0 a 2 cm'; end if;
  update costeo_reglas set ganancia = coalesce(nullif(p->>'ganancia','')::numeric, ganancia), puertas_mes = coalesce(nullif(p->>'puertas_mes','')::int, puertas_mes),
    corte_cm = coalesce(nullif(p->>'corte_cm','')::numeric, corte_cm), iva = coalesce(nullif(p->>'iva','')::numeric, iva), actualizado_en = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;

-- Insumo para costear (pintura, consumibles, accesorios). p: {id?, nombre, grupo, precio, rendimiento?}
create or replace function public.costeo_insumo_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; nom text := nullif(trim(p->>'nombre'),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian los costos'; end if;
  if nom is null then raise exception 'Escribe el nombre'; end if;
  if coalesce(p->>'grupo','') not in ('Pintura y masilla','Consumibles','Accesorios') then raise exception 'Elige el grupo'; end if;
  if coalesce(nullif(p->>'precio','')::numeric, -1) < 0 then raise exception 'Escribe el precio sin IVA'; end if;
  if nullif(p->>'id','') is null then
    insert into costeo_insumos (nombre, grupo, precio, rendimiento, orden) values (nom, p->>'grupo', (p->>'precio')::numeric, nullif(p->>'rendimiento','')::numeric,
      (select coalesce(max(orden), 0) + 1 from costeo_insumos)) returning id into nid;
  else
    update costeo_insumos set nombre = nom, grupo = p->>'grupo', precio = (p->>'precio')::numeric, rendimiento = nullif(p->>'rendimiento','')::numeric,
      activo = coalesce((p->>'activo')::boolean, activo) where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe ese insumo'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

-- Lote 7: extras de la venta (protección y marco decorativo) toman el precio de Costos (se puede cambiar).
-- Devuelve {catalogo_id: {proteccion, marco_decorativo}} con el precio de venta (costo × ganancia) de los extras
-- que se llamen así. Lo usa el formulario de venta solo como sugerencia; la vendedora no ve costos.
create or replace function public.extras_precios()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare g numeric;
begin
  if auth.uid() is null then return '{}'::jsonb; end if;
  if not _es_deposito() then return '{}'::jsonb; end if;
  select 1 + ganancia / 100 into g from costeo_reglas where id = 1;
  return coalesce((select jsonb_object_agg(cm.catalogo_id::text, x) from (
      select cm.catalogo_id, jsonb_strip_nulls(jsonb_build_object(
        'proteccion', (select round(e.costo * g) from costeo_extras e where e.modelo_id = cm.id and lower(e.nombre) like 'protecci%' order by e.orden limit 1),
        'marco_decorativo', (select round(e.costo * g) from costeo_extras e where e.modelo_id = cm.id and lower(e.nombre) like 'marco%' order by e.orden limit 1))) x
      from costeo_modelos cm where cm.catalogo_id is not null) cm where cm.x <> '{}'::jsonb), '{}'::jsonb);
end $$;

-- Avisos de Inicio: se suman los de Costos (modelos vendidos sin costear y en fabricación sin cortes)
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
         and lower(m.categoria) = lower(g.categoria) and date_trunc('month', m.fecha) = date_trunc('month', _hoy_vzla()))), '[]'::jsonb),
    'costeados', jsonb_build_object('listos', (select count(*) from costeo_modelos where catalogo_id is not null and estado = 'listo'), 'total', (select count(*) from catalogo)),
    'sin_costear', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)) from catalogo c
       where c.id in (select vi.catalogo_id from venta_items vi join ventas v on v.id = vi.venta_id where v.estado not in ('cotizacion','cancelada') and not coalesce(v.interna, false))
         and not exists (select 1 from costeo_modelos cm where cm.catalogo_id = c.id and cm.estado = 'listo')), '[]'::jsonb),
    'sin_cortes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre)) from catalogo c
       where c.id in (select vi.catalogo_id from venta_items vi join ventas v on v.id = vi.venta_id where v.estado = 'en_produccion')
         and c.tipo in ('Puerta Multilock','Portón','Combo')
         and not exists (select 1 from costeo_modelos cm join costeo_piezas p on p.modelo_id = cm.id where cm.catalogo_id = c.id)), '[]'::jsonb)
  );
end $$;

revoke execute on function public._empacar(numeric[], numeric, numeric) from anon, public;
revoke execute on function public._gasto_real_por_puerta() from anon, public;
revoke execute on function public._prov_costeo(bigint) from anon, public;
revoke execute on function public._precio_costeo(bigint, bigint) from anon, public;
revoke execute on function public._costeo(bigint, bigint, text) from anon, public;
revoke execute on function public.costeo_calcular(bigint, bigint, text) from anon, public;
revoke execute on function public.costeo_resumen(bigint) from anon, public;
revoke execute on function public.costos_datos(bigint) from anon, public;
revoke execute on function public.costeo_guardar(jsonb) from anon, public;
revoke execute on function public.costeo_duplicar(bigint) from anon, public;
revoke execute on function public.costeo_pasar_catalogo(bigint, numeric) from anon, public;
revoke execute on function public.costeo_reglas_guardar(jsonb) from anon, public;
revoke execute on function public.costeo_insumo_guardar(jsonb) from anon, public;
revoke execute on function public.extras_precios() from anon, public;
grant execute on function public.costeo_calcular(bigint, bigint, text), public.costeo_resumen(bigint), public.costos_datos(bigint), public.costeo_guardar(jsonb),
  public.costeo_duplicar(bigint), public.costeo_pasar_catalogo(bigint, numeric), public.costeo_reglas_guardar(jsonb), public.costeo_insumo_guardar(jsonb),
  public.extras_precios() to authenticated;
