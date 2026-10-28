// Monitor de compras (issue #12): lo que `monitor-compras.sh` imprime (y por lo tanto Hermes le entrega a Mau)
// según cambian los totales de `leer` de la función `pm`. Corre el script contra el stack local:
//   node supabase/tests/monitor-compras.mjs
//   Otro stack: API=http://127.0.0.1:58321 DB_CONTAINER=supabase_db_pm-ticketera node supabase/tests/monitor-compras.mjs
// Requiere `supabase functions serve --env-file supabase/functions/.env` con PM_CLAVE y ADMIN_CLAVE.
// Supone que no hay órdenes en revisión. Las órdenes nacen con `crear_orden` y se resuelven con `admin`;
// la venta manual entra por SQL. Los asserts miran solo stdout y el archivo de estado.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const API = process.env.API ?? "http://127.0.0.1:54321";
const DB = process.env.DB_CONTAINER ?? "supabase_db_sindicato-baba-ticketera";
const KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const ENV = readFileSync(new URL("../functions/.env", import.meta.url), "utf8");
const PM = ENV.match(/PM_CLAVE=(.*)/)[1];
const ADMIN = ENV.match(/ADMIN_CLAVE=(.*)/)[1];
const SCRIPT = new URL("./monitor-compras.sh", import.meta.url).pathname;
const ESTADO = join(mkdtempSync(join(tmpdir(), "monitor-compras-")), "estado.json");

const PAGADOR = { pago_movil: { banco: "BNC", telefono: "04147654321", cedula: "9876543" }, zelle: { titular: "Prueba Pagador" }, binance: { id: "prueba_pagador" } };
const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-tA", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
async function pedir(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, d: await r.json().catch(() => null) };
}
// Corre el monitor como lo corre Hermes: el stdout es el aviso; vacío = silencio. Siempre debe salir con 0.
function monitor({ clave = PM, extra = [], url = `${API}/functions/v1/pm` } = {}) {
  return execFileSync("bash", [SCRIPT, "--url", url, "--estado", ESTADO, ...extra],
    { env: { ...process.env, PM_CLAVE: clave }, encoding: "utf8" }).trim();
}
const estado = () => JSON.parse(readFileSync(ESTADO, "utf8"));

let n = 0;
async function crear(metodo, cantidad) {
  const o = (await pedir("/rest/v1/rpc/crear_orden", { p_nombre: "Prueba Monitor", p_cedula: "12345678", p_telefono: "",
    p_cantidad: cantidad, p_metodo: metodo, p_referencia: `MONITOR${Date.now()}${n++}`,
    p_captura: `${crypto.randomUUID()}.png`, p_whatsapps: Array(cantidad).fill("04141234567"),
    p_pagador: PAGADOR[metodo.startsWith("pago_movil") ? "pago_movil" : metodo] })).d;
  assert.ok(o?.token, `crear_orden: ${JSON.stringify(o)}`);
  return o.token;
}
async function resolver(token, aprobar) {
  const id = (await pedir("/functions/v1/admin", { clave: ADMIN, accion: "cola" })).d.find((x) => x.token === token).id;
  const r = await pedir("/functions/v1/admin", { clave: ADMIN, accion: "resolver", id, aprobar });
  assert.equal(r.d?.estado, aprobar ? "aprobada" : "rechazada", `resolver: ${JSON.stringify(r.d)}`);
}

const antes = sql("select row_to_json(c) from config c");
sql(`update config set auto_aprobar = false, tasa_eur = 200, tasa_consultada_en = now(), metodos = metodos
  || jsonb_build_object('pago_movil_ubii', coalesce(metodos -> 'pago_movil_ubii', '{}') || '{"activo": true}')
  || jsonb_build_object('zelle', coalesce(metodos -> 'zelle', '{}') || '{"activo": true}')`);
