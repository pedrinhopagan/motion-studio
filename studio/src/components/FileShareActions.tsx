import { useMutation } from "@tanstack/react-query";
import { Copy, FolderInput, LoaderCircle } from "lucide-react";
import type { ProjectFile } from "@shared/contracts";
import { write } from "@/lib/api";
import { useCopy, useToast } from "@/components/ui/Toast";

export function FileShareActions({ id, file, root }: {
  id: string;
  file: ProjectFile;
  root: string;
}) {
  const copy = useCopy();
  const toast = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => await write(`/api/projects/${id}/copy-file`, "POST", { path: file.path }),
    onSuccess: () => toast("Arquivo copiado. Cole no gerenciador de arquivos ou em um aplicativo que aceite arquivos."),
    onError: (error) => toast(error.message, "error"),
  });

  return (
    <div className="file-share-actions">
      <button className="button small" disabled={isPending} onClick={() => mutate()} aria-label={`Copiar arquivo ${file.name}`}>
        {isPending ? <LoaderCircle size={14} className="spin" /> : <Copy size={14} />}
        {isPending ? "Copiando…" : "Copiar"}
      </button>
      <button className="icon-button" aria-label={`Copiar caminho de ${file.name}`} data-tooltip="Copiar caminho" onClick={() => void copy(`${root}/${file.path}`, "Caminho copiado.")}>
        <FolderInput size={16} />
      </button>
    </div>
  );
}
