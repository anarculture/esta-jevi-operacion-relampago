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

**Status:** ready-for-agent

- [ ] `node supabase/tests/pm-modelo.mjs` sale 0: con un estado que registra 3 vendidas y $30 manuales y un bloque con 5 entradas y 5000 cents aprobados, `cashReal` da `incomeCents` 8000, `ticketeraCents` 5000 y `soldTotal` 8; con `null` da `incomeCents` 3000 y `soldTotal` 3, igual que `cashReal(state)`; `toCSV(state, bloque)` contiene las filas "Entradas ticketera,5" y "Cobrado por ticketera,50.00", y `toCSV(state)` contiene "sin lectura".
- [ ] `node -e "const M=require('./app.js'); const s=M.defaultState(); process.exit(M.validateState(s).ok && M.serializeState(s)===M.serializeState(M.validateState(s).state) ? 0 : 1)"` sale 0 y `git diff --stat -- app.js` no toca las líneas de `RULES`, `validateState` ni `serializeState` (revisión del diff en la autocrítica).
- [ ] `cmp app.js supabase/functions/_shared/app.js` sale 0.
- [ ] `deno test supabase/functions/` sale 0 y `node supabase/tests/pm.mjs` sigue saliendo 0.
