// Modelo puro con el bloque `ticketera` de `leer` (issue #3, ticket 02), sin servicios:
//   node supabase/tests/pm-modelo.mjs
// El bloque entra aparte del estado: con null o ausente, la caja y el CSV dan lo de siempre.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const M = createRequire(import.meta.url)("../../app.js");
const s = M.defaultState();
s.real = { ...s.real, sold: 3, ticketsCollectedCents: 3000 };
const bloque = {
  consultado_en: "2026-10-27T22:15:00Z",
  aprobadas: { ordenes: 2, entradas: 5, usd_cents: 5000 },
  por_metodo: {
    pago_movil: { ordenes: 1, entradas: 2, usd_cents: 2000, bs: 4000 },
    zelle: { ordenes: 1, entradas: 3, usd_cents: 3000, bs: null },
    binance: { ordenes: 0, entradas: 0, usd_cents: 0, bs: null },
  },
  en_revision: { ordenes: 1, entradas: 1, usd_cents: 1000 },
  ultima_aprobacion: "2026-10-27T22:00:00Z",
};

// Caja: manual + ticketera; sin bloque, igual que hoy.
const con = M.cashReal(s, bloque);
assert.equal(con.incomeCents, 8000);
assert.equal(con.ticketeraCents, 5000);
assert.equal(con.soldTotal, 8);
assert.equal(con.cashCents, 8000, "la caja disponible no sumó la ticketera");
const sin = M.cashReal(s, null);
assert.equal(sin.incomeCents, 3000);
assert.equal(sin.ticketeraCents, 0);
assert.equal(sin.soldTotal, 3);
assert.deepEqual(sin, M.cashReal(s), "null y ausente no dan lo mismo");
assert.throws(() => M.cashReal(s, { aprobadas: { entradas: -1, usd_cents: 0 } }), RangeError, "bloque inválido aceptado");
// Un solo validador para la UI y la caja: lo que la UI acepta, cashReal no lo rechaza (code review).
assert.equal(M.ticketeraValida(bloque), bloque);
assert.equal(M.ticketeraValida(null), null);
const fuera = { ...bloque, aprobadas: { ordenes: 1, entradas: 10001, usd_cents: 0 } };
assert.equal(M.ticketeraValida(fuera), null, "la UI guardaría un bloque que la caja rechaza");
assert.throws(() => M.cashReal(s, fuera), RangeError);

// CSV: filas propias para cada fuente; "Ingresos cobrados" es el total.
const plano = (csv) => csv.replace(/"/g, "");
const csv = plano(M.toCSV(s, bloque));
for (const fila of ["Entradas ticketera,5", "Cobrado por ticketera,50.00", "Entradas fuera de la ticketera,3",
  "Cobrado fuera de la ticketera,30.00", "Ingresos cobrados,80.00",
  "Ticketera leída a las," + new Date(bloque.consultado_en).toLocaleTimeString("es-419", { hour: "2-digit", minute: "2-digit" })]) {
  assert.ok(csv.includes(fila), `falta la fila ${fila}`);
}
const csvSin = plano(M.toCSV(s));
for (const fila of ["Entradas ticketera,sin lectura", "Cobrado por ticketera,sin lectura", "Ticketera leída a las,sin lectura",
  "Entradas fuera de la ticketera,3", "Cobrado fuera de la ticketera,30.00", "Ingresos cobrados,30.00"]) {
  assert.ok(csvSin.includes(fila), `sin bloque falta la fila ${fila}`);
}

// El escenario no lee el bloque y el bloque no entra al estado ni al respaldo.
assert.equal(M.calcScenario(s).tickets, s.scenario.tickets);
assert.ok(!M.serializeState(s).includes("ticketera"), "el respaldo menciona la ticketera");

console.log("OK pm-modelo: caja, CSV y escenario con y sin bloque ticketera");
