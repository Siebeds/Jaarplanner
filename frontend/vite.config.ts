/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The backend origin the dev server forwards `/api` to. Defaults to the `http` launch profile in
 * `backend/src/Jaarplanner.Api/Properties/launchSettings.json` (the profile `dotnet run` picks by
 * default). Override with `VITE_API_PROXY_TARGET` when running the API elsewhere or on the `https`
 * profile (https://localhost:7274).
 */
const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:5184";

// Vite + React 18 SPA config (Art. VIII). Vitest test config is colocated here.
export default defineConfig({
  plugins: [react()],
  server: {
    // `src/lib/api.ts` issues same-origin relative requests (`/api/...`) — its docstring has always
    // said "the dev server proxy resolves them", but no proxy existed, so every call from
    // `pnpm dev` 404'd against Vite itself and the whole doelsuggestie UI showed only its error copy.
    //
    // A proxy (rather than pointing VITE_API_BASE_URL at the API) is deliberate: it keeps the browser
    // same-origin, so no CORS policy and no preflight is needed. Setting a cross-origin base URL
    // would instead require the API to answer an OPTIONS preflight for the JSON `Content-Type` the
    // client always sends — extra server config that buys nothing in development.
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        // Accept the ASP.NET dev certificate when the target is the https profile.
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
