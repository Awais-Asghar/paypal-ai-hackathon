import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  // Each test boots an in-memory PGlite. The first boot in each worker compiles its WebAssembly, which took
  // over 30 s on Windows with 7 files in parallel next to a running dev server.
  test: { environment: "node", testTimeout: 30_000, hookTimeout: 90_000 },
});
