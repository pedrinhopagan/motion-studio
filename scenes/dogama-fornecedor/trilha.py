# uv run --with numpy --with scipy --with soundfile --with pyloudnorm python trilha.py <eventos.json> <musica-crua.wav> <mix.wav>
# Monta a trilha em 48 kHz estéreo a partir dos tempos da cena, antes do loudnorm:
#   música com passa-baixa leve até a primeira venda (o drop da faixa), aberta depois e fechando de novo no fim do loop;
#   clique em cada clique, uma notificação da Dogama na primeira venda, bipe em cada número que muda
#   e um sopro de ruído rosa que acompanha a velocidade do cursor e da câmera ("Sopro suave" na audição).
# Balanço escolhido na página de audição (v4): música 35% e efeitos 50%, sem ducking, como foi ouvido lá.
# Imprime o nível de cada efeito sobre a música.
# Tudo aqui é numpy: o amix do ffmpeg cortava o fim da mixagem de forma diferente a cada rodada.
# Também é módulo: audicao.py importa efeitos() e musica() para gerar cada variação em faixa separada.
import json, sys
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, resample_poly, find_peaks

SR = 48000
A = "../../assets/dogama-fornecedor/audio/sfx"
REF = 10 ** (-24 / 20)  # pico de RMS (30 ms) de referência dos efeitos, antes do loudnorm
MUS_LUFS = -18.3  # música da v3 contra os mesmos efeitos: é o 100% da página de audição
VOL_MUS, VOL_FX = 0.35, 0.50  # escolhidos na página de audição


def peak_rms(y, win=0.03):
    w = int(win * SR)
    c = np.convolve(y**2, np.ones(w) / w, "valid")
    return np.sqrt(c.max())


def pan_gains(p):  # -1 esquerda … 1 direita, potência constante
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


def load(name, start=0.0, dur=None, hp=None, lp=None):
    y, sr = sf.read(f"{A}/{name}", always_2d=True)
    y = y.mean(1)
    if sr != SR:
        y = resample_poly(y, SR, sr)
    y = y[int(start * SR) : int((start + dur) * SR) if dur else None]
    if hp:
        y = sosfilt(butter(2, hp, "highpass", fs=SR, output="sos"), y)
    if lp:
        y = sosfilt(butter(2, lp, "lowpass", fs=SR, output="sos"), y)
    y[-int(0.01 * SR) :] *= np.linspace(1, 0, int(0.01 * SR))
    return y / peak_rms(y)


# variações pontuais: arquivo, início, duração, passa-alta, passa-baixa, onde está o ataque, ganho em dB.
# Todas normalizadas pelo mesmo pico de RMS; o ganho é a diferença de propósito entre categorias.
CLIQUES = {
    "mouse": ("clique-mouse.wav", 0, 0.2, 150, 7000, 0.011, -0.5),  # Mixkit 1113: descer e subir do botão, 0,13 s entre os dois
    "mouse2": ("clique-mouse-2.wav", 0, 0.3, 150, 7000, 0.002, -0.5),  # Mixkit 2997: outro mouse, 0,2 s entre descer e subir
    "digital": ("clique-digital.wav", 0, 0.08, 200, None, 0.001, -2.0),  # Mixkit 3124: toque tonal curto
}
VENDAS = {
    "dogama": ("notificacao-dogama.mp3", 0.53, None, None, None, 0.02, 1.0),  # som real do app, sem o silêncio inicial
}
NUMEROS = {
    "tique": ("tique.wav", 0.095, 0.12, 200, None, 0.005, -2.0),  # Mixkit 1120, perto de Mi5 como a notificação
    "bipe": ("bipe-digital.wav", 0, 0.08, 200, None, 0.001, -4.0),  # Mixkit 2568, bipe curto e agudo
}
MOV_DB = {"câmera": -3.5, "cursor": -6.0}


