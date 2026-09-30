import { ArrowUpRight, Link2 } from "lucide-react";
import type { Library } from "@shared/contracts";
import { FilesBrowser, type FileEntry } from "@/components/FilesBrowser";
import { EmptyState } from "@/components/EmptyState";
import { libraryFiles } from "@/components/AllFiles";

export function AllReferences({
  data,
  search,
  onOpen,
  onCreate,
}: {
  data: Library;
  search: string;
  onOpen: (entry: FileEntry) => void;
  onCreate: () => void;
}) {
  const query = search.toLocaleLowerCase();
  const links = data.projects
    .flatMap((project) =>
      project.manifest.references.map((reference) => ({ project, reference })),
    )
    .filter(({ reference, project }) =>
      `${reference.title} ${reference.description} ${project.manifest.name}`
        .toLocaleLowerCase()
        .includes(query),
    );
  const documents = libraryFiles(data).filter(
    ({ file }) => file.kind === "document" || file.group === "context",
  );

  if (!data.projects.length) {
    return (
      <EmptyState
        title="Crie um projeto para organizar suas referências"
        description="O contexto acompanha cada motion design desde o primeiro arquivo."
        action={
          <button className="button" onClick={onCreate}>
            Criar projeto
          </button>
        }
      />
    );
  }
  return (
    <div className="page-enter">
      <div className="page-title">
        <div>
          <h1>Referências e contexto</h1>
          <p>Os materiais que orientam cada projeto, reunidos para consulta.</p>
        </div>
      </div>
      {!!links.length && (
        <div className="reference-grid global-link-grid">
          {links.map(({ project, reference }) => (
            <a
              key={`${project.manifest.id}-${reference.id}`}
              className="reference-card"
              href={reference.url}
              target="_blank"
              rel="noreferrer"
            >
              <Link2 size={20} />
              <div>
                <strong>{reference.title}</strong>
                <span>
                  {project.manifest.name} · {new URL(reference.url).hostname}
                </span>
                <p>{reference.description}</p>
              </div>
              <ArrowUpRight size={16} />
            </a>
          ))}
        </div>
      )}
      <FilesBrowser
        entries={documents}
        origin={data.previewOrigin}
        query={search}
        onOpen={onOpen}
        title="Documentos de referência"
      />
    </div>
  );
}
