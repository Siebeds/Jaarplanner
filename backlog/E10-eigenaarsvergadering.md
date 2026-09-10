# E10 — Features uit de eigenaarsvergadering

**Phase:** 3 (parallel to E4/E5/E9) · **Milestone:** none of its own
**Goal:** Build the numbered features (`F1`…`F9`) the project owner brought back from a working session with the
school. They are not change requests against built screens (that is E9) and not FR scope from the functional
analysis; they are new content the school asked for, and each one has to be traced back to an FR or ratified as
new scope before it is built.
**Constitution:** [Art. III](../CONSTITUTION.md) (school content is autonomous), [Art. IX.2](../CONSTITUTION.md#article-ix--core-data-model-functional)
(level-dependent scoping), [Art. II.3](../CONSTITUTION.md) (language), [Art. XIV](../CONSTITUTION.md) (open decisions).
**UX & a11y:** every story with a screen **starts with the `frontend-design` skill** and is looked at in a real
browser at desktop *and* ~390px. WCAG 2.2 AA; colour never alone.

---

## Why this file exists

`F6`/`F7` (hoeken en hoekenverrijking) were being built on 2026-08-30 with **no backlog entry at all** — a
`story-hoeken` claim in the coordination channel and nothing durable. The coordination directory is gitignored
live state, so a story that lives only there leaves no record once the session ends. This file is the durable
home for that whole set.

> **The F-numbers are the owner's, not ours.** They come from meeting notes that are **not in the repo**, so this
> file cannot be checked against its own source. Anyone adding a story here should paste the owner's wording for
> that F-number into the story rather than paraphrasing it, because the paraphrase is all a later reader will get.

| F | What the owner asked for | Where it is |
| --- | --- | --- |
| F1–F5 | not yet transcribed into this file | — |
| F6 | hoeken | built 2026-08-30 by session `hoeken`, **story entry still owed** |
| F7 | hoekenverrijking | built 2026-08-30 by session `hoeken`, **story entry still owed** |
| F8 | not yet transcribed into this file | — |
| F9 | streefwoordenschat op subthema | **E10-01** below |

---

- [ ] **E10-01 — Streefwoordenschat op het subthema** — *F9. **Designed 2026-08-30, not built.** The model shape
  is an **owner ruling of 2026-08-30**; the pedagogy behind it is **not ratified** and is filed as question 10 in
  [`docs/besluiten-gevraagd.md`](../docs/besluiten-gevraagd.md). Full design: **[ADR-0026](../docs/adr/0026-streefwoordenschat-op-subthema.md)** (Proposed).*

  The owner's wording: *"woordenschat die je nastreeft, aangeduid op het subthema, doorklikbaar vanuit de agenda
  en ook in de agenda zelf aanpasbaar."*

  A third vocabulary list, `Streefwoordenschat[]`, on `Subthema` — so **scoped by leeftijd alone** and shared by
  every klas that teaches that age. The thema's `kernwoordenschat` and `rijkeWoordenschat` are not touched, not
  moved and not deprecated, so there is no data migration. Reachable and editable from the agenda through a sheet,
  with the thema's two lists shown beside it read-only.

  *Done when:* a teacher standing in the agenda can open a running subthema, read its streefwoorden beside the
  thema's two lists, add and remove words, and save; the list survives a reload; and a second class of the same
  leeftijd sees the same list, with the interface saying so before the save rather than after.

  > **⚠ Blocked on two things, and the first is hard.**
  > 1. **ADR-0025 does not exist.** Session `verbeteringen` removed `Subthema.KlasId` on 2026-08-30 and
  >    `Subthema.cs` cites the number in its own docstring, but the ADR is unwritten and the change is
  >    **uncommitted**. This story's entire scoping argument rests on it. Do not build against a docstring.
  > 2. **The migration queue.** Three sessions want a migration off the same `AppDbContextModelSnapshot`:
  >    `verbeteringen` (`SubthemaPerLeeftijd`, uncommitted), then `hoeken` (three new entities, waiting on the
  >    first), then this. Generating out of order conflicts by construction. **Do not run
  >    `dotnet ef migrations add` until both have landed on the branch.**

  **Acceptance criteria**

  *Domain and data*
  - `Subthema` gains `Streefwoordenschat` as an `IReadOnlyList<string>` over a private backing list, with a
    `StelStreefwoordenschatIn(IEnumerable<string>)` mutator, mirroring `Thema.StelRijkeWoordenschatIn` exactly.
  - **No containment rule.** A streefwoord that appears in neither thema list is accepted without comment
    (Art. III). A test asserts this, because "validate it against the thema" is the obvious wrong instinct.
  - One migration, one column. **No data migration**, and a test or a manual check proves an existing subthema
    comes back with an empty list rather than `null`.
  - **Dekking does not move.** A test places a thema, adds streefwoorden, and asserts the dekkingscijfer is
    byte-identical before and after (Art. V.1, ADR-0026 decision 8).

  *API*
  - `streefwoordenschat` joins `SubthemaWeergave` (read) and `SubthemaWijzigingInvoer` (write) on the **existing**
    `PUT /api/subthemas/{subthemaId}`. **No new endpoint.**
  - The field is **required, not optional**, on the read model. Optional lets a consumer render
    `undefined streefwoorden`; E9-02 paid 51 test fixtures for this same call and it was the right trade.
  - Integration-tested against **real PostgreSQL**, not the in-memory provider (E5-01: in-memory has passed a
    broken query in this repo before).

  *Agenda — the doorklik*
  - A rail above the grid lists **every** subthema run in the visible range, one row each: name, run dates, first
    few streefwoorden as chips, and a count. Each row is a single control of at least 24×24 CSS px (SC 2.5.8).
  - **`Subthemastroken` is not modified.** Its `aria-hidden` and `pointer-events-none` stay. A test asserts the
    strips are still absent from the accessibility tree, because the tempting fix is to make them the button and
    it fails three ways at once (ADR-0026 decision 5).
  - A run with no streefwoorden yet still gets a row, and the row says so in a way that invites the press. The
    rail may never be conditional on "every activiteit in view belongs to one subthema" — that condition is why
    the old `Maandrooster` chip was deleted.
  - `Activiteitblad` gains a second entry to the same sheet. It already resolves its subthema; it does not fetch
    twice.

  *Agenda — the sheet*
  - `Subthemablad` on `Blad`, editing streefwoorden through the **existing `Woordchips`** with no changes to that
    component. Paste splitting, duplicate dropping and commit-on-blur all come along for free and are what the
    control exists for.
  - The thema's `kernwoordenschat` (filled chips) and `rijkeWoordenschat` (outlined chips) are shown **read-only**
    beneath. Three lists, three treatments, **no new hue** (Art. XII, ADR-0024). Editability is carried by the
    input box and the per-chip ×, never by colour.
  - **The full subthema record arrives before the form may open.** The rail row carries a preview, not a payload;
    prefilling the form from it is the `Activiteitblad` defect (four fields erased on first save) repeated.
  - Cancel discards; Bewaren saves. An in-flight save disables the control rather than dropping the edit.

  *Copy*
  - Every string in `nl.json` (Art. II.3). **No em dashes** (owner, 2026-07-29).
  - The scope sentence is **unconditional** and survives E9-01's "Uitleg tonen" switch in both positions: it is a
    consequence disclosure, not instruction. A test asserts it, mirroring E9-01's error-survives-the-switch test.
  - The scope sentence asserts **only what the render condition guarantees** (the E5-03 rule): *"Elke klas die K3
    geeft, werkt met deze lijst"*, never *"Ook K3 blauw werkt met deze lijst"* — the sheet does not know whether a
    second K3 class exists. Case law and the guard: `frontend/src/i18n/catalogus.test.ts`.

  *Gates*
  - `dotnet test` (unit + integration against real PostgreSQL), `dotnet format`, `pnpm lint`, `pnpm test`.
  - **Looked at in a real browser** at 1440 and 390, per the standing agreement. Contrast measured in the browser,
    not in jsdom.
  - `antagonist` audit, and the finding to expect is the one this story cannot fully answer: a sentence is a
    weaker guard than a mechanism, and a K3-groen teacher really does edit K3-blauw's list.

  > **What this story deliberately does not do.**
  > - **No AI suggestion of streefwoorden.** FR-4 matches doelen, not words. A word generator is scope with no
  >   ruling behind it.
  > - **No count on the calendar strip.** A 16px strip already truncates the subthema name.
  > - **No `aantalAfgeleideKlassen` on the weekplanning payload.** Naming the sibling class is better copy and it
  >   needs a count the payload does not carry; it is a cheap follow-up, not v1.

- [ ] **E10-02 — Hoeken (F6) en hoekenverrijking (F7): story entry owed** — *Built 2026-08-30 by session `hoeken`
  (domain, EF configs, three DbSets, 22 unit tests) with no backlog entry. **This placeholder is not the story.**
  Whoever finishes that work writes the real entry here: the owner's wording, the scope, the acceptance criteria
  it was actually held to, and the gates that ran. A feature on `main` with no durable record is how this repo
  gets a progress table it cannot trust.*
