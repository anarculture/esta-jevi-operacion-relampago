# BUILD: WhatsApp por entrada, aprobación automática y aviso por vytas

## Estado  <!-- lo actualiza el loop en el paso 6 -->
- Ticket actual: 03
- Último verde: 02 · commit (ver git log) · 2026-10-26 (01 en 41ac3bc; `git merge ticketera` hecho en 46873d1)
- Gates: build ✅ (sin build) · test ✅ SQL, ux, deno, flujo, auto-aprobar · smoke ✅ 8790 "Tu WhatsApp"
- Bloqueado: —
- Rama de trabajo: `worktree-agent-af9623a6e11453d53` (worktree `.claude/worktrees/agent-af9623a6e11453d53`; base: rama del portero ya publicada en `origin/vm/evento-pm-v2` + `git merge ticketera`)
- Servicios: gate SQL en el stack compartido `sindicato-baba-ticketera` (54322; ahí apliqué con `migration up` la del portero y la mía, sin `db reset`, y sembré la orden `PREMIGRACIONAVISOS` antes de la migración para que el assert de backfill muerda). El hook de permisos no deja parar el `functions serve` de `pm-compartida` en 54321 ni escribir por HTTP en esa base, así que los gates HTTP corren en un stack propio `avisos` (API 56321, DB 56322; `API=http://127.0.0.1:56321`), igual que el portero con el suyo en 55321. Smoke en el puerto 8790 (el 8787 lo ocupa un `http.server` del worktree `ticketera`).

