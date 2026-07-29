# E3-01 — Jaarplan generation service (structured JSON, advisory)

## Build round 1 — the `Jaarplan` aggregate, Schooljaar↔Klas containment, and the AI generation flow with its endpoint

- **FR / Article:** FR-5.1 · Art. IV (all clauses, esp. IV.1/IV.2/IV.3/IV.4/IV.5/IV.6) · Art. IX.3 (data model) ·
  Art. V.1 (dekking computed, not stored) · Art. VIII (layering) · Art. X · Art. XIV (graadklassen left open) ·
  [ADR-0010](../../../docs/adr/0010-ai-advisory-architecture.md) · [ADR-0013](../../../docs/adr/0013-planningsblok-abstraction.md) ·
  [ADR-0020](../../../docs/adr/0020-planningsblok-derivation-rules.md)
- **Branch:** `story/E3-01` (branched from `feature/e3-jaarplan-kalender`)

### What this story owns, and what I built for each

The story bundles three things. All three are built.

1. **The `Jaarplan` entity** (Art. IX.3) with a `vergrendeld` flag per thema.
2. **Schooljaar↔Klas containment** — Art. IX.3's "`Schooljaar` contains multiple klassen", which E3-05 left
   unimplemented and which the E3-05 audit found was owned by no story.
3. **The generation service** — a per-class plan proposal, structured JSON, validated, persisted as a proposal,
   reachable through an actual endpoint.

### Files changed

**Domain (`backend/src/Jaarplanner.Domain`)**

| Path | Why |
| --- | --- |
| `Planning/Jaarplan.cs` | **new** — the per-class plan aggregate: `KlasId` + a set of `Themaplaatsing`. Holds no block list. |
| `Planning/Themaplaatsing.cs` | **new** — one thema in one planningsblok: `(BlokNiveau, BlokStart)` + `Status` + `AiMotivatie` + `Vergrendeld`. |
| `Planning/Klas.cs` | Added a **required** `SchooljaarId`; ctor is now `Klas(Guid schooljaarId, string naam, int leerjaar)`. |
| `Planning/Schooljaar.cs` | Added the `Klassen` collection + `VoegKlasToe(naam, leerjaar)` — the containment expressed on the owning side. |
| `Schoolcontent/KoppelingStatus.cs` | Doc only: recorded that this is *the* Art. IV.2 status vocabulary, shared by `DoelKoppeling` and `Themaplaatsing`. |

**Application (`backend/src/Jaarplanner.Application`)**

| Path | Why |
| --- | --- |
| `Planning/Generatie/JaarplanGeneratieService.cs` | **new** — the FR-5.1 pipeline behind three seams (`IAiClient`, `IPlanningsblokIndeling`, `IJaarplanOpslag`), plus the review/lock use cases. |
| `Planning/Generatie/JaarplanGeneratiePromptBuilder.cs` | **new** — grounded prompt from klas + *derived* blocks + the school's thema's. Pure, deterministic, no calendar unit. |
| `Planning/Generatie/Response/JaarplanGeneratieResponseParser.cs` | **new** — validates the structured-JSON contract before anything is used (Art. IV.5). |
| `Planning/Generatie/Response/JaarplanParseResultaat.cs` | **new** — valid-with-placements or invalid-with-diagnostic; no third state. |
| `Planning/Generatie/Response/ThemaplaatsingSuggestie.cs` | **new** — one validated suggestion; cannot exist invalid. |
| `Planning/Generatie/JaarplanGeneratieResultaat.cs` | **new** — run outcome incl. what was skipped and what was kept. |
| `Planning/Generatie/JaarplanWeergave.cs` | **new** — the reviewable read view (`JaarplanWeergave` + `ThemaplaatsingWeergave`). |
| `Planning/Generatie/IJaarplanOpslag.cs` | **new** — persistence seam, so the flow runs with no database in tests. |
| `Planning/Generatie/OngeldigePlaatsingsstatusFout.cs` | **new** — the only genuinely new fault type (→ 400). |
| `Planning/Beheer/ISchooljaarBeheerService.cs` | **new** — the minimum Schooljaar create/list/read surface + DTOs. |
| `Planning/Beheer/IKlasBeheerService.cs` | `MaakKlasAsync` now takes a `schooljaarId`; `KlasWeergave` carries `SchooljaarId`. |

**Infrastructure (`backend/src/Jaarplanner.Infrastructure`)**

| Path | Why |
| --- | --- |
| `Planning/EfJaarplanOpslag.cs` | **new** — EF Core implementation of the persistence seam. |
| `PlanningBeheer/SchooljaarBeheerService.cs` | **new** — Schooljaar create/list/read over `AppDbContext`. |
| `PlanningBeheer/KlasBeheerService.cs` | Creates a klas *through* its schooljaar; 404 on an unknown year; `SchooljaarId` in the view. |
| `Persistence/Configurations/JaarplanConfiguration.cs` | **new** — `jaarplannen` + owned `themaplaatsingen`; no block table, no ordinal column. |
| `Persistence/Configurations/SchooljaarConfiguration.cs` | Added the `HasMany<Klas>("_klassen")` FK (Restrict) and ignored the `Klassen` projection. |
| `Persistence/Configurations/KlasConfiguration.cs` | `SchooljaarId` required; documented that the name index stays school-wide. |
| `Persistence/AppDbContext.cs` | Added `DbSet<Jaarplan> Jaarplannen`. |
| `Persistence/Migrations/20260728150734_JaarplanEnSchooljaarKlassen.cs` (+ `.Designer.cs`, snapshot) | **new** — generated with `dotnet ef migrations add`; hand-annotated with a guard (see below). |
| `DependencyInjection.cs` | Registered `IJaarplanOpslag`, `JaarplanGeneratieService`, `ISchooljaarBeheerService`. |

