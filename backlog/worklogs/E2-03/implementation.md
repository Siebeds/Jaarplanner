# E2-03 — Structured-JSON response contract + validation

## Build round 1 — response contract + standalone parser/validator

- **FR / Article:** FR-4 (AI-matching); Constitution **Art. IV.5** (AI calls always request structured
  JSON and the response is validated before use — invalid output never reaches the domain), with
  Art. IV.1/IV.2/IV.3 context (advisory, status persisted, one-line motivation).

- **Files changed (all new, in my own subfolder — no shared-file edits):**
  - `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchSuggestie.cs` — the validated
    suggestion DTO (opaque leerplandoel `Code` + one-line `Motivatie`); validating constructor so the
    type can never exist in an invalid state; this is the exact shape E2-04 persists as a
    `DoelKoppeling` (`voorgesteld` + `aiMotivatie`).
  - `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchParseResultaat.cs` — explicit
    result type (`IsGeldig` + validated `Suggesties` **or** a diagnostic `Fout` + empty list). Result
    type, not exception, because malformed model output is a routine, expected case.
  - `backend/src/Jaarplanner.Application/AiMatching/Response/DoelMatchResponseParser.cs` — stateless
    static parser/validator turning a raw `AiCompletion` into a `DoelMatchParseResultaat`.
  - `backend/tests/Jaarplanner.UnitTests/Ai/DoelMatchResponseParserTests.cs` — 21 tests (see below).

- **Key decisions:**
  - **No DI registration, no shared-file edits.** The parser is a pure static/stateless function, so
    `DependencyInjection.cs` was **not** touched. I did **not** modify `DoelMatchingService.cs`,
    `IAiClient.cs`, `AiRequest.cs`, or `AiCompletion.cs` (E2-01/E2-04/E2-02 boundaries). Wiring the
    validated response into the service flow is explicitly E2-04's job.
  - **New `AiMatching/Response/` subfolder + distinct file names** to avoid any path collision with the
    concurrent E2-02 prompt-builder work.
  - **`System.Text.Json` only** — no new packages (no Newtonsoft, no JSON-schema library).
  - **Codes are opaque here.** I validate shape (present, non-blank), not existence against loaded
    `Leerplandoel` data — the DB lookup is downstream (E2-04), per the story guidance.
  - **Accepted contract:** envelope `{ "suggesties": [ { "code", "motivatie" } ] }` *or* a bare
    top-level array. An empty array is a **valid** success (model found no matches) — mirrors the
    E2-01 fake's canned `{"suggesties":[]}`.

- **Validation rules (reject) + conservative repair:**
  - Reject: blank/whitespace content; malformed/non-JSON; a root that is neither the envelope nor an
    array; an envelope missing its `suggesties` array; a `null` array item; any item with a
    missing/blank `code` or `motivatie`. One bad item fails the **whole** parse (no silent dropping →
    no partial domain state).
  - Repair (conservative, never fabricates): strip a leading/trailing markdown ```` ```json ```` fence;
    trim surrounding whitespace; case-insensitive property matching; tolerate unknown extra fields;
    collapse internal line breaks / whitespace runs in the motivation to keep it "one-line".

- **The guarantee (Art. IV.5):** a caller gets **either** `IsGeldig == true` with fully validated
  `DoelMatchSuggestie` objects **or** `IsGeldig == false` with an empty suggestion list and a
  diagnostic — there is no half-parsed third state. Double safety: even if the parser's field checks
  were bypassed, `DoelMatchSuggestie`'s constructor throws on a blank code/motivation, so an invalid
  suggestion object cannot be constructed at all.

- **Tests added (21, xUnit, no network):**
  - Valid envelope → validated objects; bare array accepted; empty `suggesties` → valid, zero
    suggestions; unknown extra fields tolerated.
  - Repair: markdown-fenced JSON accepted; multiline motivation collapsed to one line.
  - Reject: blank/empty/whitespace content (Theory); malformed JSON; object without `suggesties`;
    missing/empty `code`; missing/empty `motivatie`; `null` item; one bad item rejects the whole
    response (no partial state); `null` completion throws `ArgumentNullException`.
  - Type-level invariant: `DoelMatchSuggestie` constructor throws on blank fields (Theory).

- **Gates:** `dotnet build` ✓ (0 errors; pre-existing NU1903 OpenApi warnings only, unrelated) ·
  `dotnet test` (UnitTests) ✓ 259 passed (21 new) · `dotnet format --verify-no-changes` ✓ (exit 0).
  Frontend gates N/A — backend-only story.

- **Branch:** story/E2-03 (based on `feature/e1-curriculum-content`, which carries E1 + the E2-01
  seam; the assigned worktree branch pointed at the E0 commit, so I re-based onto the feature line).

- **Self-check vs acceptance criteria (*Done when:* invalid AI output never reaches the domain;
  validated objects only):**
  - Invalid output → explicit failure, empty suggestion list: proven by the 11 rejection tests →
    **met**.
  - Validated objects only: `DoelMatchSuggestie` has a validating constructor + the parser returns a
    result type; no half-parsed object path exists → **met**.

- **For the test-runner:** pure unit story, **no Playwright / no API route** yet (not wired into the
  service — that's E2-04). Verify by running:
  `cd backend && dotnet test tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~DoelMatchResponseParserTests"`
  (21 tests). Proving tests for the guarantee: `Malformed_json_is_rejected`,
  `Missing_code_field_is_rejected`, `Empty_motivatie_field_is_rejected`,
  `One_bad_item_rejects_the_whole_response_so_no_partial_domain_state`,
  `Suggestie_constructor_enforces_required_fields`.

- **Open questions / Art. XIV touched:** none. The exact JSON field names (`suggesties`/`code`/
  `motivatie`) should stay in sync with the E2-02 prompt-builder's requested output format; the parser
  is case-insensitive and both-shape tolerant to reduce coupling, but a final alignment check at
  merge time is worth a glance.
