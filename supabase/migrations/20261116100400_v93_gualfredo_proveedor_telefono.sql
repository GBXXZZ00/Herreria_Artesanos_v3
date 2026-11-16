-- Autor: Gualfredo (Claude de Gualfredo)
-- v93 · Taller › Corte, base (lote 4, §3B.2 punto 5): el teléfono del proveedor sirve para wa.me.
-- proveedor_guardar pasa el teléfono por normalizar_telefono (04141234567 -> 584141234567).
-- Los que ya están guardados se normalizan una vez. compras_en_camino devuelve el teléfono de cada
-- proveedor para armar el mensaje de WhatsApp.

create or replace function public.proveedor_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare nid bigint; nom text := nullif(trim(p->>'nombre'), ''); tps text[]; tel text := nullif(normalizar_telefono(p->>'telefono'), '');
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
    values (nom, nullif(trim(p->>'rif'),''), tel, tps, coalesce((p->>'cobra_iva')::boolean, false),
            nullif(trim(p->>'datos_pago'),''), nullif(trim(p->>'nota'),''), auth.uid())
    returning id into nid;
  else
    update proveedores set nombre = nom, rif = nullif(trim(p->>'rif'),''), telefono = tel, tipos = tps,
      cobra_iva = coalesce((p->>'cobra_iva')::boolean, cobra_iva), datos_pago = nullif(trim(p->>'datos_pago'),''),
      nota = nullif(trim(p->>'nota'),''), activo = coalesce((p->>'activo')::boolean, activo)
    where id = (p->>'id')::bigint returning id into nid;
    if nid is null then raise exception 'No existe ese proveedor'; end if;
  end if;
  return jsonb_build_object('id', nid);
end $$;

-- Los teléfonos que ya estaban guardados
update public.proveedores set telefono = nullif(normalizar_telefono(telefono), '')
where telefono is not null and telefono is distinct from nullif(normalizar_telefono(telefono), '');

-- compras_en_camino: el teléfono de cada proveedor
do $$
declare
  def text := pg_get_functiondef('public.compras_en_camino()'::regprocedure);
  viejo constant text := '''iva'', p.cobra_iva, ''saldo'', _saldo_proveedor(p.id))';
  nuevo constant text := '''iva'', p.cobra_iva, ''telefono'', p.telefono, ''saldo'', _saldo_proveedor(p.id))';
begin
  if position('''telefono'', p.telefono' in def) > 0 then return; end if;
  if (length(def) - length(replace(def, viejo, ''))) / length(viejo) <> 1 then raise exception 'No encontré dónde poner el teléfono en compras_en_camino'; end if;
  execute replace(def, viejo, nuevo);
end $$;
