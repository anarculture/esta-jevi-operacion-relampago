// Única fuente del texto que vytas manda por WhatsApp con cada entrada (issue #5).
// Mismos datos de la fiesta que FIESTA de ticketera/comun.js. Las dudas se responden en el mismo chat.
export const BASE = "https://postropicalia.com/sindicato-baba/";

export type Pendiente = { token: string; orden_token: string; numero: number; posicion: number; total: number };

export function textoAviso(p: Pendiente): string {
  return [
    `Hola, aquí está tu entrada ${p.posicion} de ${p.total} para Sindicato Baba · DJ BABATR · jueves 29 de octubre · 21:00 · CC Chacaíto.`,
    `${BASE}entrada.html?e=${p.token}`,
    ...(p.posicion === 1 ? [`Tu orden #${p.numero} completa: ${BASE}orden.html?t=${p.orden_token}`] : []),
    `Haz captura del QR ahora; en la puerta sube el brillo y muéstralo. ¿Problemas? Responde a este mensaje.`,
  ].join("\n");
}
