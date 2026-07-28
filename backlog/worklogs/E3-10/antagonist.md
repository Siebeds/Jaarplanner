# E3-10 — Antagonist

**Not run — and deliberately so.**

`CLAUDE.md` scopes the antagonist to *significant changes*: "new/modified source files, data-model or
migration changes, Excel-import or coverage logic, AI prompts/orchestration, permissions, or any
scope-touching edit", and exempts trivial documentation. E3-10 adds **no source file, no migration, no
dependency and no scope change** — it is two files under `docs/ux/wireframes/` plus backlog bookkeeping.

The constitution-relevant judgements the wireframe *does* make were checked inline and recorded in
`implementation.md`:

- **Art. IX.3 / ADR-0013 (no month assumption)** — the design's central idea is a refusal of the month grid,
  and the one place the first draft violated it (a month-labelled scale strip) was caught and replaced before
  commit.
- **Art. XII / WCAG 2.2 AA (colour never sole carrier)** — doelsoort renders as letter+count chips and every
  knelpunt carries icon **and** word.
- **Art. II.3 (Dutch strings)** — the artifact is documentation, not a component, so its Dutch copy is in
  scope for the doc and out of scope for `nl.json`. The obligation transfers to E3-06.

If the E3-06 build reuses markup or CSS from this wireframe, **that** change is a significant one and must be
audited then.
