-- Autor: Ray (Claude de Ray)
-- v72c: Gualfredo confirma pagos, igual que Ray (decidido por Ray, opción A).
-- Ese permiso también le da: pagar la nómina, revisar entregas del Depósito y recibir
-- el aviso de cada pago por confirmar. Es un cambio de datos, no de reglas.
update public.perfiles
   set confirma_abonos = true
 where nombre = 'Gualfredo' and rol = 'admin';
