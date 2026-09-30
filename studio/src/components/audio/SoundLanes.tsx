import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Music2 } from "lucide-react";
import type { Audition, SoundLayer } from "@shared/contracts";
import { audioPeaks, selectedOption } from "@/lib/audio";
import { cn, shortTime } from "@/lib/format";
import { WaveCanvas } from "@/components/audio/WaveCanvas";

// Faixas de som alinhadas ao mapa de cenas: a música no trecho que toca com o
// vídeo e uma faixa por camada de efeito, com cada momento em que ela toca.
export function SoundLanes({
  audition,
  duration,
  music,
  musicLabel,
  musicError,
  effects,
  focused,
  onFocus,
  onEdit,
  onSeek,
  onHit,
  onOffset,
}: {
  audition: Audition;
  duration: number;
  music?: AudioBuffer;
  musicLabel: string;
  musicError?: string;
  effects: Map<string, AudioBuffer>;
  focused?: string;
  onFocus: (layer?: string) => void;
  onEdit: (layer?: string) => void;
  onSeek: (time: number) => void;
  onHit: (layer: string, index: number) => void;
  onOffset: (offset: number) => void;
}) {
  const timeAt = (event: { clientX: number }, element: Element) => {
    const rect = element.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration),
    );
  };

  return (
    <>
      <div className="lane lane-music">
        <button className="lane-head" onClick={() => onEdit()}>
          <strong>
            <Music2 size={12} />
            Música
          </strong>
          <small>{audition.track ? musicLabel : "Sem música"}</small>
        </button>
        {audition.track ? (
          <MusicLane
            audition={audition}
            duration={duration}
            buffer={music}
            error={musicError}
            onSeek={onSeek}
            onOffset={onOffset}
          />
        ) : (
          <div
            className="lane-body lane-empty"
            onClick={(event) => onSeek(timeAt(event, event.currentTarget))}
          >
            Escolha uma música no editor abaixo
          </div>
        )}
      </div>
      {audition.effects.map((layer) => (
        <EffectLane
          key={layer.id}
          layer={layer}
          duration={duration}
          buffer={effects.get(layer.selected)}
          focused={focused === layer.id}
          onFocus={() => onEdit(layer.id)}
          onSeek={(event, element) => {
            onFocus(layer.id);
            onSeek(timeAt(event, element));
          }}
          onHit={(index) => onHit(layer.id, index)}
        />
      ))}
    </>
  );
}

function MusicLane({
  audition,
  duration,
  buffer,
  error,
  onSeek,
  onOffset,
}: {
  audition: Audition;
  duration: number;
  buffer?: AudioBuffer;
  error?: string;
  onSeek: (time: number) => void;
  onOffset: (offset: number) => void;
}) {
  const drag = useRef<{ x: number; offset: number; moved: boolean }>(undefined);
  const { offset, muffle, fadeIn, fadeOut } = audition;
  const maxOffset = buffer ? Math.max(0, buffer.duration - 0.01) : 86400;
  const clamp = (value: number) =>
    Math.round(Math.max(0, Math.min(maxOffset, value)) * 100) / 100;

  function handleKey(event: KeyboardEvent) {
    const step = event.shiftKey ? 1 : 0.05;
    const moves: Record<string, number> = {
      ArrowLeft: offset - step,
      ArrowRight: offset + step,
    };
    if (event.key in moves) {
      event.preventDefault();
      event.stopPropagation();
      onOffset(clamp(moves[event.key]));
    }
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) {
      return;
    }
    const delta = event.clientX - state.x;
    if (Math.abs(delta) > 3) {
      state.moved = true;
    }
    if (state.moved) {
      const width = event.currentTarget.getBoundingClientRect().width;
      onOffset(clamp(state.offset - (delta / width) * duration));
    }
  }

  const tone = (position: number) => {
    const time = position * duration;
    const envelope =
      Math.min(1, fadeIn ? time / fadeIn : 1) *
      Math.min(1, fadeOut ? (duration - time) / fadeOut : 1);
    const muffled = muffle.enabled && time < muffle.until;
    return {
      color: muffled ? "--wave-muffled" : "--wave-music",
      gain: Math.max(0.08, envelope),
    };
  };

  return (
    <div
      className="lane-body music-lane"
      role="slider"
      tabIndex={0}
      aria-label="Trecho da música: arraste para mudar o início"
      aria-valuemin={0}
      aria-valuemax={Math.round(maxOffset * 100) / 100}
      aria-valuenow={offset}
      aria-valuetext={`Começa em ${shortTime(offset)} da faixa`}
      title="Arraste para mudar o trecho da música. Clique para ir ao tempo."
      onKeyDown={handleKey}
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, offset, moved: false };
        }
      }}
      onPointerMove={handleMove}
      onPointerUp={(event) => {
        const state = drag.current;
        drag.current = undefined;
        if (state && !state.moved) {
          const rect = event.currentTarget.getBoundingClientRect();
          onSeek(((event.clientX - rect.left) / rect.width) * duration);
        }
      }}
      onPointerCancel={() => (drag.current = undefined)}
    >
      {buffer ? (
        <WaveCanvas
          peaks={audioPeaks(buffer)}
          from={offset}
          to={offset + duration}
          tone={tone}
        />
      ) : (
        <span className={cn("lane-status", error && "failed")}>
          {error ?? "Lendo a faixa…"}
        </span>
      )}
      {muffle.enabled && muffle.until > 0 && muffle.until < duration && (
        <span
          className="lane-cue"
          style={{ left: `${(muffle.until / duration) * 100}%` }}
        >
          abre
        </span>
      )}
    </div>
  );
}

function EffectLane({
  layer,
  duration,
  buffer,
  focused,
  onFocus,
  onSeek,
  onHit,
}: {
  layer: SoundLayer;
  duration: number;
  buffer?: AudioBuffer;
  focused: boolean;
  onFocus: () => void;
  onSeek: (event: { clientX: number }, element: Element) => void;
  onHit: (index: number) => void;
}) {
  const option = selectedOption(layer);
  return (
    <div className={cn("lane lane-effect", focused && "focused")}>
      <button className="lane-head" aria-pressed={focused} onClick={onFocus}>
        <strong>{layer.name}</strong>
        <small>{option?.label ?? "Sem som"}</small>
      </button>
      <div
        className={cn("lane-body", !option && "muted")}
        onClick={(event) => onSeek(event, event.currentTarget)}
      >
        {option?.stem && buffer && (
          <WaveCanvas
            peaks={audioPeaks(buffer)}
            from={option.start}
            to={option.start + duration}
            tone={() => ({ color: "--wave-effect" })}
          />
        )}
        {layer.hits.map((hit, index) => (
          <button
            key={index}
            className={cn("lane-hit", option?.stem && "peak")}
            style={{ left: `${(hit.time / duration) * 100}%` }}
            aria-label={`${layer.name}${hit.label ? `, ${hit.label}` : ""}: ouvir em ${shortTime(hit.time)}`}
            title={`${hit.label ? `${hit.label} · ` : ""}${shortTime(hit.time)}`}
            onClick={(event) => {
              event.stopPropagation();
              onHit(index);
            }}
          />
        ))}
      </div>
    </div>
  );
}
