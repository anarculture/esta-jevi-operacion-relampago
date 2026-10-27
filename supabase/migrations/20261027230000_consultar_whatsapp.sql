-- `consultar` de la función `avisos` (PM_CLAVE): órdenes donde aparece un WhatsApp y los datos del
-- aviso de cada entrada aprobada atada a él (el texto lo arma textoAviso). Solo lectura: no toca
-- avisada_en ni los intentos. Solo service role; el número completo nunca sale por anon.
create function consultar_whatsapp(p_whatsapp text) returns json
language plpgsql stable security definer set search_path = public as $$
declare v text := normalizar_whatsapp(p_whatsapp);
begin
  if v is null then raise exception 'whatsapp_invalido'; end if;
  return json_build_object(
    'ordenes', (select coalesce(json_agg(json_build_object('numero', o.numero, 'estado', o.estado,
        'cantidad', o.cantidad, 'nombre', o.nombre, 'comprador', coalesce(o.whatsapps[1] = v, false))
        order by o.creada_en desc, o.numero desc), '[]')
      from (select * from ordenes o
            -- whatsapps es lo que escribió el comprador; entradas.whatsapp, lo corregido desde el panel.
            where v = any(o.whatsapps) or o.id in (select orden_id from entradas where whatsapp = v)
            order by o.creada_en desc, o.numero desc limit 10) o),
    -- La posición se calcula sobre todas las entradas de la orden (como avisos_pendientes).
    'entradas', (select coalesce(json_agg(json_build_object('token', x.token, 'orden_token', x.orden_token,
        'numero', x.numero, 'posicion', x.posicion, 'total', x.total)
        order by x.creada_en desc, x.numero desc, x.posicion), '[]')
      from (select * from (
              select e.token, e.whatsapp, o.numero, o.token as orden_token, o.cantidad as total, o.creada_en,
                row_number() over (partition by e.orden_id order by e.id) as posicion
              from entradas e join ordenes o on o.id = e.orden_id
              where o.estado = 'aprobada' and o.id in (select orden_id from entradas where whatsapp = v)
            ) y where y.whatsapp = v
            order by y.creada_en desc, y.numero desc, y.posicion limit 10) x)
  );
end;
$$;

revoke execute on function consultar_whatsapp(text) from public, anon, authenticated;
