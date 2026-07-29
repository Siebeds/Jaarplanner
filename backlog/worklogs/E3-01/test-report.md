# E3-01 - Test report (round 1)

**Verdict:** FAIL
**Mode:** unit/integration (no Playwright - E3-01 ships no UI; E3-06 owns the calendar screen, so there is nothing to render and a browser run would prove nothing)
**Worktree:** `C:\source\Jaarplanner\.claude\worktrees\agent-ab70ee414b05090ae` - branch `story/E3-01`, commit `dfb1407`

FAIL on **one** criterion clause: the *real* AI client half of "via the faked + real AI client".
Everything else in the story passes on executed evidence. This is a narrow, cheap fix round, not a rewrite.

## Criteria checked

### 1. "a class yields a reviewable generated plan via the **faked** AI client" -> PASS

`JaarplanEndpointsTests.Een_klas_levert_een_beoordeelbaar_gegenereerd_jaarplan_op` - **executed, passed in
55 ms** (not skipped). It does re-GET rather than inspect the POST response; the round-trip is real:

- `GET /api/klassen/{klasId}/jaarplan` before generation -> `Assert.Empty(leeg.Plaatsingen)` (a class has an
  empty plan, not a 404).
- `POST /api/klassen/{klasId}/jaarplan/generatie` -> 200, `IsGeslaagd`, `AantalNieuw == 1`.
- **A second, independent `GET`** ("Reload through a brand-new GET - proving it was persisted, not just
  returned") then asserts `ThemaNaam`, `Status == "Voorgesteld"`, `AiMotivatie == "seizoen past bij het
  begin van het schooljaar"`, `Vergrendeld == false`, `BlokStart == blokStart`, `IsVervallen == false`,
  `BlokEind != null`, `BlokNiveau == "Themaperiode"`.

So status **and** motivation both come back on the read path - the plan is genuinely reviewable, not
write-only. The whole route runs through the real DI container with only `IAiClient` and the DB provider
swapped, so controller, `JaarplanGeneratieService`, the configured `IPlanningsblokIndeling` and EF are all
production wiring.

Supporting executed evidence - all 7 `JaarplanEndpointsTests` passed:

| Test | ms |
|---|---|
| `Een_klas_levert_een_beoordeelbaar_gegenereerd_jaarplan_op` | 55 |
| `Een_ongeldig_AI_antwoord_geeft_422_en_wijzigt_het_plan_niet` | 31 |
| `Beslissing_en_vergrendeling_overleven_een_herlaad` | 4 s |
| `Voorgesteld_terugzetten_geeft_400` | 40 |
| `Onbekende_klas_geeft_404` | 15 |
| `Een_schooljaar_bevat_zijn_klassen` | 356 |
| `Een_klas_in_een_onbekend_schooljaar_geeft_404` | 12 |

The "goals" half of "thema's + goals" is covered by an executed unit assertion:
`JaarplanGeneratieServiceTests` line 95, `Assert.Equal(["NAT-K3-01"], herfst.Doelcodes)` - goal codes are
derived onto the read view rather than stored.

### 2. "via the faked + **real** AI client" -> **FAIL**

`AzureAiFoundryClient` is referenced in **exactly two places in the entire repository**:

```
backend/src/Jaarplanner.Infrastructure/Ai/AzureAiFoundryClient.cs:20   (its own definition)
backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs:126      services.AddHttpClient<IAiClient, AzureAiFoundryClient>();
```

Zero test references. There is no `HttpMessageHandler` / `DelegatingHandler` stubbing anywhere in either
test project. And the one reachability test that uses the real container **deliberately removes** it:

```csharp
// JaarplanEndpointsTests.Factory.ConfigureWebHost
d.ServiceType == typeof(IAiClient)            // <- removed
services.AddSingleton<IAiClient>(new StubAiClient(() => AiAntwoord));
```

So `AzureAiFoundryClient.CompleteAsync` has never executed - not in this story, and not in E2-01 either.
Everything inside it is unverified: the URI construction
(`{endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...`), the `api-key` header, the
`response_format = { type = "json_object" }` payload, `EnsureSuccessStatusCode()`, the
`choices[0].message.content` extraction, and `EnsureConfigured()`. "Wired" is doing all of the work here.
The implementer's own statement that the real client "was never called - only wired" is accurate.

**Is the criterion therefore unmeetable as written? Only partly - and the meetable part was skipped.**

`AzureAiFoundryClient` is a typed `HttpClient` with the constructor
`AzureAiFoundryClient(HttpClient httpClient, IOptions<AzureAIOptions> options)`. It can be instantiated
directly with `new HttpClient(stubHandler)` plus dummy options - **no live Azure endpoint, no real key, no
network**. A test along these lines would exercise the real client's own code path for this story's flow:

- stub handler returns a canned Azure envelope whose `choices[0].message.content` is a valid jaarplan JSON
  payload (`{"plaatsingen":[{"blokStart":"...","thema":"Herfst","motivatie":"..."}]}`);
- assert the outbound request URI, the `api-key` header and the `json_object` response format;
- feed the extracted content through the real `JaarplanGeneratieResponseParser` ->
  `JaarplanGeneratieService` and assert a reviewable `voorgesteld` plan comes out.

That is the standard technique for this shape of adapter and it needs nothing this environment lacks.
Because the AC's real-client clause is substantially verifiable offline and was not verified at all, this
is a genuine gap, not an environmental impossibility.

**What is legitimately unverifiable here:** the *live* Azure round-trip - that credentials authenticate
against a real resource, that the configured `api-version` is accepted, and that a real deployment returns
content the jaarplan contract can parse. That needs a provisioned Azure AI Foundry endpoint plus a key
(user-secrets / Key Vault), neither of which exists in this worktree. That residue belongs in a
CI/staging smoke check, and should be recorded as such rather than counted as met.

### 3. "persisted as a proposal (not auto-applied)" -> PASS

Single generation call site, hardcoded (`JaarplanGeneratieService.cs:138-142`):
`jaarplan.VoegPlaatsingToe(..., KoppelingStatus.Voorgesteld, ...)`.

`VoegPlaatsingToe` is called exactly once in the generation path and never with any other status, so
nothing can land accepted/applied. Reinforced by:

- `WijzigPlaatsingStatusAsync` (line 191) rejects `Voorgesteld` - only `Aanvaard`/`Geweigerd`/`Manueel` are
  teacher decisions; over HTTP that is a 400 (`Voorgesteld_terugzetten_geeft_400`, executed).
- `Geldig_antwoord_wordt_als_voorgesteld_voorstel_met_motivatie_gepersisteerd` - executed, passed.
- `Ongeldig_antwoord_persisteert_niets_en_geeft_een_diagnose` and
  `Ongeldig_antwoord_laat_een_bestaand_voorstel_ongemoeid` - executed; validation runs before the plan is
  touched, so a malformed completion cannot even clear the previous proposal (422, plan unchanged).
- `Hergeneratie_behoudt_vergrendelde_en_besliste_plaatsingen` - executed; regeneration discards only
  untouched, unlocked proposals.

### 4. "returned as validated JSON" -> PASS

`JaarplanGeneratieResponseParserTests` plus the 422 path both executed. One bad item invalidates the whole
answer; a non-JSON body yields 422 with a diagnostic and an untouched plan
(`Een_ongeldig_AI_antwoord_geeft_422_en_wijzigt_het_plan_niet`, executed).

### 5. Also owns: Schooljaar-Klas containment + `Jaarplan` with per-thema `vergrendeld` -> PASS (in-memory)

- `Een_schooljaar_bevat_zijn_klassen` - executed: creates a schooljaar, creates a klas at
  `POST /api/schooljaren/{id}/klassen`, re-GETs the year and asserts it contains the class. The route
  carries the containment.
- `Beslissing_en_vergrendeling_overleven_een_herlaad` - executed: `Vergrendeld == true` and
  `Status == "Aanvaard"` survive a reload, and a subsequent regeneration leaves the locked placement in
  place.
- `JaarplanTests` (13 tests) - all executed: start-date-as-key, no ordinal property,
  `Alleen_een_onaangeroerd_en_niet_vergrendeld_voorstel_is_vervangbaar`,
  `Vergrendeling_is_standaard_uit_en_omschakelbaar`.

Caveat: all of the above runs on the **EF in-memory provider**. It proves the logical round-trip and the
aggregate's behaviour; it does not prove the relational mapping. See section 6.

### 6. The 31 skipped tests - count and composition confirmed, credited as ZERO evidence

- Skipped-line count -> **31**.
- Filtering those 31 for anything outside the `Jaarplanner.IntegrationTests.Postgres.` namespace returns
  **nothing** - all 31 are in the Postgres namespace, all `[PostgresFact]`, all skipped at 1 ms (no Docker
  in this environment; per project convention CI is the only real run).
- `JaarplanPersistentieTests` contains exactly **7** `[PostgresFact]` tests, all 7 skipped.

Per this project's hard rule, **none of these counts toward the verdict.** The acceptance-relevant
properties that have *only* skipped coverage:

| Property | Only-skipped test | Implementer listed it? |
|---|---|---|
| `BlokStart` maps to `date` | `De_bloksleutel_is_een_datum_en_er_is_geen_ordinaalkolom` | yes |
| No ordinal column exists | same test | yes |
| One-plan-per-class unique index | `Een_klas_heeft_ten_hoogste_een_jaarplan` | yes |
| Owned-collection cascade on plan delete | `Verwijderen_neemt_de_plaatsingen_mee` | yes |
| Schooljaar-to-Klas Restrict FK | `Een_schooljaar_bevat_klassen_en_kan_niet_zomaar_verdwijnen`, `Een_klas_zonder_bestaand_schooljaar_wordt_geweigerd` | yes |
| `Vergrendeld` survives *relational* storage | `Jaarplan_met_plaatsingen_rondtript` | yes (see nuance) |
| **DB-level unique index on (JaarplanId, ThemaId, BlokNiveau, BlokStart)** | `Dezelfde_plaatsing_kan_niet_twee_keer_bestaan` (asserts `PostgresException` SqlState `23505` on a raw INSERT around the aggregate) | **no - the list is incomplete by this one** |

Two nuances, in the implementer's favour:

- `Vergrendeld` surviving storage is **not** wholly unverified - the logical round-trip through the
  DbContext is covered by the executed `Beslissing_en_vergrendeling_overleven_een_herlaad`. What is
  skipped-only is the *relational column* mapping.
- The duplicate-placement *rule* is covered in-memory by the executed domain test
  `Een_thema_kan_niet_twee_keer_in_hetzelfde_blok`. What is skipped-only is the *database-level* index
  (defence-in-depth beneath the aggregate).

Otherwise the implementer's list is accurate. **All of the above awaits CI** and must not be treated as
verified until CI runs it against a real Postgres.

### 7. Regression check on the modified pre-existing files -> PASS, no assertion loosened

Diff of all test-file changes (`git show HEAD -- "backend/tests/*"`, 1541 added lines):

- **Assert lines added: 194. Assert lines removed: 0.** Nothing was deleted or relaxed.
- No `Skip =` or `[Fact(Skip...)]` was introduced - nothing was quietly parked.
- Every modification is the same mechanical adaptation to `Klas` now requiring a `Schooljaar`:
  `new Klas(...)` + `db.Klassen.Add(...)` becomes `TestSchooljaar.Maak()` + `schooljaar.VoegKlasToe(...)` +
  `db.Schooljaren.Add(...)`; and in `KlasEndpointsTests`, `POST /api/klassen` becomes the nested
  `POST /api/schooljaren/{id}/klassen` route via a `KlassenRoute` helper. Status-code assertions
  (`Created`, `BadRequest`) are unchanged throughout.
- `ReferentiedataIntegriteitTests.Klas_naam_is_uniek_in_de_database` was made **stronger**, not weaker: the
  two same-named classes are now deliberately placed in *different* school years, which pins the intent
  that the name index is school-wide rather than per-year.
- `KoppelingStatus.cs` - **doc comment only**. No enum member added, removed or renumbered; the change
  records that the enum is now shared with `Themaplaatsing`. No behavioural change.

## Commands run

- `dotnet test Jaarplanner.sln --logger "console;verbosity=normal"` (run **once**, exit 0) ->
  - Unit: **Total 380, Passed 380, Skipped 0** (7.97 s)
  - Integration: **Total 57, Passed 26, Skipped 31** (8.45 s)
  - Both runs "Test Run Successful."; zero `error` / `warning CS` lines in the build output.
  - Matches the implementer's claimed numbers **exactly**.
- `dotnet format Jaarplanner.sln --verify-no-changes` (run **once**) -> exit **0**, clean (only the benign
  "Warnings were encountered while loading the workspace" notice). Gate green.
- `git show --stat HEAD` -> 49 files, +4984 / -53.
- Reference greps: `AzureAiFoundryClient` (2 hits, both non-test); `HttpMessageHandler|DelegatingHandler`
  in `backend/tests` (0 hits); skipped count (31); skipped outside `Postgres.` (0).

## Evidence

- Test log: scratchpad `testrun.txt` (session 7d5ea4b4-8f96-4eb5-b289-90ac758eb433)
- Format log: same scratchpad, `format.txt`
- Test-diff extract: same scratchpad, `testdiff.txt`
- No screenshots - no UI in this story (E3-06 owns the calendar).

## Defects (back to the implementer)

- **[major] The real AI client's code path is never executed, so the AC clause "via the faked + real AI
  client" is unmet.**
  - *Expected:* the real `AzureAiFoundryClient` participates in at least one executed test of the E3-01
    generation flow.
  - *Actual:* `AzureAiFoundryClient` appears only at its own definition and
    `DependencyInjection.cs:126`. `JaarplanEndpointsTests.Factory` removes the `IAiClient` descriptor and
    substitutes `StubAiClient`, so `CompleteAsync` - URI, `api-key` header, `json_object` request format,
    `EnsureSuccessStatusCode`, `choices[0].message.content` extraction, `EnsureConfigured` - has never run.
  - *Repro:* `rg -n "AzureAiFoundryClient" backend/` -> 2 hits, neither in `backend/tests`.
  - *Fix (no Azure needed):* add a test that constructs the real client over a stub `HttpMessageHandler` -
    `new AzureAiFoundryClient(new HttpClient(stub), Options.Create(new AzureAIOptions{ Endpoint = "https://stub.invalid", ApiKey = "x", Deployment = "d" }))` -
    return a canned Azure envelope whose `content` is a valid jaarplan JSON, and assert (a) the outbound
    request URI / `api-key` header / `response_format`, and (b) that the extracted content flows through
    `JaarplanGeneratieResponseParser` -> `JaarplanGeneratieService` to a reviewable `voorgesteld` plan. Also
    cover the `EnsureConfigured` throw and a non-2xx response.
  - *Residual that cannot be closed in this environment:* the live Azure round-trip (real auth, the
    `api-version` being accepted, a real deployment returning parseable content). Record it explicitly as a
    CI/staging smoke item rather than letting it ride as "met" - or, if the story owner intends the AC's
    "real" to mean only "the real client is registered in production DI", the AC should be reworded, since
    as written it reads as an execution requirement that E2-01's fake-only AC deliberately did not make.

- **[minor] The skipped-only list in the worklog is incomplete by one item.** It omits the DB-level unique
  index on `(JaarplanId, ThemaId, BlokNiveau, BlokStart)`, covered only by the skipped
  `Dezelfde_plaatsing_kan_niet_twee_keer_bestaan`. Add it to the "awaits CI" list so the CI-gap inventory is
  complete.

## Environment gaps (acknowledged, not defects)

- No Docker/Postgres here, so all 31 `[PostgresFact]` tests skip. Credited as zero evidence. The seven
  persistence guarantees in section 6 are unverified until CI.
- No provisioned Azure AI Foundry endpoint or key, so a live AI round-trip cannot be verified in this
  worktree by anyone.
