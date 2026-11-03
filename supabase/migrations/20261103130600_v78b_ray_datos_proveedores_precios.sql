-- Autor: Ray (Claude de Ray)
-- v78b · Datos reales para Costos y Depósito (de la maqueta de Ray, sección Datos y window.MAQUETA):
-- proveedores (Colores y Ambiente, Inversiones Torniplemaca y "Sin factura"), material de fabricación con sus
-- medidas, precios sin IVA por proveedor, insumos para costear, gastos fijos ($915 al mes), costeo del Bitral
-- (catálogo id 7, M-01) y la nota de entrega 00-2884 de Torniplemaca ($1.674,50) con el material por registrar.
-- NO se cargan: existencias (las sube Ray), saldos de cuentas ni de proveedores, ventas ni clientes de ejemplo.
-- Ojo: la nota 00-2884 mueve el saldo de Torniplemaca a "Le debes $1.674,50" hasta que Ray ponga el saldo real.

insert into public.proveedores (nombre, rif, tipos, cobra_iva, principal, nota) values
  ('Colores y Ambiente', null, array['hierro','laminas'], true, true, 'Da factura'),
  ('Inversiones Torniplemaca', 'J-40218850-1', array['hierro','laminas'], false, false, 'Da nota de entrega'),
  ('Sin factura (ferretería y otros)', null, array['vidrio','pintura','consumibles','accesorios'], false, false, 'Precios dados por Ray')
on conflict do nothing;

