# 02: Escaneo con la cámara

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/4

**What to build:** con la clave puesta, `portero.html` abre la cámara trasera a pantalla
completa; el portero apunta al QR de una entrada y, sin tocar nada, obtiene el mismo resultado
que al teclear el código (verde / amarilla / roja con vibración), y el escaneo sigue activo
después de cada resultado. Si no hay cámara o el permiso se niega, la página lo dice en una
línea y el campo de código de respaldo sigue funcionando.

Decisiones congeladas:

- `getUserMedia` con `facingMode: "environment"`. Decodificación con `BarcodeDetector`
  (`formats: ["qr_code"]`) cuando existe; si no, un decodificador QR en JavaScript vendido en la
  carpeta de la ticketera junto a `qrcode.min.js` (un solo archivo, sin build ni CDN; jsQR o
  equivalente con licencia MIT), leyendo frames del vídeo en un canvas a 10 fps. Ningún
  script externo: la página sigue funcionando sin red una vez cargada.
- El mismo token no se reenvía mientras siga en el encuadre: 3 s de silencio tras su último
  resultado (regla ya definida en el ticket 01; aquí se aplica a la cámara).
- La cámara se detiene al salir (botón "Salir") y al ocultar la pestaña; se reanuda al volver.
- Test automático con cámara falsa de Chrome: Playwright lanza `google-chrome` con
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  --use-file-for-fake-video-capture=<vídeo>`; el vídeo (`.y4m` o `.mjpeg`) se genera en el
  propio test con `ffmpeg` a partir de un PNG del QR del token del fixture (el PNG se genera con
  el mismo `qrcode.min.js` en Node, o con Playwright renderizando `entrada.html`). Script aparte,
  `ticketera/tests/portero-camara.mjs`, porque necesita flags de lanzamiento distintos a `ux.mjs`.
  Fuerza el camino del decodificador vendido (en headless `BarcodeDetector` puede no existir) y,
  si `BarcodeDetector` existe, también ese camino.

**Blocked by:** 01

**Status:** done

- [x] `node ticketera/tests/portero-camara.mjs` sale 0: con el vídeo falso del QR del fixture, la página muestra "valida" y "Entrada 1 de 2" sin teclear nada, y el fixture de `checkin` recibió exactamente una llamada con ese token en 5 s de vídeo (anti-rebote).
- [x] El mismo script, con permiso de cámara denegado (`--use-fake-ui-for-media-stream` ausente y permiso bloqueado en el contexto), muestra la línea "Sin cámara" y el código de respaldo sigue validando.
- [x] `ls ticketera/*.js | wc -l` cuenta el decodificador nuevo y `grep -c "https\?://" <decodificador>` imprime 0 (sin cargas externas).
- [x] `node ticketera/tests/ux.mjs` sigue saliendo 0.

## Cierre (2026-10-26)

Evidencia:
- `node ticketera/tests/portero-camara.mjs` → `OK portero-camara.mjs`. Con jsQR forzado: válida sin teclear y 1 sola llamada
  `checkin` con el token en 5 s de vídeo. Con la cámara denegada por CDP: "Sin cámara" y el código valida. Con la pestaña
  oculta se apaga la pista y al volver se enciende. Antes de la implementación, 3 casos en rojo.
- Decodificador: `ticketera/jsQR.min.js` (3 `.js` en `ticketera/`, antes 2); `grep -c "https\?://"` → 0.
- `node ticketera/tests/ux.mjs` → `OK ux.mjs`.

Decisiones y debilidades:
- jsQR 1.4.0 es Apache-2.0, no MIT. El ticket lo nombra explícito ("jsQR o equivalente") y la licencia queda en la cabecera.
  Se minificó con terser del caché de npx (sin dependencia nueva): sin comentarios ni URL, de 257 KB a 130 KB.
- El vídeo falso sale de un PGM dibujado con `isDark` de `qrcode.min.js`; el GIF de `createDataURL` no lo abre este ffmpeg.
- Anti-rebote: cada lectura del mismo token renueva los 3 s, así no se reenvía mientras siga en el encuadre.
- En este Chrome de Linux no existe `BarcodeDetector`: el camino nativo queda para la prueba humana en Android.
- jsQR a resolución completa puede bajar de 10 fps en iPhones viejos (comentario `ponytail:` en `portero.html`).
