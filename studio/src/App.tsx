import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Search,
  FolderOpen,
  Menu,
  X,
  LoaderCircle,
} from "lucide-react";
import { Library } from "@/components/Library";
import { Sidebar } from "@/components/Sidebar";
import { AllFiles } from "@/components/AllFiles";
import { AllReferences } from "@/components/AllReferences";
import { SoundLibrary } from "@/components/audio/SoundLibrary";
import { CreateProject } from "@/components/CreateProject";
import { WorkspaceHelp } from "@/components/WorkspaceHelp";
import type { FileEntry } from "@/components/FilesBrowser";
import { libraryOptions } from "@/lib/api";
import { cn } from "@/lib/format";
import { projectHref, useRoute } from "@/lib/route";

const ProjectPage = lazy(async () => ({
  default: (await import("@/components/ProjectPage")).ProjectPage,
}));
const FileViewer = lazy(async () => ({
  default: (await import("@/components/FileViewer")).FileViewer,
}));
const pageTitles = {
  library: "Projetos",
  files: "Arquivos",
  references: "Referências",
  sounds: "Sons",
  project: "Projeto",
};

export function App() {
  const { data, isPending, error, isFetching, refetch } =
    useQuery(libraryOptions);
  const [search, setSearch] = useState("");
  const [create, setCreate] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [file, setFile] = useState<FileEntry>();
  const searchInput = useRef<HTMLInputElement>(null);
  const route = useRoute(() => {
    setMobileNav(false);
    setFile(undefined);
  });
  const current =
    route.page === "project"
      ? data?.projects.find((project) => project.manifest.id === route.id)
      : undefined;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    document.title = current
      ? `${current.manifest.name} · Motion Studio`
      : "Motion Studio";
  }, [current?.manifest.name]);

  return (
    <div
      className={cn(
        "app-shell",
        collapsed && "sidebar-collapsed",
        mobileNav && "mobile-nav-open",
      )}
    >
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileNav(false)}
        />
      )}
      <Sidebar
        data={data}
        route={route}
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        onCreate={() => setCreate(true)}
        onHelp={() => setHelp(true)}
      />
      <div className="app-content">
        <header className="app-header">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir navegação"
            aria-expanded={mobileNav}
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <FolderOpen size={16} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current?.manifest.name ?? pageTitles[route.page]}</strong>
          </div>
          <label className="header-search">
            <Search size={16} />
            <input
              ref={searchInput}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (route.page === "project" && route.tab !== "files") {
                  location.hash = projectHref(route.id, "files");
                }
              }}
              placeholder="Buscar no acervo…"
              aria-label="Buscar no acervo"
            />
            {search ? (
              <button
                className="icon-button"
                aria-label="Limpar busca"
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </label>
          <button
            className="header-connection"
            aria-label="Atualizar arquivos"
            data-tooltip="Atualizar arquivos"
            onClick={() => void refetch()}
          >
            <span
              className={cn("connection-dot", isFetching && "refreshing")}
            />
            <span>Local</span>
          </button>
        </header>
        <main
          id="main"
          className={cn(
            "main-content",
            route.page === "project" && "project-main",
          )}
        >
          {isPending && <Loading title="Abrindo seu workspace" />}
          {error && !data && (
            <div className="error-page">
              <h1>O workspace está indisponível</h1>
              <p>{error.message}</p>
              <button className="button primary" onClick={() => void refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
          {data && route.page === "library" && (
            <Library
              data={data}
              search={search}
              onCreate={() => setCreate(true)}
            />
          )}
          {data && route.page === "project" && (
            <Suspense fallback={<Loading title="Abrindo projeto" />}>
              <ProjectPage
                key={route.id}
                id={route.id}
                tab={route.tab}
                library={data}
                search={search}
                onOpen={setFile}
              />
            </Suspense>
          )}
          {data && route.page === "files" && (
            <AllFiles data={data} search={search} onOpen={setFile} />
          )}
          {data && route.page === "sounds" && (
            <SoundLibrary data={data} search={search} />
          )}
          {data && route.page === "references" && (
            <AllReferences
              data={data}
              search={search}
              onOpen={setFile}
              onCreate={() => setCreate(true)}
            />
          )}
        </main>
      </div>
      {create && <CreateProject onClose={() => setCreate(false)} />}
      {file && data && (
        <Suspense>
          <FileViewer
            key={file.file.path}
            id={file.project.manifest.id}
            file={file.file}
            origin={data.previewOrigin}
            root={data.root}
            onClose={() => setFile(undefined)}
          />
        </Suspense>
      )}
      {help && data && (
        <WorkspaceHelp root={data.root} onClose={() => setHelp(false)} />
      )}
    </div>
  );
}

function Loading({ title }: { title: string }) {
  return (
    <div className="loading-panel" role="status">
      <LoaderCircle size={26} className="spin" />
      <span>{title}…</span>
    </div>
  );
}
