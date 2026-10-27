# 04: Producción y prueba real

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/4

**What to build:** la migración y la función `portero` quedan vivas en el proyecto de producción
(`ptbzdepejxxlavqfyepw`), el secreto `PORTERO_CLAVE` existe, `portero.html` está publicado en
GitHub Pages con el resto de la ticketera, y una entrada de prueba creada para esto se valida de
verdad en producción: primera vez "valida", segunda "ya_usada". Mau recibe la clave sin que
pase por el chat.

Decisiones congeladas:

- `PORTERO_CLAVE` se genera aleatoria (32+ caracteres, `openssl rand -base64 33`), va al secreto
  de Supabase de producción por un env-file temporal que se borra (nunca por argumento de línea
  de comandos), a `~/.config/sindicato-baba/portero_clave` con permisos 600, y a Mau por
  `zenity --entry` con la clave precargada para copiar. No se imprime en logs, commits ni chat.
- Antes de aplicar la migración: `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw`
  debe mostrar todas las migraciones existentes aplicadas. Si producción no coincide con el
  repo → BLOQUEADO, no forzar.
- Los comandos que escriben en producción (`supabase db push`, `supabase functions deploy`,
  `supabase secrets set`) pueden quedar bloqueados por el hook de permisos del agente. Si pasa,
  el ticket queda en **BLOQUEADO** con los comandos exactos listados para que Mau los corra con
  `!` en su sesión; no se intenta rodear el bloqueo.
- Entrada de prueba: una orden manual con referencia `PRUEBAPORTERO1`, 1 entrada, insertada con
  el mismo patrón que `supabase/manual/orden-madeidk.sql` (archivo nuevo
  `supabase/manual/orden-prueba-portero.sql`, idempotente). **No se hace check-in de ninguna
  entrada real** (órdenes #2 y #3 incluidas).
- Publicar es mergear la rama de trabajo a `vm/evento-pm-v2` y `git push origin vm/evento-pm-v2`
  (Pages sirve esa rama desde la raíz). Si el checkout principal tiene cambios ajenos sin commit,
  el merge se hace con `git merge-tree --write-tree` + `git commit-tree` y push del SHA, sin tocar
  ese árbol (así se hicieron a7b2036 y a0dafe6).
- La prueba de cámara en un Android y un iPhone reales la hace Mau; el ticket la deja escrita
  como pendiente humano en el reporte final, no la bloquea.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra la migración nueva aplicada en remoto.
- [ ] `supabase secrets list --project-ref ptbzdepejxxlavqfyepw | grep -c PORTERO_CLAVE` imprime `1`.
- [ ] `test -s ~/.config/sindicato-baba/portero_clave && stat -c %a ~/.config/sindicato-baba/portero_clave` imprime `600`.
- [ ] Con la clave del archivo, `POST https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/portero` con `{accion:"resumen"}` responde 200 y JSON con `aprobadas`; con clave mala responde 401.
- [ ] `checkin` del código de la entrada `PRUEBAPORTERO1` en producción responde `valida` la primera vez y `ya_usada` la segunda, con la misma `checked_in_at`.
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://anarculture.github.io/sindicato-baba/ticketera/portero.html` imprime `200` (reintentar hasta 5 min tras el push).
- [ ] `git grep -n "$(cat ~/.config/sindicato-baba/portero_clave)"` no encuentra nada (sale 1).
