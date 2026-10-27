// Función `lectura` (issue #7) contra el Supabase local, por HTTP:
//   node supabase/tests/lectura.mjs
//   Otro stack: API=http://127.0.0.1:57321 DB_CONTAINER=supabase_db_cotejo node supabase/tests/lectura.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con OPENROUTER_API_KEY (sin
// ella se salta) y pago_movil_bnc activo. Sube el recibo sintético, lo lee dos veces (la segunda sin
// OCR), prueba el límite por IP y que `revisar` reutiliza la lectura guardada.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
if (!/OPENROUTER_API_KEY=\S+/.test(readFileSync(new URL("../functions/.env", import.meta.url), "utf8"))) {
  console.log("SKIP lectura.mjs: falta OPENROUTER_API_KEY en supabase/functions/.env");
  process.exit(0);
}

const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function pedir(path, body, { type = "application/json", ip } = {}) {
  const headers = { apikey: KEY, "Content-Type": type, ...(ip ? { "x-forwarded-for": ip } : {}) };
  const r = await fetch(API + path, { method: "POST", headers, body: type === "application/json" ? JSON.stringify(body) : body });
  return { status: r.status, d: await r.json().catch(() => null) };
}

// El recibo sintético de pago móvil, dibujado en Chrome headless.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? join(process.env.HOME, ".npm/_npx/9833c18b2d85bc59/node_modules/playwright-core"));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 640 } });
await page.setContent(readFileSync(new URL("./recibo-sintetico.html", import.meta.url), "utf8"));
const png = await page.screenshot();
await browser.close();

const ipA = `198.51.100.${Math.floor(Math.random() * 250)}`;
const ipB = `203.0.113.${Math.floor(Math.random() * 250)}`;
const path = `${crypto.randomUUID()}.png`;
assert.equal((await pedir(`/storage/v1/object/capturas/${path}`, png, { type: "image/png" })).status, 200, "subida de captura");

// Validación del path antes de tocar nada.
assert.equal((await pedir("/functions/v1/lectura", { path: "../config.png" }, { ip: ipA })).status, 400, "path inválido aceptado");
assert.equal((await pedir("/functions/v1/lectura", { path: `${crypto.randomUUID()}.png` }, { ip: ipA })).status, 404, "captura inexistente");

const l1 = await pedir("/functions/v1/lectura", { path }, { ip: ipA });
assert.equal(l1.status, 200, `lectura: ${JSON.stringify(l1.d)}`);
assert.equal(l1.d.ocr.documentType, "pago_movil", `documentType: ${JSON.stringify(l1.d.ocr)}`);
assert.match(l1.d.ocr.reference, /71239946/, "referencia leída");
assert.equal(l1.d.ocr.transactionTime, "22:41", "la hora impresa (10:41 pm) no quedó en 24 horas");
for (const k of ["recipientPhone", "recipientId", "recipientName", "editSignals", "confidence"]) {
  assert.ok(!(k in l1.d.ocr), `la respuesta trae ${k}`);
}
assert.ok(!JSON.stringify(l1.d).includes("1234567") && !JSON.stringify(l1.d).includes("12.345.678"), "teléfono o cédula de destino en la respuesta");
const l2 = await pedir("/functions/v1/lectura", { path }, { ip: ipA });
assert.equal(l2.d?.creada_en, l1.d.creada_en, "la segunda lectura volvió al OCR");
assert.deepEqual(l2.d.ocr, l1.d.ocr, "la segunda lectura devolvió otra cosa");
console.log(`ok  lectura: ref ${l1.d.ocr.reference}, hora ${l1.d.ocr.transactionTime || "—"}; la segunda devuelve la guardada`);

// Límite: la IP B ya hizo 10 lecturas en la última hora; la 11 responde 429 sin tocar el OCR.
sql(`insert into lecturas (path, ip, ocr) select 'lectura-test-' || g || '-' || '${ipB}', '${ipB}', '{}' from generate_series(1, 10) g`);
try {
  const l11 = await pedir("/functions/v1/lectura", { path: `${crypto.randomUUID()}.png` }, { ip: `${ipB}, 10.0.0.1` });
  assert.equal(l11.status, 429, `lectura 11: ${JSON.stringify(l11.d)}`);
  assert.equal(l11.d?.error, "demasiadas_lecturas");
  assert.equal((await pedir("/functions/v1/lectura", { path }, { ip: ipB })).status, 200, "el límite frenó una lectura ya guardada");
  console.log("ok  la lectura 11 de una IP en una hora responde 429");
} finally {
  sql(`delete from lecturas where ip = '${ipB}' and path like 'lectura-test-%'`);
}

// `revisar` reutiliza la lectura: se marca la guardada y la orden debe quedar con esa misma marca.
const venta = (await pedir("/functions/v1/tasa", {})).d;
assert.ok(venta.metodos?.pago_movil_bnc, "pago_movil_bnc activo");
sql(`update lecturas set ocr = ocr || '{"marca": "lectura-test"}' where path = '${path}'`);
const o = (await pedir("/rest/v1/rpc/crear_orden", { p_nombre: "Prueba Lectura", p_cedula: "12345678", p_telefono: "",
  p_cantidad: 1, p_metodo: "pago_movil_bnc", p_referencia: `8${String(Date.now()).slice(-7)}`, p_captura: path,
  p_whatsapps: ["04141234567"], p_pagador: { banco: "BNC", telefono: "04245551122", cedula: "9876543" } })).d;
assert.ok(o?.token, `orden creada: ${JSON.stringify(o)}`);
const rev = await pedir("/functions/v1/revisar", { token: o.token });
assert.equal(rev.status, 200, `revisar: ${JSON.stringify(rev.d)}`);
const [igual, marca] = sql(`select o.ocr = l.ocr, o.ocr ->> 'marca' from ordenes o join lecturas l on l.path = o.captura where o.token = '${o.token}'`).split("|");
assert.equal(marca, "lectura-test", "revisar volvió a llamar al OCR en vez de usar la lectura");
assert.equal(igual, "t", "ordenes.ocr distinto de lecturas.ocr");
console.log(`ok  revisar reutilizó la lectura: orden #${o.numero}, dictamen ${rev.d.dictamen}`);
console.log("OK lectura.mjs");
