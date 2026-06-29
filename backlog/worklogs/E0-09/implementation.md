# E0-09 — Design-system foundation (Radix + shadcn/ui + tokens + Storybook)

## Build round 1 — design tokens + shadcn primitives + sample component + Storybook + axe

- **FR / Article:** ADR-0017; Constitution Art. VIII (Tailwind + @dnd-kit; Radix/shadcn
  complement), Art. XII (doelsoort colours), Art. II.3 (Dutch UI via `nl.json`),
  Art. X (small, reviewable). UX doc `docs/ux/ui-ux-approach.md` §2.1.

### Files changed

- `frontend/src/index.css` — added the design tokens as CSS variables (shadcn pattern)
  under `@layer base :root`: HSL channels for doelsoort / suggestiestatus / dekking +
  the base shadcn UI tokens. Single source of truth for token values.
- `frontend/tailwind.config.js` — mapped each CSS variable to a semantic Tailwind colour
  token (`hsl(var(--token) / <alpha-value>)`, so opacity modifiers work). Added the
  `.storybook/**` glob to `content`, and `borderRadius` tied to `--radius`.
- `frontend/src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge), the shadcn utility.
- `frontend/src/components/ui/button.tsx` — copied-in shadcn/ui Button (Radix `Slot` for
  `asChild`, cva variants, AA focus ring). Restyled with base tokens.
- `frontend/src/components/ui/badge.tsx` — copied-in shadcn/ui Badge, extended with the
  Jaarplanner semantic variants (doelsoort / suggestiestatus / dekking) reading the tokens.
- `frontend/src/components/DoelsoortBadge.tsx` — **sample component**: renders an Op.stap
  doelsoort as a token-coloured badge; abbreviation as visible text, full Dutch label as
  the accessible name (colour never the sole signal — ADR-0017 §4).
- `frontend/src/components/DoelsoortBadge.test.tsx` — Vitest + jest-axe smoke test.
- `frontend/src/components/DoelsoortBadge.stories.tsx` — Storybook story (sample component).
- `frontend/src/components/ui/button.stories.tsx` — Storybook story (Button primitive).
- `frontend/src/i18n/nl.json` — added `doelsoort.*` (full Dutch labels) and
  `doelsoortAfkorting.*` (MD/G/+/P/S/A) keys. No hard-coded Dutch in components.
- `frontend/src/test/setup.ts` — registered jest-axe `toHaveNoViolations` on vitest expect.
- `frontend/.storybook/main.ts` + `preview.ts` — Storybook (react-vite) config + a11y addon;
  telemetry disabled; imports `src/index.css` so stories render with the real tokens.
- `frontend/eslint.config.js` — exempted `*.stories.{ts,tsx}` from the i18n guard (like
  tests); added `storybook-static` to `ignores` (build output must not be linted).
- `frontend/.gitignore` — ignore `storybook-static`.
- `frontend/package.json` — `storybook` + `build-storybook` scripts; new deps (below).

### Design tokens (the token list + semantics)

All paired with a label/icon in the UI — colour is never the sole signal (WCAG 2.2 AA).
Token class form: `bg-<group>-<name>` / `text-<group>-<name>-foreground`.

**doelsoort** (Art. XII conventions):
| token | doelsoort | colour |
| --- | --- | --- |
| `doelsoort-md` | MD — minimumdoel | blue |
| `doelsoort-gemeenschappelijk` | G | neutral/grey |
| `doelsoort-verdieping` | + | green |
| `doelsoort-precurriculum` | P (illustratief) | pink |
| `doelsoort-specifiek` | S (illustratief) | pink |
| `doelsoort-anderstalige` | A | yellow/amber |

**suggestiestatus** (DoelKoppeling lifecycle, Art. IV):
`suggestie-voorgesteld` (blue/outline) · `suggestie-aanvaard` (green/solid) ·
`suggestie-geweigerd` (red/struck) · `suggestie-manueel` (purple marker).

**dekking** (coverage, FR-9):
`dekking-gedekt` (green) · `dekking-deels` (amber) · `dekking-niet-gedekt` (red).

Plus base shadcn tokens: `background`, `foreground`, `primary`, `secondary`, `muted`,
`accent`, `border`, `input`, `ring`, and `--radius`.

### shadcn/Radix components copied in

- `Button` (`components/ui/button.tsx`) — uses `@radix-ui/react-slot`, `cva`.
- `Badge` (`components/ui/badge.tsx`) — `cva`, extended with the domain variants.
Both are owned/copied in (ADR-0017 "copied in"); no remote registry at runtime.

### Sample component

`DoelsoortBadge` (`components/DoelsoortBadge.tsx`) — renders the badge in the doelsoort
token colour, with the abbreviation (MD/G/+/…) as text and the full Dutch label as the
accessible name (both via `t()`). Satisfies "a sample component renders from the tokens".

### Storybook

Storybook 8.6 (react-vite), reusing the app Vite/Tailwind pipeline. Stories:
`Doelen/DoelsoortBadge` (Minimumdoel, Verdieping, AlleDoelsoorten) and `UI/Button`.
`@storybook/addon-a11y` runs axe in the Storybook UI; `@storybook/addon-essentials` for
controls/docs. Scripts: `storybook` (dev -p 6006 --no-open), `build-storybook` (static).

### axe wiring (where it runs, how asserted)

- **Automated (CI, `pnpm test`):** `DoelsoortBadge.test.tsx` renders the sample component
  (every doelsoort variant) and the Button, calls `axe(container)` (jest-axe) and asserts
  `toHaveNoViolations()`. Matcher registered in `src/test/setup.ts`. This is the gate the
  E0-08 CI runs.
- **Interactive:** `@storybook/addon-a11y` runs axe on every story in the Storybook UI
  (`preview.ts` `a11y.test: "error"`).

### i18n lint guard kept green

- The sample component renders only `t()` values; its `aria-label`/`title` are `t()` values
  too — no literals flagged.
- Story files use illustrative demo copy, so `*.stories.{ts,tsx}` is exempted in
  `eslint.config.js` exactly as test files already are (E0-06 mechanism unchanged).

### Deps added (exact versions installed)

Runtime: `@radix-ui/react-slot 1.3.0`, `class-variance-authority 0.7.1`, `clsx 2.1.1`,
`tailwind-merge 3.6.0`, `lucide-react 1.22.0`.
Dev: `storybook 8.6.18`, `@storybook/react 8.6.18`, `@storybook/react-vite 8.6.18`,
`@storybook/addon-essentials 8.6.14`, `@storybook/addon-a11y 8.6.18`,
`@storybook/test 8.6.15`, `jest-axe 10.0.0`, `@types/jest-axe 3.5.9`.

### Gates (from `frontend/`, `corepack pnpm <cmd>`)

- `pnpm lint` ✓ — 0 errors, 2 warnings (`react-refresh/only-export-components` on the
  shadcn `buttonVariants`/`badgeVariants` co-exports; rule is `warn`, standard shadcn).
- `pnpm test` ✓ — 7 passed (incl. the axe smoke check across all doelsoort variants + Button).
- `pnpm build` ✓ — tsc + vite build clean; CSS grew 5.99→13.80 kB (tokens applied).
- `pnpm build-storybook` ✓ — static Storybook built to `storybook-static/`.
- `pnpm storybook` ✓ — dev server served on :6006; `/index.json` listed both stories;
  stopped after confirmation.

### E0-02 pins preserved

`private: true`, `packageManager: pnpm@11.9.0`, `engines.node: >=24`, React 18 — untouched.
All installs via `corepack pnpm`.

### Self-check vs acceptance criteria

- *A sample component renders from the design tokens* → met: `DoelsoortBadge` colour comes
  from the doelsoort tokens (index.css → tailwind.config → Badge variant). CSS bundle grew,
  confirming the token classes are emitted.
- *It appears in Storybook* → met: `Doelen/DoelsoortBadge` story; dev server `/index.json`
  listed it; static build compiled `DoelsoortBadge.stories-*.js`.
- *It passes an axe accessibility smoke check* → met: jest-axe test asserts
  `toHaveNoViolations` for all variants + Button (passing in `pnpm test`), and the a11y
  addon runs axe per story in Storybook.

### For the test-runner

- **Unit / CI:** from `frontend/`, `corepack pnpm install` then `corepack pnpm test` —
  expect 7 passing, including `DoelsoortBadge.test.tsx > has no axe violations for every
  doelsoort variant`. Also run `corepack pnpm lint` (0 errors) and `corepack pnpm build`.
- **Storybook static:** `corepack pnpm build-storybook` → `storybook-static/` produced.
- **Storybook served (optional, Playwright):** `corepack pnpm storybook` → open
  `http://localhost:6006/?path=/story/doelen-doelsoortbadge--alle-doelsoorten` (six coloured
  badges, each with its abbreviation) and `.../?path=/story/ui-button--default`. The a11y
  addon panel shows axe results per story.

