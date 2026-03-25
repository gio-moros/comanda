import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    port: 4174,
    proxy: {
      "/health": "http://localhost:8080",
      "/workflows": "http://localhost:8080",
      "/files": "http://localhost:8080",
      "/list": "http://localhost:8080",
      "/process": "http://localhost:8080",
      "/ui/config": "http://localhost:8080",
    },
  },
});
