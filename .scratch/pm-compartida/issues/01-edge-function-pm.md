# 01: Edge Function `pm` con su tabla y contrato HTTP

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/2

**What to build:** un agente (o cualquier cliente con la clave) puede leer y guardar el estado
completo de la plataforma del organizador por HTTP contra el Supabase local. Cada guardado es
una versión nueva con fecha y autor; nada se borra. El servidor rechaza clave mala (401), base
vieja (409, con la versión vigente), estado inválido (400 con `errores`) y cuerpos más grandes
que `LIMITS.importBytes`. Contrato completo: sección "Implementation Decisions" del issue #2
(`leer`, `leer` con `version`, `guardar` con `base`/`autor`/`estado`, `versiones`; autor ∈
`navegador`/`claude`/`vytas`).

Decisiones congeladas para este ticket:

- Tabla solo de inserción, RLS activado sin políticas (mismo patrón que `ordenes`); la versión
  vigente es la de número más alto. Migración nueva, sin tocar las existentes.
- La función sigue el patrón de `admin`: `serve`/`json` de `_shared`, `verify_jwt = false` en
  `config.toml`, clave en el secreto `PM_CLAVE` (mínimo 16 caracteres; si es más corta, todo 401).
- El servidor valida con el mismo `validateState` del modelo puro de `app.js` y guarda el estado
  normalizado que devuelve. Como `supabase functions serve` solo monta la carpeta de funciones,
  la función importa una **copia byte a byte** de `app.js` dentro de la carpeta compartida de
  funciones; el gate `cmp` la mantiene idéntica. `app.js` cambia lo mínimo para exponer el
  modelo en `globalThis.SindicatoBaba` también cuando no hay `document` ni `module` (Deno), sin
  cambiar lo que ya expone en Node y en el navegador.
- La respuesta de `leer` es un objeto plano (`{ version, guardado_en, autor, estado }`), nunca un
  array: otra spec (repintar-ticketera) le añadirá un bloque `ticketera` calculado al momento y no
  guardado en las versiones. Los clientes ignoran claves que no conocen.
- La comparación `base` contra versión vigente y la inserción no pueden intercalarse con otro
  guardado: dos guardados con la misma `base` → uno gana, el otro 409.
- Test nuevo: script Node por HTTP al estilo de `supabase/tests/flujo.mjs` (fetch +
  `node:assert/strict`, clave leída de `supabase/functions/.env`), con los 8 casos de "Testing
  Decisions" del issue #2. Supone la tabla vacía: el gate corre `supabase db reset` antes.

**Blocked by:** None (can start immediately)

**Status:** done (commit del ticket 01)

- [x] `supabase db reset` sale 0 (todas las migraciones aplican). · `Applying migration 20261026120000_pm_compartida.sql...` · `db_reset=0`
- [x] `node supabase/tests/pm.mjs` sale 0 con los 8 casos (requiere `supabase functions serve --env-file supabase/functions/.env` corriendo). · `OK pm: 8 casos del contrato y la carrera de guardados`
- [x] `cmp app.js supabase/functions/_shared/app.js` sale 0. · `cmp=0`
- [x] `node -e "const M=require('./app.js'); process.exit(M.validateState(M.defaultState()).ok?0:1)"` sale 0. · `build=0`
- [x] `deno test supabase/functions/` sale 0 (los 7 tests del dictamen siguen verdes). · `ok | 7 passed | 0 failed`
- [x] `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54321/functions/v1/pm -H 'Content-Type: application/json' -d '{"clave":"mala","accion":"leer"}'` imprime `401`. · `smoke=401`

Notas del agente:

- 409 devuelve `{ error: "base_vieja", version, guardado_en, autor, estado }` (la vigente completa),
  así quien guarda no necesita otra llamada para recargar. La atomicidad la da la clave primaria
  `version`: el que pierde la carrera recibe 23505 y se le responde 409.
- El límite de cuerpo vive en `serve` de `_shared/db.ts` como parámetro opcional (`maxBytes`, por
  defecto sin límite): `admin`, `revisar` y `tasa` no cambian. Mide `text.length`, como
  `parseBackup`. Rechazo: 413 `cuerpo_muy_grande`.
- Debilidad anotada: `versiones` lista solo las 100 últimas (comentario `ponytail:`); las viejas se
  leen con `leer` + `version`.
- `/security-review`: sin hallazgos altos ni medios (bajos descartados: comparación de clave no
  constante como en `admin`, clave compartida por diseño).
