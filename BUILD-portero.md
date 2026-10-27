# BUILD: check-in del portero

## Estado  <!-- lo actualiza el loop en el paso 6 -->
- Ticket actual: 03
- Último verde: 02 · commit (ver git log; 01 = c123180) · 2026-10-26
- Gates: build ✅ · test ✅ · smoke ✅
- Bloqueado: —
- Rama de trabajo: `worktree-agent-a04ac3b55edd7ecf4` (worktree `.claude/worktrees/agent-a04ac3b55edd7ecf4`, creado por el harness; `ticketera` mergeada encima)
- Entorno: el stack local compartido (`sindicato-baba-ticketera`, 54321) lo usa en paralelo el build
  `pm-compartida` (su `functions serve` y sus `db reset`). Para no pisarnos, este build corre un stack
  propio con override por entorno, sin tocar `config.toml`:
  `env SUPABASE_PROJECT_ID=portero SUPABASE_API_PORT=55321 SUPABASE_DB_PORT=55322 SUPABASE_DB_SHADOW_PORT=55320 SUPABASE_DB_POOLER_PORT=55329 SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT=8183 supabase start -x realtime,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor`
  (y el mismo `env` delante de `supabase functions serve --env-file supabase/functions/.env`).
  Gates equivalentes: contenedor `supabase_db_portero`; `API=http://127.0.0.1:55321 DB_CONTAINER=supabase_db_portero`
  para `portero.mjs` y `API=…` para `flujo.mjs`; el 8787 lo ocupa un `http.server` del worktree `ticketera`,
  así que el smoke corre en 8788. En la config local de ese stack se activaron `pago_movil_bnc` y `zelle`.

