-- Autor: Gualfredo (Claude de Gualfredo)
-- v88 · Taller › Nómina (lote 3): pagar solo lo marcado, cuando se quiera.
-- pagar_trabajador recibe las listas de trabajos (etapas) y vales a pagar:
--   - Si las dos listas vienen en null, hace lo de siempre: todo lo pendiente antes del corte.
--   - Si vienen, paga solo esas, con las mismas validaciones: dueño del pago (_puede_pagar_a),
--     filas bloqueadas (for update), que sean de ese trabajador y no estén pagadas, sin montos
--     nulos, neto >= 0 y esperado igual al neto. Lo no marcado queda para después.
-- El corte (_corte_nomina) es el fin del sábado de esta semana: lo terminado hasta hoy ya entra.
-- Las protecciones pago_protegido, vale_protegido y etapa_protegida no cambian.
-- Se reemplaza la versión de 2 datos: si quedaran las dos, la app no sabría a cuál llamar.

drop function if exists public.pagar_trabajador(uuid, numeric);

create or replace function public.pagar_trabajador(tid uuid, esperado numeric, p_etapas bigint[] default null, p_vales bigint[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  corte timestamptz := _corte_nomina();
  elegido boolean := p_etapas is not null or p_vales is not null;
  pe bigint[] := coalesce(p_etapas, '{}');
  pv bigint[] := coalesce(p_vales, '{}');
  ids_e bigint[]; ids_v bigint[]; t numeric; v numeric; n int; nv int; sin_monto int; pid bigint; neto numeric; nombre_t text; sem date;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _puede_pagar_a(tid) then
    raise exception 'A este trabajador no le pagas tú';
  end if;
  select nombre into nombre_t from perfiles where id = tid and rol = 'trabajador' for update;
  if not found then raise exception 'No existe ese trabajador'; end if;
  if elegido then
    if cardinality(pe) + cardinality(pv) = 0 then raise exception 'Marca lo que vas a pagar'; end if;
    if cardinality(pe) > 500 or cardinality(pv) > 200 then raise exception 'Demasiados trabajos a la vez'; end if;
    select coalesce(array_agg(id), '{}') into ids_e from (select id from etapas where id = any(pe) and trabajador_id = tid and estado = 'hecha' and pago_id is null for update) q;
    select coalesce(array_agg(id), '{}') into ids_v from (select id from vales where id = any(pv) and trabajador_id = tid and estado = 'aprobado' and pago_id is null for update) q;
    if cardinality(ids_e) <> (select count(distinct x) from unnest(pe) x) or cardinality(ids_v) <> (select count(distinct x) from unnest(pv) x) then
      raise exception 'Algo cambió mientras lo veías (un trabajo o un vale ya no está por pagar). Revisa de nuevo';
    end if;
  else
    select coalesce(array_agg(id), '{}') into ids_e from (select id from etapas where trabajador_id = tid and estado = 'hecha' and pago_id is null and terminada_en < corte for update) q;
    select coalesce(array_agg(id), '{}') into ids_v from (select id from vales where trabajador_id = tid and estado = 'aprobado' and pago_id is null and creado_en < corte for update) q;
  end if;
  select count(*), coalesce(sum(monto), 0), count(*) filter (where monto is null) into n, t, sin_monto from etapas where id = any(ids_e);
  select count(*), coalesce(sum(monto), 0) into nv, v from vales where id = any(ids_v);
  if n = 0 and nv = 0 then raise exception 'No hay nada por pagar esta semana'; end if;
  if sin_monto > 0 then raise exception 'Hay trabajos sin monto. Dale categoría de pago a ese producto y vuelve a intentar'; end if;
  neto := round(t - v, 2);
  if neto < 0 then raise exception 'Los vales son más que lo trabajado. Quedan para la próxima semana'; end if;
  if esperado is null or round(esperado, 2) <> neto then raise exception 'Los montos cambiaron mientras lo veías. Revisa de nuevo'; end if;
  sem := _semana_de(corte - interval '1 second');
  insert into pagos_trabajador (trabajador_id, trabajos, vales, monto, pagado_por, pagado_en, semana)
  values (tid, t, v, neto, auth.uid(), now(), sem) returning id into pid;
  update etapas set pago_id = pid where id = any(ids_e);
  update vales set pago_id = pid where id = any(ids_v);
  perform _avisar(tid, null, null, 'Te pagaron ' || _usd(neto),
    (case when n = 1 then '1 trabajo' else n || ' trabajos' end) || case when nv > 0 then ' · vales −' || _usd(v) else '' end
      || E'\n' || 'Mira el detalle en tu historial.',
    'index.html?ver=historial', null);
  return jsonb_build_object('id', pid, 'monto', neto);
end $$;

revoke execute on function public.pagar_trabajador(uuid, numeric, bigint[], bigint[]) from public, anon;
grant execute on function public.pagar_trabajador(uuid, numeric, bigint[], bigint[]) to authenticated;
