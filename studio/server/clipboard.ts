import { pathToFileURL } from "node:url";
import { HttpError, workspacePath } from "./files";

let owner: ReturnType<typeof Bun.spawn> | undefined;

export function stopClipboardProcess() {
  owner?.kill();
  owner = undefined;
}

// O processo mantém a oferta do arquivo até outra cópia ou o encerramento.
export async function copyFile(path: string) {
  const full = await workspacePath(path);
  const uri = `${pathToFileURL(full).href}\r\n`;
  const args = process.env.WAYLAND_DISPLAY && Bun.which("wl-copy")
    ? ["wl-copy", "--foreground", "--type", "text/uri-list"]
    : ["xclip", "-quiet", "-selection", "clipboard", "-t", "text/uri-list"];

  if (!Bun.which(args[0])) {
    throw new HttpError(503, "A cópia de arquivos precisa de wl-copy (Wayland) ou xclip (X11). Você pode baixar o original ou copiar seu caminho.");
  }

  stopClipboardProcess();
  const child = Bun.spawn(args, { stdin: new Blob([uri]), stdout: "ignore", stderr: "pipe" });
  owner = child;
  const ready = await Promise.race([
    child.exited.then(() => false),
    Bun.sleep(200).then(() => true),
  ]);

  if (!ready) {
    owner = undefined;
    const errors = await new Response(child.stderr).text();
    throw new HttpError(503, `Não foi possível copiar o arquivo nesta sessão. ${errors.slice(-300)}`);
  }
}
