# 02: Datos del pagador

**Parent:** issue https://github.com/anarculture/sindicato-baba/issues/6 (punto 2).

**What to build:** al comprar, el comprador dice desde dónde pagó: en pago móvil el banco de
origen, el teléfono y la cédula con los que pagó; en Zelle el nombre del titular que envía; en
Binance su Binance ID o nickname. Esos datos quedan en la orden y Mau los ve en el panel junto a
la referencia, porque son las llaves con las que busca el pago en la app del banco. La IA también
lee al emisor en la captura y, si no cuadra con lo declarado, el dictamen lo anota como duda.

Decisiones congeladas:

- Columna `pagador jsonb` en `ordenes` (migración nueva), con claves por tipo: pago móvil
  `{ banco, telefono, cedula }`, Zelle `{ titular }`, Binance `{ id }`. `crear_orden` gana un
  parámetro `p_pagador jsonb default null`; valida que estén las claves del tipo (texto entre 2 y
  80, teléfono venezolano normalizado con `normalizar_whatsapp`, cédula con la misma regla que la
  del comprador) y rechaza con `pagador_invalido`. Los valores se guardan normalizados.
- Banco de origen: lista fija en el formulario (BNC, Mercantil, Banesco, Provincial, Venezuela,
  BFC, Bancamiga, Banplus, Otro) que se guarda como texto; sin tabla de bancos.
- Formulario: los campos del pagador aparecen debajo del método elegido y cambian con él; entran
  al borrador (`ticketera-borrador`) y a `validar` con las mismas reglas que el SQL. Copy en
  español neutro, tono de `DESIGN.md`; ningún dato del pagador es obligatorio en Binance salvo el
  ID o nickname.
- OCR: el esquema de `revisar` gana `senderName`, `senderPhone`, `senderId`, `senderBank`
  (strings; "" si no se leen) y el prompt los pide ("Desde", "Origen", "Ordenante", "De").
  `dictamen.ts` compara lo leído con `pagador` (últimos 10 del teléfono, dígitos de la cédula,
  primer nombre del titular, ID de Binance): si se leyó algo y no coincide, duda "el pagador leído
  no es el declarado"; si no se leyó nada, no se anota. Nunca pasa a `malos`.
- `admin` (`cola`) devuelve `pagador`; `admin.html` lo muestra en la línea de la referencia
  ("desde 0414…1234 · V12345678 · Mercantil") y el buscador también busca por teléfono y cédula
  del pagador. `ver_orden` (anon) no devuelve `pagador`.
- `pagador` no entra en `ver_entrada`, el portero ni los avisos.
- La venta manual (`supabase/manual/plantilla-venta-manual.sql`) deja `pagador` en `null`.

**Blocked by:** 01

**Status:** done (27-oct-2026, rama `cotejo`, stack local `supabase_db_cotejo` en 57321)

- [x] `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con los asserts: pago móvil sin cédula del pagador → `pagador_invalido`; pago móvil completo guarda `pagador->>'telefono'` como `58…`; Zelle con `titular` pasa; `ver_orden` como anon no trae `pagador`. Evidencia: `OK ticketera.sql: 29 órdenes creadas`. Falibilidad: `crear_orden` sin el chequeo de cédula del pagador → `ERROR: pagador inválido aceptado: pm sin cédula`. También: teléfono extranjero, banco vacío, Zelle sin titular, sin `p_pagador` y `p_pagador` no objeto → `pagador_invalido`; claves de más se descartan; `ver_entrada` y `lista_portero` no traen la cédula ni el banco del pagador.
- [x] `deno test supabase/functions/` sale 0 con dos casos nuevos en `dictamen.test.ts`: pagador leído distinto del declarado → `dudoso` con "el pagador leído"; sin lectura del emisor → sin esa duda. Evidencia: `ok | 14 passed | 0 failed | 1 ignored`. Falibilidad: sin el `dudas.push` del pagador → `FAILED | 13 passed | 1 failed`.
- [x] `node ticketera/tests/ux.mjs` sale 0 con los casos: al elegir pago móvil aparecen banco, teléfono y cédula del pagador y `crear_orden` recibe `p_pagador` con las tres claves; al elegir Zelle solo aparece titular; el panel muestra "desde" con los datos y el buscador encuentra la orden por la cédula del pagador. Evidencia: `ok  compra: pago móvil pide banco, teléfono y cédula del pagador; p_pagador con las tres claves; Zelle solo titular` · `ok  admin: 'desde' con los datos del pagador; el buscador encuentra por cédula y teléfono del pagador` · `OK ux.mjs`.
- [x] `node supabase/tests/flujo.mjs <imagen.png>`, `auto-aprobar.mjs`, `avisos.mjs`, `portero.mjs` siguen saliendo 0 (sus llamadas a `crear_orden` pasan `p_pagador` válido). Evidencia: `OK flujo: orden #59 aprobada, 2 entradas` (el `ocr` guardado trae `senderName`, `senderPhone`, `senderId`, `senderBank` y `pagador` quedó `{"banco": "Mercantil", "cedula": "V9876543", "telefono": "584147654321"}`) · `OK auto-aprobar.mjs` · `OK avisos.mjs · orden #55` · `OK portero: orden #57, 8 ingresadas de 36 aprobadas`. `avisos.mjs` y `portero.mjs` crean sus órdenes por SQL, no por `crear_orden`.

Decisiones de implementación: los campos del pagador van en el paso 3 ("Reporta tu pago"), debajo
de la captura, y cambian con el método elegido; preguntar desde dónde pagó antes de pagar no
tiene sentido. El panel muestra el teléfono del pagador completo en formato local (04147654321),
no enmascarado: es la llave con la que Mau busca el pago, y el panel ya muestra completo el del
comprador.

Autocrítica: `p_pagador` es obligatorio. Entre `db push` y la publicación de Pages, la página vieja
no lo manda y toda compra falla con `pagador_invalido` (va al ticket 04, ventana acordada con Mau).
El cotejo del emisor solo compara lecturas completas: un teléfono enmascarado en el comprobante
no genera duda.

Revisión (security-review sin hallazgos; `pagador` solo sale por `admin`). Corregidos de los revisores
Sonnet: `p_pagador` con valores no texto (`{"banco": 12}`) se aceptaba, ahora `pagador_invalido`
(assert nuevo, rojo sin la guarda); la rama Binance gana casos SQL; el cotejo ya no duda con
lecturas enmascaradas de cédula, nombre o ID, acepta el RIF con dígito verificador y compara el
titular por palabras completas de 3 o más letras ("Ana" ya no coincide con "Mariana"); el formulario
cuenta caracteres como el SQL y valida el ID para cualquier método que no sea pago móvil ni Zelle;
el panel busca también el teléfono del comprador en formato local; caso XSS del pagador en `ux.mjs`
(rojo sin `esc()`).
