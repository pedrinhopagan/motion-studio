import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  LoaderCircle,
  Plus,
  Square,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { projectSchema } from "@shared/contracts";
import { Modal } from "@/components/Modal";
import { useStudioWrite } from "@/lib/api";
import { cn } from "@/lib/format";
import { Select } from "@/components/ui/Select";

const fpsOptions = ["24", "30", "60"].map((value) => ({
  value,
  label: `${value} fps`,
}));

const formats = [
  { label: "Quadrado", ratio: "1:1", width: 1440, height: 1440, icon: Square },
  {
    label: "Vertical",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    icon: RectangleVertical,
  },
  {
    label: "Horizontal",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    icon: RectangleHorizontal,
  },
];

export function CreateProject({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState(0);
  const [fps, setFps] = useState("60");
  const { mutate, isPending } = useStudioWrite({
    path: "/api/projects",
    method: "POST",
    message: "Projeto criado. A base está pronta para receber seu contexto.",
    onSuccess: (data) => {
      const project = projectSchema.parse(data);
      location.hash = `/projects/${project.manifest.id}/context`;
      onClose();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutate({
      name: String(data.get("name")),
      description: String(data.get("description")),
      brief: String(data.get("brief")),
      fps: Number(fps),
      duration: Number(data.get("duration")),
      width: formats[format].width,
      height: formats[format].height,
    });
  }

  return (
    <Modal title="Um novo motion design" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body form-stack">
          <p className="muted">
            Comece com uma composição vazia. Adicione direção, referências e
            arquivos conforme o projeto evolui.
          </p>
          <label>
            Nome do projeto
            <input
              name="name"
              required
              maxLength={120}
              autoFocus
              placeholder="Ex.: Lançamento do produto"
            />
          </label>
          <label>
            Descrição
            <input
              name="description"
              placeholder="O que você quer construir?"
              maxLength={5000}
            />
          </label>
          <fieldset className="format-field">
            <legend>Formato da composição</legend>
            <div className="format-options">
              {formats.map((item, index) => (
                <button
                  key={item.ratio}
                  className={cn(
                    "format-option",
                    format === index && "selected",
                  )}
                  type="button"
                  aria-pressed={format === index}
                  onClick={() => setFormat(index)}
                >
                  <item.icon size={24} />
                  <strong>{item.label}</strong>
                  <span>{item.ratio}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="two-fields">
            <label>
              Duração em segundos
              <input
                name="duration"
                type="number"
                min="1"
                max="3600"
                defaultValue="30"
                step="0.01"
                required
              />
            </label>
            <div className="field">
              <span>Quadros por segundo</span>
              <Select
                label="Quadros por segundo"
                value={fps}
                options={fpsOptions}
                onChange={setFps}
              />
            </div>
          </div>
          <label>
            Contexto inicial
            <textarea
              name="brief"
              rows={4}
              placeholder="Objetivo, público, cenas, direção visual, o que precisa aparecer…"
              maxLength={500000}
            />
          </label>
          <div className="callout">
            <ArrowUpRight size={18} />
            <p>
              O projeto nasce com código de cena, contexto em Markdown e pastas
              para assets e versões. Os arquivos ficam disponíveis no seu
              computador.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={isPending}>
            {isPending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <Plus size={16} />
            )}
            {isPending ? "Criando projeto…" : "Criar projeto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
