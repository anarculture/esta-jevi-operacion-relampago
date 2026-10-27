# PRODUCT.md — Sindicato Baba

Escrito el 26-oct-2026 a partir de `docs/user-stories.md`, `docs/spec-ux-ticketera.md` y las
decisiones de Mau en sesión. Los puntos marcados *(inferido)* no fueron confirmados palabra por palabra.

## Product

Plataforma de un colectivo de fiestas en Caracas (Sindicato) para una fecha concreta: DJ BABATR,
jueves 29 de octubre de 2026, 21:00, CC Chacaíto. Dos piezas en el mismo repo:

- **Ticketera** (`ticketera/`): venta de entradas sin pasarela. El comprador paga por transferencia
  a la cuenta personal del organizador, sube la captura, y recibe entradas con QR cuando el
  organizador concilia a mano contra su banco, con un dictamen de IA como apoyo.
- **Plataforma de PM** (`index.html`, publicada en `pm/`): presupuesto, caja, tareas y operación del
  evento. Su estado vive en Supabase detrás de la Edge Function `pm` (clave `PM_CLAVE`); Claude Code y
  vytas lo leen y actualizan por HTTP. Sin clave, el navegador guarda solo en local.

## Users

- **Comprador**: público de fiesta en Caracas, en el teléfono, llegando desde el flyer en Instagram
  o WhatsApp. Paga a un desconocido y necesita confianza y una salida humana.
- **Organizador (Mau)**: una sola persona, en su teléfono, concilia pagos entre otras tareas y
  avisa por WhatsApp.
- **Portero** *(pendiente)*: valida QR en la puerta, a veces sin señal.
- **Vendedor / referido** *(pendiente)*: vende con enlace propio y gana consumo.

## Platform

`web`. Páginas estáticas en GitHub Pages, móvil primero (390 px), sin build. Backend en Supabase
(Postgres + Storage + Edge Functions). El comprador no tiene cuenta.

## Durable facts

- Métodos de pago: pago móvil (Bs, se cobra €10 a tasa BCV del euro), Zelle y Binance ($10).
  En puerta $15. Todo cae a cuentas personales del organizador; nada se verifica contra API bancaria.
- Nada se aprueba solo: el dictamen de IA orienta, Mau decide.
- El comprobante que vale es el que emite la plataforma (QR firmado por token); la captura del
  comprador es evidencia.
- Contacto humano: WhatsApp del organizador, visible en compra, orden y rechazo.
- Idioma: español de Venezuela (cédula, pago móvil, referencia, tasa BCV).

## Brand commitments

- Nombre del evento y del colectivo: **Sindicato Baba**; handle `@SINDICATO.CLUB`.
- Identidad visual fuente: el flyer (`ticketera/flyer.jpg`): fotocopia en blanco y negro de cables
  y fachada caraqueña, letras cromadas, un solo acento verde neón en el handle. Logos aliados en
  `elements/` (Cerveza Zulia, Bandera, Mal Portada).
- La base visual fue elegida por Mau el 26-oct-2026: "Fotocopia en el poste" (ver `DESIGN.md`).

## Accessibility

Objetivo WCAG AA en texto (4,5:1), objetivos táctiles ≥44 px, formulario completo con teclado y
lector de pantalla, nada transmitido solo por color. El QR se mantiene negro sobre blanco.

## Open decisions

- Check-in del portero y tarifa de puerta (historias 7 y 11 de `docs/user-stories.md`).
- Referidos y vendedores (8 a 11c): % y forma de pago sin decidir.
- Si la plataforma de PM adopta la misma identidad visual o se queda sobria *(inferido: se queda)*.
