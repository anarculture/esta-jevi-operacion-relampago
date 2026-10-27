-- Check de la etapa 2. Corre en una transacción y deshace todo:
--   docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql
begin;

-- Backfill de avisos (issue #5): las entradas emitidas antes de la migración quedaron avisadas.
-- Las que nacen sin WhatsApp por el SQL manual también nacen avisadas (plantilla-venta-manual.sql).
do $$
begin
  assert not exists (select 1 from entradas where whatsapp is null and avisada_en is null),
    'hay entradas sin WhatsApp pendientes de aviso (falta el backfill)';
  -- Venezolano en sus formas habituales → 58…; extranjero con código de país, tal cual.
  assert normalizar_whatsapp('0414-123.45.67') = '584141234567', '04… no quedó 58…';
  assert normalizar_whatsapp('414 123 4567') = '584141234567', 'venezolano sin el 0 no quedó 58… (saldría a Suiza)';
  assert normalizar_whatsapp('+58 0414 123 4567') = '584141234567', '+58 0414… conservó el 0';
  assert normalizar_whatsapp('+58 414 123 4567') = '584141234567', '+58 414… cambió';
  assert normalizar_whatsapp('+1 (305) 555-0100') = '13055550100', 'extranjero cambió';
end $$;

-- Se activan por concatenación y no con jsonb_set: si la config local perdió una clave, jsonb_set no la crea.
update config set tasa = 150, tasa_eur = 200, tasa_consultada_en = now(), precio_usd_cents = 1500,
  metodos = metodos
    || jsonb_build_object('pago_movil_bnc', coalesce(metodos -> 'pago_movil_bnc', '{}') || '{"activo": true}')
    || jsonb_build_object('pago_movil_ubii', coalesce(metodos -> 'pago_movil_ubii', '{}') || '{"activo": true}')
    || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}') || '{"activo": true}');

set local role anon;

