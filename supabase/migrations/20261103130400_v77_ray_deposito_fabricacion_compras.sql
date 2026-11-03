-- Autor: Ray (Claude de Ray)
-- v77 · Depósito: material de fabricación por tubo y hoja, precios por proveedor con historial y
-- compras (lote 5 de Finanzas y Costos). Toca dinero: la compra resta del saldo del proveedor.
-- El material de fabricación va en su propia tabla (materiales_fab) para no tocar los consumibles
-- (entregas, revisión y avisos siguen igual). Los precios se guardan SIN IVA (Costos los usa así).
-- Una compra puede guardarse solo con su total y el material "por registrar" (se carga después).

create table if not exists public.materiales_fab (
  id bigint generated always as identity primary key,
  codigo text,
  nombre text not null,
  tipo text not null check (tipo in ('hierro','aluminio','laminas','vidrio')),
  presentacion text not null check (presentacion in ('barra','hoja')),
  largo_cm numeric(8,1),
  hoja_ancho_cm numeric(8,1),
  hoja_alto_cm numeric(8,1),
  espesor text,
  precio_fijo numeric(12,2),
  stock int not null default 0 check (stock >= 0),
  minimo int not null default 0 check (minimo >= 0),
  activo boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now(),
  constraint materiales_fab_medidas check ((presentacion = 'barra' and largo_cm > 0) or (presentacion = 'hoja' and hoja_ancho_cm > 0 and hoja_alto_cm > 0))
);
create unique index if not exists materiales_fab_nombre_uq on public.materiales_fab (lower(nombre));
create unique index if not exists materiales_fab_codigo_uq on public.materiales_fab (codigo) where codigo is not null;

-- Retazos de barra (largo) y sobrantes de hoja (largo × ancho) que sirven (50 cm o más)
create table if not exists public.material_retazos (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_fab(id),
  largo_cm numeric(8,1) not null check (largo_cm > 0),
  ancho_cm numeric(8,1),
  origen text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  usado_en timestamptz,
  usado_por uuid references auth.users(id),
  usado_motivo text
);
create index if not exists material_retazos_vivos on public.material_retazos (material_id) where usado_en is null;

