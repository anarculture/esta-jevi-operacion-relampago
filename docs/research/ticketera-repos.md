# Ticketera: qué se puede reutilizar

Investigación del 24-oct-2026 (sábado). Fiesta el jueves 29-oct, venta de prueba el domingo 25-oct.
Datos de GitHub tomados con `gh api` ese mismo día; endpoints de tasa probados con `curl` ese día.

## Recomendación

**Construir lo propio sobre Supabase y meterle piezas sueltas; no forkear una plataforma.** Ninguna de
las cinco ticketeras revisadas cumple los requisitos que hacen distinta a esta venta: ninguna deja que el
comprador suba la captura del comprobante, ninguna verifica con IA, ninguna impone referencia única por
método y ninguna trae la tasa BCV. Para cubrir eso habría que modificar el código de un monolito
(Laravel + React, Django o Java) y además operar un servidor con Postgres, Redis y SMTP. En el plazo del
domingo eso sale más caro que escribir cinco tablas y dos Edge Functions. La más cercana es Hi.Events
(pagos offline, afiliados con `?aff=CODE`, check-in web por cámara con aviso de "already checked in"),
pero tiene un defecto para este caso: emite la entrada **antes** de recibir el pago, y la venta en puerta
(box office) es Enterprise. Lo propio se arma así: front estático en GitHub Pages (el mismo patrón vanilla
del repo), Supabase para DB, Storage y Edge Functions, `UNIQUE (metodo, referencia)` en Postgres para no
repetir comprobantes, una Edge Function que llama a Claude con visión y salida JSON por esquema, un
escáner QR en el navegador y la tasa tomada de `ve.dolarapi.com`, con otro endpoint estático de respaldo.
**Plan B**, si el domingo no llega: Hi.Events con un deploy de un clic (Railway o Render), pagos offline
y revisión 100 % manual. Así se pierden los requisitos 1 (subida), 2, 3 y 6.

## Tabla comparativa de plataformas

Leyenda: **sí** = documentado en fuente primaria; **no** = la fuente muestra que no está o no hay rastro;
**n/v** = no verificado.