### Open questions / Art. XIV touched

None. Suggestiestatus and dekking tokens are defined for the foundation but not yet consumed
by a component (their consumers are later epics — AI review UX E?, dekkingsoverzicht E5).
No open decision hard-assumed.

- **Branch:** story/E0-09

## Fix round (gate findings) — 3 cleanup items

1. **Removed the `dekking-deels` token** (finding: MVP coverage is BINARY per Art. IX.3;
   graded/partial coverage is an Art. XIV open decision we must not pre-decide). Dropped the
   `--dekking-deels` / `--dekking-deels-foreground` CSS variables (`src/index.css`), the
   `dekking.deels` Tailwind token (`tailwind.config.js`), and the `deels` Badge variant
   (`src/components/ui/badge.tsx`). Only `gedekt` / `niet-gedekt` remain. Added a short
   comment in each place noting the binary-MVP / Art. XIV rationale.
   - Grep confirmation: `rg deels frontend` returns only the two explanatory comments
     (index.css, tailwind.config.js) — no token/variant references remain.
2. **Removed the unused `lucide-react` dependency** (zero imports in `src`/`.storybook`).
   Dropped from `frontend/package.json` and refreshed the lockfile via `corepack pnpm
   install` (`- lucide-react 1.22.0`). Can be re-added at first real icon use.
   - Grep confirmation: `rg lucide frontend/src frontend/.storybook` → no matches.
3. **Removed the spurious `allowBuilds:` placeholder block** from `pnpm-workspace.yaml`
   (literal `esbuild: set this to true or false` — not a valid pnpm key). Kept
   `onlyBuiltDependencies: [esbuild]`. The follow-up `corepack pnpm install` ran with no
   `ERR_PNPM_IGNORED_BUILDS` warning and did not re-add the block — esbuild's build step is
   still approved via `onlyBuiltDependencies`.

The `*.stories` i18n exemption and the demo "Opslaan" string were left as-is (accepted).

### Re-run gates (from `frontend/`, `corepack pnpm`)

- `pnpm install` ✓ — `- lucide-react 1.22.0`; no ignored-build warning.
- `pnpm lint` ✓ — 0 errors (2 `warn`-level shadcn `*Variants` co-export warnings, unchanged).
- `pnpm test` ✓ — 7 passed, axe smoke check still green.
- `pnpm build` ✓ — CSS 13.80 → 13.51 kB (deels token gone).
- `pnpm build-storybook` ✓ — static Storybook built.
