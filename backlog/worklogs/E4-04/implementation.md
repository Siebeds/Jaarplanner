# E4-04 — Regenerate the whole plan (FR-8.1)

Branch `story/E4-04-hergeneratie`, off `origin/main` `59183ad` (so E4-08 and E3-09 are both in).

## What the story turned out to be

**The run was already repeatable, and had been since E3-01.** `POST /api/klassen/{klasId}/jaarplan/generatie`
discards exactly `Themaplaatsing.IsVervangbaar` (`Voorgesteld && !Vergrendeld`), keeps everything a human decided or
locked, and returns `AantalNieuw` / `AantalBehouden` / `AantalVervangen`. `Spreidingsoverzicht` has been rendering the
last two all along. Nothing in the server needed writing.

**What did not exist was any way for a teacher to know that before pressing.** The button read
*"Jaarplan genereren…"* on the second press exactly as on the first, `kalender.genereerUitleg` described a fresh run,
and the only statement about the replacement was past tense, after the fact. FR-8.1's own wording is *"het volledige
jaarplan **opnieuw** laten genereren"*, and the word *opnieuw* appeared nowhere on the screen. A teacher reviewing
proposals over an afternoon, pressing again to fill the periods the model had skipped, would have lost every proposal
they had not yet decided on, with no warning anywhere.

So this is a disclosure story plus the two pieces of proof the behaviour never had: a row-level one on real
PostgreSQL for the half of the preservation rule that had none, and an end-to-end one in a browser.

**Seventh instance of the reachable-vs-tested pattern** (E2-08, E1-15, E0-10, E4-06, E4-02, E4-03), and the mildest:
the path was reachable and correct, it simply misdescribed itself. Worth naming anyway, because "the control exists
and works" has now been mistaken for "the story is done" seven times.

## What changed

| File | Change |
| --- | --- |
| `frontend/src/i18n/nl.json` | `kalender.hergenereer`, `kalender.hergenereerUitleg` (2 keys) |
| `frontend/src/features/jaarplan/Jaarplankalender.tsx` | `heeftPlan`, the label and the sentence keyed on it; the card comment corrected |
| `frontend/src/i18n/catalogus.test.ts` | a third guard, over the whole `kalender.*` namespace |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | 4 new tests; 4 existing assertions re-pointed at the new label |
| `backend/tests/.../Postgres/JaarplanPersistentieTests.cs` | a decided placement survives at row level |
| `backend/tests/.../JaarplanEndpointsTests.cs` | the second press over the wire, and `aantalVervangen` read for the first time |

### The copy, and the one decision inside it

> **Hele jaarplan opnieuw genereren…**
>
> Er staat al een jaarplan. Opnieuw genereren geldt voor het hele jaarplan. Wat je aanvaard, geweigerd, zelf
> geplaatst, verplaatst of vastgezet hebt, blijft staan. De overige AI-voorstellen verdwijnen, ook als de AI er deze
> keer minder of geen voorstelt. Wat de AI nu voorstelt, komt als “Voorgesteld” op de kalender en jij beslist.

*Four sentences after two audit rounds rather than two, and the **shape** is the round-2 fix: what is lost is named as
the **complement** of what is kept, in that order. Both audits found the same class of defect in this one paragraph, in
opposite directions, and a second list of conditions is what let them drift. See the fix rounds below.*

**It keys on "does this class have a plan", never on "is anything replaceable".** The second question is
`IsVervangbaar`, which is the server's rule, and answering it in the client would be a second implementation of it —
the defect E3-09 spent a whole story deleting from this same screen, where the kalender guessed a te-vol threshold the
server already owned. So the sentence states a **rule**, which is true in every state including the one where nothing
is replaceable, rather than a **prediction**. A test pins that deliberately (`discloses the rule from a plan in which
nothing is replaceable`), because "improve it into a count" is the obvious wrong next move.

Counting what will change, and offering a cancel, is **E4-07**. This story stops one step short of it on purpose.

