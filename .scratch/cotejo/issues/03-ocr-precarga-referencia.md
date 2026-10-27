# 03: El OCR precarga la referencia al subir la captura (y lee la hora)

**Parent:** issue https://github.com/anarculture/sindicato-baba/issues/7 completo, más el punto 5
del https://github.com/anarculture/sindicato-baba/issues/6 (hora de la transacción).

**What to build:** el comprador elige la captura y, mientras termina de llenar el formulario, la
página ya la subió y la leyó: el campo de referencia aparece lleno (editable) y debajo una línea
"Leímos: Bs 9.930,88 · ref 61540227 · 27/10 21:03". En Zelle también se precarga el nombre si
estaba vacío. Si la captura es de otro método que el elegido o el monto leído no es el de la
orden, un aviso lo dice antes de enviar, sin bloquear. Al registrar la orden, `revisar` reutiliza
esa lectura en vez de llamar al OCR otra vez. Cédula y WhatsApp siguen tecleados.

Decisiones congeladas:

- Edge Function nueva `lectura` (`verify_jwt = false` en `config.toml`, como las demás): recibe
  `{ path }` de una captura ya subida al bucket `capturas`, corre el mismo OCR que `revisar` y
  guarda el resultado en la tabla nueva `lecturas (path text primary key, ocr jsonb, ip text,
  creada_en timestamptz default now())`. Responde el `ocr` sin `recipientPhone` ni `recipientId`
  (son datos de la cuenta de destino, no del comprador). Si `path` ya tiene lectura, devuelve la
  guardada sin volver al OCR.
- El OCR (prompt, `FIELDS`, `SCHEMA`, `leer`) se mueve de `revisar/index.ts` a
  `_shared/ocr.ts` y las dos funciones lo importan. El esquema gana `transactionTime` (HH:MM
  local impreso en el comprobante, "" si no está); `Ocr` en `dictamen.ts` lo incluye como opcional
  y no lo coteja todavía (se guarda para desempatar movimientos del mismo monto).
- Rate limit en `lectura`: máximo 10 lecturas por IP (`x-forwarded-for`, primer valor) en la última
  hora, contadas sobre `lecturas`; de más, 429 `{ error: "demasiadas_lecturas" }`. Sin IP legible,
  se cuenta bajo "desconocida".
- `revisar`: si existe `lecturas.ocr` para `o.captura`, lo usa; si no, llama al OCR como hoy. En
  ambos casos guarda `ocr` en la orden como hasta ahora. El resto del flujo (dictamen, sufijo,
  auto-aprobar) no cambia.
- Formulario: al elegir la captura (`change`), tras la vista previa, sube con `subirCaptura` y
  llama `lectura`; muestra "Leyendo el comprobante…" y luego la línea "Leímos: …" (monto con
  moneda según `documentType`, referencia, fecha y hora si las hay). Precarga `referencia` solo si
  el campo está vacío o si su valor es el precargado anterior (una referencia que el comprador ya
  escribió a mano no se pisa); en Zelle precarga `nombre` con `senderName` si está vacío. La
  `subida` existente se reutiliza en el envío (misma captura no se sube dos veces). Si `lectura`
  falla o da 429, la línea dice "No pudimos leer la captura; escribe la referencia" y todo sigue
  como hoy.
- Avisos no bloqueantes bajo la línea "Leímos": "El comprobante parece de {método} y elegiste
  {método}" y "El monto leído ({x}) no es el de la orden ({y})", con la misma tolerancia que
  `dictamen.ts` (Bs 1 / $0,01). Se recalculan al cambiar método o cantidad.
- Copy del `hint` de la referencia: "La leemos de la captura; revisa que sea la de tu pago."
- `lecturas` no tiene políticas para `anon`; solo service role (la función) la toca. Las
  capturas huérfanas quedan como hoy.
- Tests: Deno para `_shared/ocr.ts` (el esquema contiene `transactionTime` y los campos del
  emisor) y para el recorte de la respuesta de `lectura`; HTTP nuevo `supabase/tests/lectura.mjs`
  (sube el recibo sintético, llama `lectura` dos veces y comprueba que la segunda no llama al
  OCR: misma `creada_en`; 11 llamadas desde la misma IP → 429; luego `crear_orden` + `revisar`
  y la orden queda con el mismo `ocr`); `ux.mjs` con el `rpc`/`funcion` interceptado como en los
  demás casos (precarga, línea "Leímos", aviso de método, no pisa una referencia tecleada,
  fallo de `lectura` deja el formulario usable).

**Blocked by:** 02

**Status:** done (27-oct-2026, rama `cotejo`, stack local `supabase_db_cotejo` en 57321)

