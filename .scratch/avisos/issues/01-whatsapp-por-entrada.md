# 01: WhatsApp por entrada, de punta a punta

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/5

**What to build:** al comprar 3 entradas, el comprador ve tres campos de WhatsApp ("Tu WhatsApp"
y "WhatsApp de la entrada 2" y "3"), el primero hereda lo que ya escribió como teléfono, el
formulario avisa si un número está mal antes de subir la captura, y los tres sobreviven a una
recarga. La orden guarda los tres; al aprobarse, cada entrada nace con su WhatsApp. En
`orden.html` cada tarjeta de QR dice "Para el ···1234 · pendiente de envío"; en `entrada.html`
aparece el número enmascarado. Nada se envía todavía.

Decisiones congeladas (spec, Implementation Decisions):

- Migración nueva con timestamp posterior a cualquier migración del issue #4 que ya exista en
  la rama (si no existe, usa el minuto actual; nunca edites migraciones existentes):
  - `ordenes.whatsapps text[]`, `ordenes.aprobada_por text check (aprobada_por in ('ia','admin'))`.
  - `entradas.whatsapp text`, `entradas.avisada_en timestamptz`, `entradas.aviso_error text`,
    `entradas.aviso_intentos int not null default 0`.
  - `config.auto_aprobar boolean not null default true`.
  - Backfill: `update entradas set avisada_en = now() where avisada_en is null` (las existentes
    no se avisan nunca).
- `crear_orden` gana `p_whatsapps text[]` al final de la firma (las llamadas viejas sin el
  parámetro deben seguir fallando con `whatsapp_invalido`, no con error de firma: usa
  `default null` y valida). Reglas: `array_length = p_cantidad`; cada uno a dígitos;
  `0` + 10 dígitos (venezolano) → `58` + 10 dígitos; de 10 a 15 dígitos se acepta; otro →
  `whatsapp_invalido`. El primero se guarda también en `ordenes.telefono` (normalizado como hoy).
- `resolver_orden` al aprobar inserta las entradas con `whatsapp = whatsapps[posicion]`; con
  `whatsapps` nulo (órdenes manuales viejas) inserta `whatsapp = null` y `avisada_en = now()`.
- `ver_orden` devuelve por entrada `{ token, whatsapp_mascara, avisada_en }` donde
  `whatsapp_mascara` son los últimos 4 dígitos; `ver_entrada` añade `whatsapp_mascara`. El
  número completo nunca sale por las RPC anónimas.
- Formulario (`index.html`): el campo "Teléfono (WhatsApp)" pasa a "Tu WhatsApp"; al cambiar la
  cantidad se generan los campos 2..N con ayuda "Le llegará su QR por WhatsApp"; validación local
  igual al servidor; `ticketera-borrador` guarda `whatsapps`. `comun.js` expone la normalización
  para que la página y los tests la compartan.
- El SQL de venta manual (`supabase/manual/`) pasa a incluir `whatsapps`; el de madeidk no se
  reejecuta.
- Tests: SQL en `supabase/tests/ticketera.sql`; página en `ticketera/tests/ux.mjs`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con asserts nuevos: 3 WhatsApps válidos crean la orden; 2 para cantidad 3 → `whatsapp_invalido`; `04141234567` queda `584141234567`; al aprobar, la entrada 2 lleva `whatsapps[2]`; `ver_orden` trae `whatsapp_mascara` de 4 dígitos y no el número completo; una entrada insertada antes del backfill tiene `avisada_en` no nulo.
- [x] `node ticketera/tests/ux.mjs` sale 0 con casos nuevos: cantidad 3 → 3 campos de WhatsApp; número de 5 dígitos → error de campo antes de subir y `crear_orden` no se llama; recarga restaura los 3; `crear_orden` recibe `p_whatsapps` con 3 elementos normalizados; orden aprobada muestra "···1234" por tarjeta; `entrada.html` muestra el enmascarado.
- [x] `deno test supabase/functions/` sale 0.
- [x] `grep -c "whatsapps" supabase/manual/orden-madeidk.sql` imprime 0 (no se reescribe el histórico) y existe `supabase/manual/plantilla-venta-manual.sql` con `whatsapps`.

**Evidencia (ticket 01):**
- SQL: `OK ticketera.sql: 5 órdenes creadas` (asserts nuevos en `supabase/tests/ticketera.sql`: backfill, 3 válidos, 5 inválidos → `whatsapp_invalido`, máscara por posición, sin número completo).
- Página: `OK ux.mjs` con el caso "compra: un WhatsApp por entrada…" (`p_whatsapps` = `["584141234567","13055550100","584241112233"]`), tarjetas "Para el ···4567 · pendiente de envío" / "Enviada al ···2233 a las 21:03", copia offline vieja y `entrada.html` con ···2233.
- Deno: `ok | 7 passed | 0 failed`.
- `grep -c whatsapps orden-madeidk.sql` → 0; `plantilla-venta-manual.sql` → 9 (probada en transacción con rollback).
- Decisión: un número que empieza en 0 y no es el venezolano de 11 dígitos se rechaza (un 0 nunca es código de país); misma regla en SQL y `comun.js`.
- Debilidad anotada: `orden.html` no se refresca sola tras aprobarse, así que "pendiente de envío" cambia a "Enviada" solo al recargar (fuera de alcance).
