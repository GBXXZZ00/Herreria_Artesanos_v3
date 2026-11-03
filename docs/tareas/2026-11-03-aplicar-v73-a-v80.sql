-- Autor: Ray (Claude de Ray)
-- TODO JUNTO: migraciones v73 a v80 de Finanzas y Costos, en orden. Pegar completo en Supabase > SQL Editor > Run.
-- Si algo falla, se deshace solo (una sola transacción).
begin;

-- ===== 20261103130000_v73_ray_seguridad_abonos.sql =====
-- Autor: Ray (Claude de Ray)
-- v73 · Seguridad de abonos (lote 1 de Finanzas y Costos). CON CUIDADO: reglas de dinero y permisos.
-- 1) La vendedora ya no cambia ni borra abonos directo: solo lee e inserta pagos nuevos por confirmar
--    (crear_venta y convertir_en_venta los insertan). Cambiar y anular va solo por funciones.
-- 2) registrar_abono y cancelar_venta pasan a security definer y revisan el rol.
-- 3) Borrar una venta ya no borra sus abonos (sin ON DELETE CASCADE): si tiene pagos, no se borra.

drop policy if exists "abonos admin y vendedora" on public.abonos;
create policy "abonos leer admin y vendedora" on public.abonos for select using (_es_deposito());
create policy "abonos nuevo por confirmar" on public.abonos for insert
  with check (_es_deposito() and tipo = 'abono' and estado = 'por_confirmar'
              and registrado_por = auth.uid() and confirmado_por is null);

alter table public.abonos drop constraint if exists abonos_venta_id_fkey;
alter table public.abonos add constraint abonos_venta_id_fkey
  foreign key (venta_id) references public.ventas(id) on delete restrict;

