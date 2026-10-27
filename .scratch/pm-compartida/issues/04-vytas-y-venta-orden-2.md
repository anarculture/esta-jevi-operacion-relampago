# 04: vytas usa la plataforma y se registra la venta de la orden #2

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/2

**What to build:** vytas (Hermes Agent en `aios-vm`, home `~developer/.hermes`) lee y escribe el
estado de la plataforma con la misma Edge Function, guiado por un skill. Al cerrar, la venta
manual de la orden #2 (Johan Martinez: 2 entradas pagadas, $20 cobrados) queda registrada en
producción con autor `claude`, vytas la lee y Mau la ve en su navegador.

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
- **Pausa humana (única del build):** antes de escribir en producción, el agente avisa a Mau
  con `zenity --info` (abre https://anarculture.github.io/sindicato-baba/, pega la clave en "Datos
  y respaldo") y espera, consultando `leer` cada 30 s hasta 30 min, a que exista una versión con
  autor `navegador`. Si no aparece en 30 min → este ticket va a BLOQUEADO con "Mau no conectó el
  navegador"; no se escribe nada.
- Registro de la venta: Claude lee la versión vigente, suma 2 a `real.sold` y 2000 a
  `real.ticketsCollectedCents`, y guarda con `base` = esa versión y autor `claude`.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `ssh aios-vm 'set -a; . ~/.hermes/.env; curl -s -o /dev/null -w "%{http_code}" -X POST https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm -H "Content-Type: application/json" -d "{\"clave\":\"$PM_CLAVE\",\"accion\":\"leer\"}"'` imprime `200`.
- [ ] El skill existe en `~developer/.hermes/skills/` y `ssh aios-vm 'grep -rl "functions/v1/pm" ~/.hermes/skills'` encuentra exactamente un archivo.
- [ ] `versiones` en producción muestra una versión con autor `navegador` anterior a la primera con autor `claude`.
- [ ] `leer` en producción: `real.sold` y `real.ticketsCollectedCents` valen lo que tenía la versión de Mau más 2 y más 2000.
- [ ] `ssh aios-vm 'hermes -z "Según la plataforma del organizador de Sindicato Baba, ¿cuántas entradas pagadas llevamos? Responde solo el número."'` imprime el mismo `real.sold` que devuelve `leer`.
