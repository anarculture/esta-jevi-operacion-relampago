# 01: `leer` trae el bloque `ticketera`

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/3

**What to build:** quien llama `leer` en la Edge Function `pm` (navegador, vytas, Claude Code)
recibe, además del estado compartido, un bloque `ticketera` calculado en ese momento desde las
órdenes de la ticketera: entradas emitidas, órdenes, cobrado nominal en USD, desglose por método
(con los bolívares de pago móvil) y lo que espera revisión. Con `PM_CLAVE` basta; esa clave sigue
sin poder aprobar ni rechazar. Si el cálculo falla, `leer` responde igual que hoy con
`ticketera: null`.

Decisiones congeladas:

- Forma exacta del bloque (del spec): `consultado_en` (ISO), `aprobadas { ordenes, entradas,
  usd_cents }`, `por_metodo { pago_movil, zelle, binance }` cada uno `{ ordenes, entradas,
  usd_cents, bs }` (`bs` numérico solo en `pago_movil`, `null` en los demás), `en_revision
  { ordenes, entradas, usd_cents }`, `ultima_aprobacion` (ISO o `null`). Los tres métodos
  aparecen siempre, aunque estén en 0.
- `entradas` = suma de `cantidad`; `usd_cents` = suma de `monto_usd_cents`; `bs` = suma de
  `monto_bs`; el método se agrupa por la columna generada `tipo` (BNC y Ubii suman en
  `pago_movil`). `ultima_aprobacion` = máximo de `resuelta_en` entre aprobadas. Las rechazadas no
  cuentan en nada.
- Una función SQL `resumen_ticketera()` que devuelve `jsonb`, `security definer`, con `revoke
  execute ... from public, anon, authenticated` (misma forma que `normalizar_whatsapp` en
  `20261027120300_whatsapp_sin_cero.sql`). Migración nueva; ninguna existente se edita y las
  políticas de `ordenes` no cambian.
- `pm` la llama con el cliente service role de `_shared/db.ts` en las dos formas de `leer`
  (vigente e histórica) y adjunta `ticketera` al objeto que ya devuelve. Un error ahí se
  registra en consola y se adjunta `ticketera: null`; nunca cambia el código HTTP. `guardar` y
  `versiones` no cambian. La función `admin` no cambia.
- Test HTTP nuevo `supabase/tests/pm-ticketera.mjs`, mismo estilo que `pm.mjs` y `avisos.mjs`
  (fetch + `node:assert/strict`, claves del `.env` de funciones, variables `API` y `DB_CONTAINER`
  para correr contra un stack propio). Crea órdenes con la RPC `crear_orden` y las resuelve con
  `admin` (`resolver`), igual que `avisos.mjs`; nunca escribe filas a mano.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `node supabase/tests/pm-ticketera.mjs` sale 0 con los seis casos del spec en este orden: (1) sin órdenes, `leer` trae `ticketera` con todo en 0, los tres métodos presentes y `ultima_aprobacion: null`; (2) una orden de 2 entradas por pago móvil aprobada → `aprobadas.entradas = 2`, `usd_cents = 2000`, `por_metodo.pago_movil.bs` igual al `monto_bs` de la orden, `ultima_aprobacion` no nulo; (3) una en revisión y una rechazada no cuentan en `aprobadas` y solo la de revisión aparece en `en_revision`; (4) Zelle y Binance suman en su método con `bs: null`; (5) clave mala → 401 sin bloque; (6) `leer` con `version` histórica trae el mismo `ticketera` actual.
- [x] `docker exec -i <contenedor de base> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con un assert nuevo: `set role anon; select resumen_ticketera()` lanza `insufficient_privilege`.
- [x] `node supabase/tests/pm.mjs` sigue saliendo 0 (el contrato anterior de `leer`, `guardar` y `versiones` no cambió).
- [x] `deno test supabase/functions/` sale 0.

**Evidencia (stack local `pm-ticketera`, API 58321, tras `supabase db reset`):**

- `node supabase/tests/pm-ticketera.mjs` → `OK pm-ticketera: 6 casos · aprobadas {"ordenes":3,"entradas":6,"usd_cents":6000}`. Con el `pm` anterior daba rojo: `leer sin bloque ticketera`.
- `ticketera.sql` → `OK ticketera.sql: 9 órdenes creadas` con los asserts nuevos de `anon` y `authenticated` (`supabase/tests/ticketera.sql:244`).
- `node supabase/tests/pm.mjs` → `OK pm: 8 casos del contrato y la carrera de guardados`; `avisos.mjs` → `OK avisos.mjs`.
- `deno test supabase/functions/` → `ok | 13 passed | 0 failed | 1 ignored`.
- Camino de falla, a mano: con `revoke execute ... from service_role`, `leer` responde `200 version 5 ticketera null` y deja `resumen_ticketera` en el log de funciones.
- `/security-review`: sin hallazgos. El bloque solo lleva conteos y sumas (`supabase/migrations/20261027200000_resumen_ticketera.sql`); el test busca nombre, cédula, WhatsApp, referencia y `token` en el JSON y no los encuentra.
- Notas: `pm-ticketera.mjs` supone `ordenes` vacía (corre después de `supabase db reset`, igual que `pm.mjs` supone `pm_versiones` vacía). `leer` hace dos consultas seguidas (versión y totales); `ponytail:` si la latencia importa, van en `Promise.all`. Riesgo de choque: el test crea órdenes con la firma actual de `crear_orden` (`p_whatsapps`); si el frente cotejo (#6/#7) cambia esa firma, el test se ajusta.
