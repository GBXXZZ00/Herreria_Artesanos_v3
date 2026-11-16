-- Autor: Gualfredo (Claude de Gualfredo)
-- v97 · Seguridad (sigue a v95): cerrar las dos funciones internas que quedaban abiertas.
-- _avisar_usuario (manda un aviso) y _a_produccion_si_pagada (pasa una venta pagada a fabricación) se podían
-- llamar desde la app con cualquier sesión. Quedaban abiertas porque cambiar_estado_venta y actualizar_venta
-- corrían con el permiso del usuario. Ahora esas dos corren como security definer y revisan el rol al empezar
-- (_es_deposito(): administrador o vendedora, la misma regla RLS de ventas, ítems, clientes y disponibles).
-- El resto de cada función queda igual (se toma su definición actual y solo se agrega esa línea).

do $$
declare fn text; def text;
  viejo constant text := 'if auth.uid() is null then raise exception ''Hace falta entrar con PIN''; end if;';
  nuevo constant text := 'if auth.uid() is null then raise exception ''Hace falta entrar con PIN''; end if;
  if not _es_deposito() then raise exception ''Solo el administrador o la vendedora cambian ventas''; end if;';
begin
  foreach fn in array array['public.cambiar_estado_venta(bigint,text,text)','public.actualizar_venta(bigint,jsonb)'] loop
    def := pg_get_functiondef(fn::regprocedure);
    if position('_es_deposito()' in def) = 0 then
      if (length(def) - length(replace(def, viejo, ''))) / length(viejo) <> 1 then raise exception 'No encontré dónde poner el permiso en %', fn; end if;
      execute replace(def, viejo, nuevo);
    end if;
  end loop;
end $$;

alter function public.cambiar_estado_venta(bigint, text, text) security definer;
alter function public.actualizar_venta(bigint, jsonb) security definer;

revoke execute on function public._avisar_usuario(uuid, text, text, bigint) from public, anon, authenticated;
revoke execute on function public._a_produccion_si_pagada(bigint) from public, anon, authenticated;
