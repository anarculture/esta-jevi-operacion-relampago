-- WhatsApp por entrada y avisos por vytas (issue #5, ticket 01). Va después de la del
-- portero (20261027000000) y no depende de ella. La entrada sigue identificada por su token.

alter table ordenes
  add column whatsapps text[],
  add column aprobada_por text check (aprobada_por in ('ia', 'admin'));

alter table entradas
  add column whatsapp text,
  add column avisada_en timestamptz,
  add column aviso_error text,
  add column aviso_intentos int not null default 0;

alter table config add column auto_aprobar boolean not null default true;

-- Las entradas ya emitidas nunca reciben aviso.
update entradas set avisada_en = now() where avisada_en is null;

-- Dígitos; venezolano 0 + 10 dígitos → 58 + 10; con código de país, 10 a 15 dígitos tal cual.
-- Null si no vale. Misma regla que normalizarWhatsapp en ticketera/comun.js.
create function normalizar_whatsapp(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^0\d{10}$' then '58' || substr(d, 2)
    when d ~ '^[1-9]\d{9,14}$' then d
  end
  from regexp_replace(coalesce(p, ''), '\D', '', 'g') as d
$$;

-- p_whatsapps: uno por entrada, el primero es el del comprador (queda también en telefono).
-- p_telefono ya no se usa: se conserva en la firma para no romper el contrato de la RPC.
drop function crear_orden(text, text, text, int, text, text, text);
create function crear_orden(
  p_nombre text, p_cedula text, p_telefono text, p_cantidad int,
  p_metodo text, p_referencia text, p_captura text, p_whatsapps text[] default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  c config;
  o ordenes;
  v_cedula text := upper(regexp_replace(coalesce(p_cedula, ''), '[^VvEe0-9]', '', 'g'));
  v_ref text := normalizar_referencia(p_referencia);
  v_pm boolean := p_metodo like 'pago_movil%';
  v_was text[];
begin
  select * into c from config where id = 1;
  if length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then raise exception 'nombre_invalido'; end if;
  if v_cedula !~ '^[VE]?\d{5,9}$' then raise exception 'cedula_invalida'; end if;
  if v_cedula ~ '^\d' then v_cedula := 'V' || v_cedula; end if;
  if coalesce(array_length(p_whatsapps, 1), 0) <> coalesce(p_cantidad, -1) then
    raise exception 'whatsapp_invalido' using detail = 'faltan o sobran: uno por entrada';
  end if;
  for k in 1 .. p_cantidad loop
    v_was[k] := normalizar_whatsapp(p_whatsapps[k]);
    if v_was[k] is null then raise exception 'whatsapp_invalido' using detail = k::text; end if;
  end loop;
  if not coalesce((c.metodos -> p_metodo ->> 'activo')::boolean, false) then raise exception 'metodo_invalido'; end if;
  if length(v_ref) < 4 then raise exception 'referencia_invalida'; end if;
  if p_captura !~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then raise exception 'captura_invalida'; end if;
  if v_pm and (c.tasa_eur is null or c.tasa_consultada_en < now() - interval '12 hours') then
    raise exception 'tasa_vencida';
  end if;

  insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs)
  values (
    trim(p_nombre), v_cedula, v_was[1], v_was, p_cantidad, p_metodo, v_ref, p_captura, p_cantidad * c.precio_usd_cents,
    case when v_pm then c.tasa_eur end,
    case when v_pm then round(p_cantidad * c.precio_pm_eur_cents / 100.0 * c.tasa_eur, 2) end
  )
  returning * into o;

  return json_build_object('numero', o.numero, 'token', o.token);
exception
  when unique_violation then raise exception 'referencia_usada';
end;
$$;

-- La posición de una entrada es su orden por id (como en ver_entrada): la k-ésima recibe whatsapps[k].
-- Sin WhatsApp (orden manual vieja) nace avisada: nunca se le escribe.
create or replace function resolver_orden(p_id uuid, p_aprobar boolean, p_motivo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  update ordenes set estado = case when p_aprobar then 'aprobada' else 'rechazada' end, resuelta_en = now(),
    rechazo_motivo = case when p_aprobar then null else left(trim(p_motivo), 200) end
  where id = p_id and estado = 'en_revision'
  returning * into o;
  if o.id is null then raise exception 'orden_ya_resuelta'; end if;
  if p_aprobar then
    insert into entradas (id, orden_id, whatsapp, avisada_en)
    select id, o.id, o.whatsapps[k], case when o.whatsapps[k] is null then now() end
    from (select id, row_number() over (order by id)::int as k
          from (select gen_random_uuid() as id from generate_series(1, o.cantidad)) g) s;
  end if;
  return json_build_object('numero', o.numero, 'estado', o.estado);
end;
$$;

-- El número completo nunca sale por aquí: solo los últimos 4 dígitos.
create or replace function ver_orden(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero, 'estado', o.estado, 'nombre', o.nombre, 'cedula', o.cedula,
    'cantidad', o.cantidad, 'metodo', o.metodo, 'referencia', o.referencia,
    'monto_usd_cents', o.monto_usd_cents, 'monto_bs', o.monto_bs, 'creada_en', o.creada_en,
    'rechazo_motivo', o.rechazo_motivo,
    'entradas', case when o.estado = 'aprobada' then
      (select json_agg(json_build_object('token', e.token, 'whatsapp_mascara', right(e.whatsapp, 4),
         'avisada_en', e.avisada_en) order by e.id) from entradas e where e.orden_id = o.id) end
  ) from ordenes o where o.token = p_token
$$;

create or replace function ver_entrada(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id),
    'whatsapp_mascara', right(e.whatsapp, 4)
  )
  from entradas e join ordenes o on o.id = e.orden_id
  where e.token = p_token and o.estado = 'aprobada'
$$;

revoke execute on all functions in schema public from public;
grant execute on function datos_venta(), crear_orden(text, text, text, int, text, text, text, text[]), ver_orden(uuid), ver_entrada(uuid)
  to anon, authenticated;
revoke execute on function resolver_orden(uuid, boolean, text), normalizar_whatsapp(text) from anon, authenticated;