Spec: https://github.com/anarculture/sindicato-baba/issues/5 (léela completa antes del ticket 01:
`gh issue view 5 --repo anarculture/sindicato-baba`). Tickets en `.scratch/avisos/issues/`.
Otros builds en paralelo en este repo: `BUILD.md` (plataforma compartida, issue #2) y
`BUILD-portero.md` (check-in, issue #4). No los leas ni los edites; sus archivos son suyos.

## Setup (una vez)

1. Aísla el trabajo: estás en un worktree propio creado por el harness desde la rama
   `ticketera`; comprueba con `git log --oneline -1` que tu HEAD desciende de `ticketera`.
   Anota la rama en `## Estado`. Todo corre dentro de ese worktree.
2. Servicios locales: `supabase start` (Docker; contenedor de base
   `supabase_db_sindicato-baba-ticketera`, confirma con `docker ps --format '{{.Names}}' | grep supabase_db`).
   Si otro build ya tiene Supabase local arriba, compártelo: no lo reinicies ni hagas
   `supabase db reset` sin avisar en `## Estado`; aplica tu migración con `supabase migration up`.
   Funciones: `supabase functions serve --env-file supabase/functions/.env` en background
   (`run_in_background`); si ya hay una sirviendo en el puerto 54321 de otro worktree, párala y
   sirve desde el tuyo (las funciones se montan desde la carpeta del worktree activo).
   `supabase/functions/.env` (ignorado por git) necesita `ADMIN_CLAVE`, `OPENROUTER_API_KEY` y
   `PM_CLAVE` (genera una de 32+ caracteres si falta).
3. Gates reales del repo, tal cual existen hoy:
   - SQL: `docker exec -i supabase_db_sindicato-baba-ticketera psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql`
   - HTTP: `node supabase/tests/flujo.mjs <imagen.png>` (no lo rompas) y los nuevos `auto-aprobar.mjs`, `avisos.mjs`
   - Deno: `deno test supabase/functions/`
   - Página: `node ticketera/tests/ux.mjs` (Playwright-core en `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`, Chrome en `/usr/bin/google-chrome`; capturas en `ticketera/tests/evidencia/`, no versionadas)
   - Smoke: `python3 -m http.server 8787 --bind 127.0.0.1` desde el worktree; `index.html` de la ticketera responde 200 y contiene "Tu WhatsApp".
4. Hooks del entorno: `curl`/`wget` están redirigidos; usa `python3 -c` con `urllib` o `fetch`
   en Node. Los comandos que escriben en producción pueden quedar bloqueados por el hook de
   permisos: no los rodees, anótalos en `## BLOQUEADO` (ticket 05). `ssh aios-vm` funciona sin
   contraseña; el usuario allí es `developer` y Hermes vive en `~/.hermes`.
5. Secretos: nunca imprimas `PM_CLAVE`, `ADMIN_CLAVE` ni claves de API en la salida, en commits
   ni en mensajes; léelos de archivos y pásalos por variables de entorno.

## Tu rol

Desarrollador autónomo. Construyes los 5 tickets sin pedir confirmación, salvo gate HITL o
contradicción real entre specs. Decisiones de producto congeladas (no se reabren):

- Un WhatsApp por entrada; el primero es el del comprador y sigue en `ordenes.telefono`.
- `coincide` aprueba sola; `dudoso` y `no_coincide` van a la cola de Mau; interruptor
  `config.auto_aprobar`.
- Los avisos salen del número de vytas (`hermes send` en `aios-vm`), nunca del de Mau.
- El texto del aviso lo arma el servidor (una sola fuente); lleva enlace, no PNG.
- Las entradas anteriores a la migración quedan avisadas por backfill: nunca reciben mensaje.
- Las RPC anónimas devuelven el WhatsApp enmascarado (4 dígitos); el completo solo con clave.
- Sin dependencias nuevas de npm ni de la VM.

## Tickets

- [x] 01 · WhatsApp por entrada, de punta a punta · Bloqueado por: — · → .scratch/avisos/issues/01-whatsapp-por-entrada.md
- [x] 02 · Aprobación automática con `coincide` · Bloqueado por: 01 · → .scratch/avisos/issues/02-auto-aprobar.md
- [ ] 03 · Función `avisos` y panel · Bloqueado por: 01 · → .scratch/avisos/issues/03-funcion-avisos-y-panel.md
- [ ] 04 · vytas envía · Bloqueado por: 03 · → .scratch/avisos/issues/04-vytas-envia.md
- [ ] 05 · Producción · Bloqueado por: 02, 04 · → .scratch/avisos/issues/05-produccion.md

## Loop por ticket (lazy-fable)

1. **Frontera**: toma el primer ticket cuyos bloqueantes estén `[x]`. Si un bloqueante está en
   `## BLOQUEADO`, hereda el bloqueo: sáltalo.
2. **Mira antes de mapear**: lee el archivo del ticket y el código que va a tocar
   (`codegraph_explore` con `projectPath` del worktree, o grep). No mapees sobre código que no viste.
   Referencias obligadas: `supabase/migrations/20261026000000_tanda1_ux.sql` (`crear_orden`,
   `resolver_orden`, `ver_orden`, `ver_entrada`, grants), `supabase/functions/revisar/index.ts`
   y `_shared/dictamen.ts`, `supabase/functions/admin/index.ts`, `ticketera/index.html`
   (formulario, borrador, `validar`), `ticketera/orden.html`, `ticketera/entrada.html`,
   `ticketera/admin.html`, `ticketera/comun.js`, `ticketera/tests/ux.mjs` (helper `pagina`),
   `supabase/tests/flujo.mjs` y `recibo-sintetico.html`, `DESIGN.md`.
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

- Tickets 02 (aprueba dinero sin humano), 03 (clave y datos personales) y 05 (producción y
  secretos): tras verde, corre `/security-review` antes de cerrar cada uno.
- Ticket 04: el envío real al WhatsApp de Mau requiere su confirmación (una pregunta, 30 min).
- Contradicción real entre el spec (#5), los tickets y el código → para y pregunta, no inventes.
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

Todos `[x]`, los gates verdes, la compra publicada pide "Tu WhatsApp", el cron de vytas activo y
la orden de prueba avisada y borrada. Al cerrar: `/f5` sobre los docs del repo, baja
`supabase functions serve` y el `http.server` que levantaste (`supabase stop` solo si lo
arrancaste tú y ningún otro build lo usa), y `ExitWorktree`. Reporte final en tres líneas: qué
quedó, qué quedó en BLOQUEADO con sus comandos, y qué le toca a Mau.

## Reglas que no se rompen

- Nada se aprueba sin dictamen `coincide` o sin Mau. `dudoso` y `no_coincide` jamás se aprueban solos.
- El número completo de WhatsApp nunca sale por una RPC anónima ni por `ver_entrada`.
- Las entradas existentes antes de la migración no reciben avisos (backfill de `avisada_en`).
- Un aviso marcado `ok` no se vuelve a enviar salvo `reenviar_aviso` explícito desde el panel.
- Las migraciones existentes no se editan; `entradas.token` sigue siendo lo que codifica el QR.
- No se toca `BUILD.md`, `BUILD-portero.md`, `.scratch/pm-compartida/`, `.scratch/portero/`,
  `app.js` ni el `index.html` de la raíz (pertenecen a otros builds). Si necesitas algo que el
  portero añadió (p. ej. su migración), espera a que esté en `ticketera` y haz `git merge ticketera`.
- Nunca se debilita un test ni un grant para que algo pase. Si no cuadra, el bug es tuyo.
- Español neutro en todo lo que escribas (sin voseo); nombres en el código en español como el
  resto de la ticketera.