insert into public.materiales_fab (codigo, nombre, tipo, presentacion, largo_cm, hoja_ancho_cm, hoja_alto_cm, espesor, precio_fijo, orden) values
  ('t1x3',  'Tubo 1" x 3"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 1),
  ('t1x2',  'Tubo 1" x 2"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 2),
  ('t1x1',  'Tubo 1" x 1"',             'hierro',  'barra', 600, null, null, '0,90 mm', null, 3),
  ('t12',   'Tubo 1/2" x 1/2" 0,70',    'hierro',  'barra', 600, null, null, '0,70 mm', null, 4),
  ('pl12',  'Platina 1/2" x 2 mm',      'hierro',  'barra', 600, null, null, '2 mm',    null, 5),
  ('pl1',   'Platina 1" x 1/8"',        'hierro',  'barra', 600, null, null, null,      null, 6),
  ('m10',   'Marco de puerta 10',       'hierro',  'barra', 510, null, null, '0,70 mm', 12.28, 7),
  ('m15',   'Marco de puerta 15',       'hierro',  'barra', 510, null, null, null,      null, 8),
  ('lam14', 'Lámina pulida C/14',       'laminas', 'hoja',  null, 122, 244, null,       null, 9),
  ('lam16', 'Lámina calibre 16',        'laminas', 'hoja',  null, 122, 244, null,       null, 10),
  ('vid5',  'Vidrio 5 mm',              'vidrio',  'hoja',  null, 330, 244, null,       null, 11)
on conflict do nothing;

-- Precios sin IVA por proveedor (con espesor cuando lo da)
insert into public.material_precios (material_id, proveedor_id, precio, espesor, origen)
select m.id, p.id, x.precio, x.espesor, 'datos'
from (values
  ('t1x3', 'Colores y Ambiente', 12.98, '0,90 mm'),
  ('t1x2', 'Colores y Ambiente', 9.69, '0,90 mm'), ('t1x2', 'Inversiones Torniplemaca', 9.50, '0,80 mm'),
  ('t1x1', 'Colores y Ambiente', 6.43, '0,90 mm'), ('t1x1', 'Inversiones Torniplemaca', 6.50, '0,80 mm'),
  ('t12',  'Colores y Ambiente', 2.66, '0,70 mm'),
  ('pl12', 'Colores y Ambiente', 2.19, '2 mm'),
  ('pl1',  'Colores y Ambiente', 6.51, null), ('pl1', 'Inversiones Torniplemaca', 6.50, null),
  ('m10',  'Colores y Ambiente', 12.28, '0,70 mm'), ('m10', 'Inversiones Torniplemaca', 13.00, '0,70 mm'),
  ('m15',  'Colores y Ambiente', 15.07, null), ('m15', 'Inversiones Torniplemaca', 15.50, null),
  ('lam14','Colores y Ambiente', 61.05, null),
  ('lam16','Colores y Ambiente', 49.66, null), ('lam16', 'Inversiones Torniplemaca', 52.00, null),
  ('vid5', 'Sin factura (ferretería y otros)', 100.00, null)
) x(cod, prov, precio, espesor)
join public.materiales_fab m on m.codigo = x.cod join public.proveedores p on p.nombre = x.prov
where not exists (select 1 from public.material_precios mp where mp.material_id = m.id and mp.proveedor_id = p.id and mp.vigente);

-- Insumos para costear: precio sin IVA y rendimiento general (puertas por unidad). Sin general = se pone por modelo.
insert into public.costeo_insumos (codigo, nombre, grupo, precio, rendimiento, orden) values
  ('fondo', 'Fondo anticorrosivo', 'Pintura y masilla', 20, null, 1),
  ('esmalte', 'Esmalte', 'Pintura y masilla', 22, null, 2),
  ('masilla', 'Masilla', 'Pintura y masilla', 25, null, 3),
  ('thinner', 'Thinner', 'Pintura y masilla', 10, 2, 4),
  ('electrodo', 'Electrodos (kg)', 'Consumibles', 3, 2, 5),
  ('d14', 'Disco de corte 14"', 'Consumibles', 6, 3, 6),
  ('d7', 'Disco de corte 7"', 'Consumibles', 1, 1, 7),
  ('flap', 'Disco flap', 'Consumibles', 1, 4, 8),
  ('carton', 'Disco de cartón', 'Consumibles', 1, 4, 9),
  ('l40', 'Lija 40', 'Consumibles', 4, 1, 10),
  ('l80', 'Lija 80', 'Consumibles', 1, 0.5, 11),
  ('l100', 'Lija 100', 'Consumibles', 1, 1, 12),
  ('l120', 'Lija 120', 'Consumibles', 1, 1, 13),
  ('bisagra', 'Bisagra', 'Accesorios', 1, null, 14),
  ('cerradura', 'Cerradura multilock', 'Accesorios', 15, null, 15),
  ('manillon', 'Manillón inox 30 cm', 'Accesorios', 20, null, 16)
on conflict (codigo) do nothing;

-- Gastos fijos del mes: $915 en total (Ray los cambia en Costos › Ganancia)
insert into public.gastos_fijos (categoria, monto, orden) values
  ('Alquiler', 800, 1), ('Electricidad', 60, 2), ('Internet', 30, 3), ('Teléfono', 5, 4), ('Transporte', 20, 5)
on conflict do nothing;

-- Costeo del Bitral (catálogo id 7) = Vitral M-01 de la Memoria central de Ray.
-- Mano de obra con la categoría "Puerta Estándar" (como en la maqueta). En el catálogo el Bitral todavía no tiene categoría.
do $$
declare mid bigint; cat bigint;
begin
  if not exists (select 1 from public.catalogo where id = 7) or exists (select 1 from public.costeo_modelos where catalogo_id = 7) then return; end if;
  select id into cat from public.categorias_pago where nombre = 'Puerta Estándar' and producto = 'Puerta Multilock' limit 1;
  insert into public.costeo_modelos (catalogo_id, codigo, estado, categoria_pago_id) values (7, 'M-01', 'listo', cat) returning id into mid;
  insert into public.costeo_piezas (modelo_id, material_id, cantidad, largo_cm, nota, orden)
  select mid, m.id, x.n, x.cm, x.nota, x.o from (values
    ('t1x3', 2, 200, 'Bastidor largo', 1), ('t1x3', 2, 88, 'Bastidor ancho', 2), ('m10', 1, 500, 'Marco', 3), ('t1x2', 1, 194, 'Divisor vertical', 4),
    ('pl12', 1, 600, 'Ranuras, frente', 5), ('t12', 1, 600, 'Ranuras, atrás', 6), ('t12', 1, 390, 'Vitral largo', 7)
  ) x(cod, n, cm, nota, o) join public.materiales_fab m on m.codigo = x.cod;
  insert into public.costeo_hojas (modelo_id, material_id, cantidad, ancho_cm, alto_cm, nota, orden)
  select mid, m.id, x.n, x.a, x.h, x.nota, x.o from (values
    ('lam14', 1, 61.5, 179, 'Panel', 8), ('vid5', 1, 184, 10, 'Franja de vidrio', 9), ('vid5', 5, 50, 4, 'Ranuras de vidrio', 10)
  ) x(cod, n, a, h, nota, o) join public.materiales_fab m on m.codigo = x.cod;
  insert into public.costeo_modelo_insumos (modelo_id, insumo_id, rendimiento)
  select mid, i.id, 3 from public.costeo_insumos i where i.codigo in ('fondo','esmalte','masilla','thinner','d7','carton');
  insert into public.costeo_modelo_insumos (modelo_id, insumo_id, cantidad)
  select mid, i.id, x.q from (values ('bisagra', 3), ('cerradura', 1), ('manillon', 1)) x(cod, q) join public.costeo_insumos i on i.codigo = x.cod;
end $$;

-- Nota de entrega real de Torniplemaca 00-2884 (31 oct 2026, $1.674,50, sin IVA). Los 12 renglones quedan por registrar.
do $$
declare pid bigint; cid bigint;
begin
  select id into pid from public.proveedores where nombre = 'Inversiones Torniplemaca';
  if pid is null or exists (select 1 from public.compras where proveedor_id = pid and numero = '00-2884') then return; end if;
  insert into public.compras (proveedor_id, documento, numero, fecha, subtotal, iva, total, material_pendiente, nota)
  values (pid, 'nota', '00-2884', date '2026-10-31', 1674.50, 0, 1674.50, true, 'Nota de entrega real de Torniplemaca: 12 productos por registrar')
  returning id into cid;
  insert into public.movimientos (fecha, tipo, proveedor_id, monto_proveedor, referencia, nota, compra_id)
  values (date '2026-10-31', 'compra', pid, -1674.50, 'Nota 00-2884', 'Material por registrar', cid);
end $$;
