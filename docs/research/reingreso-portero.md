# Reingreso sin escaneo de salida: cómo evitar que un QR pase por la reja

Investigación del 27-oct-2026 (martes). La fiesta es el jueves 29-oct. Se leyó el código real de la puerta
(`ticketera/portero.html`, `ticketera/entrada.html`, `ticketera/orden.html`, `ticketera/comun.js`, la función
`supabase/functions/portero/`, las migraciones `20261027000000_portero.sql` y
`20261027040000_portero_hora_local.sql`, `ver_entrada` en `20261027120000_avisos.sql`, la función `avisos/` y
`entradas-manuales/`). Se revisaron los centros de ayuda oficiales de Ticketmaster, AXS, DICE, Eventbrite,
Universe, Shotgun y Resident Advisor; cuando la web devolvía 403 se leyó el mismo artículo por la API pública de
Zendesk de cada centro. También la documentación de Google Wallet sobre códigos rotativos, el RFC 6238 (TOTP),
WebKit, MDN y dos patentes. **No se probó nada en teléfonos reales ni contra producción.** No se pudo verificar:
el centro de ayuda de Tixr (respondió 403 en web y API), el artículo original de Conduition sobre SafeTix (no
respondió; se cita por Hackaday, que es **secundaria**), la normativa venezolana de datos personales, ni la
calidad de una foto nocturna en la puerta de CC Chacaíto.

## Conclusión

Sin escaneo de salida, el sistema no puede saber si quien muestra un QR "ya usado" salió o nunca entró. Ningún
truco sobre el QR resuelve eso, porque el ataque no falsifica el QR: le pasa a otra persona el link, la captura o
el teléfono entero. Lo único que distingue "el mismo que entró" es la persona. Las ticketeras grandes tampoco lo
resuelven con el boleto: prohíben el reingreso, lo dejan al sello del recinto o escanean la salida (ver abajo).

**Recomendación (6–8 h, cabe el miércoles): foto del asistente en su primer ingreso, tomada por el portero con
la misma cámara, y mostrada en grande cada vez que salga "Reingreso". Sin foto, no hay reingreso.** Se construye
en dos pasos: primero la foto queda en el teléfono del portero (IndexedDB); después se sube a un bucket privado
por la función `portero`, para que la vea un segundo teléfono y no se pierda si el primero muere. Frena la
captura, el link reenviado y el teléfono por la reja; detecta el robo del primer ingreso; sirve igual con los PNG
de cortesía; el portero sigue sin ver nombre, cédula ni teléfono. No toca `checked_in_at`, así que el total de
asistentes sigue siendo el mismo conteo de hoy. Pide una migración (el bucket), desplegar la función y
`portero.html`, y borrar las fotos el viernes.

**Plan B (3–4 h, solo `portero.html`, sin migración ni despliegue de función): el primer paso solo.** Alcanza si
la puerta tiene un solo teléfono, como describe `docs/operativa-jueves.md`. Pierde las fotos si ese teléfono se
pierde o se descarga, y un segundo portero no las ve.

**Si no hay tiempo para código:** dejar la rama como está y, ante un "Reingreso" de "hace 0–3 min", pedir que
abra el chat de WhatsApp donde le llegó la entrada desde el número de vytas. Detiene poco (ver tabla).

**No recomendado para el jueves: QR rotativo (TOTP/HMAC).** Frena una captura vieja, pero el link de
`entrada.html` es el boleto: quien está adentro lo reenvía con un toque y afuera se abre un QR vivo. Además
contradice el "Haz captura del QR ahora" que ya salió en cada aviso, los PNG de cortesía no rotan, y el código de
respaldo de 8 caracteres impreso en cada entrada seguiría siendo una credencial fija. Atarlo al primer teléfono
que abre el link tapa el reenvío, pero rompe a los compradores que ven todas sus entradas en `orden.html` y exige
resetear entradas a mano en plena noche.

## Qué hay hoy (según el código)

