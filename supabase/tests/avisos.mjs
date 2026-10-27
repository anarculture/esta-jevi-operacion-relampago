// Contrato HTTP de la función `avisos` (vytas) y de `admin` `reenviar_aviso` (panel), issue #5:
//   node supabase/tests/avisos.mjs
//   Otro stack: API=http://127.0.0.1:56321 DB_CONTAINER=supabase_db_avisos node supabase/tests/avisos.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con PM_CLAVE y ADMIN_CLAVE.
// Las órdenes de prueba entran por SQL (como una venta manual) y se aprueban con resolver_orden;
// los asserts miran solo lo que responden las funciones.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const ENV = readFileSync(new URL("../functions/.env", import.meta.url), "utf8");
const PM = ENV.match(/PM_CLAVE=(.*)/)[1];
const ADMIN = ENV.match(/ADMIN_CLAVE=(.*)/)[1];

const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function llamar(fn, body) {
  const r = await fetch(`${API}/functions/v1/${fn}`, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, d: await r.json().catch(() => null) };
}
const avisos = (body) => llamar("avisos", { clave: PM, ...body });
const pendientes = async (numero) => (await avisos({ accion: "pendientes" })).d.filter((p) => p.numero === numero);

// Orden aprobada de 2 entradas con WhatsApp, y otra sin WhatsApp (venta manual vieja).
const ref = `AVISOSTEST${Date.now()}`;
const nueva = (r, was) => sql(`with o as (insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura, monto_usd_cents)
  values ('Prueba Avisos', 'V99999999', '584141110001', ${was}, 2, 'zelle', '${r}', 'manual.jpg', 2000) returning id)
  select resolver_orden(id, true)->>'numero' from o;`);
const numero = Number(nueva(ref, "array['584141110001', '584241110002']"));
const sinWa = Number(nueva(ref + "B", "null"));

for (const accion of ["pendientes", "avisada"]) {
  assert.equal((await llamar("avisos", { clave: "mala", accion, id: crypto.randomUUID(), ok: true })).status, 401, `clave mala en ${accion}`);
}
assert.equal((await llamar("avisos", { clave: ADMIN, accion: "pendientes" })).status, 401, "ADMIN_CLAVE abre avisos");

let p = await pendientes(numero);
assert.equal(p.length, 2, `pendientes de la orden: ${JSON.stringify(p)}`);
assert.deepEqual(p.map((x) => [x.posicion, x.total]), [[1, 2], [2, 2]], "posiciones");
assert.ok(p.every((x) => x.jid === `${x.whatsapp}@s.whatsapp.net`), "jid");
assert.deepEqual(p.map((x) => x.whatsapp), ["584141110001", "584241110002"], "WhatsApp por posición");
assert.ok(p[0].texto.includes("1 de 2") && p[0].texto.includes("entrada.html?e=") && p[0].texto.includes("orden.html?t="), `texto 1: ${p[0].texto}`);
assert.ok(p[1].texto.includes("2 de 2") && p[1].texto.includes("entrada.html?e=") && !p[1].texto.includes("orden.html?t="), `texto 2: ${p[1].texto}`);
assert.equal((await pendientes(sinWa)).length, 0, "pendientes incluye entradas sin WhatsApp");
const [e1, e2] = p.map((x) => x.id);

// ok: sale de pendientes; repetirlo no cambia la hora.
const a1 = (await avisos({ accion: "avisada", id: e1, ok: true })).d;
assert.ok(a1.avisada_en, `avisada: ${JSON.stringify(a1)}`);
assert.deepEqual((await pendientes(numero)).map((x) => x.id), [e2], "la avisada sigue en pendientes");
assert.equal((await avisos({ accion: "avisada", id: e1, ok: true })).d.avisada_en, a1.avisada_en, "un ok repetido cambió avisada_en");
assert.equal((await avisos({ accion: "avisada", id: e1, ok: false, error: "tarde" })).d.aviso_intentos, 0, "un error sobre una avisada contó");

// 5 errores: sale de pendientes con aviso_intentos = 5.
let r;
for (let k = 1; k <= 5; k++) {
  r = (await avisos({ accion: "avisada", id: e2, ok: false, error: `no se pudo enviar ${k}` })).d;
  assert.equal(r.aviso_intentos, k, `intento ${k}: ${JSON.stringify(r)}`);
  assert.equal((await pendientes(numero)).length, k < 5 ? 1 : 0, `pendientes tras ${k} errores`);
}
assert.equal((await avisos({ accion: "avisada", id: crypto.randomUUID(), ok: true })).status, 404, "entrada inexistente");

// Panel: estado de cada entrada sin el número completo; reenviar corrige y vuelve a la cola.
const cola = (await llamar("admin", { clave: ADMIN, accion: "cola" })).d;
const mia = cola.find((o) => o.numero === numero);
assert.deepEqual(mia.entradas.map((e) => [e.posicion, e.whatsapp_mascara, Boolean(e.avisada_en), e.aviso_intentos]),
  [[1, "0001", true, 0], [2, "0002", false, 5]], `cola: ${JSON.stringify(mia.entradas)}`);
assert.equal(mia.entradas[1].aviso_error, "no se pudo enviar 5");
assert.ok(!JSON.stringify(mia.entradas).includes("584241110002"), "la cola expone el número completo");
assert.equal((await llamar("admin", { clave: "mala", accion: "reenviar_aviso", id: e2 })).status, 401, "reenviar sin clave");
assert.equal((await llamar("admin", { clave: ADMIN, accion: "reenviar_aviso", id: e2, whatsapp: "123" })).d?.error, "whatsapp_invalido");
const re = await llamar("admin", { clave: ADMIN, accion: "reenviar_aviso", id: e2, whatsapp: "0416-765.43.21" });
assert.equal(re.d?.whatsapp_mascara, "4321", `reenviar: ${JSON.stringify(re.d)}`);
p = await pendientes(numero);
assert.deepEqual(p.map((x) => [x.id, x.whatsapp, x.jid]), [[e2, "584167654321", "584167654321@s.whatsapp.net"]], "reenviar no la devolvió con el número nuevo");
await llamar("admin", { clave: ADMIN, accion: "reenviar_aviso", id: e1 });
assert.equal((await pendientes(numero)).length, 2, "reenviar sin número no devolvió la avisada");

// Limpieza: que no quede en la cola de avisos de este stack.
sql(`update entradas set avisada_en = now() where orden_id in (select id from ordenes where referencia like '${ref}%')`);
console.log(`OK avisos.mjs · orden #${numero}`);
