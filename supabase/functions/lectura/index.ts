// Lee la captura apenas el comprador la elige (issue #7): el formulario precarga la referencia y
// `revisar` reutiliza esta lectura al registrar la orden. Anónima: el gasto de OCR lo frena
// reservar_lectura (una lectura por captura, 10 por IP y 200 en total por hora).
import { db, json, serve } from "../_shared/db.ts";
import { leerBlob, sinDestino } from "../_shared/ocr.ts";

const PATH = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/; // misma regla que crear_orden para p_captura

serve(async ({ path }, req) => {
  if (typeof path !== "string" || !PATH.test(path)) return json({ error: "path_invalido" }, 400);
  // shortcut: el primer valor de x-forwarded-for lo puede escribir el cliente; el tope total por hora acota el gasto igual.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";

  const { data: r, error } = await db.rpc("reservar_lectura", { p_path: path, p_ip: ip });
  if (error) throw error;
  if (r.estado === "limite") return json({ error: "demasiadas_lecturas" }, 429);
  if (r.estado === "pendiente") return json({ error: "lectura_pendiente" }, 409);
  if (r.estado === "guardada") return json({ ocr: sinDestino(r.ocr), creada_en: r.creada_en });

  const { data: blob, error: ed } = await db.storage.from("capturas").download(path);
  if (ed) {
    // Captura que no existe: se libera la reserva, no gastó OCR.
    await db.from("lecturas").delete().eq("path", path).is("ocr", null);
    return json({ error: "captura_no_encontrada" }, 404);
  }
  let ocr;
  try {
    ocr = await leerBlob(blob);
  } catch (e) {
    // La reserva queda sin OCR y cuenta para el límite; `revisar` volverá a leer al registrar la orden.
    console.error("lectura", e);
    return json({ error: "lectura_fallida" }, 502);
  }
  const { error: eu } = await db.from("lecturas").update({ ocr }).eq("path", path);
  if (eu) throw eu;
  return json({ ocr: sinDestino(ocr), creada_en: r.creada_en });
});
