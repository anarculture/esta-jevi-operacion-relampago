// Cámara del portero con la cámara falsa de Chrome (ticket 02 del issue #4). Aparte de ux.mjs
// porque necesita otras flags de lanzamiento. El vídeo sale del QR del token del fixture, dibujado
// con el mismo qrcode.min.js de entrada.html y pasado a y4m con ffmpeg.
//   node ticketera/tests/portero-camara.mjs [dir-capturas]
import { strict as a } from "node:assert";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE ?? join(process.env.HOME, ".npm/_npx/9833c18b2d85bc59/node_modules/playwright-core");
const { chromium } = require(PW);
const OUT = process.argv[2] ?? new URL("./evidencia", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const TOKEN = "bbbbbbbb-0000-4000-8000-000000000001";
const CLAVE_PT = "clave-portero-de-prueba";
const tmp = mkdtempSync(join(tmpdir(), "portero-camara-"));
const qrcode = require(new URL("../qrcode.min.js", import.meta.url).pathname);
const q = qrcode(0, "M");
q.addData(TOKEN);
q.make();
// QR en gris de 8 bits (PGM): 10 px por módulo, 4 módulos de margen blanco.
const n = q.getModuleCount(), lado = (n + 8) * 10;
const px = Buffer.alloc(lado * lado, 255);
for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) {
  const r = Math.floor(y / 10) - 4, c = Math.floor(x / 10) - 4;
  if (r >= 0 && c >= 0 && r < n && c < n && q.isDark(r, c)) px[y * lado + x] = 0;
}
const pgm = join(tmp, "qr.pgm");
writeFileSync(pgm, Buffer.concat([Buffer.from(`P5\n${lado} ${lado}\n255\n`), px]));
const VIDEO = join(tmp, "qr.y4m");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-i", pgm, "-t", "5", "-r", "10",
  "-vf", "scale=400:400:flags=neighbor,pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p", "-f", "yuv4mpegpipe", VIDEO]);

const PORT = 8767;
const raiz = new URL("..", import.meta.url).pathname;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", raiz], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
// Con el puerto ocupado, http.server muere y el test hablaría con el servidor de otro proceso.
if (server.exitCode !== null) throw new Error(`puerto ${PORT} ocupado: libéralo antes de correr el test`);
const URLBASE = `http://127.0.0.1:${PORT}`;
const FAKE = ["--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${VIDEO}`];
let fallos = 0;

async function caso(nombre, fn) {
  try { await fn(); console.log("ok ", nombre); }
  catch (e) { fallos++; console.log("FAIL", nombre, "\n   ", e.message.split("\n")[0]); }
}

// Contexto móvil con la clave guardada y la función `portero` respondida por un fixture.
async function abrir(browser, llamadas, { camara = true, sinDetector = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-VE", permissions: camara ? ["camera"] : [] });
  await ctx.addInitScript((c) => localStorage.setItem("ticketera-portero-clave", JSON.stringify(c)), CLAVE_PT);
  if (sinDetector) await ctx.addInitScript(() => { delete window.BarcodeDetector; });
  await ctx.route(/functions\/v1\/portero/, (route) => {
    const b = route.request().postDataJSON();
    llamadas.push(b);
    const r = b.accion === "resumen" ? { aprobadas: 112, ingresadas: 37 }
      : b.token === TOKEN || b.codigo === TOKEN.slice(0, 8) ? { resultado: "valida", token: TOKEN, numero: 12, posicion: 1, total: 2, checked_in_at: "2026-10-30T02:14:00Z" }
      : { resultado: "invalida", motivo: "no_existe" };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r) });
  });
  const page = await ctx.newPage();
  return { ctx, page };
}

async function escanea(browser, { sinDetector, foto }) {
  const llamadas = [];
  const { ctx, page } = await abrir(browser, llamadas, { sinDetector });
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector('#resultado[data-estado="valida"]:not([hidden])', { timeout: 15000 });
  a.ok((await page.textContent("#resultado")).includes("Entrada 1 de 2"), "sin 'Entrada 1 de 2'");
  if (foto) await page.screenshot({ path: join(OUT, foto) });
  await page.waitForTimeout(5000); // el QR sigue en el encuadre: no se reenvía
  const checkins = llamadas.filter((b) => b.accion === "checkin");
  a.equal(checkins.length, 1, `checkin llamado ${checkins.length} veces en 5 s de vídeo`);
  a.equal(checkins[0].token, TOKEN, "no mandó el token del QR");
  a.equal(await page.isVisible("#video"), true, "la cámara se apagó tras el resultado");
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--use-fake-ui-for-media-stream", ...FAKE] });

await caso("cámara con el decodificador vendido (jsQR): válida sin teclear y una sola llamada", async () => {
  await escanea(browser, { sinDetector: true, foto: "15-portero-camara.png" });
});

await caso("cámara con BarcodeDetector nativo, si este Chrome lo trae", async () => {
  const { ctx, page } = await abrir(browser, []);
  await page.goto(`${URLBASE}/portero.html`);
  const nativo = await page.evaluate(async () => "BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats()).includes("qr_code"));
  await ctx.close();
  if (!nativo) return console.log("    (BarcodeDetector no existe en este Chrome: el camino nativo queda para la prueba en Android)");
  await escanea(browser, { sinDetector: false });
});

await caso("cámara: ocultar la pestaña la apaga y volver la enciende", async () => {
  const { ctx, page } = await abrir(browser, [], { sinDetector: true });
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector("#video:not([hidden])");
  const vivas = () => page.evaluate(() => document.getElementById("video").srcObject?.getTracks().filter((t) => t.readyState === "live").length ?? 0);
  a.equal(await vivas(), 1, "sin pista de vídeo viva");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  a.equal(await vivas(), 0, "la cámara sigue encendida con la pestaña oculta");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForFunction(() => document.getElementById("video").srcObject?.getTracks().some((t) => t.readyState === "live"));
  await ctx.close();
});
await browser.close();

// Sin la flag que acepta el permiso solo, y con el permiso denegado en el contexto.
const sinPermiso = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: FAKE });
await caso("cámara denegada: dice 'Sin cámara' y el código de respaldo sigue validando", async () => {
  const llamadas = [];
  const { ctx, page } = await abrir(sinPermiso, llamadas, { camara: false });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Browser.setPermission", { permission: { name: "camera" }, setting: "denied", origin: URLBASE });
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector("#sin-camara:not([hidden])", { timeout: 10000 });
  a.ok((await page.textContent("#sin-camara")).includes("Sin cámara"));
  await page.screenshot({ path: join(OUT, "16-portero-sin-camara.png") });
  await page.fill("#codigo", TOKEN.slice(0, 8));
  await page.press("#codigo", "Enter");
  await page.waitForSelector('#resultado[data-estado="valida"]:not([hidden])');
  a.equal(llamadas.filter((b) => b.accion === "checkin").length, 1);
  await ctx.close();
});
await sinPermiso.close();

server.kill();
console.log(fallos ? `\n${fallos} caso(s) fallaron` : `\nOK portero-camara.mjs · capturas en ${OUT}`);
process.exit(fallos ? 1 : 0);
