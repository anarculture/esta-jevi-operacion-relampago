# BUILD: cotejo duro de comprobantes y lectura al subir la captura (issues #6 y #7)

## Estado  <!-- lo actualiza el loop en el paso 6 -->
- Ticket actual: 04
- Último verde: 03 · commit (ver `git log --oneline -1`) · 27-oct-2026
- Gates: build ✅ · test ✅ · smoke ✅
- Bloqueado: —
- Rama de trabajo: `cotejo` (worktree `.claude/worktrees/alfa`, base 39b1b46 de `ticketera`)
- Merge de `ticketera` (8dfb7c6: issue #3 en producción y fixes del code-review de producción) antes
  del 04. Migraciones del cotejo renumeradas tras `20261027200000_resumen_ticketera`: `20261027210000_sufijo_referencia`,
  `…210100_pagador`, `…210200_lecturas` (así `db push` no necesita `--include-all`). `pm-ticketera.mjs`
  y `pm-navegador.mjs` pasan `p_pagador`. `resumen_ticketera()` no cambia: el cotejo no agrega estados a `ordenes`.
- Servicios: Supabase local `project_id = "cotejo"`, API 57321, DB 57322 (`supabase_db_cotejo`), studio 57323, inbucket 57324, analytics 57327; `functions serve` sobre ese stack; `http.server` en 8793

Specs: https://github.com/anarculture/sindicato-baba/issues/6 (puntos 1, 2 y 5; el 3 "memo
#N" y el 4 "Binance por API" quedan fuera de este BUILD: el 3 exige reservar número antes de
pagar y el 4 exige claves de Mau y un pago real) y https://github.com/anarculture/sindicato-baba/issues/7
(completo). Léelos antes del ticket 01: `gh issue view 6 --repo anarculture/sindicato-baba` y
`gh issue view 7 …`. También `docs/research/autenticidad-comprobantes.md`. Tickets en
`.scratch/cotejo/issues/`. Otro build corre en paralelo en este repo: `BUILD-pm-ticketera.md`
(issue #3, toca `supabase/functions/pm`, `app.js`, `index.html` de la raíz y una migración
`resumen_ticketera`): no toques sus archivos; si necesitas algo suyo, `git merge ticketera`
cuando esté ahí. `BUILD.md`, `BUILD-portero.md` y `BUILD-avisos.md` ya terminaron: solo referencia.

## Setup (una vez)

1. Aísla el trabajo: estás en un worktree propio creado por el harness desde la rama
   `ticketera`; comprueba con `git log --oneline -1` que tu HEAD desciende de `ticketera`
   (02c6117 o posterior). Anota la rama en `## Estado`. Todo corre dentro de ese worktree; nunca
   hagas `cd` al checkout principal ni a otros worktrees.
2. Servicios locales: stack propio de Supabase. Edita `project_id` en `supabase/config.toml` de tu
   worktree (p. ej. `cotejo`) y puertos libres (`api.port`, `db.port`, `studio.port`,
   `inbucket.port`, `analytics.port`; otros builds usaron 553xx, 563xx y quizá 573xx; comprueba
   con `ss -ltn`), luego `supabase start`. Anota API y contenedor de base en `## Estado`; los
   tests HTTP aceptan `API=http://127.0.0.1:<api.port>` y `DB_CONTAINER=supabase_db_<project_id>`.
   Funciones: `supabase functions serve --env-file supabase/functions/.env` en background
   (`run_in_background`). `supabase/functions/.env` (ignorado por git) necesita `ADMIN_CLAVE`,
   `OPENROUTER_API_KEY` y `PM_CLAVE`. Sin `OPENROUTER_API_KEY` los tests que usan OCR real
   (`flujo.mjs`, `auto-aprobar.mjs`, `lectura.mjs`) no valen: consíguela del `.env` del checkout
   principal (`cat`, no `cp`).