do $$
declare r json; err text;
begin
  r := crear_orden('Ana Pérez', 'v-12.345.678', '0414-123.45.67', 2, 'pago_movil_bnc', '000712283',
                   '11111111-1111-1111-1111-111111111111.jpg', array['0414-123.45.67', '0424 111 2233'],
                   '{"banco": " Mercantil ", "telefono": "0414-765.43.21", "cedula": "v-9.876.543", "extra": "se descarta"}');
  assert (r ->> 'numero') is not null, 'crear_orden no devolvió número';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'estado') = 'en_revision', 'estado inicial';
  assert (ver_orden((r ->> 'token')::uuid) -> 'entradas')::text = 'null', 'QR antes de aprobar';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'monto_bs')::numeric = 4000, 'monto Bs = 2 x 10 EUR x 200 (tasa euro, no dólar)';
  assert (datos_venta() ->> 'tasa_eur')::numeric = 200, 'datos_venta sin tasa_eur';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'cedula') = 'V12345678', 'cédula normalizada';
  -- Datos del pagador (issue #6, punto 2): solo el panel los ve.
  assert ver_orden((r ->> 'token')::uuid)::text not like '%pagador%' and ver_orden((r ->> 'token')::uuid)::text not like '%9876543%'
     and ver_orden((r ->> 'token')::uuid)::text not like '%7654321%', 'ver_orden expone al pagador';
  foreach err in array array['pm sin cédula', 'pm cédula corta', 'pm teléfono extranjero', 'pm sin banco', 'pm banco no texto', 'zelle sin titular', 'sin pagador', 'pagador no objeto'] loop
    begin
      case err
        when 'pm sin cédula' then perform crear_orden('Beto', '87654321', '', 1, 'pago_movil_ubii', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "04247654321"}');
        when 'pm cédula corta' then perform crear_orden('Beto', '87654321', '', 1, 'pago_movil_ubii', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "04247654321", "cedula": "V-1234"}');
        when 'pm teléfono extranjero' then perform crear_orden('Beto', '87654321', '', 1, 'pago_movil_ubii', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "+1 305 555 0100", "cedula": "9876543"}');
        when 'pm sin banco' then perform crear_orden('Beto', '87654321', '', 1, 'pago_movil_ubii', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": " ", "telefono": "04247654321", "cedula": "9876543"}');
        when 'pm banco no texto' then perform crear_orden('Beto', '87654321', '', 1, 'pago_movil_ubii', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": 12345, "telefono": "04247654321", "cedula": "9876543"}');
        when 'zelle sin titular' then perform crear_orden('Beto', '87654321', '', 1, 'zelle', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"cedula": "9876543"}');
        when 'sin pagador' then perform crear_orden('Beto', '87654321', '', 1, 'zelle', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567']);
        when 'pagador no objeto' then perform crear_orden('Beto', '87654321', '', 1, 'zelle', 'PAGMAL1',
          '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '"Beto Díaz"');
      end case;
      assert false, 'pagador inválido aceptado: ' || err;
    exception when raise_exception then
      assert sqlerrm = 'pagador_invalido', err || ': error esperado pagador_invalido, vino ' || sqlerrm;
    end;
  end loop;

  -- Misma referencia con otro formato y por la otra cuenta de pago móvil.
  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'pago_movil_ubii', '712-283',
                        '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "04247654321", "cedula": "9876543"}');
    assert false, 'referencia repetida aceptada';
  exception when others then err := sqlerrm;
  end;
  assert err = 'referencia_usada', 'error esperado referencia_usada, vino ' || err;

  -- Unicidad por sufijo (issue #6): otra referencia con la misma terminación de 6 es la misma captura.
  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'pago_movil_ubii', 'AB712283',
                        '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "04247654321", "cedula": "9876543"}');
    assert false, 'misma terminación en el mismo tipo aceptada';
  exception when others then err := sqlerrm;
  end;
  assert err = 'referencia_usada', 'sufijo repetido: error esperado referencia_usada, vino ' || err;

  -- Menos de 6 caracteres tras normalizar no identifican el pago.
  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'pago_movil_ubii', '0-99.999',
                        '22222222-2222-2222-2222-222222222222.png', array['04241234567'], '{"banco": "Banesco", "telefono": "04247654321", "cedula": "9876543"}');
    assert false, 'referencia de 5 caracteres aceptada';
  exception when others then err := sqlerrm;
  end;
  assert err = 'referencia_invalida', 'referencia corta: error esperado referencia_invalida, vino ' || err;

  -- La misma cifra (y la misma terminación) en otro método es otra referencia.
  r := crear_orden('Beto', '87654321', '04241234567', 1, 'zelle', '712283',
                   '33333333-3333-3333-3333-333333333333.png', array['04241234567'], '{"titular": " Beto Díaz "}');
  assert (r ->> 'numero') is not null, 'misma terminación en otro tipo rechazada';
  assert (ver_orden((r ->> 'token')::uuid) ->> 'monto_usd_cents')::int = 1500, 'zelle no cobra precio_usd_cents';

  begin
    perform crear_orden('Beto', '87654321', '04241234567', 1, 'binance', '999999',
                        '44444444-4444-4444-4444-444444444444.png', array['04241234567'], '{"id": "beto123"}');
    assert false, 'método inactivo aceptado';
  exception when others then err := sqlerrm;
  end;
  assert err = 'metodo_invalido', 'error esperado metodo_invalido, vino ' || err;

  -- Un WhatsApp por entrada (issue #5): venezolano y extranjeros con código de país.
  r := crear_orden('Caro Ruiz', '11111111', '', 3, 'zelle', 'WA3OKA',
                   '55555555-5555-5555-5555-555555555555.png', array['04141234567', '+1 (305) 555-0100', '+44 20 7946 0958'],
                   '{"titular": "Caro Ruiz"}');
  assert (r ->> 'numero') is not null, '3 WhatsApps válidos no crearon la orden';
  foreach err in array array['dos para tres', 'sin parámetro', 'corto', 'cero no venezolano', 'largo'] loop
    begin
      case err
        when 'dos para tres' then perform crear_orden('Caro', '11111111', '', 3, 'zelle', 'WA3MAL',
          '66666666-6666-6666-6666-666666666666.png', array['04141234567', '04241234567']);
        when 'sin parámetro' then perform crear_orden('Caro', '11111111', '04141234567', 1, 'zelle', 'WA3MAL',
          '66666666-6666-6666-6666-666666666666.png');
        when 'corto' then perform crear_orden('Caro', '11111111', '', 1, 'zelle', 'WA3MAL',
          '66666666-6666-6666-6666-666666666666.png', array['12345']);
        when 'cero no venezolano' then perform crear_orden('Caro', '11111111', '', 1, 'zelle', 'WA3MAL',
          '66666666-6666-6666-6666-666666666666.png', array['0414123456']);
        when 'largo' then perform crear_orden('Caro', '11111111', '', 1, 'zelle', 'WA3MAL',
          '66666666-6666-6666-6666-666666666666.png', array['5841412345678901']);
      end case;
      assert false, 'WhatsApp inválido aceptado: ' || err;
    exception when raise_exception then
      assert sqlerrm = 'whatsapp_invalido', err || ': error esperado whatsapp_invalido, vino ' || sqlerrm;
    end;
  end loop;

  assert (select count(*) from ordenes) = 0, 'anon puede leer ordenes';
  assert (datos_venta() -> 'metodos' -> 'binance') is null, 'datos_venta muestra método inactivo';
end $$;

reset role;

-- Rama Binance de p_pagador: solo el ID o nickname, como texto.
update config set metodos = metodos || jsonb_build_object('binance', coalesce(metodos -> 'binance', '{}') || '{"activo": true}');
set local role anon;
do $$
declare r json; err text;
begin
  r := crear_orden('Beto', '87654321', '', 1, 'binance', 'BNB712283',
                   '44444444-4444-4444-4444-444444444444.png', array['04241234567'], '{"id": " BetoDJ ", "cedula": "se descarta"}');
  assert (r ->> 'numero') is not null, 'Binance con ID no creó la orden';
  foreach err in array array['{"id": ["BetoDJ"]}', '{"id": "B"}', '{"nickname": "BetoDJ"}'] loop
    begin
      perform crear_orden('Beto', '87654321', '', 1, 'binance', 'BNBMAL1',
                          '44444444-4444-4444-4444-444444444444.png', array['04241234567'], err::jsonb);
      assert false, 'pagador de Binance inválido aceptado: ' || err;
    exception when raise_exception then
      assert sqlerrm = 'pagador_invalido', err || ': error esperado pagador_invalido, vino ' || sqlerrm;
    end;
  end loop;
end $$;
reset role;
do $$
begin
  assert (select pagador from ordenes where referencia = 'BNB712283') = '{"id": "BetoDJ"}'::jsonb, 'pagador de Binance';
end $$;

do $$
declare o ordenes; z ordenes; err text; e json;
begin
  select * into o from ordenes where metodo = 'pago_movil_bnc' and referencia = '712283';
  select * into z from ordenes where metodo = 'zelle' and referencia = '712283';
  assert ver_entrada(gen_random_uuid()) is null, 'ver_entrada con token inexistente';
  -- Sufijo generado; la terminación leída por la IA no sale por las RPC anónimas.
  assert o.sufijo = '712283', 'sufijo generado: ' || coalesce(o.sufijo, 'null');
  assert o.pagador = '{"banco": "Mercantil", "telefono": "584147654321", "cedula": "V9876543"}'::jsonb,
    'pagador de pago móvil sin normalizar o con claves de más: ' || o.pagador::text;
  assert z.pagador = '{"titular": "Beto Díaz"}'::jsonb, 'pagador de Zelle: ' || coalesce(z.pagador::text, 'null');
  update ordenes set ocr_sufijo = 'ZZ9999' where id = o.id;
  execute 'set local role anon';
  assert ver_orden(o.token)::text not like '%ocr_sufijo%' and ver_orden(o.token)::text not like '%ZZ9999%', 'ver_orden expone ocr_sufijo';
  execute 'reset role';
  perform resolver_orden(o.id, true);
  assert (select count(*) from entradas where orden_id = o.id) = 2, 'aprobar no creó 2 entradas';
  assert json_array_length(ver_orden(o.token) -> 'entradas') = 2, 'ver_orden no muestra QR aprobada';
  e := ver_entrada((ver_orden(o.token) -> 'entradas' -> 1 ->> 'token')::uuid);
  assert (e ->> 'posicion') = '2' and (e ->> 'total') = '2' and (e ->> 'numero') = o.numero::text, 'ver_entrada posición: ' || e::text;
  assert e::text not like '%Ana%' and e::text not like '%V12345678%' and e::text not like '%ZZ9999%'
     and e::text not like '%9876543%' and e::text not like '%Mercantil%', 'ver_entrada expone datos personales';

  -- WhatsApp por entrada (issue #5): normalizado, el primero también en telefono, por posición al aprobar.
  assert o.whatsapps = array['584141234567', '584241112233'] and o.telefono = '584141234567',
    'whatsapps no normalizados: ' || o.whatsapps::text || ' / ' || o.telefono;
  assert (e ->> 'whatsapp_mascara') = '2233', 'la entrada 2 no lleva whatsapps[2]: ' || e::text;
  assert ver_orden(o.token) -> 'entradas' -> 0 ->> 'whatsapp_mascara' = '4567'
     and ver_orden(o.token) -> 'entradas' -> 1 ->> 'whatsapp_mascara' = '2233', 'ver_orden sin máscara por posición';
  assert (ver_orden(o.token) -> 'entradas' -> 0 -> 'avisada_en')::text = 'null', 'entrada nueva nace avisada';
  assert ver_orden(o.token)::text not like '%4141234567%' and ver_orden(o.token)::text not like '%4241112233%'
     and e::text not like '%4241112233%', 'el número completo sale por una RPC anónima';
  perform resolver_orden(z.id, false, '  No llegó el pago  ');
  assert (ver_orden(z.token) ->> 'rechazo_motivo') = 'No llegó el pago', 'rechazo sin motivo';
  assert ver_entrada(gen_random_uuid()) is null, 'ver_entrada de orden no aprobada';
  begin
    perform resolver_orden(o.id, false);
    assert false, 'orden resuelta dos veces';
  exception when others then err := sqlerrm;
  end;
  assert err = 'orden_ya_resuelta', 'error esperado orden_ya_resuelta, vino ' || err;
  -- Quién aprobó (issue #5, ticket 02): el panel no pasa el parámetro → 'admin'; rechazo → nadie.
  assert (select aprobada_por from ordenes where id = o.id) = 'admin', 'aprobación del panel sin aprobada_por = admin';
  assert (select aprobada_por from ordenes where id = z.id) is null, 'un rechazo quedó con aprobada_por';
end $$;

-- `revisar` aprueba con service role y marca 'ia'.
set local role service_role;
do $$
begin
  perform resolver_orden((select id from ordenes where referencia = 'WA3OKA'), true, null, 'ia');
end $$;
reset role;
do $$
begin
  assert (select aprobada_por from ordenes where referencia = 'WA3OKA') = 'ia', 'la aprobación de la IA no quedó marcada';
end $$;

-- Check-in del portero (issue #4).
do $$
declare o ordenes; t1 uuid; t2 uuid; tr uuid; r0 json; r1 json; r2 json; err text; l json; h timestamptz;
begin
  select * into o from ordenes where metodo = 'pago_movil_bnc' and referencia = '712283';
  t1 := ver_orden(o.token) -> 'entradas' -> 0 ->> 'token';
  t2 := ver_orden(o.token) -> 'entradas' -> 1 ->> 'token';
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

  -- Hora local del check-in sin señal: se respeta dentro de [ahora - 1 día, ahora].
  r1 := checkin_entrada(t2, now() - interval '10 minutes');
  assert (r1 ->> 'checked_in_at')::timestamptz = now() - interval '10 minutes', 'hora local no respetada: ' || r1::text;
  update entradas set checked_in_at = null where token = t2;
  r1 := checkin_entrada(t2, now() + interval '1 hour');
  assert (r1 ->> 'checked_in_at')::timestamptz = now(), 'hora futura no acotada: ' || r1::text;
  update entradas set checked_in_at = null where token = t2;
  r1 := checkin_entrada(t2, now() - interval '3 days');
  assert (r1 ->> 'checked_in_at')::timestamptz = now() - interval '1 day', 'hora vieja no acotada: ' || r1::text;
  update entradas set checked_in_at = null where token = t2;

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
  assert l::text not like '%Ana%' and l::text not like '%V12345678%' and l::text not like '%04141234567%' and l::text not like '%ZZ9999%'
     and l::text not like '%9876543%' and l::text not like '%Mercantil%', 'lista expone datos personales';
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
do $$
begin
  perform avisos_pendientes();
  assert false, 'anon puede bajar los WhatsApp pendientes de aviso';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform reenviar_aviso(gen_random_uuid(), '04141234567');
  assert false, 'anon puede redirigir una entrada a otro WhatsApp';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform marcar_aviso(gen_random_uuid(), true);
  assert false, 'anon puede marcar avisos';
exception when insufficient_privilege then null;
end $$;
-- Lecturas del OCR (issue #7): solo la función `lectura` (service role) las toca.
do $$
begin
  perform * from lecturas;
  assert false, 'anon puede leer lecturas';
exception when insufficient_privilege then null;
end $$;
-- Totales de venta (issue #3): solo `pm` con service role.
do $$
begin
  perform resumen_ticketera();
  assert false, 'anon puede leer los totales de la ticketera';
exception when insufficient_privilege then null;
end $$;
reset role;
set local role authenticated;
do $$
begin
  perform resumen_ticketera();
  assert false, 'authenticated puede leer los totales de la ticketera';
exception when insufficient_privilege then null;
end $$;
reset role;
do $$
begin
  assert not has_function_privilege('anon', 'reservar_lectura(text, text)', 'execute')
     and not has_function_privilege('authenticated', 'reservar_lectura(text, text)', 'execute'), 'anon o authenticated pueden reservar lecturas';
  assert has_function_privilege('service_role', 'reservar_lectura(text, text)', 'execute')
     and has_table_privilege('service_role', 'lecturas', 'insert'), 'la función lectura (service role) no puede reservar';
end $$;

-- reservar_lectura, como la llama la función `lectura` (service role): una lectura por path, 10 por IP
-- y 200 en total por hora. Se parte de una tabla vacía (la transacción se deshace al final).
delete from lecturas;
set local role service_role;
do $$
begin
  assert reservar_lectura('lec-a.png', 'ip-prueba') ->> 'estado' = 'nueva', 'primera reserva';
  assert reservar_lectura('lec-a.png', 'ip-prueba') ->> 'estado' = 'pendiente', 'reserva sin OCR no quedó pendiente';
  update lecturas set ocr = '{"reference": "61540227"}' where path = 'lec-a.png';
  assert reservar_lectura('lec-a.png', 'otra-ip') ->> 'estado' = 'guardada', 'path leído no devuelve la guardada';
  assert reservar_lectura('lec-a.png', 'otra-ip') -> 'ocr' ->> 'reference' = '61540227', 'la guardada sin ocr';
  -- Por IP: la 10 pasa, la 11 no.
  insert into lecturas (path, ip, ocr) select 'lec-ip-' || g, 'ip-prueba', '{}' from generate_series(1, 8) g;
  assert reservar_lectura('lec-b.png', 'ip-prueba') ->> 'estado' = 'nueva', 'la lectura 10 de una IP no pasó';
  assert reservar_lectura('lec-c.png', 'ip-prueba') ->> 'estado' = 'limite', 'la lectura 11 de una IP pasó el límite';
  assert reservar_lectura('lec-c.png', 'ip-otra') ->> 'estado' = 'nueva', 'el límite de una IP frenó a otra';
  -- La ventana es de una hora: 10 lecturas de hace 61 minutos no frenan a esa IP.
  insert into lecturas (path, ip, ocr, creada_en) select 'lec-vieja-' || g, 'ip-vieja', '{}', now() - interval '61 minutes' from generate_series(1, 10) g;
  assert reservar_lectura('lec-d.png', 'ip-vieja') ->> 'estado' = 'nueva', 'lecturas de hace más de una hora cuentan';
  -- Una reserva sin OCR de hace 3 minutos admite reintento: la misma fila vuelve a contar desde ahora.
  update lecturas set creada_en = now() - interval '3 minutes' where path = 'lec-d.png';
  assert reservar_lectura('lec-d.png', 'ip-vieja') ->> 'estado' = 'nueva', 'reserva colgada no admite reintento';
  assert (select creada_en from lecturas where path = 'lec-d.png') = now(), 'el reintento no volvió a contar';
  -- Las reservas fallidas siguen contando: 10 sin OCR de hace 3 minutos frenan a esa IP.
  insert into lecturas (path, ip, creada_en) select 'lec-fallida-' || g, 'ip-fallida', now() - interval '3 minutes' from generate_series(1, 10) g;
  assert reservar_lectura('lec-g.png', 'ip-fallida') ->> 'estado' = 'limite', 'las lecturas fallidas dejaron de contar';
  -- Total: se completa a 199 en la última hora; la 200 pasa y la 201 no.
  insert into lecturas (path, ip, ocr) select 'lec-tot-' || g, 'ip-' || g, '{}'
    from generate_series(1, 199 - (select count(*) from lecturas where creada_en > now() - interval '1 hour')) g;
  assert reservar_lectura('lec-e.png', 'ip-nueva') ->> 'estado' = 'nueva', 'la lectura 200 del total no pasó';
  assert reservar_lectura('lec-f.png', 'ip-nueva-2') ->> 'estado' = 'limite', 'la lectura 201 del total pasó el tope';
  -- Lo de más de un día se borra al reservar.
  insert into lecturas (path, ip, ocr, creada_en) values ('lec-antigua.png', 'ip-x', '{}', now() - interval '25 hours');
  perform reservar_lectura('lec-a.png', 'otra-ip');
  assert not exists (select 1 from lecturas where path = 'lec-antigua.png'), 'una lectura de más de un día no se borró';
end $$;
reset role;

select 'OK ticketera.sql: ' || count(*) || ' órdenes creadas' from ordenes;
rollback;
