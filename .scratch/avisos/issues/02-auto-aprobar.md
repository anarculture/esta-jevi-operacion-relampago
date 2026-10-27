# 02: Aprobación automática con `coincide`

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/5

**What to build:** una orden cuyo comprobante cuadra (dictamen `coincide`) se aprueba sola
segundos después de enviarse: el comprador recarga `orden.html` y ya tiene sus QR; en el panel
la orden aparece en "Resueltas" con el chip "Aprobada por IA". `dudoso` y `no_coincide` siguen
en "Por revisar". Con `update config set auto_aprobar = false` todo vuelve a manual sin
desplegar.

Decisiones congeladas:

- En la función `revisar`, tras guardar `dictamen`: si es `coincide` y `config.auto_aprobar`,
  llama `resolver_orden(id, true)` con service role y marca `aprobada_por = 'ia'`;
  `orden_ya_resuelta` se ignora (Mau pudo aprobar antes). Cualquier otro error del RPC se
  registra en consola y la orden queda en revisión (nunca se cae la respuesta del dictamen).
- `resolver_orden` llamado desde `admin` marca `aprobada_por = 'admin'`.
- `admin` (`cola`) devuelve `aprobada_por`; el panel muestra el chip "Aprobada por IA" junto
  al estado cuando corresponde (label 13px, tono verde, tokens de `DESIGN.md`).
- Test HTTP: `supabase/tests/flujo.mjs` ya hace el flujo P0 con un comprobante sintético
  (`supabase/tests/recibo-sintetico.html`); se extiende o se copia a `supabase/tests/auto-aprobar.mjs`
  para cubrir ambos valores del interruptor. Requiere `OPENROUTER_API_KEY` en el `.env` local;
  si no hay clave, el test marca `skip` con mensaje explícito y el AC se considera verde solo si
  el SQL del interruptor pasa.
- Test SQL: `resolver_orden` desde una sesión con service role marca `aprobada_por`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `node supabase/tests/auto-aprobar.mjs` sale 0 (funciones sirviendo): con `auto_aprobar = true` y el recibo sintético que cuadra, `ver_orden` responde `aprobada` con entradas en menos de 60 s; con `auto_aprobar = false` queda `en_revision` con dictamen `coincide`; `admin` `cola` muestra `aprobada_por = 'ia'` en la primera.
- [ ] `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con el assert de `aprobada_por`.
- [ ] `node ticketera/tests/ux.mjs` sale 0 con el caso: fixture de `cola` con `aprobada_por: "ia"` → el panel muestra "Aprobada por IA"; con `"admin"` no lo muestra.
- [ ] `deno test supabase/functions/` sale 0.
