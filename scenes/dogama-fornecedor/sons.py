# uv run --with numpy --with scipy --with soundfile --with pyloudnorm python scenes/dogama-fornecedor/sons.py
# Grava em projects/dogama-fornecedor/motion.json o que o Motion Studio precisa para a audição:
#   audition.music: as músicas candidatas, cada uma com o início que põe o grave na primeira venda;
#   audition.effects: uma camada por categoria de efeito, com os momentos tirados da cena e as opções de som.
# O movimento é contínuo (segue a velocidade da câmera e do cursor), então cada opção vira uma faixa inteira
# em assets/dogama-fornecedor/audio/stems/. Escolhas já feitas no Studio (som e volume de cada camada) são mantidas.
import json, subprocess
from pathlib import Path
import numpy as np, soundfile as sf
from scipy.signal import find_peaks
import trilha

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MANIFEST = ROOT / "projects/dogama-fornecedor/motion.json"
AUDIO = "assets/dogama-fornecedor/audio"

ev = json.loads(subprocess.run(["bun", "eventos.js"], cwd=HERE, capture_output=True, text=True, check=True).stdout)
N, R, SR = int(round(ev["DUR"] * trilha.SR)), ev["R"], trilha.SR
v = trilha.velocidades(ev)

stems = ROOT / AUDIO / "stems"
stems.mkdir(exist_ok=True)
for name, wave in (("movimento-sopro", trilha.sopro(v, N)), ("movimento-whoosh", trilha.whoosh(v, N, R))):
    sf.write(stems / f"{name}.wav", (wave / np.abs(wave).max() * 0.5).astype(np.float32), SR, subtype="PCM_16")


def hits(times, pan=lambda t: 0.0):
    return [{"time": round(t, 4), "pan": round(pan(t), 2)} for t in times]


def cursor_pan(t):
    return float(np.clip((v["cx"][int(t * R)] / 1440 - 0.5) * 0.8, -0.4, 0.4))


def movement_peaks():
    found = []
    for label, speed, ref in (("câmera", v["vcam"], 5200), ("cursor", v["vcur"], 2600)):
        smooth = np.convolve(speed, np.ones(25) / 25, "same")
        for i in find_peaks(smooth, height=ref * 0.15, distance=int(0.6 * R))[0]:
            found.append({"time": round(i / R, 4), "label": label})
    return sorted(found, key=lambda hit: hit["time"])


def option(file, label, **extra):
    return {"file": f"{AUDIO}/{file}", "label": label, **extra}


layers = [
    {
        "id": "cliques",
        "name": "Cliques",
        "description": "Cada clique do cursor. O som sai do lado da tela onde o cursor está.",
        "hits": hits(ev["click"], cursor_pan),
        "options": [
            option("sfx/clique-mouse.wav", "Mouse", duration=0.2, attack=0.011, gain=-0.5),
            option("sfx/clique-mouse-2.wav", "Mouse 2", duration=0.3, attack=0.002, gain=-0.5),
            option("sfx/clique-digital.wav", "Toque digital", duration=0.08, attack=0.001, gain=-2),
        ],
        "selected": f"{AUDIO}/sfx/clique-mouse-2.wav",
    },
    {
        "id": "movimento",
        "name": "Movimento",
        "description": "Câmera, cursor e morphs grandes em deslocamento. Os momentos marcam os picos de velocidade; o som é uma faixa contínua que segue a velocidade.",
        "hits": movement_peaks(),
        "options": [
            option("stems/movimento-sopro.wav", "Sopro suave", stem=True, gain=-3.5),
            option("stems/movimento-whoosh.wav", "Whoosh", stem=True, gain=-3.5),
        ],
        "selected": f"{AUDIO}/stems/movimento-sopro.wav",
    },
    {
        "id": "vendas",
        "name": "Momento de valor",
        "description": "Uma notificação só, na primeira venda, junto do grave da música.",
        "hits": hits(ev["sale"]),
        "options": [
            option("sfx/notificacao-dogama.mp3", "Notificação Dogama", start=0.53, attack=0.02, gain=1),
            option("sfx/venda.wav", "Pop seco", attack=0.045),
        ],
        "selected": f"{AUDIO}/sfx/notificacao-dogama.mp3",
    },
    {
        "id": "numeros",
        "name": "Números",
        "description": "Cada número que muda: estoque baixando e saldo subindo.",
        "hits": hits(ev["tock"]),
        "options": [
            option("sfx/tique.wav", "Tique suave", start=0.095, duration=0.12, attack=0.005, gain=-2),
            option("sfx/bipe-digital.wav", "Bipe digital", duration=0.08, attack=0.001, gain=-4),
        ],
        "selected": f"{AUDIO}/sfx/bipe-digital.wav",
    },
]

# Onde o grave de cada faixa entra (FONTES.md), para cair na primeira venda.
drop = ev["drop"]
music = [
    {"file": f"{AUDIO}/cant-get-you-off-my-mind.mp3", "label": "Can't Get You Off My Mind", "description": "Future bass · positiva · 75 BPM. Escolhida na v4.", "offset": round(25.60 - drop, 2)},
    {"file": f"{AUDIO}/its-love.mp3", "label": "It's Love", "description": "Corporativa · 110 BPM. Usada até a v3, recusada como música de elevador.", "offset": round(39.32 - drop, 2)},
    {"file": f"{AUDIO}/head-bang.mp3", "label": "Head Bang", "description": "Trap · 74 BPM. Usada na v1, recusada por soar melancólica.", "offset": round(12.94 - drop, 2)},
]

manifest = json.loads(MANIFEST.read_text())
audition = manifest.setdefault("audition", {})
chosen = {layer["id"]: layer for layer in audition.get("effects", [])}
for layer in layers:
    prior = chosen.get(layer["id"], {})
    layer["selected"] = prior.get("selected", layer["selected"])
    layer["volume"] = prior.get("volume", trilha.VOL_FX)
audition["music"] = music
audition["effects"] = layers
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(f"{len(layers)} camadas, {sum(len(layer['hits']) for layer in layers)} momentos, {len(music)} músicas")
