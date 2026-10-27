-- Totales de la ticketera para la plataforma del organizador (issue #3, ticket 01). Solo cifras:
-- ni nombres, ni cédulas, ni teléfonos, ni referencias. La Edge Function `pm` la llama con service
-- role en cada `leer` y la adjunta como `ticketera`; nunca se guarda. Las rechazadas no cuentan.
-- usd_cents es el nominal ($10 por entrada, también en pago móvil); los Bs van aparte en `bs`.
create function resumen_ticketera() returns jsonb
language sql stable security definer set search_path = public as $$
  with g(clave, estado, tipo) as (values
    ('aprobadas', 'aprobada', null), ('en_revision', 'en_revision', null),
    ('pago_movil', 'aprobada', 'pago_movil'), ('zelle', 'aprobada', 'zelle'), ('binance', 'aprobada', 'binance')
  ), t as (
    select g.clave, jsonb_build_object('ordenes', count(o.id), 'entradas', coalesce(sum(o.cantidad), 0),
        'usd_cents', coalesce(sum(o.monto_usd_cents), 0))
      -- Por método lleva `bs`: la suma en pago móvil (BNC y Ubii), null en Zelle y Binance.
      || case when g.tipo is null then '{}'::jsonb
         else jsonb_build_object('bs', case when g.tipo = 'pago_movil' then coalesce(sum(o.monto_bs), 0) end) end as v
    from g left join ordenes o on o.estado = g.estado and (g.tipo is null or o.tipo = g.tipo)
    group by g.clave, g.tipo
  )
  select jsonb_build_object(
    'consultado_en', now(),
    'aprobadas', (select v from t where clave = 'aprobadas'),
    'por_metodo', (select jsonb_object_agg(clave, v) from t where clave in ('pago_movil', 'zelle', 'binance')),
    'en_revision', (select v from t where clave = 'en_revision'),
    'ultima_aprobacion', (select max(resuelta_en) from ordenes where estado = 'aprobada'))
$$;

revoke execute on function resumen_ticketera() from public, anon, authenticated;
