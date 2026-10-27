# 02: El modelo puro suma la ticketera

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/3

**What to build:** la caja real y "faltan para el mínimo" de la plataforma del organizador
aceptan el bloque `ticketera` como entrada aparte del estado: ingresos = cobrado manual +
`ticketera.aprobadas.usd_cents`; vendidas = `real.sold` + `ticketera.aprobadas.entradas`. Sin
bloque (`null` o ausente) todo da lo mismo que hoy. El informe CSV gana filas propias para cada
fuente. El estado guardado, su validación y el respaldo JSON no cambian: `real.sold` y
`real.ticketsCollectedCents` conservan nombre, tipo y validación y pasan a significar "fuera de
la ticketera".

Decisiones congeladas:

- `cashReal(state, ticketera)` con segundo argumento opcional; `incomeCents` incluye
  `ticketera.aprobadas.usd_cents` cuando hay bloque y devuelve además `ticketeraCents` y
  `soldTotal` (manual + ticketera) para que el render y el CSV no repitan la suma. El cálculo de
  "faltan" usa `soldTotal`. Firma de todo lo demás intacta.
- `toCSV(state, ticketera)` añade bajo "Caja real (registrado)" las filas "Entradas ticketera",
  "Cobrado por ticketera", "Entradas fuera de la ticketera", "Cobrado fuera de la ticketera" y
  "Ticketera leída a las" (hora local de `consultado_en`, o "sin lectura"). Sin bloque, las filas
  de ticketera dicen "sin lectura" y las manuales valen lo registrado; la fila "Ingresos cobrados"
  pasa a ser el total.
- El escenario (hipótesis de 100 entradas) no lee el bloque: `calcScenario`, `breakEven` y
  `compareGrid` no cambian.
- `validateState`, `serializeState`, `parseBackup` y `RULES` no cambian: el bloque nunca entra al
  estado ni al respaldo.
- `app.js` de la raíz es la fuente; su copia `supabase/functions/_shared/app.js` se mantiene
  idéntica con `cmp` (gate del issue #2). Como `pm` importa esa copia, el cambio del modelo no
  debe romper `deno test` ni `pm.mjs`.
- Check propio en `supabase/tests/pm-modelo.mjs` (Node puro, `require('../../app.js')`,
  `node:assert/strict`, sin servicios): bloque fijo de ejemplo con y sin `null`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `node supabase/tests/pm-modelo.mjs` sale 0: con un estado que registra 3 vendidas y $30 manuales y un bloque con 5 entradas y 5000 cents aprobados, `cashReal` da `incomeCents` 8000, `ticketeraCents` 5000 y `soldTotal` 8; con `null` da `incomeCents` 3000 y `soldTotal` 3, igual que `cashReal(state)`; `toCSV(state, bloque)` contiene las filas "Entradas ticketera,5" y "Cobrado por ticketera,50.00", y `toCSV(state)` contiene "sin lectura".
- [x] (AC enmendado por el agente; ver nota) `node -e "const M=require('./app.js'); const a=require('assert'); const s=M.defaultState(); const v=M.validateState(s); a.ok(v.ok); a.deepStrictEqual(JSON.parse(M.serializeState(s)), JSON.parse(M.serializeState(v.state))); a.equal(M.serializeState(v.state), M.serializeState(M.validateState(v.state).state))"` sale 0, y `git diff 02c6117 -- app.js` no toca las líneas de `RULES`, `validateState` ni `serializeState`.
- [x] `cmp app.js supabase/functions/_shared/app.js` sale 0.
- [x] `deno test supabase/functions/` sale 0 y `node supabase/tests/pm.mjs` sigue saliendo 0.

**Nota sobre el AC 2.** El comando original (`M.serializeState(s)===M.serializeState(M.validateState(s).state)`)
ya salía 1 en la base `02c6117`, sin ningún cambio de este ticket: `validateState` devuelve las claves de primer
nivel en otro orden que `defaultState` (`real` antes de `budget`, `tasks`/`ops` antes de `sponsors`/`bar`), y
la comparación es de strings. Para que salga 0 habría que tocar `validateState`/`serializeState` (prohibido) o
reordenar `defaultState` (fuera del ticket). La variante de arriba comprueba lo que el AC quiere: el estado
validado es el mismo, sin importar el orden de las claves, y su serialización es estable.

**Evidencia:**

- Con el `app.js` de `02c6117`, `node supabase/tests/pm-modelo.mjs` → `AssertionError` (sin `ticketeraCents`). Después → `OK pm-modelo: caja, CSV y escenario con y sin bloque ticketera`.
- `app.js:432` `cashReal(state, ticketera)`; `app.js:447` devuelve `ticketeraCents` y `soldTotal`; `app.js:513` filas nuevas del CSV; `app.js:967` "faltan" usa `d.cash.soldTotal`; `hhmm` sube al modelo (`app.js:465`) para que el CSV la use sin duplicarla.
- Hunks de `git diff -U0 app.js`: 430, 434, 443, 460, 473, 475, 506, 645, 958. Ninguno cae en `RULES` (l.120-145), `validateState` (l.203) ni `serializeState`.
- `validate-serialize ok`, `cmp` OK, `deno test` → `13 passed | 0 failed`, `pm.mjs` → `OK pm: 8 casos`, `pm-ticketera.mjs` → `OK pm-ticketera: 6 casos`.
- Autocrítica: un bloque inválido hace que `cashReal` lance `RangeError` (mismo patrón que `real`), y eso apaga todos los resultados del render. El ticket 03 tiene que validar el bloque que lee de `localStorage` antes de pasarlo al modelo.