- **El QR es el `entradas.token` crudo (UUID).** `entrada.html?e=<token>` lo dibuja en el navegador con
  `qrcode.min.js` a partir de la URL, llama a `ver_entrada` (grant a `anon`) y guarda una copia en localStorage
  para mostrarse sin señal. El link funciona como portador: quien lo tiene, tiene la entrada.
- **Se pide la captura.** La página dice "Haz captura de pantalla de este QR ahora" y el texto del aviso de vytas
  (`supabase/functions/avisos/texto.ts`) dice "Haz captura del QR ahora". Muchos asistentes llegarán con una
  imagen estática.
- **Cada entrada tiene su link y su WhatsApp** (`entradas.whatsapp`, uno por entrada). La entrada 1 lleva además
  `orden.html?t=…`, que dibuja **todos** los QR de la orden con su código de respaldo y un botón "Enviar esta
  entrada a un amigo". Las entradas con WhatsApp `null` las reparte el comprador como quiera.
- **Doce PNG estáticos ya enviados** en `entradas-manuales/` (cortesías Zulia y VIP, ventas manuales, una de
  prueba), hechos con `render-cortesia.mjs` desde `cortesia.html`/`vip.html`: mismo QR con el UUID crudo y mismo
  código de respaldo.
- **Puerta.** `checkin_entrada` hace un solo `update` que fija `checked_in_at` si es `null` (atómico entre
  porteros); si ya tenía, devuelve `ya_usada` con la hora del primer ingreso. **Los reingresos no se registran en
  ningún lado.** El total de asistentes es `count(checked_in_at)` en `resumen_portero`, por eso un reingreso no lo
  infla.
- **Sin señal.** Lista descargada por `lista_portero` (sin nombre, cédula ni teléfono), marcas `{token: hora}` y
  cola en localStorage. La cola solo sube las válidas; un reingreso sin señal no deja rastro. `guardar` en
  `comun.js` traga cualquier error, incluido el de cuota llena.
- **En la rama de trabajo** `ya_usada` se muestra como "Reingreso" amarillo con "(hace N min)" contado desde el
  **primer** ingreso, no desde el último escaneo. Desde el segundo reingreso ese número ya no indica un pase
  reciente por la reja.

## Opciones

El ataque de referencia es "alguien de adentro le pasa su entrada a alguien de afuera". Tiene tres formas: la
**captura** (o foto) del QR por WhatsApp, el **link** reenviado, y el **teléfono** pasado por la reja. Todas las
horas son estimadas, con pruebas en `ticketera/tests/ux.mjs`, y no incluyen la prueba en el teléfono del portero.

