# 03: Función `avisos` y panel

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/5

**What to build:** un cliente con `PM_CLAVE` (vytas) pide las entradas pendientes de aviso y
recibe, por cada una, el número, el `jid` de WhatsApp y el texto completo listo para enviar;
reporta cada envío como ok o error y las ok desaparecen de pendientes. En el panel admin cada
orden lista sus entradas con número enmascarado y estado del aviso ("enviada 21:03",
"pendiente", "error: …", "intentos agotados"), con botón "Reenviar" y un campo para corregir el
número antes de reenviar.

Decisiones congeladas:

- Edge Function nueva `avisos`, patrón de `admin`, clave comparada con el secreto `PM_CLAVE`
  (mínimo 16 caracteres; menos → todo 401). Local: `PM_CLAVE` en `supabase/functions/.env`
  (si el build del issue #2 ya la puso, se reutiliza; si no, se genera). `config.toml`:
  `[functions.avisos] verify_jwt = false`.
- `pendientes` → entradas de órdenes `aprobada` con `whatsapp` no nulo, `avisada_en` nulo y
  `aviso_intentos < 5`, ordenadas por orden y posición:
  `{ id, whatsapp, jid, texto, numero, posicion, total }`. `jid = whatsapp + "@s.whatsapp.net"`.
  `texto` lo arma el servidor; plantilla (una sola fuente, en la función):
  - Línea 1: `Hola, aquí está tu entrada {posicion} de {total} para Sindicato Baba · DJ BABATR · jueves 29 de octubre · 21:00 · CC Chacaíto.`
  - Línea 2: `{BASE}entrada.html?e={token}`
  - Línea 3 (solo posición 1): `Tu orden #{numero} completa: {BASE}orden.html?t={token_orden}`
  - Línea 4: `Haz captura del QR ahora; en la puerta sube el brillo y muéstralo. Dudas: wa.me/{CONTACTO_WA}`
  - `BASE = https://postropicalia.com/sindicato-baba/`; `CONTACTO_WA` el mismo de `comun.js`.
- `avisada` con `{ id, ok, error? }`: ok → `avisada_en = now()` (idempotente); no ok →
  `aviso_error = error`, `aviso_intentos + 1`. Responde `{ id, avisada_en, aviso_intentos }`.
- `admin` gana `reenviar_aviso` con `{ id, whatsapp? }` (`ADMIN_CLAVE`): si viene `whatsapp`, se
  normaliza con la misma regla del ticket 01 y se guarda; luego `avisada_en = null`,
  `aviso_error = null`, `aviso_intentos = 0`. `cola` devuelve por orden sus `entradas` con
  `{ id, posicion, whatsapp_mascara, avisada_en, aviso_error, aviso_intentos }`.
- Panel: bajo cada orden aprobada, una fila por entrada (label 13px) con el estado y el botón
  "Reenviar" (tonal) que abre un campo de número opcional; tras reenviar, la fila pasa a
  "pendiente". Sin red o error, mensaje en la línea de error existente.
- Tests: HTTP en `supabase/tests/avisos.mjs` (estilo `flujo.mjs`, claves del `.env`); página en
  `ticketera/tests/ux.mjs`.

**Blocked by:** 01

**Status:** done

- [x] `node supabase/tests/avisos.mjs` sale 0 (funciones sirviendo): clave mala → 401 en `pendientes` y `avisada`; una orden aprobada con 2 WhatsApps → `pendientes` trae 2 con `jid` terminado en `@s.whatsapp.net`, `texto` con "1 de 2" y el enlace `entrada.html?e=`; la posición 1 incluye `orden.html?t=`; `avisada` ok saca la entrada de pendientes y repetirlo no cambia `avisada_en`; `avisada` con error 5 veces la saca de pendientes con `aviso_intentos = 5`; `reenviar_aviso` con número nuevo la devuelve a pendientes con el número normalizado; `pendientes` no incluye entradas con `whatsapp` nulo.
- [x] `node ticketera/tests/ux.mjs` sale 0 con el caso: fixture de `cola` con entradas en los cuatro estados → el panel muestra "enviada", "pendiente", "error" e "intentos agotados"; "Reenviar" con número nuevo llama al fixture `admin` con `accion: "reenviar_aviso"` y el `whatsapp` tecleado.
- [x] `grep -c "functions.avisos" supabase/config.toml` imprime 1.
- [x] `deno test supabase/functions/` sale 0 (la plantilla del texto tiene un test Deno propio: posición 1 lleva el enlace de la orden, las demás no).

**Evidencia (ticket 03):**
- HTTP (stack `avisos`): `OK avisos.mjs · orden #10` (401 con clave mala y con ADMIN_CLAVE; 2 pendientes con `jid` y texto "1 de 2"/"2 de 2"; solo la 1 lleva `orden.html?t=`; ok idempotente; 5 errores la sacan; `reenviar_aviso` con número nuevo la devuelve normalizada; sin WhatsApp no aparece; la cola no trae el número completo).
- Página: `OK ux.mjs` con "admin: estado del aviso por entrada y 'Reenviar' con número corregido" (enviada 21:03 / pendiente / error / intentos agotados; número inválido no llama; el válido llama `reenviar_aviso` con lo tecleado).
- `grep -c "functions.avisos" supabase/config.toml` → 1.
- Deno: `ok | 13 passed | 0 failed | 1 ignored`. El ignorado es "mismo contacto que la ticketera" y requiere `--allow-read`; con `deno test --allow-read supabase/functions/avisos/` → `3 passed`.
- SQL: `ticketera.sql` verde con el assert de que anon no llama `avisos_pendientes`.
- /security-review (gate HITL): sin hallazgos ≥ 8. Observación: `PM_CLAVE` ahora también da números completos y enlaces de entrada (decisión del spec: vytas reutiliza su clave). Si se filtra del navegador de Mau, filtra eso; una `AVISOS_CLAVE` solo para vytas lo acotaría.