3. Gates reales del repo, tal cual existen hoy:
   - SQL: `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql`
   - HTTP: `node supabase/tests/flujo.mjs <imagen.png>` (una captura real o la de
     `pruebas-e2e/` del checkout principal si existe; si no, genera una con
     `supabase/tests/recibo-sintetico.html`), `auto-aprobar.mjs`, `avisos.mjs`, `portero.mjs`,
     `pm.mjs`. Los que usan OCR real pueden fallar por red o por un 502 del Kong local: repite una
     vez antes de culpar al código.
   - Deno: `deno test supabase/functions/`
   - Página: `node ticketera/tests/ux.mjs` (Playwright-core en
     `~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core`, Chrome en
     `/usr/bin/google-chrome`; capturas en `ticketera/tests/evidencia/`, ignoradas por git). Sus
     casos interceptan `rpc`/`funcion` con fixtures: mira el helper `pagina` antes de añadir casos.
   - Smoke: `python3 -m http.server <puerto libre> --bind 127.0.0.1` desde el worktree;
     `ticketera/index.html` responde 200 y contiene "Tu WhatsApp" y, desde el ticket 03, "Leímos".
4. Hooks del entorno: `curl`/`wget` están redirigidos; usa `python3 -c` con `urllib` o `fetch`
   en Node. `grep` es `rg` (sintaxis ripgrep: `-e` por patrón, `-F` literal). `cp` pide
   confirmación: usa `cat > destino`. Los comandos que escriben en producción (`db push`,
   `functions deploy`, `git push`, `secrets set`) suelen quedar bloqueados por el hook de
   permisos: no los rodees, anótalos en `## BLOQUEADO` (ticket 04).
5. Secretos: nunca imprimas `ADMIN_CLAVE`, `PM_CLAVE`, `OPENROUTER_API_KEY` ni nada del `.env`
   en la salida, en commits ni en mensajes; léelos de archivos y pásalos por variables de entorno.

## Tu rol

Desarrollador autónomo. Construyes los 4 tickets sin pedir confirmación, salvo gate HITL o
contradicción real entre specs. Decisiones de producto congeladas (no se reabren):

- Referencia mínima de 6 caracteres normalizados; unicidad por `(tipo, sufijo de 6)` además de
  `(tipo, referencia)`. Una terminación leída por OCR que ya está en otra orden es `no_coincide`.
- Datos del pagador por método (pago móvil: banco, teléfono, cédula; Zelle: titular; Binance: ID
  o nickname) en `ordenes.pagador`, visibles solo con `ADMIN_CLAVE`. El cotejo con lo leído es una
  duda, nunca un rechazo.
- La captura se sube y se lee al elegirla (función `lectura`, tabla `lecturas`, rate limit por IP);
  `revisar` reutiliza la lectura. La referencia precargada es editable y nunca pisa una tecleada.
- El OCR vive en `_shared/ocr.ts` y lee además hora de la transacción y datos del emisor.
- `coincide` sigue aprobando sola con `config.auto_aprobar`; `dudoso` y `no_coincide` van a Mau.
- Memo "Sindicato #N" y Binance por API quedan fuera; no se preparan ganchos para ellos.
- Sin dependencias nuevas de npm, Deno ni de la VM.

## Tickets

- [x] 01 · Unicidad por sufijo de la referencia · Bloqueado por: — · → .scratch/cotejo/issues/01-unicidad-por-sufijo.md
- [x] 02 · Datos del pagador · Bloqueado por: 01 · → .scratch/cotejo/issues/02-datos-del-pagador.md
- [x] 03 · El OCR precarga la referencia al subir la captura (y lee la hora) · Bloqueado por: 02 · → .scratch/cotejo/issues/03-ocr-precarga-referencia.md
- [ ] 04 · Producción · Bloqueado por: 03 · → .scratch/cotejo/issues/04-produccion.md

## BLOQUEADO

### 04 · Producción: espera el OK explícito de Mau (27-oct-2026)

