-- Corrección del code-review final (ticket 03): una reserva sin OCR ya no se borra a los 2 minutos,
-- porque al borrarse dejaba de contar para los topes (una IP podía reintentar lecturas fallidas muy por
-- encima de 10 por hora). Ahora la fila se conserva: el mismo path puede reintentar pasados 2 minutos si
-- su IP y el total aún tienen cupo, y la fila vuelve a contar desde ese momento. Las lecturas de más de
-- un día se siguen borrando.
create or replace function reservar_lectura(p_path text, p_ip text) returns json
language plpgsql set search_path = public as $$
declare l lecturas;
begin
  perform pg_advisory_xact_lock(hashtext('reservar_lectura'));
  delete from lecturas where creada_en < now() - interval '1 day';
  p_ip := left(p_ip, 64);
  select * into l from lecturas where path = p_path;
  -- Leída, o en curso hace menos de 2 minutos (el OCR corta a los 90 s): no se vuelve a leer.
  if found and (l.ocr is not null or l.creada_en > now() - interval '2 minutes') then
    return json_build_object('estado', case when l.ocr is null then 'pendiente' else 'guardada' end,
                             'ocr', l.ocr, 'creada_en', l.creada_en);
  end if;
  -- ponytail: topes fijos; si la venta crece, pasarlos a config.
  if (select count(*) from lecturas where ip = p_ip and creada_en > now() - interval '1 hour') >= 10
     or (select count(*) from lecturas where creada_en > now() - interval '1 hour') >= 200 then
    return json_build_object('estado', 'limite');
  end if;
  if found then
    update lecturas set ip = p_ip, creada_en = now() where path = p_path returning * into l; -- reintento
  else
    insert into lecturas (path, ip) values (p_path, p_ip) returning * into l;
  end if;
  return json_build_object('estado', 'nueva', 'creada_en', l.creada_en);
end;
$$;
