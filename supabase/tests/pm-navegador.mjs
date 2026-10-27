// Smoke del navegador contra `pm` local, manejando Chrome headless por CDP (sin dependencias):
//   supabase db reset && node supabase/tests/pm-navegador.mjs
//   Otro stack: API=http://127.0.0.1:58321 DB_CONTAINER=supabase_db_pm-ticketera node supabase/tests/pm-navegador.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con PM_CLAVE y ADMIN_CLAVE.
// Supone `pm_versiones` y `ordenes` vacías. Las órdenes de la ticketera (casos 7 a 10) nacen con
// `crear_orden` y se aprueban con `admin`, como en pm-ticketera.mjs; la config entra por SQL y se restaura.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const M = createRequire(import.meta.url)("../../app.js");
const ROOT = new URL("../../", import.meta.url).pathname;
const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const PM = API + "/functions/v1/pm";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const ENV = readFileSync(new URL("../functions/.env", import.meta.url), "utf8");
const CLAVE = ENV.match(/PM_CLAVE=(.*)/)[1];
const ADMIN = ENV.match(/ADMIN_CLAVE=(.*)/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Datos del pagador por tipo (issue #6): crear_orden los exige.
const PAGADOR = { pago_movil: { banco: "BNC", telefono: "04147654321", cedula: "9876543" }, zelle: { titular: "Prueba Pagador" }, binance: { id: "prueba_pagador" } };
const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function pedir(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json().catch(() => null);
}
// Orden aprobada por el panel, como en pm-ticketera.mjs.
let nOrden = 0;
async function aprobada(metodo, cantidad) {
  const o = await pedir("/rest/v1/rpc/crear_orden", { p_nombre: "Prueba Navegador", p_cedula: "12345678", p_telefono: "",
    p_cantidad: cantidad, p_metodo: metodo, p_referencia: `PMNAVEGADOR${Date.now()}${nOrden++}`,
    p_captura: `${crypto.randomUUID()}.png`, p_whatsapps: Array(cantidad).fill("04141234567"),
    p_pagador: PAGADOR[metodo.startsWith("pago_movil") ? "pago_movil" : metodo] });
  assert.ok(o?.token, `crear_orden: ${JSON.stringify(o)}`);
  const id = (await pedir("/functions/v1/admin", { clave: ADMIN, accion: "cola" })).find((x) => x.token === o.token).id;
  assert.equal((await pedir("/functions/v1/admin", { clave: ADMIN, accion: "resolver", id, aprobar: true }))?.estado, "aprobada");
  return pedir("/rest/v1/rpc/ver_orden", { p_token: o.token });
}

// La página llama a `pm` en 127.0.0.1:54321 fijo (app.js); con otro stack, un proxy en ese puerto reenvía a API.
// shortcut: si otro stack ocupa 54321, este test corre solo contra ese (sin API) o con ese stack apagado.
const proxy = new URL(API).port === "54321" ? null : createServer(async (req, res) => {
  const partes = [];
  for await (const p of req) partes.push(p);
  const headers = { ...req.headers };
  for (const h of ["host", "connection", "content-length"]) delete headers[h];
  const r = await fetch(API + req.url, { method: req.method, headers, body: partes.length ? Buffer.concat(partes) : undefined }).catch(() => null);
  if (!r) return res.writeHead(502).end();
  const out = Object.fromEntries(r.headers);
  for (const h of ["content-encoding", "content-length", "transfer-encoding", "connection"]) delete out[h];
  res.writeHead(r.status, out).end(Buffer.from(await r.arrayBuffer()));
}).listen(54321, "127.0.0.1");
if (proxy) await once(proxy, "listening");
const antes = sql("select row_to_json(c) from config c");

async function pm(body) {
  const r = await fetch(PM, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify({ clave: CLAVE, ...body }) });
  return r.json();
}
const leer = () => pm({ accion: "leer" });
const sembrar = async (base, sold, autor) => {
  const { estado } = await leer();
  assert.equal((await pm({ accion: "guardar", base, autor, estado: { ...estado, real: { ...estado.real, sold } } })).version, base + 1);
};

// Raíz del repo por HTTP local (shortcut: sin defensa de rutas, solo para este test).
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const server = createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  try { res.writeHead(200, { "Content-Type": TYPES[extname(p)] ?? "application/octet-stream" }).end(readFileSync(join(ROOT, p))); }
  catch { res.writeHead(404).end(); }
}).listen(0, "127.0.0.1");
await once(server, "listening");
const PAGE = `http://127.0.0.1:${server.address().port}/index.html`;