-- Precio sin IVA de cada material por proveedor, con historial (vigente = el de hoy)
create table if not exists public.material_precios (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_fab(id),
  proveedor_id bigint not null references public.proveedores(id),
  precio numeric(12,2) not null check (precio > 0),
  espesor text,
  desde date not null default ((now() at time zone 'America/Caracas')::date),
  vigente boolean not null default true,
  origen text not null default 'manual' check (origen in ('manual','compra','datos')),
  registrado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create unique index if not exists material_precios_vigente_uq on public.material_precios (material_id, proveedor_id) where vigente;

create table if not exists public.compras (
  id bigint generated always as identity primary key,
  proveedor_id bigint not null references public.proveedores(id),
  documento text not null check (documento in ('factura','nota')),
  numero text,
  fecha date not null default ((now() at time zone 'America/Caracas')::date),
  subtotal numeric(12,2) not null default 0,
  iva numeric(12,2) not null default 0,
  total numeric(12,2) not null check (total > 0),
  material_pendiente boolean not null default false,
  foto text,
  nota text,
  anulada_en timestamptz,
  anulada_por uuid references auth.users(id),
  anulada_motivo text,
  registrado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index if not exists compras_proveedor_idx on public.compras (proveedor_id);

create table if not exists public.compra_lineas (
  id bigint generated always as identity primary key,
  compra_id bigint not null references public.compras(id),
  material_id bigint references public.materiales_fab(id),
  consumible_id bigint references public.materiales(id),
  descripcion text,
  cantidad numeric(10,2) not null check (cantidad > 0),
  precio numeric(12,2) not null check (precio >= 0),
  constraint compra_lineas_un_material check (num_nonnulls(material_id, consumible_id) <= 1)
);

-- Lo que entra y sale de cada material de fabricación (compras, cortes, conteos)
create table if not exists public.material_movs (
  id bigint generated always as identity primary key,
  material_id bigint not null references public.materiales_fab(id),
  cantidad int not null,
  motivo text not null check (motivo in ('compra','corte','conteo','ajuste','anulada')),
  compra_id bigint references public.compras(id),
  referencia text,
  registrado_por uuid references auth.users(id),
  fecha timestamptz not null default now()
);
create index if not exists material_movs_mat_idx on public.material_movs (material_id, fecha desc);

create table if not exists public.conteos (
  id bigint generated always as identity primary key,
  fecha timestamptz not null default now(),
  diferencias jsonb not null default '[]'::jsonb,
  registrado_por uuid references auth.users(id)
);

alter table public.movimientos drop constraint if exists movimientos_compra_fk;
alter table public.movimientos add constraint movimientos_compra_fk foreign key (compra_id) references public.compras(id);

alter table public.materiales_fab enable row level security;
alter table public.material_retazos enable row level security;
alter table public.material_precios enable row level security;
alter table public.compras enable row level security;
alter table public.compra_lineas enable row level security;
alter table public.material_movs enable row level security;
alter table public.conteos enable row level security;
create policy "materiales fab admin lee" on public.materiales_fab for select using (_es_admin());
create policy "retazos admin lee" on public.material_retazos for select using (_es_admin());
create policy "precios admin lee" on public.material_precios for select using (_es_admin());
create policy "compras admin lee" on public.compras for select using (_es_admin());
create policy "compra lineas admin lee" on public.compra_lineas for select using (_es_admin());
create policy "material movs admin lee" on public.material_movs for select using (_es_admin());
create policy "conteos admin lee" on public.conteos for select using (_es_admin());

-- ---------- Funciones ----------

-- Crear o editar material de fabricación. p: {id?, nombre, codigo?, tipo, presentacion, largo_cm | hoja_ancho_cm+hoja_alto_cm, espesor?, precio_fijo?, minimo?, activo?}
create or replace function public.material_fab_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; nom text := nullif(trim(p->>'nombre'),''); pres text := p->>'presentacion';
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cambia materiales'; end if;
  if nom is null then raise exception 'Escribe el nombre'; end if;
  if coalesce(p->>'tipo','') not in ('hierro','aluminio','laminas','vidrio') then raise exception 'Elige el tipo de material'; end if;
  if coalesce(pres,'') not in ('barra','hoja') then raise exception 'Elige si es barra u hoja'; end if;
  if pres = 'barra' and coalesce(nullif(p->>'largo_cm','')::numeric, 0) <= 0 then raise exception 'Escribe el largo de la barra'; end if;
  if pres = 'hoja' and (coalesce(nullif(p->>'hoja_ancho_cm','')::numeric, 0) <= 0 or coalesce(nullif(p->>'hoja_alto_cm','')::numeric, 0) <= 0) then raise exception 'Escribe las medidas de la hoja'; end if;
  if exists (select 1 from materiales_fab where lower(nombre) = lower(nom) and id is distinct from nullif(p->>'id','')::bigint) then raise exception 'Ya hay un material con ese nombre'; end if;
  if nullif(p->>'id','') is null then
    insert into materiales_fab (codigo, nombre, tipo, presentacion, largo_cm, hoja_ancho_cm, hoja_alto_cm, espesor, precio_fijo, minimo, orden)
    values (nullif(trim(p->>'codigo'),''), nom, p->>'tipo', pres,
      case when pres = 'barra' then (p->>'largo_cm')::numeric end, case when pres = 'hoja' then (p->>'hoja_ancho_cm')::numeric end,
      case when pres = 'hoja' then (p->>'hoja_alto_cm')::numeric end, nullif(trim(p->>'espesor'),''), nullif(p->>'precio_fijo','')::numeric,
      coalesce(nullif(p->>'minimo','')::int, 0), (select coalesce(max(orden), 0) + 1 from materiales_fab))
    returning id into nid;
  else
    update materiales_fab set nombre = nom, tipo = p->>'tipo', presentacion = pres,
      largo_cm = case when pres = 'barra' then (p->>'largo_cm')::numeric end,
      hoja_ancho_cm = case when pres = 'hoja' then (p->>'hoja_ancho_cm')::numeric end,
      hoja_alto_cm = case when pres = 'hoja' then (p->>'hoja_alto_cm')::numeric end,
      espesor = nullif(trim(p->>'espesor'),''), precio_fijo = nullif(p->>'precio_fijo','')::numeric,
      minimo = coalesce(nullif(p->>'minimo','')::int, minimo), activo = coalesce((p->>'activo')::boolean, activo)
    where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe ese material'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

-- Precio sin IVA de un material con un proveedor. Guarda historial: el anterior deja de estar vigente.
create or replace function public._precio_poner(mid bigint, pid bigint, pr numeric, esp text, org text, f date)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare act material_precios%rowtype;
begin
  select * into act from material_precios where material_id = mid and proveedor_id = pid and vigente;
  if found and act.precio = round(pr, 2) and coalesce(act.espesor,'') = coalesce(esp, act.espesor, '') then return; end if;
  update material_precios set vigente = false where material_id = mid and proveedor_id = pid and vigente;
  insert into material_precios (material_id, proveedor_id, precio, espesor, desde, origen, registrado_por)
  values (mid, pid, round(pr, 2), coalesce(esp, act.espesor), coalesce(f, _hoy_vzla()), org, auth.uid());
end $$;

-- p: {material_id, proveedor_id, precio (sin IVA), espesor?}
create or replace function public.material_precio_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare mid bigint := nullif(p->>'material_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint; pr numeric := nullif(p->>'precio','')::numeric; tp text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cambia precios'; end if;
  select tipo into tp from materiales_fab where id = mid;
  if not found then raise exception 'No existe ese material'; end if;
  if not exists (select 1 from proveedores where id = pid) then raise exception 'No existe ese proveedor'; end if;
  if pr is null or pr <= 0 or pr > 100000 then raise exception 'Escribe el precio sin IVA'; end if;
  perform _precio_poner(mid, pid, pr, nullif(trim(p->>'espesor'),''), 'manual', null);
  return jsonb_build_object('ok', true);
end $$;

-- Retazos: agregar a mano (los del corte los pone el plan de la semana) o quitar con motivo
create or replace function public.retazo_agregar(mid bigint, p_largo numeric, p_ancho numeric default null)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; pres text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cambia el depósito'; end if;
  select presentacion into pres from materiales_fab where id = mid;
  if not found then raise exception 'No existe ese material'; end if;
  if p_largo is null or p_largo < 10 or p_largo > 1000 then raise exception 'Escribe la medida en cm'; end if;
  if pres = 'hoja' and (p_ancho is null or p_ancho < 10) then raise exception 'Escribe las dos medidas del sobrante'; end if;
  insert into material_retazos (material_id, largo_cm, ancho_cm, origen, creado_por)
  values (mid, round(p_largo, 1), case when pres = 'hoja' then round(p_ancho, 1) end, 'A mano', auth.uid()) returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.retazo_quitar(rid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cambia el depósito'; end if;
  update material_retazos set usado_en = now(), usado_por = auth.uid(), usado_motivo = coalesce(nullif(trim(motivo),''), 'Se quitó a mano')
  where id = rid and usado_en is null;
  if not found then raise exception 'Ese retazo ya no está'; end if;
  return jsonb_build_object('id', rid);
end $$;

-- Sube o baja el stock de un material de fabricación y deja el movimiento
create or replace function public._fab_mover(mid bigint, n int, mot text, cid bigint, ref text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare s int;
begin
  if n = 0 then return; end if;
  update materiales_fab set stock = stock + n where id = mid returning stock into s;
  if not found then raise exception 'No existe ese material'; end if;
  if s < 0 then raise exception 'No hay tantas barras u hojas en el depósito'; end if;
  insert into material_movs (material_id, cantidad, motivo, compra_id, referencia, registrado_por) values (mid, n, mot, cid, ref, auth.uid());
end $$;

-- Guarda las líneas de material de una compra: sube el stock y pone el precio del proveedor
create or replace function public._compra_lineas_poner(cid bigint, lineas jsonb)
 returns int language plpgsql security definer set search_path to 'public'
as $$
declare c compras%rowtype; l jsonb; mid bigint; kid bigint; q numeric; pr numeric; n int := 0; pnom text; tp text; tps text[];
begin
  select * into c from compras where id = cid;
  select nombre, tipos into pnom, tps from proveedores where id = c.proveedor_id;
  for l in select * from jsonb_array_elements(coalesce(lineas, '[]'::jsonb)) loop
    mid := nullif(l->>'material_id','')::bigint; kid := nullif(l->>'consumible_id','')::bigint;
    q := nullif(l->>'cantidad','')::numeric; pr := coalesce(nullif(l->>'precio','')::numeric, 0);
    if q is null or q <= 0 then raise exception 'Escribe la cantidad de cada material'; end if;
    if pr < 0 then raise exception 'El precio no puede ser negativo'; end if;
    if mid is not null and kid is not null then raise exception 'Cada línea es de un solo material'; end if;
    if mid is null and kid is null and nullif(trim(l->>'descripcion'),'') is null then raise exception 'Elige el material de cada línea'; end if;
    insert into compra_lineas (compra_id, material_id, consumible_id, descripcion, cantidad, precio)
    values (cid, mid, kid, nullif(trim(l->>'descripcion'),''), q, round(pr, 2));
    if mid is not null then
      select tipo into tp from materiales_fab where id = mid;
      if not found then raise exception 'No existe ese material'; end if;
      if q <> trunc(q) then raise exception 'Las barras y hojas se cuentan enteras'; end if;
      perform _fab_mover(mid, q::int, 'compra', cid, 'Compra a ' || replace(pnom, 'Inversiones ', ''));
      if pr > 0 then perform _precio_poner(mid, c.proveedor_id, pr, null, 'compra', c.fecha); end if;
    elsif kid is not null then
      if q <> trunc(q) then raise exception 'Los consumibles se cuentan enteros'; end if;
      update materiales set stock = stock + q::int, actualizado_en = now() where id = kid;
      if not found then raise exception 'No existe ese consumible'; end if;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Compra (factura o nota). No pregunta cómo se pagó: resta del saldo del proveedor.
-- p: {proveedor_id, documento, numero?, fecha?, total?, foto?, nota?, lineas:[{material_id|consumible_id|descripcion, cantidad, precio sin IVA}],
--     aparte?: {cuenta_id, monto_salio|monto, monto_llego?, monto_bs?, tasa?, tasa_origen?, referencia?}}
-- Sin líneas: se guarda con su total y el material queda "por registrar".
create or replace function public.compra_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare pid bigint := nullif(p->>'proveedor_id','')::bigint; doc text := coalesce(nullif(p->>'documento',''), 'nota'); cid bigint;
  sub numeric; iv numeric; tot numeric; nl int; pnom text; f date := _mov_fecha(p); ap jsonb := p->'aparte'; num text := nullif(trim(p->>'numero'),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador registra compras'; end if;
  select nombre into pnom from proveedores where id = pid;
  if not found then raise exception 'Elige el proveedor'; end if;
  if doc not in ('factura','nota') then raise exception 'Elige factura o nota'; end if;
  if num is not null and exists (select 1 from compras where proveedor_id = pid and numero = num and anulada_en is null) then
    raise exception 'Ya hay una compra de ese proveedor con ese número'; end if;
  nl := jsonb_array_length(coalesce(p->'lineas', '[]'::jsonb));
  if nl > 0 then
    select round(sum((l->>'cantidad')::numeric * coalesce(nullif(l->>'precio','')::numeric, 0)), 2) into sub from jsonb_array_elements(p->'lineas') l;
    iv := case when doc = 'factura' then round(sub * 0.16, 2) else 0 end;
    tot := coalesce(nullif(p->>'total','')::numeric, sub + iv);
  else
    tot := nullif(p->>'total','')::numeric;
    if tot is null or tot <= 0 then raise exception 'Escribe el total del papel'; end if;
    iv := case when doc = 'factura' then round(tot - tot / 1.16, 2) else 0 end;
    sub := tot - iv;
  end if;
  if tot <= 0 or tot > 1000000 then raise exception 'Revisa el total de la compra'; end if;
  insert into compras (proveedor_id, documento, numero, fecha, subtotal, iva, total, material_pendiente, foto, nota, registrado_por)
  values (pid, doc, num, f, sub, iv, round(tot, 2), nl = 0, nullif(p->>'foto',''), nullif(trim(p->>'nota'),''), auth.uid()) returning id into cid;
  if nl > 0 then perform _compra_lineas_poner(cid, p->'lineas'); end if;
  insert into movimientos (fecha, tipo, proveedor_id, monto_proveedor, referencia, nota, compra_id, registrado_por)
  values (f, 'compra', pid, -round(tot, 2), case when doc = 'factura' then 'Factura ' else 'Nota ' end || coalesce(num, 'sin número'),
          case when nl = 0 then 'Material por registrar' end, cid, auth.uid());
  if ap is not null and jsonb_typeof(ap) = 'object' and nullif(ap->>'cuenta_id','') is not null then
    perform transferencia_guardar(ap || jsonb_build_object('proveedor_id', pid, 'fecha', f,
      'nota', 'Para la compra ' || coalesce(num, ''), 'referencia', coalesce(nullif(ap->>'referencia',''), 'Compra ' || coalesce(num, ''))));
  end if;
  return jsonb_build_object('id', cid, 'total', round(tot, 2), 'saldo_proveedor', _saldo_proveedor(pid));
end $$;

-- Registrar el material de una compra que se guardó solo con su total
create or replace function public.compra_material_registrar(cid bigint, lineas jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare c compras%rowtype; n int; sub numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador registra compras'; end if;
  select * into c from compras where id = cid for update;
  if not found or c.anulada_en is not null then raise exception 'No existe esa compra'; end if;
  if not c.material_pendiente then raise exception 'El material de esta compra ya está registrado'; end if;
  if jsonb_array_length(coalesce(lineas, '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un material'; end if;
  n := _compra_lineas_poner(cid, lineas);
  select round(sum(cantidad * precio), 2) into sub from compra_lineas where compra_id = cid;
  update compras set material_pendiente = false where id = cid;
  update movimientos set nota = null where compra_id = cid and tipo = 'compra' and nota = 'Material por registrar';
  return jsonb_build_object('id', cid, 'lineas', n, 'subtotal_lineas', sub, 'subtotal_papel', c.subtotal);
end $$;

-- Anular una compra mal cargada: anula su movimiento y devuelve el stock
create or replace function public.compra_anular(cid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare c compras%rowtype; l record; mot text := nullif(trim(motivo),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo anulan compras'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  select * into c from compras where id = cid for update;
  if not found then raise exception 'No existe esa compra'; end if;
  if c.anulada_en is not null then raise exception 'Esa compra ya estaba anulada'; end if;
  for l in select * from compra_lineas where compra_id = cid loop
    if l.material_id is not null then
      perform _fab_mover(l.material_id, -least(l.cantidad::int, (select stock from materiales_fab where id = l.material_id)), 'anulada', cid, 'Compra anulada');
    end if;
    if l.consumible_id is not null then update materiales set stock = greatest(0, stock - l.cantidad::int) where id = l.consumible_id; end if;
  end loop;
  update compras set anulada_en = now(), anulada_por = auth.uid(), anulada_motivo = mot where id = cid;
  update movimientos set anulado_en = now(), anulado_por = auth.uid(), anulado_motivo = 'Compra anulada: ' || mot where compra_id = cid and tipo = 'compra' and anulado_en is null;
  return jsonb_build_object('id', cid);
end $$;

-- Conteo de barras y hojas: lo contado reemplaza lo anotado y quedan las diferencias
-- p: {conteo:[{material_id, contado}]}
create or replace function public.conteo_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare x jsonb; mid bigint; v int; ant int; nom text; difs jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cuenta el depósito'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'conteo', '[]'::jsonb)) loop
    mid := nullif(x->>'material_id','')::bigint; v := nullif(x->>'contado','')::int;
    if v is null then continue; end if;
    if v < 0 or v > 10000 then raise exception 'Revisa lo contado'; end if;
    select stock, nombre into ant, nom from materiales_fab where id = mid for update;
    if not found then raise exception 'No existe ese material'; end if;
    if v <> ant then
      perform _fab_mover(mid, v - ant, 'conteo', null, 'Ajuste por conteo');
      difs := difs || jsonb_build_object('material_id', mid, 'nombre', nom, 'antes', ant, 'contado', v);
    end if;
  end loop;
  insert into conteos (diferencias, registrado_por) values (difs, auth.uid());
  return jsonb_build_object('diferencias', difs);
end $$;

-- Todo lo del depósito de fabricación y compras en una lectura (solo admin)
create or replace function public.deposito_fab_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador ve el material de fabricación'; end if;
  return jsonb_build_object(
    'fab', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'codigo', m.codigo, 'nombre', m.nombre, 'tipo', m.tipo, 'pres', m.presentacion,
        'largo', m.largo_cm, 'hoja', case when m.presentacion = 'hoja' then jsonb_build_array(m.hoja_ancho_cm, m.hoja_alto_cm) end,
        'espesor', m.espesor, 'fijo', m.precio_fijo, 'stock', m.stock, 'minimo', m.minimo, 'activo', m.activo,
        'retazos', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'largo', r.largo_cm, 'ancho', r.ancho_cm) order by r.largo_cm desc)
           from material_retazos r where r.material_id = m.id and r.usado_en is null), '[]'::jsonb),
        'precios', coalesce((select jsonb_object_agg(pp.proveedor_id::text, jsonb_build_object('p', pp.precio, 'esp', pp.espesor, 'desde', pp.desde))
           from material_precios pp where pp.material_id = m.id and pp.vigente), '{}'::jsonb)) order by m.orden, m.id) from materiales_fab m), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipos', to_jsonb(p.tipos), 'iva', p.cobra_iva,
        'activo', p.activo, 'saldo', _saldo_proveedor(p.id)) order by p.principal desc, p.nombre) from proveedores p), '[]'::jsonb),
    'cuentas', case when _es_ray() then coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'moneda', c.moneda) order by c.orden)
        from cuentas c where c.activa), '[]'::jsonb) else '[]'::jsonb end,
    'compras', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'prov', c.proveedor_id, 'doc', c.documento, 'numero', c.numero, 'fecha', c.fecha,
        'subtotal', c.subtotal, 'iva', c.iva, 'total', c.total, 'pendiente', c.material_pendiente, 'foto', c.foto, 'nota', c.nota,
        'anulada', case when c.anulada_en is null then null else jsonb_build_object('motivo', c.anulada_motivo) end,
        'lineas', coalesce((select jsonb_agg(jsonb_build_object('material_id', l.material_id, 'consumible_id', l.consumible_id,
           'n', coalesce(mf.nombre, mc.nombre, l.descripcion), 'q', l.cantidad, 'p', l.precio) order by l.id)
           from compra_lineas l left join materiales_fab mf on mf.id = l.material_id left join materiales mc on mc.id = l.consumible_id where l.compra_id = c.id), '[]'::jsonb))
        order by c.fecha desc, c.id desc) from (select * from compras order by fecha desc, id desc limit 200) c), '[]'::jsonb),
    'movs', coalesce((select jsonb_agg(jsonb_build_object('mid', x.material_id, 'n', x.cantidad, 'motivo', x.motivo, 'ref', x.referencia, 'fecha', x.fecha, 'por', coalesce(pr.nombre, '')) order by x.fecha desc)
        from (select * from material_movs order by fecha desc limit 300) x left join perfiles pr on pr.id = x.registrado_por), '[]'::jsonb),
    'conteo', (select jsonb_build_object('fecha', c.fecha, 'diferencias', c.diferencias, 'por', coalesce(pr.nombre, '')) from conteos c left join perfiles pr on pr.id = c.registrado_por order by c.fecha desc limit 1),
    'consumibles', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre) order by lower(m.nombre)) from materiales m where m.activo), '[]'::jsonb)
  );