**Api (`backend/src/Jaarplanner.Api`)**

| Path | Why |
| --- | --- |
| `Controllers/JaarplanController.cs` | **new** — the invocation surface: generate, read, decide, lock. |
| `Controllers/SchooljarenController.cs` | **new** — create/list/read a schooljaar, without which the required container is unreachable. |
| `Controllers/KlassenController.cs` | `POST` moved to the nested route `/api/schooljaren/{schooljaarId}/klassen`. |
| `Infrastructure/PlanningExceptionHandler.cs` | **new** — maps `OngeldigePlaatsingsstatusFout` → 400. |
| `Program.cs` | Registered that handler. |

**Tests**

| Path | Why |
| --- | --- |
| `tests/Jaarplanner.UnitTests/Planning/JaarplanTests.cs` | **new** — 10 domain tests. |
| `tests/Jaarplanner.UnitTests/Planning/JaarplanGeneratieResponseParserTests.cs` | **new** — 25 validation tests (incl. theories). |
| `tests/Jaarplanner.UnitTests/Planning/JaarplanGeneratieServiceTests.cs` | **new** — 16 flow tests against faked AI + fake store. |
| `tests/Jaarplanner.UnitTests/Planning/FakeJaarplanOpslag.cs` | **new** — in-memory store, no EF. |
| `tests/Jaarplanner.UnitTests/TestSchooljaar.cs` | **new** — fixture helper for the now-required school year. |
| `tests/Jaarplanner.IntegrationTests/JaarplanEndpointsTests.cs` | **new** — 7 endpoint tests through the real DI container (the reachability evidence). |
| `tests/Jaarplanner.IntegrationTests/Postgres/JaarplanPersistentieTests.cs` | **new** — 7 `[PostgresFact]` persistence tests (**skip here**, see gates). |
| `tests/Jaarplanner.IntegrationTests/TestSchooljaar.cs` | **new** — same helper for the integration project. |
| 5 existing unit-test files + 2 existing integration-test files | Updated for the new `Klas` ctor / nested POST route (mechanical). |

---

### Key decisions

#### (a) A placement keys on the block's **start date**, never on `Ordinaal`

This was the binding constraint and it shaped the whole schema.

`Themaplaatsing` persists exactly two things about the block: `BlokNiveau` (the tier) and `BlokStart` (a
`DateOnly` → PostgreSQL `date`). That pair is `Planningsblok`'s documented identity (ADR-0020 §3). There is **no
ordinal column, and no ordinal property**, deliberately:

- The ordinal is a running position over a *derived* grid. `PlanningsblokIndelingTests.Ordinaal_is_geen_stabiele_sleutel_over_vakantiewijzigingen`
  proves that moving one vakantie re-points later ordinals, so a placement keyed on the ordinal would silently
  relocate a teacher's thema.
- I asserted the absence structurally, not by convention: `JaarplanTests.Themaplaatsing_heeft_geen_ordinaal_of_kalendereenheid`
  reflects over the type and fails if anyone adds `Ordinaal` / `BlokOrdinaal` / `Maand` / `Week`, and
  `JaarplanPersistentieTests.De_bloksleutel_is_een_datum_en_er_is_geen_ordinaalkolom` reads
  `information_schema.columns` and asserts `BlokStart` is a `date` and no ordinal column exists.
- The ordinal *is* projected at read time (`ThemaplaatsingWeergave.BlokOrdinaal`) purely for display ("periode 3"),
  which is the role ADR-0020 assigns it.
- The **AI contract has no way to express an ordinal.** The prompt says, verbatim, *"Verwijs naar een planningsblok
  altijd met zijn STARTDATUM, nooit met zijn nummer of naam"*, and the parser's DTO has no ordinal member at all, so
  `{"blok": 3, …}` fails the required-`blokStart` check. Four theory cases pin that
  (`Een_antwoord_op_blokpositie_wordt_geweigerd`).
- **Blocks are still derived, never stored.** No planningsblok table was added. The service asks
  `IPlanningsblokIndeling.Blokken(schooljaar, Themaperiode)` and never computes or assumes a period itself.
  `De_prompt_biedt_de_afgeleide_blokken_aan_en_geen_kalendereenheid` asserts every derived block start appears in
  the prompt and that no Dutch month name appears in either prompt part.
- **A returned date is resolved, never snapped.** A date that is not the start of any current block is skipped and
  reported in `OnbekendeBlokken`. Snapping to the nearest block would put a thema in a period nobody chose.
