# E3-01 - Test report (round 2)

**Verdict:** PASS
**Mode:** unit/integration (no Playwright - E3-01 ships no UI, and `git diff dfb1407..93b211c --stat -- frontend/` is empty; E3-06 owns the calendar screen, so a browser run would prove nothing)
**Worktree:** `C:\source\Jaarplanner\.claude\worktrees\agent-ab70ee414b05090ae` - branch `story/E3-01`, commit `93b211c`

Round 1 failed on exactly one clause: the *real* AI client half of *"a class yields a reviewable
generated plan via the faked + real AI client"*. **That clause is now closed for everything reachable
offline, on executed evidence.** One residual - the live Azure round-trip - is explicitly scoped out
below and is the owner's call, not a blocking defect.

Round 1's report is preserved verbatim at the bottom of this file.

## Criteria checked

### The story criterion, clause by clause

| Clause | Verdict | Evidence |
| --- | --- | --- |
| "a class yields a reviewable generated plan" | PASS | `resultaat.Jaarplan` projected by the real `JaarplanGeneratieService.Projecteer`; every placement `Voorgesteld`, unlocked, with a motivation (round 1 evidence, still green) |
| "via the **faked** AI client" | PASS | `JaarplanGeneratieServiceTests` via `FakeAiClient` - unchanged and still green (round 1 evidence) |
| "via the **real** AI client" | **PASS (offline portion), 1 scoped residual** | new `AzureAiFoundryClientTests` - 13 executed cases against the production `AzureAiFoundryClient`; see below |

### 1. The real AI client is the production type, not a look-alike -> PASS

`backend/tests/Jaarplanner.UnitTests/Ai/AzureAiFoundryClientTests.cs` does
`using Jaarplanner.Infrastructure.Ai;` and constructs
`new AzureAiFoundryClient(new HttpClient(handler), Options.Create(Opties()))` in **every** test. There
is no subclass, no shadowing type, no partial re-implementation - I checked: `AzureAiFoundryClient`
exists exactly twice in the repo (`Infrastructure/Ai/AzureAiFoundryClient.cs` and this test file).
The only doubles are a `StubHandler : HttpMessageHandler` (the transport) and `IOptions` values.
`AzureAiFoundryClient.cs` is **not** in `git diff dfb1407..93b211c --stat` - the production client was
not bent to fit the tests; the tests were written to the code as it already stood.

I read the production client and confirmed each assertion actually pins production behaviour:

| Assertion | Production line it pins |
| --- | --- |
| URI `.../openai/deployments/gpt-4o-jaarplan/chat/completions?api-version=2024-10-21` | the deployment-scoped interpolation over `Endpoint.TrimEnd('/')`, `Deployment` and `ApiVersion` - and `AzureAIOptions.ApiVersion` really does default to `"2024-10-21"`, so the literal is not a copy of a test constant |
| `Headers.GetValues("api-key") == [ApiKey]`, `Headers.Authorization is null`, key absent from the URI | `httpRequest.Headers.Add("api-key", _options.ApiKey)` - header, single, not a bearer token, not a query param (Art. VI.4) |
| `response_format.type == "json_object"`, 2 messages with roles `system`/`user` | the anonymous `payload` object |
| verbatim passthrough | `GetProperty("choices")[0].GetProperty("message").GetProperty("content")` returned unparsed |
| `null` content -> `string.Empty`, and the real parser then rejects it | the `?? string.Empty` fallback |
| non-2xx throws `HttpRequestException` (3 statuses: 401 / 429 / 500) | `response.EnsureSuccessStatusCode()` |
| missing/whitespace config throws `InvalidOperationException` naming `AzureAI:Endpoint`, never echoing the key, **and `handler.AantalAanroepen == 0`** | `EnsureConfigured()` called before the URI is even built |

The **throwing** behaviour is right, and the implementer's reasoning holds: `EnsureSuccessStatusCode`
before reading the stream means a 429 cannot become an empty completion, which the parser would reject as
`"Empty AI response content."` and the controller would surface as a 422 *"the model answered badly"* -
blaming the model for a throttled deployment. Failing loud is correct.

