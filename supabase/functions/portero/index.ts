// Puerta de la fiesta: check-in por QR (token) o por código de respaldo (8 primeros
// caracteres del token). Clave propia en PORTERO_CLAVE, distinta de ADMIN_CLAVE: el portero
// no ve datos de compradores ni aprueba órdenes.
import { db, json, serve } from "../_shared/db.ts";

const CLAVE = Deno.env.get("PORTERO_CLAVE") ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

serve(async ({ clave, accion, token, codigo }) => {
  if (CLAVE.length < 16 || clave !== CLAVE) return json({ error: "clave_invalida" }, 401);

  if (accion === "checkin") {
    let t = typeof token === "string" && UUID.test(token.trim()) ? token.trim() : null;
    if (!t && typeof codigo === "string") {
      const { data, error } = await db.rpc("token_por_codigo", { p_codigo: codigo });
      if (error?.message === "codigo_ambiguo") return json({ resultado: "invalida", motivo: "codigo_ambiguo" });
      if (error) throw new Error(error.message);
      t = data;
    }
    if (!t) return json({ resultado: "invalida", motivo: "no_existe" });
    return json(await rpc("checkin_entrada", { p_token: t }));
  }

  if (accion === "deshacer") {
    if (typeof token !== "string" || !UUID.test(token)) return json({ ok: false });
    return json(await rpc("deshacer_checkin", { p_token: token }));
  }

  if (accion === "lista") return json(await rpc("lista_portero"));
  if (accion === "resumen") return json(await rpc("resumen_portero"));

  return json({ error: "accion_invalida" }, 400);
});
