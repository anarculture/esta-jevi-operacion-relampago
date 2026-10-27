// deno test --allow-read supabase/functions/avisos/texto.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { CONTACTO_WA, textoAviso } from "./texto.ts";

const p = { token: "e-tok", orden_token: "o-tok", numero: 12, posicion: 1, total: 3 };

Deno.test("posición 1: entrada, enlace de la orden y contacto", () => {
  const t = textoAviso(p).split("\n");
  assertEquals(t.length, 4);
  assert(t[0].includes("tu entrada 1 de 3 para Sindicato Baba"));
  assertEquals(t[1], "https://postropicalia.com/sindicato-baba/entrada.html?e=e-tok");
  assertEquals(t[2], "Tu orden #12 completa: https://postropicalia.com/sindicato-baba/orden.html?t=o-tok");
  assert(t[3].startsWith("Haz captura del QR") && t[3].endsWith(`wa.me/${CONTACTO_WA}`));
});

Deno.test("las demás posiciones no llevan el enlace de la orden", () => {
  const t = textoAviso({ ...p, posicion: 2 });
  assert(t.includes("2 de 3") && t.includes("entrada.html?e=e-tok"));
  assert(!t.includes("orden.html"), "la entrada 2 lleva el enlace de la orden");
});

// Sin --allow-read (el gate corre `deno test supabase/functions/`) sale como "ignored", no como verde.
const lee = (await Deno.permissions.query({ name: "read" })).state === "granted";
Deno.test({ name: "mismo contacto que la ticketera (requiere --allow-read)", ignore: !lee }, async () => {
  const comun = await Deno.readTextFile(new URL("../../../ticketera/comun.js", import.meta.url));
  assertEquals(comun.match(/CONTACTO_WA = "(\d+)"/)?.[1], CONTACTO_WA);
});
