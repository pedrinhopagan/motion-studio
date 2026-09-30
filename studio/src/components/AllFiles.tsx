import type { Library } from "@shared/contracts";
import { FilesBrowser, type FileEntry } from "@/components/FilesBrowser";

export function libraryFiles(data: Library): FileEntry[] {
  return data.projects.flatMap((project) =>
    project.files.map((file) => ({ project, file })),
  );
}

export function AllFiles({
  data,
  search,
  onOpen,
}: {
  data: Library;
  search: string;
  onOpen: (entry: FileEntry) => void;
}) {
  return (
    <div className="page-enter">
      <div className="page-title">
        <div>
          <h1>Todos os arquivos</h1>
          <p>Todos os materiais dos seus vídeos e animações.</p>
        </div>
        <span className="badge">
          {data.projects.length}{" "}
          {data.projects.length === 1 ? "projeto" : "projetos"}
        </span>
      </div>
      <FilesBrowser
        entries={libraryFiles(data)}
        origin={data.previewOrigin}
        query={search}
        onOpen={onOpen}
        title="Acervo do workspace"
      />
    </div>
  );
}
