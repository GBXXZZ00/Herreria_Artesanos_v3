-- Autor: Gualfredo (Claude de Gualfredo)
-- v92 · Taller › Corte, base (lote 4, §3B.2 punto 4): un retazo no queda apartado en dos planes.
-- Hoy solo se revisa dentro de un mismo plan. Ahora, al guardar (o enviar) un plan, un retazo que ya
-- está en otro plan abierto (otro sábado, sin cerrar) no se acepta.

create or replace function public.corte_plan_guardar(p_sab date, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r jsonb; b jsonb; otro date;
begin
  if jsonb_typeof(coalesce(p->'barras', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  for b in select * from jsonb_array_elements(coalesce(p->'barras', '[]'::jsonb)) loop
    if b->>'tipo' = 'retazo' and nullif(b->>'rid','') is not null then
      select cp.sab into otro from cortes_planes cp, jsonb_array_elements(cp.barras) x
      where cp.sab <> p_sab and not cp.cerrado and x->>'tipo' = 'retazo' and x->>'rid' = b->>'rid' limit 1;
      if found then
        raise exception 'El retazo R-% ya está apartado en el plan del %. Usa otro', (select numero from material_retazos where id = (b->>'rid')::bigint), to_char(otro, 'DD/MM');
      end if;
    end if;
  end loop;
  r := _corte_plan_guardar_v82(p_sab, p);
  if jsonb_typeof(coalesce(p->'extras_mano', '[]'::jsonb)) <> 'array' then raise exception 'El plan no es válido'; end if;
  if p ? 'extras_mano' then update cortes_planes set extras_mano = coalesce(p->'extras_mano', '[]'::jsonb) where sab = p_sab; end if;
  return r;
end $$;