- **Staleness after a vakantie edit is reported, not repaired.** `ThemaplaatsingWeergave.IsVervallen` is `true` when
  the stored date is no longer any block's start; `BlokEind`/`BlokOrdinaal` come back `null`. The stored key is
  untouched — nothing moves on its own (directie 2026-07-28). Pinned by
  `Een_vakantiewijziging_verplaatst_een_plaatsing_nooit_stil`, which reshapes the grid by shifting the kerstvakantie
  a week earlier and asserts the placement's date is unchanged and flagged. **I did not build** the non-dismissible
  UI signal or E5's "refuse a dekking figure" — those are E3-07/E3-09/E5. This flag is the honest input they need,
  nothing more.

#### (b) How the AI response is validated before anything is applied

Modelled directly on the E2 stack (`DoelMatchResponseParser` + `DoelMatchParseResultaat`), same shape and same
discipline:

- Contract: `{"plaatsingen":[{"blokStart":"2026-09-01","thema":"Herfst","motivatie":"…"}]}`, or a bare top-level
  array. Empty list is valid.
- Conservative repair only: strip one markdown fence, trim, case-insensitive property matching, ignore unknown
  fields. Nothing is fabricated.
- `blokStart` is **required** and must be strictly ISO `yyyy-MM-dd`. `"01-09-2026"` is rejected rather than parsed
  with the ambient culture — it is 1 September to a Belgian reader and 9 January to an American one, and guessing
  would put a thema most of a year from where it was meant.
- Rejected → `JaarplanParseResultaat.Ongeldig(diagnostic)` with an **empty** list. There is no half-parsed state.
- **One bad item invalidates the whole response** (`Een_ongeldig_item_maakt_het_hele_antwoord_ongeldig`). A
  half-applied year plan hides which half the model got wrong.
- The service validates **before it touches the plan at all**, so a failed run cannot even clear the previous
  proposal (`Ongeldig_antwoord_laat_een_bestaand_voorstel_ongemoeid`, and `AantalKeerBewaard == 0`).
- Over HTTP an invalid response is **422** with the diagnostic and no change to the plan — 422 rather than 500
  because nothing is broken; the model answered badly and the caller can retry.
- A thema name outside the school's own library is skipped and reported (`OnbekendeThemas`), never invented
  (Art. IV.4).
- Everything persisted is `Voorgesteld` + `AiMotivatie`; only an explicit teacher PUT moves it off that, and setting
  it *back* to `voorgesteld` is a 400.

#### (c) `vergrendeld`, modelled now for E4

`Themaplaatsing.Vergrendeld` (non-nullable, default `false` in the database) plus
`Themaplaatsing.IsVervangbaar => Status == Voorgesteld && !Vergrendeld`. `Jaarplan.VerwijderVervangbarePlaatsingen()`
is the only way a generation run discards anything, and `GenereerAsync` calls exactly that. So a run:

- replaces untouched, unlocked proposals;
- keeps locked placements and every human decision (`aanvaard` / `geweigerd` / `manueel`) exactly where they are,
  reported as `AantalBehouden`.

I implemented that rule here rather than deferring the whole thing to E4, because a generator that overwrote a locked
thema would make the flag decorative and a second POST would corrupt the plan. E4 extends this to a single period.
`PUT …/vergrendeling` exists so the flag is settable rather than dead code. Pinned by
`Hergeneratie_behoudt_vergrendelde_en_besliste_plaatsingen` and, over HTTP, by
`Beslissing_en_vergrendeling_overleven_een_herlaad`.

#### (d) Goals are derived, never stored on the plan

FR-5.1 says "thema's met hun doelen". The plan stores **only** thema placements. `ThemaplaatsingWeergave.Doelcodes`
is computed from the thema's themadoelen + goal links with status `aanvaard`/`manueel` — the same rule dekking uses
(Art. V.1). Storing goal codes on the placement would be storing dekking, which Art. V.1 forbids. The prompt shows
the model the same filtered set, so it never reasons about a goal the teacher rejected or has not yet decided on.
The contract for what the AI returns is `planningsblok → thema's`, which is what Art. IV.5 and ADR-0010 specify.

#### (e) Schooljaar↔Klas containment made **required**, and the container given a creation path

`Klas.SchooljaarId` is a required `Guid` with a Restrict FK, and a klas is created through
`Schooljaar.VoegKlasToe(...)`. A nullable FK would mean "contains multiple klassen" held only when someone
remembered to set it, which is not containment.

That required a decision I want visible: **a required container with no way to create it would have made class
creation, and jaarplan generation with it, unreachable** — the exact failure mode this project has hit three times.
So I added a deliberately minimal `SchooljarenController` (POST create with its closures, GET list, GET detail with
the classes it contains). **No update, no delete**: editing a year's vakanties reshapes the grid and can strand
placements, which must raise a review signal rather than move anything — that is E3-07/E3-09, and full
schooljaarbeheer (incl. per-year block lengths) stays **E6-03**. Shipping an edit path would have shipped the
stranding without the signal.

Two consequences I chose on purpose:

- `POST /api/klassen` **moved** to `POST /api/schooljaren/{schooljaarId}/klassen`. The route carries the containment,
  so the body cannot disagree with it and a "rename" (`PUT /api/klassen/{id}`) can never silently move a class to
  another school year.
