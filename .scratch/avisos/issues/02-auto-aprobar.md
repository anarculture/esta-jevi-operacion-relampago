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

**Status:** done

- [x] `node supabase/tests/auto-aprobar.mjs` sale 0 (funciones sirviendo): con `auto_aprobar = true` y el recibo sintético que cuadra, `ver_orden` responde `aprobada` con entradas en menos de 60 s; con `auto_aprobar = false` queda `en_revision` con dictamen `coincide`; `admin` `cola` muestra `aprobada_por = 'ia'` en la primera.
- [x] `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con el assert de `aprobada_por`.
- [x] `node ticketera/tests/ux.mjs` sale 0 con el caso: fixture de `cola` con `aprobada_por: "ia"` → el panel muestra "Aprobada por IA"; con `"admin"` no lo muestra.
- [x] `deno test supabase/functions/` sale 0.

**Evidencia (ticket 02):**
- HTTP (stack propio `avisos`, `API=http://127.0.0.1:56321 DB_CONTAINER=supabase_db_avisos`): `ok auto_aprobar = true: orden #5 aprobada en 14.9 s` · `ok la misma captura no aprueba sola una segunda orden (prefijo ni sufijo)` · `ok auto_aprobar = false: … sigue en revisión con dictamen coincide` · `OK auto-aprobar.mjs` (cola: `aprobada_por` ia / null / admin tras el panel).
- SQL: `OK ticketera.sql` con `aprobada_por` = admin (panel), null (rechazo), ia (service role).
- Página: `OK ux.mjs` con "admin: chip 'Aprobada por IA' solo en las que aprobó la IA".
- Deno: `ok | 11 passed | 0 failed` (tras `git merge ticketera` con el dictamen endurecido).
- `flujo.mjs` sigue verde: `OK flujo: orden #3 aprobada, 2 entradas`.

**/security-review (gate HITL):** un hallazgo HIGH, ya corregido. `coincide` acepta la referencia por sufijo y `unique(tipo, referencia)` no ve "1"+REF ni un sufijo como repetidos, así que una sola captura habría aprobado N órdenes sin Mau. Arreglo en `revisar` (`capturaDeUnaSolaOrden`): solo se aprueba sola si la referencia leída es exactamente la tipeada y no comparte sufijo con otra orden del mismo tipo; los dos caminos están cubiertos en `auto-aprobar.mjs`. Efecto: quien tipea solo el final de una referencia larga espera a Mau.
Pendiente, no bloquea: dos `revisar` en paralelo sobre el mismo token pueden correr el OCR dos veces (sin doble emisión: `resolver_orden` solo actúa sobre `en_revision`). Y `porNombre` en `dictamen.ts` aceptaría un destinatario solo por el nombre si algún método tuviera `titular` (Zelle lo tendrá al activarse): conviene revisarlo en `ticketera` antes de activar Zelle con aprobación automática.
