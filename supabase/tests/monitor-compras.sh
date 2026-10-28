#!/usr/bin/env bash
# Monitor de compras (issue #12): le avisa a Mau por WhatsApp cuando cambian los totales de la ticketera.
# En aios-vm vive en ~/.hermes/scripts/monitor-compras.sh y lo corre `hermes cron` cada 2 min
# (--no-agent: el stdout se entrega tal cual al chat de Mau; vacío = silencio). Copia idéntica en el repo:
# supabase/tests/monitor-compras.sh. Prueba: supabase/tests/monitor-compras.mjs.
#   monitor-compras.sh [--dry-run] [--url <función pm>] [--estado <archivo>]
# Lee PM_CLAVE y PM_URL (si falta, AVISOS_URL con la función cambiada a pm) de ~/.hermes/.env o del entorno.
# Solo llama `leer`: no toca órdenes ni le escribe a compradores. Siempre sale con 0, porque Hermes mandaría
# un aviso de falla en cada corrida; las fallas las avisa el script, como máximo una vez cada 30 min.
# --dry-run imprime el aviso que tocaría y no guarda el estado.
set -euo pipefail
exec 9>"${TMPDIR:-/tmp}/monitor-compras.lock"
flock -n 9 || exit 0
exec python3 - "$@" <<'PY'
import json, os, sys, tempfile, time, urllib.error, urllib.request

args = sys.argv[1:]
dry = "--dry-run" in args
opcion = lambda n: args[args.index(n) + 1] if n in args else None
env = {}
try:
    for linea in open(os.path.expanduser("~/.hermes/.env")):
        k, _, v = linea.strip().partition("=")
        if k in ("PM_CLAVE", "PM_URL", "AVISOS_URL"):
            env[k] = v.strip().strip("\"'")
except FileNotFoundError:
    pass
clave = os.environ.get("PM_CLAVE") or env.get("PM_CLAVE")
url = opcion("--url") or os.environ.get("PM_URL") or env.get("PM_URL")
avisos = os.environ.get("AVISOS_URL") or env.get("AVISOS_URL")
if not url and avisos:
    url = avisos.rsplit("/", 1)[0] + "/pm"
ruta = opcion("--estado") or os.path.expanduser("~/.hermes/workspace/monitor-compras.json")
PANEL = "https://postropicalia.com/sindicato-baba/admin.html"
CADA = 30 * 60
METODO = {"pago_movil": "pago móvil", "zelle": "Zelle", "binance": "Binance"}
ahora = time.time()

try:
    estado = json.load(open(ruta))
except (FileNotFoundError, ValueError):
    estado = {}
if not isinstance(estado, dict):
    estado = {}

def guardar():
    if dry:
        return
    carpeta = os.path.dirname(os.path.abspath(ruta))
    os.makedirs(carpeta, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=carpeta)
    with os.fdopen(fd, "w") as f:
        json.dump(estado, f)
    os.replace(tmp, ruta)

def contador(b):
    claves = ("ordenes", "entradas", "usd_cents")
    if not (isinstance(b, dict) and all(type(b.get(k)) is int and b[k] >= 0 for k in claves)):
        raise ValueError("totales con forma inesperada")
    return {k: b[k] for k in claves}

def leer():
    if not clave or not url:
        raise ValueError("falta PM_CLAVE o la URL de pm")
    req = urllib.request.Request(url, data=json.dumps({"clave": clave, "accion": "leer"}).encode(),
                                 headers={"Content-Type": "application/json"})
    for intento in (1, 2):  # un corte de red pasajero (SSL EOF, visto en la VM) no amerita avisarle a Mau
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                t = (json.load(r) or {}).get("ticketera")
            break
        except urllib.error.HTTPError as e:
            raise ValueError(f"HTTP {e.code}") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if intento == 2:
                raise
            time.sleep(5)
    if not isinstance(t, dict):
        raise ValueError("leer respondió sin los totales")
    return {"aprobadas": contador(t.get("aprobadas")), "en_revision": contador(t.get("en_revision")),
            "por_metodo": {m: contador(v) for m, v in (t.get("por_metodo") or {}).items()},
            "ultima_aprobacion": t.get("ultima_aprobacion")}

pl = lambda n, uno, varios: f"{n} {uno if abs(n) == 1 else varios}"
usd = lambda c: ("-" if c < 0 else "") + (f"${abs(c) // 100}" if c % 100 == 0 else f"${abs(c) / 100:.2f}")
mas = lambda s: s if s.startswith("-") else "+" + s