- The klas-name unique index stays **school-wide**, not per schooljaar. Scoping it per year would make the
  school-content Excel import's by-name class resolution ambiguous the moment a second year exists. The consequence
  — "L3" cannot exist in two years at once — is *inherited*, not introduced here, and is E8-03's ("kopiëren van een
  vorig schooljaar") problem to solve deliberately.

#### (f) Migration

Generated with `dotnet ef migrations add JaarplanEnSchooljaarKlassen` (not hand-written). No model drift: a
subsequent `dotnet build` and the full `dotnet test` run are green, and the snapshot was regenerated by the tool.

I hand-added one thing: **`SchooljaarId` is added NOT NULL with a zero-Guid default** (Postgres needs a default to
fill existing rows) **and that value satisfies no foreign key.** So the migration opens with a `DO $$ … RAISE
EXCEPTION` guard that refuses to run against a non-empty `klassen` table, with an actionable message, instead of
letting the FK fail cryptically. This is safe today — the app has no production deployment (only M0 is reached) — and
if that changes, the fix is a follow-up migration that back-fills, which is a decision about *which* year those
classes belong to and must not be guessed in a migration.

---

### Art. XIV forks isolated rather than decided

- **Graadklassen / menggroepen.** Nothing I built assumes one klas = one leerjaar. `Jaarplan` has **no invariant that
  mentions leerjaar** and no property derived from it; the plan keys on `KlasId` alone. `Klas.Leerjaar` (pre-existing,
  E1) is carried as descriptive data and is stated to the model as context, never as a constraint or a filter. A klas
  that later turns out to span two leerjaren needs no change to this aggregate. I did **not** extend `Klas` to hold
  multiple leerjaren — that is the open decision itself, and inventing a representation would pre-empt directie.
- **Placement tier.** Generation places on `Themaperiode` (a thema is 4–6 wk = the themaperiode).
  `Themaplaatsing.BlokNiveau` is persisted per placement, so subthema-level placement (E3-02 and later) needs no
  schema change. The tier is a named constant `JaarplanGeneratieService.GeneratieNiveau`, not scattered literals.
- **Per-schooljaar block lengths** (ADR-0020 decision 4 / E6-03). Untouched: I consume `IPlanningsblokIndeling`,
  which already takes the `Schooljaar` as a parameter, so lengths can start coming from it without touching this code.

---

### Deliberately deferred (not built here)

- **No frontend.** This is a backend story; the calendar is E3-06 and drag-and-drop E3-07. So the flow is reachable
  by an API caller **but not yet by a teacher in a browser.** I am stating that plainly rather than implying
  otherwise.
- **No spreading heuristics** (E3-02), no full-coverage targeting (E3-03), no pre-generation parameters (E3-04). The
  prompt currently asks the model to spread the thema's over the blocks with a motivation; seasonal ordering and
  balanced goal distribution are E3-02's acceptance, not asserted here.
- **No stale-placement UI signal and no E5 gating.** `IsVervallen` is reported; the non-dismissible notification and
  "refuse a dekking figure" are E3-07/E3-09/E5.
- **No per-period regeneration** (E4). Only the whole-plan run, honouring `vergrendeld`.
- **No Schooljaar update/delete** (E6-03), as argued above.

---

### Gates — stated exactly as run

| Gate | Command | Result |
| --- | --- | --- |
| Build | `dotnet build Jaarplanner.sln` | **Build succeeded**, 0 errors. (4 pre-existing warnings, incl. the known `Microsoft.OpenApi` NU1903 advisory — not introduced here.) |
| Tests | `dotnet test Jaarplanner.sln` | **380 unit passed / 0 failed / 0 skipped** · **26 integration passed / 0 failed / 31 skipped** |
| Format | `dotnet format` then `dotnet format --verify-no-changes` | **Clean** (exit 0, no findings) — after one fix, see note below |

**What executed vs what skipped — read this part carefully.**

- **Executed and green:** all 380 unit tests (including my 51 new ones: 10 domain, 25 parser, 16 service) and all 26
  runnable integration tests, **including all 7 of `JaarplanEndpointsTests`** — the endpoint tests use the EF in-memory
  provider, so they run here and in CI with no container.
- **Skipped here (31 total):** every `[PostgresFact]`, because this machine has no Docker/local Postgres. That
  includes **all 7 of my new `JaarplanPersistentieTests`**. I am **not** presenting any of those 7 as evidence for
  anything. They were written so CI runs them, and they are the only coverage for:
  - the `date` mapping of `BlokStart` and the two enum-as-name columns;
  - the **absence of an ordinal column** in the real schema;
  - the unique **one-plan-per-class** index;
  - the unique **`(JaarplanId, ThemaId, BlokNiveau, BlokStart)`** index (`Dezelfde_plaatsing_kan_niet_twee_keer_bestaan`,
    SqlState `23505`) — note the *rule* itself **is** covered by an executed domain test
    (`JaarplanTests.Een_thema_kan_niet_twee_keer_in_hetzelfde_blok`); only the database index is skipped;
  - the owned-collection cascade on deleting the jaarplan;
  - the **Schooljaar→Klas Restrict FK** (both directions);
  - and that `Vergrendeld` survives storage — note its *logical* round-trip **is** covered in-memory
    (`Beslissing_en_vergrendeling_overleven_een_herlaad` re-`GET`s it); only the relational column mapping is skipped.

  **Until CI runs them, the relational half of this story is unverified.** That is a real gap, not a formality — the
  E1 reopening happened because in-memory results were trusted for exactly this class of thing.
