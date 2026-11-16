-- Autor: Gualfredo (Claude de Gualfredo)
-- v94 · Taller › Corte, base (lote 4, §3B.2 punto 6): ¿Llegó? con una parte, y cambiar una compra pedida.
-- compra_confirmar ya confirmaba cada lugar con lo que de verdad llegó, pero el resto se perdía.
-- Ahora cada lugar puede traer "quedan" (las líneas que no llegaron): siguen en camino, en la misma
-- compra (mismo grupo), para el mismo proveedor y herrero.
-- compra_pedida_cambiar cambia las líneas de un lugar que sigue en camino. Cancelar sigue siendo
-- compra_no_llego (con motivo).

create or replace function public._compra_queda_en_camino(pid bigint, quedan jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare pr compras_pedidas%rowtype; iva boolean; tot numeric; nid bigint;
begin
  if quedan is null or jsonb_typeof(quedan) <> 'array' or jsonb_array_length(quedan) = 0 then return null; end if;
  perform _compra_lineas_ok(quedan);
  select * into pr from compras_pedidas where id = pid;
  select cobra_iva into iva from proveedores where id = pr.proveedor_id;
  select round(sum((l->>'cantidad')::numeric * coalesce(nullif(l->>'precio','')::numeric, 0)) * case when iva then 1.16 else 1 end, 2) into tot from jsonb_array_elements(quedan) l;
  insert into compras_pedidas (grupo, tipo, proveedor_id, lineas, total, plan_sab, nota, pedida_por, pedida_en, tid)
  values (pr.grupo, 'lugar', pr.proveedor_id, quedan, coalesce(tot, 0), pr.plan_sab, coalesce(pr.nota || ' · ', '') || 'Lo que no llegó', pr.pedida_por, pr.pedida_en, pr.tid)
  returning id into nid;
  return nid;
end $$;
revoke execute on function public._compra_queda_en_camino(bigint, jsonb) from public, anon, authenticated;

-- compra_confirmar: después de confirmar un lugar, lo que no llegó queda en camino
do $$
declare
  def text := pg_get_functiondef('public.compra_confirmar(bigint, jsonb)'::regprocedure);
  viejo constant text := 'update compras_pedidas set estado = ''confirmada'', compra_id = (r->>''id'')::bigint, cerrada_por = auth.uid(), cerrada_en = now() where id = (lg->>''pedida_id'')::bigint;';
  nuevo constant text := 'update compras_pedidas set estado = ''confirmada'', compra_id = (r->>''id'')::bigint, cerrada_por = auth.uid(), cerrada_en = now() where id = (lg->>''pedida_id'')::bigint;
      perform _compra_queda_en_camino((lg->>''pedida_id'')::bigint, lg->''quedan'');';
begin
  if position('_compra_queda_en_camino' in def) > 0 then return; end if;
  if (length(def) - length(replace(def, viejo, ''))) / length(viejo) <> 1 then raise exception 'No encontré dónde poner lo que no llegó en compra_confirmar'; end if;
  execute replace(def, viejo, nuevo);
end $$;

-- Cambiar lo que se pidió a un lugar que sigue en camino
create or replace function public.compra_pedida_cambiar(pid bigint, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pr compras_pedidas%rowtype; prov bigint; iva boolean; tot numeric;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador cambia compras'; end if;
  select * into pr from compras_pedidas where id = pid for update;
  if not found or pr.estado <> 'pedida' or pr.tipo <> 'lugar' then raise exception 'Esa compra ya no está en camino'; end if;
  if jsonb_array_length(coalesce(p->'lineas', '[]'::jsonb)) = 0 then raise exception 'Deja al menos un material. Para quitarla toda, cancélala'; end if;
  perform _compra_lineas_ok(p->'lineas');
  prov := coalesce(nullif(p->>'proveedor_id','')::bigint, pr.proveedor_id);
  select cobra_iva into iva from proveedores where id = prov and activo;
  if not found then raise exception 'Elige el proveedor'; end if;
  select round(sum((l->>'cantidad')::numeric * coalesce(nullif(l->>'precio','')::numeric, 0)) * case when iva then 1.16 else 1 end, 2) into tot from jsonb_array_elements(p->'lineas') l;
  update compras_pedidas set proveedor_id = prov, lineas = p->'lineas', total = coalesce(tot, 0),
    nota = coalesce(nullif(trim(p->>'nota'),''), nota) where id = pid;
  return jsonb_build_object('id', pid, 'total', coalesce(tot, 0));
end $$;
revoke execute on function public.compra_pedida_cambiar(bigint, jsonb) from public, anon;
grant execute on function public.compra_pedida_cambiar(bigint, jsonb) to authenticated;
