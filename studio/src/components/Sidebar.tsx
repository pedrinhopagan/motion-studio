import {
  LayoutGrid,
  Files,
  Bookmark,
  Plus,
  ChevronRight,
  FolderOpen,
  Copy,
  CircleHelp,
  Film,
  PanelLeftClose,
  PanelLeftOpen,
  AudioLines,
} from "lucide-react";
import type { Library } from "@shared/contracts";
import { cn, formatBytes } from "@/lib/format";
import { projectHref, type Route } from "@/lib/route";
import { useCopy } from "@/components/ui/Toast";

const links = [
  { page: "library", href: "#/", label: "Projetos", icon: LayoutGrid },
  { page: "files", href: "#/files", label: "Todos os arquivos", icon: Files },
  {
    page: "references",
    href: "#/references",
    label: "Referências",
    icon: Bookmark,
  },
  { page: "sounds", href: "#/sounds", label: "Sons", icon: AudioLines },
] as const;

export function Sidebar({
  data,
  route,
  collapsed,
  onCollapse,
  onCreate,
  onHelp,
}: {
  data?: Library;
  route: Route;
  collapsed: boolean;
  onCollapse: () => void;
  onCreate: () => void;
  onHelp: () => void;
}) {
  const copy = useCopy();
  const totalBytes =
    data?.projects.reduce((sum, project) => sum + project.totalSize, 0) ?? 0;
  const currentId = route.page === "project" ? route.id : "";

  return (
    <aside className="sidebar">
      <a className="brand" href="#/" aria-label="Motion Studio, início">
        <img className="brand-symbol" src="/icon.svg" alt="" />
        <span>
          motion<span>studio</span>
        </span>
      </a>
      <div className="workspace-label">
        <div className="workspace-avatar">M</div>
        <div>
          <strong>Meu workspace</strong>
          <span>Vídeos e animações</span>
        </div>
        <button
          className="icon-button desktop-collapse"
          aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
          data-tooltip={collapsed ? "Expandir navegação" : "Recolher navegação"}
          onClick={onCollapse}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>
      <nav className="primary-nav" aria-label="Navegação principal">
        {links.map((link) => (
          <a
            key={link.page}
            href={link.href}
            className={cn(route.page === link.page && "selected")}
            aria-current={route.page === link.page ? "page" : undefined}
          >
            <link.icon size={18} />
            <span>{link.label}</span>
            {link.page === "library" && (
              <small>{data?.projects.length ?? 0}</small>
            )}
          </a>
        ))}
      </nav>
      <div className="sidebar-projects">
        <div className="sidebar-section-title">
          <span>Seus projetos</span>
          <button
            className="icon-button"
            aria-label="Criar projeto"
            data-tooltip="Criar projeto"
            onClick={onCreate}
          >
            <Plus size={16} />
          </button>
        </div>
        {data?.projects.map((project, index) => (
          <a
            key={project.manifest.id}
            href={projectHref(project.manifest.id)}
            className={cn(currentId === project.manifest.id && "selected")}
            aria-current={
              currentId === project.manifest.id ? "page" : undefined
            }
          >
            <span className={`project-avatar project-tone-${index % 3}`}>
              <Film size={14} />
            </span>
            <span title={project.manifest.name}>{project.manifest.name}</span>
            <ChevronRight size={13} />
          </a>
        ))}
        {data && !data.projects.length && (
          <p className="sidebar-empty">Seu primeiro projeto começa aqui.</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <div className="local-workspace">
          <span>
            <span className="connection-dot" />
            Workspace local
          </span>
          <strong>
            {formatBytes(totalBytes)}
            <small>em arquivos de projeto</small>
          </strong>
          <button
            className="folder-copy"
            disabled={!data}
            onClick={() =>
              data && void copy(data.root, "Caminho do workspace copiado.")
            }
          >
            <FolderOpen size={14} />
            <span title={data?.root}>Motion Studio</span>
            <Copy size={12} />
          </button>
        </div>
        <button className="help-link" onClick={onHelp}>
          <CircleHelp size={17} />
          <span>Sobre o workspace</span>
        </button>
        <div className="sidebar-version">
          <span>Motion Studio</span>
          <span>v{__APP_VERSION__}</span>
        </div>
      </div>
    </aside>
  );
}
