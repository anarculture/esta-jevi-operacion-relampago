#!/usr/bin/env python3
"""Montaje del reel: 8 clips de Seedance → 1080×1920 con nombres y CTA final congelado.

Uso: python3 docs/video/montaje.py [salida.mp4]
Lee elements/clips/<id>.mp4 (720×1280, 5 s) y escribe elements/entregas/reel-borrador.mp4 por defecto.
Sin audio: el track de BABATR sigue pendiente.
"""
import json
import pathlib
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

RAIZ = pathlib.Path(__file__).resolve().parents[2]
EL = RAIZ / "elements"
FUENTE = str(EL / "fuentes" / "Oswald.ttf")
W, H, FPS, CORTE, CTA_S = 1080, 1920, 24, 4.0, 3.5
VERDE, BLANCO, NEGRO = (46, 216, 71), (255, 255, 255), (0, 0, 0)

# (clip, [(texto, tamaño, y, desde, hasta, color)]) — tiempos dentro del corte de 4 s del clip
ESCENAS = [
    ("1a", [("DJ BABATR", 150, 260, 0.0, 1.6, BLANCO), ("JUE 29 OCT", 90, 420, 0.0, 1.6, BLANCO),
            ("miss venezuela", 84, 1560, 1.8, 3.9, BLANCO)]),
    ("1b", []),
    ("2", [("warapo", 96, 1560, 0.4, 2.6, BLANCO)]),
    ("3", [("giulio tafa", 96, 1560, 0.4, 2.6, BLANCO)]),
    ("4", [("lis the producer", 90, 1560, 0.4, 2.6, BLANCO)]),
    ("5", [("amesty", 96, 1560, 0.4, 2.6, BLANCO)]),
    ("6a", [("DJ BABATR", 140, 1460, 1.2, 4.0, BLANCO), ("el creador del raptor house", 64, 1620, 1.2, 4.0, VERDE)]),
    ("6b", []),
]
CTA = [("JUEVES 29 OCT · 21:00", 92, BLANCO), ("CC CHACAÍTO", 92, BLANCO), ("PREVENTA $10 · PUERTA $15", 78, VERDE),
       ("LINK EN BIO", 70, BLANCO), ("postropicalia.com/sindicato-baba", 50, BLANCO),
       ("pago móvil · Zelle · Binance · entrada con QR", 40, BLANCO), ("@SINDICATO.CLUB", 60, VERDE)]
LOGOS = ["Logo Zulia CON RIF.PNG", "BANDERA BLANCO-01.png", "VERSIÓN-DE-LOGO-MALPORTADA-BLANCO-BESO-ROJO.png"]


def texto(draw, s, size, y, color):
    """Texto centrado con la sombra negra desplazada del flyer."""
    f = ImageFont.truetype(FUENTE, size)
    f.set_variation_by_name("Bold")
    x = (W - draw.textlength(s, font=f)) / 2
    off = max(3, size // 18)
    draw.text((x + off, y + off), s, font=f, fill=NEGRO + (255,))
    draw.text((x, y), s, font=f, fill=color + (255,))


def capa(lineas):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for s, size, y, color in lineas:
        texto(d, s, size, y, color)
    return im


def capa_cta():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 520, W, 1640], fill=(15, 15, 15, 215))
    y = 580
    for s, size, color in CTA:
        texto(d, s, size, y, color)
        y += int(size * 1.45)
    x, alto = 90, 150
    for nombre in LOGOS:
        logo = Image.open(EL / nombre).convert("RGBA")
        logo.thumbnail((260, alto))
        if nombre.startswith("Logo Zulia"):  # azul oscuro: sin fondo blanco no se lee sobre el panel
            d.rounded_rectangle([x - 14, 1460 - logo.height // 2 - 14, x + logo.width + 14, 1460 + logo.height // 2 + 14],
                                radius=18, fill=BLANCO + (255,))
        im.alpha_composite(logo, (x, 1460 - logo.height // 2))
        x += 320
    return im


def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def main():
    salida = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else EL / "entregas" / "reel-borrador.mp4"
    salida.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        segs = []
        for i, (clip, textos) in enumerate(ESCENAS):
            src = EL / "clips" / f"{clip}.mp4"
            # entrar tarde: el primer segundo es el still casi quieto; los remates están en el último
            base = f"[0:v]trim=1:{1 + CORTE},setpts=PTS-STARTPTS,scale={W}:{H}:flags=lanczos,fps={FPS},setsar=1"
            if clip == "6b":  # el último cuadro queda congelado bajo el CTA
                base += f",tpad=stop_mode=clone:stop_duration={CTA_S}"
            entradas, filtro, prev = ["-i", str(src)], base + "[v0]", "v0"
            capas = [(capa([(s, sz, y, c)]), a, b) for s, sz, y, a, b, c in textos]
            if clip == "6b":
                capas.append((capa_cta(), CORTE, CORTE + CTA_S))
            for k, (im, a, b) in enumerate(capas, 1):
                png = tmp / f"{clip}-{k}.png"
                im.save(png)
                entradas += ["-i", str(png)]
                filtro += f";[{prev}][{k}:v]overlay=0:0:enable='between(t,{a},{b})'[v{k}]"
                prev = f"v{k}"
            seg = tmp / f"{i:02d}.mp4"
            ff(*entradas, "-filter_complex", filtro, "-map", f"[{prev}]", "-an",
               "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", str(seg))
            segs.append(seg)
        lista = tmp / "lista.txt"
        lista.write_text("".join(f"file '{s}'\n" for s in segs))
        ff("-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", "-movflags", "+faststart", str(salida))

    info = json.loads(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height", "-of", "json", str(salida)],
        capture_output=True, text=True, check=True).stdout)
    dur, st = float(info["format"]["duration"]), info["streams"][0]
    esperado = len(ESCENAS) * CORTE + CTA_S
    assert (st["width"], st["height"]) == (W, H), st
    assert abs(dur - esperado) < 0.3, (dur, esperado)
    print(f"{salida} {st['width']}x{st['height']} {dur:.2f}s")


if __name__ == "__main__":
    main()
