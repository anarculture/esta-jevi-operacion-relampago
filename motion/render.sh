#!/usr/bin/env bash
# Renderiza la entrada de un DJ: overlay con alfa (ProRes 4444 .mov, 720×1280 reducido de 1080×1920, 24 fps, 1,6 s)
# y vista previa MP4 de la entrada completa sobre su clip: cámara lenta, congelado oscurecido con la tapa encima, sigue.
# Uso: bash motion/render.sh <dj>  → motion/renders/<dj>.mov y <dj>-vista.mp4
# Método de dpworld-video/graficas/render.sh: render de HyperFrames y reducción con el alfa premultiplicado (si no, el
# filtro arrastra al borde de cada letra el color de los píxeles transparentes).
set -euo pipefail
dj=${1:?dj: miss-venezuela, warapo, giulio, lis-the-producer, amesty, dj-babatr}
raiz=$(cd "$(dirname "$0")" && pwd)
# clips del borrador v1 del reel (sesión del montaje); el cuadro es donde se congela, con el DJ a la vista
media=/tmp/claude-1000/-home-acracia-Code-sindicato-baba--claude-worktrees-video-promo-baba/0f5f76b6-5be4-42b0-a509-82080a8f5236/scratchpad/escenas/media
case $dj in
  miss-venezuela) clip=1a cuadro=84 ;;
  warapo) clip=2 cuadro=60 ;;
  giulio) clip=3 cuadro=60 ;;
  lis-the-producer) clip=4 cuadro=36 ;;
  amesty) clip=5 cuadro=12 ;;
  dj-babatr) clip=6a cuadro=60 ;;
  *) echo "dj desconocido: $dj" >&2 && exit 2 ;;
esac
out=$raiz/renders
mkdir -p "$out"
export HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
t0=$SECONDS
npx -y hyperframes@0.8.162 render "$raiz" -c "compositions/$dj.html" --format mov --fps 24 --workers 2 --quiet -o "$tmp/full.mov"
ffmpeg -v error -y -i "$tmp/full.mov" -vf "scale=in_color_matrix=bt709:in_range=tv,format=gbrapf32le,\
premultiply=inplace=1,scale=720:1280:flags=lanczos,unpremultiply=inplace=1,\
scale=out_color_matrix=bt709:out_range=tv,format=yuva444p10le" -c:v prores_ks -profile:v 4444 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv "$out/$dj.mov"

# vista: hasta 2 s normales antes del congelado, el último medio segundo a mitad de velocidad, 2 cuadros de destello,
# el congelado (saturación baja, acercamiento lento) con la tapa encima 1,6 s, y el resto del clip
t=$(python3 -c "print($cuadro / 24)")
a=$(python3 -c "print(max(0, $t - 2))") b=$(python3 -c "print(max(0, $t - 0.5))")
E=(-an -c:v libx264 -crf 16 -preset fast -pix_fmt yuv420p -r 24)
c=$media/clip-$clip.mp4
tramos=()
# congelado a menos de 0,5 s del inicio (amesty, cuadro 12): no hay tramo a velocidad normal, empieza en cámara lenta
if python3 -c "import sys; sys.exit(not $b > $a)"; then
  ffmpeg -v error -y -i "$c" -vf "trim=$a:$b,setpts=PTS-STARTPTS,setsar=1" "${E[@]}" "$tmp/s1.mp4"
  tramos+=("$tmp/s1.mp4")
fi
ffmpeg -v error -y -i "$c" -vf "trim=$b:$t,setpts=2*(PTS-STARTPTS),fps=24,setsar=1" "${E[@]}" "$tmp/s2.mp4"
ffmpeg -v error -y -f lavfi -i "color=c=white:s=720x1280:r=24" -frames:v 2 -vf setsar=1 "${E[@]}" "$tmp/s3.mp4"
ffmpeg -v error -y -i "$c" -i "$out/$dj.mov" -filter_complex \
  "[0:v]trim=start_frame=$cuadro:end_frame=$((cuadro + 1)),setpts=PTS-STARTPTS,scale=1440:2560,\
zoompan=z='1+0.0015*on':d=39:s=720x1280:fps=24,eq=saturation=0.6:contrast=1.2:brightness=-0.08,setsar=1[f];\
[f][1:v]overlay=format=auto:shortest=1" "${E[@]}" "$tmp/s4.mp4"
ffmpeg -v error -y -i "$c" -vf "trim=start_frame=$((cuadro + 1)),setpts=PTS-STARTPTS,setsar=1" "${E[@]}" "$tmp/s5.mp4"
tramos+=("$tmp"/s{2,3,4,5}.mp4)
printf "file '%s'\n" "${tramos[@]}" >"$tmp/lista.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$tmp/lista.txt" -c copy "$out/$dj-vista.mp4"
echo "$dj: $out/$dj.mov y $dj-vista.mp4 en $((SECONDS - t0)) s"