No es el hook: el General pidió no desplegar hasta que Mau autorice. `crear_orden` cambia de firma
(pide `p_pagador`): **entre el paso 2 y el paso 4 la página publicada vieja no puede comprar**. Pages
tarda 1 a 2 min. Correrlos seguidos, fuera del horario de venta fuerte. Rama `cotejo` en el worktree
`/home/acracia/Code/sindicato-baba/.claude/worktrees/alfa`. El push es fast-forward: la rama contiene
`origin/vm/evento-pm-v2` (8dfb7c6). Este worktree no está enlazado a producción
(`supabase/.temp/project-ref` no existe), por eso el paso 0. En `supabase/config.toml` quedan sin
commitear el `project_id` y los puertos del stack local; no afectan a `--linked` ni a `--project-ref`.

```
! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase link --project-ref ptbzdepejxxlavqfyepw
! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase db query --linked "select tipo, right(referencia, 6) as sufijo, count(*) from ordenes group by 1, 2 having count(*) > 1"
! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase db push --linked --dry-run
! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase db push --linked --yes
! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase functions deploy revisar admin lectura --project-ref ptbzdepejxxlavqfyepw
! git -C /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa push origin HEAD:vm/evento-pm-v2
```

- Paso 0 (`link`): enlaza el worktree; con la sesión del CLI de Mau no hace falta clave.
- Paso 1 (assert de la migración 01 contra producción): debe dar **0 filas**. Si trae alguna, no sigas:
  dos órdenes del mismo tipo terminan igual y la migración fallaría; se decide a mano.
- Paso 2 (`--dry-run`): debe listar exactamente `20261027210000_sufijo_referencia.sql`,
  `20261027210100_pagador.sql` y `20261027210200_lecturas.sql`.
- Pasos 3 a 5: migraciones, funciones (`revisar` reutiliza la lectura, `admin` devuelve `pagador`,
  `lectura` es nueva con `verify_jwt = false`) y página. Secretos: `OPENROUTER_API_KEY` y
  `ADMIN_CLAVE` ya existen en producción; no hace falta `secrets set`.

Verificación después (Mau o un agente con permisos de producción):

6. `supabase migration list --linked` muestra las tres aplicadas y ninguna pendiente.
7. `https://postropicalia.com/sindicato-baba/index.html` responde 200 y contiene "Leímos";
   `admin.html` contiene "desde". Ojo: el AC del ticket 04 pide "los últimos 6 caracteres" en
   `index.html`, pero el ticket 03 cambió el hint; esa frase vive en `comun.js` (`ERRORES.referencia_invalida`).
8. `lectura` con un `path` inexistente bien formado responde 404 (y uno mal formado, 400); `admin` con
   clave mala sigue dando 401.
9. Compra de prueba en la página publicada: 1 entrada, referencia `PRUEBACOTEJO1` (corrige la que
   precargue la lectura), datos del pagador y el WhatsApp de Mau (04145287337). En el panel se ve con
   "desde …" y su dictamen. Luego
   `! cd /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa && supabase db query --linked -f supabase/manual/borrar-prueba-cotejo.sql`
   imprime 0 (borra la orden, sus entradas y la fila de `lecturas` de su captura).
10. `git -C /home/acracia/Code/sindicato-baba/.claude/worktrees/alfa grep -n "$(cat ~/.config/sindicato-baba/admin_clave)"` sale 1.
11. Mau confirma que el formulario publicado le precargó la referencia desde su teléfono.

## Loop por ticket (lazy-fable)

1. **Frontera**: toma el primer ticket cuyos bloqueantes estén `[x]`. Si un bloqueante está en
   `## BLOQUEADO`, hereda el bloqueo: sáltalo.
