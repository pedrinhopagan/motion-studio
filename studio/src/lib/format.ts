import type {
  FileKind,
  FileGroup,
  Manifest,
  ProjectFile,
} from "@shared/contracts";

export const fileLabels: Record<FileKind, string> = {
  video: "Vídeos",
  image: "Imagens",
  audio: "Áudios",
  document: "Documentos",
  code: "Código",
  html: "Prévias HTML",
  other: "Outros",
};
export const groupLabels: Record<FileGroup, string> = {
  source: "Fonte",
  assets: "Assets",
  renders: "Renders",
  context: "Contexto",
};
export const statusLabels: Record<Manifest["status"], string> = {
  draft: "Em construção",
  review: "Em revisão",
  approved: "Aprovado",
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  }
  return `${(bytes / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor((seconds % 1) * 100)
    .toString()
    .padStart(2, "0")}`;
}

export function formatDuration(seconds: number) {
  if (seconds < 10) {
    return `${seconds.toFixed(1).replace(".", ",")} s`;
  }
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function shortTime(seconds: number) {
  return `${seconds.toFixed(2).replace(".", ",")} s`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(date));
}

export function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function cn(...parts: (string | false | undefined)[]) {
  return parts.filter((part) => !!part).join(" ");
}

// Cópia da fonte guardada junto de um render: renders/<id>/<versão>/fonte/…
export function isSourceSnapshot(file: ProjectFile) {
  return file.group === "renders" && file.path.split("/")[3] === "fonte";
}

// Os pontos de entrada se chamam index.html; o nome sozinho não diz nada.
export function fileTitle(file: ProjectFile) {
  if (file.name !== "index.html") {
    return file.name;
  }
  if (file.group === "source") {
    return "Composição ao vivo";
  }
  if (isSourceSnapshot(file)) {
    return `Fonte da ${file.version}`;
  }
  return file.path.split("/").at(-2) ?? file.name;
}

// Nome legível de um arquivo de som: "clique-mouse-2.wav" vira "Clique mouse 2".
export function audioTitle(path: string) {
  const words = path
    .split("/")
    .at(-1)!
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}
