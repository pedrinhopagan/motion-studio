import { join } from "node:path";
import { z } from "zod";
import {
  createProjectSchema,
  updateProjectSchema,
  contextInputSchema,
  textInputSchema,
  referenceInputSchema,
  noteInputSchema,
  sceneSchema,
  auditionChoicesSchema,
  applyAuditionChoices,
  studioUploadLimits,
  copyFileInputSchema,
  openFolderInputSchema,
  exportVideoInputSchema,
  exportedVideoSchema,
} from "../shared/contracts";
import {
  getLibrary,
  getProject,
  createProject,
  updateManifest,
  assertProjectFile,
  validateScenes,
} from "./library";
import {
  workspaceRoot,
  workspacePath,
  HttpError,
  serveFile,
  slugify,
  writeNew,
  atomicWrite,
  revision,
} from "./files";
import {
  probeMedia,
  videoThumbnail,
  stopMediaProcesses,
  exportVideo,
  exportedVideoPath,
} from "./media";
import { copyFile, stopClipboardProcess } from "./clipboard";
import { openFolder } from "./folders";
import { livePreviewHtml } from "./live-preview";

const port = Number(process.env.STUDIO_PORT ?? 4318);
const previewPort = Number(process.env.STUDIO_PREVIEW_PORT ?? 4319);
const devPort = Number(process.env.STUDIO_DEV_PORT ?? 4317);
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const uiOrigins = [
  `http://127.0.0.1:${port}`,
  `http://localhost:${port}`,
  `http://127.0.0.1:${devPort}`,
  `http://localhost:${devPort}`,
];
const jsonHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const textExtensions = /\.(md|txt|js|ts|jsx|tsx|css|html|json|sh|py)$/i;

function failure(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: jsonHeaders },
    );
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400, headers: jsonHeaders },
    );
  }
  if (error instanceof SyntaxError) {
    return Response.json(
      { error: "O arquivo ou pedido contém JSON inválido." },
      { status: 400, headers: jsonHeaders },
    );
  }
  console.error(error);
  return Response.json(
    {
      error:
        "Não foi possível concluir a operação. Consulte o terminal do Studio.",
    },
    { status: 500, headers: jsonHeaders },
  );
}

const preview = Bun.serve({
  hostname: "127.0.0.1",
  port: previewPort,
  async fetch(request) {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        throw new HttpError(405, "A prévia permite apenas leitura.");
      }
      const url = new URL(request.url);
      const path = decodeURIComponent(url.pathname.slice(1));
      const parentOrigin = url.searchParams.get("studio");

      if (parentOrigin && /\.html$/i.test(path)) {
        if (!uiOrigins.includes(parentOrigin)) {
          throw new HttpError(403, "Abra a composição pelo Motion Studio.");
        }

        const html = await Bun.file(await workspacePath(path)).text();
        return new Response(
          request.method === "HEAD"
            ? null
            : livePreviewHtml(html, parentOrigin),
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-cache",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }

      return await serveFile(request, path);
    } catch (error) {
      return failure(error);
    }
  },
});

