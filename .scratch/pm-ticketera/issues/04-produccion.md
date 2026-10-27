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

**Status:** done (la vista de Mau sobre `/pm/` contra el panel admin queda como su confirmación final; ver el último AC)

Despliegue: Mau respondió "ok" a la pregunta del doble conteo (v14: `real.sold = 0`, `ticketsCollectedCents = 0`).
El coordinador corrió desde el hilo principal `supabase db push --linked --project-ref ptbzdepejxxlavqfyepw --yes`
(solo `20261027200000_resumen_ticketera.sql`) y `supabase functions deploy --project-ref ptbzdepejxxlavqfyepw pm`
("Deployed Functions", 722 kB). El agente rebasó sobre `origin/vm/evento-pm-v2` (081e1a9), repitió los gates (todos
verdes) e hizo `git push origin HEAD:vm/evento-pm-v2` → `081e1a9..aee5dc6`.

- [x] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra la migración nueva aplicada en remoto y ninguna pendiente. → `{"local":"20261027200000","remote":"20261027200000",...}`, sin ninguna con `remote` vacío.
- [x] `leer` en producción (POST a `https://ptbzdepejxxlavqfyepw.supabase.co/functions/v1/pm` con `PM_CLAVE` por variable de entorno) responde 200 con `ticketera.aprobadas.entradas` ≥ 1 y `consultado_en` de hoy; con clave mala responde 401. → `leer 200 version 14`, `aprobadas {"ordenes":3,"entradas":5,"usd_cents":4000}`, `consultado_en 2026-10-27T06:20:35Z`, clave mala `401`.
- [x] `https://postropicalia.com/sindicato-baba/pm/index.html` responde 200 y contiene "fuera de la ticketera"; `https://postropicalia.com/sindicato-baba/pm/app.js` contiene "Sin conexión con la ticketera". → `index 200 fuera de la ticketera: True | app.js Sin conexión: True | ticketeraValida: True` (es el commit aee5dc6).
- [x] `ssh aios-vm 'grep -c "ticketera.aprobadas.entradas" ~/.hermes/skills/plataforma-sindicato-baba/SKILL.md'` imprime 1 o más. → `1`.
- [x] `git grep -n "$(cat ~/.config/sindicato-baba/pm_clave)"` sale 1 (la clave no está en el repo). → corrido como `git grep -c -F -f ~/.config/sindicato-baba/pm_clave` (misma búsqueda, sin poner la clave en la línea de comandos): exit 1.
- [x] Mau confirma (una pregunta) que el registro manual de la plataforma no duplica la orden #2 y que la columna Ticketera en `/pm/` coincide con el panel admin. → Doble conteo: Mau "ok" (v14 con `real.sold = 0`). Coincidencia con el panel: el bloque se calcula en el servidor desde la misma tabla `ordenes` que lee el panel. El agente no tiene permiso para leer la cola de `admin` (se denegó el uso de `ADMIN_CLAVE`), así que la comparación visual en `/pm/` → Ventas contra el panel queda para Mau.

**`/security-review` (gate del 04), sobre `02c6117..HEAD`:** NO FINDINGS (revoke de la función, sin datos
personales en el bloque ni en `localStorage`, gate de `PM_CLAVE` intacto, render solo con `textContent`, sin secretos
nuevos). No verificado en vivo: la llamada anon a `rpc/resumen_ticketera` en producción, que el clasificador bloqueó
("Production Reads"). Riesgo previo, no introducido aquí: `PM_CLAVE` vive en `localStorage` del mismo origen que la
ticketera pública.

**Datos de producción que Mau debería mirar:** `por_metodo.pago_movil` tiene 1 orden de 2 entradas con `bs: 0` (esa
orden no tiene `monto_bs`; probablemente es una venta manual cargada por SQL), y Zelle suma 3 entradas por
`usd_cents: 2000`, así que alguna orden no está a $10 por entrada. El bloque suma `monto_usd_cents` tal cual, como
pide el spec.

**Nota:** el `pm` desplegado se empaquetó antes del commit aee5dc6, que solo cambia un comentario en `pm/index.ts`
y agrega `ticketeraValida` a la copia `_shared/app.js` (que `pm` importa solo por `validateState`). No cambia
la conducta de `pm`; un redeploy es opcional.

**Riesgos de choque con el frente cotejo (#6/#7, agente Alfa, en paralelo):** `resumen_ticketera()` solo lee
`ordenes.estado`, `tipo`, `cantidad`, `monto_usd_cents`, `monto_bs` y `resuelta_en`, tal como están en
producción. Si cotejo agrega un estado nuevo a `ordenes`, no cuenta ni como aprobada ni como en revisión.
`pm-ticketera.mjs` y `pm-navegador.mjs` crean órdenes con la firma actual de `crear_orden` (`p_whatsapps`): si
cotejo la cambia, hay que ajustarlos. Si cotejo sube una migración con timestamp menor que `20261027200000`
después de esta, su `db push` va a necesitar `--include-all`.
