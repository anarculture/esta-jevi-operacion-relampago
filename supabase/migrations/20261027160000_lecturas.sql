-- Lectura de la captura al elegirla (issue #7): la función `lectura` corre el OCR apenas el comprador
-- sube la captura y lo guarda aquí por path; `revisar` lo reutiliza al registrar la orden.
-- Solo la función (service role) toca esto: anon no lee la tabla ni llama a reservar_lectura.

create table lecturas (
  path text primary key,
  ocr jsonb,            -- null: OCR en curso o fallido (la fila cuenta igual para el límite)
  ip text not null,
  creada_en timestamptz not null default now()
);
alter table lecturas enable row level security;
revoke all on lecturas from anon, authenticated;
create index lecturas_creada_en_idx on lecturas (creada_en);

-- Reserva la lectura de una captura antes de gastar OCR. Estados:
--   guardada: el path ya tiene OCR (se devuelve, sin volver al OCR)
--   pendiente: el path ya está reservado y aún sin OCR (en curso o falló)
--   limite: la IP llegó a 10 lecturas en la última hora, o el total a 200
--   nueva: se reservó el path; la función corre el OCR y guarda el resultado
-- El candado serializa las reservas: dos pedidos simultáneos no pasan el límite a la vez.
create function reservar_lectura(p_path text, p_ip text) returns json
language plpgsql set search_path = public as $$
declare l lecturas;
begin
  perform pg_advisory_xact_lock(hashtext('reservar_lectura'));
  select * into l from lecturas where path = p_path;
  if found then
    return json_build_object('estado', case when l.ocr is null then 'pendiente' else 'guardada' end,
                             'ocr', l.ocr, 'creada_en', l.creada_en);
  end if;
  -- ponytail: topes fijos; si la venta crece, pasarlos a config.
  if (select count(*) from lecturas where ip = p_ip and creada_en > now() - interval '1 hour') >= 10
     or (select count(*) from lecturas where creada_en > now() - interval '1 hour') >= 200 then
    return json_build_object('estado', 'limite');
  end if;
  insert into lecturas (path, ip) values (p_path, p_ip) returning * into l;
  return json_build_object('estado', 'nueva', 'creada_en', l.creada_en);
end;
$$;

revoke execute on function reservar_lectura(text, text) from public, anon, authenticated;
