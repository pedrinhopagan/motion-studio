import { useCallback, useEffect, useRef, useState } from "react";
import type { Clock } from "@/lib/clock";

export type Playback = ReturnType<typeof usePlayback>;

// Estado do transporte de um <video>. O tempo corre no relógio a cada quadro;
// o React só renderiza quando tocar, pausar ou a configuração mudam.
export function usePlayback({
  clock,
  fps,
  fallbackDuration,
  onFrame,
  beforePlay,
}: {
  clock: Clock;
  fps: number;
  fallbackDuration: number;
  onFrame?: (time: number, playing: boolean, rate: number) => void;
  beforePlay?: () => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | undefined>(undefined);
  const frame = useRef(onFrame);
  frame.current = onFrame;
  const prepare = useRef(beforePlay);
  prepare.current = beforePlay;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const length = duration || fallbackDuration;

  const publish = useCallback(() => {
    const element = video.current;
    if (element) {
      clock.set(element.currentTime);
      frame.current?.(
        element.currentTime,
        !element.paused && !element.ended,
        element.playbackRate,
      );
    }
  }, [clock]);

  useEffect(() => {
    if (!playing) {
      publish();
      return;
    }
    let handle = requestAnimationFrame(function tick() {
      publish();
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  }, [playing, publish]);

  useEffect(() => {
    if (video.current) {
      video.current.playbackRate = speed;
    }
    publish();
  }, [speed, publish]);

  const seek = useCallback(
    (value: number) => {
      const element = video.current;
      const next = Math.max(0, Math.min(value, length));
      if (element && element.readyState > 0) {
        element.currentTime = next;
        publish();
      } else {
        pendingSeek.current = next;
      }
      clock.set(next);
    },
    [clock, length, publish],
  );

  const toggle = useCallback(() => {
    const element = video.current;
    if (!element) {
      return;
    }
    if (element.paused || element.ended) {
      void prepare.current?.();
      element.play().catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(
            "Não foi possível reproduzir este vídeo. Baixe o arquivo para abri-lo em outro player.",
          );
        }
      });
    } else {
      element.pause();
    }
  }, []);

  const step = useCallback(
    (seconds: number) => {
      video.current?.pause();
      seek(clock.get() + seconds);
    },
    [clock, seek],
  );

  const pause = useCallback(() => video.current?.pause(), []);

  // Recomeça do zero quando o arquivo muda; um seek pendente (vindo de uma
  // anotação em outro render) é aplicado quando os metadados chegam.
  const load = useCallback(
    (time = 0) => {
      setPlaying(false);
      setDuration(0);
      setError("");
      pendingSeek.current = time;
      clock.set(time);
    },
    [clock],
  );

  const videoProps = {
    ref: video,
    loop,
    playsInline: true,
    preload: "auto",
    crossOrigin: "anonymous" as const,
    onLoadedMetadata() {
      const element = video.current!;
      element.playbackRate = speed;
      setDuration(Number.isFinite(element.duration) ? element.duration : 0);
      if (pendingSeek.current !== undefined) {
        element.currentTime = pendingSeek.current;
        pendingSeek.current = undefined;
      }
      publish();
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onSeeked: publish,
    onTimeUpdate() {
      if (video.current?.paused) {
        publish();
      }
    },
    onError: () =>
      setError(
        "O navegador não conseguiu abrir este render. Baixe o arquivo ou escolha outra versão.",
      ),
  };

  return {
    video,
    videoProps,
    playing,
    duration: length,
    frameLength: 1 / fps,
    error,
    speed,
    setSpeed,
    loop,
    setLoop,
    muted,
    setMuted,
    volume,
    setVolume,
    toggle,
    seek,
    step,
    pause,
    load,
  };
}
