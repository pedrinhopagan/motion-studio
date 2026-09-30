const children = [
  Bun.spawn(["bun", "server/index.ts"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
  Bun.spawn(["bun", "node_modules/vite/bin/vite.js"], {
    stdout: "inherit",
    stderr: "inherit",
  }),
];

let shutdown: Promise<void> | undefined;

function stop() {
  shutdown ??= (async () => {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGTERM");
    }
    const timeout = setTimeout(() => {
      for (const child of children) {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }, 2000);
    try {
      await Promise.all(children.map((child) => child.exited));
    } finally {
      clearTimeout(timeout);
    }
  })();
  return shutdown;
}

process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
const exitCode = await Promise.race(children.map((child) => child.exited));
await stop();
process.exitCode = exitCode;
