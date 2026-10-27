#!/usr/bin/env python3
"""Reel híbrido: base del piloto v4 con los clips de la v5 que Mau aprobó, y la entrada animada de cada DJ.

Tramos v5 donde ganó la v5 (1a, 1b, 3a, 4a, 4b) o no hay nada mejor (5a, 5b); el resto del v4 (gag de la cabeza en
1c, raptor de frente en 2, estirón de 3, cierre en el ring). Entrada de DJ: el último 0,5 s antes del congelado va a
mitad de velocidad, destello blanco, cuadro congelado 1,6 s con la tapa `.mov` encima, y el clip sigue.
Uso: python3 docs/video/montaje_hibrido.py  →  elements/entregas/reel-hibrido.mp4
"""
import json
import os
import subprocess
import tempfile

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
CLIPS = os.path.join(RAIZ, "elements", "clips")
TAPAS = "/home/acracia/Code/sindicato-baba/.claude/worktrees/tapas-motion/motion/renders"
SALIDA = os.path.join(RAIZ, "elements", "entregas", "reel-hibrido.mp4")
W, H, FPS = 1080, 1920, 24

CORTE = 2 / FPS
CUADRO = 1 / FPS
# (clip, entrada, fin en s del clip o None = hasta el final, transición hacia el siguiente, segundos de fundido)
ORDEN = [("v5/1a", 0.3, 3.84, "fade", CORTE),
         ("v5/1b", 0.8, 4.0, "fadewhite", 0.25),        # antes de que el vinil salga; salto al tanque que revienta
         ("v4/1b", 3.3, None, "fade", 0.1),
         ("v4/1c", 0.1, None, "fadewhite", 0.3),         # gag: solo la cabeza, el cuerpo saluda
         ("v4/2", 0.1, None, "fadewhite", 0.3),          # raptor de frente
         ("v5/3a", 1.5, 4.64, "fadewhite", 0.25),        # 3a arranca con 1,8 s quietos (jurado v5)
         ("v4/3", 3.3, None, "fade", 0.4),               # segunda mitad: el estirón sobre las nubes
         ("v5/4a", 0.4, 3.84, "fade", CORTE),
         ("v5/4b", 0.4, 4.04, "fade", 0.4),
         ("v5/5a", 0.1, 3.94, "fade", CORTE),
         ("v5/5b", 0.0, 3.24, "fadeblack", 0.3),         # corta antes de que los jinetes broten del agujero
         ("v4/6a", 0.2, None, "fade", 0.1),
         ("v4/6b", 0.0, None, "fade", 0.1),
         ("v4/6c", 0.0, None, "fade", 0.1),
         ("v4/6d", 0.0, 4.2, None, 0)]                   # corta con BABATR coronado, antes del primer plano del raptor
VEL = 1.3  # ritmo que probó el jurado v5
VELOCIDAD = {"v4/6c": 1.0, "v4/6d": 1.0}
# clip: (segundo del congelado en el clip, tapa). El DJ tiene que estar a la vista en ese cuadro.
INTROS = {"v5/1b": (3.4, "miss-venezuela"), "v4/2": (1.2, "warapo"), "v5/3a": (2.6, "giulio"),
          "v5/4b": (1.2, "lis-the-producer"), "v5/5a": (1.2, "amesty"), "v4/6a": (3.8, "dj-babatr")}
LENTO, CONGELADO = 0.5, 1.6


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def congelado(clip, t, tapa, tmp):
    """Cuadro t del clip, viraje del spec y acercamiento lento, con la tapa animada encima: mp4 de 1,6 s."""
    cuadro, salida = os.path.join(tmp, f"{tapa}.png"), os.path.join(tmp, f"{tapa}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", clip, "-frames:v", "1", cuadro], check=True)
    # 0,2 s de sobra: si el archivo queda un cuadro corto, el xfade siguiente corta el reel ahí
    largo = CONGELADO + 0.2
    n = round(largo * FPS)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", f"{largo}", "-i", cuadro,
                    "-i", os.path.join(TAPAS, f"{tapa}.mov"), "-filter_complex",
                    f"[0:v]scale={W * 3 // 2}:{H * 3 // 2}:force_original_aspect_ratio=increase,crop={W * 3 // 2}:{H * 3 // 2},"
                    f"eq=saturation=0.6:contrast=1.2:brightness=-0.08,"
                    f"zoompan=z='1+0.05*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS}[f];"
                    f"[1:v]scale={W}:{H},format=rgba[t];[f][t]overlay=0:0,format=yuv420p",
                    "-t", f"{largo}", "-r", str(FPS), "-c:v", "libx264", "-crf", "16", "-preset", "fast", salida],
                   check=True)
    return salida


tmp = tempfile.mkdtemp()
# Cada pieza: (archivo, entrada, largo en el clip, velocidad, transición hacia la siguiente, fundido)
piezas = []
for k, ent, fin, trans, fundido in ORDEN:
    a = os.path.join(CLIPS, f"{k}.mp4")
    assert os.path.exists(a), f"falta {a}"
    fin = fin if fin is not None else dur(a) - 0.05
    vel = VELOCIDAD.get(k, VEL)
    if k in INTROS:
        t, tapa = INTROS[k]
        assert ent < t - LENTO and t < fin, (k, ent, t, fin)
        piezas += [(a, ent, t - LENTO - ent, vel, "fade", CUADRO),
                   (a, t - LENTO, LENTO, 0.5, "fadewhite", 4 / FPS),       # cámara lenta y destello
                   (congelado(a, t, tapa, tmp), 0, CONGELADO, 1.0, "fade", CUADRO),
                   (a, t, fin - t, vel, trans, fundido)]
    else:
        piezas.append((a, ent, fin - ent, vel, trans, fundido))

entradas, filtros = [], []
for i, (a, ent, largo, vel, _, _) in enumerate(piezas):
    entradas += ["-i", a]
    filtros.append(f"[{i}:v]trim=start={ent:.3f}:duration={largo:.3f},setpts=(PTS-STARTPTS)/{vel},fps={FPS},"
                   f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},format=yuv420p[v{i}]")
previo, acumulado = "v0", piezas[0][2] / piezas[0][3]
for i, (_, _, _, _, trans, fundido) in enumerate(piezas[:-1]):
    siguiente = piezas[i + 1][2] / piezas[i + 1][3]
    assert fundido < min(acumulado, siguiente), (i, fundido, siguiente)
    salida = f"x{i}"
    filtros.append(f"[{previo}][v{i + 1}]xfade=transition={trans}:duration={fundido:.4f}:offset={acumulado - fundido:.4f}[{salida}]")
    acumulado += siguiente - fundido
    previo = salida

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(filtros), "-map", f"[{previo}]",
                "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-r", str(FPS), "-movflags", "+faststart", SALIDA],
               check=True)

info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height",
                                  "-of", "json", SALIDA], capture_output=True, text=True, check=True).stdout)
total, st = float(info["format"]["duration"]), info["streams"][0]
assert (st["width"], st["height"]) == (W, H), st
assert abs(total - acumulado) < 0.3, (total, acumulado)
print(f"{SALIDA} {W}x{H} {total:.2f}s")
