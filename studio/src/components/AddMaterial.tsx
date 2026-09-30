import { useRef, useState, type FormEvent } from "react";
import { FileText, Link2, Upload, LoaderCircle, X, File } from "lucide-react";
import { studioUploadLimits, type Project } from "@shared/contracts";
import { Modal } from "@/components/Modal";
import { useStudioWrite } from "@/lib/api";
import { cn, formatBytes } from "@/lib/format";
import { Select } from "@/components/ui/Select";

const categoryOptions = [
  {
    value: "assets" as const,
    label: "Assets do projeto",
    hint: "Imagens, áudio, fontes e outros recursos",
  },
  {
    value: "context" as const,
    label: "Contexto e referências",
    hint: "Briefings e documentos de direção",
  },
];

function uploadValidation({
  fileCount,
  totalSize,
}: {
  fileCount: number;
  totalSize: number;
}) {
  if (fileCount > studioUploadLimits.fileCount) {
    return `Envie até ${studioUploadLimits.fileCount} arquivos por vez.`;
  }
  if (totalSize > studioUploadLimits.totalBytes) {
    return "O envio pode ter até 100 MB. Remova alguns arquivos para continuar.";
  }
  return "";
}

export function AddMaterial({
  project,
  onClose,
  initial = "files",
}: {
  project: Project;
  onClose: () => void;
  initial?: "files" | "text" | "link";
}) {
  const [tab, setTab] = useState(initial);
  return (
    <Modal title="Adicionar ao projeto" onClose={onClose}>
      <div className="modal-tabs">
        {[
          { id: "files", label: "Arquivos", icon: Upload },
          { id: "text", label: "Texto", icon: FileText },
          { id: "link", label: "Link", icon: Link2 },
        ].map((item) => (
          <button
            key={item.id}
            className={cn(tab === item.id && "selected")}
            onClick={() => setTab(item.id as typeof tab)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>
      {tab === "files" && <UploadForm project={project} onClose={onClose} />}
      {tab === "text" && <TextForm project={project} onClose={onClose} />}
      {tab === "link" && <LinkForm project={project} onClose={onClose} />}
    </Modal>
  );
}

function UploadForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState<"assets" | "context">("assets");
  const totalSize = files.reduce((size, file) => size + file.size, 0);
  const uploadError = uploadValidation({ fileCount: files.length, totalSize });
  const { mutate, isPending } = useStudioWrite<FormData>({
    path: `/api/projects/${project.manifest.id}/upload`,
    method: "POST",
    message: "Arquivos adicionados ao projeto.",
    onSuccess: onClose,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const data = new FormData();
    data.set("category", category);
    files.forEach((file) => data.append("files", file));
    mutate(data);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body form-stack">
        <p className="muted">
          Imagens, áudios, vídeos, Markdown e outros arquivos. Até 50 arquivos e
          100 MB por envio.
        </p>
        <div
          className={cn("dropzone", dragging && "dragging")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            setFiles((current) => [
              ...current,
              ...Array.from(event.dataTransfer.files),
            ]);
          }}
        >
          <Upload size={30} />
          <strong>Arraste seus arquivos para cá</strong>
          <span>ou escolha no seu computador</span>
          <button
            className="button"
            type="button"
            onClick={() => input.current?.click()}
          >
            Escolher arquivos
          </button>
          <input
            className="visually-hidden"
            ref={input}
            type="file"
            multiple
            aria-label="Arquivos para adicionar"
            onChange={(event) =>
              setFiles((current) => [
                ...current,
                ...Array.from(event.target.files ?? []),
              ])
            }
          />
        </div>
        {!!files.length && (
          <ul className="upload-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <File size={17} />
                <span>
                  {file.name}
                  <small>{formatBytes(file.size)}</small>
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover ${file.name}`}
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {uploadError && (
          <p className="inline-error" role="alert">
            {uploadError}
          </p>
        )}
        <div className="field">
          <span>Salvar em</span>
          <Select
            label="Salvar em"
            value={category}
            options={categoryOptions}
            onChange={setCategory}
          />
        </div>
        <p className="helper">
          Arquivos com o mesmo nome recebem um nome novo. Arquivos maiores podem
          ser copiados diretamente para a pasta do projeto.
        </p>
      </div>
      <div className="modal-footer">
        <button className="button" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={isPending || !files.length || !!uploadError}
        >
          {isPending && <LoaderCircle size={16} className="spin" />}
          {isPending ? "Adicionando…" : "Adicionar arquivos"}
        </button>
      </div>
    </form>
  );
}

function TextForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { mutate, isPending } = useStudioWrite({
    path: `/api/projects/${project.manifest.id}/context`,
    method: "POST",
    message: "Texto salvo como Markdown no contexto do projeto.",
    onSuccess: onClose,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        mutate({
          title: String(data.get("title")),
          content: String(data.get("content")),
        });
      }}
    >
      <div className="modal-body form-stack">
        <p className="muted">
          Dê direção ao próximo passo. Este texto será um arquivo que você e o
          agent podem consultar.
        </p>
        <label>
          Título
          <input
            name="title"
            required
            autoFocus
            placeholder="Ex.: Direção visual"
            maxLength={120}
          />
        </label>
        <label>
          Conteúdo
          <textarea
            name="content"
            required
            rows={10}
            placeholder="Descreva o que importa para este projeto. Você pode usar Markdown."
            maxLength={500000}
          />
        </label>
      </div>
      <div className="modal-footer">
        <button className="button" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar contexto"}
        </button>
      </div>
    </form>
  );
}

function LinkForm({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { mutate, isPending } = useStudioWrite({
    path: `/api/projects/${project.manifest.id}/references`,
    method: "POST",
    message: "Referência adicionada.",
    onSuccess: onClose,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        mutate({
          title: String(data.get("title")),
          url: String(data.get("url")),
          description: String(data.get("description")),
        });
      }}
    >
      <div className="modal-body form-stack">
        <label>
          Título
          <input
            name="title"
            required
            autoFocus
            placeholder="Ex.: Referência de transições"
            maxLength={200}
          />
        </label>
        <label>
          Endereço
          <input name="url" type="url" required placeholder="https://…" />
        </label>
        <label>
          O que observar
          <textarea
            name="description"
            rows={4}
            placeholder="O ritmo, as cores, uma cena específica…"
            maxLength={5000}
          />
        </label>
        <p className="helper">
          O link e suas observações ficam no arquivo motion.json. A interface
          não baixa o conteúdo da página.
        </p>
      </div>
      <div className="modal-footer">
        <button className="button" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar referência"}
        </button>
      </div>
    </form>
  );
}
