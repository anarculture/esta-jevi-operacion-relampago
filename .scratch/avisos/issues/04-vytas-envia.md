# 04: vytas envía

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/5

**What to build:** en `aios-vm`, un sondeo cada minuto pide a `avisos` las entradas pendientes
y, por cada una, vytas manda el texto al WhatsApp indicado con `hermes send` y reporta el
resultado; si vytas se cae, las pendientes esperan y salen al volver; un sondeo repetido no
duplica mensajes (el servidor ya marcó la entrada). Mau recibe en su propio WhatsApp un mensaje
de prueba enviado por vytas con una entrada de prueba local.

Decisiones congeladas:

- Script `~/.hermes/scripts/avisos-entradas.sh` en la VM (bash + `python3` para JSON, sin
  dependencias nuevas): lee `PM_CLAVE` y `AVISOS_URL` de `~/.hermes/.env`, llama `pendientes`,
  por cada entrada ejecuta `hermes send -t whatsapp:<jid> --json "<texto>"` y reporta
  `avisada` con `ok` según el exit code y la salida JSON (el error va en `error`, recortado a
  200 caracteres). Opción `--dry-run`: imprime una línea por entrada (`DRY <jid> <primeros 60
  caracteres del texto>`) sin enviar ni marcar. Opción `--url <base>` para apuntar al Supabase
  local desde la laptop en pruebas.
- Programación con `hermes cron` (comando real de la VM: `hermes cron create`), cada minuto,
  ejecutando el script; `hermes cron list` debe mostrarlo. Si `hermes cron` no admite ejecutar
  un script de shell, usar un timer de `systemd --user` y dejarlo anotado en el ticket.
- `hermes send -t whatsapp:<jid>`: antes de programar nada, probar una vez a mano contra el
  WhatsApp de Mau (`CONTACTO_WA` de `comun.js`, formato `<dígitos>@s.whatsapp.net`) y confirmar
  que llega a un número sin chat previo. Si no llega, el ticket va a BLOQUEADO con la salida
  exacta del comando; no se intenta otra librería.
- `PM_CLAVE` en la VM: si el ticket 04 del issue #2 ya la dejó en `~/.hermes/.env`, se reutiliza.
  Si no, se copia por `ssh` desde `~/.config/sindicato-baba/pm_clave` sin imprimirla.
  `AVISOS_URL` apunta a producción (`https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/avisos`);
  hasta que el ticket 05 despliegue, el cron se crea **en pausa** (`hermes cron pause`).
- Skill de vytas (`~developer/.hermes/skills/`, el del issue #2 si existe; si no, uno nuevo
  `ticketera-avisos`): qué es la ticketera, que los avisos salen de su número, y que ante una
  respuesta de un comprador ("no me llega", "cambié de número", "quiero devolver") avise a Mau
  con el número y el texto, y no toque nada.
- Pruebas desde la laptop: el script se copia también a `supabase/tests/avisos-entradas.sh`
  (misma versión; un `cmp` por `ssh` exige que sean idénticos) y se corre con `--dry-run --url
  http://127.0.0.1:54321/functions/v1/avisos` contra el Supabase local con una orden de prueba.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `bash supabase/tests/avisos-entradas.sh --dry-run --url http://127.0.0.1:54321/functions/v1/avisos` (funciones sirviendo, orden de prueba aprobada con 2 WhatsApps) imprime 2 líneas `DRY …@s.whatsapp.net …` y `pendientes` sigue devolviendo 2 después.
- [ ] `ssh aios-vm 'cmp ~/.hermes/scripts/avisos-entradas.sh -' < supabase/tests/avisos-entradas.sh` sale 0.
- [ ] `ssh aios-vm 'hermes send -t whatsapp:<CONTACTO_WA>@s.whatsapp.net --json "Prueba de avisos de la ticketera (vytas)"'` sale 0 y Mau confirma que le llegó (gate HITL: pregúntale una vez; sin respuesta en 30 min → BLOQUEADO).
- [ ] `ssh aios-vm 'hermes cron list'` muestra el job de avisos (en pausa hasta el ticket 05).
- [ ] `ssh aios-vm 'grep -c "avisos" ~/.hermes/skills/*/SKILL.md'` encuentra al menos 1.
- [ ] `ssh aios-vm 'grep -c "^PM_CLAVE=" ~/.hermes/.env'` imprime 1 (sin imprimir el valor).
