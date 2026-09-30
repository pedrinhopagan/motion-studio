import { useMemo, type KeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  LoaderCircle,
  Music2,
  RotateCcw,
  Save,
  Timer,
  Play,
  Pause,
  Check,
} from "lucide-react";
import {
  applyAuditionChoices,
  auditionChoices,
  type Audition,
  type AuditionChoices,
  type MusicOption,
  type Project,
  type SoundLayer,
} from "@shared/contracts";
import type { Clock } from "@/lib/clock";
import { selectedOption } from "@/lib/audio";
import { audioTitle, cn, formatDuration, shortTime } from "@/lib/format";
import { useStudioWrite } from "@/lib/api";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { useCopy } from "@/components/ui/Toast";

const muffleLevels = [
  { value: "4000", label: "Leve" },
  { value: "2200", label: "Média" },
  { value: "900", label: "Forte" },
];
const percent = (value: number) => `${Math.round(value * 100)}%`;

// As candidatas preparadas pelo agent ou, sem elas, os áudios do projeto que
// não são opção de efeito.
export function musicCandidates(project: Project): MusicOption[] {
  const { audition, id } = project.manifest;
  if (audition.music.length) {
    return audition.music;
  }
  const effects = new Set(
    audition.effects.flatMap((layer) =>
      layer.options.map((option) => option.file),
    ),
  );
  return project.files
    .filter((file) => file.kind === "audio" && !effects.has(file.path))
    .sort(
      (a, b) =>
        Number(a.group === "renders") - Number(b.group === "renders") ||
        a.path.localeCompare(b.path, "pt-BR"),
    )
    .map((file) => ({
      file: file.path,
      label:
        file.group === "renders"
          ? `Mixagem da ${file.version}`
          : audioTitle(file.path),
      description: file.path
        .split("/")
        .slice(0, -1)
        .filter((part) => part !== id)
        .join("/"),
      offset: 0,
    }));
}

export function musicLabel(audition: Audition, candidates: MusicOption[]) {
  return (
    candidates.find((candidate) => candidate.file === audition.track)?.label ??
    audioTitle(audition.track)
  );
}

export function auditionSummary(audition: Audition, candidates: MusicOption[]) {
  const { muffle } = audition;
  const music = audition.track
    ? [
        `Música: ${musicLabel(audition, candidates)} (${audition.track})`,
        `começa em ${shortTime(audition.offset)} da faixa`,
        `volume ${percent(audition.volume)}`,
        audition.fadeIn ? `entrada suave de ${shortTime(audition.fadeIn)}` : "",
        audition.fadeOut ? `saída suave de ${shortTime(audition.fadeOut)}` : "",
        muffle.enabled
          ? `abafada até ${shortTime(muffle.until)} do vídeo (passa-baixa em ${muffle.cutoff} Hz)`
          : "",
      ]
        .filter(Boolean)
        .join(", ")
    : "Música: nenhuma";
  const effects = audition.effects.map((layer) => {
    const option = selectedOption(layer);
    return option
      ? `${layer.name}: ${option.label} (${option.file}), volume ${percent(layer.volume)}`
      : `${layer.name}: sem som`;
  });
  return [
    music,
    ...effects,
    `Áudio original do render: ${percent(audition.originalVolume)}`,
  ]
    .map((line) => `${line}.`)
    .join("\n");
}

