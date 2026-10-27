import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HOME + "/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core");
const hoy = "27/10/2026";
const bs = (1 * 10 * 993.0884).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fila = (k, v) => `<tr><td style="color:#666">${k}</td><td style="text-align:right">${v}</td></tr>`;
const base = (cabecera, color, titulo, monto, filas) => `<!doctype html><meta charset="utf-8"><body style="font-family:Roboto,sans-serif;background:#f2f2f2;margin:0;width:390px">
<div style="background:${color};color:#fff;padding:18px;font-size:20px">${cabecera}</div>
<div style="padding:24px;text-align:center"><div style="font-size:22px;color:#1a7f37;font-weight:bold">${titulo}</div>
<div style="font-size:34px;font-weight:bold;margin:12px 0">${monto}</div></div>
<table style="width:100%;font-size:17px;padding:0 20px;border-spacing:0 10px">${filas.map(([k, v]) => fila(k, v)).join("")}</table></body>`;
const recibos = {
  "pago-movil-bnc": { ref: "00061540227", html: base("BNC · Banco Nacional de Crédito", "#003b71", "Pago Móvil exitoso", `Bs. ${bs}`, [
    ["Referencia", "000061540227"], ["Fecha", `${hoy} 07:12 pm`], ["Desde", "0412-9988776"], ["Banco destino", "0191 BNC"],
    ["Teléfono destino", "0414-5287337"], ["C.I. destino", "V-21.616.092"], ["Concepto", "Entradas"]]) },
  "zelle": { ref: "ZT8K2M4Q", html: base("Chase · Zelle®", "#0b5fd1", "Payment sent", "$10.00", [
    ["Confirmation number", "ZT8K2M4Q"], ["Date", "Oct 27, 2026 7:14 PM"], ["To", "Mauricio Davila"],
    ["Recipient", "mauricioadb@gmail.com"], ["Memo", "Entradas"]]) },
  "binance": { ref: "P2X9Q7L4M6", html: base("Binance Pay", "#0b0e11", "Payment successful", "10 USDT", [
    ["Order ID", "P2X9Q7L4M6"], ["Time", "2026-10-27 19:16"], ["Receiver", "anarculture"],
    ["Pay ID", "1049969286"], ["Note", "Entradas"]]) },
};
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 3 });
for (const [n, r] of Object.entries(recibos)) {
  const p = await ctx.newPage(); await p.setContent(r.html); await p.screenshot({ path: `${n}.png`, fullPage: true }); await p.close();
  console.log(`${n}.png  referencia a teclear: ${r.ref}`);
}
await browser.close();
