-- Check de la etapa 2. Corre en una transacción y deshace todo:
--   docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql
begin;

-- Se activan por concatenación y no con jsonb_set: si la config local perdió una clave, jsonb_set no la crea.
update config set tasa = 150, tasa_eur = 200, tasa_consultada_en = now(),
  metodos = metodos
    || jsonb_build_object('pago_movil_bnc', coalesce(metodos -> 'pago_movil_bnc', '{}') || '{"activo": true}')
    || jsonb_build_object('pago_movil_ubii', coalesce(metodos -> 'pago_movil_ubii', '{}') || '{"activo": true}')
    || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}') || '{"activo": true}');

set local role anon;

do $$
declare r json; err text;
begin
  r := crear_orden('Ana Pérez', 'v-12.345.678', '0414-123.45.67', 2, 'pago_movil_bnc', '00012283',
                   '11111111-1111-1111-1111-111111111111.jpg');
  assert (r ->> 'numero') is not null, 'crear_orden no devolvió número';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'estado') = 'en_revision', 'estado inicial';
  assert (ver_orden((r ->> 'token')::uuid) -> 'entradas')::text = 'null', 'QR antes de aprobar';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'monto_bs')::numeric = 4000, 'monto Bs = 2 x 10 EUR x 200 (tasa euro, no dólar)';
  assert (datos_venta() ->> 'tasa_eur')::numeric = 200, 'datos_venta sin tasa_eur';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'cedula') = 'V12345678', 'cédula normalizada';

  -- Misma referencia con otro formato y por la otra cuenta de pago móvil.
  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'pago_movil_ubii', '12-283',
                        '22222222-2222-2222-2222-222222222222.png');
    assert false, 'referencia repetida aceptada';
  exception when others then err := sqlerrm;
  end;
  assert err = 'referencia_usada', 'error esperado referencia_usada, vino ' || err;

  -- La misma cifra en otro método es otra referencia.
  perform crear_orden('Beto', '87654321', '04241234567', 1, 'zelle', '12283',
                      '33333333-3333-3333-3333-333333333333.png');

  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'binance', '999999',
                        '44444444-4444-4444-4444-444444444444.png');
    assert false, 'método inactivo aceptado';
  exception when others then err := sqlerrm;
  end;
  assert err = 'metodo_invalido', 'error esperado metodo_invalido, vino ' || err;

  assert (select count(*) from ordenes) = 0, 'anon puede leer ordenes';
  assert (datos_venta() -> 'metodos' -> 'binance') is null, 'datos_venta muestra método inactivo';
end $$;

reset role;

do $$
declare o ordenes; z ordenes; err text; e json;
begin
  select * into o from ordenes where metodo = 'pago_movil_bnc' and referencia = '12283';
  select * into z from ordenes where metodo = 'zelle' and referencia = '12283';
  assert ver_entrada(gen_random_uuid()) is null, 'ver_entrada con token inexistente';
  perform resolver_orden(o.id, true);
  assert (select count(*) from entradas where orden_id = o.id) = 2, 'aprobar no creó 2 entradas';
  assert json_array_length(ver_orden(o.token) -> 'entradas') = 2, 'ver_orden no muestra QR aprobada';
  e := ver_entrada((ver_orden(o.token) -> 'entradas' ->> 1)::uuid);
  assert (e ->> 'posicion') = '2' and (e ->> 'total') = '2' and (e ->> 'numero') = o.numero::text, 'ver_entrada posición: ' || e::text;
  assert e::text not like '%Ana%' and e::text not like '%V12345678%', 'ver_entrada expone datos personales';
  perform resolver_orden(z.id, false, '  No llegó el pago  ');
  assert (ver_orden(z.token) ->> 'rechazo_motivo') = 'No llegó el pago', 'rechazo sin motivo';
  assert ver_entrada(gen_random_uuid()) is null, 'ver_entrada de orden no aprobada';
  begin
    perform resolver_orden(o.id, false);
    assert false, 'orden resuelta dos veces';
  exception when others then err := sqlerrm;
  end;
  assert err = 'orden_ya_resuelta', 'error esperado orden_ya_resuelta, vino ' || err;
end $$;

