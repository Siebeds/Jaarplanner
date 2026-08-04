# E4-03 — Manual add/move/remove independent of AI (FR-7.2)

Branch `story/E4-03-handmatig-plaatsen`, off `origin/main` `ba372a4` (which already contains E1-14).

## What the story turned out to be

**FR-7.2 is a 3×3 matrix, and eight of the nine cells were already built.** The story line reads
"Add/move/remove thema's, activiteiten, and goal links by hand", so the first thing done was to
measure every verb against every object rather than trust the wording:

| | toevoegen | verplaatsen | verwijderen |
| --- | --- | --- | --- |
| **thema in het jaarplan** | **MISSING** | `PUT …/plaatsingen/{id}/blok` (E3-07) | `DELETE …/plaatsingen/{id}` |
| **thema als schoolcontent** | `POST /api/themas` (E1-14) | n/a | `DELETE /api/themas/{id}` |
| **activiteit** | `POST /api/subthemas/{id}/activiteiten` (E1-14) | not built, see boundary | `DELETE /api/activiteiten/{id}` |
| **doelkoppeling** | `POST …/themadoelen`, `…/doelkoppelingen` (E1-14) | n/a | `DELETE …` (three paths) |

E1-14, which landed hours earlier, had already built the activiteit and doelkoppeling halves, and
it writes those hand-made links as `KoppelingStatus.Manueel`
(`SchoolcontentBeheerService.cs:219/319/395`). So the one genuinely missing verb was **putting a
thema into a period by hand**, and it was missing completely rather than partially:

> `Jaarplan.VoegPlaatsingToe` was reached from exactly **two** callers in the whole repository,
> `JaarplanGeneratieService.GenereerAsync` and `DemoDataSeeder`. The only way a thema had ever
> entered a jaarplan was an AI run, so "manual editing, independent of the AI" meant editing
> something the AI had produced first, and FR-7.2's *"a fully hand-built plan is possible"* was
> impossible as written.

Sixth instance of the reachable-vs-tested pattern (E2-08, E1-15, E0-10, E4-06, E4-02), with a twist
worth naming: **the domain method existed and enforced its invariant correctly.** Nothing was
missing at the level where a unit test would look. What was missing was every layer above it.

## Server

- **`JaarplanGeneratieService.VoegPlaatsingToeAsync`** — the only placement path that **creates the
  jaarplan when the class has none**, via the existing `LaadOfMaakJaarplanAsync`. That is the story,
  not a convenience: the other four manual paths rightly 404 on a class with no plan, because they
  operate on a placement that already exists. A class that has never been generated for now gets its
  first thema by hand.
- **Lands as `KoppelingStatus.Manueel` with no `aiMotivatie`.** It is the teacher's own decision, so
  crediting the model would misreport who decided (Art. IV.3). Two consequences, both intended and
  both pinned by test: it **counts for dekking** (Art. V.1, only `Aanvaard`/`Manueel` count), and it
  is not `IsVervangbaar`, so **a regeneration cannot discard it** (Art. IV.1, Art. IX.3). Same status
  a drag produces, which keeps "the teacher positioned this" one state rather than two.
- **Fixed to `GeneratieNiveau`** (themaperiode). A `Themaplaatsing` keys on a themaperiode start
  (ADR-0020 §3) and nothing records which weeks inside it a thema occupies, so accepting a
  subthemaperiode start would record five weeks where the teacher aimed at a fortnight. Same
  reasoning E3-08 uses to withhold the move affordance at the fine tier.
- **`OngeldigePlaatsingFout`**, one static factory per refusal (the E1-15 `OngeldigeImportFout`
  precedent), mapped to 400 in `PlanningExceptionHandler` beside the two existing planning faults.
  Deliberately **not** a reuse of `OngeldigeVerplaatsingFout`: that type documents itself as a failed
  *move* and its reasoning is written around one, so reusing it would have made its own summary false.
- **`POST /api/klassen/{klasId}/jaarplan/plaatsingen`**, body `{themaId, blokStart}`. A date, never an
  ordinal (ADR-0020 §3), and **no status field**: a hand-placement is `manueel` by definition, so
  letting a client name its own status would let it claim the AI proposed something.

### Two stale claims corrected rather than left

Both in `JaarplanController`'s own class summary, and both are the defect class this repo has
retracted most often:

1. Its endpoint enumeration, which the file itself says is *"kept complete on purpose"* after an
   earlier revision silently omitted the DELETE. The POST is now in it.
2. *"only the explicit status PUT moves one to aanvaard/geweigerd/manueel"* — which this POST
   falsifies, and which a **move** had already falsified before it. Rewritten to say what it actually
   means (nothing the **AI** proposes auto-applies) with the correction recorded in place.

