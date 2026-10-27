-- Avisos por WhatsApp (issue #5, ticket 03). Solo las Edge Functions `avisos` (vytas, PM_CLAVE) y
-- `admin` (panel, ADMIN_CLAVE) las llaman con service role: ninguna tiene grant a anon.

-- Pendientes de aviso. La posición se calcula sobre todas las entradas de la orden (como ver_entrada).
create function avisos_pendientes() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', x.id, 'whatsapp', x.whatsapp, 'token', x.token, 'numero', x.numero, 'orden_token', x.orden_token,
    'posicion', x.posicion, 'total', x.total) order by x.numero, x.posicion), '[]')
  from (
    select e.id, e.whatsapp, e.token, e.avisada_en, e.aviso_intentos, o.numero, o.token as orden_token, o.cantidad as total,
      row_number() over (partition by e.orden_id order by e.id) as posicion
    from entradas e join ordenes o on o.id = e.orden_id
    where o.estado = 'aprobada'
  ) x
  where x.whatsapp is not null and x.avisada_en is null and x.aviso_intentos < 5
$$;

-- Resultado de un envío. Un ok sobre una ya avisada no cambia nada; un error solo cuenta si aún no se avisó.
create function marcar_aviso(p_id uuid, p_ok boolean, p_error text default null) returns json
language plpgsql security definer set search_path = public as $$
declare e entradas;
begin
  if p_ok then
    update entradas set avisada_en = coalesce(avisada_en, now()) where id = p_id returning * into e;
  else
    update entradas set aviso_error = left(coalesce(nullif(trim(p_error), ''), 'sin detalle'), 200),
      aviso_intentos = aviso_intentos + 1
    where id = p_id and avisada_en is null returning * into e;
    if e.id is null then select * into e from entradas where id = p_id; end if;
  end if;
  if e.id is null then raise exception 'entrada_no_existe'; end if;
  return json_build_object('id', e.id, 'avisada_en', e.avisada_en, 'aviso_intentos', e.aviso_intentos);
end;
$$;

-- Desde el panel: corrige el número si viene y vuelve a poner la entrada en la cola de avisos.
create function reenviar_aviso(p_id uuid, p_whatsapp text default null) returns json
language plpgsql security definer set search_path = public as $$
declare v text := normalizar_whatsapp(p_whatsapp); e entradas;
begin
  if p_whatsapp is not null and trim(p_whatsapp) <> '' and v is null then raise exception 'whatsapp_invalido'; end if;
  update entradas set whatsapp = coalesce(v, whatsapp), avisada_en = null, aviso_error = null, aviso_intentos = 0
  where id = p_id returning * into e;
  if e.id is null then raise exception 'entrada_no_existe'; end if;
  return json_build_object('id', e.id, 'whatsapp_mascara', right(e.whatsapp, 4));
end;
$$;

revoke execute on function avisos_pendientes(), marcar_aviso(uuid, boolean, text), reenviar_aviso(uuid, text)
  from public, anon, authenticated;
