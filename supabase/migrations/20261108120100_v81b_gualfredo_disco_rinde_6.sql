-- Autor: Gualfredo (Claude de Gualfredo)
-- v81b · Dato de Ray: el disco de corte 14" rinde 6 puertas por disco como general (estaba en 3).
-- El Bitral es el dato de control ($223,22 · $290,19 · $326,79 · $339,23, costeado con el disco en 3): se le deja
-- su propio rendimiento en 3 para que no cambie. Si Ray quiere el 6 también en el Bitral, lo cambia en su ficha.
insert into public.costeo_modelo_insumos (modelo_id, insumo_id, rendimiento)
select m.id, i.id, i.rendimiento from public.costeo_modelos m, public.costeo_insumos i
where m.catalogo_id = 7 and i.codigo = 'd14' and i.rendimiento is not null
on conflict (modelo_id, insumo_id) do update set rendimiento = coalesce(public.costeo_modelo_insumos.rendimiento, excluded.rendimiento);
update public.costeo_insumos set rendimiento = 6 where codigo = 'd14';