create or replace function public.registrar_abono(vid bigint, a jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cur ventas%rowtype;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_deposito() then raise exception 'No tienes permiso para registrar pagos'; end if;
  select * into cur from ventas where id = vid for update;
  if nullif(a->>'clave','') is not null and exists (select 1 from abonos where clave = (a->>'clave')::uuid) then
    return jsonb_build_object('id', vid, 'pagado', pagado_venta(vid), 'repetida', true);
  end if;
  if not found or cur.estado in ('cotizacion','cancelada') then raise exception 'A esta venta no se le pueden registrar pagos'; end if;
  if coalesce((a->>'monto')::numeric, 0) <= 0 then raise exception 'Escribe el monto del pago'; end if;
  if pagado_venta(vid) + (a->>'monto')::numeric > cur.total then raise exception 'El pago es mayor que lo que resta por pagar'; end if;
  insert into abonos (clave, venta_id, monto, metodo, comprobante, registrado_por)
  values (nullif(a->>'clave','')::uuid, vid, (a->>'monto')::numeric, a->>'metodo', nullif(a->>'comprobante',''), auth.uid());
  update ventas set actualizado_en = now() where id = vid;
  return jsonb_build_object('id', vid, 'pagado', pagado_venta(vid));
end $function$;

create or replace function public.cancelar_venta(vid bigint, motivo text, metodo_devolucion text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare cur ventas%rowtype; pag numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_deposito() then raise exception 'No tienes permiso para cancelar'; end if;
  select * into cur from ventas where id = vid for update;
  if not found or cur.estado in ('cancelada','entregada') then raise exception 'Esta venta no se puede cancelar'; end if;
  if cur.estado <> 'cotizacion' and not _es_admin() then raise exception 'Solo un administrador puede cancelar una venta'; end if;
  pag := pagado_venta(vid);
  if pag > 0 then
    if coalesce(metodo_devolucion,'') not in ('Binance','Zelle','Bolívares','Efectivo') then raise exception 'Elige cómo se devolvió el dinero'; end if;
    insert into abonos (venta_id, tipo, monto, metodo, nota, registrado_por) values (vid, 'devolucion', pag, metodo_devolucion, 'Devolución por cancelación', auth.uid());
  end if;
  if cur.estado <> 'cotizacion' then perform _stock_devolver(vid); end if;
  update ventas set estado = 'cancelada', cancelada_en = now(), cancelada_motivo = nullif(trim(motivo),''), actualizado_en = now() where id = vid;
  return jsonb_build_object('id', vid, 'devuelto', pag);
end $function$;

revoke execute on function public.registrar_abono(bigint, jsonb) from anon, public;
revoke execute on function public.cancelar_venta(bigint, text, text) from anon, public;
grant execute on function public.registrar_abono(bigint, jsonb) to authenticated;
grant execute on function public.cancelar_venta(bigint, text, text) to authenticated;

-- ===== 20261103130100_v74_ray_proveedores_cuentas.sql =====
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

-- ===== 20261103130200_v75_ray_libreta.sql =====
-- Autor: Ray (Claude de Ray)
-- v75 · Libreta de dinero (lote 3 de Finanzas y Costos). CON CUIDADO: reglas de dinero.
-- Una sola libreta (movimientos). Cada renglón mueve una cuenta nuestra, un proveedor o los dos.
-- Los saldos se calculan sumando. Nada se borra: se anula con motivo.
-- Toda salida guarda dos montos: lo que salió de la cuenta y lo que llegó o se pagó. La diferencia
-- es "Comisión y cambio". En bolívares se guarda el monto en Bs, la tasa y de dónde es la tasa.
-- Nómina y vales: al pagar o entregar se elige de qué cuenta salió (o "después": queda por ubicar).

create table if not exists public.movimientos (
  id bigint generated always as identity primary key,
  fecha date not null default ((now() at time zone 'America/Caracas')::date),
  tipo text not null check (tipo in ('ajuste','transferencia','traspaso','gasto','compra','ubicar','nomina','vale')),
  cuenta_id bigint references public.cuentas(id),
  proveedor_id bigint references public.proveedores(id),
  monto_cuenta numeric(12,2) not null default 0,
  monto_proveedor numeric(12,2) not null default 0,
  monto_salio numeric(12,2),
  monto_llego numeric(12,2),
  comision numeric(12,2) generated always as (coalesce(monto_salio, 0) - coalesce(monto_llego, monto_salio, 0)) stored,
  monto_bs numeric(14,2),
  tasa numeric(14,4),
  tasa_origen text check (tasa_origen in ('BCV','Binance','Otra')),
  categoria text,
  referencia text,
  nota text,
  comprobante text,
  grupo bigint,
  abono_id bigint references public.abonos(id),
  pago_id bigint references public.pagos_trabajador(id),
  vale_id bigint references public.vales(id),
  compra_id bigint,
  por_ubicar boolean not null default false,
  anulado_en timestamptz,
  anulado_por uuid references auth.users(id),
  anulado_motivo text,
  registrado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index if not exists movimientos_cuenta_idx on public.movimientos (cuenta_id) where anulado_en is null;
create index if not exists movimientos_proveedor_idx on public.movimientos (proveedor_id) where anulado_en is null;
create index if not exists movimientos_fecha_idx on public.movimientos (fecha);
create unique index if not exists movimientos_pago_uq on public.movimientos (pago_id) where pago_id is not null and anulado_en is null;
create unique index if not exists movimientos_vale_uq on public.movimientos (vale_id) where vale_id is not null and anulado_en is null;

create table if not exists public.gastos_fijos (
  id bigint generated always as identity primary key,
  categoria text not null,
  monto numeric(12,2) not null default 0 check (monto >= 0),
  orden int not null default 0,
  activo boolean not null default true
);
create unique index if not exists gastos_fijos_cat_uq on public.gastos_fijos (lower(categoria));

alter table public.movimientos enable row level security;
alter table public.gastos_fijos enable row level security;
create policy "movimientos quien confirma pagos lee" on public.movimientos for select using (_es_ray());
create policy "gastos fijos admin lee" on public.gastos_fijos for select using (_es_admin());

-- ---------- Ayudantes internos ----------
create or replace function public._hoy_vzla() returns date language sql stable set search_path to 'public'
as $$ select (now() at time zone 'America/Caracas')::date $$;

create or replace function public._saldo_cuenta(cid bigint) returns numeric language sql stable security definer set search_path to 'public'
as $$ select coalesce(round(sum(monto_cuenta), 2), 0) from movimientos where cuenta_id = cid and anulado_en is null $$;

create or replace function public._saldo_proveedor(pid bigint) returns numeric language sql stable security definer set search_path to 'public'
as $$ select coalesce(round(sum(monto_proveedor), 2), 0) from movimientos where proveedor_id = pid and anulado_en is null $$;

-- Lee los montos de una salida: {monto_salio, monto_llego, monto, monto_bs, tasa, tasa_origen}
-- Si la cuenta es en bolívares y vienen Bs y tasa, lo que salió en dólares es Bs ÷ tasa.
create or replace function public._mov_montos(p jsonb, cid bigint, por_defecto numeric default null)
 returns jsonb language plpgsql stable set search_path to 'public'
as $$
declare bs numeric := nullif(p->>'monto_bs','')::numeric; ts numeric := nullif(p->>'tasa','')::numeric;
  sal numeric := coalesce(nullif(p->>'monto_salio','')::numeric, nullif(p->>'monto','')::numeric);
  lle numeric := nullif(p->>'monto_llego','')::numeric; mon text;
  org text := nullif(p->>'tasa_origen','');
begin
  select moneda into mon from cuentas where id = cid;
  if (bs is not null and bs <= 0) or (ts is not null and ts <= 0) then raise exception 'Los bolívares y la tasa deben ser mayores a 0'; end if;
  if mon = 'VES' then
    if bs is null or ts is null then raise exception 'Escribe los bolívares y la tasa'; end if;
    sal := round(bs / ts, 2);
  elsif bs is not null and ts is not null and sal is null then
    sal := round(bs / ts, 2);
  end if;
  sal := coalesce(sal, lle, por_defecto);
  lle := coalesce(lle, por_defecto, sal);
  if sal is null or sal <= 0 then raise exception 'Escribe el monto'; end if;
  if lle <= 0 then raise exception 'Escribe lo que llegó o se pagó'; end if;
  if sal > 1000000 or lle > 1000000 then raise exception 'El monto es demasiado alto'; end if;
  if org is not null and org not in ('BCV','Binance','Otra') then raise exception 'Elige de dónde es la tasa'; end if;
  if bs is not null and org is null then org := 'Otra'; end if;
  return jsonb_build_object('salio', round(sal, 2), 'llego', round(lle, 2), 'bs', bs, 'tasa', ts, 'origen', org);
end $$;

create or replace function public._mov_fecha(p jsonb) returns date language plpgsql stable set search_path to 'public'
as $$
declare f date := coalesce(nullif(p->>'fecha','')::date, _hoy_vzla());
begin
  if f > _hoy_vzla() + 1 then raise exception 'La fecha no puede ser futura'; end if;
  if f < date '2020-01-01' then raise exception 'Revisa la fecha'; end if;
  return f;
end $$;

create or replace function public._cuenta_activa(cid bigint) returns void language plpgsql stable set search_path to 'public'
as $$ begin
  if cid is null then raise exception 'Elige la cuenta'; end if;
  if not exists (select 1 from cuentas where id = cid and activa) then raise exception 'Esa cuenta no existe o está apagada'; end if;
end $$;

-- ---------- Funciones que usa la app (solo quien confirma pagos: Ray o Gualfredo) ----------

-- Le transferí a un proveedor. Sin proveedor queda "por ubicar" (en proceso).
-- p: {cuenta_id, proveedor_id?, monto_salio|monto, monto_llego?, monto_bs?, tasa?, tasa_origen?, referencia?, nota?, fecha?}
create or replace function public.transferencia_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare cid bigint := nullif(p->>'cuenta_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint; m jsonb; nid bigint;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo registran pagos a proveedores'; end if;
  perform _cuenta_activa(cid);
  if pid is not null and not exists (select 1 from proveedores where id = pid) then raise exception 'No existe ese proveedor'; end if;
  m := _mov_montos(p, cid);
  insert into movimientos (fecha, tipo, cuenta_id, proveedor_id, monto_cuenta, monto_proveedor, monto_salio, monto_llego, monto_bs, tasa, tasa_origen,
                           referencia, nota, comprobante, por_ubicar, registrado_por)
  values (_mov_fecha(p), 'transferencia', cid, pid, -(m->>'salio')::numeric, case when pid is null then 0 else (m->>'llego')::numeric end,
          (m->>'salio')::numeric, (m->>'llego')::numeric, (m->>'bs')::numeric, (m->>'tasa')::numeric, m->>'origen',
          nullif(trim(p->>'referencia'),''), nullif(trim(p->>'nota'),''), nullif(p->>'comprobante',''), pid is null, auth.uid())
  returning id into nid;
  return jsonb_build_object('id', nid, 'saldo_proveedor', case when pid is null then null else _saldo_proveedor(pid) end);
end $$;

-- Mover entre cuentas. No es gasto ni ingreso; si llega menos, la diferencia es comisión y cambio.
-- p: {de, a, monto_salio|monto, monto_llego?, monto_bs?, tasa?, tasa_origen?, nota?, fecha?}
create or replace function public.traspaso_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare de bigint := nullif(p->>'de','')::bigint; a bigint := nullif(p->>'a','')::bigint; m jsonb; g bigint; f date := _mov_fecha(p);
  nde text; na text; lle numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo mueven dinero entre cuentas'; end if;
  perform _cuenta_activa(de); perform _cuenta_activa(a);
  if de = a then raise exception 'Elige dos cuentas distintas'; end if;
  m := _mov_montos(p, de); lle := (m->>'llego')::numeric;
  select nombre into nde from cuentas where id = de; select nombre into na from cuentas where id = a;
  insert into movimientos (fecha, tipo, cuenta_id, monto_cuenta, monto_salio, monto_llego, monto_bs, tasa, tasa_origen, referencia, nota, registrado_por)
  values (f, 'traspaso', de, -(m->>'salio')::numeric, (m->>'salio')::numeric, lle, (m->>'bs')::numeric, (m->>'tasa')::numeric, m->>'origen',
          'A ' || na, nullif(trim(p->>'nota'),''), auth.uid()) returning id into g;
  update movimientos set grupo = g where id = g;
  insert into movimientos (fecha, tipo, cuenta_id, monto_cuenta, referencia, nota, grupo, registrado_por)
  values (f, 'traspaso', a, lle, 'De ' || nde, nullif(trim(p->>'nota'),''), g, auth.uid());
  return jsonb_build_object('id', g);
end $$;

-- Registrar un gasto. p: {cuenta_id, categoria, monto_salio|monto, monto_llego?, monto_bs?, tasa?, tasa_origen?, referencia?, nota?, fecha?}
create or replace function public.gasto_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare cid bigint := nullif(p->>'cuenta_id','')::bigint; cat text := nullif(trim(p->>'categoria'),''); m jsonb; nid bigint;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo registran gastos'; end if;
  if cat is null then raise exception 'Elige qué gasto es'; end if;
  perform _cuenta_activa(cid);
  m := _mov_montos(p, cid);
  insert into movimientos (fecha, tipo, cuenta_id, monto_cuenta, monto_salio, monto_llego, monto_bs, tasa, tasa_origen, categoria, referencia, nota, comprobante, registrado_por)
  values (_mov_fecha(p), 'gasto', cid, -(m->>'salio')::numeric, (m->>'salio')::numeric, (m->>'llego')::numeric, (m->>'bs')::numeric,
          (m->>'tasa')::numeric, m->>'origen', cat, coalesce(nullif(trim(p->>'referencia'),''), cat), nullif(trim(p->>'nota'),''), nullif(p->>'comprobante',''), auth.uid())
  returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

-- Cambiar saldo de una cuenta o de un proveedor: queda como ajuste con motivo y nombre.
-- p: {cuenta_id | proveedor_id, nuevo, motivo}. En proveedores: + a tu favor, − le debes.
create or replace function public.saldo_cambiar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare cid bigint := nullif(p->>'cuenta_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint;
  nuevo numeric := nullif(p->>'nuevo','')::numeric; mot text := nullif(trim(p->>'motivo'),''); actual numeric; dif numeric; nid bigint;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian saldos'; end if;
  if (cid is null) = (pid is null) then raise exception 'Elige una cuenta o un proveedor'; end if;
  if mot is null then raise exception 'Escribe por qué cambias el saldo'; end if;
  if nuevo is null or abs(nuevo) > 1000000 then raise exception 'Escribe el saldo'; end if;
  if cid is not null then
    if not exists (select 1 from cuentas where id = cid) then raise exception 'No existe esa cuenta'; end if;
    actual := _saldo_cuenta(cid);
  else
    if not exists (select 1 from proveedores where id = pid) then raise exception 'No existe ese proveedor'; end if;
    actual := _saldo_proveedor(pid);
  end if;
  dif := round(nuevo - actual, 2);
  if abs(dif) < 0.005 then return jsonb_build_object('id', null, 'diferencia', 0); end if;
  insert into movimientos (tipo, cuenta_id, proveedor_id, monto_cuenta, monto_proveedor, referencia, nota, registrado_por)
  values ('ajuste', cid, pid, case when cid is null then 0 else dif end, case when pid is null then 0 else dif end, 'Ajuste de saldo', mot, auth.uid())
  returning id into nid;
  return jsonb_build_object('id', nid, 'diferencia', dif);
end $$;

-- Anular un movimiento con motivo (no se borra). Un movimiento entre cuentas se anula completo.
create or replace function public.movimiento_anular(mid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare x movimientos%rowtype; mot text := nullif(trim(motivo),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo anulan movimientos'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  select * into x from movimientos where id = mid for update;
  if not found then raise exception 'No existe ese movimiento'; end if;
  if x.anulado_en is not null then raise exception 'Ese movimiento ya estaba anulado'; end if;
  update movimientos set anulado_en = now(), anulado_por = auth.uid(), anulado_motivo = mot
  where (id = mid or (x.grupo is not null and grupo = x.grupo)) and anulado_en is null;
  return jsonb_build_object('id', mid);
end $$;

-- Decir a qué cuenta o proveedor va una salida que quedó "por ubicar".
-- p: {cuenta_id?, proveedor_id?}. Al elegir la cuenta se puede decir cuánto salió de verdad
-- (monto_salio, o monto_bs y tasa si la cuenta es en bolívares): la diferencia es comisión y cambio.
create or replace function public.movimiento_ubicar(mid bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare x movimientos%rowtype; cid bigint := nullif(p->>'cuenta_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint; m jsonb;
  puede boolean;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  select * into x from movimientos where id = mid for update;
  if not found or x.anulado_en is not null then raise exception 'No existe ese movimiento'; end if;
  -- Quien pagó la nómina o el vale también puede decir de qué cuenta salió
  puede := _es_ray() or (x.pago_id is not null and _puede_pagar_a((select trabajador_id from pagos_trabajador where id = x.pago_id)))
           or (x.vale_id is not null and _puede_pagar_a((select trabajador_id from vales where id = x.vale_id)));
  if not puede then raise exception 'Solo Ray o Gualfredo ubican movimientos'; end if;
  if not x.por_ubicar then raise exception 'Ese movimiento ya está ubicado'; end if;
  if x.cuenta_id is null then
    perform _cuenta_activa(cid);
    m := _mov_montos(p - 'monto_llego', cid, x.monto_salio);
    update movimientos set cuenta_id = cid, monto_salio = (m->>'salio')::numeric, monto_cuenta = -(m->>'salio')::numeric,
      monto_bs = (m->>'bs')::numeric, tasa = (m->>'tasa')::numeric, tasa_origen = m->>'origen', por_ubicar = false where id = mid;
  else
    if pid is null or not exists (select 1 from proveedores where id = pid) then raise exception 'Elige el proveedor'; end if;
    update movimientos set proveedor_id = pid, monto_proveedor = coalesce(monto_llego, monto_salio, 0), por_ubicar = false where id = mid;
  end if;
  return jsonb_build_object('id', mid);
end $$;

-- Nómina del sábado: de qué cuenta salió el pago (el cálculo de la nómina no cambia).
-- p: {cuenta_id? (sin cuenta queda por ubicar), monto_salio?, monto_bs?, tasa?, tasa_origen?}
create or replace function public.nomina_salida(pid bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare pg pagos_trabajador%rowtype; cid bigint := nullif(p->>'cuenta_id','')::bigint; m jsonb; nid bigint; nom text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  select * into pg from pagos_trabajador where id = pid;
  if not found then raise exception 'No existe ese pago'; end if;
  if not _puede_pagar_a(pg.trabajador_id) then raise exception 'A este trabajador no le pagas tú'; end if;
  if exists (select 1 from movimientos where pago_id = pid and anulado_en is null) then raise exception 'Ese pago ya tiene su cuenta'; end if;
  if pg.monto <= 0 then return jsonb_build_object('id', null); end if;
  if cid is not null then perform _cuenta_activa(cid); end if;
  m := _mov_montos(p - 'monto_llego', cid, pg.monto);
  select nombre into nom from perfiles where id = pg.trabajador_id;
  insert into movimientos (tipo, cuenta_id, monto_cuenta, monto_salio, monto_llego, monto_bs, tasa, tasa_origen, categoria, referencia, pago_id, por_ubicar, registrado_por)
  values ('nomina', cid, case when cid is null then 0 else -(m->>'salio')::numeric end, (m->>'salio')::numeric, pg.monto,
          (m->>'bs')::numeric, (m->>'tasa')::numeric, m->>'origen', 'Nómina', 'Nómina · ' || coalesce(nom, ''), pid, cid is null, auth.uid())
  returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

-- Vale entregado (adelanto): sale de la cuenta el día que se entrega. El sábado se paga solo la diferencia.
create or replace function public.vale_salida(vid bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v vales%rowtype; cid bigint := nullif(p->>'cuenta_id','')::bigint; m jsonb; nid bigint; nom text; q jsonb := p - 'monto_llego';
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  select * into v from vales where id = vid;
  if not found then raise exception 'No existe ese vale'; end if;
  if not _puede_pagar_a(v.trabajador_id) then raise exception 'Este vale no lo entregas tú'; end if;
  if v.estado <> 'aprobado' then raise exception 'Ese vale no está aprobado'; end if;
  if exists (select 1 from movimientos where vale_id = vid and anulado_en is null) then raise exception 'Ese vale ya tiene su cuenta'; end if;
  if cid is not null then perform _cuenta_activa(cid); end if;
  if v.monto_bs is not null and q->>'monto_bs' is null then q := q || jsonb_build_object('monto_bs', v.monto_bs, 'tasa', v.tasa); end if;
  if cid is null or (select moneda from cuentas where id = cid) <> 'VES' then q := q - 'monto_bs' - 'tasa'; end if;
  m := _mov_montos(q, cid, v.monto);
  select nombre into nom from perfiles where id = v.trabajador_id;
  insert into movimientos (tipo, cuenta_id, monto_cuenta, monto_salio, monto_llego, monto_bs, tasa, tasa_origen, categoria, referencia, vale_id, por_ubicar, registrado_por)
  values ('vale', cid, case when cid is null then 0 else -(m->>'salio')::numeric end, (m->>'salio')::numeric, v.monto,
          (m->>'bs')::numeric, (m->>'tasa')::numeric, m->>'origen', 'Vales (adelantos)', 'Vale · ' || coalesce(nom, ''), vid, cid is null, auth.uid())
  returning id into nid;
  return jsonb_build_object('id', nid);
end $$;

-- Gastos fijos del mes (los llena Ray). p: {id?, categoria, monto, activo?}
create or replace function public.gasto_fijo_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare nid bigint; cat text := nullif(trim(p->>'categoria'),''); mto numeric := nullif(p->>'monto','')::numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian los gastos fijos'; end if;
  if cat is null then raise exception 'Escribe el nombre del gasto'; end if;
  if mto is null or mto < 0 or mto > 1000000 then raise exception 'Escribe el monto'; end if;
  if exists (select 1 from gastos_fijos where lower(categoria) = lower(cat) and id is distinct from nullif(p->>'id','')::bigint) then
    raise exception 'Ya hay un gasto fijo con ese nombre'; end if;
  if nullif(p->>'id','') is null then
    insert into gastos_fijos (categoria, monto, orden) values (cat, round(mto, 2), (select coalesce(max(orden), 0) + 1 from gastos_fijos)) returning id into nid;
  else
    update gastos_fijos set categoria = cat, monto = round(mto, 2), activo = coalesce((p->>'activo')::boolean, activo)
    where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe ese gasto'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

-- Todo lo de Finanzas en una sola lectura (solo quien confirma pagos).
create or replace function public.finanzas_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Finanzas es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'hoy', _hoy_vzla(),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'moneda', c.moneda, 'orden', c.orden,
        'activa', c.activa, 'nota', c.nota) order by c.orden, c.id) from cuentas c), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rif', p.rif, 'telefono', p.telefono, 'tipos', to_jsonb(p.tipos),
        'iva', p.cobra_iva, 'principal', p.principal, 'datos_pago', p.datos_pago, 'nota', p.nota, 'activo', p.activo,
        'cuadre', case when p.cuadre_fecha is null then null else jsonb_build_object('fecha', p.cuadre_fecha, 'saldo', p.cuadre_saldo) end) order by p.nombre) from proveedores p), '[]'::jsonb),
    'movs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'cuenta', m.cuenta_id, 'prov', m.proveedor_id,
        'ec', m.monto_cuenta, 'ep', m.monto_proveedor, 'salio', m.monto_salio, 'llego', m.monto_llego, 'comision', m.comision,
        'bs', m.monto_bs, 'tasa', m.tasa, 'tasa_origen', m.tasa_origen, 'cat', m.categoria, 'ref', m.referencia, 'nota', m.nota, 'comp', m.comprobante, 'grupo', m.grupo,
        'abono', m.abono_id, 'pago', m.pago_id, 'vale', m.vale_id, 'compra', m.compra_id, 'por_ubicar', m.por_ubicar,
        'por', coalesce(pr.nombre, ''), 'creado_en', m.creado_en,
        'anulado', case when m.anulado_en is null then null else jsonb_build_object('fecha', (m.anulado_en at time zone 'America/Caracas')::date,
           'motivo', m.anulado_motivo, 'por', coalesce(pa.nombre, '')) end) order by m.fecha, m.id)
      from movimientos m left join perfiles pr on pr.id = m.registrado_por left join perfiles pa on pa.id = m.anulado_por), '[]'::jsonb),
    'gastosFijos', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'cat', g.categoria, 'monto', g.monto) order by g.orden, g.id)
      from gastos_fijos g where g.activo), '[]'::jsonb),
    'porConfirmar', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'venta_id', a.venta_id, 'monto', a.monto, 'metodo', a.metodo,
        'comprobante', a.comprobante, 'fecha', a.fecha, 'cliente', coalesce(c.nombre, 'Exhibición'), 'total', v.total, 'estadoVenta', v.estado,
        'pagado', pagado_venta(v.id), 'registro', coalesce(pr.nombre, '')) order by a.fecha)
      from abonos a join ventas v on v.id = a.venta_id left join clientes c on c.id = v.cliente_id left join perfiles pr on pr.id = a.registrado_por
      where a.estado = 'por_confirmar' and a.tipo = 'abono'), '[]'::jsonb),
    'porCobrar', coalesce((select jsonb_agg(x order by x->>'id') from (
        select jsonb_build_object('id', v.id, 'cliente', coalesce(c.nombre, 'Exhibición'), 'estado', v.estado, 'total', v.total,
          'pagado', pagado_venta(v.id), 'resta', round(v.total - pagado_venta(v.id), 2)) x
        from ventas v left join clientes c on c.id = v.cliente_id
        where v.estado in ('confirmada','en_produccion','lista') and not coalesce(v.interna, false) and v.total - pagado_venta(v.id) > 0.005) q), '[]'::jsonb)
  );
