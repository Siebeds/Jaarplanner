# E2-04 — Suggestion persistence as `DoelKoppeling` (status + motivatie)

## Build round 1 — end-to-end matching flow + thema-level suggestion persistence

- **FR / Article:** FR-4.1/4.2 · Art. IV.1 (AI proposes, human decides), Art. IV.2 (persist `voorgesteld` + aiMotivatie, never auto-apply), Art. IV.4/IV.5 (grounded + validated), Art. IV.6 (fakeable, no network), Art. IX.2 (`DoelKoppeling` = any link School-content↔Leerplandoel), Art. III.5 (never fabricate a code).
- **Base:** the worktree branch was off E0. Verified `MatchingPromptBuilder.cs` / `Response/DoelMatchResponseParser.cs` were absent, so branched `story/E2-04` from `feature/e1-curriculum-content` (which carries E1 + E2-01/02/03 merged). Said so here as instructed.

### Alignment fix (required)
- `MatchingPromptBuilder.SystemPrompt` previously asked for structured JSON loosely ("per voorstel: leerplandoelcode + motivatie"). Tightened it to instruct the **exact** shape the E2-03 parser accepts: the envelope `{"suggesties": [{"code": "<leerplandoelcode>", "motivatie": "<één zin>"}]}`, load-bearing field names `suggesties`/`code`/`motivatie`, and an explicit empty-list case `{"suggesties": []}`. The parser stays the canonical contract; the prompt now matches it.
- The E2-02 snapshot test (`Bouwt_de_verwachte_grounded_prompt`) references the system prompt **via the `SystemPrompt` constant**, so it followed automatically and stays green. Added `Systeemprompt_vraagt_exact_het_parser_contract` to pin the new instruction shape explicitly.

### End-to-end flow (`DoelMatchingService`)
`MatchThemaAsync(themaId, leerdoelen, minimumdoelen?)`:
1. loads the thema (tracked, with themadoelen + existing suggestions) via the persistence port;
2. builds the grounded prompt (E2-02);
3. calls `IAiClient` (E2-01);
4. parses+validates (E2-03) — **on invalid output persists nothing** and returns `DoelMatchResultaat.Mislukt`;
5. for each validated suggestion: resolves the code against the loaded leerplandoel set (a code not in the set is **skipped**, never fabricated — Art. III.5), skips a code already linked (idempotent), else persists a `DoelKoppeling(code, Voorgesteld, motivatie)` as a thema-level suggestion;
6. commits once (only when something was added) and returns what was persisted/skipped.

The old thin `VraagSuggestiesAsync` pass-through (E2-01 placeholder) was replaced by this real flow; no source referenced it.

### Persistence + queryability
- **Key design decision (open-decision seam).** The E2-02 prompt is whole-thema and the E2-03 response is a flat `{code, motivatie}` list with no per-element target. `DoelKoppeling` only attaches to `Themadoel` (hard cap 2–3), `Subdoel` (needs a subthema) or `Activiteit`. None cleanly stores an arbitrary count of thema-level AI candidates. So I added a **thema-scoped `Thema.Doelsuggesties`** collection of `DoelKoppeling` (always `voorgesteld`), **separate from the curated 2–3 `Themadoelen`**. Rationale: reuses the single `DoelKoppeling` entity (Art. IX.2 — "any link School-content↔Leerplandoel"; a Thema is school-content); respects the themadoel cap (E2-05 promotes an accepted candidate to a themadoel at curation time, where the bound applies); aligns with Art. IV.8 (AI proposes candidates, teacher curates). This keeps AI candidates and school-authored anchors cleanly distinct.
- Query path: `DoelMatchingService.HaalSuggestiesVoorThemaAsync(themaId)` → `IDoelMatchOpslag` → read views per thema. Activiteit-level links were already queryable (E1-10); this story's suggestions are thema-level, satisfying "queryable per thema".

### Migration (needed — justified)
A new owned collection is a genuine schema change, so one migration was required: `20260713194326_ThemaDoelsuggesties` creates table `thema_doelsuggesties` (Id, ThemaId, leerplandoel_code, status, ai_motivatie) with **cascade** delete from `themas` (suggestions die with their thema) and **restrict** FK to `leerplandoelen` (read-only curriculum is never deleted — Art. III.1), plus the code index. Snapshot regenerated.