- [x] `API=… DB_CONTAINER=… node supabase/tests/lectura.mjs` sale 0: segunda llamada con el mismo `path` devuelve la misma `creada_en`; la respuesta no trae `recipientPhone` ni `recipientId`; la llamada 11 desde la misma IP responde 429; tras `crear_orden` y `revisar`, `ordenes.ocr` es igual a `lecturas.ocr` y el OCR se llamó una sola vez (contador en el test por `creada_en` o por log). Evidencia: `ok  lectura: ref 000071239946, hora 22:41; la segunda devuelve la guardada` · `ok  la lectura 11 de una IP en una hora responde 429` · `ok  revisar reutilizó la lectura` · `OK lectura.mjs`. El test marca la lectura guardada y exige la marca en `ordenes.ocr`; con `revisar` del 02 falla con `revisar volvió a llamar al OCR en vez de usar la lectura`. Las 10 lecturas previas de la IP se siembran por SQL para no pagar 10 OCR.
- [x] `node ticketera/tests/ux.mjs` sale 0 con los casos: elegir captura → `lectura` recibe el `path` subido, `referencia` queda con el valor leído y aparece "Leímos:"; con método Zelle y lectura `pago_movil` aparece el aviso de método; referencia tecleada antes de la lectura no cambia; `lectura` con error deja enviar. Evidencia: `ok  lectura: elegir la captura la sube, la lee y precarga la referencia con 'Leímos'; avisa el monto; no se sube dos veces` · `ok  lectura: Zelle con comprobante de pago móvil avisa el método y precarga el nombre; no pisa la referencia tecleada` · `ok  lectura: si falla (429) avisa y el formulario se envía igual` · `OK ux.mjs`.
- [x] `deno test supabase/functions/` sale 0 e incluye un test de que `SCHEMA.required` contiene `transactionTime`. Evidencia: `ok | 17 passed | 0 failed | 1 ignored` (`el esquema pide la hora y los datos del emisor`, `lectura: la respuesta no trae los datos de la cuenta de destino`).
- [x] `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con el assert: `set role anon; select * from lecturas` lanza `insufficient_privilege` (o `permission denied`). Evidencia: `OK ticketera.sql: 48 órdenes creadas`; con `grant select on lecturas to anon` falla con `ERROR: anon puede leer lecturas`. También: anon no ejecuta `reservar_lectura`; una lectura por path, 10 por IP y 200 en total por hora.
- [x] `node supabase/tests/flujo.mjs <imagen.png>`, `auto-aprobar.mjs`, `avisos.mjs`, `portero.mjs` siguen saliendo 0. Evidencia: `OK flujo: orden #110 aprobada, 2 entradas` · `OK auto-aprobar.mjs` · `OK avisos.mjs · orden #116` · `OK portero: orden #118, 14 ingresadas de 62 aprobadas`. Smoke en 8793: 200 con "Tu WhatsApp" y "Leímos".

Decisiones de implementación:
- El límite vive en `reservar_lectura` (SQL, con candado): reserva el path antes de gastar OCR, así
  dos pedidos simultáneos no pasan el tope y una lectura fallida cuenta igual. Además del tope por
  IP hay un tope total de 200 por hora: el primer valor de `x-forwarded-for` lo puede escribir el
  cliente, y el tope total acota el gasto aunque alguien rote la IP.
- La captura va antes que la referencia en el formulario: al elegirla se lee y llena el campo de abajo.
- El hint del ticket 03 reemplaza al del 01 ("al menos los últimos 6"); la regla de 6 sigue en
  `validar`, en `crear_orden` y en el mensaje de error.
- `serve` pasa el `Request` al handler para leer la IP; las demás funciones no cambian.
- `OCR_MODEL` se lee al llamar al OCR y no al importar `ocr.ts`: `deno test` corre sin `--allow-env`.

Autocrítica: una lectura que falló deja el path en `pendiente` (409) para siempre; el comprador ve
"No pudimos leer la captura" y teclea, y `revisar` vuelve a leer al registrar la orden. Las capturas
que se suben al elegirlas y no terminan en compra quedan huérfanas en el bucket (ya pasaba).

Revisión (security-review sin hallazgos; la IP de `x-forwarded-for` se puede falsificar y el tope total
acota el gasto). Corregidos de los revisores Sonnet:
- `lectura` respondía `editSignals`, `confidence` y `recipientName`: servía para probar falsificaciones
  hasta que salieran limpias. Ahora lista blanca de lo que pinta el formulario (`paraComprador`);
  el test Deno falla con la lista negra vieja.
- Una reserva sin OCR quedaba `pendiente` para siempre: `reservar_lectura` libera las de más de 2
  minutos (el OCR corta a los 90 s) y borra las lecturas de más de un día. IP recortada a 64.
  `grant` explícitos a `service_role`. Tests SQL de bordes (10/11 por IP, 200/201 total, ventana de
  una hora, liberación y borrado), cada uno rojo con su regla rota.
- La IP sale primero de `cf-connecting-ip` y luego del primer valor de `x-forwarded-for`.
- El OCR fuera del esquema falla (502 / dudoso) en vez de guardarse; cuerpo de `lectura` tope 1 KB;
  si no se puede guardar la lectura, el comprador la recibe igual.
- Formulario: la referencia precargada de una captura anterior se borra al elegir otra; `precargada`
  va en el borrador; una lectura tardía no reescribe el borrador después de enviar; el envío espera la
  lectura en curso (hasta 20 s) para que `revisar` no pague otro OCR; el error real de la subida se
  muestra en la captura; la línea y los avisos solo se reescriben si cambian (aria-live); lo leído se
  recorta a 80 y nunca entra como HTML (caso XSS en `ux.mjs`).
