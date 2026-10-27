// Check de la tanda 1 de UX en el seam cliente <-> Supabase: las páginas corren en
// Chrome headless y cada petición a la API se responde con un fixture. Deja capturas
// a 390x844 en el directorio que se pase como argumento (default: tests/evidencia).
//   node ticketera/tests/ux.mjs [dir-capturas]
import { strict as a } from "node:assert";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_CORE ?? join(process.env.HOME, ".npm/_npx/9833c18b2d85bc59/node_modules/playwright-core");
const { chromium } = require(PW);
const OUT = process.argv[2] ?? new URL("./evidencia", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PORT = 8766;
const raiz = new URL("..", import.meta.url).pathname;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", raiz], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
// Con el puerto ocupado, http.server muere y el test hablaría con el servidor de otro proceso.
if (server.exitCode !== null) throw new Error(`puerto ${PORT} ocupado: libéralo antes de correr el test`);
const URLBASE = `http://127.0.0.1:${PORT}`;

const VENTA = {
  precio_usd_cents: 1000, precio_pm_eur_cents: 1000, tasa_eur: 993.0884, tasa_eur_fecha: "2026-10-23",
  metodos: {
    pago_movil_bnc: { activo: true, nombre: "Pago móvil BNC", banco: "0191 BNC", telefono: "04145287337", cedula: "V21616092" },
    zelle: { activo: true, nombre: "Zelle", correo: "mau@example.com", titular: "Mauricio Davila" },
  },
};
const ORDEN = {
  numero: 12, estado: "en_revision", nombre: "Ana Pérez", cedula: "V12345678", cantidad: 3, metodo: "pago_movil_bnc",
  referencia: "12283", monto_usd_cents: 3000, monto_bs: 29792.65, creada_en: "2026-10-26T18:00:00Z", rechazo_motivo: null, entradas: null,
};
const TOKENS = ["aaaaaaaa-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000003"];
const COLA = [
  { id: "o1", numero: 12, token: "t1", creada_en: "2026-10-26T18:00:00Z", nombre: "Ana Pérez", cedula: "V12345678", telefono: "04141234567", cantidad: 3, metodo: "pago_movil_bnc", referencia: "12283", monto_usd_cents: 3000, monto_bs: 29792.65, pagador: { banco: "Mercantil", telefono: "584147654321", cedula: "V9876543" }, estado: "en_revision", dictamen: "coincide", dictamen_motivo: "monto, referencia, fecha y destinatario coinciden", rechazo_motivo: null, captura_url: null },
  { id: "o2", numero: 11, token: "t2", creada_en: "2026-10-26T17:00:00Z", nombre: "Beto Díaz", cedula: "V87654321", telefono: "04241234567", cantidad: 1, metodo: "zelle", referencia: "ZX99", monto_usd_cents: 1000, monto_bs: null, pagador: { titular: "Beto Díaz" }, estado: "aprobada", dictamen: "dudoso", dictamen_motivo: "no se lee la fecha", rechazo_motivo: null, captura_url: null },
  { id: "o3", numero: 10, token: "t3", creada_en: "2026-10-26T16:00:00Z", nombre: "Caro Ruiz", cedula: "V11111111", telefono: "04161234567", cantidad: 2, metodo: "pago_movil_bnc", referencia: "555", monto_usd_cents: 2000, monto_bs: 19861.77, estado: "rechazada", dictamen: "no_coincide", dictamen_motivo: "monto menor", rechazo_motivo: "El monto no coincide", captura_url: null },
];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const llamadas = [];
let fallos = 0;

async function pagina(fixtures, { offline = false, storage = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "es-VE", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  await ctx.route(/(rest\/v1|functions\/v1|storage\/v1)/, async (route) => {
    const u = new URL(route.request().url());
    const nombre = u.pathname.split("/").slice(-1)[0];
    const clave = u.pathname.includes("/storage/") ? "storage" : nombre;
    llamadas.push(clave);
    if (typeof offline === "function" ? offline() : offline) return route.abort("internetdisconnected"); // función: red que se corta y vuelve
    const fx = fixtures[clave];
    if (fx === undefined) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: `sin fixture: ${clave}` }) });
    const body = typeof fx === "function" ? fx(route.request().postDataJSON?.() ?? {}) : fx;
    return route.fulfill({ status: body?.__status ?? 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return ctx;
}

async function caso(nombre, fn) {
  try { await fn(); console.log("ok ", nombre); }
  catch (e) { fallos++; console.log("FAIL", nombre, "\n   ", e.message.split("\n")[0]); }
}
const foto = (page, n) => page.screenshot({ path: join(OUT, `${n}.png`), fullPage: true });

// ---------- compra ----------
await caso("compra: pasos ocultos, monto en euros a tasa BCV, copiar plano, validación antes de subir", async () => {
  const ctx = await pagina({ tasa: VENTA, crear_orden: () => ({ numero: 13, token: TOKENS[0] }), storage: { Key: "x" }, revisar: {} });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  a.equal(await page.isHidden("#pago"), true, "paso 2 visible antes de elegir método");
  a.equal(await page.isHidden("#reporte"), true, "paso 3 visible antes de pagar");
  a.ok((await page.textContent("ol.pasos")).includes("organizador"), "no dice a quién se paga");
  await foto(page, "01-compra-inicio");

  await page.fill("#cantidad", "3");
  await page.check("input[value=pago_movil_bnc]");
  await page.waitForSelector("#pago:not([hidden])");
  a.equal(await page.isHidden("#reporte"), true, "paso 3 apareció sin tocar 'Ya pagué'");
  a.equal(await page.textContent("#monto"), "Bs 29.792,65", "monto no es 3 x 10 EUR x tasa euro");
  a.equal(await page.getAttribute("#copiar-monto", "data-copiar"), "29792,65", "monto a copiar con formato");
  a.ok((await page.textContent("#tasa")).includes("€30") && (await page.textContent("#tasa")).includes("23/10"), "línea de tasa");
  a.equal(await page.locator('#destino button[data-copiar="04145287337"]').count(), 1, "copiar teléfono");
  a.equal(await page.textContent("#l-referencia"), "Referencia del pago móvil");
  await page.click('#destino button[data-copiar="04145287337"]');
  a.equal(await page.evaluate(() => navigator.clipboard.readText()), "04145287337", "portapapeles");
  await foto(page, "02-compra-pago-movil");

  await page.click("#ya-pague");
  await page.waitForSelector("#reporte:not([hidden])");
  await page.fill("#referencia", "712283");
  await page.selectOption("#pagador-banco", "Mercantil");
  await page.fill("#pagador-telefono", "04147654321");
  await page.fill("#pagador-cedula", "9876543");
  await page.fill("#nombre", "Ana Pérez");
  await page.fill("#cedula", "12");
  await page.fill("#telefono", "04141234567");
  await page.fill("#wa-2", "04241234567");
  await page.fill("#wa-3", "04161234567");
  const png = join(tmpdir(), "captura-test.png");
  writeFileSync(png, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
  await page.setInputFiles("#captura", png);
  a.equal(await page.isVisible("#preview"), true, "sin miniatura de la captura");
  llamadas.length = 0;
  await page.click("#enviar");
  await page.waitForSelector("#e-cedula:not([hidden])");
  a.ok(!llamadas.includes("storage"), "subió la captura con la cédula inválida");
  await foto(page, "03-compra-error-cedula");

  await page.fill("#cedula", "V12345678");
  await page.click("#enviar");
  await page.waitForURL(/orden\.html\?t=/);
  a.ok(llamadas.includes("storage") && llamadas.includes("crear_orden"), "no subió ni registró");
  a.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ticketera-orden")).numero), 13, "orden no guardada en el teléfono");
  await ctx.close();
});

await caso("compra: cantidad fuera de rango avisa en vez de recortar; zelle en dólares", async () => {
  const ctx = await pagina({ tasa: VENTA });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  await page.check("input[value=zelle]");
  await page.waitForSelector("#pago:not([hidden])");
  a.equal(await page.textContent("#monto"), "$10");
  a.equal(await page.textContent("#l-referencia"), "Número de confirmación de Zelle");
  await page.fill("#cantidad", "15");
  a.equal(await page.isVisible("#e-cantidad"), true, "no avisa con 15 entradas");
  a.equal(await page.inputValue("#cantidad"), "15", "recortó la cantidad en silencio");
  await ctx.close();
});

await caso("compra: un WhatsApp por entrada, error antes de subir, recarga los conserva, p_whatsapps normalizados", async () => {
  let args = null;
  const ctx = await pagina({ tasa: VENTA, crear_orden: (b) => ((args = b), { numero: 14, token: TOKENS[1] }), storage: { Key: "x" }, revisar: {} });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  await page.fill("#cantidad", "3");
  await page.check("input[value=zelle]");
  await page.click("#ya-pague");
  a.equal(await page.locator("#telefono, #otros-wa input[type=tel]").count(), 3, "cantidad 3 sin 3 campos de WhatsApp");
  a.equal(await page.textContent("label[for=telefono]"), "Tu WhatsApp");
  a.equal(await page.textContent("label[for=wa-3]"), "WhatsApp de la entrada 3");
  a.ok((await page.textContent("#otros-wa")).includes("Le llegará su QR por WhatsApp"), "sin ayuda en los campos de amigos");
  await page.fill("#referencia", "ZX12345");
  await page.fill("#pagador-titular", "Ana Pérez");
  await page.fill("#nombre", "Ana Pérez");
  await page.fill("#cedula", "V12345678");
  await page.fill("#telefono", "0414-123.45.67");
  await page.fill("#wa-2", "+1 305 555 0100");
  await page.fill("#wa-3", "12345");
  await page.reload();
  await page.waitForSelector("#wa-3");
  a.deepEqual([await page.inputValue("#telefono"), await page.inputValue("#wa-2"), await page.inputValue("#wa-3")],
    ["0414-123.45.67", "+1 305 555 0100", "12345"], "la recarga no restauró los 3 WhatsApps");
  const png = join(tmpdir(), "captura-test.png");
  await page.setInputFiles("#captura", png);
  llamadas.length = 0;
  await page.click("#enviar");
  await page.waitForSelector("#e-wa-3:not([hidden])");
  a.ok(!llamadas.includes("storage") && !llamadas.includes("crear_orden"), "subió o registró con un WhatsApp de 5 dígitos");
  a.equal(await page.isHidden("#e-wa-2"), true, "marcó un número extranjero válido");
  await foto(page, "03b-compra-whatsapp-invalido");
  await page.fill("#wa-3", "04241112233");
  await page.click("#enviar");
  await page.waitForURL(/orden\.html\?t=/);
  a.deepEqual(args.p_whatsapps, ["584141234567", "13055550100", "584241112233"], "p_whatsapps sin normalizar");
  // Misma tabla que ticketera.sql: venezolano sin el 0 y +58 0414… no pueden salir a otro país.
  a.deepEqual(await page.evaluate(() => ["0414-123.45.67", "414 123 4567", "+58 0414 123 4567", "+1 (305) 555-0100", "12345"].map(normalizarWhatsapp)),
    ["584141234567", "584141234567", "584141234567", "13055550100", null], "normalizarWhatsapp distinta de SQL");
  await ctx.close();
});

await caso("compra: referencia de 5 caracteres marca error sin subir; con 6 envía", async () => {
  const ctx = await pagina({ tasa: VENTA, crear_orden: () => ({ numero: 15, token: TOKENS[2] }), storage: { Key: "x" }, revisar: {} });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  await page.check("input[value=pago_movil_bnc]");
  await page.click("#ya-pague");
  a.ok((await page.getAttribute("#referencia", "placeholder")).includes("últimos 6"), "el hint no pide los últimos 6");
  await page.fill("#referencia", "0-12.283"); // 5 tras normalizar: el cero a la izquierda no cuenta
  await page.selectOption("#pagador-banco", "BNC");
  await page.fill("#pagador-telefono", "04147654321");
  await page.fill("#pagador-cedula", "V9876543");
  await page.fill("#nombre", "Ana Pérez");
  await page.fill("#cedula", "V12345678");
  await page.fill("#telefono", "04141234567");
  await page.setInputFiles("#captura", join(tmpdir(), "captura-test.png"));
  llamadas.length = 0;
  await page.click("#enviar");
  await page.waitForSelector("#e-referencia:not([hidden])");
  a.ok((await page.textContent("#e-referencia")).includes("últimos 6"), "el error no pide los últimos 6");
  a.ok(!llamadas.includes("storage") && !llamadas.includes("crear_orden"), "subió o registró con 5 caracteres");
  await foto(page, "03c-compra-referencia-corta");
  await page.fill("#referencia", "712283");
  await page.click("#enviar");
  await page.waitForURL(/orden\.html\?t=/);
  a.ok(llamadas.includes("crear_orden"), "con 6 caracteres no registró");
  await ctx.close();
});

await caso("compra: pago móvil pide banco, teléfono y cédula del pagador; p_pagador con las tres claves; Zelle solo titular", async () => {
  let args = null;
  const ctx = await pagina({ tasa: VENTA, crear_orden: (b) => ((args = b), { numero: 16, token: TOKENS[0] }), storage: { Key: "x" }, revisar: {} });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  await page.check("input[value=pago_movil_bnc]");
  await page.click("#ya-pague");
  for (const id of ["pagador-banco", "pagador-telefono", "pagador-cedula"]) a.equal(await page.isVisible(`#${id}`), true, `sin #${id} en pago móvil`);
  for (const id of ["pagador-titular", "pagador-id"]) a.equal(await page.isHidden(`#${id}`), true, `#${id} visible en pago móvil`);
  await page.fill("#referencia", "712283");
  await page.fill("#nombre", "Ana Pérez");
  await page.fill("#cedula", "V12345678");
  await page.fill("#telefono", "04141234567");
  await page.setInputFiles("#captura", join(tmpdir(), "captura-test.png"));
  llamadas.length = 0;
  await page.click("#enviar");
  await page.waitForSelector("#e-pagador-banco:not([hidden])");
  a.equal(await page.isVisible("#e-pagador-telefono"), true, "teléfono del pagador vacío sin error");
  a.equal(await page.isVisible("#e-pagador-cedula"), true, "cédula del pagador vacía sin error");
  a.ok(!llamadas.includes("storage") && !llamadas.includes("crear_orden"), "subió o registró sin datos del pagador");
  await page.selectOption("#pagador-banco", "Mercantil");
  await page.fill("#pagador-telefono", "0414-765.43.21");
  await page.fill("#pagador-cedula", "v-9.876.543");
  await page.reload();
  await page.waitForSelector("#pagador-banco");
  a.deepEqual([await page.inputValue("#pagador-banco"), await page.inputValue("#pagador-telefono"), await page.inputValue("#pagador-cedula")],
    ["Mercantil", "0414-765.43.21", "v-9.876.543"], "la recarga no restauró los datos del pagador");
  await foto(page, "03d-compra-pagador-pago-movil");
  await page.setInputFiles("#captura", join(tmpdir(), "captura-test.png"));
  await page.click("#enviar");
  await page.waitForURL(/orden\.html\?t=/);
  a.deepEqual(args.p_pagador, { banco: "Mercantil", telefono: "0414-765.43.21", cedula: "v-9.876.543" }, "p_pagador de pago móvil");

  const z = await ctx.newPage();
  await z.goto(`${URLBASE}/index.html`);
  await z.waitForSelector("#metodos input");
  await z.check("input[value=zelle]");
  await z.click("#ya-pague");
  a.equal(await z.isVisible("#pagador-titular"), true, "sin titular en Zelle");
  for (const id of ["pagador-banco", "pagador-telefono", "pagador-cedula", "pagador-id"]) a.equal(await z.isHidden(`#${id}`), true, `#${id} visible en Zelle`);
  await ctx.close();
});

await caso("compra: 'Ver mi orden' si ya compró; borrador restaurado tras recarga", async () => {
  const ctx = await pagina({ tasa: VENTA }, { storage: { "ticketera-orden": JSON.stringify({ token: TOKENS[0], numero: 13 }), "ticketera-borrador": JSON.stringify({ cantidad: "2", metodo: "zelle", nombre: "Ana" }) } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/index.html`);
  await page.waitForSelector("#metodos input");
  a.equal(await page.textContent("#mi-orden-link"), "Ver mi orden #13");
  a.equal(await page.inputValue("#cantidad"), "2");
  a.equal(await page.isChecked("input[value=zelle]"), true, "método no restaurado");
  a.equal(await page.isHidden("#reporte"), false, "paso 3 cerrado con borrador a medias");
  a.equal(await page.inputValue("#nombre"), "Ana");
  await ctx.close();
});

// ---------- orden ----------
await caso("orden en revisión: espera neutra con contacto, guardar enlace", async () => {
  const ctx = await pagina({ ver_orden: ORDEN }, { storage: { "ticketera-borrador": JSON.stringify({ telefono: "04141234567" }) } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/orden.html?t=${TOKENS[0]}`);
  await page.waitForSelector(".espera");
  a.ok((await page.textContent(".espera")).includes("menos de una hora"));
  a.ok((await page.getAttribute("a.btn", "href")).startsWith("https://wa.me/584141234567?text="), "guardar enlace no va al propio WhatsApp");
  a.ok((await page.getAttribute("a.btn", "href")).includes(encodeURIComponent(`orden.html?t=${TOKENS[0]}`)), "el enlace no viaja en el mensaje");
  a.equal(await page.getAttribute("button[data-copiar]", "data-copiar"), `${URLBASE}/orden.html?t=${TOKENS[0]}`);
  a.ok((await page.textContent("main")).includes("CC Chacaíto"), "sin lugar");
  await foto(page, "04-orden-en-revision");
  await ctx.close();
});

await caso("orden aprobada: QR por entrada, enviar a un amigo, consejo de captura, copia offline", async () => {
  const MASCARAS = ["4567", "2233", "0100"];
  const aprobada = { ...ORDEN, estado: "aprobada", entradas: TOKENS.map((token, i) => ({
    token, whatsapp_mascara: MASCARAS[i], avisada_en: i === 1 ? "2026-10-30T01:03:00Z" : null })) };
  const ctx = await pagina({ ver_orden: aprobada });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/orden.html?t=${TOKENS[0]}`);
  await page.waitForSelector(".qr svg");
  a.equal(await page.locator(".qr svg").count(), 3, "no hay 3 QR");
  a.deepEqual(await page.$$eval(".qr .envio", (ps) => ps.map((p) => p.textContent)),
    ["Para el ···4567 · pendiente de envío", "Enviada al ···2233 a las 21:03", "Para el ···0100 · pendiente de envío"], "tarjeta sin WhatsApp o estado de envío");
  a.ok(!(await page.textContent("main")).includes("584141234567"), "número completo en la orden");
  a.ok((await page.textContent(".aviso")).includes("captura de pantalla"));
  a.equal(await page.locator(".qr a.btn").count(), 3, "sin botón de enviar por entrada");
  a.ok((await page.getAttribute(".qr a.btn", "href")).includes(encodeURIComponent(`entrada.html?e=${TOKENS[0]}`)));
  a.ok((await page.textContent(".qr")).includes("Código de respaldo"));
  await foto(page, "05-orden-aprobada");
  const cache = await page.evaluate((t) => localStorage.getItem(`ticketera-orden-${t}`), TOKENS[0]);
  a.ok(cache, "no guardó copia de la orden aprobada");
  await ctx.close();

  const off = await pagina({}, { offline: true, storage: { [`ticketera-orden-${TOKENS[0]}`]: cache } });
  const p2 = await off.newPage();
  await p2.goto(`${URLBASE}/orden.html?t=${TOKENS[0]}`);
  await p2.waitForSelector(".qr svg");
  a.equal(await p2.locator(".qr svg").count(), 3, "sin red no pintó la copia");
  a.ok((await p2.textContent("main")).includes("sin conexión"));
  await foto(p2, "06-orden-sin-red");
  await off.close();

  // Copia guardada antes del issue #5: tokens en texto, sin WhatsApp.
  const vieja = await pagina({}, { offline: true, storage: { [`ticketera-orden-${TOKENS[0]}`]: JSON.stringify({ ...ORDEN, estado: "aprobada", entradas: TOKENS }) } });
  const p3 = await vieja.newPage();
  await p3.goto(`${URLBASE}/orden.html?t=${TOKENS[0]}`);
  await p3.waitForSelector(".qr svg");
  a.equal(await p3.locator(".qr svg").count(), 3, "la copia vieja sin red no pintó los QR");
  a.ok((await p3.textContent(".qr")).includes(`Código de respaldo: ${TOKENS[0].slice(0, 8)}`), "copia vieja sin código de respaldo");
  await vieja.close();
});

await caso("orden rechazada con motivo y salida por WhatsApp; sin red y sin copia; no encontrada", async () => {
  const ctx = await pagina({ ver_orden: { ...ORDEN, estado: "rechazada", rechazo_motivo: "El monto no coincide" } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/orden.html?t=${TOKENS[1]}`);
  await page.waitForSelector(".error a.btn");
  a.ok((await page.textContent(".error")).includes("El monto no coincide"));
  a.ok((await page.getAttribute(".error a.btn", "href")).includes("584145287337") && (await page.getAttribute(".error a.btn", "href")).includes("%2312"), "wa.me sin número de orden");
  await foto(page, "07-orden-rechazada");
  await ctx.close();

  const off = await pagina({}, { offline: true });
  const p2 = await off.newPage();
  await p2.goto(`${URLBASE}/orden.html?t=${TOKENS[2]}`);
  await p2.waitForSelector(".error");
  a.ok((await p2.textContent(".error")).includes("Sin conexión"), "fallo de red dice otra cosa");
  await off.close();

  const nf = await pagina({ ver_orden: null });
  const p3 = await nf.newPage();
  await p3.goto(`${URLBASE}/orden.html?t=${TOKENS[2]}`);
  await p3.waitForSelector("h1");
  a.ok((await p3.textContent("main")).includes("Orden no encontrada") && (await p3.locator("a.btn").count()) >= 2, "no encontrada sin salida");
  await foto(p3, "08-orden-no-encontrada");
  await nf.close();
});

// ---------- entrada ----------
await caso("entrada individual: QR, posición, sin datos personales; inexistente", async () => {
  const ctx = await pagina({ ver_entrada: { numero: 12, posicion: 2, total: 3, whatsapp_mascara: "2233" } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/entrada.html?e=${TOKENS[1]}`);
  await page.waitForSelector(".qr svg");
  const txt = await page.textContent("main");
  a.ok(txt.includes("Entrada 2 de 3") && txt.includes("CC Chacaíto") && !txt.includes("Ana"));
  a.ok(txt.includes("···2233"), "entrada sin el WhatsApp enmascarado");
  await foto(page, "09-entrada");
  await ctx.close();
  const nf = await pagina({ ver_entrada: null });
  const p2 = await nf.newPage();
  await p2.goto(`${URLBASE}/entrada.html?e=${TOKENS[2]}`);
  await p2.waitForSelector(".error");
  a.ok((await p2.textContent("main")).includes("Entrada no encontrada"));
  await nf.close();
});

// ---------- admin ----------
await caso("admin: cola, título con pendientes, filtro, rechazo con motivo, WhatsApp al aprobar", async () => {
  const resueltas = [];
  const ctx = await pagina({ admin: (b) => {
    if (b.clave !== "clave-buena-de-prueba") return { __status: 401, error: "clave_invalida" };
    if (b.accion === "cola") return COLA;
    resueltas.push(b);
    return { numero: 12, estado: b.aprobar ? "aprobada" : "rechazada" };
  } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__abiertos = []; window.open = (u) => { window.__abiertos.push(u); return null; }; });
  await page.goto(`${URLBASE}/admin.html`);
  await page.fill("#clave", "mala");
  await page.click("#login button");
  await page.waitForSelector("#error:not([hidden])");
  a.equal(await page.textContent("#error"), "Clave incorrecta.");
  await page.fill("#clave", "clave-buena-de-prueba");
  await page.click("#login button");
  await page.waitForSelector("#cola .card");
  a.equal(await page.title(), "(1) Conciliar · Sindicato Baba");
  a.ok((await page.textContent("#hechas")).includes("Rechazada") && (await page.textContent("#hechas")).includes("El monto no coincide"), "estado crudo o sin motivo");
  a.equal(await page.locator("#hechas a.btn").count(), 2, "sin WhatsApp en resueltas");
  await foto(page, "10-admin-cola");
  await page.fill("#buscar", "caro");
  a.equal(await page.locator("#hechas .card").count(), 1);
  a.equal(await page.locator("#cola .card").count(), 0);
  await page.fill("#buscar", "");

  page.on("dialog", (d) => d.accept("2")); // prompt de motivo: opción 2; confirm de aprobar: aceptar
  await page.click("#cola button.mal");
  await page.waitForFunction(() => document.title.startsWith("(1)"));
  a.equal(resueltas.length, 1, "rechazar no llamó a resolver");
  a.deepEqual([resueltas[0].aprobar, resueltas[0].motivo], [false, "El monto no coincide"]);
  await page.click("#cola button[data-aprobar]");
  await page.waitForFunction(() => window.__abiertos.length === 1);
  a.equal(resueltas[1].aprobar, true);
  a.ok((await page.evaluate(() => window.__abiertos[0])).startsWith("https://wa.me/584141234567?text="), "no abrió WhatsApp al aprobar");
  await ctx.close();
});

await caso("admin: 'desde' con los datos del pagador; el buscador encuentra por cédula y teléfono del pagador", async () => {
  const ctx = await pagina({ admin: () => COLA }, { storage: { "ticketera-clave": "clave-buena-de-prueba" } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/admin.html`);
  await page.waitForSelector("#cola .card");
  a.ok((await page.textContent("#cola .card")).includes("desde 04147654321 · V9876543 · Mercantil"), "sin 'desde' de pago móvil");
  a.ok((await page.textContent("#hechas")).includes("desde Beto Díaz"), "sin 'desde' de Zelle");
  await foto(page, "10d-admin-pagador");
  for (const q of ["9876543", "04147654321"]) {
    await page.fill("#buscar", q);
    a.equal(await page.locator("#cola .card").count(), 1, `buscar ${q}: no encontró la orden`);
    a.equal(await page.locator("#hechas .card").count(), 0, `buscar ${q}: trajo otras`);
  }
  await ctx.close();
});

await caso("admin: chip 'Aprobada por IA' solo en las que aprobó la IA", async () => {
  const cola = [{ ...COLA[1], id: "ia", numero: 21, aprobada_por: "ia" }, { ...COLA[1], id: "mau", numero: 20, nombre: "Dani Mora", aprobada_por: "admin" }];
  const ctx = await pagina({ admin: () => cola }, { storage: { "ticketera-clave": "clave-buena-de-prueba" } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/admin.html`);
  await page.waitForSelector("#hechas .card");
  const tarjetas = await page.$$eval("#hechas .card", (cs) => cs.map((c) => c.textContent));
  a.ok(tarjetas[0].includes("#21") && tarjetas[0].includes("Aprobada por IA"), "la de la IA sin chip");
  a.ok(tarjetas[1].includes("#20") && !tarjetas[1].includes("por IA"), "la de Mau con chip de IA");
  await foto(page, "10b-admin-aprobada-por-ia");
  await ctx.close();
});

await caso("admin: estado del aviso por entrada y 'Reenviar' con número corregido", async () => {
  const entradas = [
    { id: "e1", posicion: 1, whatsapp_mascara: "4567", avisada_en: "2026-10-30T01:03:00Z", aviso_error: null, aviso_intentos: 0 },
    { id: "e2", posicion: 2, whatsapp_mascara: "2233", avisada_en: null, aviso_error: null, aviso_intentos: 0 },
    { id: "e3", posicion: 3, whatsapp_mascara: "0100", avisada_en: null, aviso_error: "número sin WhatsApp", aviso_intentos: 2 },
    { id: "e4", posicion: 4, whatsapp_mascara: "9999", avisada_en: null, aviso_error: "timeout", aviso_intentos: 5 },
  ];
  const pedidas = [];
  const ctx = await pagina({ admin: (b) => {
    if (b.accion === "reenviar_aviso") {
      pedidas.push(b);
      Object.assign(entradas[3], { whatsapp_mascara: "4321", aviso_error: null, aviso_intentos: 0 });
      return { id: b.id, whatsapp_mascara: "4321" };
    }
    return [{ ...COLA[1], cantidad: 4, entradas }];
  } }, { storage: { "ticketera-clave": "clave-buena-de-prueba" } });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/admin.html`);
  await page.waitForSelector("#hechas .envio");
  const filas = await page.$$eval("#hechas .envio", (fs) => fs.map((f) => f.textContent.replace(/\s+/g, " ").trim()));
  a.ok(filas[0].includes("Entrada 1 · ···4567") && filas[0].includes("enviada 21:03"), `enviada: ${filas[0]}`);
  a.ok(filas[1].includes("···2233") && filas[1].includes("pendiente"), `pendiente: ${filas[1]}`);
  a.ok(filas[2].includes("error: número sin WhatsApp"), `error: ${filas[2]}`);
  a.ok(filas[3].includes("intentos agotados"), `agotados: ${filas[3]}`);
  a.ok(!filas.join(" ").includes("584"), "el panel muestra el número completo");
  await foto(page, "10c-admin-avisos");

  await page.click('button[data-reenviar="e4"]');
  await page.fill(".reenvio:not([hidden]) input", "123");
  await page.click('button[data-confirmar="e4"]');
  await page.waitForSelector("#error:not([hidden])");
  a.equal(pedidas.length, 0, "reenvió un número inválido");
  await page.fill(".reenvio:not([hidden]) input", "0416-765.43.21");
  await page.click('button[data-confirmar="e4"]');
  await page.waitForFunction(() => document.querySelectorAll("#hechas .envio")[3]?.textContent.includes("···4321"));
  a.deepEqual(pedidas.map((b) => [b.accion, b.id, b.whatsapp]), [["reenviar_aviso", "e4", "0416-765.43.21"]], "Reenviar no llamó a admin con el número tecleado");
  a.ok((await page.$$eval("#hechas .envio", (fs) => fs[3].textContent)).includes("pendiente"), "tras reenviar la fila no quedó pendiente");
  await ctx.close();
});

// ---------- portero ----------
const CLAVE_PT = "clave-portero-de-prueba";
const PT = { bbbbbbbb: "bbbbbbbb-0000-4000-8000-000000000001", cccccccc: "cccccccc-0000-4000-8000-000000000002", eeeeeeee: "eeeeeeee-0000-4000-8000-000000000003" };
const HORA_PT = "2026-10-30T02:14:00Z"; // 22:14 en Caracas
function puerta(llamadasPt) {
  return (b) => {
    llamadasPt.push(b);
    if (b.clave !== CLAVE_PT) return { __status: 401, error: "clave_invalida" };
    if (b.accion === "resumen") return { aprobadas: 112, ingresadas: 37 };
    if (b.accion === "deshacer") return { ok: true };
    const c = b.codigo ?? b.token?.slice(0, 8);
    if (c === "bbbbbbbb" || c === "eeeeeeee") return { resultado: "valida", token: PT[c], numero: 12, posicion: 1, total: 2, checked_in_at: HORA_PT };
    if (c === "cccccccc") return { resultado: "ya_usada", token: PT[c], numero: 12, posicion: 2, total: 2, checked_in_at: HORA_PT };
    return { resultado: "invalida", motivo: "no_existe" };
  };
}
const espiarVibracion = () => { window.__vib = []; Object.defineProperty(navigator, "vibrate", { value: (p) => (window.__vib.push(p), true) }); };
async function teclear(page, codigo) {
  await page.fill("#codigo", codigo);
  await page.press("#codigo", "Enter");
}

await caso("portero: sin clave pide clave; clave mala avisa; buena entra con contador", async () => {
  const ll = [];
  const ctx = await pagina({ portero: puerta(ll) });
  const page = await ctx.newPage();
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector("#login:not([hidden])");
  a.equal(await page.isHidden("#panel"), true, "panel visible sin clave");
  a.equal(ll.length, 0, "llamó a la función sin clave");
  await foto(page, "11-portero-clave");
  await page.fill("#clave", "mala");
  await page.click("#login button");
  await page.waitForSelector("#error:not([hidden])");
  a.equal(await page.textContent("#error"), "Clave incorrecta.");
  await page.fill("#clave", CLAVE_PT);
  await page.click("#login button");
  await page.waitForSelector("#panel:not([hidden])");
  a.equal(await page.textContent("#contador"), "37 ingresaron de 112 aprobadas");
  a.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ticketera-portero-clave"))), CLAVE_PT, "no guardó la clave");
  await ctx.close();
});

await caso("portero: válida verde con vibración y deshacer, vuelve sola; ya usada con hora; inválida roja", async () => {
  const ll = [];
  const ctx = await pagina({ portero: puerta(ll) }, { storage: { "ticketera-portero-clave": JSON.stringify(CLAVE_PT) } });
  const page = await ctx.newPage();
  await page.addInitScript(espiarVibracion);
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector("#panel:not([hidden])");

  await teclear(page, "BBBBBBBB");
  await page.waitForSelector("#resultado:not([hidden])");
  a.equal(await page.getAttribute("#resultado", "data-estado"), "valida");
  a.ok((await page.getAttribute("#resultado", "class")).includes("valida"));
  a.equal(await page.evaluate(() => getComputedStyle(document.getElementById("resultado")).backgroundColor), "rgb(46, 216, 71)", "válida no es verde neón");
  a.ok((await page.textContent("#resultado")).includes("Entrada 1 de 2"), "válida sin 'Entrada 1 de 2'");
  a.deepEqual(await page.evaluate(() => window.__vib), [[80]], "no vibró un pulso corto");
  a.equal(await page.isVisible("#deshacer"), true, "sin 'Deshacer' tras una válida");
  a.equal(ll.filter((b) => b.accion === "checkin").at(-1).codigo, "bbbbbbbb", "no mandó el código normalizado");
  await foto(page, "12-portero-valida");

  await teclear(page, "bbbbbbbb"); // mismo código dentro de los 3 s: se ignora
  await page.waitForSelector("#resultado", { state: "hidden", timeout: 3500 });
  a.equal(ll.filter((b) => b.accion === "checkin").length, 1, "reenvió el mismo código antes de 3 s");

  await teclear(page, "cccccccc");
  await page.waitForSelector("#resultado:not([hidden])");
  a.equal(await page.getAttribute("#resultado", "data-estado"), "ya_usada");
  a.ok((await page.textContent("#resultado")).includes("22:14"), "ya usada sin la hora del primer ingreso");
  a.equal(await page.evaluate(() => getComputedStyle(document.getElementById("resultado")).backgroundColor), "rgb(255, 214, 10)", "ya usada no es amarillo marcador");
  await foto(page, "13-portero-ya-usada");
  await page.click("#resultado"); // un toque lo cierra antes
  a.equal(await page.isHidden("#resultado"), true, "el toque no cerró el resultado");

  await teclear(page, "dddddddd");
  await page.waitForSelector("#resultado:not([hidden])");
  a.equal(await page.getAttribute("#resultado", "data-estado"), "invalida");
  a.ok((await page.textContent("#r-titulo")).includes("Inválida"));
  a.equal(await page.isHidden("#deshacer"), true, "'Deshacer' visible tras una inválida");
  a.deepEqual((await page.evaluate(() => window.__vib)).at(-1), [400], "inválida no vibró largo");
  await foto(page, "14-portero-invalida");
  await page.click("#resultado");

  await teclear(page, "eeeeeeee");
  await page.waitForSelector("#resultado:not([hidden])");
  await page.click("#resultado");
  await page.click("#deshacer");
  await page.waitForSelector("#aviso:not([hidden])");
  a.deepEqual(ll.filter((b) => b.accion === "deshacer").map((b) => b.token), [PT.eeeeeeee], "deshacer no mandó el token de la última válida");
  a.equal(await page.isHidden("#deshacer"), true);
  await ctx.close();
});

await caso("portero sin señal: lista descargada, validación local en cola, reenvío con aviso, lista ordenada e imprimible", async () => {
  const A = "a1a1a1a1-0000-4000-8000-000000000001", B = "f0f0f0f0-0000-4000-8000-000000000009";
  const LISTA = { generada_en: "2026-10-30T00:35:00Z", entradas: [ // desordenada a propósito
    { token: B, numero: 14, posicion: 1, total: 1, checked_in_at: null },
    { token: A, numero: 12, posicion: 1, total: 2, checked_in_at: null },
    { token: "a2a2a2a2-0000-4000-8000-000000000002", numero: 12, posicion: 2, total: 2, checked_in_at: "2026-10-30T01:50:00Z" },
  ] };
  const ll = [];
  let sinRedPt = false, claveMala = false;
  const ctx = await pagina({ portero: (b) => {
    ll.push(b);
    if (claveMala) return { __status: 401, error: "clave_invalida" };
    if (b.accion === "lista") return LISTA;
    if (b.accion === "resumen") return { aprobadas: 3, ingresadas: 1 };
    if (b.accion === "deshacer") return { ok: true };
    if (b.token === B) return { resultado: "ya_usada", token: B, numero: 14, posicion: 1, total: 1, checked_in_at: "2026-10-30T01:00:00Z" };
    return { resultado: "valida", token: b.token, numero: 12, posicion: 1, total: 2, checked_in_at: "2026-10-30T02:00:00Z" };
  } }, { offline: () => sinRedPt, storage: { "ticketera-portero-clave": JSON.stringify(CLAVE_PT) } });
  const page = await ctx.newPage();
  const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), k);
  const checkins = () => ll.filter((b) => b.accion === "checkin").map((b) => b.token);
  async function resultado(codigo) {
    await teclear(page, codigo);
    await page.waitForSelector("#resultado:not([hidden])");
    const r = { estado: await page.getAttribute("#resultado", "data-estado"), texto: await page.innerText("#resultado") };
    await page.click("#resultado");
    return r;
  }
  await page.goto(`${URLBASE}/portero.html`);
  await page.waitForSelector("#panel:not([hidden])");
  await page.click("#descargar");
  await page.waitForSelector("#lista-info:not([hidden])");
  a.equal(await page.textContent("#lista-info"), "Lista del 29/10 20:35 · 3 entradas");
  a.equal((await ls("ticketera-portero-lista")).entradas.length, 3, "no guardó la lista");

  sinRedPt = true;
  const v = await resultado("f0f0f0f0");
  a.equal(v.estado, "valida");
  a.ok(/sin conexión/i.test(v.texto), "válida local sin la etiqueta 'sin conexión'");
  a.deepEqual(await ls("ticketera-portero-cola"), [B], "no quedó en cola");
  a.ok((await page.textContent("#contador")).startsWith("2 ingresaron de 3"), "contador sin red no sale de la lista local");
  await page.waitForTimeout(3100); // pasa el anti-rebote del mismo código
  a.equal((await resultado("f0f0f0f0")).estado, "ya_usada", "el mismo código sin red no sale ya usada");
  a.equal((await resultado("99999999")).estado, "invalida", "código fuera de la lista no sale inválido");
  a.equal((await resultado("a1a1a1a1")).estado, "valida");
  a.deepEqual(checkins(), [], "con la red cortada llegó algo al servidor");

  sinRedPt = false;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("ticketera-portero-cola")).length === 0);
  a.deepEqual(checkins(), [B, A], "el servidor no recibió los tokens encolados");
  await page.waitForSelector("#aviso:not([hidden])");
  a.ok((await page.textContent("#aviso")).includes("orden #14"), "sin aviso de la válida local que ya había entrado");
  await foto(page, "17-portero-aviso");

  // La última válida sin red (A) ya subió: Deshacer va al servidor y borra la marca local.
  a.equal(await page.isVisible("#deshacer"), true, "sin 'Deshacer' para la válida que subió");
  await page.click("#deshacer");
  await page.waitForFunction(() => document.getElementById("deshacer").hidden);
  a.deepEqual(ll.filter((b) => b.accion === "deshacer").map((b) => b.token), [A], "deshacer de una válida ya subida no llamó al servidor");
  a.equal((await ls("ticketera-portero-marcas"))[A], undefined, "deshacer dejó la marca local");
  a.equal(await page.textContent("#aviso"), "Ingreso deshecho.");

  // Si al subir el servidor ya la tenía de otro teléfono, Deshacer desaparece (borraría ese ingreso).
  sinRedPt = true;
  await page.evaluate(() => { const m = JSON.parse(localStorage.getItem("ticketera-portero-marcas")); delete m["f0f0f0f0-0000-4000-8000-000000000009"]; localStorage.setItem("ticketera-portero-marcas", JSON.stringify(m)); });
  a.equal((await resultado("f0f0f0f0")).estado, "valida");
  sinRedPt = false;
  await page.evaluate(() => dispatchEvent(new Event("online")));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("ticketera-portero-cola")).length === 0);
  a.equal(await page.isHidden("#deshacer"), true, "'Deshacer' visible para una válida que el servidor ya tenía");

  await page.click("#ver-lista");
  a.deepEqual(await page.$$eval("#filas tr td:first-child", (tds) => tds.map((t) => t.textContent)), ["a1a1a1a1", "a2a2a2a2", "f0f0f0f0"], "lista no ordenada por código");
  a.ok((await page.textContent("#filas")).includes("#12") && (await page.textContent("#filas")).includes("2 de 2"));
  await foto(page, "18-portero-lista");
  await page.emulateMedia({ media: "print" });
  a.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(255, 255, 255)", "impresión sin fondo blanco");
  a.equal(await page.isHidden("#imprimir"), true, "botones en la impresión");
  await foto(page, "19-portero-impresion");
  await page.emulateMedia({ media: "screen" });

  // Una clave mala borra la clave guardada, no la lista ni la cola.
  await page.click("#volver");
  await page.evaluate((t) => localStorage.setItem("ticketera-portero-cola", JSON.stringify([t])), A);
  claveMala = true;
  await page.click("#descargar");
  await page.waitForSelector("#login:not([hidden])");
  a.equal(await ls("ticketera-portero-clave"), null, "la clave mala quedó guardada");
  a.ok((await ls("ticketera-portero-lista")) && (await ls("ticketera-portero-cola")).length === 1, "la clave mala borró la lista o la cola");
  await ctx.close();
});

await browser.close();
server.kill();
console.log(fallos ? `\n${fallos} caso(s) fallaron` : `\nOK ux.mjs · capturas en ${OUT}`);
process.exit(fallos ? 1 : 0);