- **Files changed:**
  - `Jaarplanner.Domain/Schoolcontent/Thema.cs` — new `Doelsuggesties` collection + `VoegDoelsuggestieToe` (enforces `voorgesteld`), `IsAlGekoppeldAan`, `VerwijderDoelsuggestie`.
  - `Jaarplanner.Application/AiMatching/DoelMatchingService.cs` — **[shared E2-02 file]** replaced the pass-through with the end-to-end flow; ctor now takes `IAiClient` + `IDoelMatchOpslag`.
  - `Jaarplanner.Application/AiMatching/MatchingPromptBuilder.cs` — **[shared E2-02 file]** system-prompt alignment to the parser contract.
  - `Jaarplanner.Application/AiMatching/IDoelMatchOpslag.cs`, `DoelMatchResultaat.cs`, `DoelMatchSuggestieWeergave.cs`, `ThemaNietGevondenFout.cs` — new port, result, read view, exception.
  - `Jaarplanner.Infrastructure/AiMatching/EfDoelMatchOpslag.cs` — EF Core implementation of the port.
  - `Jaarplanner.Infrastructure/Persistence/Configurations/ThemaConfiguration.cs` — `OwnsMany` `Doelsuggesties` → table `thema_doelsuggesties`.
  - `Jaarplanner.Infrastructure/DependencyInjection.cs` — **[shared DI file]** registered `IDoelMatchOpslag` → `EfDoelMatchOpslag`.
  - `Jaarplanner.Infrastructure/Persistence/Migrations/20260713194326_ThemaDoelsuggesties*.cs` + `AppDbContextModelSnapshot.cs` — **[new migration]**.
  - Tests: `DoelMatchingServiceTests.cs` (rewritten for the E2-04 flow), `FakeDoelMatchOpslag.cs` (new), `DoelMatchOpslagTests.cs` (new EF round-trip), `MatchingPromptBuilderTests.cs` (+contract assertion), `SchoolContentModelConfigurationTests.cs` (+owned-mapping assertion).

- **Tests added / what they pin:**
  - `Geldige_suggesties_worden_als_voorgesteld_met_motivatie_gepersisteerd` — canned valid `suggesties` JSON (fake, no network) ⇒ two `DoelKoppeling` persisted as `Voorgesteld` with the right `AiMotivatie`; no themadoelen created; committed once.
  - `Malformed_json_persisteert_niets_en_geeft_een_fout` — garbage completion ⇒ result failure, `Doelsuggesties` empty, `BewaarAsync` **not** called (Art. IV.5).
  - `Een_code_buiten_de_geladen_set_wordt_overgeslagen_niet_verzonnen` — unknown code skipped into `OvergeslagenOnbekend`, never fabricated (Art. III.5).
  - `Een_reeds_gekoppelde_code_wordt_niet_gedupliceerd` — idempotency vs existing themadoel.
  - `Gepersisteerde_suggesties_zijn_queryeerbaar_per_thema` — query path returns the persisted `Voorgesteld` view.
  - `Een_lege_geldige_lijst_persisteert_niets_maar_slaagt`; `Onbekend_thema_gooit_ThemaNietGevondenFout`; `Service_verwerpt_null_afhankelijkheden`.
  - `DoelMatchOpslagTests` — real EF mapping (in-memory provider) round-trip: suggestions persist as `Voorgesteld` and are queryable per thema; empty list for an unknown thema.
  - `SchoolContentModelConfigurationTests.Thema_owns_the_ai_doelsuggesties_in_their_own_table` — owned collection mapped to `thema_doelsuggesties`, status-by-name, FK to leerplandoel.

- **Gates:** `dotnet build` ✓ (0 errors; pre-existing NU1903 OpenApi warning only) · `dotnet test` ✓ **285 passed** (273 unit + 12 integration), 0 failed · `dotnet format --verify-no-changes` ✓ (exit 0). Frontend gates: N/A (backend-only story).
- **Branch:** story/E2-04

- **Self-check vs acceptance criteria (Done when: suggestions are stored and queryable per thema/activiteit):**
  - *Stored as `voorgesteld` + aiMotivatie* → met; `VoegDoelsuggestieToe` enforces `Voorgesteld`, motivatie carried; proven by `Geldige_suggesties_...` + EF round-trip.
  - *Queryable per thema* → met; `HaalSuggestiesVoorThemaAsync` + `DoelMatchOpslagTests`.
  - *Never auto-applied (Art. IV.2)* → met; only `voorgesteld` is ever written; no path sets aanvaard/geweigerd here.
  - *Invalid AI output persists nothing (Art. IV.5)* → met; `Malformed_json_...`.

- **For the test-runner:** **Unit + EF round-trip only** — no HTTP endpoint was added (scope 3 asked for a service/repository query path, not an API route), so **no Playwright** applies. Verify by running `cd backend && dotnet test`; the proving tests are `Jaarplanner.UnitTests.Ai.DoelMatchingServiceTests` (end-to-end flow against `FakeAiClient` + `FakeDoelMatchOpslag`, no network/DB) and `Jaarplanner.UnitTests.Ai.DoelMatchOpslagTests` (real EF mapping round-trip, in-memory provider). The whole flow is exercised without network or Postgres.

- **Open questions / Art. XIV touched:** The **granularity/attachment point** of AI match suggestions is effectively an open decision (the pipeline is whole-thema + flat response). I isolated it behind the `Thema.Doelsuggesties` collection + `IDoelMatchOpslag` seam rather than overloading `Themadoel` (cap) or guessing a subthema/activiteit target. If the directie/team later wants per-subthema (subdoel, Art. IV.8 step 6) or per-activiteit matching, the response contract would need a target field and this seam can route accordingly — no rework of the persisted shape (still a `DoelKoppeling`). Flagging for the orchestrator/antagonist to confirm the thema-level choice.