end $$;

revoke execute on function public._saldo_cuenta(bigint) from anon, public;
revoke execute on function public._saldo_proveedor(bigint) from anon, public;
revoke execute on function public._mov_montos(jsonb, bigint, numeric) from anon, public;
revoke execute on function public._mov_fecha(jsonb) from anon, public;
revoke execute on function public._cuenta_activa(bigint) from anon, public;
revoke execute on function public.transferencia_guardar(jsonb) from anon, public;
revoke execute on function public.traspaso_guardar(jsonb) from anon, public;
revoke execute on function public.gasto_guardar(jsonb) from anon, public;
revoke execute on function public.saldo_cambiar(jsonb) from anon, public;
revoke execute on function public.movimiento_anular(bigint, text) from anon, public;
revoke execute on function public.movimiento_ubicar(bigint, jsonb) from anon, public;
revoke execute on function public.nomina_salida(bigint, jsonb) from anon, public;
revoke execute on function public.vale_salida(bigint, jsonb) from anon, public;
revoke execute on function public.gasto_fijo_guardar(jsonb) from anon, public;
revoke execute on function public.finanzas_datos() from anon, public;
grant execute on function public.transferencia_guardar(jsonb), public.traspaso_guardar(jsonb), public.gasto_guardar(jsonb),
  public.saldo_cambiar(jsonb), public.movimiento_anular(bigint, text), public.movimiento_ubicar(bigint, jsonb),
  public.nomina_salida(bigint, jsonb), public.vale_salida(bigint, jsonb), public.gasto_fijo_guardar(jsonb), public.finanzas_datos() to authenticated;