| # | Opción | Frena | No frena | Edge cases que rompe | Horas | Migración / despliegue |
|---|---|---|---|---|---|---|
| 0 | Lo que ya está en la rama: "Reingreso" amarillo + "(hace N min)" | Nada; avisa de un pase inmediato si el portero lee el número | Captura, link y teléfono | "Hace N min" mide desde el primer ingreso; desde el segundo reingreso engaña | 0 | Solo `portero.html` (ya hecho) |
| 1 | Registrar el último escaneo y contar reingresos; aviso si el anterior fue hace menos de ~10 min; tope (p. ej. 3 reingresos) y después rojo "llama a Mau" | El pase rápido por la reja (aviso) y acota el daño a K personas extra por entrada | El pase paciente (esperar 10 min); el robo del primer ingreso | Sin señal no registra reingresos; molesta al que sale a fumar 5 min si se vuelve bloqueo | 2–3 | Migración (2 columnas + `create or replace checkin_entrada`); función sin cambios; `portero.html` |
| 2 | **Foto al primer ingreso, solo en el teléfono del portero** (plan B) | Captura, link y teléfono: en el reingreso la cara no coincide. Detecta el robo del primer ingreso | Un parecido físico; un portero que no mira; mala luz | Varios teléfonos (la foto vive en uno); teléfono perdido o sin batería; cuota del navegador si se usa localStorage (usar IndexedDB) | 3–4 | Ninguna; solo `portero.html` |
| 3 | **Foto al primer ingreso, en Storage + copia local** (recomendada) | Lo mismo que la 2, y además entre teléfonos con señal | Lo mismo que la 2 | Sin señal, un segundo teléfono no ve la foto que tomó el primero | 6–8 (incluye la 2) | Migración (bucket privado `ingresos`); función `portero` (acción `foto` y foto en `ya_usada`); `portero.html` |
| 4 | QR rotativo TOTP/HMAC en `entrada.html` | La captura con más de ~1 min | El link reenviado (un toque); el teléfono; un relevo en vivo (captura enviada en segundos); el código de respaldo fijo; los PNG | La instrucción "haz captura" ya enviada; reloj del asistente; quien guardó solo la captura y no tiene señal; `orden.html` muestra QR fijos | 8–12 | Migración (clave por entrada en `ver_entrada` y `lista_portero`); función; `entrada.html`, `orden.html`, `portero.html`; reavisar a todos |
| 5 | QR rotativo + atado al primer teléfono que abre el link | Captura y link | El teléfono por la reja | Comprador que abrió las entradas de su grupo; navegador interno de WhatsApp vs. Safari/Chrome; modo privado; datos borrados; cambio de teléfono; batería; el que robó el link primero se queda con la entrada | 14–20 + herramienta de reseteo | Todo lo de la 4 + tabla de dispositivos |
| 6 | Selfie que sube el propio asistente al abrir su entrada | Captura, link y teléfono, si la subió | Al que no la subió (adopción incierta en dos días); a los PNG | Subida anónima a Storage; quien sube la foto de otro | 6–8 | Migración (bucket + política anon); `entrada.html`, `portero.html` |
| 7 | Nombre o cédula en la puerta | Todo, si se exige documento | — | Rompe la privacidad por diseño (el portero vería datos); la cédula es solo del comprador, no de cada asistente; las cortesías no tienen titular (`cedula 'V0'`) | — | No viable |
| 8 | Proceso: en un reingreso reciente, pedir el chat de WhatsApp donde llegó la entrada desde el número de vytas | Captura o link reenviados por un tercero (el de afuera no tiene ese chat) | El teléfono por la reja; entradas sin WhatsApp; cortesías | Ninguno técnico; cuesta tiempo en la fila | 0 | Ninguna |

Dos técnicas de la lista pedida no aparecen como opción propia porque se reducen a otras:

- **Enfriamiento entre escaneos** es la opción 1 con bloqueo en vez de aviso. Bloquear choca con el reingreso
  permitido (la salida a fumar dura minutos) y el atacante solo tiene que esperar.
- **"Un solo adentro por token" con inferencia** no tiene de dónde inferir: sin escaneo de salida, cada reingreso
  es indistinguible de "salió y volvió". Lo único que queda es el tiempo entre escaneos (opción 1) y la identidad
  de la persona (opciones 2, 3, 6, 7).

## Cómo lo hacen las ticketeras

### Ticketmaster (SafeTix)

