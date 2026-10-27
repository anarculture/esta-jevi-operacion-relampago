#!/usr/bin/env bash
# Renderiza las seis entradas en orden de aparición en el reel (~30 s cada una)
set -euo pipefail
cd "$(dirname "$0")"
djs=("$@")
((${#djs[@]})) || djs=(miss-venezuela warapo giulio lis-the-producer amesty dj-babatr)
for dj in "${djs[@]}"; do
  bash render.sh "$dj" 2>&1 | tail -1
done
