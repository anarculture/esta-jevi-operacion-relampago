// Bloque `ticketera` que `leer` de la Edge Function `pm` adjunta (issue #3, ticket 01), por HTTP como un agente:
//   supabase db reset && node supabase/tests/pm-ticketera.mjs
//   Otro stack: API=http://127.0.0.1:58321 DB_CONTAINER=supabase_db_pm-ticketera node supabase/tests/pm-ticketera.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con PM_CLAVE y ADMIN_CLAVE.
// Supone `ordenes` vacía. La config (métodos activos, tasa) entra por SQL y se restaura al final; las
// órdenes nacen con la RPC `crear_orden` y se resuelven con `admin` (`resolver`); los asserts miran
// solo lo que responde `leer`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const M = createRequire(import.meta.url)("../../app.js");
const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const ENV = readFileSync(new URL("../functions/.env", import.meta.url), "utf8");
const PM = ENV.match(/PM_CLAVE=(.*)/)[1];
const ADMIN = ENV.match(/ADMIN_CLAVE=(.*)/)[1];

// Datos del pagador por tipo (issue #6): crear_orden los exige.
const PAGADOR = { pago_movil: { banco: "BNC", telefono: "04147654321", cedula: "9876543" }, zelle: { titular: "Prueba Pagador" }, binance: { id: "prueba_pagador" } };
const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function pedir(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, d: await r.json().catch(() => null) };
}
const pm = (body) => pedir("/functions/v1/pm", { clave: PM, ...body });
async function ticketera(extra) {
  const r = await pm({ accion: "leer", ...extra });
  assert.equal(r.status, 200, JSON.stringify(r.d));
  assert.ok(r.d.ticketera, `leer sin bloque ticketera: ${JSON.stringify(r.d)}`);
  return r.d.ticketera;
}

// Crea una orden como el comprador; aprobar true/false la resuelve el panel, undefined la deja en revisión.
let n = 0;
async function orden(metodo, cantidad, aprobar) {
  const o = (await pedir("/rest/v1/rpc/crear_orden", { p_nombre: "Prueba Ticketera", p_cedula: "12345678", p_telefono: "",
    p_cantidad: cantidad, p_metodo: metodo, p_referencia: `PMTICKETERA${Date.now()}${n++}`,
    p_captura: `${crypto.randomUUID()}.png`, p_whatsapps: Array(cantidad).fill("04141234567"),
    p_pagador: PAGADOR[metodo.startsWith("pago_movil") ? "pago_movil" : metodo] })).d;
  assert.ok(o?.token, `crear_orden: ${JSON.stringify(o)}`);
  if (aprobar !== undefined) {
    const id = (await pedir("/functions/v1/admin", { clave: ADMIN, accion: "cola" })).d.find((x) => x.token === o.token).id;
    const r = await pedir("/functions/v1/admin", { clave: ADMIN, accion: "resolver", id, aprobar });
    assert.equal(r.d?.estado, aprobar ? "aprobada" : "rechazada", `resolver: ${JSON.stringify(r.d)}`);
  }
  return (await pedir("/rest/v1/rpc/ver_orden", { p_token: o.token })).d;
}

const CERO = { ordenes: 0, entradas: 0, usd_cents: 0 };
const antes = sql("select row_to_json(c) from config c");
sql(`update config set tasa_eur = 200, tasa_consultada_en = now(), metodos = metodos
  || jsonb_build_object('pago_movil_bnc', coalesce(metodos -> 'pago_movil_bnc', '{}') || '{"activo": true}')
  || jsonb_build_object('pago_movil_ubii', coalesce(metodos -> 'pago_movil_ubii', '{}') || '{"activo": true}')
  || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}') || '{"activo": true}')
  || jsonb_build_object('binance', coalesce(metodos -> 'binance', '{}') || '{"activo": true}')`);
