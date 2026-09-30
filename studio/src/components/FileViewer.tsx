import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Download,
  ExternalLink,
  Pencil,
  Save,
  File,
  LoaderCircle,
  Music2,
} from "lucide-react";
import type { ProjectFile } from "@shared/contracts";
import { Modal } from "@/components/Modal";
import { mediaUrl, textOptions, useStudioWrite } from "@/lib/api";
import {
  fileTitle,
  formatBytes,
  formatDateTime,
  groupLabels,
  isSourceSnapshot,
} from "@/lib/format";
import { FileShareActions } from "@/components/FileShareActions";

export function FileViewer({
  id,
  file,
  origin,
  root,
  onClose,
}: {
  id: string;
  file: ProjectFile;
  origin: string;
  root: string;
  onClose: () => void;
}) {
  const url = mediaUrl(origin, file.path);
  // A cópia da fonte guardada num render não roda fora da pasta original:
  // o HTML dela aparece como texto, não como página.
  const snapshot = isSourceSnapshot(file);
  const isText =
    /\.(md|txt|js|ts|jsx|tsx|css|json|py|sh)$/i.test(file.path) ||
    (snapshot && file.kind === "html");

  return (
    <Modal title={fileTitle(file)} onClose={onClose} wide>
      <div className="file-toolbar">
        <span className="badge">{groupLabels[file.group]}</span>
        <span>{formatBytes(file.size)}</span>
        <span className="file-date">{formatDateTime(file.modifiedAt)}</span>
        <div className="toolbar-spacer" />
        <FileShareActions id={id} file={file} root={root} />
        <a
          className="icon-button"
          aria-label="Abrir original"
          data-tooltip="Abrir original"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={17} />
        </a>
        <a className="button small" href={`${url}?download`}>
          <Download size={15} />
          Baixar
        </a>
      </div>
      <div className="file-view-body">
        {file.kind === "image" && (
          <div className="image-view">
            <img src={url} alt={file.name} />
          </div>
        )}
        {file.kind === "video" && (
          <div className="video-view">
            <video src={url} controls playsInline preload="metadata" />
          </div>
        )}
        {file.kind === "audio" && (
          <div className="audio-view">
            <div className="audio-glyph">
              <Music2 size={28} />
            </div>
            <h3>{file.name}</h3>
            <audio src={url} controls preload="metadata" />
          </div>
        )}
        {((file.kind === "html" && !snapshot) ||
          file.path.toLowerCase().endsWith(".pdf")) && (
          <iframe
            className="document-frame"
            title={file.name}
            src={url}
            sandbox="allow-scripts allow-same-origin"
            allow="clipboard-write"
          />
        )}
        {isText && <TextDocument id={id} file={file} />}
        {file.kind === "other" && (
          <div className="empty-state">
            <File size={28} />
            <h3>Arquivo disponível no projeto</h3>
            <p>Baixe o original para abrir no aplicativo correspondente.</p>
            <a className="button" href={`${url}?download`}>
              <Download size={16} />
              Baixar arquivo
            </a>
          </div>
        )}
      </div>
      <div className="file-path">
        <code>{file.path}</code>
      </div>
    </Modal>
  );
}

function TextDocument({ id, file }: { id: string; file: ProjectFile }) {
  const { data, isPending, error } = useQuery(textOptions(id, file.path));
  const [draft, setDraft] = useState<string>();
  const [baseRevision, setBaseRevision] = useState("");
  const { mutate, isPending: isSaving } = useStudioWrite({
    path: `/api/projects/${id}/text`,
    method: "PUT",
    message: "Documento salvo.",
    onSuccess: () => setDraft(undefined),
  });
  if (isPending) {
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" size={24} />
        Carregando documento…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="inline-error">
        {error?.message ?? "Não foi possível abrir o documento."}
      </div>
    );
  }

  return (
    <div className="text-document">
      <div className="text-actions">
        <span>
          {file.name.endsWith(".md")
            ? "Markdown"
            : file.kind === "document"
              ? "Texto"
              : "Código"}
        </span>
        {data.editable && draft === undefined && (
          <button
            className="button small"
            onClick={() => {
              setDraft(data.content);
              setBaseRevision(data.revision);
            }}
          >
            <Pencil size={14} />
            Editar texto
          </button>
        )}
        {draft !== undefined && (
          <>
            <button
              className="button small"
              disabled={isSaving}
              onClick={() => setDraft(undefined)}
            >
              Cancelar
            </button>
            <button
              className="button small primary"
              disabled={isSaving}
              onClick={() =>
                mutate({
                  path: file.path,
                  content: draft,
                  revision: baseRevision,
                })
              }
            >
              <Save size={14} />
              {isSaving ? "Salvando…" : "Salvar"}
            </button>
          </>
        )}
      </div>
      {draft !== undefined ? (
        <textarea
          className="document-editor"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Conteúdo do documento"
          spellCheck={false}
        />
      ) : (
        <div className="prose">
          {file.name.endsWith(".md") ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {data.content}
            </ReactMarkdown>
          ) : (
            <pre>{data.content}</pre>
          )}
        </div>
      )}
    </div>
  );
}
