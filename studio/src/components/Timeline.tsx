import type { CSSProperties, ReactNode } from "react";
import { Check, Eye, GitBranch, Layers, Pencil, Plus } from "lucide-react";
import type { Project, Scene } from "@shared/contracts";
import { useClock, type Clock } from "@/lib/clock";
import { formatTime, shortTime, cn } from "@/lib/format";
import { mediaUrl, thumbnailUrl } from "@/lib/api";

export function sceneIndexAt(scenes: Scene[], time: number) {
  return scenes.findIndex((scene) => time >= scene.start && time < scene.end);
}

// Miniatura da cena: a imagem definida no mapa ou o quadro do meio da cena no
// render escolhido (ou no mais recente), quando ele cobre a duração do projeto.
function sceneFrames(project: Project, origin: string) {
  const video = project.manifest.approvedFile ?? project.latestVideo;
  const file = project.files.find((entry) => entry.path === video);
  const info = video ? project.media[video] : undefined;
  const covers =
    !!file && !!info && info.duration >= project.manifest.duration - 0.1;
  return (scene: Scene) =>
    scene.thumbnail
      ? mediaUrl(origin, scene.thumbnail)
      : covers
        ? thumbnailUrl(
            project.manifest.id,
            file.path,
            file.modifiedAt,
            (scene.start + scene.end) / 2,
          )
        : undefined;
}

// Cenas e faixas de som dividem o mesmo eixo de tempo: cada linha tem um
// cabeçalho à esquerda e o conteúdo na mesma largura.
export function Timeline({
  project,
  origin,
  clock,
  onSeek,
  onEdit,
  children,
}: {
  project: Project;
  origin: string;
  clock: Clock;
  onSeek: (time: number) => void;
  onEdit: () => void;
  children?: ReactNode;
}) {
  const duration = project.manifest.duration;
  const scenes = project.manifest.scenes;
  const ticks = Array.from({ length: 7 }, (_, index) => (index * duration) / 6);
  const frame = sceneFrames(project, origin);
  const active = useClock(clock, (time) => sceneIndexAt(scenes, time));
  return (
    <section className="timeline-panel">
      <div className="section-heading">
        <div className="timeline-title">
          <Layers size={16} />
          <h2>Mapa de cenas</h2>
          <span>
            {scenes.length} {scenes.length === 1 ? "parte" : "partes"}
          </span>
        </div>
        <button className="button ghost small" onClick={onEdit}>
          {scenes.length ? <Pencil size={14} /> : <Plus size={14} />}
          {scenes.length ? "Editar mapa" : "Adicionar cenas"}
        </button>
      </div>
      {!scenes.length && (
        <div className="timeline-empty">
          <p>
            Uma composição em branco. Defina as cenas para guiar a construção.
          </p>
          <button className="button small" onClick={onEdit}>
            <Plus size={14} />
            Criar primeira cena
          </button>
        </div>
      )}
      {(!!scenes.length || !!children) && (
        <div className="timeline-body">
          <div className="lane lane-ruler" aria-hidden>
            <span className="lane-head" />
            <div className="lane-body timeline-ruler">
              {ticks.map((tick) => (
                <span key={tick}>{formatTime(tick).slice(0, 5)}</span>
              ))}
            </div>
          </div>
          {!!scenes.length && (
            <div className="lane lane-scenes">
              <span className="lane-head">
                <strong>Cenas</strong>
              </span>
              <div className="lane-body timeline-track">
                {scenes.map((scene, index) => {
                  const image = frame(scene);
                  return (
                    <button
                      key={scene.id}
                      className={cn(
                        "timeline-clip",
                        `clip-color-${index % 4}`,
                        index === active && "active",
                      )}
                      style={{
                        left: `${(scene.start / duration) * 100}%`,
                        width: `${((scene.end - scene.start) / duration) * 100}%`,
                      }}
                      onClick={() => onSeek(scene.start)}
                      aria-label={`${scene.name}, ${shortTime(scene.start)} até ${shortTime(scene.end)}`}
                    >
                      {image && <img src={image} alt="" loading="lazy" />}
                      <span>
                        {String(index + 1).padStart(2, "0")}
                        {!!scene.variants.length && (
                          <em title={`${scene.variants.length} opções`}>
                            <GitBranch size={10} />
                            {scene.variants.length}
                          </em>
                        )}
                      </span>
                      <strong>{scene.name}</strong>
                      <small>{shortTime(scene.end - scene.start)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {children}
          <Playhead clock={clock} duration={duration} />
        </div>
      )}
    </section>
  );
}

function Playhead({ clock, duration }: { clock: Clock; duration: number }) {
  const position = useClock(clock, (time) => Math.min(time / duration, 1));
  return (
    <div
      className="timeline-playhead"
      style={{ "--position": position } as CSSProperties}
    >
      <i />
    </div>
  );
}

export function SceneVariants({
  scenes,
  clock,
  project,
  preview,
  onPreview,
  onChoose,
  choosing,
}: {
  scenes: Scene[];
  clock: Clock;
  project: Project;
  preview: string;
  onPreview: (file: string | undefined, time: number) => void;
  onChoose: (scene: Scene, file: string) => void;
  choosing: boolean;
}) {
  const index = useClock(clock, (time) => sceneIndexAt(scenes, time));
  const scene = scenes[index];
  if (!scene?.variants.length) {
    return null;
  }
  const viewing = scene.variants.some((variant) => variant.file === preview);
  return (
    <section
      className="scene-variants-panel"
      aria-label={`Opções de ${scene.name}`}
    >
      <div className="scene-variants">
        <div className="field-title">
          <h4>Opções de {scene.name}</h4>
          {viewing && (
            <button
              className="text-button"
              onClick={() => onPreview(undefined, scene.start)}
            >
              Voltar ao render
            </button>
          )}
        </div>
        {scene.variants.map((variant) => {
          const file = project.files.find(
            (entry) => entry.path === variant.file,
          );
          const chosen = scene.selected === variant.file;
          const current = preview === variant.file;
          return (
            <div
              key={variant.file}
              className={cn("variant-row", current && "current")}
            >
              <img
                src={thumbnailUrl(
                  project.manifest.id,
                  variant.file,
                  file?.modifiedAt,
                  (scene.start + scene.end) / 2,
                )}
                alt=""
                loading="lazy"
              />
              <div>
                <strong>
                  {variant.label}
                  {chosen && (
                    <span className="badge success">
                      <Check size={11} />
                      Escolhida
                    </span>
                  )}
                </strong>
                {!!variant.description && <p>{variant.description}</p>}
              </div>
              <div className="variant-actions">
                <button
                  className="button small ghost"
                  disabled={current || !file}
                  onClick={() => onPreview(variant.file, scene.start)}
                >
                  <Eye size={14} />
                  {file ? (current ? "Na prévia" : "Ver") : "Sem vídeo"}
                </button>
                {!chosen && (
                  <button
                    className="button small"
                    disabled={choosing}
                    onClick={() => onChoose(scene, variant.file)}
                  >
                    <Check size={14} />
                    Escolher
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
