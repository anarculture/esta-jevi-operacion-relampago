-- Reingreso con cédula (decisión de Mau, 28-oct): una entrada ya usada vuelve a pasar si quien la
-- muestra enseña el documento con la cédula del comprador de la orden. El portero ve esa cédula; la
-- lista sin señal la lleva también, para reingresos sin señal. Cortesías y ventas manuales traen 'V0'.
-- create or replace conserva los revoke de 20261027000000_portero.sql.
create or replace function _portero_entrada(e entradas, o ordenes, p_resultado text) returns json
language sql stable set search_path = public as $$
  select json_build_object(
    'resultado', p_resultado, 'token', e.token, 'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id),
    'checked_in_at', e.checked_in_at, 'cedula', o.cedula)
$$;

create or replace function lista_portero() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('generada_en', now(), 'entradas', coalesce(json_agg(json_build_object(
    'token', e.token, 'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id),
    'checked_in_at', e.checked_in_at, 'cedula', o.cedula) order by e.token), '[]'))
  from entradas e join ordenes o on o.id = e.orden_id
  where o.estado = 'aprobada'
$$;
