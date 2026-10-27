-- Check-in del portero (issue #4). Solo la Edge Function `portero` (service role) llama a
-- estas funciones: ninguna tiene grant a anon ni authenticated, igual que resolver_orden.
-- `entradas` no cambia de forma: el check-in escribe la columna checked_in_at que ya existía.

-- Lo que el portero ve de una entrada válida o ya usada. Misma posición que ver_entrada.
create function _portero_entrada(e entradas, o ordenes, p_resultado text) returns json
language sql stable set search_path = public as $$
  select json_build_object(
    'resultado', p_resultado, 'token', e.token, 'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id),
    'checked_in_at', e.checked_in_at)
$$;

-- Un solo update atómico: con dos porteros a la vez, el segundo espera el lock de la fila,
-- re-evalúa `checked_in_at is null` y no actualiza, así que recibe `ya_usada`.
create function checkin_entrada(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare e entradas; o ordenes;
begin
  update entradas set checked_in_at = now()
  where token = p_token and checked_in_at is null
    and orden_id in (select id from ordenes where estado = 'aprobada')
  returning * into e;
  if found then
    select * into o from ordenes where id = e.orden_id;
    return _portero_entrada(e, o, 'valida');
  end if;

  select * into e from entradas where token = p_token;
  if e.id is null then return json_build_object('resultado', 'invalida', 'motivo', 'no_existe'); end if;
  select * into o from ordenes where id = e.orden_id;
  if o.estado <> 'aprobada' then return json_build_object('resultado', 'invalida', 'motivo', 'no_aprobada'); end if;
  return _portero_entrada(e, o, 'ya_usada');
end;
$$;

-- Deshacer solo dentro de los 5 minutos del check-in; lo demás se corrige a mano por SQL.
create function deshacer_checkin(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  update entradas set checked_in_at = null
  where token = p_token and checked_in_at > now() - interval '5 minutes';
  return json_build_object('ok', found);
end;
$$;

-- Código de respaldo = 8 primeros caracteres del token. Null si no existe; más de uno, error.
create function token_por_codigo(p_codigo text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_codigo text := lower(trim(coalesce(p_codigo, ''))); v_tokens uuid[];
begin
  if v_codigo !~ '^[0-9a-f]{8}$' then return null; end if;
  -- ponytail: scan secuencial sin índice; basta para cientos de entradas, indexar token::text si pasan de ~50 mil.
  select array_agg(token) into v_tokens from entradas where token::text like v_codigo || '%';
  if cardinality(v_tokens) > 1 then raise exception 'codigo_ambiguo'; end if;
  return v_tokens[1];
end;
$$;

-- Lista de respaldo para validar sin señal: sin nombre, cédula ni teléfono.
create function lista_portero() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('generada_en', now(), 'entradas', coalesce(json_agg(json_build_object(
    'token', e.token, 'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id),
    'checked_in_at', e.checked_in_at) order by e.token), '[]'))
  from entradas e join ordenes o on o.id = e.orden_id
  where o.estado = 'aprobada'
$$;

create function resumen_portero() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('aprobadas', count(*), 'ingresadas', count(e.checked_in_at))
  from entradas e join ordenes o on o.id = e.orden_id
  where o.estado = 'aprobada'
$$;

revoke execute on function _portero_entrada(entradas, ordenes, text), checkin_entrada(uuid), deshacer_checkin(uuid),
  token_por_codigo(text), lista_portero(), resumen_portero()
  from public, anon, authenticated;
