# BUILD: plataforma del organizador compartida (Mau, Claude Code, vytas)

## Estado  <!-- lo actualiza el loop en el paso 6 -->
- Ticket actual: 01
- Último verde: — · commit — · —
- Gates: build ⬜ · test ⬜ · smoke ⬜
- Bloqueado: —
- Rama de trabajo: — (la anota el setup)

Spec: https://github.com/anarculture/sindicato-baba/issues/2 (léela completa antes del ticket 01:
`gh issue view 2 --repo anarculture/sindicato-baba`). Tickets en `.scratch/pm-compartida/issues/`.

## Setup (una vez)

1. Aísla el trabajo: crea un worktree con la herramienta `EnterWorktree` del harness (no
   `git checkout -b` en el directorio principal), partiendo de `vm/evento-pm-v2` en
   `/home/acracia/Code/sindicato-baba`. Anota el nombre de la rama en `## Estado`. Comprueba que
   `git rev-parse origin/vm/evento-pm-v2` es ancestro de tu HEAD
   (`git merge-base --is-ancestor origin/vm/evento-pm-v2 HEAD`).
2. Puertos: otro stack local de Supabase (`esta-jevi-ticketera`) ocupa 54321 y siguientes.
   Páralo conservando sus datos: `supabase stop --project-id esta-jevi-ticketera`. Su carpeta de
   trabajo ya no existe; al cerrar se reanuda con `docker start` (ver Done global).
3. Desde la raíz del worktree: `supabase start`. Crea `supabase/functions/.env` (ya está en
   `supabase/.gitignore`) con `ADMIN_CLAVE` y `PM_CLAVE` locales aleatorias de 32+ caracteres
   (`openssl rand -hex 24`). Son solo locales; nunca las de producción.
4. Levanta las funciones en background (con `run_in_background` del harness, no `nohup … &`):
   `supabase functions serve --env-file supabase/functions/.env`. Si el log muestra error de
   arranque, arréglalo antes de seguir.
5. Herramientas que ya están en la máquina y bastan: `node` (trae `fetch` y `WebSocket`),
   `deno`, `google-chrome`, `supabase` CLI, `gh`, `zenity`, `ssh aios-vm`. No instales deps nuevas.

## Tu rol

Eres un desarrollador autónomo. Construye todos los tickets sin pedir confirmación, salvo la
pausa humana del ticket 04 y las paradas que este documento ordena. Decisiones de producto
congeladas (no las reabras):

- Estado de la plataforma en Supabase de la ticketera, tabla solo de inserción con versión, fecha
  y autor; una sola Edge Function `pm` con clave propia `PM_CLAVE`, distinta de `ADMIN_CLAVE`.
- Contrato `pm`: `leer` (opcional `version`), `guardar` con `base`/`autor`/`estado`, `versiones`.
  401 clave mala, 409 base vieja (devuelve la vigente), 400 estado inválido con `errores`.
  Autor ∈ `navegador`/`claude`/`vytas`. No hay acción de borrado. La respuesta de `leer` es un
  objeto plano extensible: otra spec (repintar-ticketera, bloqueada por 01 y 02) le añadirá un
  bloque `ticketera` calculado al momento; los clientes ignoran claves que no conocen.
- `real.sold` y `real.ticketsCollectedCents` son solo ventas fuera de la ticketera. La orden #2
  está en la ticketera y **no se registra a mano** (decisión de Mau: evita doble conteo).
- El servidor valida con `validateState` de `app.js` mediante una copia byte a byte en la carpeta
  compartida de funciones; el gate `cmp` la mantiene idéntica.
- Navegador: sin clave, igual que hoy. Con clave: carga al abrir, sube lo local si el remoto está
  vacío, guarda con debounce de 1 a 2 s. Antes de reemplazar lo local por lo remoto, lo local va
  siempre a "respaldo anterior". 409 → respaldo + carga remoto + aviso. Sin red → "Guardado solo
  en este navegador". 401 → olvida la clave.
- Una sola clave compartida; sin cuentas ni roles. Sin Realtime. Sin poda de versiones.
  `SCHEMA_VERSION` sigue en 1. La sección Ventas no lee la ticketera (fuera de alcance).
- Pruebas: contrato HTTP por script Node (costura principal) y smoke del navegador por CDP.

## Tickets

- [ ] 01 · Edge Function `pm` con su tabla y contrato HTTP · Bloqueado por: — · → .scratch/pm-compartida/issues/01-edge-function-pm.md
- [ ] 02 · El navegador sincroniza con `pm` · Bloqueado por: 01 · → .scratch/pm-compartida/issues/02-navegador-sincroniza.md
- [ ] 03 · Producción y acceso de Claude · Bloqueado por: 01, 02 · → .scratch/pm-compartida/issues/03-produccion-y-claude.md
- [ ] 04 · vytas usa la plataforma · Bloqueado por: 03 · → .scratch/pm-compartida/issues/04-vytas.md

## Gates