def velocidades(ev):
    """Velocidade na tela (px/s, a cada 1 ms) da câmera, dos morphs sem câmera e do cursor."""
    R = ev["R"]
    tt = np.arange(len(ev["cam"])) / R
    cam = np.array(ev["cam"])
    dx, dy = np.gradient(cam[:, 0]) * R * cam[:, 2], np.gradient(cam[:, 1]) * R * cam[:, 2]
    dz = np.gradient(np.log(cam[:, 2])) * R * 720  # zoom: deslocamento radial na borda
    vcam = np.sqrt(dx**2 + dy**2 + dz**2)
    # morphs sem câmera (linha → card, wordmark saindo): mesma curva de velocidade de um glide de 0,8 s
    ease_v = np.gradient(np.array(ev["ease"])) * len(ev["ease"]) / 0.8
    for t0 in ev["swish"]:
        i0 = int(t0 * R)
        seg = np.interp(tt[i0 : i0 + int(0.8 * R)] - t0, np.linspace(0, 0.8, len(ease_v)), ease_v)
        vcam[i0 : i0 + len(seg)] += seg / ease_v.max() * 2600
    cx = np.array([c[0] if c else np.nan for c in ev["cur"]])
    cy = np.array([c[1] if c else np.nan for c in ev["cur"]])
    ca = np.array([c[2] if c else 0.0 for c in ev["cur"]])
    vcur = np.nan_to_num(np.hypot(np.gradient(cx), np.gradient(cy)) * R) * ca
    cpan = np.clip(np.nan_to_num(cx / 1440 - 0.5, nan=0) * 1.2, -0.6, 0.6)
    return dict(tt=tt, vcam=vcam, vcur=vcur, cx=cx, cpan=cpan)


def sopro(v, N):
    """Ruído rosa em bandas, com a intensidade presa à velocidade: o movimento soa enquanto acontece."""
    rng = np.random.default_rng(7)

    def pink(n):
        X = np.fft.rfft(rng.standard_normal(n))
        f = np.fft.rfftfreq(n, 1 / SR)
        X[1:] /= np.sqrt(f[1:])
        X[0] = 0
        y = np.fft.irfft(X, n)
        return y / y.std()

    band = lambda y, lo, hi: sosfilt(butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), y)
    tN = np.arange(N) / SR

    def envelope(x, vref, curve):
        a = np.clip(x / vref, 0, 1.25) ** curve
        a = np.convolve(a, np.ones(25) / 25, "same")  # 25 ms, sem degrau
        return np.interp(tN, v["tt"], a)

    ecam, ecur = envelope(v["vcam"], 5200, 1.3), envelope(v["vcur"], 2600, 1.2)
    pcur = np.interp(tN, v["tt"], np.convolve(v["cpan"], np.ones(25) / 25, "same"))
    nl, nr = pink(N), pink(N)
    # câmera: corpo grave-médio + ar que só aparece nas passagens rápidas, L/R descorrelacionados
    lo_l, lo_r = band(nl, 220, 900), band(nr, 220, 900)
    hi_l, hi_r = band(nl, 900, 3800), band(nr, 900, 3800)
    wcam = np.stack([lo_l * ecam + hi_l * ecam**1.8, lo_r * ecam + hi_r * ecam**1.8], 1)
    # cursor: um roçar mais agudo e mais curto, seguindo o lado da tela
    sw = band(pink(N), 1400, 5200) * ecur
    l, r = pan_gains(pcur)
    wcur = np.stack([sw * l, sw * r], 1)
    norm = lambda w: w / max(peak_rms(w[:, 0]), peak_rms(w[:, 1])) * REF
    return norm(wcam) * 10 ** (MOV_DB["câmera"] / 20) + norm(wcur) * 10 ** (MOV_DB["cursor"] / 20)


def whoosh(v, N, R):
    """Whoosh gravado em cada pico de velocidade, com o pico do som no pico do movimento e o volume pela velocidade."""
    out = np.zeros((N, 2))
    for name, x, vref, f, pan in (
        ("câmera", v["vcam"], 5200, "whoosh-camera.wav", None),  # Mixkit 168 "Fast air sweep transition"
        ("cursor", v["vcur"], 2600, "whoosh-cursor.wav", v["cpan"]),  # Mixkit 166 "Fast small sweep transition"
    ):
        y = load(f, hp=120) * REF
        w = int(0.03 * SR)
        at = np.argmax(np.convolve(y**2, np.ones(w) / w, "same")) / SR  # onde o som é mais forte
        s = np.convolve(x, np.ones(25) / 25, "same")
        for i in find_peaks(s, height=vref * 0.15, distance=int(0.6 * R))[0]:
            db = MOV_DB[name] + 20 * np.log10(min(1, s[i] / vref) ** 0.6)
            j = int(round((i / R - at) * SR))
            yy = y[max(0, -j) :][: N - max(j, 0)] * 10 ** (db / 20)
            l, r = pan_gains(float(pan[i]) if pan is not None else 0.0)
            out[max(j, 0) : max(j, 0) + len(yy)] += np.stack([yy * l, yy * r], 1)
    return out


