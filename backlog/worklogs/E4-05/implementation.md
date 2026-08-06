# E4-05 — Regenerate a single period (FR-8.2)

Branch `story/E4-05-periode-hergeneratie`, off `origin/main` `b2401e3` (so E4-04, E4-08 and E3-03 are all in).

## What the story turned out to be

Two things, and only the first is FR-8.2:

1. **A second regeneration path**, scoped to one themaperiode. The code delta is small because the pipeline is shared:
   `GenereerAsync` and `GenereerPeriodeAsync` both call one private `UitvoerenAsync`, and the three places they differ
   are marked `PER-PERIOD 1..3` in the source. What a run may replace is unchanged — `IsVervangbaar` narrowed by
   position — so E4-06's hidden lock control stays non-load-bearing and **E4-07's preserve/overwrite ruling is still
   open rather than pre-empted**.
2. **A rule about who may plan into a period the teacher blocked**, which the backlog routed here as an Art. XIV item
   and which turned out to be the larger half. The owner ruled it the strict way, and that *removes* a path E4-03 and
   E3-07 ship today.

## The two owner rulings, 2026-08-06

Both were obtained **before any code was written**, because the story text forbids assuming either.

1. **A per-period regeneration of a period holding a blocking `vast moment` is refused before the AI call**, with the
   reason visible on the control rather than reported afterwards. Rejected alternatives are recorded on the story: run
   and report (what the whole-plan path does, where the blocked period is one of eight and the refusal is a footnote),
   and treat the explicit choice of that period as an override (which would make the tool ignore an instruction the
   teacher gave it).
2. **A teacher may not hand-place or drag into such a period either.** One rule for human and machine.
   *Boundary the ruling does not cover:* nothing is retroactive. A placement already there stays, so no copy may call
   the period empty — only closed to anything *new*.

**The settings form already agreed with ruling 2 before anyone ruled.** `parameters.momentBlokkeert` asks *"Mag er een
thema in die themaperiode?"* and the blocking answer reads *"Nee, die themaperiode is bezet"* — generic, never "mag de
AI". So the column reuses the teacher's own word, **Bezet**, rather than inventing a second vocabulary for it.

## Server

- `Jaarplan.VerwijderVervangbarePlaatsingenIn(niveau, blokStart)` beside the whole-plan variant, both delegating to one
  private filter so the two regeneration paths cannot come to disagree about what a run may take.
- `PeriodeIsBezetFout` → **409**, deliberately not 400: the request is well-formed and every id in it exists, so what it
  collides with is a stored setting of the teacher's own. The client uses that distinction to tell *"reload, the grid
  moved"* (400) from *"that period is blocked"* (409) without reading Dutch prose out of a `detail`.
- The vast-moment resolution moved **above** the model call and became a shared helper, which is what lets one
  implementation of the rule serve generation, hand-placement and the move path. For the whole-plan run it is a
  reordering of two side-effect-free statements.
- The per-period prompt gets the whole grid **plus what already stands**, because the Dekking and Spreiding rules ask
  the model to prefer goals the rest of the year misses, and a model shown one period cannot answer that. The scope is
  an instruction; the enforcement is the server, which reports an out-of-scope proposal as its own kind rather than
  relocating it.
- `geblokkeerdePeriodes` rides on the **plan read**, so a control can state why it is unavailable instead of provoking a
  409 to find out. `Projecteer` became async and reads it itself: six call sites would be six chances to pass an empty
  list, and an empty list re-enables a control the server refuses.

## Screen

- One `ghost` button per period column, under the `outline` picker trigger. Two identically weighted buttons stacked in
  a 288px column is the defect E4-06 was ruled on; the hierarchy is real, because putting a thema there yourself is the
  certain act and asking the AI to redo the period is the one that replaces work.
- Failures report **in the column that was pressed**, four causes told apart by status. The board scrolls sideways, so a
  notice at the top of the page can be off screen entirely.
- **Bezet is one column state with three consequences**: no regeneration, no picker, no drop target. Marked in `petrol`
  and deliberately **not** in the attentie hue: every other marker on that header means something is wrong, and this one
  means the teacher told the tool to keep the period free. The word is the state, so it is not colour alone.
- One report area for both runs, showing whichever finished last by `submittedAt`, naming its own period — otherwise the
  scoped counts sit under a button that says *"Hele jaarplan"*.

## The seven inherited strings

E4-06 and E4-03 qualified every survival promise to *"een hergeneratie van het hele jaarplan"* **because the second path
did not exist**. It exists now and preserves exactly the same placements, so the qualification protected nothing and
left a teacher guessing about the button now sitting in every column. All seven name both paths.

