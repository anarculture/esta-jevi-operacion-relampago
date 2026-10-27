# 01: Unicidad por sufijo de la referencia

**Parent:** issue https://github.com/anarculture/sindicato-baba/issues/6 (punto 1), sobre
`docs/research/autenticidad-comprobantes.md` (rec. 2).

**What to build:** una misma captura de pago ya no puede convertirse en dos órdenes por tipear
la referencia con un cero o un dígito de más. El comprador tiene que escribir al menos los
últimos 6 caracteres de la referencia; si otra orden del mismo método termina en esos mismos 6,
el registro falla con "esa referencia ya se usó" antes de subir nada. Y cuando la IA lee la
captura, `revisar` guarda la terminación leída y da `no_coincide` si esa terminación ya está en
otra orden, aunque el comprador haya tipeado algo distinto.

Decisiones congeladas:

- Migración nueva: columna generada `sufijo text generated always as (right(referencia, 6))
  stored` en `ordenes` y `unique (tipo, sufijo)`; `unique (tipo, referencia)` se mantiene. Antes
  del `unique`, la migración comprueba con un `do $$ … assert` que no hay duplicados en
  producción (hoy hay 3 órdenes reales; si los hubiera, la migración falla y se decide a mano).
- `crear_orden`: `length(v_ref) < 6` → `referencia_invalida` (hoy 4). La `unique_violation` sigue
  saliendo como `referencia_usada`. Firma sin cambios.
- Columna `ocr_sufijo text` en `ordenes`, que `revisar` llena con `right(normRef(ocr.reference), 6)`
  cuando la lectura trae referencia. Índice simple `(tipo, ocr_sufijo)`.
- En `revisar`, antes de `dictaminar`: si `ocr_sufijo` existe en otra orden del mismo `tipo` (por
  `sufijo` o por `ocr_sufijo`), el dictamen es `no_coincide` con motivo "la referencia leída
  (…NNNNNN) ya está en la orden #M". Esa comprobación reemplaza a `capturaDeUnaSolaOrden`, que se
  elimina: con sufijo único y 6 mínimos, la guarda por `like` sobra.
- `dictamen.ts`: la rama "referencia tipeada corta (<6)" desaparece porque `crear_orden` ya no la
  deja pasar; el resto de la regla por sufijo queda igual. `normRef` sigue siendo la fuente única
  junto a `normalizar_referencia`.
- Formulario (`ticketera/index.html`, `validar`) exige 6 caracteres alfanuméricos tras
  normalizar; `ERRORES.referencia_invalida` en `comun.js` dice "Escribe al menos los últimos 6
  caracteres de la referencia". El `hint` del campo lo dice también.
- Panel `admin.html`: nada nuevo que mostrar; el motivo del dictamen ya se ve.
- Tests: casos nuevos en `supabase/tests/ticketera.sql` (5 caracteres → `referencia_invalida`;
  misma terminación en el mismo tipo → `referencia_usada`; misma terminación en tipos distintos
  → pasa; `set role anon` no lee `ocr_sufijo` por `ver_orden`), en `dictamen.test.ts` (ya no
  existe la duda por referencia corta) y en `ux.mjs` (el formulario marca error con 5 y acepta 6).
  En `auto-aprobar.mjs`, el caso "misma captura, otra referencia" debe seguir dando `en_revision`
  (ahora por `no_coincide` del sufijo leído) y el caso de 5 caracteres tipeados cambia a fallo del
  formulario/RPC.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con los cuatro asserts nuevos (5 caracteres, misma terminación mismo tipo, misma terminación otro tipo, anon no ve `ocr_sufijo`).
- [ ] `deno test supabase/functions/` sale 0 y ya no contiene un test de "referencia tipeada corta".
- [ ] `API=… DB_CONTAINER=… node supabase/tests/auto-aprobar.mjs` sale 0: la primera orden con `coincide` se aprueba sola; una segunda orden con la misma captura y otra referencia queda `en_revision` con `dictamen_motivo` que contiene "ya está en la orden #".
- [ ] `node ticketera/tests/ux.mjs` sale 0 con el caso nuevo: referencia de 5 caracteres marca error y no sube; con 6 envía.
- [ ] `node supabase/tests/flujo.mjs <imagen.png>`, `avisos.mjs`, `portero.mjs` siguen saliendo 0.
