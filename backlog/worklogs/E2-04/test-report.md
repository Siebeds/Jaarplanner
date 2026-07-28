# E2-04 — Test report (round 1)

**Verdict:** FAIL
**Mode:** unit/integration (EF in-memory round-trip). No Playwright — backend-only story, no HTTP route added.

Overall: everything the implementer *built* is correct and green (build clean, 285/285 tests pass). The FAIL is a single, precise gap-vs-criterion: the Done-when says "queryable per thema/**activiteit**", but the AI matching flow persists and queries suggestions at **thema level only**. This is a scope/criterion decision for the orchestrator, not a coding defect (see Defects).

## Criteria checked
- "suggestions are stored ... as `voorgesteld` with `aiMotivatie`" → PASS — `DoelMatchingServiceTests.Geldige_suggesties_worden_als_voorgesteld_met_motivatie_gepersisteerd` asserts 2 persisted `DoelKoppeling` with `KoppelingStatus.Voorgesteld` and the exact motivation; `Thema.VoegDoelsuggestieToe` throws unless status == Voorgesteld (Thema.cs:161-172). EF round-trip `DoelMatchOpslagTests.Suggesties_persisteren_als_voorgesteld_en_zijn_queryeerbaar_per_thema` confirms round-trip status "Voorgesteld" + motivatie.
- "malformed AI output persists nothing" (Art. IV.5) → PASS — `Malformed_json_persisteert_niets_en_geeft_een_fout`: result `IsGeslaagd == false`, `Doelsuggesties` empty, `BewaarAsync` never called (opslag.AantalKeerBewaard == 0). Guard is `DoelMatchingService.cs:65-68` (early return before persistence).
- "no auto-accept" (Art. IV.2) → PASS — flow only ever writes `Voorgesteld`; domain guard rejects any other status on the suggestion path; test asserts `Assert.All(thema.Doelsuggesties, k => Voorgesteld)` and that no curated `Themadoelen` are created. No path sets aanvaard/geweigerd/manueel.
- "queryable per thema" → PASS — `HaalSuggestiesVoorThemaAsync` (service → `IDoelMatchOpslag`); `Gepersisteerde_suggesties_zijn_queryeerbaar_per_thema` and the EF `DoelMatchOpslagTests` (fresh context, per-thema read view).
- "queryable per **activiteit**" → **FAIL** — no path exists. The E2-04 pipeline is whole-thema: `DoelMatchingService` exposes only `MatchThemaAsync` / `HaalSuggestiesVoorThemaAsync`; suggestions land in `Thema.Doelsuggesties` (table `thema_doelsuggesties`). `Activiteit.Doelkoppelingen` exists (from E1-10) but the AI matching flow never writes or queries it. Root cause: the E2-03 response contract is a flat `{code, motivatie}` list with no per-element target, so the model output cannot address an activiteit.
- "no network in the unit flow" (Art. IV.6) → PASS — end-to-end `DoelMatchingServiceTests` run against `FakeAiClient` (canned string, `AantalAanroepen` counter) + `FakeDoelMatchOpslag` (in-memory, no HttpClient/DbContext).
- "unknown codes skipped, never fabricated" (Art. III.5) → PASS — `Een_code_buiten_de_geladen_set_wordt_overgeslagen_niet_verzonnen`: `VERZONNEN-99` → `OvergeslagenOnbekend`, only the real code persisted. Belt-and-braces: migration FK `thema_doelsuggesties.leerplandoel_code` → `leerplandoelen(Code)` with `Restrict`.

## Commands run
- `dotnet build` (worktree/backend) → Build succeeded, 0 errors (pre-existing NU1903 OpenApi warning only).
- `dotnet test tests/Jaarplanner.UnitTests` → Passed 273 / Failed 0.
- `dotnet test tests/Jaarplanner.IntegrationTests` → Passed 12 / Failed 0 (ran without Docker; `docker` not on PATH in this env — the integration suite completed green regardless).
- Total 285 passed, matching the implementer's claim.

## Evidence
- Named proving tests: `DoelMatchingServiceTests` (8 tests, end-to-end vs fakes) and `DoelMatchOpslagTests` (2 tests, real EF mapping in-memory).
- `DoelMatchingService.cs:48-114` (flow + query path); `Thema.cs:161-189` (VoegDoelsuggestieToe status guard + IsAlGekoppeldAan idempotency); `ThemaConfiguration.cs:52-59` (OwnsMany → thema_doelsuggesties); migration `20260713194326_ThemaDoelsuggesties.cs` (cascade from thema, restrict FK to leerplandoelen).

## Defects (routed to the orchestrator, not a code fix for the implementer)
- [medium] Acceptance criterion "queryable per thema/**activiteit**" is only half met: activiteit-level AI-suggestion persistence/query is absent. This cannot be fixed inside E2-04 without changing the *already-merged* E2-03 response contract to carry a per-suggestion target (thema vs subthema vs activiteit) — the current flat `{code, motivatie}` list has no target. The implementer flagged this as an open decision (implementation.md:62). Recommendation: either (a) narrow E2-04's criterion to "per thema" and open a follow-up story for activiteit/subdoel-level matching (contract change gated on E2-03), or (b) explicitly widen scope now. Verifier's call: as written, the criterion is not fully satisfied → FAIL.
