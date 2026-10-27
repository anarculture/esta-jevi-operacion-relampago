# 04: Producción

**Parent:** issues https://github.com/anarculture/sindicato-baba/issues/6 y
https://github.com/anarculture/sindicato-baba/issues/7.

**What to build:** la ticketera publicada exige 6 caracteres de referencia, pide los datos del
pagador, lee la captura al elegirla y rechaza una captura ya usada en otra orden; el panel de Mau
muestra desde dónde pagó cada comprador.

Decisiones congeladas:

- Orden de despliegue: `supabase db push --linked --yes` (las migraciones de 01, 02 y 03),
  `supabase functions deploy revisar admin lectura --project-ref ptbzdepejxxlavqfyepw`,
  `git push origin HEAD:vm/evento-pm-v2` (Pages publica en 1 a 2 min). Entre el `db push` y Pages
  la página vieja no puede comprar (`crear_orden` cambia de firma): hacerlo seguido y, si Mau
  está de acuerdo, fuera del horario de venta fuerte.
- Si el hook de permisos niega esos comandos, no busques otra vía: anótalos bajo `## BLOQUEADO`
  del BUILD con la ruta absoluta del worktree para que Mau los corra con `!`, con los pasos de
  verificación de abajo escritos para que los siga él o un agente con permisos.
- Antes del `db push`, la migración de 01 debe pasar su propio assert de duplicados por sufijo
  contra producción (`supabase db push --dry-run` no lo ejecuta: correr el `select` del assert
  con `supabase db query --linked --project-ref ptbzdepejxxlavqfyepw` y comprobar 0 filas).
- Prueba real en producción: una compra de prueba con referencia `PRUEBACOTEJO1` y una captura
  cualquiera (la lectura precarga lo que lea; el comprador corrige la referencia), aprobación o
  rechazo desde el panel, y borrado con un script `supabase/manual/borrar-prueba-cotejo.sql`
  (mismo patrón que `borrar-prueba-aviso.sql`, filtra `PRUEBACOTEJO%` y también borra la fila de
  `lecturas` de esa captura; la última línea imprime 0). Si el aviso de vytas llega al WhatsApp
  de la prueba, es efecto conocido: usar el número de Mau.
- Secretos: `OPENROUTER_API_KEY` y `ADMIN_CLAVE` ya existen en producción; no hace falta
  `secrets set`. Ninguna clave se imprime.

**Blocked by:** 03

**Status:** desplegado (27-oct-2026 03:30, por el General con el OK de Mau: "Deploy cotejo"); pendientes la compra de prueba y la confirmación de Mau

- [x] `supabase migration list --linked --project-ref ptbzdepejxxlavqfyepw` muestra las tres migraciones nuevas aplicadas y ninguna pendiente. Evidencia (General, desde un worktree fijado en 13f0d4f): `db push` aplicó `20261027210000`, `210100` y `210200`; `migration list` las muestra en remote.
- [x] `https://postropicalia.com/sindicato-baba/index.html` responde 200 y contiene "los últimos 6 caracteres" y "Leímos"; `https://postropicalia.com/sindicato-baba/admin.html` contiene "desde". Evidencia (General): Pages publicado en 13f0d4f; `index.html` contiene "Leímos", `comun.js` contiene "últimos 6" (el ticket 03 cambió el hint de `index.html`; la frase quedó en `ERRORES.referencia_invalida`), `admin.html` contiene "desde".
- [x] `lectura` en producción con un `path` inexistente responde 404 o 400 (no 500), y con clave de admin mala `admin` sigue dando 401. Evidencia (General): `lectura` responde 400 `path_invalido` a `../x` y 404 `captura_no_encontrada` a un path inexistente; `admin` con clave mala, 401. `functions deploy revisar admin lectura` OK.
- [ ] **Pendiente (Mau está afk).** Compra de prueba `PRUEBACOTEJO1` creada desde la página publicada, visible en el panel con sus datos de pagador y su dictamen; luego `supabase db query --linked --project-ref ptbzdepejxxlavqfyepw -f supabase/manual/borrar-prueba-cotejo.sql` imprime 0. El script existe y se probó en local: borra orden, entradas y la fila de `lecturas`, e imprime 0.
- [x] `git grep -n "$(cat ~/.config/sindicato-baba/admin_clave)"` sale 1. Evidencia (Alfa, sobre 13f0d4f+): `git grep -qF -- "$(cat ~/.config/sindicato-baba/admin_clave)" HEAD` → `exit=1`, sin imprimir la clave.
- [ ] **Pendiente (Mau está afk).** Mau confirma (una pregunta) que el formulario publicado le precargó la referencia desde su teléfono.
