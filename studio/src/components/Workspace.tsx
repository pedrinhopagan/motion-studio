import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import {
  MonitorPlay,
  MessageSquare,
  SlidersHorizontal,
  FolderOpen,
  LoaderCircle,
  ExternalLink,
  Check,
  Film,
} from "lucide-react";
import {
  applyAuditionChoices,
  auditionChoices,
  type Project,
  type Note,
  type Manifest,
  type OpenFolderInput,
} from "@shared/contracts";
import {
  audioOptions,
  fileUrl,
  mediaUrl,
  thumbnailUrl,
  useStudioWrite,
  write,
} from "@/lib/api";
import { AuditionMixer } from "@/lib/audio";
import { createClock } from "@/lib/clock";
import { cn, shortTime, statusLabels } from "@/lib/format";
import { Timeline, SceneVariants } from "@/components/Timeline";
import { SceneEditor } from "@/components/SceneEditor";
import { ReviewNotes } from "@/components/ReviewNotes";
import { Player } from "@/components/player/Player";
import { usePlayback } from "@/components/player/usePlayback";
import { useLivePlayback } from "@/components/player/useLivePlayback";
import {
  TrackPanel,
  musicCandidates,
  musicLabel,
} from "@/components/audio/TrackPanel";
import { SoundLanes } from "@/components/audio/SoundLanes";
import { Select, type SelectOption } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { FileShareActions } from "@/components/FileShareActions";

type InspectorTab = "project" | "notes";
const inspectorTabs = [
  { id: "project", label: "Projeto", icon: SlidersHorizontal },
  { id: "notes", label: "Anotações", icon: MessageSquare },
] as const;
// Quanto antes de um momento de efeito o vídeo começa, para ver a chegada.
const hitLead = 0.6;

