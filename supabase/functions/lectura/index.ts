// Lee la captura apenas el comprador la elige (issue #7): el formulario precarga la referencia y
// `revisar` reutiliza esta lectura al registrar la orden. Anónima: el gasto de OCR lo frena
// reservar_lectura (una lectura por captura, 10 por IP y 200 en total por hora).
import { db, json, serve } from "../_shared/db.ts";
import { leerBlob, paraComprador } from "../_shared/ocr.ts";

const PATH = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/; // misma regla que crear_orden para p_captura

serve(async ({ path }, req) => {
  if (typeof path !== "string" || !PATH.test(path)) return json({ error: "path_invalido" }, 400);
  // cf-connecting-ip lo fija Cloudflare; si no llega, el primer valor de x-forwarded-for, que el cliente puede
  // escribir (shortcut: el tope total de 200 por hora acota el gasto igual). Sin IP, una sola cuenta compartida.
  const ip = req.headers.get("cf-connecting-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "desconocida";

  const { data: r, error } = await db.rpc("reservar_lectura", { p_path: path, p_ip: ip });
  if (error) throw error;
  if (r.estado === "limite") return json({ error: "demasiadas_lecturas" }, 429);
  if (r.estado === "pendiente") return json({ error: "lectura_pendiente" }, 409);
  if (r.estado === "guardada") return json({ ocr: paraComprador(r.ocr), creada_en: r.creada_en });

  const { data: blob, error: ed } = await db.storage.from("capturas").download(path);
  // Sin captura no hay OCR; la reserva queda y cuenta (reservar_lectura la libera a los 2 minutos).
  if (ed) return json({ error: "captura_no_encontrada" }, 404);
  let ocr;
  try {
    ocr = await leerBlob(blob);
  } catch (e) {
    // La reserva queda sin OCR y cuenta para el límite; `revisar` volverá a leer al registrar la orden.
    console.error("lectura", e);
    return json({ error: "lectura_fallida" }, 502);
  }
  // Si no se guarda, el comprador recibe la lectura igual; `revisar` volverá a leer al registrar la orden.
  const { error: eu } = await db.from("lecturas").update({ ocr }).eq("path", path);
  if (eu) console.error("lectura: guardar", eu.message);
  return json({ ocr: paraComprador(ocr), creada_en: r.creada_en });
}, 1024); // el cuerpo es { path }
