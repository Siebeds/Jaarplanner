# E2-02 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit (xUnit)

## Criteria checked
- "prompt contains only school + Op.stap data" → PASS — `MatchingPromptBuilder.BouwUserPrompt` renders the user prompt exclusively from its arguments (Thema + Leerplandoel[] + optional Minimumdoel[]). The only non-data text is the fixed `SystemPrompt` const, which forbids external sources ("Gebruik geen externe kennis, geen internet en geen andere bronnen. Verzin geen leerplandoelen, codes, voorbeelden of woordenschat."). Grounding test `Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data` asserts every supplied datum appears AND that no `http`/`wikipedia`/external-source text leaks in.
- "snapshot-tested" → PASS — `Bouwt_de_verwachte_grounded_prompt` pins the entire built prompt: `Assert.Equal(SystemPrompt, request.SystemPrompt)` and `Assert.Equal(verwacht, request.UserPrompt)` against a full hard-coded expected string (byte-for-byte, explicit `\n`).
- Deterministic (no order leak) → PASS — `Is_deterministisch_ongeacht_leerdoelvolgorde` proves reversed input yields identical output; builder sorts leerdoelen by `Code` and minimumdoelen by `Ref` (StringComparer.Ordinal).

## Purity / grounding confirmation
- `MatchingPromptBuilder` is a pure static function: uses only `StringBuilder`, LINQ `OrderBy`, `string.Join`. No `DateTime`/clock, no `Random`, no `HttpClient`/network, no file/DB IO, no config/env reads.
- `AiRequest` is a `sealed record` with two string props — a pure envelope, no side effects.

## Commands run
- `dotnet build` → Build succeeded, 0 errors (4 warnings: pre-existing NU1903 Microsoft.OpenApi advisory, unrelated to this story).
- `dotnet test tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj` → Passed! Failed: 0, Passed: 243, Skipped: 0, Total: 243.
- `dotnet test --filter MatchingPromptBuilderTests` → Passed! 5/5 (Bouwt_de_verwachte_grounded_prompt, Prompt_bevat_enkel_de_aangeleverde_school_en_opstap_data, Is_deterministisch_ongeacht_leerdoelvolgorde, Minimumdoelen_sectie_ontbreekt_wanneer_geen_minimumdoelen_meegegeven, Verwerpt_null_argumenten).

## Evidence
- 243 total unit tests pass (matches implementer's claim); 5 new MatchingPromptBuilder tests confirmed present and green.
- Snapshot ("Done when") proven by `Bouwt_de_verwachte_grounded_prompt`.

## Defects
- None.
