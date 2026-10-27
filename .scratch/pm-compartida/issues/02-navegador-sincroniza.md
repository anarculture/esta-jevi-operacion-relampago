# 02: El navegador sincroniza con `pm`

**Parent:** spec en https://github.com/anarculture/sindicato-baba/issues/2

**What to build:** Mau escribe la clave una vez en "Datos y respaldo" y desde ahí la plataforma
carga el estado compartido al abrir y guarda cada cambio en él. Sin clave, la plataforma se
comporta exactamente como hoy. Comportamiento (sección "Navegador" del issue #2):

- Clave en `localStorage` como en el panel admin, con botón para olvidarla.
- Al abrir con clave: `leer`. Versión remota 0 y estado local → se sube con `base: 0`. Si no,
  el remoto reemplaza al local.
- **Regla añadida (aprobada por Mau):** antes de reemplazar el estado local por el remoto, el
  local queda siempre como "respaldo anterior" con el mecanismo existente
  (`backupBeforeReplace` + botón "Restaurar respaldo anterior"), salvo que sean iguales.
- Cada cambio se guarda al instante en `localStorage` (como hoy) y se envía con `guardar`
  agrupando ráfagas (1 a 2 s).
- 409: lo local va a respaldo anterior, se carga el remoto, aviso en la línea de estado.
- Sin red o 5xx: queda en `localStorage`, el indicador dice "Guardado solo en este navegador",
  reintenta en el siguiente cambio o al recuperar el foco.
- 401: borra la clave guardada y la pide de nuevo.
- La URL de la API sigue el patrón de `ticketera/comun.js`: local en `localhost`/`127.0.0.1`,
  producción `https://ptbzdepejxxlavqfyepw.supabase.co`, con la publishable key de cada uno.
- Exportar e importar respaldo JSON siguen funcionando igual.
- De la respuesta de `leer` el navegador usa solo `version` y `estado`; claves extra (como el
  futuro bloque `ticketera`) no rompen la carga ni se guardan en el estado.

Smoke automático aprobado por Mau: un script Node (sin dependencias nuevas; Node trae
`WebSocket` y `fetch`) que levanta `google-chrome --headless=new --remote-debugging-port`,
sirve la raíz del repo por HTTP local y maneja la página por CDP. Supone la tabla vacía (el gate
corre `supabase db reset` antes). Casos, en este orden:

1. Sin clave: la app carga y el indicador muestra guardado local; ninguna llamada a `pm`.
2. Con clave y remoto vacío: el estado local se sube; `leer` devuelve versión 1, autor `navegador`.
3. Con versión remota sembrada por HTTP (por ejemplo `real.sold: 7`) y recarga: el campo de
   entradas vendidas muestra 7 y el estado local previo está en el respaldo anterior.
4. Editar un campo: tras el debounce, `leer` devuelve una versión nueva con el valor editado.
5. Conflicto: sembrar otra versión por HTTP y editar en la página → la página muestra el valor
   remoto, el respaldo anterior tiene la edición local, la línea de estado avisa.
6. Clave mala: la clave desaparece de `localStorage`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `supabase db reset && node supabase/tests/pm-navegador.mjs` sale 0 con los 6 casos.
- [ ] `supabase db reset && node supabase/tests/pm.mjs` sigue saliendo 0.
- [ ] `cmp app.js supabase/functions/_shared/app.js` sale 0.
- [ ] `node -e "const M=require('./app.js'); process.exit(M.validateState(M.defaultState()).ok?0:1)"` sale 0.
- [ ] `google-chrome --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom http://127.0.0.1:<puerto>/index.html | grep -c 'id="v-sold"'` imprime `1` (sin clave la página sigue renderizando).
