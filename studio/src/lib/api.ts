import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { z } from "zod";
import {
  librarySchema,
  projectSchema,
  type ProjectFile,
  textFileSchema,
  errorSchema,
} from "@shared/contracts";
import { useToast } from "@/components/ui/Toast";
import { loadAudio, summarizeAudio } from "@/lib/audio";

async function responseData(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    if (response.status === 413) {
      throw new Error(
        "O envio pode ter até 100 MB no total. Divida os arquivos em envios menores.",
      );
    }
    throw new Error(
      `A operação falhou (${response.status}). Confira se o servidor do Studio está em execução.`,
    );
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = errorSchema.safeParse(data);
    throw new Error(
      error.success
        ? error.data.error
        : `A operação falhou (${response.status}).`,
    );
  }
  return data;
}

async function read<T extends z.ZodType>(path: string, schema: T) {
  return schema.parse(await responseData(await fetch(path)));
}

export const libraryOptions = queryOptions({
  queryKey: ["library"],
  queryFn: async () => await read("/api/library", librarySchema),
  refetchInterval: 5000,
});

export function projectOptions(id: string) {
  return queryOptions({
    queryKey: ["project", id],
    queryFn: async () => await read(`/api/projects/${id}`, projectSchema),
    refetchInterval: 5000,
  });
}

export function audioOptions(url: string) {
  return queryOptions({
    queryKey: ["audio", url],
    queryFn: async () => await loadAudio(url),
    enabled: !!url,
    staleTime: Infinity,
    retry: false,
    structuralSharing: false,
  });
}

export function summaryOptions(url: string) {
  return queryOptions({
    queryKey: ["audio-summary", url],
    queryFn: async () => await summarizeAudio(url),
    staleTime: Infinity,
    retry: false,
    structuralSharing: false,
  });
}

export function textOptions(id: string, path: string) {
  return queryOptions({
    queryKey: ["text", id, path],
    queryFn: async () =>
      await read(
        `/api/projects/${id}/text?path=${encodeURIComponent(path)}`,
        textFileSchema,
      ),
    staleTime: 0,
  });
}

export async function write(path: string, method: string, data: unknown) {
  const body = data instanceof FormData ? data : JSON.stringify(data);
  const headers = new Headers({ "X-Motion-Studio": "1" });
  if (!(data instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return await responseData(await fetch(path, { method, body, headers }));
}

export function useStudioWrite<T>(options: {
  path: string | ((data: T) => string);
  method: string;
  message: string;
  onSuccess?: (data: unknown) => void;
}) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (data: T) =>
      await write(
        typeof options.path === "string" ? options.path : options.path(data),
        options.method,
        data,
      ),
    onSuccess: async (data) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["library"] }),
        client.invalidateQueries({ queryKey: ["project"] }),
        client.invalidateQueries({ queryKey: ["text"] }),
      ]);
      if (options.message) {
        toast(options.message);
      }
      options.onSuccess?.(data);
    },
    onError: (error) => toast(error.message, "error"),
  });
}

export function mediaUrl(origin: string, path: string) {
  return `${origin}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Endereço com a data de modificação, para o navegador buscar de novo quando o
// arquivo muda no disco.
export function fileUrl(origin: string, file: ProjectFile) {
  return `${mediaUrl(origin, file.path)}?revision=${encodeURIComponent(file.modifiedAt)}`;
}

export function thumbnailUrl(
  id: string,
  path: string,
  modifiedAt?: string,
  time?: number,
) {
  const parameters = new URLSearchParams({
    path,
    ...(modifiedAt ? { revision: modifiedAt } : {}),
    ...(time === undefined ? {} : { t: time.toFixed(2) }),
  });
  return `/api/projects/${id}/thumbnail?${parameters}`;
}
