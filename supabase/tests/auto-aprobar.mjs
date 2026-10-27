// Aprobación automática con `coincide` (issue #5, ticket 02) contra el Supabase local, por HTTP:
//   node supabase/tests/auto-aprobar.mjs
//   Otro stack: API=http://127.0.0.1:56321 DB_CONTAINER=supabase_db_avisos node supabase/tests/auto-aprobar.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con ADMIN_CLAVE y
// OPENROUTER_API_KEY (sin esa clave el test se salta: la IA no puede dictaminar). La config
// (Zelle activo, el interruptor) entra por SQL; los asserts miran solo lo que responden las
// funciones y las RPC. El comprobante se dibuja con la fecha de hoy para caer en la ventana del dictamen.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const ENV = readFileSync(new URL("../functions/.env", import.meta.url), "utf8");
const CLAVE = ENV.match(/ADMIN_CLAVE=(.*)/)[1];
if (!/OPENROUTER_API_KEY=\S+/.test(ENV)) {
  console.log("SKIP auto-aprobar.mjs: falta OPENROUTER_API_KEY en supabase/functions/.env; vale solo el assert SQL de aprobada_por");
  process.exit(0);
}

const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function pedir(path, body, type = "application/json") {
  const r = await fetch(API + path, { method: "POST", headers: { apikey: KEY, "Content-Type": type }, body: type === "application/json" ? JSON.stringify(body) : body });
  return { status: r.status, d: await r.json().catch(() => null) };
}

const CORREO = "pagos@sindicatobaba.test";
const antes = sql("select metodos::text || '|' || auto_aprobar::text from config"); // 'true' | 'false'
sql(`update config set metodos = metodos || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}')
  || '{"activo": true, "correo": "${CORREO}", "titular": "Mauricio Davila"}')`);

// Comprobante Zelle de $10 (1 entrada) dibujado en Chrome headless, como captura de pantalla de un teléfono.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? join(process.env.HOME, ".npm/_npx/9833c18b2d85bc59/node_modules/playwright-core"));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const hoy = new Date().toISOString().slice(0, 10); // el dictamen compara contra la fecha UTC de la orden
async function recibo(ref) {
  const page = await browser.newPage({ viewport: { width: 390, height: 640 } });
  await page.setContent(`<meta charset="utf-8"><body style="font-family:Roboto,Arial,sans-serif;margin:0;background:#fff">
    <div style="background:#6d1ed4;color:#fff;padding:18px;font-size:22px;font-weight:bold">Zelle</div>
    <div style="padding:24px;text-align:center"><div style="font-size:22px;color:#1a7f37;font-weight:bold">Payment sent</div>
    <div style="font-size:40px;font-weight:bold;margin:12px 0">$10.00</div></div>
    <table style="width:100%;font-size:17px;padding:0 20px;border-spacing:0 12px">
    <tr><td style="color:#666">Sent to</td><td style="text-align:right">Mauricio Davila</td></tr>
    <tr><td style="color:#666">Email</td><td style="text-align:right">${CORREO}</td></tr>
    <tr><td style="color:#666">Date</td><td style="text-align:right">${hoy}</td></tr>
    <tr><td style="color:#666">Confirmation number</td><td style="text-align:right">${ref}</td></tr>
    <tr><td style="color:#666">Memo</td><td style="text-align:right">Entradas</td></tr></table></body>`);
  const png = await page.screenshot();
  await page.close();
  return png;
}

// Crea la orden, corre `revisar` y devuelve el dictamen y lo que ve el comprador.
// refRecibo: la referencia impresa en la captura, si difiere de la tipeada.
async function comprar(ref, esperarAprobada, refRecibo = ref) {
  const path = `${crypto.randomUUID()}.png`;
  assert.equal((await pedir(`/storage/v1/object/capturas/${path}`, await recibo(refRecibo), "image/png")).status, 200, "subida de captura");
  const o = (await pedir("/rest/v1/rpc/crear_orden", { p_nombre: "Prueba Auto", p_cedula: "12345678", p_telefono: "",
    p_cantidad: 1, p_metodo: "zelle", p_referencia: ref, p_captura: path, p_whatsapps: ["04141234567"] })).d;
  assert.ok(o?.token, `orden creada: ${JSON.stringify(o)}`);
  const t0 = Date.now();
  const rev = (await pedir("/functions/v1/revisar", { token: o.token })).d;
  const ver = async () => (await pedir("/rest/v1/rpc/ver_orden", { p_token: o.token })).d;
  let vista = await ver();
  while (esperarAprobada && vista.estado === "en_revision" && Date.now() - t0 < 60000) {
    await new Promise((r) => setTimeout(r, 2000));
    vista = await ver();
  }
  return { o, rev, vista, segundos: (Date.now() - t0) / 1000 };
}

