# 03: Sin señal e imprimir

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/4

**What to build:** antes de la fiesta el portero toca "Descargar lista" y la página guarda en el
teléfono las entradas aprobadas con su hora ("Lista de las 20:35 · 112 entradas"). Cuando el
servidor no responde, un código o QR se valida contra esa lista: verde si existe y no está
usada, amarilla si ya lo estaba, roja si no está; el resultado lleva la etiqueta "sin conexión",
queda marcado localmente y en cola. Al volver la red o el foco, la cola se envía sola; si el
servidor responde "ya usada" a algo que localmente fue válida, aparece una línea de aviso con el
número de orden. "Lista" abre la lista local ordenada por código de respaldo, con número de
orden y "N de M", lista para imprimir en negro sobre blanco.

Decisiones congeladas:

- Lista y cola en `localStorage` bajo claves propias (patrón `leer`/`guardar` de `comun.js`);
  sobreviven a recargas. La clave mala (401) borra la clave guardada pero no la lista ni la cola.
- "Sin conexión" se decide por fallo de red (el `ErrorRed` de `comun.js`) o 5xx; un 401 o un
  4xx no activan el modo local.
- El contador sin red se calcula desde la lista local más las marcas locales.
- Reenvío de la cola: al evento `online`, al recuperar el foco (`visibilitychange`) y tras cada
  check-in con red. Cada token sale de la cola solo cuando el servidor respondió (válida o ya
  usada); un fallo de red lo deja en cola.
- Vista imprimible dentro de la misma página (sección que se muestra con "Lista"), estilos de
  impresión en `t.css` (`@media print`: fondo blanco, texto negro, sin cámara ni botones).

**Blocked by:** 01

**Status:** done

- [x] `node ticketera/tests/ux.mjs` sale 0 con casos nuevos: "Descargar lista" guarda la lista y muestra su hora y cantidad; con `offline: true` un código de la lista → "valida" con "sin conexión" y queda en cola (`localStorage`); el mismo código otra vez sin red → "ya_usada"; un código fuera de la lista sin red → "invalida"; al volver la red (fixture de `checkin` activo) la cola se vacía y el fixture recibió los tokens encolados; un fixture que responde `ya_usada` a un token local válido deja la línea de aviso con "orden #"; "Lista" muestra los códigos ordenados.
- [x] Captura de la vista de impresión (`page.emulateMedia({ media: "print" })`) en `evidencia/` con fondo blanco: el test comprueba que el color de fondo computado del `body` es blanco en modo print.
- [x] `node supabase/tests/portero.mjs` sigue saliendo 0.

## Cierre (2026-10-26)

Evidencia:
- `node ticketera/tests/ux.mjs` → `OK ux.mjs` con `portero sin señal: lista descargada, validación local en cola, reenvío
  con aviso, lista ordenada e imprimible`. El mismo test contra `portero.html`/`t.css` de 619f62b da rojo.
- Impresión: `getComputedStyle(body).backgroundColor` = `rgb(255, 255, 255)`; captura `evidencia/19-portero-impresion.png`.
- `node supabase/tests/portero.mjs` → `OK portero`; `node ticketera/tests/portero-camara.mjs` → `OK`.
- Extra cubierto: un 401 borra la clave y deja la lista y la cola.

Decisiones y debilidades:
- El helper `pagina` de `ux.mjs` acepta `offline` como función para cortar y devolver la red en el mismo contexto.
- Una válida local que aún no subió se deshace en el teléfono (sale de la cola y de las marcas). Si ya subió, la deshace
  el servidor y se borra la marca local; si al subir el servidor la tenía de otro teléfono, Deshacer desaparece (4dc23f9,
  hallazgo de la revisión de cierre).
- Las marcas locales quedan en el teléfono tras subir: si Mau deshace un ingreso por SQL, ese teléfono sin red lo seguirá
  viendo usado hasta que se borre el almacenamiento.
- La cola sube en orden y se detiene en el primer error que no es de red (solo un 401 en la práctica); se reintenta en el siguiente evento.
