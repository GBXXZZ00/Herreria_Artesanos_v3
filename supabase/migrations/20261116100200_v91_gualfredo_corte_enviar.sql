-- Autor: Gualfredo (Claude de Gualfredo)
-- v91 · Taller › Corte, base (lote 4, §3B.2 punto 2): enviar el corte y pedir la compra juntos.
-- corte_enviar(p_sab, p_tid, p_plan, p_compra) guarda el plan (mismas validaciones y candado que
-- corte_plan_guardar), guarda el envío de ese herrero (firma, hora y copia de sus barras) y, si
-- viene p_compra, pide la compra para ese herrero. Todo en una sola transacción: si algo falla,
-- no queda el corte enviado sin la compra.

create or replace function public.corte_enviar(p_sab date, p_tid uuid, p_plan jsonb, p_compra jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare nom text; bs jsonb; c jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo envían el corte'; end if;
  if p_sab is null or p_tid is null then raise exception 'Falta el sábado o el herrero'; end if;
  select nombre into nom from perfiles where id = p_tid and rol = 'trabajador' and activo;
  if not found then raise exception 'Ese herrero no existe o no está activo'; end if;
  if jsonb_typeof(coalesce(p_plan, 'null'::jsonb)) <> 'object' then raise exception 'El plan no es válido'; end if;
  -- 1) El plan (con el candado por herrero)
  perform corte_plan_guardar(p_sab, p_plan || jsonb_build_object('aceptado', true));
  select _corte_barras_de(barras, p_tid::text) into bs from cortes_planes where sab = p_sab for update;
  if jsonb_array_length(bs) = 0 then raise exception '% no tiene cortes en este plan', nom; end if;
  -- 2) El envío de ese herrero: lo que va a ver y lo que se baja cuando termine
  update cortes_planes set enviados = enviados || jsonb_build_object(p_tid::text,
      jsonb_build_object('firma', _corte_firma_tid(p_sab, p_tid), 'en', now(), 'por', auth.uid(), 'barras', bs)),
    actualizado_por = auth.uid(), actualizado_en = now()
  where sab = p_sab;
  -- 3) La compra para ese herrero, en la misma transacción
  if p_compra is not null and jsonb_array_length(coalesce(p_compra->'lugares', '[]'::jsonb)) > 0 then
    c := compra_pedir(p_compra || jsonb_build_object('tid', p_tid, 'plan_sab', p_sab));
  end if;
  return jsonb_build_object('sab', p_sab, 'tid', p_tid, 'barras', jsonb_array_length(bs), 'compra', c);
end $$;

revoke execute on function public.corte_enviar(date, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.corte_enviar(date, uuid, jsonb, jsonb) to authenticated;
