-- Autor: Gualfredo (Claude de Gualfredo)
-- v90 · Taller › Corte, base (lote 4, §3B.2 punto 3): el herrero de una compra pedida.
-- compras_pedidas.tid dice para quién es la compra ("para Jesus") y permite apartarle lo que llega.
-- compra_pedir lo recibe en p.tid (opcional) y compras_en_camino lo devuelve con su nombre.

alter table public.compras_pedidas add column if not exists tid uuid references public.perfiles(id);

create or replace function public.compra_pedir(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare lg jsonb; g bigint; nid bigint; tot numeric; iva boolean; n int := 0; t uuid := nullif(p->>'tid','')::uuid;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_admin() then raise exception 'Solo el administrador pide compras'; end if;
  if jsonb_array_length(coalesce(p->'lugares', '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un lugar con material'; end if;
  if t is not null and not exists (select 1 from perfiles where id = t and rol = 'trabajador') then raise exception 'Ese herrero no existe'; end if;
  for lg in select * from jsonb_array_elements(p->'lugares') loop
    select cobra_iva into iva from proveedores where id = nullif(lg->>'proveedor_id','')::bigint and activo;
    if not found then raise exception 'Elige el proveedor de cada lugar'; end if;
    if jsonb_array_length(coalesce(lg->'lineas', '[]'::jsonb)) = 0 then raise exception 'Cada lugar necesita al menos un material'; end if;
    perform _compra_lineas_ok(lg->'lineas');
    select round(sum((l->>'cantidad')::numeric * coalesce(nullif(l->>'precio','')::numeric, 0)) * case when iva then 1.16 else 1 end, 2) into tot from jsonb_array_elements(lg->'lineas') l;
    insert into compras_pedidas (grupo, tipo, proveedor_id, lineas, total, plan_sab, nota, pedida_por, tid)
    values (g, 'lugar', (lg->>'proveedor_id')::bigint, lg->'lineas', coalesce(tot, 0), nullif(p->>'plan_sab','')::date, nullif(trim(p->>'nota'),''), auth.uid(), t) returning id into nid;
    if g is null then g := nid; update compras_pedidas set grupo = g where id = nid; end if;
    n := n + 1;
  end loop;
  for lg in select * from jsonb_array_elements(coalesce(p->'gastos', '[]'::jsonb)) loop
    if nullif(trim(lg->>'categoria'),'') is null then raise exception 'Escribe qué gasto es'; end if;
    if coalesce(nullif(lg->>'monto','')::numeric, -1) < 0 then raise exception 'Revisa el monto del gasto'; end if;
    insert into compras_pedidas (grupo, tipo, categoria, total, plan_sab, pedida_por, tid) values (g, 'gasto', trim(lg->>'categoria'), round((lg->>'monto')::numeric, 2), nullif(p->>'plan_sab','')::date, auth.uid(), t);
  end loop;
  return jsonb_build_object('grupo', g, 'lugares', n);
end $$;

-- compras_en_camino: cada lugar con su herrero
do $$
declare
  def text := pg_get_functiondef('public.compras_en_camino()'::regprocedure);
  viejo constant text := '''lugares'', (select jsonb_agg(jsonb_build_object(''id'', c.id, ''proveedor_id'', c.proveedor_id,';
  nuevo constant text := '''lugares'', (select jsonb_agg(jsonb_build_object(''id'', c.id, ''tid'', c.tid, ''herrero'', (select nombre from perfiles where id = c.tid), ''proveedor_id'', c.proveedor_id,';
begin
  if position('''herrero''' in def) > 0 then return; end if;
  if (length(def) - length(replace(def, viejo, ''))) / length(viejo) <> 1 then raise exception 'No encontré dónde poner el herrero en compras_en_camino'; end if;
  execute replace(def, viejo, nuevo);
end $$;