- One test file I touched, `KlasEndpointsTests`, is entirely `[PostgresFact]`, so my change to it (the nested POST
  route + creating a schooljaar in `InitializeAsync`) is **also unverified locally**. It compiles; it has not run.

**Format note.** The first `dotnet format --verify-no-changes` run reported **7 `WHITESPACE` errors, all in
`EfJaarplanOpslag.cs`**, caused by comments placed after `=>` in expression-bodied members. I rewrote those two
comments as `<remarks>` doc blocks, then ran `dotnet format` followed by `dotnet format --verify-no-changes`: **both
exited 0 with no findings**, and `git status` shows the formatter made no further edits of its own. The command is
slow on this solution (it exceeded a 600 s foreground timeout once and had to be backgrounded), so allow a couple of
minutes for it. Build and the full test suite were re-run after that fix and are still green.

---

### Self-check vs the acceptance criteria

| Criterion | Met? | Evidence |
| --- | --- | --- |
| Generate a per-class plan: thema's across planningsblokken | Yes | `JaarplanGeneratieService.GenereerAsync`; `Geldig_antwoord_wordt_als_voorgesteld_voorstel_met_motivatie_gepersisteerd` |
| …with their goals | Yes, **derived** | `ThemaplaatsingWeergave.Doelcodes` from `aanvaard`/`manueel` links (Art. V.1); asserted in the same test |
| Returned as **validated** JSON | Yes | `JaarplanGeneratieResponseParser` + 25 tests; invalid → diagnostic, no placements |
| Persisted as a **proposal**, not auto-applied | Yes | every new placement is `Voorgesteld` + motivation; setting `voorgesteld` by hand is 400 |
| A class yields a **reviewable** generated plan via the **faked** AI client | Yes | `JaarplanGeneratieServiceTests` (fake client, fake store, no network, no DB) and `JaarplanEndpointsTests` (stub client through the real container) |
| …via the **real** AI client | **Not executed.** The real `AzureAiFoundryClient` is the registered `IAiClient` in production DI and this service depends only on that interface, so the wiring is in place and unchanged from E2. But I have no Azure endpoint/key here and did **not** call a live model. Treat "real client" as *wired, untested*. |
| `Schooljaar` contains multiple klassen | Yes (locally in-memory) | `Schooljaar.Klassen` + `VoegKlasToe`; `Een_schooljaar_bevat_zijn_klassen` over HTTP. The **FK/Restrict** proof is a skipped `[PostgresFact]`. |
| `Jaarplan` entity with `vergrendeld` per thema | Yes | `Jaarplan` + `Themaplaatsing.Vergrendeld`; `Alleen_een_onaangeroerd_en_niet_vergrendeld_voorstel_is_vervangbaar` |
| Placement keys on start date, not `Ordinaal` | Yes | reflection test + schema test (skipped) + `Een_vakantiewijziging_verplaatst_een_plaatsing_nooit_stil` |
| Blocks derived, never stored | Yes | no block table in the migration; service calls the seam only |
| Reachable — an actual invocation surface | Yes | `JaarplanController`; `JaarplanEndpointsTests` drives HTTP → controller → service → seam → EF through the real DI container |

---

### For the test-runner

Everything here is **backend / API only — there is no UI for this story, so Playwright has nothing to click.**
Verify with unit + API tests, and if you want a manual pass, use HTTP.

**Automated**

```
cd backend
dotnet build Jaarplanner.sln
dotnet test Jaarplanner.sln
```

Expect 380 unit passed, 26 integration passed, 31 skipped (all `[PostgresFact]`). To confirm the reachability
claim specifically:

```
dotnet test tests/Jaarplanner.IntegrationTests --filter "JaarplanEndpointsTests"
```

That is 7 tests and they must all pass with no container. If you have Docker, please also run
`--filter "JaarplanPersistentieTests"` — those 7 are the ones I could not verify.

**Manual, against a running API** (`dotnet run --project src/Jaarplanner.Api`, with a Postgres connection string and
migrations applied). Note step 4 requires a configured `AzureAI` section; without one the POST will fail at the AI
call, which is expected and is the boundary of what I could verify.

1. `POST /api/schooljaren`
   `{"naam":"2026-2027","start":"2026-09-01","eind":"2027-06-30","sluitingen":[{"naam":"Herfstvakantie","start":"2026-11-02","eind":"2026-11-08","soort":"Vakantie"},{"naam":"Kerstvakantie","start":"2026-12-21","eind":"2027-01-03","soort":"Vakantie"},{"naam":"Hemelvaart","start":"2027-05-13","eind":"2027-05-14","soort":"VrijeDag"}]}`
   → 201, note the `id`.
