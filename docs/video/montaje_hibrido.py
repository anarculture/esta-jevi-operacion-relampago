#!/usr/bin/env python3
"""Reel híbrido: base del piloto v4 con los clips de la v5 que Mau aprobó, y la entrada animada de cada DJ.

Tramos v5 donde ganó la v5 (1a, 1b, 3a, 4a, 4b) o no hay nada mejor (5a, 5b); el resto del v4 (gag de la cabeza en
1c, raptor de frente en 2, estirón de 3, cierre en el ring). Entrada de DJ: destello blanco, cuadro congelado 1,0 s
con la tapa `.mov` encima (acelerada para caber), y el clip sigue. Las escenas van a 2,2× para que el reel quede en
menos de 30 s; la música va a 1×.
Sonido: el audio de Kling de cada clip, con los mismos recortes, velocidades y fundidos que el video (silencio en
los congelados), mezclado debajo del track. Sin SFX sintéticos (a Mau no le gustaron).
Uso: python3 docs/video/montaje_hibrido.py [--solo-audio]  →  elements/entregas/reel-hibrido.mp4
--solo-audio rehace solo la mezcla sobre el video ya renderizado.
"""
import json
import os
import subprocess
import sys
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
         ("v4/6d", 0.0, 4.2, "fade", 0.3)]               # corta con BABATR coronado, antes del primer plano del raptor
FLYER, FLYER_DUR = os.path.join(RAIZ, "FLYER FINAL BABA.png"), 3.0  # cierre: el flyer con la música sonando
VEL = 2.2  # con 2,2× y congelados de 1,0 s el reel queda en 28,8 s (meta: ≤ 30 s)
# clip: (segundo del congelado en el clip, tapa). El DJ tiene que estar a la vista en ese cuadro.
INTROS = {"v5/1b": (3.4, "miss-venezuela"), "v4/2": (1.2, "warapo"), "v5/3a": (2.6, "giulio"),
          "v5/4b": (1.2, "lis-the-producer"), "v5/5a": (1.2, "amesty"), "v4/6a": (3.8, "dj-babatr")}
CONGELADO, TAPA_DUR = 1.0, 1.6  # la tapa dura 1,6 s y se acelera para caber en el congelado
# Track: RING THE ALARM (DJ Babatr Remix). El drop (DROP s del track) cae en el destello del tanque que revienta
# (TANQUE: clip y segundo del clip); antes suena el break. MUSICA_INICIO se calcula abajo con esa posición.
TRACK = "/home/acracia/Music/1-01 RING THE ALARM (DJ Babatr Remix).mp3"
DROP, TANQUE = 132.0, ("v4/1b", 3.5)
MUSICA, SFX = 0.8, 0.75  # SFX: audio de Kling de cada clip


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return float(out)


def congelado(clip, t, tapa, tmp):
    """Cuadro t del clip, viraje del spec y acercamiento lento, con la tapa animada encima: mp4 de CONGELADO s."""
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
                    f"[1:v]setpts=PTS*{CONGELADO / TAPA_DUR:.4f},scale={W}:{H},format=rgba[t];[f][t]overlay=0:0,format=yuv420p",
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
    if k in INTROS:
        t, tapa = INTROS[k]
        assert ent < t < fin, (k, ent, t, fin)
        piezas += [(a, ent, t - ent, VEL, "fadewhite", 4 / FPS),          # destello
                   (congelado(a, t, tapa, tmp), 0, CONGELADO, 1.0, "fade", CUADRO),
                   (a, t, fin - t, VEL, trans, fundido)]
    else:
        piezas.append((a, ent, fin - ent, VEL, trans, fundido))
# Flyer (4:5) centrado sobre sí mismo desenfocado, 0,2 s de sobra como el congelado
flyer = os.path.join(tmp, "flyer.mp4")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", f"{FLYER_DUR + 0.2}", "-i", FLYER,
                "-filter_complex", f"[0:v]split[a][b];[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                f"boxblur=30[f];[b]scale={W}:-2[g];[f][g]overlay=(W-w)/2:(H-h)/2,format=yuv420p",
                "-r", str(FPS), "-c:v", "libx264", "-crf", "16", "-preset", "fast", flyer], check=True)
