# E2-07 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (backend-only; no Playwright per story scope)

## Criteria checked (Done when: the wizard can request themadoel/subdoel suggestions; all advisory)

- "Step 2 (themadoelen) suggestions can be requested and return candidate leerplandoelen with motivation"
  → PASS — `Stap2_geeft_advieskandidaten_verrijkt_en_adviserend_terug` passes. It POST-equivalent calls
  `StelThemadoelenVoorAsync`, gets back a single advies with `Code=WAT-K3-01`, `Motivatie="kern van het thema water"`,
  enriched from the read-only leerplandoel (`Tekst`, `Doelsoort=MD`, `JaarFase=K3`), and asserts the step-2 system
  prompt (`SystemPromptThemadoelen`) was used.

- "Step 6 (subdoelen) suggestions can be requested and return candidate leerplandoelen with motivation"
  → PASS — `Stap6_gebruikt_de_subdoel_prompt_en_grondt_op_de_subthema_context` passes. `StelSubdoelenVoorAsync`
  returns advies `WAT-K3-02` (`Doelsoort=G`), uses `SystemPromptSubdoelen`, and the user prompt contains the
  subthema grounding ("leeftijd 3K", "Hoe stroomt water?"). Controller `ThemaOpbouwController` exposes both as
  `POST /api/thema-opbouw/themadoel-suggesties` and `POST /api/thema-opbouw/subdoel-suggesties`.

- "All advisory — nothing auto-creates a Themadoel/Subdoel and nothing is persisted"
  → PASS — `ThemaOpbouwAssistService.VoerAssistUitAsync` returns a transient `ThemaOpbouwAdviesResultaat`
  (in-memory record); no DbContext, no SaveChanges, no repository write anywhere in the AiAuthoring path.
  Controller is thin: binds → delegates → `Ok(result)`. E2-07 adds NO migration (the `20260713194326_ThemaDoelsuggesties`
  migration in the tree predates this commit — not in the isolated E2-07 diff).

- "Malformed AI output returns nothing + a failure (Art. IV.5)"
  → PASS — `Malformed_json_geeft_niets_terug_maar_een_fout_stap2` (input `dit is geen JSON {kapot`) and
  `Malformed_json_geeft_niets_terug_maar_een_fout_stap6` (input `{"onzin": true}`) both assert
  `IsGeslaagd == false`, `Fout != null`, `Suggesties` empty. Service returns `ThemaOpbouwAdviesResultaat.Mislukt(...)`
  on `!parse.IsGeldig`, reusing the unchanged E2-03 `DoelMatchResponseParser`.

- "Grounded (Art. IV.4) — hallucinated codes skipped, not fabricated"
  → PASS — `Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen` passes: model returns `WAT-K3-01` (valid) +
  `VERZONNEN-99` (not in loaded set); result keeps only `WAT-K3-01` and reports `VERZONNEN-99` under
  `OvergeslagenOnbekend`. Service resolves each code against the loaded set (`perCode.TryGetValue`) and never invents.
  `ThemaOpbouwPromptBuilder` system prompt forbids external sources: "Gebruik geen externe kennis, geen internet en
  geen andere bronnen" and grounds only on "de schoolcontext en de opgegeven Op.stap-leerplandoelen".
  Also `Stap6_sluit_reeds_gekozen_themadoelen_uit` confirms already-chosen themadoelen are excluded from subdoel runs.

- "No network / no database in tests (Art. IV.6)"
  → PASS — tests use `FakeAiClient` (canned completion, "no HttpClient, no sockets, no external call") and
  `FakeLeerdoelCatalogus` (in-memory, no DB I/O). `Stap2` test asserts `fake.AantalAanroepen == 1` (one model call)
  and `catalogus.LaatsteSelectie != null` (candidates loaded via port). Production `EfLeerdoelCatalogus` reads
  `AsNoTracking` — read-only over reference data (Art. III.1).

## Commands run
- `cd backend && dotnet build` → Build succeeded, 0 Errors (4 NU1903 warnings, pre-existing Microsoft.OpenApi advisory, unrelated to E2-07).
- `dotnet test tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj --no-build` → Passed! Failed: 0, Passed: 287, Skipped: 0, Total: 287.
- `dotnet test ... --filter "FullyQualifiedName~AiAuthoring"` → 14 tests, all Passed (5 PromptBuilder + 9 AssistService).
- `git diff --stat cac9155 c292990` → 16 files, +1287, insertions only. No frontend, no nl.json, no MatchingPromptBuilder.cs, no DoelMatchingService.cs, no DoelMatchResponseParser.cs changes. DI edit is additive (2 registrations).

## Evidence — 14 new AiAuthoring tests (all PASS)
ThemaOpbouwAssistServiceTests (9):
- Stap2_geeft_advieskandidaten_verrijkt_en_adviserend_terug
- Stap6_gebruikt_de_subdoel_prompt_en_grondt_op_de_subthema_context
- Stap6_sluit_reeds_gekozen_themadoelen_uit
- Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen
- Malformed_json_geeft_niets_terug_maar_een_fout_stap2
- Malformed_json_geeft_niets_terug_maar_een_fout_stap6
- Een_lege_geldige_lijst_slaagt_zonder_suggesties
- Selectie_wordt_doorgegeven_aan_de_catalogus
- Service_verwerpt_null_afhankelijkheden

ThemaOpbouwPromptBuilderTests (5):
- Stap2_bouwt_de_verwachte_grounded_themadoel_prompt
- Stap6_bouwt_de_verwachte_grounded_subdoel_prompt
- Systeemprompts_vragen_exact_het_parser_contract_en_verbieden_externe_bronnen
- Is_deterministisch_ongeacht_leerdoelvolgorde
- Verwerpt_null_argumenten

## Reuse-only scope confirmed
E2-03 `DoelMatchResponseParser` + `DoelMatchSuggestie` reused unchanged (not in E2-07 diff); the authoring
response is the same `{code, motivatie}` shape. No product code outside the new AiAuthoring/controller/DI seam
was touched.

## Defects
None.
