# Antagonist Review — E0-06 i18n scaffold (nl.json + t() + lint guard)

**Verdict:** COMPLIANT
**Scope audited:** branch diff `feature/e0-foundation...story/E0-06` (commit 60b8d94) — `frontend/src/i18n/nl.json`, `frontend/src/i18n/index.ts`, `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/eslint.config.js`, `backlog/worklogs/E0-06/implementation.md`.

## Findings
No violations found. No CRITICAL / MAJOR / MINOR / QUESTION findings.

## Checks run (proof of thoroughness)
- **Art. II.3 — central nl.json, no hard-coded Dutch.** Verified `App.tsx` sources all copy via `t()` (`app.ondertitel`, `zijbalk.open/gesloten`, aria-label `zijbalk.toggleOpenen/toggleSluiten`). Grepped all `.tsx`/`.ts` under `frontend/src` for JSX-text and aria-label/title/placeholder/alt literals: the ONLY match is `<h1>Jaarplanner</h1>` — the documented brand/proper-noun exemption (inline `eslint-disable-next-line` + comment, `lang="nl"` set in index.html). `main.tsx` and `uiStore.ts` contain only English infra strings (error message, comments). No leak.
- **Lint guard actually enforces the rule (not just asserted).** Independently injected `<p>Dit is een hard-gecodeerde Nederlandse zin.</p>` and `<input placeholder="Zoek een leerplandoel" />` into App.tsx and ran `eslint src/App.tsx`: both flagged (`no-restricted-syntax`, 2 errors, exit 1) with the Art. II.3 message. Reverted; working tree restored to committed state via `git checkout`. The two AST selectors (`JSXText[value=/[A-Za-z]/]` and the attribute selector) are sound and `t(...)` (a CallExpression) is correctly not flagged. Test-file override (`**/*.test.{ts,tsx}`, `src/test/**`) is reasonable — tests legitimately assert against literal copy.
- **Art. II.1/II.2 — Dutch domain language vs English infra split.** i18n keys/helper are English technical identifiers (`t`, `DotKeys`, `TranslationKey`); catalogue values are Dutch UI copy. Split respected. No domain entities introduced in this story.
- **Art. VI.4 — secrets.** Scanned the diff and new files: no keys, tokens, connection strings, or env material. nl.json holds only UI copy. None present.
- **E0-02 pin preservation.** `frontend/package.json` diff is EMPTY (unchanged). Confirmed `"private": true`, `"packageManager": "pnpm@11.9.0"`, `"engines.node": ">=24"`, React `^18.3.1`. No new dependency added (no react-i18next) — the tiny custom typed `t()` is the in-scope choice.
- **Scope discipline (Art. VIII / E0-09 boundary).** No Radix/shadcn/design tokens/Storybook, no heavy i18n library, no backend, no Docker, no CI added. App.tsx header comment correctly defers the design system and full a11y tooling to E0-09. No scope creep.
- **Art. X — Definition of Done.** Ran `corepack pnpm lint` → exit 0 (eslint + tsc --noEmit clean). Ran `corepack pnpm test` → 3/3 pass. Change is small and reviewable (6 files, +198/-9). No hard-coded Dutch past the guard; no secrets.
- **Art. XIV — open decisions.** Nothing hard-assumed. Dutch-only-for-now with a localised seam under `src/i18n/`; the "multilingual later?" door (Art. XIV) stays open. Compile-time-typed keys (`DotKeys<NlCatalogue>`) make a typo/missing key a tsc error — a genuine safety property, not over-engineering.

## Open questions surfaced
- None. The implementation does not touch any Art. XIV open decision and isolates the i18n choice behind a clean seam.

## Note
- During verification I temporarily injected test literals into `App.tsx` to confirm the lint guard fires, then ran `git checkout -- frontend/src/App.tsx` to restore the committed content. The working tree is clean; no project files were modified by this review.