-- ===== 20261103130300_v76_ray_ubicar_pagos.sql =====
-- Autor: Ray (Claude de Ray)
-- v76 · Pagos por confirmar y por ubicar (lote 4 de Finanzas y Costos). CON CUIDADO: dinero y permisos.
-- Confirmar un pago se hace en Finanzas y en el mismo paso se dice dónde quedó: una cuenta nuestra,
-- un proveedor (queda a nuestro favor) o "después" (queda por ubicar, con aviso en Inicio).
-- La regla de confirmar_abono no cambia (al 50 % pasa solo a producción): se llama tal cual.
-- Las devoluciones de ventas canceladas también se ubican: de qué cuenta salió el dinero.

alter table public.abonos add column if not exists ubicado_en timestamptz;
alter table public.abonos add column if not exists ubicado_por uuid references auth.users(id);
create unique index if not exists movimientos_abono_uq on public.movimientos (abono_id) where abono_id is not null and anulado_en is null;

-- Dónde quedó un pago ya confirmado (o de dónde salió una devolución). p: {cuenta_id | proveedor_id}
create or replace function public.pago_ubicar(aid bigint, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare ab abonos%rowtype; cid bigint := nullif(p->>'cuenta_id','')::bigint; pid bigint := nullif(p->>'proveedor_id','')::bigint;
  sg int; mon text; nid bigint; ref text;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo ubican pagos'; end if;
  select * into ab from abonos where id = aid for update;
  if not found then raise exception 'No existe ese pago'; end if;
  if ab.tipo = 'abono' and ab.estado <> 'confirmado' then raise exception 'Primero confirma el pago'; end if;
  if ab.estado = 'rechazado' then raise exception 'Ese pago no llegó'; end if;
  if ab.ubicado_en is not null then raise exception 'Ese pago ya está ubicado'; end if;
  if (cid is null) = (pid is null) then raise exception 'Elige una cuenta o un proveedor'; end if;
  sg := case when ab.tipo = 'devolucion' then -1 else 1 end;
  if pid is not null and sg < 0 then raise exception 'Una devolución sale de una cuenta'; end if;
  ref := case when sg < 0 then 'Devolución N° ' else 'Pago N° ' end || ab.venta_id;
  if cid is not null then
    perform _cuenta_activa(cid);
    select moneda into mon from cuentas where id = cid;
    insert into movimientos (tipo, cuenta_id, monto_cuenta, monto_llego, monto_bs, tasa, referencia, nota, abono_id, registrado_por)
    values ('ubicar', cid, sg * ab.monto, ab.monto, case when mon = 'VES' then ab.monto_bs end, case when mon = 'VES' then ab.tasa end,
            ref, case when sg < 0 then 'Salió de la cuenta' else 'Quedó en la cuenta' end, aid, auth.uid())
    returning id into nid;
  else
    if not exists (select 1 from proveedores where id = pid) then raise exception 'No existe ese proveedor'; end if;
    insert into movimientos (tipo, proveedor_id, monto_proveedor, monto_llego, referencia, nota, abono_id, registrado_por)
    values ('ubicar', pid, ab.monto, ab.monto, ref, 'Se transfirió directo al proveedor', aid, auth.uid())
    returning id into nid;
  end if;
  update abonos set ubicado_en = now(), ubicado_por = auth.uid() where id = aid;
  return jsonb_build_object('id', nid);
end $$;

-- Confirmar y ubicar en un solo paso. p: {cuenta_id?, proveedor_id?} (vacío = "después", queda por ubicar)
create or replace function public.pago_confirmar_y_ubicar(aid bigint, llego boolean, nota text, p jsonb default '{}'::jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare r jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo confirman los pagos'; end if;
  if not llego and nullif(trim(nota), '') is null then raise exception 'Escribe qué pasó'; end if;
  if llego and nullif(p->>'cuenta_id','') is not null and nullif(p->>'proveedor_id','') is not null then raise exception 'Elige una cuenta o un proveedor'; end if;
  r := confirmar_abono(aid, llego, nota);
  if llego and (nullif(p->>'cuenta_id','') is not null or nullif(p->>'proveedor_id','') is not null) then
    perform pago_ubicar(aid, p);
    r := r || jsonb_build_object('ubicado', true);
  end if;
  return r;
end $$;

-- Al anular el movimiento de un pago ubicado, el pago vuelve a "por ubicar".
create or replace function public.movimiento_anular(mid bigint, motivo text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare x movimientos%rowtype; mot text := nullif(trim(motivo),'');
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo anulan movimientos'; end if;
  if mot is null then raise exception 'Escribe el motivo'; end if;
  select * into x from movimientos where id = mid for update;
  if not found then raise exception 'No existe ese movimiento'; end if;
  if x.anulado_en is not null then raise exception 'Ese movimiento ya estaba anulado'; end if;
  update movimientos set anulado_en = now(), anulado_por = auth.uid(), anulado_motivo = mot
  where (id = mid or (x.grupo is not null and grupo = x.grupo)) and anulado_en is null;
  if x.abono_id is not null then update abonos set ubicado_en = null, ubicado_por = null where id = x.abono_id; end if;
  return jsonb_build_object('id', mid);
end $$;

-- Pagos por ubicar: confirmados sin ubicar y devoluciones sin decir de qué cuenta salieron.
create or replace function public._pagos_por_ubicar()
 returns jsonb language sql stable security definer set search_path to 'public'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'venta_id', a.venta_id, 'monto', a.monto, 'metodo', a.metodo, 'tipo', a.tipo,
      'monto_bs', a.monto_bs, 'tasa', a.tasa, 'confirmado_en', coalesce(a.confirmado_en, a.fecha), 'cliente', coalesce(c.nombre, 'Exhibición')) order by a.fecha), '[]'::jsonb)
  from abonos a join ventas v on v.id = a.venta_id left join clientes c on c.id = v.cliente_id
  where a.ubicado_en is null and ((a.tipo = 'abono' and a.estado = 'confirmado') or (a.tipo = 'devolucion' and a.estado <> 'rechazado'))