export function Workspace({
  project,
  origin,
  root,
  selected,
  onSelect,
}: {
  project: Project;
  origin: string;
  root: string;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const { manifest } = project;
  const [adjustmentBaseline] = useState(manifest);
  const mainFile =
    manifest.approvedFile ?? project.latestVideo ?? project.source ?? "";
  const [inspector, setInspector] = useState<InspectorTab>("project");
  const [editScenes, setEditScenes] = useState(false);
  const [choices, setChoices] = useState(() =>
    auditionChoices(manifest.audition),
  );
  const [focused, setFocused] = useState<string>();
  const [cursor, setCursor] = useState<{ layer: string; index: number }>();
  const audition = useMemo(
    () => applyAuditionChoices(manifest.audition, choices),
    [manifest.audition, choices],
  );
  const candidates = useMemo(() => musicCandidates(project), [project]);
  const clock = useMemo(createClock, []);
  const mixer = useRef<AuditionMixer>(undefined);
  const selectedFile = project.files.find((file) => file.path === selected);
  const isVideo = selectedFile?.kind === "video";
  const info = project.media[selected];
  const fps = info?.fps || manifest.fps;
  const audioUrl = (path: string) => {
    const file = project.files.find((entry) => entry.path === path);
    return file ? fileUrl(origin, file) : "";
  };
  const music = useQuery(audioOptions(audioUrl(audition.track)));
  const effectFiles = useMemo(
    () => [
      ...new Set(
        manifest.audition.effects.flatMap((layer) =>
          layer.options.map((option) => option.file),
        ),
      ),
    ],
    [manifest.audition.effects],
  );
  const effectBuffers = useQueries({
    queries: effectFiles.map((file) => audioOptions(audioUrl(file))),
    combine: useCallback(
      (results: { data?: AudioBuffer }[]) =>
        new Map(
          results.flatMap((result, index) =>
            result.data ? [[effectFiles[index], result.data] as const] : [],
          ),
        ),
      [effectFiles],
    ),
  });
  const renderPlayback = usePlayback({
    clock,
    fps,
    fallbackDuration: info?.duration || manifest.duration,
    onFrame: (time, playing, rate) =>
      mixer.current?.sync(time, renderPlayback.duration, playing, rate),
    beforePlay: async () => await mixer.current?.resume(),
  });
  const { mutate: chooseVariant, isPending: choosing } = useStudioWrite<{
    scene: string;
    selected: string;
  }>({
    path: ({ scene }) => `/api/projects/${manifest.id}/scenes/${scene}`,
    method: "PATCH",
    message: "Opção da cena escolhida.",
  });

  // A fonte ao vivo recarrega quando qualquer fonte ou asset muda no disco.
  const sourceRevision = useMemo(
    () =>
      project.files
        .filter((file) => file.group === "source" || file.group === "assets")
        .map((file) => `${file.path}:${file.modifiedAt}:${file.size}`)
        .join("|"),
    [project.files],
  );

  const livePlayback = useLivePlayback({
    clock,
    fps: manifest.fps,
    duration: manifest.duration,
    origin,
    revision: `${selected}-${sourceRevision}`,
    enabled: !!selected && !isVideo,
    onFrame: (time, playing, rate) =>
      mixer.current?.sync(time, manifest.duration, playing, rate),
    beforePlay: async () => await mixer.current?.resume(),
  });
  const playback = isVideo ? renderPlayback : livePlayback;
  const { seek } = playback;
  const canPreview = !!selected && (isVideo || livePlayback.ready);
  const sourceUrl = `${mediaUrl(origin, selected)}?render&studio=${encodeURIComponent(location.origin)}`;

  useEffect(() => {
    const instance = new AuditionMixer();
    mixer.current = instance;
    return () => {
      instance.dispose();
      mixer.current = undefined;
    };
  }, []);

  useEffect(() => {
    const element = renderPlayback.video.current;
    if (isVideo && element) {
      mixer.current?.attach(element);
    }
  }, [isVideo, renderPlayback.video]);

  useEffect(() => {
    mixer.current?.setBuffers(
      audition.track ? music.data : undefined,
      effectBuffers,
    );
    mixer.current?.configure(audition);
    mixer.current?.setOutput(playback.volume, playback.muted);
    mixer.current?.sync(
      clock.get(),
      playback.duration,
      playback.playing,
      playback.speed,
    );
  }, [
    audition,
    music.data,
    effectBuffers,
    playback.volume,
    playback.muted,
    playback.duration,
    playback.playing,
    playback.speed,
    clock,
  ]);

  function select(path: string, time = 0) {
    if (path !== selected) {
      playback.pause();
      onSelect(path);
      renderPlayback.load(time);
    } else {
      playback.seek(time);
    }
  }

  function playHit(layer: string, index: number) {
    const hit = audition.effects.find((entry) => entry.id === layer)?.hits[
      index
    ];
    if (!hit) {
      return;
    }
    setFocused(layer);
    setCursor({ layer, index });
    seek(Math.max(0, hit.time - hitLead));
    if (canPreview && !playback.playing) {
      playback.toggle();
    }
  }

  function editAudio(layer?: string) {
    setFocused(layer);
    document
      .getElementById(layer ? `layer-${layer}` : "music-title")
      ?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }

  const variantOptions = manifest.scenes.flatMap((scene) =>
    scene.variants.map((variant) => ({
      value: variant.file,
      label: `${scene.name}: ${variant.label}`,
      hint: scene.selected === variant.file ? "Escolhida" : undefined,
      group: "Opções de cena",
    })),
  );
  const previewOptions: SelectOption<string>[] = [
    ...(project.source
      ? [
          {
            value: project.source,
            label: "Composição ao vivo",
            hint: "Fonte atual em HTML",
            group: "Fonte",
          },
        ]
      : []),
    ...[...project.versions].reverse().flatMap((version) =>
      version.videos.map((file) => ({
        value: file.path,
        label: `${version.name} · ${file.name}`,
        hint:
          file.path === manifest.approvedFile ? "Render escolhido" : undefined,
        group: "Renders",
      })),
    ),
    ...variantOptions,
  ];
  const markers = [
    ...manifest.scenes.map((scene) => ({
      time: scene.start,
      label: scene.name,
    })),
    ...(audition.track && audition.muffle.enabled
      ? [
          {
            time: audition.muffle.until,
            label: "A música abre",
            kind: "cue" as const,
          },
        ]
      : []),
  ];
  const downloadUrl = `${mediaUrl(origin, selected)}?download`;
  const showLanes =
    !!audition.track || !!candidates.length || !!audition.effects.length;

  return (
    <div className="workspace">
      <div className="workspace-main">
        <div className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <MonitorPlay size={16} />
              <span>Prévia</span>
              <span
                className={cn("badge", !isVideo && selected && "badge-live")}
              >
                {isVideo ? "Render" : "Fonte ao vivo"}
              </span>
            </div>
            {!!previewOptions.length && (
              <Select
                label="Arquivo da prévia"
                size="sm"
                variant="ghost"
                className="preview-select"
                value={selected}
                options={previewOptions}
                onChange={(path) => select(path)}
              />
            )}
            {!!selected && (
              <a
                className="icon-button"
                href={mediaUrl(origin, selected)}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir prévia em outra aba"
                data-tooltip="Abrir em outra aba"
              >
                <ExternalLink size={16} />
              </a>
            )}
            {selectedFile && (
              <FileShareActions
                id={manifest.id}
                file={selectedFile}
                root={root}
              />
            )}
          </div>
          {!selected && (
            <div className="empty-stage">
              <Film size={40} strokeWidth={1.5} />
              <h3>Sua composição aparece aqui</h3>
              <p>Adicione uma fonte HTML ou um render nas pastas do projeto.</p>
            </div>
          )}
          {isVideo && (
            <Player
              playback={playback}
              clock={clock}
              src={fileUrl(origin, selectedFile)}
              poster={thumbnailUrl(
                manifest.id,
                selected,
                selectedFile.modifiedAt,
              )}
              downloadUrl={downloadUrl}
              markers={markers}
              overlay={
                <span className="stage-dimensions">
                  {info?.width || manifest.width} ×{" "}
                  {info?.height || manifest.height}
                </span>
              }
            />
          )}
          {!!selected && !isVideo && (
            <Player
              playback={livePlayback}
              clock={clock}
              src={sourceUrl}
              sourceRevision={`${selected}-${sourceRevision}`}
              aspectRatio={manifest.width / manifest.height}
              downloadUrl={downloadUrl}
              markers={markers}
              overlay={
                <span className="stage-dimensions">
                  {manifest.width} × {manifest.height} · {manifest.fps} fps
                </span>
              }
            />
          )}
        </div>
        <Timeline
          project={project}
          origin={origin}
          clock={clock}
          onSeek={seek}
          onEdit={() => setEditScenes(true)}
        >
          {showLanes && (
            <SoundLanes
              audition={audition}
              duration={manifest.duration}
              music={audition.track ? music.data : undefined}
              musicLabel={musicLabel(audition, candidates)}
              musicError={music.error?.message}
              effects={effectBuffers}
              focused={focused}
              onFocus={setFocused}
              onEdit={editAudio}
              onSeek={seek}
              onHit={playHit}
              onOffset={(offset) => setChoices({ ...choices, offset })}
            />
          )}
        </Timeline>
        <section className="workspace-tracks" aria-label="Editor de trilha">
          <TrackPanel
            project={project}
            audition={audition}
            choices={choices}
            onChange={setChoices}
            clock={clock}
            duration={playback.duration}
            canPreview={canPreview}
            playing={playback.playing}
            musicLoading={music.isFetching}
            focused={focused}
            cursor={cursor}
            onFocus={setFocused}
            onHit={playHit}
            onListen={playback.toggle}
            onSample={(layer, file) => {
              const option = layer.options.find((entry) => entry.file === file);
              const buffer = effectBuffers.get(file);
              if (option && buffer && !option.stem) {
                void mixer.current
                  ?.resume()
                  .then(() =>
                    mixer.current?.play(option, buffer, layer.volume),
                  );
              }
            }}
          />
        </section>
        <SceneVariants
          scenes={manifest.scenes}
          clock={clock}
          project={project}
          preview={selected}
          choosing={choosing}
          onPreview={(file, time) => select(file ?? mainFile, time)}
          onChoose={(scene, file) =>
            chooseVariant({ scene: scene.id, selected: file })
          }
        />
      </div>
      <aside className="inspector">
        <div className="inspector-tabs" role="tablist">
          {inspectorTabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={inspector === item.id}
              className={cn(inspector === item.id && "selected")}
              onClick={() => setInspector(item.id)}
            >
              <item.icon size={15} />
              {item.label}
            </button>
          ))}
        </div>
        {inspector === "project" && (
          <ProjectInspector project={project} selected={selected} />
        )}
        {inspector === "notes" && (
          <ReviewNotes
            project={project}
            audition={audition}
            baseline={adjustmentBaseline}
            clock={clock}
            selected={selected}
            onSeek={(note: Note) =>
              note.file ? select(note.file, note.time) : seek(note.time ?? 0)
            }
          />
        )}
      </aside>
      {editScenes && (
        <SceneEditor project={project} onClose={() => setEditScenes(false)} />
      )}
    </div>
  );
}

