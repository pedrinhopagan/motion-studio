import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Project, Scene } from "@shared/contracts";
import { Modal } from "@/components/Modal";
import { useStudioWrite } from "@/lib/api";

export function SceneEditor({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [scenes, setScenes] = useState(project.manifest.scenes);
  const { mutate, isPending } = useStudioWrite<Scene[]>({
    path: `/api/projects/${project.manifest.id}/scenes`,
    method: "PUT",
    message: "Mapa de cenas salvo no projeto.",
    onSuccess: onClose,
  });
  function change(id: string, values: Partial<Scene>) {
    setScenes((current) =>
      current.map((scene) =>
        scene.id === id ? { ...scene, ...values } : scene,
      ),
    );
  }
  return (
    <Modal title="Mapa de cenas" onClose={onClose} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutate(scenes);
        }}
      >
        <div className="modal-body form-stack">
          <p className="muted">
            Organize as partes da composição e escreva a direção de cada cena.
            Os tempos e descrições ficam em motion.json para orientar o agent.
          </p>
          {!scenes.length && (
            <p className="helper">
              O mapa está vazio. Adicione sua primeira cena.
            </p>
          )}
          {scenes.map((scene, index) => (
            <div className="scene-editor-row" key={scene.id}>
              <div className="scene-row-top">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <label>
                  Nome da cena
                  <input
                    value={scene.name}
                    required
                    onChange={(event) =>
                      change(scene.id, { name: event.target.value })
                    }
                    maxLength={120}
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover cena ${scene.name}`}
                  data-tooltip="Remover cena do mapa"
                  onClick={() =>
                    setScenes((current) =>
                      current.filter((entry) => entry.id !== scene.id),
                    )
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="two-fields">
                <label>
                  Início em segundos
                  <input
                    type="number"
                    min="0"
                    max={project.manifest.duration}
                    step="0.01"
                    required
                    value={scene.start}
                    onChange={(event) =>
                      change(scene.id, { start: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Fim em segundos
                  <input
                    type="number"
                    min="0.01"
                    max={project.manifest.duration}
                    step="0.01"
                    required
                    value={scene.end}
                    onChange={(event) =>
                      change(scene.id, { end: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label>
                Direção desta cena
                <textarea
                  rows={2}
                  value={scene.description}
                  maxLength={5000}
                  onChange={(event) =>
                    change(scene.id, { description: event.target.value })
                  }
                  placeholder="O que acontece, quais assets usar, como a transição funciona…"
                />
              </label>
            </div>
          ))}
          <button
            className="button"
            type="button"
            onClick={() =>
              setScenes((current) => [
                ...current,
                {
                  id: crypto.randomUUID(),
                  name: `Cena ${current.length + 1}`,
                  start: current.at(-1)?.end ?? 0,
                  end: project.manifest.duration,
                  description: "",
                  variants: [],
                  selected: "",
                },
              ])
            }
          >
            <Plus size={16} />
            Adicionar cena
          </button>
        </div>
        <div className="modal-footer">
          <button className="button" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar mapa de cenas"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
