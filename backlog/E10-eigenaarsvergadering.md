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
| — | the agenda as a time grid, with free clock times | **E10-04** below. *No F-number: it came from a session on 2026-09-11, not from the meeting notes this file was opened for.* |

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

- [~] **E10-03 — Algemene fiches: terugkerende activiteiten per klas, los van thema's** — *Owner request 2026-09-11,
  from the teachers' feedback. **Backend and the Instellingen half built** on `feature/algemene-fiches` (backend
  `743af2e`, pushed). **The agenda half waits on ADR-0028's time grid** (owner ruling, same day). Design:
  [ADR-0029](../docs/adr/0029-algemene-fiches.md).* *The agenda half was built on 2026-09-14, once the time grid was
  on `main`, on `story/E10-03-agenda`. The owner asked to see it on the board, so it has a card:
  [TB-002](technische-backlog/TB-002-algemene-fiches-in-de-agenda-plaatsen-agendahelft.md).*

  The teachers' wording: *"Lesfiches algemene/terugkerende activiteiten (e.g. onthaal) los staand van thema/subthema
  kunnen inplannen en dit ook kunnen linken aan doelen > via algemeen thema eventueel implementeren. Elke maandag
  turnen op dit uur."* The owner's: *"ik wil het algemene fiches noemen, ik wil een gelijkaardige optie zoals bij de
  hoekenfiches (het mag eronder komen te staan), deze algemene fiches kunnen worden ingesteld per klas (een leerkracht
  kan voor haar eigen klas deze aanmaken)."*

  **Owner rulings of 2026-09-11 this story rests on:** (1) a planned fiche's goals **count for dekking**, which amends
  Art. V.1 (amendment commit owed, see below); (2) the fiche moments use **clock times**, aligned with ADR-0028; (3) the
  agenda half is built **after** the time grid is committed, so it is built once.

  **Acceptance criteria**
  - [x] A teacher creates, renames and deletes fiches for one klas in Instellingen, in a section under Hoeken. A
    planned fiche's delete is refused with the count, in Dutch.
  - [x] She links and unlinks leerplandoelen on a fiche; every link is `manueel`; the picker narrows to the chosen
    klas's jaar/fase.
  - [x] Planning (API): chosen weekdays over a window, one row per teaching day, skipping weekends and closures,
    from a begin to an end time; one occurrence can be moved or resized; the placement is outside the Jaarplan.
  - [x] Dekking: a goal linked to a planned fiche of the klas is gedekt, named as `DekkendeFiches`, in the
    dekkingsoverzicht, the vooruitzicht and the export; an unplanned fiche and another class's fiche do not count.
  - [x] The register, the ongekoppelde doelen and the Op.stap re-import reference count read the fifth link table.
  - [ ] Agenda: a switch *Algemene fiches* of its own beside *Hoekenfiches*, opening the class's fiches (owner,
    2026-09-14: "ik wil twee secties in het meest linkse side bar, hoekenfiches en algemene fiches, niet gegroepeerd
    als fiches", which replaced "a panel of algemene fiches under the hoekenfiches"); drag or click a fiche onto a day
    of the time grid; the placement sheet asks the weekdays and the times; occurrences drawn and movable in the day
    and week views. *Built 2026-09-14 on `story/E10-03-agenda`, shown on the board as
    [TB-002](technische-backlog/TB-002-algemene-fiches-in-de-agenda-plaatsen-agendahelft.md) at the owner's request;
    this story stays the source.*
  - [x] Art. V.1 amendment commit (with CLAUDE.md's dekking line), per Art. XI.1. *On `main` since 2026-09-11 as
    `7fc20bc`, with its ratification-log row; the box stayed open until the E10-03 agenda session's antagonist
    noticed on 2026-09-14.*
  - [ ] Browser pass at 1440 and 390 on the Instellingen half; antagonist audit.

  **Gates so far:** 825 unit + 261 integration on real PostgreSQL, 0 skipped; `dotnet format` clean; frontend
  lint/tsc and Vitest green.

- [~] **E10-04 — De agenda als tijdraster: vrije tijdstippen in plaats van lesuren** — *Owner request of
  2026-09-11, in session, with his own Outlook week beside the screen. Decision record:
  **[ADR-0028](../docs/adr/0028-tijdraster-in-plaats-van-lesuren.md)**, which supersedes his own instruction of
  2026-08-24 that the agenda shows no clock times, and the `Volgorde` half of
  [ADR-0023](../docs/adr/0023-activiteit-day-placement.md) decision 1.*

  The owner's wording: *"ik wil zoals in outlook alle uren van de dag zien op de week/dag view met een lijntje van
  waar we vandaag zitten ook. hierin moeten de leerkrachten hun activiteiten kunnen plannen, niet zoals nu met
  lesuren, zij moeten de tijdstippen zelf kunnen bepalen. ook zie ik bij de hoeken dat in de weekview ze vanboven
  staan bovenaan de dag terwijl ik ze liever op de dag zelf ook willen zien staan."*

  Four defaults were put to him with their costs and accepted: the grid draws 7:00 to 18:00 and opens on 8:00,
  planning snaps to a quarter of an hour, a new activiteit runs 50 minutes, and the existing rows are converted by
  arithmetic rather than by a real bell schedule because they are demo data. He also ruled that **every hoek gets a
  time**, which removes the "niet in het uurrooster" answer.

  > **The first of those four is no longer what ships**, and the sentence above is kept rather than rewritten because
  > it is what he accepted at the time. Later the same day he looked at the day view and split it in two: the grid
  > **draws the whole 24 hours** and the **default window is 7:00–18:00, opened on 7:00**. See *Day-view corrections*
  > at the end of this entry, and the amendment on decision 5 of ADR-0028.

  *Done when:* a teacher can drag a block to another day and another hour, pull its bottom edge to change when it
  ends, click empty space to make something at that hour, see a line marking the current time, and read a hoek as a
  block on the day it runs; and when the same three things are reachable without a drag, from the activiteit sheet.

  **Built 2026-09-11. `[~]` rather than `[x]`: the antagonist has not seen most of it.** That is the only gate left;
  the migration and the browser pass below are done. *Narrowed the same day: the three day-view corrections at the
  end of this entry have had their own antagonist round. Everything else here has not.*

  **The migration is written, hand-edited and applied.** `20260911131815_TijdstippenInPlaatsVanLesuren` adds the two
  columns nullable, derives them from the slot they replace, makes them required and only then drops `Volgorde`. The
  scaffold had it the other way round, which would have moved every planned activiteit in the database to midnight.
  Applied to the dev database, and the conversion was read back through the API: lesuur 2 became 10:10, lesuur 4
  became 11:50, and the one day the owner had dragged to another hour kept its own.

  **The browser pass ran at 1440px and 390px, over CDP, and found what the tests could not.**
  - **A real defect:** a drag changed the day and silently kept the old hour. `laatLos` called `eindigSleep()` before
    reading the target time, so the pointer it needs was already forgotten and every drop fell back to "keep the
    time" — while the preview under the cursor had shown the right one. Fixed, then re-measured: a block dragged two
    hours down went from 10:10 to 12:30 **in the database**, not only on screen.
  - **A second, visible one:** a 50-minute block is 47 pixels tall and was drawing three stacked lines, so the third
    was cut in half. The block now says as much as it has room for: name alone under half an hour, name and start
    beside each other under an hour, and the full three lines above it.
  - Also measured: 7 columns at 1440 and 3 at 390 with no horizontal overflow, hour labels 4.97:1 and block names
    16.58:1, a resize by the bottom edge landing on 11:15, and no console errors.
  - **The dev database was put back exactly as the migration left it** (four hoekmomenten, one verrijking), because
    this ran against the shared one.

  **What landed**

  *Backend.* `Activiteitplaatsing` and `Hoekmoment` carry `Begin`/`Einde` (`TimeOnly`); the duplicate rule and the
  unique index key on the start time; `WeekplanningService` refuses an end that is not after its start with a Dutch
  400, and the hoek service refuses a window with no teaching day in it, because every placement now writes rows.
  `GeplandeActiviteitWeergave` sends the two times and no longer sends `LengteInLesuren`.

  *Frontend.* One `Tijdraster` draws both the day and the week (three days below `sm`), with an hour gutter, the
  now-line in ink plus its time in words, overlapping blocks side by side, a drag preview that reads the same module
  the drop handler reads, and a resize handle. `ruilen.ts` (the swap rule of 2026-08-31), `Lesurenraster`,
  `lesuren.ts` and `Dagcel` are deleted; the activiteit sheet gained begin/end fields as the non-drag route.

  *Gates:* **801 unit + 256 integration tests on real PostgreSQL, 0 skipped**, `dotnet build` and `dotnet format`
  clean, 131 frontend tests (16 new), oxlint + tsc clean, and the browser pass above.

  **Day-view corrections, 2026-09-11 (same day, after the owner looked at it).** He reported three things about the
  day view and ruled on all three in session.

  1. *"ik zie geen die twee strepen bovenaan de dag zijn wat raar, moeten daar niet andere dingen staan?"* — they
     were the themaperiode band and the subthema band with their labels dropped. The rule that drops a label exists
     for a row of seven columns, where the Monday carries the name for the row; it was keyed on the day count, which
     is not the same question. **Ruling: show the names** (he was offered three options and chose this one). The
     predicate is now "is a Monday in this row?", which also fixes the case nobody had reported: the **phone week
     view** is three days starting at the anchored day, so an anchor past Monday gave the same two nameless bars at
     390px. Verified in a browser both before and after.
  2. Planning outside 7:00–18:00. **Ruling, verbatim:** *"ik wil gewoon kunnen scrollen maar default moet het wel op
     7u-18u staan"* — so no expand control was built. The grid draws the whole day and the window opens on 7:00. A
     press on an empty 6:15 opens the sheet on "vrijdag 11 september om 6:15".
  3. *"ook zie ik maar de helft van de 7u waardoor dit onprofessioneel oogt"* — the hour labels were centred on their
     own line, so the topmost one hung half above the scroller's edge. They now sit just under the line, the way a
     paper timetable writes it, and the final hour boundary gets no label at all because one there would hang off the
     bottom the same way.

  **Antagonist round on these three corrections: ran, VIOLATIONS FOUND, all addressed.** *Scope, stated so nobody
  reads more into it than happened: it was asked to audit the six changed files, not the whole of E10-04. The
  backend, the migration, the drag, the resize and the hoek blocks have still not been audited, so the story's own
  gate below is not discharged by this.* It caught the phone week case in (1) as a MAJOR, and
  two more: this entry and ADR-0028 decision 5 still named the old range (fixed above and in the ADR), and the two
  bands are `aria-hidden` on the promise that the day announces the same facts once, which `Maandrooster` keeps and
  this grid did not. The day view has no day button at all, so after (1) the subthema was readable on screen and
  nowhere else. `Dagkop` now carries `themaZin` + `subthemaZin`: appended to the button's label in the week view,
  spoken after the heading in the day view. Three MINOR findings (an over-claiming comment about the window height, a
  comment calling `bereik` a seam in the same hunk that weakened it, a test named for behaviour it did not exercise)
  were fixed rather than waived.

  *Also measured, because the audit asked and code cannot answer it:* the first Tab into the grid does **not** drag
  the scroll to midnight (392 through fourteen tabs), and once focus is on the column button the arrow keys and Page
  Down do scroll it, so the late hours are keyboard-reachable.

  *Still open for the owner, not blocking:* on a 390×844 phone the window is 508px, i.e. 7:00 to about 16:00 rather
  than 18:00, because 56px an hour and the header leave no more room. He has not been asked whether that is
  acceptable or whether the hour should be shorter on a phone.

  **Owed:** the antagonist round **on the story as a whole** (the day-view corrections above have had theirs; the
  backend, the migration, the drag, the resize and the hoek blocks have not); and then the rename `LengteInLesuren` →
  `DuurInMinuten` (ADR-0028 decision 2), which is blocked on a stale claim over `SchoolcontentBeheerService.cs` and is
  the one place the model still speaks in lesuren.

  **Also owed: a non-drag route to resize one hoek day** (WCAG 2.2 AA). *Found 2026-09-11 by the antagonist on
  `feature/hoek-uren` (rounds 1–3); recorded by the technical lead, because without it this story closes with the gap
  unrecorded.* In the time grid, resizing **one** day of a hoek run still depends on the drag strip at the block's
  bottom edge, and nothing else does it: there is no single-pointer or keyboard alternative (SC 2.5.7 Dragging
  Movements), and the strip is below the 24px minimum target (SC 2.5.8 Target Size). It is `h-1.5` (6px) on `main`
  (`f047cef`, `Rekgreep` in `Tijdraster.tsx`) and `h-2` (8px) on `feature/hoek-uren`. The hours form that branch adds
  to the Hoekdetailblad sets **every** day of the run, so it is not that alternative. The gap predates the branch; its
  visible grip only makes the gap easier to find. The *Done when* above asks for a non-drag route for activiteiten
  only, and no story names one for a hoek day. This finding does not replace the antagonist round on E10-04 itself,
  which is still owed.

  **Owner rulings of 2026-09-11 on a hoek run's hours**, given in session to `hoek-uren` in answer to explicit
  questions, and reported to the lead by that session. They are built on `feature/hoek-uren` (`aeb44de`, `6cc843e`,
  `21feaf3`), which is **not yet on `main`**:
  - **New hours saved in the Hoekdetailblad go to every day of the run**, including days moved or resized by hand. The
    sheet warns before saving when a day currently differs.
  - **A day that holds the hoek more than once** (days dragged onto another) **refuses** a change to the run's hours,
    and the refusal names the day. Nothing is folded into one row. *`aeb44de` first folded such a day. Antagonist
    round 1 flagged that as unruled (MAJOR), and this ruling replaced it in `6cc843e`.*