2. `POST /api/schooljaren/{schooljaarId}/klassen` `{"naam":"L3 — derde leerjaar","leerjaar":3}` → 201, note the `id`.
3. Create at least one thema: `POST /api/themas` `{"naam":"Herfst","duurWeken":5,"invalshoeken":"natuur"}`.
4. `POST /api/klassen/{klasId}/jaarplan/generatie` (no body) → 200 with `isGeslaagd`, `aantalNieuw`, and the plan;
   or **422** with a diagnostic if the model answers badly — and in that case the plan must be **unchanged**.
5. `GET /api/klassen/{klasId}/jaarplan` → each placement has `blokStart` (an ISO date), `blokEind`, `blokOrdinaal`,
   `isVervallen: false`, `status: "Voorgesteld"`, an `aiMotivatie`, `vergrendeld: false`, and `doelcodes`.
6. `PUT /api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status` `{"status":"Aanvaard"}` → 200; re-`GET`
   shows it persisted. `{"status":"Voorgesteld"}` must be **400**.
7. `PUT /api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling` `{"vergrendeld":true}` → 200, then
   POST generatie again: the locked placement must still be there, on the same `blokStart`.

**What to attack** (I would): call generatie twice and check nothing duplicates or gets clobbered; feed the parser a
response keyed on `"blok": 3`; feed it `"blokStart":"01-09-2026"`; and check that `GET` on a klas that was never
generated for returns an empty plan rather than a 404.

---

### Open questions / things I am unsure about

1. **The real AI client was never called.** Only wired. The story's *Done when* says "faked **+ real** AI client";
   I can only claim the faked half. Someone with an Azure AI Foundry endpoint should run step 4 above once.
2. **Postgres persistence is unverified locally** — all 7 of my `[PostgresFact]` tests skipped, as did my edits to
   `KlasEndpointsTests`. CI is the first real run.
3. **The change is larger than I would like** (Art. X.6). It is ~25 source files plus tests, because the story
   bundles three deliverables and because making the containment required forced a creation path and mechanical
   updates at 10 `new Klas(...)` call sites. If a reviewer wants it split, the natural cut is
   *Schooljaar↔Klas containment + `SchooljarenController`* as its own commit ahead of the generation flow.
4. **`KoppelingStatus` is reused for placements** and still lives in `Domain.Schoolcontent`. I judged one shared
   Art. IV.2 vocabulary better than two identical enums drifting apart, and documented that on the type — but the
   namespace is now slightly wrong for one of its two consumers. Moving it is a rename across many files and I chose
   not to bundle that here.
5. **Placement staleness is reported but not acted on.** `IsVervallen` exists; nothing yet forces a human to resolve
   it, and E5 does not yet refuse a dekking figure. Per ADR-0020's follow-ups those are E3-07/E3-09/E5 obligations,
   but until they land a stale placement is only *visible*, not *blocking*.
6. **The migration guard is a design choice, not a test.** It has never executed against a non-empty `klassen`
   table, because no such database exists here.

---

## Fix round 1 — 2026-07-29

Both gates came back red on `dfb1407`: the antagonist raised 1 MAJOR + 5 MINOR, the test-runner 1 MAJOR. The
antagonist could **not** falsify the four binding constraints (start-date keying, exact block resolution with no
snapping, validation-before-mutation, `IsVervangbaar` as the sole regeneration predicate) and judged the reachability
genuine — none of that was touched. All seven findings are addressed; **nothing is disputed.**

### 1. [MAJOR] Deleting a `Klas` silently destroyed accepted and locked placements

**Real, and worse than a missing test: a comment asserted a guard that did not exist.** `JaarplanConfiguration` maps
`jaarplannen → klassen` as `Cascade` and claimed *"Klas deletion is itself already refused while class-scoped content
exists (KlasBeheerService)"*. That guard counts **`Subthemas` only**, so `DELETE /api/klassen/{klasId}` on a class
whose sole content was a fully reviewed, locked jaarplan succeeded, and the database removed the plan and every
`Themaplaatsing` — including ones a teacher explicitly set to `Aanvaard` and explicitly locked. The same endpoint
meanwhile returned a 400 to protect a bare subthema. The existing cascade test
(`Verwijderen_neemt_de_plaatsingen_mee`) deletes the *jaarplan*, never the *klas*, which is exactly why it went
unnoticed.

Three changes:

- **Guard extended.** `VerwijderKlasAsync` now also refuses while the class's jaarplan holds any placement a human
  committed to, reporting the count the way the subthema guard does. A bare unreviewed `voorgesteld` proposal carries
  no human decision and still cascades freely.
- **The predicate is the *complement of the existing one*, deliberately.** New
  `Jaarplan.MenselijkBeslotenPlaatsingen => _plaatsingen.Where(p => !p.IsVervangbaar)`. A second, independently
  written "is this a human decision?" test is precisely how a plan ends up protected against regeneration but not
  against deletion — which *is* this bug.
  `KlasVerwijderenTests.De_verwijdergrens_is_precies_het_complement_van_de_hergeneratiegrens` enumerates all 4
  statuses × locked/unlocked and asserts the two sets partition the plan with no overlap.
- **The false comment is gone,** replaced by what is actually true — including that the earlier claim was wrong and why.