- **build:** `node -e "const M=require('./app.js'); process.exit(M.validateState(M.defaultState()).ok?0:1)"` y, desde el ticket 01, `cmp app.js supabase/functions/_shared/app.js`.
- **test:** `deno test supabase/functions/` · desde 01: `supabase db reset && node supabase/tests/pm.mjs` · desde 02: `supabase db reset && node supabase/tests/pm-navegador.mjs`. Tras cada `db reset`, si las funciones dejan de responder, reinicia `functions serve`.
- **smoke:** `curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:54321/functions/v1/pm -H 'Content-Type: application/json' -d '{"clave":"mala","accion":"leer"}'` imprime `401`.

## Loop lazy-fable por ticket

1. **Frontera**: toma el primer ticket cuyos bloqueantes estén `[x]`. Si un bloqueante está en
   `## BLOQUEADO`, hereda el bloqueo: sáltalo.
2. **Mira antes de mapear**: lee el archivo del ticket y el código que va a tocar (codegraph si
   está indexado, si no grep). No mapees sobre código que no viste.
3. **Mapa de etapas** (escrito, corto): `Etapa N: <qué> → <artefacto> · check: <comando>`. Etapa
   sin check verificable → fusiónala con la siguiente. Si lo que aprendes invalida el mapa,
   reescríbelo.
4. **Ship lazy por etapa**: el mínimo diff que pasa su check. Reusa lo existente (`_shared/db.ts`
   con `db`/`json`/`serve`, el patrón de `admin`, `backupBeforeReplace`/`readBackup` del modelo,
   el patrón LOCAL/API/KEY de `ticketera/comun.js`), cero abstracciones nuevas, no agregues deps.
   Atajo deliberado → comentario `ponytail:` con su techo. Corre el check de la etapa; un arreglo
   en N que rompe M → re-corre M.
5. **Autocrítica**: relee el diff como revisor adversarial, nombra ≥1 debilidad y arréglala o
   anótala en el ticket. Corre los AC del ticket + build + test. Tienen que poder fallar.
6. **Verde** → `[x]` con evidencia (`archivo:línea` o línea decisiva del output), commit
   `NN: <título>`, reescribe `## Estado` con el siguiente ticket y `git rev-parse --short HEAD`.
   **Rojo** → arregla.
7. **2 fallas seguidas** en el mismo ticket → PARA, anótalo bajo `## BLOQUEADO` con el error,
   sigue con la frontera.
8. Si `## Estado` contradice `git log --oneline`, **gana git log**.

## Gates HITL

- Los tickets 01, 02 y 03 tocan auth (clave) y datos con montos: tras verde, corre
  `/security-review` antes de cerrar cada uno. Un hallazgo de severidad alta o media reabre el
  ticket.
- Ticket 04 tiene la única pausa humana (Mau conecta su navegador); el procedimiento y el límite
  de 30 min están en su archivo.
- Contradicción real entre la spec (#2) y un ticket → para y pregunta; no inventes. Las reglas
  de este BUILD.md ganan sobre la spec donde la ajustan (respaldo antes de reemplazar, clave
  generada por el agente, copia de `app.js` con `cmp`).

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

Un solo pase al cierre de la tanda, no uno por ticket. Los AC de 03 y 04 que tocan producción
son de solo lectura en la verificación (`leer`, `versiones`, `curl`); la prueba de falibilidad
no aplica a ellos: nunca revertir ni re-desplegar producción para verificar.

## Done global

Todos `[x]`, build + test verdes, `functions serve` arranca, smoke pasa. Al cerrar:

1. `/f5`.
2. Fast-forward de la rama local: `git -C /home/acracia/Code/sindicato-baba merge --ff-only <rama de trabajo>`
   (el push a `origin vm/evento-pm-v2` ya lo hizo el ticket 03).
3. Baja lo que levantaste: detén `functions serve`, `supabase stop` en el worktree.
4. Reanuda el otro stack: `docker start $(docker ps -aq --filter label=com.supabase.cli.project=esta-jevi-ticketera)`
   y comprueba con `docker ps --filter label=com.supabase.cli.project=esta-jevi-ticketera --format '{{.Names}}' | wc -l` que hay contenedores corriendo.
5. `ExitWorktree`.
6. Reporte final con evidencia: salida de cada gate, líneas PASS de la verificación independiente,
   hallazgos de calidad, y riesgos (clave compartida, versiones sin poda).

## Reglas que no se rompen

- Las claves (`PM_CLAVE`, `ADMIN_CLAVE`, service role) nunca en el repo, en commits, en logs ni
  en el chat. La de producción vive solo en el secreto de Supabase, `~/.config/sindicato-baba/pm_clave`
  (600), `~developer/.hermes/.env` y el diálogo zenity a Mau.
- Las migraciones existentes no se editan; todo cambio de esquema va en una migración nueva.
- RLS activado en toda tabla nueva; `anon` no lee ni escribe el estado de la plataforma.
- `ordenes`, `entradas`, `config` y las funciones `admin`, `revisar` y `tasa` no se tocan.
- El modelo de `app.js` sigue siendo puro y cargable con `require` en Node; sin clave, la
  plataforma se comporta exactamente como antes. Exportar e importar respaldo JSON no cambian.
- Producción: no se escribe estado antes de que exista una versión con autor `navegador` (la de
  Mau). Nunca `db reset`, `--force` ni borrado de filas contra producción. Si `migration list`
  de producción no coincide con el repo → BLOQUEADO.
- Nunca debilites un AC o un validador para que pase un test; si no cuadra, el bug es del agente.