-- Check-in del portero (issue #4).
do $$
declare o ordenes; t1 uuid; t2 uuid; tr uuid; r0 json; r1 json; r2 json; err text; l json; h timestamptz;
begin
  select * into o from ordenes where metodo = 'pago_movil_bnc' and referencia = '12283';
  t1 := ver_orden(o.token) -> 'entradas' ->> 0;
  t2 := ver_orden(o.token) -> 'entradas' ->> 1;
  r0 := resumen_portero();
  r1 := checkin_entrada(t1);
  assert r1 ->> 'resultado' = 'valida', 'primer check-in: ' || r1::text;
  assert (r1 ->> 'posicion') = '1' and (r1 ->> 'total') = '2' and (r1 ->> 'numero') = o.numero::text, 'posición: ' || r1::text;
  assert (r1 ->> 'checked_in_at') is not null and (r1 ->> 'token')::uuid = t1, 'válida sin hora o sin token';
  -- now() es fijo en la transacción: se corre la hora atrás para ver si el segundo check-in la pisa.
  update entradas set checked_in_at = checked_in_at - interval '1 minute' where token = t1 returning checked_in_at into h;
  r2 := checkin_entrada(t1);
  assert r2 ->> 'resultado' = 'ya_usada', 'segundo check-in: ' || r2::text;
  assert (r2 ->> 'checked_in_at')::timestamptz = h, 'ya_usada cambió la hora del primer ingreso';
  assert checkin_entrada(gen_random_uuid()) ->> 'motivo' = 'no_existe', 'token inexistente';

  -- Entrada colgada de una orden en revisión (solo posible a mano): inválida.
  insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents)
  values ('Rev', 'V1', '0', 1, 'zelle', 'PORTEROREV1', 'x.jpg', 1000) returning * into o;
  insert into entradas (orden_id) values (o.id) returning token into tr;
  r1 := checkin_entrada(tr);
  assert r1 ->> 'resultado' = 'invalida' and r1 ->> 'motivo' = 'no_aprobada', 'orden en revisión: ' || r1::text;

  -- Deshacer dentro de la ventana: vuelve a validar. Fuera de la ventana: no deshace.
  assert (deshacer_checkin(t1) ->> 'ok')::boolean, 'deshacer dentro de 5 min';
  assert checkin_entrada(t1) ->> 'resultado' = 'valida', 'tras deshacer no vuelve a valida';
  update entradas set checked_in_at = now() - interval '6 minutes' where token = t1;
  assert not (deshacer_checkin(t1) ->> 'ok')::boolean, 'deshizo fuera de la ventana';
  assert checkin_entrada(t1) ->> 'resultado' = 'ya_usada', 'fuera de la ventana quedó sin hora';

  -- Código de respaldo: prefijo del token; dos coincidencias → ambiguo.
  assert token_por_codigo(upper(left(t2::text, 8))) = t2, 'código de respaldo no resuelve';
  assert token_por_codigo('zzzzzzzz') is null and token_por_codigo('0000000') is null, 'código mal formado';
  insert into entradas (orden_id, token) select id, v::uuid from ordenes, unnest(array[
    'abcdef12-0000-4000-8000-00000000000a', 'abcdef12-0000-4000-8000-00000000000b']) v where referencia = 'PORTEROREV1';
  begin
    perform token_por_codigo('abcdef12');
    assert false, 'código ambiguo aceptado';
  exception when others then err := sqlerrm;
  end;
  assert err = 'codigo_ambiguo', 'error esperado codigo_ambiguo, vino ' || err;

  l := lista_portero();
  assert (l ->> 'generada_en') is not null and l::text like '%' || t1 || '%' and l::text like '%' || t2 || '%', 'lista sin las entradas aprobadas';
  assert l::text not like '%' || tr || '%' and l::text not like '%abcdef12%', 'lista con entradas no aprobadas';
  assert l::text not like '%Ana%' and l::text not like '%V12345678%' and l::text not like '%04141234567%', 'lista expone datos personales';
  assert (resumen_portero() ->> 'aprobadas') = (r0 ->> 'aprobadas')
     and (resumen_portero() ->> 'ingresadas')::int = (r0 ->> 'ingresadas')::int + 1, 'resumen: ' || resumen_portero()::text;
end $$;

set local role anon;
do $$
begin
  perform resolver_orden(gen_random_uuid(), true);
  assert false, 'anon puede resolver órdenes';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform checkin_entrada(gen_random_uuid());
  assert false, 'anon puede hacer check-in';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform lista_portero();
  assert false, 'anon puede bajar la lista del portero';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'OK ticketera.sql: ' || count(*) || ' órdenes creadas' from ordenes;
rollback;