## Frontend

**`Themakiezer.tsx`**, a per-period control at the foot of each column.

- **A native `<select>` plus a submit button, mirroring the period picker in `Themakaart` rather than
  inventing a second answer.** `components/ui/` holds a Badge and a Button and **no Dialog**
  (ADR-0017: copied in), so a modal would have meant owning a focus trap on the anchor screen. The
  platform control is already correct on touch, by keyboard and to a screen reader, and it type-aheads
  through a long list, which removed the filter field the first sketch had.
- **Inline in the column, not centred over the board.** The period is the one piece of context the
  choice depends on and it is written in the column heading directly above.
- **Gated on the same `verplaatsstaat` the grip and move picker use**, reusing that answer instead of
  deriving a second one. At the fine tier there is **no control at all** and the board says once, in
  visible text, where hand-planning works (`PLAATSUITLEG`, a `Record<Verplaatsstaat, key | null>` so
  the compiler still demands an answer for any state added later). `kan` contributes no sentence
  because the button is in every column and labels itself.
- **The one thing this picker does that a plain list would not:** each option says where that thema
  already sits in the year (*"Water (staat al in themaperiode 3)"*), and the thema already in **this**
  period is not offered at all, because the server refuses that with a 400.
- **Three dead ends, three sentences** (the E3-06 rule): no thema's at all, a library that failed to
  load, and a period that already holds every thema the school has. None of them renders an empty
  picker or a button that can never enable.
- Copy in `nl.json`; `plaatsGevolg` states what the teacher *gets* rather than warning about
  something, because adding a thema destroys nothing and a caution that does not apply is how
  teachers learn to ignore the ones that do.

### `themaPeriodeOrdinalen`, and the subtlety that is its whole correctness

Derived once for the board (a column sees only its own placements) and **status-blind on purpose**.
The obvious thing to reach for is `geplandeIn`, which every other count on this board uses and which
drops `Geweigerd` — and it is wrong twice over here. The server's duplicate guard is
`Jaarplan.IsAlGeplaatst`, matching `(themaId, niveau, blokStart)` and **no status**, so a rejected
placement still occupies the slot: filtering it out would offer an option that can only answer 400,
while telling the teacher a period is free that visibly holds a card. The two functions answer
different questions: `geplandeIn` is about *teaching time*, this is about *slot occupancy*.

## The defect the browser found and no test could

`sluit()` called `trigger.current?.focus()` directly. `setOpen(false)` is batched, so at that moment
the trigger was still unmounted and the ref was null: focus fell to `<body>`, and a keyboard user
pressing "Annuleren" lost their place on a board that scrolls sideways — **exactly what the comment
beside that line claimed to prevent.** Measured in one CDP probe
(`document.activeElement` → `BODY`), fixed with a `useEffect` guarded on the previous `open` value
(unguarded, every column would grab focus in turn on mount), re-measured in the browser on **both**
exits, and pinned by a test that was then mutation-checked against the original broken form.

This is the story's argument for the standing "look at it" rule: 388 frontend tests were green, and
the one thing wrong with the component was invisible to all of them.

## Verification

**Gates on the landing commit:** `542` unit + `180` integration against **real PostgreSQL**,
**0 skipped**; `388` frontend / 18 files; `dotnet format --verify-no-changes`, `pnpm lint` and
`pnpm build` clean. (`pnpm build` is the one that type-checks — see E7-17.)

**Every new claim was mutation-checked in two directions**, because a test that has only ever passed
has not been shown to be able to fail:

| Mutation | Broke | Not |
| --- | --- | --- |
| `Manueel` → `Voorgesteld` | the empty-plan test **and** the survives-regeneration test | 67 others |
| create-if-absent → 404 | 6 unit + **both** Postgres tests | the unknown-thema test (see blind spot) |
| status-blind → `geplandeIn` | the REJECTED-occupancy test | 386 others |
| `blokStart` → ordinal | the START-DATE test | 386 others |
| withhold-at-fine-tier removed | the fine-tier test | 386 others |
| focus fix → the original broken form | the focus test | 387 others |

**A recorded blind spot:** `Handmatig_plaatsen_van_een_onbekend_thema_is_niet_gevonden` stayed green
under the create-if-absent mutation, because it expects `SchoolcontentNietGevondenFout` either way.
It passes for the right reason today and would pass for the wrong one if that path regressed.

**One flaky test caught and fixed before it could mislead anyone:** the two-thema assertion sorted
the *actual* against an *unsorted expected* of two random Guids, so it passed on that run's ordering
luck. Both sides are sorted now, with the reason in a comment.