Tests: `KlasVerwijderenTests` (6 tests, **executed** in-memory) covers the refusal for
`Aanvaard`/`Geweigerd`/`Manueel`/locked-`Voorgesteld`, a real multi-placement count (3 blocking, 1 bare proposal not
counted), the proposals-only success path, a class with no plan at all, and the partition property. Two new
`[PostgresFact]`s (**skipped here**): `JaarplanPersistentieTests.Een_klas_verwijderen_neemt_haar_jaarplan_en_plaatsingen_mee`
deletes the `klassen` row with **raw SQL** so the database's own `ON DELETE CASCADE` is what is under test rather than
EF's change tracker; `KlasEndpointsTests.Klas_met_beoordeeld_jaarplan_kan_niet_verwijderd_worden` drives the 400 over
HTTP.

> **A second defect fell out of this fix, and it would have taken the whole app down.** Adding
> `MenselijkBeslotenPlaatsingen` made `dotnet ef` fail with *"Unable to determine the relationship represented by
> navigation 'Jaarplan.MenselijkBeslotenPlaatsingen'"* — EF reads any `IReadOnlyList<Themaplaatsing>` property as a
> second navigation and then refuses to build the model at all, i.e. a startup failure, not a degraded aggregate.
> Fixed with `builder.Ignore(j => j.MenselijkBeslotenPlaatsingen)` beside the existing `Ignore` for `Plaatsingen`, and
> the comment now says *why* both must be ignored so the next projection property added here does not repeat it.

### 2. [MAJOR] The real `AzureAiFoundryClient` had never executed — and the offline part was achievable

Correct, and my earlier framing ("can only claim the faked half") wrongly implied a live endpoint was needed. It is
not: the client is a typed `HttpClient` taking `(HttpClient, IOptions<AzureAIOptions>)`, so a stub
`HttpMessageHandler` plus dummy options drives everything except the network hop.

New `tests/Jaarplanner.UnitTests/Ai/AzureAiFoundryClientTests.cs` — **12 executed tests**, no endpoint, no key, no
sockets. This is the first execution of this class anywhere in the repo, E2-01 included:

- **Outbound request asserted exactly:** `POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=2024-10-21`
  with the trailing slash trimmed; the key on the `api-key` **header**, present once, with no `Authorization` header
  and the key **absent from the URI** (Art. VI.4); both prompt roles in `messages`; and
  `response_format.type == "json_object"` (Art. IV.5 — the model is genuinely *asked* for structured JSON).
- **Raw passthrough:** the assistant content returns verbatim; the client parses nothing, so the trust boundary stays
  in Application. A `null` content normalises to `""`, which the parser then rejects.
- **The full offline seam of the story's "real AI client" criterion:** a canned Azure envelope goes through the
  **real** client → the real parser → the real `JaarplanGeneratieService`, and a reviewable `voorgesteld` plan with a
  motivation comes out keyed on the derived block's start date. The grounded prompt is asserted to have actually
  travelled in the body the client built.
- **Failure paths:** 401/429/500 each throw `HttpRequestException` rather than yielding an empty completion — an empty
  completion is indistinguishable from "the model proposed nothing", so a throttled deployment would otherwise read as
  a legitimately empty plan. `EnsureConfigured` throws for each of endpoint/key/deployment missing *or* whitespace, the
  message names the config keys without echoing the key, and **nothing leaves the process**
  (`AantalAanroepen == 0`).

**Still out of scope:** a genuine live round-trip against Azure AI Foundry. That needs a real endpoint and key, and is
the orchestrator's waiver-or-run decision.

### 3. [MINOR] A constitution citation shipped to a teacher, and one payload was bilingual

- The 400 body no longer reads `"… (Art. IV.1/IV.2)"`. The citation moved into the method's doc comment, where a
  developer reads it.
- **The 422 body is now English throughout, documented as an operator/developer diagnostic rather than teacher copy.**
  Reasoning: `Detail` carries the parser's diagnostic (`"Malformed JSON: …"`, `"Placement at index 2 has a
  missing/blank 'thema'"`), deliberately English because it describes malformed model output no teacher can act on.
  The two *consistent* options were (a) English title + English detail, or (b) Dutch both — but (b) means translating
  parser diagnostics into teacher copy for a condition a teacher cannot act on, i.e. **inventing new hard-coded Dutch
  in the backend**, which is the Art. II.3 problem rather than a fix for it. So (a): `Title = "Invalid AI response"`,
  and the teacher-facing message ("de AI gaf geen bruikbaar antwoord, probeer opnieuw") belongs in `nl.json` keyed on
  the 422 status. **Acknowledged divergence:** the school-content and AI-matching exception handlers use Dutch
  `Title`s; those describe conditions a teacher *can* act on (a bad request, a missing thema), which this one is not.
  Recorded in the controller's doc comment. **Art. II.3 itself is untouched** — it is an open decision, and this
  choice is a contribution to its cost, not a resolution of it.

### 4. [MINOR] Art. II.2 language drift inside the new domain types

All three programmer-error guards are now English, with a comment saying why (they catch programmer error, never
teacher input):

- `Themaplaatsing`: `"Onbekend planningsblokniveau."` → `"Unknown planningsblokniveau."`, now consistent with its
  neighbour `"Unknown plaatsingsstatus."`.
