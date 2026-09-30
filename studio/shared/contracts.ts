import { z } from "zod";

export const projectStatusSchema = z.enum(["draft", "review", "approved"]);
export const fileKindSchema = z.enum([
  "video",
  "image",
  "audio",
  "document",
  "code",
  "html",
  "other",
]);
export const fileGroupSchema = z.enum([
  "source",
  "assets",
  "renders",
  "context",
]);
export const studioUploadLimits = {
  fileCount: 50,
  totalBytes: 100 * 1024 * 1024,
};
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
// Alternativa renderizada de uma cena, para escolher no Studio. O arquivo é o
// vídeo inteiro com a alternativa no lugar, então a cena começa no mesmo tempo.
export const sceneVariantSchema = z.object({
  file: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
});
export const sceneSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(120),
    start: z.number().min(0),
    end: z.number().positive(),
    description: z.string().max(5000).default(""),
    thumbnail: z.string().optional(),
    variants: z.array(sceneVariantSchema).max(20).default([]),
    selected: z.string().default(""),
  })
  .refine((scene) => scene.end > scene.start, {
    message: "O fim precisa ser depois do início.",
  });
export const referenceSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(200),
  url: z
    .url()
    .refine((url) => /^https?:\/\//i.test(url), "Use um link http ou https."),
  description: z.string().max(5000).default(""),
});
export const noteSchema = z.object({
  id: z.string(),
  text: z.string().trim().min(1).max(10000),
  time: z.number().min(0).optional(),
  file: z.string().optional(),
  resolved: z.boolean().default(false),
  createdAt: z.string(),
});
export const muffleSchema = z.object({
  enabled: z.boolean().default(false),
  until: z.number().min(0).max(3600).default(0),
  cutoff: z.number().min(200).max(20000).default(2200),
});
// Música candidata; offset é o ponto da faixa que toca no início do vídeo.
export const musicOptionSchema = z.object({
  file: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  offset: z.number().min(0).max(86400).default(0),
});
// Momento em que uma camada de efeito toca, com ganho em dB e pan (-1 a 1).
export const soundHitSchema = z.object({
  time: z.number().min(0).max(86400),
  label: z.string().max(120).optional(),
  gain: z.number().min(-60).max(24).default(0),
  pan: z.number().min(-1).max(1).default(0),
});
// Som candidato de uma camada. Um efeito pontual toca em cada momento, com o
// ataque (segundos depois de start) no tempo exato; um stem é a faixa do vídeo
// inteiro e toca alinhado ao tempo 0.
export const soundOptionSchema = z.object({
  file: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  start: z.number().min(0).max(86400).default(0),
  attack: z.number().min(0).max(60).default(0),
  duration: z.number().positive().max(86400).optional(),
  gain: z.number().min(-60).max(24).default(0),
  stem: z.boolean().default(false),
});
export const soundLayerSchema = z.object({
  id: slugSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
  hits: z.array(soundHitSchema).max(5000).default([]),
  options: z.array(soundOptionSchema).max(50).default([]),
  selected: z.string().default(""),
  volume: z.number().min(0).max(2).default(1),
});
export const auditionSchema = z.object({
  track: z.string().default(""),
  offset: z.number().min(0).max(86400).default(0),
  volume: z.number().min(0).max(2).default(0.5),
  originalVolume: z.number().min(0).max(1).default(0),
  fadeIn: z.number().min(0).max(10).default(0),
  fadeOut: z.number().min(0).max(10).default(0),
  muffle: muffleSchema.default({ enabled: false, until: 0, cutoff: 2200 }),
  music: z.array(musicOptionSchema).max(200).default([]),
  effects: z.array(soundLayerSchema).max(40).default([]),
});
export type Audition = z.infer<typeof auditionSchema>;
export type MusicOption = z.infer<typeof musicOptionSchema>;
export type SoundLayer = z.infer<typeof soundLayerSchema>;
export type SoundOption = z.infer<typeof soundOptionSchema>;
export type SoundHit = z.infer<typeof soundHitSchema>;

// O agent define candidatas, camadas e momentos; o Studio grava só as escolhas,
// para salvar nunca desfazer o que o agent escreveu depois.
export const auditionChoicesSchema = auditionSchema
  .omit({ music: true, effects: true })
  .extend({
    effects: z
      .record(
        z.string(),
        z.object({
          selected: z.string(),
          volume: z.number().min(0).max(2),
        }),
      )
      .default({}),
  });
export type AuditionChoices = z.infer<typeof auditionChoicesSchema>;

export function auditionChoices({
  music: _music,
  effects,
  ...rest
}: Audition): AuditionChoices {
  return {
    ...rest,
    effects: Object.fromEntries(
      effects.map((layer) => [
        layer.id,
        { selected: layer.selected, volume: layer.volume },
      ]),
    ),
  };
}