**The explanation is replaced, not supplemented.** Two paragraphs beside one button is the wall of prose this screen
keeps cutting, and the first-run sentence's remaining content ("elk voorstel komt als Voorgesteld en jij beslist") is
carried by *"vervangen door nieuwe voorstellen"* and stated once above the board by E4-02's `beslisUitleg`.

**The label carries its own scope** — *"Hele jaarplan"*, not just *"opnieuw genereren"* — because E4-05 adds a
per-period path and the two controls will sit on the same screen. It also makes the label satisfy the guard below
rather than needing an exemption from it.

### The guard, widened to the class rather than the instance

`catalogus.test.ts` had two guards over the key **prefixes** `kalender.vergrendel*` and `kalender.weigering*`, keyed on
the word `hergener`, requiring the phrase *"hele jaarplan"*. Both blind spots that leaves are recorded in the file, and
this story walked into the second one immediately: its copy says *"opnieuw genereren"*, contains no `hergener`, and was
therefore invisible to the family guard.

A third guard now covers **every `kalender.*` string that mentions running the generation again, in either wording**.
The two old guards stay: they carry the per-family non-vacuity canaries that caught a rename once, and a
content-defined family cannot have one.

*It found a pre-existing gap on its first run:* `kalender.plaatsGevolg` (E4-03) makes exactly this claim from outside
both prefixes, and nothing pinned it. Mutation-checked — dropping *"het hele"* from that string fails the new guard
and no other.

## Gates

- **577 unit + 205 integration**, 0 skipped, against **real PostgreSQL**; `dotnet format --verify-no-changes` clean.
- **500 frontend tests / 20 files**, `pnpm lint` and `pnpm build` clean.
- Every new claim mutation-checked in the failing direction:
  - the component reverted to the first-run copy → 3 of the 4 new tests fail (the fourth is the empty-plan case, which
    that mutation does not touch, and it is stated here rather than left looking like a hole);
  - *"hele jaarplan"* removed from `hergenereerUitleg` → the new guard **and** the render test fail;
  - `IsVervangbaar` widened to `!Vergrendeld` → both new backend tests fail (`behouden 2 → 0`).

### Browser pass (real API, real PostgreSQL, stubbed model)

Driven at 1440px and 390px against a throwaway `jp_e404` database with the demo seed, the model replaced by a local
stub answering a canned plan (no key exists on this machine; Art. IV.6).

1. A class with **no** plan: *"Jaarplan genereren…"* and the first-run sentence; the regeneration copy absent.
2. First run lands → **the label and the sentence flip within the same session**, no reload.
3. Demo class, 7 untouched proposals: *Water* accepted, *Verkeer* locked, then pressed.
4. Result: **5 eerdere voorstellen zijn vervangen, 2 bestaande plaatsingen bleven staan, 2 thema's voorgesteld** — and
   the board agrees: `Water Aanvaard` and `Verkeer Vast` still there, the five untouched ones gone, two new proposals.
   Exactly what the sentence promised before the press.
5. 390px: button 302×44 inside the viewport, no horizontal overflow, composited contrast **8,90:1** (button) and
   **6,08:1** (the 12px explanation).

## The mistake worth copying, because it nearly became a filed defect

Mid-pass the browser showed an **`Aanvaard` placement being discarded** by a regeneration. It reproduced over plain
`curl`, on a row inserted directly by `psql` so no application write path was involved, on real PostgreSQL — while the
xUnit test asserting the opposite passed on the same source tree. That is a convincing-looking contradiction and I
spent half an hour building theories about EF materialisation for it.

**The API was running the mutation.** The `IsVervangbaar => !Vergrendeld` mutation check had been built, then the
source restored with `cp` — and the app started with `dotnet run --no-build`. `git diff` was clean, `dotnet test` was
green, the source on disk was correct, and the running process was not. A forced recompile (`touch` + `dotnet build`)
changed the behaviour, which is the evidence: same source, same database, same requests, different binary.

Two rules out of it, both cheap:

