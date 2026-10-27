// Contrato HTTP de la Edge Function `pm` contra el Supabase local, como lo haría un agente:
//   supabase db reset && node supabase/tests/pm.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env`. Supone la tabla vacía.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const M = createRequire(import.meta.url)("../../app.js");
const API = "http://127.0.0.1:54321";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CLAVE = readFileSync(new URL("../functions/.env", import.meta.url), "utf8").match(/PM_CLAVE=(.*)/)[1];

async function pm(body, raw) {
  const r = await fetch(API + "/functions/v1/pm", {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body),
  });
  return { status: r.status, d: await r.json().catch(() => null) };
}
const leer = (extra) => pm({ clave: CLAVE, accion: "leer", ...extra });
const guardar = (base, estado, autor = "claude") => pm({ clave: CLAVE, accion: "guardar", base, autor, estado });
const vigente = async () => (await leer()).d.version;

// 1. Sin versiones: version 0, estado null.
let r = await leer();
assert.equal(r.status, 200);
assert.equal(r.d.version, 0);
assert.equal(r.d.estado, null);

// 2. guardar con base 0 y el defaultState → versión 1; leer devuelve el mismo estado.
const inicial = M.defaultState();
r = await guardar(0, inicial, "navegador");
assert.equal(r.status, 200, JSON.stringify(r.d));
assert.equal(r.d.version, 1);
assert.ok(r.d.guardado_en);
r = await leer();
assert.equal(r.d.version, 1);
assert.equal(r.d.autor, "navegador");
assert.deepEqual(r.d.estado, inicial);

// 3. Clave mala o vacía: 401 en leer y en guardar.
for (const clave of ["mala", "", undefined]) {
  assert.equal((await pm({ clave, accion: "leer" })).status, 401, `leer con clave ${clave}`);
  assert.equal((await pm({ clave, accion: "guardar", base: 1, autor: "claude", estado: inicial })).status, 401, `guardar con clave ${clave}`);
}

// 4. Base vieja: 409 con la versión vigente y no se crea versión.
r = await guardar(0, inicial);
assert.equal(r.status, 409);
assert.equal(r.d.version, 1);
assert.deepEqual(r.d.estado, inicial);
assert.equal(await vigente(), 1);

// 5. Estado inválido: 400 con errores y no se crea versión.
for (const malo of [{ ...inicial, real: { ...inicial.real, sold: -1 } }, { ...inicial, schemaVersion: 2 }, null]) {
  r = await guardar(1, malo);
  assert.equal(r.status, 400, JSON.stringify(malo).slice(0, 80));
  assert.ok(Array.isArray(r.d.errores) && r.d.errores.length > 0 && r.d.errores.length <= 20, JSON.stringify(r.d));
}
assert.equal(await vigente(), 1);

// 6. Cuerpo mayor que LIMITS.importBytes: rechazado y no se crea versión.
const grande = { ...inicial, relleno: "x".repeat(M.LIMITS.importBytes) };
r = await guardar(1, grande);
assert.equal(r.status, 413);
assert.equal(await vigente(), 1);

// 7. versiones lista número, fecha y autor; leer con version devuelve esa versión.
const conVenta = { ...inicial, real: { ...inicial.real, sold: 3 } };
assert.equal((await guardar(1, conVenta)).d.version, 2);
r = await pm({ clave: CLAVE, accion: "versiones" });
assert.equal(r.status, 200);
assert.deepEqual(r.d.versiones.map((v) => [v.version, v.autor]), [[2, "claude"], [1, "navegador"]]);
assert.ok(r.d.versiones.every((v) => v.guardado_en && !("estado" in v)));
r = await leer({ version: 1 });
assert.equal(r.d.version, 1);
assert.equal(r.d.estado.real.sold, 0);
assert.equal((await leer()).d.estado.real.sold, 3);
assert.equal((await leer({ version: 99 })).status, 404);

// 8. Autor fuera de la lista: 400 y no se crea versión.
for (const autor of ["mau", "", null]) assert.equal((await guardar(2, conVenta, autor)).status, 400, `autor ${autor}`);
assert.equal(await vigente(), 2);

// Dos guardados con la misma base: uno gana, el otro 409.
const carrera = await Promise.all([guardar(2, conVenta), guardar(2, conVenta, "vytas")]);
assert.deepEqual(carrera.map((x) => x.status).sort(), [200, 409]);
assert.equal(await vigente(), 3);

console.log("OK pm: 8 casos del contrato y la carrera de guardados");
