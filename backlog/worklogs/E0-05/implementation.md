# E0-05 — Frontend bootstrap (React 18 + TS + Vite + Tailwind)

> Note: the implementer agent stalled mid-stream (API response cut off) **after** completing the scaffold and running the gates, but **before** committing and writing this worklog. The orchestrator verified the work was complete and correct (gates re-run green), authored this worklog, and committed the branch. No code was changed by the orchestrator beyond authoring this file.

## What was built
A minimal but real React 18 + TypeScript + Vite SPA in `frontend/`, extending the E0-02 `package.json` (pins preserved).

**Stack / versions (from `frontend/package.json`):**
- React `^18.3.1` + react-dom `^18.3.1` (React 18 per Art. VIII — NOT 19)
- Vite `^5.4.10` + `@vitejs/plugin-react`
- Tailwind CSS `^3.4.14` + PostCSS + autoprefixer
- TanStack Query `@tanstack/react-query ^5.59.0` (server state) — `QueryClientProvider` mounted in `main.tsx`
- Zustand `^5.0.0` (local UI state) — example `uiStore` (`sidebarOpen`/`toggleSidebar`) proves wiring
- `@dnd-kit/core ^6.3.1` — `DndContext` mounted in `App.tsx` proves install/importability
- ESLint `^9` + `typescript-eslint ^8` (flat config `eslint.config.js`)
- Vitest `^2` + Testing Library + jsdom (minimal test setup; `App.test.tsx` = 2 tests)

**Pins preserved (E0-02):** `"private": true`, `"packageManager": "pnpm@11.9.0"`, `"engines": { "node": ">=24" }` all intact.

## Files
- `frontend/`: `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `tsconfig*.json`, `.npmrc`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.gitignore`
- `frontend/src/`: `main.tsx` (providers), `App.tsx`, `index.css` (Tailwind directives), `store/uiStore.ts`, `App.test.tsx`, `test/setup.ts`, `vite-env.d.ts`
- `node_modules/` and `dist/` are gitignored (verified — not committed).

## Gate results (re-run by orchestrator from `frontend/`)
- `corepack pnpm lint` → clean (eslint + `tsc --noEmit`, no errors)
- `corepack pnpm build` → success (`tsc -b && vite build`, 85 modules, dist emitted)
- `corepack pnpm test` → 2/2 passed (Vitest)
- `corepack pnpm dev` → Vite boots (server-start path; not left running)

## Deliberate exclusions (other stories)
- **i18n / `nl.json` / `t()` helper → E0-06.** `App.tsx` is intentionally text-light and neutral (English/identifier text only); no Dutch UI strings hard-coded.
- **Radix UI + shadcn/ui + design tokens + Storybook → E0-09.**
- No backend, Docker, EF, or CI.

## Notes
- `pnpm-workspace.yaml` was added at `frontend/` by the scaffold; harmless. E0-08 (CI) and any future monorepo decision can revisit.
