import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useClock, type Clock } from "@/lib/clock";
import { cn, formatTime } from "@/lib/format";

export interface ScrubMarker {
  time: number;
  label: string;
  kind?: "scene" | "cue";
}

export function Scrubber({
  clock,
  duration,
  frameLength,
  markers = [],
  onSeek,
  onScrub,
  disabled = false,
}: {
  clock: Clock;
  duration: number;
  frameLength: number;
  markers?: ScrubMarker[];
  onSeek: (time: number) => void;
  onScrub?: (active: boolean) => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number>();
  const [dragging, setDragging] = useState(false);
  const progress = useClock(clock, (time) =>
    duration ? Math.min(1, time / duration) : 0,
  );
  const label = useClock(clock, formatTime);

  function timeAt(event: PointerEvent) {
    const rect = track.current!.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
      duration
    );
  }

  function handleKey(event: KeyboardEvent) {
    if (disabled) {
      return;
    }

    const step = event.shiftKey ? 1 : frameLength;
    const moves: Record<string, number> = {
      ArrowLeft: clock.get() - step,
      ArrowRight: clock.get() + step,
      PageDown: clock.get() - 5,
      PageUp: clock.get() + 5,
      Home: 0,
      End: duration,
    };
    if (event.key in moves) {
      event.preventDefault();
      event.stopPropagation();
      onSeek(moves[event.key]);
    }
  }

  return (
    <div
      className={cn("scrubber", dragging && "dragging")}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Posição do vídeo"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 100) / 100}
      aria-valuenow={Math.round(progress * duration * 100) / 100}
      aria-valuetext={label}
      onKeyDown={handleKey}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onScrub?.(true);
        onSeek(timeAt(event));
      }}
      onPointerMove={(event) => {
        const time = timeAt(event);
        setHover(time);
        if (dragging) {
          onSeek(time);
        }
      }}
      onPointerUp={() => {
        if (dragging) {
          setDragging(false);
          onScrub?.(false);
        }
      }}
      onPointerCancel={() => {
        setDragging(false);
        onScrub?.(false);
      }}
      onPointerLeave={() => setHover(undefined)}
    >
      <div className="scrubber-track" ref={track}>
        <div
          className="scrubber-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
        {markers
          .filter((marker) => marker.time > 0 && marker.time < duration)
          .map((marker) => (
            <span
              key={`${marker.kind}-${marker.time}`}
              className={cn("scrubber-marker", marker.kind ?? "scene")}
              style={{ left: `${(marker.time / duration) * 100}%` }}
              title={marker.label}
            />
          ))}
        <div
          className="scrubber-thumb"
          style={{ left: `${progress * 100}%` }}
        />
        {hover !== undefined && (
          <span
            className="scrubber-hover"
            style={{
              left: `clamp(48px, ${(hover / duration) * 100}%, calc(100% - 48px))`,
            }}
            aria-hidden
          >
            {formatTime(hover)}
            {hoverLabel(markers, hover)}
          </span>
        )}
      </div>
    </div>
  );
}

function hoverLabel(markers: ScrubMarker[], time: number) {
  const scene = markers
    .filter((marker) => (marker.kind ?? "scene") === "scene")
    .findLast((marker) => marker.time <= time);
  return scene ? <small>{scene.label}</small> : null;
}