piezas.append((flyer, 0, FLYER_DUR, 1.0, None, 0))

entradas, filtros = [], []
for i, (a, ent, largo, vel, _, _) in enumerate(piezas):
    entradas += ["-i", a]
    filtros.append(f"[{i}:v]trim=start={ent:.3f}:duration={largo:.3f},setpts=(PTS-STARTPTS)/{vel},fps={FPS},"
                   f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},format=yuv420p[v{i}]")
previo, acumulado = "v0", piezas[0][2] / piezas[0][3]
inicios = [0.0]  # segundo del reel donde arranca cada pieza
for i, (_, _, _, _, trans, fundido) in enumerate(piezas[:-1]):
    siguiente = piezas[i + 1][2] / piezas[i + 1][3]
    assert fundido < min(acumulado, siguiente), (i, fundido, siguiente)
    salida = f"x{i}"
    filtros.append(f"[{previo}][v{i + 1}]xfade=transition={trans}:duration={fundido:.4f}:offset={acumulado - fundido:.4f}[{salida}]")
    inicios.append(acumulado - fundido)
    acumulado += siguiente - fundido
    previo = salida
assert acumulado <= 30 + FLYER_DUR, f"el reel dura {acumulado:.2f} s; la meta es ≤ 30 s más el flyer"
i = next(i for i, p in enumerate(piezas) if p[0].endswith(TANQUE[0] + ".mp4"))
tanque = inicios[i] + (TANQUE[1] - piezas[i][1]) / piezas[i][3]
MUSICA_INICIO = DROP - tanque
print(f"reel {acumulado:.2f} s; el tanque revienta en {tanque:.2f} s; música desde {MUSICA_INICIO:.2f} s")

os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
if "--solo-audio" not in sys.argv:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(filtros), "-map", f"[{previo}]",
                    "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-r", str(FPS), "-movflags", "+faststart", SALIDA],
                   check=True)

# Sonido: misma cadena de piezas y fundidos que el video, sobre el audio de cada clip
sonido = []
for i, (a, ent, largo, vel, _, _) in enumerate(piezas):
    if a.startswith(tmp):  # congelado: sin sonido propio
        sonido.append(f"anullsrc=r=44100:cl=stereo,atrim=duration={largo:.3f}[a{i}]")
    else:
        sonido.append(f"[{i}:a]atrim=start={ent:.3f}:duration={largo:.3f},asetpts=PTS-STARTPTS,atempo={vel},"
                      f"aformat=sample_rates=44100:channel_layouts=stereo[a{i}]")
previo_a = "a0"
for i, (_, _, _, _, _, fundido) in enumerate(piezas[:-1]):
    sonido.append(f"[{previo_a}][a{i + 1}]acrossfade=d={fundido:.4f}:c1=tri:c2=tri[y{i}]")
    previo_a = f"y{i}"
n = len(piezas)
sonido.append(f"[{n}:a]afade=t=in:d=0.3,afade=t=out:st={acumulado - 2:.3f}:d=2,volume={MUSICA}[m];"
              f"[{previo_a}]volume={SFX}[k];[m][k]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[mezcla]")
con_audio = SALIDA + ".tmp.mp4"
subprocess.run(["ffmpeg", "-v", "error", "-y", *entradas, "-ss", f"{MUSICA_INICIO}", "-t", f"{acumulado:.3f}", "-i", TRACK,
                "-i", SALIDA, "-filter_complex", ";".join(sonido), "-map", f"{n + 1}:v", "-map", "[mezcla]",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", con_audio], check=True)

# Se valida el temporal antes de reemplazar: un audio corto recorta el video por -shortest
info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                                  "-of", "json", con_audio], capture_output=True, text=True, check=True).stdout)
total = float(info["format"]["duration"])
st = next(s for s in info["streams"] if s["codec_type"] == "video")
assert (st["width"], st["height"]) == (W, H), st
assert any(s["codec_type"] == "audio" for s in info["streams"]), "sin audio"
assert abs(total - acumulado) < 0.3, (total, acumulado)
os.replace(con_audio, SALIDA)
print(f"{SALIDA} {W}x{H} {total:.2f}s con audio")
