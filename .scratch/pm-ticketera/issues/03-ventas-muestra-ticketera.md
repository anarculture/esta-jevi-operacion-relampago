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

**Status:** done

- [x] `supabase db reset && node supabase/tests/pm-navegador.mjs` sale 0 con los casos nuevos: con clave y dos órdenes aprobadas (2 entradas pago móvil + 1 Zelle) y `real.sold = 3` sembrado, Ventas muestra "3 entradas" en Ticketera, "6 entradas" en Vendidas, el cobrado de la ticketera ($30.00), los Bs de pago móvil, "Ticketera al HH:MM" y la caja real de Finanzas incluye los $30; tras aprobar una tercera orden y pulsar "Actualizar", Ticketera muestra "4 entradas" sin recargar; sin clave y sin lectura previa, Ventas muestra "Sin conexión con la ticketera" y Vendidas = `real.sold`.
- [x] En el mismo smoke: tras una lectura con clave, simular red caída (el test apaga su respuesta de `leer` o cambia `PM_URL` a un puerto cerrado) y recargar → la columna Ticketera conserva las cifras y la línea dice "puede estar vieja".
- [x] `rg -n "no procesa pagos|Entradas pagadas vendidas|Cobrado por entradas \(USD\)" index.html` no encuentra nada, y `rg -n "Sin conexión con la ticketera|puede estar vieja|fuera de la ticketera" app.js index.html` encuentra los tres textos.
- [x] `node supabase/tests/pm-modelo.mjs`, `node supabase/tests/pm.mjs`, `node supabase/tests/pm-ticketera.mjs`, `cmp app.js supabase/functions/_shared/app.js` y `deno test supabase/functions/` salen 0.

**Evidencia (stack `pm-ticketera`, `API=http://127.0.0.1:58321`, tras `supabase db reset`):**

- `node supabase/tests/pm-navegador.mjs` → `OK pm-navegador: 10 casos`. Líneas decisivas:
  `7 ticketera: 3 entradas · $30 · $20 · 2 entradas · Bs 4,000.00 · vendidas 6 entradas pagadas · Ticketera al 01:32 a.m.`,
  `8 actualizar: 4 entradas sin recargar`, `9 sin red: Ticketera al 01:32 a.m., puede estar vieja`,
  `10 sin clave: Sin conexión con la ticketera · vendidas 2 entradas pagadas`. El caso 7 compara `cr-income` de Finanzas con lo manual + $30.
- AC 3: el primer `rg` sale 1 (sin coincidencias); el segundo encuentra `app.js:968` ("Sin conexión con la ticketera", "puede estar vieja") e `index.html:298` ("fuera de la ticketera").
- AC 4: `OK pm-modelo`, `OK pm: 8 casos`, `OK pm-ticketera: 6 casos`, `cmp` OK, `deno test` → `13 passed | 0 failed`. También verdes: `ticketera.sql`, `avisos.mjs`, `ticketera/tests/ux.mjs` (`OK ux.mjs`), `flujo.mjs` con el recibo sintético (`OK flujo: orden #13 aprobada, 2 entradas`) y el smoke `http.server` (`index.html` 200 con "fuera de la ticketera").
- Código: `index.html:364` aviso nuevo, `index.html:368` columna Ticketera; `app.js:621` `TK_KEY`; `app.js:769` `cashReal(state, tk)`; `app.js:967` `renderTicketera`; `app.js:1267` `leerRemoto` toma el bloque; `app.js:1277` `tkValida`; `app.js:1294` `actualizarTicketera` (solo bloque); `app.js:1349` olvidar la clave borra la lectura; `app.js:1425` CSV con el bloque.
- Captura de Ventas (fuera del repo): `CAPTURA_TK=<ruta.png> node supabase/tests/pm-navegador.mjs`.
- Notas del test: la página llama a `127.0.0.1:54321` fijo, así que con otro `API` el test levanta un proxy en 54321 (`ponytail`/shortcut comentado; no corre si otro stack ocupa 54321). La red caída se simula con CDP `Fetch.failRequest` sobre `/functions/v1/pm`.
- Code review del cierre (hallazgo de corrección, reabrió el 03): `tkValida` (UI) aceptaba cualquier entero ≥ 0
  y `cashReal` rechazaba más de 10000 entradas o 1e8 centavos. Un bloque así se guardaba y la caja mostraba
  "Datos inconsistentes" con un estado sano. Ahora hay un solo validador, `ticketeraValida`, en el modelo (mismas
  `RULES` que la caja), que usan la UI y `cashReal`. `pm-modelo.mjs` lo prueba: con el `app.js` anterior falla
  (`ticketeraValida` no existe). Tras el arreglo: `OK pm-modelo`, `OK pm-navegador: 10 casos`,
  `OK pm: 8 casos`, `OK pm-ticketera: 6 casos`, `deno` 13 passed, `OK ux.mjs`, `OK flujo`, smoke 200.
- Autocrítica (no bloquea): (1) con clave y sin lectura previa, mientras la primera lectura está en vuelo, la línea dice "Sin conexión con la ticketera" un instante; (2) los Bs usan el formato `es-419` de la plataforma (`4,000.00`), no el venezolano (`4.000,00`); (3) con campos de Finanzas inválidos, "Vendidas" muestra "—" como el resto de los derivados (antes mostraba solo lo manual).
