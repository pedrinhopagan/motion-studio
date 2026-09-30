import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Film,
  FolderOpen,
  Star,
  Clock3,
  FileText,
  Layers,
  Grid2X2,
  List,
  Play,
} from "lucide-react";
import type { Library as LibraryData, Project } from "@shared/contracts";
import { mediaUrl, thumbnailUrl, useStudioWrite } from "@/lib/api";
import { cn, formatDateTime, formatBytes, statusLabels } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { projectHref } from "@/lib/route";
import { Select } from "@/components/ui/Select";

const sortOptions = [
  { value: "updated" as const, label: "Última atualização" },
  { value: "name" as const, label: "Nome do projeto" },
];

export function Library({
  data,
  search,
  onCreate,
}: {
  data: LibraryData;
  search: string;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const projects = data.projects.filter(
    (project) =>
      `${project.manifest.name} ${project.manifest.description}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "favorite"
          ? project.manifest.favorite
          : project.manifest.status === filter)),
  );
  const sorted = [...projects].sort((a, b) =>
    sort === "name"
      ? a.manifest.name.localeCompare(b.manifest.name)
      : b.updatedAt.localeCompare(a.updatedAt),
  );
  const latest = data.projects.at(0);
  const totalVideos = data.projects.reduce(
    (sum, project) =>
      sum + project.files.filter((file) => file.kind === "video").length,
    0,
  );
  const totalFiles = data.projects.reduce(
    (sum, project) => sum + project.files.length,
    0,
  );

  return (
    <div className="library-page page-enter">
      <div className="page-title">
        <div>
          <div className="eyeline">
            <span className="tiny-marker" />
            Seu espaço de criação
          </div>
          <h1>Motion Studio</h1>
          <p>Da primeira ideia ao último frame. Tudo no mesmo lugar.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={18} />
          Novo projeto
        </button>
      </div>
      {!!data.issues.length && (
        <div className="inline-error">
          {data.issues.map((issue) => (
            <p key={issue.project}>
              {issue.project}: {issue.message}
            </p>
          ))}
        </div>
      )}
      {latest && !search && filter === "all" && (
        <div className="library-feature">
          <a
            className="featured-preview"
            href={projectHref(latest.manifest.id)}
          >
            <ProjectCover project={latest} origin={data.previewOrigin} />
            <span className="featured-pill">
              <Clock3 size={13} />
              Último projeto atualizado
            </span>
            <span className="featured-play">
              <Play size={25} fill="currentColor" />
            </span>
            <div className="featured-bottom">
              <span>
                {latest.manifest.width} × {latest.manifest.height}
              </span>
              <span>{latest.manifest.fps} fps</span>
            </div>
          </a>
          <div className="featured-content">
            <div className="featured-top">
              <span className={`status status-${latest.manifest.status}`}>
                <i />
                {statusLabels[latest.manifest.status]}
              </span>
              <span>{formatDateTime(latest.updatedAt)}</span>
            </div>
            <h2>{latest.manifest.name}</h2>
            <p>
              {latest.manifest.description ||
                "Um projeto em evolução. Explore a composição, os arquivos e cada versão."}
            </p>
            <div className="featured-stats">
              <div>
                <Layers size={18} />
                <strong>
                  {
                    latest.versions.filter((version) =>
                      /^v\d/.test(version.name),
                    ).length
                  }
                </strong>
                <span>versões</span>
              </div>
              <div>
                <FolderOpen size={18} />
                <strong>{latest.files.length}</strong>
                <span>arquivos</span>
              </div>
              <div>
                <Film size={18} />
                <strong>
                  {latest.files.filter((file) => file.kind === "video").length}
                </strong>
                <span>renders de vídeo</span>
              </div>
            </div>
            <a className="button" href={projectHref(latest.manifest.id)}>
              Abrir projeto
              <ArrowUpRight size={17} />
            </a>
            <div className="featured-path">
              <FolderOpen size={13} />
              <code>renders/{latest.manifest.id}</code>
            </div>
          </div>
        </div>
      )}
      <div className="collection-heading">
        <div className="collection-tabs">
          {[
            {
              id: "all",
              label: "Todos os projetos",
              count: data.projects.length,
            },
            {
              id: "favorite",
              label: "Favoritos",
              count: data.projects.filter((p) => p.manifest.favorite).length,
            },
            {
              id: "review",
              label: "Em revisão",
              count: data.projects.filter((p) => p.manifest.status === "review")
                .length,
            },
          ].map((item) => (
            <button
              key={item.id}
              className={cn(filter === item.id && "selected")}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </div>
        <div className="list-toolbar">
          <Select
            label="Ordenar projetos"
            size="sm"
            variant="ghost"
            value={sort}
            options={sortOptions}
            onChange={setSort}
          />
          <div className="segmented">
            <button
              aria-label="Projetos em grade"
              className={cn(view === "grid" && "selected")}
              onClick={() => setView("grid")}
            >
              <Grid2X2 size={16} />
            </button>
            <button
              aria-label="Projetos em lista"
              className={cn(view === "list" && "selected")}
              onClick={() => setView("list")}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className={cn("project-grid", view === "list" && "project-list")}>
        {sorted.map((project) => (
          <ProjectCard
            key={project.manifest.id}
            project={project}
            origin={data.previewOrigin}
          />
        ))}
        {filter === "all" && !search && (
          <button className="new-project-card" onClick={onCreate}>
            <span>
              <Plus size={23} />
            </span>
            <strong>Comece uma nova ideia</strong>
            <p>Um projeto vazio, pronto para ganhar movimento.</p>
            <div>
              Criar motion design
              <ArrowRight size={15} />
            </div>
          </button>
        )}
      </div>
      {!sorted.length && (search || filter !== "all") && (
        <EmptyState
          title="Nenhum projeto encontrado"
          description="Ajuste a busca ou escolha outra coleção."
        />
      )}
      <div className="library-footer">
        <span>
          <span className="connection-dot" />
          Arquivos locais, sempre à mão
        </span>
        <span>
          {data.projects.length} projeto{data.projects.length === 1 ? "" : "s"}{" "}
          <i />
          {totalVideos} vídeos <i />
          {totalFiles} arquivos
        </span>
      </div>
      <div className="workflow-note">
        <FileText size={20} />
        <div>
          <strong>O contexto faz parte do projeto.</strong>
          <p>
            Guarde briefings, referências e decisões junto dos arquivos. Quando
            o agent criar uma nova parte, ela aparece aqui.
          </p>
        </div>
        <a href="#/references">
          Explorar referências
          <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  origin,
}: {
  project: Project;
  origin: string;
}) {
  const { mutate } = useStudioWrite({
    path: `/api/projects/${project.manifest.id}`,
    method: "PATCH",
    message: "",
  });
  return (
    <article className="project-card">
      <a className="project-card-cover" href={projectHref(project.manifest.id)}>
        <ProjectCover project={project} origin={origin} />
        <span className="cover-versions">
          <Layers size={12} />
          {
            project.versions.filter((version) => /^v\d/.test(version.name))
              .length
          }{" "}
          versões
        </span>
      </a>
      <button
        className={cn(
          "favorite-button",
          project.manifest.favorite && "is-favorite",
        )}
        aria-label={
          project.manifest.favorite
            ? `Remover ${project.manifest.name} dos favoritos`
            : `Favoritar ${project.manifest.name}`
        }
        data-tooltip="Favorito"
        onClick={() => mutate({ favorite: !project.manifest.favorite })}
      >
        <Star
          size={17}
          fill={project.manifest.favorite ? "currentColor" : "none"}
        />
      </button>
      <div className="project-card-content">
        <a href={projectHref(project.manifest.id)}>
          <h3>{project.manifest.name}</h3>
          <ArrowUpRight size={17} />
        </a>
        <p>
          {project.manifest.description || "Pronto para receber sua direção."}
        </p>
        <div>
          <span className={`status status-${project.manifest.status}`}>
            <i />
            {statusLabels[project.manifest.status]}
          </span>
          <span>{formatBytes(project.totalSize)}</span>
        </div>
      </div>
    </article>
  );
}

export function ProjectCover({
  project,
  origin,
}: {
  project: Project;
  origin: string;
}) {
  const [failed, setFailed] = useState(false);
  const image = project.latestVideo
    ? thumbnailUrl(
        project.manifest.id,
        project.latestVideo,
        project.files.find((file) => file.path === project.latestVideo)
          ?.modifiedAt,
      )
    : undefined;
  useEffect(() => {
    setFailed(false);
  }, [image, project.cover]);
  const fallback = project.cover ? mediaUrl(origin, project.cover) : undefined;
  if ((!image && !fallback) || failed) {
    return (
      <div className="blank-cover">
        <Film size={38} strokeWidth={1} />
        <span>Composição inicial</span>
      </div>
    );
  }
  return (
    <img
      src={image ?? fallback}
      alt={`Prévia de ${project.manifest.name}`}
      loading="lazy"
      onError={(event) => {
        if (fallback && event.currentTarget.src !== fallback) {
          event.currentTarget.src = fallback;
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
