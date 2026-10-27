#!/usr/bin/env bash
# Avisos de la ticketera (issue #5): vytas manda a cada WhatsApp su entrada aprobada.
# En aios-vm vive en ~/.hermes/scripts/avisos-entradas.sh y lo corre `hermes cron` cada minuto
# (--no-agent: sin LLM). Copia idéntica en el repo: supabase/tests/avisos-entradas.sh.
#   avisos-entradas.sh [--dry-run] [--url <función avisos>]
# Lee PM_CLAVE y AVISOS_URL de ~/.hermes/.env (o del entorno). Pide `pendientes` a la función
# `avisos`, manda cada texto con `hermes send` y reporta `avisada` con ok o el error (200 caracteres).
# --dry-run imprime "DRY <jid> <texto>" por entrada sin enviar ni marcar. En silencio si no hay nada.
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
# Dos sondeos a la vez mandarían dos veces la misma entrada antes de marcarla: el segundo se va.
exec 9>"${TMPDIR:-/tmp}/avisos-entradas.lock"
flock -n 9 || exit 0
exec python3 - "$@" <<'PY'
import json, os, subprocess, sys, urllib.request

args = sys.argv[1:]
dry = "--dry-run" in args
env = {}
try:
    for linea in open(os.path.expanduser("~/.hermes/.env")):
        k, _, v = linea.strip().partition("=")
        if k in ("PM_CLAVE", "AVISOS_URL"):
            env[k] = v.strip().strip("\"'")
except FileNotFoundError:
    pass
clave = os.environ.get("PM_CLAVE") or env.get("PM_CLAVE")
url = (args[args.index("--url") + 1] if "--url" in args else None) or os.environ.get("AVISOS_URL") or env.get("AVISOS_URL")
if not clave or not url:
    sys.exit("avisos-entradas: falta PM_CLAVE o AVISOS_URL")

def llamar(body):
    req = urllib.request.Request(url, data=json.dumps({"clave": clave, **body}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

for p in llamar({"accion": "pendientes"}):
    if dry:
        print(f"DRY {p['jid']} {p['texto'][:60]}".replace("\n", " "))
        continue
    try:
        r = subprocess.run(["hermes", "send", "-t", f"whatsapp:{p['jid']}", "--json", p["texto"]],
                           capture_output=True, text=True, timeout=120)
        salida, rc = (r.stdout.strip() or r.stderr.strip()), r.returncode
    except Exception as e:  # timeout o hermes ausente: cuenta como intento fallido
        salida, rc = str(e), -1
    try:
        j = json.loads(salida)
    except ValueError:
        j = None
    fallo = rc != 0 or (isinstance(j, dict) and (j.get("success") is False or j.get("ok") is False or bool(j.get("error"))))
    # Ya se envió: si marcar falla, se reintenta; si no se pudo, el próximo sondeo lo reenviaría.
    for intento in range(3):
        try:
            llamar({"accion": "avisada", "id": p["id"], "ok": not fallo,
                    **({"error": (salida or f"exit {rc}")[-200:]} if fallo else {})})
            break
        except Exception as e:
            if intento == 2:
                print(f"no se pudo marcar el aviso de la orden #{p['numero']} entrada {p['posicion']} ({e}); puede repetirse")
    if fallo:
        print(f"aviso fallido: orden #{p['numero']} entrada {p['posicion']}: {(salida or f'exit {rc}')[-200:]}")
PY
