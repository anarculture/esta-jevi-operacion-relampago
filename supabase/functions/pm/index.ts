// Plataforma del organizador compartida (spec #2): el navegador de Mau, Claude Code y vytas
// leen y guardan el mismo estado. Clave propia PM_CLAVE, distinta de ADMIN_CLAVE: da cuentas,
// no aprueba órdenes. Cada guardado es una versión nueva; no hay borrado.
import { db, json, serve } from "../_shared/db.ts";
// Copia byte a byte de /app.js (el gate `cmp` la mantiene idéntica): mismo validador que importar respaldo.
import "../_shared/app.js";

// deno-lint-ignore no-explicit-any
const M = (globalThis as any).SindicatoBaba;
const CLAVE = Deno.env.get("PM_CLAVE") ?? "";
const AUTORES = ["navegador", "claude", "vytas"];
const VACIO = { version: 0, guardado_en: null, autor: null, estado: null };

// Objeto plano a propósito: `leer` le adjunta el bloque `ticketera`; los clientes ignoran lo que no conocen.
async function leer(version?: number) {
  let q = db.from("pm_versiones").select("version, guardado_en, autor, estado");
  q = version === undefined ? q.order("version", { ascending: false }).limit(1) : q.eq("version", version);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

// Totales de la ticketera al momento (spec #3); nunca se guardan. Si fallan, `leer` responde igual con null.
async function ticketera() {
  try {
    const { data, error } = await db.rpc("resumen_ticketera");
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("resumen_ticketera", e);
    return null;
  }
}

serve(async ({ clave, accion, version, base, autor, estado }) => {
  if (CLAVE.length < 16 || clave !== CLAVE) return json({ error: "clave_invalida" }, 401);

  if (accion === "leer") {
    // ponytail: versión y totales van en serie (dos viajes a la base por `leer`); si la latencia molesta, Promise.all.
    if (version === undefined) return json({ ...((await leer()) ?? VACIO), ticketera: await ticketera() });
    if (!Number.isInteger(version) || (version as number) < 1) return json({ error: "version_invalida" }, 400);
    const v = await leer(version as number);
    return v ? json({ ...v, ticketera: await ticketera() }) : json({ error: "version_no_existe" }, 404);
  }

  if (accion === "versiones") {
    // ponytail: lista solo las 100 últimas; una más vieja se lee igual con `leer` + `version`.
    const { data, error } = await db.from("pm_versiones").select("version, guardado_en, autor")
      .order("version", { ascending: false }).limit(100);
    if (error) throw error;
    return json({ versiones: data });
  }

  if (accion === "guardar") {
    if (!AUTORES.includes(autor as string)) return json({ error: "autor_invalido" }, 400);
    if (!Number.isInteger(base) || (base as number) < 0) return json({ error: "base_invalida" }, 400);
    const r = M.validateState(estado);
    if (!r.ok) return json({ error: "estado_invalido", errores: r.errors }, 400);
    const vigente = (await leer()) ?? VACIO;
    if (vigente.version !== base) return json({ error: "base_vieja", ...vigente }, 409);
    // Se guarda el estado normalizado del validador, no el que llegó.
    const { data, error } = await db.from("pm_versiones")
      .insert({ version: (base as number) + 1, autor, estado: r.state }).select("version, guardado_en").single();
    // 23505: otro guardado con la misma base insertó primero; gana ese.
    if (error?.code === "23505") return json({ error: "base_vieja", ...((await leer()) ?? VACIO) }, 409);
    if (error) throw error;
    return json(data);
  }

  return json({ error: "accion_invalida" }, 400);
}, M.LIMITS.importBytes);
