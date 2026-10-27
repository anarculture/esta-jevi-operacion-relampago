# BUILD: la plataforma del organizador lee las ventas de la ticketera

## Estado  <!-- lo actualiza el loop en el paso 6 -->
- Ticket actual: 03
- Último verde: 02 · commit 588743c (01) + commit del 02 · 27-oct-2026
- Gates: build ✅ · test ✅ (pm, pm-ticketera, pm-modelo, ticketera.sql, avisos, deno) · smoke ⬜
- Bloqueado: —
- Rama de trabajo: `worktree-agent-a38d1f2148cd4d058` (desde `ticketera` 02c6117)
- Servicios: stack propio `pm-ticketera` (config.toml local con skip-worktree): API `http://127.0.0.1:58321`, DB 58322, studio 58323, contenedor `supabase_db_pm-ticketera`; `supabase functions serve` en background

Spec: https://github.com/anarculture/sindicato-baba/issues/3 (léela completa antes del ticket 01:
`gh issue view 3 --repo anarculture/sindicato-baba`). Tickets en `.scratch/pm-ticketera/issues/`.
Otros BUILD en este repo (`BUILD.md`, `BUILD-portero.md`, `BUILD-avisos.md`) ya terminaron: no
los edites; sus tickets en `.scratch/pm-compartida/`, `.scratch/portero/` y `.scratch/avisos/`
son solo referencia de estilo y de evidencia.

## Setup (una vez)

1. Aísla el trabajo: estás en un worktree propio creado por el harness desde la rama
   `ticketera`; comprueba con `git log --oneline -1` que tu HEAD desciende de `ticketera`
   (dc09e06 o posterior). Anota la rama en `## Estado`. Todo corre dentro de ese worktree;
   nunca hagas `cd` al checkout principal ni a otros worktrees.
2. Servicios locales. Lo más seguro es un stack propio de Supabase: edita `project_id` en
   `supabase/config.toml` de tu worktree (p. ej. `pm-ticketera`) y puertos libres
   (`api.port`, `db.port`, `studio.port`, `inbucket.port`, `analytics.port`; los builds
   anteriores usaron 553xx y 563xx; comprueba con `ss -ltn`), luego `supabase start`. Así tu
   `supabase db reset` no tumba a nadie. Anota API y contenedor de base en `## Estado`; los
   tests aceptan `API=http://127.0.0.1:<api.port>` y `DB_CONTAINER=supabase_db_<project_id>`
   (`pm.mjs` y `pm-navegador.mjs` tienen la URL fija en 54321: si usas otro puerto, añádeles la
   misma variable `API` antes de correrlos, es un cambio de una línea y es parte del ticket que
   los toque). Funciones: `supabase functions serve --env-file supabase/functions/.env` en
   background (`run_in_background`). `supabase/functions/.env` (ignorado por git) necesita
   `ADMIN_CLAVE`, `OPENROUTER_API_KEY` y `PM_CLAVE` (genera una de 32+ caracteres si falta).
   Chrome headless para el smoke CDP: `/usr/bin/google-chrome`.
3. Gates reales del repo, tal cual existen hoy:
   - build: `node -e "const M=require('./app.js'); process.exit(M.validateState(M.defaultState()).ok?0:1)"` y `cmp app.js supabase/functions/_shared/app.js`.
   - SQL: `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql`
   - HTTP: `node supabase/tests/pm.mjs` (contrato de `pm`), `node supabase/tests/avisos.mjs`, `node supabase/tests/flujo.mjs <imagen.png>` (no los rompas; `flujo.mjs` y `auto-aprobar.mjs` usan el OCR real y pueden fallar por red: repite una vez antes de culpar al código).
   - Deno: `deno test supabase/functions/`
   - Navegador PM: `supabase db reset && node supabase/tests/pm-navegador.mjs` (CDP sin dependencias; supone tabla `pm_versiones` vacía).
   - Página ticketera: `node ticketera/tests/ux.mjs` (Playwright-core en `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`; capturas en `ticketera/tests/evidencia/`, ignoradas por git). No la tocas, pero debe seguir verde.
   - Smoke: `python3 -m http.server <puerto libre> --bind 127.0.0.1` desde el worktree; `index.html` de la raíz responde 200 y contiene "fuera de la ticketera" (desde el ticket 03).
4. Hooks del entorno: `curl`/`wget` están redirigidos; usa `python3 -c` con `urllib` o `fetch`
   en Node. `grep` es `rg`: sintaxis de ripgrep (`-e` por patrón, `-F` para literal). Los
   comandos que escriben en producción (`db push`, `functions deploy`, `git push`) suelen quedar
   bloqueados por el hook de permisos: no los rodees, anótalos en `## BLOQUEADO` (ticket 04).
   `ssh aios-vm` funciona sin contraseña; el usuario allí es `developer`, Hermes vive en
   `~/.hermes` y no hay `rg` (usa `grep`).
5. Secretos: nunca imprimas `PM_CLAVE`, `ADMIN_CLAVE` ni claves de API en la salida, en commits
   ni en mensajes; léelos de archivos y pásalos por variables de entorno.