export function applyAuditionChoices(
  audition: Audition,
  { effects, ...rest }: AuditionChoices,
): Audition {
  return {
    ...audition,
    ...rest,
    effects: audition.effects.map((layer) => {
      const choice = effects[layer.id];
      const known =
        !choice?.selected ||
        layer.options.some((option) => option.file === choice.selected);
      return choice && known ? { ...layer, ...choice } : layer;
    }),
  };
}
export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: slugSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
  status: projectStatusSchema.default("draft"),
  favorite: z.boolean().default(false),
  width: z.number().int().min(64).max(7680).multipleOf(4).default(1440),
  height: z.number().int().min(64).max(7680).multipleOf(2).default(1440),
  fps: z.number().int().min(1).max(120).default(60),
  duration: z.number().positive().max(3600).default(30),
  createdAt: z.string(),
  contextPaths: z.array(z.string()).default([]),
  scenes: z.array(sceneSchema).default([]),
  references: z.array(referenceSchema).default([]),
  notes: z.array(noteSchema).default([]),
  audition: auditionSchema.default(auditionSchema.parse({})),
  approvedFile: z.string().optional(),
});
export type Manifest = z.infer<typeof manifestSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type SceneVariant = z.infer<typeof sceneVariantSchema>;
export type Note = z.infer<typeof noteSchema>;
export type FileKind = z.infer<typeof fileKindSchema>;
export type FileGroup = z.infer<typeof fileGroupSchema>;

export const fileSchema = z.object({
  path: z.string(),
  name: z.string(),
  kind: fileKindSchema,
  group: fileGroupSchema,
  size: z.number(),
  modifiedAt: z.string(),
  version: z.string().optional(),
});
export type ProjectFile = z.infer<typeof fileSchema>;
export const copyFileInputSchema = z.object({ path: z.string().min(1) });
export const openFolderInputSchema = z.object({
  folder: z.enum(["scenes", "assets", "renders", "projects"]),
});
export type OpenFolderInput = z.infer<typeof openFolderInputSchema>;
export const livePreviewStatusSchema = z.object({
  type: z.literal("motion-studio:status"),
  ready: z.boolean(),
  error: z.string().optional(),
});
export const exportVideoInputSchema = copyFileInputSchema.extend({
  targetMB: z.number().min(0.5).max(500),
  resolution: z.enum(["original", "1080", "720", "480"]),
});
export type ExportVideoInput = z.infer<typeof exportVideoInputSchema>;
export const exportedVideoSchema = z.object({
  key: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string(),
  size: z.number(),
});
export const mediaInfoSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  fps: z.number(),
  hasAudio: z.boolean(),
});
export type MediaInfo = z.infer<typeof mediaInfoSchema>;
export const versionSchema = z.object({
  name: z.string(),
  files: z.array(fileSchema),
  videos: z.array(fileSchema),
  modifiedAt: z.string(),
});
export const projectSchema = z.object({
  manifest: manifestSchema,
  files: z.array(fileSchema),
  versions: z.array(versionSchema),
  cover: z.string().optional(),
  latestVideo: z.string().optional(),
  source: z.string().optional(),
  updatedAt: z.string(),
  totalSize: z.number(),
  media: z.record(z.string(), mediaInfoSchema).default({}),
});
export type Project = z.infer<typeof projectSchema>;
export const librarySchema = z.object({
  root: z.string(),
  previewOrigin: z.string(),
  projects: z.array(projectSchema),
  issues: z.array(z.object({ project: z.string(), message: z.string() })),
});
export type Library = z.infer<typeof librarySchema>;
export const textFileSchema = z.object({
  content: z.string(),
  revision: z.string(),
  editable: z.boolean(),
});
export const errorSchema = z.object({ error: z.string() });
export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).default(""),
  width: z.number().int().min(64).max(7680).multipleOf(4),
  height: z.number().int().min(64).max(7680).multipleOf(2),
  fps: z.number().int().min(1).max(120),
  duration: z.number().positive().max(3600),
  brief: z.string().max(500000).default(""),
});
export const updateProjectSchema = manifestSchema
  .pick({
    name: true,
    description: true,
    status: true,
    favorite: true,
    approvedFile: true,
  })
  .partial();
export const contextInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(500000),
});
export const textInputSchema = z.object({
  path: z.string(),
  content: z.string().max(500000),
  revision: z.string(),
});
export const referenceInputSchema = referenceSchema.omit({ id: true });
export const noteInputSchema = noteSchema.pick({
  text: true,
  time: true,
  file: true,
});
