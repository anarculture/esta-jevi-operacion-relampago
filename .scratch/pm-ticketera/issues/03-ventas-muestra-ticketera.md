# 03: Ventas muestra "Ticketera" y "Fuera de la ticketera"

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/3

**What to build:** Mau abre la plataforma del organizador (`/pm/`) con su clave y en "Ventas y
patrocinios" ve dos columnas: "Ticketera" (entradas, órdenes, cobrado nominal, por método con los
bolívares de pago móvil, cuánto espera revisión y la hora de la lectura) y "Fuera de la
ticketera" (los campos manuales de hoy, renombrados). "Vendidas", "Faltan para el mínimo" y la
caja real en Finanzas usan el total. Un botón "Actualizar" trae cifras nuevas sin recargar; al
volver a la pestaña también se refrescan. Sin red ve la última lectura con su hora y "puede
estar vieja"; sin clave y sin lectura previa ve "Sin conexión con la ticketera" y la caja usa
solo lo manual. El aviso de la sección ya no dice que no se procesan pagos.

Decisiones congeladas:

- El bloque llega en el mismo `leer` que ya hace la sincronización del issue #2 (`leerRemoto`,
  al abrir y al recuperar el foco): de la respuesta se toma `ticketera` aparte de `version` y
  `estado`, y nunca entra al estado. "Actualizar" hace un `leer` que solo actualiza el bloque (no
  adopta ni sube estado). Sin clave, el botón está deshabilitado con el motivo visible.
- Última lectura en `localStorage` bajo una clave propia derivada de `STORAGE_KEY` (sufijo
  `:ticketera`), con el bloque y su `consultado_en`; fuera del estado, fuera del respaldo JSON y
  del CSV de respaldo. Se borra al olvidar la clave.
- Línea de estado en Ventas, textos exactos: "Ticketera al HH:MM" (lectura fresca en esta
  sesión), "Ticketera al HH:MM, puede estar vieja" (la última lectura falló o no hay red),
  "Sin conexión con la ticketera" (sin clave y sin lectura previa). Hora local, formato `hhmm`
  ya existente.
- Etiquetas renombradas: "Entradas pagadas vendidas" → "Entradas vendidas fuera de la ticketera";
  "Cobrado por entradas (USD)" (en Ventas y en Caja real) → "Cobrado fuera de la ticketera (USD)";
  el `hint` de Caja real pasa a decir que la ticketera se suma sola. "Vendidas (registro)" →
  "Vendidas (ticketera + fuera)". El aviso de la sección: "La ticketera emite las entradas y
  cobra; aquí se anota solo lo que pasa fuera de ella (mano, puerta, cortesías). La plataforma no
  valida códigos QR."
- Render de la columna Ticketera con `dl.ledger` como el resto de la sección; tokens y tipografía
  de `DESIGN.md`; sin librerías nuevas. Los montos en USD con `fmtMoney`; los bolívares con dos
  decimales y el prefijo "Bs".
- El respaldo JSON (exportar/importar) y `validateState` no cambian; `parseBackup` sigue
  rechazando claves desconocidas.
- Smoke en `supabase/tests/pm-navegador.mjs` (CDP, mismo patrón): dos casos nuevos. Como `pm`
  local ya adjunta el bloque (ticket 01), el caso con clave crea órdenes reales con `crear_orden`
  + `resolver` igual que `pm-ticketera.mjs` y comprueba lo que se muestra; el caso sin clave
  arranca con `localStorage` limpio.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] `supabase db reset && node supabase/tests/pm-navegador.mjs` sale 0 con los casos nuevos: con clave y dos órdenes aprobadas (2 entradas pago móvil + 1 Zelle) y `real.sold = 3` sembrado, Ventas muestra "3 entradas" en Ticketera, "6 entradas" en Vendidas, el cobrado de la ticketera ($30.00), los Bs de pago móvil, "Ticketera al HH:MM" y la caja real de Finanzas incluye los $30; tras aprobar una tercera orden y pulsar "Actualizar", Ticketera muestra "4 entradas" sin recargar; sin clave y sin lectura previa, Ventas muestra "Sin conexión con la ticketera" y Vendidas = `real.sold`.
- [ ] En el mismo smoke: tras una lectura con clave, simular red caída (el test apaga su respuesta de `leer` o cambia `PM_URL` a un puerto cerrado) y recargar → la columna Ticketera conserva las cifras y la línea dice "puede estar vieja".
- [ ] `rg -n "no procesa pagos|Entradas pagadas vendidas|Cobrado por entradas \(USD\)" index.html` no encuentra nada, y `rg -n "Sin conexión con la ticketera|puede estar vieja|fuera de la ticketera" app.js index.html` encuentra los tres textos.
- [ ] `node supabase/tests/pm-modelo.mjs`, `node supabase/tests/pm.mjs`, `node supabase/tests/pm-ticketera.mjs`, `cmp app.js supabase/functions/_shared/app.js` y `deno test supabase/functions/` salen 0.
