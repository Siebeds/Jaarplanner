# E0-09 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (Vitest + jest-axe) + design-system static build (Storybook)

## Criteria checked
- "A sample component renders from the design tokens" → PASS — Full token chain is real and unbroken: `src/index.css` defines the doelsoort/suggestiestatus/dekking HSL CSS variables (e.g. `--doelsoort-md: 217 91% 40%`); `tailwind.config.js` maps them to semantic colours via `hsl(var(--token) / <alpha-value>)`; `src/components/ui/badge.tsx` (copied-in shadcn, Radix-compatible) exposes Dutch-named variants using `bg-doelsoort-md text-doelsoort-md-foreground` etc.; `src/components/DoelsoortBadge.tsx` derives its colour purely from `variant={doelsoort}` and routes its visible text + aria-label through `t()`. `pnpm build` emitted a 13.80 kB CSS bundle (gzip 3.01 kB) — tokens + utilities are compiled into the bundle. `ui/` contains copied-in shadcn `button.tsx` (uses `@radix-ui/react-slot`) and `badge.tsx`.
- "It appears in Storybook" → PASS — `corepack pnpm build-storybook` succeeded; `storybook-static/index.html` and `iframe.html` emitted; both `DoelsoortBadge.stories-*.js` and `button.stories-*.js` compiled into the static output. `.storybook/main.ts` globs `../src/**/*.stories.@(ts|tsx)` with react-vite + a11y addon; `.storybook/preview.ts` imports `src/index.css` so stories render with the real tokens.
- "It passes an axe accessibility smoke check" → PASS — `src/components/DoelsoortBadge.test.tsx` has a REAL axe assertion: `const results = await axe(container); expect(results).toHaveNoViolations();` run over all 6 doelsoort variants, plus a second axe check over `Button`. The matcher is genuinely registered in `src/test/setup.ts` via `expect.extend(toHaveNoViolations)` (loaded as a Vitest setupFile). Not skipped, not trivial. `pnpm test` → 7/7 pass (4 in DoelsoortBadge.test.tsx).

## Commands run
- `corepack pnpm install` → resolves; lockfile up to date (only an informational ERR_PNPM_IGNORED_BUILDS notice for esbuild — handled via pnpm-workspace.yaml onlyBuiltDependencies; not a failure).
- `corepack pnpm lint` → exit 0; 0 errors, 2 warnings (react-refresh on badge.tsx/button.tsx variant co-exports — explicitly acceptable per the story).
- `corepack pnpm test` → exit 0; 2 files, 7 tests passed (incl. the axe smoke checks).
- `corepack pnpm build` → exit 0; CSS bundle 13.80 kB (tokens emit), JS 208.84 kB.
- `corepack pnpm build-storybook` → exit 0; output to storybook-static/.

## Evidence
- CSS bundle: `dist/assets/index-DdRjyVGP.css  13.80 kB │ gzip: 3.01 kB`.
- Storybook artifacts: `storybook-static/assets/DoelsoortBadge.stories-CPoU0J_u.js`, `storybook-static/assets/button.stories-BT9haQCs.js`, `storybook-static/index.html`, `storybook-static/iframe.html`.
- Test output: `Test Files 2 passed (2) / Tests 7 passed (7)`.
- Axe matcher registration: `src/test/setup.ts` line 6-8 (`expect.extend(toHaveNoViolations)`).

## Scope / pins (all OK)
- `package.json`: `private: true`, `packageManager: pnpm@11.9.0`, `engines.node >=24`, React `^18.3.1` — all preserved.
- Added deps are design-system/Storybook/axe only: @radix-ui/react-slot, class-variance-authority, clsx, lucide-react, tailwind-merge; @storybook/*, jest-axe (+ @types/jest-axe), storybook.
- i18n guard intact: eslint.config.js exempts `**/*.stories.{ts,tsx}` and `**/*.test.{ts,tsx}`; sample component text routed through `t()`; nl.json gained real `doelsoort` + `doelsoortAfkorting` Dutch entries.
- No backend/Docker/CI changes (git diff HEAD~1 touches only frontend/ + backlog/worklogs/E0-09/). `storybook-static` is gitignored (frontend/.gitignore).

## Defects
- None.
