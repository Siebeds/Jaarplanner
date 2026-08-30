// `defineConfig` from vitest/config rather than from vite: it is the same function widened with
// the `test` key. Vitest 3 no longer augments vite's own type through a triple-slash reference, so
// importing from "vite" here fails the build with TS2769 on the test block below.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The backend origin the dev server forwards `/api` to. Defaults to the `http` launch profile in
 * `backend/src/Jaarplanner.Api/Properties/launchSettings.json`. Override with
 * `VITE_API_PROXY_TARGET` when the API runs elsewhere.
 *
 * A proxy rather than a cross-origin base URL, for the same reason as the two frontends this one replaced: it
 * keeps the browser same-origin, so the API needs no CORS policy and answers no preflight.
 */
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:5184";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Every runtime dependency is listed, so the optimizer runs ONCE at startup instead of
  // discovering a dependency mid-crawl and re-running. That second pass renames
  // node_modules/.vite/deps while the first pass still holds it, which on Windows fails with
  // EBUSY: the pre-bundles are then missing, the browser 404s on them, and the page renders
  // white with no error in the app itself. Observed on both frontends that preceded this one.
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "@tanstack/react-query",
      "@radix-ui/react-dialog",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "zustand",
      "zustand/middleware",
      "clsx",
      "tailwind-merge",
    ],
  },
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true, secure: false },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
