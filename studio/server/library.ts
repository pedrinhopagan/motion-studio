import { readdir, stat, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  manifestSchema,
  type Manifest,
  type Project,
  type ProjectFile,
  type FileGroup,
  type Scene,
  type Library,
} from "../shared/contracts";
import {
  workspaceRoot,
  scanFiles,
  workspacePath,
  HttpError,
  atomicWrite,
  slugify,
  writeNew,
} from "./files";
import { scaffoldScene } from "./scaffold";

const projectRoots = ["projects", "scenes", "assets", "renders"];
const manifestQueues = new Map<string, Promise<unknown>>();

export async function projectIds() {
  const ids = new Set<string>();
  for (const root of projectRoots) {
    const entries = await readdir(join(workspaceRoot, root), {
      withFileTypes: true,
    }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)
      ) {
        ids.add(entry.name);
      }
    }
  }
  return [...ids];
}

export async function readManifest(id: string): Promise<Manifest> {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
    !(await projectIds()).includes(id)
  ) {
    throw new HttpError(404, "Projeto não encontrado.");
  }
  const file = Bun.file(join(workspaceRoot, "projects", id, "motion.json"));
  if (await file.exists()) {
    await workspacePath(`projects/${id}/motion.json`);
    const result = manifestSchema.safeParse(await file.json());
    if (!result.success || result.data.id !== id) {
      throw new HttpError(
        422,
        `Revise projects/${id}/motion.json: ${result.error?.issues[0]?.message ?? "id diferente da pasta"}.`,
      );
    }
    return result.data;
  }

  const source = Bun.file(join(workspaceRoot, "scenes", id, "index.html"));
  const html = (await source.exists()) ? await source.text() : "";
  const roots = await Promise.all(
    projectRoots.map(
      async (root) =>
        await stat(join(workspaceRoot, root, id)).catch(() => null),
    ),
  );
  return manifestSchema.parse({
    schemaVersion: 1,
    id,
    name: html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? id.replace(/-/g, " "),
    createdAt: new Date(
      Math.min(...roots.flatMap((info) => (info ? [info.birthtimeMs] : []))),
    ).toISOString(),
    status: "draft",
  });
}

export async function getProject(id: string): Promise<Project> {
  const manifest = await readManifest(id);
  const groups: { path: string; group: FileGroup }[] = [
    { path: `scenes/${id}`, group: "source" },
    { path: `assets/${id}`, group: "assets" },
    { path: `renders/${id}`, group: "renders" },
    { path: `projects/${id}`, group: "context" },
  ];
  const scans = await Promise.all(
    groups.map(({ path, group }) => scanFiles(path, group)),
  );
  const extra = await Promise.all(
    manifest.contextPaths.map(async (path) => {
      const full = await workspacePath(path);
      const info = await stat(full);
      if (!info.isFile()) {
        throw new HttpError(
          422,
          `O contexto precisa apontar para um arquivo: ${path}`,
        );
      }
      return {
        path,
        name: path.split("/").at(-1)!,
        kind: "document" as const,
        group: "context" as const,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
      };
    }),
  );
  const files: ProjectFile[] = [...scans.flat(), ...extra];
  const versionNames = [
    ...new Set(
      files
        .filter((file) => file.group === "renders")
        .map((file) => file.version!),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const versions = versionNames.map((name) => {
    const entries = files.filter((file) => file.version === name);
    return {
      name,
      files: entries,
      // Alternativas de cena ficam em vN/variantes/ e se escolhem pelo mapa de cenas.
      videos: entries.filter(
        (file) => file.kind === "video" && !file.path.includes("/variantes/"),
      ),
      modifiedAt: entries
        .map((file) => file.modifiedAt)
        .sort()
        .at(-1)!,
    };
  });
  const latest = versions.filter((version) => version.videos.length).at(-1);
  const preferred =
    latest?.videos.find((file) => file.name === `${id}.mp4`) ??
    latest?.videos.at(-1);
  const still = files.find(
    (file) => file.kind === "image" && file.path.includes("/stills/"),
  );
  const source = files.find((file) => file.path === `scenes/${id}/index.html`);
  const manifestInfo = await stat(
    join(workspaceRoot, "projects", id, "motion.json"),
  ).catch(() => null);
  const updated = [
    ...files.map((file) => file.modifiedAt),
    manifest.createdAt,
    ...(manifestInfo ? [manifestInfo.mtime.toISOString()] : []),
  ]
    .sort()
    .at(-1)!;
  return {
    manifest,
    files,
    versions,
    ...(still ? { cover: still.path } : {}),
    ...(preferred ? { latestVideo: preferred.path } : {}),
    ...(source ? { source: source.path } : {}),
    updatedAt: updated,
    totalSize: files.reduce((total, file) => total + file.size, 0),
    media: {},
  };
}

export async function getLibrary(previewOrigin: string): Promise<Library> {
  const ids = await projectIds();
  const results = await Promise.allSettled(ids.map(getProject));
  const projects: Project[] = [];
  const issues: Library["issues"] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      projects.push(result.value);
    } else {
      issues.push({
        project: ids[index],
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "Não foi possível ler o projeto.",
      });
    }
  });
  return {
    root: workspaceRoot,
    previewOrigin,
    projects: projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    issues,
  };
}