end $$;

revoke execute on function public._precio_poner(bigint, bigint, numeric, text, text, date) from anon, public;
revoke execute on function public._fab_mover(bigint, int, text, bigint, text) from anon, public;
revoke execute on function public._compra_lineas_poner(bigint, jsonb) from anon, public;
revoke execute on function public.material_fab_guardar(jsonb) from anon, public;
revoke execute on function public.material_precio_guardar(jsonb) from anon, public;
revoke execute on function public.retazo_agregar(bigint, numeric, numeric) from anon, public;
revoke execute on function public.retazo_quitar(bigint, text) from anon, public;
revoke execute on function public.compra_guardar(jsonb) from anon, public;
revoke execute on function public.compra_material_registrar(bigint, jsonb) from anon, public;
revoke execute on function public.compra_anular(bigint, text) from anon, public;
revoke execute on function public.conteo_guardar(jsonb) from anon, public;
revoke execute on function public.deposito_fab_datos() from anon, public;
grant execute on function public.material_fab_guardar(jsonb), public.material_precio_guardar(jsonb), public.retazo_agregar(bigint, numeric, numeric),
  public.retazo_quitar(bigint, text), public.compra_guardar(jsonb), public.compra_material_registrar(bigint, jsonb), public.compra_anular(bigint, text),
  public.conteo_guardar(jsonb), public.deposito_fab_datos() to authenticated;
