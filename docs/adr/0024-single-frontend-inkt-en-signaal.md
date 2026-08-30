# ADR-0024 — One frontend at `frontend/`, design direction "Inkt en Signaal"

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Architect (Siebe De Saedeleir / team), on the project owner's ruling of 2026-08-30
- **Relates to:** [ADR-0017](0017-ui-ux-design-system.md) (UI/UX approach & design system). This ADR
  **supersedes ADR-0017 decisions 1, 2, 3 and 5** and leaves 4 and 6 standing. It supersedes nothing else:
  [ADR-0005](0005-dutch-ubiquitous-language-i18n.md) (Dutch copy in `nl.json`) and
  [ADR-0021](0021-frontend-routing-and-url-selection.md) (routing and URL selection) continue to govern unchanged.
- **Realises:** NFR-1 (Dutch UI), NFR-2 (calm interface, minimal training), NFR-7 (recent browsers).
  **Constitution:** Art. VIII (Tailwind, @dnd-kit), Art. XII (colour conventions and never colour alone),
  Art. II (Dutch UI copy), Art. X (the Definition of Done gates).
- **Backlog:** E9 (UX herwerking).

## Context

The repository carried **three** frontends at once: `frontend/` (the original, the only one CI built),
`frontend-mobile/` (added by `acabd2e` and never touched again, zero tests, its README still the Vite
template) and `frontend-v3/` (the one actually being built on, and the only one with feature parity plus
day-level activiteitplaatsing).

That is not a design decision, it is an accident of parallel work, and it had three costs. A reader could
not tell which directory was the product. `frontend-v3/` was **built, linted and tested by nobody** — CI
pins `working-directory: frontend`, so the app under active development had no gate while a retired one
had all of them. And every path in `CLAUDE.md`, `CONSTITUTION.md`, the backlog and thirty-odd worklogs
pointed at `frontend/`, which had stopped being where the work happened.

ADR-0017 chose shadcn/ui copied in, design tokens in `tailwind.config.js`, a Storybook catalog and a
desktop-first layout. The frontend that was actually built made four different choices, and made them for
reasons worth recording rather than quietly leaving the ADR to describe a directory that no longer exists.

## Decision

1. **There is one frontend, and it lives at `frontend/`.** `frontend-v3/` is renamed to `frontend/`; the
   previous `frontend/` and `frontend-mobile/` are deleted. The name carried a version number only while
   there was something to distinguish it from. The history of all three stays in git; nothing is lost that
   `git log` cannot answer.
2. **Radix primitives directly, no shadcn/ui copy-in.** Only the primitives that earn their weight are taken
   (`@radix-ui/react-dialog`, `@radix-ui/react-visually-hidden`); the rest of `src/components/ui/` is written
   here, in the domain's Dutch names (`Knop`, `Blad`, `Veld`, `Doelsoortmerk`, `Statusmerk`). Copying in a
   component library we then restyle beyond recognition bought vocabulary, not accessibility.
   *(Supersedes ADR-0017 decision 1.)*
3. **Design tokens live in `src/index.css`, not in `tailwind.config.js`.** Tailwind v4 configures in CSS and
   the project has no `tailwind.config.js` at all. The tokens themselves are unchanged in intent: doelsoort,
   suggestiestatus and dekking each keep their hue, defined once, never inline.
   *(Supersedes ADR-0017 decision 2 as to location only.)*
4. **The chrome has no brand hue — direction "Inkt en Signaal".** Art. XII already spends nine hues on
   *meaning*: six doelsoorten, four suggestiestatussen, two dekkingstoestanden and one attentiekleur. Every
   remaining hue sits within roughly 25 degrees of one already taken, so a brand hue would not be a free
   choice: it would compete with a signal a teacher has to read. The chrome is therefore built from paper,
   ink and a near-black for primary actions, plus **one** rationed accent (`--color-accent`, hue 187) spent
   on exactly five things: the primary action, the active destination, the focus ring, the fill of the year
   strip, and a selected row. That ration is the decision. Spending it anywhere else puts chrome back in
   competition with the domain colours, which is the whole thing this palette avoids. The full argument is at
   the top of `frontend/src/index.css` and is the rule the rest of the design follows.
5. **Mobile first, with a real two column layout from `lg` up.** Not a desktop layout squeezed down, and not
   a phone layout stretched wide. *(Supersedes ADR-0017 decision 5, which was desktop-first.)*
6. **No Storybook; oxlint replaces ESLint.** `pnpm lint` is `oxlint && tsc --noEmit`. The component catalog
   that Storybook would host is instead covered by Vitest, including `src/i18n/catalogus.test.ts`, which
   fails the build on an em dash, on an unreferenced catalogue key, and on Dutch text hard-coded in a
   component instead of in `nl.json`. *(Supersedes ADR-0017 decision 3.)*
7. **CI gates the frontend that ships.** Because the surviving directory is `frontend/`, the existing
   `working-directory: frontend` job lints, tests and builds the live app with no workflow change. This is
   the point of the rename, not a side effect of it.

**ADR-0017 decisions 4 (WCAG 2.2 AA, colour never the only signal) and 6 (all copy in Dutch via `nl.json`)
stand unchanged and are not restated here.**

## Alternatives considered

- **Keep all three directories and point CI at each.** Honest about history, but it asks every future reader
  to decide which frontend is the product, and triples the gate time for two apps nobody ships.
- **Keep the name `frontend-v3/` and repoint CI at it.** Fewer moved files, but it leaves `frontend/` free for
  someone to recreate, and it falsifies every existing path reference in the docs and worklogs rather than
  repairing them. The version number also stops meaning anything once v1 and v2 are gone.
- **Retrofit the built frontend to ADR-0017 (add shadcn, Storybook, a Tailwind config, desktop-first).** This
  would be rewriting a working app to match a document. The ADR is meant to record decisions, not to bind the
  build to a choice made before the design direction existed.

## Consequences

- `frontend/src/i18n/nl.json` and `frontend/src/i18n/catalogus.test.ts` — cited in `CLAUDE.md` and
  `CONSTITUTION.md` Art. II.3 — resolve correctly again, and now point at the app that ships.
- The `frontend-mobile/` prototype is reachable only through git history (`acabd2e`). It had no tests and no
  type-check gate, so nothing verifiable is lost.
- Storybook's three story files are gone with the old `frontend/`. If a component catalog is wanted later it
  is a new decision, not a regression against this one.
- **This costs shipped E9 work, and the backlog must not pretend otherwise.** The retired `frontend/` held
  29 test files; the surviving one holds 11 (86 tests). Two closed stories lose their implementation
  outright: **E9-05**'s `Minikalender` for week navigation has no counterpart here, and **E9-06**'s live
  coverage progress *while linking* does not: `Dekkingsbalk` exists but is rendered on Agenda and Dekking,
  not in the koppel flow. **E9-04**'s period-to-week drill-down is replaced rather than lost, by a
  day-level agenda that goes finer than the week panel did. E9-07 was rebuilt here (`a5cd0f8`) and E9-08's
  confirmation copy has a home (`components/ui/Bevestiging.tsx`), both needing re-verification rather than
  rebuilding. Reopening E9-05 and E9-06 against this frontend is the honest bookkeeping; this ADR does not
  do it, because a story's state is the backlog's to own.
- ADR-0017 stays in the register as Accepted-then-partly-superseded, per the rule that ADRs are superseded and
  never rewritten. Read 0017 for the reasoning that still holds (WCAG, Dutch copy, tokens-not-hex); read this
  one for what the built frontend actually does.
