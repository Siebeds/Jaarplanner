# E2-03 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit (xUnit)

## Story & Done-when
Define the response schema (goal codes + one-line motivation); validate before use;
reject/repair malformed output.
*Done when:* invalid AI output never reaches the domain; validated objects only. (Art. IV.5)

## Criteria checked
- "invalid AI output never reaches the domain" → PASS
  - Malformed JSON → `Malformed_json_is_rejected` (IsGeldig=false, Suggesties empty, Fout set).
  - Missing `code` → `Missing_code_field_is_rejected`; empty `code` → `Empty_code_field_is_rejected`.
  - Missing `motivatie` → `Missing_motivatie_field_is_rejected`; empty → `Empty_motivatie_field_is_rejected`.
  - Blank content (null/""/"   ") → `Blank_content_is_rejected` (Theory, 3 cases).
  - Root neither envelope nor array → `Object_without_suggesties_array_is_rejected`.
  - Null array item → `Null_item_in_array_is_rejected`.
  - One bad item fails the WHOLE parse (no partial domain state) →
    `One_bad_item_rejects_the_whole_response_so_no_partial_domain_state` (Suggesties empty, not the one valid item).
- "validated objects only" → PASS
  - `DoelMatchSuggestie` has only a validating constructor (`Require` throws `ArgumentException`
    on blank code/motivatie); no init-setters, so it cannot exist invalid →
    `Suggestie_constructor_enforces_required_fields` (Theory, 3 cases).
  - `DoelMatchResponseParser.Parse` builds each suggestion via that constructor (line 91), so the
    type-level guarantee is on the only success path.
  - `DoelMatchParseResultaat` is a two-state result (Geldig with list OR Ongeldig with empty list +
    Fout) — no third half-parsed state. On any failure it returns `Leeg` (empty).
- "reject/repair malformed output — repair never fabricates" → PASS
  - `StripMarkdownFence` only strips a leading/trailing ``` fence → `Markdown_fenced_json_is_repaired_and_accepted`.
  - `NormaliseerRegel` only collapses internal whitespace/newlines to single spaces →
    `Multiline_motivatie_is_collapsed_to_one_line` ("Regel een.\n  Regel twee." → "Regel een. Regel twee.").
  - `Require` only trims. Unknown fields tolerated (ignored) → `Unknown_extra_fields_are_tolerated`.
  - No code path invents `code`/`motivatie`; empty stays empty and is rejected.

## Commands run
- `dotnet build` (backend/Jaarplanner.sln) → Build succeeded, 0 errors (4 NU1903 warnings, pre-existing Microsoft.OpenApi advisory, unrelated).
- `dotnet test tests/Jaarplanner.UnitTests --no-build` → Passed 259 / Failed 0 / Skipped 0.
- `dotnet test --filter DoelMatchResponseParserTests` → Passed 21 / Failed 0 (17 methods; theories expand to 21 cases). Matches the implementer's "21 tests" claim.

## Evidence
- Parser: backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchResponseParser.cs
- DTO (validating ctor): .../Response/DoelMatchSuggestie.cs (Require throws; Code/Motivatie get-only)
- Result type: .../Response/DoelMatchParseResultaat.cs (Geldig/Ongeldig, empty on failure)
- Tests: backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchResponseParserTests.cs

## Findings (non-blocking for E2-03)
- [info] Integration-alignment check could NOT be performed as briefed: the task said this branch
  carries E2-02 and named `backend/src/Jaarplanner.Application/AiMatching/MatchingPromptBuilder.cs`,
  but that file does not exist. Git log confirms E2-02 was only "claim (in progress)" (commit 3d6776a)
  in a parallel wave and never landed on this branch; the newest commit is b16c2b2 (E2-03). There is
  no prompt builder / SystemPrompt asserting a JSON shape anywhere in the worktree.
  This does NOT affect E2-03's acceptance (E2-03 is a self-contained parser/validator).
  Forward note for the orchestrator: when E2-02 lands, verify its SystemPrompt asks the model for the
  envelope `{ "suggesties": [ { "code": "...", "motivatie": "..." } ] }` (or a bare array of the same
  items). The parser is lenient (case-insensitive, accepts envelope OR bare array, tolerates unknown
  fields, strips markdown fence), so most reasonable prompt phrasings will parse — but the field names
  `code` and `motivatie` are load-bearing and must match. This is the seam E2-04 relies on.

## Defects
- None.
