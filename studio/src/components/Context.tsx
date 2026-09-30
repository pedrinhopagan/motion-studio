import {
  FileText,
  Plus,
  Link2,
  ArrowUpRight,
  FolderOpen,
  Upload,
  CheckCircle2,
} from "lucide-react";
import type { Project, ProjectFile } from "@shared/contracts";
import { formatBytes } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export function Context({
  project,
  onOpen,
  onAdd,
}: {
  project: Project;
  onOpen: (file: ProjectFile) => void;
  onAdd: (tab: "text" | "link" | "files") => void;
}) {
  const docs = project.files.filter(
    (file) => file.kind === "document" || file.group === "context",
  );
  const references = project.manifest.references;
  return (
    <div className="context-page page-enter">
      <div className="context-intro">
        <div className="context-symbol">
          <FileText size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h2>Tudo que dá direção ao projeto</h2>
          <p>
            Briefings, referências, textos e decisões. Uma base compartilhada
            entre você, os arquivos e o próximo passo da criação.
          </p>
        </div>
        <button className="button" onClick={() => onAdd("text")}>
          <Plus size={16} />
          Escrever contexto
        </button>
      </div>
      <div className="section-heading">
        <div>
          <h2>Documentos e briefings</h2>
          <p>{docs.length} arquivos de contexto</p>
        </div>
        <button className="button ghost small" onClick={() => onAdd("files")}>
          <Upload size={15} />
          Adicionar documento
        </button>
      </div>
      {!docs.length ? (
        <EmptyState
          title="O projeto começa com uma direção"
          description="Escreva seu briefing ou envie documentos para construir uma base de contexto."
          action={
            <button className="button" onClick={() => onAdd("text")}>
              Escrever briefing
            </button>
          }
        />
      ) : (
        <div className="context-documents">
          {docs.map((file) => (
            <button
              key={file.path}
              className="context-document"
              onClick={() => onOpen(file)}
            >
              <div className="document-symbol">
                <FileText size={23} strokeWidth={1.5} />
                <span>{file.name.split(".").at(-1)}</span>
              </div>
              <div>
                <h3>{file.name}</h3>
                <p title={file.path}>{file.path}</p>
                <span>
                  {formatBytes(file.size)}
                  {file.path.startsWith(
                    `projects/${project.manifest.id}/context/`,
                  ) && /\.(md|txt)$/i.test(file.path)
                    ? " · Editável na interface"
                    : " · Arquivo de referência"}
                </span>
              </div>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </div>
      )}
      <div className="section-heading reference-heading">
        <div>
          <h2>Referências na internet</h2>
          <p>Links com o que observar em cada referência.</p>
        </div>
        <button className="button ghost small" onClick={() => onAdd("link")}>
          <Plus size={15} />
          Adicionar link
        </button>
      </div>
      {!references.length ? (
        <div className="empty-links">
          <Link2 size={21} />
          <span>Guarde referências de ritmo, estilo e composição.</span>
          <button className="text-button" onClick={() => onAdd("link")}>
            Adicionar uma referência
          </button>
        </div>
      ) : (
        <div className="reference-grid">
          {references.map((reference) => (
            <a
              key={reference.id}
              className="reference-card"
              href={reference.url}
              target="_blank"
              rel="noreferrer"
            >
              <Link2 size={21} />
              <div>
                <strong>{reference.title}</strong>
                <span>{new URL(reference.url).hostname}</span>
                <p>{reference.description}</p>
              </div>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      )}
      <div className="context-contract">
        <FolderOpen size={20} />
        <div>
          <h3>O contexto acompanha a criação</h3>
          <p>
            Os textos ficam em{" "}
            <code>projects/{project.manifest.id}/context/</code>. Links, cenas,
            escolhas e anotações ficam em <code>motion.json</code>. Use esses
            caminhos ao pedir a próxima alteração ao agent.
          </p>
        </div>
        <CheckCircle2 size={18} />
      </div>
    </div>
  );
}