try:
    t = leer()
except Exception as e:  # red, timeout, 401, JSON raro: se avisa sin la clave y no avanza la lectura
    motivo = str(e) or type(e).__name__
    # La salida a internet de aios-vm pierde paquetes (30 % el 28-oct): la red se avisa tras 3 corridas seguidas (6 min).
    red = isinstance(e, (urllib.error.URLError, TimeoutError, ConnectionError))
    estado["seguidas"] = estado.get("seguidas", 0) + 1
    if dry or ((not red or estado["seguidas"] >= 3) and ahora - estado.get("falla", 0) >= CADA):
        print(f"⚠️ Monitor de compras: no pude consultar la ticketera ({motivo[:120]}). Hasta que vuelva no hay avisos de compras.")
        estado["falla"] = ahora
    guardar()
    sys.exit(0)

estado.pop("seguidas", None)
lineas = []
if estado.pop("falla", None):
    lineas.append("✅ Monitor de compras: volvió a consultar la ticketera.")
antes = estado.get("lectura")
try:  # una lectura guardada con otra forma (versión vieja, archivo editado) vale como primera corrida
    antes = antes and {k: contador(antes[k]) for k in ("aprobadas", "en_revision")} | {
        "por_metodo": dict(antes["por_metodo"]), "ultima_aprobacion": antes["ultima_aprobacion"]}
except (KeyError, TypeError, ValueError):
    antes = None
r = t["en_revision"]
if antes is None:
    if r["ordenes"]:
        lineas.append(f"⏳ {pl(r['ordenes'], 'orden', 'órdenes')} en revisión ({pl(r['entradas'], 'entrada', 'entradas')}, {usd(r['usd_cents'])}). Revísalas: {PANEL}")
else:
    a, a0 = t["aprobadas"], antes["aprobadas"]
    nuevas = a["ordenes"] - a0["ordenes"]
    if a != a0 or t["ultima_aprobacion"] != antes["ultima_aprobacion"]:
        metodos = ", ".join(METODO.get(m, m) for m, v in t["por_metodo"].items()
                            if v["ordenes"] > antes["por_metodo"].get(m, {}).get("ordenes", 0))
        total = f"Total: {pl(a['entradas'], 'entrada', 'entradas')}, {usd(a['usd_cents'])}."
        if nuevas > 0:
            lineas.append(f"🎟️ {pl(nuevas, 'orden aprobada', 'órdenes aprobadas')}{f' ({metodos})' if metodos else ''}: "
                          f"{mas(pl(a['entradas'] - a0['entradas'], 'entrada', 'entradas'))}, {mas(usd(a['usd_cents'] - a0['usd_cents']))}. {total}")
        else:
            lineas.append(f"🎟️ Cambiaron las aprobadas. {total}")
    # ponytail: `leer` solo da agregados; una orden que entra en la misma ventana en que otra se rechaza deja la
    # cola igual y solo aparece en el recordatorio. Si molesta, `leer` tendría que traer rechazadas o ids.
    dr = r["ordenes"] - antes["en_revision"]["ordenes"]
    if dr > 0:
        lineas.append(f"⏳ {pl(dr, 'orden nueva', 'órdenes nuevas')} en revisión ({r['ordenes']} en total, "
                      f"{pl(r['entradas'], 'entrada', 'entradas')}, {usd(r['usd_cents'])}). Revísalas: {PANEL}")
    elif dr < 0 and nuevas <= 0:
        lineas.append(f"↩️ Bajó la cola de revisión a {r['ordenes']}: {pl(-dr, 'orden se resolvió', 'órdenes se resolvieron')} sin aprobarse.")
    elif lineas and r["ordenes"]:
        lineas.append(f"⏳ Queda{'n' if r['ordenes'] > 1 else ''} {pl(r['ordenes'], 'orden', 'órdenes')} en revisión. Revísalas: {PANEL}")
    elif r["ordenes"] and not lineas and ahora - estado.get("avisado", 0) >= CADA:
        lineas.append(f"⏳ Sigue{'n' if r['ordenes'] > 1 else ''} {pl(r['ordenes'], 'orden', 'órdenes')} en revisión "
                      f"({pl(r['entradas'], 'entrada', 'entradas')}). Revísalas: {PANEL}")

estado["lectura"] = t
if lineas:
    estado["avisado"] = ahora
    print("\n".join(lineas[:3]))
guardar()
PY