### 2. The canned envelope is genuinely Azure-shaped -> PASS

`AzureEnvelop(string content)` serialises
`{ id, choices: [ { index, finish_reason, message: { role: "assistant", content } } ] }`. Because
`content` is a C# `string`, System.Text.Json emits it as a **JSON string** - so
`choices[0].message.content` carries JSON-as-text, which is exactly what Azure OpenAI returns under
`response_format: json_object`, and exactly what forces the double decode the production client + parser
have to do. It is not the shortcut of nesting a JSON *object* there. The `null`-content test uses a
hand-written envelope with `"content":null`, also a real Azure shape.

### 3. The end-to-end test really traverses the real parser and real service -> PASS

`Een_azure_antwoord_levert_via_de_echte_client_een_beoordeelbaar_voorstel` wires
`IAiClient echteClient = new AzureAiFoundryClient(...)` into
`new JaarplanGeneratieService(echteClient, indeling, opslag)` with the real
`GeconfigureerdePlanningsblokIndeling`. The parser is not stubbed - the service calls
`JaarplanGeneratieResponseParser` internally - and the asserted plan
(`ThemaNaam`, `Status == "Voorgesteld"`, `AiMotivatie`, `BlokStart == blok.Start`,
`Vergrendeld == false`) is built by the real service's private `Projecteer`, not by the fake. Only
`FakeJaarplanOpslag` (the persistence port) and the `HttpMessageHandler` (the socket) are doubles - the
correct two seams. It also asserts the grounded prompt travelled over the wire the client built
(`Assert.Contains("Thema: Herfst", handler.LaatsteBody)`).

**Count correction (trivial):** the implementer reports "12 executed tests" in this file; the actual
figure is **13** (5 `[Fact]` + a 3-case `[Theory]` + a 5-case `[Theory]`). It undercounted its own work.
The arithmetic in section 7 confirms 13.

### 4. MAJOR fix - the delete guard actually protects the data -> PASS

`KlasBeheerService.VerwijderKlasAsync` now loads the plan and refuses when
`jaarplan?.MenselijkBeslotenPlaatsingen.Count ?? 0` is greater than 0, with the count in the Dutch message.

**The complement claim is true, and structurally so.** There is exactly one predicate:

- `Themaplaatsing.IsVervangbaar => Status == KoppelingStatus.Voorgesteld && !Vergrendeld` (one definition, `Themaplaatsing.cs:105`)
- `Jaarplan.MenselijkBeslotenPlaatsingen => _plaatsingen.Where(p => !p.IsVervangbaar).ToList()` (`Jaarplan.cs:126`)
- `Jaarplan.VerwijderVervangbarePlaatsingen` (regeneration) -> `_plaatsingen.Where(p => p.IsVervangbaar)` (`Jaarplan.cs:135`)

`grep -rn "IsVervangbaar" backend/src` returns those and doc references only - no second hand-written
"is this a human decision?" test exists anywhere. Divergence is impossible by construction, not by
discipline.

**Bare `Voorgesteld` still cascades freely** - asserted, not assumed (see the table below).

**The guard is not vacuous, and I checked the thing that would have made it vacuous.**
`FirstOrDefaultAsync(j => j.KlasId == klasId)` has no `.Include(...)`, which would normally leave
`_plaatsingen` empty and the count a permanent 0. It is safe because `JaarplanConfiguration` maps the
collection with `builder.OwnsMany<Themaplaatsing>("_plaatsingen", ...)`, and EF Core always loads owned
collection navigations eagerly. Worth stating explicitly: if that mapping is ever changed from
`OwnsMany` to `HasMany`, this guard silently stops guarding.

