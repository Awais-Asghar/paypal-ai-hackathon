import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  // Each test boots an in-memory PGlite; on slower machines that setup alone can pass the 10s hook default.
  test: { environment: "node", testTimeout: 30_000, hookTimeout: 30_000 },
});