export async function updateManifest(
  id: string,
  change: (manifest: Manifest) => Manifest | Promise<Manifest>,
) {
  const prior = manifestQueues.get(id) ?? Promise.resolve();
  const operation = prior
    .catch(() => {})
    .then(async () => {
      const updated = manifestSchema.parse(
        await change(await readManifest(id)),
      );
      await atomicWrite(
        `projects/${id}/motion.json`,
        JSON.stringify(updated, null, 2) + "\n",
      );
      return updated;
    });
  manifestQueues.set(id, operation);
  try {
    return await operation;
  } finally {
    if (manifestQueues.get(id) === operation) {
      manifestQueues.delete(id);
    }
  }
}

export async function assertProjectFile(
  id: string,
  path: string,
): Promise<ProjectFile> {
  const project = await getProject(id);
  const file = project.files.find((entry) => entry.path === path);
  if (!file) {
    throw new HttpError(404, "O arquivo não pertence a este projeto.");
  }
  await workspacePath(path);
  return file;
}

export async function createProject(input: {
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  brief: string;
}) {
  const id = slugify(input.name);
  if (!id) {
    throw new HttpError(400, "Use letras ou números no nome do projeto.");
  }
  if ((await projectIds()).includes(id)) {
    throw new HttpError(
      409,
      "Já existe um projeto com esse nome. Escolha outro nome.",
    );
  }
  const created: string[] = [];
  try {
    for (const root of projectRoots) {
      await mkdir(join(workspaceRoot, root), { recursive: true });
      await mkdir(join(workspaceRoot, root, id));
      created.push(join(workspaceRoot, root, id));
    }
    const manifest = manifestSchema.parse({
      ...input,
      schemaVersion: 1,
      id,
      createdAt: new Date().toISOString(),
    });
    await writeNew(
      `projects/${id}/motion.json`,
      JSON.stringify(manifest, null, 2) + "\n",
    );
    await writeNew(
      `projects/${id}/context/brief.md`,
      `# ${input.name}\n\n${input.brief || input.description || "Descreva o objetivo, o público e a direção visual deste motion design."}\n`,
    );
    for (const [name, content] of Object.entries(scaffoldScene(manifest))) {
      await writeNew(`scenes/${id}/${name}`, content);
    }
    return await getProject(id);
  } catch (error) {
    await Promise.all(
      created.map((folder) => rm(folder, { recursive: true, force: true })),
    );
    throw error;
  }
}

export function validateScenes(scenes: Scene[], duration: number) {
  if (new Set(scenes.map((scene) => scene.id)).size !== scenes.length) {
    throw new HttpError(400, "As cenas precisam ter identificadores únicos.");
  }
  for (const scene of scenes) {
    if (scene.end > duration) {
      throw new HttpError(
        400,
        `A cena ${scene.name} ultrapassa a duração do projeto.`,
      );
    }
  }
  return [...scenes].sort((a, b) => a.start - b.start);
}
