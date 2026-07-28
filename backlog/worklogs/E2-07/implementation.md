# E2-07 — Goal-first authoring assist (thema-opbouw wizard hooks)

## Build round 1 — backend AI-assist seam for wizard step 2 (themadoelen) + step 6 (subdoelen)

### FR / Article
- **Art. IV.8** (committed MVP goal-first authoring: step 2 = themadoelen, step 6 = subdoelen; AI is advisory assist that never skips ahead of the teacher).
- **Art. IV.1/IV.2** (advisory only; nothing auto-applied; a decision's status is persisted only by the human).
- **Art. IV.4** (grounded only on the school's own data + loaded Op.stap goals; no external sources).
- **Art. IV.5** (structured JSON, validated before use; malformed output is routine and returns nothing).
- **Art. IV.6** (AI client injected behind an interface; fakeable with no network).
- **Art. III.1/III.5** (Op.stap reference data read-only; fabricated codes skipped, never invented).
- **Gap A.7** (goal-first authoring wizard; AI plugs into themadoel-/subdoelselectie).

### Base note
The isolated worktree was branched at the **E0-only** merge (`1c439fa`); it did **not** contain
`Application/Ai/IAiClient.cs` or `AiMatching/Response/DoelMatchResponseParser.cs`. Per the story's
instruction I rebranched: `story/E2-07` is created **from `feature/e1-curriculum-content`** (which
carries E1 + E2-01..04 and the E2-05/E2-07 claim commit). Base now contains the required seam files.

### Design decision — advisory, transient (not persisted)
The assist **returns advisory suggestions the wizard acts on; it persists nothing** (the story's
preferred option). Rationale:
- Goal-first authoring runs **while the thema/subthema is still being built** (often unsaved), so the
  wizard passes its in-progress context transiently — there is no aggregate to attach links to yet.
- Persisting subdoel-level match output is explicitly **deferred to fast-follow (E8)** by Art. IX.1
  ("activiteit- and subdoel-level matching is deferred"); returning transient advice keeps this story
  compliant and avoids pre-empting that decision.
- It avoids collision with E2-04/E2-05, which own thema-level `DoelKoppeling` persistence + the
  accept/reject status endpoint. On teacher accept, the wizard persists via the existing E1/E6 beheer
  endpoints (e.g. `POST /api/themas/{id}/themadoelen`), which already record `manueel`/`voorgesteld`.

### Files changed (all NEW unless flagged)
**Application (`Jaarplanner.Application/AiAuthoring/`)**
- `ILeerdoelCatalogus.cs` — read-only query seam over loaded Op.stap leerplandoelen (grounding + resolvable set); keeps the service DB-free/fakeable.
- `LeerdoelSelectie.cs` — optional discipline/jaar-fase filter to bound + ground the candidate set.
- `ThemaOpbouwContext.cs` — transient step-2 thema context (naam, invalshoeken, duur, woordenschat, reeds-gekozen themadoelcodes).
- `SubthemaOpbouwContext.cs` — transient step-6 subthema context (naam, **required leeftijd**, probleemstelling/onderzoeksvraag, activiteiten) + `ActiviteitOpbouwContext`.
- `ThemaOpbouwPromptBuilder.cs` — **my own** grounded, deterministic prompt builder (separate from `MatchingPromptBuilder`); two system prompts + `BouwThemadoelRequest` / `BouwSubdoelRequest`. Asks the exact `{suggesties:[{code,motivatie}]}` contract so the E2-03 parser can be reused.
- `ThemaOpbouwAdvies.cs` — one advisory suggestion, enriched from the read-only leerplandoel (code, motivatie, tekst, doelsoort, jaarfase) for wizard display.
- `ThemaOpbouwAdviesResultaat.cs` — result envelope (isGeslaagd / fout / suggesties / overgeslagenOnbekend); result-type, not exceptions.
- `IThemaOpbouwAssistService.cs` — the two wizard hooks + request records `ThemadoelSuggestieVerzoek` / `SubdoelSuggestieVerzoek`.
- `ThemaOpbouwAssistService.cs` — orchestration: load candidates → build prompt → `IAiClient` → **reuse `DoelMatchResponseParser`** → resolve/enrich against loaded set (skip fabricated → `onbekend`; skip already-chosen themadoelcodes; dedup) → advisory result. Persists nothing.

**Infrastructure (`Jaarplanner.Infrastructure/AiAuthoring/`)**
- `EfLeerdoelCatalogus.cs` — EF Core `AsNoTracking` read of `Leerplandoelen` with the optional filter, ordered by code. No mutation (Art. III.1).

**API (`Jaarplanner.Api/Controllers/`)**
- `ThemaOpbouwController.cs` — thin controller, route `api/thema-opbouw`, `POST themadoel-suggesties` (step 2) + `POST subdoel-suggesties` (step 6). Returns 200 + the result envelope (malformed AI is `isGeslaagd=false` in-body, mirroring the matching flow's result-type philosophy).

**SHARED FILE — flagged (additive only)**
- `Jaarplanner.Infrastructure/DependencyInjection.cs` — added 3 lines: two `using`s + registration of
  `ILeerdoelCatalogus → EfLeerdoelCatalogus` and `IThemaOpbouwAssistService → ThemaOpbouwAssistService`.
  E2-05 may also touch this file; the additions are self-contained and near the E2-04 block —
  **orchestrator resolves at merge**. No key/config changes (reuses the E2-01 `AzureAI` config).

### Reuse of E2-03 parser
The authoring response has the **same `{code, motivatie}` shape** as matching, so
`ThemaOpbouwAssistService` **reuses `DoelMatchResponseParser` + `DoelMatchSuggestie` unchanged** — no
new parser, and `MatchingPromptBuilder.cs` / `DoelMatchingService.cs` / `DoelMatchResponseParser.cs`
were **not modified** (treated as read-only reference).

### Tests added (all against fakes — no network, no database)
`tests/Jaarplanner.UnitTests/AiAuthoring/`
- `FakeLeerdoelCatalogus.cs` — in-memory catalogus (records last selection, applies the filter).
- `ThemaOpbouwPromptBuilderTests.cs` (5): step-2 snapshot, step-6 snapshot (incl. subthema block +
  reeds-gekozen line), determinism vs leerdoel ordering, both system prompts carry the exact parser
  contract + forbid external sources, null-argument rejection.
- `ThemaOpbouwAssistServiceTests.cs` (9): step 2 returns enriched advisory candidate + right prompt +
  fake called once; step 6 uses the subdoel prompt grounded on the subthema (leeftijd/onderzoeksvraag);
  step 6 excludes already-chosen themadoelen; fabricated code skipped → `onbekend`; **malformed JSON
  returns nothing + fout (step 2 and step 6)**; empty valid list succeeds with no suggestions;
  selectie passed through to the catalogus; null-dependency rejection.
- Reuses the existing `Jaarplanner.UnitTests.Ai.FakeAiClient`.

### Gates
- `dotnet build` ✓ (0 errors; only pre-existing NU1903 OpenApi warnings).
- `dotnet test` (UnitTests) ✓ — **287 passed, 0 failed** (14 new).
- `dotnet format --verify-no-changes` ✓ (exit 0).
- (No frontend gates — backend-only story; did not touch `frontend/`, `nl.json`, or the api client.)

### Branch
`story/E2-07` (from `feature/e1-curriculum-content`).

### Self-check vs acceptance criteria ("the wizard can request themadoel/subdoel suggestions; all advisory")
- **Request themadoel suggestions (step 2):** `POST /api/thema-opbouw/themadoel-suggesties` →
  `StelThemadoelenVoorAsync`. Evidence: `Stap2_geeft_advieskandidaten_verrijkt_en_adviserend_terug`,
  `Stap2_bouwt_de_verwachte_grounded_themadoel_prompt`.
- **Request subdoel suggestions (step 6):** `POST /api/thema-opbouw/subdoel-suggesties` →
  `StelSubdoelenVoorAsync`. Evidence: `Stap6_gebruikt_de_subdoel_prompt_en_grondt_op_de_subthema_context`.
- **All advisory:** nothing persisted; suggestions are transient `ThemaOpbouwAdvies` with a motivatie;
  never auto-creates a Themadoel/Subdoel (Art. IV.1/IV.2). Malformed AI yields nothing (Art. IV.5) —
  `Malformed_json_geeft_niets_terug_maar_een_fout_stap2/stap6`.
- **Grounded (Art. IV.4):** prompt built only from the transient context + loaded goals; system prompts
  forbid external sources — `Systeemprompts_vragen_exact_het_parser_contract_en_verbieden_externe_bronnen`.
- **No fabrication (Art. III.5):** `Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen`.

### For the test-runner
**Unit only** — no Playwright (no UI in this story). Prove with:
```
cd backend && dotnet test tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~AiAuthoring"
```
Optional manual API check (needs a running API + a seeded Op.stap leerplandoel, e.g. discipline "9"):
`POST /api/thema-opbouw/themadoel-suggesties` with body
`{ "thema": { "naam": "Water", "kernwoordenschat": ["nat","droog"] }, "selectie": { "disciplines": ["9"] } }`
→ 200 with `{ isGeslaagd, suggesties: [{ code, motivatie, tekst, doelsoort, jaarFase }], overgeslagenOnbekend }`.
`POST /api/thema-opbouw/subdoel-suggesties` with an added
`"subthema": { "naam": "...", "leeftijd": "3K" }`.
(With the real `AzureAiFoundryClient` the JSON shape depends on the model; the FakeAiClient path is the
deterministic contract proof.)

### Open questions / Art. XIV touched
- None hard-assumed. The candidate leerdoel set is **data-driven** via `LeerdoelSelectie`
  (disciplines / jaarfasen), so the "which disciplines first" open decision stays a caller/config
  concern, not compiled in.
- Merge note: the single shared edit is the additive DI registration in
  `Infrastructure/DependencyInjection.cs` (flagged above) — potential overlap with E2-05.
