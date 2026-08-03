# E5-01 — Coverage computation (computed, never stored)

**FR:** FR-9.1 · **Constitution:** Art. V.1 (the core invariant), Art. V.6 (highest-risk logic)
**Branch:** `story/E5-01-dekkingsberekening` (off `main` `61457bc`)
**Date:** 2026-08-03

---

## What this story delivers

Coverage of one class's jaarplan, derived on read. A leerplandoel is *gedekt* when a thema carrying it (link status
`aanvaard`/`manueel`) is placed in a real period of that class's plan. Nothing is persisted: there is no dekking
table, no cached percentage and no invalidation step.

| File | Layer | Role |
| --- | --- | --- |
| `Application/Dekking/DekkingWeergave.cs` | Application | The read view: per-doel coverage + the reliability of the summary figure |
| `Application/Dekking/IDekkingOpslag.cs` | Application | The persistence port; **carries the layer ruling and its rejected alternatives** |
| `Application/Dekking/DekkingService.cs` | Application | The computation itself |
| `Application/Planning/Generatie/IJaarplanLezer.cs` | Application | New narrow read seam over the existing plan projection |
| `Infrastructure/Dekking/EfDekkingOpslag.cs` | Infrastructure | The four-layer link read + the curriculum denominator |
| `Api/Controllers/DekkingController.cs` | Api | `GET /api/klassen/{klasId}/dekking` |

`JaarplanGeneratieService` now implements `IJaarplanLezer` (one line). No migration, no frontend, no `nl.json`.

## The decision this story could not infer: which link layers count

**Found before writing any code.** A `DoelKoppeling` lives in four places (Art. IX.2), and the codebase held
**three different answers** about which of them count:

| Where | Layers |
| --- | --- |
| `OngekoppeldeDoelenQuery` (gap list, E2-06) | **4** |
| `OpstapImportService.KoppelingAantallenAsync` | **3** — omits `Thema.Doelsuggesties` (this is E1-17's defect) |
| `JaarplanGeneratiePromptBuilder.ThemaDoelcodes` (kalender card) | **2** |

The gap list's own docstring claims it "matches the coverage semantics of Art. V, so the gap list and dekking agree
on what linked means". That promise could not hold against a 2-layer dekking. Art. V.1 says "linked to a thema that
is placed in the plan" and enumerates no layers, so this was not derivable.

**Owner ruling, 2026-08-03: all four layers, with the two class-scoped ones filtered to this class.** Themadoelen and
thema-level doelsuggesties are school-wide and count for every class placing the thema; `Subdoel` and
`Activiteit.Doelkoppelingen` hang off a `Subthema`, which Art. IX.2 scopes per klas and leeftijd, so they count only
for the class that owns the subthema. The rejected readings and why they were rejected are recorded on
`IDekkingOpslag` rather than only here:

- **2 layers** would leave a goal linked solely through an activiteit missing from *both* overviews — not covered,
  and not in the gap list either, because the gap list would call it linked.
- **4 layers school-wide** would let class A claim coverage for content class B teaches.

A second consequence worth stating: `LaadThemasAsync` eager-loads only two layers, so before this story the other
two were not merely unfiltered, they were **not loaded**. A missing navigation, not a wrong query — the failure mode
that stays green in every test.

## The Postgres test earned its place on its first run

`EfDekkingOpslag` was first written as **one** query: `.Concat()` over the four branches with a single `Distinct()`,
translated to one SQL UNION. **It is not translatable.** EF throws *"Unable to translate set operation after client
projection has been applied"*, because each branch already projects into a `DekkendeKoppeling`. Four of the five
Postgres tests failed on it.

The union moved client-side — four reads, unioned in memory — which is exactly what
`LeerplandoelenQuery.HaalKoppelingenAsync` already does for these same four layers. Cost: four statements over one
class's placed thema's, bounded and small.

**The point is what would have happened otherwise.** The EF in-memory provider evaluates that whole expression in
LINQ, so the broken version *passed* there. It would have gone through CI green and thrown the first time anyone
opened a dekkingsoverzicht. This is precisely the carry-forward the E2-06 antagonist attached to this story: cover
the "UNION of owned subqueries" translation against real PostgreSQL when the coverage queries are written. It paid
off immediately.

## Rules implemented, each with its authority

1. **Only `aanvaard`/`manueel` placements cover** (Art. V.1's "placed in the plan", as read by the E3-01 antagonist
   on 2026-07-29). A `voorgesteld` placement would let the **AI** grant dekking, which Art. IV.1 forbids.
2. **A stale placement covers nothing** — it is in no period, so nothing is demonstrably taught on its account
   (directie 2026-07-28).
3. **The summary figure is withheld while anything is unresolved.** `AantalGedekt` is `int?` and is `null` when
   `IsBetrouwbaar` is false. Deliberately a missing number rather than a flag beside a populated one: a caller
   physically cannot render a total it does not have. This is E3-07's clause 4, which its own test report recorded as
   *not verifiable* rather than as a pass — **it is now implemented.**
4. **A withdrawn goal (`NietMeerInOpstap`) stays in the denominator** and carries its flag. Dropping it would shrink
   the total and raise the percentage, the one direction a coverage figure must never move on its own.
5. **Fail closed on an unreadable status.** `ThemaplaatsingWeergave` carries the status as a string; an unrecognised
   value covers nothing *and* still counts as unresolved.

### One judgement call, flagged as such

**A stale *geweigerd* placement does not make the figure unreliable.** The directie ruling says "while any placement
is unresolved" and did not contemplate a rejected one. A rejected placement contributes nothing whether or not its
period still exists, so its staleness can never change the number; counting it would leave the plan permanently
*te herzien* over a placement nobody will ever re-place, and would reproduce the defect E4-06 fixed elsewhere (a
rejected card being told to go pick a period). It reuses an existing tested domain concept —
`Themaplaatsing.IsGepland`, "anything except a placement the teacher has rejected" — and the E3-02 code review made
exactly this correction to the spreading report. A stale *voorgesteld* placement **does** count as unresolved,
because accepting it would raise the figure.

Both sides are pinned by their own named test. If the owner wants the stricter reading, it is one predicate.

## Why `IJaarplanLezer` exists

Coverage must agree with the calendar about which placements are stale, because the same screen carries a
non-dismissible "needs attention" notice (E3-07/E3-09) *and* a dekking figure. Re-deriving staleness independently
could drift, and the visible symptom would be a plan reporting a trustworthy percentage while flagging placements as
broken. Consuming the **same projection the teacher sees** makes that disagreement impossible to write. Registered so
both resolve from one scoped instance per request.

## What this story deliberately does NOT do

- **No minimumdoel-level coverage.** That is **E5-04**, blocked on **E1-12**: no `Minimumdoel` row can exist until
  directie supplies the decreed source file. Every doel carries its `minimumdoelRef` so the roll-up needs no second
  pass, and a named test exists so the presence of the field is not mistaken for the presence of the roll-up.
  **Art. V.2's inspection level is therefore still unreached.**
- **No screen.** E5-02/E5-03/E5-05 own the dekkingsoverzicht. The endpoint exists so the figure is verifiable, not
  because FR-9 is satisfied.
- **No percentage.** E5-03 owns it. The counts it needs are here.
- **No unification of the three layer definitions.** That is **E1-17**, and folding it in would absorb that story.
  What this story adds for it: the duplication **cannot be removed by extracting a method**, because these predicates
  must translate to SQL and EF cannot translate a call to a helper. E1-17 has to either generate the queries from one
  place or pin the call sites against each other.
- **No change to `ThemaDoelcodes`' behaviour.** Its docstring claimed "the same rule dekking uses", which this story
  falsifies; the comment was corrected to state the subset relationship and why it cannot be closed without giving
  that method a klas.

## Gates

| Gate | Result |
| --- | --- |
| `dotnet build` | 0 warnings, 0 errors |
| `dotnet format --verify-no-changes` | clean |
| `dotnet test` (unit) | **512 passed**, 0 failed, 0 skipped (+16) |
| `dotnet test` (integration, real PostgreSQL) | **161 passed**, 0 failed, 0 skipped (+7) |

Baseline at `61457bc` was 496 unit + 154 integration. New tests: 16 unit (`DekkingServiceTests`), 5 Postgres
(`DekkingLagenPostgresTests`), 2 endpoint (`DekkingEndpointsTests`).

Run with `JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable"`.

**Not run:** the antagonist audit. It is owed under the working agreement and has not happened.
