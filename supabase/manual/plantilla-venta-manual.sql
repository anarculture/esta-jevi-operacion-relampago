-- Plantilla de venta manual (issue #5): cobrada fuera del flujo, sin cédula ni captura.
-- Copia el archivo, cambia los valores de `v_*` y córrelo una vez. Inserta la orden ya aprobada
-- con una entrada por WhatsApp de `v_whatsapps` (por posición, igual que resolver_orden), y
-- vytas le avisa a cada número. Un null en el arreglo = esa entrada nace avisada y no recibe
-- mensaje. Idempotente: si la referencia ya existe, no inserta nada y solo lista los tokens.
do $$
declare
  v_nombre text := 'Nombre (Instagram)';
  v_metodo text := 'pago_movil_bnc';        -- pago_movil_bnc | pago_movil_ubii | binance | zelle
  v_referencia text := 'MANUALCAMBIAME1';
  v_monto_usd_cents int := 2000;            -- nominal en dólares, para los totales del panel
  v_whatsapps text[] := array['04141234567', null];
  v_was text[];
  v_id uuid;
begin
  if exists (select 1 from ordenes where referencia = v_referencia) then return; end if;
  for k in 1 .. coalesce(array_length(v_whatsapps, 1), 0) loop
    v_was[k] := normalizar_whatsapp(v_whatsapps[k]);
    if v_whatsapps[k] is not null and v_was[k] is null then
      raise exception 'WhatsApp % inválido: %', k, v_whatsapps[k];
    end if;
  end loop;
  insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura,
                       monto_usd_cents, estado, resuelta_en, aprobada_por, dictamen_motivo)
  values (v_nombre, 'V0', coalesce(v_was[1], '0'), v_was, array_length(v_whatsapps, 1), v_metodo, v_referencia,
          'manual.jpg', v_monto_usd_cents, 'aprobada', now(), 'admin', 'venta manual, emitida por Mau')
  returning id into v_id;
  insert into entradas (id, orden_id, whatsapp, avisada_en)
  select id, v_id, v_was[k], case when v_was[k] is null then now() end
  from (select id, row_number() over (order by id)::int as k
        from (select gen_random_uuid() as id from generate_series(1, array_length(v_whatsapps, 1))) g) s;
end $$;

select o.numero, o.token as orden_token, e.token as entrada_token, e.whatsapp, e.avisada_en
from ordenes o join entradas e on e.orden_id = o.id
where o.referencia = 'MANUALCAMBIAME1'
order by e.id;
