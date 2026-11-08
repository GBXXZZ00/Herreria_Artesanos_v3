-- Autor: Gualfredo (Claude de Gualfredo)
-- v81 · Ficha del modelo (lote 1 de la reestructura de Costos): una sola lista de cortes como el Costeador.
-- Cada pieza dice qué es (Bastidor, Marco, Divisor, Travesaño, Ranura, Vitral u Otra) y si va vertical (V) u
-- horizontal (H): prepara el dibujo en 3D. Reglas: despunte (cm que se botan de cada punta de la barra), empieza en 0.
-- _costeo NO cambia: el costo no depende de esto (Bitral sigue en $223,22 · $290,19 · $326,79 · $339,23).

alter table public.costeo_piezas add column if not exists que_es text
  check (que_es is null or que_es in ('Bastidor','Marco','Divisor','Travesaño','Ranura','Vitral','Otra'));
alter table public.costeo_piezas add column if not exists orientacion text check (orientacion is null or orientacion in ('V','H'));
alter table public.costeo_reglas add column if not exists despunte_cm numeric(5,2) not null default 0 check (despunte_cm >= 0 and despunte_cm <= 20);

-- Piezas viejas: lo que dice su nota sugiere qué es y cómo va (solo si la nota lo dice claro; si no, queda vacío)
update public.costeo_piezas set que_es = case
    when nota ilike 'bastidor%' then 'Bastidor' when nota ilike 'marco%' then 'Marco' when nota ilike 'divisor%' then 'Divisor'
    when nota ilike 'travesa%' then 'Travesaño' when nota ilike 'ranura%' then 'Ranura' when nota ilike 'vitral%' then 'Vitral' end
  where que_es is null;
update public.costeo_piezas set orientacion = case when nota ilike '%vertical%' or nota ilike '%largo%' then 'V' when nota ilike '%horizontal%' or nota ilike '%ancho%' then 'H' end
  where orientacion is null;

-- Datos de Costos: reglas con despunte y piezas [material, cantidad, cm, nota, que_es, orientacion]
create or replace function public.costos_datos(pref bigint default null)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare prov bigint := _prov_costeo(pref);
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Costos es solo para Ray o Gualfredo'; end if;
  return jsonb_build_object(
    'prov', prov,
    'reglas', (select jsonb_build_object('iva', iva, 'ganancia', ganancia, 'puertasMes', puertas_mes, 'corte', corte_cm, 'despunte', despunte_cm,
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
        'piezas', coalesce((select jsonb_agg(jsonb_build_array(p.material_id, p.cantidad, p.largo_cm, coalesce(p.nota, ''), p.que_es, p.orientacion) order by p.orden, p.id) from costeo_piezas p where p.modelo_id = cm.id), '[]'::jsonb),
        'hojas', coalesce((select jsonb_agg(jsonb_build_array(h.material_id, h.cantidad, h.ancho_cm, h.alto_cm, coalesce(h.nota, '')) order by h.orden, h.id) from costeo_hojas h where h.modelo_id = cm.id), '[]'::jsonb),
        'rend', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.rendimiento) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo <> 'Accesorios' and mi.rendimiento is not null), '{}'::jsonb),
        'acc', coalesce((select jsonb_object_agg(mi.insumo_id::text, mi.cantidad) from costeo_modelo_insumos mi join costeo_insumos i on i.id = mi.insumo_id where mi.modelo_id = cm.id and i.grupo = 'Accesorios' and mi.cantidad is not null), '{}'::jsonb),
        'extras', coalesce((select jsonb_agg(jsonb_build_object('n', e.nombre, 'v', e.costo)) from costeo_extras e where e.modelo_id = cm.id), '[]'::jsonb),
        'x', _costeo(cm.id, prov, 'metro')) order by cm.id) from costeo_modelos cm), '[]'::jsonb)
  );
end $$;

-- Guardar el costeo de un modelo. Piezas: [material_id, cantidad, cm, nota, que_es?, orientacion?] (las de 4 elementos siguen sirviendo)
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
    if nullif(x->>4,'') is not null and x->>4 not in ('Bastidor','Marco','Divisor','Travesaño','Ranura','Vitral','Otra') then raise exception 'Revisa qué es cada pieza'; end if;
    if nullif(x->>5,'') is not null and x->>5 not in ('V','H') then raise exception 'Cada pieza va vertical (V) u horizontal (H)'; end if;
    if not exists (select 1 from materiales_fab where id = (x->>0)::bigint and presentacion = 'barra') then raise exception 'Elige un material en barra para cada corte'; end if;
    insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion)
    values (mid, (x->>0)::bigint, (x->>1)::int, (x->>2)::numeric, nullif(trim(x->>3),''), i, nullif(x->>4,''), nullif(x->>5,''));
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

-- Duplicar un costeo: copia también qué es y cómo va cada pieza
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
  insert into costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion) select nid, material_id, cantidad, largo_cm, nota, orden, que_es, orientacion from costeo_piezas where modelo_id = mid;
  insert into costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden) select nid, material_id, cantidad, ancho_cm, alto_cm, nota, orden from costeo_hojas where modelo_id = mid;
  insert into costeo_modelo_insumos (modelo_id, insumo_id, rendimiento, cantidad) select nid, insumo_id, rendimiento, cantidad from costeo_modelo_insumos where modelo_id = mid;
  insert into costeo_extras (modelo_id, nombre, costo, orden) select nid, nombre, costo, orden from costeo_extras where modelo_id = mid;
  return jsonb_build_object('id', nid);
end $$;

-- Reglas del costeo. p: {ganancia?, puertas_mes?, corte_cm?, despunte_cm?, iva?}
create or replace function public.costeo_reglas_guardar(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta entrar con PIN'; end if;
  if not _es_ray() then raise exception 'Solo Ray o Gualfredo cambian las reglas'; end if;
  if coalesce(nullif(p->>'ganancia','')::numeric, 30) < 0 or coalesce(nullif(p->>'ganancia','')::numeric, 30) > 300 then raise exception 'Revisa la ganancia'; end if;
  if coalesce(nullif(p->>'puertas_mes','')::int, 25) <= 0 then raise exception 'Las puertas al mes deben ser más de 0'; end if;
  if coalesce(nullif(p->>'corte_cm','')::numeric, 0) < 0 or coalesce(nullif(p->>'corte_cm','')::numeric, 0) > 2 then raise exception 'El grosor del corte va de 0 a 2 cm'; end if;
  if coalesce(nullif(p->>'despunte_cm','')::numeric, 0) < 0 or coalesce(nullif(p->>'despunte_cm','')::numeric, 0) > 20 then raise exception 'El despunte va de 0 a 20 cm'; end if;
  if coalesce(nullif(p->>'iva','')::numeric, 16) < 0 or coalesce(nullif(p->>'iva','')::numeric, 16) > 50 then raise exception 'Revisa el IVA'; end if;
  update costeo_reglas set ganancia = coalesce(nullif(p->>'ganancia','')::numeric, ganancia), puertas_mes = coalesce(nullif(p->>'puertas_mes','')::int, puertas_mes),
    corte_cm = coalesce(nullif(p->>'corte_cm','')::numeric, corte_cm), despunte_cm = coalesce(nullif(p->>'despunte_cm','')::numeric, despunte_cm), iva = coalesce(nullif(p->>'iva','')::numeric, iva), actualizado_en = now() where id = 1;
  return jsonb_build_object('ok', true);
end $$;