const perfil = mkdtempSync(join(tmpdir(), "pm-cdp-"));
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${perfil}`, "--remote-debugging-port=0", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });

try {
  const wsBrowser = await new Promise((ok, ko) => {
    let buf = "";
    chrome.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
    chrome.on("exit", () => ko(new Error("chrome salió antes de abrir CDP")));
    setTimeout(() => ko(new Error("chrome no abrió CDP en 15 s")), 15000);
  });
  const targets = await (await fetch(`http://127.0.0.1:${new URL(wsBrowser).port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let seq = 0;
  const pend = new Map();
  const llamadasPm = [];
  const consola = [];
  let cortadas = 0; // pedidos a `pm` que el caso de red caída hizo fallar
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (pend.has(m.id)) { const [ok, ko] = pend.get(m.id); pend.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
    else if (m.method === "Fetch.requestPaused") { cortadas++; cdp("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "InternetDisconnected" }); }
    else if (m.method === "Runtime.exceptionThrown") consola.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") consola.push(m.params.args.map((x) => x.value ?? x.description).join(" "));
    else if (m.method === "Network.requestWillBeSent" && m.params.request.url.includes("/functions/v1/pm")) llamadasPm.push(m.params.request.url);
  };
  const cdp = (method, params = {}) => new Promise((ok, ko) => { pend.set(++seq, [ok, ko]); ws.send(JSON.stringify({ id: seq, method, params })); });
  const ev = async (expr) => {
    const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? expr);
    return r.result.value;
  };
  // 20 s: el primer pedido a una función local recién arrancada tarda ~8 s.
  async function hasta(expr, ms = 20000) {
    const t = Date.now();
    for (;;) {
      if (await ev(expr).catch(() => false)) return;
      if (Date.now() - t > ms) {
        const pagina = await ev("['ind-save', 'save-detail', 'data-msg', 'storage-alert'].map((id) => id + ': ' + document.getElementById(id).textContent).join(' | ')").catch((e) => e.message);
        throw new Error(`timeout esperando: ${expr}\n  página: ${pagina}\n  llamadas a pm: ${llamadasPm.length}\n  consola: ${consola.join(" / ")}`);
      }
      await sleep(200);
    }
  }
  const S = JSON.stringify;
  const abrir = async () => { await cdp("Page.navigate", { url: PAGE }); await sleep(300); await hasta("document.readyState === 'complete' && !!window.SindicatoBaba"); };
  const escribir = (id, v) => ev(`(() => { const el = document.getElementById(${S(id)}); el.value = ${S(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const texto = (id) => ev(`document.getElementById(${S(id)}).textContent`);
  const respaldoSold = () => ev(`JSON.parse(localStorage.getItem(${S(M.BACKUP_KEY)})).real.sold`);
  const vigente = async () => (await leer()).version;

  await cdp("Network.enable");
  await cdp("Runtime.enable");

  // 1. Sin clave: la app carga, guarda local y no llama a `pm`.
  await abrir();
  await escribir("v-sold", "5");
  await sleep(2500);
  assert.equal(llamadasPm.length, 0, `sin clave no hay llamadas a pm: ${llamadasPm}`);
  assert.match(await texto("ind-save"), /^Guardado \d/);
  assert.match(await texto("save-detail"), /en este navegador/);
  console.log("1 sin clave: guardado local, 0 llamadas a pm");

  // 2. Con clave y remoto vacío: lo local se sube como versión 1 de `navegador`.
  await ev(`(() => { document.getElementById('pm-clave').value = ${S(CLAVE)}; document.getElementById('pm-form').requestSubmit(); })()`);
  await hasta(`document.getElementById('ind-save').textContent.startsWith('Sincronizado')`);
  let r = await leer();
  assert.equal(r.version, 1);
  assert.equal(r.autor, "navegador");
  assert.equal(r.estado.real.sold, 5);
  console.log("2 remoto vacío: subido como versión 1, autor navegador");

  // 3. Versión remota sembrada y recarga: se ve el remoto y lo local queda en el respaldo anterior.
  await sembrar(1, 7, "claude");
  await abrir();
  await hasta(`document.getElementById('v-sold').value === '7'`);
  assert.equal(await respaldoSold(), 5);
  console.log("3 recarga: muestra 7, respaldo anterior con 5");

  // 4. Editar un campo: tras el debounce hay versión nueva con el valor editado.
  await escribir("v-sold", "8");
  for (let i = 0; i < 100 && (await vigente()) !== 3; i++) await sleep(200);
  r = await leer();
  assert.equal(r.version, 3);
  assert.equal(r.estado.real.sold, 8);
  assert.equal(r.autor, "navegador");
  console.log("4 edición: versión 3 con 8");

  // 5. Conflicto: otro autor guarda y la página edita con base vieja → carga el remoto y avisa.
  await sembrar(3, 9, "vytas");
  await escribir("v-sold", "10");
  await hasta(`document.getElementById('v-sold').value === '9'`);
  assert.equal(await respaldoSold(), 10);
  assert.match(await texto("data-msg"), /respaldo anterior/);
  await sleep(2500);
  assert.equal(await vigente(), 4, "la página no pisó la versión de vytas");
  // CAPTURA=<ruta.png> guarda la pantalla del conflicto como evidencia.
  if (process.env.CAPTURA) writeFileSync(process.env.CAPTURA, Buffer.from((await cdp("Page.captureScreenshot")).data, "base64"));
  console.log("5 conflicto: muestra 9, respaldo con 10, aviso:", await texto("data-msg"));

  // 6. Clave mala: se olvida.
  await ev(`localStorage.setItem(${S(M.CLAVE_KEY)}, 'mala')`);
  await abrir();
  await hasta(`localStorage.getItem(${S(M.CLAVE_KEY)}) === null`);
  console.log("6 clave mala: olvidada");

  // 7. Ticketera (spec #3): dos órdenes aprobadas (2 pago móvil + 1 Zelle) y 3 vendidas fuera, sembradas.
  sql(`update config set tasa_eur = 200, tasa_consultada_en = now(), metodos = metodos
    || jsonb_build_object('pago_movil_bnc', coalesce(metodos -> 'pago_movil_bnc', '{}') || '{"activo": true}')
    || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}') || '{"activo": true}')
    || jsonb_build_object('binance', coalesce(metodos -> 'binance', '{}') || '{"activo": true}')`);
  const movil = await aprobada("pago_movil_bnc", 2);
  await aprobada("zelle", 1);
  await sembrar(await vigente(), 3, "claude");
  const manual = (await leer()).estado.real;
  await ev(`localStorage.setItem(${S(M.CLAVE_KEY)}, ${S(CLAVE)})`);
  await abrir();
  await hasta(`document.getElementById('tk-entradas').textContent === '3 entradas'`);
  await hasta(`document.getElementById('v-sold-out').textContent.startsWith('6 entradas')`);
  assert.equal(await texto("tk-cobrado"), M.fmtMoney(3000));
  const bs = new Intl.NumberFormat("es-419", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(movil.monto_bs);
  assert.ok((await texto("tk-pago-movil")).endsWith("Bs " + bs), `Bs de pago móvil: ${await texto("tk-pago-movil")}`);
  assert.match(await texto("tk-estado"), /^Ticketera al \d{1,2}:\d{2}/);
  assert.ok(!(await texto("tk-estado")).includes("vieja"), await texto("tk-estado"));
  assert.equal(await texto("cr-income"), M.fmtMoney(manual.ticketsCollectedCents + manual.sponsorCollectedCents + manual.barCollectedCents + 3000), "la caja real no suma la ticketera");
  console.log("7 ticketera:", await texto("tk-entradas"), "·", await texto("tk-cobrado"), "·", await texto("tk-pago-movil"), "· vendidas", await texto("v-sold-out"), "·", await texto("tk-estado"));

  // 8. Una tercera orden y "Actualizar": cifras nuevas sin recargar ni tocar el estado.
  await ev("window.__sinRecarga = true");
  const versionAntes = await vigente();
  await aprobada("binance", 1);
  await ev("document.getElementById('tk-actualizar').click()");
  await hasta(`document.getElementById('tk-entradas').textContent === '4 entradas'`);
  assert.equal(await ev("window.__sinRecarga"), true, "Actualizar recargó la página");
  await sleep(2500); // más que el debounce de guardado: si Actualizar tocara el estado, ya habría versión nueva
  assert.equal(await vigente(), versionAntes, "Actualizar subió estado");
  assert.ok((await texto("v-sold-out")).startsWith("7 entradas"), await texto("v-sold-out"));
  if (process.env.CAPTURA_TK) {
    await ev("location.hash = '#ventas'");
    await sleep(400);
    writeFileSync(process.env.CAPTURA_TK, Buffer.from((await cdp("Page.captureScreenshot", { captureBeyondViewport: true })).data, "base64"));
  }
  console.log("8 actualizar: 4 entradas sin recargar");

  // 9. Red caída y recarga: quedan las cifras de la última lectura, marcadas viejas.
  await cdp("Fetch.enable", { patterns: [{ urlPattern: "*/functions/v1/pm*" }] });
  await abrir();
  for (let i = 0; i < 100 && cortadas === 0; i++) await sleep(100);
  assert.ok(cortadas > 0, "la página no intentó leer");
  await sleep(500);
  assert.equal(await texto("tk-entradas"), "4 entradas");
  assert.match(await texto("tk-estado"), /^Ticketera al \d{1,2}:\d{2}.*, puede estar vieja$/);
  await cdp("Fetch.disable");
  console.log("9 sin red:", await texto("tk-estado"));

  // 10. Sin clave y sin lectura previa: "Sin conexión con la ticketera" y la caja solo con lo manual.
  await ev("localStorage.clear()");
  await abrir();
  await escribir("v-sold", "2");
  await hasta(`document.getElementById('v-sold-out').textContent === '2 entradas pagadas'`);
  assert.equal(await texto("tk-estado"), "Sin conexión con la ticketera");
  assert.equal(await texto("tk-entradas"), "—");
  assert.equal(await texto("cr-income"), M.fmtMoney(0));
  assert.equal(await ev("document.getElementById('tk-actualizar').disabled && !document.getElementById('tk-motivo').hidden"), true, "Actualizar sin motivo");
  // Un bloque guardado con otra forma se ignora sin romper la caja.
  const errores = consola.length;
  await ev(`localStorage.setItem(${S(M.STORAGE_KEY + ":ticketera")}, '{"aprobadas":{"entradas":"x"}}')`);
  await abrir();
  await hasta(`document.getElementById('v-sold-out').textContent === '2 entradas pagadas'`);
  assert.equal(await texto("tk-estado"), "Sin conexión con la ticketera");
  assert.equal(consola.length, errores, `errores en consola: ${consola.slice(errores).join(" / ")}`);
  console.log("10 sin clave:", await texto("tk-estado"), "· vendidas", await texto("v-sold-out"));

  ws.close();
  console.log("OK pm-navegador: 10 casos");
} finally {
  if (chrome.exitCode === null) { chrome.kill(); await once(chrome, "exit"); }
  server.close();
  proxy?.close();
  sql(`update config set (metodos, tasa_eur, tasa_consultada_en) = (select metodos, tasa_eur, tasa_consultada_en
    from json_populate_record(null::config, '${antes.replace(/'/g, "''")}'))`);
  rmSync(perfil, { recursive: true, force: true, maxRetries: 3 });
}
