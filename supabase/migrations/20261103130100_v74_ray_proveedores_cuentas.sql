-- Autor: Ray (Claude de Ray)
-- v74 · Proveedores y cuentas (lote 2 de Finanzas y Costos).
-- Proveedores con tipos de material, si cobran IVA y sus datos de pago (opcionales).
-- Cuentas nuestras libres (Zelle, efectivo por sede, Binance, banco, bolívares).
-- Se leen solo admin (proveedores) o quien confirma pagos (cuentas). Se escriben solo por funciones.

create table if not exists public.proveedores (
  id bigint generated always as identity primary key,
  nombre text not null,
  rif text,
  telefono text,
  tipos text[] not null default '{}',
  cobra_iva boolean not null default false,
  principal boolean not null default false,
  datos_pago text,
  nota text,
  activo boolean not null default true,
  cuadre_fecha date,
  cuadre_saldo numeric(12,2),
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  constraint proveedores_tipos_ok check (tipos <@ array['hierro','aluminio','laminas','vidrio','pintura','consumibles','accesorios','madera']::text[])
);
create unique index if not exists proveedores_nombre_uq on public.proveedores (lower(nombre));

create table if not exists public.cuentas (
  id bigint generated always as identity primary key,
  nombre text not null,
  tipo text not null default 'Otra',
  moneda text not null default 'USD' check (moneda in ('USD','VES')),
  orden int not null default 0,
  activa boolean not null default true,
  nota text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  constraint cuentas_tipo_ok check (tipo in ('Zelle','Efectivo','Binance','Banco','Bolívares','Otra'))
);
create unique index if not exists cuentas_nombre_uq on public.cuentas (lower(nombre));

alter table public.proveedores enable row level security;
alter table public.cuentas enable row level security;
create policy "proveedores admin lee" on public.proveedores for select using (_es_admin());
create policy "cuentas quien confirma pagos lee" on public.cuentas for select using (_es_ray());

-- Guardar o crear un proveedor. p: {id?, nombre, rif, telefono, tipos[], cobra_iva, datos_pago, nota, activo}
create or replace function public.proveedor_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; nom text := nullif(trim(p->>'nombre'), ''); tps text[];
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian proveedores'; end if;
  if nom is null then raise exception 'Escribe el nombre'; end if;
  select coalesce(array_agg(x), '{}') into tps from jsonb_array_elements_text(coalesce(p->'tipos', '[]'::jsonb)) x;
  if cardinality(tps) = 0 then raise exception 'Elige al menos un tipo de material'; end if;
  if exists (select 1 from proveedores where lower(nombre) = lower(nom) and id is distinct from nullif(p->>'id','')::bigint) then
    raise exception 'Ya hay un proveedor con ese nombre'; end if;
  if nullif(p->>'id','') is null then
    insert into proveedores (nombre, rif, telefono, tipos, cobra_iva, datos_pago, nota, creado_por)
    values (nom, nullif(trim(p->>'rif'),''), nullif(trim(p->>'telefono'),''), tps, coalesce((p->>'cobra_iva')::boolean, false),
            nullif(trim(p->>'datos_pago'),''), nullif(trim(p->>'nota'),''), auth.uid())
    returning id into nid;
  else
    update proveedores set nombre = nom, rif = nullif(trim(p->>'rif'),''), telefono = nullif(trim(p->>'telefono'),''), tipos = tps,
      cobra_iva = coalesce((p->>'cobra_iva')::boolean, cobra_iva), datos_pago = nullif(trim(p->>'datos_pago'),''),
      nota = nullif(trim(p->>'nota'),''), activo = coalesce((p->>'activo')::boolean, activo)
    where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe ese proveedor'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

-- Marcar que se cuadró con el proveedor hoy (guarda la fecha y el saldo de ese momento)
create or replace function public.proveedor_cuadrar(pid bigint, p_saldo numeric)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cuadran con proveedores'; end if;
  update proveedores set cuadre_fecha = (now() at time zone 'America/Caracas')::date, cuadre_saldo = round(p_saldo, 2) where id = pid;
  if not found then raise exception 'No existe ese proveedor'; end if;
  return jsonb_build_object('id', pid);
end $$;

-- Guardar o crear una cuenta nuestra. p: {id?, nombre, tipo, moneda, orden, activa, nota}
create or replace function public.cuenta_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; nom text := nullif(trim(p->>'nombre'), ''); tp text := coalesce(nullif(p->>'tipo',''), 'Otra');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian las cuentas'; end if;
  if nom is null then raise exception 'Escribe el nombre de la cuenta'; end if;
  if tp not in ('Zelle','Efectivo','Binance','Banco','Bolívares','Otra') then raise exception 'Elige el tipo de cuenta'; end if;
  if exists (select 1 from cuentas where lower(nombre) = lower(nom) and id is distinct from nullif(p->>'id','')::bigint) then
    raise exception 'Ya hay una cuenta con ese nombre'; end if;
  if nullif(p->>'id','') is null then
    insert into cuentas (nombre, tipo, moneda, orden, nota, creado_por)
    values (nom, tp, case when tp = 'Bolívares' then 'VES' else coalesce(nullif(p->>'moneda',''), 'USD') end,
            coalesce((p->>'orden')::int, (select coalesce(max(orden), 0) + 1 from cuentas)), nullif(trim(p->>'nota'),''), auth.uid())
    returning id into nid;
  else
    update cuentas set nombre = nom, tipo = tp, orden = coalesce((p->>'orden')::int, orden),
      activa = coalesce((p->>'activa')::boolean, activa), nota = nullif(trim(p->>'nota'),'')
    where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe esa cuenta'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

revoke execute on function public.proveedor_guardar(jsonb) from anon, public;
revoke execute on function public.proveedor_cuadrar(bigint, numeric) from anon, public;
revoke execute on function public.cuenta_guardar(jsonb) from anon, public;
grant execute on function public.proveedor_guardar(jsonb) to authenticated;
grant execute on function public.proveedor_cuadrar(bigint, numeric) to authenticated;
grant execute on function public.cuenta_guardar(jsonb) to authenticated;
-- Los proveedores reales se cargan aparte en v78b (datos).
