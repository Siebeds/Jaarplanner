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

## Antagonist round 1 — VIOLATIONS FOUND (4 MAJOR, 6 MINOR, 1 QUESTION), all addressed

The audit re-ran the gates itself before judging and confirmed the gate table above was true. Then it falsified
**four** claims in this worklog and in the code comments. Recording each, because three of the four were prose
asserting the opposite of the implementation — the defect class this project keeps re-encountering, and one that this
story had itself been fixing in `ThemaDoelcodes`.

### MAJOR 1 — the contract said "stale", the code meant "unresolved", and the kalender really does disagree

`IsBetrouwbaar` and `AantalVervallenPlaatsingen` were documented as counting **stale** placements. They exclude
rejected ones. Worse, the audit checked the frontend and found the divergence is not hypothetical:
`kalenderFormat.ts:174` filters `isVervallen` with **no status filter**, so a stale *geweigerd* card raises the
non-dismissible "aandacht nodig" notice while this payload reports `isBetrouwbaar: true` and `0` unresolved. My
`IJaarplanLezer` docstring meanwhile claimed such a disagreement was "impossible to write".

**Fixed:** field renamed to `AantalOnopgelosteVervallenPlaatsingen`; both params state the exclusion; the seam's
docstring now says what actually holds (one grid derivation and one per-placement flag per request — *not* agreement
on the totals) and names the divergence as chosen, with **E5-02 owning the copy**. Presenting "1 plaatsing moet
herbekeken worden" beside a bare "dekking is betrouwbaar" would be the E4-06 contradiction in a new place.

*On the rule itself the audit agreed, and gave it a better argument than I did:* because dekking is recomputed on
read, un-rejecting a stale placement makes the **very next read** withhold the figure. The state is self-healing, so
nothing is permanently claimed that cannot be proven.

### MAJOR 2 — the test fake documented a safeguard it did not implement

The fake's comment claimed it filtered by `themaIds` "so it cannot hand back coverage the service did not request".
It never filtered. The audit verified no test was passing for the wrong reason (the short-circuit cases assert the
port is never called at all), so this was a documented guard that was simply absent — and the next test to rely on it
would have passed silently.

**Fixed:** claim removed, replaced with why no filter is needed and why the existing assertions are *stronger* than a
filtered answer would be (a filtered fake could still hide a service asking about the wrong thema).

### MAJOR 3 — the denominator is the whole curriculum, and it was the one judgement call I left undeclared

`HaalLeerplandoelenAsync()` took no argument and had no seam, so a K3 class is measured against every L1–L6 goal,
every discipline and the illustrative `P`/`S`/`A` doelsoorten. The audit's sharpest point: this story documents five
other judgement calls meticulously and the layer ruling in three places, while `DekkingWeergave` framed the unscoped
denominator as a **virtue** ("a property of the loaded curriculum rather than of this plan").

**Fixed:** recorded as a **new Art. XIV open decision** in `backlog/README.md`, and a real seam added —
`HaalLeerplandoelenAsync(jaarFasen)` — which is **implemented and Postgres-tested** rather than accepted-and-ignored,
because a parameter that is ignored is discovered to be decorative on the day someone finally needs it. A test also
pins that an *empty* collection means "no scope" rather than "nothing in scope", since the latter would report 0 of 0
and look perfect. `null` at every call site today, with the structural reason stated: `Klas` deliberately keys nothing
on `Leerjaar` while graadklassen are unresolved.

### MAJOR 4 — the story's central claim had no test above component level

No test anywhere composed a real persisted `Themaplaatsing` with the real link layers. The endpoint tests covered only
the empty plan and the 404; the layer tests never touched a jaarplan; the unit tests never touched a database. So the
sentence this story exists to deliver was verified **only across two mutually-faked halves** — and my own
`DekkingEndpointsTests` docstring claimed it proved the whole chain while proving it for the path where the link query
is never called.

**Fixed:** three endpoint tests over HTTP against real PostgreSQL — a placed aanvaarde thema covering its doel and
**naming itself as evidence**, a stale placement withholding the figure (**E3-07 clause 4 now proven end to end**),
and a voorgestelde placement covering nothing at the outermost boundary. The block start is asked of the real
`IPlanningsblokIndeling` rather than hard-coded, so the healthy case cannot silently drift into asserting the stale one.

### MINORs, all addressed

| Finding | Fix |
| --- | --- |
| "same browse order as the gap list" was unguaranteeable — dekking sorts in .NET, the gap list in Postgres under the DB collation — and `CurrentCulture` made output host-dependent | **Ordinal throughout**; the claim now says stable and host-independent, and explicitly *not* byte-identical to the gap list |
| the worklog said the rejected rule "reuses `Themaplaatsing.IsGepland`"; it re-derives it from a serialised string | stated plainly, with the trigger named for fixing it properly (put the predicate on `ThemaplaatsingWeergave` if a fourth caller appears) |
| `IsGedekt` pointed at `DekkendeThemas` "for what placed excludes"; that member said nothing about it | the three exclusions are spelled out where they are claimed |
| `IJaarplanLezer`'s isolation from the AI client is type-level, not structural (the resolved instance *is* `JaarplanGeneratieService`) | stated as type-level, with what would make it structural |
| unpaged whole-curriculum payload with full goal text diverges from the register's paging, unnoted | recorded on the controller for E5-02/E5-03, including the four link queries + full thema load per request |
| new endpoint is unauthenticated | noted on the controller and routed to **E7-11**; FA §3.2 needs no *role* gate here, but it does need a signed-in user |

### QUESTION — filed, not guessed

The FR-1 school-content import writes every `DoelKoppeling` as `voorgesteld`, and only `aanvaard`/`manueel` count. So
a school that imports its thema's *with* their links sees **0% dekking** until a teacher accepts each one. That may be
exactly right (Art. IV.2), but it is the first number directie will ever see. Recorded in `backlog/README.md`;
**E5-02 must not put a figure on screen before it is answered.**

## Gates

| Gate | Round 1 | After the fix round |
| --- | --- | --- |
| `dotnet build` | 0 warnings, 0 errors | 0 warnings, 0 errors |
| `dotnet format --verify-no-changes` | clean | clean |
| `dotnet test` (unit) | 512 passed, 0 skipped | **513 passed**, 0 failed, 0 skipped |
| `dotnet test` (integration, real PostgreSQL) | 161 passed, 0 skipped | **165 passed**, 0 failed, 0 skipped |

Baseline at `61457bc` was 496 unit + 154 integration. Final new tests: **17 unit** (`DekkingServiceTests`),
**6 Postgres** (`DekkingLagenPostgresTests`), **5 endpoint** (`DekkingEndpointsTests`).

Run with `JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable"`.

**Still not done:** a re-audit of the fix round. Every prior story here that needed one found defects *in the fixes*,
so this stays `[~]` until an independent pass confirms these fixes are real and no finding was falsely reported as
closed.
