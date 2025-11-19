import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  base: "./",
  server: {
    open: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "three-first-person-controller": path.resolve(__dirname, "src/index.ts"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist-demo"),
    emptyOutDir: true,
  },
});