const base = String(Date.now()).slice(-7);
try {
  sql("update config set auto_aprobar = true");
  const si = await comprar(`9${base}1`, true);
  assert.equal(si.rev?.dictamen, "coincide", `el comprobante de prueba no cuadra: ${JSON.stringify(si.rev)}`);
  assert.equal(si.vista.estado, "aprobada", `con auto_aprobar = true quedó ${si.vista.estado}`);
  assert.equal(si.vista.entradas?.length, 1, "aprobada sin entradas");
  assert.ok(si.segundos < 60, `tardó ${si.segundos} s`);
  console.log(`ok  auto_aprobar = true: orden #${si.o.numero} aprobada en ${si.segundos.toFixed(1)} s`);

  // Una captura, una sola orden aprobada sola. La misma captura con "1"+REF: coincide, pero espera a Mau.
  const otra = await comprar(`19${base}1`, false, `9${base}1`);
  assert.equal(otra.rev?.dictamen, "coincide", `reuso: ${JSON.stringify(otra.rev)}`);
  assert.equal(otra.vista.estado, "en_revision", "la misma captura con otra referencia se aprobó sola");
  // Un comprador tipea solo los 5 últimos caracteres (espera a Mau); otro sube la misma captura con la
  // referencia exacta: la captura ya está en otra orden, aunque su referencia sea más corta que 6.
  const corta = await comprar(`9${base}3`.slice(-5), false, `9${base}3`);
  assert.notEqual(corta.rev?.dictamen, undefined, `sufijo: ${JSON.stringify(corta.rev)}`);
  assert.equal(corta.vista.estado, "en_revision", "referencia tipeada parcial se aprobó sola");
  const exacta = await comprar(`9${base}3`, false);
  assert.equal(exacta.rev?.dictamen, "coincide", `exacta: ${JSON.stringify(exacta.rev)}`);
  assert.equal(exacta.vista.estado, "en_revision", "una captura ya usada en otra orden se aprobó sola");
  console.log("ok  la misma captura no aprueba sola una segunda orden (prefijo ni sufijo)");

  sql("update config set auto_aprobar = false");
  const no = await comprar(`9${base}2`, false);
  assert.equal(no.rev?.dictamen, "coincide", `el comprobante de prueba no cuadra: ${JSON.stringify(no.rev)}`);
  assert.equal(no.vista.estado, "en_revision", `con auto_aprobar = false quedó ${no.vista.estado}`);
  console.log(`ok  auto_aprobar = false: orden #${no.o.numero} sigue en revisión con dictamen coincide`);

  const cola = (await pedir("/functions/v1/admin", { clave: CLAVE, accion: "cola" })).d;
  assert.equal(cola.find((x) => x.token === si.o.token)?.aprobada_por, "ia", "cola sin aprobada_por = ia");
  assert.equal(cola.find((x) => x.token === no.o.token)?.aprobada_por, null, "la que espera a Mau trae aprobada_por");
  // Mau aprueba la que quedó en revisión: el panel marca 'admin'.
  const res = await pedir("/functions/v1/admin", { clave: CLAVE, accion: "resolver", id: cola.find((x) => x.token === no.o.token).id, aprobar: true });
  assert.equal(res.d?.estado, "aprobada", `resolver: ${JSON.stringify(res.d)}`);
  const cola2 = (await pedir("/functions/v1/admin", { clave: CLAVE, accion: "cola" })).d;
  assert.equal(cola2.find((x) => x.token === no.o.token)?.aprobada_por, "admin", "aprobada por el panel sin aprobada_por = admin");
  console.log("OK auto-aprobar.mjs");
} finally {
  const [metodos, auto] = antes.split("|");
  sql(`update config set metodos = '${metodos.replace(/'/g, "''")}'::jsonb, auto_aprobar = ${auto === "true"}`);
  await browser.close();
}
