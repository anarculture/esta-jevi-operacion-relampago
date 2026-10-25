-- Check de la etapa 2. Corre en una transacción y deshace todo:
--   docker exec -i supabase_db_esta-jevi-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql
begin;

update config set tasa = 200, tasa_consultada_en = now(),
  metodos = jsonb_set(jsonb_set(jsonb_set(metodos,
    '{pago_movil_bnc,activo}', 'true'), '{pago_movil_ubii,activo}', 'true'), '{zelle,activo}', 'true');

set local role anon;

do $$
declare r json; err text;
begin
  r := crear_orden('Ana Pérez', 'v-12.345.678', '0414-123.45.67', 2, 'pago_movil_bnc', '00012283',
                   '11111111-1111-1111-1111-111111111111.jpg');
  assert (r ->> 'numero') is not null, 'crear_orden no devolvió número';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'estado') = 'en_revision', 'estado inicial';
  assert (ver_orden((r ->> 'token')::uuid) -> 'entradas')::text = 'null', 'QR antes de aprobar';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'monto_bs')::numeric = 4000, 'monto Bs = 2 x 10 x 200';
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
declare o ordenes; err text;
begin
  select * into o from ordenes where metodo = 'pago_movil_bnc';
  perform resolver_orden(o.id, true);
  assert (select count(*) from entradas where orden_id = o.id) = 2, 'aprobar no creó 2 entradas';
  assert json_array_length(ver_orden(o.token) -> 'entradas') = 2, 'ver_orden no muestra QR aprobada';
  begin
    perform resolver_orden(o.id, false);
    assert false, 'orden resuelta dos veces';
  exception when others then err := sqlerrm;
  end;
  assert err = 'orden_ya_resuelta', 'error esperado orden_ya_resuelta, vino ' || err;
end $$;

set local role anon;
do $$
begin
  perform resolver_orden(gen_random_uuid(), true);
  assert false, 'anon puede resolver órdenes';
exception when insufficient_privilege then null;
end $$;
reset role;

select 'OK ticketera.sql: ' || count(*) || ' órdenes creadas' from ordenes;
rollback;