### Browser pass (headless Chrome over CDP, real API, real PostgreSQL, own database)

- All **seven** period columns render a trigger with its own accessible name
  (*"Thema toevoegen aan themaperiode 3"*), so a dozen identical names never reach the page.
- The full journey: open the picker in period 2 → every option annotated with where that thema
  already is → *"Herfst en oogst"*, which is in that period, correctly **absent** → choose Water →
  the card appears as **`Manueel`**, with no *"Waarom hier?"* motivation and no Aanvaarden/Weigeren,
  and the picker closes.
- **`GET …/dekking` moved 0 → 2 of 14, and both covered doelen name `Water` as the evidence.** No AI
  call, no accept step: the strongest available statement that a hand-built plan produces provable
  dekking (Art. V.1). It is also E4-01's criterion demonstrated for an *add*; E4-01 still owns
  proving it for a *move*.
- **Measured, composited in the browser** (jsdom cannot evaluate colour): label `rgb(21,39,46)` on
  its own white fill = **15.42:1** (SC 1.4.3 needs 4.5); the `border-input` boundary
  `rgb(150,138,115)` against the composited well `rgb(250,248,245)` = **3.21:1** (SC 1.4.11 needs 3),
  which is the app-wide token at exactly the value E7-10's entry records for it. Target **36×266px**
  (SC 2.5.8 needs 24×24).
  *Note the split, deliberately:* the `<select>` that carries the choice uses `border-ink-zacht`
  (6.08:1) copied from the move picker, while the trigger is a standard `outline` Button whose label
  carries 15.42:1. Overriding the shared variant in one place would diverge from every other outline
  button in the app.
- **axe 4.10.2 run in the real browser with the picker open: 0 violations.** All 12 `color-contrast`
  *incomplete* nodes are pre-existing (nav links, `aria-hidden` icon spans, the vakantie label, the
  empty well); **none is an element this story added**. Worth doing because `toHaveNoViolations`
  reads only `violations`, which is where two of E1-14's WCAG defects sat.
- **390px:** the window cannot scroll horizontally (`scrollX` stays 0 after `scrollTo(9999,0)`),
  `body.scrollWidth === clientWidth`, and **zero** elements exceed the viewport with the picker open;
  the panel stays inside its 288px column. *First probe was wrong and is recorded as such:*
  `documentElement.scrollWidth` read 1700 and looked like a defect, but the board `<ol>` is its own
  `overflow-x: auto` scroller (343px wide, 2248px of content), so that property was measuring
  descendant scroll content. **`documentElement.scrollWidth` is the wrong probe when a descendant
  scrolls**; ask whether the *window* can scroll.

## Two disclosures

1. **I wrote to the shared dev database by accident and reversed it.** `ConnectionStrings__Jaarplanner`
   was overridden; the key the app reads is **`ConnectionStrings__Postgres`**
   (`DependencyInjection.cs:40`), so the override was **silently ignored** and the API came up on the
   shared `jaarplanner` database. One `Themaplaatsing` was created on the demo klas and `DELETE`d
   again; that plan is back to the 0 placements it held before. **An env override for a config key
   that does not exist fails silently and looks exactly like success** — assert which database you are
   on before you write, not after. Posted to the groepschat.
2. **`GET /api/themas` answers 500 on that shared database, and it is dirty data rather than a
   product defect.** One `activiteiten` row holds `activiteit_type = 'experiment'` (lowercase) while
   `ActiviteitConfiguration` reads the column with a **case-sensitive** `Enum.Parse`, so the whole
   list throws on one row. Both writers (`SchoolcontentImportService:370` and the beheer POST) pass
   the strongly-typed `ActiviteitType`, so neither can produce it. Not fixed: it is not this story's
   data. **The arguably real finding underneath it** — one unparseable row takes down an entire list
   endpoint — is E1-14's or E7-15's to file, not mine.

## Scope boundaries

- **"Activiteit verplaatsen" (to another subthema) is not built** and is not claimed. FR-7.2's verb
  list applies to all three objects, and there is no endpoint that moves an activiteit between
  subthema's. It is E1-14's surface; recorded here because the matrix above is the only place the gap
  is visible.
- **`plaatsGevolg` is scoped to "een hergeneratie van het hele jaarplan"**, following E4-06's rule
  that no string may promise anything unscoped about a hergeneratie while per-period regeneration
  does not exist. **E4-05 must re-read it** and it is added to that story's string list.
- No new backend Dutch was authored beyond the two `OngeldigePlaatsingFout` refusals; both are
  teacher-actionable, and the frontend renders its own `nl.json` copy rather than the server's
  `detail`. Logged in the Art. II.3 entry in `backlog/README.md`.
