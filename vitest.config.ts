import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "three-first-person-controller": path.resolve(__dirname, "src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "tests/setupTests.ts",
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
