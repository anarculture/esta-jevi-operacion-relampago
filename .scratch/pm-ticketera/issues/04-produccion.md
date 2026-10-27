# 04: Producción

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/3

**What to build:** la plataforma publicada en https://postropicalia.com/sindicato-baba/pm/ muestra
las ventas reales de la ticketera, y vytas responde "cuántas llevamos" sumando ticketera + fuera
de la ticketera, sin que nadie copie números.

Decisiones congeladas:

- Despliegue en este orden: `supabase db push --linked --yes` (solo la migración de
  `resumen_ticketera`), `supabase functions deploy pm --project-ref ptbzdepejxxlavqfyepw`, y
  `git push origin HEAD:vm/evento-pm-v2` (Pages publica `/pm/` en 1 a 2 min). Ninguna función
  más se despliega; `admin`, `revisar`, `avisos` y `portero` no cambiaron.
- El hook de permisos de la sesión suele negar esos tres comandos: si pasa, no busques otra vía;
  anótalos bajo `## BLOQUEADO` del BUILD con la ruta absoluta del worktree para que Mau los corra
  con `!`, y deja escritos los pasos de verificación para que los siga él o un agente con permisos.
- Paso humano antes de desplegar (de Mau): revisar en la plataforma que `real.sold` y "Cobrado
  fuera de la ticketera" no incluyan ventas que la ticketera ya cuenta (la orden #2 de Johan está
  en la ticketera como Zelle). Si las incluye, las resta él desde la plataforma; el agente no
  edita el estado compartido.
- Skill de vytas: `~developer/.hermes/skills/plataforma-sindicato-baba/SKILL.md` en `aios-vm` ya
  trae la regla (línea "Las ventas de la ticketera no se registran a mano … cuántas llevamos =
  `ticketera.aprobadas.entradas` + `real.sold`"). Solo se verifica; no se edita ni se reinicia
  nada en la VM.
- La verificación en producción lee con `PM_CLAVE` desde `~/.config/sindicato-baba/pm_clave`
  (archivo 600) pasada por variable de entorno; nunca se imprime la clave.

**Blocked by:** 03

**Status:** bloqueado (gate HITL: pregunta a Mau + comandos de producción; ver `## BLOQUEADO` del BUILD)

- [ ] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra la migración nueva aplicada en remoto y ninguna pendiente. *(Hoy: todas aplicadas hasta `20261027120300`; `20261027200000` pendiente. `db push --dry-run` → solo `20261027200000_resumen_ticketera.sql`.)*
- [ ] `leer` en producción (POST a `https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm` con `PM_CLAVE` por variable de entorno) responde 200 con `ticketera.aprobadas.entradas` ≥ 1 y `consultado_en` de hoy; con clave mala responde 401. *(Hoy, antes del deploy: `leer 200 version 10 ... trae ticketera: false`; clave mala `401`.)*
- [ ] `https://postropicalia.com/sindicato-baba/pm/index.html` responde 200 y contiene "fuera de la ticketera"; `https://postropicalia.com/sindicato-baba/pm/app.js` contiene "Sin conexión con la ticketera". *(Falta el `git push`.)*
- [x] `ssh aios-vm 'grep -c "ticketera.aprobadas.entradas" ~/.hermes/skills/plataforma-sindicato-baba/SKILL.md'` imprime 1 o más. → `1`.
- [x] `git grep -n "$(cat ~/.config/sindicato-baba/pm_clave)"` sale 1 (la clave no está en el repo). → corrido como `git grep -c -F -f ~/.config/sindicato-baba/pm_clave` (misma búsqueda, sin poner la clave en la línea de comandos): exit 1.
- [ ] Mau confirma (una pregunta) que el registro manual de la plataforma no duplica la orden #2 y que la columna Ticketera en `/pm/` coincide con el panel admin. *(Dato para la pregunta: producción versión 10 tiene `real.sold = 0` y `ticketsCollectedCents = 0`.)*

**Riesgos de choque con el frente cotejo (#6/#7, agente Alfa, en paralelo):** `resumen_ticketera()` solo lee
`ordenes.estado`, `tipo`, `cantidad`, `monto_usd_cents`, `monto_bs` y `resuelta_en`, tal como están en
producción. Si cotejo agrega un estado nuevo a `ordenes`, no cuenta ni como aprobada ni como en revisión.
`pm-ticketera.mjs` y `pm-navegador.mjs` crean órdenes con la firma actual de `crear_orden` (`p_whatsapps`): si
cotejo la cambia, hay que ajustarlos. Si cotejo sube una migración con timestamp menor que `20261027200000`
después de esta, su `db push` va a necesitar `--include-all`.