- El código "se refresca automáticamente cada 15 segundos" para protección contra fraude; "una vez que lo ves en
  nuestra app, tu entrada queda guardada en tu dispositivo específico"; "las capturas de pantalla no te hacen
  entrar"; se recomienda la billetera del teléfono para entrar sin internet
  ([Why do my tickets have a moving barcode?](https://help.ticketmaster.com/hc/en-us/articles/26584309038353-Why-do-my-tickets-have-a-moving-barcode)).
- En Mobile Entry los códigos aparecen tres días antes, "no se aceptan capturas", varios acompañantes pueden
  entrar con las entradas en un solo teléfono si llegan juntos, y si algo falla hay una ventanilla que pide
  identificación con foto que coincida con el nombre de la orden
  ([How do I use Mobile Entry tickets?](https://help.ticketmaster.com/hc/en-us/articles/9786597785617-How-do-I-use-Mobile-Entry-tickets)).
- **Secundaria:** según el análisis de Conduition resumido por Hackaday, el código es un PDF417 con un token en
  Base64, dos TOTP de seis dígitos y una marca de tiempo; rota cada 15 s, y en la puerta la red estaba saturada y
  costó cargarlo ([Hackaday, 11-jul-2024](https://hackaday.com/2024/07/11/ticketmaster-safetix-reverse-engineered/)).
- No se encontró una política de reingreso de Ticketmaster: depende del recinto.

### AXS (Mobile ID)

- No se pueden compartir capturas: "el código QR cambia dentro de la app de AXS cada pocos segundos"
  ([Can I share screen shots…?](https://support.axs.com/hc/en-us/articles/360031506054-Can-I-share-screen-shots-of-digital-tickets-with-friends)).
- Las capturas y la impresión no están disponibles; solo se accede por la app
  ([Do I need the AXS App…?](https://support.axs.com/hc/en-us/articles/201086794-Do-I-need-the-AXS-App-to-use-my-AXS-Mobile-ID),
  [Can I print my AXS Mobile ID ticket?](https://support.axs.com/hc/en-us/articles/360031518434-Can-I-print-my-AXS-Mobile-ID-ticket)).
- El día del evento las entradas se muestran con o sin wifi
  ([How do I use my AXS Mobile ID to enter the venue?](https://support.axs.com/hc/en-us/articles/360031518934-How-do-I-use-my-AXS-Mobile-ID-to-enter-the-venue)).

### DICE

- La entrada vive en la app como "un código QR único vinculado a tu número de teléfono"
  ([Why your DICE tickets are stored in the app](https://dicefm.zendesk.com/hc/en-gb/articles/19414006984465-Why-your-DICE-tickets-are-stored-in-the-app)).
- El QR se activa el día del evento, un par de horas antes; después de activarlo ya no se puede transferir; un
  grupo que llega junto puede mostrar todo en un teléfono, pero si alguien llega aparte hay que enviarle su entrada
  antes de activar; "no hagas captura del QR"
  ([How to activate your tickets on the day of the event](https://dicefm.zendesk.com/hc/en-gb/articles/19413725197713-How-to-activate-your-tickets-on-the-day-of-the-event)).
- Sin smartphone, muchos recintos tienen lista en puerta con documento que coincida con el nombre de la cuenta; las
  entradas quedan disponibles sin conexión si se vieron al menos una vez
  ([How to access your tickets if you can't get on the app](https://dicefm.zendesk.com/hc/en-gb/articles/19414143889169-How-to-access-your-tickets-if-you-can-t-get-on-the-app)).
- **El reingreso lo decide el recinto y no el boleto.** En las fichas de recintos del propio centro de ayuda de
  DICE: The Parkway, "reingreso permitido con sello del recinto"
  ([The Parkway Theater FAQs](https://dicefm.zendesk.com/hc/en-gb/articles/20599126101905-The-Parkway-Theater-FAQs));
  Public Records, "no se permite reingreso"
  ([Public Records FAQ](https://dicefm.zendesk.com/hc/en-gb/articles/19459259776401-Public-Records-FAQ));
  Knockdown Center, no se permite salvo que el evento lo diga
  ([Knockdown Center FAQ](https://dicefm.zendesk.com/hc/en-gb/articles/19472477965457-Knockdown-Center-FAQ));
  Chop Shop, reingreso hasta que sale el headliner y pasando otra vez por seguridad
  ([Chop Shop FAQ](https://dicefm.zendesk.com/hc/en-gb/articles/19967834040337-Chop-Shop-FAQ)).

### Eventbrite (app Organizer)

- El escaneo tiene tres modos: por defecto marca ingreso y da error si el QR ya entró; "Scan to check out" marca
  salida; "Validate Only" solo dice si es válido
  ([Check in attendees… with the Eventbrite app for organizers](https://support.eventbrite.com/hc/en-us/articles/34865085832594-Check-in-attendees-at-your-event-with-the-Eventbrite-app-for-organizers)).
- Desde la computadora se puede marcar salida a muchos a la vez, por ejemplo para reiniciar pases de varios días
  ([Check in or check out attendees from your computer](https://support.eventbrite.com/hc/en-us/articles/34865007454994-Check-in-or-check-out-attendees-from-your-computer)).
- El modelo de reingreso de Eventbrite es escanear la salida, justo lo que el organizador no quiere.

### Universe (BoxOffice)

- En iOS, si una entrada ya se escaneó, la app avisa y pregunta si se quiere registrar el ingreso otra vez
  ([BoxOffice iOS](https://support.universe.com/hc/en-us/articles/360002486192-BoxOffice-IOS-App-check-in-attendees-and-sell-tickets-at-the-door)).
  En Android el mismo centro dice que ninguna entrada se puede escanear más de una vez
  ([BoxOffice Android](https://support.universe.com/hc/en-us/articles/360002501511-BoxOffice-Android-check-in-attendees-and-sell-tickets-at-the-door)).
- Hay entradas multi-escaneo y "check out", que vuelve a cero el saldo; el historial muestra cada ingreso y salida
  con qué dispositivo y qué persona del equipo lo hizo
  ([Viewing the check in history of a ticket](https://support.universe.com/hc/en-us/articles/6501692624653-BoxOffice-App-Viewing-the-check-in-history-of-a-ticket)).
- Se pueden reiniciar los ingresos de un tipo de entrada por franja horaria
  ([Reset Check-Ins on a Ticket Type](https://support.universe.com/hc/en-us/articles/13021790671757-Reset-Check-Ins-on-a-Ticket-Type)).

### Shotgun

- Si la entrada ya se escaneó, el escáner muestra cuándo y con qué escáner; los escáneres se sincronizan entre sí
  por Bluetooth; para el aforo hay un contador manual de salidas ("+" por cada persona que sale) que se descuenta
  del total que entró, sin escanear a nadie
  ([Shotgun Scan – user guide](https://support-pro.shotgun.live/hc/en-us/articles/6986376133138-Shotgun-Scan-user-guide)).
- En la mayoría de los eventos el nombre de la entrada no se verifica en la puerta; lo decide el organizador
  ([I want to change the name on my ticket](https://support.shotgun.live/hc/en-us/articles/29026971571474--I-want-to-change-the-name-on-my-ticket)).

### Resident Advisor

- RA Scan muestra "Already scanned" como error; funciona sin conexión con varios dispositivos a la vez y sincroniza
  al volver la red; permite deshacer un escaneo ([RA Scan app guide](https://support.ra.co/article/504-ra-scan)).
- Las entradas solo se descargan 24 horas antes del evento "para evitar la circulación de entradas falsas o
  sobrevaloradas"; mostrar la entrada en el teléfono es lo recomendado; se pide documento en la mayoría de los
  eventos; las entradas no son transferibles, pero el nombre se puede cambiar hasta 24 horas antes
  ([I have a question about my order or tickets](https://support.ra.co/article/65-faqs-i-have-already-ordered-tickets)).

### Tixr

- No se pudo leer su centro de ayuda (403 en la web y en la API). Sin fuente primaria.

### Base técnica de los códigos rotativos

- Google Wallet: el código cambia periódicamente, "normalmente cada minuto", y el lector acepta solo el más
  reciente; lleva un TOTP; recomienda una clave por pase; el ejemplo usa `TOTP_SHA1` con período de 3000 ms
  ([Rotating Barcodes](https://developers.google.com/wallet/generic/resources/rotating-barcodes)).
- RFC 6238 recomienda pasos de 30 segundos y aceptar como máximo un paso de retraso; un código expuesto a un
  tercero puede usarse dentro de su ventana ([RFC 6238](https://www.rfc-editor.org/rfc/rfc6238)). Por eso una
  captura enviada por WhatsApp a alguien en la reja llega a tiempo.
- Dos patentes describen el mismo patrón: credenciales en el teléfono con información que se actualiza a
  intervalos ([US9047715B2](https://patents.google.com/patent/US9047715B2/en)) y un código de entrada inoperable
  hasta que se activa ([US10937251B2](https://patents.google.com/patent/US10937251B2/en)).

### Lectura para este caso

1. Los códigos rotativos (Ticketmaster, AXS, DICE) apuntan a la reventa y a la captura, y solo funcionan porque el
   boleto vive en una app con cuenta y el teléfono queda atado. Ninguno impide pasar el teléfono por la reja.
2. Ninguna de las siete resuelve el reingreso con el boleto. Lo prohíben, lo dejan al sello del recinto, escanean
   la salida (Eventbrite, Universe) o cuentan salidas a mano para el aforo (Shotgun).
3. Donde hay que saber que es la misma persona, piden documento (Ticketmaster en la ventanilla, DICE en la lista
   de puerta, RA). La foto del primer ingreso cumple esa función sin pedir datos al asistente y sin mostrarle al
   portero los datos del comprador.

## Edge cases

| Caso | 0 Hoy (rama) | 1 Último escaneo + tope | 2 Foto local (plan B) | 3 Foto Storage (rec.) | 4 QR rotativo | 5 Rotativo + dispositivo |
|---|---|---|---|---|---|---|
| Sin señal (lista y cola) | Funciona | Los reingresos sin señal no se registran | Funciona entera en ese teléfono | Cae a la copia local; la foto sube con la cola | El asistente necesita la clave guardada (abrió el link con señal antes); quien guardó solo la captura queda fuera; la lista del portero tendría que llevar las claves | Igual que la 4 |
| Varios porteros a la vez | Con señal, atómico; sin señal, dos verdes y aviso al sincronizar | Con señal, coherente | La foto solo está en el teléfono que la tomó | Con señal la ven todos; sin señal, solo el que la tomó | Cada teléfono necesita las claves | Igual que la 4 |
| Orden con N entradas | Bien | Bien | Escanear y fotografiar alternando (escaneo k, foto de la persona k); conviene que la app no lea otro QR hasta "Foto" o "Sin foto" | Igual que la 2 | El comprador debe reenviar links, no capturas; `orden.html` muestra QR fijos | Si el comprador abrió las entradas de su grupo, quedan atadas a su teléfono |
| PNG estáticos ya enviados (12) | Bien | Bien | Bien: no cambia nada del lado del asistente | Bien | Hay que aceptar UUID crudo para esos tokens, que quedan sin protección | Igual que la 4 |
| Reloj del teléfono desfasado | "Hace N min" usa el reloj del portero; si va adelantado o atrasado, el número miente (el negativo se oculta) | Igual; mejor calcular la diferencia en el servidor | No depende del reloj del asistente | Igual | Si el reloj del asistente se sale de la ventana, lo rechaza; ampliar la ventana alarga la vida de una captura (RFC 6238) | Igual que la 4 |
| Batería muerta del asistente | Código de respaldo si lo recuerda | Igual | Código de respaldo + cara contra la foto | Igual | El código de respaldo es fijo: o se desactiva para reingresos (y el que se quedó sin batería no vuelve) o es la puerta trasera | Igual que la 4 |
| Robo del primer ingreso (entra antes el de la captura) | El ladrón entra verde, el dueño entra amarillo: los dos adentro y no se nota | Igual; solo el "hace N min" da pista | El dueño sale amarillo con la cara de otro: se detecta, y el ladrón es identificable adentro | Igual | Frena la captura vieja, no el link robado | Si el ladrón abrió el link primero, el dueño queda bloqueado |
| QR en pantalla vs. papel | Sin cambio. Ojo: en iOS se usa jsQR con `inversionAttempts: "dontInvert"`, así que un QR invertido por modo oscuro no se lee | Sin cambio | Sin cambio en la lectura; la foto se toma con la misma cámara trasera, ya abierta | Igual | Un payload más largo da un QR más denso; papel y PNG no rotan | Igual que la 4 |
| Privacidad (el portero no ve datos del comprador) | Bien | Bien | El portero ve una cara que ya vio en persona, más "entrada k de N · orden #X". Nada sale del teléfono | La foto queda en el servidor junto al token: quien administre la base puede cruzarla con la orden. Bucket privado, sin acceso `anon`, borrado el viernes | Bien | Guarda una huella del dispositivo |

Notas:

- **Cuota del navegador.** MDN da 5 MiB de localStorage por origen y un `QuotaExceededError` al llenarse
  ([Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)).
  Cientos de fotos en base64 se acercan a ese tope y, como `guardar` traga el error, la lista, las marcas y la cola
  sin señal dejarían de guardarse sin aviso. Por eso las fotos van en IndexedDB, nunca en localStorage.
- **Atar al dispositivo con almacenamiento del navegador es frágil.** En Safari, WebKit borra todo el
  almacenamiento escrito por scripts (localStorage, IndexedDB) tras siete días de uso sin interacción con el sitio
  ([WebKit, 24-mar-2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). A eso se suman
  el navegador interno de las apps, el modo privado y el cambio de teléfono (no verificado aquí para el navegador
  interno de WhatsApp).
- **El total de asistentes no cambia en ninguna opción.** Ninguna toca `checked_in_at`; el robo del primer
  ingreso sí deja a dos personas con un solo token, y eso hoy no se ve.

## Diseño mínimo de la recomendación

1. `portero.html`, paso local (plan B). Tras una `valida`, el verde dura ~1 s y vuelve la cámara con un botón
   grande "Foto" y uno chico "Sin foto"; la lectura de QR queda en pausa hasta tocar uno de los dos. La foto se
   saca del `<video>` que ya está abierto: un canvas de ~240 px de ancho y `toDataURL("image/jpeg", 0.6)`, que
   todos los navegadores soportan aunque solo PNG es obligatorio
   ([MDN toDataURL](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL)). Se guarda en
   IndexedDB con el token como clave. En `ya_usada`, el amarillo muestra la foto grande y no se cierra solo a los
   2 s, sino al tocar. Sin foto, el texto dice "Sin foto: no hay reingreso". "Deshacer" también borra la foto.
2. Paso servidor. Una migración crea el bucket privado (`insert into storage.buckets … ('ingresos', false, …)`,
   igual que `capturas` en `20261024000000_ticketera.sql`, pero sin políticas para `anon`). La función `portero`
   suma `accion: "foto"` (token UUID y JPEG en base64 de 64 KB como máximo, `db.storage.from("ingresos").upload`
   con `upsert`) y, cuando el `checkin` da `ya_usada`, adjunta la foto si existe. El teléfono busca primero la
   local. Las fotos tomadas sin señal se suben con una cola propia, igual que los ingresos.
3. Pruebas en `ticketera/tests/ux.mjs`, que ya intercepta `functions/v1` y `storage/v1`.
4. En la puerta, un cartel: "Te tomamos una foto para que puedas salir y volver. Se borra el viernes." El viernes,
   vaciar el bucket (dashboard de Storage o CLI) y el IndexedDB del teléfono (botón "Salir" o borrar datos del
   sitio).
5. Antes de abrir, probarlo en el teléfono real del portero, con la luz real de la entrada.

## Qué queda sin verificar

- El centro de ayuda de Tixr y el artículo original de Conduition sobre SafeTix.
- Las políticas de reingreso de Ticketmaster y AXS: dependen de cada recinto.
- La calidad de la foto con la luz de la entrada y el tiempo que suma por persona (estimado en 2–3 s; no medido).
- Si el navegador interno de WhatsApp en iOS y Android comparte almacenamiento con Safari o Chrome (afecta solo a
  las opciones 4 y 5).
- La normativa venezolana sobre fotos de asistentes. No se revisó.

## Fuentes

Primarias (centros de ayuda y documentación oficial de cada empresa, especificaciones, patentes):

- Ticketmaster, "Why do my tickets have a moving barcode?": https://help.ticketmaster.com/hc/en-us/articles/26584309038353-Why-do-my-tickets-have-a-moving-barcode
- Ticketmaster, "How do I use Mobile Entry tickets?": https://help.ticketmaster.com/hc/en-us/articles/9786597785617-How-do-I-use-Mobile-Entry-tickets
- AXS, "Can I share screen shots of digital tickets with friends?": https://support.axs.com/hc/en-us/articles/360031506054-Can-I-share-screen-shots-of-digital-tickets-with-friends
- AXS, "Do I need the AXS App to use my AXS Mobile ID?": https://support.axs.com/hc/en-us/articles/201086794-Do-I-need-the-AXS-App-to-use-my-AXS-Mobile-ID
- AXS, "How do I use my AXS Mobile ID to enter the venue?": https://support.axs.com/hc/en-us/articles/360031518934-How-do-I-use-my-AXS-Mobile-ID-to-enter-the-venue
- AXS, "Can I print my AXS Mobile ID ticket?": https://support.axs.com/hc/en-us/articles/360031518434-Can-I-print-my-AXS-Mobile-ID-ticket
- DICE, "How to activate your tickets on the day of the event": https://dicefm.zendesk.com/hc/en-gb/articles/19413725197713-How-to-activate-your-tickets-on-the-day-of-the-event
- DICE, "Why your DICE tickets are stored in the app": https://dicefm.zendesk.com/hc/en-gb/articles/19414006984465-Why-your-DICE-tickets-are-stored-in-the-app
- DICE, "How to access your tickets if you can't get on the app": https://dicefm.zendesk.com/hc/en-gb/articles/19414143889169-How-to-access-your-tickets-if-you-can-t-get-on-the-app
- DICE, fichas de recintos: https://dicefm.zendesk.com/hc/en-gb/articles/20599126101905-The-Parkway-Theater-FAQs · https://dicefm.zendesk.com/hc/en-gb/articles/19459259776401-Public-Records-FAQ · https://dicefm.zendesk.com/hc/en-gb/articles/19472477965457-Knockdown-Center-FAQ · https://dicefm.zendesk.com/hc/en-gb/articles/19967834040337-Chop-Shop-FAQ
- Eventbrite, "Check in attendees at your event with the Eventbrite app for organizers": https://support.eventbrite.com/hc/en-us/articles/34865085832594-Check-in-attendees-at-your-event-with-the-Eventbrite-app-for-organizers
- Eventbrite, "Check in or check out attendees from your computer": https://support.eventbrite.com/hc/en-us/articles/34865007454994-Check-in-or-check-out-attendees-from-your-computer
- Universe, "BoxOffice IOS App": https://support.universe.com/hc/en-us/articles/360002486192-BoxOffice-IOS-App-check-in-attendees-and-sell-tickets-at-the-door
- Universe, "BoxOffice Android": https://support.universe.com/hc/en-us/articles/360002501511-BoxOffice-Android-check-in-attendees-and-sell-tickets-at-the-door
- Universe, "Viewing the check in history of a ticket": https://support.universe.com/hc/en-us/articles/6501692624653-BoxOffice-App-Viewing-the-check-in-history-of-a-ticket
- Universe, "Reset Check-Ins on a Ticket Type": https://support.universe.com/hc/en-us/articles/13021790671757-Reset-Check-Ins-on-a-Ticket-Type
- Shotgun, "Shotgun Scan – user guide": https://support-pro.shotgun.live/hc/en-us/articles/6986376133138-Shotgun-Scan-user-guide
- Shotgun, "I want to change the name on my ticket": https://support.shotgun.live/hc/en-us/articles/29026971571474--I-want-to-change-the-name-on-my-ticket
- Resident Advisor, "RA Scan app guide": https://support.ra.co/article/504-ra-scan
- Resident Advisor, "I have a question about my order or tickets": https://support.ra.co/article/65-faqs-i-have-already-ordered-tickets
- Google Wallet, "Rotating Barcodes": https://developers.google.com/wallet/generic/resources/rotating-barcodes
- IETF, RFC 6238 (TOTP): https://www.rfc-editor.org/rfc/rfc6238
- WebKit, "Full Third-Party Cookie Blocking and More": https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
- MDN, "Storage quotas and eviction criteria": https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN, "HTMLCanvasElement: toDataURL()": https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL
- Patente US9047715B2: https://patents.google.com/patent/US9047715B2/en
- Patente US10937251B2: https://patents.google.com/patent/US10937251B2/en

Secundarias:

- Hackaday, "Ticketmaster SafeTix Reverse-Engineered" (11-jul-2024), resumen del análisis de Conduition: https://hackaday.com/2024/07/11/ticketmaster-safetix-reverse-engineered/
