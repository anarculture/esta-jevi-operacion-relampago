#!/usr/bin/env python3
"""Imagen a video con Wan 2.2 TI2V-5B (diffusers) en el pod GPU: un clip por trabajo de un JSON.

Uso (en el pod, venv /workspace/venv-wan, HF_HOME=/workspace/hf):
    python wan_i2v.py trabajos.json salida/ [id ...]
Sin ids corre todos. Cada trabajo: {"id", "image", "prompt", opcional "seed", "steps"}.
"""
import json
import pathlib
import sys
import time

import torch
from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
from diffusers.utils import export_to_video, load_image

MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
W, H, FRAMES, FPS = 704, 1280, 121, 24  # 9:16, ~5 s: lo que el 5B genera a 720p
NEG = ("text, letters, words, subtitles, watermark, logo, blurry, low quality, static, frozen frame, "
       "style change, photorealistic, extra limbs, deformed hands, duplicated characters")

jobs = json.load(open(sys.argv[1]))
out = pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
pick = set(sys.argv[3:])

vae = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
pipe = WanImageToVideoPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=torch.bfloat16)
# todo en la GPU no entra en 32 GB (OOM en el VAE a 704x1280x121): T5 y transformer se turnan, VAE por mosaicos
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()

for j in jobs:
    if pick and j["id"] not in pick:
        continue
    t = time.time()
    image = load_image(j["image"]).convert("RGB").resize((W, H))
    frames = pipe(
        image=image, prompt=j["prompt"], negative_prompt=NEG, height=H, width=W, num_frames=FRAMES,
        guidance_scale=5.0, num_inference_steps=j.get("steps", 50),
        generator=torch.Generator("cuda").manual_seed(j.get("seed", 42)),
    ).frames[0]
    assert len(frames) == FRAMES, f"{j['id']}: {len(frames)} cuadros"
    dest = out / f"{j['id']}.mp4"
    export_to_video(frames, str(dest), fps=FPS)
    print(f"{j['id']} {dest} {time.time() - t:.0f}s", flush=True)