export function TrackPanel({
  project,
  audition,
  choices,
  onChange,
  clock,
  duration,
  canPreview,
  playing,
  musicLoading,
  focused,
  cursor,
  onFocus,
  onListen,
  onHit,
  onSample,
}: {
  project: Project;
  audition: Audition;
  choices: AuditionChoices;
  onChange: (choices: AuditionChoices) => void;
  clock: Clock;
  duration: number;
  canPreview: boolean;
  playing: boolean;
  musicLoading: boolean;
  focused?: string;
  cursor?: { layer: string; index: number };
  onFocus: (layer?: string) => void;
  onListen: () => void;
  onHit: (layer: string, index: number) => void;
  onSample: (layer: SoundLayer, file: string) => void;
}) {
  const id = project.manifest.id;
  const saved = project.manifest.audition;
  const savedChoices = JSON.stringify(auditionChoices(saved));
  const dirty =
    JSON.stringify(auditionChoices(applyAuditionChoices(saved, choices))) !==
    savedChoices;
  const copy = useCopy();
  const { mutate: save, isPending: saving } = useStudioWrite<AuditionChoices>({
    path: `/api/projects/${id}/audition`,
    method: "PUT",
    message: "Trilha salva no projeto.",
  });
  const candidates = useMemo(() => musicCandidates(project), [project]);
  const tracks = ["", ...candidates.map((candidate) => candidate.file)];
  const set = (values: Partial<AuditionChoices>) =>
    onChange({ ...choices, ...values });

  function pick(track: string) {
    const candidate = candidates.find((entry) => entry.file === track);
    set({
      track,
      offset:
        track === choices.track ? choices.offset : (candidate?.offset ?? 0),
    });
    if (canPreview && track && !playing) {
      onListen();
    }
  }

  function handleKey(event: KeyboardEvent) {
    const index = tracks.indexOf(choices.track);
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
    };
    const next = moves[event.key];

    if (tracks[next] !== undefined) {
      event.preventDefault();
      pick(tracks[next]);
      document.getElementById(`track-${next}`)?.focus();
    }
  }

  return (
    <div className="track-panel">
      <header className="panel-heading">
        <div>
          <h3>
            <Music2 size={17} /> Trilha e efeitos
          </h3>
          <p>
            Compare as músicas na prévia e ajuste os sons no tempo de cada cena.
          </p>
        </div>
        <div className="track-heading-actions">
          {dirty && <span className="dirty-badge">Não salvo</span>}
          <button
            className="button small"
            disabled={!canPreview}
            onClick={onListen}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pausar prévia" : "Ouvir na prévia"}
          </button>
        </div>
      </header>

      {!canPreview && (
        <div className="callout">
          <Info size={16} />
          <p>
            Abra uma composição ou um render na prévia para ouvir em sincronia.
          </p>
        </div>
      )}

      <section
        className="track-section music-section"
        aria-labelledby="music-title"
      >
        <div className="field-title">
          <h4 id="music-title">Música</h4>
          <span>
            {candidates.length}{" "}
            {candidates.length === 1 ? "candidata" : "candidatas"}
          </span>
        </div>
        <div
          className="track-list"
          role="radiogroup"
          aria-labelledby="music-title"
          onKeyDown={handleKey}
        >
          {tracks.map((path, index) => {
            const candidate = candidates[index - 1];
            const checked = choices.track === path;
            const length = project.media[path]?.duration;
            return (
              <button
                key={path || "none"}
                id={`track-${index}`}
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={cn("track-option", checked && "selected")}
                onClick={() => pick(path)}
              >
                <Music2 size={14} />
                <span>
                  {candidate?.label ?? "Sem música"}
                  <small>
                    {candidate
                      ? candidate.description
                      : audition.effects.length
                        ? "Só os efeitos"
                        : "Toca o áudio do render"}
                  </small>
                </span>
                {length !== undefined && (
                  <small className="track-length">
                    {formatDuration(length)}
                  </small>
                )}
                {checked && !musicLoading && (
                  <Check size={15} className="track-check" />
                )}
                {checked && musicLoading && (
                  <LoaderCircle size={14} className="spin" />
                )}
              </button>
            );
          })}
        </div>

        {!!audition.track && (
          <div
            className="music-settings"
            aria-label="Ajustes da música selecionada"
          >
            <div className="selected-track-heading">
              <span>Ajustes da música</span>
              <strong>{musicLabel(audition, candidates)}</strong>
            </div>
            <Slider
              label="Volume da música"
              value={audition.volume}
              max={2}
              onChange={(volume) => set({ volume })}
            />
            <label className="inline-field">
              <span>
                Começa em
                <small>ou arraste a faixa sob o mapa</small>
              </span>
              <span className="number-input">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={audition.offset}
                  onChange={(event) =>
                    set({ offset: Math.max(0, Number(event.target.value)) })
                  }
                />
                <span>s da faixa</span>
              </span>
            </label>
            <div className="field-grid two">
              <label>
                Entrada suave
                <span className="number-input">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={audition.fadeIn}
                    onChange={(event) =>
                      set({ fadeIn: clampFade(event.target.value) })
                    }
                  />
                  <span>s</span>
                </span>
              </label>
              <label>
                Saída suave
                <span className="number-input">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={audition.fadeOut}
                    onChange={(event) =>
                      set({ fadeOut: clampFade(event.target.value) })
                    }
                  />
                  <span>s</span>
                </span>
              </label>
            </div>
            <MuffleField
              audition={audition}
              duration={duration}
              clock={clock}
              onChange={(muffle) => set({ muffle })}
            />
          </div>
        )}
      </section>

      <section
        className="track-section effects-section"
        aria-labelledby="effects-title"
      >
        <div className="field-title">
          <h4 id="effects-title">Efeitos</h4>
          <a href="#/sounds">Biblioteca de sons</a>
        </div>
        {!audition.effects.length && (
          <p className="helper">
            Nenhum efeito marcado nesta peça. Peça ao agent opções de som para
            os momentos que quer destacar.
          </p>
        )}
        <div className="layer-list">
          {audition.effects.map((layer) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              focused={focused === layer.id}
              position={cursor?.layer === layer.id ? cursor.index : undefined}
              onFocus={() => onFocus(layer.id)}
              onHit={(index) => onHit(layer.id, index)}
              onPick={(selected) => {
                set({
                  effects: {
                    ...choices.effects,
                    [layer.id]: { selected, volume: layer.volume },
                  },
                });
                if (!playing && selected) {
                  onSample(layer, selected);
                }
              }}
              onVolume={(volume) =>
                set({
                  effects: {
                    ...choices.effects,
                    [layer.id]: { selected: layer.selected, volume },
                  },
                })
              }
            />
          ))}
        </div>
      </section>

      <section className="track-section">
        <div className="field-title">
          <h4>Mixagem</h4>
        </div>
        <Slider
          label="Áudio original do render"
          value={audition.originalVolume}
          onChange={(originalVolume) => set({ originalVolume })}
        />
      </section>

      <footer className="panel-actions">
        <button
          className="button small ghost copy-track"
          aria-label="Copiar resumo da trilha"
          data-tooltip="Copiar resumo"
          onClick={() =>
            void copy(
              auditionSummary(audition, candidates),
              "Resumo da trilha copiado.",
            )
          }
        >
          <Copy size={16} />
          Copiar decisões
        </button>
        <button
          className="button small ghost"
          disabled={!dirty || saving}
          onClick={() => onChange(auditionChoices(saved))}
        >
          <RotateCcw size={14} />
          Descartar
        </button>
        <button
          className="button small primary"
          disabled={!dirty || saving}
          onClick={() => save(choices)}
        >
          <Save size={14} />
          {saving ? "Salvando…" : "Salvar trilha"}
        </button>
      </footer>
    </div>
  );
}

