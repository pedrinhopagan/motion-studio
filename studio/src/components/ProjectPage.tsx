import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowLeft,
  Pencil,
  MonitorPlay,
  Files,
  FileText,
  Layers,
  LoaderCircle,
  Download,
} from "lucide-react";
import type { Library, ProjectFile } from "@shared/contracts";
import { projectOptions, useStudioWrite } from "@/lib/api";
import { statusLabels, cn } from "@/lib/format";
import { Workspace } from "@/components/Workspace";
import { FilesBrowser, type FileEntry } from "@/components/FilesBrowser";
import { Context } from "@/components/Context";
import { Versions } from "@/components/Versions";
import { AddMaterial } from "@/components/AddMaterial";
import { Modal } from "@/components/Modal";
import { ExportFile } from "@/components/ExportFile";
import { projectHref, type ProjectTab } from "@/lib/route";

export function ProjectPage({
  id,
  tab,
  library,
  search,
  onOpen,
}: {
  id: string;
  tab: ProjectTab;
  library: Library;
  search: string;
  onOpen: (entry: FileEntry) => void;
}) {
  const {
    data: project,
    isPending,
    error,
    isRefetchError,
  } = useQuery(projectOptions(id));
  const [add, setAdd] = useState<"files" | "text" | "link">();
  const [edit, setEdit] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<string>();
  const { mutate: editProject, isPending: isEditing } = useStudioWrite({
    path: `/api/projects/${id}`,
    method: "PATCH",
    message: "Projeto atualizado.",
    onSuccess: () => setEdit(false),
  });
  if (isPending) {
    return (
      <div className="loading-panel">
        <LoaderCircle size={28} className="spin" />
        <span>Lendo os arquivos do projeto…</span>
      </div>
    );
  }
  if (!project || (error && !isRefetchError)) {
    return (
      <div className="error-page">
        <h1>Não foi possível abrir o projeto</h1>
        <p>{error?.message}</p>
        <a href="#/" className="button">
          <ArrowLeft size={16} />
          Voltar aos projetos
        </a>
      </div>
    );
  }
  const open = (file: ProjectFile) => onOpen({ file, project });
  const selected = preview ?? project.manifest.approvedFile ?? project.latestVideo ?? project.source ?? "";
  const selectedFile = project.files.find((file) => file.path === selected);
  return (
    <div className="project-page">
      <div className="project-heading">
        <div>
          <a className="back-link" href="#/">
            <ArrowLeft size={14} />
            Todos os projetos
          </a>
          <div className="project-title-row">
            <h1>{project.manifest.name}</h1>
            <span className={`status status-${project.manifest.status}`}>
              <i />
              {statusLabels[project.manifest.status]}
            </span>
            <button
              className="icon-button"
              aria-label="Editar projeto"
              data-tooltip="Editar projeto"
              onClick={() => setEdit(true)}
            >
              <Pencil size={15} />
            </button>
          </div>
          <p>
            {project.manifest.description ||
              "Adicione contexto e construa a composição, parte por parte."}
          </p>
        </div>
        <div className="project-actions">
          <button className="button" disabled={!project.files.length} onClick={() => setExporting(true)}>
            <Download size={17} />Exportar
          </button>
          <button className="button primary" onClick={() => setAdd("files")}>
            <Plus size={17} />Adicionar material
          </button>
        </div>
      </div>
      {isRefetchError && (
        <div className="inline-error">
          Não foi possível atualizar os arquivos: {error?.message}
        </div>
      )}
      <nav className="project-tabs" aria-label="Seções do projeto">
        {(
          [
            { id: "workspace", label: "Composição", icon: MonitorPlay },
            {
              id: "context",
              label: "Contexto",
              icon: FileText,
              count:
                project.files.filter((file) => file.kind === "document")
                  .length + project.manifest.references.length,
            },
            {
              id: "files",
              label: "Arquivos",
              icon: Files,
              count: project.files.length,
            },
            {
              id: "versions",
              label: "Versões",
              icon: Layers,
              count: project.versions.length,
            },
          ] satisfies {
            id: ProjectTab;
            label: string;
            icon: typeof MonitorPlay;
            count?: number;
          }[]
        ).map((item) => (
          <a
            className={cn(tab === item.id && "selected")}
            aria-current={tab === item.id ? "page" : undefined}
            key={item.id}
            href={projectHref(id, item.id)}
          >
            <item.icon size={16} />
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </a>
        ))}
        <div className="project-tabs-status">
          <span className="connection-dot" />
          Acompanhando arquivos
        </div>
      </nav>
      {tab === "workspace" && (
        <Workspace
          key={id}
          project={project}
          origin={library.previewOrigin}
          root={library.root}
          selected={selected}
          onSelect={setPreview}
        />
      )}
      {tab === "context" && (
        <Context project={project} onOpen={open} onAdd={setAdd} />
      )}
      {tab === "files" && (
        <FilesBrowser
          entries={project.files.map((file) => ({ project, file }))}
          origin={library.previewOrigin}
          onOpen={onOpen}
          query={search}
        />
      )}
      {tab === "versions" && (
        <Versions
          project={project}
          origin={library.previewOrigin}
          root={library.root}
          onOpen={open}
        />
      )}
      {add && (
        <AddMaterial
          project={project}
          initial={add}
          onClose={() => setAdd(undefined)}
        />
      )}
      {exporting && <ExportFile project={project} initialFile={selectedFile} origin={library.previewOrigin} root={library.root} onClose={() => setExporting(false)} />}
      {edit && (
        <Modal title="Editar projeto" onClose={() => setEdit(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              editProject({
                name: String(data.get("name")),
                description: String(data.get("description")),
              });
            }}
          >
            <div className="modal-body form-stack">
              <label>
                Nome do projeto
                <input
                  name="name"
                  required
                  defaultValue={project.manifest.name}
                  maxLength={120}
                  autoFocus
                />
              </label>
              <label>
                Descrição
                <textarea
                  name="description"
                  defaultValue={project.manifest.description}
                  maxLength={5000}
                  rows={4}
                />
              </label>
              <p className="helper">
                A pasta do projeto continua com o identificador {id}.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="button"
                type="button"
                onClick={() => setEdit(false)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={isEditing}>
                {isEditing ? "Salvando…" : "Salvar projeto"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
