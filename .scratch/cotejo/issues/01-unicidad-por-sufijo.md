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

**Status:** done (27-oct-2026, rama `cotejo`, stack local `supabase_db_cotejo` en 57321)

- [x] `docker exec -i <DB_CONTAINER> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/ticketera.sql` sale 0 con los cuatro asserts nuevos (5 caracteres, misma terminación mismo tipo, misma terminación otro tipo, anon no ve `ocr_sufijo`). Evidencia: `OK ticketera.sql: 4 órdenes creadas`. Falibilidad: sin `ordenes_tipo_sufijo_key` el test muere con `ERROR: misma terminación en el mismo tipo aceptada`; el assert de la migración con dos órdenes de igual terminación muere con `ERROR: hay órdenes del mismo tipo con la misma terminación…`.
- [x] `deno test supabase/functions/` sale 0 y ya no contiene un test de "referencia tipeada corta". Evidencia: `ok | 12 passed | 0 failed | 1 ignored`; `rg "tipeada corta" supabase/functions/` → 0 matches.
- [x] `API=… DB_CONTAINER=… node supabase/tests/auto-aprobar.mjs` sale 0: la primera orden con `coincide` se aprueba sola; una segunda orden con la misma captura y otra referencia queda `en_revision` con `dictamen_motivo` que contiene "ya está en la orden #". Evidencia: `ok  auto_aprobar = true: orden #9 aprobada en 22.8 s` · `ok  la misma captura no produce una segunda orden (sufijo tipeado ni leído)` · `OK auto-aprobar.mjs`.
- [x] `node ticketera/tests/ux.mjs` sale 0 con el caso nuevo: referencia de 5 caracteres marca error y no sube; con 6 envía. Evidencia: `ok  compra: referencia de 5 caracteres marca error sin subir; con 6 envía` · `OK ux.mjs`.
- [x] `node supabase/tests/flujo.mjs <imagen.png>`, `avisos.mjs`, `portero.mjs` siguen saliendo 0. Evidencia: `OK flujo: orden #7 aprobada, 2 entradas` (con `pruebas-e2e/pago-movil-bnc.png`) · `OK avisos.mjs · orden #13` · `OK portero: orden #20, 2 ingresadas de 12 aprobadas`.

Autocrítica: dos `revisar` simultáneos con la misma captura no aprueban dos órdenes, porque `sufijo` nace en el insert y la segunda orden siempre encuentra a la primera por esa columna; solo quedaría en carrera el caso en que ninguna referencia tipeada coincide con la leída, y ahí `dictaminar` ya da `no_coincide` por referencia distinta. Si la consulta de sufijos falla, el dictamen es `dudoso` (nunca aprueba sola).

Revisión (security-review sin hallazgos; Sonnet `silent-failure-hunter`, `typescript-reviewer`,
`database-reviewer`): corregidos `crear_orden` cobrando `precio_pm_eur_cents` a Zelle/Binance (assert
nuevo en `ticketera.sql`, rojo con el error) y el `update` del dictamen sin chequear error en
`revisar` (ahora lanza y no aprueba).
