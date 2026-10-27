// Lee la captura de una orden con un modelo de visión y deja el dictamen.
// Prompt adaptado de ruedda-platform/backend/services/pago-movil-receipt-ocr.ts.
// Corre una sola vez por orden (dictamen null), así un token filtrado no gasta IA en bucle.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { db, json, serve } from "../_shared/db.ts";
import { type Dictamen, dictaminar, normRef, type Ocr } from "../_shared/dictamen.ts";

// Elección y respaldo (nvidia/nemotron-3.5-super-vl): docs/research/modelo-ocr-open-source.md
const MODEL = Deno.env.get("OCR_MODEL") ?? "qwen/qwen3.6-27b";

const SYSTEM_PROMPT =
  `You are a precise OCR system specialized in payment receipts used in Venezuela: Pago Móvil bank receipts, Binance Pay and Zelle confirmations. Extract the printed fields exactly as they appear. Do not invent values. Return only the JSON object that matches the provided schema.`;

const USER_PROMPT = `This image should be a payment receipt screenshot. Classify it first:
- "pago_movil": a Venezuelan bank app receipt for a Pago Móvil P2P transfer ("Pago Móvil exitoso", "Comprobante de transferencia", "Operación exitosa"; banks like BNC, Mercantil, Banesco, Provincial, Venezuela, BFC). Amount in bolívares.
- "binance": a Binance Pay / Binance transfer confirmation. Amount in USDT or USD.
- "zelle": a Zelle payment confirmation from a US bank app. Amount in USD.
- "other": anything else (a conversation, a balance summary, a web page). Then leave every other field as "".

Extraction rules:
1. amount: transfer amount without currency symbol or thousands separators, dot as decimal separator. "Bs. 1.185,82" → "1185.82"; "$20.00" → "20.00"; "20 USDT" → "20".
2. reference: the operation reference / nro. de operación / order ID / confirmation number. Prefer the one labeled "Referencia" or "Nro. de operación" over "Aprobación". As printed, without spaces.
3. transactionDate: ISO YYYY-MM-DD. "" if only relative ("hoy", "ayer").
4. recipientName: the beneficiary / destination name as printed.
5. recipientPhone: the beneficiary / destination phone (near "Para", "Destino", "Beneficiario", "Teléfono destino"). Not the sender's.
6. recipientId: the beneficiary's cédula/RIF, Binance ID / Pay ID, or Zelle email — whichever identifies the destination.
7. editSignals: visible signs the image was edited (mismatched fonts or alignment in amount/reference/date, pixelation around a single field, inconsistent totals). "" if none. Do not speculate beyond what is visible.
8. confidence: "high" sharp and unambiguous; "medium" minor inference; "low" blurry, cropped or unreadable fields.
9. For any field you cannot read, return "". Never hallucinate.`;

const FIELDS = ["documentType", "amount", "reference", "transactionDate", "recipientName", "recipientPhone", "recipientId", "editSignals", "confidence"];
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: FIELDS,
  properties: {
    ...Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
    documentType: { type: "string", enum: ["pago_movil", "binance", "zelle", "other"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
};

async function leer(imageUrl: string): Promise<Ocr> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      // Qwen razona por defecto y esos tokens cuentan contra max_tokens: apagado y con margen.
      reasoning: { enabled: false },
      max_tokens: 2000,
      // Solo proveedores que cumplan el json_schema y no guarden los datos (cédulas, teléfonos).
      provider: { require_parameters: true, data_collection: "deny" },
      response_format: { type: "json_schema", json_schema: { name: "receipt", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [{ type: "text", text: USER_PROMPT }, { type: "image_url", image_url: { url: imageUrl } }] },
      ],
    }),
  });
  if (!r.ok) throw new Error(`openrouter ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const content = (await r.json()).choices?.[0]?.message?.content ?? "";
  return JSON.parse(content.replace(/^```(json)?|```$/g, ""));
}

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

  // Inline en base64 y no URL firmada: así también funciona contra el Supabase local.
  const { data: blob, error } = await db.storage.from("capturas").download(o.captura);
  if (error) throw error;
  const dataUrl = `data:${blob.type};base64,${encodeBase64(await blob.arrayBuffer())}`;
  const { data: c } = await db.from("config").select("metodos, auto_aprobar").single();

  let ocr: Ocr | null = null;
  let ocr_sufijo: string | null = null;
  let d: Dictamen;
  try {
    ocr = await leer(dataUrl);
    ocr_sufijo = normRef(ocr.reference).slice(-6) || null;
    d = (ocr_sufijo && await sufijoEnOtraOrden(o, ocr_sufijo)) || dictaminar(o, ocr, c!.metodos[o.metodo] ?? {});
  } catch (e) {
    console.error(e);
    d = { dictamen: "dudoso", motivo: "la IA no pudo leer la captura; revisar a mano" };
  }
  await db.from("ordenes").update({ ocr, ocr_sufijo, dictamen: d.dictamen, dictamen_motivo: d.motivo }).eq("id", o.id);
  // Solo `coincide` aprueba sin Mau; `dudoso` y `no_coincide` esperan en el panel. Interruptor: config.auto_aprobar.
  if (d.dictamen === "coincide" && c!.auto_aprobar) {
    const { error: e } = await db.rpc("resolver_orden", { p_id: o.id, p_aprobar: true, p_aprobada_por: "ia" });
    // orden_ya_resuelta: Mau aprobó o rechazó antes. Cualquier otro fallo deja la orden en revisión.
    if (e && e.message !== "orden_ya_resuelta") console.error("auto_aprobar", o.numero, e.message);
  }
  return json(d);
});
