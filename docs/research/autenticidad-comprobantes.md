# Qué campos de un comprobante prueban que el pago existe

Investigación del 26-oct-2026 (lunes). La fiesta es el jueves 29-oct. Se revisaron documentación oficial de
Binance, material de Zelle y Early Warning, el repositorio de ejemplos que publica Mercantil Banco en GitHub
y sus PDF de campos, contratos de bancos venezolanos y prensa venezolana. **No se probó ninguna llamada real**
porque no hay credenciales de ninguna API bancaria ni de Binance. Cuando no hubo fuente primaria se dice
explícitamente. Varias APIs venezolanas solo aparecen documentadas en código de terceros. Esas fuentes se
marcan como **secundarias**.

## Conclusión

**Ninguna captura prueba un pago por sí sola.** En los tres métodos, la prueba es el movimiento que aparece en
la cuenta receptora. La captura solo sirve para encontrar ese movimiento. Por eso el OCR debe extraer las
llaves de búsqueda que usan los bancos: referencia, fecha, monto, teléfono y cédula del pagador y banco de
origen. La plantilla visual del comprobante importa menos, porque hay generadores públicos de comprobantes
falsos con la misma tipografía y los mismos logos que el original
([Diario Avance, 17-jun-2025](https://diarioavance.com/piden-estar-alerta-con-falsas-capturas-de-pago-movil/)).

Hoy existen tres vías de verificación automática:
- **Pago móvil hacia Mercantil, BDV o BNC.** Los tres bancos tienen una API para empresas que busca un pago
  entrante por referencia, fecha, monto y teléfono. Solo sirve si la cuenta receptora de la fiesta está en
  uno de esos bancos y es una cuenta jurídica afiliada.
- **Binance Pay.** Cualquier usuario puede crear una API key de solo lectura y consultar
  `GET /sapi/v1/pay/transactions`. No hace falta ser comerciante, pero el endpoint no filtra por ID.
- **Zelle.** No hay vía automática para un particular. La única prueba es la actividad Zelle en la app del
  banco receptor.

## 1. Pago móvil interbancario (Venezuela)

### Estructura de la referencia

- **No se encontró un estándar publicado por el BCV, Suiche 7B ni Conexus** sobre el formato de la referencia.
  El contrato de Banplus confirma que el servicio corre sobre "la infraestructura de las redes Conexus y
  Suiche 7B" y que el BCV fija los límites. El contrato no define la referencia
  ([Banplus, condiciones Pago Plus](https://banplus.com/wp-content/uploads/2025/04/CONDICIONES-PAGO-PLUS.pdf)).
- **La referencia interbancaria tiene 12 caracteres.** Esto lo dice la API oficial de Mercantil. El PDF de
  campos de la "API Búsqueda de Transacciones Tpago" describe `payment_reference` como "Número de la
  referencia interbancaria de la transacción" y lo acepta de dos formas: "Número de referencia completo de 12
  caracteres" o "Los últimos 4, 5 ó 6 caracteres del número de referencia"
  ([PDF Mercantil, C2P search](https://www.mercantilbanco.com/mercprod/apiportal/pdfs/api_c2p_search_descripcion_de_atributos_y_campos_0.pdf)).
- **Cada banco imprime además su propia referencia interna, con otro largo.** El PDF de la API de búsqueda de
  transferencias de Mercantil da el ejemplo "referencia Mercantil 99912345678" de 11 dígitos y pide enviar solo
  "los últimos 8 dígitos"
  ([PDF Mercantil, transfer search](https://www.mercantilbanco.com/mercprod/apiportal/pdfs/api_transfer_search_descripcion_de_atributos_y_campos_0.pdf)).
  Conclusión práctica: el largo de la referencia varía según el banco y el comprobante. No conviene rechazar
  un pago por el largo de su referencia, y conviene comparar por sufijo.
- **Aprobación, referencia y número de operación.** No se encontró documentación de BNC, Banesco, Provincial,
  BDV, BFC ni Ubii que defina qué etiqueta usa cada uno. Lo único sostenido por una fuente primaria es que las
  APIs de búsqueda piden la **referencia** y no el código de aprobación. El prompt actual de
  `supabase/functions/revisar/index.ts` ya prefiere "Referencia" o "Nro. de operación" sobre "Aprobación", y
  eso es coherente con esas APIs.

### Consulta de un pago entrante por API

| Banco | Qué existe | Llaves de búsqueda | Fuente |
|---|---|---|---|
| Mercantil | API oficial "Búsqueda de pagos móviles" (`POST …/v1/mobile-payment/search`, header `X-IBM-Client-ID`, teléfonos cifrados con AES) y "Búsqueda de transferencias" (`…/v1/payment/transfer-search`) | monto, moneda `ves`, teléfono origen y destino con formato `58` + área + número, referencia de 12 caracteres o sus últimos 4 a 6, fecha `AAAA-MM-DD` | Primaria: [repo `apimercantil/api-playground`](https://github.com/apimercantil/api-playground) (cuenta "Mercantil Banco CA", enlaza a [apiportal.mercantilbanco.com](https://apiportal.mercantilbanco.com/mercantil-banco/produccion/)) y los PDF citados arriba |
| BDV | API "Conciliación de Movimientos" (`POST https://bdvconciliacion.banvenez.com:443/getMovement`, header `X-API-Key` generado desde BDVenLínea Empresas). Responde `1000` si encuentra el pago y `1002 Movimiento no encontrado` si no | cédula y teléfono del pagador, teléfono destino, referencia, fecha, importe, banco origen | Secundaria: transcripción del manual "MDU-006" en [phlexmod-docs](https://github.com/JAG-MEDIA-SERVICIOS-C-A/phlexmod-docs/blob/301a07f108b9b81ec6e71b3346f6ab619ffa374b/es/6-guias/APIConciliacion.md) y la [doc de TMT](https://mintlify.wiki/Zeto96/tmt-doc-6/api-reference/payments/bdv). El host no respondió al consultarlo directamente |
| BNC | API "ESolutions" con `Position/ValidateP2P` en `https://servicios.bncenlinea.com:16000/api/`, que devuelve `MovementExists` | cuenta receptora, monto, código del banco, RIF del cliente, teléfono, referencia, fecha | Secundaria: código de [Api-Transporte](https://github.com/albertcharmelo/Api-Transporte/blob/HEAD/app/BankUrisApi.php) y de [pillatickets](https://github.com/tauhid132/pillatickets/blob/HEAD/app/Http/Controllers/PagoMovilPaymentController.php), que también es una ticketera. No se encontró documentación oficial pública |
| Activo | Sección de APIs para empresas con "consulta de pago móvil" y webhooks | sin documentación técnica pública | Prensa: [Ecosistema Startup](https://ecosistemastartup.com/activo-banco-universal-lanza-apis-para-empresas-en-venezuela/) |
| Banesco | La "Suite BanescoPagos" permite "confirmar en tiempo real si han recibido un Pago Móvil, sin necesidad de ingresar a la cuenta jurídica". Funciona en una app o en el punto de venta del banco. No se encontró API | — | Prensa: [Finanzas Digital, 20-ene-2026](https://finanzasdigital.com/suite-banesco-pagos-comercios-tercer-trimestre-2025/) |
| Provincial, BFC, Bancamiga, R4, Credicard, Ubii | No se encontró documentación de una API de consulta. R4 publica un contacto de implementación (`implementacion@r4conecta.io`) en su ficha de Play Store. El PDF de términos de Bancamiga devolvió 403 | — | [R4 en Play Store](https://play.google.com/store/apps/details?id=r4.app) |

Todas estas APIs son para **cuentas jurídicas afiliadas**, con credenciales que entrega el banco. Ninguna
permite verificar un pago hecho a la cuenta personal de alguien. Solo verifican pagos que entran a la cuenta
afiliada.

### Notificación al receptor

No se encontró una fuente primaria que describa el SMS o la notificación push que recibe el beneficiario en
cada banco. Lo que sí está documentado:
- BDV permite consultar movimientos por SMS: "CMC" más los últimos cuatro dígitos de la cuenta, enviado al 2661
  ([El Diario](https://eldiario.com/2022/01/31/pasos-para-consultar-el-saldo-del-banco-de-venezuela-por-whatsapp/)).
  La fuente es prensa, no el banco.
- Banesco anuló pagos móviles ya recibidos durante una incidencia en julio de 2022
  ([Bloomberg Línea](https://www.bloomberglinea.com/2022/07/29/banesco-sufre-incidencia-con-operaciones-moviles-y-usuarios-entran-en-incertidumbre/)).
  Un pago visible en la cuenta puede revertirse en casos excepcionales.

### Capturas falsas: qué reporta la prensa

- **Portal generador de comprobantes del BDV.** Usaba "logotipos, tipografía y diseños idénticos" a los del
  banco. Un cajero lo detectó porque el comprobante contenía un enlace al portal generador
  ([Diario Avance, 17-jun-2025](https://diarioavance.com/piden-estar-alerta-con-falsas-capturas-de-pago-movil/)).
  El portal fue dado de baja el 5-may-2025, según [Efecto Cocuyo](https://efectococuyo.com/cocuyo-chequea/falsos-comprobantes-pago/)
  (la página devolvió 403; el dato viene del extracto del buscador).
- **Referencias inválidas.** En Nueva Esparta detuvieron a cuatro personas que pagaban con referencias falsas
  del BDV. Las comerciantes las descubrieron al verificarlas en el banco
  ([Prensa Mercosur, abr-2025](https://prensamercosur.org/2025/04/09/estafas-en-el-espinal/)).
- **Delivery pagado con capturas falsificadas.** Un caso en Maracaibo se detectó por descuadres en el balance
  de ventas, no por la imagen
  ([Cactus24, 10-oct-2026](https://cactus24.com.ve/pidio-delivery-pago-con-una-captura-falsa-y-la-policia-le-llevo-la-comida-cayo-en-maracaibo-un-estafador/),
  [Prensa Mercosur, 17-oct-2026](https://prensamercosur.org/2026/10/17/detenido-en-zulia-por-estafar-a-comercios-con-pagos-moviles-falsos/)).
- **Pago real por menos y monto editado con IA.** En Perú, en junio de 2026, se reportó que el estafador hace
  una transferencia real por un monto menor, toma la captura y cambia el monto con una app de IA
  ([Panamericana](https://panamericana.pe/locales/470196-alerta-nueva-modalidad-estafa-ia-alterar-comprobantes-pago)).
  Esta variante pasa cualquier chequeo de referencia y fecha, y solo se detecta con el monto del banco.
- **SUDEBAN.** No se encontró ninguna alerta de SUDEBAN sobre capturas falsas de pago móvil. El consejo
  oficial más cercano viene del Banco Central de Costa Rica para SINPE Móvil: verificar la confirmación de la
  propia institución antes de entregar el producto
  ([BCCR, CP-026-2021](https://www.bccr.fi.cr/comunicacion-y-prensa/Docs_Comunicados_Prensa/CP-BCCR-026-2021-Alerta_intentos_estafas_timo_basado_Sinpe_Movil.pdf)).

Ninguna fuente lista señales de edición a nivel de píxel. Las señales documentadas son de proceso: el pago no
aparece en la cuenta, la referencia es inválida, el comprobante trae un enlace extraño o el monto no cuadra
con el banco.

## 2. Zelle

- **No hay API pública para particulares (confirmado).** Early Warning, dueña de Zelle, dice que solo pueden
  unirse a la red instituciones financieras de EE. UU., con una relación directa o a través de revendedores
  como Alacriti, FIS, Fiserv o Jack Henry
  ([Zelle P2P Product Brief Q4-2025](https://www.earlywarning.com/sites/default/files/2025-10/Zelle-P2P-Product-Brief-Q425.pdf)).
  Las APIs de Zelle que existen son para bancos y sus integradores, como
  [Jack Henry](https://jackhenry.dev/open-api-docs/consumer-api/api-reference/v0/zelle/), o para clientes
  corporativos que envían pagos, como
  [J.P. Morgan](https://developer.payments.jpmorgan.com/docs/treasury/global-payments/capabilities/global-payments-2/zelle-disbursements/how-to/initiate-a-zelle-payment-request).
  Ninguna sirve para que un receptor particular consulte un pago entrante.
- **Desde abril de 2025 Zelle solo funciona dentro de la app de cada banco.** La app independiente cerró, según
  [ABC7](https://abc7news.com/post/zelle-app-news-person-money-transferring-service-is-shutting-down-users-can-use-own-bank/16122687/).
  Por eso la confirmación y su número tienen el formato de cada banco.
- **Número de confirmación.** No se encontró ninguna fuente primaria que defina su formato. Cada banco genera
  el suyo. Para el cotejo es un dato opaco: sirve para reclamar al banco, pero no se puede validar.
- **Qué recibe el receptor.** "The recipient receives a payment notification" y el dinero llega "directly to
  your business account in minutes" ([zelle.com/business](https://www.zelle.com/business)). No se encontró
  una fuente primaria que diga si esa notificación incluye el nombre del remitente y el memo. Lo verificable
  es la actividad Zelle del banco receptor.
- **Irreversibilidad.** "No, Zelle® payments cannot be reversed". Un pago solo se puede cancelar si el
  receptor aún no está inscrito ([zelle.com/faq](https://www.zelle.com/faq)). Un comprobante "enviado" a un
  correo no inscrito puede no llegar nunca.
- **Fraudes típicos.** Los más comunes son correos falsos "de tu banco" que dicen que el pago ya se hizo y
  capturas editadas. La recomendación constante es confirmar en la app del propio banco
  ([ABC7](https://abc7.com/zelle-app-payment-scam/11219806/),
  [Resistant AI](https://resistant.ai/blog/zelle-scams)). Ninguna de estas fuentes es de Zelle.

## 3. Binance Pay

### Identificadores

| ID | Formato documentado | Dónde aparece |
|---|---|---|
| `transactionId` | Texto. El ejemplo oficial es `M_P_71505104267788288` | Historial Pay de la API de usuario y consulta de orden de comerciante, donde se emite "once the payment is successful" ([Get Pay Trade History](https://developers.binance.com/docs/pay/rest-api/Get-Pay-Trade-History), [Query Order](https://developers.binance.com/docs/binance-pay/api-order-query-v2)) |
| `prepayId` | `string(19)`, "unique id generated by binance". Los ejemplos tienen 18 y 20 dígitos | Solo órdenes de comerciante ([Create Order v3](https://developers.binance.com/docs/binance-pay/api-order-create-v3)) |
| `merchantTradeNo` | Hasta 32 caracteres, solo letras y dígitos | Solo órdenes de comerciante |
| "Order ID" del comprobante en la app | **Sin fuente primaria.** No se pudo confirmar si es igual al `transactionId` de la API | — |

**Pay ID está en retiro.** Binance recomienda enviar por Binance ID, correo o teléfono, según su FAQ de Pay.
Este dato viene del extracto del buscador porque la página no lo mostró al consultarla. El destinatario
confiable para cotejar es el **Binance ID** de la cuenta receptora.

### Qué ve cada lado

- **Pagador.** Binance indica al receptor: "Ask for a screenshot of the payment details from the sender".
  Esos detalles están en Orders > Payment History > Details en la web, o en Pay > History en la app. Un pago
  exitoso muestra "Successful" en Status
  ([FAQ Binance](https://www.binance.com/en/support/faq/detail/528c2ea5316c4905926a0a9dcd0318c4)).
- **Receptor.** El dinero llega a la Funding Account (misma FAQ). Por API, cada registro trae `orderType`,
  `transactionId`, `transactionTime`, `amount` con signo (positivo es ingreso), `currency`, `payerInfo` y
  `receiverInfo`. En una transferencia C2C, el receptor ve el **nombre** del pagador en `payerInfo`
  ([Get Pay Trade History](https://developers.binance.com/docs/pay/rest-api/Get-Pay-Trade-History)).
  La documentación no lista un campo de nota o memo.
- **Irreversible.** "Sorry, you cannot reverse a Binance Pay transaction"
  ([FAQ Binance Pay](https://www.binance.com/en-AE/support/faq/3cd54320f57d45f6a0de711e9ee98ab0)).

### Verificar un pago entrante sin ser comerciante: sí, con límites

```
GET https://api.binance.com/sapi/v1/pay/transactions
  ?startTime=<ms>&endTime=<ms>&limit=100&timestamp=<ms>&signature=<HMAC>
Header: X-MBX-APIKEY: <key de solo lectura>
Peso: 3000 por UID. Ventana máxima de 90 días, historial de hasta 18 meses.
```

- Es un endpoint firmado de usuario, no de comerciante
  ([Get Pay Trade History](https://developers.binance.com/docs/pay/rest-api/Get-Pay-Trade-History)). Una API
  key nueva trae por defecto el permiso "Enable Reading"
  ([Quick Start](https://developers.binance.com/legacy-docs/wallet/quick-start)), así que la key no puede
  mover fondos.
- **No filtra por `transactionId`.** Solo acepta tiempo y límite. Hay que traer la ventana de la orden y
  buscar localmente por monto, moneda, `transactionTime` y nombre o Binance ID del pagador.
- El peso de 3000 consume buena parte del presupuesto de peso por minuto de la cuenta. No conviene
  consultarlo en cada visita, sino una vez por cada orden en revisión.
- **La API de comerciante no aplica sin ser comerciante.** `POST /binancepay/openapi/v2/order/query` es
  "used for merchant/partner to query order status" y solo busca órdenes creadas por el comerciante, por
  `prepayId` o `merchantTradeNo`
  ([Query Order](https://developers.binance.com/docs/binance-pay/api-order-query-v2)). No sirve para pagos
  persona a persona. Las fuentes no coinciden sobre si Binance todavía acepta comerciantes individuales
  ([FAQ oficial](https://www.binance.com/zh-TC/support/faq/7a49148912214defa816f14ee51b9f9f)).

## Tabla: campo, verificación automática y revisión humana

| Campo | ¿Se puede verificar automáticamente? | Qué debe mirar el humano |
|---|---|---|
| Monto (pago móvil) | Sí, con la API de Mercantil, BDV o BNC si la cuenta receptora es jurídica y afiliada. Si no, no | El monto del movimiento en la cuenta, no el de la captura. La IA puede editar el monto de un pago real |
| Referencia (pago móvil) | Sí, con las mismas APIs: 12 caracteres o sus últimos 4 a 6 en Mercantil. Sin API, solo se puede comprobar el formato y que no esté repetida | Que exista un movimiento con esa terminación ese día y que no se haya usado en otra orden |
| Fecha (pago móvil) | Sí. Las APIs exigen la fecha exacta | Que coincida con el día del movimiento, no solo con la captura |
| Teléfono y cédula del pagador | Sí. BDV y BNC los usan como llave | Que el pagador del movimiento coincida con lo que declaró el comprador |
| Banco de origen | Sí. BDV y BNC exigen el código de 4 dígitos | Que el banco del movimiento coincida |
| Destinatario (teléfono, cédula o cuenta propia) | Solo por OCR, comparando con los datos de la fiesta. Ya se hace | Que la captura no muestre otro beneficiario |
| Código de aprobación | No. Ninguna API lo usa como llave | Ignorarlo |
| N.º de confirmación Zelle | No. No hay API ni formato estándar | Guardarlo para reclamos. La prueba es la actividad Zelle del banco receptor: monto, nombre del remitente y memo |
| Nombre del remitente Zelle | No hay API | Que coincida con el nombre declarado en la orden |
| Memo Zelle | No hay API | Que contenga el código de la orden, si se le pidió al comprador |
| Order ID o transactionId de Binance | Parcial: la API no filtra por ID. Si el ID del comprobante resulta ser el `transactionId`, se puede cotejar contra la lista de la ventana | Que el pago esté en Pay > History con status Successful |
| Monto y moneda en Binance | Sí, con `sapi/v1/pay/transactions` y una key de solo lectura | Que sea USDT y el monto exacto |
| Nombre o Binance ID del pagador en Binance | Sí, con `payerInfo`. En C2C el receptor ve el nombre | Que coincida con lo declarado |
| Señales de edición | Solo como heurística del OCR. No hay fuente que las valide | Mirar enlaces o textos extraños y descuadres de tipografía, pero decidir siempre por el banco |

## Cinco recomendaciones para el cotejo actual

Referidas a `supabase/functions/_shared/dictamen.ts` y a la migración `20261024000000_ticketera.sql`.

1. **Pedir al comprador de pago móvil el banco de origen, el teléfono y la cédula con los que pagó.** Son las
   llaves que exigen las APIs de BDV y BNC y la de Mercantil, aunque esta última pide el teléfono y no la
   cédula. Así el humano busca el movimiento sin adivinar. Si mañana la cuenta receptora es jurídica en uno de
   esos bancos, el cotejo pasa a ser automático sin pedir datos nuevos. En Zelle, pedir el nombre exacto del
   titular de la cuenta que envía. En Binance, pedir el Binance ID o el nickname del pagador.
2. **Referencia: exigir al menos 6 caracteres y aplicar la unicidad sobre el sufijo, no sobre el texto
   tipeado.** Hoy la base acepta 4 caracteres y el `unique (tipo, referencia)` compara la referencia
   normalizada completa. Un mismo comprobante puede entrar dos veces si el comprador tipea primero los
   últimos 6 dígitos y después los 12. La propuesta es guardar los últimos 6 dígitos de la referencia leída
   por OCR y marcar como `no_coincide` cualquier orden cuya terminación ya exista. Mercantil busca con 4 a 6
   dígitos, así que 6 es el máximo que garantiza compatibilidad con su API. No conviene rechazar por largo:
   12 caracteres es la referencia interbancaria y cada banco imprime otras.
3. **Monto: en bolívares, tolerancia absoluta pequeña y nunca a favor del pagador.** Hoy un monto hasta 1 %
   menor pasa como `coincide`. Se propone que cualquier monto menor al esperado por más de Bs 1 dé
   `no_coincide`, y que un monto mayor dé `dudoso` como ahora. En USD y USDT, Zelle y Binance, la tolerancia
   debe ser ±0,01. La estafa documentada en 2026 es justamente un pago real por menos con el monto editado.
4. **Fecha: la ventana válida va desde el día de la orden hasta 1 día después, y una captura anterior a la
   orden es `dudoso`.** Hoy se aceptan capturas de hasta 3 días antes de crear la orden, lo que permite
   reutilizar una captura vieja y real. Las APIs bancarias buscan por fecha exacta. Conviene también pedir al
   OCR la hora y guardarla, porque en BNC y Mercantil ayuda a desempatar movimientos del mismo monto.
5. **Pedir un código de la orden en el concepto o memo, y automatizar Binance ya.** En Zelle, que el memo
   lleve el número de orden. El humano lo ve en la actividad de su banco y así descarta pagos de terceros
   reciclados. En Binance, una API key de solo lectura de la cuenta receptora y una llamada a
   `GET /sapi/v1/pay/transactions` por cada orden en revisión. Se busca un `amount` positivo igual al esperado
   en USDT, con `transactionTime` posterior a la creación de la orden y no asignado a otra orden. Con eso
   Binance pasa de "un humano revisa la app" a una verificación real. Antes de confiar en el ID, falta una
   prueba con un pago real que confirme si el "Order ID" del comprobante coincide con `transactionId`.

## Qué queda sin fuente primaria

- El estándar de la referencia según BCV, Suiche 7B o Conexus.
- Las etiquetas "aprobación" y "referencia" por banco en BNC, Banesco, Provincial, BDV, BFC y Ubii.
- El contenido del SMS o la notificación push al receptor de pago móvil.
- Alguna alerta de SUDEBAN sobre capturas falsas.
- La documentación oficial de las APIs de BDV y BNC. Solo hay transcripciones y código de terceros.
- El formato del número de confirmación de Zelle y el contenido de la notificación al receptor.
- La correspondencia entre el "Order ID" del comprobante de Binance y el `transactionId` de la API.
