-- Check-in sin señal: la cola sube la hora en que el portero validó, no la de la subida.
-- Se acota a [ahora - 1 día, ahora] para que un reloj mal puesto no deje ingresos en el futuro.
create or replace function checkin_entrada(p_token uuid, p_hora timestamptz default null) returns json
language plpgsql security definer set search_path = public as $$
declare e entradas; o ordenes;
begin
  update entradas set checked_in_at = least(greatest(coalesce(p_hora, now()), now() - interval '1 day'), now())
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
drop function checkin_entrada(uuid);
revoke execute on function checkin_entrada(uuid, timestamptz) from public, anon, authenticated;
