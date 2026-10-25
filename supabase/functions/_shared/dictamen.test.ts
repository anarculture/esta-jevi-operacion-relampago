// deno test supabase/functions/_shared/dictamen.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { dictaminar, type Ocr } from "./dictamen.ts";

const orden = { metodo: "pago_movil_bnc", referencia: "12283", monto_usd_cents: 2000, monto_bs: 17724.54, creada_en: "2026-10-25T14:00:00Z" };
const destino = { activo: true, telefono: "0414-1234567", cedula: "V-12.345.678" };
const ok: Ocr = {
  documentType: "pago_movil", amount: "17724.54", reference: "000012283", transactionDate: "2026-10-25",
  recipientName: "", recipientPhone: "04141234567", recipientId: "", editSignals: "", confidence: "high",
};

Deno.test("todo cuadra: coincide", () => {
  assertEquals(dictaminar(orden, ok, destino).dictamen, "coincide");
});

Deno.test("monto menor: no_coincide", () => {
  assertEquals(dictaminar(orden, { ...ok, amount: "8862.27" }, destino).dictamen, "no_coincide");
});

Deno.test("otra cuenta de destino: no_coincide", () => {
  assertEquals(dictaminar(orden, { ...ok, recipientPhone: "04249998877" }, destino).dictamen, "no_coincide");
});

Deno.test("referencia distinta: no_coincide", () => {
  assertEquals(dictaminar(orden, { ...ok, reference: "55555" }, destino).dictamen, "no_coincide");
});

Deno.test("señal de edición: dudoso", () => {
  assertEquals(dictaminar(orden, { ...ok, editSignals: "fuente distinta en el monto" }, destino).dictamen, "dudoso");
});

Deno.test("no es comprobante: no_coincide", () => {
  assertEquals(dictaminar(orden, { ...ok, documentType: "other" }, destino).dictamen, "no_coincide");
});

Deno.test("zelle por correo en USD: coincide", () => {
  const z = { ...orden, metodo: "zelle", monto_bs: null };
  const x = { ...ok, documentType: "zelle" as const, amount: "20.00", recipientPhone: "", recipientId: "Mau@Mail.com" };
  assertEquals(dictaminar(z, x, { correo: "mau@mail.com" }).dictamen, "coincide");
});
