-- Autor: Gualfredo (Claude de Gualfredo)
-- v87 · Taller (lote 2): el aviso "Terminó ..." al administrador abre directo ese trabajo con su
-- foto (taller.html?trabajo=<id del paso>) en vez del pedido en Producción.
-- Solo cambia el enlace del aviso en marcar_etapa_terminada y terminar_etapa_madera: el resto de
-- cada función queda igual (se toma su definición actual y se reemplaza ese texto).
-- Los demás avisos que llevan a produccion.html siguen sirviendo: esa página redirige al Taller.

do $$
declare
  fn text;
  def text;
  viejo constant text := '''produccion.html?abrir='' || vid';
  nuevo constant text := '''taller.html?trabajo='' || eid';
begin
  foreach fn in array array['public.marcar_etapa_terminada(bigint,text)', 'public.terminar_etapa_madera(bigint,text)'] loop
    def := pg_get_functiondef(fn::regprocedure);
    if position(nuevo in def) > 0 then continue; end if;   -- ya estaba aplicada
    if (length(def) - length(replace(def, viejo, ''))) / length(viejo) <> 1 then
      raise exception 'No encontré una sola vez el enlace del aviso en %', fn;
    end if;
    execute replace(def, viejo, nuevo);
  end loop;
end $$;
