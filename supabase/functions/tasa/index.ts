// Refresca la tasa BCV (como mucho una vez por hora) y devuelve los datos de venta.
// No se usa bcv.org.ve: publica con fecha valor futura y su certificado TLS no valida.
import { db, json, serve } from "../_shared/db.ts";

serve(async () => {
  const { data: c } = await db.from("config").select("tasa_consultada_en").single();
  if (!c?.tasa_consultada_en || Date.now() - Date.parse(c.tasa_consultada_en) > 3600e3) {
    // shortcut: sin fuente de respaldo; si dolarapi cae, queda la última tasa y a las 12 h pago móvil se bloquea.
    const r = await fetch("https://ve.dolarapi.com/v1/dolares/oficial");
    const t = r.ok ? await r.json() : null;
    if (t?.promedio > 0) {
      await db.from("config").update({
        tasa: t.promedio,
        tasa_fecha: String(t.fechaActualizacion).slice(0, 10),
        tasa_consultada_en: new Date().toISOString(),
      }).eq("id", 1);
    } else console.error("dolarapi", r.status);
  }
  const { data, error } = await db.rpc("datos_venta");
  if (error) throw error;
  return json(data);
});
