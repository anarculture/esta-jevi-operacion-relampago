#!/usr/bin/env python3
"""Reel v5: encadena los 16 clips de Kling en un solo plano (sin textos ni audio).

Dentro de un mismo estilo el cuadro final es el inicial del siguiente: basta un fundido de 2 cuadros.
En los relevos de estilo el inicio del tramo nuevo es el final del anterior redibujado, así que un fundido
de 0,4 s sobre el mismo encuadre se lee como el mundo que se transforma con la acción en marcha.
Uso: python3 docs/video/montaje_v5.py  →  elements/entregas/reel-v5.mp4
"""
import json
import os
import subprocess

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
CLIPS = os.path.join(RAIZ, "elements", "clips", "v5")
SALIDA = os.path.join(RAIZ, "elements", "entregas", "reel-v5.mp4")
W, H, FPS = 1080, 1920, 24  # Kling entrega 24 fps: no forzar a 30

CORTE = 2 / FPS
# (clip, transición hacia el siguiente, segundos de fundido)
ORDEN = [("1a", "fade", CORTE), ("1b", "fade", CORTE), ("1c", "fade", 0.4),          # relevo: luz → papel
         ("2a", "fade", CORTE), ("2b", "fade", 0.4),                                   # relevo: cable → metro
         ("3a", "fade", CORTE), ("3b", "fade", 0.4),                                   # relevo: nubes → píxeles
         ("4a", "fade", CORTE), ("4b", "fade", 0.4),                                   # relevo: píxel → anime
         ("5a", "fade", CORTE), ("5b", "fadeblack", 0.3),                              # relevo: negro → techo
         ("6a", "fade", CORTE), ("6b", "fade", CORTE), ("6c", "fade", CORTE), ("6d", "fade", CORTE), ("6e", None, 0)]
# Recortes (entrada, cola en s): Kling sostiene el primer cuadro y frena antes del último. En los relevos la
# entrada queda casi en 0 para que el primer cuadro siga siendo el redibujo del final anterior.
RECORTE = {"1a": (0.3, 1.2), "1b": (0.6, 1.0), "1c": (0.2, 0.8), "2a": (0.1, 1.2), "2b": (1.0, 0.5),
           "3a": (0.1, 1.4), "3b": (0.3, 0.9), "4a": (0.1, 1.2), "4b": (0.5, 0.9), "5a": (0.1, 1.0),
           "5b": (0.3, 0.8), "6a": (0.2, 1.0), "6b": (0.4, 0.8), "6c": (0.4, 1.0), "6d": (0.4, 0.6), "6e": (0.3, 0.2)}
ENTRADA, COLA = 0.15, 0.2
# Kling anima lento: 1,2× le da el ritmo del reel. El clímax (6d) y el cierre (6e) van a velocidad real.
VELOCIDAD = {"6d": 1.0, "6e": 1.0}
VEL = 1.2


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


tramos = []
for k, _, _ in ORDEN:
    a = os.path.join(CLIPS, f"{k}.mp4")
    assert os.path.exists(a), f"falta {a}"
    ent, cola = RECORTE.get(k, (ENTRADA, COLA))
    vel = VELOCIDAD.get(k, VEL)
    tramos.append((a, ent, dur(a) - ent - cola, vel))

entradas, filtros = [], []
for i, (a, ent, largo, vel) in enumerate(tramos):
    entradas += ["-i", a]
    filtros.append(f"[{i}:v]trim=start={ent:.3f}:duration={largo:.3f},setpts=(PTS-STARTPTS)/{vel},fps={FPS},"
                   f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},format=yuv420p[v{i}]")
previo, acumulado = "v0", tramos[0][2] / tramos[0][3]
for i, (_, trans, fundido) in enumerate(ORDEN[:-1]):
    salida = f"x{i}"
    filtros.append(f"[{previo}][v{i + 1}]xfade=transition={trans}:duration={fundido:.3f}:offset={acumulado - fundido:.3f}[{salida}]")
    acumulado += tramos[i + 1][2] / tramos[i + 1][3] - fundido
    previo = salida

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(filtros), "-map", f"[{previo}]",
                "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-r", str(FPS), "-movflags", "+faststart", SALIDA],
               check=True)

info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
                                  "-of", "json", SALIDA], capture_output=True, text=True, check=True).stdout)
total, st = float(info["format"]["duration"]), info["streams"][0]
assert (st["width"], st["height"]) == (W, H), st
assert abs(total - acumulado) < 0.3, (total, acumulado)
print(f"{SALIDA} {W}x{H} {total:.2f}s")