- `Jaarplan.VoegPlaatsingToe`'s duplicate guard: Dutch → `"Thema {id} is already placed in the {niveau} starting
  {date}."`, with a note that **no handler maps this exception**, so if it ever escaped it would be a 500 — which is
  exactly why it must not carry Dutch.

### 5. [MINOR] `Schooljaar` name uniqueness repeated a bug already fixed for `Klas`

Real, and the race handler was unreachable for exactly the case it was written for: the service pre-checks
`lower(naam) = lower(@naam)` and catches `DbUpdateException`, but the EF-declared index on `schooljaren."Naam"` is
case-**sensitive**, so two labels differing only in case passed both. Mirrored the `Klas` fix with migration
`20260729075450_SchooljaarNaamCaseInsensitiefUniek`, emitting
`CREATE UNIQUE INDEX "IX_schooljaren_Naam_lower" ON schooljaren (lower("Naam"))`.

Generated with `dotnet ef migrations add` — it came out **empty**, confirming no model change and therefore no
snapshot drift — then hand-filled with the SQL, exactly as `KlasNaamCaseInsensitiefUniek` was. New `[PostgresFact]`
`SchooljaarPersistentieTests.Schooljaarnaam_is_ook_case_insensitief_uniek` asserts SqlState `23505` **and** the
constraint name, using a label carrying letters ("2030-2031 proefjaar" vs "2030-2031 PROEFJAAR") so "differs only in
case" is expressible at all. **Skipped here** — in-memory ignores unique indexes entirely, so only CI can show it.

### 6. [MINOR] A rejected placement was reported to the caller as a "duplicaat"

`JaarplanGeneratieResultaat` gains **`Afgewezen`** beside `Duplicaten`. Both suppress the re-proposal, but they are
different facts: a duplicate means the AI repeated itself, while this means the *teacher's own* rejection is holding —
and labelling the second as the first blames the AI for the teacher's decision.

Implementation note: the service now calls a new `Jaarplan.VindPlaatsingOp(...)`, which returns the placement so the
*reason* the slot is occupied is available, and `IsAlGeplaatst` is **redefined in terms of it** so the two cannot
answer differently. Pinned by `Een_afgewezen_plaatsing_wordt_niet_als_duplicaat_gerapporteerd`: a rejected slot lands
in `Afgewezen` and *not* in `Duplicaten`, an accepted slot stays a `Duplicaat`, and both survive the run.

**The lifecycle divergence is now written down** in `KoppelingStatus`'s XML doc as an explicit contrast:

- on a `DoelKoppeling`, `geweigerd` is purely negative — the link "does not count" toward dekking (Art. V.1) and blocks
  nothing else;
- on a `Themaplaatsing`, it **additionally occupies the slot** and suppresses re-proposal.

**Deliberately not fixed:** nothing can *remove* a rejected placement, so the suppression is permanent. A DELETE
endpoint is E3-07's scope and I did not add one. This is a real functional gap a teacher can hit — reject a thema in a
period, change your mind, and the product offers no undo. It is now documented in three places (here,
`JaarplanGeneratieResultaat.Afgewezen`, `KoppelingStatus`) so E3-07 cannot miss it.

### 7. [MINOR] Worklog corrections

The "awaits CI" list now names the **unique `(JaarplanId, ThemaId, BlokNiveau, BlokStart)` index** (`23505`), which it
omitted, and records the two nuances in my favour: `Vergrendeld`'s *logical* round-trip **is** covered in-memory (only
the relational column mapping is skipped), and the duplicate-placement *rule* **is** covered by an executed domain test
(only the DB index is skipped).

### Gates after fix round 1

| Gate | Result |
| --- | --- |
| `dotnet build Jaarplanner.sln` | **Build succeeded**, 0 errors |
| `dotnet test Jaarplanner.sln` | **402 unit passed / 0 failed / 0 skipped** (was 380 — **+22**) · **26 integration passed / 0 failed / 34 skipped** (was 31 — **+3 `[PostgresFact]`**) |
| `dotnet format --verify-no-changes` | **Clean**, exit 0 (after `dotnet format` reflowed some new files) |

**Executed vs skipped, restated for this round.** All 22 new unit tests **executed**: 12 for the real
`AzureAiFoundryClient`, 6 for the `Klas` delete guard, 1 for `Afgewezen` vs `Duplicaten`, plus 3 further
domain/partition assertions. All 3 new integration tests are `[PostgresFact]` and **skipped here** — the raw
`ON DELETE CASCADE` on `klassen`, the functional `lower("Naam")` index on `schooljaren`, and the HTTP 400 for a class
with a reviewed plan. So the *service-level* halves of finding 1 and **all** of finding 2 are verified locally; the
*relational* halves of findings 1 and 5 remain CI-only.

### Still open after this round

1. **No live Azure round-trip** (finding 2's remainder) — waiver-or-run decision for the owner.
2. **No way to remove a rejected placement** (finding 6) — E3-07 scope, now documented in three places.
3. **The relational half remains CI-only** — 34 `[PostgresFact]`s skip on this machine.
4. **Art. II.3 is untouched.** My 422 payload is English by reasoned choice, which diverges from the Dutch
   `ProblemDetails` titles two neighbouring handlers use. Whichever way the open decision lands, one of the two will
   need changing; I did not pre-empt it.
