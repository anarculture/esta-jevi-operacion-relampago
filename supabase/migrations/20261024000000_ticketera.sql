-- Ticketera de la fiesta del 29-oct-2026 (P0 de docs/user-stories.md).
-- El comprador no tiene cuenta: anon solo sube capturas y llama a las RPC de
-- abajo. Las tablas no tienen políticas; el panel de Mau y la IA pasan por
-- Edge Functions con service_role.

create table config (
  id int primary key default 1 check (id = 1),
  precio_usd_cents int not null default 1000,
  tasa numeric(14, 4),
  tasa_fecha date,
  tasa_consultada_en timestamptz,
  -- Datos de destino que ve el comprador, por método. Solo se ofrecen los activos.
  metodos jsonb not null
);

insert into config (metodos) values ('{
  "pago_movil_bnc":  {"activo": false, "nombre": "Pago móvil BNC",  "banco": "0191 BNC", "telefono": "", "cedula": ""},
  "pago_movil_ubii": {"activo": false, "nombre": "Pago móvil Ubii", "banco": "",         "telefono": "", "cedula": ""},
  "binance":         {"activo": false, "nombre": "Binance Pay",     "id": ""},
  "zelle":           {"activo": false, "nombre": "Zelle",           "correo": "", "titular": ""}
}');

create table ordenes (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  token uuid not null unique default gen_random_uuid(),
  creada_en timestamptz not null default now(),
  nombre text not null,
  cedula text not null,
  telefono text not null,
  cantidad int not null check (cantidad between 1 and 10),
  metodo text not null check (metodo in ('pago_movil_bnc', 'pago_movil_ubii', 'binance', 'zelle')),
  -- BNC y Ubii comparten el espacio de referencias de pago móvil.
  tipo text generated always as (case when metodo like 'pago_movil%' then 'pago_movil' else metodo end) stored,
  referencia text not null,
  captura text not null,
  monto_usd_cents int not null,
  tasa numeric(14, 4),
  monto_bs numeric(14, 2),
  estado text not null default 'en_revision' check (estado in ('en_revision', 'aprobada', 'rechazada')),
  dictamen text check (dictamen in ('coincide', 'dudoso', 'no_coincide')),
  dictamen_motivo text,
  ocr jsonb,
  resuelta_en timestamptz,
  unique (tipo, referencia)
);

create table entradas (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes (id),
  token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz
);

alter table config enable row level security;
alter table ordenes enable row level security;
alter table entradas enable row level security;

-- Comparación de referencias: sin separadores, mayúsculas, sin ceros a la izquierda.
create function normalizar_referencia(r text) returns text
language sql immutable as $$
  select ltrim(upper(regexp_replace(coalesce(r, ''), '[^A-Za-z0-9]', '', 'g')), '0')
$$;

create function datos_venta() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'precio_usd_cents', c.precio_usd_cents,
    'tasa', c.tasa,
    'tasa_fecha', c.tasa_fecha,
    'metodos', (select coalesce(json_object_agg(k, v), '{}') from jsonb_each(c.metodos) as m(k, v)
                where (v ->> 'activo')::boolean)
  ) from config c
$$;

create function crear_orden(
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
  v_usd int;
begin
  select * into c from config where id = 1;
  if length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then raise exception 'nombre_invalido'; end if;
  if v_cedula !~ '^[VE]?\d{5,9}$' then raise exception 'cedula_invalida'; end if;
  if v_cedula ~ '^\d' then v_cedula := 'V' || v_cedula; end if;
  if length(v_tel) not between 10 and 13 then raise exception 'telefono_invalido'; end if;
  if not coalesce((c.metodos -> p_metodo ->> 'activo')::boolean, false) then raise exception 'metodo_invalido'; end if;
  if length(v_ref) < 4 then raise exception 'referencia_invalida'; end if;
  if p_captura !~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$' then raise exception 'captura_invalida'; end if;

  v_usd := p_cantidad * c.precio_usd_cents;
  if p_metodo like 'pago_movil%' and (c.tasa is null or c.tasa_consultada_en < now() - interval '12 hours') then
    raise exception 'tasa_vencida';
  end if;

  insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs)
  values (
    trim(p_nombre), v_cedula, v_tel, p_cantidad, p_metodo, v_ref, p_captura, v_usd,
    case when p_metodo like 'pago_movil%' then c.tasa end,
    case when p_metodo like 'pago_movil%' then round(v_usd / 100.0 * c.tasa, 2) end
  )
  returning * into o;

  return json_build_object('numero', o.numero, 'token', o.token);
exception
  when unique_violation then raise exception 'referencia_usada';
end;
$$;

-- Lo que ve el comprador en el enlace de su orden; los QR solo si está aprobada.
create function ver_orden(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'numero', o.numero, 'estado', o.estado, 'nombre', o.nombre, 'cedula', o.cedula,
    'cantidad', o.cantidad, 'metodo', o.metodo, 'referencia', o.referencia,
    'monto_usd_cents', o.monto_usd_cents, 'monto_bs', o.monto_bs, 'creada_en', o.creada_en,
    'entradas', case when o.estado = 'aprobada' then
      (select json_agg(e.token order by e.id) from entradas e where e.orden_id = o.id) end
  ) from ordenes o where o.token = p_token
$$;

-- Aprobar o rechazar una sola vez; al aprobar nacen las entradas en la misma transacción.
create function resolver_orden(p_id uuid, p_aprobar boolean) returns json
language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  update ordenes set estado = case when p_aprobar then 'aprobada' else 'rechazada' end, resuelta_en = now()
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
grant execute on function datos_venta(), crear_orden(text, text, text, int, text, text, text), ver_orden(uuid)
  to anon, authenticated;
revoke execute on function resolver_orden(uuid, boolean) from anon, authenticated;

-- Capturas: anon solo puede subir; nadie anónimo lista ni lee.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capturas', 'capturas', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp']);

create policy "anon sube capturas" on storage.objects
  for insert to anon with check (bucket_id = 'capturas');
