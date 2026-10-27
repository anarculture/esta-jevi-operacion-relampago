// deno test supabase/functions/avisos/texto.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { textoAviso } from "./texto.ts";

const p = { token: "e-tok", orden_token: "o-tok", numero: 12, posicion: 1, total: 3 };

Deno.test("posición 1: entrada, enlace de la orden e invitación a responder", () => {
  const t = textoAviso(p).split("\n");
  assertEquals(t.length, 4);
  assert(t[0].includes("tu entrada 1 de 3 para Sindicato Baba"));
  assertEquals(t[1], "https://postropicalia.com/sindicato-baba/entrada.html?e=e-tok");
  assertEquals(t[2], "Tu orden #12 completa: https://postropicalia.com/sindicato-baba/orden.html?t=o-tok");
  assertEquals(t[3], "Haz captura del QR ahora; en la puerta sube el brillo y muéstralo. ¿Problemas? Responde a este mensaje.");
});

Deno.test("las demás posiciones no llevan el enlace de la orden", () => {
  const t = textoAviso({ ...p, posicion: 2 });
  assert(t.includes("2 de 3") && t.includes("entrada.html?e=e-tok"));
  assert(!t.includes("orden.html"), "la entrada 2 lleva el enlace de la orden");
});
