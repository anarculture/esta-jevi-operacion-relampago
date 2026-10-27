// OCR de comprobantes con un modelo de visión: lo usan `lectura` (al elegir la captura) y `revisar`.
// Prompt adaptado de ruedda-platform/backend/services/pago-movil-receipt-ocr.ts.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type { Ocr } from "./dictamen.ts";

// Elección y respaldo (nvidia/nemotron-3.5-super-vl): docs/research/modelo-ocr-open-source.md
// Se lee al llamar y no al importar: así los tests corren sin --allow-env.
const modelo = () => Deno.env.get("OCR_MODEL") ?? "qwen/qwen3.6-27b";

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
   transactionTime: the local time printed for the transaction, 24-hour HH:MM ("10:41 pm" → "22:41"). "" if not printed.
4. recipientName: the beneficiary / destination name as printed.
5. recipientPhone: the beneficiary / destination phone (near "Para", "Destino", "Beneficiario", "Teléfono destino"). Not the sender's.
6. recipientId: the beneficiary's cédula/RIF, Binance ID / Pay ID, or Zelle email — whichever identifies the destination.
7. senderName, senderPhone, senderId, senderBank: the payer / origin of the transfer (near "Desde", "Origen", "Ordenante", "De", "From", "Sent by"): name, phone, cédula/RIF or Binance ID / nickname or Zelle email, and the bank of origin. Not the beneficiary's. "" if not printed.
8. editSignals: visible signs the image was edited (mismatched fonts or alignment in amount/reference/date, pixelation around a single field, inconsistent totals). "" if none. Do not speculate beyond what is visible.
9. confidence: "high" sharp and unambiguous; "medium" minor inference; "low" blurry, cropped or unreadable fields.
10. For any field you cannot read, return "". Never hallucinate.`;

const FIELDS = ["documentType", "amount", "reference", "transactionDate", "transactionTime", "recipientName", "recipientPhone", "recipientId",
  "senderName", "senderPhone", "senderId", "senderBank", "editSignals", "confidence"];
export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: FIELDS,
  properties: {
    ...Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
    documentType: { type: "string", enum: ["pago_movil", "binance", "zelle", "other"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
};

export async function leer(imageUrl: string): Promise<Ocr> {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(90_000), // por debajo de los 2 minutos en que reservar_lectura libera una reserva
    headers: { Authorization: `Bearer ${Deno.env.get("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelo(),
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
  const ocr = JSON.parse(content.replace(/^```(json)?|```$/g, ""));
  // Un proveedor que no respeta el esquema no deja una lectura rota guardada: falla como cualquier error del OCR.
  if (!ocr || typeof ocr !== "object" || FIELDS.some((f) => typeof ocr[f] !== "string")
    || !SCHEMA.properties.documentType.enum.includes(ocr.documentType) || !SCHEMA.properties.confidence.enum.includes(ocr.confidence)) {
    throw new Error(`ocr: respuesta fuera del esquema: ${content.slice(0, 200)}`);
  }
  return ocr;
}

// La captura tal como está en el bucket. Inline en base64 y no URL firmada: así también funciona contra el Supabase local.
export async function leerBlob(blob: Blob): Promise<Ocr> {
  return leer(`data:${blob.type};base64,${encodeBase64(await blob.arrayBuffer())}`);
}

// Lo que ve el comprador: solo lo que pinta el formulario. Nada de la cuenta de destino (es de Mau), ni
// `editSignals` o `confidence`: con ellos un falsificador probaría capturas hasta que salgan limpias.
export function paraComprador(ocr: Ocr) {
  const { documentType, amount, reference, transactionDate, transactionTime, senderName } = ocr;
  return { documentType, amount, reference, transactionDate, transactionTime: transactionTime ?? "", senderName };
}
