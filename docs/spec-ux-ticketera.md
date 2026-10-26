# Spec — UX de la ticketera antes de abrir la venta

Fuente: crítica Impeccable (dual-agent, 26-oct-2026, Nielsen 21/40) más auditoría
wondel `ux-heuristics` (Krug 5/10) y `cro-methodology` (4/10). Compra de prueba de Mau
el 26-oct. Fiesta: jueves 29-oct-2026, 21:00, CC Chacaíto.

## Problem Statement

El comprador llega desde el flyer a un formulario que no se parece a la fiesta, le pide
transferir $10 a la cuenta personal de un desconocido sin explicarle quién organiza ni
qué pasa después, lo obliga a transcribir a mano teléfono, cédula y un monto en Bs con
decimales, le muestra "Reporta tu pago" antes de que haya pagado, y al enviar lo deja con
un enlace que, si cierra la pestaña del navegador de Instagram o WhatsApp, pierde para
siempre junto con su entrada. En la puerta, sin señal, la página de la orden dice "No
encontramos esta orden". Si lo rechazan, le piden escribir por WhatsApp sin decirle a
quién. Mau, por su lado, no se entera de que entró una orden hasta que recarga, y
después de aprobar tiene que buscar el botón de WhatsApp al final de la lista.

## Solution

Mantener el flujo de tres pasos y la paleta de la plataforma, y arreglar los puntos
donde el comprador duda, pierde datos o se queda sin salida:

- Compra: identidad y confianza arriba (quién organiza, qué pasa después, contacto);
  copiar con un toque cada dato de pago y el monto; el paso 3 aparece solo cuando el
  comprador dice "ya pagué"; el formulario sobrevive al cambio de app; se valida antes de
  subir la captura; la captura se ve en miniatura; la referencia se explica según el método.
- Orden: botón para enviarse el enlace por WhatsApp y copiarlo; el enlace queda guardado
  en el teléfono y la compra ofrece "Ver mi orden"; espera en tono neutro con tiempo
  estimado y contacto; al aprobarse, instrucción de hacer captura de pantalla; la última
  orden aprobada se guarda en el teléfono y se muestra sin red; el error de red se
  distingue de "no existe"; el rechazo trae enlace de WhatsApp con el número de orden.
- Admin: la cola se refresca sola y el título muestra cuántas hay por revisar; al aprobar
  se abre WhatsApp al comprador de inmediato; rechazar pide motivo y ofrece avisarlo;
  filtro por nombre, cédula o referencia.

## User Stories

### Compra (`index.html`)

1. Como comprador, quiero ver el nombre de la fiesta, el DJ, la fecha, la hora y el lugar arriba de todo, para saber que estoy comprando lo que vi en el flyer.
2. Como comprador, quiero saber quién organiza y a nombre de quién pago, para transferirle a una persona con confianza.
3. Como comprador, quiero leer en tres líneas qué pasa después de pagar (pago, subo captura, me confirman por WhatsApp con mis QR), para no quedarme con dudas antes de transferir.
4. Como comprador, quiero un enlace de WhatsApp de contacto visible en la compra, para preguntar antes de pagar si algo no me cuadra.
5. Como comprador, quiero ver el total actualizarse al cambiar la cantidad aunque todavía no haya elegido método, para decidir cuántas compro.
6. Como comprador, quiero que me avisen si pido más de 10 entradas en lugar de que el número cambie solo, para no pagar un monto distinto al que escribí.
7. Como comprador que paga por pago móvil, quiero copiar con un toque el teléfono, la cédula y el monto en Bs sin "Bs" ni puntos de miles, para pegarlos en la app del banco sin equivocarme.
8. Como comprador que paga por Zelle o Binance, quiero copiar el correo, el titular o el ID con un toque, para no transcribirlos.
9. Como comprador, quiero ver la fecha de la tasa BCV en formato local (23/10) o "de hoy", para entender de dónde sale el monto.
10. Como comprador, quiero que el paso "Reporta tu pago" aparezca solo cuando toque el botón "Ya pagué", para no llenar datos antes de haber pagado.
11. Como comprador, quiero que al aparecer el paso siguiente la página baje sola hasta él, para no tener que buscarlo.
12. Como comprador, quiero que la cantidad, el método y lo que ya escribí se conserven si el navegador recarga al volver de la app del banco, para no empezar de cero.
13. Como comprador, quiero que el campo de referencia me diga qué número poner según el método (referencia del pago móvil, confirmación de Zelle, Order ID de Binance), para no mandar el número equivocado.
14. Como comprador, quiero ver una miniatura de la captura que elegí, para confirmar que subí el comprobante correcto.
15. Como comprador, quiero que me marquen el campo con error antes de subir la captura, para no esperar una subida de varios MB y recibir un error de cédula.
16. Como comprador, quiero que si la subida ya se hizo y falla el registro, el reintento no vuelva a subir la captura, para gastar menos datos.
17. Como comprador, quiero que el botón diga "Subiendo captura…" y luego "Registrando…", para saber que algo pasa durante una subida lenta.
18. Como comprador, quiero que cualquier error de servidor no mapeado se muestre en español con el contacto de WhatsApp, para no ver "HTTP 500".
19. Como comprador que ya compró, quiero ver "Ver mi orden" en la página de compra, para volver a mi orden sin el enlace.
20. Como comprador, quiero ver el flyer o el logo de la fiesta en la cabecera, para reconocer la fiesta en la página. *(P2, se hace si queda tiempo)*

