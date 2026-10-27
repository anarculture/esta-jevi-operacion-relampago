-- Datos del pagador (issue #6, punto 2): desde dónde pagó el comprador. Son las llaves con las que
-- Mau busca el pago en la app del banco. Solo los ve el panel (función admin, con ADMIN_CLAVE):
-- ver_orden, ver_entrada, el portero y los avisos no los devuelven.
--   pago móvil: { banco, telefono (58…), cedula (V…/E…) } · Zelle: { titular } · Binance: { id }

alter table ordenes add column pagador jsonb;

-- Igual que en 20261027210000_sufijo_referencia.sql, más p_pagador. Se borra la firma de 8 argumentos:
-- con dos sobrecargas, PostgREST no sabría a cuál llamar con argumentos por nombre.
drop function crear_orden(text, text, text, int, text, text, text, text[]);
create function crear_orden(
  p_nombre text, p_cedula text, p_telefono text, p_cantidad int,
  p_metodo text, p_referencia text, p_captura text, p_whatsapps text[] default null,
  p_pagador jsonb default null
) returns json
language plpgsql security definer set search_path = public as $$
declare
  c config;
  o ordenes;
  v_cedula text := upper(regexp_replace(coalesce(p_cedula, ''), '[^VvEe0-9]', '', 'g'));
  v_ref text := normalizar_referencia(p_referencia);
  v_pm boolean := p_metodo like 'pago_movil%';
  v_was text[];
  v_pag jsonb;
  v_pag_ced text := upper(regexp_replace(coalesce(p_pagador ->> 'cedula', ''), '[^VvEe0-9]', '', 'g'));
  v_pag_tel text := normalizar_whatsapp(p_pagador ->> 'telefono');
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

  -- Solo las claves del tipo, normalizadas; cualquier otra clave se descarta.
  if jsonb_typeof(p_pagador) is distinct from 'object' then raise exception 'pagador_invalido'; end if;
  -- Cada clave del tipo es texto JSON: {"banco": 12} o {"id": ["a"]} no pasan.
  if exists (select 1 from unnest(case when v_pm then array['banco', 'telefono', 'cedula']
                                       when p_metodo = 'zelle' then array['titular'] else array['id'] end) k
             where jsonb_typeof(p_pagador -> k) is distinct from 'string') then
    raise exception 'pagador_invalido' using detail = 'tipos';
  end if;
  if v_pm then
    if length(trim(coalesce(p_pagador ->> 'banco', ''))) not between 2 and 80 then
      raise exception 'pagador_invalido' using detail = 'banco';
    end if;
    -- Pago móvil: solo teléfonos venezolanos (58 + 10 dígitos).
    if coalesce(v_pag_tel, '') !~ '^58\d{10}$' then raise exception 'pagador_invalido' using detail = 'telefono'; end if;
    if v_pag_ced !~ '^[VE]?\d{5,9}$' then raise exception 'pagador_invalido' using detail = 'cedula'; end if;
    if v_pag_ced ~ '^\d' then v_pag_ced := 'V' || v_pag_ced; end if;
    v_pag := jsonb_build_object('banco', trim(p_pagador ->> 'banco'), 'telefono', v_pag_tel, 'cedula', v_pag_ced);
  elsif p_metodo = 'zelle' then
    if length(trim(coalesce(p_pagador ->> 'titular', ''))) not between 2 and 80 then
      raise exception 'pagador_invalido' using detail = 'titular';
    end if;
    v_pag := jsonb_build_object('titular', trim(p_pagador ->> 'titular'));
  else
    if length(trim(coalesce(p_pagador ->> 'id', ''))) not between 2 and 80 then
      raise exception 'pagador_invalido' using detail = 'id';
    end if;
    v_pag := jsonb_build_object('id', trim(p_pagador ->> 'id'));
  end if;

  if length(v_ref) < 6 then raise exception 'referencia_invalida'; end if;
  if p_captura !~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then raise exception 'captura_invalida'; end if;
  if v_pm and (c.tasa_eur is null or c.tasa_consultada_en < now() - interval '12 hours') then
    raise exception 'tasa_vencida';
  end if;

  insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs, pagador)
  values (
    trim(p_nombre), v_cedula, v_was[1], v_was, p_cantidad, p_metodo, v_ref, p_captura, p_cantidad * c.precio_usd_cents,
    case when v_pm then c.tasa_eur end,
    case when v_pm then round(p_cantidad * c.precio_pm_eur_cents / 100.0 * c.tasa_eur, 2) end,
    v_pag
  )
  returning * into o;

  return json_build_object('numero', o.numero, 'token', o.token);
exception
  when unique_violation then raise exception 'referencia_usada';
end;
$$;

revoke execute on function crear_orden(text, text, text, int, text, text, text, text[], jsonb) from public;
grant execute on function crear_orden(text, text, text, int, text, text, text, text[], jsonb) to anon, authenticated;
