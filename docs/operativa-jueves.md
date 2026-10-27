# Operativa del jueves 29-oct-2026 — Sindicato Baba, CC Chacaíto, 21:00

Guía para la noche, en orden de uso. Escrita el 27-oct con lo que está en producción.
Lo que corre solo: aprobación con dictamen `coincide`, avisos por WhatsApp desde vytas (quien responde el aviso recibe sus entradas de vuelta; lo demás pasa a miss v),
check-in del portero. Lo que toca a Mau: aprobar o rechazar lo `dudoso` y `no coincide`, ventas en mano, imprevistos.

## Direcciones y claves

| Qué | Dónde | Clave |
|---|---|---|
| Compra | https://postropicalia.com/sindicato-baba/ | ninguna |
| Panel de Mau | https://postropicalia.com/sindicato-baba/admin.html | `~/.config/sindicato-baba/admin_clave` |
| Portero | https://postropicalia.com/sindicato-baba/portero.html | `~/.config/sindicato-baba/portero_clave` |
| Plataforma del organizador | https://postropicalia.com/sindicato-baba/pm/ | `~/.config/sindicato-baba/pm_clave` |
| vytas (WhatsApp) | chat de vytas; responde "cuántas llevamos" | — |

Las claves se guardan en el navegador del teléfono la primera vez. Mostrarlas en la laptop con
`zenity --info --text="$(cat ~/.config/sindicato-baba/portero_clave)"`; nunca por chat.
Los comandos de abajo se corren desde `~/Code/sindicato-baba/.claude/worktrees/ticketera` y los que
escriben en producción los corre Mau con `!` en Claude Code (el hook se los niega al agente).

## Antes de salir de casa (tarde del jueves)

1. Portero: abrir `portero.html` en el teléfono del portero, poner la clave, tocar **Descargar lista**
   con señal. Probar la cámara con el QR de una entrada aprobada de prueba (debe salir **verde**; al
   segundo intento **amarillo** "ya usada"; tocar **Deshacer** en los 5 minutos la libera).
2. Panel: abrir `admin.html`, confirmar que no queda nada en "Por revisar".
3. Tasa: la compra en pago móvil se bloquea si la tasa BCV tiene más de 12 horas. Se refresca sola cada
   hora con cada visita a la página; si el jueves de tarde la página dice "No pudimos actualizar la tasa
   BCV", ver "Si falla la tasa".
4. Batería y datos del teléfono del portero; una batería externa.

## Durante la noche

- **Compra normal**: el comprador paga, sube la captura, la referencia se precarga desde la foto, llena
  nombre, cédula, desde dónde pagó y un WhatsApp por entrada. Si el dictamen es `coincide`, la orden se
  aprueba sola y en menos de 2 minutos cada WhatsApp recibe su entrada desde el número de vytas.
- **`dudoso` o `no coincide`**: aparece en "Por revisar" del panel con el motivo, la captura y "desde"
  (banco, teléfono y cédula con que pagó). Mau lo busca en la app del banco y aprueba o rechaza. Casos
  frecuentes y qué hacer:
  - "monto … menor al esperado" por pocos bolívares: la tasa cambió entre que pagó y envió. Si el pago
    está en el banco, aprobar.
  - "destinatario solo por nombre" en Zelle: el comprobante no mostraba el correo. Confirmar en Zelle y
    aprobar.
  - "la referencia leída (…) ya está en la orden #N": misma captura reportada dos veces. Rechazar la
    segunda con motivo "La referencia ya se usó".
  - "Esa referencia ya se usó" al comprar (antes de enviar): o es un intento repetido, o dos pagos reales
    terminan en los mismos 6 dígitos (raro, cerca de 0,5 % con 100 órdenes). El comprador escribe por
    WhatsApp; Mau registra la venta a mano (abajo).
- **Entrada en puerta**: el portero escanea. Verde entra; amarillo ya entró (muestra la hora); rojo no
  existe o la orden no está aprobada. Sin señal, el portero sigue validando contra la lista descargada
  y la cola se sube sola al volver la red; "Ver lista" muestra e imprime la lista de respaldo.
- **Venta en mano o en puerta**: copiar `supabase/manual/plantilla-venta-manual.sql`, poner nombre,
  método, referencia, monto y los WhatsApp (uno por entrada, `null` si no quiere aviso) y correrla:
  `!supabase db query --linked --project-ref ptbzdepejxxlavqfyepw -f <archivo>`. Imprime los tokens
  y vytas avisa a cada número. La venta queda contada en la ticketera (no en el registro manual de la PM).
- **Reenviar un aviso**: en el panel, en la entrada, "Reenviar" con el número corregido.
- **Cuántas llevamos**: preguntarle a vytas, o abrir `/pm/` → Ventas (columna Ticketera + fuera de la
  ticketera; botón Actualizar).

## Si algo falla

- **La IA aprueba lo que no debe, o se quiere revisar todo a mano**: apagar la aprobación automática.
  `!supabase db query --linked --project-ref ptbzdepejxxlavqfyepw "update config set auto_aprobar = false"`.
  Todo pasa a "Por revisar"; volver con `= true`.
- **Avisos que no llegan**: en `aios-vm`, `ssh aios-vm '~/.local/bin/hermes cron list'` debe mostrar
  `avisos-entradas [active]` con "Last run … ok" del último minuto. Si no: `ssh aios-vm 'systemctl --user
  restart hermes-gateway.service'` y luego `hermes cron resume f2e9920487c7`. Pausar los avisos:
  `hermes cron pause f2e9920487c7`. Lo pendiente de avisar se ve con la función `avisos`
  (`accion: pendientes`, clave PM).
- **Se cayó la tasa (pago móvil bloqueado)**: la página sigue vendiendo en Zelle y Binance. Para
  destrabar pago móvil, poner la tasa a mano con el valor del BCV del día:
  `!supabase db query --linked --project-ref ptbzdepejxxlavqfyepw "update config set tasa_eur = <euros en Bs>,
  tasa_eur_fecha = current_date, tasa_consultada_en = now()"`.
- **La lectura de la captura no funciona** ("No pudimos leer la captura"): el comprador escribe la
  referencia a mano; la compra sigue igual. Pasa también si en una hora hubo más de 200 lecturas.
- **El portero perdió el teléfono o la clave**: cualquier teléfono con `portero.html` y la clave sirve;
  descargar la lista otra vez. Lo que ya entró está en el servidor, no en el teléfono.
- **Se filtró una clave**: regenerar el secreto en Supabase (`supabase secrets set ADMIN_CLAVE=…` /
  `PORTERO_CLAVE` / `PM_CLAVE`), guardar el archivo 600 nuevo y volver a escribirla en el teléfono.
  La de PM también vive en el `.env` de vytas en `aios-vm`.
- **Deshacer una aprobación equivocada**: no hay botón. Por SQL, `update ordenes set estado = 'rechazada',
  rechazo_motivo = '…' where numero = N` deja las entradas inválidas en la puerta; el aviso ya enviado no
  se retira (escribirle al comprador).

## Después de la fiesta

- Cierre: `/pm/` → Informe CSV (entradas y cobrado por fuente), y `resumen_ticketera` vía `leer` de la PM.
- Órdenes de prueba: borrar con los scripts `supabase/manual/borrar-prueba-*.sql` (portero, cotejo, recepción).
- Issues abiertos para después: tarifa en puerta, referidos (pospuesto), memo "Sindicato #N", Binance por
  API, exportar check-ins.
