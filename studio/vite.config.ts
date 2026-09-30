import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { version } from "./package.json";

export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.STUDIO_DEV_PORT ?? 4317),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.STUDIO_PORT ?? 4318}` },
  },
});
