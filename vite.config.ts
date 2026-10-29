import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: { outDir: "docs", emptyOutDir: true },
  server: { host: "127.0.0.1", allowedHosts: ["terminal.local"], fs: { strict: true } },
  preview: { host: "127.0.0.1" },
});
