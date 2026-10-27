// Smoke del navegador contra `pm` local, manejando Chrome headless por CDP (sin dependencias):
//   supabase db reset && node supabase/tests/pm-navegador.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env`. Supone la tabla vacía.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const M = createRequire(import.meta.url)("../../app.js");
const ROOT = new URL("../../", import.meta.url).pathname;
const PM = "http://127.0.0.1:54321/functions/v1/pm";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CLAVE = readFileSync(new URL("../functions/.env", import.meta.url), "utf8").match(/PM_CLAVE=(.*)/)[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (pend.has(m.id)) { const [ok, ko] = pend.get(m.id); pend.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
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

  ws.close();
  console.log("OK pm-navegador: 6 casos");
} finally {
  if (chrome.exitCode === null) { chrome.kill(); await once(chrome, "exit"); }
  server.close();
  rmSync(perfil, { recursive: true, force: true, maxRetries: 3 });
}