$$;

-- Avisos de Finanzas para Inicio (cuentas, sin montos de más). Solo quien confirma pagos.
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
         and lower(m.categoria) = lower(g.categoria) and date_trunc('month', m.fecha) = date_trunc('month', _hoy_vzla()))), '[]'::jsonb)
  );
end $$;

-- finanzas_datos con los pagos por ubicar
create or replace function public.finanzas_datos()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Finanzas es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'hoy', _hoy_vzla(),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'moneda', c.moneda, 'orden', c.orden,
        'activa', c.activa, 'nota', c.nota) order by c.orden, c.id) from cuentas c), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rif', p.rif, 'telefono', p.telefono, 'tipos', to_jsonb(p.tipos),
        'iva', p.cobra_iva, 'principal', p.principal, 'datos_pago', p.datos_pago, 'nota', p.nota, 'activo', p.activo,
        'cuadre', case when p.cuadre_fecha is null then null else jsonb_build_object('fecha', p.cuadre_fecha, 'saldo', p.cuadre_saldo) end) order by p.nombre) from proveedores p), '[]'::jsonb),
    'movs', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'cuenta', m.cuenta_id, 'prov', m.proveedor_id,
        'ec', m.monto_cuenta, 'ep', m.monto_proveedor, 'salio', m.monto_salio, 'llego', m.monto_llego, 'comision', m.comision,
        'bs', m.monto_bs, 'tasa', m.tasa, 'tasa_origen', m.tasa_origen, 'cat', m.categoria, 'ref', m.referencia, 'nota', m.nota, 'comp', m.comprobante, 'grupo', m.grupo,
        'abono', m.abono_id, 'pago', m.pago_id, 'vale', m.vale_id, 'compra', m.compra_id, 'por_ubicar', m.por_ubicar,
        'por', coalesce(pr.nombre, ''), 'creado_en', m.creado_en,
        'anulado', case when m.anulado_en is null then null else jsonb_build_object('fecha', (m.anulado_en at time zone 'America/Caracas')::date,
           'motivo', m.anulado_motivo, 'por', coalesce(pa.nombre, '')) end) order by m.fecha, m.id)
      from movimientos m left join perfiles pr on pr.id = m.registrado_por left join perfiles pa on pa.id = m.anulado_por), '[]'::jsonb),
    'gastosFijos', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'cat', g.categoria, 'monto', g.monto) order by g.orden, g.id)
      from gastos_fijos g where g.activo), '[]'::jsonb),
    'porConfirmar', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'venta_id', a.venta_id, 'monto', a.monto, 'metodo', a.metodo,
        'comprobante', a.comprobante, 'fecha', a.fecha, 'cliente', coalesce(c.nombre, 'Exhibición'), 'total', v.total, 'estadoVenta', v.estado,
        'pagado', pagado_venta(v.id) - a.monto, 'registro', coalesce(pr.nombre, '')) order by a.fecha)
      from abonos a join ventas v on v.id = a.venta_id left join clientes c on c.id = v.cliente_id left join perfiles pr on pr.id = a.registrado_por
      where a.estado = 'por_confirmar' and a.tipo = 'abono'), '[]'::jsonb),
    'porUbicar', _pagos_por_ubicar(),
    'porCobrar', coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
        select jsonb_build_object('id', v.id, 'cliente', coalesce(c.nombre, 'Exhibición'), 'estado', v.estado, 'total', v.total,
          'pagado', pagado_venta(v.id), 'resta', round(v.total - pagado_venta(v.id), 2)) x
        from ventas v left join clientes c on c.id = v.cliente_id
        where v.estado in ('confirmada','en_produccion','lista') and not coalesce(v.interna, false) and v.total - pagado_venta(v.id) > 0.005) q), '[]'::jsonb)
  );