2. **Mira antes de mapear**: lee el archivo del ticket y el código que va a tocar
   (`codegraph_explore` con `projectPath` del worktree, o `rg`). No mapees sobre código que no viste.
   Referencias obligadas: `supabase/migrations/20261024000000_ticketera.sql` (tabla `ordenes`,
   `normalizar_referencia`, `ver_orden`, bucket y política de `capturas`),
   `20261027120000_avisos.sql` (`crear_orden` vigente con `p_whatsapps`, `resolver_orden`),
   `20261027120300_whatsapp_sin_cero.sql` (forma de una función con `revoke`),
   `supabase/functions/revisar/index.ts` (prompt, `SCHEMA`, `leer`, `capturaDeUnaSolaOrden`,
   flujo de `serve`), `_shared/dictamen.ts` y `dictamen.test.ts`, `_shared/db.ts`,
   `supabase/functions/admin/index.ts` (`cola`), `ticketera/index.html` (`validar`, `subirCaptura`,
   `change` de `#captura`, `submit`, borrador), `ticketera/comun.js` (`ERRORES`, `rpc`, `funcion`,
   `normalizarWhatsapp`), `ticketera/admin.html` (render de la orden y buscador),
   `ticketera/tests/ux.mjs` (helper `pagina` y fixtures), `supabase/tests/ticketera.sql`,
   `auto-aprobar.mjs`, `avisos.mjs` (cómo crear y resolver órdenes desde un test),
   `supabase/manual/plantilla-venta-manual.sql`, `DESIGN.md`, `docs/research/autenticidad-comprobantes.md`.
3. **Mapa de etapas** (escrito, corto): `Etapa N: <qué> → <artefacto> · check: <comando>`. Etapa
   sin check verificable → fusiónala con la siguiente. Si lo que aprendes invalida el mapa,
   reescríbelo.
4. **Ship lazy por etapa**: el mínimo diff que pasa su check. Reusa lo existente, cero
   abstracciones nuevas, no agregues deps si lo instalado alcanza. Atajo deliberado → comentario
   `ponytail:` con su techo. Corre el check de la etapa; un arreglo en N que rompe M → re-corre M.
   Migraciones: una por ticket, con timestamp posterior a `20261027120300` y a la del issue #3
   (`resumen_ticketera`, si ya está en `ticketera`); nunca editar las existentes.
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

- Ticket 01 (cambia qué se aprueba sin humano) y 02 (datos personales nuevos): tras verde, corre
  `/security-review` antes de cerrar cada uno. Confirma que `ver_orden`, `ver_entrada` y el portero
  no exponen `pagador` ni `ocr_sufijo`.
- Ticket 03 (función anónima que gasta OCR y guarda lecturas): `/security-review`; confirma el
  rate limit y que la respuesta no trae datos de la cuenta de destino.
- Ticket 04 (producción y secretos): `/security-review`; la ventana sin ventas entre `db push` y
  Pages se acuerda con Mau (una pregunta).
- Contradicción real entre los issues, los tickets y el código → para y pregunta, no inventes.
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

Todos `[x]`, los gates verdes, la compra publicada precarga la referencia y el panel muestra al
pagador. Al cerrar: `/f5` sobre los docs del repo, baja `supabase functions serve`, el
`http.server` que levantaste y `supabase stop` de tu stack propio, y `ExitWorktree`. Reporte
final en tres líneas: qué quedó, qué quedó en BLOQUEADO con sus comandos, y qué le toca a Mau.
Tu rama se mergea fast-forward en `ticketera` y se empuja a `vm/evento-pm-v2` (eso lo hace quien
te lanzó, o Mau).

## Reglas que no se rompen

- Nada se aprueba sin dictamen `coincide` o sin Mau. `dudoso` y `no_coincide` jamás se aprueban solos.
- Una misma captura o una misma terminación de referencia nunca produce dos órdenes aprobadas.
- `pagador`, `ocr_sufijo`, el `ocr` completo y el WhatsApp completo nunca salen por una RPC
  anónima, por `ver_orden`, `ver_entrada`, el portero ni `lectura`.
- Las migraciones existentes no se editan; `entradas.token` sigue siendo lo que codifica el QR.
- El dictamen nunca suaviza una regla existente (tolerancia, ventana de fecha, destinatario) para
  que pase un test.
- No se toca `supabase/functions/pm`, `app.js`, `supabase/functions/_shared/app.js`, el
  `index.html` de la raíz, `BUILD-pm-ticketera.md`, `.scratch/pm-ticketera/`, ni los BUILD y
  `.scratch/` de los builds terminados.
- Nunca `db reset`, `--force` ni borrado de filas contra producción.
