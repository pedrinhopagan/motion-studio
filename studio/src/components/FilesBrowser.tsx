import { useEffect, useState } from "react";
import {
  Film,
  Image,
  Music2,
  FileText,
  Code2,
  Globe,
  File,
  Grid2X2,
  List,
  Search,
  ArrowUpRight,
} from "lucide-react";
import type { FileKind, Project, ProjectFile } from "@shared/contracts";
import { mediaUrl, thumbnailUrl } from "@/lib/api";
import {
  formatBytes,
  formatDate,
  fileLabels,
  fileTitle,
  groupLabels,
  cn,
} from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const fileIcons = {
  video: Film,
  image: Image,
  audio: Music2,
  document: FileText,
  code: Code2,
  html: Globe,
  other: File,
};
export interface FileEntry {
  project: Project;
  file: ProjectFile;
}

export function FilesBrowser({
  entries,
  origin,
  onOpen,
  query = "",
  title = "Arquivos do projeto",
  compact = false,
}: {
  entries: FileEntry[];
  origin: string;
  onOpen: (entry: FileEntry) => void;
  query?: string;
  title?: string;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [localQuery, setLocalQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  useEffect(() => {
    setVisibleCount(60);
  }, [kind, query, localQuery]);
  const kinds = Object.keys(fileLabels).filter(
    (value): value is FileKind => value in fileLabels,
  );
  const filtered = entries.filter(
    ({ file, project }) =>
      (kind === "all" || file.kind === kind) &&
      `${file.path} ${fileTitle(file)} ${project.manifest.name}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()) &&
      file.path.toLocaleLowerCase().includes(localQuery.toLocaleLowerCase()),
  );

  return (
    <section className={cn("files-browser", compact && "compact")}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p>{entries.length} arquivos disponíveis</p>
        </div>
        <div className="list-toolbar">
          <label className="mini-search">
            <Search size={16} />
            <input
              aria-label="Filtrar arquivos"
              placeholder="Filtrar arquivos…"
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
            />
          </label>
          <div className="segmented">
            <button
              className={cn(view === "grid" && "selected")}
              aria-label="Ver em grade"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={16} />
            </button>
            <button
              className={cn(view === "list" && "selected")}
              aria-label="Ver em lista"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="filter-row">
        <button
          className={cn(kind === "all" && "selected")}
          onClick={() => setKind("all")}
        >
          Todos <span>{entries.length}</span>
        </button>
        {kinds
          .filter((value) => entries.some(({ file }) => file.kind === value))
          .map((value) => (
            <button
              key={value}
              className={cn(kind === value && "selected")}
              onClick={() => setKind(value)}
            >
              {fileLabels[value]}
              <span>
                {entries.filter(({ file }) => file.kind === value).length}
              </span>
            </button>
          ))}
      </div>
      {!filtered.length ? (
        <EmptyState
          title="Nenhum arquivo encontrado"
          description={
            entries.length
              ? "Ajuste a busca ou escolha outro tipo de arquivo."
              : "Adicione contexto e assets. Os novos arquivos dos agents também aparecerão aqui."
          }
        />
      ) : (
        <>
          <div
            className={cn("file-collection", view === "list" && "file-list")}
          >
            {filtered.slice(0, visibleCount).map((entry) => (
              <FileCard
                key={`${entry.project.manifest.id}-${entry.file.path}`}
                entry={entry}
                origin={origin}
                onOpen={() => onOpen(entry)}
                list={view === "list"}
              />
            ))}
          </div>
          <div className="file-pagination">
            <span>
              {Math.min(visibleCount, filtered.length)} de {filtered.length}{" "}
              arquivos
            </span>
            {visibleCount < filtered.length && (
              <button
                className="button small"
                onClick={() => setVisibleCount((current) => current + 60)}
              >
                Mostrar mais arquivos
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function FileCard({
  entry,
  origin,
  onOpen,
  list,
}: {
  entry: FileEntry;
  origin: string;
  onOpen: () => void;
  list: boolean;
}) {
  const { file, project } = entry;
  const Icon = fileIcons[file.kind];
  const [failed, setFailed] = useState(false);
  const preview =
    file.kind === "image"
      ? `${mediaUrl(origin, file.path)}?revision=${encodeURIComponent(file.modifiedAt)}`
      : thumbnailUrl(project.manifest.id, file.path, file.modifiedAt);
  useEffect(() => {
    setFailed(false);
  }, [preview]);
  return (
    <button className={cn("file-card", `kind-${file.kind}`)} onClick={onOpen}>
      <div className="file-thumbnail">
        {!list && !failed && ["image", "video"].includes(file.kind) ? (
          <img
            src={preview}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <Icon size={list ? 19 : 30} strokeWidth={1.5} />
        )}
        {!list && file.kind === "video" && (
          <span className="preview-type">
            <Film size={13} />
            Vídeo
          </span>
        )}
      </div>
      <div className="file-card-info">
        <strong title={file.path}>{fileTitle(file)}</strong>
        <span title={file.path}>
          {groupLabels[file.group]} / {file.version ?? project.manifest.name}
        </span>
      </div>
      <div className="file-card-meta">
        <span>{formatBytes(file.size)}</span>
        <span>{formatDate(file.modifiedAt)}</span>
      </div>
      {list && <ArrowUpRight size={16} className="file-open-icon" />}
    </button>
  );
}