async function api(request: Request, url: URL) {
  const path = url.pathname;
  const method = request.method;
  if (!/^(GET|HEAD)$/.test(method)) {
    const origin = request.headers.get("origin");
    if (origin && !uiOrigins.includes(origin)) {
      throw new HttpError(403, "Esse pedido não veio do Motion Studio.");
    }
    if (request.headers.get("x-motion-studio") !== "1") {
      throw new HttpError(
        403,
        "Abra a interface do Motion Studio para editar arquivos.",
      );
    }
  }
  if (path === "/api/library" && method === "GET") {
    return Response.json(await getLibrary(previewOrigin), {
      headers: jsonHeaders,
    });
  }
  if (path === "/api/projects" && method === "POST") {
    return Response.json(
      await createProject(createProjectSchema.parse(await request.json())),
      { status: 201, headers: jsonHeaders },
    );
  }

  const match = /^\/api\/projects\/([a-z0-9-]+)(?:\/(.*))?$/.exec(path);
  if (!match) {
    throw new HttpError(404, "Operação não encontrada.");
  }
  const [, id, action = ""] = match;

  if (action === "open-folder" && method === "POST") {
    const input = openFolderInputSchema.parse(await request.json());
    await getProject(id);
    await openFolder(`${input.folder}/${id}`);
    return Response.json({ opened: true }, { headers: jsonHeaders });
  }

  if (action === "copy-file" && method === "POST") {
    const input = copyFileInputSchema.parse(await request.json());
    await assertProjectFile(id, input.path);
    await copyFile(input.path);
    return Response.json({ copied: true }, { headers: jsonHeaders });
  }
  if (action === "export" && method === "POST") {
    const input = exportVideoInputSchema.parse(await request.json());
    const file = await assertProjectFile(id, input.path);
    if (file.kind !== "video") {
      throw new HttpError(400, "Escolha um render de vídeo para comprimir.");
    }
    if (input.targetMB * 1000000 >= file.size) {
      throw new HttpError(400, "Escolha um tamanho alvo menor que o original.");
    }
    return Response.json(await exportVideo(id, input), {
      headers: jsonHeaders,
    });
  }
  if (action === "export" && method === "GET") {
    await getProject(id);
    const key = exportedVideoSchema.shape.key.parse(
      url.searchParams.get("key"),
    );
    const name = z
      .string()
      .max(240)
      .regex(/^[^/\\\r\n]+\.mp4$/)
      .parse(url.searchParams.get("name"));
    const file = Bun.file(exportedVideoPath(id, key));
    if (!(await file.exists())) {
      throw new HttpError(
        404,
        "Essa exportação não está disponível. Gere o vídeo novamente.",
      );
    }
    return new Response(file, {
      headers: {
        ...jsonHeaders,
        "Content-Type": "video/mp4",
        "Content-Length": String(file.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  }

  if (!action && method === "GET") {
    const project = await getProject(id);
    const results = await Promise.allSettled(
      project.files
        .filter((file) => file.kind === "video" || file.kind === "audio")
        .map(async (file) => [file.path, await probeMedia(file.path)] as const),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        project.media[result.value[0]] = result.value[1];
      }
    }
    return Response.json(project, { headers: jsonHeaders });
  }
  if (!action && method === "PATCH") {
    const input = updateProjectSchema.parse(await request.json());
    if (input.approvedFile) {
      const file = await assertProjectFile(id, input.approvedFile);
      if (file.kind !== "video") {
        throw new HttpError(400, "Escolha um render de vídeo para aprovar.");
      }
    }
    return Response.json(
      await updateManifest(id, (manifest) => ({ ...manifest, ...input })),
      { headers: jsonHeaders },
    );
  }
  if (action === "thumbnail" && method === "GET") {
    const file = await assertProjectFile(
      id,
      url.searchParams.get("path") ?? "",
    );
    if (file.kind !== "video") {
      throw new HttpError(400, "A miniatura precisa de um vídeo.");
    }
    const time = z.coerce
      .number()
      .min(0)
      .max(86400)
      .optional()
      .parse(url.searchParams.get("t") ?? undefined);
    return new Response(Bun.file(await videoThumbnail(file.path, time)), {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }
  if (action === "text" && method === "GET") {
    const file = await assertProjectFile(
      id,
      url.searchParams.get("path") ?? "",
    );
    if (!textExtensions.test(file.path)) {
      throw new HttpError(400, "Esse arquivo não é um documento de texto.");
    }
    if (file.size > 500000) {
      throw new HttpError(
        413,
        "O documento é grande demais para o editor. Baixe o arquivo para abri-lo.",
      );
    }
    const content = await Bun.file(await workspacePath(file.path)).text();
    return Response.json(
      {
        content,
        revision: revision(content),
        editable:
          file.path.startsWith(`projects/${id}/context/`) &&
          /\.(md|txt)$/i.test(file.path),
      },
      { headers: jsonHeaders },
    );
  }
  if (action === "text" && method === "PUT") {
    const input = textInputSchema.parse(await request.json());
    await assertProjectFile(id, input.path);
    if (
      !input.path.startsWith(`projects/${id}/context/`) ||
      !/\.(md|txt)$/i.test(input.path)
    ) {
      throw new HttpError(
        403,
        "O editor altera apenas os textos na pasta de contexto deste projeto.",
      );
    }
    return Response.json(
      await updateManifest(id, async (manifest) => {
        const current = await Bun.file(await workspacePath(input.path)).text();
        if (revision(current) !== input.revision) {
          throw new HttpError(
            409,
            "O arquivo foi alterado fora do Studio. Reabra o documento antes de salvar para preservar a alteração.",
          );
        }
        await atomicWrite(input.path, input.content);
        return manifest;
      }),
      { headers: jsonHeaders },
    );
  }
  if (action === "context" && method === "POST") {
    const input = contextInputSchema.parse(await request.json());
    await getProject(id);
    const name = slugify(input.title) || "contexto";
    await writeNew(
      `projects/${id}/context/${name}.md`,
      `# ${input.title}\n\n${input.content}\n`,
    );
    return Response.json(
      { saved: true },
      { status: 201, headers: jsonHeaders },
    );
  }
  if (action === "upload" && method === "POST") {
    await getProject(id);
    const form = await request.formData();
    const category = z.enum(["assets", "context"]).parse(form.get("category"));
    const uploads = z
      .array(
        z
          .instanceof(File)
          .transform((file) => ({
            file,
            name: file.name.replace(/[\\/\x00-\x1f]/g, "_").replace(/^\.+/, ""),
          }))
          .refine(
            (entry) => !!entry.name && entry.name !== "motion.json",
            "Use um nome válido para o arquivo.",
          ),
      )
      .min(1, "Escolha pelo menos um arquivo.")
      .max(
        studioUploadLimits.fileCount,
        `Envie até ${studioUploadLimits.fileCount} arquivos por vez.`,
      )
      .refine(
        (entries) =>
          entries.reduce((size, entry) => size + entry.file.size, 0) <=
          studioUploadLimits.totalBytes,
        "O envio pode ter até 100 MB no total.",
      )
      .parse(form.getAll("files"));
    const saved: string[] = [];
    for (const { file: upload, name } of uploads) {
      const target =
        category === "context"
          ? `projects/${id}/context/${name}`
          : `assets/${id}/uploads/${name}`;
      const extension = name.includes(".") ? `.${name.split(".").at(-1)}` : "";
      const base = extension ? target.slice(0, -extension.length) : target;
      const destination = (await Bun.file(join(workspaceRoot, target)).exists())
        ? `${base}-${crypto.randomUUID().slice(0, 8)}${extension}`
        : target;
      await writeNew(destination, new Uint8Array(await upload.arrayBuffer()));
      saved.push(destination);
    }
    return Response.json({ saved }, { status: 201, headers: jsonHeaders });
  }
  if (action === "references" && method === "POST") {
    const reference = referenceInputSchema.parse(await request.json());
    return Response.json(
      await updateManifest(id, (manifest) => ({
        ...manifest,
        references: [
          ...manifest.references,
          { ...reference, id: crypto.randomUUID() },
        ],
      })),
      { headers: jsonHeaders },
    );
  }
  if (action === "notes" && method === "POST") {
    const note = noteInputSchema.parse(await request.json());
    if (note.file) {
      await assertProjectFile(id, note.file);
    }
    return Response.json(
      await updateManifest(id, (manifest) => ({
        ...manifest,
        notes: [
          ...manifest.notes,
          {
            ...note,
            id: crypto.randomUUID(),
            resolved: false,
            createdAt: new Date().toISOString(),
          },
        ],
      })),
      { headers: jsonHeaders },
    );
  }
  if (action.startsWith("notes/") && method === "PATCH") {
    const input = z
      .object({ resolved: z.boolean() })
      .parse(await request.json());
    return Response.json(
      await updateManifest(id, (manifest) => {
        if (!manifest.notes.some((note) => note.id === action.slice(6))) {
          throw new HttpError(404, "Anotação não encontrada.");
        }
        return {
          ...manifest,
          notes: manifest.notes.map((note) =>
            note.id === action.slice(6)
              ? { ...note, resolved: input.resolved }
              : note,
          ),
        };
      }),
      { headers: jsonHeaders },
    );
  }
  if (action === "scenes" && method === "PUT") {
    const scenes = z
      .array(sceneSchema)
      .max(200)
      .parse(await request.json());
    // O editor muda tempos e textos; as alternativas de cada cena são do agent.
    return Response.json(
      await updateManifest(id, (manifest) => ({
        ...manifest,
        scenes: validateScenes(
          scenes.map((scene) => {
            const current = manifest.scenes.find(
              (entry) => entry.id === scene.id,
            );
            return current
              ? {
                  ...scene,
                  variants: current.variants,
                  selected: current.selected,
                }
              : scene;
          }),
          manifest.duration,
        ),
      })),
      { headers: jsonHeaders },
    );
  }
  if (action.startsWith("scenes/") && method === "PATCH") {
    const { selected } = z
      .object({ selected: z.string() })
      .parse(await request.json());
    return Response.json(
      await updateManifest(id, (manifest) => {
        const scene = manifest.scenes.find(
          (entry) => entry.id === action.slice(7),
        );
        if (!scene) {
          throw new HttpError(404, "Cena não encontrada.");
        }
        if (
          selected &&
          !scene.variants.some((variant) => variant.file === selected)
        ) {
          throw new HttpError(400, "Escolha uma das opções desta cena.");
        }
        return {
          ...manifest,
          scenes: manifest.scenes.map((entry) =>
            entry === scene ? { ...entry, selected } : entry,
          ),
        };
      }),
      { headers: jsonHeaders },
    );
  }
  if (action === "audition" && method === "PUT") {
    const choices = auditionChoicesSchema.parse(await request.json());
    if (choices.track) {
      const file = await assertProjectFile(id, choices.track);
      if (file.kind !== "audio") {
        throw new HttpError(400, "Escolha um arquivo de áudio do projeto.");
      }
    }
    return Response.json(
      await updateManifest(id, (manifest) => ({
        ...manifest,
        audition: applyAuditionChoices(manifest.audition, choices),
      })),
      { headers: jsonHeaders },
    );
  }
  throw new HttpError(404, "Operação não encontrada.");
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  idleTimeout: 255,
  maxRequestBodySize: studioUploadLimits.totalBytes + 10 * 1024 * 1024,
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!allowedHosts.includes(request.headers.get("host") ?? "")) {
        throw new HttpError(403, "Host inválido.");
      }
      if (url.pathname.startsWith("/api/")) {
        return await api(request, url);
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        throw new HttpError(405, "Método inválido.");
      }
      // Arquivos com extensão vêm do build; qualquer outro caminho abre a SPA.
      const hashed = url.pathname.startsWith("/assets/");
      const bundled = /^\/[\w./-]+\.\w+$/.test(url.pathname);
      if (url.pathname.includes("..")) {
        throw new HttpError(403, "Caminho inválido.");
      }
      const file = Bun.file(
        join(
          import.meta.dir,
          "../dist",
          bundled ? url.pathname.slice(1) : "index.html",
        ),
      );
      if (!(await file.exists())) {
        if (bundled) {
          throw new HttpError(404, "Arquivo não encontrado.");
        }
        return new Response(
          "Execute bun run build e depois bun run start. Para desenvolver, use bun run dev.",
          { status: 503 },
        );
      }
      return new Response(file, {
        headers: {
          "Cache-Control": hashed
            ? "public, max-age=31536000, immutable"
            : "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      return failure(error);
    }
  },
});

function stop() {
  stopMediaProcesses();
  stopClipboardProcess();
  server.stop(true);
  preview.stop(true);
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
console.log(
  `Motion Studio: http://127.0.0.1:${port}\nPrévias: ${previewOrigin}\nArquivos: ${workspaceRoot}`,
);
