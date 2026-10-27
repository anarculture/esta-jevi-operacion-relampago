-- Normalización de WhatsApp (issue #5), corrección del code review: un venezolano escrito sin el 0
-- (4141234567) se aceptaba tal cual y vytas le escribía a 41… (Suiza); +58 0414… quedaba con el 0.
-- Misma regla que normalizarWhatsapp en ticketera/comun.js.
create or replace function normalizar_whatsapp(p text) returns text
language sql immutable as $$
  select case
    when d ~ '^0\d{10}$' then '58' || substr(d, 2)       -- 04141234567
    when d ~ '^580\d{10}$' then '58' || substr(d, 4)     -- +58 0414 123 4567
    when d ~ '^[24]\d{9}$' then '58' || d                -- 4141234567 (móvil 4xx o fijo 2xx sin el 0)
    when d ~ '^[1-9]\d{9,14}$' then d                    -- con código de país
  end
  from regexp_replace(coalesce(p, ''), '\D', '', 'g') as d
$$;

revoke execute on function normalizar_whatsapp(text) from public, anon, authenticated;
