// Refresca las tasas BCV (como mucho una vez por hora) y devuelve los datos de venta.
// No se usa bcv.org.ve: publica con fecha valor futura y su certificado TLS no valida.
import { db, json, serve } from "../_shared/db.ts";

// dolarapi responde 403 a user agents de bots.
const UA = { "User-Agent": "Mozilla/5.0 (ticketera Sindicato Baba)" };

async function oficial(url: string) {
  // Red caída o cuerpo que no es JSON: se queda la última tasa guardada y la venta sigue.
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { console.error("dolarapi", url, r.status); return null; }
    const d = await r.json();
    const t = Array.isArray(d) ? d.find((x) => x.fuente === "oficial") : d;
    return t?.promedio > 0 ? { tasa: t.promedio, fecha: String(t.fechaActualizacion).slice(0, 10) } : null;
  } catch (e) { console.error("dolarapi", url, e instanceof Error ? e.message : e); return null; }
}

serve(async () => {
  const { data: c } = await db.from("config").select("tasa_consultada_en").single();
  if (!c?.tasa_consultada_en || Date.now() - Date.parse(c.tasa_consultada_en) > 3600e3) {
    // shortcut: sin fuente de respaldo; si dolarapi cae, queda la última tasa y a las 12 h pago móvil se bloquea.
    const [usd, eur] = await Promise.all([
      oficial("https://ve.dolarapi.com/v1/dolares/oficial"),
      oficial("https://ve.dolarapi.com/v1/euros"),
    ]);
    if (eur) {
      await db.from("config").update({
        tasa: usd?.tasa, tasa_fecha: usd?.fecha,
        tasa_eur: eur.tasa, tasa_eur_fecha: eur.fecha,
        tasa_consultada_en: new Date().toISOString(),
      }).eq("id", 1);
    }
  }
  const { data, error } = await db.rpc("datos_venta");
  if (error) throw error;
  return json(data);
});
