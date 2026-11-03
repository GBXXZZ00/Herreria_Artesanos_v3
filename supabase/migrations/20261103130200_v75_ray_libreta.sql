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
