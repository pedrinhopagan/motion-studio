import { useCallback, useEffect, useRef, useState } from "react";
import { livePreviewStatusSchema } from "@shared/contracts";
import type { Clock } from "@/lib/clock";

export type LivePlayback = ReturnType<typeof useLivePlayback>;

export function useLivePlayback({
  clock,
  fps,
  duration,
  origin,
  revision,
  enabled,
  onFrame,
  beforePlay,
}: {
  clock: Clock;
  fps: number;
  duration: number;
  origin: string;
  revision: string;
  enabled: boolean;
  onFrame: (time: number, playing: boolean, rate: number) => void;
  beforePlay: () => Promise<void>;
}) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const active = useRef(false);
  const frame = useRef(onFrame);
  const prepare = useRef(beforePlay);
  frame.current = onFrame;
  prepare.current = beforePlay;

  const publish = useCallback(
    (time: number, active: boolean, rate: number) => {
      clock.set(time);
      iframe.current?.contentWindow?.postMessage(
        { type: "motion-studio:seek", time },
        origin,
      );
      frame.current(time, active, rate);
    },
    [clock, origin],
  );

  useEffect(() => {
    setReady(false);
    setError("");
    setPlaying(false);
    active.current = false;

    if (!enabled) {
      return;
    }

    const deadline = setTimeout(() => {
      setError(
        "A composição não ficou pronta. Abra a fonte em outra aba para conferir o carregamento.",
      );
    }, 18000);

    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== origin ||
        event.source !== iframe.current?.contentWindow
      ) {
        return;
      }

      const result = livePreviewStatusSchema.safeParse(event.data);

      if (!result.success) {
        return;
      }

      clearTimeout(deadline);
      setReady(result.data.ready);
      setError(result.data.error ?? "");

      if (result.data.ready) {
        publish(clock.get(), false, 1);
      } else {
        active.current = false;
        setPlaying(false);
      }
    };

    addEventListener("message", receive);
    return () => {
      clearTimeout(deadline);
      active.current = false;
      removeEventListener("message", receive);
      frame.current(clock.get(), false, 1);
    };
  }, [enabled, revision, origin, clock, publish]);

  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }

    if (!playing) {
      publish(clock.get(), false, speed);
      return;
    }

    let previous = performance.now();
    let handle = requestAnimationFrame(function tick(now) {
      const next = clock.get() + ((now - previous) / 1000) * speed;
      previous = now;

      if (next >= duration && !loop) {
        active.current = false;
        publish(duration, false, speed);
        setPlaying(false);
        return;
      }

      publish(next >= duration ? next % duration : next, true, speed);
      handle = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(handle);
  }, [clock, duration, enabled, loop, playing, publish, ready, speed]);

  const seek = useCallback(
    (time: number) => {
      publish(Math.max(0, Math.min(time, duration)), playing, speed);
    },
    [duration, playing, publish, speed],
  );

  const pause = useCallback(() => {
    active.current = false;
    setPlaying(false);
    frame.current(clock.get(), false, speed);
  }, [clock, speed]);

  const toggle = useCallback(async () => {
    if (!ready) {
      return;
    }

    if (active.current) {
      pause();
      return;
    }

    if (clock.get() >= duration) {
      seek(0);
    }

    active.current = true;

    try {
      await prepare.current();

      if (active.current) {
        setPlaying(true);
      }
    } catch {
      active.current = false;
      setError(
        "Não foi possível iniciar o áudio da composição. Recarregue a prévia.",
      );
    }
  }, [clock, duration, pause, ready, seek]);

  const step = useCallback(
    (seconds: number) => {
      pause();
      publish(
        Math.max(0, Math.min(clock.get() + seconds, duration)),
        false,
        speed,
      );
    },
    [clock, duration, pause, publish, speed],
  );

  return {
    iframe,
    ready,
    error,
    playing,
    duration,
    frameLength: 1 / fps,
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
  };
}
