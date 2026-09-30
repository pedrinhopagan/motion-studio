#!/usr/bin/env bash
# bash scenes/dogama-fornecedor/mix.sh <saida.wav>
# Trilha da v4: trilha.py monta música e efeitos a partir dos tempos e do movimento da cena; aqui só loudnorm em -14 LUFS.
set -euo pipefail
out=$(realpath -m "$1")
here=$(dirname "$(realpath "$0")")
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$here"

bun eventos.js > "$tmp/eventos.json"
read -r DUR DROP < <(python3 -c "import json; e = json.load(open('$tmp/eventos.json')); print(e['DUR'], e['drop'])")

# Can't Get You Off My Mind: o grave entra em 25,60 s da faixa → primeira venda. Só decodifica o trecho;
# nível, filtro e soma com os efeitos ficam em trilha.py.
start=$(awk "BEGIN { print 25.60 - $DROP }")
ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$DUR" -i ../../assets/dogama-fornecedor/audio/cant-get-you-off-my-mind.mp3 -ar 48000 -c:a pcm_f32le "$tmp/musica-crua.wav"
uv run -q --with numpy --with scipy --with soundfile --with pyloudnorm python trilha.py "$tmp/eventos.json" "$tmp/musica-crua.wav" "$tmp/mix.wav"

# loudnorm em duas passadas, linear em -14 LUFS. A faixa é masterizada alta: nesse nível os bumbos passariam do teto
# e o loudnorm sairia do modo linear, achatando intro e drop. Antes dele, sobe até -14 LUFS e segura os picos em -2,9 dBFS (o limitador tira ~0,6 dB, que o loudnorm devolve).
lj() { ffmpeg -hide_banner -nostats -i "$tmp/mix.wav" -af "${1}loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p'; }
j() { echo "$m" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
m=$(lj "")
pre="volume=$(awk "BEGIN { print -14 - $(j input_i) }")dB,alimiter=limit=0.72:attack=5:release=80:level=disabled,"
m=$(lj "$pre")
ffmpeg -hide_banner -loglevel error -y -i "$tmp/mix.wav" -af "${pre}loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(j input_i):measured_TP=$(j input_tp):measured_LRA=$(j input_lra):measured_thresh=$(j input_thresh):offset=$(j target_offset):linear=true,aresample=48000" -c:a pcm_s24le "$out"
ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true:framelog=quiet -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):"
