#!/usr/bin/env python3
"""Piloto v4: encadena los 11 clips de Kling en un solo plano (sin textos ni audio).

Entre clips del mismo estilo el cuadro final es el inicial del siguiente, así que basta un fundido de 0,1 s.
En los portales (cambio de estilo) el fundido pasa por blanco o negro, el corte escondido del guion v4.
Uso: python3 docs/video/montaje_v4.py  →  elements/entregas/piloto-v4.mp4
"""
import json
import os
import subprocess

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
CLIPS = os.path.join(RAIZ, "elements", "clips", "v4")
SALIDA = os.path.join(RAIZ, "elements", "entregas", "piloto-v4.mp4")
W, H, FPS = 720, 1280, 30

# (clip, transición hacia el siguiente, segundos de fundido)
ORDEN = [("1a", "fade", 0.1), ("1b", "fade", 0.1), ("1c", "fadewhite", 0.3), ("2", "fadewhite", 0.3),
         ("3", "fadewhite", 0.3), ("4", "fadewhite", 0.3), ("5", "fadeblack", 0.3), ("6a", "fade", 0.1),
         ("6b", "fade", 0.1), ("6c", "fade", 0.1), ("6d", None, 0)]


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


archivos = [os.path.join(CLIPS, f"{k}.mp4") for k, _, _ in ORDEN]
for a in archivos:
    assert os.path.exists(a), f"falta {a}"
duraciones = [dur(a) for a in archivos]

entradas, filtros = [], []
for i, a in enumerate(archivos):
    entradas += ["-i", a]
    filtros.append(f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},"
                   f"format=yuv420p,setpts=PTS-STARTPTS[v{i}]")
previo, acumulado = "v0", duraciones[0]
for i, (_, trans, fundido) in enumerate(ORDEN[:-1]):
    salida = f"x{i}"
    filtros.append(f"[{previo}][v{i + 1}]xfade=transition={trans}:duration={fundido}:offset={acumulado - fundido:.3f}[{salida}]")
    acumulado += duraciones[i + 1] - fundido
    previo = salida

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(filtros), "-map", f"[{previo}]",
                "-c:v", "libx264", "-crf", "23", "-preset", "medium", "-movflags", "+faststart", SALIDA], check=True)

info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
                                  "-of", "json", SALIDA], capture_output=True, text=True, check=True).stdout)
total, st = float(info["format"]["duration"]), info["streams"][0]
assert (st["width"], st["height"]) == (W, H), st
assert abs(total - acumulado) < 0.3, (total, acumulado)
print(f"{SALIDA} {W}x{H} {total:.2f}s")