function ProjectInspector({
  project,
  selected,
}: {
  project: Project;
  selected: string;
}) {
  const { manifest } = project;
  const { mutate, isPending } = useStudioWrite<Partial<Manifest>>({
    path: `/api/projects/${manifest.id}`,
    method: "PATCH",
    message: "Projeto atualizado.",
  });
  const toast = useToast();
  const {
    mutate: openFolder,
    isPending: openingFolder,
    variables: opening,
  } = useMutation({
    mutationFn: async (folder: OpenFolderInput["folder"]) =>
      await write(`/api/projects/${manifest.id}/open-folder`, "POST", {
        folder,
      }),
    onError: (error) => toast(error.message, "error"),
  });
  const info = project.media[selected];
  const folders = [
    {
      folder: "scenes",
      label: "Código da composição",
      path: `scenes/${manifest.id}`,
    },
    {
      folder: "assets",
      label: "Assets e recursos",
      path: `assets/${manifest.id}`,
    },
    {
      folder: "renders",
      label: "Versões renderizadas",
      path: `renders/${manifest.id}`,
    },
    {
      folder: "projects",
      label: "Contexto e decisões",
      path: `projects/${manifest.id}`,
    },
  ] as const;
  const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
    value: value as Manifest["status"],
    label,
  }));
  return (
    <div className="project-inspector">
      <div className="inspector-section">
        <h3>Estado do projeto</h3>
        <Select
          label="Estado do projeto"
          value={manifest.status}
          options={statusOptions}
          disabled={isPending}
          onChange={(status) => mutate({ status })}
        />
      </div>
      <div className="inspector-section">
        <h3>{info ? "Render selecionado" : "Composição atual"}</h3>
        <dl className="spec-list">
          <div>
            <dt>Resolução</dt>
            <dd>
              {info?.width || manifest.width} ×{" "}
              {info?.height || manifest.height}
            </dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{shortTime(info?.duration || manifest.duration)}</dd>
          </div>
          <div>
            <dt>Quadros</dt>
            <dd>{Math.round(info?.fps || manifest.fps)} fps</dd>
          </div>
          <div>
            <dt>Cenas mapeadas</dt>
            <dd>{manifest.scenes.length}</dd>
          </div>
        </dl>
      </div>
      <div className="inspector-section">
        <h3>Pastas do projeto</h3>
        <div className="folder-links">
          {folders.map((folder) => (
            <button
              key={folder.path}
              aria-label={`Abrir na pasta: ${folder.label}`}
              data-tooltip="Abrir na pasta"
              disabled={openingFolder}
              onClick={() => openFolder(folder.folder)}
            >
              <span>
                {folder.label}
                <code>{folder.path}</code>
              </span>
              {openingFolder && opening === folder.folder ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <FolderOpen size={16} />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="inspector-section">
        <h3>Versão escolhida</h3>
        {manifest.approvedFile ? (
          <p className="chosen-file">
            <Check size={16} />
            {manifest.approvedFile.split("/").slice(-2).join("/")}
          </p>
        ) : (
          <p className="muted">Nenhum render escolhido como final.</p>
        )}
        {info && manifest.approvedFile !== selected && (
          <button
            className="button small"
            disabled={isPending}
            onClick={() =>
              mutate({ approvedFile: selected, status: "approved" })
            }
          >
            <Check size={14} />
            Escolher este render
          </button>
        )}
      </div>
    </div>
  );
}
