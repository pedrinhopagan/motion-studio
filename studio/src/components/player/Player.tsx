import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Play,
  Pause,
  StepBack,
  StepForward,
  Repeat2,
  Maximize2,
  Minimize2,
  Download,
  Volume2,
  VolumeX,
  Info,
  LoaderCircle,
} from "lucide-react";
import { useClock, type Clock } from "@/lib/clock";
import { cn, formatTime } from "@/lib/format";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Scrubber, type ScrubMarker } from "@/components/player/Scrubber";
import type { Playback } from "@/components/player/usePlayback";
import type { LivePlayback } from "@/components/player/useLivePlayback";

const speeds = ["0.25", "0.5", "1", "1.5", "2"].map((value) => ({
  value,
  label: `${value.replace(".", ",")}×`,
}));

export function Player({
  playback,
  clock,
  src,
  poster,
  downloadUrl,
  markers,
  overlay,
  sourceRevision,
  aspectRatio,
}: {
  playback: Playback | LivePlayback;
  clock: Clock;
  src: string;
  poster?: string;
  downloadUrl: string;
  markers?: ScrubMarker[];
  overlay?: ReactNode;
  sourceRevision?: string;
  aspectRatio?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const resume = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const toast = useToast();
  const { playing, duration, frameLength, error, toggle, seek, step } =
    playback;
  const live = "iframe" in playback;
  const available = !live || playback.ready;

  useEffect(() => {
    const change = () =>
      setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      root.current
        ?.requestFullscreen()
        .catch(() =>
          toast("A tela cheia não está disponível neste navegador.", "error"),
        );
    }
  }

  // Atalhos valem na página toda, menos enquanto se digita ou com um controle
  // que já usa a tecla (botões com Espaço, sliders com as setas).
  const keys = useRef<(event: KeyboardEvent) => void>(undefined);
  keys.current = (event) => {
    const target = event.target as HTMLElement;
    if (
      event.defaultPrevented ||
      !available ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      target.closest("input, textarea, select, [contenteditable], dialog")
    ) {
      return;
    }
    const interactive = target.closest(
      "button, a, [role=slider], [role=combobox], [role=listbox]",
    );
    const actions: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      ArrowLeft: () => step(-(event.shiftKey ? 1 : frameLength)),
      ArrowRight: () => step(event.shiftKey ? 1 : frameLength),
      Home: () => seek(0),
      m: () => playback.setMuted(!playback.muted),
      f: toggleFullscreen,
    };
    const action =
      actions[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (
      action &&
      !(interactive && (event.key === " " || event.key.startsWith("Arrow")))
    ) {
      event.preventDefault();
      action();
    }
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => keys.current?.(event);
    addEventListener("keydown", handle);
    return () => removeEventListener("keydown", handle);
  }, []);

  const VolumeIcon =
    playback.muted || playback.volume === 0 ? VolumeX : Volume2;

  return (
    <div
      className={cn(
        "player",
        live && "player-live",
        fullscreen && "is-fullscreen",
      )}
      ref={root}
    >
      <div className="player-stage">
        {live ? (
          <iframe
            key={sourceRevision}
            ref={playback.iframe}
            className="source-preview"
            style={
              { aspectRatio, "--source-ratio": aspectRatio } as CSSProperties
            }
            title="Composição atual ao vivo"
            sandbox="allow-scripts allow-same-origin"
            src={src}
            tabIndex={-1}
          />
        ) : (
          <video
            {...playback.videoProps}
            src={src}
            poster={poster}
            onClick={toggle}
            onDoubleClick={toggleFullscreen}
          />
        )}
        {live && !available && !error && (
          <div className="stage-loading" role="status">
            <LoaderCircle size={24} className="spin" />
            <span>Carregando composição…</span>
          </div>
        )}
        {live && available && (
          <button
            className="source-surface"
            aria-label={playing ? "Pausar composição" : "Reproduzir composição"}
            onClick={toggle}
            onDoubleClick={toggleFullscreen}
          />
        )}
        {!live && !playing && !error && (
          <button
            className="stage-play"
            aria-label="Reproduzir vídeo"
            onClick={toggle}
          >
            <Play size={26} fill="currentColor" />
          </button>
        )}
        {!!error && (
          <div className="stage-error" role="alert">
            <Info size={22} />
            <p>{error}</p>
            <a
              className="button small"
              href={live ? src.split("?")[0] : downloadUrl}
              target={live ? "_blank" : undefined}
              rel="noreferrer"
            >
              {live ? "Abrir fonte em outra aba" : "Baixar render"}
            </a>
          </div>
        )}
        {overlay}
      </div>
      <div className="player-controls">
        <Scrubber
          clock={clock}
          duration={duration}
          frameLength={frameLength}
          markers={markers}
          disabled={!available}
          onSeek={seek}
          onScrub={(active) => {
            if (active) {
              resume.current = playing;
              playback.pause();
            } else if (resume.current) {
              toggle();
            }
          }}
        />
        <div className="transport">
          <div className="transport-group">
            <button
              className="icon-button"
              aria-label="Voltar um quadro"
              data-tooltip="Quadro anterior (←)"
              onClick={() => step(-frameLength)}
              disabled={!available}
            >
              <StepBack size={17} />
            </button>
            <button
              className="transport-play"
              aria-label={playing ? "Pausar" : "Reproduzir"}
              data-tooltip={playing ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}
              onClick={toggle}
              disabled={!available}
            >
              {playing ? (
                <Pause size={17} fill="currentColor" />
              ) : (
                <Play size={17} fill="currentColor" />
              )}
            </button>
            <button
              className="icon-button"
              aria-label="Avançar um quadro"
              data-tooltip="Próximo quadro (→)"
              onClick={() => step(frameLength)}
              disabled={!available}
            >
              <StepForward size={17} />
            </button>
            <Timecode clock={clock} duration={duration} />
          </div>
          <div className="transport-group">
            <Select
              label="Velocidade de reprodução"
              size="sm"
              variant="ghost"
              value={String(playback.speed)}
              options={speeds}
              onChange={(value) => playback.setSpeed(Number(value))}
            />
            <div className="volume-control">
              <button
                className="icon-button"
                aria-label={playback.muted ? "Ativar áudio" : "Silenciar áudio"}
                data-tooltip={
                  playback.muted ? "Ativar áudio (M)" : "Silenciar (M)"
                }
                onClick={() => playback.setMuted(!playback.muted)}
              >
                <VolumeIcon size={17} />
              </button>
              <input
                type="range"
                className="range"
                aria-label="Volume"
                min="0"
                max="1"
                step="0.01"
                value={playback.muted ? 0 : playback.volume}
                style={
                  {
                    "--fill": `${(playback.muted ? 0 : playback.volume) * 100}%`,
                  } as CSSProperties
                }
                onChange={(event) => {
                  playback.setVolume(Number(event.target.value));
                  playback.setMuted(false);
                }}
              />
            </div>
            <button
              className={cn("icon-button", playback.loop && "selected")}
              aria-label="Repetir vídeo"
              aria-pressed={playback.loop}
              data-tooltip={
                playback.loop ? "Repetição ligada" : "Repetição desligada"
              }
              onClick={() => playback.setLoop(!playback.loop)}
            >
              <Repeat2 size={17} />
            </button>
            {!live && (
              <a
                className="icon-button"
                aria-label="Baixar render"
                data-tooltip="Baixar render"
                href={downloadUrl}
              >
                <Download size={17} />
              </a>
            )}
            <button
              className="icon-button"
              aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
              data-tooltip={
                fullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Timecode({ clock, duration }: { clock: Clock; duration: number }) {
  const time = useClock(clock, formatTime);
  return (
    <span className="timecode">
      {time}
      <span> / {formatTime(duration)}</span>
    </span>
  );
}
