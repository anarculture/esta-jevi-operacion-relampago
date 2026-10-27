# 03: Producción y acceso de Claude

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/2

**What to build:** la Edge Function `pm` y su tabla quedan vivas en el proyecto de producción
(`ptbzdepejxxlavqfyepw`), la plataforma publicada en GitHub Pages sincroniza contra ella, Claude
Code tiene la clave en un archivo local fuera del repo y puede leer por HTTP, y Mau recibe la
clave sin que pase por el chat.

Decisiones congeladas:

- `PM_CLAVE` la genera el agente (aleatoria, 32+ caracteres, por ejemplo `openssl rand -base64 33`).
  Va a: el secreto de Supabase de producción, `~/.config/sindicato-baba/pm_clave` (permisos 600) y
  a Mau por un diálogo `zenity --entry` con la clave precargada para copiar. Nunca se imprime en
  logs, commits ni en el chat. No se pasa por la línea de comandos donde quede en el historial:
  `supabase secrets set` se alimenta con un env-file temporal que se borra después.
- Antes de aplicar la migración: `supabase migration list` contra producción debe mostrar las dos
  migraciones existentes ya aplicadas. Si producción no coincide con el repo → BLOQUEADO, no
  forzar.
- GitHub Pages sirve la rama `vm/evento-pm-v2` desde la raíz: publicar es `git push origin
  HEAD:vm/evento-pm-v2` con los commits del build. Otra sesión (repintar-ticketera) también
  publica en esa rama: antes del push, `git fetch origin && git rebase origin/vm/evento-pm-v2`,
  vuelve a correr build + test, y recién entonces push. Conflicto en el rebase o push rechazado
  dos veces → BLOQUEADO. Nunca `--force`.
- **No escribir estado en producción en este ticket.** El primer guardado en producción tiene que
  ser el de Mau desde su navegador (sube lo que ya tenía); eso pasa en el ticket 04.

**Blocked by:** 01, 02

**Status:** done (commit del ticket 03)

- [x] `supabase migration list --linked` (con `--project-ref ptbzdepejxxlavqfyepw` o tras `supabase link`) muestra la migración nueva aplicada en remoto. · `('20261026120000', '20261026120000')`
- [x] `test -s ~/.config/sindicato-baba/pm_clave && stat -c %a ~/.config/sindicato-baba/pm_clave` imprime `600`. · `600` (44 caracteres, `openssl rand -base64 33`)
- [x] `supabase secrets list --project-ref ptbzdepejxxlavqfyepw | grep -c PM_CLAVE` imprime `1`. · `secrets_PM_CLAVE=1`
- [x] Con la clave del archivo, `leer` contra `https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm` responde 200 y JSON con `version`; con clave mala responde 401. · `http=200 {'version': 0, 'guardado_en': None, 'autor': None, 'estado': 'null'}` · `leer_mala=401`
- [x] `curl -s https://anarculture.github.io/sindicato-baba/app.js | grep -c 'functions/v1/pm'` imprime 1 o más (reintentar hasta 5 min tras el push; Pages tarda). · URL vigente: `curl -sL https://anarculture.github.io/sindicato-baba/pm/app.js` (redirige 301 a `https://postropicalia.com/sindicato-baba/pm/app.js`) → `pages_pm_app_js=1`; push `249bdf4..383010f`, run de Pages `40440053641` success
- [x] `git grep -n "$(cat ~/.config/sindicato-baba/pm_clave)"` no encuentra nada (sale 1). · `git_grep_exit=1`; tras el push y el rebase: `git_grep_clave=1`

Notas del agente:

- **URL de Pages cambiada después de escribir este ticket.** El commit `249bdf4` (Mau, otra sesión:
  "ci: publicar la ticketera como raíz de Pages") publica Pages con un workflow: la ticketera en la
  raíz y la plataforma PM en `pm/`. `https://anarculture.github.io/sindicato-baba/app.js` ahora da
  404 y la plataforma vive en `https://anarculture.github.io/sindicato-baba/pm/`. El AC de Pages se
  comprueba en `.../sindicato-baba/pm/app.js` (mismo check, ubicación vigente). **Corrección:** esta nota
  decía que el `localStorage` de Mau no se perdía; es falso. `anarculture.github.io` redirige (301) a
  `postropicalia.com`, que es otro origen: los datos de Mau quedaron en el `localStorage` del origen
  viejo (Firefox, savedAt 01:09Z) y su primera conexión subió la plantilla como versión 1. El
  coordinador recuperó el estado desde el disco (`~/Downloads/sindicato-baba-respaldo-recuperado.json`,
  pasa `parseBackup`) para que Mau lo importe desde la página.
- `supabase migration list --linked` antes de aplicar: `20261024000000` y `20261026000000` aplicadas
  en remoto, `20261026120000` pendiente; `db push --dry-run` aplicaría solo
  `20261026120000_pm_compartida.sql`.
- El clasificador de permisos del harness denegó dos veces `supabase db push --linked` (motivo
  `[Production Deploy]`). Mau corrió él mismo, desde el worktree, `supabase db push --linked --yes`
  (aplicó solo `20261026120000_pm_compartida.sql`), `supabase secrets set PM_CLAVE="$(cat
  ~/.config/sindicato-baba/pm_clave)"` (el `--env-file <(...)` falló con NotFound en
  `/proc/self/fd`; la clave no quedó escrita en el historial, solo el `$(cat ...)`) y
  `supabase functions deploy pm`. El agente verificó después solo con lecturas.
- `/security-review` del 03: el ticket no tiene diff de código (solo docs y operación). En su lugar
  se verificó el manejo de la clave: no está en el repo (`git grep` sale 1), el archivo local está
  en 600 y nunca se imprimió en logs ni en el chat.
- El dominio de Pages es `postropicalia.com` (`html_url` del sitio): `anarculture.github.io/...` redirige
  ahí con 301. La plataforma pública vive en `https://postropicalia.com/sindicato-baba/pm/`.
