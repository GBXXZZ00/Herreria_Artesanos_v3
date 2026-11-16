-- Autor: Gualfredo (Claude de Gualfredo)
-- v96 · Taller › Corte (K09): reportar una barra dañada mientras el herrero corta.
-- corte_barra_danada(p_sab, p_tid, p_mid, p_barra, p_compra):
--   * la barra dañada sale del Depósito ya (baja 1 de ese material, con su motivo);
--   * se reemplaza con otra del taller (p_compra = false: necesita que quede al menos 1 en el Depósito,
--     que es la que el herrero va a usar y baja sola cuando termine el Hierro), o
--   * se suma a la compra (p_compra = true): 1 barra más en la compra en camino de ese herrero; si no
--     hay una con ese material, se pide una nueva con el precio más barato que se pagó.
-- Queda anotado en el envío del herrero (enviados -> tid -> danadas): qué, cuál barra, quién y cuándo.
-- Depende de v89 (enviados), v90 (compras_pedidas.tid) y v94 (compra_pedida_cambiar).

create or replace function public.corte_barra_danada(p_sab date, p_tid uuid, p_mid bigint, p_barra integer, p_compra boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare pl cortes_planes%rowtype; nom text; mat text; st int; pid bigint; ls jsonb; prov bigint; pr numeric; c jsonb;
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian el corte'; end if;
  if p_sab is null or p_tid is null or p_mid is null then raise exception 'Falta el herrero o el material'; end if;
  select * into pl from cortes_planes where sab = p_sab for update;
  if not found or not (pl.enviados ? p_tid::text) then raise exception 'A ese herrero no se le ha enviado el corte'; end if;
  select nombre into nom from perfiles where id = p_tid;
  if not exists (select 1 from jsonb_array_elements(coalesce(pl.enviados -> p_tid::text -> 'barras', '[]'::jsonb)) b
                 where b->>'mid' = p_mid::text and coalesce(b->>'tipo', 'barra') = 'barra') then
    raise exception 'Ese material no está en las barras de %', coalesce(nom, 'ese herrero'); end if;
  select nombre, stock into mat, st from materiales_fab where id = p_mid for update;
  if not found then raise exception 'No existe ese material'; end if;
  if st < 1 then raise exception 'El Depósito no tiene barras de % para bajar. Cuenta las barras primero.', mat; end if;
  if not coalesce(p_compra, false) and st < 2 then
    raise exception 'No queda otra barra de % en el taller. Súmala a la compra.', mat; end if;

  -- La dañada sale del Depósito
  perform _fab_mover(p_mid, -1, 'ajuste', null, 'Barra dañada · corte de ' || coalesce(nom, 'herrero') || ' · sáb ' || to_char(p_sab, 'DD/MM'));

  -- Se suma a la compra de ese herrero
  if coalesce(p_compra, false) then
    select id into pid from compras_pedidas c
    where c.estado = 'pedida' and c.tipo = 'lugar' and c.tid = p_tid
      and exists (select 1 from jsonb_array_elements(c.lineas) l where l->>'material_id' = p_mid::text)
    order by c.id desc limit 1;
    if pid is not null then
      select jsonb_agg(case when x.o = (select min(y.o) from compras_pedidas cp, jsonb_array_elements(cp.lineas) with ordinality y(l, o)
                                        where cp.id = pid and y.l->>'material_id' = p_mid::text)
                            then jsonb_set(x.l, '{cantidad}', to_jsonb((x.l->>'cantidad')::numeric + 1)) else x.l end order by x.o)
        into ls from compras_pedidas cp, jsonb_array_elements(cp.lineas) with ordinality x(l, o) where cp.id = pid;
      perform compra_pedida_cambiar(pid, jsonb_build_object('lineas', ls));
    else
      select mp.proveedor_id, mp.precio into prov, pr from material_precios mp join proveedores p on p.id = mp.proveedor_id and p.activo
      where mp.material_id = p_mid and mp.vigente order by mp.precio, mp.proveedor_id limit 1;
      if prov is null then
        select id into prov from proveedores where activo order by principal desc, nombre limit 1;
        pr := 0;
      end if;
      if prov is null then raise exception 'No hay proveedores. Agrega uno en Material › Proveedores.'; end if;
      c := compra_pedir(jsonb_build_object('tid', p_tid, 'plan_sab', p_sab, 'nota', 'Barra dañada',
             'lugares', jsonb_build_array(jsonb_build_object('proveedor_id', prov,
               'lineas', jsonb_build_array(jsonb_build_object('material_id', p_mid, 'cantidad', 1, 'precio', coalesce(pr, 0)))))));
    end if;
  end if;

  -- Anotado en el envío del herrero
  update cortes_planes set enviados = jsonb_set(enviados, array[p_tid::text, 'danadas'],
      coalesce(enviados -> p_tid::text -> 'danadas', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'mid', p_mid, 'barra', p_barra, 'reemplazo', case when coalesce(p_compra, false) then 'compra' else 'taller' end, 'en', now(), 'por', auth.uid()))),
    actualizado_por = auth.uid(), actualizado_en = now()
  where sab = p_sab;

  return jsonb_build_object('material', mat, 'reemplazo', case when coalesce(p_compra, false) then 'compra' else 'taller' end,
    'compra_id', pid, 'compra', c);
end $$;

revoke execute on function public.corte_barra_danada(date, uuid, bigint, integer, boolean) from public, anon;
grant execute on function public.corte_barra_danada(date, uuid, bigint, integer, boolean) to authenticated;
