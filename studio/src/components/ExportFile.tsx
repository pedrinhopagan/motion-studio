import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Link, LoaderCircle } from "lucide-react";
import { exportedVideoSchema, type ExportVideoInput, type Project, type ProjectFile } from "@shared/contracts";
import { mediaUrl, write } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/ui/Select";
import { FileShareActions } from "@/components/FileShareActions";
import { useCopy } from "@/components/ui/Toast";

export function ExportFile({ project, initialFile, origin, root, onClose }: {
  project: Project;
  initialFile?: ProjectFile;
  origin: string;
  root: string;
  onClose: () => void;
}) {
  const [path, setPath] = useState(initialFile?.path ?? "");
  const [targetMB, setTargetMB] = useState(() => Math.max(0.5, Math.min(10, Math.floor((initialFile?.size ?? 15000000) * 0.7 / 500000) * 0.5)));
  const [resolution, setResolution] = useState<ExportVideoInput["resolution"]>("original");
  const copy = useCopy();
  const file = project.files.find((entry) => entry.path === path);
  const { mutate, isPending, data: exported, error, reset } = useMutation({
    mutationFn: async (input: ExportVideoInput) => exportedVideoSchema.parse(await write(`/api/projects/${project.manifest.id}/export`, "POST", input)),
  });
  const downloadUrl = exported ? `/api/projects/${project.manifest.id}/export?${new URLSearchParams({ key: exported.key, name: exported.name })}` : "";
  const targetTooLarge = !!file && targetMB * 1000000 >= file.size;

  function handleClose() {
    if (!isPending) {
      onClose();
    }
  }

  return (
    <Modal title="Exportar arquivo" onClose={handleClose}>
      <div className="modal-body form-stack export-body">
        <label className="field">
          Arquivo
          <Select label="Arquivo para exportar" value={path} disabled={isPending} options={project.files.map((entry) => ({ value: entry.path, label: entry.name, hint: `${entry.path} · ${formatBytes(entry.size)}` }))} onChange={(value) => { setPath(value); reset(); }} />
        </label>
        {!file && <p className="helper">Escolha um arquivo do projeto para copiar ou baixar.</p>}
        {file && (
          <>
            <div className="export-original">
              <div><strong>Arquivo original</strong><span>{formatBytes(file.size)}</span></div>
              <code>{root}/{file.path}</code>
              <div className="export-actions">
                <FileShareActions id={project.manifest.id} file={file} root={root} />
                <button className="button small" onClick={() => void copy(mediaUrl(origin, file.path), "Link copiado.")}><Link size={14} />Copiar link</button>
                <a className="button small" href={`${mediaUrl(origin, file.path)}?download`}><Download size={14} />Baixar original</a>
              </div>
            </div>
            {file.kind === "video" ? (
              <form className="form-stack export-compression" onSubmit={(event) => { event.preventDefault(); mutate({ path: file.path, targetMB, resolution }); }}>
                <div><h3>Versão comprimida</h3><p className="helper">MP4 com o áudio do render. O tamanho final pode variar um pouco.</p></div>
                <div className="export-fields">
                  <label className="field">Tamanho alvo (MB)<input type="number" min={0.5} max={500} step={0.5} required value={targetMB} disabled={isPending} onChange={(event) => { setTargetMB(event.target.valueAsNumber); reset(); }} /></label>
                  <label className="field">Resolução<Select label="Resolução da exportação" value={resolution} disabled={isPending} options={[
                    { value: "original", label: "Original" },
                    { value: "1080", label: "Até 1080 px" },
                    { value: "720", label: "Até 720 px" },
                    { value: "480", label: "Até 480 px" },
                  ]} onChange={(value) => { setResolution(value); reset(); }} /></label>
                </div>
                <p className="helper">A resolução limita o lado maior e preserva a proporção.</p>
                {targetTooLarge && <p className="inline-error">Escolha menos de {(file.size / 1000000).toFixed(2)} MB para reduzir o original.</p>}
                {error && <p className="inline-error" role="alert">{error.message}</p>}
                {isPending && <p className="helper" role="status">Comprimindo o vídeo… Mantenha esta janela aberta.</p>}
                {exported && <div className="export-result" role="status"><span>Pronto: {formatBytes(exported.size)}</span><a className="button small" href={downloadUrl}><Download size={14} />Baixar MP4 comprimido</a></div>}
                <button className="button primary" disabled={isPending || targetTooLarge || !Number.isFinite(targetMB) || targetMB < 0.5 || targetMB > 500}>
                  {isPending ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
                  {isPending ? "Comprimindo…" : "Gerar versão comprimida"}
                </button>
              </form>
            ) : <p className="helper">Para comprimir, selecione um render de vídeo. Este arquivo pode ser copiado ou baixado no formato original.</p>}
          </>
        )}
      </div>
      <div className="modal-footer"><button className="button" disabled={isPending} onClick={onClose}>Fechar</button></div>
    </Modal>
  );
}