end $$;

revoke execute on function public.pago_ubicar(bigint, jsonb) from anon, public;
revoke execute on function public.pago_confirmar_y_ubicar(bigint, boolean, text, jsonb) from anon, public;
revoke execute on function public._pagos_por_ubicar() from anon, public;
revoke execute on function public.finanzas_avisos() from anon, public;
grant execute on function public.pago_ubicar(bigint, jsonb), public.pago_confirmar_y_ubicar(bigint, boolean, text, jsonb), public.finanzas_avisos() to authenticated;

-- ===== 20261103130400_v77_ray_deposito_fabricacion_compras.sql =====
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

-- ===== 20261103130500_v78_ray_costos.sql =====
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
  catalogo_id bigint unique references public.catalogo(id) on delete cascade,
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

-- ===== 20261103130600_v78b_ray_datos_proveedores_precios.sql =====
-- Autor: Ray (Claude de Ray)
-- v78b · Datos reales para Costos y Depósito (de la maqueta de Ray, sección Datos y window.MAQUETA):
-- proveedores (Colores y Ambiente, Inversiones Torniplemaca y "Sin factura"), material de fabricación con sus
-- medidas, precios sin IVA por proveedor, insumos para costear, gastos fijos ($915 al mes), costeo del Bitral
-- (catálogo id 7, M-01) y la nota de entrega 00-2884 de Torniplemaca ($1.674,50) con el material por registrar.
-- NO se cargan: existencias (las sube Ray), saldos de cuentas ni de proveedores, ventas ni clientes de ejemplo.
-- Ojo: la nota 00-2884 mueve el saldo de Torniplemaca a "Le debes $1.674,50" hasta que Ray ponga el saldo real.