1. **After a mutation check, rebuild before you run anything** — and prefer `--no-build` only on a build you watched
   succeed *after* the restore. An incremental build did not notice a file restored within the same second as the
   previous build's output.
2. **A defect that contradicts a passing test on the same tree is a claim about your environment first.** The tell was
   there from the first measurement: the lock was honoured and the status was not, which is precisely the shape of
   `!Vergrendeld` and not the shape of any plausible EF bug.

Recorded rather than quietly fixed because the failure mode is invisible in every artifact this project reviews: the
diff, the tests and the worklog would all have been honest while the screenshot was of something else.

## Antagonist round 1 — VIOLATIONS FOUND (3 MAJOR, 4 MINOR, 2 QUESTION), all addressed

Run on `ff47067`. **All three MAJORs were in the disclosure or in prose about it, which is exactly what this story is,
so none of them was cosmetic.** The auditor re-ran vitest, lint and `dotnet format` itself and ran the two new backend
tests against real PostgreSQL rather than taking the worklog's figures.

**MAJOR-1 — the copy promised replacement where the code only guarantees deletion.** *"…worden vervangen door nieuwe
voorstellen"* is stronger than `GenereerAsync`: the discard at line 136 is unconditional on a valid parse and happens
**before** anything is placed, so at least three success paths delete and put nothing back (the model returns an empty
list, every proposal is skipped as an unknown thema/date, every proposal lands in a period a `vast moment` blocks).
**This story's own new endpoint test constructs the first of those**, which is the sharpest part of the finding: the
counterexample was in the commit. Worse, the certain half was worded as a swap while the uncertain half was stated
flatly, which inverts the risk on the one press the sentence exists to inform, and it was stronger than
`kalender.vergrendelUitlegVrij`'s own *"kan het vervangen"* two keys away. Now: *"verdwijnen, ook als de AI er deze keer
minder of geen voorstelt"*, pinned by an assertion on the clause **and** a `not.toHaveTextContent(/worden vervangen/)`.

**MAJOR-2 — replacing the first-run sentence deleted the human-in-the-loop statement in a reachable state.** The
justification was that the board's `beslisUitleg` carries *"jij beslist"* anyway. It does not always: it is gated on
`openBeslissingen > 0`, deliberately, by E4-02's own re-audit, and there is an existing test proving it disappears once
every card is decided. So on a **fully decided plan** — the likeliest state to press regenerate from, having worked
through every card and wanting the empty periods filled — neither sentence rendered and nothing said the arrivals are
proposals the teacher still decides on (Art. IV.1/IV.2). None of my four tests covered it: test 4's third placement is
`Voorgesteld`+`vergrendeld`, so `openBeslissingen` is 1 there and `beslisUitleg` renders. Fixed in the string itself,
which no other component can gate, plus a fifth test with an all-decided fixture that **asserts the precondition**
(`beslisUitleg` really is absent) so it cannot quietly stop testing its own case.

**MAJOR-3 — "no server test read `aantalVervangen`" was false, three times.** E4-06's lock test asserts it forty lines
above my new test in the same file, and the unit suite reads `AantalBehouden` four times. The consequence I drew from
it was wrong too: renaming the C# property breaks the build, so the suite would not have been green. Only the
**serialized** name was unpinned. All three sentences narrowed to that; the mutation figure for the endpoint test was
also off (`1 → 0`, not `2 → 0`). *This is the class the last five audits here keep finding, and I produced a textbook
instance while writing a story whose whole subject is a claim that outran the code.*

