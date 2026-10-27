// Única fuente del texto que vytas manda por WhatsApp con cada entrada (issue #5).
// Repite a mano los datos de FIESTA de ticketera/comun.js; texto.test.ts solo compara el mapa (con
// --allow-read). Las dudas se responden en el mismo chat.
export const BASE = "https://postropicalia.com/sindicato-baba/";
export const MAPA = "https://maps.app.goo.gl/D9tyCVLa8ppZVfDE6";

export type Pendiente = { token: string; orden_token: string; numero: number; posicion: number; total: number };

export function textoAviso(p: Pendiente): string {
  return [
    `Hola, aquí está tu entrada ${p.posicion} de ${p.total} para Sindicato Baba · DJ BABATR · jueves 29 de octubre · 21:00 · CC Chacaíto.`,
    `${BASE}entrada.html?e=${p.token}`,
    ...(p.posicion === 1 ? [`Tu orden #${p.numero} completa: ${BASE}orden.html?t=${p.orden_token}`] : []),
    `Cómo llegar a CC Chacaíto: ${MAPA}`,
    `Haz captura del QR ahora; en la puerta sube el brillo y muéstralo. ¿Problemas? Responde a este mensaje.`,
  ].join("\n");
}
