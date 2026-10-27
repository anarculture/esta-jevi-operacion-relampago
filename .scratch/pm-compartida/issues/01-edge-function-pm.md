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

**Status:** ready-for-agent

- [ ] `supabase db reset` sale 0 (todas las migraciones aplican).
- [ ] `node supabase/tests/pm.mjs` sale 0 con los 8 casos (requiere `supabase functions serve --env-file supabase/functions/.env` corriendo).
- [ ] `cmp app.js supabase/functions/_shared/app.js` sale 0.
- [ ] `node -e "const M=require('./app.js'); process.exit(M.validateState(M.defaultState()).ok?0:1)"` sale 0.
- [ ] `deno test supabase/functions/` sale 0 (los 7 tests del dictamen siguen verdes).
- [ ] `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54321/functions/v1/pm -H 'Content-Type: application/json' -d '{"clave":"mala","accion":"leer"}'` imprime `401`.