| Test (`Jaarplanner.UnitTests/Planning/KlasVerwijderenTests.cs`) | Asserts | Status |
| --- | --- | --- |
| `Een_klas_met_een_beoordeelde_of_vergrendelde_plaatsing_kan_niet_verwijderd_worden` (4 `[InlineData]`: `Aanvaard`, `Geweigerd`, `Manueel`, and `Voorgesteld`+**locked**) | throws `SchoolcontentValidatieFout`, message contains the count and "jaarplan", and **both** klas and jaarplan still exist afterwards | **EXECUTED** (in-memory) |
| `Het_gerapporteerde_aantal_is_het_werkelijke_aantal` | 3 blocking + 1 bare proposal -> message says "3", so the count is real, not a hard-coded 1 | **EXECUTED** |
| `Een_klas_met_alleen_onaangeroerde_voorstellen_kan_wel_verwijderd_worden` | 2 bare `Voorgesteld` -> delete proceeds; klas **and** jaarplan gone | **EXECUTED** |
| `Een_klas_zonder_jaarplan_kan_verwijderd_worden` | guard does not fire on a null plan | **EXECUTED** |
| `De_verwijdergrens_is_precies_het_complement_van_de_hergeneratiegrens` | over **every** `KoppelingStatus` x {locked, unlocked}: the two sets do not intersect **and** together they partition the whole collection | **EXECUTED** |
| `Postgres/KlasEndpointsTests.Klas_met_beoordeeld_jaarplan_kan_niet_verwijderd_worden` | the guard through the HTTP endpoint on real Postgres | **`[PostgresFact]` - SKIPPED, credited as zero** |
| `Postgres/JaarplanPersistentieTests.Een_klas_verwijderen_neemt_haar_jaarplan_en_plaatsingen_mee` | the relational `ON DELETE CASCADE` itself | **`[PostgresFact]` - SKIPPED, credited as zero** |

The five executed tests use the **real `AppDbContext`** on the EF in-memory provider, so they prove the
service logic and the guard's arithmetic. What stays CI-only is the *relational* cascade.

### 5. The defect the fix round surfaced - EF model build -> PASS, fix is correct and complete

Adding `MenselijkBeslotenPlaatsingen` made EF read it as a second navigation to `Themaplaatsing`
(`"Unable to determine the relationship represented by navigation"`), a **model-build** failure that
takes the process down at startup, not merely this aggregate. Fixed with
`builder.Ignore(j => j.MenselijkBeslotenPlaatsingen);` next to the pre-existing
`Ignore(j => j.Plaatsingen)`, with a comment naming the consequence.

I audited for the same shape rather than taking the claim:

- `grep -rn "public IReadOnlyList<" backend/src/Jaarplanner.Domain` -> the only *properties* on mapped
  aggregates that project over a backing field are `Jaarplan.Plaatsingen`,
  `Jaarplan.MenselijkBeslotenPlaatsingen`, `Schooljaar.Sluitingen`, `Schooljaar.Vakanties`,
  `Schooljaar.Klassen` - **all five are `builder.Ignore`d** (`JaarplanConfiguration:111-112`,
  `SchooljaarConfiguration:62-64`).
- `Jaarplan.VerwijderVervangbarePlaatsingen()` returns `IReadOnlyList<Themaplaatsing>` but is a
  **method**, which EF never treats as a navigation - no risk.
- The `Schoolcontent` properties (`Thema.Subthemas` etc.) return the backing field directly and *are* the
  mapped navigation - the established pattern, untouched.

This is now regression-proof, and worth noting as a strength: the five executed `KlasVerwijderenTests`
construct the real `AppDbContext`, so **any** future model-build failure of this kind fails a fast unit
test instead of only production startup.

### 6. `Afgewezen` vs `duplicaten` -> PASS

`Jaarplan.IsAlGeplaatst` is now `VindPlaatsingOp(...) is not null`, and `JaarplanGeneratieService` calls
`VindPlaatsingOp` directly and branches on `bestaande.Status == KoppelingStatus.Geweigerd` -> `afgewezen`,
else `duplicaten`. The existence check and the lookup are the same code path, so they cannot disagree.
New `Afgewezen` list on `JaarplanGeneratieResultaat`, defaulting to `LeegTekst` on both `Geslaagd` and
`Mislukt`.

