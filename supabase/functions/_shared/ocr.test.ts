// deno test supabase/functions/_shared/ocr.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { paraComprador, SCHEMA } from "./ocr.ts";
import type { Ocr } from "./dictamen.ts";

Deno.test("el esquema pide la hora y los datos del emisor", () => {
  for (const f of ["transactionTime", "senderName", "senderPhone", "senderId", "senderBank", "reference", "amount"]) {
    assertEquals(SCHEMA.required.includes(f), true, f);
  }
});

Deno.test("lectura: la respuesta no trae la cuenta de destino ni las señales del dictamen", () => {
  const ocr: Ocr = {
    documentType: "pago_movil", amount: "9930.88", reference: "61540227", transactionDate: "2026-10-27", transactionTime: "21:03",
    recipientName: "Mauricio", recipientPhone: "04145287337", recipientId: "V21616092", editSignals: "", confidence: "high",
    senderName: "Ana", senderPhone: "04147654321", senderId: "V9876543", senderBank: "Mercantil",
  };
  const r = paraComprador({ ...ocr, editSignals: "fuente distinta en el monto", confidence: "low" }) as Record<string, unknown>;
  for (const k of ["recipientPhone", "recipientId", "recipientName", "editSignals", "confidence", "senderPhone", "senderId"]) assertEquals(k in r, false, k);
  assertEquals(JSON.stringify(r).includes("04145287337") || JSON.stringify(r).includes("21616092"), false);
  assertEquals([r.reference, r.amount, r.transactionTime], ["61540227", "9930.88", "21:03"]);
});
