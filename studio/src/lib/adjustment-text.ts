import type { Audition, Manifest, Note } from "@shared/contracts";
import { shortTime } from "@/lib/format";

export function auditionChanges(saved: Audition, current: Audition) {
  const changes: string[] = [];

  if (saved.track !== current.track) {
    changes.push(`Música: ${current.track || "sem música"}.`);
  }

  for (const field of [
    { key: "offset", label: "Início na faixa", format: shortTime },
    { key: "volume", label: "Volume da música", format: percent },
    { key: "originalVolume", label: "Volume do áudio original", format: percent },
    { key: "fadeIn", label: "Entrada suave da música", format: shortTime },
    { key: "fadeOut", label: "Saída suave da música", format: shortTime },
  ] as const) {
    if (saved[field.key] !== current[field.key]) {
      changes.push(`${field.label}: ${field.format(current[field.key])}.`);
    }
  }

  if (JSON.stringify(saved.muffle) !== JSON.stringify(current.muffle)) {
    changes.push(
      current.muffle.enabled
        ? `Música abafada até ${shortTime(current.muffle.until)}, em ${current.muffle.cutoff} Hz.`
        : "Abafamento da música: desligado.",
    );
  }

  for (const layer of current.effects) {
    const previous = saved.effects.find((entry) => entry.id === layer.id);

    if (previous?.selected !== layer.selected) {
      changes.push(`Som de "${layer.name}" (${layer.id}): ${layer.selected || "sem som"}.`);
    }

    if (previous?.volume !== layer.volume) {
      changes.push(`Volume de "${layer.name}" (${layer.id}): ${percent(layer.volume)}.`);
    }

    if (JSON.stringify(previous?.hits) !== JSON.stringify(layer.hits)) {
      changes.push(`Momentos de "${layer.name}" (${layer.id}): ${JSON.stringify(layer.hits)}.`);
    }
  }

  for (const layer of saved.effects) {
    if (!current.effects.some((entry) => entry.id === layer.id)) {
      changes.push(`Remova a camada de som "${layer.name}" (${layer.id}).`);
    }
  }

  return changes;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function adjustmentsText({
  notes,
  source,
  baseline,
  audition,
  scenes,
  duration,
}: {
  notes: Pick<Note, "text" | "time" | "file">[];
  source?: string;
  baseline: Pick<Manifest, "audition" | "scenes" | "duration">;
  audition: Audition;
  scenes: Manifest["scenes"];
  duration: Manifest["duration"];
}) {
  const comments = notes.map((note) => {
    const time = note.time === undefined ? "" : `${shortTime(note.time)}: `;
    const file = note.file && note.file !== source ? ` (${note.file})` : "";

    return `${time}${note.text.trim()}${file}`;
  });
  const changes = auditionChanges(baseline.audition, audition);

  if (baseline.duration !== duration) {
    changes.push(`Duração do vídeo: ${shortTime(duration)}.`);
  }

  for (const scene of scenes) {
    const previous = baseline.scenes.find((entry) => entry.id === scene.id);

    if (previous?.start !== scene.start || previous?.end !== scene.end) {
      changes.push(`Tempo de "${scene.name}" (${scene.id}): ${shortTime(scene.start)} a ${shortTime(scene.end)}.`);
    }
  }

  for (const scene of baseline.scenes) {
    if (!scenes.some((entry) => entry.id === scene.id)) {
      changes.push(`Remova a cena "${scene.name}" (${scene.id}) do mapa de tempos.`);
    }
  }

  const text = [
    comments.join("\n\n"),
    changes.filter((change) => !comments.includes(change)).join("\n"),
  ].filter((part) => !!part).join("\n\n");

  return text || undefined;
}