## Tu rol

Desarrollador autónomo. Construyes los 4 tickets sin pedir confirmación, salvo gate HITL o
contradicción real entre specs. Decisiones de producto congeladas (no se reabren):

- Una sola costura: `leer` de la Edge Function `pm` devuelve además `ticketera`, calculado al
  momento y nunca guardado en `pm_versiones`. Ninguna acción, función ni clave nueva; `PM_CLAVE`
  basta y sigue sin poder aprobar ni rechazar. La función `admin` no cambia.
- Forma del bloque, literal del ticket 01. Nominal `usd_cents` = suma de `monto_usd_cents` ($10
  por entrada, también en pago móvil); los bolívares van aparte en `bs`.
- El cálculo vive en SQL (`resumen_ticketera()`, security definer, no ejecutable por anon).
- `real.sold` y `real.ticketsCollectedCents` conservan nombre, tipo y validación y pasan a
  significar "fuera de la ticketera". El esquema del estado, `validateState`, `serializeState`,
  el respaldo JSON y el escenario no cambian.
- La última lectura de la ticketera vive en `localStorage` bajo clave propia, fuera del estado.
- Textos exactos de la UI: los del ticket 03.
- La orden #2 de Johan ya está en la ticketera (Zelle): si el registro manual la duplica, la
  corrige Mau desde la plataforma (ticket 04), no el agente.
- Sin dependencias nuevas de npm, Deno ni de la VM.

## Tickets

- [x] 01 · `leer` trae el bloque `ticketera` · Bloqueado por: — · → .scratch/pm-ticketera/issues/01-leer-trae-ticketera.md · evidencia: `OK pm-ticketera: 6 casos`, `supabase/functions/pm/index.ts:39,42`, `/security-review` sin hallazgos
- [x] 02 · El modelo puro suma la ticketera · Bloqueado por: — · → .scratch/pm-ticketera/issues/02-modelo-suma-ticketera.md · evidencia: `OK pm-modelo`, `app.js:432,447,513,967`; AC 2 enmendado (el comando literal ya salía 1 en 02c6117 por orden de claves, nota en el ticket)
- [ ] 03 · Ventas muestra "Ticketera" y "Fuera de la ticketera" · Bloqueado por: 01, 02 · → .scratch/pm-ticketera/issues/03-ventas-muestra-ticketera.md
- [ ] 04 · Producción · Bloqueado por: 03 · → .scratch/pm-ticketera/issues/04-produccion.md

## BLOQUEADO

(vacío)

## Loop por ticket (lazy-fable)

1. **Frontera**: toma el primer ticket cuyos bloqueantes estén `[x]`. Si un bloqueante está en
   `## BLOQUEADO`, hereda el bloqueo: sáltalo.