def efeitos(ev, cliques="mouse2", movimento="sopro", vendas="dogama", numeros="bipe"):
    """Uma faixa estéreo por categoria."""
    N = int(round(ev["DUR"] * SR))
    R = ev["R"]
    stems = {k: np.zeros((N, 2)) for k in ("cliques", "movimento", "vendas", "numeros")}
    v = velocidades(ev)

    def pontuais(cat, spec, times, pan=lambda t: 0.0):
        if spec is None:
            return
        f, a, d, hp, lp, atk, db = spec
        y0 = load(f, a, d, hp, lp) * REF
        for t in times:
            i = int(round((t - atk) * SR))
            y = y0[: N - i] * 10 ** (db / 20)
            l, r = pan_gains(pan(t))
            stems[cat][i : i + len(y), 0] += y * l
            stems[cat][i : i + len(y), 1] += y * r

    # o clique sai do lado da tela onde o cursor está
    pontuais("cliques", CLIQUES.get(cliques), ev["click"], lambda t: float(np.clip((v["cx"][int(t * R)] / 1440 - 0.5) * 0.8, -0.4, 0.4)))
    pontuais("vendas", VENDAS.get(vendas), ev["sale"])
    pontuais("numeros", NUMEROS.get(numeros), ev["tock"])
    if movimento == "sopro":
        stems["movimento"] = sopro(v, N)
    elif movimento == "whoosh":
        stems["movimento"] = whoosh(v, N, R)
    return stems


def musica(raw, ev, abafar=True):
    """Fade de 0,3 s na entrada e 1,2 s na saída, loudness em MUS_LUFS, como na página de audição.
    Com abafar: passa-baixa de 2,2 kHz até o drop, aberta depois e volta ao filtro nos últimos 1,9 s."""
    N = int(round(ev["DUR"] * SR))
    y = np.pad(raw, ((0, max(0, N - len(raw))), (0, 0)))[:N].copy()
    y[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
    y[-int(1.2 * SR) :] *= np.linspace(1, 0, int(1.2 * SR))[:, None]
    y *= 10 ** ((MUS_LUFS - pyln.Meter(SR).integrated_loudness(y)) / 20) * VOL_MUS
    if not abafar:
        return y
    tN = np.arange(N) / SR
    opn = np.clip((tN - (ev["drop"] - 0.05)) / 0.05, 0, 1) * np.clip((ev["DUR"] - tN) / 1.9, 0, 1)
    wet = sosfilt(butter(2, 2200, "lowpass", fs=SR, output="sos"), y, axis=0)
    return wet * (1 - opn)[:, None] + y * opn[:, None]


def mixar(mus, stems):
    mix = mus + sum(stems.values()) * VOL_FX
    fade = int(0.02 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)[:, None]
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return mix


def relatorio(mus, stems, ev):
    """Pico de 30 ms de cada efeito contra o RMS da música em volta (1 s), acima de 300 Hz, onde a música mascara."""
    db = lambda x: 20 * np.log10(max(x, 1e-9))
    hp = lambda y: sosfilt(butter(2, 300, "highpass", fs=SR, output="sos"), y, axis=0)
    m = hp(mus.mean(1))
    mrms = lambda t: np.sqrt((m[int((t - 0.5) * SR) : int((t + 0.5) * SR)] ** 2).mean())
    print("efeito     tempo    sobre a música (> 300 Hz)")
    for name, cat, ts in (("clique", "cliques", ev["click"]), ("venda", "vendas", ev["sale"]), ("número", "numeros", ev["tock"])):
        s = hp(stems[cat].mean(1))
        for t in ts:
            print(f"{name:9} {t:6.2f}   {db(peak_rms(s[int((t - 0.05) * SR) : int((t + 0.6) * SR)])) - db(mrms(t)):+5.1f} dB")
    s = hp(stems["movimento"].mean(1))
    if s.any():
        w = int(0.03 * SR)
        pk = np.argmax(np.convolve(s**2, np.ones(w) / w, "same")) / SR
        print(f"movimento {pk:6.2f}   {db(peak_rms(s)) - db(mrms(pk)):+5.1f} dB (pico)")


if __name__ == "__main__":
    ev = json.load(open(sys.argv[1]))
    raw, _ = sf.read(sys.argv[2], always_2d=True)
    mus = musica(raw, ev)
    stems = efeitos(ev)
    mix = mixar(mus, stems)
    sf.write(sys.argv[3], mix.astype(np.float32), SR, subtype="FLOAT")
    relatorio(mus, {k: v * VOL_FX for k, v in stems.items()}, ev)
