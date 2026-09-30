import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, FolderInput, Pause, Play } from "lucide-react";
import type { Library, Project, ProjectFile } from "@shared/contracts";
import { fileUrl, summaryOptions } from "@/lib/api";
import { createClock, useClock, type Clock } from "@/lib/clock";
import { audioTitle, cn, formatDuration } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/ui/Select";
import { useCopy } from "@/components/ui/Toast";
import { WaveCanvas } from "@/components/audio/WaveCanvas";

type SoundKind = "music" | "effect" | "mix";
const kindLabels: Record<SoundKind, string> = {
  music: "Músicas",
  effect: "Efeitos",
  mix: "Mixagens",
};
interface Sound {
  key: string;
  project: Project;
  file: ProjectFile;
  url: string;
  kind: SoundKind;
  title: string;
  uses: { label: string; chosen: boolean }[];
}

// Cada áudio dos projetos, com o papel que tem na trilha: candidata a música,
// opção de uma camada de efeito ou mixagem de um render.
function soundsOf(data: Library): Sound[] {
  return data.projects.flatMap((project) => {
    const { audition } = project.manifest;
    return project.files
      .filter((file) => file.kind === "audio")
      .map((file) => {
        const music = audition.music.find((entry) => entry.file === file.path);
        const effects = audition.effects.flatMap((layer) =>
          layer.options
            .filter((option) => option.file === file.path)
            .map((option) => ({ layer, option })),
        );
        const uses = [
          ...(music || audition.track === file.path
            ? [
                {
                  label: audition.track === file.path ? "Música" : "Candidata",
                  chosen: audition.track === file.path,
                },
              ]
            : []),
          ...effects.map(({ layer }) => ({
            label: layer.name,
            chosen: layer.selected === file.path,
          })),
        ];
        const kind: SoundKind =
          file.group === "renders"
            ? "mix"
            : effects.length || /\/(sfx|stems)\//.test(file.path)
              ? "effect"
              : "music";
        return {
          key: `${project.manifest.id}:${file.path}`,
          project,
          file,
          url: fileUrl(data.previewOrigin, file),
          kind,
          title:
            effects[0]?.option.label ??
            music?.label ??
            (file.group === "renders"
              ? `Mixagem da ${file.version}`
              : audioTitle(file.path)),
          uses,
        };
      });
  });
}

