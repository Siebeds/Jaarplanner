# E0-06 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (Vitest) + lint-guard verification

## Criteria checked
- "The sample screen renders ALL its user-facing text from `nl.json` (no hard-coded UI strings)." → PASS — `src/App.tsx` routes every user-facing string through `t(...)`: subtitle `t("app.ondertitel")`, button label `t("zijbalk.open")`/`t("zijbalk.gesloten")`, and `aria-label` `t("zijbalk.toggleOpenen")`/`t("zijbalk.toggleSluiten")`. The only literal JSX text is the brand word "Jaarplanner" (proper noun), explicitly exempted with an inline-documented `// eslint-disable-next-line no-restricted-syntax` (App.tsx:22-24). Vitest `App.test.tsx` test 2 asserts the rendered subtitle equals `t("app.ondertitel")` and test 3 asserts both button text content and aria-label equal their `t()` values — proving copy comes from the catalogue, not literals.
- "A lint rule/check FAILS when Dutch UI text is hard-coded in a component." → PASS — `eslint.config.js` defines `no-restricted-syntax` (error) with two selectors: `JSXText[value=/[A-Za-z]/]` (rendered JSX child text) and a `Literal` under user-facing attributes (`aria-label|title|placeholder|alt`). Independently verified: inserting `<p>Dit is een test</p>` into App.tsx and running `eslint src/App.tsx` produced `26:12 error no-restricted-syntax` and exit 1; reverting restored exit 0 with zero git diff.

## Commands run
- `corepack pnpm lint` (eslint . && tsc --noEmit) → exit 0 (PASS)
- `corepack pnpm build` (tsc -b && vite build) → exit 0, 87 modules transformed, built in 3.84s (PASS)
- `corepack pnpm test` (vitest run) → exit 0, 1 file / 3 tests passed (PASS)
- `corepack pnpm exec eslint src/App.tsx` with temporary hard-coded `<p>Dit is een test</p>` → exit 1, `no-restricted-syntax` error (guard fires as required)
- `corepack pnpm exec eslint src/App.tsx` after revert → exit 0; `git diff --stat frontend/src/App.tsx` → empty (clean revert)
- `grep -iE "i18next|react-intl|lingui|@radix-ui|shadcn|storybook" package.json` → no matches (scope held)

## Evidence
- `frontend/src/i18n/nl.json` — Dutch catalogue (app.ondertitel, zijbalk.open/gesloten/toggleOpenen/toggleSluiten).
- `frontend/src/i18n/index.ts` — dependency-free typed `t()` helper; keys typed via `DotKeys<NlCatalogue>` so unknown keys are compile errors; defensive runtime fallback returns the key.
- `frontend/eslint.config.js` — i18n guard selectors; tests explicitly exempted via override block.
- `frontend/src/App.tsx` — all copy via `t()`; brand word documented-exempt.
- `frontend/package.json` — pins preserved: `private: true`, `packageManager: pnpm@11.9.0`, `engines.node >=24`, React `^18.3.1`. No runtime i18n dep; no Radix/shadcn/Storybook (E0-09). No backend/Docker/CI touched.

## Defects
- None.
