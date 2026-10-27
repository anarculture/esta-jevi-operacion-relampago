// Avisos por WhatsApp (issue #5): vytas pide las entradas pendientes y reporta cada envío.
// Clave PM_CLAVE, la misma que vytas ya usa con `pm`. El texto lo arma texto.ts (una sola fuente).
import { db, json, serve } from "../_shared/db.ts";
import { type Pendiente, textoAviso } from "./texto.ts";

const CLAVE = Deno.env.get("PM_CLAVE") ?? "";

serve(async ({ clave, accion, id, ok, error, whatsapp }) => {
  if (CLAVE.length < 16 || clave !== CLAVE) return json({ error: "clave_invalida" }, 401);

  if (accion === "pendientes") {
    const { data, error: e } = await db.rpc("avisos_pendientes");
    if (e) throw e;
    return json((data as (Pendiente & { id: string; whatsapp: string })[]).map((p) => ({
      id: p.id, whatsapp: p.whatsapp, jid: `${p.whatsapp}@s.whatsapp.net`, texto: textoAviso(p),
      numero: p.numero, posicion: p.posicion, total: p.total,
    })));
  }

  if (accion === "avisada") {
    if (typeof id !== "string" || typeof ok !== "boolean") return json({ error: "datos_invalidos" }, 400);
    const { data, error: e } = await db.rpc("marcar_aviso", { p_id: id, p_ok: ok, p_error: typeof error === "string" ? error : null });
    if (e) return json({ error: e.message }, e.message === "entrada_no_existe" ? 404 : 400);
    return json(data);
  }

  // Recepcionista de vytas: órdenes de un número y el mismo texto del aviso de cada entrada suya. Solo lectura.
  if (accion === "consultar") {
    if (typeof whatsapp !== "string") return json({ error: "whatsapp_invalido" }, 400);
    const { data, error: e } = await db.rpc("consultar_whatsapp", { p_whatsapp: whatsapp });
    if (e?.message === "whatsapp_invalido") return json({ error: e.message }, 400);
    if (e) throw e;
    const { ordenes, entradas } = data as { ordenes: unknown[]; entradas: Pendiente[] };
    return json({ ordenes, textos: entradas.map(textoAviso) });
  }

  return json({ error: "accion_invalida" }, 400);
}, 4096);