Pinned by `JaarplanGeneratieServiceTests.Een_afgewezen_plaatsing_wordt_niet_als_duplicaat_gerapporteerd`
- **EXECUTED**. It is a real discriminating test, not a tautology: it seeds one `Geweigerd` and one
`Aanvaard` placement, re-proposes **both**, and asserts the rejected one is `Assert.Single(Afgewezen)`
**and** `DoesNotContain` in `Duplicaten`, while the accepted one is still `Assert.Single(Duplicaten)`.
It also asserts `AantalBehouden == 2` and that the rejection was not silently revived.

### 7. No regression, and no assertion loosened or removed -> PASS

`git diff dfb1407..93b211c -- backend/tests/ | grep -c "^-[^-]"` -> **0**. Not one line was removed from
any test file in the fix round; the round-1 zero-removed baseline holds. Every change is additive.

Counts reconcile exactly, which independently proves the new tests executed:

| | round 1 (`dfb1407`) | round 2 (`93b211c`) | delta |
| --- | --- | --- | --- |
| Unit passed | 380 | **402** | +22 |
| Unit skipped | 0 | **0** | - |
| Integration passed | 26 | **26** | - |
| Integration skipped | 31 | **34** | +3 |

Static case count of the new/changed tests: 13 (`AzureAiFoundryClientTests`) + 8 (`KlasVerwijderenTests`)
+ 1 (`Een_afgewezen_plaatsing_...`) = **22**, matching the +22 exactly against **Skipped: 0**. So all 13
AI-client cases and all 8 delete-guard cases genuinely ran and passed - none was silently skipped.
The +3 integration skips are precisely the three new `[PostgresFact]`s.

### 8. The 422 payload is English throughout -> PASS, and the reasoning holds

`Title` changed from `"Ongeldig AI-antwoord"` to `"Invalid AI response"`. Every `Detail` value it can
carry is English (`JaarplanGeneratieResponseParser`: `"Empty AI response content."`,
`"Malformed JSON: {ex.Message}"`, `"Placement at index {i} has a missing/blank 'thema'."`, ...). So the
payload is now **self-consistent** rather than half-Dutch/half-English, and the argument is sound:
translating `"Malformed JSON: ..."` would mean inventing new hard-coded Dutch in the backend, which is the
open Art. II.3 problem, not a fix for it.

Two supporting facts I verified rather than assumed:

- `grep -rn "ProblemDetails|.title|detail" frontend/src` -> **zero hits**. Nothing in the frontend reads
  `title` or `detail` today, so no English string can reach a teacher's screen through this path.
- The teacher-facing 400s stay Dutch. The fix round also *shortened* `OngeldigePlaatsingsstatusFout`'s
  message by dropping the `"(Art. IV.1/IV.2)"` citation - correct, since that body does reach a teacher;
  no test asserted the citation, so nothing was loosened to allow it.

Minor, non-blocking: the new `Title` is not asserted anywhere.
`JaarplanEndpointsTests.Een_ongeldig_AI_antwoord_geeft_422_en_wijzigt_het_plan_niet` checks
`HttpStatusCode.UnprocessableEntity` and the plan's immutability, but not the payload's language - so a
future revert to Dutch would go unnoticed. Not worth failing a story over; worth a line in the worklog.

## Residual - explicitly scoped, owner's decision, NOT a blocking defect

**The live Azure AI Foundry round-trip.** What no offline test can establish: that a real key
authenticates, that the deployment name resolves, that `api-version=2024-10-21` is accepted by the live
service, that a real model honours `response_format: json_object`, and that an EU-data-zone deployment is
what answers (Art. VI.3). This is unreachable in this environment - no provisioned endpoint, no key - and
unreachable by *any* amount of code.

It closes one of two ways, and the owner picks:

1. **One manual run** against a provisioned Foundry deployment, output pasted into the worklog; or
2. **A written waiver** deferring it to first deployment.

Everything on this side of the socket is now covered by executed tests.

## Also CI-only this round (never credited as evidence)

