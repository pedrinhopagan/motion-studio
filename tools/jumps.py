# python3 tools/jumps.py <frames-dir>
# Procura saltos de um quadro: diferença entre quadros vizinhos muito acima da vizinhança (inclui a costura do loop).
import subprocess, sys
import numpy as np

N = 240
raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", f"{sys.argv[1]}/%04d.png", "-vf", f"scale={N}:{N}:flags=area,format=gray", "-f", "rawvideo", "-"],
    capture_output=True, check=True,
).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, N, N).astype(np.float32)
n = len(f)
# d[i] = mudança do quadro i-1 para i; d[0] é a costura 1079 → 0
d = np.array([np.abs(f[i] - f[i - 1]).mean() for i in range(n)])
flag = []
for i in range(n):
    viz = np.delete(d[[(i + k) % n for k in range(-4, 5)]], 4)
    ref = np.median(viz)
    if d[i] > 0.4 and d[i] > 3 * ref + 0.15:
        flag.append((i, d[i], ref))
print(f"{n} quadros; diferença média {d.mean():.3f}, máxima {d.max():.3f} no quadro {d.argmax()}; costura {d[0]:.3f}")
for i, v, r in flag:
    print(f"salto no quadro {i} (t={i / 60:.3f} s): {v:.3f} contra vizinhança {r:.3f}")
if not flag:
    print("nenhum salto de um quadro")