**MINOR-1** — the new guard's docblock argued a non-vacuity canary was impossible and then wrote one three lines below.
Kept the canary, rewrote the paragraph, and said plainly what the tripwire costs. **MINOR-2** — the guard's pattern
required *opnieuw* and *gener* to be adjacent, so **FR-8.1's own phrasing** (*"opnieuw laten genereren"*), quoted twice
in this very change, escaped it. Widened to tolerate two words, bounded rather than `.*` so an unrelated "probeer het
opnieuw" cannot drag a string in; mutation-checked with a string phrased the way the requirement is.
**MINOR-3** — the copy promises four survivors and the row-level test covered two while its docblock claimed there were
only two. `Geweigerd` is now in the fixture: it is the survivor a teacher can least verify by looking, since a rejected
card looks identical either way, and its survival is what keeps the AI from re-proposing that thema there.
**MINOR-4** — *"zelf geplaatst"* did not cover a **dragged** thema, which becomes `Manueel` and survives; the component
comment relied on that while the sentence did not say it. Added *"verplaatst"*, the screen's own verb.

**Both QUESTIONs are recorded rather than acted on**, and both are the owner's: that a directie ruling on E4-07's
preserve/overwrite rule would now falsify a primary-screen sentence as well as E4-06's six card-level ones (this story
keeps E4-06's *"hele jaarplan"* qualifier, so it adds no new commitment); and that the *Te herzien* panel does not say
a regeneration resolves an undecided stale card by deleting it, though the new copy does cover it.

**Fix round gates:** 577 unit + 205 integration (0 skipped, real PostgreSQL), **501** frontend / 20 files,
format/lint/build clean. Three new mutation checks, all biting: dropping the third clause fails the new all-decided
test; a sibling phrased *"opnieuw laten genereren"* without a scope clause fails the widened guard; making `Geweigerd`
replaceable fails the Postgres test. **No product code changed in this round** — copy, comments and tests only — so the
regeneration journey measured earlier still stands as measured.

*The copy was re-measured in a browser because it grew:* at 390px the paragraph is now **7 lines / 116px** where the
first version was 4, contrast unchanged at **6,08:1**, button **8,90:1**, no overflow. That cost is accepted rather
than hidden: this is the disclosure before a run that deletes work, on a control a teacher presses once or twice a
year, and after the audit every clause answers a state the previous version got wrong.

**A second `--no-build` lesson from the fix round, applied rather than repeated:** the `Geweigerd` mutation was
restored with `touch` + a full `dotnet build` before anything else ran, which is the rule the near-miss above produced.

## Antagonist round 2 — VIOLATIONS FOUND (1 MAJOR, 2 MINOR), all addressed

Run on `4926852`, by the same auditor, explicitly told that a fix round has contained the next defect four stories
running here. **It found the new defect in the fix, in the same sentence, pointing the opposite way** — and it also
stated plainly which round-1 findings were genuinely closed rather than crediting the attempt (MAJOR-2, MAJOR-3 and all
four MINORs closed; MAJOR-1 closed in the direction filed and reopened in the other).