Spec: https://github.com/anarculture/sindicato-baba/issues/4 (léela completa antes del ticket 01:
`gh issue view 4 --repo anarculture/sindicato-baba`). Tickets en `.scratch/portero/issues/`.
Este archivo se llama `BUILD-portero.md` porque `BUILD.md` en la raíz pertenece a otro build
(plataforma compartida, issue #2) que corre en paralelo: no lo leas ni lo edites.

## Setup (una vez)

1. Aísla el trabajo: crea un worktree con la herramienta `EnterWorktree` del harness desde
   `/home/acracia/Code/sindicato-baba/.claude/worktrees/ticketera` (rama base `ticketera`, que ya
   trae el CSS nuevo y el SQL de la orden manual). Nombre sugerido: `portero`. Anota la rama en
   `## Estado`. Todo lo demás corre dentro de ese worktree.
2. Servicios locales: `supabase start` (Docker; contenedor de base
   `supabase_db_sindicato-baba-ticketera`, confirma con `docker ps --format '{{.Names}}' | grep supabase_db`).
   Funciones: `supabase functions serve --env-file supabase/functions/.env` en background
   (`run_in_background`). Si `supabase/functions/.env` no tiene `PORTERO_CLAVE`, añade una línea
   `PORTERO_CLAVE=<aleatoria de 32+ caracteres>` (el archivo está ignorado por git).
3. Gates reales del repo, tal cual existen hoy:
   - SQL: `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql`
   - HTTP: `node supabase/tests/flujo.mjs <imagen.png>` (requiere funciones sirviendo; no lo rompas) y, nuevo, `node supabase/tests/portero.mjs`
   - Deno: `deno test supabase/functions/`
   - Página: `node ticketera/tests/ux.mjs` (Playwright-core desde `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`, Chrome en `/usr/bin/google-chrome`; capturas a `ticketera/tests/evidencia/`, no versionadas)
   - Smoke: `python3 -m http.server 8787 --bind 127.0.0.1` desde el worktree y `portero.html` responde 200.
4. Hooks del entorno: `curl`/`wget` están redirigidos por un hook; para HTTP usa `python3 -c`
   con `urllib` o `fetch` en Node. Los comandos que escriben en producción pueden quedar
   bloqueados por el hook de permisos: no los rodees, anótalos en `## BLOQUEADO` (ticket 04).

## Tu rol

Desarrollador autónomo. Construyes los 4 tickets sin pedir confirmación, salvo gate HITL o
contradicción real entre specs. Decisiones de producto congeladas (no se reabren):

- Clave del portero separada de la de admin (`PORTERO_CLAVE`); el portero no aprueba ni rechaza.
- `checkin` por token completo o por código de respaldo (8 primeros caracteres del token);
  ambiguo → inválida.
- Deshacer solo dentro de 5 minutos del check-in. Sin deshacer general.
- La lista descargable no lleva nombre, cédula ni teléfono.
- Colores y tipografía del resultado según `DESIGN.md` (verde neón, amarillo marcador, rojo aviso).
- Sin señal: validar contra la lista local, marcar local, encolar, reenviar al volver la red.
- Sin dependencias nuevas de npm; un decodificador QR vendido como archivo único es la única
  adición (ticket 02).
- Nunca se hace check-in de una entrada real en producción (ticket 04 usa `PRUEBAPORTERO1`).

## Tickets

- [x] 01 · Check-in por código de respaldo, de punta a punta · Bloqueado por: — · → .scratch/portero/issues/01-checkin-por-codigo.md · evidencia: `OK ticketera.sql` · `OK portero: orden #10, 4 ingresadas de 8 aprobadas` · `OK ux.mjs` (10 casos) · deno `7 passed` · `OK flujo` · 401 · smoke 200 · /security-review sin hallazgos
- [x] 02 · Escaneo con la cámara · Bloqueado por: 01 · → .scratch/portero/issues/02-camara.md · evidencia: `OK portero-camara.mjs` (1 checkin en 5 s; "Sin cámara" con permiso denegado) · `OK ux.mjs` · jsQR con 0 URLs
- [ ] 03 · Sin señal e imprimir · Bloqueado por: 01 · → .scratch/portero/issues/03-sin-senal.md
- [ ] 04 · Producción y prueba real · Bloqueado por: 02, 03 · → .scratch/portero/issues/04-produccion.md

## Loop por ticket (lazy-fable)

1. **Frontera**: toma el primer ticket cuyos bloqueantes estén `[x]`. Si un bloqueante está en
   `## BLOQUEADO`, hereda el bloqueo: sáltalo.
2. **Mira antes de mapear**: lee el archivo del ticket y el código que va a tocar
   (`codegraph_explore` con `projectPath` del worktree, o grep). No mapees sobre código que no viste.
   Referencias obligadas: `supabase/functions/admin/index.ts` (patrón de función con clave),
   `supabase/migrations/20261026000000_tanda1_ux.sql` (grants y `resolver_orden`),
   `ticketera/admin.html` y `ticketera/comun.js` (clave en `localStorage`, `funcion`, `ErrorRed`,
   `leer`/`guardar`), `ticketera/entrada.html` (qué codifica el QR), `ticketera/tests/ux.mjs`
   (helper `pagina` con fixtures y `offline`), `supabase/tests/flujo.mjs`, `DESIGN.md`.
3. **Mapa de etapas** (escrito, corto): `Etapa N: <qué> → <artefacto> · check: <comando>`. Etapa
   sin check verificable → fusiónala con la siguiente. Si lo que aprendes invalida el mapa,
   reescríbelo.
4. **Ship lazy por etapa**: el mínimo diff que pasa su check. Reusa lo existente, cero
   abstracciones nuevas, no agregues deps si lo instalado alcanza. Atajo deliberado → comentario
   `ponytail:` con su techo. Corre el check de la etapa; un arreglo en N que rompe M → re-corre M.
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

- Ticket 01 toca una clave y escribe en `entradas`; ticket 04 toca producción y secretos: tras
  verde, corre `/security-review` antes de cerrar cada uno.
- Contradicción real entre el spec (#4), los tickets y el código → para y pregunta, no inventes.
- Comandos de producción bloqueados por el hook → `## BLOQUEADO` con los comandos exactos para
  que Mau los corra con `!`; no insistas ni busques otra vía.

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

Un solo pase al cierre, no por ticket.

## Done global

Todos `[x]`, los cinco gates verdes, `portero.html` arranca y el smoke pasa. Al cerrar: `/f5`
sobre los docs del repo, baja `supabase functions serve` y el `http.server` que levantaste
(`supabase stop` solo si lo arrancaste tú), y `ExitWorktree`. Reporte final en tres líneas:
qué quedó, qué quedó en BLOQUEADO con sus comandos, y la prueba humana pendiente (cámara en
un Android y un iPhone contra producción).

## Reglas que no se rompen

- Nada se aprueba solo: el portero no cambia el estado de ninguna orden.
- `resolver_orden`, `crear_orden`, `ver_orden` y `ver_entrada` no cambian de firma ni de
  comportamiento. Las migraciones existentes no se editan.
- `entradas.token` sigue siendo lo que codifica el QR; no se reemiten entradas.
- Nunca se debilita un test ni un grant para que algo pase. Si no cuadra, el bug es tuyo.
- No se toca `BUILD.md`, `.scratch/pm-compartida/`, `app.js` ni el `index.html` de la raíz
  (pertenecen al otro build).
- Español neutro en todo lo que escribas (sin voseo); nombres en el código en español como el
  resto de la ticketera.
