// Contrato HTTP de la función `portero` contra el Supabase local:
//   node supabase/tests/portero.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con PORTERO_CLAVE.
// Los datos de prueba entran por SQL, como una venta manual (supabase/manual/), en el
// contenedor de la base; los asserts miran solo lo que responde la función.
// Otro stack: API=http://127.0.0.1:55321 DB_CONTAINER=supabase_db_portero node supabase/tests/portero.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CLAVE = readFileSync(new URL("../functions/.env", import.meta.url), "utf8").match(/PORTERO_CLAVE=(.*)/)[1];

const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();

async function portero(body) {
  const r = await fetch(`${API}/functions/v1/portero`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => null) };
}

// Una orden aprobada de 2 entradas, y otra con 2 entradas que comparten código de respaldo.
const ref = `PORTEROTEST${Date.now()}`;
const pre = crypto.randomUUID().slice(0, 8);
const orden = (r) => `insert into ordenes (nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, estado, resuelta_en)
  values ('Prueba Portero', 'V99999999', '04149999999', 2, 'zelle', '${r}', 'manual.jpg', 2000, 'aprobada', now()) returning id`;
const [t1, t2] = sql(`
  with o as (${orden(ref)}), amb as (${orden(ref + "B")}),
  e as (insert into entradas (orden_id) select id from o, generate_series(1, 2) returning token),
  f as (insert into entradas (orden_id, token) select id, v::uuid from amb,
        unnest(array['${pre}-0000-4000-8000-00000000000a', '${pre}-0000-4000-8000-00000000000b']) v returning token)
  select token from e;`).split("\n");
const tAmb = `${pre}-0000-4000-8000-00000000000a`;
assert.ok(t1 && t2, "datos de prueba insertados");

for (const accion of ["checkin", "deshacer", "lista", "resumen"]) {
  assert.equal((await portero({ clave: "mala", accion, token: t1 })).status, 401, `clave mala en ${accion}`);
  assert.equal((await portero({ accion, token: t1 })).status, 401, `sin clave en ${accion}`);
}

const r0 = (await portero({ clave: CLAVE, accion: "resumen" })).d;
assert.ok(Number.isInteger(r0.aprobadas) && Number.isInteger(r0.ingresadas), `resumen: ${JSON.stringify(r0)}`);

const porCodigo = (await portero({ clave: CLAVE, accion: "checkin", codigo: t1.slice(0, 8).toUpperCase() })).d;
assert.equal(porCodigo.resultado, "valida", `checkin por código: ${JSON.stringify(porCodigo)}`);
const porToken = (await portero({ clave: CLAVE, accion: "checkin", token: t1 })).d;
assert.equal(porToken.resultado, "ya_usada", `checkin por token: ${JSON.stringify(porToken)}`);
for (const k of ["token", "numero", "posicion", "total", "checked_in_at"]) {
  assert.equal(porToken[k], porCodigo[k], `token y código difieren en ${k}`);
}
assert.equal(porCodigo.total, 2);

const amb = (await portero({ clave: CLAVE, accion: "checkin", codigo: pre })).d;
assert.deepEqual(amb, { resultado: "invalida", motivo: "codigo_ambiguo" }, `código ambiguo: ${JSON.stringify(amb)}`);
for (const body of [{ token: crypto.randomUUID() }, { token: "no-es-uuid" }, { codigo: "zz" }, {}]) {
  const d = (await portero({ clave: CLAVE, accion: "checkin", ...body })).d;
  assert.deepEqual(d, { resultado: "invalida", motivo: "no_existe" }, `inexistente ${JSON.stringify(body)}: ${JSON.stringify(d)}`);
}

const lista = (await portero({ clave: CLAVE, accion: "lista" })).d;
assert.ok(lista.generada_en && Array.isArray(lista.entradas), "lista con hora y entradas");
const mia = lista.entradas.find((e) => e.token === t1);
assert.ok(mia?.checked_in_at && mia.total === 2 && mia.numero === porCodigo.numero, `lista trae la entrada: ${JSON.stringify(mia)}`);
assert.deepEqual(Object.keys(mia).sort(), ["cedula", "checked_in_at", "numero", "posicion", "token", "total"], "campos de la lista");
assert.equal(mia.cedula, "V99999999", "la lista sin la cédula del comprador para el reingreso");
const texto = JSON.stringify(lista);
for (const dato of ["nombre", "telefono", "Prueba Portero", "04149999999"]) {
  assert.ok(!texto.includes(dato), `la lista expone ${dato}`);
}

const segunda = (await portero({ clave: CLAVE, accion: "checkin", token: t2 })).d;
assert.equal(segunda.resultado, "valida");
const r1 = (await portero({ clave: CLAVE, accion: "resumen" })).d;
assert.ok(r0.aprobadas >= 4, "resumen: aprobadas no cuenta las 4 entradas de prueba");
assert.equal(r1.aprobadas, r0.aprobadas, "un check-in cambió las aprobadas");
assert.equal(r1.ingresadas, r0.ingresadas + 2, `resumen tras 2 check-in: ${JSON.stringify([r0, r1])}`);

// Dos porteros con el mismo QR en el mismo instante: entra uno solo.
const dos = await Promise.all([1, 2].map(() => portero({ clave: CLAVE, accion: "checkin", token: tAmb })));
assert.deepEqual(dos.map((r) => r.d.resultado).sort(), ["valida", "ya_usada"], `concurrencia: ${JSON.stringify(dos)}`);

assert.deepEqual((await portero({ clave: CLAVE, accion: "deshacer", token: t2 })).d, { ok: true }, "deshacer reciente");
assert.equal((await portero({ clave: CLAVE, accion: "checkin", token: t2 })).d.resultado, "valida", "tras deshacer vuelve a valida");
assert.deepEqual((await portero({ clave: CLAVE, accion: "deshacer", token: crypto.randomUUID() })).d, { ok: false });
assert.equal((await portero({ clave: CLAVE, accion: "aprobar" })).status, 400, "acción desconocida");

console.log(`OK portero: orden #${porCodigo.numero}, ${r1.ingresadas} ingresadas de ${r1.aprobadas} aprobadas`);
