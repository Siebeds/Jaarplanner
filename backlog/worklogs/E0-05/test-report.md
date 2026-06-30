# E0-05 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (CLI gates) + brief dev-server smoke

## Criteria checked
- "`pnpm dev` serves the app." → PASS — `corepack pnpm dev --port 5191` reported `VITE v5.4.21 ready in 505 ms`, served `http://localhost:5191/`; `curl` probe returned `HTTP 200`. Server then stopped (subsequent probe `HTTP 000`).
- "`pnpm build` passes (production build)." → PASS — `corepack pnpm build` (`tsc -b && vite build`) exited 0; 85 modules transformed; emitted `dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js`.
- "`pnpm lint` passes (ESLint + TypeScript type-check)." → PASS — `corepack pnpm lint` (`eslint . && tsc --noEmit`) exited 0 with no diagnostics.

## Additional scope/acceptance checks
- package.json pins preserved → PASS — `"private": true`, `"packageManager": "pnpm@11.9.0"`, `"engines.node": ">=24"`; `react`/`react-dom` `^18.3.1` (React 18, not 19).
- Mandated libs present → PASS — `@tanstack/react-query ^5.59.0`, `zustand ^5.0.0`, `@dnd-kit/core ^6.3.1`, `tailwindcss ^3.4.14`.
- TanStack Query provider wired → PASS — `src/main.tsx` mounts `QueryClientProvider` around `<App />`.
- Zustand store + DndContext exist → PASS — `src/store/uiStore.ts` (`create<UiState>` sidebar toggle); `src/App.tsx` wraps UI in `<DndContext>`.
- Scope discipline → PASS — no `src/i18n` dir / `nl.json` / `t()` (E0-06); no Radix/shadcn/Storybook in package.json (E0-09); no backend/Docker/CI; UI text is neutral English ("Jaarplanner", "Frontend skeleton (E0-05)", "sidebar: open/closed") — no hard-coded Dutch UI strings.
- node_modules and dist NOT committed → PASS — `git ls-files frontend | grep -cE 'node_modules/|dist/'` = 0; `.gitignore` ignores `node_modules` and `dist`.
- Vitest tests are meaningful → PASS — `src/App.test.tsx` (2 tests): renders title heading; clicks button and asserts Zustand state toggles closed→open (exercises wiring, not vacuous).

## Commands run
- `corepack pnpm lint` → exit 0 (eslint + tsc --noEmit clean)
- `corepack pnpm build` → exit 0, dist emitted (index.html + assets)
- `corepack pnpm test` → exit 0, 1 file / 2 tests passed (Vitest v2.1.9)
- `corepack pnpm dev --port 5191` → Vite ready in 505 ms; `curl http://localhost:5191/` → HTTP 200; stopped after probe
- `git ls-files frontend | grep -cE 'node_modules/|dist/'` → 0

## Evidence
- Build output: `dist/index.html 0.40 kB`, `dist/assets/index-CSBFGVsj.css 5.99 kB`, `dist/assets/index-Bb9PdMor.js 208.14 kB`; "built in 2.18s".
- Test output: `Test Files 1 passed (1)`, `Tests 2 passed (2)`.
- Dev: `VITE v5.4.21 ready in 505 ms` → Local http://localhost:5191/ → curl HTTP 200.

## Defects
None.
