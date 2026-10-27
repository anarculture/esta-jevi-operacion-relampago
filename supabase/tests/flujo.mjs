// Flujo P0 contra el Supabase local, por HTTP como lo hace el navegador:
//   node supabase/tests/flujo.mjs <imagen.png>
// Requiere `supabase start`, `supabase functions serve --env-file supabase/functions/.env`
// y al menos pago_movil_bnc activo en config.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const CLAVE = readFileSync(new URL("../functions/.env", import.meta.url), "utf8").match(/ADMIN_CLAVE=(.*)/)[1];

async function pedir(path, body, type = "application/json") {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": type },
    body: type === "application/json" ? JSON.stringify(body) : body,
  });
  return { status: r.status, d: await r.json().catch(() => null) };
}

const venta = (await pedir("/functions/v1/tasa", {})).d;
assert.ok(venta.tasa_eur > 0, "tasa BCV del euro cargada");
assert.ok(venta.metodos.pago_movil_bnc, "pago_movil_bnc activo");
console.log("tasa_eur", venta.tasa_eur, venta.tasa_eur_fecha);

const path = `${crypto.randomUUID()}.png`;
const up = await pedir(`/storage/v1/object/capturas/${path}`, readFileSync(process.argv[2]), "image/png");
assert.equal(up.status, 200, `subida de captura: ${JSON.stringify(up.d)}`);
const lista = await pedir("/storage/v1/object/list/capturas", { prefix: "" });
assert.ok(!Array.isArray(lista.d) || lista.d.length === 0, "anon no puede listar capturas");

// REF=71239946 con recibo-sintetico.png prueba un dictamen `coincide` de punta a punta.
const ref = process.env.REF ?? String(Date.now()).slice(-8);
const args = { p_nombre: "Ana Pérez", p_cedula: "12345678", p_telefono: "04141234567", p_cantidad: 2,
  p_metodo: "pago_movil_bnc", p_referencia: ref, p_captura: path };
const o = (await pedir("/rest/v1/rpc/crear_orden", args)).d;
assert.ok(o.token, `orden creada: ${JSON.stringify(o)}`);
const dup = await pedir("/rest/v1/rpc/crear_orden", { ...args, p_referencia: "00" + ref });
assert.equal(dup.d?.message, "referencia_usada", "referencia repetida rechazada");

const rev = await pedir("/functions/v1/revisar", { token: o.token });
assert.ok(["coincide", "dudoso", "no_coincide"].includes(rev.d?.dictamen), `dictamen: ${JSON.stringify(rev.d)}`);
console.log("dictamen", rev.d);
assert.equal((await pedir("/functions/v1/revisar", { token: o.token })).status, 404, "revisar corre una sola vez");

assert.equal((await pedir("/functions/v1/admin", { clave: "mala", accion: "cola" })).status, 401, "clave mala rechazada");
const cola = (await pedir("/functions/v1/admin", { clave: CLAVE, accion: "cola" })).d;
const mia = cola.find((x) => x.token === o.token);
assert.ok(mia?.captura_url, "la cola trae la captura firmada");
// En local la Edge Function firma con su host interno (kong:8000).
assert.equal((await fetch(mia.captura_url.replace("http://kong:8000", API))).status, 200, "la URL firmada abre");

const res = await pedir("/functions/v1/admin", { clave: CLAVE, accion: "resolver", id: mia.id, aprobar: true });
assert.equal(res.d?.estado, "aprobada", `resolver: ${JSON.stringify(res.d)}`);
const vista = (await pedir("/rest/v1/rpc/ver_orden", { p_token: o.token })).d;
assert.equal(vista.entradas.length, 2, "2 entradas con QR tras aprobar");
console.log(`OK flujo: orden #${o.numero} aprobada, ${vista.entradas.length} entradas`);