insert into public.proveedores (nombre, rif, tipos, cobra_iva, principal, nota) values
  ('Colores y Ambiente', null, array['hierro','laminas'], true, true, 'Da factura'),
  ('Inversiones Torniplemaca', 'J-40218850-1', array['hierro','laminas'], false, false, 'Da nota de entrega'),
  ('Sin factura (ferretería y otros)', null, array['vidrio','pintura','consumibles','accesorios'], false, false, 'Precios dados por Ray')
on conflict do nothing;

insert into public.materiales_fab (codigo, nombre, tipo, presentacion, largo_cm, hoja_ancho_cm, hoja_alto_cm, espesor, precio_fijo, orden) values
  ('t1x3',  'Tubo 1" x 3"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 1),
  ('t1x2',  'Tubo 1" x 2"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 2),
  ('t1x1',  'Tubo 1" x 1"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 3),
  ('t12',   'Tubo 1/2" x 1/2" 0,70',    'hierro',  'barra', 600, null, null, '0,70 mm', null, 4),
  ('pl12',  'Platina 1/2" x 2 mm',      'hierro',  'barra', 600, null, null, '2 mm',    null, 5),
  ('pl1',   'Platina 1" x 1/8"',        'hierro',  'barra', 600, null, null, null,      null, 6),
  ('m10',   'Marco de puerta 10',       'hierro',  'barra', 510, null, null, '0,70 mm', 12.28, 7),
  ('m15',   'Marco de puerta 15',       'hierro',  'barra', 510, null, null, null,      null, 8),
  ('lam14', 'Lámina pulida C/14',       'laminas', 'hoja',  null, 122, 244, null,       null, 9),
  ('lam16', 'Lámina calibre 16',        'laminas', 'hoja',  null, 122, 244, null,       null, 10),
  ('vid5',  'Vidrio 5 mm',              'vidrio',  'hoja',  null, 330, 244, null,       null, 11)
on conflict do nothing;

-- Precios sin IVA por proveedor (con espesor cuando lo da)
insert into public.material_precios (material_id, proveedor_id, precio, espesor, origen)
select m.id, p.id, x.precio, x.espesor, 'datos'
from (values
  ('t1x3', 'Colores y Ambiente', 12.98, '0,90 mm'),
  ('t1x2', 'Colores y Ambiente', 9.69, '0,90 mm'), ('t1x2', 'Inversiones Torniplemaca', 9.50, '0,80 mm'),
  ('t1x1', 'Colores y Ambiente', 6.43, '0,90 mm'), ('t1x1', 'Inversiones Torniplemaca', 6.50, '0,80 mm'),
  ('t12',  'Colores y Ambiente', 2.66, '0,70 mm'),
  ('pl12', 'Colores y Ambiente', 2.19, '2 mm'),
  ('pl1',  'Colores y Ambiente', 6.51, null), ('pl1', 'Inversiones Torniplemaca', 6.50, null),
  ('m10',  'Colores y Ambiente', 12.28, '0,70 mm'), ('m10', 'Inversiones Torniplemaca', 13.00, '0,70 mm'),
  ('m15',  'Colores y Ambiente', 15.07, null), ('m15', 'Inversiones Torniplemaca', 15.50, null),
  ('lam14','Colores y Ambiente', 61.05, null),
  ('lam16','Colores y Ambiente', 49.66, null), ('lam16', 'Inversiones Torniplemaca', 52.00, null),
  ('vid5', 'Sin factura (ferretería y otros)', 100.00, null)
) x(cod, prov, precio, espesor)
join public.materiales_fab m on m.codigo = x.cod join public.proveedores p on p.nombre = x.prov
where not exists (select 1 from public.material_precios mp where mp.material_id = m.id and mp.proveedor_id = p.id and mp.vigente);

-- Insumos para costear: precio sin IVA y rendimiento general (puertas por unidad). Sin general = se pone por modelo.
insert into public.costeo_insumos (codigo, nombre, grupo, precio, rendimiento, orden) values
  ('fondo', 'Fondo anticorrosivo', 'Pintura y masilla', 20, null, 1),
  ('esmalte', 'Esmalte', 'Pintura y masilla', 22, null, 2),
  ('masilla', 'Masilla', 'Pintura y masilla', 25, null, 3),
  ('thinner', 'Thinner', 'Pintura y masilla', 10, 2, 4),
  ('electrodo', 'Electrodos (kg)', 'Consumibles', 3, 2, 5),
  ('d14', 'Disco de corte 14"', 'Consumibles', 6, 3, 6),
  ('d7', 'Disco de corte 7"', 'Consumibles', 1, 1, 7),
  ('flap', 'Disco flap', 'Consumibles', 1, 4, 8),
  ('carton', 'Disco de cartón', 'Consumibles', 1, 4, 9),
  ('l40', 'Lija 40', 'Consumibles', 4, 1, 10),
  ('l80', 'Lija 80', 'Consumibles', 1, 0.5, 11),
  ('l100', 'Lija 100', 'Consumibles', 1, 1, 12),
  ('l120', 'Lija 120', 'Consumibles', 1, 1, 13),
  ('bisagra', 'Bisagra', 'Accesorios', 1, null, 14),
  ('cerradura', 'Cerradura multilock', 'Accesorios', 15, null, 15),
  ('manillon', 'Manillón inox 30 cm', 'Accesorios', 20, null, 16)
on conflict (codigo) do nothing;

-- Gastos fijos del mes: $915 en total (Ray los cambia en Costos › Ganancia)
insert into public.gastos_fijos (categoria, monto, orden) values
  ('Alquiler', 800, 1), ('Electricidad', 60, 2), ('Internet', 30, 3), ('Teléfono', 5, 4), ('Transporte', 20, 5)
on conflict do nothing;

-- Costeo del Bitral (catálogo id 7) = Vitral M-01 de la Memoria central de Ray.
-- Mano de obra con la categoría "Puerta Estándar" (como en la maqueta). En el catálogo el Bitral todavía no tiene categoría.
do $$
declare mid bigint; cat bigint;
begin
  if not exists (select 1 from public.catalogo where id = 7) or exists (select 1 from public.costeo_modelos where catalogo_id = 7) then return; end if;
  select id into cat from public.categorias_pago where nombre = 'Puerta Estándar' and producto = 'Puerta Multilock' limit 1;
  insert into public.costeo_modelos (catalogo_id, codigo, estado, categoria_pago_id) values (7, 'M-01', 'listo', cat) returning id into mid;
  insert into public.costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden)
  select mid, m.id, x.n, x.cm, x.nota, x.o from (values
    ('t1x3', 2, 200, 'Bastidor largo', 1), ('t1x3', 2, 88, 'Bastidor ancho', 2), ('m10', 1, 500, 'Marco', 3), ('t1x2', 1, 194, 'Divisor vertical', 4),
    ('pl12', 1, 600, 'Ranuras, frente', 5), ('t12', 1, 600, 'Ranuras, atrás', 6), ('t12', 1, 390, 'Vitral largo', 7)
  ) x(cod, n, cm, nota, o) join public.materiales_fab m on m.codigo = x.cod;
  insert into public.costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden)
  select mid, m.id, x.n, x.a, x.h, x.nota, x.o from (values
    ('lam14', 1, 61.5, 179, 'Panel', 8), ('vid5', 1, 184, 10, 'Franja de vidrio', 9), ('vid5', 5, 50, 4, 'Ranuras de vidrio', 10)
  ) x(cod, n, a, h, nota, o) join public.materiales_fab m on m.codigo = x.cod;
  insert into public.costeo_modelo_insumos (modelo_id, insumo_id, rendimiento)
  select mid, i.id, 3 from public.costeo_insumos i where i.codigo in ('fondo','esmalte','masilla','thinner','d7','carton');
  insert into public.costeo_modelo_insumos (modelo_id, insumo_id, cantidad)
  select mid, i.id, x.q from (values ('bisagra', 3), ('cerradura', 1), ('manillon', 1)) x(cod, q) join public.costeo_insumos i on i.codigo = x.cod;
end $$;

-- Nota de entrega real de Torniplemaca 00-2884 (31 oct 2026, $1.674,50, sin IVA). Los 12 renglones quedan por registrar.
do $$
declare pid bigint; cid bigint;
begin
  select id into pid from public.proveedores where nombre = 'Inversiones Torniplemaca';
  if pid is null or exists (select 1 from public.compras where proveedor_id = pid and numero = '00-2884') then return; end if;
  insert into public.compras (proveedor_id, documento, numero, fecha, subtotal, iva, total, material_pendiente, nota)
  values (pid, 'nota', '00-2884', date '2026-10-31', 1674.50, 0, 1674.50, true, 'Nota de entrega real de Torniplemaca: 12 productos por registrar')
  returning id into cid;
  insert into public.movimientos (fecha, tipo, proveedor_id, monto_proveedor, referencia, nota, compra_id)
  values (date '2026-10-31', 'compra', pid, -1674.50, 'Nota 00-2884', 'Material por registrar', cid);
end $$;

-- ===== 20261103130700_v79_ray_plan_corte.sql =====
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

-- ===== 20261103130800_v80_ray_cierre_mes.sql =====
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

commit;
