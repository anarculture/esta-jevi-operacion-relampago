// deno test supabase/functions/_shared/dictamen.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { dictaminar, type Ocr } from "./dictamen.ts";

const orden = {
  metodo: "pago_movil_bnc", referencia: "712283", monto_usd_cents: 2000, monto_bs: 17724.54, creada_en: "2026-10-25T14:00:00Z",
  pagador: { banco: "Mercantil", telefono: "584147654321", cedula: "V9876543" },
};
const destino = { activo: true, telefono: "0414-1234567", cedula: "V-12.345.678" };
const ok: Ocr = {
  documentType: "pago_movil", amount: "17724.54", reference: "000712283", transactionDate: "2026-10-25",
  recipientName: "", recipientPhone: "04141234567", recipientId: "", editSignals: "", confidence: "high",
  senderName: "", senderPhone: "", senderId: "", senderBank: "",
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

Deno.test("hasta Bs 1 de menos: coincide; más de Bs 1 de menos: no_coincide", () => {
  assertEquals(dictaminar(orden, { ...ok, amount: "17723.60" }, destino).dictamen, "coincide");
  assertEquals(dictaminar(orden, { ...ok, amount: "17722.00" }, destino).dictamen, "no_coincide");
});

Deno.test("zelle por 2 centavos menos: no_coincide", () => {
  const z = { ...orden, metodo: "zelle", monto_bs: null };
  const x = { ...ok, documentType: "zelle" as const, amount: "19.98", recipientPhone: "", recipientId: "mau@mail.com" };
  assertEquals(dictaminar(z, x, { correo: "mau@mail.com" }).dictamen, "no_coincide");
});

Deno.test("captura anterior a la orden: dudoso; un día después: coincide; dos días después: dudoso", () => {
  assertEquals(dictaminar(orden, { ...ok, transactionDate: "2026-10-24" }, destino).dictamen, "dudoso");
  assertEquals(dictaminar(orden, { ...ok, transactionDate: "2026-10-26" }, destino).dictamen, "coincide");
  assertEquals(dictaminar(orden, { ...ok, transactionDate: "2026-10-27" }, destino).dictamen, "dudoso");
});

Deno.test("pagador leído igual al declarado: coincide; distinto: dudoso con 'el pagador leído'", () => {
  assertEquals(dictaminar(orden, { ...ok, senderPhone: "0414-765.43.21", senderId: "V-9.876.543" }, destino).dictamen, "coincide");
  const d = dictaminar(orden, { ...ok, senderPhone: "04241112233", senderId: "V-1.111.111" }, destino);
  assertEquals(d.dictamen, "dudoso");
  assertEquals(d.motivo.includes("el pagador leído"), true);
  const z = { ...orden, metodo: "zelle", monto_bs: null, pagador: { titular: "Beto Díaz" } };
  const x = { ...ok, documentType: "zelle" as const, amount: "20.00", recipientPhone: "", recipientId: "mau@mail.com" };
  assertEquals(dictaminar(z, { ...x, senderName: "BETO DIAZ" }, { correo: "mau@mail.com" }).dictamen, "coincide");
  assertEquals(dictaminar(z, { ...x, senderName: "Carla Gómez" }, { correo: "mau@mail.com" }).motivo.includes("el pagador leído"), true);
});

Deno.test("sin lectura del emisor (o enmascarada): sin duda del pagador", () => {
  const d = dictaminar(orden, ok, destino);
  assertEquals(d.dictamen, "coincide");
  assertEquals(dictaminar(orden, { ...ok, senderPhone: "0424***2233" }, destino).dictamen, "coincide");
  assertEquals(dictaminar({ ...orden, pagador: null }, { ...ok, senderPhone: "04241112233" }, destino).dictamen, "coincide");
});
