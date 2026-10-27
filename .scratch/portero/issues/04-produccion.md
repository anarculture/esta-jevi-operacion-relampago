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

**Status:** done

- [x] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra la migración nueva aplicada en remoto.
- [x] `supabase secrets list --project-ref ptbzdepejxxlavqfyepw | grep -c PORTERO_CLAVE` imprime `1`.
- [x] `test -s ~/.config/sindicato-baba/portero_clave && stat -c %a ~/.config/sindicato-baba/portero_clave` imprime `600`.
- [x] Con la clave del archivo, `POST https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/portero` con `{accion:"resumen"}` responde 200 y JSON con `aprobadas`; con clave mala responde 401.
- [x] `checkin` del código de la entrada `PRUEBAPORTERO1` en producción responde `valida` la primera vez y `ya_usada` la segunda, con la misma `checked_in_at`.
- [x] `curl -s -o /dev/null -w '%{http_code}' https://anarculture.github.io/sindicato-baba/ticketera/portero.html` imprime `200` (reintentar hasta 5 min tras el push).
- [x] `git grep -n "$(cat ~/.config/sindicato-baba/portero_clave)"` no encuentra nada (sale 1).

## Cierre (2026-10-26)

Evidencia:
- `migration list` en remoto: `{"local":"20261027000000","remote":"20261027000000"}`.
- `secrets list | grep -c PORTERO_CLAVE` → `1`; `stat -c %a ~/.config/sindicato-baba/portero_clave` → `600`.
- Producción con la clave del archivo: `resumen 200 {"aprobadas":5,"ingresadas":0}`; clave mala → `401`.
- `PRUEBAPORTERO1` (orden #5): `checkin 1 valida … 2026-10-27T02:53:10.779818+00:00`, `checkin 2 ya_usada …` con la misma hora.
- Push `383010f..61eca82` a `vm/evento-pm-v2` (fast-forward). `https://postropicalia.com/sindicato-baba/ticketera/portero.html`
  → 200 con la versión nueva al primer intento.
- `git grep -q -F -f portero_clave` → exit 1 (en HEAD, en `vm/evento-pm-v2` y en todo el historial).
- Clave entregada a Mau por zenity (diálogo cerrado, exit 0). /security-review: sin hallazgos ≥ 8.

Desviaciones y notas:
- Primera `migration list`: producción tenía `20261026120000_pm_compartida.sql` y esta rama no. No era producción
  desviada: la migración ya estaba en `origin/vm/evento-pm-v2` (build `pm-compartida`). Se mergeó esa rama (conflicto
  trivial en `config.toml`: se conservaron `portero` y `pm`), se repitieron todos los gates en verde y la lista cuadró.
- La URL del AC (`anarculture.github.io/sindicato-baba/…`) responde ahora `301` a `postropicalia.com/sindicato-baba/…`
  (dominio propio, commit 249bdf4). El `200` se midió en el destino final. La página también sale en la raíz (`/portero.html`).
- `orden-prueba-portero.sql` usa dos sentencias: con una sola, la primera corrida no devolvía el código (el select no ve lo
  que insertan los CTE). `orden-madeidk.sql` tiene el mismo detalle y no se tocó.
- La entrada de prueba cuenta en el contador del portero (+1 aprobada, +1 ingresada). Si molesta, se borra por SQL.
- Ninguna entrada real recibió check-in.
- Bajo umbral (security-review): la clave pasó por argv de zenity mientras el diálogo estaba abierto (laptop de un usuario).