export function SoundLibrary({
  data,
  search,
}: {
  data: Library;
  search: string;
}) {
  const [kind, setKind] = useState<SoundKind | "all">("all");
  const [projectId, setProjectId] = useState("all");
  const [current, setCurrent] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const clock = useMemo(createClock, []);
  const copy = useCopy();
  const sounds = useMemo(() => soundsOf(data), [data]);
  const query = search.toLocaleLowerCase();
  const inProject = sounds.filter(
    (sound) => projectId === "all" || sound.project.manifest.id === projectId,
  );
  const visible = inProject.filter(
    (sound) =>
      (kind === "all" || sound.kind === kind) &&
      [sound.title, sound.file.path, ...sound.uses.map((use) => use.label)]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
  );
  const groups = (Object.keys(kindLabels) as SoundKind[])
    .map((group) => ({
      group,
      items: visible
        .filter((sound) => sound.kind === group)
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR")),
    }))
    .filter(({ items }) => items.length);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let handle = requestAnimationFrame(function tick() {
      clock.set(audio.current?.currentTime ?? 0);
      handle = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(handle);
  }, [playing, clock]);

  function play(sound: Sound, at?: number) {
    const element = audio.current!;
    if (current !== sound.key) {
      element.src = sound.url;
      setCurrent(sound.key);
      clock.set(at ?? 0);
    }
    if (at !== undefined) {
      element.currentTime = at;
      clock.set(at);
    } else if (!element.paused) {
      element.pause();
      return;
    }
    void element.play();
  }

  if (!sounds.length) {
    return (
      <EmptyState
        title="Nenhum som no acervo ainda"
        description="Músicas e efeitos em assets/<projeto>/audio aparecem aqui, prontos para ouvir e copiar."
      />
    );
  }

  return (
    <div className="page-enter sound-library">
      <div className="page-title">
        <div>
          <h1>Sons</h1>
          <p>
            Músicas, efeitos e mixagens dos projetos. Ouça, compare e copie o
            nome para pedir ao agent.
          </p>
        </div>
        {data.projects.length > 1 && (
          <Select
            label="Projeto"
            size="sm"
            value={projectId}
            options={[
              { value: "all", label: "Todos os projetos" },
              ...data.projects.map((project) => ({
                value: project.manifest.id,
                label: project.manifest.name,
              })),
            ]}
            onChange={setProjectId}
          />
        )}
      </div>
      <div className="filter-row">
        <button
          className={cn(kind === "all" && "selected")}
          onClick={() => setKind("all")}
        >
          Todos <span>{inProject.length}</span>
        </button>
        {(Object.keys(kindLabels) as SoundKind[]).map((value) => (
          <button
            key={value}
            className={cn(kind === value && "selected")}
            onClick={() => setKind(value)}
          >
            {kindLabels[value]}
            <span>
              {inProject.filter((sound) => sound.kind === value).length}
            </span>
          </button>
        ))}
      </div>
      {!groups.length && (
        <EmptyState
          title="Nenhum som encontrado"
          description="Ajuste a busca ou escolha outro tipo de som."
        />
      )}
      {groups.map(({ group, items }) => (
        <section key={group} className="sound-group">
          <h2>
            {kindLabels[group]} <span>{items.length}</span>
          </h2>
          <ul className="sound-list">
            {items.map((sound) => (
              <SoundRow
                key={sound.key}
                sound={sound}
                active={current === sound.key}
                playing={current === sound.key && playing}
                clock={clock}
                showProject={data.projects.length > 1}
                onPlay={(at) => play(sound, at)}
                onCopy={(text, message) => void copy(text, message)}
              />
            ))}
          </ul>
        </section>
      ))}
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}

function SoundRow({
  sound,
  active,
  playing,
  clock,
  showProject,
  onPlay,
  onCopy,
}: {
  sound: Sound;
  active: boolean;
  playing: boolean;
  clock: Clock;
  showProject: boolean;
  onPlay: (at?: number) => void;
  onCopy: (text: string, message: string) => void;
}) {
  const row = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(false);
  const summary = useQuery({ ...summaryOptions(sound.url), enabled: seen });

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(row.current!);
    return () => observer.disconnect();
  }, []);

  const duration = summary.data?.duration;
  return (
    <li ref={row} className={cn("sound-row", active && "active")}>
      <button
        className="sound-play"
        aria-label={`${playing ? "Pausar" : "Tocar"} ${sound.title}`}
        onClick={() => onPlay()}
      >
        {playing ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} fill="currentColor" />
        )}
      </button>
      <div className="sound-info">
        <strong title={sound.title}>{sound.title}</strong>
        <span>
          <code title={sound.file.path}>{sound.file.name}</code>
          {showProject && <small>{sound.project.manifest.name}</small>}
          {sound.uses.map((use) => (
            <small
              key={use.label}
              className={cn("sound-use", use.chosen && "chosen")}
            >
              {use.label}
              {use.chosen && " · em uso"}
            </small>
          ))}
        </span>
      </div>
      <div
        className="sound-wave"
        onClick={(event) => {
          if (duration) {
            const rect = event.currentTarget.getBoundingClientRect();
            onPlay(((event.clientX - rect.left) / rect.width) * duration);
          }
        }}
      >
        {summary.data ? (
          <WaveCanvas
            peaks={summary.data.peaks}
            from={0}
            to={summary.data.duration}
            tone={() => ({ color: "--wave-idle" })}
          />
        ) : (
          <span className="lane-status">
            {summary.isError ? "Não foi possível ler" : ""}
          </span>
        )}
        {active && duration && <Progress clock={clock} duration={duration} />}
      </div>
      <span className="sound-length">
        {duration === undefined ? "" : formatDuration(duration)}
      </span>
      <div className="sound-actions">
        <button
          className="icon-button"
          aria-label={`Copiar o nome ${sound.file.name}`}
          data-tooltip="Copiar nome"
          onClick={() => onCopy(sound.file.name, "Nome do som copiado.")}
        >
          <Copy size={15} />
        </button>
        <button
          className="icon-button"
          aria-label={`Copiar o caminho ${sound.file.path}`}
          data-tooltip="Copiar caminho"
          onClick={() => onCopy(sound.file.path, "Caminho do som copiado.")}
        >
          <FolderInput size={15} />
        </button>
      </div>
    </li>
  );
}

function Progress({ clock, duration }: { clock: Clock; duration: number }) {
  const position = useClock(clock, (time) => Math.min(1, time / duration));
  return (
    <span
      className="sound-progress"
      style={{ width: `${position * 100}%` }}
      aria-hidden
    />
  );
}
