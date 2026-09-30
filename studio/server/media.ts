import { stat, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { workspaceRoot, workspacePath, revision, HttpError } from "./files";
import { mediaInfoSchema, type ExportVideoInput } from "../shared/contracts";

const probeSchema = z
  .object({
    format: z.object({ duration: z.string().optional() }),
    streams: z.array(
      z.object({
        codec_type: z.string(),
        width: z.number().optional(),
        height: z.number().optional(),
        avg_frame_rate: z.string().optional(),
      }),
    ),
  })
  .transform((raw) => {
    const video = raw.streams.find((stream) => stream.codec_type === "video");
    const rate = video?.avg_frame_rate?.split("/").map(Number);
    return mediaInfoSchema.parse({
      duration: Number(raw.format.duration ?? 0),
      width: video?.width ?? 0,
      height: video?.height ?? 0,
      fps: rate?.[1] ? rate[0] / rate[1] : 0,
      hasAudio: raw.streams.some((stream) => stream.codec_type === "audio"),
    });
  });
const probes = new Map<string, Promise<z.infer<typeof mediaInfoSchema>>>();
const thumbnails = new Map<string, Promise<string>>();
const exports = new Map<string, Promise<{ key: string; name: string; size: number }>>();
let active = 0;
const waiters: (() => void)[] = [];
const children = new Set<ReturnType<typeof Bun.spawn>>();

export function stopMediaProcesses() {
  for (const child of children) {
    child.kill("SIGKILL");
  }
}

async function runMedia(args: string[], timeoutMs = 10000) {
  if (!Bun.which(args[0])) {
    throw new HttpError(
      503,
      "Instale o FFmpeg e o ffprobe para visualizar os dados de mídia e miniaturas.",
    );
  }
  if (active >= 2) {
    await new Promise<void>((done) => waiters.push(done));
  } else {
    active++;
  }
  try {
    const child = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    children.add(child);
    const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    try {
      const [output, errors, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      if (code !== 0) {
        throw new HttpError(
          422,
          `Não foi possível ler a mídia. ${errors.slice(-500)}`,
        );
      }
      return output;
    } finally {
      clearTimeout(timeout);
      children.delete(child);
    }
  } finally {
    const next = waiters.shift();
    if (next) {
      next();
    } else {
      active--;
    }
  }
}

async function mediaKey(path: string) {
  const full = await workspacePath(path);
  const info = await stat(full);
  return { full, key: revision(`${path}:${info.mtimeMs}:${info.size}`) };
}

export async function probeMedia(path: string) {
  const { full, key } = await mediaKey(path);
  const cached = probes.get(key);
  if (cached) {
    return await cached;
  }
  const pending = runMedia([
    "ffprobe",
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_type,width,height,avg_frame_rate",
    "-of",
    "json",
    full,
  ]).then((output) => probeSchema.parse(JSON.parse(output)));
  probes.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    probes.delete(key);
    throw error;
  }
}

// Sem tempo, a capa usa um quadro do início; com tempo, é o quadro da cena.
export async function videoThumbnail(path: string, time?: number) {
  const media = await mediaKey(path);
  const full = media.full;
  const key = time === undefined ? media.key : revision(`${media.key}@${time}`);
  const cached = thumbnails.get(key);
  if (cached) {
    return await cached;
  }
  const pending = (async () => {
    const folder = join(workspaceRoot, ".motion-studio", "cache");
    const output = join(folder, `${key}.jpg`);
    if (await Bun.file(output).exists()) {
      return output;
    }
    await mkdir(folder, { recursive: true });
    const info = await probeMedia(path);
    const temporary = `${output}.${crypto.randomUUID()}.jpg`;
    try {
      await runMedia([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-threads",
        "1",
        "-ss",
        String(
          time === undefined
            ? Math.min(1, info.duration / 4)
            : Math.min(time, Math.max(0, info.duration - 0.05)),
        ),
        "-i",
        full,
        "-frames:v",
        "1",
        "-vf",
        time === undefined
          ? "scale=640:640:force_original_aspect_ratio=decrease"
          : "scale=320:320:force_original_aspect_ratio=decrease",
        "-threads",
        "1",
        "-y",
        temporary,
      ]);
      await rename(temporary, output);
    } finally {
      await rm(temporary, { force: true });
    }
    return output;
  })();
  thumbnails.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    thumbnails.delete(key);
    throw error;
  }
}

export function exportedVideoPath(id: string, key: string) {
  return join(workspaceRoot, ".motion-studio", "exports", `${id}-${key}.mp4`);
}

export async function exportVideo(id: string, input: ExportVideoInput) {
  const media = await mediaKey(input.path);
  const info = await probeMedia(input.path);

  if (!Number.isFinite(info.duration) || info.duration <= 0 || info.width <= 0) {
    throw new HttpError(422, "Não foi possível identificar a duração e as dimensões deste vídeo.");
  }

  const audioRate = info.hasAudio ? 96000 : 0;
  const videoRate = Math.floor(input.targetMB * 1000000 * 8 * 0.96 / info.duration - audioRate);

  if (videoRate < 50000) {
    throw new HttpError(400, "Esse tamanho é pequeno demais para a duração do vídeo. Aumente o tamanho alvo em MB.");
  }

  const key = revision(`${media.key}:${input.targetMB}:${input.resolution}:h264-v1`);
  const cached = exports.get(key);

  if (cached) {
    return await cached;
  }

  if (exports.size) {
    throw new HttpError(429, "Já existe um vídeo sendo comprimido. Aguarde a conclusão antes de exportar outro.");
  }

  const pending = (async () => {
    const output = exportedVideoPath(id, key);
    const name = `${input.path.split("/").at(-1)!.replace(/\.[^.]+$/, "")}-${input.targetMB}MB-${input.resolution}.mp4`;

    if (await Bun.file(output).exists()) {
      return { key, name, size: Bun.file(output).size };
    }

    // Duas passagens distribuem o bitrate pelo vídeo para respeitar o tamanho alvo.
    await mkdir(join(workspaceRoot, ".motion-studio", "exports"), { recursive: true });
    const folder = join(workspaceRoot, ".motion-studio", "exports", crypto.randomUUID());
    await mkdir(folder);
    const temporary = join(folder, "video.mp4");
    const edge = input.resolution === "original" ? Math.max(info.width, info.height) : Number(input.resolution);
    const scale = Math.min(1, edge / Math.max(info.width, info.height));
    const width = Math.max(2, Math.floor(info.width * scale / 2) * 2);
    const height = Math.max(2, Math.floor(info.height * scale / 2) * 2);
    const args = [
      "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "2", "-i", media.full,
      "-map", "0:v:0", "-vf", `scale=${width}:${height}`, "-c:v", "libx264", "-preset", "fast",
      "-b:v", String(videoRate), "-pix_fmt", "yuv420p", "-threads", "2", "-passlogfile", join(folder, "pass"),
    ];

    try {
      await runMedia([...args, "-pass", "1", "-an", "-f", "null", "/dev/null"], 120000);
      await runMedia([...args, "-pass", "2", "-map", "0:a:0?", "-c:a", "aac", "-b:a", String(audioRate || 96000), "-movflags", "+faststart", "-y", temporary], 120000);
      await rename(temporary, output);
      return { key, name, size: Bun.file(output).size };
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  })();
  exports.set(key, pending);

  try {
    return await pending;
  } finally {
    exports.delete(key);
  }
}
