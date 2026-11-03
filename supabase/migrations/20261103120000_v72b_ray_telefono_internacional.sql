-- Autor: Ray (Claude de Ray)
-- v72b: teléfonos de cualquier país. Quita el 00 del inicio (00 1 305… → 1305…).
-- Venezuela se sigue guardando como 58 + 10 números. La app ya manda el número limpio;
-- esto es para que la base diga lo mismo si llega con 00.
create or replace function public.normalizar_telefono(t text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when d ~ '^0\d{10}$' then '58' || substr(d, 2)      -- 04141234567 -> 584141234567
    when d ~ '^4\d{9}$' then '58' || d                  -- 4141234567  -> 584141234567
    else d end
  from (select regexp_replace(regexp_replace(coalesce(t,''), '\D', '', 'g'), '^00', '') as d) x
$function$;