function LayerCard({
  layer,
  focused,
  position,
  onFocus,
  onHit,
  onPick,
  onVolume,
}: {
  layer: SoundLayer;
  focused: boolean;
  position?: number;
  onFocus: () => void;
  onHit: (index: number) => void;
  onPick: (file: string) => void;
  onVolume: (volume: number) => void;
}) {
  const order = layer.hits
    .map((_, index) => index)
    .sort((a, b) => layer.hits[a].time - layer.hits[b].time);
  const current = position === undefined ? -1 : order.indexOf(position);
  const count = order.length;
  const move = (step: number) => onHit(order[(current + step + count) % count]);
  const choices = [
    ...layer.options.map((option) => ({
      file: option.file,
      label: option.label,
    })),
    { file: "", label: "Nenhum" },
  ];

  return (
    <article
      id={`layer-${layer.id}`}
      className={cn("layer-card", focused && "focused")}
      onClick={onFocus}
    >
      <header>
        <div>
          <strong>{layer.name}</strong>
          <small>
            {count} {count === 1 ? "momento" : "momentos"}
          </small>
        </div>
        {!!count && (
          <div className="layer-nav">
            <button
              className="icon-button"
              aria-label={`Ouvir o momento anterior de ${layer.name}`}
              data-tooltip="Momento anterior"
              onClick={() => move(current < 0 ? 0 : -1)}
            >
              <ChevronLeft size={15} />
            </button>
            {current >= 0 && (
              <span aria-live="polite">
                {current + 1}/{count}
              </span>
            )}
            <button
              className="icon-button"
              aria-label={`Ouvir o próximo momento de ${layer.name}`}
              data-tooltip="Próximo momento"
              onClick={() => move(current < 0 ? 0 : 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </header>
      {!!layer.description && (
        <p className="helper" title={layer.description}>
          {layer.description}
        </p>
      )}
      <div
        className="sound-options"
        role="radiogroup"
        aria-label={`Som de ${layer.name}`}
      >
        {choices.map((choice) => (
          <button
            key={choice.file || "none"}
            role="radio"
            aria-checked={layer.selected === choice.file}
            className={cn(
              "sound-chip",
              layer.selected === choice.file && "selected",
            )}
            title={choice.file || undefined}
            onClick={() => onPick(choice.file)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <Slider
        label="Volume"
        value={layer.volume}
        max={2}
        disabled={!layer.selected}
        onChange={onVolume}
      />
    </article>
  );
}

function MuffleField({
  audition,
  duration,
  clock,
  onChange,
}: {
  audition: Audition;
  duration: number;
  clock: Clock;
  onChange: (muffle: Audition["muffle"]) => void;
}) {
  const { muffle } = audition;
  return (
    <div className="muffle-field">
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={muffle.enabled}
          onChange={(event) =>
            onChange({
              ...muffle,
              enabled: event.target.checked,
              until: muffle.until || Math.round(clock.get() * 100) / 100,
            })
          }
        />
        Abafar a música até um momento do vídeo
      </label>
      <div className="muffle-controls">
        <span className="number-input">
          <input
            type="number"
            aria-label="Abafar até, em segundos do vídeo"
            min="0"
            max={duration}
            step="0.01"
            value={muffle.until}
            disabled={!muffle.enabled}
            onChange={(event) =>
              onChange({
                ...muffle,
                until: Math.max(0, Number(event.target.value)),
              })
            }
          />
          <span>s</span>
        </span>
        <button
          className="button small"
          disabled={!muffle.enabled}
          onClick={() =>
            onChange({ ...muffle, until: Math.round(clock.get() * 100) / 100 })
          }
        >
          <Timer size={14} />
          Tempo atual
        </button>
        <div className="field muffle-level">
          <span>Intensidade</span>
          <Select
            label="Intensidade do abafamento"
            size="sm"
            disabled={!muffle.enabled}
            value={nearestLevel(muffle.cutoff)}
            options={muffleLevels}
            onChange={(value) => onChange({ ...muffle, cutoff: Number(value) })}
          />
        </div>
      </div>
    </div>
  );
}

function clampFade(value: string) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function nearestLevel(cutoff: number) {
  return muffleLevels.reduce((best, level) =>
    Math.abs(Number(level.value) - cutoff) <
    Math.abs(Number(best.value) - cutoff)
      ? level
      : best,
  ).value;
}
