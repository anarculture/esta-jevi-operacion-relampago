# 01: Check-in por código de respaldo, de punta a punta

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/4

**What to build:** el portero abre `portero.html` en la ticketera, escribe la clave que le pasó
Mau (queda guardada en el navegador, con botón para salir), teclea el código de respaldo de 8
caracteres que va bajo cada QR y la pantalla entera se pone verde ("Válida · Entrada 2 de 3 ·
orden #12"), amarilla ("Ya usada a las 22:14") o roja ("Inválida"), con vibración distinta en
cada caso; vuelve sola al estado inicial a los 2 s o con un toque. Tras una válida aparece
"Deshacer" durante 5 minutos. Arriba, el contador "N ingresaron de M aprobadas". El mismo
código en otro teléfono sale "ya usada". Todo contra el Supabase local.

Decisiones congeladas (del spec, sección Implementation Decisions):

- Edge Function nueva `portero`, patrón de `admin` (`serve`/`json` de `_shared`, cuerpo JSON
  con `clave` y `accion`, `verify_jwt = false` en `config.toml`). Clave en el secreto
  `PORTERO_CLAVE`, distinta de `ADMIN_CLAVE`; menos de 16 caracteres → todo 401. Acciones:
  `checkin` (`{token}` o `{codigo}` de 8 caracteres), `deshacer` (`{token}`, solo dentro de los
  5 minutos), `lista` (entradas de órdenes aprobadas: `token`, `numero`, `posicion`, `total`,
  `checked_in_at`, `generada_en`; sin nombre, cédula ni teléfono), `resumen`
  (`{aprobadas, ingresadas}`).
- Respuesta de `checkin`: `{ resultado, numero, posicion, total, checked_in_at }` con
  `resultado` ∈ `valida` | `ya_usada` | `invalida`; `invalida` lleva `motivo`
  (`no_existe`, `no_aprobada`, `codigo_ambiguo`). En `ya_usada`, `checked_in_at` es la hora del
  primer ingreso.
- Migración nueva (no se editan las existentes): `checkin_entrada(p_token uuid)` y
  `deshacer_checkin(p_token uuid)`, security definer, **sin** grant a anon ni authenticated
  (igual que `resolver_orden`). El check-in es un solo `update ... where checked_in_at is null`
  y la orden aprobada; si no actualiza fila, un `select` decide entre `ya_usada` e `invalida`.
  `entradas` no cambia de forma. `ver_entrada` no cambia.
- La resolución de `codigo` → token se hace en SQL (prefijo del token en texto); más de una
  coincidencia → `codigo_ambiguo`.
- Página en la carpeta de la ticketera, con `t.css` y `comun.js` (patrón de `admin.html`:
  clave en `localStorage`, `funcion("portero", {...})`). Colores del resultado: verde neón con
  texto tóner negro, amarillo marcador con texto tóner negro, rojo aviso con texto papel
  (tokens de `DESIGN.md`). Vibración: válida un pulso corto, ya usada dos, inválida uno largo.
  Un mismo token se ignora 3 s tras su último resultado.
- `PORTERO_CLAVE` local va en `supabase/functions/.env` (ignorado por git), generada aleatoria.
- Tests: el SQL se añade a `supabase/tests/ticketera.sql` (misma transacción que se deshace);
  el HTTP en `supabase/tests/portero.mjs` (estilo `flujo.mjs`: fetch + `node:assert/strict`,
  clave leída del `.env`); la página en casos nuevos de `ticketera/tests/ux.mjs` (fixtures por
  ruta, 390 px, capturas en `evidencia/`).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 e incluye asserts nuevos: válida, ya usada con la misma hora, token inexistente, orden en revisión, deshacer dentro de la ventana, deshacer fuera de la ventana no deshace.
- [ ] `node supabase/tests/portero.mjs` sale 0 (requiere `supabase functions serve --env-file supabase/functions/.env`): 401 con clave mala en las 4 acciones; `checkin` por `token` y por `codigo` coinciden; `codigo` ambiguo → `invalida`/`codigo_ambiguo`; `lista` sin `nombre`/`cedula`/`telefono`; `resumen` cuadra tras un check-in; dos `checkin` del mismo token en `Promise.all` → exactamente una `valida`.
- [ ] `node ticketera/tests/ux.mjs` sale 0 con casos nuevos de portero: sin clave pide clave; código válido → pantalla con clase/estado "valida", texto "Entrada 1 de 2" y `navigator.vibrate` llamado; ya usada → "22:14" (hora del fixture); inválida → "Inválida"; vuelve a escaneo sola; "Deshacer" visible tras una válida y oculto tras una inválida.
- [ ] `deno test supabase/functions/` sale 0 (los tests del dictamen siguen verdes).
- [ ] `grep -c "functions.portero" supabase/config.toml` imprime 1.
- [ ] `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54321/functions/v1/portero -H 'Content-Type: application/json' -d '{"clave":"mala","accion":"resumen"}'` imprime `401`.