try {
  // 1. Sin órdenes: todo en 0, los tres métodos presentes, sin última aprobación.
  let t = await ticketera();
  assert.ok(Math.abs(Date.parse(t.consultado_en) - Date.now()) < 60000, `consultado_en: ${t.consultado_en}`);
  assert.deepEqual(t.aprobadas, CERO, "hay órdenes aprobadas: corre `supabase db reset` antes");
  assert.deepEqual(t.en_revision, CERO, "hay órdenes en revisión: corre `supabase db reset` antes");
  assert.deepEqual(t.por_metodo, { pago_movil: { ...CERO, bs: 0 }, zelle: { ...CERO, bs: null }, binance: { ...CERO, bs: null } });
  assert.equal(t.ultima_aprobacion, null);

  // 2. Una orden de 2 entradas por pago móvil aprobada: $20 nominales y sus Bs aparte.
  const movil = await orden("pago_movil_bnc", 2, true);
  t = await ticketera();
  assert.deepEqual(t.aprobadas, { ordenes: 1, entradas: 2, usd_cents: 2000 });
  assert.ok(movil.monto_bs > 0, `monto_bs: ${movil.monto_bs}`);
  assert.deepEqual(t.por_metodo.pago_movil, { ordenes: 1, entradas: 2, usd_cents: 2000, bs: movil.monto_bs });
  assert.ok(Date.parse(t.ultima_aprobacion) > 0, `ultima_aprobacion: ${t.ultima_aprobacion}`);

  // 3. Una en revisión (Ubii) y una rechazada (Zelle): no cuentan en aprobadas; solo la de revisión en en_revision.
  await orden("pago_movil_ubii", 1);
  await orden("zelle", 3, false);
  t = await ticketera();
  assert.deepEqual(t.aprobadas, { ordenes: 1, entradas: 2, usd_cents: 2000 }, "en revisión o rechazada contó como aprobada");
  assert.deepEqual(t.en_revision, { ordenes: 1, entradas: 1, usd_cents: 1000 }, "en_revision");
  assert.deepEqual(t.por_metodo.pago_movil, { ordenes: 1, entradas: 2, usd_cents: 2000, bs: movil.monto_bs }, "la de revisión sumó en pago móvil");
  assert.deepEqual(t.por_metodo.zelle, { ...CERO, bs: null }, "la rechazada sumó en Zelle");

  // 4. Zelle y Binance aprobadas suman en su método, sin bolívares.
  await orden("zelle", 1, true);
  await orden("binance", 3, true);
  t = await ticketera();
  assert.deepEqual(t.por_metodo.zelle, { ordenes: 1, entradas: 1, usd_cents: 1000, bs: null });
  assert.deepEqual(t.por_metodo.binance, { ordenes: 1, entradas: 3, usd_cents: 3000, bs: null });
  assert.deepEqual(t.aprobadas, { ordenes: 3, entradas: 6, usd_cents: 6000 });
  for (const dato of ["Prueba", "12345678", "4141234567", "PMTICKETERA", "token"]) {
    assert.ok(!JSON.stringify(t).includes(dato), `el bloque lleva datos de la orden: ${dato}`);
  }

  // 5. Clave mala, vacía o la del panel: 401 sin bloque.
  for (const clave of ["mala", "", ADMIN]) {
    const r = await pedir("/functions/v1/pm", { clave, accion: "leer" });
    assert.equal(r.status, 401, `leer con clave ${clave === ADMIN ? "ADMIN_CLAVE" : JSON.stringify(clave)}`);
    assert.ok(!("ticketera" in (r.d ?? {})), "401 con bloque");
  }

  // 6. `leer` de una versión histórica trae el bloque actual, igual que la vigente.
  const base = (await pm({ accion: "leer" })).d.version;
  const v1 = await pm({ accion: "guardar", base, autor: "claude", estado: M.defaultState() });
  assert.equal(v1.status, 200, JSON.stringify(v1.d));
  assert.equal((await pm({ accion: "guardar", base: v1.d.version, autor: "claude", estado: M.defaultState() })).status, 200);
  const hist = await pm({ accion: "leer", version: v1.d.version });
  assert.equal(hist.status, 200, JSON.stringify(hist.d));
  assert.equal(hist.d.version, v1.d.version);
  assert.deepEqual(hist.d.estado, M.defaultState(), "el bloque entró al estado guardado");
  const { consultado_en: _h, ...hBloque } = hist.d.ticketera ?? {};
  const { consultado_en: _t, ...tBloque } = t;
  assert.deepEqual(hBloque, tBloque, "leer con version no trae el bloque actual");
  assert.equal((await pm({ accion: "leer", version: 999 })).status, 404);

  console.log(`OK pm-ticketera: 6 casos · aprobadas ${JSON.stringify(t.aprobadas)}`);
} finally {
  sql(`update config set (metodos, tasa_eur, tasa_consultada_en) = (select metodos, tasa_eur, tasa_consultada_en
    from json_populate_record(null::config, '${antes.replace(/'/g, "''")}'))`);
}
