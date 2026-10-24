import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // PGlite loads its WebAssembly files at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  partialPrefetching: true,
  logging: { browserToTerminal: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