`dotnet test` here reports **34 skipped**, all `[PostgresFact]`, all in
`Jaarplanner.IntegrationTests.Postgres.*`, all skipped because there is no Docker/Postgres in this
environment. The three added this round:

| Skipped test | Property that therefore has no executed evidence |
| --- | --- |
| `JaarplanPersistentieTests.Een_klas_verwijderen_neemt_haar_jaarplan_en_plaatsingen_mee` | the relational `ON DELETE CASCADE` from `klassen` to `jaarplannen` to `themaplaatsingen` |
| `KlasEndpointsTests.Klas_met_beoordeeld_jaarplan_kan_niet_verwijderd_worden` | the delete guard end-to-end through HTTP on real Postgres (the 400 body) |
| `SchooljaarPersistentieTests.Schooljaarnaam_is_ook_case_insensitief_uniek` | the functional unique index on `lower("Naam")` for `schooljaren` |

Plus the 31 from round 1, unchanged. The new migration
`20260729075450_SchooljaarNaamCaseInsensitiefUniek` emits raw
`CREATE UNIQUE INDEX "IX_schooljaren_Naam_lower" ON schooljaren (lower("Naam"))`. I read it: it mirrors
the `Klas` fix, and because hand-written SQL is invisible to the model snapshot it introduces no
model/migration drift (the snapshot is correctly unchanged). Whether it **applies** cleanly - including
against any existing rows differing only in case - is CI-only.

## Commands run

- `git diff dfb1407..93b211c --stat` -> 18 files, +2022/-23; no `frontend/` and no `AzureAiFoundryClient.cs`
- `git diff dfb1407..93b211c -- backend/tests/ | grep -c "^-[^-]"` -> **0** removed test lines
- `grep -rn "IsVervangbaar" backend/src` -> single definition; complement + regeneration uses only
- `grep -rn "public IReadOnlyList<" backend/src/Jaarplanner.Domain` plus `grep -rn "Ignore(" .../Configurations` -> all five projected properties ignored
- `dotnet test Jaarplanner.sln` (**run once**) -> exit 0.
  `Passed! - Failed: 0, Passed: 402, Skipped: 0, Total: 402` (Jaarplanner.UnitTests, 6 s);
  `Passed! - Failed: 0, Passed: 26, Skipped: 34, Total: 60` (Jaarplanner.IntegrationTests, 5 s)
- `dotnet format Jaarplanner.sln --verify-no-changes --no-restore` (**run once**, backgrounded because of
  the known foreground stall) -> **exit 0**, clean

## Evidence / notes

- No screenshots: nothing renders. `git diff dfb1407..93b211c --stat -- frontend/` is empty and
  `frontend/src` contains no reference to `duplicaten`/`afgewezen`, so the new `Afgewezen` field has no UI
  consumer yet and no `nl.json` key is due until E3-06 surfaces the generation result.
- **Pre-existing, out of scope, but flagged:** the build emits
  `warning NU1903: Package 'Microsoft.OpenApi' 2.0.0 has a known high severity vulnerability`
  (GHSA-v5pm-xwqc-g5wc) for `Jaarplanner.Api` and `Jaarplanner.IntegrationTests`. Not introduced by this
  round - no `.csproj` is in the diff - and unrelated to E3-01, but it is a high-severity advisory sitting
  in the build log and deserves its own story.

## Defects

None blocking. Two non-blocking observations, both already stated above:

- **[minor]** The 422 `Title` (`"Invalid AI response"`) is not asserted by any test, so a silent revert to
  Dutch would not be caught.
- **[info]** The delete guard depends on `_plaatsingen` being an `OwnsMany` owned collection (eagerly
  loaded without an `Include`). Changing that mapping to `HasMany` would silently make the guard vacuous;
  worth a comment at the query site.

---
---

# SUPERSEDED - round 1 (FAIL on commit `dfb1407`), preserved verbatim

The verdict below is **historical**. It was answered by the fix round `93b211c` and is superseded by the
round-2 report above; it is kept as the record of the original defect.

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
