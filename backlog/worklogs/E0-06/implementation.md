# E0-06 — i18n scaffold (`frontend/src/i18n/nl.json`)

## Build round 1 — centralised Dutch strings, `t()` helper, hard-coded-literal lint guard

- **FR / Article:** Constitution Art. II.3 (all user-facing strings Dutch + centralised in `nl.json`, never hard-coded), Art. X (small/reviewable, lint clean, no hard-coded UI Dutch). ADR-0005 (Dutch ubiquitous language & centralised i18n — this story scaffolds `nl.json` + the lint; E7-01 enforces repo-wide). NFR-1 (fully Dutch UI).

- **Files changed:**
  - `frontend/src/i18n/nl.json` — new: the single Dutch UI-string catalogue (the source of truth per Art. II.3).
  - `frontend/src/i18n/index.ts` — new: minimal, dependency-free, typed `t()` lookup helper.
  - `frontend/src/App.tsx` — converted the sample screen so all user-facing copy comes from `t()`; only the brand word "Jaarplanner" remains a literal (exempted via a documented inline disable).
  - `frontend/src/App.test.tsx` — extended Vitest to assert rendered copy equals the `nl.json`/`t()` values (proves the wiring, not a hard-coded duplicate).
  - `frontend/eslint.config.js` — added the `no-restricted-syntax` i18n guard (two selectors) + a test-file override.

### `nl.json` key convention
- **Nested by feature/area**, callers use the **flattened dot path**. Top-level groups so far: `app` (`app.ondertitel`) and `zijbalk` (`zijbalk.open`, `zijbalk.gesloten`, `zijbalk.toggleOpenen`, `zijbalk.toggleSluiten`).
- **Keys are stable technical identifiers** (not user-facing) — a Dutch/English mix in keys is fine; **values are always Dutch**.
- The catalogue holds **only referenced strings** (no dead keys): the old English placeholder "Frontend skeleton (E0-05)" was replaced by a real Dutch subtitle rather than translated 1:1.

### `t()` helper design (`frontend/src/i18n/index.ts`)
- **Dependency-free** — no react-i18next. The MVP is Dutch-only with no runtime language switching, so a full i18n library is unjustified weight; a tiny typed lookup is preferred per the story.
- **Compile-time typed against the JSON.** A recursive `DotKeys<T>` type derives the union of dot-notation paths whose leaves are strings (`TranslationKey`). `t()` accepts only valid keys → a typo or missing key is a **TypeScript error** (caught by `tsc --noEmit` in `pnpm lint`).
- **Runtime:** splits the key, walks `nl.json`, returns the string. Defensive fallback returns the key itself if a value is somehow missing (UI degrades visibly instead of crashing). JSON import works under `moduleResolution: "bundler"` (resolveJsonModule implied).

### `App.tsx` conversion
- Subtitle → `t("app.ondertitel")`.
- Button label → `t("zijbalk.open")` / `t("zijbalk.gesloten")` (replaces the English `sidebar: open/closed`).
- Button `aria-label` → `t("zijbalk.toggleSluiten")` / `t("zijbalk.toggleOpenen")` (a11y: the toggle now has an accessible name; semantic `<main>`/`<h1>`/`<button>` retained — full a11y tooling is E0-09).
- `<h1>Jaarplanner</h1>` kept as a literal: it is a brand/proper noun, not translatable copy (allowed per story + `lang="nl"` in index.html). Exempted with a one-line `// eslint-disable-next-line no-restricted-syntax` plus an explaining comment, so the exemption is explicit and reviewable.

### ESLint guard — what it catches and its limits
Implemented with the **built-in `no-restricted-syntax`** rule (no new dependency, vs. pulling in `eslint-plugin-react` just for `react/jsx-no-literals`). Two AST selectors:
1. `JSXText[value=/[A-Za-z]/]` — any text rendered as a JSX child (e.g. `<p>Hallo</p>`). Whitespace/punctuation-only JSX text (indentation, newlines, `{" "}`) is **not** flagged.
2. `JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal[value=/[A-Za-z]/]` — string literals in the user-facing accessibility/text attributes.

**Deliberately NOT flagged (no false positives):** `className`, `id`, `key`, `type`, `role`, `htmlFor`, `data-*`/test props, and anything passed through `t(...)` (it's a `CallExpression`, not a literal). **Test files are exempted** (override block) because tests legitimately assert against literal copy.

**Limits (documented in the config):** it is a *structural* heuristic, not a Dutch-language detector — an English literal in a rendered/text slot is flagged too. For a Dutch-only UI that is the intended discipline: route copy through `t()`. Genuine non-copy exceptions (brand words) use an explicit, commented inline disable.

### Proof the guard fires
Temporarily injected into `App.tsx`:
- `<p>Dit is een hard-gecodeerde Nederlandse zin.</p>` and
- `<input placeholder="Zoek een leerplandoel" />`

`eslint src/App.tsx` reported:
```
26:12  error  No hard-coded UI text in JSX. ... use t('...') (Constitution Art. II.3)  no-restricted-syntax
27:28  error  No hard-coded UI text in a user-facing attribute. ... (Constitution Art. II.3)  no-restricted-syntax
✖ 2 problems (2 errors, 0 warnings)
```
ESLint exit code **1** (lint fails). Both injected lines were then reverted; final lint is clean.

- **Gates (run from `frontend/` with `corepack pnpm`):**
  - `corepack pnpm lint` (`eslint . && tsc --noEmit`) — ✓ exit 0
  - `corepack pnpm build` (`tsc -b && vite build`) — ✓ exit 0 (87 modules, built in ~5.7s)
  - `corepack pnpm test` (`vitest run`) — ✓ 3/3 tests passed
  - (backend gates N/A — frontend-only story)
- **Pins preserved:** `package.json` unchanged — `"private": true`, `"packageManager": "pnpm@11.9.0"`, `"engines.node": ">=24"`, React 18. No new dependencies added.
- **Branch:** story/E0-06 (based on feature/e0-foundation).

### Self-check vs acceptance criteria
- *A sample screen renders ALL its user-facing text from `nl.json`* → **met.** `App.tsx` sources its subtitle, button label, and toggle aria-label from `t()`; the only literal is the brand word "Jaarplanner" (explicitly exempted). Evidence: `App.test.tsx` asserts each rendered string equals its `t(...)` catalogue value.
- *A lint rule fails when Dutch UI text is hard-coded in a component* → **met.** Demonstrated above: injecting a JSX-text literal and a `placeholder` literal makes `eslint` exit 1 with two errors; clean state exits 0.

### For the test-runner
- **Unit (Vitest):** from `frontend/`, `corepack pnpm test` → 3 passing tests in `src/App.test.tsx`.
- **Lint guard:** `corepack pnpm lint` passes on the committed code. To re-prove the guard fires, temporarily add `<p>Een Nederlandse zin.</p>` to `App.tsx` and run `corepack pnpm exec eslint src/App.tsx` → expect exit 1 with a `no-restricted-syntax` error, then revert.
- **Build:** `corepack pnpm build` passes.
- **Playwright not required** — this is a static i18n seam; no new runtime route/flow. If a visual check is wanted: `corepack pnpm dev` and confirm the page shows the Dutch subtitle "Plan en bewijs de dekking van je leerplandoelen." and the button reads "Zijbalk is gesloten" / "Zijbalk is open" on toggle.

### Open questions / Art. XIV touched
- None. No open decision is hard-assumed. The i18n approach is intentionally minimal and leaves the Art. XIV "multilingual later?" door open: swapping `t()` for a fuller library or adding more catalogues is localised to `src/i18n/`.