### Orden (`orden.html`)

21. Como comprador, quiero un botón "Enviarme el enlace por WhatsApp" arriba de todo, para guardar la orden en mi chat.
22. Como comprador, quiero un botón "Copiar enlace", para pegarlo donde quiera.
23. Como comprador, quiero que el enlace de mi orden quede guardado en el teléfono, para que la página de compra me lo ofrezca.
24. Como comprador en revisión, quiero una espera en tono neutro que diga quién verifica y cuánto suele tardar, para no sentir que algo salió mal.
25. Como comprador en revisión, quiero el contacto de WhatsApp a mano, para preguntar si pasa mucho tiempo.
26. Como comprador aprobado, quiero una instrucción de hacer captura de pantalla de mis QR y subir el brillo en la puerta, para entrar aunque no haya señal.
27. Como comprador aprobado, quiero que la página muestre mis QR desde una copia guardada en el teléfono si no hay red, para no ver un error en la puerta.
28. Como comprador, quiero que un fallo de red diga "Sin conexión, reintenta" y no "No encontramos esta orden", para no creer que perdí la compra.
29. Como comprador, quiero que los QR se generen aunque falle el CDN, para que la página nunca se quede en "Cargando…".
30. Como comprador rechazado, quiero un botón de WhatsApp con mi número de orden ya escrito, para resolverlo con una persona.
31. Como comprador, quiero ver el lugar y la hora en la orden, para saber adónde llegar.
32. Como comprador, quiero que debajo de cada QR el código corto diga "Código de respaldo", para saber para qué sirve.
33. Como comprador con varias entradas, quiero ver una por tarjeta con su número, para mostrar una por persona.
33b. Como comprador con varias entradas, quiero un botón "Enviar esta entrada" en cada QR que abra WhatsApp con un enlace a esa sola entrada, para que cada amigo lleve su QR en su teléfono.
33c. Como amigo que recibió un enlace de entrada, quiero ver una página con mi QR, el nombre de la fiesta, la fecha, el lugar y la instrucción de hacer captura, para entrar sin depender del comprador.

### Admin (`admin.html`)

34. Como Mau, quiero que la cola se refresque sola cada minuto, para no recargar a mano.
35. Como Mau, quiero ver en el título de la pestaña cuántas órdenes hay por revisar, para enterarme desde otra pestaña.
36. Como Mau, quiero que al aprobar se abra WhatsApp al comprador con el enlace, para avisarle sin buscar el botón.
37. Como Mau, quiero que al rechazar se me pida el motivo entre tres opciones (no llegó, monto distinto, referencia repetida), para dejarlo registrado.
38. Como Mau, quiero un botón de WhatsApp con el motivo del rechazo, para avisarle al comprador qué corregir.
39. Como Mau, quiero un filtro por nombre, cédula o referencia, para encontrar una orden cuando alguien me escribe.
40. Como Mau, quiero que el banco de destino se vea destacado en la tarjeta, para saber qué app abrir.
41. Como Mau, quiero que las capturas de "Resueltas" carguen solo al hacer scroll, para que el panel abra rápido.
42. Como Mau, quiero que el estado resuelto se muestre con la misma etiqueta que ve el comprador ("Aprobada"), para no leer texto crudo.
43. Como Mau, quiero que el mensaje de WhatsApp diga "Sindicato Baba" y no "jueves 29", para que el comprador lo reconozca.

### Transversales