try {
  assert.equal(sql("select count(*) from ordenes where estado = 'en_revision'"), "0", "hay órdenes en revisión: corre `supabase db reset` antes");

  // 1. Sin estado y sin órdenes en revisión: silencio y línea de base guardada.
  assert.equal(monitor(), "", "la primera corrida avisó sin pendientes");
  assert.equal(estado().lectura.en_revision.ordenes, 0, "no guardó la línea de base");

  // 2. Una orden en revisión: aviso con el enlace al panel. 3. Sin cambios: silencio.
  const ubii = await crear("pago_movil_ubii", 2);
  let out = monitor();
  assert.match(out, /1 orden nueva en revisión/, out);
  assert.ok(out.includes("https://postropicalia.com/sindicato-baba/admin.html"), `sin enlace al panel: ${out}`);
  assert.equal(monitor(), "", "repitió el aviso sin cambios");

  // 4. Recordatorio: con el último aviso hace más de 30 min y la orden todavía en revisión.
  writeFileSync(ESTADO, JSON.stringify({ ...estado(), avisado: Date.now() / 1000 - 31 * 60 }));
  out = monitor();
  assert.match(out, /Sigue 1 orden en revisión/, out);
  assert.equal(monitor(), "", "recordó dos veces seguidas");

  // 5. Se aprueba: aviso de aprobación con el método y el total; la cola quedó vacía.
  const total = () => JSON.parse(sql("select resumen_ticketera()")).aprobadas;
  await resolver(ubii, true);
  out = monitor();
  assert.match(out, /1 orden aprobada \(pago móvil\): \+2 entradas, \+\$20/, out);
  assert.ok(out.includes(`Total: ${total().entradas} entradas`), `sin total: ${out}`);
  assert.ok(out.split("\n").length <= 3, `más de 3 líneas: ${out}`);

  // 6. Venta manual por SQL (cortesía, Zelle): cuenta como aprobación.
  sql(`with o as (insert into ordenes (nombre, cedula, telefono, whatsapps, cantidad, metodo, referencia, captura, monto_usd_cents)
    values ('Prueba Monitor', 'V0', '0', null, 1, 'zelle', 'MONITORCORTESIA${Date.now()}', 'manual.jpg', 0) returning id)
    select resolver_orden(id, true) from o;`);
  out = monitor();
  assert.match(out, /1 orden aprobada \(Zelle\): \+1 entrada, \+\$0/, out);

  // 7. Rechazo: la cola baja sin aprobación.
  const zelle = await crear("zelle", 1);
  assert.match(monitor(), /1 orden nueva en revisión/);
  await resolver(zelle, false);
  out = monitor();
  assert.match(out, /se resolvió sin aprobarse/, out);
  assert.doesNotMatch(out, /aprobada \(/, out);

  // 8. Clave inválida: aviso de falla, sale con 0, el estado no avanza y una segunda falla seguida calla.
  const lectura = JSON.stringify(estado().lectura);
  const mala = "clave-mala-de-mas-de-16";
  await crear("zelle", 1);
  out = monitor({ clave: mala });
  assert.match(out, /no pude consultar la ticketera \(HTTP 401\)/, out);
  assert.ok(!out.includes(mala) && !out.includes(PM), "el aviso de falla lleva la clave");
  assert.equal(JSON.stringify(estado().lectura), lectura, "la falla avanzó la lectura");
  assert.equal(monitor({ clave: mala }), "", "la segunda falla seguida volvió a avisar");

  // 9. Se recupera: avisa la vuelta y lo que cambió mientras estuvo caído (la orden nueva en revisión).
  out = monitor();
  assert.match(out, /volvió a consultar/, out);
  assert.match(out, /1 orden nueva en revisión/, out);

  // 10. --dry-run imprime el aviso que toca y no guarda nada.
  const guardado = readFileSync(ESTADO, "utf8");
  await crear("zelle", 1);
  out = monitor({ extra: ["--dry-run"] });
  assert.match(out, /1 orden nueva en revisión/, out);
  assert.equal(readFileSync(ESTADO, "utf8"), guardado, "--dry-run tocó el estado");
  assert.match(monitor(), /1 orden nueva en revisión/, "el dry-run consumió el cambio");

  // 10b. Una aprobación en la misma ventana en que entra otra orden: la cola no cambia, pero el aviso dice que queda una.
  const otra = (await pedir("/functions/v1/admin", { clave: ADMIN, accion: "cola" })).d.find((x) => x.nombre === "Prueba Monitor").token;
  await resolver(otra, true);
  await crear("zelle", 1);
  out = monitor();
  assert.match(out, /aprobada \(Zelle\)/, out);
  assert.match(out, /Quedan? \d+ órdenes? en revisión/, out);

  // 10c. Un estado viejo con otra forma no rompe el monitor: vale como primera corrida.
  writeFileSync(ESTADO, JSON.stringify({ lectura: { aprobadas: 3 } }));
  assert.match(monitor(), /en revisión/, "estado con otra forma");

  // 10d. Red caída: calla las dos primeras corridas y avisa en la tercera; al volver, avisa la vuelta.
  const caida = { url: "http://127.0.0.1:9/functions/v1/pm" };
  assert.equal(monitor(caida), "", "avisó la primera falla de red");
  assert.equal(monitor(caida), "", "avisó la segunda falla de red");
  assert.match(monitor(caida), /no pude consultar la ticketera/);
  assert.match(monitor(), /volvió a consultar/);

  // 11. Ninguna salida ni el estado llevan la clave.
  assert.ok(!readFileSync(ESTADO, "utf8").includes(PM), "el estado guarda la clave");
  assert.ok(existsSync(ESTADO));

  console.log("OK monitor-compras: 11 casos");
} finally {
  sql(`update ordenes set estado = 'rechazada', resuelta_en = now() where estado = 'en_revision' and nombre = 'Prueba Monitor'`);
  sql(`update config set (metodos, tasa_eur, tasa_consultada_en, auto_aprobar) = (select metodos, tasa_eur, tasa_consultada_en, auto_aprobar
    from json_populate_record(null::config, '${antes.replace(/'/g, "''")}'))`);
}
