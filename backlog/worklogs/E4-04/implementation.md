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
> Er staat al een jaarplan. Opnieuw genereren geldt voor het hele jaarplan: AI-voorstellen waarover je nog niets
> beslist hebt, worden vervangen door nieuwe voorstellen. Wat je aanvaard, geweigerd, zelf geplaatst of vastgezet
> hebt, blijft staan.

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

## What this story does not claim

- **Nothing about per-period regeneration** (E4-05). The copy is scoped to the whole plan in both new strings, which is
  also what E4-06's six inherited strings do.
- **No pre-apply diff and no cancel** (E4-07, FR-8.3), and no count of what a run will change.
- **No live model round trip.** Same residual M2 accepted: `IAiClient` stubbed, everything else real.
- **The `vast moment` question is untouched** (Art. XIV, opened by E4-03): a regeneration still refuses to place into a
  blocked period while manual placement ignores it. E4-05 is where that gets settled.