44. Como persona que usa lector de pantalla, quiero que el grupo de métodos de pago tenga nombre accesible y que los errores y los estados de carga se anuncien, para completar la compra.
45. Como comprador, quiero que todos los títulos de pestaña digan "Sindicato Baba", para distinguir la pestaña.

## Implementation Decisions

- Alcance en dos tandas. **Tanda 1 (antes de abrir la venta):** historias 1 a 39, 43 a 45 (la cabecera con el flyer, historia 20, y el enlace por entrada, 33b y 33c, entran en la tanda 1 por decisión de Mau el 26-oct). **Tanda 2 (si queda tiempo antes del jueves):** 40 a 42.
- Enlace por entrada: una página nueva de entrada individual que recibe el token de la entrada en la URL y llama a una RPC nueva `ver_entrada(token)`, de solo lectura y abierta a `anon` igual que `ver_orden`, que devuelve el número de orden, la posición "N de M", el estado de la orden y nada personal del comprador (ni nombre ni cédula ni teléfono). Si la orden no está aprobada, la RPC devuelve nulo. El QR de esa página codifica el mismo token que ya codifica la orden, así que el check-in futuro no cambia. El botón "Enviar esta entrada" abre `wa.me` sin número con el enlace, para que el comprador elija el contacto.
- Fuera de eso, sin cambios de esquema. Todo ocurre en las páginas, la hoja de estilos y el cliente. La otra excepción es el motivo de rechazo (historia 37): se guarda en la columna de motivo del dictamen que ya existe, a través de la acción `resolver` de la Edge Function `admin`, que recibe un campo opcional `motivo`.
- Contacto: un único número de WhatsApp del organizador vive como constante en el cliente compartido y se usa en compra, orden y admin. **Pendiente: Mau da el número.**
- Copiar al portapapeles: `navigator.clipboard.writeText` con un botón por dato y feedback "Copiado" de dos segundos dentro del mismo botón. El monto en Bs se copia como número con coma decimal y sin separadores de miles (`26586,81`), que es lo que aceptan las apps bancarias venezolanas.
- Reveal del paso 3: el paso 2 termina con un botón "Ya pagué, reportar el pago" que muestra el paso 3 y hace `scrollIntoView`. El paso 2 también hace scroll al aparecer.
- Persistencia del formulario: cantidad, método, referencia, nombre, cédula y teléfono en `sessionStorage` al cambiar; se restauran al cargar. La captura no se persiste (los navegadores no lo permiten).
- Validación en cliente antes de subir: mismas reglas que el servidor (nombre 2 a 80, cédula `^[VE]?\d{5,9}$` tras limpiar, teléfono 10 a 13 dígitos, referencia ≥ 4 tras normalizar). El campo con error recibe `aria-invalid`, foco y el mensaje del mapa de errores existente. La ruta de la captura ya subida se guarda en memoria y se reutiliza si el registro falla.
- Guía de referencia por método: el `label` y un `placeholder` cambian con el método elegido. Textos: pago móvil "Referencia del pago móvil (los números que muestra tu banco)", Zelle "Número de confirmación de Zelle", Binance "Order ID de Binance Pay".
- Miniatura de la captura: `URL.createObjectURL` en una imagen de 96 px bajo el input; se revoca al cambiar.
- Cantidad fuera de rango: el input muestra el mensaje "Máximo 10 por compra; para más, escríbenos" y no envía, en lugar de recortar en silencio.
- Enlace de la orden: botón primario "Enviarme el enlace por WhatsApp" que abre `wa.me/<teléfono del comprador>?text=<enlace>` (el comprador se lo envía a sí mismo; en WhatsApp eso abre su propio chat o el de "Tú"); botón secundario "Copiar enlace" con `navigator.share` si existe. El token de la última orden se guarda en `localStorage`; la compra muestra un enlace "Ver mi orden #N" si existe.
- Copia offline de la orden aprobada: al recibir una orden aprobada se guarda el JSON en `localStorage` bajo su token; si la carga falla por red y hay copia, se pinta la copia con un aviso "Mostrando copia guardada". Fallo de red se detecta porque `fetch` lanza, a diferencia de una respuesta vacía del RPC.
- QR sin CDN: la librería `qrcode-generator` se sirve desde el repo junto a las páginas en lugar de cdnjs, y la generación va dentro del `try`.
- Tono de la espera: la caja "en revisión" pasa de `.aviso` ámbar a una variante neutra (fondo superficie, borde línea), con texto: "Mau revisa cada pago a mano en su banco. Suele tardar menos de una hora; de noche puede ser a la mañana siguiente." y el contacto.
- Admin: `setInterval` de 60 s sobre la carga; `document.title` = "(N) Conciliar"; tras aprobar con éxito, `window.open(whatsapp(o))` antes de recargar la lista; rechazar usa un `prompt` con tres opciones numeradas y permite texto libre; el filtro es un `input type=search` que filtra en memoria por nombre, cédula y referencia normalizada.
- Identidad (historia 20, tanda 1): se limita a una cabecera con `FINALSINDICATOBABA.png` recortada en 16:9 a lo ancho, encima del h1, en compra y orden. La paleta no cambia en esta tanda.

