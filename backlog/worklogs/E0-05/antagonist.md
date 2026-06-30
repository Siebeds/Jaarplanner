# Antagonist Review — E0-05 Frontend bootstrap (React 18 + TS + Vite + Tailwind)

**Verdict:** COMPLIANT
**Scope audited:** `git diff feature/e0-foundation...story/E0-05` (commit 170c958), all 21 changed files under `frontend/` + the E0-05 worklog.

## Findings
No violations found. See "Checks run" below for proof.

### [QUESTION] pnpm-workspace.yaml at frontend/ root presupposes nothing, but note it
- **Article/FR:** Art. XIV (open decisions) / Art. VIII (architecture).
- **Where:** `frontend/pnpm-workspace.yaml`
- **Problem:** Not a violation — declared in the brief as a scaffold artifact. It is a benign single-package workspace and does not hard-assume a monorepo layout for the repo root. Flagged only so E0-08 (CI) / any future repo-root workspace decision revisits it deliberately rather than inheriting it by accident.
- **Required fix:** None now. Confirm intent when CI / repo-root tooling is set up.

## Checks run (proof of thoroughness)
- **Art. VIII — stack fidelity:** `frontend/package.json` declares `react`/`react-dom` `^18.3.1` (NOT 19); `frontend/pnpm-lock.yaml` resolves every react reference to `18.3.1` (grep confirmed no `react@19`). Vite `^5.4.10` + `@vitejs/plugin-react`; Tailwind `^3.4.14` + PostCSS + autoprefixer; TanStack Query `^5.59.0` (`QueryClientProvider` in `main.tsx`); Zustand `^5.0.0` (`store/uiStore.ts`); `@dnd-kit/core ^6.3.1` (`DndContext` in `App.tsx`). No forbidden libs (no EPPlus relevance here; no Redux/MobX/styled-components/CSS-in-JS contradicting Tailwind). Compliant.
- **Art. II — domain language / i18n:** Inspected `App.tsx`, `uiStore.ts`, `main.tsx`, `App.test.tsx`, `index.html`. The only Dutch tokens are the product name "Jaarplanner" (brand, in `<h1>`, `<title>`, package name) and `lang="nl"` in `index.html` — both legitimate, not translatable UI copy. All other UI/identifier text is English ("sidebar: open/closed", "Frontend skeleton (E0-05)"). No hard-coded Dutch user-facing strings; correctly defers i18n to E0-06. Compliant.
- **Art. VI — secrets:** grep across `frontend/src` + config + html + json for api[_-]key/secret/password/token/bearer/connectionstring/azure returned nothing. No AI client, no fetch to any AI endpoint, no key reachable from frontend. `.gitignore` ignores `.env`/`.env.*`/`*.local`. Compliant.
- **E0-02 pin preservation:** `frontend/package.json` retains `"private": true` (l.3), `"packageManager": "pnpm@11.9.0"` (l.6), `"engines": { "node": ">=24" }` (l.7-9). All intact. Compliant.
- **Scope discipline:** Changed files are all under `frontend/` (+ worklog). No `nl.json`, no `t()` helper, no Radix/shadcn/design tokens/Storybook, no backend, no Docker, no CI workflow. `App.tsx` comment explicitly defers i18n→E0-06 and design system→E0-09. No scope creep.
- **Art. X — DoD:** Single small commit (170c958), working tree clean. `git ls-files frontend` confirms neither `node_modules/` nor `dist/` is tracked. Worklog records lint/build/test gates green (2/2 Vitest). ESLint 9 flat config present and ignores dist/node_modules/coverage. Change is small and reviewable (excluding the generated lockfile, the hand-written surface is ~15 small files). Compliant.
- **Art. XIV — open decisions:** No planningsblok/month assumption, no discipline list, no thema-scope or visibility assumption — none of those concepts appear in this skeleton. Nothing hard-assumed.
- **Art. III / IV / V / VII / IX:** Not applicable to this story — no curriculum data, no Excel mapping, no AI client/orchestration, no coverage logic, no domain entities introduced. Confirmed by inspection that none of these were touched.

## Open questions surfaced
- `frontend/pnpm-workspace.yaml` (single-package workspace) — confirm the intended repo-level package-management layout when E0-08 (CI) lands. Not blocking.
