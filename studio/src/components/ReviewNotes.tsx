import { useState, type FormEvent } from "react";
import { Check, Copy, MessageSquare, Clock3 } from "lucide-react";
import type { Audition, Manifest, Project, Note } from "@shared/contracts";
import { useStudioWrite } from "@/lib/api";
import { useClock, type Clock } from "@/lib/clock";
import { formatTime, cn } from "@/lib/format";
import { adjustmentsText } from "@/lib/adjustment-text";
import { useCopy, useToast } from "@/components/ui/Toast";

export function ReviewNotes({
  project,
  audition,
  baseline,
  clock,
  selected,
  onSeek,
}: {
  project: Project;
  audition: Audition;
  baseline: Pick<Manifest, "audition" | "scenes" | "duration">;
  clock: Clock;
  selected: string;
  onSeek: (note: Note) => void;
}) {
  const [text, setText] = useState("");
  const [timestamp, setTimestamp] = useState(!!selected);
  const [showResolved, setShowResolved] = useState(false);
  const copy = useCopy();
  const toast = useToast();
  const { mutate, isPending } = useStudioWrite({
    path: `/api/projects/${project.manifest.id}/notes`,
    method: "POST",
    message: "Anotação salva no projeto.",
    onSuccess: () => setText(""),
  });
  const notes = [...project.manifest.notes]
    .filter((note) => showResolved || !note.resolved)
    .reverse();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutate({
      text,
      ...(timestamp && selected
        ? { time: Math.round(clock.get() * 100) / 100, file: selected }
        : {}),
    });
  }

  async function handleCopy() {
    const prompt = adjustmentsText({
      notes: [
        ...project.manifest.notes.filter((note) => !note.resolved),
        ...(text.trim()
          ? [{
              text: text.trim(),
              ...(timestamp && selected
                ? { time: Math.round(clock.get() * 100) / 100, file: selected }
                : {}),
            }]
          : []),
      ],
      ...(project.source ? { source: project.source } : {}),
      baseline,
      audition,
      scenes: project.manifest.scenes,
      duration: project.manifest.duration,
    });

    if (!prompt) {
      toast("Não há ajustes pendentes para copiar.", "info");
      return;
    }

    await copy(prompt, "Ajustes copiados. Cole na conversa com o agent.");
  }

  return (
    <div className="review-notes">
      <div className="inspector-section-heading">
        <h3>Direção e ajustes</h3>
        <span>
          {project.manifest.notes.filter((note) => !note.resolved).length}{" "}
          pendentes
        </span>
      </div>
      <form onSubmit={handleSubmit} className="note-form">
        <label>
          Nova anotação
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
            rows={4}
            maxLength={10000}
            placeholder="O que você quer ajustar neste momento?"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!selected && timestamp}
            onChange={(event) => setTimestamp(event.target.checked)}
            disabled={!selected}
          />
          <Clock3 size={13} />
          {selected ? (
            <CurrentTime clock={clock} />
          ) : (
            "Selecione uma prévia para marcar o tempo"
          )}
        </label>
        <button
          className="button primary small"
          disabled={isPending || !text.trim()}
        >
          <MessageSquare size={14} />
          {isPending ? "Salvando…" : "Adicionar anotação"}
        </button>
      </form>
      <button className="button small" onClick={handleCopy}>
        <Copy size={14} />
        Copiar ajustes
      </button>
      <label className="checkbox-label show-resolved">
        <input
          type="checkbox"
          checked={showResolved}
          onChange={(event) => setShowResolved(event.target.checked)}
        />
        Mostrar resolvidas
      </label>
      {!notes.length && (
        <div className="inspector-empty">
          <MessageSquare size={23} />
          <p>
            Suas observações aparecem aqui e ficam disponíveis nos arquivos do
            projeto.
          </p>
        </div>
      )}
      <div className="notes-list">
        {notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            projectId={project.manifest.id}
            onSeek={() => onSeek(note)}
          />
        ))}
      </div>
    </div>
  );
}

function NoteItem({
  note,
  projectId,
  onSeek,
}: {
  note: Note;
  projectId: string;
  onSeek: () => void;
}) {
  const { mutate, isPending } = useStudioWrite({
    path: `/api/projects/${projectId}/notes/${note.id}`,
    method: "PATCH",
    message: "",
  });
  return (
    <article className={cn("review-note", note.resolved && "resolved")}>
      <div>
        {note.time !== undefined ? (
          <button className="time-chip" onClick={onSeek}>
            <Clock3 size={12} />
            {formatTime(note.time)}
          </button>
        ) : (
          <span className="helper">Projeto</span>
        )}
        <button
          className={cn("resolve-note", note.resolved && "selected")}
          aria-label={
            note.resolved ? "Reabrir anotação" : "Marcar como resolvida"
          }
          data-tooltip={note.resolved ? "Reabrir" : "Resolver"}
          disabled={isPending}
          onClick={() => mutate({ resolved: !note.resolved })}
        >
          <Check size={14} />
        </button>
      </div>
      <p>{note.text}</p>
      {note.file && (
        <small title={note.file}>
          {note.file.split("/").slice(-2).join("/")}
        </small>
      )}
    </article>
  );
}

function CurrentTime({ clock }: { clock: Clock }) {
  return <>Marcar em {useClock(clock, formatTime)}</>;
}
