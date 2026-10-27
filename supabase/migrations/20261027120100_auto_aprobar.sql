-- Aprobación automática (issue #5, ticket 02): quien aprueba queda en ordenes.aprobada_por.
-- `revisar` llama con 'ia' cuando el dictamen es `coincide` y config.auto_aprobar; el panel
-- (función admin) no pasa el parámetro y queda 'admin'. Sin grant a anon, como antes.
drop function resolver_orden(uuid, boolean, text);
create function resolver_orden(p_id uuid, p_aprobar boolean, p_motivo text default null, p_aprobada_por text default 'admin')
returns json
language plpgsql security definer set search_path = public as $$
declare o ordenes;
begin
  update ordenes set estado = case when p_aprobar then 'aprobada' else 'rechazada' end, resuelta_en = now(),
    rechazo_motivo = case when p_aprobar then null else left(trim(p_motivo), 200) end,
    aprobada_por = case when p_aprobar then p_aprobada_por end
  where id = p_id and estado = 'en_revision'
  returning * into o;
  if o.id is null then raise exception 'orden_ya_resuelta'; end if;
  if p_aprobar then
    insert into entradas (id, orden_id, whatsapp, avisada_en)
    select id, o.id, o.whatsapps[k], case when o.whatsapps[k] is null then now() end
    from (select id, row_number() over (order by id)::int as k
          from (select gen_random_uuid() as id from generate_series(1, o.cantidad)) g) s;
  end if;
  return json_build_object('numero', o.numero, 'estado', o.estado);
end;
$$;

revoke execute on function resolver_orden(uuid, boolean, text, text) from public, anon, authenticated;