2. **Mira antes de mapear**: lee el archivo del ticket y el código que va a tocar
   (`codegraph_explore` con `projectPath` del worktree, o `rg`). No mapees sobre código que no viste.
   Referencias obligadas: `supabase/functions/pm/index.ts` (comentario "otra spec le añadirá un
   bloque `ticketera`"), `supabase/functions/_shared/db.ts`, `supabase/migrations/20261024000000_ticketera.sql`
   (tabla `ordenes`: `tipo` generada, `estado`, `cantidad`, `monto_usd_cents`, `monto_bs`,
   `resuelta_en`), `20261027120300_whatsapp_sin_cero.sql` (forma de una función con `revoke`),
   `app.js` (`cashReal` ~l.430, `toCSV` ~l.473, exports ~l.557, `renderDerived` ~l.747, render
   de Ventas ~l.955, bloque "plataforma compartida" ~l.1213-1310 con `leerRemoto`, `adoptar`,
   `olvidarClave`, foco ~l.1405), `index.html` (sección Ventas ~l.358-400, Caja real ~l.291-310),
   `supabase/tests/pm.mjs`, `pm-navegador.mjs`, `avisos.mjs` (cómo crear y resolver órdenes
   desde un test), `DESIGN.md`, `.scratch/pm-compartida/issues/02-navegador-sincroniza.md`
   (decisiones del sync que heredas).
3. **Mapa de etapas** (escrito, corto): `Etapa N: <qué> → <artefacto> · check: <comando>`. Etapa
   sin check verificable → fusiónala con la siguiente. Si lo que aprendes invalida el mapa,
   reescríbelo.
4. **Ship lazy por etapa**: el mínimo diff que pasa su check. Reusa lo existente, cero
   abstracciones nuevas, no agregues deps si lo instalado alcanza. Atajo deliberado → comentario
   `ponytail:` con su techo. Corre el check de la etapa; un arreglo en N que rompe M → re-corre M.
   Tras tocar `app.js`: `cat app.js > supabase/functions/_shared/app.js` (no `cp`: pide
   confirmación en este shell) y `cmp`.
5. **Autocrítica**: relee el diff como revisor adversarial, nombra ≥1 debilidad y arréglala o
   anótala en el ticket. Corre los AC del ticket + todos los gates. Tienen que poder fallar.
6. **Verde** → `[x]` con evidencia (`archivo:línea` o línea decisiva del output), commit
   `NN: <título>` (mensaje en español neutro, con las líneas de atribución que indique el
   harness), reescribe `## Estado` con el siguiente ticket y `git rev-parse --short HEAD`.
   **Rojo** → arregla.
7. **2 fallas seguidas** en el mismo ticket → PARA, anótalo bajo `## BLOQUEADO` con el error,
   sigue con la frontera.
8. Si `## Estado` contradice `git log --oneline`, **gana git log**.

## Gates HITL

- Ticket 01 (expone totales de dinero detrás de `PM_CLAVE` y crea una función security definer):
  tras verde, corre `/security-review` antes de cerrar. Confirma que el bloque no lleva nombres,
  cédulas, teléfonos ni referencias.
- Ticket 04 (producción y secretos): `/security-review` antes de cerrar; la confirmación de Mau
  sobre el doble conteo es una pregunta, no una suposición.
- Contradicción real entre el spec (#3), los tickets y el código → para y pregunta, no inventes.
- Comandos de producción bloqueados por el hook → `## BLOQUEADO` con los comandos exactos y la
  ruta absoluta del worktree para que Mau los corra con `!`; no insistas ni busques otra vía.

## Verificación independiente antes del Done global

> Antes de declarar Done, lanza **un subagente fresco** con el Agent tool. Pásale
> SOLO: la lista de criterios de aceptación de cada slice `[x]` y los gates del repo.
> No le pases tu contexto ni tu diff. Su tarea: **correr** cada check y devolver una
> línea por AC — `PASS|FAIL · <comando> · <línea decisiva del output>`. Un `FAIL`
> desmarca ese slice y reabre el loop; nunca lo discutas con argumentos, se resuelve
> con output.
>
> **Prueba de falibilidad.** El paso 3 lo autoevalúa quien escribió el check; acá
> se vuelve mecánico. Sobre árbol limpio (`git status --porcelain` vacío), por cada
> slice `[x]` con check propio:
>
> ```bash
> git checkout <sha>~1 -- <archivos de implementación del slice>  # deja el test nuevo, revierte el código
> <check del slice>                                               # DEBE dar ROJO
> git checkout HEAD -- <archivos de implementación del slice>    # restaurar SOLO lo revertido
> ```
>
> Archivo que el slice creó y no existía antes: bórralo en vez de revertirlo.
> Verde con el código viejo = el check no prueba nada: desmarca ese AC.
>
> **Revisión de calidad.** Solo si TODOS los AC dieron PASS — sobre un diff que
> va a cambiar es trabajo tirado. `/code-review` sobre el diff completo de la rama
> (`git diff <base>..HEAD`), no commit por commit: lo que este pase agrega sobre
> los gates es duplicación y sobre-ingeniería entre slices, y eso solo se ve en el
> conjunto. Reportas, no arreglas. Finding de **corrección** (bug, invariante
> debilitado, check que miente) reabre el loop en el slice que lo introdujo; finding
> de **calidad** va al reporte final y NO bloquea Done — si merece sobrevivir al
> reporte, es un comentario `ponytail:` en el código.

Un solo pase al cierre, no por ticket. Si el 04 quedó en BLOQUEADO, el pase se hace igual sobre
01 a 03.

## Done global

Todos `[x]`, los gates verdes, `/pm/` publicado muestra la columna Ticketera y `leer` en
producción trae el bloque. Al cerrar: `/f5` sobre los docs del repo, baja `supabase functions
serve`, el `http.server` que levantaste y `supabase stop` de tu stack propio, y `ExitWorktree`.
Reporte final en tres líneas: qué quedó, qué quedó en BLOQUEADO con sus comandos, y qué le toca
a Mau. Al terminar, tu rama se mergea fast-forward en `ticketera` y se empuja a
`vm/evento-pm-v2` (eso lo hace quien te lanzó, o Mau).

## Reglas que no se rompen

- `PM_CLAVE` nunca aprueba, rechaza ni emite: `pm` no gana acciones de escritura sobre `ordenes`
  ni `entradas`, y la función `admin` no cambia.
- El bloque `ticketera` nunca lleva nombres, cédulas, teléfonos, WhatsApp, referencias ni tokens:
  solo totales.
- El bloque nunca se guarda en `pm_versiones`, en el estado del navegador, en el respaldo JSON
  ni pasa por `validateState`.
- `real.sold` y `real.ticketsCollectedCents` conservan nombre, tipo y validación.
- Las migraciones existentes no se editan; las políticas RLS de `ordenes` y `entradas` no cambian;
  `resumen_ticketera()` no es ejecutable por `anon` ni `authenticated`.
- `app.js` y `supabase/functions/_shared/app.js` son idénticos byte a byte en cada commit.
- No se toca la ticketera (`ticketera/`), ni `revisar`, `admin`, `avisos`, `portero`, ni
  `BUILD.md`, `BUILD-portero.md`, `BUILD-avisos.md`, `.scratch/pm-compartida/`,
  `.scratch/portero/`, `.scratch/avisos/`.
- Nunca `db reset`, `--force` ni borrado de filas contra producción.
