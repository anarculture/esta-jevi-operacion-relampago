// deno test --allow-read supabase/functions/avisos/texto.test.ts
import { assert, assertEquals } from "jsr:@std/assert@1";
import { MAPA, textoAviso } from "./texto.ts";

const p = { token: "e-tok", orden_token: "o-tok", numero: 12, posicion: 1, total: 3 };

Deno.test("posición 1: entrada, enlace de la orden, mapa e invitación a responder", () => {
  const t = textoAviso(p).split("\n");
  assertEquals(t.length, 5);
  assert(t[0].includes("tu entrada 1 de 3 para Sindicato Baba"));
  assertEquals(t[1], "https://postropicalia.com/sindicato-baba/entrada.html?e=e-tok");
  assertEquals(t[2], "Tu orden #12 completa: https://postropicalia.com/sindicato-baba/orden.html?t=o-tok");
  assertEquals(t[3], "Cómo llegar a CC Chacaíto: https://maps.app.goo.gl/D9tyCVLa8ppZVfDE6");
  assertEquals(t[4], "Haz captura del QR ahora; en la puerta sube el brillo y muéstralo. ¿Problemas? Responde a este mensaje.");
});

Deno.test("las demás posiciones no llevan el enlace de la orden", () => {
  const t = textoAviso({ ...p, posicion: 2 });
  assert(t.includes("2 de 3") && t.includes("entrada.html?e=e-tok"));
  assert(!t.includes("orden.html"), "la entrada 2 lleva el enlace de la orden");
});

// Sin --allow-read (el gate corre `deno test supabase/functions/`) sale como "ignored", no como verde.
const lee = (await Deno.permissions.query({ name: "read" })).state === "granted";
Deno.test({ name: "mismo mapa que la ticketera (requiere --allow-read)", ignore: !lee }, async () => {
  const comun = await Deno.readTextFile(new URL("../../../ticketera/comun.js", import.meta.url));
  assertEquals(comun.match(/mapa: "([^"]+)"/)?.[1], MAPA);
});
