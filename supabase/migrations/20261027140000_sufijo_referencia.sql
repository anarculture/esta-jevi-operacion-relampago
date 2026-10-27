-- Unicidad por sufijo de la referencia (issue #6, punto 1; docs/research/autenticidad-comprobantes.md, rec. 2).
-- Una misma captura ya no se vuelve dos órdenes tipeando la referencia con un dígito de más:
-- la terminación de 6 es única por tipo de pago y crear_orden exige al menos 6 caracteres.
-- `revisar` guarda además la terminación leída por OCR para cotejarla contra las demás órdenes.

alter table ordenes
  add column sufijo text generated always as (right(referencia, 6)) stored,
  add column ocr_sufijo text;

-- Si en producción ya hubiera dos órdenes con la misma terminación, la migración falla y se decide a mano.
do $$
begin
  assert not exists (select 1 from ordenes group by tipo, right(referencia, 6) having count(*) > 1),
    'hay órdenes del mismo tipo con la misma terminación de referencia: resolverlas a mano antes de migrar';
end $$;

alter table ordenes add constraint ordenes_tipo_sufijo_key unique (tipo, sufijo);
create index ordenes_tipo_ocr_sufijo_idx on ordenes (tipo, ocr_sufijo);

-- Igual que en 20261027120000_avisos.sql, salvo el mínimo de 6 caracteres de referencia (antes 4).
-- La unique_violation (por referencia o por sufijo) sigue saliendo como referencia_usada.
create or replace function crear_orden(
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
  if length(v_ref) < 6 then raise exception 'referencia_invalida'; end if;
  if p_captura !~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then raise exception 'captura_invalida'; end if;
  if v_pm and (c.tasa_eur is null or c.tasa_consultada_en < now() - interval '12 hours') then
    raise exception 'tasa_vencida';
  end if;

  insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs)
  values (
    trim(p_nombre), v_cedula, v_was[1], v_was, p_cantidad, p_metodo, v_ref, p_captura, p_cantidad * c.precio_pm_eur_cents,
    case when v_pm then c.tasa_eur end,
    case when v_pm then round(p_cantidad * c.precio_pm_eur_cents / 100.0 * c.tasa_eur, 2) end
  )
  returning * into o;

  return json_build_object('numero', o.numero, 'token', o.token);
exception
  when unique_violation then raise exception 'referencia_usada';
end;
$$;
