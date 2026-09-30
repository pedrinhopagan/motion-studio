import { useState } from "react";
import {
  GitCompareArrows,
  Film,
  Download,
  ArrowUpRight,
  Check,
  Music2,
  Copy,
  Terminal,
  Code2,
} from "lucide-react";
import type { Project, ProjectFile } from "@shared/contracts";
import { mediaUrl, thumbnailUrl, useStudioWrite } from "@/lib/api";
import {
  formatBytes,
  formatDateTime,
  isSourceSnapshot,
  shortTime,
} from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { CompareVersions } from "@/components/CompareVersions";
import { useCopy } from "@/components/ui/Toast";
import { FileShareActions } from "@/components/FileShareActions";
import { ExportFile } from "@/components/ExportFile";

export function Versions({
  project,
  origin,
  root,
  onOpen,
}: {
  project: Project;
  origin: string;
  root: string;
  onOpen: (file: ProjectFile) => void;
}) {
  const [compare, setCompare] = useState(false);
  const [exportFile, setExportFile] = useState<ProjectFile>();
  const copy = useCopy();
  const videos = project.versions.flatMap((version) => version.videos);
  const next =
    Math.max(
      0,
      ...project.versions.map((version) =>
        Number(version.name.match(/^v(\d+)$/)?.[1] ?? 0),
      ),
    ) + 1;
  const audio = [...project.versions]
    .reverse()
    .flatMap((version) => version.files)
    .find((file) => file.kind === "audio" && file.name === "trilha.wav");
  const command = `bun tools/render.ts ${project.manifest.id} renders/${project.manifest.id}/v${next}/${project.manifest.id}.mp4 2${audio ? ` --audio ${audio.path}` : ""}`;
  const { mutate, isPending } = useStudioWrite({
    path: `/api/projects/${project.manifest.id}`,
    method: "PATCH",
    message: "Render escolhido como final.",
  });

  return (
    <div className="versions-page page-enter">
      <div className="section-heading">
        <div>
          <h2>Versões e resultados</h2>
          <p>Os renders preservam a história da composição.</p>
        </div>
        <button
          className="button"
          disabled={videos.length < 2}
          onClick={() => setCompare(true)}
        >
          <GitCompareArrows size={16} />
          Comparar renders
        </button>
      </div>
      {!project.versions.length && (
        <EmptyState
          title="O primeiro render ainda está por vir"
          description="Salve os resultados em renders dentro da pasta deste projeto. Cada versão aparece aqui automaticamente."
        />
      )}
      <div className="version-stack">
        {[...project.versions].reverse().map((version) => (
          <section className="version-section" key={version.name}>
            <div className="version-heading">
              <span className="version-name">{version.name}</span>
              <div>
                <h3>
                  {version.videos.length
                    ? "Renders de vídeo"
                    : "Materiais da versão"}
                </h3>
                <span>
                  {formatDateTime(version.modifiedAt)} · {version.files.length}{" "}
                  arquivos
                </span>
              </div>
              <span className="badge">
                {version.videos.length
                  ? "Vídeo disponível"
                  : "Sem render de vídeo"}
              </span>
            </div>
            <div className="version-videos">
              {version.videos.map((file) => (
                <article key={file.path} className="version-video">
                  <button
                    className="version-preview"
                    onClick={() => onOpen(file)}
                  >
                    <img
                      src={thumbnailUrl(
                        project.manifest.id,
                        file.path,
                        file.modifiedAt,
                      )}
                      alt={`Prévia de ${file.name}`}
                      loading="lazy"
                    />
                    <span>
                      <Film size={17} />
                      Visualizar render
                    </span>
                  </button>
                  <div className="version-video-details">
                    <h4 title={file.name}>{file.name}</h4>
                    <p>
                      {formatBytes(file.size)}
                      {project.media[file.path]
                        ? ` · ${shortTime(project.media[file.path].duration)} · ${Math.round(project.media[file.path].fps)} fps`
                        : ""}
                    </p>
                    <div>
                      <FileShareActions id={project.manifest.id} file={file} root={root} />
                      <button className="button small" onClick={() => setExportFile(file)}>
                        <Download size={14} />Exportar
                      </button>
                      <a
                        className="button small"
                        href={`${mediaUrl(origin, file.path)}?download`}
                      >
                        <Download size={14} />
                        Baixar
                      </a>
                      <button
                        className="button small"
                        disabled={
                          isPending ||
                          project.manifest.approvedFile === file.path
                        }
                        onClick={() =>
                          mutate({
                            approvedFile: file.path,
                            status: "approved",
                          })
                        }
                      >
                        <Check size={14} />
                        {project.manifest.approvedFile === file.path
                          ? "Escolhido"
                          : "Escolher"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="version-materials">
              <SourceSnapshot files={version.files} onOpen={onOpen} />
              {version.files
                .filter(
                  (file) => file.kind !== "video" && !isSourceSnapshot(file),
                )
                .map((file) => (
                  <button key={file.path} onClick={() => onOpen(file)}>
                    {file.kind === "audio" ? (
                      <Music2 size={14} />
                    ) : (
                      <ArrowUpRight size={14} />
                    )}
                    <span title={file.path}>
                      {file.path.split("/").slice(3).join("/")}
                    </span>
                    <small>{formatBytes(file.size)}</small>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
      <div className="render-recipe">
        <div>
          <Terminal size={19} />
          <h3>Próxima renderização</h3>
          <span className="badge">Ferramenta do projeto</span>
        </div>
        <p>
          Execute na raiz do projeto ou entregue o comando ao agent. O resultado
          aparecerá na biblioteca.
        </p>
        <div className="command-line">
          <code>{command}</code>
          <button
            className="icon-button"
            aria-label="Copiar comando de renderização"
            data-tooltip="Copiar comando"
            onClick={() => void copy(command, "Comando copiado.")}
          >
            <Copy size={17} />
          </button>
        </div>
        <p className="helper">
          O render MP4 usa as ferramentas existentes com aceleração de GPU. A
          fonte atual será usada.
        </p>
      </div>
      {compare && (
        <CompareVersions
          project={project}
          origin={origin}
          onClose={() => setCompare(false)}
        />
      )}
      {exportFile && <ExportFile project={project} initialFile={exportFile} origin={origin} root={root} onClose={() => setExportFile(undefined)} />}
    </div>
  );
}

// A cópia da fonte de uma versão vira um item só, aberto pelo index.html.
function SourceSnapshot({
  files,
  onOpen,
}: {
  files: ProjectFile[];
  onOpen: (file: ProjectFile) => void;
}) {
  const snapshot = files.filter(isSourceSnapshot);
  const entry =
    snapshot.find((file) => file.name === "index.html") ?? snapshot[0];
  if (!entry) {
    return null;
  }
  return (
    <button onClick={() => onOpen(entry)} title={entry.path}>
      <Code2 size={14} />
      <span>Código-fonte desta versão</span>
      <small>
        {snapshot.length} {snapshot.length === 1 ? "arquivo" : "arquivos"}
      </small>
    </button>
  );
}
