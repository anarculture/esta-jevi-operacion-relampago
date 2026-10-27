// Lee la captura de una orden con un modelo de visión y deja el dictamen.
// Corre una sola vez por orden (dictamen null), así un token filtrado no gasta IA en bucle.
import { db, json, serve } from "../_shared/db.ts";
import { type Dictamen, dictaminar, normRef, type Ocr } from "../_shared/dictamen.ts";
import { leerBlob } from "../_shared/ocr.ts";

// La terminación leída por OCR ya está en otra orden del mismo tipo (tipeada o leída): es la misma
// captura reportada dos veces, aunque el comprador haya tipeado otra cosa. unique (tipo, sufijo) cubre
// lo tipeado; esto cubre lo leído. Si la consulta falla, la orden espera a Mau como dudosa.
async function sufijoEnOtraOrden(o: { id: string; tipo: string }, sufijo: string): Promise<Dictamen | null> {
  const { data, error } = await db.from("ordenes").select("numero").eq("tipo", o.tipo).neq("id", o.id)
    .or(`sufijo.eq.${sufijo},ocr_sufijo.eq.${sufijo}`).limit(1).maybeSingle(); // sufijo: solo [A-Z0-9], sin comas
  if (error) { console.error("ocr_sufijo", error.message); return { dictamen: "dudoso", motivo: "no se pudo cotejar la referencia leída con las otras órdenes; revisar a mano" }; }
  return data ? { dictamen: "no_coincide", motivo: `la referencia leída (…${sufijo}) ya está en la orden #${data.numero}` } : null;
}

serve(async ({ token }) => {
  const { data: o } = await db.from("ordenes").select("*").eq("token", token).is("dictamen", null).maybeSingle();
  if (!o) return json({ error: "orden_no_encontrada" }, 404);

  // La lectura que hizo `lectura` al elegir la captura, si la hay (issue #7): no se paga el OCR dos veces.
  const { data: l, error: el } = await db.from("lecturas").select("ocr").eq("path", o.captura).not("ocr", "is", null).maybeSingle();
  if (el) console.error("lecturas", el.message); // sin la lectura guardada se lee de nuevo
  let blob: Blob | null = null;
  if (!l) {
    const { data, error } = await db.storage.from("capturas").download(o.captura);
    if (error) throw error;
    blob = data;
  }
  const { data: c } = await db.from("config").select("metodos, auto_aprobar").single();

  let ocr: Ocr | null = null;
  let ocr_sufijo: string | null = null;
  let d: Dictamen;
  try {
    ocr = l ? l.ocr as Ocr : await leerBlob(blob!);
    ocr_sufijo = normRef(ocr.reference).slice(-6) || null;
    d = (ocr_sufijo && await sufijoEnOtraOrden(o, ocr_sufijo)) || dictaminar(o, ocr, c!.metodos[o.metodo] ?? {});
  } catch (e) {
    console.error(e);
    d = { dictamen: "dudoso", motivo: "la IA no pudo leer la captura; revisar a mano" };
  }
  // Sin dictamen guardado no se aprueba: la orden queda en revisión y `revisar` puede volver a correr.
  const { error: eu } = await db.from("ordenes").update({ ocr, ocr_sufijo, dictamen: d.dictamen, dictamen_motivo: d.motivo }).eq("id", o.id);
  if (eu) throw eu;
  // Solo `coincide` aprueba sin Mau; `dudoso` y `no_coincide` esperan en el panel. Interruptor: config.auto_aprobar.
  if (d.dictamen === "coincide" && c!.auto_aprobar) {
    const { error: e } = await db.rpc("resolver_orden", { p_id: o.id, p_aprobar: true, p_aprobada_por: "ia" });
    // orden_ya_resuelta: Mau aprobó o rechazó antes. Cualquier otro fallo deja la orden en revisión.
    if (e && e.message !== "orden_ya_resuelta") console.error("auto_aprobar", o.numero, e.message);
  }
  return json(d);
});
