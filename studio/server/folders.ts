import { stat } from "node:fs/promises";
import { HttpError, workspacePath } from "./files";

export async function openFolder(path: string) {
  const full = await workspacePath(path);

  if (!(await stat(full)).isDirectory()) {
    throw new HttpError(400, "Escolha uma pasta do projeto.");
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";

  if (!Bun.which(command)) {
    throw new HttpError(
      503,
      "O gerenciador de arquivos não está disponível nesta sessão.",
    );
  }

  const child = Bun.spawn([command, full], {
    stdout: "ignore",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => child.kill(), 8000);

  try {
    const code = await child.exited;

    if (code !== 0) {
      const detail = await new Response(child.stderr).text();
      throw new HttpError(
        503,
        `Não foi possível abrir a pasta. ${detail.slice(-300)}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
