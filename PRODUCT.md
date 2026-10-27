# PRODUCT.md — Sindicato Baba

Escrito el 26-oct-2026 a partir de `docs/user-stories.md`, `docs/spec-ux-ticketera.md` y las
decisiones de Mau en sesión. Los puntos marcados *(inferido)* no fueron confirmados palabra por palabra.

## Product

Plataforma de un colectivo de fiestas en Caracas (Sindicato) para una fecha concreta: DJ BABATR,
jueves 29 de octubre de 2026, 21:00, CC Chacaíto. Dos piezas en el mismo repo:

- **Ticketera** (`ticketera/`): venta de entradas sin pasarela. El comprador paga por transferencia
  a la cuenta personal del organizador, sube la captura, y recibe entradas con QR cuando el
  organizador concilia a mano contra su banco, con un dictamen de IA como apoyo. Cada entrada lleva
  su propio WhatsApp (el primero es el del comprador) y vytas avisa a cada dueño desde su número
  cuando la orden se aprueba (Edge Function `avisos`, clave `PM_CLAVE`; reintento en el panel admin).
- **Plataforma de PM** (`index.html`, publicada en `pm/`): presupuesto, caja, tareas y operación del
  evento. Su estado vive en Supabase detrás de la Edge Function `pm` (clave `PM_CLAVE`); Claude Code y
  vytas lo leen y actualizan por HTTP. Sin clave, el navegador guarda solo en local.
  "Ventas y patrocinios" lee las ventas de la ticketera (bloque `ticketera` del `leer` de `pm`, con
  "Actualizar" y la última lectura en local) y las suma a lo que se anota a mano fuera de ella;
  la caja real usa el total. Sin conexión ni lectura previa, la caja usa solo lo manual.

## Users

- **Comprador**: público de fiesta en Caracas, en el teléfono, llegando desde el flyer en Instagram
  o WhatsApp. Paga a un desconocido y necesita confianza y una salida humana.
- **Organizador (Mau)**: una sola persona, en su teléfono, concilia pagos entre otras tareas y
  avisa por WhatsApp.
- **Portero**: valida QR en la puerta con `portero.html` y clave propia, también sin señal (lista
  descargada, cola local y reenvío); deshacer en 5 min; la lista no muestra datos personales.
- **Vendedor / referido** *(pendiente)*: vende con enlace propio y gana consumo.

## Platform

`web`. Páginas estáticas en GitHub Pages, móvil primero (390 px), sin build. Backend en Supabase
(Postgres + Storage + Edge Functions). El comprador no tiene cuenta.

## Durable facts

- Métodos de pago: pago móvil (Bs, se cobra €10 a tasa BCV del euro), Zelle y Binance ($10).
  En puerta $15. Todo cae a cuentas personales del organizador; nada se verifica contra API bancaria.
- Solo un dictamen `coincide` aprueba sin Mau (interruptor `config.auto_aprobar`, activo por defecto),
  y únicamente si la referencia leída es exactamente la tipeada y ninguna otra orden del mismo método
  comparte su sufijo. `dudoso` y `no_coincide` esperan en el panel: ahí el dictamen orienta y Mau decide.
- Los avisos salen del número de vytas, nunca del de Mau. El texto lo arma el servidor y lleva el enlace
  a la entrada, no una imagen. Las entradas anteriores al cambio quedaron como ya avisadas.
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

- Tarifa de puerta (historia 11 de `docs/user-stories.md`); el check-in (7) ya está hecho.
- Referidos y vendedores (8 a 11c): % y forma de pago sin decidir.
- Si la plataforma de PM adopta la misma identidad visual o se queda sobria *(inferido: se queda)*.