The catalogue guard that demanded the literal `"hele jaarplan"` is widened to demand a **scope**, which is what it always
meant. **It bit my own aria-label on its first run** ("Themaperiode 3 opnieuw genereren" names no scope by its pattern,
while being the most precise scope statement in the family), and that is the guard working rather than being in the way.

**The promise was pinned before it was widened.** `Periodehergeneratie_laat_beslissingen_in_die_periode_staan` and
`Een_weigering_in_de_periode_overleeft_de_periodehergeneratie` assert survival per status against the new path. Widening
a user-facing promise by reasoning about shared code is how this backlog collected its retractions.

## Gates

- **608 unit + 218 integration**, 0 skipped, against **real PostgreSQL**; `dotnet format --verify-no-changes` clean.
  *(A first draft of this line said 622 unit, from memory rather than from the run. Corrected against the output, and
  left visible because the board's own lesson is that a gate brief may contain only measured figures.)*
- **540 frontend / 23 files**; `pnpm lint` and `pnpm build` clean (`build`, because lint type-checks nothing — E7-17).
- **21 mutation checks, all biting**: 11 backend, 9 frontend, 1 for the concurrency fix below. Every one rebuilt before
  running, per E4-04's binary trap.

### Browser pass (real API, real PostgreSQL, model stubbed)

Driven over CDP against a throwaway `jp_e405` with the demo seed; no `AzureAI:ApiKey` exists on this machine, so the
model is a local stub and everything else is the shipping code (Art. IV.6).

1. Seven per-period buttons plus the whole-plan one, and the explanation once above the board.
2. A run on period 5: *"Alleen themaperiode 5 is opnieuw gegenereerd. De rest van je jaarplan is niet aangeraakt."* +
   *"1 thema voorgesteld."* + *"1 eerder voorstel is verdwenen."* + the out-of-scope proposal named separately.
3. In flight: the pressed column reads *"Bezig met genereren…"* and is disabled; see the defect below.
4. **The three refusals over HTTP on a period that holds a thema**: regenerate → 409, hand-place → 409, drag in → 409,
   drag **out** → 200. Two earlier attempts answered 400, and correctly: the *duplicate* guard fires before the bezet
   guard, which is the documented order.
5. The blocked column at 1440px: `Bezet: Oudercontact` at **8,9:1** composited, **no** regeneration button and **no**
   picker, the card still there, and the *"Hier komt niets bij"* sentence correctly **absent** because the period is
   not empty.
6. **The drag, which no jsdom test can make**: hovering the blocked column shows no *"Hierheen verplaatsen"* anywhere
   and releasing changes nothing; the **control case** on a free period shows the sentence and actually moves the card,
   which is what makes the negative result worth anything.
7. 390px: layout viewport 390, **page overflow 0**, the button 266px inside a 288px column at 36px high, the marker
   still legible. The only scrollers are the board and the nav, both by design.
8. **axe in a real browser: 0 violations, 28 rules passed, at both 1440px and 390px.** The vitest axe run is not a
   substitute, because jsdom cannot evaluate colour at all.

## Three defects found by measuring rather than by reasoning

1. **The prompt called a non-empty plan empty.** With only a rejected placement in the year, the "what already stands"
   section rendered *"het jaarplan is nog leeg"* — a different and false claim about the school's own data. Found by the
   test written for the rejected case, which is exactly why it existed.
2. **Two concurrent per-period runs would misreport which one was working.** One `useMutation` serves all seven
   columns and `variables` holds only the last period pressed, so a second press moved the *"Bezig"* label to the new
   column and left the first looking idle mid-run. Found in the browser, not by a test: the local stub answers in under
   a second, which is short enough to make a missing progress state look like a passing check. Fixed by running one at a
   time (`wachten`), which is how the whole-plan button has always behaved, and pinned by a test that holds the request
   open.
3. **My own test destroyed its premise.** Registering a vast moment goes through `POST …/generatie`, because settings
   are saved as part of a run and there is deliberately no separate "Bewaren" control — and that run is a *whole-plan*
   regeneration, which legitimately discards every `Voorgesteld` placement. The 409 test asserted "nothing changed"
   against a plan E4-04 had correctly emptied one call earlier. Not a product defect, and worth knowing for anyone
   seeding a jaarplan.

*And one non-defect worth writing down:* the AI stub read an empty prompt on its first request, because .NET sends
`JsonContent` **chunked** with no `Content-Length`. The browser then showed a run that placed nothing, which looks
exactly like a product defect. A test harness that fails quietly is worse than one that fails loudly.

## Fix round 1 (antagonist ronde 1: VIOLATIONS FOUND, 2 MAJOR + 7 MINOR + 2 QUESTION)

The four things the audit was asked to be hostile about came back **clean**: nothing auto-applies, no failed run
persists, no ordinal is ever a key, and the new write paths do run against real PostgreSQL. Both MAJORs were in the
**seam between ruling 2 and the shipped UI** — not in the new code, but in the two paths the ruling narrowed.

**MAJOR 1 — ruling 2 was enforced on the drag and not on the drag's mandated alternative.** The board withheld the drop
target, but the card's *"Verplaats naar"* `<select>` still offered every period, and that control exists to satisfy
**WCAG 2.2 SC 2.5.7 (Dragging Movements)**. So the one route a teacher without a mouse has was the one route that
offered a target the server refuses — and the 409 fell through to *"Meld dit aan de beheerder van de tool"*: the tool
blaming itself, and sending the teacher to escalate, for a rule it had just applied on the strength of their own
setting. The stale-placement notice is the likeliest way in, since such a card sits in no period and its picker offers
all of them. Fixed by keeping the blocked period **in the list, disabled, naming the moment**, plus a 409 branch on both
manual routes.

**MAJOR 2 — the new button failed SC 2.5.3 (Label in Name, Level A).** Visible *"Deze periode opnieuw genereren…"*,
accessible name *"Themaperiode 3 opnieuw genereren"*: the visible text was not contained in the name, so speech input
could not reach the control. Every other `aria-label` in this feature appends; this one substituted. **axe cannot see
SC 2.5.3**, which is why the browser pass's "0 violations, 28 rules" was silent about it — so it is now a
catalogue-wide guard instead: every `<key>Label` must contain its visible `<key>`. *The first version of that guard was
case-sensitive and failed on `aanvaardenLabel` ("{thema} aanvaarden" over "Aanvaarden"), i.e. it called the codebase's
own good precedent a violation. Speech engines match case-insensitively, and so does the guard now.*

**The seven MINORs, all fixed:** the bezet explanation rendered at the fine tier where no column carries the marker (a
themaperiode's start is also its first sub-block's start, so the naive check was true there); the period-button
explanation promised a button a fully blocked year has nowhere; the parameter report was measured plan-wide under a
period-scoped heading; a **stale** placement was described to the model as sitting in a period the same prompt had
omitted; `BuitenPeriode` shipped `"Water @ 2026-11-02"` to a teacher and is now structured, so the screen composes
*"Water (themaperiode 4)"*; the `Manueel` half of the seven widened promises had no test and its docstring claimed four
statuses while pinning two; and the third billable anonymous route is now recorded on **E7-11**, whose AI-cost
dimension it changes from one call per class to one per period.

### What the re-verification found that the tests could not

**A copy inconsistency in my own fix, found by looking at the select in a browser.** The blocked option read
*"3: 9 nov – 20 dec (bezet door Oudercontact)"* while every sibling read *"Themaperiode 4: 4 jan – 14 feb"* — my new
string had dropped the noun, in the one list where a teacher scans for "Themaperiode 3". The test asserted the string
verbatim, so it passed while the wording disagreed with its neighbours: **a copy test cannot catch an inconsistency it
was handed.** It is now composed from the sibling string plus the reason.

### Gates after the fix round

- **611 unit + 218 integration**, 0 skipped, real PostgreSQL; `dotnet format --verify-no-changes` **exit 0**.
  *(Measured by exit code rather than by a pipeline's last command: an earlier line in this session printed
  "FORMAT CLEAN" from an `&&` chain whose exit status came from `tail`, while format was in fact complaining.)*
- **546 frontend / 23 files**; `pnpm lint` exit 0, `pnpm build` exit 0.
- **10 further mutation checks, all biting** (9 in one sweep, plus the SC 2.5.3 one re-run against the literal string
  after its first anchor missed), so every fix above has a test that fails without it.
- Browser: the blocked option **disabled and named**, mirroring its siblings, and **axe still 0 violations**.

**Ronde 2 is owed**, and the story entry says so. Two items are deliberately open: the Art. XIV line in
`backlog/README.md` (the file was claimed by another session, so it was asked for in the groepschat rather than edited
around the lock), and the audit's question for the owner about whether the settings form should disclose, at the point
of choosing, that "bezet" now binds the teacher as well as the AI.

*One process note, recorded because it cost the auditor a gate:* the running dev API holds the build output on Windows,
so `dotnet format` and a full rebuild fail for anyone else with file locks. Stop the API before running either.
