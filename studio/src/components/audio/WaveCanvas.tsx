import { useEffect, useRef, useState } from "react";
import { peaksPerSecond } from "@/lib/audio";

// Barras de pico do trecho [from, to] (segundos do arquivo). A cor de cada
// barra vem de uma variável CSS escolhida por `tone`, pela posição de 0 a 1.
export function WaveCanvas({
  peaks,
  from,
  to,
  tone,
  className,
}: {
  peaks: Float32Array;
  from: number;
  to: number;
  tone?: (position: number) => { color: string; gain?: number };
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    observer.observe(canvas.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    const { width, height } = size;
    if (!element || !context || !width || !height) {
      return;
    }
    const ratio = devicePixelRatio;
    element.width = width * ratio;
    element.height = height * ratio;
    context.scale(ratio, ratio);
    const styles = getComputedStyle(element);
    const colors = new Map<string, string>();
    const color = (name: string) => {
      if (!colors.has(name)) {
        colors.set(name, styles.getPropertyValue(name));
      }
      return colors.get(name)!;
    };
    const bar = 2;
    const step = bar + 1;
    const count = Math.floor(width / step);
    const span = (to - from) / count;
    // Altura relativa ao maior pico do trecho, para sons baixos não sumirem.
    let loudest = 0;
    const edge = Math.min(peaks.length, Math.ceil(to * peaksPerSecond));
    for (
      let bucket = Math.max(0, Math.floor(from * peaksPerSecond));
      bucket < edge;
      bucket++
    ) {
      loudest = Math.max(loudest, peaks[bucket]);
    }
    for (let index = 0; index < count; index++) {
      const first = Math.max(
        0,
        Math.floor((from + index * span) * peaksPerSecond),
      );
      const last = Math.min(
        peaks.length,
        Math.ceil((from + (index + 1) * span) * peaksPerSecond),
      );
      let peak = 0;
      for (let bucket = first; bucket < last; bucket++) {
        peak = Math.max(peak, peaks[bucket]);
      }
      if (!peak) {
        continue;
      }
      const shade = tone?.(index / count) ?? { color: "--wave-active" };
      const barHeight = Math.max(
        1.5,
        (peak / loudest) * (shade.gain ?? 1) * (height - 2),
      );
      context.fillStyle = color(shade.color);
      context.fillRect(index * step, (height - barHeight) / 2, bar, barHeight);
    }
  });

  return <canvas ref={canvas} className={className} aria-hidden />;
}
