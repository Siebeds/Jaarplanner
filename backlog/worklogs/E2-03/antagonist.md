# Antagonist Review — E2-03: Structured-JSON match response contract + validation

**Verdict:** COMPLIANT
**Scope audited:** branch `story/E2-03`, commit `b16c2b2` (diff vs `HEAD~1`). New files only:
- `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchSuggestie.cs`
- `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchParseResultaat.cs`
- `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchResponseParser.cs`
- `backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchResponseParserTests.cs`
- `backlog/worklogs/E2-03/implementation.md`

## Findings
None. No CRITICAL / MAJOR / MINOR violations found.

## Checks run (proof of thoroughness)

- **Shared-file claim (verified).** `git diff --stat HEAD~1 HEAD` shows exactly the 5 files above. `DoelMatchingService.cs`, `IAiClient.cs`, `AiRequest.cs`, `AiCompletion.cs`, `Infrastructure/DependencyInjection.cs` and every `.csproj` are UNTOUCHED by this commit. No new packages (`Application.csproj` unchanged; no Newtonsoft / FluentValidation anywhere — `git grep` = none). Claim confirmed.

- **Art. IV.5 — validate before use (core guarantee).** Verified there is no path for invalid AI output to become a validated/domain object:
  - Blank content -> `Ongeldig` (parser L48-51). Malformed JSON -> `JsonException` caught -> `Ongeldig` (L60-63). Root that is neither envelope nor array, or `suggesties` not an array -> `Deserialiseer` returns null -> `Ongeldig` (L65-69, L100-114). `null` item -> `Ongeldig` (L75-78). Missing/blank `code` or `motivatie` -> `Ongeldig` (L80-88).
  - `DoelMatchParseResultaat` has exactly two states: `Geldig` (validated list, `Fout` null) or `Ongeldig` (empty list + diagnostic). No third half-parsed state. Factory ctor is private; `Ongeldig` always uses the shared empty list.
  - All-or-nothing: the first bad item returns `Ongeldig` with an EMPTY list — good items parsed so far are discarded, not partially emitted (parser L72-92; pinned by test `One_bad_item_rejects_the_whole_response_so_no_partial_domain_state`).
  - Defense-in-depth: `DoelMatchSuggestie` ctor re-validates (`Require` throws `ArgumentException` on blank) so the type cannot exist invalid even if a caller bypasses the parser (test `Suggestie_constructor_enforces_required_fields`, `Suggestie_constructor` theory).

- **Art. IV — advisory / no fabrication.** Confirmed nothing is invented or defaulted. `NormaliseerRegel` only collapses internal whitespace/newlines into single spaces + trims (Suggestie L49-74) — never synthesises text. `StripMarkdownFence` only removes a leading/trailing ``` fence (parser L118-139). Unknown JSON fields are ignored, not backfilled. A missing code/motivatie is REJECTED, never defaulted. No status/persistence is set here (that is E2-04) — correct.

- **Art. III — curriculum integrity.** `Code` is treated as an opaque string; no reference-data mutation, no existence lookup against loaded `Leerplandoel` data (explicitly deferred to E2-04 per the type docs). Correct separation.

- **Art. VIII — layering & stack.** All three source files sit in `Jaarplanner.Application/AiMatching/Response`, depend only on `System.Text.Json` and `Jaarplanner.Application.Ai` (`AiCompletion`). No `Infrastructure`/`Api`/EF/HTTP leakage. `System.Text.Json` only — no smuggled Newtonsoft or validation library. The `RawSuggestie` deserialisation DTO is a private nested record that never leaves the parser file. Pragmatic (static stateless parser, no needless DI) — no over-engineering.

- **Art. II — domain language.** Domain-facing names are Dutch (`DoelMatchSuggestie`, `Suggesties`, `Motivatie`, `IsGeldig`, `Geldig`/`Ongeldig`, `Fout`). Technical helper names are also Dutch (`Deserialiseer`, `NormaliseerRegel`, `ruwe`, `Leeg`), which is consistent with the established house style on the same feature line (`DoelMatchingService.VraagSuggestiesAsync`). Not new drift. No user-facing strings introduced; `Fout` diagnostics are deliberately English and are not surfaced to the UI at this layer (any surfacing would go through `nl.json` downstream). No hard-coded Dutch UI text.

- **Scope creep (E2-04 boundary).** `git grep` confirms the new types are referenced ONLY within their own files and the test — NOT wired into `DoelMatchingService`, DI, or any persistence. No `DoelKoppeling`/EF/DbContext touch. Stayed strictly within its own files.

- **Art. X — Definition of Done.** `dotnet test` (filter `DoelMatchResponseParserTests`): 21 passed / 0 failed. `dotnet format --verify-no-changes` on the Response folder: clean (no output). Change is small (3 source files + 1 focused test file) and reviewable. No secrets.

## Open questions surfaced
None. The change touches no Art. XIV open decision and hard-assumes no unresolved answer (planningsblok granularity, disciplines, etc. are untouched).
