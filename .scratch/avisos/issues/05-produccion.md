# 05: Producción

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/5

**What to build:** todo vivo en producción (`ptbzdepejxxlavqfyepw`) y en Pages
(`https://postropicalia.com/sindicato-baba/`): la compra pide un WhatsApp por entrada, las
órdenes con `coincide` se aprueban solas, la función `avisos` responde con `PM_CLAVE`, el cron
de vytas está activo, y una orden de prueba con el WhatsApp de Mau recibe su aviso de vytas en
menos de 2 minutos; después se borra.

Decisiones congeladas:

- Antes de aplicar: `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` debe
  mostrar las migraciones existentes aplicadas (la del 24-oct se aplicó con `db query` y luego
  `migration repair`; si falta alguna del issue #4 porque ese build aún no desplegó, esta
  migración se aplica igual: no depende de ella). Producción distinta del repo → BLOQUEADO.
- Despliegue: migración (`supabase db push --linked` o `db query -f` + `migration repair`, el
  patrón que ya funcionó), `supabase functions deploy revisar admin avisos --project-ref …`,
  secreto `PM_CLAVE` ya existente (lo creó el issue #2) o creado con el mismo procedimiento
  (env-file temporal, archivo 600, zenity). Los comandos de producción pueden quedar bloqueados
  por el hook: entonces BLOQUEADO con los comandos exactos para que Mau los corra con `!`.
- Publicar: merge de la rama de trabajo a `vm/evento-pm-v2` y push (el workflow de Pages publica
  la ticketera en la raíz). Con cambios ajenos sin commit en el checkout principal, merge con
  `git merge-tree --write-tree` + `git commit-tree` y push del SHA.
- Prueba real: orden de prueba creada desde la página publicada con 1 entrada y el WhatsApp de
  Mau, aprobada desde el panel (no hace falta esperar a la IA), reanudar el cron de vytas en la VM,
  y Mau confirma el mensaje. Luego borrado con SQL (`entradas` y `ordenes` de esa referencia).
  **No se avisa a ninguna entrada real** durante la prueba: antes de reanudar el cron,
  `pendientes` en producción debe devolver solo la de prueba (las históricas quedaron avisadas
  por el backfill).

**Blocked by:** 02, 04

**Status:** ready-for-agent

- [ ] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra la migración nueva aplicada.
- [ ] Con `~/.config/sindicato-baba/pm_clave`, `POST …/functions/v1/avisos` `{accion:"pendientes"}` responde 200 y, antes de la prueba, lista vacía.
- [ ] `python3 -c` contra `https://postropicalia.com/sindicato-baba/index.html` encuentra "Tu WhatsApp" (reintentar hasta 5 min tras el push).
- [ ] El listado de crons de vytas en la VM muestra el job activo (no en pausa).
- [ ] La orden de prueba aparece en `pendientes`, y tras ≤ 2 min `cola` de `admin` la muestra con `avisada_en` no nulo; Mau confirma que recibió el mensaje de vytas (gate HITL).
- [ ] Tras el borrado, `select count(*) from ordenes where referencia like 'PRUEBAAVISO%'` imprime 0.
- [ ] `git grep -n "$(cat ~/.config/sindicato-baba/pm_clave)"` no encuentra nada (sale 1).
