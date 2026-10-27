-- Entrada de prueba del portero (issue #4, ticket 04): 1 entrada para validar el check-in en
-- producción sin tocar entradas reales. Mismo patrón que orden-madeidk.sql: orden ya aprobada,
-- saltando crear_orden. Idempotente: si la referencia PRUEBAPORTERO1 ya existe, no inserta nada
-- y solo devuelve el token y su código de respaldo. Dos sentencias: el select final de una sola
-- no vería las filas recién insertadas por los CTE.
with nueva as (
  insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, estado, resuelta_en, dictamen_motivo)
  select 'Prueba del portero', 'V0', '0', 1, 'zelle', 'PRUEBAPORTERO1', 'manual.jpg', 0, 'aprobada', now(), 'entrada de prueba del check-in, no es una venta'
  where not exists (select 1 from ordenes where referencia = 'PRUEBAPORTERO1')
  returning id
)
insert into entradas (orden_id) select id from nueva;

select o.numero, e.token as entrada_token, left(e.token::text, 8) as codigo, e.checked_in_at
from ordenes o join entradas e on e.orden_id = o.id
where o.referencia = 'PRUEBAPORTERO1';