**MAJOR — *"verdwijnen"* was false for a locked proposal, and the paragraph contradicted itself two clauses later.**
Round 1's fix read *"AI-voorstellen waarover je nog niets beslist hebt, verdwijnen"*. A **locked, undecided** proposal
is exactly that, and `IsVervangbaar` keeps it. This is not a corner: it is the state **E4-06 built the lock for**, and
`kalender.vergrendelUitlegVrij` instructs the teacher to create it in those words (*"Zet het vast als je het wil houden
zonder er nu al over te beslissen"*), while `vergrendelNietNodig` defines *beslissen* and *vastzetten* as disjoint. So
the reading that would rescue the sentence is the one the screen's own copy rules out. Sentence 3 then listed
*"vastgezet"* among the survivors, so a teacher who used the lock as advertised read first that their proposal
disappears and then that it stays. **This story's own test 4 renders precisely that fixture and asserted only that the
sentence appeared**, which is why it could not see it.

*Fixed by changing the shape, not by adding a condition.* What is lost is now the **complement** of what is kept:
*"Wat je aanvaard, geweigerd, zelf geplaatst, verplaatst of vastgezet hebt, blijft staan. De overige AI-voorstellen
verdwijnen…"*. A second list of exclusions can drift from the first, as it just did in both directions; *"de overige"*
cannot. The complement is exactly `IsVervangbaar`, without restating it. Pinned in test 4 by an **order** assertion
(the survivors must be named before *"De overige"*), which is the one line that fails when the two clauses are swapped
with no other change, and by asserting each survivor term by term.

**MINOR — the word this round declared wrong survived in the report three lines below.** `kalender.genereerVervangen`
still said *"{aantal} eerdere voorstellen zijn vervangen"*, so on an empty model answer a teacher read
*"De AI stelde geen enkel thema voor."* immediately followed by *"6 eerdere voorstellen zijn vervangen."* — the exact
false framing round 1 filed, left standing one paragraph lower and now the only thing on screen after a destructive
run. The report is **E3-02's**, so this is an out-of-scope edit and it is declared as one in the groepschat: both keys
now say *"verdwenen"*. Aligning beat routing because the alternative is two words for one event on one card, which is
the drift these guards exist to stop.

**MINOR — *"verplaatst"* is not true for a no-op move**, where a card is dragged back into the period it started in:
`VerplaatsPlaatsingAsync` deliberately writes nothing, so the placement stays `Voorgesteld` and does disappear. Left
unfixed on the auditor's own advice and recorded in the component comment instead. Making the no-op write would cost a
standing proposal its motivation, which is the worse trade, and `kalender.sleepUitleg` already carries the same
imprecision, so this is pre-existing drift rather than a regression.

**Round-2 gates:** 577 unit + 205 integration (0 skipped, real PostgreSQL) and **501** frontend, all re-run by the
auditor itself rather than read off this file, plus lint / build / `dotnet format` clean and `dotnet build` at 0
warnings. The clause-swap mutation fails exactly one assertion, which is the one written for it.

*Measured again in a browser, on the state both findings were about* (locked proposal + **empty** model answer, the
run that destroys and creates nothing): the board keeps `Verkeer 🔒 Vast` and nothing else, and the report reads
*"De AI stelde geen enkel thema voor." / "6 eerdere voorstellen zijn verdwenen." / "1 bestaande plaatsing bleef staan
(vast of al beslist)."* No occurrence of *"vervangen"* anywhere on the card. At 390px the paragraph is **6 lines /
99px** (down from 7 after the restructure), contrast **6,08:1** for the disclosure and **5,73:1** for the report, no
overflow.

*One process note, since it is the second `--no-build` sighting in one story:* the re-measurement first showed the run
doing nothing, because the AI stub had been killed in the previous teardown and the API was answering 500. Not a
defect and not a false one this time, but the same shape: **an environment I had dismantled, measured as if it were
the product.**

## Closed 2026-08-06 by owner ruling, without a third round

The owner was offered a third round and closed the story instead, on the same basis as E5-01, E4-01, E4-08 and E3-03.
**What that knowingly accepts is nameable here rather than generic:** each of the two rounds found its MAJOR in the
previous round's fix, in this one paragraph, pointing opposite ways, so a third round would have attacked the round-2
rewrite of `kalender.hergenereerUitleg` and the two `genereerVervangen*` keys, and nothing else.

Against that, and it is why the ruling is defensible rather than a coin flip: ronde 2 **re-ran every gate itself**
instead of reading the figures off this file; it reported per finding which of round 1's were genuinely closed rather
than crediting the attempt; the round-2 fix changed the sentence's **shape** rather than adding another condition, so
the specific failure mode (two lists of statuses drifting apart) cannot recur by drift; and the state both MAJORs were
about was then driven in a browser against real PostgreSQL.

## What this story does not claim

- **Nothing about per-period regeneration** (E4-05). The copy is scoped to the whole plan in both new strings, which is
  also what E4-06's six inherited strings do.
- **No pre-apply diff and no cancel** (E4-07, FR-8.3), and no count of what a run will change.
- **No live model round trip.** Same residual M2 accepted: `IAiClient` stubbed, everything else real.
- **The `vast moment` question is untouched** (Art. XIV, opened by E4-03): a regeneration still refuses to place into a
  blocked period while manual placement ignores it. E4-05 is where that gets settled.
