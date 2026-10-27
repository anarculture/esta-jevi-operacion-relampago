-- Venta manual: madeidk (Instagram), 2 entradas por pago móvil, cobradas fuera del flujo.
-- Inserta la orden ya aprobada y sus 2 entradas, saltando crear_orden (no hay cédula ni captura).
-- Idempotente: si la referencia MANUALMADEIDK1 ya existe, no inserta nada y solo devuelve los tokens.
with nueva as (
  insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, estado, resuelta_en, dictamen_motivo)
  select 'madeidk (Instagram)', 'V0', '0', 2, 'pago_movil_bnc', 'MANUALMADEIDK1', 'manual.jpg', 2000, 'aprobada', now(), 'venta manual, emitida por Mau'
  where not exists (select 1 from ordenes where referencia = 'MANUALMADEIDK1')
  returning id
), ents as (
  insert into entradas (orden_id) select id from nueva, generate_series(1, 2) returning orden_id
)
select o.numero, o.token as orden_token, e.token as entrada_token
from ordenes o join entradas e on e.orden_id = o.id
where o.referencia = 'MANUALMADEIDK1'
order by e.id;
