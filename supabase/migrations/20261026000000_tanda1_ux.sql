-- Tanda 1 de UX (docs/spec-ux-ticketera.md): pago móvil se cobra en euros a tasa
-- BCV del euro, cada entrada tiene su propia página, y el rechazo lleva motivo.

alter table config
  add column precio_pm_eur_cents int not null default 1000,
  add column tasa_eur numeric(14, 4),
  add column tasa_eur_fecha date;

alter table ordenes add column rechazo_motivo text;

create or replace function datos_venta() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'precio_usd_cents', c.precio_usd_cents,
    'precio_pm_eur_cents', c.precio_pm_eur_cents,
    'tasa_eur', c.tasa_eur,
    'tasa_eur_fecha', c.tasa_eur_fecha,
    'metodos', (select coalesce(json_object_agg(k, v), '{}') from jsonb_each(c.metodos) as m(k, v)
                where (v ->> 'activo')::boolean)
  ) from config c
$$;

-- Pago móvil: precio en euros a tasa BCV del euro. monto_usd_cents sigue siendo el
-- nominal en dólares de la entrada, para los totales del panel.
create or replace function crear_orden(
  p_nombre text, p_cedula text, p_telefono text, p_cantidad int,
  p_metodo text, p_referencia text, p_captura text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  c config;
  o ordenes;
  v_cedula text := upper(regexp_replace(coalesce(p_cedula, ''), '[^VvEe0-9]', '', 'g'));
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_ref text := normalizar_referencia(p_referencia);
  v_pm boolean := p_metodo like 'pago_movil%';
begin
  select * into c from config where id = 1;
  if length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then raise exception 'nombre_invalido'; end if;
  if v_cedula !~ '^[VE]?\d{5,9}$' then raise exception 'cedula_invalida'; end if;
  if v_cedula ~ '^\d' then v_cedula := 'V' || v_cedula; end if;
  if length(v_tel) not between 10 and 13 then raise exception 'telefono_invalido'; end if;
  if not coalesce((c.metodos -> p_metodo ->> 'activo')::boolean, false) then raise exception 'metodo_invalido'; end if;
  if length(v_ref) < 4 then raise exception 'referencia_invalida'; end if;
  if p_captura !~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then raise exception 'captura_invalida'; end if;
  if v_pm and (c.tasa_eur is null or c.tasa_consultada_en < now() - interval '12 hours') then
    raise exception 'tasa_vencida';
  end if;

  insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs)
  values (
    trim(p_nombre), v_cedula, v_tel, p_cantidad, p_metodo, v_ref, p_captura, p_cantidad * c.precio_usd_cents,
    case when v_pm then c.tasa_eur end,
    case when v_pm then round(p_cantidad * c.precio_pm_eur_cents / 100.0 * c.tasa_eur, 2) end
  )
  returning * into o;

  return json_build_object('numero', o.numero, 'token', o.token);
exception
  when unique_violation then raise exception 'referencia_usada';
end;
$$;

create or replace function ver_orden(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero, 'estado', o.estado, 'nombre', o.nombre, 'cedula', o.cedula,
    'cantidad', o.cantidad, 'metodo', o.metodo, 'referencia', o.referencia,
    'monto_usd_cents', o.monto_usd_cents, 'monto_bs', o.monto_bs, 'creada_en', o.creada_en,
    'rechazo_motivo', o.rechazo_motivo,
    'entradas', case when o.estado = 'aprobada' then
      (select json_agg(e.token order by e.id) from entradas e where e.orden_id = o.id) end
  ) from ordenes o where o.token = p_token
$$;

-- Una sola entrada, para el amigo que recibió el enlace: nada personal del comprador.
create function ver_entrada(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero, 'total', o.cantidad,
    'posicion', (select count(*) from entradas e2 where e2.orden_id = o.id and e2.id <= e.id)
  )
  from entradas e join ordenes o on o.id = e.orden_id
  where e.token = p_token and o.estado = 'aprobada'
$$;

drop function resolver_orden(uuid, boolean);
create function resolver_orden(p_id uuid, p_aprobar boolean, p_motivo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  update ordenes set estado = case when p_aprobar then 'aprobada' else 'rechazada' end, resuelta_en = now(),
    rechazo_motivo = case when p_aprobar then null else left(trim(p_motivo), 200) end
  where id = p_id and estado = 'en_revision'
  returning * into o;
  if o.id is null then raise exception 'orden_ya_resuelta'; end if;
  if p_aprobar then
    insert into entradas (orden_id) select o.id from generate_series(1, o.cantidad);
  end if;
  return json_build_object('numero', o.numero, 'estado', o.estado);
end;
$$;

revoke execute on all functions in schema public from public;
grant execute on function datos_venta(), crear_orden(text, text, text, int, text, text, text), ver_orden(uuid), ver_entrada(uuid)
  to anon, authenticated;
revoke execute on function resolver_orden(uuid, boolean, text) from anon, authenticated;