| Requisito | [pretix](https://github.com/pretix/pretix) | [Hi.Events](https://github.com/HiEventsDev/Hi.Events) | [Alf.io](https://github.com/alfio-event/alf.io) | [Attendize](https://github.com/Attendize/Attendize) | [eventyay](https://github.com/fossasia/eventyay) |
|---|---|---|---|---|---|
| 1. Pago manual (transferencia) | sí, transferencia bancaria; conciliación por import de CSV/MT940 del banco [¹](https://docs.pretix.eu/guides/payment/bank-transfer/) | sí, "offline payments" con instrucciones [²](https://hi.events/docs/help-center/payments-and-billing/offline-payments) | sí, "Bank Transfer" y pago en sitio [³](https://alf.io/) | sí, "offline payments" [⁴](https://github.com/Attendize/Attendize#current-features-v2xx) | n/v (plugins de pago genéricos [⁵](https://github.com/fossasia/eventyay)) |
| 1b. Comprador sube captura | no (el modelo es import de extracto) [¹](https://docs.pretix.eu/guides/payment/bank-transfer/) | no: el componente offline solo muestra las instrucciones [⁶](https://github.com/HiEventsDev/Hi.Events/blob/develop/frontend/src/components/routes/product-widget/Payment/PaymentMethods/Offline/index.tsx); la búsqueda de código no da `payment_proof` | n/v | n/v | n/v |
| 2. Verificación con IA | no | no | no | no | no |
| 3. Referencia única por método | no (conciliar contra el banco no aplica: no hay API bancaria) | no | n/v | n/v | n/v |
| 4. QR + check-in en puerta | sí, app pretixSCAN para Android, iOS y escritorio [⁷](https://docs.pretix.eu/guides/pretixscan/) | sí, web con cámara o lector USB; un check-in por lista, repetir da "already checked in"; **solo online** [⁸](https://hi.events/docs/help-center/check-in/setting-up-check-in) | sí, app Alf.io Scan [³](https://alf.io/) ([repo](https://github.com/alfio-event/Alf.ioBackoffice)) | sí, escáner QR en navegador [⁴](https://github.com/Attendize/Attendize#current-features-v2xx) | sí, componente aparte [eventyay-checkin](https://github.com/fossasia/eventyay-checkin) |
| 5. Vendedores con enlace/código y control | n/v (hay vouchers [⁹](https://docs.pretix.eu/guides/vouchers/), sin tracking por vendedor verificado) | sí, afiliado = código, enlace `?aff=CODE`, ventas e ingresos por afiliado, ventana de 30 días en el mismo navegador; **el afiliado no tiene login** [¹⁰](https://hi.events/docs/help-center/marketing-and-promotions/affiliates) | n/v | sí, "Affiliate tracking" [⁴](https://github.com/Attendize/Attendize#current-features-v2xx) | n/v |
| 6. Tasa BCV automática | no | no (trae Open Exchange Rates, solo en modo SaaS [¹¹](https://hi.events/docs/getting-started/deploying)) | no | no | no |
| Venta en puerta ($15) | n/v | box office solo en **Enterprise** [¹²](https://github.com/HiEventsDev/Hi.Events#features); queda el alta manual de asistentes | sí, pago en sitio [³](https://alf.io/) | n/v | n/v |
| Licencia | AGPL-3.0 + términos adicionales: atribución obligatoria, sin SaaS para terceros [¹³](https://github.com/pretix/pretix/blob/master/LICENSE) | AGPL-3.0 + atribución "Powered by Hi.Events" obligatoria [¹²](https://github.com/HiEventsDev/Hi.Events#licensing) | GPL-3.0 | Attribution Assurance License, "Powered by Attendize" [¹⁴](https://github.com/Attendize/Attendize/blob/develop/LICENSE) | Apache-2.0 |
| Stack | Python/Django, Postgres, Redis [¹⁵](https://docs.pretix.eu/self-hosting/installation/general/) | Laravel 13 (PHP ≥ 8.3), React 19 SSR, Postgres, Redis, Docker [¹²](https://github.com/HiEventsDev/Hi.Events#quick-start) | Java 25, Postgres ≥ 10 [¹⁶](https://github.com/alfio-event/alf.io#prerequisites) | PHP/Laravel | Django, Celery, Redis, Postgres [⁵](https://github.com/fossasia/eventyay) |
| Estrellas / último push | 2549 / 23-oct-2026 | 4076 / 24-oct-2026 (v2.0.0 salió el 23-oct) | 1623 / 21-oct-2026 (2.0-M5-2609, sep-2026) | 4280 / 20-ago-2024 (última release v2.8.0, ene-2023) | 1715 / 24-oct-2026 |
| Esfuerzo de despliegue | medio: VPS + Docker small-scale [¹⁷](https://docs.pretix.eu/self-hosting/installation/docker_smallscale/) | bajo a medio: deploy de un clic en DigitalOcean, Render, Railway y Zeabur, o `docker compose` all-in-one [¹²](https://github.com/HiEventsDev/Hi.Events#one-click-deploy); requiere SMTP [¹¹](https://hi.events/docs/getting-started/deploying) | alto: el branch principal avisa que puede ser inestable [¹⁶](https://github.com/alfio-event/alf.io#prerequisites) | alto y con riesgo: proyecto sin releases desde 2023 | alto: muchos servicios |
| ¿Andando hoy? | sí, pero sin 1b, 2, 3 ni 6 | sí, pero sin 1b, 2, 3 ni 6 | dudoso | no recomendable | dudoso |

**Riesgos de Hi.Events (el plan B), según su propia doc** [²](https://hi.events/docs/help-center/payments-and-billing/offline-payments):
- Con pago offline, la entrada se emite y se envía por correo en el momento. El pedido queda "Awaiting
  payment" hasta que alguien lo marca como pagado.
- El check-in avisa cuando el pedido está impago, y una opción del evento decide si se le puede dar
  entrada igual. Los pedidos offline no entran en las estadísticas hasta marcarlos como pagados.
- Marcar como pagado exige el permiso "Can issue refunds".

## Piezas reutilizables

### Escaneo QR en el navegador

| Pieza | Licencia | Actividad | Nota |
|---|---|---|---|
| [zxing-js/library](https://github.com/zxing-js/library) | Apache-2.0 | push 17-oct-2026, release v0.23.0 (abr-2026) | La más viva. Es de bajo nivel: la UI de cámara la haces tú. |
| [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner) | MIT | último push 30-mar-2024 | Liviana, solo QR, con worker. Está estable, pero lleva más de dos años sin cambios. |
| [mebjas/html5-qrcode](https://github.com/mebjas/html5-qrcode) | Apache-2.0 | release v2.3.8 (abr-2023) | El README dice que está **en modo mantenimiento**: no habrá arreglos ni PRs, "Ok to use the project as is". Trae UI lista en menos de 10 líneas (`Html5QrcodeScanner`). Es la más rápida de integrar para el domingo. |

Las tres corren sin build desde un CDN, así que encajan con el `index.html` + `app.js` vanilla del repo.
La cámara pide HTTPS, y GitHub Pages ya lo sirve.

### Generación de QR

- [soldair/node-qrcode](https://github.com/soldair/node-qrcode) (MIT, 8180 estrellas, último push
  ago-2024): genera canvas, SVG o data URL en navegador y en Node, así que sirve para la página del
  ticket o para una Edge Function.
- [kozakdenys/qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (MIT, push feb-2026): QR
  con logo y estilos, solo si quieres el QR con marca.
- Contenido del QR: un token aleatorio largo (UUID v4) que se busca en la DB. No hace falta firmarlo,
  porque el control real es la fila `checked_in_at` en Postgres. Un
  `UPDATE ... SET checked_in_at = now() WHERE token = $1 AND checked_in_at IS NULL RETURNING *` es
  atómico y bloquea el reingreso doble aunque dos porteros escaneen a la vez.

### Plantillas Supabase de ticketing/check-in

**No encontré ninguna reutilizable.** `gh search repos` con "supabase ticketing", "supabase event
tickets qr" y "supabase check-in qr" solo devuelve repos de 0 a 2 estrellas, sin licencia o de soporte
técnico (tickets de helpdesk), como
[bladexr8/supabase-ticketing-system](https://github.com/bladexr8/supabase-ticketing-system). Las piezas
de Supabase que sí aplican, con doc oficial:
- Storage con políticas RLS para el bucket de comprobantes (que el comprador solo pueda subir y que
  solo el operador pueda leer): [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
- Edge Functions para la llamada a Claude, de modo que la API key nunca llegue al navegador:
  [Edge Functions](https://supabase.com/docs/guides/functions).
- Referencia única: `UNIQUE (metodo, referencia_normalizada)` en Postgres
  ([constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)). La referencia se
  normaliza antes de insertar (solo dígitos para pago móvil, mayúsculas sin espacios para el resto).
- Vendedores: una tabla `vendedores (codigo UNIQUE, nombre)` y una FK en `ordenes`. El enlace es
  `?v=CODIGO`. Con una vista `ventas_por_vendedor` (count, suma USD, suma Bs) queda el control interno.
  Es el mismo modelo de afiliados de Hi.Events [¹⁰](https://hi.events/docs/help-center/marketing-and-promotions/affiliates),
  y la diferencia es que aquí el vendedor puede tener login si lo necesitas.

### Tasa BCV

Fuente primaria: [bcv.org.ve](https://www.bcv.org.ve/). El 24-oct publicaba `USD 887,30200000` con
"Fecha Valor: Martes, 27 Octubre 2026", es decir, el BCV publica por adelantado la tasa que rige desde
la fecha valor. Su certificado TLS **no valida** con la cadena estándar (`curl` sin `-k` falla con
"unable to get local issuer certificate"), así que hacerle scraping directo obliga a desactivar la
verificación o a cargar el intermedio a mano.

| Endpoint | Repo / licencia | Probado el 24-oct | CORS | Nota |
|---|---|---|---|---|
| `https://ve.dolarapi.com/v1/dolares/oficial` | [enzonotario/dolarapi.com](https://github.com/enzonotario/dolarapi.com), MIT, 751 estrellas, push 24-oct-2026 | `promedio: 886.2271`, `fechaActualizacion: 2026-10-23` | `*` | La más mantenida y usada. Da la tasa **vigente**, no la publicada por adelantado. También trae `paralelo`. |
| `https://bcv.today/api/v1/rate.json` (+ `status.json`) | [grupoclip/bcv-api](https://github.com/grupoclip/bcv-api), Apache-2.0, 7 estrellas | `USD 886.2271`, `effective_date 2026-10-23` | `*` | JSON estático en GitHub Pages. `status.json` da la frescura y la fuente. Rellena fines de semana y feriados con la última tasa vigente. |
| `https://tonydacamaram-web.github.io/bcv-tasa/latest.json` | [tonydacamaram-web/bcv-tasa](https://github.com/tonydacamaram-web/bcv-tasa), sin licencia, 0 estrellas, creado 3-oct-2026 | `usd 887.302`, `fecha_valor 2026-10-27`, más `anterior` (886.2271) | `*` | Separa la tasa vigente (`anterior`) de la publicada por adelantado. Útil, pero es muy nuevo y sin licencia: úsalo solo como referencia. |
| `https://chitty400.github.io/chitty-bcv-api/latest.json` | [Chitty400/chitty-bcv-api](https://github.com/Chitty400/chitty-bcv-api), sin licencia, 10 estrellas | no probado | n/v | Trae también la tasa P2P de Binance. |
| [rafnixg/bcv-api](https://github.com/rafnixg/bcv-api) | GPL-3.0, 30 estrellas | — | — | Su README dice: "This API is outdated and the endpoints are down". **Descartar.** |

**Fiabilidad:** todas son no oficiales y dependen del scraping de bcv.org.ve. Recomendación: una Edge
Function lee `ve.dolarapi.com` con `bcv.today` de respaldo y guarda `(fecha_valor, usd, fuente)` en una
tabla `tasas`. Cada orden congela la tasa que usó, y el operador puede sobrescribirla. Hay que decidir
qué tasa aplica a una venta del jueves 29: la vigente ese día. Ojo, porque bcv.org.ve ya muestra la del
martes 27 desde el viernes 23.

### Verificación de comprobantes con IA

**No existe un repo reutilizable que valide capturas de pago móvil, Zelle o Binance Pay.** Las
búsquedas con "pago movil comprobante", "pago movil verificacion", "zelle receipt verification",
"payment receipt verification ocr", "comprobante de pago ia" y "binance pay receipt" dieron cero
resultados. El único resultado cercano,
[PayShield](https://github.com/celestial-cyber/PayShield-Fake-Payment-Screenshot-Detection-System), tiene
0 estrellas, se creó y se abandonó el mismo día (11-sep-2026) y **no tiene licencia**, así que
legalmente no se puede reutilizar. Sirve solo como lista de ideas (veredictos Genuine / Manipulated /
Reconstructed / Inconclusive).

**Límite clave de la doc oficial de Claude:** la sección
[Vision > Limitations](https://platform.claude.com/docs/en/build-with-claude/vision) dice que Claude "cannot
determine whether an image is AI-generated" y "Do not rely on it to detect fake or synthetic images", y
que comete errores con imágenes de baja calidad, rotadas o de menos de 200 px. Por eso la IA sirve para
**extraer campos y comprobar coherencia**, no para peritaje forense. La autenticidad real descansa en
tres cosas: la referencia única, que monto, fecha y destinatario cuadren con lo esperado, y que el
operador vea el dinero en su propia cuenta cuando el caso es dudoso.

Doc para implementarlo:
- Visión: [platform.claude.com/docs/en/build-with-claude/vision](https://platform.claude.com/docs/en/build-with-claude/vision).
  El máximo es 10 MB por imagen en base64 en la Claude API, y una petición completa llega hasta 32 MB.
- Salida estructurada: [platform.claude.com/docs/en/build-with-claude/structured-outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
  Usa `output_config.format = {type: "json_schema", schema: ...}`; la doc dice que ya no hacen falta
  headers beta.

Parámetros verificables por método:

| Método | Campos que debe mostrar la captura | Qué se puede comprobar sin el banco | Fuente |
|---|---|---|---|
| Pago móvil (Bs) | banco emisor, banco destino, teléfono destino, cédula/RIF destino, monto en Bs, fecha y hora, número de referencia (algunos bancos también muestran concepto y código autorizador) | teléfono, cédula y banco destino = los de Mau; monto en Bs = USD × tasa congelada (con tolerancia por redondeo); fecha dentro de la ventana de la orden; referencia no usada antes | datos del beneficiario: [guía BDV (libero.pe)](https://libero.pe/ocio/2025/01/25/como-activar-pago-movil-banco-venezuela-guia-facil-rapida-ve-364125), [finanzasdigital](https://finanzasdigital.com/como-hacer-un-pago-movil-pasos-y-comisiones/); ejemplo de comprobante BNC con referencia, fecha, concepto y autorizador: [PDF](https://lmportal.lamundialdeseguros.com/backend/SysIP-backend/public/documents/2026-03-05-4601912026030418042800.pdf) |
| Zelle (USD) | nombre del destinatario inscrito, email o teléfono US destino, monto, fecha, número de confirmación (su formato depende del banco del pagador) | email o teléfono destino = el de Mau; monto = $10; confirmación no usada antes | Zelle se envía con el email o el teléfono US del destinatario: [Zelle FAQ](https://www.zellepay.com/faq) |
| Binance Pay (USDT) | Order ID, destinatario (Binance ID, email o teléfono), monto y moneda, fecha y hora | Order ID con el formato esperado y no usado antes; destinatario = cuenta de Mau; monto | según el FAQ de Binance (no pude abrirlo con `curl`; la página se renderiza con JS), un Order ID de Binance Pay empieza en 1 y tiene 18 dígitos, y si empieza en 5 es P2P: [FAQ](https://www.binance.com/en/support/faq/why-haven-t-i-received-the-cryptocurrency-from-binance-pay-528c2ea5316c4905926a0a9dcd0318c4). Binance retira el Pay ID desde el 6-ago-2024: [FAQ Pay](https://www.binance.com/en/support/faq/binance-pay-frequently-asked-questions-3cd54320f57d45f6a0de711e9ee98ab0) |

**Señales de edición** que se pueden pedir al modelo como campos del esquema, con veredicto
`ok | dudoso | rechazar` y motivo: tipografía o alineación inconsistentes en el monto o la fecha; hora
de la barra de estado del teléfono incoherente con la hora de la transacción; captura recortada que
oculta el destinatario; resolución muy baja. Según la doc, ninguna es concluyente, así que todo lo que no
sea `ok` va a la cola del operador.

**Binance tiene un camino mejor que la captura (no probado):** la API de Binance tiene
[Get Pay Trade History](https://developers.binance.com/docs/pay/rest-api), que devuelve los pagos
recibidos de los últimos 90 días con transaction ID, monto y pagador. Con una API key de solo lectura
de la cuenta de Mau, la Edge Function podría confirmar el Order ID contra la fuente real. Es el único de
los tres métodos que admite conciliación automática real.

## Lo que no encontré o no pude verificar

- Si pretix, Alf.io, Attendize o eventyay permiten que el comprador suba un comprobante: no vi esa
  función en sus READMEs ni en su doc. No revisé sus plugins de terceros.
- Tracking por vendedor en pretix, Alf.io y eventyay: no verificado.
- Formato y longitud del número de referencia de pago móvil por banco: no encontré una fuente oficial
  (ni Sudeban ni bancos) que lo fije. No conviene validar la longitud hasta ver capturas reales de los
  bancos de los compradores.
- Formato del número de confirmación de Zelle: depende de cada banco, y no hallé una especificación.
- Las dos páginas de Binance se citan por resultado de búsqueda; no pude cargarlas directamente.
- El endpoint Get Pay Trade History de Binance no lo probé con una key real.
- Hi.Events: no probé el deploy de un clic ni el escáner en un teléfono real.
- La disponibilidad futura de `ve.dolarapi.com` y `bcv.today`: no tienen SLA. Por eso conviene un
  respaldo y una tasa manual.
