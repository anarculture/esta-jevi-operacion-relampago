# 04: vytas usa la plataforma

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/2

**What to build:** vytas (Hermes Agent en `aios-vm`, home `~developer/.hermes`) lee y escribe el
estado de la plataforma con la misma Edge Function, guiado por un skill. Al cerrar, el estado de
Mau ya vive en producción (subido desde su navegador), vytas puede guardar y responde por
WhatsApp cuántas entradas llevamos con el dato de `leer`.

Decisiones congeladas:

- La clave va a `~developer/.hermes/.env` como `PM_CLAVE`, copiada por `ssh` desde el archivo local
  sin imprimirla. Si el gateway de WhatsApp necesita reiniciarse para leer el `.env`, se reinicia
  con el mecanismo que ya usa la VM (mira cómo corre antes de tocarlo).
- Skill nuevo en `~developer/.hermes/skills/` (sigue el formato de los skills que ya hay ahí):
  contrato de `pm`, ciclo leer → modificar → guardar con `base`, 409 → volver a leer y reaplicar,
  400 → leer `errores`; operaciones comunes con su campo (`real.sold`, `real.courtesies`,
  `real.ticketsCollectedCents` en centavos, `real.sponsorCollectedCents`,
  `real.ownContributionCents`, `tasks[].status`, `sponsors`, `budget`); reglas: ventas y cobros se
  **suman** a lo registrado, nada se borra de una lista sin confirmación de Mau, y tras guardar
  confirma el valor nuevo ("vendidas: N, cobrado: $X"). Autor siempre `vytas`.
- El skill incluye esta regla, tal cual: "Las ventas de la ticketera no se registran a mano:
  `real.sold` es solo para ventas hechas fuera de la ticketera. Si `leer` trae el bloque
  `ticketera`, cuántas llevamos = `ticketera.aprobadas.entradas` + `real.sold`. Si no lo trae,
  responde `real.sold` y aclara que faltan las de la ticketera."
- **La orden #2 no se registra a mano** (decisión de Mau): ya está aprobada en la ticketera y la
  cuenta el bloque `ticketera`. Sumarla a `real.sold` la contaría doble.
- **Pausa humana (única del build):** antes de cualquier escritura en producción, el agente avisa
  a Mau con `zenity --info` (abre https://anarculture.github.io/sindicato-baba/pm/ —la PM se movió a `pm/` en `249bdf4`—, pega la clave en
  "Datos y respaldo") y espera, consultando `leer` cada 30 s hasta 30 min, a que exista una
  versión con autor `navegador`. Si no aparece en 30 min → este ticket va a BLOQUEADO con "Mau no
  conectó el navegador"; no se escribe nada.
- Prueba de escritura de vytas: desde la VM, `leer` y `guardar` del mismo estado con `base` = la
  versión leída y autor `vytas`. Crea una versión sin cambiar datos.

**Blocked by:** 03

**Status:** 4 de 5 AC en verde; AC3 incumplido por la versión de recuperación (decide Mau)

- [x] `ssh aios-vm 'set -a; . ~/.hermes/.env; curl -s -o /dev/null -w "%{http_code}" -X POST https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm -H "Content-Type: application/json" -d "{\"clave\":\"$PM_CLAVE\",\"accion\":\"leer\"}"'` imprime `200`. · `AC1=200`
- [x] El skill existe en `~developer/.hermes/skills/` y `ssh aios-vm 'grep -rl "functions/v1/pm" ~/.hermes/skills'` encuentra exactamente un archivo, que contiene `ticketera.aprobadas.entradas`. · `1` archivo: `/home/developer/.hermes/skills/plataforma-sindicato-baba/SKILL.md`, con 1 coincidencia de `ticketera.aprobadas.entradas`
- [ ] `versiones` en producción muestra una versión con autor `navegador` anterior a la primera con autor `vytas`, y ninguna con autor `claude`. · **FAIL literal**: `versiones: 1:navegador 2:vytas 3:claude` → `AC3 FAIL · navegador en 1, primera vytas en 2, claude: 1`. La v3 (`claude`, 03:21:58Z) la escribió el coordinador para recuperar el estado real de Mau (la v1 del navegador era la plantilla); no registra la orden #2 (`real.sold=0`). No hay borrado: queda para que Mau acepte la excepción.
- [x] El `estado` de la versión de `vytas` es igual al de la versión anterior (comparación JSON en Node, sale 0). · `AC4 PASS · estado de v2 (vytas) == estado de v1` (`isDeepStrictEqual`)
- [x] `ssh aios-vm 'hermes -z "Según la plataforma del organizador de Sindicato Baba, ¿cuántas entradas pagadas llevamos? Responde solo el número."'` imprime el número que da la regla del skill aplicada a `leer`. · intento 2 (tras arreglar el skill): imprime `0`; `leer` v3 sin bloque `ticketera` → `real.sold = 0`. Control no trivial: "tareas y versión" → `tareas=7 version=3` (coincide con la v3).

Notas del agente:

- Skill `~developer/.hermes/skills/plataforma-sindicato-baba/SKILL.md` (un solo archivo, formato de
  los demás: carpeta + `SKILL.md` con frontmatter). Primera versión: `pm()` leía la clave del `.env`
  de Hermes → **falla 1 del AC5**: Hermes tiene una regla de denegación deliberada de Mau
  (`'*.hermes/.env*'` en `config.yaml`) y vytas respondió "el acceso a la clave está bloqueado". La
  regla no se tocó. Arreglo: `pm()` usa `$PM_CLAVE` del entorno y el frontmatter la declara en
  `required_environment_variables` (passthrough nativo de Hermes); diagnóstico con `hermes -z` →
  `presente`.
- `PM_CLAVE` se agregó a `~/.hermes/.env` por `ssh` con stdin (nunca en argumentos ni en pantalla);
  el archivo sigue en 600. Como Hermes carga el `.env` al arrancar, se reinició el gateway con
  `systemctl --user restart hermes-gateway.service` (arrancaba desde el 22-oct): activo, WhatsApp
  "Bridge ready (status: connected)".
- Pausa humana: zenity a las 02:59Z; versión `navegador` a las 03:07:39Z. **Pero esa v1 era la
  plantilla**: los datos de Mau estaban en el `localStorage` del origen viejo (ver nota del 03). Mi
  chequeo "no es plantilla" dio falso negativo porque comparaba JSON serializado y jsonb reordena
  las claves (lo detectó el coordinador). La prueba de escritura de vytas (v2, 03:08:11Z) es igual a
  la v1. Mau importa el respaldo recuperado desde la página: esa será la v3 o posterior.
