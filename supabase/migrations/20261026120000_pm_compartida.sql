-- Plataforma del organizador compartida (spec #2): cada guardado es una versión
-- completa del estado (el JSON de serializeState) con fecha y autor. Solo
-- inserción; la vigente es la de número más alto. Sin políticas, como ordenes:
-- solo la Edge Function `pm` (service_role) la toca.
create table pm_versiones (
  -- La clave primaria hace atómico el guardado: dos con la misma base insertan
  -- el mismo número y uno solo gana.
  version int primary key check (version > 0),
  guardado_en timestamptz not null default now(),
  autor text not null check (autor in ('navegador', 'claude', 'vytas')),
  estado jsonb not null
);

alter table pm_versiones enable row level security;
revoke all on pm_versiones from anon, authenticated;
-- Nada se borra ni se reescribe: deshacer es guardar una versión vieja como nueva.
revoke update, delete, truncate on pm_versiones from service_role;