## Testing Decisions

- Un buen test comprueba lo que ve o recibe el comprador, no la estructura del DOM ni los nombres de funciones.
- **Seam único: la frontera cliente ↔ Supabase.** Las tres páginas hablan con el servidor solo a través de `rpc`, `funcion` y `subirCaptura` en el cliente compartido. Las pruebas de interfaz cargan cada página en Chrome headless (el mismo `google-chrome` + `playwright-core` que usó la crítica) con esas tres funciones sustituidas por fixtures JSON (`datos_venta` con dos métodos, `ver_orden` en cada estado, cola de admin con tres órdenes) y verifican estados y textos: paso 3 oculto hasta "Ya pagué"; botones de copiar escriben al portapapeles el valor sin formato; error de cédula aparece sin que se llame a `subirCaptura`; orden aprobada muestra N tarjetas de QR y, con `fetch` fallando y copia guardada, sigue mostrándolas; orden rechazada muestra el botón de WhatsApp con el número de orden.
- Las capturas de pantalla a 390×844 de cada estado se guardan como evidencia junto al informe de la crítica, para comparar antes y después.
- La página de entrada individual se prueba en el mismo seam: `ver_entrada` sustituida por fixtures (aprobada, no aprobada, token inexistente).
- La lógica del servidor que cambia (motivo de rechazo en `resolver`, RPC `ver_entrada` que no expone datos personales ni entradas de órdenes no aprobadas) se cubre extendiendo el test SQL existente de la ticketera, que corre en una transacción contra el Supabase local.
- Arte previo: el test SQL de la ticketera y el script de autochequeo en Node de la plataforma de PM (`node -e` con `assert`).

## Out of Scope

- Rediseño de la paleta o del sistema visual (el verde de la plataforma se queda; solo una cabecera opcional con el flyer).
- Recuperar la orden por cédula + referencia desde el servidor (nuevo RPC); el enlace por WhatsApp y `localStorage` cubren el caso.
- Check-in del portero, tarifa de puerta, referidos y vendedores (historias 7 a 11c de `docs/user-stories.md`).
- Deshacer una aprobación o un rechazo.
- Notificaciones push o sonido en admin.
- Compresión de la imagen en el cliente.

## Further Notes

- Puntajes de partida: Nielsen 21/40 (las más bajas: reconocer antes que recordar 1, ayuda 1); Krug 5/10 (fallan "muestra qué pasa", "errores útiles", "puede volver atrás", "momentos de 'huh'"); CRO 4/10 (sin O/CO, sin prueba de confianza, sin contacto). Detector Impeccable: 0 hallazgos. Contraste WCAG AA: todos los pares de texto pasan (mínimo 6,05:1); el borde de las opciones sin elegir es 1,34:1 y por eso la opción elegida se distingue solo por el fondo verde.
- Tabla objeción / contra-objeción que guía el copy de la compra: "¿Quién es este?" → titular + "organiza Sindicato" + contacto; "¿Y si pago y no me llega?" → los tres pasos con tiempo estimado y el WhatsApp; "¿Cuánto es en Bs exacto?" → monto grande, tasa con fecha, botón copiar; "¿Qué número es la referencia?" → label por método.
- Seam de pruebas confirmado por Mau el 26-oct. Cabecera con el flyer: confirmada para la tanda 1.
- Enlace por entrada: confirmado por Mau el 26-oct (opción "enlace", no capturas).
- Decisión abierta para Mau: número de WhatsApp de contacto.
- Capturas de la crítica: `/tmp/claude-1000/-home-acracia-Code-esta-jevi-operacion-relampago/64163de4-7ad4-40f2-bdb1-6a1e0d8b9cde/scratchpad/critique/`.
