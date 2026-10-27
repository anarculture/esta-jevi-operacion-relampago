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
  vm/evento-pm-v2` con los commits del build. Solo se publican commits del build.
- **No escribir estado en producción en este ticket.** El primer guardado en producción tiene que
  ser el de Mau desde su navegador (sube lo que ya tenía); eso pasa en el ticket 04.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] `supabase migration list --linked` (con `--project-ref ptbzdepejxxlavqfyepw` o tras `supabase link`) muestra la migración nueva aplicada en remoto.
- [ ] `test -s ~/.config/sindicato-baba/pm_clave && stat -c %a ~/.config/sindicato-baba/pm_clave` imprime `600`.
- [ ] `supabase secrets list --project-ref ptbzdepejxxlavqfyepw | grep -c PM_CLAVE` imprime `1`.
- [ ] Con la clave del archivo, `leer` contra `https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm` responde 200 y JSON con `version`; con clave mala responde 401.
- [ ] `curl -s https://anarculture.github.io/sindicato-baba/app.js | grep -c 'functions/v1/pm'` imprime 1 o más (reintentar hasta 5 min tras el push; Pages tarda).
- [ ] `git grep -n "$(cat ~/.config/sindicato-baba/pm_clave)"` no encuentra nada (sale 1).
