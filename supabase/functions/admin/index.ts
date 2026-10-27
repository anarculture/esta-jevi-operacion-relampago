// Panel de Mau: cola de órdenes y aprobar/rechazar. Sin cuentas: una clave
// larga en el secreto ADMIN_CLAVE que el panel guarda en el navegador de Mau.
import { db, json, serve } from "../_shared/db.ts";

const CLAVE = Deno.env.get("ADMIN_CLAVE") ?? "";

serve(async ({ clave, accion, id, aprobar, motivo, whatsapp }) => {
  if (CLAVE.length < 16 || clave !== CLAVE) return json({ error: "clave_invalida" }, 401);

  if (accion === "cola") {
    const { data, error } = await db.from("ordenes")
      .select("id, numero, token, creada_en, nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs, estado, dictamen, dictamen_motivo, rechazo_motivo, resuelta_en, aprobada_por, entradas(id, whatsapp, avisada_en, aviso_error, aviso_intentos)")
      .order("creada_en", { ascending: false }).order("id", { referencedTable: "entradas" }).limit(300);
    if (error) throw error;
    const { data: urls } = await db.storage.from("capturas").createSignedUrls(data.map((o) => o.captura), 3600);
    // Posición = orden por id, como ver_entrada. El panel ve solo los 4 últimos dígitos del WhatsApp.
    return json(data.map((o, i) => ({
      ...o, captura_url: urls?.[i]?.signedUrl ?? null,
      entradas: o.entradas.map(({ whatsapp: w, ...e }, k) => ({ ...e, posicion: k + 1, whatsapp_mascara: w ? w.slice(-4) : null })),
    })));
  }
  if (accion === "reenviar_aviso") {
    const { data, error } = await db.rpc("reenviar_aviso", { p_id: id, p_whatsapp: typeof whatsapp === "string" ? whatsapp : null });
    if (error) return json({ error: error.message }, 409);
    return json(data);
  }

  if (accion === "resolver") {
    const { data, error } = await db.rpc("resolver_orden", {
      p_id: id, p_aprobar: aprobar === true, p_motivo: typeof motivo === "string" ? motivo : null,
    });
    if (error) return json({ error: error.message }, 409);
    return json(data);
  }

  return json({ error: "accion_invalida" }, 400);
});
