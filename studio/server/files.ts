import { readdir, realpath, stat, mkdir, rename, open } from "node:fs/promises";
import { resolve, relative, sep, dirname, extname } from "node:path";
import { createHash } from "node:crypto";
import type { FileGroup, FileKind, ProjectFile } from "../shared/contracts";

export const workspaceRoot = resolve(import.meta.dir, "../..");
const publicRoots = [
  "scenes",
  "assets",
  "renders",
  "projects",
  ".koworker/tasks",
];

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function relativePath(path: string) {
  return relative(workspaceRoot, path).split(sep).join("/");
}

export async function workspacePath(path: string) {
  if (relativePath(resolve(workspaceRoot, path)) !== path) {
    throw new HttpError(
      403,
      "Use o caminho relativo do arquivo, sem atalhos de pasta.",
    );
  }
  if (
    !publicRoots.some((root) => path.startsWith(`${root}/`)) &&
    !/^tools\/[\w-]+\.(js|ts)$/.test(path)
  ) {
    throw new HttpError(
      403,
      "Esse arquivo não pertence aos projetos de motion.",
    );
  }

  const full = resolve(workspaceRoot, path);
  if (!full.startsWith(workspaceRoot + sep)) {
    throw new HttpError(403, "Caminho fora do projeto.");
  }

  const actual = await realpath(full).catch(() => {
    throw new HttpError(404, "Arquivo não encontrado.");
  });
  if (!actual.startsWith(workspaceRoot + sep) || actual !== full) {
    throw new HttpError(
      403,
      "Links simbólicos não são usados pela biblioteca.",
    );
  }

  return full;
}

export async function ensureDirectory(path: string) {
  const full = resolve(workspaceRoot, path);
  if (!full.startsWith(workspaceRoot + sep)) {
    throw new HttpError(403, "Caminho fora do projeto.");
  }

  const parts = relative(workspaceRoot, full).split(sep);
  let current = workspaceRoot;
  for (const part of parts) {
    current = resolve(current, part);
    await mkdir(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") {
        throw error;
      }
    });
    if ((await realpath(current)) !== current) {
      throw new HttpError(
        403,
        "A pasta de destino precisa estar dentro do projeto.",
      );
    }
  }

  return full;
}

export async function atomicWrite(path: string, content: string) {
  const folder = await ensureDirectory(
    relativePath(dirname(resolve(workspaceRoot, path))),
  );
  const target = resolve(folder, path.split("/").at(-1)!);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await Bun.write(temporary, content);
  await rename(temporary, target);
}

export async function writeNew(path: string, content: string | Uint8Array) {
  await ensureDirectory(relativePath(dirname(resolve(workspaceRoot, path))));
  const file = await open(resolve(workspaceRoot, path), "wx").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST") {
        throw new HttpError(409, "Um arquivo com esse nome já existe.");
      }
      throw error;
    },
  );
  try {
    await file.writeFile(content);
  } finally {
    await file.close();
  }
}

export function revision(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

export function fileKind(path: string): FileKind {
  const ext = extname(path).toLowerCase();
  if ([".mp4", ".webm", ".mov", ".m4v"].includes(ext)) {
    return "video";
  }
  if (
    [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".avif"].includes(ext)
  ) {
    return "image";
  }
  if ([".wav", ".mp3", ".ogg", ".m4a", ".flac", ".aac"].includes(ext)) {
    return "audio";
  }
  if ([".md", ".txt", ".pdf"].includes(ext)) {
    return "document";
  }
  if (
    [".js", ".ts", ".tsx", ".jsx", ".css", ".json", ".py", ".sh"].includes(ext)
  ) {
    return "code";
  }
  if (ext === ".html") {
    return "html";
  }
  return "other";
}

export async function scanFiles(
  path: string,
  group: FileGroup,
): Promise<ProjectFile[]> {
  const full = resolve(workspaceRoot, path);
  const actual = await realpath(full).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (actual && actual !== full) {
    throw new HttpError(403, "A biblioteca não segue links simbólicos.");
  }
  const entries = await readdir(full, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    },
  );
  const files: ProjectFile[] = [];
  for (const entry of entries) {
    if (
      entry.name.startsWith(".") ||
      entry.name === "__pycache__" ||
      entry.name.endsWith(".tmp") ||
      entry.isSymbolicLink()
    ) {
      continue;
    }
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await scanFiles(child, group)));
    } else if (entry.isFile()) {
      const info = await stat(resolve(full, entry.name)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") {
            return null;
          }
          throw error;
        },
      );
      if (!info) {
        continue;
      }
      files.push({
        path: child,
        name: entry.name,
        kind: fileKind(child),
        group,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
        ...(group === "renders" ? { version: child.split("/")[2] } : {}),
      });
    }
  }
  return files;
}

export async function serveFile(request: Request, path: string) {
  const full = await workspacePath(path);
  const file = Bun.file(full);
  const info = await stat(full);
  if (!info.isFile()) {
    throw new HttpError(404, "Arquivo não encontrado.");
  }
  const headers = new Headers({
    "Content-Type": file.type,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1]
      ? Number(match[1])
      : Math.max(0, info.size - Number(match?.[2]));
    const end =
      match?.[1] && match[2]
        ? Math.min(Number(match[2]), info.size - 1)
        : info.size - 1;
    if (
      !match ||
      (!match[1] && !match[2]) ||
      start > end ||
      start >= info.size
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${info.size}` },
      });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(
      request.method === "HEAD" ? null : file.slice(start, end + 1),
      { status: 206, headers },
    );
  }
  headers.set("Content-Length", String(info.size));
  if (new URL(request.url).searchParams.has("download")) {
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(path.split("/").at(-1)!)}`,
    );
  }
  return new Response(request.method === "HEAD" ? null : file, { headers });
}
