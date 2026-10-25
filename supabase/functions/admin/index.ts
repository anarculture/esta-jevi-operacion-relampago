// Panel de Mau: cola de órdenes y aprobar/rechazar. Sin cuentas: una clave
// larga en el secreto ADMIN_CLAVE que el panel guarda en el navegador de Mau.
import { db, json, serve } from "../_shared/db.ts";

const CLAVE = Deno.env.get("ADMIN_CLAVE") ?? "";

serve(async ({ clave, accion, id, aprobar }) => {
  if (CLAVE.length < 16 || clave !== CLAVE) return json({ error: "clave_invalida" }, 401);

  if (accion === "cola") {
    const { data, error } = await db.from("ordenes")
      .select("id, numero, token, creada_en, nombre, cedula, telefono, cantidad, metodo, referencia, captura, monto_usd_cents, tasa, monto_bs, estado, dictamen, dictamen_motivo, resuelta_en")
      .order("creada_en", { ascending: false }).limit(300);
    if (error) throw error;
    const { data: urls } = await db.storage.from("capturas").createSignedUrls(data.map((o) => o.captura), 3600);
    return json(data.map((o, i) => ({ ...o, captura_url: urls?.[i]?.signedUrl ?? null })));
  }

  if (accion === "resolver") {
    const { data, error } = await db.rpc("resolver_orden", { p_id: id, p_aprobar: aprobar === true });
    if (error) return json({ error: error.message }, 409);
    return json(data);
  }

  return json({ error: "accion_invalida" }, 400);
});
