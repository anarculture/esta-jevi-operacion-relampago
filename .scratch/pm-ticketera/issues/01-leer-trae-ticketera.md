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

**Status:** ready-for-agent

- [ ] `node supabase/tests/pm-ticketera.mjs` sale 0 con los seis casos del spec en este orden: (1) sin órdenes, `leer` trae `ticketera` con todo en 0, los tres métodos presentes y `ultima_aprobacion: null`; (2) una orden de 2 entradas por pago móvil aprobada → `aprobadas.entradas = 2`, `usd_cents = 2000`, `por_metodo.pago_movil.bs` igual al `monto_bs` de la orden, `ultima_aprobacion` no nulo; (3) una en revisión y una rechazada no cuentan en `aprobadas` y solo la de revisión aparece en `en_revision`; (4) Zelle y Binance suman en su método con `bs: null`; (5) clave mala → 401 sin bloque; (6) `leer` con `version` histórica trae el mismo `ticketera` actual.
- [ ] `docker exec -i <contenedor de base> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con un assert nuevo: `set role anon; select resumen_ticketera()` lanza `insufficient_privilege`.
- [ ] `node supabase/tests/pm.mjs` sigue saliendo 0 (el contrato anterior de `leer`, `guardar` y `versiones` no cambió).
- [ ] `deno test supabase/functions/` sale 0.
