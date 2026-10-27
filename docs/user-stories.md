# User stories — ticketera de la fiesta del jueves 29-oct-2026

Borrador del 24-oct-2026. Hay cuatro roles: comprador, administrador (Mau), vendedor y portero.
Las prioridades van atadas a dos fechas: la venta de prueba del domingo 25 con el grupo
cercano y la fiesta del jueves 29.

## Decisiones ya tomadas

- Todo pago cae a cuentas personales de Mau. No hay API bancaria, así que nada se
  verifica contra el banco.
- Los métodos son pago móvil (Bs), Binance Pay y Zelle. Las tarifas son $10 anticipada
  y $15 en puerta.
- Pago móvil convierte con la tasa BCV automática. Las cuentas de destino son BNC y
  Ubii Pagos.
- ~~Habrá referidos. Quien vende 3 entradas con su código recupera la suya, y por las
  siguientes recibe un % en consumo.~~ Decisión del 27-oct: sin alicientes por ahora; los
  referidos y sus recompensas (historias 8 a 11c) quedan fuera de alcance.
- El comprobante que vale es el que emite la plataforma con los datos de la compra. La
  captura del comprador es solo evidencia.
- Preventa boca a boca hasta el lunes 26.

## P0 — domingo 25 (venta de prueba)

1. **Comprador · comprar.** Como comprador, elijo cantidad y método y veo el monto en USD,
   o en Bs con la tasa del día. Veo los datos de la cuenta de destino de ese método.
2. **Comprador · reportar pago.** Subo la captura y la referencia, con nombre, cédula y un
   WhatsApp por entrada (el primero es el mío). Recibo un número de orden y el estado «en
   revisión». *Desde el 27-oct: un WhatsApp por entrada (issue #5).*
   También desde el 27-oct (issues #6 y #7): al elegir la captura se lee sola y precarga la
   referencia (se puede corregir; si la lectura falla, se teclea); la referencia lleva al menos 6
   caracteres; y declaro desde dónde pagué (pago móvil: banco, teléfono y cédula; Zelle: titular;
   Binance: ID), datos que solo ve el administrador. Mientras la IA lee la captura, la vista
   previa late con borde verde. En pago móvil, la casilla «Pagué yo» copia mi cédula y mi
   teléfono del pago móvil a los datos del comprador.
3. **Sistema · referencia única.** Una referencia ya usada en el mismo método se
   rechaza al enviarse, para que un comprobante no pague dos veces. *Desde el 27-oct (issue #6):
   la unicidad es por terminación de 6 caracteres, no por la referencia completa.*
4. **IA · revisar comprobante.** Un modelo de visión lee la captura y extrae método,
   monto, fecha, referencia y destinatario. Los compara con la orden y con los
   parámetros de cada método, marca señales de edición y deja un dictamen: `coincide`,
   `dudoso` o `no coincide`, con el motivo. *Desde el 27-oct: también lee la hora y el emisor
   (nombre, teléfono, cédula o ID, banco); si el emisor leído no es el declarado, es una duda. La
   lectura se hace al elegir la captura y la revisión de la orden la reutiliza.*
5. **Admin · conciliar.** Como Mau, veo la cola de órdenes con el dictamen de la IA y la
   captura al lado. Apruebo o rechazo cada una tras mirarla en mi app del banco. Desde el 27-oct,
   un dictamen `coincide` aprueba solo (una terminación ya vista en otra orden da `no coincide`; interruptor
   `config.auto_aprobar`); `dudoso` y `no coincide` esperan aquí.
6. **Sistema · emitir entrada.** Al aprobar, cada entrada recibe un QR único firmado y
   el comprador obtiene un enlace a su comprobante con sus QR.

## P1 — antes del jueves 29

7. **Portero · check-in.** Escaneo el QR con el teléfono. La pantalla dice válida,
   ya usada (con la hora) o inválida, y marca el ingreso. Si no hay internet, existe una
   lista de respaldo descargada. *Hecho (27-oct): `ticketera/portero.html`, clave propia,
   deshacer en 5 min.*
7a. **Comprador · una entrada por WhatsApp.** Cada entrada de mi orden lleva el WhatsApp de
    quien va a usarla; en la página de la orden y en el panel el número se ve enmascarado
    (solo los 4 últimos dígitos). *Hecho (27-oct, issue #5).*
7b. **Sistema · aviso al aprobarse.** Al aprobarse la orden, cada entrada recibe en su WhatsApp
    un mensaje con el enlace a su QR, enviado desde el número de vytas (nunca desde el de
    Mau), con el texto armado por el servidor. Las entradas anteriores al cambio no reciben
    aviso. *Hecho (27-oct): función `avisos`, cron `avisos-entradas` en `aios-vm`.*
7c. **Admin · estado del aviso y reenvío.** Como Mau, veo por entrada si el aviso salió, a qué
    hora o con qué error, y puedo reenviarlo corrigiendo el número. *Hecho (27-oct):
    `admin.html`, acción `reenviar_aviso`.*
*Historias 8 a 11c: fuera de alcance desde el 27-oct (sin vendedores, referidos ni recompensas para esta fiesta).*

8. **Vendedor · su enlace.** Como vendedor, tengo un enlace o código propio, y las
   órdenes que entran por él quedan a mi nombre.
9. **Vendedor · venta en mano.** Registro una venta que cobré yo (efectivo o a mi
   cuenta) con su comprobante, y entra a la misma cola de conciliación.
10. **Admin · control por vendedor.** Veo por vendedor las entradas vendidas, cuánto se
    cobró, por qué método y lo que falta conciliar.
11a. **Comprador · código de referido.** Al aprobarse mi compra recibo un código propio
    para compartir. Veo cuántas entradas se vendieron con él y qué me falta para ganar.
11b. **Sistema · premio de referido.** Con 3 compras aprobadas con mi código, mi entrada
    queda como recuperada. Cada compra aprobada siguiente me suma el % acordado como
    crédito de consumo, que se canjea en la fiesta mostrando mi QR.
11c. **Admin · costo de referidos.** Veo cuánto suman las entradas recuperadas y el
    crédito de consumo, y su efecto en el saldo previsto.
11. **Admin · tarifa en puerta.** El jueves la tarifa pasa a $15 y el portero puede
    vender en puerta con el mismo flujo.

## P2 — después del evento

12. **Admin · cierre.** Exporto ventas, ingresos y check-ins a CSV, que cuadran con la
    caja real de la plataforma de PM (`index.html`).

## Fuera de alcance

Pagos automáticos con pasarela, reembolsos en la plataforma, asientos numerados, varios
eventos a la vez y cuentas de comprador con contraseña.

## Preguntas abiertas

- ¿Cuántas entradas vende como máximo un solo comprador? ¿Hay aforo tope?
- ~~Referidos: ¿la entrada recuperada se devuelve en dinero o en consumo? ¿De cuánto es el
  %? ¿El crédito de consumo sale de nuestro 50 % del patrocinio o lo pagamos al local?
  ¿Cuentan las compras en puerta del jueves?~~ Cerrada el 27-oct: sin alicientes por ahora.
- ¿Qué datos de destino se publican: teléfono y cédula del pago móvil en BNC y en Ubii,
  ID de Binance, correo o teléfono de Zelle?
- ~~¿El dictamen `coincide` basta para que tú apruebes con un clic, o siempre revisas el
  banco?~~ Resuelta el 27-oct: basta, y aprueba solo (ver historia 5).
